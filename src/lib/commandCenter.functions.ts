/**
 * NUVIA Command Center — Fase 7.5
 *
 * ServerFns consolidadas del Command Center:
 *   - Metas (empresa / área / persona) CRUD + progreso
 *   - Scoreboard (ejecutivo: nominal; resto: anonimizado + posición personal)
 *   - Health Score (lectura snapshot diario)
 *   - Métricas ejecutivas (lectura snapshot diario)
 *   - Oportunidades / Riesgos (lectura on-demand, no IA)
 *   - Forecast (proyección lineal sobre snapshot)
 *   - Copilot Ejecutivo (Gemini Flash vía Lovable Gateway, solo recomienda)
 *
 * Reglas oficiales:
 *   - Filtrado nominal SIEMPRE en servidor.
 *   - Auditoría de acceso nominal vía acceso_auditoria.
 *   - Sin nombres de colaboradores en prompts IA para roles no directivos.
 *   - Cero escritura en módulos congelados.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ROLES_EJECUTIVOS = [
  "super_admin",
  "admin",
  "gerencia",
  "director_financiero_qa",
  "director_juridico",
] as const;

// ============================================================
// Tipos públicos
// ============================================================

export type GoalNivel = "empresa" | "area" | "persona";
export type GoalTipo =
  | "honorarios"
  | "ahorro"
  | "casos_cerrados"
  | "conversion"
  | "cartera_recuperada";

export interface MonthlyGoal {
  id: string;
  periodo: string; // YYYY-MM-DD primer día mes
  nivel: GoalNivel;
  area: string | null;
  responsable_id: string | null;
  responsable_nombre?: string | null;
  tipo: GoalTipo;
  valor_meta: number;
  unidad: string;
  valor_real?: number;
  cumplimiento_pct?: number;
  proyectado?: number;
  notas: string | null;
}

export interface ScoreboardEntry {
  rank: number;
  score: number;
  percentil: number;
  promedio_area: number | null;
  tendencia: "mejora" | "estable" | "deterioro" | null;
  kpis: Record<string, number>;
  // Solo presentes en modo nominal:
  usuario_id?: string;
  display_name?: string;
}

export interface ScoreboardPayload {
  fecha: string;
  area: string;
  viewMode: "nominal" | "anonimo";
  entries: ScoreboardEntry[];
  // Solo modo anónimo: foco en el caller
  yourPosition?: {
    rank: number;
    total: number;
    score: number;
    percentil: number;
    promedio_area: number | null;
    tendencia: "mejora" | "estable" | "deterioro" | null;
  } | null;
}

export interface HealthScorePayload {
  fecha: string;
  score: number;
  estado: "excelente" | "saludable" | "atencion" | "riesgo" | "critico";
  tendencia: "mejora" | "estable" | "deterioro" | null;
  componentes: {
    produccion: number;
    conversion: number;
    cartera: number;
    sla: number;
    actividad: number;
  };
  fresh: boolean;
}

export interface CopilotRecommendation {
  id: string;
  tipo: "reasignar" | "contactar" | "acelerar" | "cobrar" | "revisar";
  severidad: "info" | "warning" | "danger";
  titulo: string;
  narrativa: string;
  impacto_estimado: string | null;
  cta_label: string | null;
}

export interface CopilotPayload {
  prompt: string;
  generatedAt: string;
  recomendaciones: CopilotRecommendation[];
}

// ============================================================
// Helpers
// ============================================================

async function assertExecutive(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  return roles.some((r: string) =>
    (ROLES_EJECUTIVOS as readonly string[]).includes(r),
  );
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function monthStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function healthEstado(score: number): HealthScorePayload["estado"] {
  if (score >= 90) return "excelente";
  if (score >= 75) return "saludable";
  if (score >= 60) return "atencion";
  if (score >= 40) return "riesgo";
  return "critico";
}

async function auditNominalAccess(
  supabase: any,
  userId: string,
  accion: string,
  detalle: Record<string, unknown>,
) {
  try {
    await supabase.from("acceso_auditoria").insert({
      user_id: userId,
      actor_id: userId,
      accion,
      detalle: detalle as any,
    });
  } catch {
    // auditoría best-effort; no bloquea
  }
}

// ============================================================
// METAS — listar
// ============================================================

const ListGoalsInput = z.object({
  periodo: z.string().optional(), // YYYY-MM-DD
  nivel: z.enum(["empresa", "area", "persona"]).optional(),
});

export const listGoals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListGoalsInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const periodo = data.periodo ?? monthStart();
    const isExec = await assertExecutive(supabase, userId);

    let query = supabase
      .from("monthly_goals")
      .select("id, periodo, nivel, area, responsable_id, tipo, valor_meta, unidad, notas")
      .eq("periodo", periodo);

    if (data.nivel) query = query.eq("nivel", data.nivel);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Calcular avance real contra snapshot ejecutivo del día
    const { data: metricsRow } = await supabase
      .from("executive_metrics_daily")
      .select("metrics_json")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    const m = (metricsRow?.metrics_json as any) ?? {};
    const realByTipo: Record<GoalTipo, number> = {
      honorarios: num(m.honorarios_mtd),
      ahorro: num(m.ahorro_mtd),
      casos_cerrados: num(m.casos_cerrados_mtd),
      conversion: num(m.conversion_mtd),
      cartera_recuperada: num(m.cartera_recuperada_mtd),
    };

    // Nombres responsables (solo si caller es ejecutivo)
    let nombreMap: Record<string, string> = {};
    if (isExec) {
      const ids = [...new Set((rows ?? []).map((r) => r.responsable_id).filter(Boolean))];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre_completo, email")
          .in("id", ids as string[]);
        nombreMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [
            p.id,
            (p.nombre_completo as string) || (p.email as string) || "Colaborador",
          ]),
        );
      }
    }

    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const goals: MonthlyGoal[] = (rows ?? []).map((r) => {
      const valor_real =
        r.nivel === "empresa" ? realByTipo[r.tipo as GoalTipo] : 0; // Persona/Área: requiere desglose futuro
      const meta = num(r.valor_meta);
      const cumplimiento_pct = meta > 0 ? Math.round((valor_real / meta) * 100) : 0;
      const proyectado = valor_real > 0 ? (valor_real / day) * daysInMonth : 0;
      return {
        id: r.id as string,
        periodo: r.periodo as string,
        nivel: r.nivel as GoalNivel,
        area: (r.area as string) ?? null,
        responsable_id: (r.responsable_id as string) ?? null,
        responsable_nombre: r.responsable_id ? nombreMap[r.responsable_id as string] ?? null : null,
        tipo: r.tipo as GoalTipo,
        valor_meta: meta,
        unidad: (r.unidad as string) ?? "COP",
        valor_real,
        cumplimiento_pct,
        proyectado,
        notas: (r.notas as string) ?? null,
      };
    });

    return { periodo, goals };
  });

// ============================================================
// METAS — crear / editar / borrar (solo ejecutivos)
// ============================================================

const UpsertGoalInput = z.object({
  id: z.string().uuid().optional(),
  periodo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nivel: z.enum(["empresa", "area", "persona"]),
  area: z.string().min(1).max(80).nullable().optional(),
  responsable_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(["honorarios", "ahorro", "casos_cerrados", "conversion", "cartera_recuperada"]),
  valor_meta: z.number().min(0),
  unidad: z.string().min(1).max(20).default("COP"),
  notas: z.string().max(500).nullable().optional(),
});

export const upsertGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertGoalInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");

    const base = {
      periodo: data.periodo,
      nivel: data.nivel,
      area: data.area ?? null,
      responsable_id: data.responsable_id ?? null,
      tipo: data.tipo,
      valor_meta: data.valor_meta,
      unidad: data.unidad ?? "COP",
      notas: data.notas ?? null,
    };

    if (data.id) {
      const { error } = await supabase.from("monthly_goals").update(base).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("monthly_goals")
      .insert({ ...base, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id as string };
  });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");
    const { error } = await supabase.from("monthly_goals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// HEALTH SCORE — lectura snapshot
// ============================================================

export const getHealthScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");

    const { data, error } = await supabase
      .from("health_score_daily")
      .select("fecha, score, componentes_json, estado, tendencia, calculated_at")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!data) {
      // Snapshot aún no calculado — devolver estado vacío
      const payload: HealthScorePayload = {
        fecha: new Date().toISOString().slice(0, 10),
        score: 0,
        estado: "atencion",
        tendencia: null,
        componentes: { produccion: 0, conversion: 0, cartera: 0, sla: 0, actividad: 0 },
        fresh: false,
      };
      return payload;
    }
    const c = (data.componentes_json as any) ?? {};
    return {
      fecha: data.fecha as string,
      score: num(data.score),
      estado: data.estado as HealthScorePayload["estado"],
      tendencia: (data.tendencia as HealthScorePayload["tendencia"]) ?? null,
      componentes: {
        produccion: num(c.produccion),
        conversion: num(c.conversion),
        cartera: num(c.cartera),
        sla: num(c.sla),
        actividad: num(c.actividad),
      },
      fresh: true,
    } satisfies HealthScorePayload;
  });

// ============================================================
// SCOREBOARD — nominal (gerencia) / anónimo (resto)
// ============================================================

const ScoreboardInput = z.object({
  area: z.string().min(1).max(50),
  fecha: z.string().optional(), // por defecto último snapshot
});

const AREAS_VALIDAS = ["comercial", "analisis", "juridica", "operaciones", "cartera"] as const;

export const getScoreboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ScoreboardInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isExec = await assertExecutive(supabase, userId);
    const area = data.area.toLowerCase();
    if (!(AREAS_VALIDAS as readonly string[]).includes(area)) {
      throw new Error("Área inválida");
    }

    // Fecha del último snapshot disponible
    let fecha = data.fecha;
    if (!fecha) {
      const { data: last } = await supabase
        .from("scoreboard_snapshot_daily")
        .select("fecha")
        .eq("area", area)
        .order("fecha", { ascending: false })
        .limit(1)
        .maybeSingle();
      fecha = (last?.fecha as string) ?? new Date().toISOString().slice(0, 10);
    }

    const { data: rows, error } = await supabase
      .from("scoreboard_snapshot_daily")
      .select("usuario_id, score, posicion, percentil, promedio_area, tendencia, kpis_json")
      .eq("fecha", fecha)
      .eq("area", area)
      .order("posicion", { ascending: true });
    if (error) throw new Error(error.message);

    const all = rows ?? [];

    if (isExec) {
      // Modo nominal
      await auditNominalAccess(supabase, userId, "scoreboard_nominal", { area, fecha });
      const ids = all.map((r) => r.usuario_id as string).filter(Boolean);
      let nombreMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre_completo, email")
          .in("id", ids);
        nombreMap = Object.fromEntries(
          (profs ?? []).map((p: any) => [
            p.id,
            (p.nombre_completo as string) || (p.email as string) || "Colaborador",
          ]),
        );
      }
      const entries: ScoreboardEntry[] = all.map((r) => ({
        rank: r.posicion as number,
        score: num(r.score),
        percentil: r.percentil as number,
        promedio_area: r.promedio_area != null ? num(r.promedio_area) : null,
        tendencia: (r.tendencia as ScoreboardEntry["tendencia"]) ?? null,
        kpis: (r.kpis_json as any) ?? {},
        usuario_id: r.usuario_id as string,
        display_name: nombreMap[r.usuario_id as string] ?? "Colaborador",
      }));
      return {
        fecha,
        area,
        viewMode: "nominal" as const,
        entries,
      } satisfies ScoreboardPayload;
    }

    // Modo anónimo: solo posición/percentil de TODOS sin nombre + foco caller
    const mine = all.find((r) => r.usuario_id === userId);
    const entries: ScoreboardEntry[] = all.map((r) => ({
      rank: r.posicion as number,
      score: num(r.score),
      percentil: r.percentil as number,
      promedio_area: r.promedio_area != null ? num(r.promedio_area) : null,
      tendencia: (r.tendencia as ScoreboardEntry["tendencia"]) ?? null,
      kpis: {}, // no exponer KPIs detallados de terceros
    }));
    return {
      fecha,
      area,
      viewMode: "anonimo" as const,
      entries,
      yourPosition: mine
        ? {
            rank: mine.posicion as number,
            total: all.length,
            score: num(mine.score),
            percentil: mine.percentil as number,
            promedio_area: mine.promedio_area != null ? num(mine.promedio_area) : null,
            tendencia: (mine.tendencia as ScoreboardEntry["tendencia"]) ?? null,
          }
        : null,
    } satisfies ScoreboardPayload;
  });

// ============================================================
// OPORTUNIDADES — top casos (lectura on-demand, no IA)
// ============================================================

export const getTopOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");

    const { data: honos } = await supabase
      .from("honorarios_calculos")
      .select("id, expediente_id, ahorro_total, honorario_ofertado, created_at")
      .order("ahorro_total", { ascending: false, nullsFirst: false })
      .limit(20);

    const expIds = [...new Set((honos ?? []).map((h) => h.expediente_id).filter(Boolean))] as string[];
    let expMap: Record<string, any> = {};
    if (expIds.length) {
      const { data: exps } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco, estado_caso, updated_at")
        .in("id", expIds);
      expMap = Object.fromEntries((exps ?? []).map((e: any) => [e.id, e]));
    }

    const enriched = (honos ?? [])
      .map((h) => {
        const e = expMap[h.expediente_id as string] ?? {};
        const diasEstancado = e.updated_at
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(e.updated_at as string).getTime()) / 86400000),
            )
          : 0;
        return {
          caso_id: h.expediente_id as string,
          cliente: (e.cliente_nombre as string) ?? "—",
          banco: (e.banco as string) ?? null,
          etapa: (e.estado_caso as string) ?? null,
          ahorro_potencial: num(h.ahorro_total),
          honorario_potencial: num(h.honorario_ofertado),
          dias_estancado: diasEstancado,
        };
      });

    const mayor_ahorro = [...enriched].sort((a, b) => b.ahorro_potencial - a.ahorro_potencial).slice(0, 5);
    const mayor_honorario = [...enriched]
      .sort((a, b) => b.honorario_potencial - a.honorario_potencial)
      .slice(0, 5);
    const estancados_valor = [...enriched]
      .filter((x) => x.dias_estancado >= 7 && x.honorario_potencial > 0)
      .sort((a, b) => b.honorario_potencial * b.dias_estancado - a.honorario_potencial * a.dias_estancado)
      .slice(0, 5);

    return { mayor_ahorro, mayor_honorario, estancados_valor };
  });

// ============================================================
// RIESGOS — agrupados (lectura on-demand)
// ============================================================

export const getRiskGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");

    const cutoff = (dias: number) => new Date(Date.now() - dias * 86400000).toISOString();

    const [sinMov, cartera90, slaVenc, docsInc] = await Promise.all([
      supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco, estado_caso, updated_at")
        .not("estado_caso", "in", "(perdido,cerrado)")
        .lt("updated_at", cutoff(15))
        .order("updated_at", { ascending: true })
        .limit(10),
      supabase
        .from("cartera")
        .select("id, expediente_id, honorarios_totales, pagado, fecha_vencimiento")
        .lt("fecha_vencimiento", new Date(Date.now() - 90 * 86400000).toISOString())
        .limit(10),
      supabase
        .from("expedientes")
        .select("id, cliente_nombre, estado_caso, fecha_sla, updated_at")
        .not("fecha_sla", "is", null)
        .lt("fecha_sla", new Date().toISOString())
        .not("estado_caso", "in", "(perdido,cerrado)")
        .limit(10),
      supabase
        .from("expediente_checklist_documentos")
        .select("expediente_id, estado")
        .eq("estado", "pendiente")
        .limit(20),
    ]);

    return {
      sin_movimiento: (sinMov.data ?? []).map((r: any) => ({
        id: r.id,
        cliente: r.cliente_nombre ?? "—",
        banco: r.banco ?? null,
        dias: r.updated_at
          ? Math.floor((Date.now() - new Date(r.updated_at).getTime()) / 86400000)
          : null,
        etapa: r.estado_caso ?? null,
      })),
      cartera_critica: (cartera90.data ?? []).map((r: any) => ({
        id: r.id,
        expediente_id: r.expediente_id,
        pendiente: Math.max(0, num(r.honorarios_totales) - num(r.pagado)),
        vencimiento: r.fecha_vencimiento,
      })),
      sla_vencidos: (slaVenc.data ?? []).map((r: any) => ({
        id: r.id,
        cliente: r.cliente_nombre ?? "—",
        etapa: r.estado_caso ?? null,
        fecha_sla: r.fecha_sla,
      })),
      docs_incompletos_count: (docsInc.data ?? []).length,
    };
  });

// ============================================================
// FORECAST — proyección lineal sobre snapshot ejecutivo
// ============================================================

export const getForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await assertExecutive(supabase, userId))) throw new Error("Forbidden");

    const { data: snap } = await supabase
      .from("executive_metrics_daily")
      .select("metrics_json, fecha")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const factor = daysInMonth / Math.max(1, day);

    const m = (snap?.metrics_json as any) ?? {};
    const project = (real: number) => Math.round(num(real) * factor);

    return {
      fecha: (snap?.fecha as string) ?? now.toISOString().slice(0, 10),
      fresh: !!snap,
      metricas: [
        { key: "honorarios", label: "Honorarios", real: num(m.honorarios_mtd), proyectado: project(m.honorarios_mtd), unidad: "COP" },
        { key: "ahorro", label: "Ahorro generado", real: num(m.ahorro_mtd), proyectado: project(m.ahorro_mtd), unidad: "COP" },
        { key: "casos_cerrados", label: "Casos cerrados", real: num(m.casos_cerrados_mtd), proyectado: project(m.casos_cerrados_mtd), unidad: "casos" },
        { key: "conversion", label: "Conversión", real: num(m.conversion_mtd), proyectado: num(m.conversion_mtd), unidad: "%" },
        { key: "cartera_recuperada", label: "Cartera recuperada", real: num(m.cartera_recuperada_mtd), proyectado: project(m.cartera_recuperada_mtd), unidad: "COP" },
      ],
    };
  });

// ============================================================
// COPILOT EJECUTIVO — Gemini Flash, solo recomienda
// ============================================================

const CopilotInput = z.object({
  prompt: z.string().min(3).max(500),
});

const PROMPT_SUGGESTIONS = [
  "¿Qué debería hacer esta semana?",
  "¿Dónde estoy perdiendo dinero?",
  "¿Quién necesita apoyo?",
  "¿Qué honorarios debo cobrar ya?",
] as const;

export const askCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CopilotInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const isExec = await assertExecutive(supabase, userId);
    if (!isExec) throw new Error("Forbidden");

    // Snapshot agregado (sin PII de clientes ni nombres de colaboradores)
    const { data: metricsSnap } = await supabase
      .from("executive_metrics_daily")
      .select("metrics_json, fecha")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: healthSnap } = await supabase
      .from("health_score_daily")
      .select("score, estado, componentes_json")
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapshot = {
      fecha: metricsSnap?.fecha ?? new Date().toISOString().slice(0, 10),
      metricas: metricsSnap?.metrics_json ?? {},
      health_score: healthSnap?.score ?? null,
      health_estado: healthSnap?.estado ?? null,
      health_componentes: healthSnap?.componentes_json ?? {},
    };

    let recomendaciones: CopilotRecommendation[] = [];
    let modelo: string | null = null;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;

    if (LOVABLE_API_KEY) {
      modelo = "google/gemini-3-flash-preview";
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelo,
            messages: [
              {
                role: "system",
                content:
                  "Eres NUVIA Copilot Ejecutivo, un Director de Operaciones virtual. " +
                  "Recibes un snapshot agregado (sin datos personales) y la pregunta de un director. " +
                  "Devuelves entre 3 y 5 recomendaciones priorizadas en JSON estricto. " +
                  "NUNCA ejecutas acciones, solo recomiendas. " +
                  "NUNCA mencionas nombres de colaboradores ni clientes específicos. " +
                  'Formato: {"recomendaciones":[{id, tipo (reasignar|contactar|acelerar|cobrar|revisar), severidad (info|warning|danger), titulo, narrativa, impacto_estimado (string o null), cta_label (string o null)}]}. ' +
                  "Responde SOLO con JSON.",
              },
              {
                role: "user",
                content: `Pregunta: ${data.prompt}\n\nSnapshot:\n${JSON.stringify(snapshot)}`,
              },
            ],
            temperature: 0.2,
          }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as any;
          const txt: string = json?.choices?.[0]?.message?.content ?? "";
          const cleaned = txt.replace(/^```json|```$/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed?.recomendaciones)) {
              recomendaciones = parsed.recomendaciones.slice(0, 5).map((r: any, i: number) => ({
                id: String(r.id ?? `rec-${i}`),
                tipo: ["reasignar", "contactar", "acelerar", "cobrar", "revisar"].includes(r.tipo)
                  ? r.tipo
                  : "revisar",
                severidad: ["info", "warning", "danger"].includes(r.severidad) ? r.severidad : "info",
                titulo: String(r.titulo ?? "Recomendación").slice(0, 120),
                narrativa: String(r.narrativa ?? "").slice(0, 400),
                impacto_estimado: r.impacto_estimado ? String(r.impacto_estimado).slice(0, 80) : null,
                cta_label: r.cta_label ? String(r.cta_label).slice(0, 60) : null,
              }));
            }
          } catch {
            /* fallback */
          }
        } else if (resp.status === 429 || resp.status === 402) {
          throw new Error(
            resp.status === 429
              ? "El Copilot recibió demasiadas consultas. Intenta en unos minutos."
              : "Créditos de IA agotados. Solicita una recarga al administrador.",
          );
        }
      } catch (err: any) {
        if (err?.message?.startsWith("El Copilot") || err?.message?.startsWith("Créditos")) throw err;
        console.error("[copilot] gateway error", err);
      }
    }

    if (!recomendaciones.length) {
      recomendaciones = [
        {
          id: "fallback-1",
          tipo: "revisar",
          severidad: "info",
          titulo: "Revisa el pipeline activo",
          narrativa:
            "Aún no hay suficientes datos materializados o el modelo IA no está disponible. Revisa la pestaña de Oportunidades para priorizar manualmente.",
          impacto_estimado: null,
          cta_label: "Ver oportunidades",
        },
      ];
    }

    // Log auditoría
    await supabase.from("executive_copilot_log").insert({
      usuario_id: userId,
      prompt: data.prompt,
      contexto_json: snapshot as any,
      recomendaciones_json: recomendaciones as any,
      modelo,
    });

    return {
      prompt: data.prompt,
      generatedAt: new Date().toISOString(),
      recomendaciones,
    } satisfies CopilotPayload;
  });

export const getCopilotSuggestions = createServerFn({ method: "GET" }).handler(async () => {
  return { suggestions: [...PROMPT_SUGGESTIONS] };
});
