// Builders y hash canónico de snapshots NUVIA QA.
//
// Fuente única para construir el snapshot que consumen:
//   • `triggerSimuladorAutoQA` (Auto-QA de expediente)
//   • `emitDraftRawReady` (tarjeta NuviaDraftAuditCard)
//
// Los builders leen SIEMPRE del estado del formulario (post-normalización)
// y nunca de `p.raw` (payload crudo del OCR). El hash canónico se calcula
// exclusivamente sobre campos de identidad financiera; timestamps, rutas
// de archivo, nombres de archivo y metadatos de UI quedan fuera para que
// dos snapshots financieramente equivalentes produzcan el mismo hash
// aunque provengan de archivos u ocasiones distintas.
//
// Este es el ÚNICO algoritmo de hash del snapshot en el cliente. La tarjeta
// (`NuviaDraftAuditCard`) y los simuladores (Pesos / UVR) importan
// `hashQaSnapshot` desde aquí para evitar criterios divergentes.

import type { DraftRawSnapshot } from "@/components/nuvex/NuviaDraftAuditCard";
import {
  calculateUVRProjection,
  type UVRInput,
} from "@/lib/finance";

// Versión actual del contrato de snapshot NUVIA. v2 introduce persistencia
// de los cuatro escenarios financieros en `datos.propuestasComerciales`.
// Ausencia del campo `snapshotVersion` (o valor 1) implica contrato legacy.
export const SNAPSHOT_VERSION = 2 as const;

export type SnapshotEscenario = {
  index: number;
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
  fuente: "manual" | "automatica";
};

// ─── Tipos de entrada (estado del formulario ya parseado) ────────────

export type SnapshotPropuesta = {
  index?: number;
  nuevaCuota?: number;
  nuevoPlazo?: number;
  cuotasEliminadas?: number;
  añosEliminados?: number;
  ahorroIntereses?: number;
  ahorroSeguros?: number;
  ahorroTotal?: number;
  honorarios?: number;
  totalProyectado?: number;
  fuente?: "manual" | "automatica";
} | null;

export type PesosSnapshotInput = {
  banco?: string | null;
  producto?: string | null;
  cedula?: string | null;
  numeroCredito?: string | null;
  cliente?: string | null;
  saldoCapital: number;
  cuotaActual: number;
  seguros?: number;
  tea: number;
  valorDesembolsado?: number;
  plazoInicial?: string | number | null;
  cuotasPagadas?: string | number | null;
  cuotasPendientes?: string | number | null;
  tasaCobertura?: number;
  valorCobertura?: number;
  beneficioFrechMensual?: number;
  honorariosBase?: number | null;
  honorariosFinal?: number | null;
  descuento?: number | null;
  propuesta?: SnapshotPropuesta;
  archivoPath?: string | null;
  archivoNombre?: string | null;
  /**
   * Cuatro escenarios financieros (v2). Persistencia obligatoria: sin
   * exactamente 4 el snapshot queda en v1 (no se estampa snapshotVersion
   * ni propuestasComerciales) para evitar sellos v2 corruptos.
   */
  escenarios?: SnapshotEscenario[] | null;
};


export type UvrSnapshotInput = {
  banco?: string | null;
  producto?: string | null;
  cedula?: string | null;
  numeroCredito?: string | null;
  cliente?: string | null;
  saldoUVR: number;
  valorUVR: number;
  saldoPesos?: number;
  cuotaActualPesos: number;
  seguros?: number;
  teaCobrada: number;
  valorDesembolsado?: number;
  variacionUVR?: number;
  variacionUVRPropuestas?: number;
  plazoInicial?: string | number | null;
  cuotasPagadas?: string | number | null;
  cuotasPendientes?: string | number | null;
  tasaCobertura?: number;
  valorCobertura?: number;
  beneficioFrechMensual?: number;
  honorariosBase?: number | null;
  honorariosFinal?: number | null;
  descuento?: number | null;
  propuesta?: SnapshotPropuesta;
  archivoPath?: string | null;
  archivoNombre?: string | null;
  /** Cuatro escenarios financieros (v2). Persistencia obligatoria en UVR. */
  escenarios?: SnapshotEscenario[] | null;
};

