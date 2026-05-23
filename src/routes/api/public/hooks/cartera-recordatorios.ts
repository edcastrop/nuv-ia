// Cron diario que envía recordatorios automáticos de cartera NUVEX.
// Programado por pg_cron 09:00 hora Colombia.
// Idempotente: por cada cartera + tipo + día sólo se envía una vez.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const FROM = "NUVEX Cartera <cartera@notify.sistema-nuvex.com>";

function money(n: number) { return "$" + Math.round(n).toLocaleString("es-CO"); }

function asunto(tipo: string, cliente: string) {
  switch (tipo) {
    case "email_recordatorio": return `Recordatorio de Honorarios NUVEX - ${cliente}`;
    case "email_vencimiento": return `Vencimiento Honorarios NUVEX - ${cliente}`;
    case "email_mora_7": return `Honorarios Pendientes NUVEX - ${cliente}`;
    case "email_mora_15": return `Solicitud Formal de Pago - ${cliente}`;
    case "email_prejuridico": return `Aviso Prejurídico NUVEX - ${cliente}`;
    default: return `Honorarios NUVEX - ${cliente}`;
  }
}

function body(tipo: string, cliente: string, saldo: number, venc: string, banco: string | null): string {
  const close = `\n\nQuedamos atentos.\nEquipo NUVEX — Finanzas Inteligentes`;
  switch (tipo) {
    case "email_recordatorio":
      return `Estimado(a) ${cliente},\n\nRecordamos que el pago de honorarios NUVEX por ${money(saldo)} vence el ${venc}.${close}`;
    case "email_vencimiento":
      return `Estimado(a) ${cliente},\n\nLe informamos que hoy vence el pago de honorarios NUVEX por ${money(saldo)}.${close}`;
    case "email_mora_7":
      return `Estimado(a) ${cliente},\n\nSu obligación con NUVEX por ${money(saldo)} presenta 7 días de mora. Le solicitamos regularizar el pago.${close}`;
    case "email_mora_15":
      return `Estimado(a) ${cliente},\n\nMediante la presente realizamos solicitud formal de pago por ${money(saldo)}. Su obligación lleva 15 días de mora. De no realizarse el pago, su caso será remitido a cobro prejurídico.${close}`;
    case "email_prejuridico":
      return `Sr(a) ${cliente},\n\nDada la mora superior a 30 días${banco ? " en el proceso con " + banco : ""}, su caso ha sido trasladado al área prejurídica por valor de ${money(saldo)}.${close}`;
    default:
      return "";
  }
}

export const Route = createFileRoute("/api/public/hooks/cartera-recordatorios")({
  server: {
    handlers: {
      POST: async () => {
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          return Response.json({ ok: false, error: "Missing email credentials" }, { status: 500 });
        }

        const hoy = new Date();
        const yyyy = hoy.toISOString().slice(0, 10);

        const { data: carteras, error } = await supabaseAdmin
          .from("cartera" as never)
          .select("id, expediente_id, honorarios_totales, pagado, fecha_aplicacion_banco, fecha_vencimiento, estado_cartera")
          .not("estado_cartera", "in", '("pago_total","cerrado","prejuridico")');
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const lista = (carteras ?? []) as Array<{
          id: string; expediente_id: string; honorarios_totales: number; pagado: number;
          fecha_aplicacion_banco: string; fecha_vencimiento: string; estado_cartera: string;
        }>;

        let enviados = 0, omitidos = 0, errores = 0;

        for (const c of lista) {
          const saldo = Number(c.honorarios_totales) - Number(c.pagado);
          if (saldo <= 0) continue;

          const venc = new Date(c.fecha_vencimiento + "T00:00:00");
          const diff = Math.floor((hoy.getTime() - venc.getTime()) / 86400000);

          let tipo: string | null = null;
          if (diff === -3) tipo = "email_recordatorio";
          else if (diff === 0) tipo = "email_vencimiento";
          else if (diff === 7) tipo = "email_mora_7";
          else if (diff === 15) tipo = "email_mora_15";
          else if (diff === 30) tipo = "email_prejuridico";
          if (!tipo) continue;

          // Idempotencia diaria
          const { data: dup } = await supabaseAdmin
            .from("cartera_comunicaciones" as never)
            .select("id")
            .eq("cartera_id", c.id)
            .eq("tipo", tipo)
            .gte("created_at", `${yyyy}T00:00:00Z`)
            .limit(1);
          if (dup && dup.length > 0) { omitidos++; continue; }

          // Datos cliente
          const { data: exp } = await supabaseAdmin
            .from("expedientes")
            .select("cliente_nombre, banco, cliente_data")
            .eq("id", c.expediente_id)
            .maybeSingle();
          const cliente = (exp?.cliente_nombre as string) ?? "Cliente";
          const banco = (exp?.banco as string | null) ?? null;
          const cd = (exp?.cliente_data ?? {}) as Record<string, unknown>;
          const email = (cd.correo as string | undefined) || (cd.email as string | undefined) || null;
          if (!email) {
            await supabaseAdmin.from("cartera_comunicaciones" as never).insert({
              cartera_id: c.id, tipo, canal: "email", estado: "sin_destinatario",
              asunto: asunto(tipo, cliente), body: "Sin email de cliente.",
            } as never);
            omitidos++; continue;
          }

          const subject = asunto(tipo, cliente);
          const text = body(tipo, cliente, saldo, c.fecha_vencimiento, banco);

          try {
            const r = await fetch(`${RESEND_GATEWAY}/emails`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": RESEND_API_KEY,
              },
              body: JSON.stringify({ from: FROM, to: [email], subject, text, html: await wrapNuvexEmail({ subject, bodyText: text }) }),
            });
            const j = await r.json().catch(() => ({} as Record<string, unknown>));
            const ok = r.ok;
            await supabaseAdmin.from("cartera_comunicaciones" as never).insert({
              cartera_id: c.id, tipo, canal: "email",
              estado: ok ? "enviado_cron" : "error_cron",
              asunto: subject, destinatario: email, body: text,
              proveedor_msg_id: (j.id as string | undefined) ?? null,
            } as never);

            if (ok && tipo === "email_prejuridico") {
              await supabaseAdmin.from("cartera" as never).update({ estado_cartera: "prejuridico" } as never).eq("id", c.id);
              await supabaseAdmin.from("expedientes").update({ estado_caso: "prejuridico" as never }).eq("id", c.expediente_id);
            }

            ok ? enviados++ : errores++;
          } catch (e) {
            errores++;
            await supabaseAdmin.from("cartera_comunicaciones" as never).insert({
              cartera_id: c.id, tipo, canal: "email", estado: "error_cron",
              asunto: subject, destinatario: email,
              body: (e instanceof Error ? e.message : "error"),
            } as never);
          }
        }

        return Response.json({ ok: true, fecha: yyyy, evaluadas: lista.length, enviados, omitidos, errores });
      },
    },
  },
});
