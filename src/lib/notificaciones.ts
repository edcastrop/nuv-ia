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
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase
    .from("notificaciones_usuario" as never)
    .select("*")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as Notificacion[]) ?? [];
}

export async function marcarLeida(id: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase
    .from("notificaciones_usuario" as never)
    .update({ leida: true } as never)
    .eq("id", id)
    .eq("user_id", u.user.id);
  if (error) throw new Error(error.message);
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
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;
  const { count } = await supabase
    .from("notificaciones_usuario" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", u.user.id)
    .eq("leida", false);
  return count ?? 0;
}

/**
 * Caso alertas (estancamiento) — RLS restringe a owner del expediente o managers.
 * Las mapeamos a forma `Notificacion` para mostrarlas en la campana.
 */
export async function listCasoAlertasComoNotif(limit = 30): Promise<Notificacion[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: alertas } = await supabase
    .from("caso_alertas" as never)
    .select("id, expediente_id, tipo, dias_estancado, leida, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const arr = (alertas ?? []) as unknown as Array<{
    id: string;
    expediente_id: string;
    tipo: string;
    dias_estancado: number;
    leida: boolean;
    created_at: string;
  }>;
  if (arr.length === 0) return [];
  const ids = Array.from(new Set(arr.map((a) => a.expediente_id)));
  const { data: exps } = await supabase
    .from("expedientes")
    .select("id, cliente_nombre, banco")
    .in("id", ids);
  const expMap = new Map<string, { cliente_nombre: string | null; banco: string | null }>();
  ((exps ?? []) as Array<{ id: string; cliente_nombre: string | null; banco: string | null }>).forEach((e) =>
    expMap.set(e.id, { cliente_nombre: e.cliente_nombre, banco: e.banco }),
  );
  return arr.map((a) => {
    const exp = expMap.get(a.expediente_id);
    const cliente = exp?.cliente_nombre ?? "Caso";
    const banco = exp?.banco ? ` · ${exp.banco}` : "";
    return {
      id: `alerta:${a.id}`,
      user_id: u.user!.id,
      tipo: "caso_alerta",
      titulo: `Caso estancado: ${cliente}${banco}`,
      mensaje: `Sin avance hace ${a.dias_estancado} días.`,
      link: `/casos/${a.expediente_id}`,
      severidad: (a.dias_estancado >= 10 ? "alta" : a.dias_estancado >= 5 ? "media" : "baja") as Notificacion["severidad"],
      leida: a.leida,
      metadata: { expediente_id: a.expediente_id, alerta_id: a.id, dias_estancado: a.dias_estancado, tipo: a.tipo },
      created_at: a.created_at,
    } satisfies Notificacion;
  });
}

export async function contarCasoAlertasNoLeidas(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;
  const { count } = await supabase
    .from("caso_alertas" as never)
    .select("id", { count: "exact", head: true })
    .eq("leida", false);
  return count ?? 0;
}

export async function marcarCasoAlertaLeida(alertaId: string): Promise<void> {
  await supabase.from("caso_alertas" as never).update({ leida: true } as never).eq("id", alertaId);
}

/**
 * Notificaciones de colaboración (canales/mensajes/DM) mapeadas como Notificacion
 * para mostrarlas en la campana unificada.
 */
export async function listColabNotifsComoNotif(limit = 30): Promise<Notificacion[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("colab_notificaciones" as never)
    .select("id, canal_id, mensaje_id, tipo, leida, created_at")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  const arr = (data ?? []) as unknown as Array<{
    id: string;
    canal_id: string | null;
    mensaje_id: string | null;
    tipo: string;
    leida: boolean;
    created_at: string;
  }>;
  if (arr.length === 0) return [];
  const canalIds = Array.from(new Set(arr.map((a) => a.canal_id).filter(Boolean) as string[]));
  const { data: canales } = canalIds.length
    ? await supabase.from("colab_canales" as never).select("id, nombre, tipo").in("id", canalIds)
    : { data: [] as Array<{ id: string; nombre: string; tipo: string }> };
  const cMap = new Map<string, { nombre: string; tipo: string }>();
  ((canales ?? []) as Array<{ id: string; nombre: string; tipo: string }>).forEach((c) =>
    cMap.set(c.id, { nombre: c.nombre, tipo: c.tipo }),
  );
  return arr.map((a) => {
    const c = a.canal_id ? cMap.get(a.canal_id) : undefined;
    const esDM = c?.tipo === "dm";
    const titulo = esDM
      ? `Mensaje directo${c?.nombre && c.nombre !== "DM" ? ` · ${c.nombre}` : ""}`
      : `Mensaje en ${c?.nombre ?? "canal"}`;
    const link = a.canal_id
      ? (esDM ? `/colaboracion/dm/${a.canal_id}` : `/colaboracion?canal=${a.canal_id}`)
      : "/colaboracion";
    return {
      id: `colab:${a.id}`,
      user_id: u.user!.id,
      tipo: a.tipo || "mensaje_interno",
      titulo,
      mensaje: a.tipo === "mencion" ? "Te han mencionado." : "Nuevo mensaje.",
      link,
      severidad: "media",
      leida: a.leida,
      metadata: { canal_id: a.canal_id, mensaje_id: a.mensaje_id, colab_notif_id: a.id },
      created_at: a.created_at,
    } satisfies Notificacion;
  });
}

export async function contarColabNotifsNoLeidas(): Promise<number> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 0;
  const { count } = await supabase
    .from("colab_notificaciones" as never)
    .select("id", { count: "exact", head: true })
    .eq("user_id", u.user.id)
    .eq("leida", false);
  return count ?? 0;
}

export async function marcarColabNotifLeida(id: string): Promise<void> {
  await supabase.from("colab_notificaciones" as never).update({ leida: true } as never).eq("id", id);
}