// ─── Utilidades internas ─────────────────────────────────────────────

const orNull = <T>(v: T | undefined | null | ""): T | null =>
  v === undefined || v === null || (v as unknown) === "" ? null : (v as T);

const numOrUndef = (v: number | undefined | null): number | undefined =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;

const strOrEmpty = (v: string | null | undefined): string => (v ?? "").toString();

// Redondeo a 6 decimales para eliminar ruido de coma flotante sin
// alterar la identidad financiera del snapshot. NO se aplica a montos
// grandes en pesos (donde el ruido no aparece); afecta principalmente
// TEAs y porcentajes.
const roundFin = (n: number | null | undefined): number | null => {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
};

// ─── Builders ────────────────────────────────────────────────────────

// Regla de sellado v2 (Opción A · bloqueo estricto):
// Sólo se estampa `snapshotVersion=2` + `propuestasComerciales=[…4…]`
// cuando existen EXACTAMENTE cuatro escenarios financieros válidos.
// Con cualquier otra cantidad (0, 1, 2, 3, >4) el snapshot queda en v1
// (sin `snapshotVersion` ni `propuestasComerciales`). El consumidor
// clasificará entonces como `reconstruido_legacy` o `sin_snapshot` y
// nunca podrá persistir un v2 corrupto ni certificar parcial.
function hasExactlyFourScenarios(escenarios: SnapshotEscenario[] | null | undefined): boolean {
  return Array.isArray(escenarios) && escenarios.length === 4;
}

function mapEscenarios(escenarios: SnapshotEscenario[]): SnapshotEscenario[] {
  return escenarios.map((e) => ({ ...e }));
}

export function buildPesosQaSnapshot(input: PesosSnapshotInput): DraftRawSnapshot {
  const datos: Record<string, unknown> = {
    banco: strOrEmpty(input.banco),
    producto: strOrEmpty(input.producto),
    cedula: strOrEmpty(input.cedula),
    numeroCredito: strOrEmpty(input.numeroCredito),
    cliente: strOrEmpty(input.cliente),
    titular: strOrEmpty(input.cliente),
    saldoCapital: input.saldoCapital,
    cuotaActual: input.cuotaActual,
    seguros: input.seguros ?? 0,
    tasaEA: input.tea,
    teaCobrada: input.tea,
    valorDesembolsado: numOrUndef(input.valorDesembolsado),
    plazoInicial: input.plazoInicial ?? undefined,
    cuotasPagadas: input.cuotasPagadas ?? undefined,
    cuotasPendientes: input.cuotasPendientes ?? undefined,
    tasaCobertura: numOrUndef(input.tasaCobertura),
    valorCobertura: numOrUndef(input.valorCobertura),
    beneficioFrechMensual: numOrUndef(input.beneficioFrechMensual),
  };
  if (hasExactlyFourScenarios(input.escenarios)) {
    datos.snapshotVersion = SNAPSHOT_VERSION;
    datos.propuestasComerciales = mapEscenarios(input.escenarios as SnapshotEscenario[]);
  }
  return {
    banco: orNull(input.banco),
    producto: orNull(input.producto),
    moneda: "COP",
    tipoCredito: "pesos",
    datos,
    archivoPath: orNull(input.archivoPath),
    archivoNombre: orNull(input.archivoNombre),
    honorariosBase: input.honorariosBase ?? null,
    honorariosFinal: input.honorariosFinal ?? null,
    descuento: input.descuento ?? null,
    propuesta: (input.propuesta ?? null) as Record<string, unknown> | null,
  };
}

