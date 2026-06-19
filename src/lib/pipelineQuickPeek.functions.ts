// Server fn: trae datos enriquecidos del lead para el Quick Peek
// (proyecciones reales, cuotas pendientes, % de auditoría).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuickPeekData = {
  // Datos del crédito actual (proyecciones_financieras más reciente)
  saldoCapital: number;
  cuotaActual: number;
  tasaActualPct: number | null;
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  // Propuesta (de propuesta_data o calculada)
  cuotaPropuesta: number;
  tasaPropuestaPct: number | null;
  plazoPropuesto: number;
  cuotasPendientesProp: number;
  ahorro: number;
  // Auditoría
  auditPct: number | null; // motor de auditoría general (acertividad_global)
  qaPct: number | null;    // score QA del simulador
};

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function readN(obj: unknown, ...keys: string[]): number {
  if (!obj || typeof obj !== "object") return 0;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = num(o[k]);
    if (v !== 0) return v;
  }
  return 0;
}

export const getQuickPeekData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ expedienteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<QuickPeekData> => {
    const { supabase } = context;

    const [{ data: exp }, { data: proy }] = await Promise.all([
      supabase
        .from("expedientes")
        .select(
          "credito_data, propuesta_data, acertividad_global, qa_score, cuotas_pactadas, cuotas_aprobadas_banco",
        )
        .eq("id", data.expedienteId)
        .maybeSingle(),
      supabase
        .from("proyecciones_financieras")
        .select(
          "saldo_capital, cuota_actual, tea_pct, cuotas_totales, cuotas_pagadas, cuotas_pendientes",
        )
        .eq("expediente_id", data.expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const credito = (exp?.credito_data ?? {}) as Record<string, unknown>;
    const propuesta = (exp?.propuesta_data ?? {}) as Record<string, unknown>;

    // Crédito actual: proyecciones_financieras > credito_data
    const saldoCapital = num(proy?.saldo_capital) || readN(credito, "saldo", "saldoCapital", "monto", "valorCredito");
    const cuotaActual = num(proy?.cuota_actual) || readN(credito, "cuota", "cuotaActual", "valorCuota");
    const tasaActualPct = num(proy?.tea_pct) || readN(credito, "tasaEA", "tasa_ea", "tasa") || null;
    const cuotasTotales = num(proy?.cuotas_totales) || readN(credito, "plazo", "plazoMeses", "plazo_meses");
    const cuotasPagadas = num(proy?.cuotas_pagadas) || readN(credito, "cuotasPagadas", "cuotas_pagadas");
    const cuotasPendientes =
      num(proy?.cuotas_pendientes) ||
      Math.max(0, cuotasTotales - cuotasPagadas);

    // Propuesta
    const cuotaPropuesta = readN(propuesta, "cuota", "cuotaNueva", "valorCuota", "cuotaPropuesta");
    const tasaPropuestaPct = readN(propuesta, "tasa", "tasaEA", "tasa_ea", "tasaNueva") || null;
    const plazoPropuesto =
      readN(propuesta, "plazo", "plazoNuevo", "plazoMeses", "plazo_meses") ||
      num(exp?.cuotas_aprobadas_banco) ||
      num(exp?.cuotas_pactadas);
    const cuotasPendientesProp = plazoPropuesto > 0 ? plazoPropuesto : 0;
    const ahorro = readN(propuesta, "ahorro", "ahorroTotal", "ahorroIntereses");

    // Auditoría
    const auditPct = exp?.acertividad_global != null ? num(exp.acertividad_global) : null;
    const qaPct = exp?.qa_score != null ? num(exp.qa_score) : null;

    return {
      saldoCapital,
      cuotaActual,
      tasaActualPct: tasaActualPct ? Number(tasaActualPct) : null,
      cuotasTotales,
      cuotasPagadas,
      cuotasPendientes,
      cuotaPropuesta,
      tasaPropuestaPct: tasaPropuestaPct ? Number(tasaPropuestaPct) : null,
      plazoPropuesto,
      cuotasPendientesProp,
      ahorro,
      auditPct,
      qaPct,
    };
  });
