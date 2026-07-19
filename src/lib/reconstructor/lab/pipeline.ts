// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Pipeline principal
//
// runLab(ExtractoLabInput) → LabResult
// Único punto de entrada de la UI. Determinista, sin efectos.
// ─────────────────────────────────────────────────────────────

import { clasificarVariables, normalizarExtracto } from "./clasificador";
import { evaluarCoherencia } from "./coherencia";
import { construirDiagnostico } from "./diagnostico";
import { evidenciasReportadas } from "./evidencias";
import { evaluarIdentificabilidad } from "./identificabilidad";
import { reconstruirCadena } from "./reconstruccion";
import type { ExtractoLabInput, LabResult, VariableDetectada } from "./types";

export function runLab(
  input: ExtractoLabInput,
  overrides?: {
    variables?: VariableDetectada[];
  },
): LabResult {
  const clasif = overrides?.variables
    ? { variables: overrides.variables, candidatos: [] as ReturnType<typeof clasificarVariables>["candidatos"] }
    : clasificarVariables(input);

  const identif = evaluarIdentificabilidad(clasif.variables);
  const recon = reconstruirCadena(clasif.variables);
  const evReportadas = evidenciasReportadas(
    clasif.variables,
    recon.evidencias.map((e) => e.categoria),
  );
  const evidencias = [...evReportadas, ...recon.evidencias];
  const coherencia = evaluarCoherencia(clasif.variables);
  const ambig = clasif.candidatos.map((c) => ({
    categoria: c.categoria,
    candidatos: c.valores,
    motivo: c.motivo,
  }));
  const diagnostico = construirDiagnostico(
    clasif.variables,
    evidencias,
    identif,
    coherencia,
    ambig,
  );

  const faltantes = identif
    .filter((d) => d.identificabilidad === "NO_DETERMINABLE")
    .map((d) => d.categoria);

  return {
    input,
    variables: clasif.variables,
    faltantes,
    identificabilidad: identif,
    reconstrucciones: evidencias,
    hipotesis: recon.hipotesis,
    coherencia,
    diagnostico,
    ambiguedades: ambig,
  };
}

export { normalizarExtracto };