export function buildUvrQaSnapshot(input: UvrSnapshotInput): DraftRawSnapshot {
  const saldoPesos = input.saldoPesos ?? input.saldoUVR * input.valorUVR;
  const datos: Record<string, unknown> = {
    // La modalidad y moneda viajan explícitas para que ningún consumidor
    // pueda reclasificar la simulación como Pesos.
    modalidad: "uvr",
    moneda: "UVR",
    banco: strOrEmpty(input.banco),
    producto: strOrEmpty(input.producto),
    cedula: strOrEmpty(input.cedula),
    numeroCredito: strOrEmpty(input.numeroCredito),
    cliente: strOrEmpty(input.cliente),
    titular: strOrEmpty(input.cliente),
    saldoCapital: saldoPesos,
    saldoPesos: numOrUndef(input.saldoPesos),
    saldoUVR: input.saldoUVR,
    valorUVR: input.valorUVR,
    cuotaActual: input.cuotaActualPesos,
    cuotaActualPesos: input.cuotaActualPesos,
    seguros: input.seguros ?? 0,
    tasaEA: input.teaCobrada,
    teaCobrada: input.teaCobrada,
    valorDesembolsado: numOrUndef(input.valorDesembolsado),
    variacionUVR: numOrUndef(input.variacionUVR),
    variacionUVRPropuestas: numOrUndef(input.variacionUVRPropuestas),
    plazoInicial: input.plazoInicial ?? undefined,
    cuotasPagadas: input.cuotasPagadas ?? undefined,
    cuotasPendientes: input.cuotasPendientes ?? undefined,
    tasaCobertura: numOrUndef(input.tasaCobertura),
    valorCobertura: numOrUndef(input.valorCobertura),
    beneficioFrechMensual: numOrUndef(input.beneficioFrechMensual),
  };
  // v2 estricto: exige exactamente 4 escenarios. Sin ellos, el snapshot
  // permanece en v1 (sin snapshotVersion ni propuestasComerciales) y el
  // consumidor no puede sellar auditoría v2 parcial ni certificar.
  if (hasExactlyFourScenarios(input.escenarios)) {
    datos.snapshotVersion = SNAPSHOT_VERSION;
    datos.propuestasComerciales = mapEscenarios(input.escenarios as SnapshotEscenario[]);
  }
  return {
    banco: orNull(input.banco),
    producto: orNull(input.producto),
    moneda: "UVR",
    tipoCredito: "uvr",
    datos,
    archivoPath: orNull(input.archivoPath),
    archivoNombre: orNull(input.archivoNombre),
    honorariosBase: input.honorariosBase ?? null,
    honorariosFinal: input.honorariosFinal ?? null,
    descuento: input.descuento ?? null,
    propuesta: (input.propuesta ?? null) as Record<string, unknown> | null,
  };
}


// ─── Hash canónico ───────────────────────────────────────────────────

// Lista fija de campos financieros que definen la identidad del snapshot
// para efectos de idempotencia y detección de invalidación. NO incluye
// archivoPath, archivoNombre, timestamps ni metadatos de UI.
const HASH_FIELDS = [
  "modalidad",
  "moneda",
  "banco",
  "producto",
  "saldoCapital",
  "saldoPesos",
  "saldoUVR",
  "valorUVR",
  "variacionUVR",
  "variacionUVRPropuestas",
  "cuotaActual",
  "cuotaActualPesos",
  "seguros",
  "tasaEA",
  "teaCobrada",
  "valorDesembolsado",
  "plazoInicial",
  "cuotasPagadas",
  "cuotasPendientes",
  "tasaCobertura",
  "valorCobertura",
  "beneficioFrechMensual",
] as const;

// Extrae un campo del snapshot para el hash canónico.
// Convierte strings numéricos triviales (ej. "84") a número para que
// "84" y 84 no produzcan hashes distintos.
function normalizeHashValue(v: unknown): unknown {
  if (v === undefined || v === "") return null;
  if (v === null) return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return roundFin(v);
  }
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const asNum = Number(trimmed);
    if (Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(trimmed)) return roundFin(asNum);
    return trimmed;
  }
  if (typeof v === "boolean") return v;
  return String(v);
}

// FNV-1a 32-bit → hex de 8 chars. Determinista, sin dependencias.
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * Hash canónico del snapshot (identidad financiera). Versionado:
 *   v1 (legacy): sólo campos de `HASH_FIELDS`. Se preserva estable para no
 *                invalidar auditorías históricas.
 *   v2: v1 + huella de `datos.propuestasComerciales` (los cuatro
 *       escenarios). Un cambio en la lista de escenarios modifica el hash.
 * La versión se toma de `datos.snapshotVersion`; ausente → v1.
 */
