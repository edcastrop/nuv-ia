// Envío de correo a contratación vía Resend (a través del connector gateway de Lovable).
//
// HARDENING (revisión auditor):
// - Server-only (`createServerFn` + `requireSupabaseAuth`): sesión validada.
// - RLS del expediente valida ownership/rol (asesor / admin / gerencia); un
//   fetch fallido de expedientes bloquea con `[expediente]`.
// - Rechaza campos privilegiados enviados desde el navegador: no acepta
//   `proveedor_message_id`, `estado_envio`, `estado`, rutas de storage, ni
//   `idempotencyKey` reusado (el schema exige UUID válido; la BD dedupa).
// - Destinatarios: se fuerza `contabilidad@nuvex.com.co` y se filtra por la
//   lista blanca activa de `contratacion_destinatarios`. Los rechazados no
//   se envían aunque el cliente los solicite.
// - Storage paths NO se aceptan desde el cliente; siempre se derivan de
//   `expediente_soportes` filtrado por `expediente_id`.
// - Transiciones de estado de `envios_contratacion` vía `supabaseAdmin`
//   (la tabla no expone política UPDATE). NO se usa `supabaseAdmin` para
//   determinar autorización — eso lo hace `requireSupabaseAuth` + RLS.
//
// GARANTÍA DE TRAZABILIDAD:
// La fila `preparando` se crea INMEDIATAMENTE después de validar la
// identificación mínima (expedienteId + idempotencyKey + acceso al
// expediente). CUALQUIER otro rechazo posterior (límite de adjuntos,
// paquete incompleto, inconsistencia cotitular, error Resend) queda como
// `estado_envio='error'` con fase y motivo. Auditoría siempre ve el intento.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";
import {
  CONTRATACION_ATTACHMENT_MAX,
  CONTRATACION_CORREO_OBLIGATORIO,
  computeCedulasRequeridas,
  detectAttachmentLimitViolation,
  detectCotitularInconsistencies,
  enforceDestinatariosServer,
  resolveCotitularesFromClienteData,
  type SoporteRow,
} from "@/lib/contratacionValidacion";

const AttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  contentBase64: z.string().min(1),
  contentType: z.string().min(1).max(120),
});

// Schema BASE: valida SOLO identificación + payload textual. NO valida cota
// superior de adjuntos (esa se hace después de crear la fila `preparando`
// para dejar rastro en Auditoría). Sí exige al menos 1 adjunto para no
// permitir un ping vacío.
const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  idempotencyKey: z.string().uuid({
    message: "Falta idempotencyKey (protección contra envíos duplicados).",
  }),
  destinatarios: z.array(z.string().email()).min(1),
  asunto: z.string().min(1).max(500),
  cuerpo: z.string().min(1).max(20000),
  attachments: z.array(AttachmentSchema).min(1),
});

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

