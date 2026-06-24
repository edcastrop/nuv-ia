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
  fechaDesembolso: string; // ISO yyyy-mm-dd usado como fecha de inicio de proyección/próxima cuota

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

const parseDateOnly = (value: string): Date | null => {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d : null;
};

const cuotaPmt = (tasaMensual: number, periodos: number, saldo: number): number => {
  const n = Math.max(0, Math.round(periodos));
  const pv = Math.max(0, saldo);
  if (pv <= 0 || n <= 0) return 0;
  if (Math.abs(tasaMensual) < 1e-10) return pv / n;
  return (pv * tasaMensual) / (1 - Math.pow(1 + tasaMensual, -n));
};

export const totalSegurosMensual = (i: ProyeccionFinancieraInput): number =>
  (i.seguroVida || 0) + (i.seguroIncendio || 0) + (i.seguroTerremoto || 0) + (i.otrosSeguros || 0);

/**
 * Proyecta el crédito con cuota fija (sin seguros) calculada a partir de la
 * cuota actual del banco. Permite aportes mensuales extra y abono extraordinario.
 *
 * Si `input.moneda === "uvr"`, escala mes a mes el saldo, la cuota y los
 * seguros con la tasa mensual equivalente a `variacionUvrPct` anual. Esto
 * refleja el comportamiento real de un crédito UVR donde la unidad se
 * reajusta con la inflación.
 */
export function proyectarEscenario(
  input: ProyeccionFinancieraInput,
  escenario: EscenarioInput,
): ResultadoEscenario {
  const segurosBase = totalSegurosMensual(input);
  const teaUsada = escenario.nuevaTasa && escenario.nuevaTasa > 0 ? escenario.nuevaTasa : input.teaPct;
  const tasaMensual = teaUsada > 0 ? Math.pow(1 + teaUsada / 100, 1 / 12) - 1 : 0;
  const cuotasPendientesOficiales = Math.max(0, Math.round(input.cuotasPendientes || 0));
  const fechaInicio = parseDateOnly(input.fechaDesembolso) ?? new Date();

  const esUvr = input.moneda === "uvr";
  const variacionAnual = esUvr ? Math.max(0, input.variacionUvrPct ?? 0) : 0;
  const factorUvr = variacionAnual > 0 ? Math.pow(1 + variacionAnual / 100, 1 / 12) : 1;

  const aporteExtra = Math.max(0, escenario.aporteMensualExtra);
  const maxMeses = Math.max(cuotasPendientesOficiales || 360, 360) + 60;
  const cuotas: CuotaProyectada[] = [];

  let totalCapital = 0;
  let totalIntereses = 0;
  let totalSeguros = 0;
  let totalPagado = 0;
  let i = 0;

  if (esUvr && (input.saldoUvr ?? 0) > 0 && (input.uvrValor ?? 0) > 0) {
    let valorUvr = Math.max(0, input.uvrValor ?? 0);
    let saldoUvr = Math.max(0, input.saldoUvr ?? 0);
    const cuotaUvrBase = cuotaPmt(tasaMensual, cuotasPendientesOficiales, saldoUvr);
    if (escenario.abonoExtraordinario > 0 && valorUvr > 0) {
      saldoUvr = Math.max(0, saldoUvr - escenario.abonoExtraordinario / valorUvr);
    }

    while (saldoUvr > 0.0001 && i < maxMeses) {
      if (i > 0 && factorUvr !== 1) valorUvr *= factorUvr;
      const interesUvr = saldoUvr * tasaMensual;
      const aporteExtraUvr = valorUvr > 0 ? aporteExtra / valorUvr : 0;
      let capitalUvr = cuotaUvrBase - interesUvr + aporteExtraUvr;
      if (capitalUvr <= 0) break;
      if (capitalUvr > saldoUvr) capitalUvr = saldoUvr;

      const saldoFinalUvr = Math.max(0, saldoUvr - capitalUvr);
      const interes = interesUvr * valorUvr;
      const capital = capitalUvr * valorUvr;
      const seguros = segurosBase;
      const cuotaBase = interes + (capital - aporteExtra) + seguros;
      const cuotaConExtra = cuotaBase + aporteExtra;

      cuotas.push({
        numero: i + 1,
        fecha: addMonths(fechaInicio, i),
        saldoInicial: saldoUvr * valorUvr,
        capital,
        interes,
        seguros,
        cuota: cuotaBase,
        cuotaConExtra,
        saldoFinal: saldoFinalUvr * valorUvr,
      });

      totalCapital += capital;
      totalIntereses += interes;
      totalSeguros += seguros;
      totalPagado += cuotaConExtra;
      saldoUvr = saldoFinalUvr;
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

  let saldo = Math.max(0, input.saldoCapital);
  const cuotaProgramada = cuotaPmt(tasaMensual, cuotasPendientesOficiales, saldo);
  let cuotaSinSeguros = cuotaProgramada > 0 ? cuotaProgramada : Math.max(0, input.cuotaActual - segurosBase);
  if (escenario.abonoExtraordinario > 0) {
    saldo = Math.max(0, saldo - escenario.abonoExtraordinario);
  }
  let seguros = segurosBase;

  while (saldo > 0.5 && i < maxMeses) {
    if (esUvr && i > 0 && factorUvr !== 1) {
      saldo = saldo * factorUvr;
      cuotaSinSeguros = cuotaSinSeguros * factorUvr;
      seguros = seguros * factorUvr;
    }
    const interes = saldo * tasaMensual;
    let capital = cuotaSinSeguros - interes + aporteExtra;
    if (capital <= 0) break;
    if (capital > saldo) capital = saldo;
    const saldoFinal = Math.max(0, saldo - capital);
    const cuotaBase = interes + (capital - aporteExtra) + seguros;
    const cuotaConExtra = cuotaBase + aporteExtra;

    cuotas.push({
      numero: i + 1,
      fecha: addMonths(fechaInicio, i),
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
