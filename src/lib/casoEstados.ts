import { supabase } from "@/integrations/supabase/client";

export type CasoEstado =
  | "lead_creado"
  | "prospecto"
  | "extracto_recibido"
  | "simulacion_realizada"
  | "simulado"
  | "propuesta_presentada"
  | "propuesta_enviada"
  | "acepto_propuesta"
  | "negociacion"
  | "pendiente_contratacion"
  | "enviado_contratacion"
  | "contrato_enviado"
  | "contrato_generado"
  | "contrato_firmado"
  | "poder_generado"
  | "poder_firmado"
  | "documentacion_completa"
  | "radicacion_pendiente"
  | "radicacion_preparada"
  | "radicado_banco"
  | "en_estudio_banco"
  | "docs_complementarios_banco"
  | "aprobado"
  | "aprobado_banco"
  | "documentos_banco_firmados"
  | "condiciones_aplicadas"
  | "aplicado_banco"
  | "resultado_final_generado"
  | "cuenta_cobro_generada"
  | "cuenta_cobro_enviada"
  | "honorarios_pendientes"
  | "honorarios_pagados"
  | "paz_y_salvo_generado"
  | "caso_finalizado"
  | "devuelto_banco"
  | "negado_banco"
  | "prejuridico"
  | "proceso_cerrado";

export interface CasoEstadoDef {
  key: CasoEstado;
  label: string;
  orden: number;
  color: string;
  bg: string;
}

export const CASO_ESTADOS: CasoEstadoDef[] = [
  { key: "lead_creado", label: "Lead creado", orden: 1, color: "#445DA3", bg: "#EEF1FA" },
  { key: "prospecto", label: "Prospecto", orden: 2, color: "#445DA3", bg: "#EEF1FA" },
  { key: "extracto_recibido", label: "Extracto recibido", orden: 3, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "simulacion_realizada", label: "Simulación realizada", orden: 4, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "simulado", label: "Simulado", orden: 5, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "propuesta_presentada", label: "Propuesta presentada", orden: 6, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "propuesta_enviada", label: "Propuesta enviada", orden: 7, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "acepto_propuesta", label: "Aceptó propuesta", orden: 8, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "negociacion", label: "Negociación", orden: 9, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "pendiente_contratacion", label: "Pendiente contratación", orden: 10, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "enviado_contratacion", label: "Enviado a contratación", orden: 11, color: "#3730A3", bg: "#E0E7FF" },
  { key: "contrato_enviado", label: "Contrato enviado", orden: 12, color: "#3730A3", bg: "#E0E7FF" },
  { key: "contrato_generado", label: "Contrato generado", orden: 13, color: "#3730A3", bg: "#E0E7FF" },
  { key: "contrato_firmado", label: "Contrato firmado", orden: 14, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "poder_generado", label: "Poder generado", orden: 15, color: "#3730A3", bg: "#E0E7FF" },
  { key: "poder_firmado", label: "Poder firmado", orden: 16, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "documentacion_completa", label: "Documentación completa", orden: 17, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "radicacion_pendiente", label: "Radicación pendiente", orden: 18, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "radicacion_preparada", label: "Radicación preparada", orden: 19, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "radicado_banco", label: "Radicado en banco", orden: 20, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "en_estudio_banco", label: "En estudio banco", orden: 21, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "docs_complementarios_banco", label: "Docs complementarios banco", orden: 22, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "aprobado", label: "Aprobado", orden: 23, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "aprobado_banco", label: "Aprobado banco", orden: 24, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "documentos_banco_firmados", label: "Documentos banco firmados", orden: 25, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "condiciones_aplicadas", label: "Condiciones aplicadas", orden: 26, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "aplicado_banco", label: "Aplicado banco", orden: 27, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "resultado_final_generado", label: "Resultado final generado", orden: 28, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "cuenta_cobro_generada", label: "Cuenta de cobro generada", orden: 29, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "cuenta_cobro_enviada", label: "Cuenta de cobro enviada", orden: 30, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "honorarios_pendientes", label: "Honorarios pendientes", orden: 31, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "honorarios_pagados", label: "Honorarios pagados", orden: 32, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "paz_y_salvo_generado", label: "Paz y salvo generado", orden: 33, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "caso_finalizado", label: "Caso finalizado", orden: 34, color: "#242424", bg: "#E5E7EB" },
  { key: "devuelto_banco", label: "Devuelto por banco", orden: 35, color: "#991B1B", bg: "#FEE2E2" },
  { key: "negado_banco", label: "Negado por banco", orden: 36, color: "#991B1B", bg: "#FEE2E2" },
  { key: "prejuridico", label: "Prejurídico", orden: 37, color: "#991B1B", bg: "#FEE2E2" },
  { key: "proceso_cerrado", label: "Proceso cerrado", orden: 38, color: "#242424", bg: "#E5E7EB" },
];

