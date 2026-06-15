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

function draftKey(mode: Mode, expedienteId?: string) {
  return `${DRAFT_PREFIX}.${mode}.${expedienteId ?? "standalone"}`;
}

export function readSimulatorDraft<T extends object>(
  mode: Mode,
  expedienteId: string | undefined,
  defaults: T,
): T {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = sessionStorage.getItem(draftKey(mode, expedienteId));
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
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(draftKey(mode, expedienteId), JSON.stringify(draft));
    } catch {
      // Si el navegador bloquea el almacenamiento, el simulador debe seguir funcionando.
    }
  }, [mode, expedienteId, draft]);
}

export function clearSimulatorDraft(mode: Mode, expedienteId?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(mode, expedienteId));
}

export function hasSimulatorDraft(mode: Mode, expedienteId?: string) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(draftKey(mode, expedienteId)) !== null;
}
