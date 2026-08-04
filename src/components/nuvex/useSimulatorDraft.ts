import { useEffect } from "react";

type Mode = "pesos" | "uvr";

const DRAFT_PREFIX = "nuvex.simulatorDraft";

export function parseStoredJson<T>(value: unknown): T | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as T) : undefined;
  } catch {
    return undefined;
  }
}

function draftKey(mode: Mode, expedienteId?: string, revision?: string) {
  const base = `${DRAFT_PREFIX}.${mode}.${expedienteId ?? "standalone"}`;
  return expedienteId && revision ? `${base}.${revision}` : base;
}

export function readSimulatorDraft<T extends object>(
  mode: Mode,
  expedienteId: string | undefined,
  defaults: T,
  revision?: string,
): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = sessionStorage.getItem(draftKey(mode, expedienteId, revision));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function useSimulatorDraft<T extends object>(
  mode: Mode,
  expedienteId: string | undefined,
  draft: T,
  revision?: string,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(draftKey(mode, expedienteId, revision), JSON.stringify(draft));
    } catch {
      // Si el navegador bloquea el almacenamiento, el simulador debe seguir funcionando.
    }
  }, [mode, expedienteId, draft, revision]);
}

export function clearSimulatorDraft(mode: Mode, expedienteId?: string, revision?: string) {
  if (typeof window === "undefined") return;
  // Eliminar también la llave anterior para limpiar borradores creados antes
  // de que el expediente se versionara con `updated_at`.
  sessionStorage.removeItem(draftKey(mode, expedienteId));
  if (revision) sessionStorage.removeItem(draftKey(mode, expedienteId, revision));
}

export function hasSimulatorDraft(mode: Mode, expedienteId?: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(draftKey(mode, expedienteId)) !== null;
}
