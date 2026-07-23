// ═════════════════════════════════════════════════════════════════════
// Adaptador UVR — motor determinista de escenarios comerciales.
//
// - La ESCALA AUTOMÁTICA (72/84/96/108, 36/48/60/72, 12/24/36/48) se
//   determina exclusivamente con `plazoInicial` (regla comercial NUVIA).
// - La VALIDEZ estructural y el nuevoPlazo se determinan con
//   `plazoRestante` (= `cuotasPendientes`).
// - Devuelve una única instancia lógica de propuestas que alimenta
//   tarjetas, recomendación, snapshot NUVIA, hash y evento de emisión.
// ═════════════════════════════════════════════════════════════════════
import {
  getUVRReductionOptions as _getUVRReductionOptions,
  type UVRInput,
  type UVREscenarioActual,
} from "./finance";
import {
  computePropuestaUVR,
  pickBestIdx,
  toPropuestaRow,
  type PropuestaCalc,
  type PropuestaFuente,
  type PropuestaRow,
} from "./propuestasEngine";

export const getUVRReductionOptions = _getUVRReductionOptions;

export interface UvrEscenariosInput {
  /** Plazo original del crédito. Determina la escala automática. */
  plazoInicial: number;
  /** Cuotas pendientes vigentes (= plazoRestante). Determina la validez
   *  de cada reducción y el nuevoPlazo resultante. */
  plazoRestante: number;
  input: UVRInput;
  escenarioActual: UVREscenarioActual;
  /** Override manual del analista. Si es undefined, longitud ≠ 4 o
   *  falla `isCuotasListValid`, se usa la escala automática. */
  cuotasList?: number[];
  /** Posición 0..3 dentro de `cuotasList` marcada manualmente como
   *  recomendada. -1 = usar automática (bestIdx por ahorro total). */
  recomendadaListIdx?: number;
}

export interface UvrEscenariosResult {
  /** cuotasList efectiva (siempre 4 posiciones). */
  cuotasList: number[];
  /** Escala automática correspondiente al `plazoInicial` recibido. */
  cuotasAutomaticas: number[];
  /** Origen de `cuotasList`. */
  fuente: PropuestaFuente;
  /** 4 cálculos crudos (incluye no-válidos para render). */
  escenarios: PropuestaCalc[];
  /** Sólo propuestas válidas (contrato PDF/snapshot). */
  propuestas: PropuestaRow[];
  /** Índice recomendado dentro de `cuotasList` (0..3). -1 si ninguno. */
  recomendadaListIdx: number;
  /** Índice recomendado dentro de `propuestas` (válidas). -1 si vacío. */
  recomendadaRowIdx: number;
  /** true si el override manual del padre existía pero no pasó la
   *  validación estructural y se regeneró la escala automática. */
  regeneradaPorInvalidez: boolean;
}

/** Estructural: 4 enteros positivos, únicos, estrictamente ascendentes
 *  y menores al plazo restante. */
export function isCuotasListValid(
  list: number[] | undefined,
  plazoRestante: number,
): boolean {
  if (!Array.isArray(list) || list.length !== 4) return false;
  if (!Number.isFinite(plazoRestante) || plazoRestante <= 1) return false;
  const seen = new Set<number>();
  let prev = -Infinity;
  for (let i = 0; i < 4; i++) {
    const v = list[i];
    if (!Number.isInteger(v) || v <= 0) return false;
    if (v >= plazoRestante) return false;
    if (v <= prev) return false;
    if (seen.has(v)) return false;
    seen.add(v);
    prev = v;
  }
  return true;
}

export function buildUvrEscenarios(args: UvrEscenariosInput): UvrEscenariosResult {
  const {
    plazoInicial,
    plazoRestante,
    input,
    escenarioActual,
    cuotasList: userCuotas,
    recomendadaListIdx: userRecomendadaListIdx = -1,
  } = args;

  const cuotasAutomaticas = getUVRReductionOptions(plazoInicial);
  const userProvided = Array.isArray(userCuotas) && userCuotas.length > 0;
  const manualValida = userProvided && isCuotasListValid(userCuotas, plazoRestante);
  const fuente: PropuestaFuente = manualValida ? "manual" : "automatica";
  const cuotasListEfectiva = manualValida ? [...(userCuotas as number[])] : [...cuotasAutomaticas];
  const regeneradaPorInvalidez = userProvided && !manualValida;

  const escenarios: PropuestaCalc[] = cuotasListEfectiva.map((c) =>
    computePropuestaUVR(input, escenarioActual, c),
  );

  const propuestas: PropuestaRow[] = [];
  for (let i = 0; i < escenarios.length; i++) {
    if (escenarios[i].valid) propuestas.push(toPropuestaRow(escenarios[i], i, fuente));
  }

  // Recomendada: prioridad al override si es válido; si no, best por ahorro.
  const bestListIdx = pickBestIdx(escenarios);
  const overrideValido =
    Number.isInteger(userRecomendadaListIdx) &&
    userRecomendadaListIdx >= 0 &&
    userRecomendadaListIdx < escenarios.length &&
    escenarios[userRecomendadaListIdx].valid;
  const recomendadaListIdx = overrideValido ? userRecomendadaListIdx : bestListIdx;
  const recomendadaRowIdx =
    recomendadaListIdx >= 0
      ? propuestas.findIndex((r) => r.index === recomendadaListIdx)
      : -1;

  return {
    cuotasList: cuotasListEfectiva,
    cuotasAutomaticas,
    fuente,
    escenarios,
    propuestas,
    recomendadaListIdx,
    recomendadaRowIdx,
    regeneradaPorInvalidez,
  };
}
