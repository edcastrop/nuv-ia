import { supabase } from "@/integrations/supabase/client";

export type CanalTipo = "area" | "caso" | "dm" | "custom";

export interface Canal {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: CanalTipo;
  area: string | null;
  caso_id: string | null;
  privado: boolean;
  archivado: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Mensaje {
  id: string;
  canal_id: string;
  user_id: string;
  texto: string | null;
  adjuntos: Array<{ nombre: string; path: string; mime?: string; size?: number }>;
  menciones: string[];
  reply_to: string | null;
  editado_at: string | null;
  borrado: boolean;
  created_at: string;
}

export interface NotifColab {
  id: string;
  user_id: string;
  canal_id: string | null;
  mensaje_id: string | null;
  tipo: string;
  leida: boolean;
  created_at: string;
}

const T = (n: string) => supabase.from(n as never);

export async function listCanales(): Promise<Canal[]> {
  const { data, error } = await T("colab_canales")
    .select("*")
    .eq("archivado", false)
    .order("tipo", { ascending: true })
    .order("nombre", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Canal[];
}

export async function getCanalDeCaso(casoId: string, nombre: string): Promise<Canal> {
  const { data: ex } = await T("colab_canales").select("*").eq("caso_id", casoId).maybeSingle();
  if (ex) return ex as unknown as Canal;
  const { data: { user } } = await supabase.auth.getUser();
  const payload = { nombre: `Caso · ${nombre}`, tipo: "caso", caso_id: casoId, privado: true, created_by: user?.id };
  const { data, error } = await T("colab_canales").insert(payload as never).select().single();
  if (error) throw error;
  await T("colab_miembros").insert({ canal_id: (data as any).id, user_id: user?.id, rol: "admin" } as never);
  return data as unknown as Canal;
}

export async function crearCanal(input: { nombre: string; descripcion?: string; privado?: boolean; tipo?: CanalTipo }): Promise<Canal> {
  const { data: { user } } = await supabase.auth.getUser();
  const payload = {
    nombre: input.nombre,
    descripcion: input.descripcion ?? null,
    tipo: input.tipo ?? "custom",
    privado: input.privado ?? false,
    created_by: user?.id,
  };
  const { data, error } = await T("colab_canales").insert(payload as never).select().single();
  if (error) throw error;
  await T("colab_miembros").insert({ canal_id: (data as any).id, user_id: user?.id, rol: "admin" } as never);
  return data as unknown as Canal;
}

export async function listMensajes(canalId: string, limit = 100): Promise<Mensaje[]> {
  const { data, error } = await T("colab_mensajes")
    .select("*")
    .eq("canal_id", canalId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Mensaje[];
}

export async function enviarMensaje(canalId: string, texto: string, adjuntos: Mensaje["adjuntos"] = [], menciones: string[] = [], replyTo?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const payload = { canal_id: canalId, user_id: user.id, texto, adjuntos, menciones, reply_to: replyTo ?? null };
  const { data, error } = await T("colab_mensajes").insert(payload as never).select().single();
  if (error) throw error;
  await T("colab_auditoria").insert({ user_id: user.id, canal_id: canalId, accion: "mensaje_enviado", detalle: { id: (data as any).id } } as never);
  return data as unknown as Mensaje;
}

export async function borrarMensaje(id: string) {
  const { error } = await T("colab_mensajes").update({ borrado: true, texto: null, adjuntos: [] } as never).eq("id", id);
  if (error) throw error;
}

export async function unirseCanal(canalId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  await T("colab_miembros").upsert({ canal_id: canalId, user_id: user.id, rol: "miembro" } as never);
}

export async function subirAdjunto(canalId: string, file: File) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const path = `${user.id}/${canalId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("colab-adjuntos").upload(path, file);
  if (error) throw error;
  return { nombre: file.name, path, mime: file.type, size: file.size };
}

export async function getAdjuntoUrl(path: string) {
  const { data, error } = await supabase.storage.from("colab-adjuntos").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function listMisNotifColab(): Promise<NotifColab[]> {
  const { data, error } = await T("colab_notificaciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as NotifColab[];
}

export async function marcarNotifLeida(id: string) {
  await T("colab_notificaciones").update({ leida: true } as never).eq("id", id);
}
export async function marcarTodasNotifLeidas() {
  await T("colab_notificaciones").update({ leida: true } as never).eq("leida", false);
}

export async function listDirectorio(): Promise<Array<{ user_id: string; nombre: string; correo: string | null; foto_url: string | null; roles: string[] }>> {
  const { data, error } = await T("profiles")
    .select("id, nombre, email, avatar_url")
    .order("nombre", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as any[];
  const ids = rows.map((p) => p.id);
  const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const map = new Map<string, string[]>();
  (rolesData ?? []).forEach((r: any) => {
    const arr = map.get(r.user_id) ?? [];
    arr.push(r.role);
    map.set(r.user_id, arr);
  });
  return rows.map((p) => ({ user_id: p.id, nombre: p.nombre ?? p.email ?? "Usuario", correo: p.email ?? null, foto_url: p.avatar_url ?? null, roles: map.get(p.id) ?? [] }));
}

export async function getOrCreateDM(otherUserId: string): Promise<Canal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: mias } = await T("colab_miembros")
    .select("canal_id, colab_canales!inner(id,tipo)")
    .eq("user_id", user.id);
  const dmIds = ((mias ?? []) as any[]).filter((m) => m.colab_canales?.tipo === "dm").map((m) => m.canal_id);
  if (dmIds.length) {
    const { data: shared } = await T("colab_miembros").select("canal_id").eq("user_id", otherUserId).in("canal_id", dmIds);
    if (shared && shared.length) {
      const { data: c } = await T("colab_canales").select("*").eq("id", (shared[0] as any).canal_id).single();
      return c as unknown as Canal;
    }
  }
  const { data: nuevo, error } = await T("colab_canales").insert({ nombre: "DM", tipo: "dm", privado: true, created_by: user.id } as never).select().single();
  if (error) throw error;
  await T("colab_miembros").insert([
    { canal_id: (nuevo as any).id, user_id: user.id, rol: "admin" },
    { canal_id: (nuevo as any).id, user_id: otherUserId, rol: "miembro" },
  ] as never);
  return nuevo as unknown as Canal;
}

export function suscribirMensajes(canalId: string, cb: (m: Mensaje) => void) {
  const ch = supabase
    .channel(`colab_msg_${canalId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "colab_mensajes", filter: `canal_id=eq.${canalId}` }, (p) => cb(p.new as Mensaje))
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

export function suscribirNotifColab(userId: string, cb: () => void) {
  const ch = supabase
    .channel(`colab_notif_${userId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "colab_notificaciones", filter: `user_id=eq.${userId}` }, () => cb())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}
