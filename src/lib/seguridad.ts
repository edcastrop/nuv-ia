import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserRole";

export type EstadoAcceso = "pendiente" | "aprobado" | "rechazado" | "bloqueado" | "desvinculado";

export interface PreviewDesvinculacion {
  transferibles: {
    expedientes: number;
    cartera_responsable: number;
    cartera_creador: number;
    reglas_comision: number;
    validaciones_qa_pendientes: number;
  };
  comisiones: {
    pendientes: number;
    pagadas: number;
    cuentas_cobro_pendientes: number;
    cuentas_cobro_pagadas: number;
  };
  historico: {
    mensajes: number;
    notificaciones: number;
    auditoria: number;
    progreso_academia: number;
    validaciones_qa_historicas: number;
  };
}

export async function previewDesvinculacion(userId: string): Promise<PreviewDesvinculacion> {
  const { data, error } = await supabase.rpc("preview_desvinculacion" as never, { _target: userId } as never);
  if (error) throw error;
  return data as unknown as PreviewDesvinculacion;
}

export async function desvincularUsuario(
  userId: string,
  reemplazoId: string,
  transferirComisiones: boolean
): Promise<{ ok: boolean; transferido: Record<string, number> }> {
  const { data, error } = await supabase.rpc("desvincular_usuario" as never, {
    _target: userId,
    _reemplazo: reemplazoId,
    _transferir_comisiones: transferirComisiones,
  } as never);
  if (error) throw error;
  return data as unknown as { ok: boolean; transferido: Record<string, number> };
}

export async function desvincularUsuarioSinTraslado(
  userId: string,
  motivo: string
): Promise<{ ok: boolean; sin_traslado: boolean; huerfanos: PreviewDesvinculacion }> {
  const { data, error } = await supabase.rpc("desvincular_usuario_sin_traslado" as never, {
    _target: userId,
    _motivo: motivo,
  } as never);
  if (error) throw error;
  return data as unknown as { ok: boolean; sin_traslado: boolean; huerfanos: PreviewDesvinculacion };
}
export type MfaMetodo = "ninguno" | "email" | "totp";

export interface UsuarioAcceso {
  id: string;
  nombre: string | null;
  email: string | null;
  avatar_url: string | null;
  telefono_registro: string | null;
  ciudad_registro: string | null;
  equipo_registro: string | null;
  rol_solicitado: string | null;
  estado_acceso: EstadoAcceso;
  aprobado_por: string | null;
  aprobado_at: string | null;
  rechazado_motivo: string | null;
  ultimo_login_at: string | null;
  intentos_fallidos: number;
  mfa_requerido: boolean;
  mfa_metodo: MfaMetodo;
  mfa_verificado_at: string | null;
  activo: boolean | null;
  created_at: string;
}

export async function listUsuariosAcceso(estado?: EstadoAcceso): Promise<UsuarioAcceso[]> {
  let q = supabase.from("profiles" as never).select("*").order("created_at", { ascending: false });
  if (estado) q = q.eq("estado_acceso", estado);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as UsuarioAcceso[];
}

export async function getMiPerfilAcceso() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles" as never)
    .select("estado_acceso, mfa_requerido, mfa_metodo, mfa_verificado_at, rechazado_motivo")
    .eq("id", user.id)
    .maybeSingle();
  return data as unknown as {
    estado_acceso: EstadoAcceso;
    mfa_requerido: boolean;
    mfa_metodo: MfaMetodo;
    mfa_verificado_at: string | null;
    rechazado_motivo: string | null;
  } | null;
}

export async function aprobarUsuario(userId: string, roles: AppRole[]) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { error } = await supabase
    .from("profiles" as never)
    .update({
      estado_acceso: "aprobado",
      aprobado_por: user.id,
      aprobado_at: new Date().toISOString(),
      activo: true,
      rechazado_motivo: null,
    } as never)
    .eq("id", userId);
  if (error) throw error;

  // Asignar roles
  if (roles.length > 0) {
    for (const role of roles) {
      await supabase.from("user_roles").insert({ user_id: userId, role } as never);
    }
  }

  await supabase.from("acceso_auditoria" as never).insert({
    user_id: userId,
    actor_id: user.id,
    accion: "aprobado",
    detalle: { roles },
  } as never);

  // Notificar al usuario aprobado (in-app)
  try {
    await supabase.rpc("notify_user" as never, {
      _uid: userId,
      _tipo: "acceso_aprobado",
      _titulo: "¡Tu acceso a NUVEX ha sido aprobado!",
      _mensaje: `Tu cuenta fue activada con rol: ${roles.join(", ") || "—"}. Inicia tu onboarding para comenzar.`,
      _link: "/onboarding",
      _sev: "alta",
      _meta: { roles },
    } as never);
  } catch {
    // no bloquear el flujo si la notificación falla
  }
}

export async function rechazarUsuario(userId: string, motivo: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { error } = await supabase
    .from("profiles" as never)
    .update({
      estado_acceso: "rechazado",
      rechazado_motivo: motivo,
      aprobado_por: user.id,
      aprobado_at: new Date().toISOString(),
    } as never)
    .eq("id", userId);
  if (error) throw error;

  await supabase.from("acceso_auditoria" as never).insert({
    user_id: userId,
    actor_id: user.id,
    accion: "rechazado",
    detalle: { motivo },
  } as never);
}

export async function bloquearUsuario(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  await supabase
    .from("profiles" as never)
    .update({ estado_acceso: "bloqueado", activo: false } as never)
    .eq("id", userId);
  await supabase.from("acceso_auditoria" as never).insert({
    user_id: userId, actor_id: user.id, accion: "bloqueado", detalle: {},
  } as never);
}

export async function activarUsuario(userId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  await supabase
    .from("profiles" as never)
    .update({ estado_acceso: "aprobado", activo: true } as never)
    .eq("id", userId);
  await supabase.from("acceso_auditoria" as never).insert({
    user_id: userId, actor_id: user.id, accion: "activado", detalle: {},
  } as never);
}

export async function listAuditoria(userId?: string) {
  let q = supabase.from("acceso_auditoria" as never).select("*").order("created_at", { ascending: false }).limit(200);
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as Array<{
    id: string; user_id: string; actor_id: string | null;
    accion: string; detalle: Record<string, unknown>; created_at: string;
  }>;
}

export async function registrarUltimoLogin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles" as never)
    .update({ ultimo_login_at: new Date().toISOString(), intentos_fallidos: 0 } as never)
    .eq("id", user.id);
  await supabase.from("acceso_auditoria" as never).insert({
    user_id: user.id, actor_id: user.id, accion: "login_ok", detalle: {},
  } as never);
}

export async function registrarMfaVerificado(metodo: MfaMetodo) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("profiles" as never)
    .update({ mfa_verificado_at: new Date().toISOString(), mfa_metodo: metodo } as never)
    .eq("id", user.id);
  await supabase.from("acceso_auditoria" as never).insert({
    user_id: user.id, actor_id: user.id, accion: "mfa_verificado", detalle: { metodo },
  } as never);
}
