// Motor de proyección detallada del crédito.
// Genera mes a mes el comportamiento bajo dos escenarios: actual y optimizado.
// La cobertura Fresh es puramente visual: solo se descuenta de la cuota
// pagada por el cliente durante las cuotas Fresh pendientes. NO afecta el
// cálculo de intereses, capital, ahorro ni honorarios.

export interface CoberturaFresh {
  activo: boolean;
  valorMensual: number;
  tasa: number;
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  // Campos extendidos (opcionales por compatibilidad). Calculados por
  // src/lib/cobertura.ts y persistidos en el expediente.
  tipoBeneficio?:
    | "FRECH"
    | "FRESH"
    | "VIS"
    | "MI_CASA_YA"
    | "SUBSIDIO_TASA"
    | "OTRO";
  beneficioRecibido?: number;
  beneficioRestante?: number;
  detectadoOCR?: boolean;
  fuente?: "ocr" | "manual" | "mixto";
  ultimaSincronizacion?: string | null;
}

export interface ProyeccionInputBase {
  modo: "pesos" | "uvr";
  saldoInicialPesos: number;
  seguros: number;
  teaPct: number;
  cuotasPendientes: number;
  // Cuota actual pagada por el cliente (con seguros, sin restar Fresh)
  cuotaActualPesos: number;
  fechaInicio: Date;
  fresh: CoberturaFresh;
  // Solo UVR
  saldoUVR?: number;
  valorUVR?: number;
  variacionUVRPct?: number;
}

export interface CuotaProyectada {
  numero: number;
  fecha: Date;
  saldoInicial: number;
  capital: number;
  interes: number;
  seguros: number;
  fresh: number;
  cuotaAntesCobertura: number;
  cuotaPagada: number;
  saldoFinal: number;
}

export interface ProyeccionResultado {
  cuotas: CuotaProyectada[];
  fechaFinalizacion: Date | null;
  totalCapital: number;
  totalIntereses: number;
  totalSeguros: number;
  totalFresh: number;
  totalCuotaAntesCobertura: number;
  totalPagado: number;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}

export function freshActiva(fresh: CoberturaFresh, cuotaIdx0: number): boolean {
  // La cobertura se considera vigente mientras haya cuotas Fresh pendientes,
  // aunque el analista no haya digitado el valor mensual. Esto garantiza que
  // la columna Fresh y la finalización del beneficio se reflejen en la tabla.
  if (!fresh.activo) return false;
  if (fresh.cuotasPendientes <= 0) return false;
  return cuotaIdx0 < Math.max(0, fresh.cuotasPendientes);
}

/**
 * Proyecta un crédito en PESOS con cuota fija (amortización francesa).
 * La cuota fija usada es `cuotaAntesCobertura` (cuota con seguros real del banco).
 */
function proyectarPesos(
  saldo: number,
  cuotaConSeguros: number,
  seguros: number,
  tasaMensual: number,
  maxCuotas: number,
  fechaInicio: Date,
  fresh: CoberturaFresh,
): ProyeccionResultado {
  const cuotas: CuotaProyectada[] = [];
  let saldoActual = saldo;
  let totalCapital = 0,
    totalIntereses = 0,
    totalSeguros = 0,
    totalFresh = 0,
    totalAntes = 0,
    totalPagado = 0;
  const cuotaSinSeguros = Math.max(0, cuotaConSeguros - seguros);
  let i = 0;
  while (saldoActual > 0.5 && i < maxCuotas + 1) {
    const interes = saldoActual * tasaMensual;
    let capital = cuotaSinSeguros - interes;
    if (capital <= 0) break; // cuota no cubre intereses
    if (capital > saldoActual) capital = saldoActual;
    const saldoFinal = Math.max(0, saldoActual - capital);
    const fechaCuota = addMonths(fechaInicio, i);
    const freshVal = freshActiva(fresh, i) ? fresh.valorMensual : 0;
    const cuotaAntes = capital + interes + seguros;
    const cuotaPagada = Math.max(0, cuotaAntes - freshVal);

    cuotas.push({
      numero: i + 1,
      fecha: fechaCuota,
      saldoInicial: saldoActual,
      capital,
      interes,
      seguros,
      fresh: freshVal,
      cuotaAntesCobertura: cuotaAntes,
      cuotaPagada,
      saldoFinal,
    });
    totalCapital += capital;
    totalIntereses += interes;
    totalSeguros += seguros;
    totalFresh += freshVal;
    totalAntes += cuotaAntes;
    totalPagado += cuotaPagada;
    saldoActual = saldoFinal;
    i++;
  }
  return {
    cuotas,
    fechaFinalizacion: cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha : null,
    totalCapital,
    totalIntereses,
    totalSeguros,
    totalFresh,
    totalCuotaAntesCobertura: totalAntes,
    totalPagado,
  };
}

