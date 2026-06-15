import { useEffect } from "react";

type Mode = "pesos" | "uvr";

const DRAFT_PREFIX = "nuvex.simulatorDraft";

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
    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem(draftKey(mode, expedienteId), JSON.stringify(draft));
      } catch {
        // Si el navegador bloquea el almacenamiento, el simulador debe seguir funcionando.
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [mode, expedienteId, draft]);
}

export function clearSimulatorDraft(mode: Mode, expedienteId?: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(draftKey(mode, expedienteId));
}