export function hashQaSnapshot(snapshot: DraftRawSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const datos = (snapshot.datos ?? {}) as Record<string, unknown>;
  const version = Number(datos.snapshotVersion) === 2 ? 2 : 1;
  return version === 2 ? hashV2(snapshot) : hashV1(snapshot);
}

function hashV1(snapshot: DraftRawSnapshot): string {
  const datos = (snapshot.datos ?? {}) as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};
  canonical.banco = normalizeHashValue(datos.banco ?? snapshot.banco ?? null);
  canonical.producto = normalizeHashValue(datos.producto ?? snapshot.producto ?? null);
  canonical.moneda = normalizeHashValue(datos.moneda ?? snapshot.moneda ?? null);
  canonical.modalidad = normalizeHashValue(datos.modalidad ?? snapshot.tipoCredito ?? null);
  for (const key of HASH_FIELDS) {
    if (key in canonical) continue;
    canonical[key] = normalizeHashValue(datos[key]);
  }
  const sortedKeys = Object.keys(canonical).sort();
  const payload = JSON.stringify(sortedKeys.map((k) => [k, canonical[k]]));
  return fnv1a(payload);
}

function hashV2(snapshot: DraftRawSnapshot): string {
  const base = hashV1(snapshot);
  const datos = (snapshot.datos ?? {}) as Record<string, unknown>;
  const escenarios = Array.isArray(datos.propuestasComerciales)
    ? (datos.propuestasComerciales as SnapshotEscenario[])
    : [];
  const canonicalEsc = escenarios
    .map((e) => [
      normalizeHashValue(e.cuotasEliminadas),
      normalizeHashValue(e.nuevaCuota),
      normalizeHashValue(e.nuevoPlazo),
      normalizeHashValue(e.ahorroTotal),
      normalizeHashValue(e.honorarios),
    ])
    // Los índices ordenan por `cuotasEliminadas` para estabilidad canónica
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return fnv1a(`v2:${base}:${JSON.stringify(canonicalEsc)}`);
}

/**
 * Devuelve una copia del snapshot con `snapshotVersion` retirado para forzar
 * hash v1 al comparar contra auditorías legacy. Uso: al hidratar una
 * auditoría v1 el card debe comparar hash actual (retrotraído a v1) contra
 * el hash reconstruido del `simulador_snapshot` original.
 */
export function downgradeToV1(snapshot: DraftRawSnapshot | null | undefined): DraftRawSnapshot | null {
  if (!snapshot) return null;
  const datos = { ...(snapshot.datos ?? {}) } as Record<string, unknown>;
  delete datos.snapshotVersion;
  delete datos.propuestasComerciales;
  return { ...snapshot, datos };
}


// ─── Decisores puros de dispatch Auto-QA ─────────────────────────────
//
// Estos helpers permiten que los simuladores gestionen re-programación
// determinística sin lógica ad-hoc: si el snapshot cambia durante el
// `await`, el resultado obsoleto se descarta y el efecto vuelve a
// disparar con el hash actual. Ver `PesosSimulator` / `UVRSimulator`
// para el consumo canónico.

export type AutoQADispatchDecision =
  | { kind: "skip"; reason: "no-intent" | "no-hash" | "inflight" | "failed-waiting-retry" }
  | { kind: "clear-intent"; reason: "already-successful" }
  | { kind: "dispatch"; hash: string };

/**
 * Decide si el efecto debe disparar Auto-QA para el snapshot actual.
 * - Si el hash actual ya fue auditado exitosamente → limpia la intención.
 * - Si el hash actual falló → NO reintenta automáticamente; espera acción
 *   explícita del analista (retry manual limpia `failedHash`).
 * - Si otro hash está en vuelo → salta; el efecto se re-evaluará cuando
 *   `inflightHash` se libere.
 */
