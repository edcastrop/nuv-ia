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

function isForbiddenLegalPdf(filename: string, contentType: string) {
  const name = filename.toLowerCase();
  const isPdf = contentType.toLowerCase().includes("pdf") || name.endsWith(".pdf");
  return isPdf && (name.includes("poder") || name.includes("ficha"));
}

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

    // Obtener datos del asesor responsable del caso para personalizar el remitente
    // y configurar el Reply-To, de modo que las respuestas lleguen directamente a él.
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

    // Blindaje definitivo: contratación NO debe recibir versiones PDF del Poder
    // ni de la Ficha Contractual, aunque una pantalla vieja intente enviarlas.
    const allowedAttachments = data.attachments.filter(
      (a) => !isForbiddenLegalPdf(a.filename, a.contentType),
    );
    if (allowedAttachments.length === 0) {
      throw new Error("El paquete de contratación no contiene adjuntos válidos.");
    }
    const attachmentNames = allowedAttachments.map((a) => a.filename.toLowerCase()).join("\n");
    if (!/(cedula|cédula|identidad)/.test(attachmentNames) || !/extracto/.test(attachmentNames)) {
      throw new Error("El paquete de contratación debe incluir cédula del cliente y extracto bancario.");
    }

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
        reply_to: replyTo,
        subject: data.asunto,
        text: data.cuerpo,
        html: await wrapNuvexEmail({ subject: data.asunto, bodyText: data.cuerpo }),
        attachments: allowedAttachments.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
        })),
      }),
    });


    const body = await resp.json().catch(() => ({}));
    const docsMeta = allowedAttachments.map((a) => ({
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
