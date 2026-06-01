// Centro de Incidentes Operativos — Fase 2
import { supabase } from "@/integrations/supabase/client";

export type IncidenteTipo = "documental" | "juridico" | "financiero" | "banco" | "cliente" | "sistema" | "otro";
export type IncidenteSeveridad = "baja" | "media" | "alta" | "critica";
export type IncidenteEstado = "abierto" | "en_gestion" | "resuelto" | "cerrado";

export interface Incidente {
  id: string;
  expediente_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: IncidenteTipo;
  severidad: IncidenteSeveridad;
  estado: IncidenteEstado;
  reportado_por: string;
  asignado_a: string | null;
  resolucion: string | null;
  resuelto_at: string | null;
  cerrado_at: string | null;
  created_at: string;
  updated_at: string;
}

export const TIPO_LABEL: Record<IncidenteTipo, string> = {
  documental: "Documental",
  juridico: "Jurídico",
  financiero: "Financiero",
  banco: "Banco",
  cliente: "Cliente",
  sistema: "Sistema",
  otro: "Otro",
};

export const SEVERIDAD_STYLE: Record<IncidenteSeveridad, { bg: string; color: string; border: string; label: string }> = {
  baja:    { bg: "#EEF2FF", color: "#3730A3", border: "#C7D2FE", label: "Baja" },
  media:   { bg: "#FFF7E6", color: "#8A5A00", border: "#F5D899", label: "Media" },
  alta:    { bg: "#FFE4D6", color: "#9A3412", border: "#FBA17B", label: "Alta" },
  critica: { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "Crítica" },
};

export const ESTADO_STYLE: Record<IncidenteEstado, { bg: string; color: string; border: string; label: string }> = {
  abierto:    { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "Abierto" },
  en_gestion: { bg: "#FFF7E6", color: "#8A5A00", border: "#F5D899", label: "En gestión" },
  resuelto:   { bg: "#DDF4E3", color: "#1F7A45", border: "#A6E2B6", label: "Resuelto" },
  cerrado:    { bg: "#F1F2F4", color: "#242424", border: "#E3E7EE", label: "Cerrado" },
};

export interface ListarIncidentesFiltros {
  estado?: IncidenteEstado | "todos";
  severidad?: IncidenteSeveridad | "todas";
  tipo?: IncidenteTipo | "todos";
  asignadoA?: string | null;
}

export async function listarIncidentes(filtros: ListarIncidentesFiltros = {}): Promise<Incidente[]> {
  let q = supabase.from("incidentes_operativos").select("*").order("created_at", { ascending: false }).limit(500);
  if (filtros.estado && filtros.estado !== "todos") q = q.eq("estado", filtros.estado);
  if (filtros.severidad && filtros.severidad !== "todas") q = q.eq("severidad", filtros.severidad);
  if (filtros.tipo && filtros.tipo !== "todos") q = q.eq("tipo", filtros.tipo);
  if (filtros.asignadoA) q = q.eq("asignado_a", filtros.asignadoA);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Incidente[];
}

export interface CrearIncidenteInput {
  titulo: string;
  descripcion?: string;
  tipo: IncidenteTipo;
  severidad: IncidenteSeveridad;
  expediente_id?: string | null;
  asignado_a?: string | null;
}

export async function crearIncidente(input: CrearIncidenteInput): Promise<Incidente> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("No autenticado");
  const payload = {
    titulo: input.titulo.trim(),
    descripcion: input.descripcion?.trim() || null,
    tipo: input.tipo,
    severidad: input.severidad,
    expediente_id: input.expediente_id || null,
    asignado_a: input.asignado_a || null,
    reportado_por: uid,
    estado: "abierto" as IncidenteEstado,
  };
  const { data, error } = await supabase.from("incidentes_operativos").insert(payload).select("*").single();
  if (error) throw error;
  await registrarAuditoria("crear", data.id, payload);
  return data as Incidente;
}

export async function actualizarIncidente(
  id: string,
  patch: Partial<Pick<Incidente, "estado" | "severidad" | "tipo" | "asignado_a" | "resolucion" | "titulo" | "descripcion">>,
): Promise<Incidente> {
  const updates: Record<string, unknown> = { ...patch };
  if (patch.estado === "resuelto") updates.resuelto_at = new Date().toISOString();
  if (patch.estado === "cerrado") updates.cerrado_at = new Date().toISOString();
  const { data, error } = await supabase
    .from("incidentes_operativos")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await registrarAuditoria("actualizar", id, updates);
  return data as Incidente;
}

export async function eliminarIncidente(id: string): Promise<void> {
  const { error } = await supabase.from("incidentes_operativos").delete().eq("id", id);
  if (error) throw error;
  await registrarAuditoria("eliminar", id, {});
}

async function registrarAuditoria(accion: string, id: string, detalle: unknown) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("auditoria_global").insert({
      entidad: "incidente_operativo",
      entidad_id: id,
      accion,
      user_id: auth.user?.id ?? null,
      valor_nuevo: detalle as never,
    });
  } catch {
    // auditoría no debe romper la operación
  }
}
