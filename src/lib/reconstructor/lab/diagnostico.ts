// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Diagnóstico ejecutivo
// ─────────────────────────────────────────────────────────────

import type {
  CategoriaFinanciera,
  Confianza,
  DiagnosticoEjecutivo,
  DiagnosticoIdentificabilidad,
  EvidenciaVariable,
  ValidacionCoherencia,
  VariableDetectada,
} from "./types";

function scoreToConfianza(score: number): Confianza {
  if (score >= 0.85) return "ALTA";
  if (score >= 0.65) return "MEDIA";
  if (score >= 0.35) return "BAJA";
  return "NULA";
}

export function construirDiagnostico(
  vars: VariableDetectada[],
  reconstrucciones: EvidenciaVariable[],
  identificabilidad: DiagnosticoIdentificabilidad[],
  coherencia: ValidacionCoherencia[],
  ambiguedades: Array<{ categoria: CategoriaFinanciera }>,
): DiagnosticoEjecutivo {
  const encontradas = new Set(vars.filter((v) => !v.excluida && v.valor !== null).map((v) => v.categoria));
  const faltantes = identificabilidad.filter((d) => d.identificabilidad !== "NO_DETERMINABLE" || d.faltan.length > 0);
  const imposibles = identificabilidad.filter((d) => d.identificabilidad === "NO_DETERMINABLE");
  const reconstruidas = reconstrucciones.filter((e) => e.estado === "CALCULADA" || e.estado === "INFERIDA").length;
  const estimadas = reconstrucciones.filter((e) => e.estado === "ESTIMADA").length;
  const inconsistencias = coherencia.filter((c) => c.severidad === "ROJO").length;
  const amarillas = coherencia.filter((c) => c.severidad === "AMARILLO").length;

  // Score determinista
  const totalReglas = Math.max(1, coherencia.length);
  const scoreCoh = 1 - (inconsistencias + amarillas * 0.3) / totalReglas;
  const totalIdent = Math.max(1, identificabilidad.length);
  const scoreIdent = 1 - imposibles.length / totalIdent;
  const scoreAmb = ambiguedades.length === 0 ? 1 : Math.max(0, 1 - ambiguedades.length * 0.15);
  const score = Math.max(0, Math.min(1, scoreCoh * 0.5 + scoreIdent * 0.3 + scoreAmb * 0.2));

  const conclusiones: string[] = [];
  if (inconsistencias) conclusiones.push(`${inconsistencias} inconsistencia(s) crítica(s) detectada(s).`);
  if (amarillas) conclusiones.push(`${amarillas} diferencia(s) moderada(s) requieren revisión.`);
  if (reconstruidas) conclusiones.push(`${reconstruidas} variable(s) reconstruida(s) matemáticamente.`);
  if (imposibles.length) conclusiones.push(`${imposibles.length} variable(s) no determinable(s) con la información actual.`);

  const recomendaciones: string[] = [];
  if (ambiguedades.length) recomendaciones.push("Confirma manualmente los valores ambiguos antes de calcular.");
  if (imposibles.length) recomendaciones.push("Solicita al banco los datos faltantes para completar el análisis.");
  if (inconsistencias) recomendaciones.push("Revisa las inconsistencias rojas antes de emitir cualquier conclusión.");

  const pendientes = imposibles.map((d) => `${d.categoria}: faltan ${d.faltan.join(", ") || "insumos"}`);

  return {
    variablesEncontradas: encontradas.size,
    variablesFaltantes: faltantes.length,
    variablesReconstruidas: reconstruidas,
    variablesEstimadas: estimadas,
    variablesImposibles: imposibles.length,
    inconsistencias,
    ambiguedades: ambiguedades.length,
    confiabilidadGlobal: scoreToConfianza(score),
    confiabilidadGlobalScore: score,
    conclusiones,
    recomendaciones,
    pendientes,
  };
}
