// Helper puro para decidir la moneda final detectada en un extracto.
// Centraliza la regla usada por ExtractoReader.handleConfirm para evitar
// que un extracto FNA en pesos con boilerplate "en UVR" se clasifique
// erróneamente como UVR y dispare MonedaMismatchDialog.
//
// Reglas:
// - FNA: sólo clasifica como "uvr" si hay evidencia numérica dura
//   (tieneDatosUvr === true). parsedEsUVR, uvrEnTexto y sistemaDicePesos
//   NO pueden clasificar FNA como UVR por sí solos.
// - Otros bancos: se conserva LITERALMENTE la lógica actual de
//   señalUvrFuerte usada previamente en ExtractoReader.

export type MonedaDetectada = "pesos" | "uvr";

export interface ResolveMonedaInput {
  banco: string;
  parsedEsUVR: boolean;
  tieneDatosUvr: boolean;
  uvrEnTexto: boolean;
  sistemaDicePesos: boolean;
}

const FNA_REGEX = /\bfna\b|fondo\s+nacional\s+del\s+ahorro/i;

export function resolveMonedaDetectada(input: ResolveMonedaInput): MonedaDetectada {
  const { banco, parsedEsUVR, tieneDatosUvr, uvrEnTexto, sistemaDicePesos } = input;

  const esFna = typeof banco === "string" && FNA_REGEX.test(banco);

  if (esFna) {
    return tieneDatosUvr ? "uvr" : "pesos";
  }

  const señalUvrFuerte =
    !sistemaDicePesos && (parsedEsUVR || tieneDatosUvr || uvrEnTexto);
  return señalUvrFuerte ? "uvr" : "pesos";
}
