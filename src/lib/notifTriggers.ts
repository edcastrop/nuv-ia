// ============================================================================
// Disparadores de notificaciones cruzadas entre roles (Fase 1 — UI guiada).
// Usa la tabla `notificaciones_usuario` existente. Cualquier usuario
// autenticado puede insertar (RLS lo permite); por eso estos helpers viven
// del lado cliente y se llaman desde acciones del expediente.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin" | "asesor" | "gerencia" | "licenciado" | "super_admin"
  | "juridica" | "operaciones" | "cartera" | "contabilidad"
  | "director_financiero_qa" | "director_juridico" | "auxiliar_operativo" | "apoderado";

export interface NotifPayload {
  tipo: string;
  titulo: string;
  mensaje?: string | null;
  link?: string | null;
  severidad?: "baja" | "media" | "alta";
  metadata?: Record<string, unknown>;
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function notificarUsuarios(userIds: string[], p: NotifPayload): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return;
  const sev = p.severidad ?? "media";
  try {
    await supabase.from("notificaciones_usuario" as never).insert(
      ids.map((u) => ({
        user_id: u,
        tipo: p.tipo,
        titulo: p.titulo,
        mensaje: p.mensaje ?? null,
        link: p.link ?? null,
        severidad: sev,
        metadata: p.metadata ?? {},
      })) as never,
    );
  } catch {
    /* nunca romper la acción principal por fallos de notificación */
  }
}

export async function notificarRoles(roles: AppRole[], p: NotifPayload, opts?: { excluirSelf?: boolean }): Promise<void> {
  if (roles.length === 0) return;
  try {
    const { data } = await supabase.from("user_roles").select("user_id").in("role", roles as never);
    const ids = ((data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id);
    if (opts?.excluirSelf !== false) {
      const me = await currentUserId();
      if (me) {
        const i = ids.indexOf(me);
        if (i >= 0) ids.splice(i, 1);
      }
    }
    await notificarUsuarios(ids, p);
  } catch {
    /* swallow */
  }
}

/** Notifica al asesor responsable del expediente (si existe). */
export async function notificarAsesorExpediente(expedienteId: string, p: NotifPayload): Promise<void> {
  try {
    const { data } = await supabase
      .from("expedientes")
      .select("asesor_id")
      .eq("id", expedienteId)
      .maybeSingle();
    const aid = (data as { asesor_id: string | null } | null)?.asesor_id;
    if (!aid) return;
    const me = await currentUserId();
    if (aid === me) return;
    await notificarUsuarios([aid], p);
  } catch {
    /* swallow */
  }
}

// ----- Disparadores específicos --------------------------------------------

export async function notifQADevuelta(expedienteId: string, motivo: string, observacion: string): Promise<void> {
  const link = `/casos/${expedienteId}`;
  await notificarAsesorExpediente(expedienteId, {
    tipo: "qa_devuelta",
    titulo: "QA devolvió tu caso",
    mensaje: `Motivo: ${motivo}. ${observacion}`.slice(0, 280),
    link,
    severidad: "alta",
    metadata: { expediente_id: expedienteId, motivo },
  });
}

export async function notifQAAprobada(expedienteId: string): Promise<void> {
  const link = `/casos/${expedienteId}`;
  // Asesor sigue, jurídica observa.
  await Promise.all([
    notificarAsesorExpediente(expedienteId, {
      tipo: "qa_aprobada",
      titulo: "QA aprobada",
      mensaje: "Puedes continuar con contratación.",
      link,
      severidad: "media",
      metadata: { expediente_id: expedienteId },
    }),
    notificarRoles(["juridica", "director_juridico"], {
      tipo: "qa_aprobada",
      titulo: "Nuevo caso aprobado por QA",
      mensaje: "Listo para gestión jurídica.",
      link,
      severidad: "baja",
      metadata: { expediente_id: expedienteId },
    }),
  ]);
}

export async function notifPagoRegistrado(carteraId: string, valor: number, expedienteId: string | null): Promise<void> {
  const link = expedienteId ? `/casos/${expedienteId}` : `/cartera/${carteraId}`;
  const fmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
  await notificarRoles(["contabilidad", "director_financiero_qa"], {
    tipo: "pago_registrado",
    titulo: "Nuevo pago registrado",
    mensaje: `Valor: ${fmt}`,
    link,
    severidad: "media",
    metadata: { cartera_id: carteraId, expediente_id: expedienteId, valor },
  });
  if (expedienteId) {
    await notificarAsesorExpediente(expedienteId, {
      tipo: "pago_registrado",
      titulo: "Tu cliente registró un pago",
      mensaje: `Valor: ${fmt}`,
      link,
      severidad: "media",
      metadata: { cartera_id: carteraId, expediente_id: expedienteId, valor },
    });
  }
}

export async function notifRadicado(expedienteId: string, banco: string | null): Promise<void> {
  const link = `/casos/${expedienteId}`;
  await notificarRoles(["operaciones", "cartera", "gerencia"], {
    tipo: "caso_radicado",
    titulo: `Caso radicado${banco ? ` en ${banco}` : ""}`,
    mensaje: "Esperando respuesta del banco.",
    link,
    severidad: "media",
    metadata: { expediente_id: expedienteId, banco },
  });
}