export const CASO_ESTADO_BY_KEY: Record<CasoEstado, CasoEstadoDef> = CASO_ESTADOS.reduce(
  (acc, e) => ({ ...acc, [e.key]: e }),
  {} as Record<CasoEstado, CasoEstadoDef>,
);

export type AccionOrigen =
  | "extracto_subido"
  | "simulacion_generada"
  | "simulacion_guardada"
  | "propuesta_generada"
  | "propuesta_enviada"
  | "acepto_propuesta"
  | "documentacion_completa"
  | "contrato_generado"
  | "contrato_firmado"
  | "poder_generado"
  | "poder_firmado"
  | "envio_contratacion"
  | "radicacion_preparada"
  | "radicado_confirmado"
  | "en_estudio_banco"
  | "aprobacion_registrada"
  | "aprobado_banco"
  | "docs_complementarios_banco"
  | "documentos_banco_firmados"
  | "condiciones_aplicadas"
  | "aplicado_banco"
  | "resultado_final"
  | "cuenta_cobro_generada"
  | "cuenta_cobro_enviada"
  | "honorarios_pendientes"
  | "honorarios_pagados"
  | "paz_y_salvo_generado"
  | "caso_finalizado"
  | "devuelto_banco"
  | "negado_banco"
  | "prejuridico"
  | "manual";

export const ACCION_A_ESTADO: Record<Exclude<AccionOrigen, "manual">, CasoEstado> = {
  extracto_subido: "extracto_recibido",
  simulacion_generada: "simulacion_realizada",
  simulacion_guardada: "simulado",
  propuesta_generada: "propuesta_presentada",
  propuesta_enviada: "propuesta_enviada",
  acepto_propuesta: "acepto_propuesta",
  documentacion_completa: "documentacion_completa",
  contrato_generado: "contrato_generado",
  contrato_firmado: "contrato_firmado",
  poder_generado: "poder_generado",
  poder_firmado: "poder_firmado",
  envio_contratacion: "enviado_contratacion",
  radicacion_preparada: "radicacion_preparada",
  radicado_confirmado: "radicado_banco",
  en_estudio_banco: "en_estudio_banco",
  aprobacion_registrada: "aprobado",
  aprobado_banco: "aprobado_banco",
  docs_complementarios_banco: "docs_complementarios_banco",
  documentos_banco_firmados: "documentos_banco_firmados",
  condiciones_aplicadas: "condiciones_aplicadas",
  aplicado_banco: "aplicado_banco",
  resultado_final: "resultado_final_generado",
  cuenta_cobro_generada: "cuenta_cobro_generada",
  cuenta_cobro_enviada: "cuenta_cobro_enviada",
  honorarios_pendientes: "honorarios_pendientes",
  honorarios_pagados: "honorarios_pagados",
  paz_y_salvo_generado: "paz_y_salvo_generado",
  caso_finalizado: "caso_finalizado",
  devuelto_banco: "devuelto_banco",
  negado_banco: "negado_banco",
  prejuridico: "prejuridico",
};

export const SUBMOTIVOS_DEVUELTO: string[] = [
  "Documentos incompletos",
  "Información inconsistente",
  "Datos del cliente sin actualizar",
  "Garantías insuficientes",
  "Falta firma o autenticación",
  "Otro",
];

export const SUBMOTIVOS_NEGADO: string[] = [
  "Capacidad de pago insuficiente",
  "Score crediticio bajo",
  "Reportes negativos",
  "Política interna del banco",
  "Antigüedad laboral insuficiente",
  "Otro",
];

export function requiereSubmotivo(estado: CasoEstado): boolean {
  return estado === "devuelto_banco" || estado === "negado_banco";
}

export function submotivosPara(estado: CasoEstado): string[] {
  if (estado === "devuelto_banco") return SUBMOTIVOS_DEVUELTO;
  if (estado === "negado_banco") return SUBMOTIVOS_NEGADO;
  return [];
}

