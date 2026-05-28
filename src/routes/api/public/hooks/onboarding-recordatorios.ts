// Cron diario que:
// 1) Llama a procesar_recordatorios_onboarding() para generar notificaciones in-app
//    y registrar correos pendientes (incluye alerta a super_admin a los 7 días).
// 2) Toma las notificaciones de correo no procesadas en onboarding_notif_log y las envía vía Resend.
// Idempotente: la función SQL deduplica por etapa+día.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "NUVEX Bienvenida <bienvenida@notify.sistema-nuvex.com>";
const APP_URL = "https://sistema-nuvex.lovable.app";

type EtapaCopy = { titulo: string; intro: string; cta: string; ctaPath: string };

function copyParaEtapa(etapa: string, nombre: string, dias?: number): EtapaCopy {
  const saludo = `Hola ${nombre},`;
  switch (etapa) {
    case "bienvenida":
      return {
        titulo: "Bienvenido a NUVEX",
        intro: `${saludo}\n\nHemos creado tu cuenta. Estamos revisando tu solicitud de acceso y te notificaremos en cuanto sea aprobada por nuestro equipo.\n\nMientras tanto, puedes ir conociendo la plataforma.`,
        cta: "Ver mi estado",
        ctaPath: "/pendiente-aprobacion",
      };
    case "aprobado":
      return {
        titulo: "¡Tu cuenta NUVEX fue aprobada!",
        intro: `${saludo}\n\nTu cuenta ya está activa. Para finalizar tu configuración debes:\n\n  1. Completar tu perfil (datos personales y contacto).\n  2. Activar la autenticación de doble factor (MFA).\n\nEsto es obligatorio y te protege contra accesos no autorizados.`,
        cta: "Continuar configuración",
        ctaPath: "/onboarding",
      };
    case "perfil_completado":
      return {
        titulo: "Perfil completo — falta un último paso",
        intro: `${saludo}\n\nExcelente, ya tenemos tus datos. Solo falta activar la autenticación de doble factor (MFA) en tu perfil para terminar.\n\nSin MFA no podrás acceder al resto de la plataforma.`,
        cta: "Activar MFA",
        ctaPath: "/mi-perfil",
      };
    case "mfa_activado":
      return {
        titulo: "Tu cuenta NUVEX está totalmente activa",
        intro: `${saludo}\n\nTu configuración está finalizada. Ya tienes acceso completo a la plataforma con autenticación de doble factor activa.\n\nBienvenido oficialmente al equipo.`,
        cta: "Ir al panel",
        ctaPath: "/",
      };
    case "recordatorio_diario": {
      const d = dias ?? 1;
      return {
        titulo: "Tu configuración NUVEX está pendiente",
        intro: `${saludo}\n\nNotamos que aún no has terminado de configurar tu cuenta (${d} día${d === 1 ? "" : "s"} sin completar).\n\nEs importante que la termines para acceder a todas las funcionalidades. Solo te toma unos minutos.`,
        cta: "Continuar ahora",
        ctaPath: "/onboarding",
      };
    }
    default:
      return {
        titulo: "Notificación NUVEX",
        intro: `${saludo}\n\nTienes una actualización en tu configuración.`,
        cta: "Abrir NUVEX",
        ctaPath: "/",
      };
  }
}

export const Route = createFileRoute("/api/public/hooks/onboarding-recordatorios")({
  server: {
    handlers: {
      POST: async () => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          return Response.json({ ok: false, error: "Missing email credentials" }, { status: 500 });
        }

        // 1) Generar recordatorios + alertas admin (idempotente por día)
        const { data: procesado, error: procErr } = await supabaseAdmin.rpc(
          "procesar_recordatorios_onboarding" as never,
        );
        if (procErr) {
          return Response.json({ ok: false, stage: "rpc", error: procErr.message }, { status: 500 });
        }

        // 2) Enviar correos pendientes (no procesados aún)
        const { data: pendientes, error: pendErr } = await supabaseAdmin
          .from("onboarding_notif_log" as never)
          .select("id, user_id, etapa, asunto, email_destino, metadata")
          .eq("canal", "email")
          .is("procesado_at", null)
          .order("enviado_at", { ascending: true })
          .limit(200);

        if (pendErr) {
          return Response.json({ ok: false, stage: "fetch", error: pendErr.message }, { status: 500 });
        }

        const list = (pendientes ?? []) as Array<{
          id: string; user_id: string; etapa: string;
          asunto: string | null; email_destino: string | null;
          metadata: Record<string, unknown>;
        }>;

        let enviados = 0, omitidos = 0, errores = 0;

        for (const n of list) {
          if (!n.email_destino) {
            await supabaseAdmin.from("onboarding_notif_log" as never)
              .update({ procesado_at: new Date().toISOString(), metadata: { ...n.metadata, error: "sin_email" } } as never)
              .eq("id", n.id);
            omitidos++;
            continue;
          }

          const nombre = (n.metadata?.nombre as string) || "colaborador";
          const dias = (n.metadata?.dias as number) || undefined;
          const c = copyParaEtapa(n.etapa, nombre, dias);
          const subject = n.asunto || c.titulo;
          const ctaUrl = `${APP_URL}${c.ctaPath}`;

          const text = `${c.intro}\n\n${c.cta}: ${ctaUrl}\n\n—\nEquipo NUVEX`;
          const html = await wrapNuvexEmail({
            subject,
            bodyText: `${c.intro}\n\n[${c.cta}](${ctaUrl})`,
          });

          try {
            const r = await fetch(`${RESEND_GATEWAY}/emails`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": RESEND_API_KEY,
              },
              body: JSON.stringify({ from: FROM, to: [n.email_destino], subject, text, html }),
            });
            const j = await r.json().catch(() => ({} as Record<string, unknown>));
            await supabaseAdmin.from("onboarding_notif_log" as never)
              .update({
                procesado_at: new Date().toISOString(),
                metadata: { ...n.metadata, resend_id: j.id ?? null, ok: r.ok, status: r.status },
              } as never)
              .eq("id", n.id);
            r.ok ? enviados++ : errores++;
          } catch (e) {
            errores++;
            await supabaseAdmin.from("onboarding_notif_log" as never)
              .update({
                procesado_at: new Date().toISOString(),
                metadata: { ...n.metadata, error: e instanceof Error ? e.message : "error" },
              } as never)
              .eq("id", n.id);
          }
        }

        return Response.json({
          ok: true,
          procesado,
          correos: { evaluados: list.length, enviados, omitidos, errores },
        });
      },
    },
  },
});
