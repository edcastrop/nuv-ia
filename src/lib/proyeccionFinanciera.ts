// Motor para el módulo "Proyección Financiera NUVEX".
// Calcula amortización mes a mes, soporta aportes mensuales extra y
// abonos extraordinarios. Tipos preparados para futura ingesta vía IA.

export type TipoProducto = "hipotecario" | "leasing";
export type Moneda = "pesos" | "uvr";
export type TipoEscenario = "actual" | "nuvex" | "conservador" | "agresivo" | "personalizado";

export interface ProyeccionFinancieraInput {
  // Identidad
  clienteNombre: string;
  banco: string;
  tipoProducto: TipoProducto;
  moneda: Moneda;
  fechaDesembolso: string; // ISO yyyy-mm-dd

  // Crédito
  valorDesembolsado: number;
  saldoCapital: number;
  cuotaActual: number;
  teaPct: number;
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasPendientes: number;

  // Seguros desglosados
  seguroVida: number;
  seguroIncendio: number;
  seguroTerremoto: number;
  otrosSeguros: number;

  // UVR
  uvrValor?: number;
  saldoUvr?: number;
  variacionUvrPct?: number;

  notas?: string;

  // Datos de contacto / identificación (opcionales, usados para crear caso)
  cedula?: string;
  numeroCredito?: string;
  celular?: string;
  correo?: string;
  ciudad?: string;
}

export interface EscenarioInput {
  nombre: string;
  tipo: TipoEscenario;
  aporteMensualExtra: number;
  abonoExtraordinario: number; // aplicado en la primera cuota
  nuevaTasa?: number; // si se quiere simular renegociación
}

export interface CuotaProyectada {
  numero: number;
  fecha: Date;
  saldoInicial: number;
  capital: number;
  interes: number;
  seguros: number;
  cuota: number;
  cuotaConExtra: number;
  saldoFinal: number;
}

export interface ResultadoEscenario {
  cuotas: CuotaProyectada[];
  totalCapital: number;
  totalIntereses: number;
  totalSeguros: number;
  totalPagado: number;
  fechaFinalizacion: Date | null;
  mesesRestantes: number;
}

export interface KpisComparacion {
  mesesEliminados: number;
  aniosEliminados: number;
  interesesEvitados: number;
  segurosEvitados: number;
  ahorroTotal: number;
  costoNoActuar: number; // intereses + seguros que se pagarían demás
  roiCliente: number; // ahorroTotal / inversionExtra
  incrementoCuota: number;
  inversionExtra: number;
  fechaActual: Date | null;
  fechaOptimizada: Date | null;
}

const addMonths = (d: Date, n: number): Date => {
  const x = new Date(d.getTime());
  const day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + n);
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
};

export const totalSegurosMensual = (i: ProyeccionFinancieraInput): number =>
  (i.seguroVida || 0) + (i.seguroIncendio || 0) + (i.seguroTerremoto || 0) + (i.otrosSeguros || 0);

/**
 * Proyecta el crédito con cuota fija (sin seguros) calculada a partir de la
 * cuota actual del banco. Permite aportes mensuales extra y abono extraordinario.
 */
export function proyectarEscenario(
  input: ProyeccionFinancieraInput,
  escenario: EscenarioInput,
): ResultadoEscenario {
  const seguros = totalSegurosMensual(input);
  const teaUsada = escenario.nuevaTasa && escenario.nuevaTasa > 0 ? escenario.nuevaTasa : input.teaPct;
  const tasaMensual = teaUsada > 0 ? Math.pow(1 + teaUsada / 100, 1 / 12) - 1 : 0;
  const cuotaSinSeguros = Math.max(0, input.cuotaActual - seguros);
  const fechaInicio = input.fechaDesembolso ? new Date(input.fechaDesembolso) : new Date();

  let saldo = Math.max(0, input.saldoCapital);
  if (escenario.abonoExtraordinario > 0) {
    saldo = Math.max(0, saldo - escenario.abonoExtraordinario);
  }

  const aporteExtra = Math.max(0, escenario.aporteMensualExtra);
  const maxMeses = Math.max(input.cuotasPendientes || 360, 360) + 60;
  const cuotas: CuotaProyectada[] = [];

  let totalCapital = 0;
  let totalIntereses = 0;
  let totalSeguros = 0;
  let totalPagado = 0;
  let i = 0;

  while (saldo > 0.5 && i < maxMeses) {
    const interes = saldo * tasaMensual;
    let capital = cuotaSinSeguros - interes + aporteExtra;
    if (capital <= 0) break;
    if (capital > saldo) capital = saldo;
    const saldoFinal = Math.max(0, saldo - capital);
    const cuotaBase = interes + (capital - aporteExtra) + seguros;
    const cuotaConExtra = cuotaBase + aporteExtra;

    cuotas.push({
      numero: i + 1,
      fecha: addMonths(fechaInicio, (input.cuotasPagadas || 0) + i),
      saldoInicial: saldo,
      capital,
      interes,
      seguros,
      cuota: cuotaBase,
      cuotaConExtra,
      saldoFinal,
    });

    totalCapital += capital;
    totalIntereses += interes;
    totalSeguros += seguros;
    totalPagado += cuotaConExtra;
    saldo = saldoFinal;
    i++;
  }

  return {
    cuotas,
    totalCapital,
    totalIntereses,
    totalSeguros,
    totalPagado,
    fechaFinalizacion: cuotas.length > 0 ? cuotas[cuotas.length - 1].fecha : null,
    mesesRestantes: cuotas.length,
  };
}

export function compararEscenarios(
  actual: ResultadoEscenario,
  optimizado: ResultadoEscenario,
  aporteMensualExtra: number,
  abonoExtraordinario: number,
): KpisComparacion {
  const mesesEliminados = Math.max(0, actual.mesesRestantes - optimizado.mesesRestantes);
  const interesesEvitados = Math.max(0, actual.totalIntereses - optimizado.totalIntereses);
  const segurosEvitados = Math.max(0, actual.totalSeguros - optimizado.totalSeguros);
  const ahorroTotal = interesesEvitados + segurosEvitados;
  const inversionExtra = aporteMensualExtra * optimizado.mesesRestantes + abonoExtraordinario;
  const roi = inversionExtra > 0 ? ahorroTotal / inversionExtra : 0;

  return {
    mesesEliminados,
    aniosEliminados: Math.floor(mesesEliminados / 12),
    interesesEvitados,
    segurosEvitados,
    ahorroTotal,
    costoNoActuar: ahorroTotal, // dinero que pagará de más si no optimiza
    roiCliente: roi,
    incrementoCuota: aporteMensualExtra,
    inversionExtra,
    fechaActual: actual.fechaFinalizacion,
    fechaOptimizada: optimizado.fechaFinalizacion,
  };
}

export const escenarioActual = (): EscenarioInput => ({
  nombre: "Crédito actual",
  tipo: "actual",
  aporteMensualExtra: 0,
  abonoExtraordinario: 0,
});
