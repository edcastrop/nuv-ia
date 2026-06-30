// Server fn: trae datos enriquecidos del lead para el Quick Peek
// (proyecciones reales, cuotas pendientes, % de auditoría).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuickPeekData = {
  // Identificación enriquecida para casos guardados con cabecera incompleta
  clienteNombre: string | null;
  cedula: string | null;
  banco: string | null;
  numeroCredito: string | null;
  producto: string | null;
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
    let s = v.trim().replace(/[^\d,.-]/g, "");
    if (!s) return 0;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      s = s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
    } else if (hasComma) {
      s = s.replace(",", ".");
    } else if ((s.match(/\./g) ?? []).length > 1) {
      s = s.replace(/\./g, "");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "—" || /^null$/i.test(s) || /^undefined$/i.test(s)) return "";
  return s;
}

function isPlaceholder(v: unknown): boolean {
  const s = cleanText(v).toLowerCase();
  return !s || s === "sin nombre" || s === "s/cédula" || s === "sin banco";
}

function readT(obj: unknown, ...keys: string[]): string {
  const o = record(obj);
  for (const k of keys) {
    const v = cleanText(o[k]);
    if (v) return v;
  }
  return "";
}

function preferText(current: unknown, ...fallbacks: unknown[]): string | null {
  if (!isPlaceholder(current)) return cleanText(current);
  for (const v of fallbacks) {
    const s = cleanText(v);
    if (s && !isPlaceholder(s)) return s;
  }
  return cleanText(current) || null;
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

    const [{ data: exp }, { data: proy }, { data: audit }, { data: lectura }, { data: qa }] = await Promise.all([
      supabase
        .from("expedientes")
        .select(
          "cliente_nombre, cedula, banco, numero_credito, producto, modo, cliente_data, credito_data, propuesta_data, aprobado_data, acertividad_global, qa_score, cuotas_pactadas, cuotas_aprobadas_banco",
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
      supabase
        .from("audit_simulaciones")
        .select("score_total")
        .eq("expediente_id", data.expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("extractos_lecturas")
        .select("datos")
        .eq("expediente_id", data.expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("qa_auditorias")
        .select("qa_score, inputs, outputs")
        .eq("expediente_id", data.expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const cliente = record(exp?.cliente_data);
    const credito = record(exp?.credito_data);
    const propuesta = record(exp?.propuesta_data);
    const aprobado = record(exp?.aprobado_data);
    const aprobadoCliente = record(aprobado?.cliente);
    const cobertura = record(credito.coberturaFresh);
    const lecturaDatos = record(lectura?.datos);
    const qaInputs = record(qa?.inputs);
    const qaOutputs = record(qa?.outputs);
    const qaReconstruccion = record(qaInputs.reconstruccion);
    const qaExtracto = record(qaInputs.extracto);
    const qaProyecciones = record(qaInputs.proyecciones);

    const clienteNombre = preferText(
      exp?.cliente_nombre,
      readT(cliente, "nombre", "clienteNombre"),
      readT(lecturaDatos, "cliente", "nombre", "clienteNombre"),
      readT(qaInputs, "cliente", "clienteNombre"),
    );
    const cedula = preferText(
      exp?.cedula,
      readT(cliente, "cedula", "identificacion"),
      readT(lecturaDatos, "cedula", "identificacion"),
      readT(qaInputs, "cedula", "identificacion"),
    );
    const banco = preferText(
      exp?.banco,
      readT(cliente, "banco"),
      readT(lecturaDatos, "banco"),
      readT(qaInputs, "banco"),
    );
    const numeroCredito = preferText(
      exp?.numero_credito,
      readT(cliente, "numeroCredito", "numero_credito"),
      readT(lecturaDatos, "numeroCredito", "numero_credito"),
      readT(qaInputs, "numeroCredito", "numero_credito"),
    );
    const producto = preferText(
      exp?.producto,
      readT(cliente, "tipoProducto", "producto"),
      readT(lecturaDatos, "producto", "tipoCredito"),
      readT(qaInputs, "producto", "tipoCredito"),
    );

    // Crédito actual: proyecciones_financieras > credito_data
    const saldoCapital =
      num(proy?.saldo_capital) ||
      readN(credito, "saldo", "saldoCapital", "saldo_capital", "monto", "valorCredito", "valorDesembolsado") ||
      readN(lecturaDatos, "saldoCapital", "saldo_capital") ||
      readN(qaReconstruccion, "saldoCapital", "saldo_capital") ||
      readN(qaExtracto, "saldoCapital", "saldo_capital") ||
      readN(qaProyecciones, "saldoCapitalAplicado");
    const cuotaActual =
      num(proy?.cuota_actual) ||
      readN(credito, "cuota", "cuotaActual", "cuota_actual", "valorCuota", "cuotaPagadaCliente", "cuotaBaseSimulacion") ||
      readN(lecturaDatos, "cuotaActual", "cuotaMensual", "cuotaPagadaCliente", "cuotaBaseSimulacion", "valorAPagar") ||
      readN(qaExtracto, "cuota", "cuotaActual", "cuotaMensual", "cuotaPagadaCliente") ||
      readN(qaOutputs, "cuotaTotalConSeguros", "cuotaConSubsidio", "cuotaTeorica");
    const tasaActualPct =
      num(proy?.tea_pct) ||
      readN(credito, "tea", "teaPct", "tasaEA", "tasaEa", "tasa_ea", "tasa", "tea_pct", "teaPactada") ||
      readN(lecturaDatos, "tea", "tasaEA", "tasaEa", "teaPactada", "teaCobrada") ||
      readN(qaReconstruccion, "tasaEa", "tasaEA", "tasaEaPactada") ||
      readN(qaExtracto, "tasaEa", "tasaEA") ||
      null;
    // Plazo mostrado = "Plazo inicial aprobado (meses)" del cliente/crédito original.
    // NO usar plazoAprobado/cuotas_aprobadas_banco: esos son el nuevo plazo aprobado/recalculado.
    const plazoInicialAprobado =
      readN(cliente, "plazoInicial", "plazo_inicial", "plazoInicialAprobadoMeses") ||
      readN(aprobadoCliente, "plazoInicial", "plazo_inicial", "plazoInicialAprobadoMeses") ||
      readN(lecturaDatos, "plazoInicial", "plazo_inicial", "cuotasTotales") ||
      (readN(qaReconstruccion, "cuotasPagadas") + readN(qaReconstruccion, "cuotasPendientes") || 0);
    const plazoOriginalCredito =
      num(proy?.cuotas_totales) ||
      readN(cobertura, "cuotasTotales", "cuotas_totales", "plazo", "plazoMeses") ||
      readN(credito, "plazo", "plazoMeses", "plazo_meses", "cuotasTotales", "cuotas_totales") ||
      readN(lecturaDatos, "plazoInicial", "cuotasTotales", "cuotas_totales");
    const cuotasTotales = plazoInicialAprobado || plazoOriginalCredito;
    const cuotasPagadas =
      num(proy?.cuotas_pagadas) ||
      readN(cobertura, "cuotasPagadas", "cuotas_pagadas") ||
      readN(credito, "cuotasPagadas", "cuotas_pagadas") ||
      readN(lecturaDatos, "cuotasPagadas", "cuotaActualNumero") ||
      readN(qaReconstruccion, "cuotasPagadas");
    const cuotasPendientes =
      num(proy?.cuotas_pendientes) ||
      readN(cobertura, "cuotasPendientes", "cuotas_pendientes") ||
      readN(credito, "cuotasPendientes", "cuotas_pendientes", "cuotasRestantes") ||
      readN(lecturaDatos, "cuotasPendientes", "cuotas_pendientes") ||
      readN(qaReconstruccion, "cuotasPendientes") ||
      readN(qaProyecciones, "cuotasPendientesRecalculadas", "cuotasPendientesExtractoOriginal") ||
      (plazoOriginalCredito > 0 ? Math.max(0, plazoOriginalCredito - cuotasPagadas) : 0);

    // Propuesta — claves reales: nuevaCuota, nuevoPlazo, ahorroTotal
    const cuotaPropuesta = readN(propuesta, "nuevaCuota", "cuota", "cuotaNueva", "valorCuota", "cuotaPropuesta");
    const tasaPropuestaPct =
      readN(propuesta, "nuevaTasa", "tasaNueva", "tasa", "tasaEA", "tasa_ea", "tea") || null;
    const plazoPropuesto =
      readN(propuesta, "nuevoPlazo", "plazo", "plazoNuevo", "plazoMeses", "plazo_meses") ||
      num(exp?.cuotas_aprobadas_banco) ||
      num(exp?.cuotas_pactadas);
    const cuotasPendientesProp = plazoPropuesto > 0 ? plazoPropuesto : 0;
    const ahorro = readN(propuesta, "ahorroTotal", "ahorro", "ahorroIntereses");

    // Auditoría: última QA oficial → motor general → fallback audit_simulaciones.
    const auditPct =
      qa?.qa_score != null
        ? num(qa.qa_score)
        : exp?.qa_score != null
          ? num(exp.qa_score)
          : exp?.acertividad_global != null
        ? num(exp.acertividad_global)
        : audit?.score_total != null
          ? num(audit.score_total)
          : null;
    const qaPct = qa?.qa_score != null ? num(qa.qa_score) : exp?.qa_score != null ? num(exp.qa_score) : null;

    return {
      clienteNombre,
      cedula,
      banco,
      numeroCredito,
      producto,
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
