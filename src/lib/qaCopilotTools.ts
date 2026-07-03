// NUVIA QA Copilot — implementación de herramientas puras (matemática financiera).
// Cada función devuelve un objeto simple listo para serializar como tool_result.

export type ToolResult = { ok: true; data: unknown } | { ok: false; error: string };

// ─── Conversión de tasas ────────────────────────────────────────────────
export function convertirTasa(
  valor: number,
  de: "ea" | "nm" | "nam" | "periodica_mensual",
  a: "ea" | "nm" | "nam" | "periodica_mensual",
): ToolResult {
  if (!Number.isFinite(valor) || valor < 0) return { ok: false, error: "Valor de tasa inválido" };
  // Normalizar a EA primero
  let ea: number;
  switch (de) {
    case "ea": ea = valor; break;
    case "nm":
    case "nam": ea = Math.pow(1 + valor / 12, 12) - 1; break;
    case "periodica_mensual": ea = Math.pow(1 + valor, 12) - 1; break;
  }
  let out: number;
  switch (a) {
    case "ea": out = ea; break;
    case "nm":
    case "nam": out = 12 * (Math.pow(1 + ea, 1 / 12) - 1); break;
    case "periodica_mensual": out = Math.pow(1 + ea, 1 / 12) - 1; break;
  }
  const periodicaMensual = Math.pow(1 + ea, 1 / 12) - 1;
  return {
    ok: true,
    data: {
      resultado: out,
      resultado_pct: (out * 100).toFixed(6) + "%",
      ea_equivalente: ea,
      ea_equivalente_pct: (ea * 100).toFixed(4) + "%",
      periodica_mensual: periodicaMensual,
      periodica_mensual_pct: (periodicaMensual * 100).toFixed(6) + "%",
      nominal_mensual_anual: 12 * periodicaMensual,
    },
  };
}

// ─── Amortización francesa (Pesos o UVR) ────────────────────────────────
export function calcularAmortizacion(input: {
  saldo: number; tasaEA: number; plazoMeses: number;
  abonoExtraCapital?: number; cuotaExtraEnMes?: number; valorUVR?: number | null;
  moneda?: "pesos" | "uvr";
}): ToolResult {
  const { saldo, tasaEA, plazoMeses } = input;
  if (!(saldo > 0) || !(tasaEA >= 0) || !(plazoMeses > 0)) {
    return { ok: false, error: "Saldo, tasa EA y plazo deben ser positivos" };
  }
  const i = Math.pow(1 + tasaEA, 1 / 12) - 1;
  const n = Math.round(plazoMeses);
  const cuota = i === 0 ? saldo / n : saldo * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  const abono = input.abonoExtraCapital ?? 0;
  const mesAbono = input.cuotaExtraEnMes ?? 0;

  let saldoActual = saldo;
  let interesesTotal = 0;
  const tabla: Array<{ cuota: number; capital: number; intereses: number; saldo: number }> = [];
  let cuotasReales = 0;
  for (let k = 1; k <= n * 2 && saldoActual > 0.01; k++) {
    const interesesMes = saldoActual * i;
    let capMes = cuota - interesesMes;
    if (capMes > saldoActual) capMes = saldoActual;
    saldoActual -= capMes;
    if (abono > 0 && k === mesAbono && saldoActual > abono) saldoActual -= abono;
    interesesTotal += interesesMes;
    if (k <= 12 || k % 12 === 0 || saldoActual < 0.01) {
      tabla.push({
        cuota: k,
        capital: Math.round(capMes),
        intereses: Math.round(interesesMes),
        saldo: Math.round(saldoActual),
      });
    }
    cuotasReales = k;
    if (saldoActual <= 0.01) break;
  }
  const totalPagado = cuota * cuotasReales + abono;
  const uvr = input.valorUVR ?? null;
  return {
    ok: true,
    data: {
      cuota_mensual: Math.round(cuota),
      cuota_mensual_cop: uvr ? Math.round(cuota * uvr) : null,
      total_pagado: Math.round(totalPagado),
      intereses_totales: Math.round(interesesTotal),
      cuotas_reales: cuotasReales,
      cuotas_ahorradas: n - cuotasReales,
      tabla_resumen: tabla,
      tasa_periodica_mensual: i,
      moneda: input.moneda ?? "pesos",
    },
  };
}

// ─── Verificación contra usura ──────────────────────────────────────────
export function evaluarSpread(tasaCobradaEA: number, ibcEA: number): ToolResult {
  const usura = ibcEA * 1.5;
  const excedeUsura = tasaCobradaEA > usura;
  const spread = tasaCobradaEA - ibcEA;
  return {
    ok: true,
    data: {
      tasa_cobrada_ea: tasaCobradaEA,
      ibc_ea: ibcEA,
      tasa_usura_ea: usura,
      spread_pp: spread * 100,
      excede_usura: excedeUsura,
      dictamen: excedeUsura
        ? `RECHAZO — la tasa cobrada ${(tasaCobradaEA * 100).toFixed(2)}% supera la usura ${(usura * 100).toFixed(2)}%`
        : `OK — la tasa está por debajo de la usura (margen ${(((usura - tasaCobradaEA) * 100)).toFixed(2)} pp)`,
    },
  };
}

// ─── UVR → COP y viceversa ──────────────────────────────────────────────
export function uvrACop(valorUVR: number, uvrEnFecha: number): ToolResult {
  if (!(valorUVR > 0) || !(uvrEnFecha > 0)) return { ok: false, error: "Valores UVR inválidos" };
  return { ok: true, data: { cop: Math.round(valorUVR * uvrEnFecha), valor_uvr: valorUVR, uvr_fecha: uvrEnFecha } };
}

export function copAUvr(valorCOP: number, uvrEnFecha: number): ToolResult {
  if (!(valorCOP > 0) || !(uvrEnFecha > 0)) return { ok: false, error: "Valores inválidos" };
  return { ok: true, data: { uvr: valorCOP / uvrEnFecha, valor_cop: valorCOP, uvr_fecha: uvrEnFecha } };
}

// ─── VPN (para evaluar refinanciación) ──────────────────────────────────
export function calcularVPN(flujos: number[], tasaDescuentoEA: number): ToolResult {
  if (!Array.isArray(flujos) || flujos.length === 0) return { ok: false, error: "Flujos vacíos" };
  const iM = Math.pow(1 + tasaDescuentoEA, 1 / 12) - 1;
  const vpn = flujos.reduce((s, f, t) => s + f / Math.pow(1 + iM, t), 0);
  return { ok: true, data: { vpn: Math.round(vpn), n_periodos: flujos.length, tasa_descuento_ea: tasaDescuentoEA } };
}
