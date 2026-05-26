import { supabase } from "@/integrations/supabase/client";

export interface Notificacion {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje: string | null;
  link: string | null;
  severidad: "baja" | "media" | "alta";
  leida: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function listMisNotificaciones(limit = 50): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from("notificaciones_usuario" as never)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as Notificacion[]) ?? [];
}

export async function marcarLeida(id: string): Promise<void> {
  await supabase
    .from("notificaciones_usuario" as never)
    .update({ leida: true } as never)
    .eq("id", id);
}

export async function marcarTodasLeidas(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase
    .from("notificaciones_usuario" as never)
    .update({ leida: true } as never)
    .eq("user_id", u.user.id)
    .eq("leida", false);
}

export async function contarNoLeidas(): Promise<number> {
  const { count } = await supabase
    .from("notificaciones_usuario" as never)
    .select("id", { count: "exact", head: true })
    .eq("leida", false);
  return count ?? 0;
}
