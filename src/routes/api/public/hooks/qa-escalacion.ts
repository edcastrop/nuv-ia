// ============================================================================
// QA ESCALATION CRON — corre cada 10 min. Convierte validaciones QA sin
// dictamen en presión creciente:
//   • ≥30 min  → re-notifica Director QA + Super Admin (nuevo push, sonido).
//   • ≥60 min  → añade Director de Operaciones (rol "operaciones").
//   • ≥120 min → severidad crítica + notifica Gerencia; el banner en /qa-ai
//                pasa a modo pulsante rojo automáticamente.
// Idempotencia: sólo notifica al rebasar cada umbral por primera vez,
// registrando el nivel alcanzado en `metadata.qa_escalacion_nivel` para no
// spammear con la misma alerta cada 10 min.
// ============================================================================
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Pendiente = {
  id: string;
  expediente_id: string;
  solicitada_at: string;
};

type Rol = { user_id: string };

async function userIdsPorRoles(roles: string[]): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("user_roles" as never)
    .select("user_id")
    .in("role", roles as never);
  return Array.from(new Set(((data ?? []) as Rol[]).map((r) => r.user_id)));
}

async function yaNotificado(
  userIds: string[],
  expedienteId: string,
  nivel: number,
): Promise<Set<string>> {
  // Busca notificaciones existentes para este expediente donde metadata->qa_escalacion_nivel >= nivel
  const { data } = await supabaseAdmin
    .from("notificaciones_usuario" as never)
    .select("user_id, metadata")
    .in("user_id", userIds as never)
    .in("tipo", ["qa_escalado", "qa_critico"] as never)
    .contains("metadata" as never, { expediente_id: expedienteId } as never);
  const done = new Set<string>();
  for (const row of ((data ?? []) as Array<{ user_id: string; metadata: Record<string, unknown> }>)) {
    const n = Number((row.metadata as { qa_escalacion_nivel?: number })?.qa_escalacion_nivel ?? 0);
    if (n >= nivel) done.add(row.user_id);
  }
  return done;
}

async function insertarNotifs(
  userIds: string[],
  payload: Record<string, unknown>,
): Promise<number> {
  if (userIds.length === 0) return 0;
  const rows = userIds.map((uid) => ({ ...payload, user_id: uid }));
  const { error } = await supabaseAdmin
    .from("notificaciones_usuario" as never)
    .insert(rows as never);
  if (error) {
    console.warn("[qa-escalacion] insert error", error);
    return 0;
  }
  return rows.length;
}

export const Route = createFileRoute("/api/public/hooks/qa-escalacion")({
  server: {
    handlers: {
      POST: async () => {
        const { data: pendientes, error } = await supabaseAdmin
          .from("validaciones_qa" as never)
          .select("id, expediente_id, solicitada_at")
          .is("resultado", null);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const ahora = Date.now();
        let creadas = 0;
        const detalle: Array<{ id: string; mins: number; nivel: number; enviadas: number }> = [];

        // Preload de roles (una vez)
        const [directoresQA, superAdmins, operaciones, gerencia] = await Promise.all([
          userIdsPorRoles(["director_financiero_qa"]),
          userIdsPorRoles(["super_admin"]),
          userIdsPorRoles(["operaciones"]),
          userIdsPorRoles(["gerencia"]),
        ]);

        for (const p of ((pendientes ?? []) as Pendiente[])) {
          const mins = Math.floor((ahora - new Date(p.solicitada_at).getTime()) / 60_000);
          if (mins < 30) continue;

          // Info del expediente
          const { data: expRow } = await supabaseAdmin
            .from("expedientes" as never)
            .select("cliente_nombre, banco, asesor_id")
            .eq("id", p.expediente_id)
            .maybeSingle();
          const cliente = (expRow as { cliente_nombre?: string | null } | null)?.cliente_nombre ?? "Cliente";
          const banco = (expRow as { banco?: string | null } | null)?.banco ?? null;

          let nivel = 1;
          if (mins >= 120) nivel = 3;
          else if (mins >= 60) nivel = 2;

          // Público según nivel
          const publico = new Set<string>([...directoresQA, ...superAdmins]);
          if (nivel >= 2) operaciones.forEach((u) => publico.add(u));
          if (nivel >= 3) gerencia.forEach((u) => publico.add(u));

          const publicoArr = Array.from(publico);
          const ya = await yaNotificado(publicoArr, p.expediente_id, nivel);
          const destinatarios = publicoArr.filter((u) => !ya.has(u));
          if (destinatarios.length === 0) continue;

          const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}min`;
          const titulo =
            nivel >= 3
              ? `🚨 QA CRÍTICO: ${cliente}`
              : nivel === 2
                ? `⏰ QA sin atender: ${cliente}`
                : `QA esperando dictamen: ${cliente}`;
          const mensaje = `${label} sin dictamen${banco ? ` · ${banco}` : ""}. Nivel ${nivel}/3.`;

          const enviadas = await insertarNotifs(destinatarios, {
            tipo: nivel >= 3 ? "qa_critico" : "qa_escalado",
            titulo,
            mensaje,
            link: `/qa-ai`,
            severidad: nivel >= 2 ? "alta" : "media",
            metadata: {
              expediente_id: p.expediente_id,
              validacion_id: p.id,
              qa_escalacion_nivel: nivel,
              mins,
            },
          });
          creadas += enviadas;
          detalle.push({ id: p.id, mins, nivel, enviadas });
        }

        return Response.json({ ok: true, creadas, detalle });
      },
    },
  },
});
