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
  const safeName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-120) || "archivo";
  const path = `${user.id}/${canalId}/${Date.now()}-${safeName}`;
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
export async function marcarNotifsCanalLeidas(canalId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await T("colab_notificaciones").update({ leida: true } as never)
    .eq("user_id", user.id).eq("canal_id", canalId).eq("leida", false);
}

export interface DMResumen {
  canal: Canal;
  otro: {
    user_id: string;
    nombre: string;
    foto_url: string | null;
    roles: string[];
    ultima_lectura: string | null;
    last_seen_at: string | null;
    presencia_visible: boolean;
  };
  ultimo_mensaje: { texto: string | null; created_at: string; user_id: string } | null;
  no_leidos: number;
}

export async function listMisDMs(): Promise<DMResumen[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: mias } = await T("colab_miembros")
    .select("canal_id, ultima_lectura, colab_canales!inner(id,nombre,tipo,privado,archivado,descripcion,area,caso_id,created_by,created_at,updated_at)")
    .eq("user_id", user.id);
  const dmRows = ((mias ?? []) as any[]).filter((m) => m.colab_canales?.tipo === "dm" && !m.colab_canales?.archivado);
  if (!dmRows.length) return [];
  const canalIds = dmRows.map((r) => r.canal_id);
  const myReadByCanal = new Map<string, string>(dmRows.map((r) => [r.canal_id, r.ultima_lectura]));

  const { data: otrosMiembros } = await T("colab_miembros")
    .select("canal_id, user_id, ultima_lectura")
    .in("canal_id", canalIds)
    .neq("user_id", user.id);
  const otroPorCanal = new Map<string, { user_id: string; ultima_lectura: string }>();
  ((otrosMiembros ?? []) as any[]).forEach((m) => { otroPorCanal.set(m.canal_id, { user_id: m.user_id, ultima_lectura: m.ultima_lectura }); });

  const otroIds = Array.from(new Set(Array.from(otroPorCanal.values()).map((v) => v.user_id)));
  const dir = await listDirectorioFull();
  const dirMap = new Map(dir.map((d) => [d.user_id, d]));

  const { data: ultMsgs } = await T("colab_mensajes")
    .select("canal_id, user_id, texto, created_at, borrado")
    .in("canal_id", canalIds)
    .order("created_at", { ascending: false })
    .limit(canalIds.length * 30);
  const ultimoPorCanal = new Map<string, any>();
  ((ultMsgs ?? []) as any[]).forEach((m) => { if (!ultimoPorCanal.has(m.canal_id)) ultimoPorCanal.set(m.canal_id, m); });

  const resumen: DMResumen[] = dmRows.map((r) => {
    const otroRef = otroPorCanal.get(r.canal_id);
    const perfil = otroRef ? dirMap.get(otroRef.user_id) : undefined;
    const myRead = myReadByCanal.get(r.canal_id);
    const noLeidos = ((ultMsgs ?? []) as any[]).filter((m) => m.canal_id === r.canal_id && m.user_id !== user.id && (!myRead || new Date(m.created_at) > new Date(myRead))).length;
    return {
      canal: r.colab_canales as Canal,
      otro: {
        user_id: otroRef?.user_id ?? "",
        nombre: perfil?.nombre ?? "Usuario",
        foto_url: perfil?.foto_url ?? null,
        roles: perfil?.roles ?? [],
        ultima_lectura: otroRef?.ultima_lectura ?? null,
        last_seen_at: perfil?.last_seen_at ?? null,
        presencia_visible: perfil?.presencia_visible !== false,
      },
      ultimo_mensaje: ultimoPorCanal.get(r.canal_id) ?? null,
      no_leidos: noLeidos,
    };
  });
  void otroIds;
  resumen.sort((a, b) => {
    const ta = a.ultimo_mensaje ? new Date(a.ultimo_mensaje.created_at).getTime() : 0;
    const tb = b.ultimo_mensaje ? new Date(b.ultimo_mensaje.created_at).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return new Date(b.canal.created_at).getTime() - new Date(a.canal.created_at).getTime();
  });
  // Deduplicar por contraparte: si hay varios canales DM con la misma persona
  // (por carreras al crear o históricos), conservamos el más relevante y
  // acumulamos los no_leidos de los duplicados.
  const vistos = new Map<string, DMResumen>();
  for (const r of resumen) {
    const key = r.otro.user_id || `__canal__:${r.canal.id}`;
    const prev = vistos.get(key);
    if (!prev) vistos.set(key, r);
    else prev.no_leidos += r.no_leidos;
  }
  return Array.from(vistos.values());
}

