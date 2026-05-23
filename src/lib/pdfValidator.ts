// Validador de datos PDF — fuente única: Expediente Maestro.
//
// Dos modos:
//  - ensureValid (estricto): bloquea exportación si hay issues. Usar SOLO
//    para PDFs comerciales donde la inconsistencia rompe el cierre comercial.
//  - ensureValidAdvisory (informativo): muestra una advertencia pero PERMITE
//    exportar. Es el modo por defecto para documentos administrativos
//    (Poder, Datos para Contrato, Cuenta de Cobro, Paz y Salvo).

import { toast } from "sonner";

export interface RequiredField {
  key: string;
  label: string;
  value: unknown;
}

export interface ValidationIssue {
  type: "missing" | "math" | "inconsistency";
  label: string;
  detail?: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const isEmpty = (v: unknown): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "" || v.trim() === "—";
  if (typeof v === "number") return !isFinite(v);
  return false;
};

export function validateRequired(fields: RequiredField[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  for (const f of fields) {
    if (isEmpty(f.value)) issues.push({ type: "missing", label: f.label });
  }
  return { ok: issues.length === 0, issues };
}

export function validateMath(
  label: string,
  expected: number,
  actual: number,
  toleranceCOP = 1,
): ValidationIssue | null {
  if (!isFinite(expected) || !isFinite(actual)) return null;
  if (Math.abs(expected - actual) > toleranceCOP) {
    return {
      type: "math",
      label,
      detail: `esperado ${Math.round(expected).toLocaleString("es-CO")} · calculado ${Math.round(actual).toLocaleString("es-CO")}`,
    };
  }
  return null;
}

function formatIssues(result: ValidationResult): string {
  const missing = result.issues.filter((i) => i.type === "missing");
  const math = result.issues.filter((i) => i.type !== "missing");
  const msgs: string[] = [];
  if (missing.length) msgs.push(`Faltan: ${missing.map((m) => m.label).join(", ")}`);
  if (math.length)
    msgs.push(
      `Inconsistencias: ${math.map((m) => `${m.label}${m.detail ? ` (${m.detail})` : ""}`).join("; ")}`,
    );
  return msgs.join(" · ");
}

/** Bloquea la exportación si hay issues (modo estricto). */
export function ensureValid(documentName: string, result: ValidationResult): boolean {
  if (result.ok) return true;
  toast.error(`${documentName} — no se puede generar`, {
    description: formatIssues(result),
    duration: 7000,
  });
  return false;
}

/**
 * Modo informativo (documentos administrativos): muestra una advertencia
 * pero retorna SIEMPRE true para permitir la generación. Se usa para
 * Poder, Datos para Contrato, Cuenta de Cobro y Paz y Salvo.
 */
export function ensureValidAdvisory(
  documentName: string,
  result: ValidationResult,
): boolean {
  if (!result.ok) {
    toast.warning(`${documentName} — pendiente de validación financiera`, {
      description: formatIssues(result),
      duration: 6000,
    });
  }
  return true;
}

/** Reporte final de exportación PDF (páginas generadas / campos pendientes). */
export interface PdfExportReport {
  documento: string;
  paginas: number;
  camposOcultados: number;
  camposPendientes: string[];
}

export function reportPdfExport(r: PdfExportReport) {
  const estado = r.camposPendientes.length === 0 ? "OK" : "Con pendientes";
  const desc = [
    `Páginas: ${r.paginas}`,
    `Ocultos: ${r.camposOcultados}`,
    r.camposPendientes.length
      ? `Pendientes: ${r.camposPendientes.join(", ")}`
      : "Sin pendientes",
    `Estado: ${estado}`,
  ].join(" · ");
  if (r.camposPendientes.length === 0) {
    toast.success(`${r.documento} generado`, { description: desc, duration: 5000 });
  } else {
    toast.message(`${r.documento} generado`, { description: desc, duration: 6500 });
  }
}
