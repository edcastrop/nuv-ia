// Motores financieros NUVEX: PESOS y UVR
// No exponer fórmulas al usuario final.

export const HONORARIOS_MIN_BASE = 2_000_000;
export const HONORARIOS_MIN_FINAL = 1_800_000;

export function applyHonorariosFloor(calculado: number): number {
  if (!isFinite(calculado) || calculado <= 0) return calculado;
  return Math.max(HONORARIOS_MIN_BASE, calculado);
}

export function pmt(rate: number, nper: number, pv: number): number {
  if (nper <= 0) return 0;
  if (rate === 0) return pv / nper;
  return (rate * pv) / (1 - Math.pow(1 + rate, -nper));
}

// Redondeo NUVEX para convertir plazo exacto (NPER) a plazo entero.
// Si la fracción es ≤ 0.02 (errores de redondeo flotante), se redondea al entero
// más cercano; de lo contrario se aplica Math.ceil. Garantiza que la calculadora
// manual coincida con las propuestas automáticas cuando se ingresa la misma cuota.
export function roundPlazoNuvex(plazoExacto: number): number {
  const nearest = Math.round(plazoExacto);
  const diff = Math.abs(plazoExacto - nearest);
  if (diff <= 0.02) return nearest;
  return Math.ceil(plazoExacto);
}


// ====================== PESOS ======================
export interface PesosInput {
  saldoCapital: number;
  cuotaActual: number; // cuota base de simulación con seguros
  seguros: number;
  tea: number; // % efectiva anual
  cuotasPendientes: number;
  porcentajeHonorarios: number;
}

export interface PesosPropuesta {
  cuotasEliminadas: number;
  añosEliminados: number;
  nuevoPlazo: number;
  nuevaCuotaSinSeguro: number;
  nuevaCuotaConSeguro: number;
  abonoAdicionalMensual: number;
  totalActualPendiente: number;
  totalProyectadoNuevo: number;
  interesesActuales: number;
  interesesProyectados: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorariosNuvex: number;
  totalAproxPagar: number;
}

export function calculatePesosProjection(input: PesosInput): {
  tasaMensual: number;
  propuestas: PesosPropuesta[];
} {
  const tasaMensual = Math.pow(1 + input.tea / 100, 1 / 12) - 1;
  const eliminaciones = [12, 24, 36, 48];
  const propuestas = eliminaciones
    .map((cuotasEliminadas) => buildPesosPropuesta(input, tasaMensual, cuotasEliminadas))
    .filter((p): p is PesosPropuesta => p !== null);
  return { tasaMensual, propuestas };
}

function buildPesosPropuesta(
  input: PesosInput,
  tasaMensual: number,
  cuotasEliminadas: number,
): PesosPropuesta | null {
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  const nuevoPlazo = cuotasBase - cuotasEliminadas;
  if (nuevoPlazo <= 0) return null;
  const nuevaCuotaSinSeguro = pmt(tasaMensual, nuevoPlazo, input.saldoCapital);
  const nuevaCuotaConSeguro = nuevaCuotaSinSeguro + input.seguros;
  const abonoAdicionalMensual = nuevaCuotaConSeguro - input.cuotaActual;
  const totalActualPendiente = input.cuotaActual * cuotasBase;
  const totalProyectadoNuevo = nuevaCuotaConSeguro * nuevoPlazo;
  const interesesActuales = totalActualPendiente - input.saldoCapital;
  const interesesProyectados = totalProyectadoNuevo - input.saldoCapital;
  const ahorroIntereses = interesesActuales - interesesProyectados;
  const ahorroSeguros = input.seguros * cuotasEliminadas;
  const ahorroTotal = ahorroIntereses + ahorroSeguros;
  const honorariosNuvex = applyHonorariosFloor(ahorroTotal * (input.porcentajeHonorarios / 100));
  return {
    cuotasEliminadas,
    añosEliminados: cuotasEliminadas / 12,
    nuevoPlazo,
    nuevaCuotaSinSeguro,
    nuevaCuotaConSeguro,
    abonoAdicionalMensual,
    totalActualPendiente,
    totalProyectadoNuevo,
    interesesActuales,
    interesesProyectados,
    ahorroIntereses,
    ahorroSeguros,
    ahorroTotal,
    honorariosNuvex,
    totalAproxPagar: totalProyectadoNuevo,
  };
}

