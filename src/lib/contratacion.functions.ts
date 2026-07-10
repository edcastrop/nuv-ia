// Envío de correo a contratación vía Resend (a través del connector gateway de Lovable).
// Crea trazabilidad en `envios_contratacion` ANTES de cualquier validación/envío,
// para garantizar que TODO intento quede registrado (éxito o error).

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
  attachments: z.array(AttachmentSchema).min(1).max(10, {
    message:
      "Este paquete supera el límite permitido de 10 adjuntos. Reduce o consolida los archivos antes de enviar.",
  }),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

export const enviarContratacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 0 — Registrar el intento ANTES de todo (garantiza trazabilidad).
    // ─────────────────────────────────────────────────────────────────────────
    const intentoDocs = data.attachments.map((a) => ({
      name: a.filename,
      type: a.contentType,
      size: Math.floor((a.contentBase64.length * 3) / 4),
    }));
    const { data: intento, error: intentoErr } = await supabase
      .from("envios_contratacion")
      .insert({
        expediente_id: data.expedienteId,
        user_id: userId,
        destinatarios: data.destinatarios,
        asunto: data.asunto,
        documentos: intentoDocs,
        estado_envio: "preparando",
      })
      .select("id")
      .single();
    if (intentoErr || !intento) {
      throw new Error(
        "No se pudo registrar el intento de envío. Reintenta o contacta a soporte."
      );
    }
    const intentoId = intento.id as string;

    const markError = async (fase: string, msg: string) => {
      const clean = `[${fase}] ${msg}`.slice(0, 2000);
      const { error: updErr } = await supabase
        .from("envios_contratacion")
        .update({ estado_envio: "error", error: clean })
        .eq("id", intentoId);
      if (updErr) console.error("[contratacion] markError update failed", intentoId, updErr.message);
    };

    try {
      // ───────────────────────────────────────────────────────────────────────
      // FASE 1 — Expediente accesible
      // ───────────────────────────────────────────────────────────────────────
      const { data: exp, error: expErr } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, estado, asesor_id, credito_data, cliente_data")
        .eq("id", data.expedienteId)
        .single();
      if (expErr || !exp) {
        await markError("expediente", expErr?.message || "no accesible");
        throw new Error("Expediente no encontrado o sin acceso.");
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 2 — Credenciales
      // ───────────────────────────────────────────────────────────────────────
      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (!LOVABLE_API_KEY) {
        await markError("credenciales", "LOVABLE_API_KEY no configurado");
        throw new Error("LOVABLE_API_KEY no está configurado.");
      }
      if (!RESEND_API_KEY) {
        await markError("credenciales", "RESEND_API_KEY no configurado");
        throw new Error("RESEND_API_KEY no está configurado. Conecta Resend.");
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 3 — Asesor + remitente
      // ───────────────────────────────────────────────────────────────────────
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

      // ───────────────────────────────────────────────────────────────────────
      // FASE 4 — Ensamblado defensivo desde storage (cédula + extracto)
      // ───────────────────────────────────────────────────────────────────────
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

      try {
        await ensureStoredSupport("cedula");
        await ensureStoredSupport("extracto");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markError("storage", msg);
        throw new Error(`No se pudieron leer los soportes del expediente: ${msg.slice(0, 200)}`);
      }

      if (allowedAttachments.length === 0) {
        await markError("validacion", "paquete vacío");
        throw new Error("El paquete de contratación no contiene adjuntos válidos.");
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 5 — Validación completa del paquete (poder + ficha + cédula + extracto)
      // ───────────────────────────────────────────────────────────────────────
      const nombres = allowedAttachments.map((a) => a.filename.toLowerCase());
      const some = (re: RegExp) => nombres.some((n) => re.test(n));
      const faltantes: string[] = [];
      if (!some(/poder/)) faltantes.push("poder especial");
      if (!some(/ficha|datos.?contrato|contrato/)) faltantes.push("ficha de datos del contrato");
      if (!some(/cedula|cédula|identidad/)) faltantes.push("cédula del titular");
      if (!some(/extracto/)) faltantes.push("extracto bancario");

      // Cotitular activo: si el expediente registra cotitulares, exigir cédula(s) adicionales.
      const clienteData = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
      const cotitularesRaw = clienteData.cotitulares;
      const cotitulares = Array.isArray(cotitularesRaw)
        ? (cotitularesRaw as Array<Record<string, unknown>>).filter(
            (c) => c && (c.activo !== false) && (typeof c.nombre === "string" ? c.nombre.trim() : false),
          )
        : [];
      if (cotitulares.length > 0) {
        const cedulasCount = nombres.filter((n) => /cedula|cédula|identidad/.test(n)).length;
        const requeridas = 1 + cotitulares.length;
        if (cedulasCount < requeridas) {
          faltantes.push(`cédula(s) de cotitular(es) (${cedulasCount}/${requeridas})`);
        }
      }

      if (faltantes.length > 0) {
        const lista = faltantes.join(", ");
        await markError("validacion", `Faltan: ${lista}`);
        throw new Error(`No fue posible enviar el paquete. Faltan: ${lista}. Carga los documentos pendientes y vuelve a intentarlo.`);
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 6 — Envío a Resend
      // ───────────────────────────────────────────────────────────────────────
      let resp: Response;
      try {
        resp = await fetch(`${RESEND_GATEWAY}/emails`, {
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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markError("resend_red", msg);
        throw new Error("No fue posible contactar al proveedor de correo. El intento quedó registrado; puedes reintentarlo.");
      }

      const body = await resp.json().catch(() => ({}));
      const docsMeta = allowedAttachments.map((a) => ({
        name: a.filename,
        type: a.contentType,
        size: Math.floor((a.contentBase64.length * 3) / 4),
      }));

      if (!resp.ok) {
        const bodyStr = (() => { try { return JSON.stringify(body); } catch { return String(body); } })().slice(0, 500);
        const msg = `Resend [${resp.status}]: ${bodyStr}`;
        await supabase
          .from("envios_contratacion")
          .update({ estado_envio: "error", error: `[resend] ${msg}`.slice(0, 2000), documentos: docsMeta })
          .eq("id", intentoId);
        throw new Error(`No fue posible completar el envío. ${msg.slice(0, 300)}`);
      }

      const messageId =
        body && typeof body === "object" && "id" in body ? String((body as Record<string, unknown>).id) : null;

      // ───────────────────────────────────────────────────────────────────────
      // FASE 7 — Trazabilidad post-envío (correo YA salió)
      // ───────────────────────────────────────────────────────────────────────
      let trazabilidadOk = true;

      const { error: envUpErr } = await supabase
        .from("envios_contratacion")
        .update({
          estado_envio: "enviado",
          proveedor_message_id: messageId,
          documentos: docsMeta,
          error: null,
        })
        .eq("id", intentoId);
      if (envUpErr) {
        trazabilidadOk = false;
        console.error("[contratacion] update envio failed", { intentoId, messageId, err: envUpErr.message });
      }

      const estadoAnterior = (exp as { estado: string }).estado;
      if (estadoAnterior !== "ENVIADO_CONTRATACION") {
        const { error: expUpErr } = await supabase
          .from("expedientes")
          .update({ estado: "ENVIADO_CONTRATACION" })
          .eq("id", data.expedienteId);
        if (expUpErr) {
          trazabilidadOk = false;
          console.error("[contratacion] update expediente failed", { intentoId, messageId, err: expUpErr.message });
        }
      }

      const { error: histErr } = await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        estado_anterior: estadoAnterior as never,
        estado_nuevo: "ENVIADO_CONTRATACION" as never,
        user_id: userId,
        nota:
          estadoAnterior === "ENVIADO_CONTRATACION"
            ? `Reenvío a contratación (${data.destinatarios.join(", ")})`
            : `Documentación enviada a contratación (${data.destinatarios.join(", ")})`,
      });
      if (histErr) {
        trazabilidadOk = false;
        console.error("[contratacion] historial failed", { intentoId, messageId, err: histErr.message });
      }

      if (!trazabilidadOk) {
        await supabase
          .from("envios_contratacion")
          .update({
            estado_envio: "enviado_trazabilidad_parcial",
            proveedor_message_id: messageId,
            error: "[trazabilidad] correo enviado pero falló el registro interno",
          })
          .eq("id", intentoId);
        return { ok: true, messageId, warning: "trazabilidad_parcial" as const };
      }

      return { ok: true, messageId, warning: null };
    } catch (e) {
      // Seguro de último recurso: si el intento sigue en "preparando", marcarlo error.
      try {
        await supabase
          .from("envios_contratacion")
          .update({
            estado_envio: "error",
            error: `[fatal] ${e instanceof Error ? e.message : String(e)}`.slice(0, 2000),
          })
          .eq("id", intentoId)
          .eq("estado_envio", "preparando");
      } catch (finalErr) {
        console.error("[contratacion] fallback markError failed", intentoId, finalErr);
      }
      throw e;
    }
  });
