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
  if (!fresh.activo || fresh.valorMensual <= 0) return false;
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
