// Fase 3 — Control de Calidad: pre-requisitos para radicar en banco.
// Bloquea la transición a `radicado_banco` si falta contrato, poder, checklist
// documental validado o documentos obligatorios.
import { supabase } from "@/integrations/supabase/client";
import { loadChecklistRows, loadValidacion, esDocumentoCompleto, type EstadoDoc } from "@/lib/checklistDocumental";

export interface RequisitoRadicacion {
  key: "contrato" | "poder" | "checklist_validado" | "documentos_obligatorios";
  label: string;
  cumple: boolean;
  detalle?: string;
}

export interface ResultadoValidacionRadicacion {
  puedeRadicar: boolean;
  requisitos: RequisitoRadicacion[];
  pendientes: string[];
}

const ESTADOS_CONTRATO_OK = new Set([
  "contrato_firmado", "poder_generado", "poder_firmado", "documentacion_completa",
  "radicacion_pendiente", "radicacion_preparada", "radicado_banco",
]);
const ESTADOS_PODER_OK = new Set([
  "poder_firmado", "documentacion_completa", "radicacion_pendiente",
  "radicacion_preparada", "radicado_banco",
]);

export async function evaluarRequisitosRadicacion(expedienteId: string): Promise<ResultadoValidacionRadicacion> {
  // Historial para detectar contrato/poder firmados
  const { data: hist } = await supabase
    .from("expediente_historial")
    .select("estado_caso_nuevo")
    .eq("expediente_id", expedienteId);
  const estados = new Set<string>(
    ((hist ?? []) as Array<{ estado_caso_nuevo: string | null }>)
      .map((h) => h.estado_caso_nuevo || "")
      .filter(Boolean),
  );

  // Estado actual también cuenta
  const { data: exp } = await supabase
    .from("expedientes")
    .select("estado_caso" as never)
    .eq("id", expedienteId)
    .single();
  const actual = (exp as unknown as { estado_caso?: string })?.estado_caso ?? "";
  if (actual) estados.add(actual);

  const contratoOk = [...estados].some((e) => ESTADOS_CONTRATO_OK.has(e));
  const poderOk = [...estados].some((e) => ESTADOS_PODER_OK.has(e));

  // Checklist documental
  let checklistValidado = false;
  let docsObligatoriosOk = false;
  let detalleDocs = "";
  try {
    const validacion = await loadValidacion(expedienteId);
    checklistValidado = !!validacion?.validada_at;
    const rows = await loadChecklistRows(expedienteId);
    const obligatorios = rows.filter((r) => r.obligatorio);
    const pendientes = obligatorios.filter((r) => !esDocumentoCompleto(r.estado as EstadoDoc));
    docsObligatoriosOk = obligatorios.length > 0 && pendientes.length === 0;
    if (!docsObligatoriosOk) {
      detalleDocs = obligatorios.length === 0
        ? "No se ha generado el checklist documental."
        : `${pendientes.length} de ${obligatorios.length} documentos obligatorios pendientes.`;
    }
  } catch {
    detalleDocs = "No se pudo evaluar el checklist documental.";
  }

  const requisitos: RequisitoRadicacion[] = [
    { key: "contrato", label: "Contrato firmado", cumple: contratoOk, detalle: contratoOk ? undefined : "El expediente no registra contrato firmado." },
    { key: "poder", label: "Poder firmado", cumple: poderOk, detalle: poderOk ? undefined : "El expediente no registra poder firmado." },
    { key: "checklist_validado", label: "Checklist documental validado", cumple: checklistValidado, detalle: checklistValidado ? undefined : "Falta validar formalmente el checklist." },
    { key: "documentos_obligatorios", label: "Documentos obligatorios recibidos", cumple: docsObligatoriosOk, detalle: docsObligatoriosOk ? undefined : detalleDocs },
  ];

  const pendientes = requisitos.filter((r) => !r.cumple).map((r) => r.label);
  return { puedeRadicar: pendientes.length === 0, requisitos, pendientes };
}

export class BloqueoRadicacionError extends Error {
  pendientes: string[];
  constructor(pendientes: string[]) {
    super(`No se puede radicar: faltan ${pendientes.join(", ")}.`);
    this.name = "BloqueoRadicacionError";
    this.pendientes = pendientes;
  }
}
