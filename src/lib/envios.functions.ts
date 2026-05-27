// Envío genérico de documentos del expediente al cliente por correo (Resend vía Lovable gateway).
// Tipos soportados: propuesta_comercial, informe_final, cuenta_cobro_cliente.
// Personaliza From y Reply-To con el asesor responsable del caso.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  tipo: z.enum(["propuesta_comercial", "informe_final", "cuenta_cobro_cliente"]),
  destinatarios: z.array(z.string().email()).min(1).max(10),
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).max(120).default("application/pdf"),
  // overrides opcionales
  bancoOverride: z.string().max(120).optional(),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

function money(n: number | null | undefined): string {
  const v = typeof n === "number" && isFinite(n) ? n : 0;
  return "$" + v.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

function buildAsuntoYCuerpo(
  tipo: "propuesta_comercial" | "informe_final" | "cuenta_cobro_cliente",
  ctx: { cliente: string; banco: string; asesor: string; ahorro?: number | null },
): { asunto: string; cuerpo: string } {
  const banco = ctx.banco || "su entidad financiera";
  const close = `\n\nQuedamos atentos a cualquier inquietud.\n\nCordialmente,\n${ctx.asesor || "Equipo NUVEX"}\nNUVEX — Finanzas Inteligentes`;

  switch (tipo) {
    case "propuesta_comercial":
      return {
        asunto: `${ctx.cliente} - Propuesta comercial Optimización (${banco})`,
        cuerpo:
          `Estimado(a) ${ctx.cliente},\n\n` +
          `Reciba un cordial saludo. Adjuntamos la propuesta comercial de optimización ` +
          `para su crédito con ${banco}, elaborada por el equipo NUVEX a partir del análisis ` +
          `detallado de su situación financiera actual.\n\n` +
          `En el documento encontrará el escenario propuesto, el ahorro proyectado y los ` +
          `honorarios aplicables. Estaremos a su disposición para resolver cualquier duda y ` +
          `acompañarle en el siguiente paso del proceso.${close}`,
      };
    case "informe_final":
      return {
        asunto: `Informe Final - ${ctx.cliente} y ${banco}`,
        cuerpo:
          `Estimado(a) ${ctx.cliente},\n\n` +
          `¡Felicitaciones! Es para nosotros una gran satisfacción comunicarle que el proceso ` +
          `de optimización adelantado con ${banco} ha culminado exitosamente` +
          (ctx.ahorro && ctx.ahorro > 0
            ? `, generando un ahorro total de ${money(ctx.ahorro)}.`
            : `.`) +
          `\n\nAdjuntamos el Informe Final con el detalle de los resultados obtenidos, ` +
          `las condiciones aprobadas y el comparativo del escenario original frente al optimizado.\n\n` +
          `Agradecemos profundamente la confianza depositada en NUVEX y celebramos junto a usted ` +
          `esta decisión financiera acertada.${close}`,
      };
    case "cuenta_cobro_cliente":
      return {
        asunto: `Cuenta de cobro - ${ctx.cliente} - Optimización ${banco}`,
        cuerpo:
          `Estimado(a) ${ctx.cliente},\n\n` +
          `Antes que nada, queremos agradecerle la confianza depositada en NUVEX para acompañarle ` +
          `en este proceso. Nuevamente le felicitamos por el ahorro obtenido con la optimización ` +
          `adelantada con ${banco}` +
          (ctx.ahorro && ctx.ahorro > 0 ? ` (${money(ctx.ahorro)})` : ``) +
          `, un resultado que refleja una decisión financiera muy acertada.\n\n` +
          `Adjuntamos la cuenta de cobro correspondiente a los honorarios pactados por este ` +
          `proceso. Quedamos atentos a confirmar el pago y a continuar acompañándole.${close}`,
      };
  }
}

export const enviarDocumentoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, banco, asesor_id, propuesta_data, aprobado_data")
      .eq("id", data.expedienteId)
      .single();
    if (expErr || !exp) throw new Error("Expediente no encontrado o sin acceso.");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no está configurado.");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no está configurado. Conecta Resend.");

    const asesorId = (exp as { asesor_id: string | null }).asesor_id ?? userId;
    const { data: asesor } = await supabase
      .from("profiles")
      .select("nombre, email, correo_corporativo")
      .eq("id", asesorId)
      .maybeSingle();

    const sanitizeName = (s: string) =>
      s.replace(/[\r\n"<>]/g, "").trim().slice(0, 80);
    const asesorNombre = asesor?.nombre ? sanitizeName(asesor.nombre) : "NUVEX";
    const asesorEmail = (asesor?.correo_corporativo || asesor?.email || "").trim();

    const SENDER_ADDRESS =
      process.env.CONTRATACION_FROM_EMAIL || "notificaciones@mail.nuvex.com.co";
    const fromAddress = `${asesorNombre} (NUVEX) <${SENDER_ADDRESS}>`;
    const replyTo = asesorEmail || SENDER_ADDRESS;

    const banco = data.bancoOverride || (exp as { banco: string | null }).banco || "";
    // Ahorro estimado para los cuerpos
    const propuesta = (exp as { propuesta_data: Record<string, unknown> | null }).propuesta_data ?? {};
    const aprobado = (exp as { aprobado_data: Record<string, unknown> | null }).aprobado_data ?? {};
    const ahorro = Number(
      (aprobado as { ahorroTotal?: unknown }).ahorroTotal ??
        (propuesta as { ahorroTotal?: unknown }).ahorroTotal ??
        0,
    );

    const { asunto, cuerpo } = buildAsuntoYCuerpo(data.tipo, {
      cliente: exp.cliente_nombre,
      banco,
      asesor: asesorNombre,
      ahorro: isFinite(ahorro) && ahorro > 0 ? ahorro : null,
    });

    const resp = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: data.destinatarios,
        reply_to: replyTo,
        subject: asunto,
        text: cuerpo,
        html: await wrapNuvexEmail({ subject: asunto, bodyText: cuerpo }),
        attachments: [
          {
            filename: data.filename,
            content: data.contentBase64,
          },
        ],
      }),
    });

    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = `Resend [${resp.status}]: ${JSON.stringify(body).slice(0, 400)}`;
      await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        user_id: userId,
        nota: `❌ Falló envío de ${data.tipo} a ${data.destinatarios.join(", ")}: ${msg}`,
      });
      throw new Error(`No se pudo enviar el correo. ${msg}`);
    }

    const messageId =
      body && typeof body === "object" && "id" in body
        ? String((body as Record<string, unknown>).id)
        : null;

    await supabase.from("expediente_historial").insert({
      expediente_id: data.expedienteId,
      user_id: userId,
      nota: `📧 ${data.tipo.replace(/_/g, " ")} enviado a ${data.destinatarios.join(", ")} (asunto: "${asunto}")`,
    });

    return { ok: true, messageId, asunto };
  });