export interface PesosManualResult {
  nuevaCuotaConSeguro: number;
  nuevaCuotaSinSeguro: number;
  nuevoPlazo: number;
  cuotasEliminadas: number;
  añosEliminados: number;
  totalProyectado: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  incrementoMensual: number;
  valid: boolean;
  motivo?: string;
}

export function calculatePesosManual(
  input: PesosInput,
  nuevaCuotaConSeguro: number,
): PesosManualResult {
  const base: PesosManualResult = {
    nuevaCuotaConSeguro,
    nuevaCuotaSinSeguro: 0,
    nuevoPlazo: 0,
    cuotasEliminadas: 0,
    añosEliminados: 0,
    totalProyectado: 0,
    ahorroIntereses: 0,
    ahorroSeguros: 0,
    ahorroTotal: 0,
    honorarios: 0,
    incrementoMensual: 0,
    valid: false,
  };
  if (nuevaCuotaConSeguro <= input.cuotaActual) {
    return { ...base, motivo: "La nueva cuota debe ser mayor a la cuota actual" };
  }
  const tasaMensual = Math.pow(1 + input.tea / 100, 1 / 12) - 1;
  const nuevaCuotaSinSeguro = nuevaCuotaConSeguro - input.seguros;
  if (nuevaCuotaSinSeguro <= input.saldoCapital * tasaMensual) {
    return { ...base, motivo: "La cuota no alcanza a cubrir los intereses" };
  }
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  const nuevoPlazoExacto =
    -Math.log(1 - (input.saldoCapital * tasaMensual) / nuevaCuotaSinSeguro) /
    Math.log(1 + tasaMensual);
  const nuevoPlazo = roundPlazoNuvex(nuevoPlazoExacto);
  if (nuevoPlazo <= 0 || nuevoPlazo >= cuotasBase) {
    return { ...base, motivo: "El nuevo plazo no genera ahorro" };
  }
  const cuotasEliminadas = cuotasBase - nuevoPlazo;
  const totalProyectado = nuevaCuotaConSeguro * nuevoPlazo;
  const totalActualPendiente = input.cuotaActual * cuotasBase;
  const interesesActuales = totalActualPendiente - input.saldoCapital;
  const ahorroIntereses = interesesActuales - (totalProyectado - input.saldoCapital);
  const ahorroSeguros = input.seguros * cuotasEliminadas;
  const ahorroTotal = ahorroIntereses + ahorroSeguros;
  return {
    nuevaCuotaConSeguro,
    nuevaCuotaSinSeguro,
    nuevoPlazo,
    cuotasEliminadas,
    añosEliminados: cuotasEliminadas / 12,
    totalProyectado,
    ahorroIntereses,
    ahorroSeguros,
    ahorroTotal,
    honorarios: applyHonorariosFloor(ahorroTotal * (input.porcentajeHonorarios / 100)),
    incrementoMensual: nuevaCuotaConSeguro - input.cuotaActual,
    valid: true,
  };
}

/**
 * Modo 2 (Pesos): el usuario indica cuántas cuotas quiere eliminar.
 * Derivamos la nueva cuota requerida y delegamos en calculatePesosManual
 * para mantener una única fuente de cálculo.
 */
