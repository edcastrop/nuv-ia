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

// Nota: el Poder Especial y la Ficha Contractual viajan ahora a contratación
// en formato PDF con el branding NUVEX (mismo PDF que descarga el botón azul).
// Las versiones .docx quedan deprecadas para el envío a contratación.

export const enviarContratacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verificar acceso al expediente
    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, estado, asesor_id, credito_data, cliente_data")
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

    // El navegador arma el paquete, pero el servidor lo completa defensivamente
    // desde el expediente: si el soporte existe en almacenamiento/base de datos,
    // debe viajar aunque el cliente no lo haya adjuntado por caché/RLS/UI.
    const allowedAttachments = [...data.attachments];
    const attachmentHas = (pattern: RegExp) =>
      allowedAttachments.some((a) => pattern.test(a.filename.toLowerCase()));
    const uniqueFilename = (filename: string) => {
      const clean = filename.replace(/[\r\n"<>]/g, "_").trim().slice(0, 180) || "soporte.pdf";
      const lowerNames = new Set(allowedAttachments.map((a) => a.filename.toLowerCase()));
      if (!lowerNames.has(clean.toLowerCase())) return clean;
      const dot = clean.lastIndexOf(".");
      const base = dot > 0 ? clean.slice(0, dot) : clean;
      const ext = dot > 0 ? clean.slice(dot) : "";
      for (let i = 2; i <= 20; i += 1) {
        const candidate = `${base}_${i}${ext}`;
        if (!lowerNames.has(candidate.toLowerCase())) return candidate;
      }
      return `${base}_${Date.now()}${ext}`;
    };
    const fileNameFromPath = (path: string, fallback: string) => {
      const raw = path.split("/").pop() || fallback;
      try { return decodeURIComponent(raw); } catch { return raw; }
    };
    const normalizePath = (value: unknown) =>
      typeof value === "string" && value.trim() ? value.trim() : null;

    const ensureStoredSupport = async (kind: "cedula" | "extracto") => {
      const alreadyPresent = kind === "cedula"
        ? attachmentHas(/cedula|cédula|identidad/)
        : attachmentHas(/extracto/);
      if (alreadyPresent) return;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const candidates: Array<{
        bucket: "soportes-banco" | "extractos";
        path: string;
        filename: string;
        contentType?: string | null;
      }> = [];
      const seenPaths = new Set<string>();
      const addCandidate = (candidate: typeof candidates[number]) => {
        const path = normalizePath(candidate.path);
        if (!path) return;
        const key = `${candidate.bucket}:${path}`;
        if (seenPaths.has(key)) return;
        seenPaths.add(key);
        candidates.push({ ...candidate, path });
      };

      const { data: soportes } = await supabaseAdmin
        .from("expediente_soportes")
        .select("categoria, subcategoria, archivo_nombre, archivo_path, mime_type, created_at")
        .eq("expediente_id", data.expedienteId)
        .order("created_at", { ascending: true });

      for (const soporte of (soportes ?? []) as Array<{
        categoria: string | null;
        subcategoria: string | null;
        archivo_nombre: string | null;
        archivo_path: string | null;
        mime_type: string | null;
      }>) {
        const raw = `${soporte.categoria ?? ""} ${soporte.subcategoria ?? ""} ${soporte.archivo_nombre ?? ""}`.toLowerCase();
        const isExtracto = raw.includes("extracto");
        const isCedula = raw.includes("identidad") || raw.includes("cedula") || raw.includes("cédula");
        if ((kind === "extracto" && !isExtracto) || (kind === "cedula" && !isCedula)) continue;
        const bucket = isExtracto ? "extractos" : "soportes-banco";
        addCandidate({
          bucket,
          path: soporte.archivo_path ?? "",
          filename: soporte.archivo_nombre || fileNameFromPath(soporte.archivo_path ?? "", kind === "extracto" ? "extracto.pdf" : "cedula.pdf"),
          contentType: soporte.mime_type,
        });
      }

      if (kind === "extracto") {
        const credito = ((exp as { credito_data?: unknown }).credito_data ?? {}) as Record<string, unknown>;
        const cliente = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
        for (const path of [credito.archivoPath, cliente.extractoArchivoPath, cliente.archivoPath]) {
          const clean = normalizePath(path);
          if (clean) {
            addCandidate({
              bucket: "extractos",
              path: clean,
              filename: fileNameFromPath(clean, "extracto.pdf"),
              contentType: clean.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
            });
          }
        }
        const { data: lecturas } = await supabaseAdmin
          .from("extractos_lecturas")
          .select("archivo_nombre, archivo_path, created_at")
          .eq("expediente_id", data.expedienteId)
          .not("archivo_path", "is", null)
          .order("created_at", { ascending: false })
          .limit(5);
        for (const lectura of (lecturas ?? []) as Array<{ archivo_nombre: string | null; archivo_path: string | null }>) {
          const clean = normalizePath(lectura.archivo_path);
          if (clean) {
            addCandidate({
              bucket: "extractos",
              path: clean,
              filename: lectura.archivo_nombre || fileNameFromPath(clean, "extracto.pdf"),
              contentType: clean.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
            });
          }
        }
      }

      for (const candidate of candidates) {
        const { data: signed, error: signError } = await supabaseAdmin.storage
          .from(candidate.bucket)
          .createSignedUrl(candidate.path, 300);
        if (signError || !signed?.signedUrl) continue;
        const resp = await fetch(signed.signedUrl);
        if (!resp.ok) continue;
        const arrayBuffer = await resp.arrayBuffer();
        const { Buffer } = await import("buffer");
        const prefix = kind === "extracto" ? "Extracto_Credito" : "Cedula_Cliente";
        allowedAttachments.push({
          filename: uniqueFilename(`${prefix}_${candidate.filename}`),
          contentType: candidate.contentType || resp.headers.get("content-type") || "application/octet-stream",
          contentBase64: Buffer.from(arrayBuffer).toString("base64"),
        });
        return;
      }
    };

    await ensureStoredSupport("cedula");
    await ensureStoredSupport("extracto");

    if (allowedAttachments.length === 0) {
      throw new Error("El paquete de contratación no contiene adjuntos válidos.");
    }
    const attachmentNames = allowedAttachments.map((a) => a.filename.toLowerCase()).join("\n");
    if (!/(cedula|cédula|identidad)/.test(attachmentNames) || !/extracto/.test(attachmentNames)) {
      throw new Error("El paquete de contratación debe incluir cédula del cliente y extracto bancario.");
    }

    // Llamar a Resend
    const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";
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