/**
 * Proyecta un crédito en UVR. La cuota en UVR se obtiene como
 * cuotaSinSegurosPesos_inicial / valorUVR_inicial y se mantiene constante en UVR
 * (las cuotas en pesos crecen con la UVR).
 */
function proyectarUVR(
  saldoUVRIni: number,
  valorUVRIni: number,
  cuotaConSegurosPesosIni: number,
  seguros: number,
  tasaMensual: number,
  variacionMensualUVR: number,
  maxCuotas: number,
  fechaInicio: Date,
  fresh: CoberturaFresh,
): ProyeccionResultado {
  const cuotas: CuotaProyectada[] = [];
  const cuotaSinSegPesosIni = Math.max(0, cuotaConSegurosPesosIni - seguros);
  const cuotaUVR = valorUVRIni > 0 ? cuotaSinSegPesosIni / valorUVRIni : 0;
  let saldoUVR = saldoUVRIni;
  let valorUVR = valorUVRIni;
  let totalCapital = 0,
    totalIntereses = 0,
    totalSeguros = 0,
    totalFresh = 0,
    totalAntes = 0,
    totalPagado = 0;
  let i = 0;
  while (saldoUVR > 0.0001 && i < maxCuotas + 1) {
    const valorUVRProy = valorUVR * (1 + variacionMensualUVR);
    const interesUVR = saldoUVR * tasaMensual;
    let capitalUVR = cuotaUVR - interesUVR;
    if (capitalUVR <= 0) break;
    if (capitalUVR > saldoUVR) capitalUVR = saldoUVR;
    const saldoUVRFinal = Math.max(0, saldoUVR - capitalUVR);

    const interesPesos = interesUVR * valorUVRProy;
    const capitalPesos = capitalUVR * valorUVRProy;
    const saldoInicialPesos = saldoUVR * valorUVRProy;
    const saldoFinalPesos = saldoUVRFinal * valorUVRProy;
    const fechaCuota = addMonths(fechaInicio, i);
    const freshVal = freshActiva(fresh, i) ? fresh.valorMensual : 0;
    const cuotaAntes = capitalPesos + interesPesos + seguros;
    const cuotaPagada = Math.max(0, cuotaAntes - freshVal);

    cuotas.push({
      numero: i + 1,
      fecha: fechaCuota,
      saldoInicial: saldoInicialPesos,
      capital: capitalPesos,
      interes: interesPesos,
      seguros,
      fresh: freshVal,
      cuotaAntesCobertura: cuotaAntes,
      cuotaPagada,
      saldoFinal: saldoFinalPesos,
    });
    totalCapital += capitalPesos;
    totalIntereses += interesPesos;
    totalSeguros += seguros;
    totalFresh += freshVal;
    totalAntes += cuotaAntes;
    totalPagado += cuotaPagada;
    saldoUVR = saldoUVRFinal;
    valorUVR = valorUVRProy;
    i++;
  }
  return {
    cuotas,
    fechaFinalizacion: cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha : null,
    totalCapital,
    totalIntereses,
    totalSeguros,
    totalFresh,
    totalCuotaAntesCobertura: totalAntes,
    totalPagado,
  };
}

