// ═════════════════════════════════════════════════════════════════════
// Motor puro y común de propuestas comerciales.
//
// Fuente única de verdad para el cálculo de cada escenario, tanto en
// modo Pesos como en modo UVR. No contiene estado, no depende de React
// y no realiza cálculos financieros propios: delega en `finance.ts`
// (que es la única capa que ejecuta la fórmula real). Su misión es
// normalizar la forma de salida (`PropuestaCalc`, `PropuestaRow`) para
// que la interfaz y la auditoría NUVIA consuman EXACTAMENTE los mismos
// objetos, sin reconstruirlos por caminos paralelos.
// ═════════════════════════════════════════════════════════════════════
import {
  calculatePesosManualByCuotas,
  calculateUVRManualByCuotas,
  type PesosInput,
  type UVRInput,
  type UVREscenarioActual,
} from "./finance";

export type PropuestaFuente = "automatica" | "manual";

/** Resultado inmutable de un escenario individual. Coincide 1:1 con el
 *  contrato histórico usado por `PropuestasComerciales`. */
export interface PropuestaCalc {
  valid: boolean;
  motivo?: string;
  cuotasEliminadas: number;
  añosEliminados: number;
  nuevoPlazo: number;
  nuevaCuota: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  incrementoMensual: number;
}

/** Fila de propuesta lista para PDF / snapshot / auditoría. Incluye
 *  `index` y `fuente` para trazabilidad. */
export interface PropuestaRow extends PropuestaCalc {
  index: number;
  fuente: PropuestaFuente;
}

// ─── Cálculo Pesos ────────────────────────────────────────────────────
export function computePropuestaPesos(
  input: PesosInput,
  cuotasEliminadas: number,
): PropuestaCalc {
  const r = calculatePesosManualByCuotas(input, cuotasEliminadas);
  return {
    valid: r.valid,
    motivo: r.motivo,
    cuotasEliminadas: r.cuotasEliminadas || cuotasEliminadas,
    añosEliminados: r.añosEliminados,
    nuevoPlazo: r.nuevoPlazo,
    nuevaCuota: r.nuevaCuotaConSeguro,
    ahorroIntereses: r.ahorroIntereses,
    ahorroSeguros: r.ahorroSeguros,
    ahorroTotal: r.ahorroTotal,
    honorarios: r.honorarios,
    totalProyectado: r.totalProyectado,
    incrementoMensual: r.incrementoMensual,
  };
}

// ─── Cálculo UVR ──────────────────────────────────────────────────────
export function computePropuestaUVR(
  input: UVRInput,
  escenarioActual: UVREscenarioActual,
  cuotasEliminadas: number,
): PropuestaCalc {
  const r = calculateUVRManualByCuotas(input, escenarioActual, cuotasEliminadas);
  return {
    valid: r.valid,
    motivo: r.motivo,
    cuotasEliminadas: r.cuotasEliminadas || cuotasEliminadas,
    añosEliminados: r.añosEliminados,
    nuevoPlazo: r.nuevoPlazo,
    nuevaCuota: r.nuevaCuotaPesos,
    ahorroIntereses: r.ahorroIntereses,
    ahorroSeguros: r.ahorroSeguros,
    ahorroTotal: r.ahorroTotal,
    honorarios: r.honorarios,
    totalProyectado: r.totalProyectado,
    incrementoMensual: r.incrementoMensual,
  };
}

/** Selecciona el índice del escenario con mayor ahorro total entre los
 *  válidos. Devuelve -1 si no hay ninguno viable. */
export function pickBestIdx(calcs: readonly PropuestaCalc[]): number {
  let best = -1;
  let bestAhorro = -Infinity;
  for (let i = 0; i < calcs.length; i++) {
    const c = calcs[i];
    if (c.valid && c.ahorroTotal > bestAhorro) {
      bestAhorro = c.ahorroTotal;
      best = i;
    }
  }
  return best;
}

export function toPropuestaRow(
  c: PropuestaCalc,
  index: number,
  fuente: PropuestaFuente,
): PropuestaRow {
  return {
    index,
    fuente,
    valid: c.valid,
    motivo: c.motivo,
    cuotasEliminadas: c.cuotasEliminadas,
    añosEliminados: c.añosEliminados,
    nuevoPlazo: c.nuevoPlazo,
    nuevaCuota: c.nuevaCuota,
    ahorroIntereses: c.ahorroIntereses,
    ahorroSeguros: c.ahorroSeguros,
    ahorroTotal: c.ahorroTotal,
    honorarios: c.honorarios,
    totalProyectado: c.totalProyectado,
    incrementoMensual: c.incrementoMensual,
  };
}
