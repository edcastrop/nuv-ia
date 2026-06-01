// Cron diario que crea alertas de estancamiento por estado del caso.
// Idempotente: por cada expediente con alerta vigente sin leer, sólo se inserta una nueva
// si los días aumentaron significativamente (>= 1 día más).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Umbral en días por estado: cuántos días puede pasar el caso en ese estado
// antes de generar alerta de estancamiento.
const UMBRAL_DIAS: Record<string, number> = {
  prospecto: 7,
  simulado: 10,
  propuesta_enviada: 7,
  propuesta_presentada: 7,
  acepto_propuesta: 5,
  documentacion_completa: 5,
  contrato_generado: 5,
  poder_generado: 5,
  enviado_contratacion: 5,
  radicacion_preparada: 3,
  radicado_banco: 14,
  en_estudio_banco: 21,
  docs_complementarios_banco: 7,
  aprobado_banco: 7,
  aprobado: 7,
  honorarios_pendientes: 5,
  cuenta_cobro_enviada: 10,
};

export const Route = createFileRoute("/api/public/hooks/casos-alertas")({
  server: {
    handlers: {
      POST: async () => {
        const { data: exps, error } = await supabaseAdmin
          .from("expedientes" as never)
          .select("id, estado_caso, updated_at")
          .not("estado_caso", "in", '("caso_finalizado","proceso_cerrado","paz_y_salvo_generado","negado_banco")');
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const ahora = Date.now();
        let creadas = 0;

        for (const e of (exps as unknown as { id: string; estado_caso: string; updated_at: string }[]) ?? []) {
          const umbral = UMBRAL_DIAS[e.estado_caso];
          if (!umbral) continue;

          // Última transición a este estado (o fallback a updated_at)
          const { data: hist } = await supabaseAdmin
            .from("expediente_historial" as never)
            .select("created_at")
            .eq("expediente_id", e.id)
            .eq("estado_caso_nuevo", e.estado_caso)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastChange = (hist as unknown as { created_at: string }[] | null)?.[0]?.created_at ?? e.updated_at;
          const dias = Math.floor((ahora - new Date(lastChange).getTime()) / 86_400_000);
          if (dias < umbral) continue;

          // Verifica alerta sin leer existente
          const { data: prev } = await supabaseAdmin
            .from("caso_alertas" as never)
            .select("id, dias_estancado")
            .eq("expediente_id", e.id)
            .eq("leida", false)
            .order("created_at", { ascending: false })
            .limit(1);
          const ultima = (prev as unknown as { id: string; dias_estancado: number }[] | null)?.[0];
          if (ultima && ultima.dias_estancado >= dias) continue;

          await supabaseAdmin.from("caso_alertas" as never).insert([{
            expediente_id: e.id,
            tipo: `estancado_${e.estado_caso}`,
            dias_estancado: dias,
            leida: false,
          }] as never);
          creadas++;

          // Fase 4 — Fan-out a notificaciones_usuario para Gerencia + asesor responsable
          try {
            const severidad: "alta" | "media" = dias >= umbral * 2 ? "alta" : "media";
            const { data: exp } = await supabaseAdmin
              .from("expedientes" as never)
              .select("asesor_id, cliente_nombre")
              .eq("id", e.id)
              .single();
            const cliente = (exp as unknown as { cliente_nombre?: string })?.cliente_nombre ?? "Expediente";
            const asesorId = (exp as unknown as { asesor_id?: string })?.asesor_id ?? null;

            const { data: gerentes } = await supabaseAdmin
              .from("user_roles" as never)
              .select("user_id")
              .in("role", ["super_admin", "gerencia"]);
            const destinatarios = new Set<string>(
              ((gerentes ?? []) as Array<{ user_id: string }>).map((g) => g.user_id),
            );
            if (asesorId) destinatarios.add(asesorId);

            if (destinatarios.size > 0) {
              const payload = Array.from(destinatarios).map((uid) => ({
                user_id: uid,
                tipo: "caso_estancado",
                titulo: `Caso estancado: ${cliente}`,
                mensaje: `${dias} días en estado "${e.estado_caso}" (SLA ${umbral}d).`,
                link: `/casos/${e.id}`,
                severidad,
                metadata: { expediente_id: e.id, estado: e.estado_caso, dias },
              }));
              await supabaseAdmin.from("notificaciones_usuario" as never).insert(payload as never);
            }
          } catch { /* notificaciones no deben romper el cron */ }
        }

        return Response.json({ ok: true, creadas });

      },
    },
  },
});
