// Cliente: gestión de destinatarios y trazabilidad de envíos a contratación.
import { supabase } from "@/integrations/supabase/client";

export interface DestinatarioContratacion {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
}

export interface EnvioContratacion {
  id: string;
  expediente_id: string;
  user_id: string | null;
  destinatarios: string[];
  asunto: string;
  documentos: { name: string; type: string; size: number }[];
  estado_envio: string;
  proveedor_message_id: string | null;
  error: string | null;
  created_at: string;
}

export async function listDestinatarios(): Promise<DestinatarioContratacion[]> {
  const { data, error } = await supabase
    .from("contratacion_destinatarios")
    .select("id,email,nombre,activo")
    .order("email", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DestinatarioContratacion[];
}

export async function addDestinatario(email: string, nombre?: string) {
  const { error } = await supabase
    .from("contratacion_destinatarios")
    .insert({ email: email.trim().toLowerCase(), nombre: nombre?.trim() || null, activo: true });
  if (error) throw error;
}

export async function setDestinatarioActivo(id: string, activo: boolean) {
  const { error } = await supabase
    .from("contratacion_destinatarios")
    .update({ activo })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteDestinatario(id: string) {
  const { error } = await supabase
    .from("contratacion_destinatarios")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listEnviosByExpediente(expedienteId: string): Promise<EnvioContratacion[]> {
  const { data, error } = await supabase
    .from("envios_contratacion")
    .select("*")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EnvioContratacion[];
}
