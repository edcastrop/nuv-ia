// Registry en memoria para soportes cargados DURANTE la simulación,
// antes de que exista un `expediente_id` real. Se descargan (`flush`)
// cuando el analista certifica y se crea el caso.
//
// Reglas clave:
// - `draftKey` acota cada entrada a un cliente/borrador específico.
//   `flushPendingSoportes` toca SOLO las entradas de ese draftKey; nunca
//   vacía el registry completo.
// - Al montar un simulador nuevo (sin `initialExpediente`),
//   `purgeStaleAnonEntries` limpia entradas anónimas que nunca fueron
//   re-etiquetadas O que sobrepasaron ANON_MAX_AGE_MS. Entradas ya
//   asociadas a un cliente identificado (ced:… o soft:…) sobreviven
//   entre montajes.
import { supabase } from "@/integrations/supabase/client";

export const ANON_DRAFT_KEY = "anon:__no_client__";
const ANON_MAX_AGE_MS = 10 * 60 * 1000;

export type SoporteKind = "cedula-titular" | "cedula-cotitular" | "extracto";

export interface UploadedExtractoOriginal {
  path: string;
  name: string;
  mime: string | null;
  size: number | null;
}

interface BaseEntry {
  id: string;
  draftKey: string;
  kind: SoporteKind;
  createdAt: number;
  relabeled: boolean;
  status: "pending" | "flushing" | "failed";
  error?: string;
  label: string;
}

export interface CedulaEntry extends BaseEntry {
  kind: "cedula-titular" | "cedula-cotitular";
  files: File[];
  subcategoria: string;
}

export interface ExtractoEntry extends BaseEntry {
  kind: "extracto";
  originals: UploadedExtractoOriginal[];
}

export type Entry = CedulaEntry | ExtractoEntry;

const registry = new Map<string, Entry>();
const listeners = new Set<() => void>();
let version = 0;

function bump() {
  version += 1;
  for (const l of listeners) l();
}

