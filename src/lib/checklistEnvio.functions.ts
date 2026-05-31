// Envío de correo del Checklist Documental al cliente vía Resend (connector gateway).
// Mirror de contratacion.functions.ts: usa al asesor del expediente como remitente
// y reply-to, registra trazabilidad en expediente_checklist_envios, marca los
// documentos solicitados como "solicitado" e inserta entradas en auditoría.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const AttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).max(120),
});

const DocSolicitadoSchema = z.object({
  documento_id: z.string().min(1).max(100),
  documento_nombre: z.string().min(1).max(255),
});

const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  destinatarios: z.array(z.string().email()).min(1).max(20),
  cc: z.array(z.string().email()).max(20).default([]),
  asunto: z.string().min(1).max(500),
  cuerpo: z.string().min(1).max(20000),
  attachments: z.array(AttachmentSchema).max(10).default([]),
  documentosSolicitados: z.array(DocSolicitadoSchema).max(50).default([]),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

export const enviarChecklistCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar acceso al expediente
    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, estado, estado_caso, asesor_id")
      .eq("id", data.expedienteId)
      .single();
    if (expErr || !exp) throw new Error("Expediente no encontrado o sin acceso.");

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY no está configurado.");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY no está configurado. Conecta Resend.");

    // Asesor responsable del caso → remitente + reply-to
    const asesorId = (exp as { asesor_id: string | null }).asesor_id ?? userId;
    const { data: asesor } = await supabase
      .from("profiles")
      .select("nombre, email, correo_corporativo")
      .eq("id", asesorId)
      .maybeSingle();

    const sanitizeName = (s: string) => s.replace(/[\r\n"<>]/g, "").trim().slice(0, 80);
    const asesorNombre = asesor?.nombre ? sanitizeName(asesor.nombre) : "NUVEX";
    const asesorEmail = (asesor?.correo_corporativo || asesor?.email || "").trim();

    const SENDER_ADDRESS =
      process.env.CONTRATACION_FROM_EMAIL || "notificaciones@mail.nuvex.com.co";
    const fromAddress = `${asesorNombre} (NUVEX) <${SENDER_ADDRESS}>`;
    const replyTo = asesorEmail || SENDER_ADDRESS;

    // CC: incluir al asesor automáticamente si tiene email
    const ccFinal = Array.from(
      new Set([...(data.cc ?? []), ...(asesorEmail ? [asesorEmail] : [])].filter(Boolean)),
    ).filter((e) => !data.destinatarios.includes(e));

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
        cc: ccFinal.length ? ccFinal : undefined,
        reply_to: replyTo,
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
      size: Math.floor(a.contentBase64.length * 3 / 4),
    }));

    if (!resp.ok) {
      const msg = `Resend [${resp.status}]: ${JSON.stringify(body)}`;
      await supabase.from("expediente_checklist_envios").insert({
        expediente_id: data.expedienteId,
        enviado_a_email: data.destinatarios[0] ?? null,
        destinatarios: data.destinatarios,
        cc_emails: ccFinal,
        cc_licenciado_email: ccFinal[0] ?? null,
        asunto: data.asunto,
        cuerpo: data.cuerpo,
        documentos: docsMeta,
        documentos_solicitados: data.documentosSolicitados,
        estado_envio: "error",
        error: msg.slice(0, 2000),
        enviado_por: userId,
      } as never);
      throw new Error(`No se pudo enviar el correo. ${msg.slice(0, 500)}`);
    }

    const messageId =
      body && typeof body === "object" && "id" in body
        ? String((body as Record<string, unknown>).id)
        : null;

    // Registrar envío exitoso
    await supabase.from("expediente_checklist_envios").insert({
      expediente_id: data.expedienteId,
      enviado_a_email: data.destinatarios[0] ?? null,
      destinatarios: data.destinatarios,
      cc_emails: ccFinal,
      cc_licenciado_email: ccFinal[0] ?? null,
      asunto: data.asunto,
      cuerpo: data.cuerpo,
      documentos: docsMeta,
      documentos_solicitados: data.documentosSolicitados,
      estado_envio: "enviado",
      proveedor_message_id: messageId,
      enviado_por: userId,
    } as never);

    // Marcar documentos como "solicitado" (sólo los que aún estaban pendientes/rechazado/vencido)
    const ids = data.documentosSolicitados.map((d) => d.documento_id);
    if (ids.length) {
      const { data: existentes } = await supabase
        .from("expediente_checklist_documentos")
        .select("documento_id, estado, fecha_solicitado")
        .eq("expediente_id", data.expedienteId)
        .in("documento_id", ids);

      const existMap = new Map<string, { estado: string; fecha_solicitado: string | null }>();
      ((existentes ?? []) as Array<{ documento_id: string; estado: string; fecha_solicitado: string | null }>)
        .forEach((r) => existMap.set(r.documento_id, { estado: r.estado, fecha_solicitado: r.fecha_solicitado }));

      const ahora = new Date().toISOString();
      const auditPayload: Array<Record<string, unknown>> = [];

      for (const doc of data.documentosSolicitados) {
        const prev = existMap.get(doc.documento_id);
        const prevEstado = prev?.estado ?? "pendiente";
        // Sólo actualiza si está en estado que merece "solicitado"
        if (["pendiente", "rechazado", "vencido"].includes(prevEstado) || !prev) {
          await supabase.from("expediente_checklist_documentos").upsert(
            {
              expediente_id: data.expedienteId,
              documento_id: doc.documento_id,
              documento_nombre: doc.documento_nombre,
              obligatorio: true,
              estado: "solicitado",
              fecha_solicitado: prev?.fecha_solicitado ?? ahora,
              updated_by: userId,
            } as never,
            { onConflict: "expediente_id,documento_id" } as never,
          );
          auditPayload.push({
            expediente_id: data.expedienteId,
            documento_id: doc.documento_id,
            documento_nombre: doc.documento_nombre,
            estado_anterior: prevEstado,
            estado_nuevo: "solicitado",
            usuario_id: userId,
            usuario_nombre: asesorNombre,
          });
        }
      }

      if (auditPayload.length) {
        await supabase.from("expediente_checklist_auditoria").insert(auditPayload as never);
      }
    }

    // Trazar en historial general del expediente
    await supabase.from("expediente_historial").insert({
      expediente_id: data.expedienteId,
      estado_anterior: exp.estado as never,
      estado_nuevo: exp.estado as never,
      user_id: userId,
      nota: `Checklist enviado al cliente (${data.destinatarios.join(", ")}) — ${data.documentosSolicitados.length} documento(s) solicitado(s)`,
    } as never);

    return { ok: true, messageId, ccFinal };
  });
