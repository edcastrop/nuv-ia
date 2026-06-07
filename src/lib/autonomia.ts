// Reglas de Licencia de Autonomía NUVEX
// Nivel 1: nuevos / score bajo. Nivel 2: intermedio. Nivel 3: avanzado.

import type { AuditoriaResultado } from "./auditEngine";

export type NivelAutonomia = 1 | 2 | 3;

export interface MetricasAnalista {
  totalSimulaciones: number;
  scorePromedio: number;
  precisionHistorica: number;
  nivelAutonomia: NivelAutonomia;
}

export const metricasIniciales: MetricasAnalista = {
  totalSimulaciones: 0,
  scorePromedio: 0,
  precisionHistorica: 0,
  nivelAutonomia: 1,
};

export function calcularNivelAutonomia(m: MetricasAnalista): NivelAutonomia {
  if (m.totalSimulaciones >= 100 && m.scorePromedio >= 95) return 3;
  if (m.totalSimulaciones >= 30 && m.scorePromedio >= 85) return 2;
  return 1;
}

export type AccionPdf = "permitir" | "permitir_con_marca" | "bloquear";

export interface DecisionPdf {
  accion: AccionPdf;
  motivo: string;
  marca?: string;
}

export function decidirPdf(nivel: NivelAutonomia, r: AuditoriaResultado): DecisionPdf {
  const score = r.score.total;
  const criticas = r.inconsistencias.some((x) => x.severidad === "critica");
  const altoRiesgo = r.clasificacion.requiereRevision;

  if (criticas) {
    return { accion: "bloquear", motivo: "Inconsistencias críticas detectadas" };
  }

  if (nivel === 3) {
    if (altoRiesgo) {
      return {
        accion: "bloquear",
        motivo: r.clasificacion.motivo ?? "Caso de alto riesgo: requiere Dirección Financiera",
      };
    }
    return { accion: "permitir", motivo: "Nivel 3 — Autonomía avanzada" };
  }

  if (nivel === 2) {
    if (score >= 95) return { accion: "permitir", motivo: "Nivel 2 — Score apto" };
    if (score >= 85)
      return {
        accion: "permitir_con_marca",
        motivo: "Nivel 2 — Score con advertencia",
        marca: "REVISIÓN RECOMENDADA",
      };
    return { accion: "bloquear", motivo: "Nivel 2 — Score insuficiente, escala" };
  }

  // Nivel 1
  if (score >= 95)
    return {
      accion: "permitir_con_marca",
      motivo: "Nivel 1 — Pendiente Auditoría",
      marca: "PENDIENTE AUDITORÍA",
    };
  if (score >= 85)
    return {
      accion: "bloquear",
      motivo: "Nivel 1 — Score 85–94 requiere Dirección Financiera",
    };
  return { accion: "bloquear", motivo: "Nivel 1 — Score insuficiente" };
}

export function etiquetaNivel(n: NivelAutonomia): string {
  return n === 3 ? "Avanzada" : n === 2 ? "Intermedia" : "Supervisada";
}
