// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Evidencias por variable
//
// Convierte VariableDetectada REPORTADA + EvidenciaVariable
// reconstruida en una lista uniforme para la pestaña VARIABLES /
// RECONSTRUCCIÓN. Añade evidencias mínimas de "reportada" sin
// tocar los cálculos.
// ─────────────────────────────────────────────────────────────

import type {
  CategoriaFinanciera,
  EvidenciaVariable,
  VariableDetectada,
} from "./types";

export function evidenciasReportadas(
  vars: VariableDetectada[],
  reconstruidas: CategoriaFinanciera[],
): EvidenciaVariable[] {
  const yaReconstruidas = new Set(reconstruidas);
  const out: EvidenciaVariable[] = [];
  const vistas = new Set<CategoriaFinanciera>();
  for (const v of vars) {
    if (v.excluida) continue;
    if (yaReconstruidas.has(v.categoria)) continue;
    if (vistas.has(v.categoria)) continue;
    if (typeof v.valor !== "number") continue;
    vistas.add(v.categoria);
    out.push({
      categoria: v.categoria,
      estado: "REPORTADA",
      valor: v.valor,
      unidad: v.unidad,
      confianzaMatematica: v.confianzaExtraccion,
      formula: "Reportado por el extracto",
      datosUsados: [],
      variablesInferidas: [],
      supuestos: [],
      residuoAbs: null,
      residuoPct: null,
      advertencias:
        v.confianzaExtraccion === "BAJA" ? ["Confianza de extracción baja"] : [],
    });
  }
  return out;
}
