// Envío de correo a contratación vía Resend (a través del connector gateway de Lovable).
// Crea trazabilidad en `envios_contratacion`, actualiza estado del expediente
// y registra entrada en `expediente_historial`.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const AttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).max(120),
});

const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  asunto: z.string().min(1).max(500),
  cuerpo: z.string().min(1).max(20000),
  attachments: z.array(AttachmentSchema).min(1).max(10),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

export const enviarContratacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar acceso al expediente
    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, estado, asesor_id")
      .eq("id", data.expedienteId)
      .single();
    if (expErr || !exp) throw new Error("Expediente no encontrado o sin acceso.");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no está configurado.");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no está configurado. Conecta Resend.");

    const fromAddress = process.env.CONTRATACION_FROM_EMAIL || "NUVEX <onboarding@resend.dev>";

    // Llamar a Resend
    const resp = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: data.destinatarios,
        subject: data.asunto,
        text: data.cuerpo,
        html: await wrapNuvexEmail({ subject: data.asunto, bodyText: data.cuerpo }),
        attachments: data.attachments.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
        })),
      }),
    });

    const body = await resp.json().catch(() => ({}));
    const docsMeta = data.attachments.map((a) => ({
      name: a.filename,
      type: a.contentType,
      // tamaño aprox a partir del base64
      size: Math.floor(a.contentBase64.length * 3 / 4),
    }));

    if (!resp.ok) {
      const msg = `Resend [${resp.status}]: ${JSON.stringify(body)}`;
      await supabase.from("envios_contratacion").insert({
        expediente_id: data.expedienteId,
        user_id: userId,
        destinatarios: data.destinatarios,
        asunto: data.asunto,
        documentos: docsMeta,
        estado_envio: "error",
        error: msg.slice(0, 2000),
      });
      throw new Error(`No se pudo enviar el correo. ${msg.slice(0, 500)}`);
    }

    const messageId = (body && typeof body === "object" && "id" in body) ? String((body as Record<string, unknown>).id) : null;

    // Trazabilidad
    await supabase.from("envios_contratacion").insert({
      expediente_id: data.expedienteId,
      user_id: userId,
      destinatarios: data.destinatarios,
      asunto: data.asunto,
      documentos: docsMeta,
      estado_envio: "enviado",
      proveedor_message_id: messageId,
    });

    // Actualizar estado del expediente
    const estadoAnterior = exp.estado as string;
    if (estadoAnterior !== "ENVIADO_CONTRATACION") {
      await supabase
        .from("expedientes")
        .update({ estado: "ENVIADO_CONTRATACION" })
        .eq("id", data.expedienteId);

      await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        estado_anterior: estadoAnterior as never,
        estado_nuevo: "ENVIADO_CONTRATACION" as never,
        user_id: userId,
        nota: `Documentación enviada a contratación (${data.destinatarios.join(", ")})`,
      });
    } else {
      await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        estado_anterior: estadoAnterior as never,
        estado_nuevo: "ENVIADO_CONTRATACION" as never,
        user_id: userId,
        nota: `Reenvío a contratación (${data.destinatarios.join(", ")})`,
      });
    }

    return { ok: true, messageId };
  });
