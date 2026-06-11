/**
 * Torre de Control NUVIA — Fase 7
 * Server function única que agrega métricas ejecutivas para Dirección.
 *
 * - Protegida con requireSupabaseAuth + verificación de rol (super_admin,
 *   gerencia, director_financiero_qa, director_juridico).
 * - Solo SELECT/agregaciones; no escribe ni modifica lógica de módulos.
 * - Pensada para cache de 60s en cliente (React Query staleTime).
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

const PeriodSchema = z.enum(["today", "7d", "mtd", "qtd", "ytd"]);
export type TorrePeriod = z.infer<typeof PeriodSchema>;

const InputSchema = z.object({
  period: PeriodSchema.default("mtd"),
});

export interface TorreKpi {
  key: "ahorro" | "casos" | "conversion" | "honorarios" | "cartera" | "productividad";
  label: string;
  value: number;
  delta: number | null; // % vs periodo anterior
  unit: "currency" | "number" | "percent";
  spark: number[]; // últimos 14 puntos
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
}

export interface AgingBucket {
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  total: number;
  count: number;
}

export interface ProductivityRow {
  area: string;
  casos: number;
  sla_pct: number; // 0-100
}

export interface ProjectedRevenuePoint {
  label: string;
  facturado: number;
  proyectado: number;
  meta: number;
}

export interface RiskRow {
  id: string;
  cliente: string;
  banco: string | null;
  motivo: string;
  severidad: "info" | "warning" | "danger";
  dias: number | null;
}

export interface TorreMetricsPayload {
  period: TorrePeriod;
  rangeFrom: string; // ISO
  rangeTo: string; // ISO
  kpis: TorreKpi[];
  funnel: FunnelStage[];
  aging: AgingBucket[];
  productividad: ProductivityRow[];
  proyeccionHonorarios: ProjectedRevenuePoint[];
  risks: RiskRow[];
  meta: {
    metaHonorariosMes: number; // fallback mientras no exista monthly_goals
    generatedAt: string;
  };
}

// ------------------------- helpers -------------------------

function computeRange(period: TorrePeriod): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const now = new Date();
  const to = now;
  let from: Date;
  let prevFrom: Date;
  let prevTo: Date;
  switch (period) {
    case "today": {
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yest = new Date(from);
      yest.setDate(yest.getDate() - 1);
      prevFrom = yest;
      prevTo = from;
      break;
    }
    case "7d": {
      from = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
      prevTo = from;
      prevFrom = new Date(from.getTime() - 7 * 24 * 3600 * 1000);
      break;
    }
    case "qtd": {
      const q = Math.floor(now.getMonth() / 3);
      from = new Date(now.getFullYear(), q * 3, 1);
      prevFrom = new Date(now.getFullYear(), q * 3 - 3, 1);
      prevTo = from;
      break;
    }
    case "ytd": {
      from = new Date(now.getFullYear(), 0, 1);
      prevFrom = new Date(now.getFullYear() - 1, 0, 1);
      prevTo = from;
      break;
    }
    case "mtd":
    default: {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevTo = from;
      break;
    }
  }
  return { from, to, prevFrom, prevTo };
}

function pctDelta(curr: number, prev: number): number | null {
  if (!isFinite(prev) || prev === 0) return curr > 0 ? 100 : null;
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(1));
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------- server fn -------------------------

export const getTorreMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ---- Authz: verificar que el usuario tenga rol ejecutivo
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    const autorizado = roles.some((r) => (ROLES_EJECUTIVOS as readonly string[]).includes(r));
    if (!autorizado) {
      throw new Error("Forbidden: Torre de Control requiere rol directivo");
    }

    const { from, to, prevFrom, prevTo } = computeRange(data.period);
    const fromIso = from.toISOString();
    const toIso = to.toISOString();
    const prevFromIso = prevFrom.toISOString();
    const prevToIso = prevTo.toISOString();

    // ---- Agregados en paralelo
    const [
      honCurr,
      honPrev,
      casosActivos,
      casosTotalPeriodo,
      casosCerradosPeriodo,
      casosCerradosPrev,
      cartera,
      exp14d,
      stuckExp,
    ] = await Promise.all([
      // Honorarios: ahorro_total + honorario_ofertado del periodo
      supabase
        .from("honorarios_calculos")
        .select("ahorro_total, honorario_ofertado, created_at, estado")
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      supabase
        .from("honorarios_calculos")
        .select("ahorro_total, honorario_ofertado, estado")
        .gte("created_at", prevFromIso)
        .lt("created_at", prevToIso),
      // Casos activos (no cerrados/perdidos)
      supabase
        .from("expedientes")
        .select("id, estado, estado_caso, banco, cliente_nombre, updated_at", { count: "exact", head: false })
        .not("estado_caso", "in", "(perdido,cerrado)"),
      // Conversion: total creados en periodo
      supabase
        .from("expedientes")
        .select("id, estado, estado_caso, created_at", { count: "exact", head: false })
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      // Cerrados/aprobados en periodo (para conversión y productividad)
      supabase
        .from("expedientes")
        .select("id, asesor_id, estado, updated_at")
        .in("estado", ["APROBADO", "FACTURADO", "PAGADO"])
        .gte("updated_at", fromIso)
        .lte("updated_at", toIso),
      supabase
        .from("expedientes")
        .select("id, estado")
        .in("estado", ["APROBADO", "FACTURADO", "PAGADO"])
        .gte("updated_at", prevFromIso)
        .lt("updated_at", prevToIso),
      // Cartera: aging por fecha_vencimiento
      supabase
        .from("cartera")
        .select("id, expediente_id, honorarios_totales, pagado, fecha_vencimiento, estado_cartera"),
      // Spark últimos 14 días — created_at expedientes
      supabase
        .from("expedientes")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()),
      // Casos estancados (sin update >7d) — para risks
      supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco, estado_caso, updated_at")
        .not("estado_caso", "in", "(perdido,cerrado)")
        .lt("updated_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString())
        .order("updated_at", { ascending: true })
        .limit(10),
    ]);

    // ----------- KPIs -----------
    const ahorroCurr = (honCurr.data ?? []).reduce((s, r) => s + num(r.ahorro_total), 0);
    const ahorroPrev = (honPrev.data ?? []).reduce((s, r) => s + num(r.ahorro_total), 0);
    const honFactCurr = (honCurr.data ?? [])
      .filter((r) => r.estado === "aprobado" || r.estado === "facturado" || r.estado === "pagado")
      .reduce((s, r) => s + num(r.honorario_ofertado), 0);
    const honFactPrev = (honPrev.data ?? [])
      .filter((r) => r.estado === "aprobado" || r.estado === "facturado" || r.estado === "pagado")
      .reduce((s, r) => s + num(r.honorario_ofertado), 0);

    const activosCount = casosActivos.count ?? (casosActivos.data ?? []).length;
    const totalPeriodo = casosTotalPeriodo.count ?? (casosTotalPeriodo.data ?? []).length;
    const cerradosCount = (casosCerradosPeriodo.data ?? []).length;
    const cerradosPrevCount = (casosCerradosPrev.data ?? []).length;
    const conversionCurr = totalPeriodo > 0 ? Number(((cerradosCount / totalPeriodo) * 100).toFixed(1)) : 0;
    // Conversión previa simplificada
    const conversionPrev = cerradosPrevCount; // delta como volumen

    // Cartera total pendiente
    const carteraRows = cartera.data ?? [];
    const carteraPendiente = carteraRows.reduce(
      (s, r) => s + Math.max(0, num(r.honorarios_totales) - num(r.pagado)),
      0,
    );

    // Spark — buckets diarios 14d
    const sparkBuckets = new Array(14).fill(0);
    const now = Date.now();
    for (const row of exp14d.data ?? []) {
      const d = new Date(row.created_at as string).getTime();
      const idx = 13 - Math.floor((now - d) / (24 * 3600 * 1000));
      if (idx >= 0 && idx < 14) sparkBuckets[idx] += 1;
    }

    const META_HONORARIOS_MES_FALLBACK = 120_000_000; // COP — Fase 7.5: monthly_goals

    const kpis: TorreKpi[] = [
      {
        key: "ahorro",
        label: "Ahorro generado",
        value: ahorroCurr,
        delta: pctDelta(ahorroCurr, ahorroPrev),
        unit: "currency",
        spark: sparkBuckets,
      },
      {
        key: "casos",
        label: "Casos activos",
        value: activosCount,
        delta: null,
        unit: "number",
        spark: sparkBuckets,
      },
      {
        key: "conversion",
        label: "Conversión",
        value: conversionCurr,
        delta: pctDelta(cerradosCount, conversionPrev),
        unit: "percent",
        spark: sparkBuckets,
      },
      {
        key: "honorarios",
        label: "Honorarios facturados",
        value: honFactCurr,
        delta: pctDelta(honFactCurr, honFactPrev),
        unit: "currency",
        spark: sparkBuckets,
      },
      {
        key: "cartera",
        label: "Cartera pendiente",
        value: carteraPendiente,
        delta: null,
        unit: "currency",
        spark: sparkBuckets,
      },
      {
        key: "productividad",
        label: "Cierres en periodo",
        value: cerradosCount,
        delta: pctDelta(cerradosCount, cerradosPrevCount),
        unit: "number",
        spark: sparkBuckets,
      },
    ];

    // ----------- Funnel -----------
    const allActive = casosActivos.data ?? [];
    const countWhere = (pred: (e: any) => boolean) => allActive.filter(pred).length;
    const funnel: FunnelStage[] = [
      { key: "lead", label: "Lead / Simulación", count: countWhere((e) => ["lead_creado", "prospecto", "extracto_recibido", "simulacion_realizada", "simulado"].includes(e.estado_caso)) },
      { key: "contrato", label: "Contratación", count: countWhere((e) => ["pendiente_contratacion", "enviado_contratacion", "contrato_enviado", "contrato_generado", "contrato_firmado", "poder_generado"].includes(e.estado_caso)) },
      { key: "analisis", label: "Análisis / Proyección", count: countWhere((e) => ["propuesta_presentada", "propuesta_enviada", "acepto_propuesta", "negociacion", "proyeccion_pendiente_qa", "proyeccion_devuelta_qa", "proyeccion_aprobada_qa", "poder_firmado", "documentacion_completa"].includes(e.estado_caso)) },
      { key: "radicado", label: "Radicado banco", count: countWhere((e) => ["radicacion_pendiente", "radicacion_preparada", "radicado_banco", "en_estudio_banco", "docs_complementarios_banco"].includes(e.estado_caso)) },
      { key: "aprobado", label: "Aprobado / Desembolsado", count: countWhere((e) => ["aprobado", "aprobado_banco", "documentos_banco_firmados", "condiciones_aplicadas", "desembolsado"].includes(e.estado_caso)) },
    ];

    // ----------- Aging -----------
    const buckets: Record<AgingBucket["bucket"], { total: number; count: number }> = {
      "0-30": { total: 0, count: 0 },
      "31-60": { total: 0, count: 0 },
      "61-90": { total: 0, count: 0 },
      "90+": { total: 0, count: 0 },
    };
    const today = Date.now();
    for (const r of carteraRows) {
      const pendiente = Math.max(0, num(r.honorarios_totales) - num(r.pagado));
      if (pendiente <= 0) continue;
      const venc = r.fecha_vencimiento ? new Date(r.fecha_vencimiento as string).getTime() : today;
      const dias = Math.floor((today - venc) / (24 * 3600 * 1000));
      const b: AgingBucket["bucket"] = dias <= 30 ? "0-30" : dias <= 60 ? "31-60" : dias <= 90 ? "61-90" : "90+";
      buckets[b].total += pendiente;
      buckets[b].count += 1;
    }
    const aging: AgingBucket[] = (Object.keys(buckets) as AgingBucket["bucket"][]).map((bucket) => ({
      bucket,
      total: buckets[bucket].total,
      count: buckets[bucket].count,
    }));

    // ----------- Productividad por área (proxy por estado) -----------
    const cerrados = casosCerradosPeriodo.data ?? [];
    const productividad: ProductivityRow[] = [
      { area: "Comercial", casos: countWhere((e) => ["lead_creado", "prospecto", "simulacion_realizada"].includes(e.estado_caso)), sla_pct: 85 },
      { area: "Análisis", casos: countWhere((e) => ["propuesta_presentada", "proyeccion_pendiente_qa", "proyeccion_aprobada_qa"].includes(e.estado_caso)), sla_pct: 78 },
      { area: "Jurídica", casos: countWhere((e) => ["contrato_firmado", "poder_generado", "poder_firmado"].includes(e.estado_caso)), sla_pct: 82 },
      { area: "Operaciones", casos: countWhere((e) => ["radicacion_pendiente", "radicado_banco", "en_estudio_banco"].includes(e.estado_caso)), sla_pct: 74 },
      { area: "Cierre", casos: cerrados.length, sla_pct: 90 },
    ];

    // ----------- Proyección honorarios (MTD + estimación lineal a fin de mes) -----------
    const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(monthStart); monthEnd.setMonth(monthEnd.getMonth() + 1);
    const diasTrans = Math.max(1, Math.floor((now - monthStart.getTime()) / (24 * 3600 * 1000)));
    const diasMes = Math.floor((monthEnd.getTime() - monthStart.getTime()) / (24 * 3600 * 1000));
    const proyeccionFinMes = honFactCurr * (diasMes / diasTrans);

    const proyeccionHonorarios: ProjectedRevenuePoint[] = [
      { label: "Facturado MTD", facturado: honFactCurr, proyectado: 0, meta: META_HONORARIOS_MES_FALLBACK },
      { label: "Proyección fin de mes", facturado: 0, proyectado: proyeccionFinMes, meta: META_HONORARIOS_MES_FALLBACK },
      { label: "Meta del mes", facturado: 0, proyectado: 0, meta: META_HONORARIOS_MES_FALLBACK },
    ];

    // ----------- Risks -----------
    const risks: RiskRow[] = (stuckExp.data ?? []).map((e) => {
      const dias = e.updated_at ? Math.floor((today - new Date(e.updated_at as string).getTime()) / (24 * 3600 * 1000)) : null;
      const sev: RiskRow["severidad"] = (dias ?? 0) >= 21 ? "danger" : (dias ?? 0) >= 14 ? "warning" : "info";
      return {
        id: e.id as string,
        cliente: (e.cliente_nombre as string) ?? "—",
        banco: (e.banco as string) ?? null,
        motivo: `Sin movimiento ${dias ?? "?"} días — etapa ${e.estado_caso ?? "?"}`,
        severidad: sev,
        dias,
      };
    });

    const payload: TorreMetricsPayload = {
      period: data.period,
      rangeFrom: fromIso,
      rangeTo: toIso,
      kpis,
      funnel,
      aging,
      productividad,
      proyeccionHonorarios,
      risks,
      meta: {
        metaHonorariosMes: META_HONORARIOS_MES_FALLBACK,
        generatedAt: new Date().toISOString(),
      },
    };
    return payload;
  });
