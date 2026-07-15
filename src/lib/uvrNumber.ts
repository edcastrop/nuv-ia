// ─────────────────────────────────────────────────────────────
// UVR number parser (deterministic, ambiguity-aware).
//
// Rationale: los parsers de montos en pesos existentes tratan "385,4321"
// eliminando la coma (→ 3854321) porque asumen coma como separador de
// miles. En créditos UVR el saldo UVR y el valor UVR se publican con 4
// decimales y ese comportamiento corrompe el dato.
//
// Este módulo NO reemplaza `parseMontoExtracto` para pesos. Sólo se usa
// para los tres campos críticos de UVR y para la validación de coherencia
// (saldoUVR × valorUVR ≈ saldoCapital en pesos).
//
// Reglas:
//  - Entradas inequívocas → devuelven un único número.
//  - Entradas ambiguas (un solo separador con exactamente 3 dígitos a la
//    derecha, p.ej. "123.456" o "123,456") → devuelven los dos candidatos
//    y `parseUVRNumber` retorna `undefined`. El caller debe resolverla
//    por coherencia matemática.
//  - Entradas inválidas → arreglo vacío / `undefined`.
//  - No se aceptan negativos, `Infinity`, `NaN`, separadores consecutivos
//    ni caracteres no numéricos (salvo `$`, espacios y NBSP que se limpian).
// ─────────────────────────────────────────────────────────────

export const UVR_COHERENCE_TOLERANCE_PCT = 0.01;

const isFinitePositive = (n: number) => Number.isFinite(n) && n >= 0;

/**
 * Devuelve TODOS los candidatos válidos que la cadena podría representar.
 * - 0 elementos → inválida.
 * - 1 elemento → inequívoca.
 * - 2 elementos → ambigua (decimal vs miles).
 */
export function parseUVRNumberCandidates(input: unknown): number[] {
  if (input === null || input === undefined) return [];
  if (typeof input === "number") {
    return isFinitePositive(input) ? [input] : [];
  }
  if (typeof input !== "string") return [];

  let s = input.trim().replace(/\u00a0/g, " ").replace(/\$/g, "").replace(/\s+/g, "");
  if (!s) return [];
  if (s.startsWith("-")) return [];
  if (!/^[0-9.,]+$/.test(s)) return [];
  // separadores consecutivos o duplicados adyacentes
  if (/[.,][.,]/.test(s)) return [];

  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;

  if (dots === 0 && commas === 0) {
    const n = Number(s);
    return isFinitePositive(n) ? [n] : [];
  }

  if (dots > 0 && commas > 0) {
    // Inequívoco: el último separador es decimal.
    const lastDot = s.lastIndexOf(".");
    const lastComma = s.lastIndexOf(",");
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thouSep = decimalSep === "," ? "." : ",";
    const segments = s.split(decimalSep);
    if (segments.length !== 2) return [];
    const [intPart, decPart] = segments;
    if (!intPart || !decPart) return [];
    if (!/^\d+$/.test(decPart)) return [];
    const groups = intPart.split(thouSep);
    if (groups.length < 2) return [];
    if (!/^\d{1,3}$/.test(groups[0])) return [];
    for (let i = 1; i < groups.length; i++) {
      if (!/^\d{3}$/.test(groups[i])) return [];
    }
    const n = Number(groups.join("") + "." + decPart);
    return isFinitePositive(n) ? [n] : [];
  }

  // Un solo tipo de separador
  const sep = dots > 0 ? "." : ",";
  const parts = s.split(sep);

  if (parts.length === 2) {
    const [a, b] = parts;
    if (!a || !b) return [];
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return [];
    if (b.length === 3 && a.length >= 1 && a.length <= 3) {
      // Ambigüedad real: 3 dígitos a la derecha, ≤3 a la izquierda.
      const dec = Number(`${a}.${b}`);
      const thou = Number(`${a}${b}`);
      const out: number[] = [];
      if (isFinitePositive(dec)) out.push(dec);
      if (isFinitePositive(thou) && thou !== dec) out.push(thou);
      return out;
    }
    // No ambiguo → decimal (convención colombiana; para punto con >3 o <3
    // dígitos a la derecha también es decimal).
    const n = Number(`${a}.${b}`);
    return isFinitePositive(n) ? [n] : [];
  }

  // Múltiples separadores iguales → miles obligatorios.
  if (!/^\d{1,3}$/.test(parts[0])) return [];
  for (let i = 1; i < parts.length; i++) {
    if (!/^\d{3}$/.test(parts[i])) return [];
  }
  const n = Number(parts.join(""));
  return isFinitePositive(n) ? [n] : [];
}