function nextId() {
  return `soporte_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveDraftKey(input: {
  cedula?: string | null;
  nombre?: string | null;
  numeroCredito?: string | null;
  banco?: string | null;
}): string {
  const ced = (input.cedula ?? "").replace(/\D/g, "");
  if (ced) return `ced:${ced}`;
  const nom = (input.nombre ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const num = (input.numeroCredito ?? "").trim();
  const banco = (input.banco ?? "").trim().toLowerCase();
  if (nom || num || banco) return `soft:${nom}|${banco}|${num}`;
  return ANON_DRAFT_KEY;
}

export function enqueueCedula(input: {
  draftKey: string;
  files: File[];
  isTitular: boolean;
  cotitularIdx?: number;
  label: string;
}): string {
  const id = nextId();
  const entry: CedulaEntry = {
    id,
    draftKey: input.draftKey,
    kind: input.isTitular ? "cedula-titular" : "cedula-cotitular",
    files: [...input.files],
    subcategoria: input.isTitular
      ? "cedula_titular"
      : `cedula_cotitular_${input.cotitularIdx ?? 1}`,
    createdAt: Date.now(),
    relabeled: false,
    status: "pending",
    label: input.label,
  };
  registry.set(id, entry);
  bump();
  return id;
}

export function enqueueExtracto(input: {
  draftKey: string;
  originals: UploadedExtractoOriginal[];
  label: string;
}): string {
  const id = nextId();
  const entry: ExtractoEntry = {
    id,
    draftKey: input.draftKey,
    kind: "extracto",
    originals: [...input.originals],
    createdAt: Date.now(),
    relabeled: false,
    status: "pending",
    label: input.label,
  };
  registry.set(id, entry);
  bump();
  return id;
}

/** Re-etiqueta entradas con `oldKey` (típicamente ANON) a `newKey`.
 *  Se llama cuando el lector IA autocompleta la cédula del titular. */
export function relabelDraftKey(oldKey: string, newKey: string) {
  if (!oldKey || !newKey || oldKey === newKey) return;
  let changed = false;
  for (const e of registry.values()) {
    if (e.draftKey === oldKey && e.status !== "flushing") {
      e.draftKey = newKey;
      e.relabeled = true;
      changed = true;
    }
  }
  if (changed) bump();
}

export function removeEntry(id: string) {
  if (registry.delete(id)) bump();
}

export function listByDraft(draftKey: string): Entry[] {
  return Array.from(registry.values()).filter((e) => e.draftKey === draftKey);
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getVersion(): number {
  return version;
}

/** Barrida al montar un simulador nuevo (standalone).
 *  Elimina entradas ANON que nunca fueron re-etiquetadas O superaron
 *  ANON_MAX_AGE_MS. Nunca toca entradas de clientes identificados. */
export function purgeStaleAnonEntries() {
  const now = Date.now();
  let changed = false;
  for (const e of Array.from(registry.values())) {
    if (e.draftKey !== ANON_DRAFT_KEY) continue;
    if (e.status === "flushing") continue;
    if (!e.relabeled || now - e.createdAt > ANON_MAX_AGE_MS) {
      registry.delete(e.id);
      changed = true;
    }
  }
  if (changed) bump();
}

async function flushCedulaEntry(
  entry: CedulaEntry,
  expedienteId: string,
  uid: string | null,
) {
  for (let i = 0; i < entry.files.length; i++) {
    const f = entry.files[i];
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const lado = i === 0 ? "frente" : i === 1 ? "reverso" : `pag${i + 1}`;
    const path = `${expedienteId}/identidad/${entry.subcategoria}_${lado}_${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("soportes-banco")
      .upload(path, f, {
        contentType: f.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);
    const { error: insErr } = await supabase
      .from("expediente_soportes" as never)
      .insert({
        expediente_id: expedienteId,
        categoria: "identidad",
        subcategoria: entry.subcategoria,
        archivo_nombre: f.name,
        archivo_path: path,
        mime_type: f.type || null,
        size_bytes: f.size ?? null,
        estado_relacionado: "validacion_identidad",
        user_id: uid,
      } as never);
    if (insErr) throw new Error(insErr.message);
  }
}

async function flushExtractoEntry(
  entry: ExtractoEntry,
  expedienteId: string,
  uid: string | null,
) {
  for (const orig of entry.originals) {
    const { error: insErr } = await supabase
      .from("expediente_soportes" as never)
      .insert({
        expediente_id: expedienteId,
        categoria: "extracto_banco",
        subcategoria: "extracto",
        archivo_nombre: orig.name,
        archivo_path: orig.path,
        mime_type: orig.mime,
        size_bytes: orig.size,
        estado_relacionado: "validacion_identidad",
        user_id: uid,
      } as never);
    if (insErr) throw new Error(insErr.message);
  }
}

/** Sube/inserta las entradas del `draftKey` indicado. Devuelve conteo
 *  ok/failed. Entradas fallidas quedan en el registry con status "failed"
 *  para que el UI pueda mostrar "Reintentar". */
export async function flushPendingSoportes(
  expedienteId: string,
  draftKey: string,
): Promise<{ ok: number; failed: number }> {
  if (!expedienteId || !draftKey) return { ok: 0, failed: 0 };
  const entries = listByDraft(draftKey);
  if (!entries.length) return { ok: 0, failed: 0 };

  let uid: string | null = null;
  try {
    const { data: userData } = await supabase.auth.getUser();
    uid = userData?.user?.id ?? null;
  } catch {
    uid = null;
  }

  let ok = 0;
  let failed = 0;
  for (const entry of entries) {
    entry.status = "flushing";
    entry.error = undefined;
    bump();
    try {
      if (entry.kind === "extracto") {
        await flushExtractoEntry(entry, expedienteId, uid);
      } else {
        await flushCedulaEntry(entry, expedienteId, uid);
      }
      registry.delete(entry.id);
      ok += 1;
    } catch (err) {
      entry.status = "failed";
      entry.error = err instanceof Error ? err.message : String(err);
      failed += 1;
    } finally {
      bump();
    }
  }
  return { ok, failed };
}
