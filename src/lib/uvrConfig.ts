// Configuración global de Variación UVR EA por defecto.
// Se utiliza como respaldo cuando el analista no ingresa un valor manual
// o cuando no hay un dato actualizado del Banco de la República.

const STORAGE_KEY = "nuvex.uvr.variacionDefault";
export const DEFAULT_VARIACION_UVR = "6";

export function getDefaultVariacionUVR(): string {
  if (typeof window === "undefined") return DEFAULT_VARIACION_UVR;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && v.trim()) return v.trim();
  } catch {
    // ignore
  }
  return DEFAULT_VARIACION_UVR;
}

export function setDefaultVariacionUVR(value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value.trim() || DEFAULT_VARIACION_UVR);
  } catch {
    // ignore
  }
}