export function proyectar(input: ProyeccionInputBase): ProyeccionResultado {
  const tasaMensual = input.teaPct > 0 ? Math.pow(1 + input.teaPct / 100, 1 / 12) - 1 : 0;
  if (input.modo === "uvr") {
    const variacionMensual = Math.pow(1 + (input.variacionUVRPct ?? 0) / 100, 1 / 12) - 1;
    return proyectarUVR(
      input.saldoUVR ?? 0,
      input.valorUVR ?? 0,
      input.cuotaActualPesos,
      input.seguros,
      tasaMensual,
      variacionMensual,
      Math.max(input.cuotasPendientes, 1) + 24,
      input.fechaInicio,
      input.fresh,
    );
  }
  return proyectarPesos(
    input.saldoInicialPesos,
    input.cuotaActualPesos,
    input.seguros,
    tasaMensual,
    Math.max(input.cuotasPendientes, 1) + 24,
    input.fechaInicio,
    input.fresh,
  );
}

export interface DistribucionPagos {
  capital: number;
  intereses: number;
  seguros: number;
  fresh: number;
}

export function distribucion(r: ProyeccionResultado): DistribucionPagos {
  return {
    capital: r.totalCapital,
    intereses: r.totalIntereses,
    seguros: r.totalSeguros,
    fresh: r.totalFresh,
  };
}

export function formatFecha(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short" });
}