export function decideAutoQADispatch(input: {
  hasIntent: boolean;
  currentHash: string;
  inflightHash: string | null;
  successHash: string | null;
  failedHash: string | null;
}): AutoQADispatchDecision {
  if (!input.hasIntent) return { kind: "skip", reason: "no-intent" };
  if (!input.currentHash) return { kind: "skip", reason: "no-hash" };
  if (input.successHash === input.currentHash) {
    return { kind: "clear-intent", reason: "already-successful" };
  }
  if (input.inflightHash !== null && input.inflightHash !== input.currentHash) {
    return { kind: "skip", reason: "inflight" };
  }
  if (input.inflightHash === input.currentHash) {
    return { kind: "skip", reason: "inflight" };
  }
  if (input.failedHash === input.currentHash) {
    return { kind: "skip", reason: "failed-waiting-retry" };
  }
  return { kind: "dispatch", hash: input.currentHash };
}

export type AutoQAResultReconcile =
  | { kind: "obsolete" }
  | { kind: "apply" };

/**
 * Reconcilia un resultado que llega tras el await. Si el `inflightHash`
 * ya no coincide con el hash del resultado, el resultado corresponde a
 * un snapshot superado por una edición posterior y debe descartarse.
 */
export function decideAutoQAResult(input: {
  resultHash: string;
  inflightHash: string | null;
}): AutoQAResultReconcile {
  if (input.inflightHash !== input.resultHash) return { kind: "obsolete" };
  return { kind: "apply" };
}

// ─── Contrato de auditoría (fuente única) ────────────────────────────
//
// Toda la validación del contrato del snapshot de una auditoría vive
// aquí. `validateAuditSnapshotContract(snapshot)` es la única función
// pública que consumidores (`writeStandaloneDraftFromAudit`,
// `qaReviewExpediente.escenariosFromAudit`, `NuviaDraftAuditCard`) deben
// invocar para clasificar el origen de los escenarios y bloquear v2
// corruptos ANTES de caer al reconstruidor legacy.

export type AuditSnapshotContract =
  | {
      kind: "historico_persistido";
      version: 2;
      escenarios: SnapshotEscenario[];
    }
  | {
      kind: "reconstruido_legacy";
      version: 1;
      reason: "v1_sin_escenarios";
    }
  | {
      kind: "invalido_v2";
      version: 2;
      reason:
        | "v2_sin_propuestas"
        | "v2_menos_de_cuatro"
        | "v2_mas_de_cuatro"
        | "v2_forma_invalida";
    }
  | {
      kind: "version_desconocida";
      version: number;
    }
  | {
      kind: "sin_snapshot";
    };

const REQUIRED_ESC_KEYS: Array<keyof SnapshotEscenario> = [
  "cuotasEliminadas",
  "nuevaCuota",
  "nuevoPlazo",
  "ahorroTotal",
  "honorarios",
];

function isValidEscenario(x: unknown): x is SnapshotEscenario {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return REQUIRED_ESC_KEYS.every((k) => {
    const v = o[k];
    return typeof v === "number" && Number.isFinite(v);
  });
}

export function validateAuditSnapshotContract(
  snapshot: DraftRawSnapshot | null | undefined,
): AuditSnapshotContract {
  if (!snapshot || !snapshot.datos) return { kind: "sin_snapshot" };
  const datos = snapshot.datos as Record<string, unknown>;
  const rawVersion = datos.snapshotVersion;
  const version =
    rawVersion === undefined || rawVersion === null
      ? 1
      : Number(rawVersion);
  if (version === 1) {
    return { kind: "reconstruido_legacy", version: 1, reason: "v1_sin_escenarios" };
  }
  if (version === 2) {
    const raw = datos.propuestasComerciales;
    if (raw === null || raw === undefined) {
      return { kind: "invalido_v2", version: 2, reason: "v2_sin_propuestas" };
    }
    if (!Array.isArray(raw)) {
      return { kind: "invalido_v2", version: 2, reason: "v2_forma_invalida" };
    }
    if (raw.length < 4) {
      return { kind: "invalido_v2", version: 2, reason: "v2_menos_de_cuatro" };
    }
    if (raw.length > 4) {
      return { kind: "invalido_v2", version: 2, reason: "v2_mas_de_cuatro" };
    }
    if (!raw.every(isValidEscenario)) {
      return { kind: "invalido_v2", version: 2, reason: "v2_forma_invalida" };
    }
    return { kind: "historico_persistido", version: 2, escenarios: raw as SnapshotEscenario[] };
  }
  return { kind: "version_desconocida", version };
}