/**
 * Devuelve un número únicamente cuando la entrada es inequívoca.
 * Ambigüedades y errores devuelven `undefined` — nunca se adivina.
 */
export function parseUVRNumber(input: unknown): number | undefined {
  const cands = parseUVRNumberCandidates(input);
  return cands.length === 1 ? cands[0] : undefined;
}

export type UVRCoherenceResult = {
  ejecutable: boolean;
  isCoherent: boolean;
  saldoUVR?: number;
  valorUVR?: number;
  saldoPesos?: number;
  productoPesos?: number;
  diffPct?: number;
  motivo?: string;
};

/**
 * Valida que `saldoUVR × valorUVR ≈ saldoPesos` dentro del 1 %.
 * - `ejecutable: false` cuando falta o es inválido cualquiera de los tres.
 * - `ejecutable: true, isCoherent: false` cuando existen pero divergen.
 */
export function validateUVRCoherence(
  saldoUVR: number | undefined | null,
  valorUVR: number | undefined | null,
  saldoPesos: number | undefined | null,
): UVRCoherenceResult {
  const s = typeof saldoUVR === "number" && Number.isFinite(saldoUVR) ? saldoUVR : undefined;
  const v = typeof valorUVR === "number" && Number.isFinite(valorUVR) ? valorUVR : undefined;
  const p = typeof saldoPesos === "number" && Number.isFinite(saldoPesos) ? saldoPesos : undefined;
  if (!(s && s > 0 && v && v > 0 && p && p > 0)) {
    return {
      ejecutable: false,
      isCoherent: false,
      saldoUVR: s,
      valorUVR: v,
      saldoPesos: p,
      motivo:
        "Faltan o son inválidos uno o más datos críticos (saldoUVR, valorUVR o saldoCapital en pesos).",
    };
  }
  const producto = s * v;
  const diffPct = Math.abs(producto - p) / p;
  return {
    ejecutable: true,
    isCoherent: diffPct <= UVR_COHERENCE_TOLERANCE_PCT,
    saldoUVR: s,
    valorUVR: v,
    saldoPesos: p,
    productoPesos: producto,
    diffPct,
  };
}

export type UVRResolution = {
  resolved: boolean;
  saldoUVR?: number;
  valorUVR?: number;
  coherent?: UVRCoherenceResult;
  multipleCoherent: boolean;
  triedCombinations: number;
};

/**
 * Cuando algún candidato UVR es ambiguo, prueba todas las combinaciones y
 * resuelve SÓLO si exactamente una combinación es coherente con saldoPesos.
 * Nunca resuelve silenciosamente en presencia de múltiples combinaciones
 * coherentes o ninguna.
 */
export function resolveUVRByCoherence(opts: {
  saldoUVRCandidates: number[];
  valorUVRCandidates: number[];
  saldoPesos: number | undefined;
}): UVRResolution {
  const { saldoUVRCandidates, valorUVRCandidates, saldoPesos } = opts;
  if (!(saldoPesos && saldoPesos > 0) || saldoUVRCandidates.length === 0 || valorUVRCandidates.length === 0) {
    return { resolved: false, multipleCoherent: false, triedCombinations: 0 };
  }
  const coherent: Array<{ s: number; v: number; res: UVRCoherenceResult }> = [];
  let tried = 0;
  for (const s of saldoUVRCandidates) {
    for (const v of valorUVRCandidates) {
      tried++;
      const res = validateUVRCoherence(s, v, saldoPesos);
      if (res.ejecutable && res.isCoherent) coherent.push({ s, v, res });
    }
  }
  if (coherent.length === 1) {
    const { s, v, res } = coherent[0];
    return { resolved: true, saldoUVR: s, valorUVR: v, coherent: res, multipleCoherent: false, triedCombinations: tried };
  }
  return { resolved: false, multipleCoherent: coherent.length > 1, triedCombinations: tried };
}