export function formatFechaLarga(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

// ============================================================================
// LEASING HABITACIONAL — Sistema Francés con Valor Residual (opción de compra)
// ----------------------------------------------------------------------------
// A diferencia del hipotecario, el saldo NO llega a cero: converge al valor
// de la opción de compra. La fórmula del canon financiero incluye el valor
// futuro (FV = residual):
//
//   PMT = (PV − FV / (1+i)^n) · i / (1 − (1+i)^-n)
//
// NOTA: Este motor es aditivo. NO modifica `proyectarPesos` ni `proyectarUVR`.
// ============================================================================

export interface LeasingInput {
  saldoInicial: number;         // PV — saldo actual del leasing
  valorResidual: number;        // FV — opción de compra
  cuotasPendientes: number;     // n
  teaPct: number;               // tasa efectiva anual
  seguros: number;              // seguros mensuales (fuera del canon financiero)
  fechaInicio: Date;
  aporteMensualExtra?: number;  // canon extra opcional
  abonoExtraordinario?: number; // aplicado al saldo antes de proyectar
  incluirOpcionCompra?: boolean;// si true, agrega cuota final = residual
  canonBancoReportado?: number; // solo para métricas / QA
}

export interface CuotaLeasing {
  numero: number;
  fecha: Date;
  saldoInicial: number;
  interes: number;
  capital: number;
  seguros: number;
  canonFinanciero: number;
  canonTotal: number;
  saldoFinal: number;
  esOpcionCompra?: boolean;
}

export interface ResultadoLeasing {
  cuotas: CuotaLeasing[];
  canonFinancieroBase: number;
  canonTotalBase: number;
  totalIntereses: number;
  totalCapital: number;
  totalSeguros: number;
  totalPagado: number;
  saldoFinalProyectado: number;
  valorResidual: number;
  fechaFinalizacion: Date | null;
  saldoConvergeAlResidual: boolean;
  vecesPagado: number;
  qa: {
    canonReconstruidoDifPct: number | null;
    saldoResidualDifPct: number;
    residualComoPctDelSaldo: number;
    capitalCero: boolean;
  };
}

/** Canon financiero periódico usando Sistema Francés con Valor Futuro. */
export function calcularCanonLeasing(pv: number, fv: number, i: number, n: number): number {
  if (n <= 0 || pv <= 0) return 0;
  if (Math.abs(i) < 1e-12) return (pv - fv) / n;
  const factor = Math.pow(1 + i, -n);
  return ((pv - fv * factor) * i) / (1 - factor);
}

export function proyectarLeasing(input: LeasingInput): ResultadoLeasing {
  const tasaMensual = input.teaPct > 0 ? Math.pow(1 + input.teaPct / 100, 1 / 12) - 1 : 0;
  const n = Math.max(1, Math.round(input.cuotasPendientes));
  const abono = Math.max(0, input.abonoExtraordinario ?? 0);
  const extra = Math.max(0, input.aporteMensualExtra ?? 0);
  const saldoIni = Math.max(0, input.saldoInicial - abono);
  const residual = Math.max(0, input.valorResidual);
  const canonFin = calcularCanonLeasing(saldoIni, residual, tasaMensual, n);

  const cuotas: CuotaLeasing[] = [];
  let saldo = saldoIni;
  let totalIntereses = 0;
  let totalCapital = 0;
  let totalSeguros = 0;
  let totalPagado = 0;
  let capitalCero = false;

  const maxIter = n + 24;
  let i = 0;
  while (i < maxIter) {
    if (saldo <= residual + 0.5) break;
    const interes = saldo * tasaMensual;
    let capital = canonFin - interes + extra;
    if (capital <= 0) { capitalCero = true; break; }
    if (saldo - capital < residual && extra === 0) capital = saldo - residual;
    if (capital > saldo) capital = saldo;

    const saldoFinal = Math.max(0, saldo - capital);
    const canonTotal = canonFin + input.seguros + extra;

    cuotas.push({
      numero: i + 1,
      fecha: addMonths(input.fechaInicio, i),
      saldoInicial: saldo,
      interes,
      capital,
      seguros: input.seguros,
      canonFinanciero: canonFin,
      canonTotal,
      saldoFinal,
    });

    totalIntereses += interes;
    totalCapital += capital;
    totalSeguros += input.seguros;
    totalPagado += canonTotal;
    saldo = saldoFinal;
    i++;
  }

  let saldoFinalProyectado = saldo;

  if (input.incluirOpcionCompra && residual > 0 && saldo > 0) {
    const ultimaFecha = cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha : input.fechaInicio;
    cuotas.push({
      numero: cuotas.length + 1,
      fecha: addMonths(ultimaFecha, 1),
      saldoInicial: saldo,
      interes: 0,
      capital: saldo,
      seguros: 0,
      canonFinanciero: 0,
      canonTotal: saldo,
      saldoFinal: 0,
      esOpcionCompra: true,
    });
    totalCapital += saldo;
    totalPagado += saldo;
    saldoFinalProyectado = 0;
  }

  const saldoObjetivo = input.incluirOpcionCompra ? 0 : residual;
  const saldoResidualDif = Math.abs(saldoFinalProyectado - saldoObjetivo);
  const saldoResidualDifPct = residual > 0 ? (saldoResidualDif / residual) * 100 : 0;
  const canonReconstruidoDifPct =
    input.canonBancoReportado && input.canonBancoReportado > 0
      ? ((canonFin + input.seguros - input.canonBancoReportado) / input.canonBancoReportado) * 100
      : null;

  return {
    cuotas,
    canonFinancieroBase: canonFin,
    canonTotalBase: canonFin + input.seguros,
    totalIntereses,
    totalCapital,
    totalSeguros,
    totalPagado,
    saldoFinalProyectado,
    valorResidual: residual,
    fechaFinalizacion: cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha : null,
    saldoConvergeAlResidual: saldoResidualDifPct < 0.5,
    vecesPagado: saldoIni > 0 ? totalPagado / saldoIni : 0,
    qa: {
      canonReconstruidoDifPct,
      saldoResidualDifPct,
      residualComoPctDelSaldo: input.saldoInicial > 0 ? (residual / input.saldoInicial) * 100 : 0,
      capitalCero,
    },
  };
}