// ─── Reconstrucción legacy determinística (v1) ───────────────────────
//
// Sólo se invoca cuando `validateAuditSnapshotContract` clasifica como
// `reconstruido_legacy`. Utiliza el motor financiero canónico
// (`calculateUVRProjection`) y las 4 opciones estándar
// (`getUVRReductionOptions`). Devuelve `null` si faltan campos
// matemáticos obligatorios (saldo, cuota, plazo, tea, uvrActual,
// variacion) — sin fallback ambiguo.

export type LegacyReconstructionInput = {
  saldoUVR: number;
  valorUVR: number;
  cuotaActualPesos: number;
  teaCobrada: number;
  variacionUVR: number;
  plazoInicial: number;
  cuotasPendientes: number;
  seguros?: number;
  variacionUVRPropuestas?: number;
  honorariosPct?: number;
};

export type LegacyReconstructionResult = {
  escenarios: SnapshotEscenario[];
  uvrVariationConflict: null | {
    snapshotValue: number;
    inputsValue: number;
    chosen: number;
  };
};

/**
 * Precedencia UVR EA: cuando snapshot y inputs discrepan, prima el valor
 * del snapshot original (contrato del analista al momento del OCR). Se
 * expone `uvrVariationConflict` para que la UI lo comunique.
 */
export function reconstructLegacyUvrScenarios(
  input: LegacyReconstructionInput | null,
  conflict?: { snapshotValue: number; inputsValue: number } | null,
): LegacyReconstructionResult | null {
  if (!input) return null;
  const {
    saldoUVR, valorUVR, cuotaActualPesos, teaCobrada, variacionUVR,
    plazoInicial, cuotasPendientes,
  } = input;
  if (
    !(saldoUVR > 0) || !(valorUVR > 0) || !(cuotaActualPesos > 0) ||
    !(teaCobrada > 0) || !(variacionUVR > 0) ||
    !(plazoInicial > 0) || !(cuotasPendientes > 0)
  ) {
    return null;
  }
  const seguros = input.seguros ?? 0;
  // Motor financiero: `variacionUVR` y `teaCobrada` viajan como porcentaje
  // (ej. 6 y 12.5) y `porcentajeHonorarios` como fracción (0.06).
  const uvrInput: UVRInput = {
    valorDesembolsado: saldoUVR * valorUVR,
    saldoPesos: saldoUVR * valorUVR,
    saldoUVR,
    valorUVR,
    cuotaActualPesos,
    cuotaSinSeguros: Math.max(0, cuotaActualPesos - seguros),
    seguros,
    teaCobrada,
    variacionUVR,
    variacionUVRPropuestas: input.variacionUVRPropuestas ?? variacionUVR,
    plazoInicial,
    cuotasPendientes,
    porcentajeHonorarios: input.honorariosPct ?? 0.06,
  };
  const projection = calculateUVRProjection(uvrInput);
  const escenarios: SnapshotEscenario[] = projection.propuestas
    .slice(0, 4)
    .map((p, idx) => ({
      index: idx,
      cuotasEliminadas: p.cuotasEliminadas,
      añosEliminados: p.añosEliminados,
      nuevoPlazo: p.nuevoPlazo,
      nuevaCuota: p.nuevaCuotaConSeguroAprox,
      ahorroIntereses: p.ahorroIntereses,
      ahorroSeguros: p.ahorroSeguros,
      ahorroTotal: p.ahorroTotal,
      honorarios: p.honorariosNuvex,
      totalProyectado: p.totalPagoPropuesta,
      incrementoMensual: p.abonoAdicionalMensual,
      fuente: "automatica",
    }));
  if (escenarios.length === 0) return null;
  const uvrVariationConflict =
    conflict && Number.isFinite(conflict.snapshotValue) && Number.isFinite(conflict.inputsValue)
      && Math.abs(conflict.snapshotValue - conflict.inputsValue) > 1e-6
      ? { ...conflict, chosen: conflict.snapshotValue }
      : null;
  return { escenarios, uvrVariationConflict };
}
