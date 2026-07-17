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
 * Hash canónico del snapshot (identidad financiera).
 * - Dos snapshots equivalentes → mismo hash aunque provengan de archivos
 *   distintos o momentos distintos.
 * - Cambios en archivoPath / archivoNombre / timestamps NO afectan el hash.
 * - Un cambio real en cualquier campo de `HASH_FIELDS` sí lo modifica.
 * - `tipoCredito` participa implícitamente vía `modalidad`/`moneda`.
 */
export function hashQaSnapshot(snapshot: DraftRawSnapshot | null | undefined): string {
  if (!snapshot) return "";
  const datos = (snapshot.datos ?? {}) as Record<string, unknown>;
  const canonical: Record<string, unknown> = {};
  // Encabezado — banco/producto/moneda pueden venir en el snapshot o dentro de datos.
  canonical.banco = normalizeHashValue(datos.banco ?? snapshot.banco ?? null);
  canonical.producto = normalizeHashValue(datos.producto ?? snapshot.producto ?? null);
  canonical.moneda = normalizeHashValue(datos.moneda ?? snapshot.moneda ?? null);
  canonical.modalidad = normalizeHashValue(datos.modalidad ?? snapshot.tipoCredito ?? null);
  for (const key of HASH_FIELDS) {
    if (key in canonical) continue;
    canonical[key] = normalizeHashValue(datos[key]);
  }
  // Orden estable de claves.
  const sortedKeys = Object.keys(canonical).sort();
  const payload = JSON.stringify(sortedKeys.map((k) => [k, canonical[k]]));
  return fnv1a(payload);
}
