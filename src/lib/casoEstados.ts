import { supabase } from "@/integrations/supabase/client";

export type CasoEstado =
  | "lead_creado"
  | "extracto_recibido"
  | "simulacion_realizada"
  | "propuesta_presentada"
  | "negociacion"
  | "pendiente_contratacion"
  | "enviado_contratacion"
  | "contrato_enviado"
  | "contrato_firmado"
  | "poder_firmado"
  | "radicacion_pendiente"
  | "radicado_banco"
  | "en_estudio_banco"
  | "aprobado"
  | "documentos_banco_firmados"
  | "condiciones_aplicadas"
  | "resultado_final_generado"
  | "cuenta_cobro_generada"
  | "cuenta_cobro_enviada"
  | "honorarios_pagados"
  | "paz_y_salvo_generado"
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
  { key: "extracto_recibido", label: "Extracto recibido", orden: 2, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "simulacion_realizada", label: "Simulación realizada", orden: 3, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "propuesta_presentada", label: "Propuesta presentada", orden: 4, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "negociacion", label: "Negociación", orden: 5, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "pendiente_contratacion", label: "Pendiente contratación", orden: 6, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "enviado_contratacion", label: "Enviado a contratación", orden: 7, color: "#3730A3", bg: "#E0E7FF" },
  { key: "contrato_enviado", label: "Contrato enviado", orden: 8, color: "#3730A3", bg: "#E0E7FF" },
  { key: "contrato_firmado", label: "Contrato firmado", orden: 9, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "poder_firmado", label: "Poder firmado", orden: 10, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "radicacion_pendiente", label: "Radicación pendiente", orden: 11, color: "#8A5A00", bg: "#FFF7E6" },
  { key: "radicado_banco", label: "Radicado en banco", orden: 12, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "en_estudio_banco", label: "En estudio banco", orden: 13, color: "#1A4A8A", bg: "#E8F0FE" },
  { key: "aprobado", label: "Aprobado", orden: 14, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "documentos_banco_firmados", label: "Documentos banco firmados", orden: 15, color: "#1F7A45", bg: "#EAF7EE" },
  { key: "condiciones_aplicadas", label: "Condiciones aplicadas", orden: 16, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "resultado_final_generado", label: "Resultado final generado", orden: 17, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "cuenta_cobro_generada", label: "Cuenta de cobro generada", orden: 18, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "cuenta_cobro_enviada", label: "Cuenta de cobro enviada", orden: 19, color: "#6B21A8", bg: "#F3E8FF" },
  { key: "honorarios_pagados", label: "Honorarios pagados", orden: 20, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "paz_y_salvo_generado", label: "Paz y salvo generado", orden: 21, color: "#1F7A45", bg: "#DDF4E3" },
  { key: "prejuridico", label: "Prejurídico", orden: 22, color: "#991B1B", bg: "#FEE2E2" },
  { key: "proceso_cerrado", label: "Proceso cerrado", orden: 23, color: "#242424", bg: "#E5E7EB" },
];

export const CASO_ESTADO_BY_KEY: Record<CasoEstado, CasoEstadoDef> = CASO_ESTADOS.reduce(
  (acc, e) => ({ ...acc, [e.key]: e }),
  {} as Record<CasoEstado, CasoEstadoDef>,
);

export type AccionOrigen =
  | "extracto_subido"
  | "simulacion_generada"
  | "propuesta_generada"
  | "envio_contratacion"
  | "contrato_firmado"
  | "poder_firmado"
  | "radicado_confirmado"
  | "aprobacion_registrada"
  | "documentos_banco_firmados"
  | "condiciones_aplicadas"
  | "resultado_final"
  | "cuenta_cobro_generada"
  | "cuenta_cobro_enviada"
  | "honorarios_pagados"
  | "paz_y_salvo_generado"
  | "prejuridico"
  | "manual";

export const ACCION_A_ESTADO: Record<Exclude<AccionOrigen, "manual">, CasoEstado> = {
  extracto_subido: "extracto_recibido",
  simulacion_generada: "simulacion_realizada",
  propuesta_generada: "propuesta_presentada",
  envio_contratacion: "enviado_contratacion",
  contrato_firmado: "contrato_firmado",
  poder_firmado: "poder_firmado",
  radicado_confirmado: "radicado_banco",
  aprobacion_registrada: "aprobado",
  documentos_banco_firmados: "documentos_banco_firmados",
  condiciones_aplicadas: "condiciones_aplicadas",
  resultado_final: "resultado_final_generado",
  cuenta_cobro_generada: "cuenta_cobro_generada",
  cuenta_cobro_enviada: "cuenta_cobro_enviada",
  honorarios_pagados: "honorarios_pagados",
  paz_y_salvo_generado: "paz_y_salvo_generado",
  prejuridico: "prejuridico",
};

export function labelEstado(e: CasoEstado | null | undefined): string {
  if (!e) return "—";
  return CASO_ESTADO_BY_KEY[e]?.label ?? e;
}

export async function cambiarEstadoCaso(
  expedienteId: string,
  nuevoEstado: CasoEstado,
  accion: AccionOrigen,
  observacion?: string,
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
  await supabase.from("expediente_historial").insert({
    expediente_id: expedienteId,
    estado_caso_anterior: anterior,
    estado_caso_nuevo: nuevoEstado,
    accion_origen: accion,
    observacion: observacion ?? null,
    user_id: userData.user?.id ?? null,
  } as never);
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