export function calculatePesosManualByCuotas(
  input: PesosInput,
  cuotasEliminadas: number,
): PesosManualResult {
  const base: PesosManualResult = {
    nuevaCuotaConSeguro: 0,
    nuevaCuotaSinSeguro: 0,
    nuevoPlazo: 0,
    cuotasEliminadas: 0,
    añosEliminados: 0,
    totalProyectado: 0,
    ahorroIntereses: 0,
    ahorroSeguros: 0,
    ahorroTotal: 0,
    honorarios: 0,
    incrementoMensual: 0,
    valid: false,
  };
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  if (cuotasEliminadas <= 0 || cuotasEliminadas >= cuotasBase) {
    return { ...base, motivo: "Cuotas a eliminar fuera de rango" };
  }
  const tasaMensual = Math.pow(1 + input.tea / 100, 1 / 12) - 1;
  const nuevoPlazo = cuotasBase - cuotasEliminadas;
  const nuevaCuotaSinSeguro = pmt(tasaMensual, nuevoPlazo, input.saldoCapital);
  const nuevaCuotaConSeguro = nuevaCuotaSinSeguro + input.seguros;
  return calculatePesosManual(input, nuevaCuotaConSeguro);
}

// ====================== UVR ======================
export interface UVRInput {
  valorDesembolsado: number;
  saldoPesos: number;
  saldoUVR: number;
  valorUVR: number;
  cuotaActualPesos: number; // con seguro
  cuotaSinSeguros: number;
  seguros: number;
  teaCobrada: number; // %
  variacionUVR: number; // % EA
  cuotasPendientes: number;
  plazoInicial: number;
  porcentajeHonorarios: number;
}

export function getUVRReductionOptions(plazoInicial: number): number[] {
  if (plazoInicial >= 360) return [72, 84, 96, 108];
  if (plazoInicial >= 240) return [36, 48, 60, 72];
  return [12, 24, 36, 48];
}

interface UVRProyeccionTotales {
  totalPagoPesos: number;
  totalInteresesYCorreccion: number;
  totalSeguros: number;
  totalCapitalPesos: number;
}

function proyectarUVR(
  saldoUVRInicial: number,
  valorUVRInicial: number,
  tasaMensual: number,
  variacionMensualUVR: number,
  cuotaUVR: number,
  seguros: number,
  plazo: number,
): UVRProyeccionTotales {
  let saldoUVR = saldoUVRInicial;
  let valorUVR = valorUVRInicial;
  let saldoPesosAnterior = saldoUVRInicial * valorUVRInicial;
  let totalPagoPesos = 0;
  let totalInteresesYCorreccion = 0;
  let totalCapitalPesos = 0;
  for (let i = 0; i < plazo; i++) {
    const interesUVR = saldoUVR * tasaMensual;
    const abonoCapitalUVR = cuotaUVR - interesUVR;
    const saldoUVRFinal = saldoUVR - abonoCapitalUVR;
    const valorUVRProyectado = valorUVR * (1 + variacionMensualUVR);

    const cuotaPesos = cuotaUVR * valorUVRProyectado;
    const capitalPesos = abonoCapitalUVR * valorUVRProyectado;
    const interesesPesos = interesUVR * valorUVRProyectado;
    const saldoPesos = saldoUVRFinal * valorUVRProyectado;
    const correccionMonetaria = Math.max(0, saldoPesos - saldoPesosAnterior + capitalPesos);

    totalPagoPesos += cuotaPesos + seguros;
    totalInteresesYCorreccion += interesesPesos + correccionMonetaria;
    totalCapitalPesos += capitalPesos;

    saldoUVR = saldoUVRFinal;
    valorUVR = valorUVRProyectado;
    saldoPesosAnterior = saldoPesos;
  }
  return {
    totalPagoPesos,
    totalInteresesYCorreccion,
    totalSeguros: seguros * plazo,
    totalCapitalPesos,
  };
}

export interface UVRPropuesta {
  cuotasEliminadas: number;
  añosEliminados: number;
  nuevoPlazo: number;
  nuevaCuotaUVR: number;
  nuevaCuotaPesosAprox: number;
  nuevaCuotaConSeguroAprox: number;
  abonoAdicionalMensual: number;
  totalPagoPropuesta: number;
  totalInteresesYCorreccion: number;
  totalSeguros: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorariosNuvex: number;
  totalAproxPagar: number;
}

export interface UVREscenarioActual {
  totalPagoPesos: number;
  totalInteresesYCorreccion: number;
  totalSeguros: number;
}

