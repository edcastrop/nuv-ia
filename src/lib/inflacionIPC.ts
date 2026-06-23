/**
 * IPC Colombia (DANE) — variación anual de fin de año.
 * Para años en curso / futuros usamos proyección razonable (≈ meta BanRep + drift).
 * Fuente: DANE — Índice de Precios al Consumidor (variación anual).
 */
export const IPC_ANUAL_COLOMBIA: Record<number, number> = {
  2015: 0.0677,
  2016: 0.0575,
  2017: 0.0409,
  2018: 0.0318,
  2019: 0.0380,
  2020: 0.0161,
  2021: 0.0562,
  2022: 0.1312,
  2023: 0.0928,
  2024: 0.0520,
  2025: 0.0520, // proyección
  2026: 0.0500, // proyección
};

const IPC_DEFAULT = 0.052;

export function ipcAnual(year: number): number {
  return IPC_ANUAL_COLOMBIA[year] ?? IPC_DEFAULT;
}

export function factorMensualIPC(year: number): number {
  return Math.pow(1 + ipcAnual(year), 1 / 12);
}

/**
 * Factor de inflación acumulado desde hace `mesesAtras` hasta `hasta`.
 * Devuelve un multiplicador: 1.083 = +8.3% acumulado.
 */
export function factorInflacionAcumulado(mesesAtras: number, hasta: Date = new Date()): number {
  if (!Number.isFinite(mesesAtras) || mesesAtras <= 0) return 1;
  const d = new Date(hasta);
  let f = 1;
  for (let i = 0; i < Math.round(mesesAtras); i++) {
    f *= factorMensualIPC(d.getFullYear());
    d.setMonth(d.getMonth() - 1);
  }
  return f;
}

/**
 * Valor presente (en pesos de hoy) de un total pagado en cuotas uniformes
 * a lo largo de los últimos `n` meses. Cada cuota se reexpresa con la
 * inflación acumulada desde su mes de pago hasta hoy.
 */
export function valorEquivalenteHoyUniforme(
  totalPagado: number,
  n: number,
  hasta: Date = new Date(),
): number {
  if (!(totalPagado > 0) || !(n > 0)) return totalPagado || 0;
  const cuota = totalPagado / n;
  const d = new Date(hasta);
  let cumFactor = 1;
  let suma = 0;
  for (let i = 0; i < Math.round(n); i++) {
    cumFactor *= factorMensualIPC(d.getFullYear());
    d.setMonth(d.getMonth() - 1);
    suma += cuota * cumFactor;
  }
  return suma;
}
