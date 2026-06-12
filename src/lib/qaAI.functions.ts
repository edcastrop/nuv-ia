import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditar, QA_MOTOR_VERSION, type Modalidad } from "./qaMath";

const ModalidadEnum = z.enum(["hipotecario", "leasing", "uvr"]);

const AuditarInputSchema = z.object({
  expedienteId: z.string().uuid().nullable().optional(),
  simulacionId: z.string().uuid().nullable().optional(),
  extractoId: z.string().uuid().nullable().optional(),
  analistaId: z.string().uuid().nullable().optional(),
  modalidad: ModalidadEnum,
  reconstruccion: z.object({
    saldoCapital: z.number().nonnegative(),
    tasaEa: z.number().nonnegative(),
    cuotasPendientes: z.number().int().nonnegative(),
    seguros: z.number().nonnegative().default(0),
    coberturaFrechPp: z.number().nonnegative().optional(),
    valorDesembolsado: z.number().nonnegative().optional(),
  }),
  extracto: z.object({
    saldoCapital: z.number().nonnegative().optional(),
    tasaEa: z.number().nonnegative().optional(),
    cuota: z.number().nonnegative().optional(),
    seguros: z.number().nonnegative().optional(),
    coberturaFrechPp: z.number().nonnegative().optional(),
  }).default({}),
  simulacion: z.object({
    cuotasEliminadas: z.number().optional(),
    ahorroProyectado: z.number().optional(),
    nuevoPlazo: z.number().optional(),
  }).optional(),
});

export const auditarCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuditarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const result = auditar({
      modalidad: data.modalidad as Modalidad,
      reconstruccion: {
        modalidad: data.modalidad as Modalidad,
        saldoCapital: data.reconstruccion.saldoCapital,
        tasaEa: data.reconstruccion.tasaEa,
        cuotasPendientes: data.reconstruccion.cuotasPendientes,
        seguros: data.reconstruccion.seguros,
        coberturaFrechPp: data.reconstruccion.coberturaFrechPp,
        valorDesembolsado: data.reconstruccion.valorDesembolsado,
      },
      extracto: data.extracto,
      simulacion: data.simulacion,
    });

    const { supabase, userId } = context;

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: data.expedienteId ?? null,
        analista_id: data.analistaId ?? null,
        simulacion_id: data.simulacionId ?? null,
        extracto_id: data.extractoId ?? null,
        modalidad: data.modalidad,
        motor_version: QA_MOTOR_VERSION,
        qa_score: result.score.score,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        inputs: JSON.parse(JSON.stringify(data)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
        })),
        diferencias: JSON.parse(JSON.stringify(result.inconsistencias)),
        alertas: JSON.parse(JSON.stringify(result.inconsistencias.filter((i) => i.severidad === "critica"))),
        ejecutado_by: userId,
      })
      .select("id")
      .single();
    if (errAud) throw new Error(errAud.message);
    const auditoriaId = aud!.id;

    if (result.inconsistencias.length) {
      await supabase.from("qa_inconsistencias").insert(
        result.inconsistencias.map((i) => ({
          auditoria_id: auditoriaId,
          tipo: i.tipo,
          severidad: i.severidad,
          campo: i.campo ?? null,
          valor_extracto: i.valorExtracto ?? null,
          valor_calculado: i.valorCalculado ?? null,
          diferencia: i.diferencia ?? null,
          mensaje: i.mensaje,
          sugerencia: i.sugerencia ?? null,
        })),
      );
      const criticas = result.inconsistencias.filter((i) => i.severidad === "critica");
      if (criticas.length) {
        await supabase.from("qa_alertas").insert(
          criticas.map((i) => ({
            auditoria_id: auditoriaId,
            expediente_id: data.expedienteId ?? null,
            tipo: i.tipo,
            severidad: i.severidad,
            mensaje: i.mensaje,
          })),
        );
      }
    }

    await supabase.from("qa_auditoria_log").insert({
      auditoria_id: auditoriaId,
      accion: "crear",
      payload: { score: result.score.score, dictamen: result.score.dictamen },
      user_id: userId,
    });

    return { auditoriaId, ...result };
  });