export function calculateUVRProjection(input: UVRInput): {
  tasaMensual: number;
  variacionMensualUVR: number;
  cuotaUVRActual: number;
  escenarioActual: UVREscenarioActual;
  propuestas: UVRPropuesta[];
} {
  const tasaMensual = Math.pow(1 + input.teaCobrada / 100, 1 / 12) - 1;
  const variacionMensualUVR = Math.pow(1 + input.variacionUVR / 100, 1 / 12) - 1;
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  const cuotaUVRActual = pmt(tasaMensual, cuotasBase, input.saldoUVR);

  const actual = proyectarUVR(
    input.saldoUVR,
    input.valorUVR,
    tasaMensual,
    variacionMensualUVR,
    cuotaUVRActual,
    input.seguros,
    cuotasBase,
  );

  const escenarioActual: UVREscenarioActual = {
    totalPagoPesos: actual.totalPagoPesos,
    totalInteresesYCorreccion: actual.totalInteresesYCorreccion,
    totalSeguros: actual.totalSeguros,
  };

  const eliminaciones = getUVRReductionOptions(input.plazoInicial);
  const propuestas: UVRPropuesta[] = [];
  for (const cuotasEliminadas of eliminaciones) {
    const nuevoPlazo = cuotasBase - cuotasEliminadas;
    if (nuevoPlazo <= 0) continue;
    const nuevaCuotaUVR = pmt(tasaMensual, nuevoPlazo, input.saldoUVR);
    const prop = proyectarUVR(
      input.saldoUVR,
      input.valorUVR,
      tasaMensual,
      variacionMensualUVR,
      nuevaCuotaUVR,
      input.seguros,
      nuevoPlazo,
    );
    const nuevaCuotaPesosAprox = nuevaCuotaUVR * input.valorUVR;
    const nuevaCuotaConSeguroAprox = nuevaCuotaPesosAprox + input.seguros;
    const ahorroIntereses =
      escenarioActual.totalInteresesYCorreccion - prop.totalInteresesYCorreccion;
    const ahorroSeguros = input.seguros * cuotasEliminadas;
    const ahorroTotal = ahorroIntereses + ahorroSeguros;
    propuestas.push({
      cuotasEliminadas,
      añosEliminados: cuotasEliminadas / 12,
      nuevoPlazo,
      nuevaCuotaUVR,
      nuevaCuotaPesosAprox,
      nuevaCuotaConSeguroAprox,
      abonoAdicionalMensual: nuevaCuotaConSeguroAprox - input.cuotaActualPesos,
      totalPagoPropuesta: prop.totalPagoPesos,
      totalInteresesYCorreccion: prop.totalInteresesYCorreccion,
      totalSeguros: prop.totalSeguros,
      ahorroIntereses,
      ahorroSeguros,
      ahorroTotal,
      honorariosNuvex: applyHonorariosFloor(ahorroTotal * (input.porcentajeHonorarios / 100)),
      totalAproxPagar: prop.totalPagoPesos,
    });
  }
  return { tasaMensual, variacionMensualUVR, cuotaUVRActual, escenarioActual, propuestas };
}

export interface UVRManualResult {
  nuevaCuotaPesos: number;
  nuevaCuotaUVR: number;
  nuevoPlazo: number;
  cuotasEliminadas: number;
  añosEliminados: number;
  incrementoMensual: number;
  totalProyectado: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  valid: boolean;
  motivo?: string;
}