export function transicionAutomatica(accion: Exclude<AccionOrigen, "manual">): CasoEstado | null {
  return ACCION_A_ESTADO[accion] ?? null;
}

/**
 * Mapeo oficial caso.estado → expediente.estado.
 * Debe coincidir con la función SQL `public.map_caso_to_expediente_estado`.
 * Single source of truth: el expediente.estado SIEMPRE se deriva del estado del caso.
 */
export type EstadoExpedienteDerivado =
  | "SIMULADO"
  | "ENVIADO_CONTRATACION"
  | "FIRMADO"
  | "RADICADO"
  | "APROBADO"
  | "CONDICIONES_APLICADAS"
  | "FACTURADO"
  | "PAGADO";

export function mapCasoToExpedienteEstado(
  caso: CasoEstado | null | undefined,
): EstadoExpedienteDerivado {
  switch (caso) {
    case "enviado_contratacion":
    case "contrato_enviado":
    case "contrato_generado":
      return "ENVIADO_CONTRATACION";
    case "contrato_firmado":
    case "poder_generado":
    case "poder_firmado":
    case "documentacion_completa":
    case "radicacion_pendiente":
    case "radicacion_preparada":
      return "FIRMADO";
    case "radicado_banco":
    case "en_estudio_banco":
    case "docs_complementarios_banco":
    case "devuelto_banco":
      return "RADICADO";
    case "aprobado":
    case "aprobado_banco":
      return "APROBADO";
    case "documentos_banco_firmados":
    case "condiciones_aplicadas":
    case "aplicado_banco":
    case "resultado_final_generado":
      return "CONDICIONES_APLICADAS";
    case "cuenta_cobro_generada":
    case "cuenta_cobro_enviada":
    case "honorarios_pendientes":
    case "prejuridico":
      return "FACTURADO";
    case "honorarios_pagados":
    case "paz_y_salvo_generado":
    case "caso_finalizado":
      return "PAGADO";
    default:
      return "SIMULADO";
  }
}

export function labelEstado(e: CasoEstado | null | undefined): string {
  if (!e) return "—";
  return CASO_ESTADO_BY_KEY[e]?.label ?? e;
}

export async function cambiarEstadoCaso(
  expedienteId: string,
  nuevoEstado: CasoEstado,
  accion: AccionOrigen,
  observacion?: string,
  submotivo?: string,
): Promise<void> {
  // Read previous estado_caso
  const { data: prev, error: errSel } = await supabase
    .from("expedientes")
    .select("estado_caso" as never)
    .eq("id", expedienteId)
    .single();
  if (errSel) throw errSel;
  const anterior = (prev as unknown as { estado_caso?: CasoEstado })?.estado_caso ?? null;

  // Update
  const { error: errUpd } = await supabase
    .from("expedientes")
    .update({ estado_caso: nuevoEstado } as never)
    .eq("id", expedienteId);
  if (errUpd) throw errUpd;

  // Historial
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  await supabase.from("expediente_historial").insert({
    expediente_id: expedienteId,
    estado_caso_anterior: anterior,
    estado_caso_nuevo: nuevoEstado,
    accion_origen: accion,
    observacion: observacion ?? null,
    user_id: userId,
  } as never);

  // Submotivo (obligatorio para devuelto_banco / negado_banco)
  if (submotivo && requiereSubmotivo(nuevoEstado)) {
    await supabase.from("caso_submotivos" as never).insert({
      expediente_id: expedienteId,
      estado: nuevoEstado,
      submotivo,
      observacion: observacion ?? null,
      user_id: userId,
    } as never);
  }
}

export interface HistorialEntry {
  id: string;
  created_at: string;
  estado_anterior: string | null;
  estado_nuevo: string | null;
  estado_caso_anterior: CasoEstado | null;
  estado_caso_nuevo: CasoEstado | null;
  accion_origen: string | null;
  observacion: string | null;
  user_id: string | null;
  user_nombre?: string | null;
}

export async function listHistorial(expedienteId: string): Promise<HistorialEntry[]> {
  const { data, error } = await supabase
    .from("expediente_historial")
    .select("*")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as HistorialEntry[];
  const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  if (ids.length === 0) return rows;
  const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
  const nameById = new Map<string, string>();
  (profs ?? []).forEach((p) => nameById.set(p.id, p.nombre || p.email || "—"));
  return rows.map((r) => ({ ...r, user_nombre: r.user_id ? nameById.get(r.user_id) ?? null : null }));
}