export const listAuditoriasQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().positive().max(500).default(100) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_auditorias")
      .select("id,expediente_id,analista_id,modalidad,qa_score,categoria,dictamen,ejecutado_at")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const obtenerAuditoriaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: aud, error } = await context.supabase
      .from("qa_auditorias").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: incs } = await context.supabase
      .from("qa_inconsistencias").select("*").eq("auditoria_id", data.id);
    return { auditoria: aud, inconsistencias: incs ?? [] };
  });

export const qaKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("qa_auditorias")
      .select("qa_score,dictamen,ejecutado_at")
      .order("ejecutado_at", { ascending: false })
      .limit(500);
    const r = rows ?? [];
    const total = r.length;
    const aprobados = r.filter((x) => x.dictamen === "aprobado").length;
    const obs = r.filter((x) => x.dictamen === "aprobado_obs").length;
    const rechazados = r.filter((x) => x.dictamen === "rechazado").length;
    const promedio = total ? r.reduce((s, x) => s + Number(x.qa_score || 0), 0) / total : 0;
    const { count: alertasAbiertas } = await context.supabase
      .from("qa_alertas").select("id", { count: "exact", head: true }).eq("estado", "abierta");
    return { total, aprobados, obs, rechazados, promedio, alertasAbiertas: alertasAbiertas ?? 0 };
  });

// ─────────────────────────────────────────────────────────────
// Reuso de extractos existentes (no recapturar datos)
// ─────────────────────────────────────────────────────────────
export const listExpedientesConExtracto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: extractos, error } = await context.supabase
      .from("extractos_lecturas")
      .select("id,expediente_id,banco,producto,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((extractos ?? []).map((e) => e.expediente_id).filter(Boolean))) as string[];
    const { data: exps } = ids.length
      ? await context.supabase.from("expedientes").select("id,codigo,cliente_nombre").in("id", ids)
      : { data: [] as Array<{ id: string; codigo: string | null; cliente_nombre: string | null }> };
    const map = new Map((exps ?? []).map((e) => [e.id, e]));
    return {
      rows: (extractos ?? []).map((e) => ({
        extractoId: e.id,
        expedienteId: e.expediente_id,
        banco: e.banco,
        producto: e.producto,
        codigo: map.get(e.expediente_id!)?.codigo ?? null,
        cliente: map.get(e.expediente_id!)?.cliente_nombre ?? null,
        fecha: e.created_at,
      })),
    };
  });

export const obtenerExtractoQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ extractoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ext, error } = await context.supabase
      .from("extractos_lecturas")
      .select("id,expediente_id,banco,producto,datos")
      .eq("id", data.extractoId)
      .single();
    if (error) throw new Error(error.message);
    const d = (ext.datos ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === "") return undefined;
      const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : undefined;
    };
    const productoStr = String(d.producto ?? ext.producto ?? "").toUpperCase();
    const modalidad: "hipotecario" | "leasing" | "uvr" =
      productoStr.includes("LEASING") ? "leasing"
      : (d.saldoUVR || d.valorUVR) ? "uvr" : "hipotecario";
    return {
      extracto: {
        id: ext.id,
        expedienteId: ext.expediente_id,
        banco: String(d.banco ?? ext.banco ?? ""),
        producto: productoStr,
        modalidad,
        saldoCapital: num(d.saldoCapital),
        tasaEa: num(d.tasaEA),
        cuotaActual: num(d.cuotaActual),
        seguros: num(d.seguros),
        cuotasPagadas: num(d.cuotasPagadas),
        cuotasPendientes: num(d.cuotasPendientes),
        valorDesembolsado: num(d.valorDesembolsado),
        valorUVR: num(d.valorUVR),
        saldoUVR: num(d.saldoUVR),
        coberturaFrechPp: num(d.tasaCobertura),
        titular: String(d.titular ?? ""),
      },
    };
  });