export const enviarContratacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ─────────────────────────────────────────────────────────────────────────
    // FASE PRE-0 — Autorización: RLS-friendly fetch del expediente.
    // Si falla, NO hay fila preparando aún (por diseño): no se puede crear
    // trazabilidad sin identificar el expediente ni tener permiso sobre él.
    // ─────────────────────────────────────────────────────────────────────────
    const { data: exp, error: expErr } = await supabase
      .from("expedientes")
      .select("id, cliente_nombre, estado, asesor_id, credito_data, cliente_data")
      .eq("id", data.expedienteId)
      .single();
    if (expErr || !exp) {
      throw new Error(
        "Expediente no encontrado o sin permiso para enviar a Contratación.",
      );
    }

    // Admin client (bypass RLS) SOLO para escrituras de trazabilidad y lecturas
    // de storage/soportes filtradas por expediente_id. Nunca para autorización.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 0 — Registro del intento (garantiza que Auditoría lo vea).
    // ─────────────────────────────────────────────────────────────────────────
    const intentoDocs = data.attachments.map((a) => ({
      name: a.filename,
      type: a.contentType,
      size: Math.floor((a.contentBase64.length * 3) / 4),
    }));

    let intentoId: string | null = null;
    {
      const { data: inserted, error: insertErr } = await supabase
        .from("envios_contratacion")
        .insert({
          expediente_id: data.expedienteId,
          user_id: userId,
          destinatarios: data.destinatarios,
          asunto: data.asunto,
          documentos: intentoDocs,
          estado_envio: "preparando",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          idempotency_key: data.idempotencyKey as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .select("id")
        .single();

      if (insertErr) {
        const code = (insertErr as { code?: string }).code;
        const msg = insertErr.message || "";
        if (code === "23505" || /duplicate key|unique/i.test(msg)) {
          const { data: prev } = await supabaseAdmin
            .from("envios_contratacion")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .select("id, estado_envio, proveedor_message_id, error")
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .eq("idempotency_key" as any, data.idempotencyKey as any)
            .maybeSingle();
          if (prev) {
            const estado = (prev as { estado_envio: string }).estado_envio;
            const messageId = (prev as { proveedor_message_id: string | null }).proveedor_message_id;
            if (estado === "enviado") return { ok: true, messageId, warning: null, deduped: true } as const;
            if (estado === "enviado_trazabilidad_parcial") return { ok: true, messageId, warning: "trazabilidad_parcial" as const, deduped: true };
            if (estado === "preparando") {
              throw new Error("Este envío ya está en curso. Espera a que finalice antes de reintentar.");
            }
            throw new Error("Este intento ya se registró como fallido. Cierra el modal y vuelve a abrirlo para reintentar (se generará un nuevo identificador).");
          }
          throw new Error("Ya hay un envío a Contratación en curso para este expediente. Espera a que termine antes de intentar nuevamente.");
        }
        throw new Error("No se pudo registrar el intento de envío. Reintenta o contacta a soporte.");
      }
      intentoId = (inserted as { id: string }).id;
    }

    const markError = async (fase: string, msg: string) => {
      if (!intentoId) return;
      const clean = `[${fase}] ${msg}`.slice(0, 2000);
      const { error: updErr } = await supabaseAdmin
        .from("envios_contratacion")
        .update({ estado_envio: "error", error: clean })
        .eq("id", intentoId);
      if (updErr) console.error("[contratacion] markError update failed", intentoId, updErr.message);
    };

    try {
      // ───────────────────────────────────────────────────────────────────────
      // FASE 1 — Límite de adjuntos (con trazabilidad garantizada).
      // ───────────────────────────────────────────────────────────────────────
      const limitViolation = detectAttachmentLimitViolation(data.attachments.length, CONTRATACION_ATTACHMENT_MAX);
      if (limitViolation) {
        await markError("validacion", limitViolation);
        throw new Error(limitViolation);
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 2 — Credenciales
      // ───────────────────────────────────────────────────────────────────────
      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (!LOVABLE_API_KEY) { await markError("credenciales", "LOVABLE_API_KEY no configurado"); throw new Error("LOVABLE_API_KEY no está configurado."); }
      if (!RESEND_API_KEY) { await markError("credenciales", "RESEND_API_KEY no configurado"); throw new Error("RESEND_API_KEY no está configurado. Conecta Resend."); }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 3 — Asesor + remitente + destinatarios (filtrados en servidor)
      // ───────────────────────────────────────────────────────────────────────
      const asesorId = (exp as { asesor_id: string | null }).asesor_id ?? userId;
      const { data: asesor } = await supabase
        .from("profiles")
        .select("nombre, email, correo_corporativo")
        .eq("id", asesorId)
        .maybeSingle();

      const sanitizeName = (s: string) => s.replace(/[\r\n"<>]/g, "").trim().slice(0, 80);
      const asesorNombre = asesor?.nombre ? sanitizeName(asesor.nombre) : "NUVEX";
      const asesorEmail = (asesor?.correo_corporativo || asesor?.email || "").trim();

      const SENDER_ADDRESS = process.env.CONTRATACION_FROM_EMAIL || "notificaciones@mail.nuvex.com.co";
      const fromAddress = `${asesorNombre} (NUVEX) <${SENDER_ADDRESS}>`;
      const replyTo = asesorEmail || SENDER_ADDRESS;

      // Lista blanca de destinatarios (server-side; no confiamos en el cliente).
      const { data: destActivos } = await supabaseAdmin
        .from("contratacion_destinatarios")
        .select("email, activo")
        .eq("activo", true);
      const activosLista = (destActivos ?? []).map((r) => (r as { email: string }).email);
      const { finales: destinatariosFinales, rechazados } = enforceDestinatariosServer(
        data.destinatarios,
        activosLista,
      );
      if (rechazados.length > 0) {
        console.warn("[contratacion] destinatarios rechazados (no activos)", { intentoId, rechazados });
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 4 — Consistencia cotitular + ensamblado por subcategoría
      // ───────────────────────────────────────────────────────────────────────
      const clienteData = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
      const cotitularesActivos = normalizarCotitularesActivos(clienteData.cotitulares);
      const cedulasRequeridas = computeCedulasRequeridas(cotitularesActivos);

      const { data: soportesRows, error: soportesErr } = await supabaseAdmin
        .from("expediente_soportes")
        .select("id, categoria, subcategoria, archivo_nombre, archivo_path, mime_type, created_at")
        .eq("expediente_id", data.expedienteId)
        .in("categoria", ["identidad", "extracto_banco"])
        .order("created_at", { ascending: false });
      if (soportesErr) {
        await markError("storage", `no se pudieron leer soportes: ${soportesErr.message}`);
        throw new Error("No se pudieron leer los soportes del expediente.");
      }
      const soportes = (soportesRows ?? []) as SoporteRow[];

      // Consistencia: cédula cotitular_n sin cotitular en cliente_data → BLOQUEA.
      const inconsistencias = detectCotitularInconsistencies(soportes, cotitularesActivos);
      if (inconsistencias.length > 0) {
        const msg = inconsistencias.join(" | ");
        await markError("validacion", msg);
        throw new Error(msg);
      }

      // Ensamblado atado a expediente_id (source of truth = expediente_soportes).
      const allowedAttachments = [...data.attachments];
      const uniqueFilename = (filename: string) => {
        const clean = filename.replace(/[\r\n"<>]/g, "_").trim().slice(0, 180) || "soporte.pdf";
        const lower = new Set(allowedAttachments.map((a) => a.filename.toLowerCase()));
        if (!lower.has(clean.toLowerCase())) return clean;
        const dot = clean.lastIndexOf(".");
        const base = dot > 0 ? clean.slice(0, dot) : clean;
        const ext = dot > 0 ? clean.slice(dot) : "";
        for (let i = 2; i <= 20; i += 1) {
          const cand = `${base}_${i}${ext}`;
          if (!lower.has(cand.toLowerCase())) return cand;
        }
        return `${base}_${Date.now()}${ext}`;
      };

      const downloadAndAppend = async (
        s: SoporteRow,
        bucket: "soportes-banco" | "extractos",
        namePrefix: string,
      ) => {
        if (!s.archivo_path) return false;
        const { data: signed, error: signErr } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(s.archivo_path, 300);
        if (signErr || !signed?.signedUrl) return false;
        const resp = await fetch(signed.signedUrl);
        if (!resp.ok) return false;
        const arr = await resp.arrayBuffer();
        const { Buffer } = await import("buffer");
        const base = s.archivo_nombre || s.archivo_path.split("/").pop() || "documento.pdf";
        allowedAttachments.push({
          filename: uniqueFilename(`${namePrefix}__${base}`),
          contentType: s.mime_type || resp.headers.get("content-type") || "application/octet-stream",
          contentBase64: Buffer.from(arr).toString("base64"),
        });
        return true;
      };

      // Retirar cédulas del cliente para evitar ambigüedad; regeneradas desde BD.
      const cedulaKw = /cedula|cédula|identidad/i;
      const nonIdent = allowedAttachments.filter((a) => !cedulaKw.test(a.filename));
      allowedAttachments.length = 0;
      allowedAttachments.push(...nonIdent);

      const faltantes: string[] = [];
      for (const sub of cedulasRequeridas) {
        const cand = soportes.filter((s) => s.categoria === "identidad" && s.subcategoria === sub && s.archivo_path);
        if (cand.length === 0) {
          const label = sub === "cedula_titular" ? "cédula del titular" : `cédula de cotitular ${sub.replace("cedula_cotitular_", "")}`;
          faltantes.push(label);
          continue;
        }
        const prefix = sub === "cedula_titular" ? "Cedula_Titular" : `Cedula_Cotitular_${sub.replace("cedula_cotitular_", "")}`;
        if (!(await downloadAndAppend(cand[0], "soportes-banco", prefix))) {
          faltantes.push(`archivo de ${sub.replace(/_/g, " ")} no accesible en storage`);
        }
      }

      // Extracto
      const extractoKw = /extracto/i;
      const yaExtracto = allowedAttachments.some((a) => extractoKw.test(a.filename));
      if (!yaExtracto) {
        let ok = false;
        const rows = soportes.filter((s) => s.categoria === "extracto_banco" && s.archivo_path);
        if (rows.length > 0) ok = await downloadAndAppend(rows[0], "extractos", "Extracto_Credito");
        if (!ok) {
          const credito = ((exp as { credito_data?: unknown }).credito_data ?? {}) as Record<string, unknown>;
          const cliente = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
          const paths = [credito.archivoPath, cliente.extractoArchivoPath, cliente.archivoPath]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
          for (const p of paths) {
            const fake: SoporteRow = { categoria: "extracto_banco", subcategoria: null, archivo_nombre: p.split("/").pop() || "extracto.pdf", archivo_path: p.trim(), mime_type: p.toLowerCase().endsWith(".pdf") ? "application/pdf" : null };
            if (await downloadAndAppend(fake, "extractos", "Extracto_Credito")) { ok = true; break; }
          }
          if (!ok) {
            const { data: lecturas } = await supabaseAdmin
              .from("extractos_lecturas")
              .select("archivo_nombre, archivo_path")
              .eq("expediente_id", data.expedienteId)
              .not("archivo_path", "is", null)
              .order("created_at", { ascending: false })
              .limit(3);
            for (const l of (lecturas ?? []) as Array<{ archivo_nombre: string | null; archivo_path: string | null }>) {
              if (!l.archivo_path) continue;
              const fake: SoporteRow = { categoria: "extracto_banco", subcategoria: null, archivo_nombre: l.archivo_nombre, archivo_path: l.archivo_path, mime_type: l.archivo_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : null };
              if (await downloadAndAppend(fake, "extractos", "Extracto_Credito")) { ok = true; break; }
            }
          }
        }
        if (!ok) faltantes.push("extracto bancario");
      }

      // Poder + Ficha (llegan del cliente)
      const nombres = allowedAttachments.map((a) => a.filename.toLowerCase());
      if (!nombres.some((n) => /poder/.test(n))) faltantes.push("poder especial");
      if (!nombres.some((n) => /ficha|datos.?contrato|contrato/.test(n))) faltantes.push("ficha de datos del contrato");

      if (faltantes.length > 0) {
        const msg = `Faltan: ${faltantes.join(", ")}`;
        await markError("validacion", msg);
        throw new Error(`No fue posible enviar el paquete. ${msg}. Carga los documentos pendientes y vuelve a intentarlo.`);
      }
      if (allowedAttachments.length === 0) {
        await markError("validacion", "paquete vacío");
        throw new Error("El paquete de contratación no contiene adjuntos válidos.");
      }

      // Re-verificar límite tras auto-inclusión de soportes.
      const finalLimit = detectAttachmentLimitViolation(allowedAttachments.length, CONTRATACION_ATTACHMENT_MAX);
      if (finalLimit) {
        await markError("validacion", `${finalLimit} (tras auto-inclusión de soportes)`);
        throw new Error(finalLimit);
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
            to: destinatariosFinales,
            reply_to: replyTo,
            subject: data.asunto,
            text: data.cuerpo,
            html: await wrapNuvexEmail({ subject: data.asunto, bodyText: data.cuerpo }),
            attachments: allowedAttachments.map((a) => ({ filename: a.filename, content: a.contentBase64 })),
          }),
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await markError("resend_red", msg);
        throw new Error("No fue posible contactar al proveedor de correo. El intento quedó registrado; puedes reintentarlo.");
      }

      const body = await resp.json().catch(() => ({}));
      const docsMeta = allowedAttachments.map((a) => ({
        name: a.filename, type: a.contentType, size: Math.floor((a.contentBase64.length * 3) / 4),
      }));

      if (!resp.ok) {
        const bodyStr = (() => { try { return JSON.stringify(body); } catch { return String(body); } })().slice(0, 500);
        const msg = `Resend [${resp.status}]: ${bodyStr}`;
        await supabaseAdmin
          .from("envios_contratacion")
          .update({ estado_envio: "error", error: `[resend] ${msg}`.slice(0, 2000), documentos: docsMeta, destinatarios: destinatariosFinales })
          .eq("id", intentoId);
        throw new Error(`No fue posible completar el envío. ${msg.slice(0, 300)}`);
      }

      const messageId = body && typeof body === "object" && "id" in body ? String((body as Record<string, unknown>).id) : null;

      // ───────────────────────────────────────────────────────────────────────
      // FASE 7 — Trazabilidad post-envío
      // ───────────────────────────────────────────────────────────────────────
      let trazabilidadOk = true;

      const { error: envUpErr } = await supabaseAdmin
        .from("envios_contratacion")
        .update({ estado_envio: "enviado", proveedor_message_id: messageId, documentos: docsMeta, destinatarios: destinatariosFinales, error: null })
        .eq("id", intentoId);
      if (envUpErr) { trazabilidadOk = false; console.error("[contratacion] update envio failed", { intentoId, err: envUpErr.message }); }

      const estadoAnterior = (exp as { estado: string }).estado;
      if (estadoAnterior !== "ENVIADO_CONTRATACION") {
        const { error: expUpErr } = await supabase.from("expedientes").update({ estado: "ENVIADO_CONTRATACION" }).eq("id", data.expedienteId);
        if (expUpErr) { trazabilidadOk = false; console.error("[contratacion] update expediente failed", { intentoId, err: expUpErr.message }); }
      }

      const { error: histErr } = await supabase.from("expediente_historial").insert({
        expediente_id: data.expedienteId,
        estado_anterior: estadoAnterior as never,
        estado_nuevo: "ENVIADO_CONTRATACION" as never,
        user_id: userId,
        nota: estadoAnterior === "ENVIADO_CONTRATACION"
          ? `Reenvío a contratación (${destinatariosFinales.join(", ")})`
          : `Documentación enviada a contratación (${destinatariosFinales.join(", ")})`,
      });
      if (histErr) { trazabilidadOk = false; console.error("[contratacion] historial failed", { intentoId, err: histErr.message }); }

      if (!trazabilidadOk) {
        await supabaseAdmin
          .from("envios_contratacion")
          .update({ estado_envio: "enviado_trazabilidad_parcial", proveedor_message_id: messageId, error: "[trazabilidad] correo enviado pero falló el registro interno" })
          .eq("id", intentoId);
        return { ok: true, messageId, warning: "trazabilidad_parcial" as const, deduped: false };
      }
      return { ok: true, messageId, warning: null, deduped: false };
    } catch (e) {
      try {
        if (intentoId) {
          await supabaseAdmin
            .from("envios_contratacion")
            .update({ estado_envio: "error", error: `[fatal] ${e instanceof Error ? e.message : String(e)}`.slice(0, 2000) })
            .eq("id", intentoId)
            .eq("estado_envio", "preparando");
        }
      } catch (finalErr) {
        console.error("[contratacion] fallback markError failed", intentoId, finalErr);
      }
      throw e;
    }
    // Referenciamos el correo obligatorio para asegurar que el símbolo está en uso.
    // (evita "declared but never used" si el import quedara aislado por refactors).
    void CONTRATACION_CORREO_OBLIGATORIO;
  });