export function calculateUVRManual(
  input: UVRInput,
  escenarioActual: UVREscenarioActual,
  nuevaCuotaPesos: number,
): UVRManualResult {
  const base: UVRManualResult = {
    nuevaCuotaPesos,
    nuevaCuotaUVR: 0,
    nuevoPlazo: 0,
    cuotasEliminadas: 0,
    añosEliminados: 0,
    incrementoMensual: 0,
    totalProyectado: 0,
    ahorroIntereses: 0,
    ahorroSeguros: 0,
    ahorroTotal: 0,
    honorarios: 0,
    valid: false,
  };
  if (nuevaCuotaPesos <= input.cuotaActualPesos) {
    return { ...base, motivo: "La nueva cuota debe ser mayor a la cuota actual" };
  }
  const tasaMensual = Math.pow(1 + input.teaCobrada / 100, 1 / 12) - 1;
  const variacionMensualUVR = Math.pow(1 + input.variacionUVR / 100, 1 / 12) - 1;
  const cuotaSinSeguro = nuevaCuotaPesos - input.seguros;
  const nuevaCuotaUVR = cuotaSinSeguro / input.valorUVR;
  if (nuevaCuotaUVR <= input.saldoUVR * tasaMensual) {
    return { ...base, motivo: "La cuota no alcanza a cubrir los intereses" };
  }
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  const plazoExacto =
    -Math.log(1 - (input.saldoUVR * tasaMensual) / nuevaCuotaUVR) / Math.log(1 + tasaMensual);
  const nuevoPlazo = roundPlazoNuvex(plazoExacto);
  if (nuevoPlazo <= 0 || nuevoPlazo >= cuotasBase) {
    return { ...base, motivo: "El nuevo plazo no genera ahorro" };
  }
  const cuotasEliminadas = cuotasBase - nuevoPlazo;
  const prop = proyectarUVR(
    input.saldoUVR,
    input.valorUVR,
    tasaMensual,
    variacionMensualUVR,
    nuevaCuotaUVR,
    input.seguros,
    nuevoPlazo,
  );
  const ahorroIntereses =
    escenarioActual.totalInteresesYCorreccion - prop.totalInteresesYCorreccion;
  const ahorroSeguros = input.seguros * cuotasEliminadas;
  const ahorroTotal = ahorroIntereses + ahorroSeguros;
  return {
    nuevaCuotaPesos,
    nuevaCuotaUVR,
    nuevoPlazo,
    cuotasEliminadas,
    añosEliminados: cuotasEliminadas / 12,
    incrementoMensual: nuevaCuotaPesos - input.cuotaActualPesos,
    totalProyectado: prop.totalPagoPesos,
    ahorroIntereses,
    ahorroSeguros,
    ahorroTotal,
    honorarios: applyHonorariosFloor(ahorroTotal * (input.porcentajeHonorarios / 100)),
    valid: true,
  };
}

/**
 * Modo 2 (UVR): el usuario indica cuántas cuotas quiere eliminar.
 * Derivamos la nueva cuota requerida en pesos y delegamos en calculateUVRManual.
 */
export function calculateUVRManualByCuotas(
  input: UVRInput,
  escenarioActual: UVREscenarioActual,
  cuotasEliminadas: number,
): UVRManualResult {
  const base: UVRManualResult = {
    nuevaCuotaPesos: 0,
    nuevaCuotaUVR: 0,
    nuevoPlazo: 0,
    cuotasEliminadas: 0,
    añosEliminados: 0,
    incrementoMensual: 0,
    totalProyectado: 0,
    ahorroIntereses: 0,
    ahorroSeguros: 0,
    ahorroTotal: 0,
    honorarios: 0,
    valid: false,
  };
  const cuotasBase = Math.max(0, input.cuotasPendientes);
  if (cuotasEliminadas <= 0 || cuotasEliminadas >= cuotasBase) {
    return { ...base, motivo: "Cuotas a eliminar fuera de rango" };
  }
  const tasaMensual = Math.pow(1 + input.teaCobrada / 100, 1 / 12) - 1;
  const nuevoPlazo = cuotasBase - cuotasEliminadas;
  const nuevaCuotaUVR = pmt(tasaMensual, nuevoPlazo, input.saldoUVR);
  const nuevaCuotaPesos = nuevaCuotaUVR * input.valorUVR + input.seguros;
  return calculateUVRManual(input, escenarioActual, nuevaCuotaPesos);
}

export function pickBestProposal<T extends { ahorroTotal: number }>(
  propuestas: T[],
): { best: T | null; bestIndex: number } {
  let best: T | null = null;
  let bestIndex = -1;
  propuestas.forEach((p, i) => {
    if (!best || p.ahorroTotal > best.ahorroTotal) {
      best = p;
      bestIndex = i;
    }
  });
  return { best, bestIndex };
}
