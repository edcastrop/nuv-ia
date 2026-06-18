// Construye y envía la "Solicitud de Disminución de Plazo (Ley 546)" al
// correo de Jurídica de NUVEX (juridica@nuvex.com.co), adjuntando los
// soportes financieros que ya se cargaron en el módulo de capacidad de pago.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const AdjuntoSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(20).max(18_000_000),
  contentType: z.string().min(3).max(120).default("application/pdf"),
});

const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  plazoNuevoMeses: z.number().int().positive().max(360),
  cuotaProyectada: z.number().positive(),
  esVis: z.boolean().default(false),
  tipoPersona: z.enum(["empleado_mensual", "empleado_quincenal", "independiente", "empleado_mensual_independiente", "empleado_quincenal_independiente"]),
  // Lista corta de documentos enviados (nombres legibles, para listar en el cuerpo)
  documentos: z.array(z.string().min(1).max(200)).min(1).max(40),
  adjuntos: z.array(AdjuntoSchema).min(1).max(20),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
const JURIDICA_EMAIL = "juridica@nuvex.com.co";

function money(n: number): string {
  return "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
}

export const enviarSolicitudPlazoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, banco, asesor_id")
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

    const sanitize = (s: string) => s.replace(/[\r\n"<>]/g, "").trim().slice(0, 80);
    const asesorNombre = asesor?.nombre ? sanitize(asesor.nombre) : "NUVEX";
    const asesorEmail = (asesor?.correo_corporativo || asesor?.email || "").trim();
    const cliente = sanitize(exp.cliente_nombre || "Cliente");
    const banco = sanitize((exp as { banco: string | null }).banco || "Banco");

    const SENDER_ADDRESS =
      process.env.CONTRATACION_FROM_EMAIL || "notificaciones@mail.nuvex.com.co";
    const fromAddress = `${asesorNombre} (NUVEX) <${SENDER_ADDRESS}>`;
    const replyTo = asesorEmail || SENDER_ADDRESS;

    const asunto = `Documentación financiera - Caso ${cliente} ${banco} (${asesorNombre})`;

    const tipoTxt =
      data.tipoPersona === "independiente"
        ? "persona independiente"
        : data.tipoPersona === "empleado_quincenal"
        ? "empleado con pago quincenal"
        : data.tipoPersona === "empleado_mensual_independiente"
        ? "persona con ingreso mixto (empleado mensual + independiente)"
        : data.tipoPersona === "empleado_quincenal_independiente"
        ? "persona con ingreso mixto (empleado quincenal + independiente)"
        : "empleado con pago mensual";

    const listaDocs = data.documentos.map((d, i) => `  ${i + 1}. ${d}`).join("\n");

    const cuerpo =
      `Señores ${banco},\n` +
      `Atn. Área de Cartera Hipotecaria\n\n` +
      `Asunto: Solicitud de DISMINUCIÓN DE PLAZO del crédito hipotecario — Caso ${cliente}.\n\n` +
      `En nombre de nuestro cliente ${cliente}, y conforme a lo dispuesto en la Ley 546 ` +
      `de 1999 y la regulación complementaria, presentamos formal solicitud de ` +
      `disminución del plazo del crédito hipotecario referenciado, con las siguientes ` +
      `condiciones proyectadas:\n\n` +
      `• Nuevo plazo solicitado: ${data.plazoNuevoMeses} meses.\n` +
      `• Cuota mensual proyectada: ${money(data.cuotaProyectada)}.\n` +
      `• Tipo de crédito: ${data.esVis ? "VIS (límite 40% de ingresos)" : "No VIS (límite 30% de ingresos)"}.\n` +
      `• Tipo de ingresos del titular: ${tipoTxt}.\n\n` +
      `Adjuntamos la documentación financiera que sustenta la capacidad de pago del ` +
      `cliente bajo el nuevo escenario:\n\n` +
      `${listaDocs}\n\n` +
      `Agradecemos su gestión dentro de los términos legales y quedamos atentos a ` +
      `cualquier información adicional que se requiera para la radicación.\n\n` +
      `Cordialmente,\n\n` +
      `${asesorNombre}\n` +
      `Analista de Optimización Financiera — NUVEX Finanzas Inteligentes\n` +
      `${asesorEmail || ""}`;

    const resp = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [JURIDICA_EMAIL],
        cc: asesorEmail ? [asesorEmail] : undefined,
        reply_to: replyTo,
        subject: asunto,
        text: cuerpo,
        html: await wrapNuvexEmail({ subject: asunto, bodyText: cuerpo }),
        attachments: data.adjuntos.map((a) => ({
          filename: a.filename,
          content: a.contentBase64,
        })),
      }),
    });

    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = `Resend [${resp.status}]: ${JSON.stringify(body).slice(0, 400)}`;
      await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        user_id: userId,
        nota: `❌ Falló envío de solicitud de plazo a Jurídica: ${msg}`,
      });
      throw new Error(`No se pudo enviar la solicitud. ${msg}`);
    }

    await supabase.from("expediente_historial").insert({
      expediente_id: data.expedienteId,
      user_id: userId,
      nota:
        `📧 Solicitud de disminución de plazo enviada a Jurídica (${JURIDICA_EMAIL}). ` +
        `Nuevo plazo: ${data.plazoNuevoMeses} meses · Cuota: ${money(data.cuotaProyectada)} · ` +
        `${data.adjuntos.length} adjunto(s).`,
    });

    return { ok: true, asunto, destinatario: JURIDICA_EMAIL };
  });