export async function marcarCanalLeido(canalId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await T("colab_miembros").update({ ultima_lectura: new Date().toISOString() } as never).eq("canal_id", canalId).eq("user_id", user.id);
}

export async function getOtroMiembroLectura(canalId: string): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await T("colab_miembros").select("user_id, ultima_lectura").eq("canal_id", canalId).neq("user_id", user.id).limit(1).maybeSingle();
  return (data as any)?.ultima_lectura ?? null;
}

export type DirectorioPersona = {
  user_id: string;
  nombre: string;
  correo: string | null;
  correo_corp: string | null;
  whatsapp: string | null;
  celular: string | null;
  ciudad: string | null;
  pais: string | null;
  equipo: string | null;
  sede: string | null;
  foto_url: string | null;
  activo: boolean;
  roles: string[];      // Labels traducidos para mostrar en UI
  rolesRaw: string[];   // Códigos crudos para lógica/agrupación
  last_seen_at: string | null;
  presencia_visible: boolean;
};

const ROL_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  gerencia: "CEO / Gerencia",
  asesor: "Asesor",
  licenciado: "Analista Financiero Comercial",
  juridica: "Jurídica",
  operaciones: "Operaciones",
  cartera: "Cartera",
  contabilidad: "Contabilidad",
  director_financiero_qa: "Director Financiero / QA",
  director_juridico: "Director Jurídico",
  auxiliar_operativo: "Auxiliar Operativo",
  apoderado: "Apoderado",
};

export function labelRol(r: string): string {
  return ROL_LABEL[r] ?? r.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function listDirectorioFull(): Promise<DirectorioPersona[]> {
  const { data, error } = await T("profiles")
    .select("id, nombre, email, avatar_url, correo_corporativo, whatsapp, celular, ciudad, pais, equipo, sede, activo, estado_acceso, rol_solicitado, last_seen_at, presencia_visible")
    .eq("activo", true)
    .eq("estado_acceso", "aprobado")
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
  return rows.map((p) => {
    const rolesRaw = map.get(p.id) ?? [];
    // Fallback al rol solicitado si todavía no hay asignación en user_roles
    const roles = rolesRaw.length > 0
      ? rolesRaw
      : (p.rol_solicitado ? [String(p.rol_solicitado)] : []);
    return {
      user_id: p.id,
      nombre: p.nombre ?? p.email ?? "Usuario",
      correo: p.email ?? null,
      correo_corp: p.correo_corporativo ?? null,
      whatsapp: p.whatsapp ?? null,
      celular: p.celular ?? null,
      ciudad: p.ciudad ?? null,
      pais: p.pais ?? null,
      equipo: p.equipo ?? null,
      sede: p.sede ?? null,
      foto_url: p.avatar_url ?? null,
      activo: p.activo ?? true,
      roles: roles.map(labelRol),
      rolesRaw: roles,
      last_seen_at: p.last_seen_at ?? null,
      presencia_visible: p.presencia_visible !== false,
    };
  });
}

export async function listDirectorio(): Promise<Array<{ user_id: string; nombre: string; correo: string | null; foto_url: string | null; roles: string[] }>> {
  const rows = await listDirectorioFull();
  return rows.map((p) => ({ user_id: p.user_id, nombre: p.nombre, correo: p.correo, foto_url: p.foto_url, roles: p.roles }));
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
