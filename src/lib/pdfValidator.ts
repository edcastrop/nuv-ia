// Validador de datos PDF — fuente única: Expediente Maestro.
// Si falta algún campo obligatorio o hay inconsistencias matemáticas,
// bloquea la generación del documento.

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

/** Notifica issues al usuario con toast y devuelve true si puede continuar. */
export function ensureValid(
  documentName: string,
  result: ValidationResult,
): boolean {
  if (result.ok) return true;
  const missing = result.issues.filter((i) => i.type === "missing");
  const math = result.issues.filter((i) => i.type !== "missing");
  const msgs: string[] = [];
  if (missing.length) msgs.push(`Faltan: ${missing.map((m) => m.label).join(", ")}`);
  if (math.length)
    msgs.push(
      `Inconsistencias: ${math.map((m) => `${m.label}${m.detail ? ` (${m.detail})` : ""}`).join("; ")}`,
    );
  toast.error(`${documentName} — no se puede generar`, {
    description: msgs.join(" · "),
    duration: 7000,
  });
  return false;
}
