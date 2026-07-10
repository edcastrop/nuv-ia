// Envío de correo a contratación vía Resend (a través del connector gateway de Lovable).
//
// Garantías nuevas:
// 1) Idempotencia real: cada intento del cliente lleva un `idempotencyKey` UUID.
//    - Índice único parcial: no puede existir más de una fila "preparando" por
//      expediente → dos pestañas/usuarios/clics simultáneos → solo uno gana.
//    - Índice único sobre idempotency_key → reintentos con la MISMA clave no
//      duplican envíos: se retorna el resultado ya persistido.
// 2) Validación de cotitulares por `subcategoria`, no por regex de nombres.
//    Requiere una fila `cedula_titular` y una `cedula_cotitular_${n}` por cada
//    cotitular activo en `cliente_data.cotitulares`.
// 3) Transiciones de estado de `envios_contratacion` vía `supabaseAdmin`
//    (bypass RLS) porque la tabla carece de política UPDATE. No se altera RLS.

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
  idempotencyKey: z.string().uuid({
    message: "Falta idempotencyKey (protección contra envíos duplicados).",
  }),
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

    // Admin client para transiciones de estado (la tabla no tiene política UPDATE).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // ─────────────────────────────────────────────────────────────────────────
    // FASE 0 — Idempotencia + registro del intento (garantiza trazabilidad).
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
        // 23505 = unique_violation. Distinguimos las dos causas.
        const code = (insertErr as { code?: string }).code;
        const msg = insertErr.message || "";
        if (code === "23505" || /duplicate key|unique/i.test(msg)) {
          // (a) Mismo idempotencyKey → devolver el resultado previo (dedupe).
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
            if (estado === "enviado") {
              return { ok: true, messageId, warning: null, deduped: true } as const;
            }
            if (estado === "enviado_trazabilidad_parcial") {
              return { ok: true, messageId, warning: "trazabilidad_parcial" as const, deduped: true };
            }
            if (estado === "preparando") {
              throw new Error(
                "Este envío ya está en curso. Espera a que finalice antes de reintentar.",
              );
            }
            // estado=error → permitir reintento con NUEVA clave desde el cliente.
            throw new Error(
              "Este intento ya se registró como fallido. Cierra el modal y vuelve a abrirlo para reintentar (se generará un nuevo identificador).",
            );
          }
          // (b) Otro envío "preparando" para el mismo expediente.
          throw new Error(
            "Ya hay un envío a Contratación en curso para este expediente. Espera a que termine antes de intentar nuevamente.",
          );
        }
        throw new Error(
          "No se pudo registrar el intento de envío. Reintenta o contacta a soporte.",
        );
      }
      intentoId = (inserted as { id: string }).id;
    }

    const markError = async (fase: string, msg: string) => {
      if (!intentoId) return;
      const clean = `[${fase}] ${msg}`.slice(0, 2000);
      // Vía admin (RLS de esta tabla no permite UPDATE a authenticated).
      const { error: updErr } = await supabaseAdmin
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
      // FASE 4 — Ensamblado por SUBCATEGORÍA (cédula titular + cotitulares + extracto)
      //
      // Fuente de verdad: expediente_soportes filtrado por expediente_id.
      // Se valida presencia por subcategoria (no por filename regex), lo que
      // impide que una cédula duplicada del titular "cubra" al cotitular.
      // ───────────────────────────────────────────────────────────────────────
      const allowedAttachments = [...data.attachments];
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

      // Determinar cotitulares activos.
      const clienteData = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
      const cotitularesRaw = clienteData.cotitulares;
      const cotitularesActivos = Array.isArray(cotitularesRaw)
        ? (cotitularesRaw as Array<Record<string, unknown>>).filter(
            (c) => c && c.activo !== false && typeof c.nombre === "string" && (c.nombre as string).trim(),
          )
        : [];

      // Cédulas requeridas por subcategoria.
      const cedulasRequeridas: string[] = [
        "cedula_titular",
        ...cotitularesActivos.map((_c, i) => `cedula_cotitular_${i + 1}`),
      ];

      // Cargar TODOS los soportes de identidad + extracto SOLO para este expediente.
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
      type SoporteRow = {
        categoria: string;
        subcategoria: string | null;
        archivo_nombre: string | null;
        archivo_path: string | null;
        mime_type: string | null;
      };
      const soportes = (soportesRows ?? []) as SoporteRow[];

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

      const faltantes: string[] = [];

      // Cada cédula requerida se resuelve UNA sola vez, tomando la fila más
      // reciente de esa subcategoria (source-of-truth: expediente_soportes).
      // Se retira del ensamblado cualquier cédula del cliente para evitar
      // ambigüedad con la de la BD.
      const cedulaAttachmentKeywords = /cedula|cédula|identidad/i;
      const originalNonIdentityAttachments = allowedAttachments.filter(
        (a) => !cedulaAttachmentKeywords.test(a.filename),
      );
      // Reiniciamos allowedAttachments removiendo cédulas provistas por el cliente.
      allowedAttachments.length = 0;
      allowedAttachments.push(...originalNonIdentityAttachments);

      for (const sub of cedulasRequeridas) {
        const candidatos = soportes.filter(
          (s) => s.categoria === "identidad" && s.subcategoria === sub && s.archivo_path,
        );
        if (candidatos.length === 0) {
          const label = sub === "cedula_titular" ? "cédula del titular" : `cédula de ${sub.replace("cedula_", "").replace("_", " ")}`;
          faltantes.push(label);
          continue;
        }
        const prefix = sub === "cedula_titular"
          ? "Cedula_Titular"
          : `Cedula_Cotitular_${sub.replace("cedula_cotitular_", "")}`;
        const ok = await downloadAndAppend(candidatos[0], "soportes-banco", prefix);
        if (!ok) {
          faltantes.push(`archivo de ${sub.replace("_", " ")} no accesible en storage`);
        }
      }

      // Extracto: debe existir al menos uno en expediente_soportes categoria=extracto_banco
      // O en credito_data.archivoPath / extractos_lecturas (fallbacks preexistentes).
      const extractoAttachmentKeyword = /extracto/i;
      const yaTieneExtracto = allowedAttachments.some((a) => extractoAttachmentKeyword.test(a.filename));
      if (!yaTieneExtracto) {
        let extractoOk = false;
        const extractoRows = soportes.filter((s) => s.categoria === "extracto_banco" && s.archivo_path);
        if (extractoRows.length > 0) {
          extractoOk = await downloadAndAppend(extractoRows[0], "extractos", "Extracto_Credito");
        }
        if (!extractoOk) {
          // Fallback: credito_data.archivoPath / extractos_lecturas
          const credito = ((exp as { credito_data?: unknown }).credito_data ?? {}) as Record<string, unknown>;
          const cliente = ((exp as { cliente_data?: unknown }).cliente_data ?? {}) as Record<string, unknown>;
          const candidatePaths = [credito.archivoPath, cliente.extractoArchivoPath, cliente.archivoPath]
            .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
          for (const p of candidatePaths) {
            const fakeRow: SoporteRow = {
              categoria: "extracto_banco",
              subcategoria: null,
              archivo_nombre: p.split("/").pop() || "extracto.pdf",
              archivo_path: p.trim(),
              mime_type: p.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
            };
            if (await downloadAndAppend(fakeRow, "extractos", "Extracto_Credito")) {
              extractoOk = true;
              break;
            }
          }
          if (!extractoOk) {
            const { data: lecturas } = await supabaseAdmin
              .from("extractos_lecturas")
              .select("archivo_nombre, archivo_path")
              .eq("expediente_id", data.expedienteId)
              .not("archivo_path", "is", null)
              .order("created_at", { ascending: false })
              .limit(3);
            for (const l of (lecturas ?? []) as Array<{ archivo_nombre: string | null; archivo_path: string | null }>) {
              if (!l.archivo_path) continue;
              const fakeRow: SoporteRow = {
                categoria: "extracto_banco",
                subcategoria: null,
                archivo_nombre: l.archivo_nombre,
                archivo_path: l.archivo_path,
                mime_type: l.archivo_path.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
              };
              if (await downloadAndAppend(fakeRow, "extractos", "Extracto_Credito")) {
                extractoOk = true;
                break;
              }
            }
          }
        }
        if (!extractoOk) faltantes.push("extracto bancario");
      }

      // ───────────────────────────────────────────────────────────────────────
      // FASE 5 — Validación adicional (poder + ficha) + resultado
      // ───────────────────────────────────────────────────────────────────────
      const nombres = allowedAttachments.map((a) => a.filename.toLowerCase());
      const some = (re: RegExp) => nombres.some((n) => re.test(n));
      if (!some(/poder/)) faltantes.push("poder especial");
      if (!some(/ficha|datos.?contrato|contrato/)) faltantes.push("ficha de datos del contrato");

      if (faltantes.length > 0) {
        const lista = faltantes.join(", ");
        await markError("validacion", `Faltan: ${lista}`);
        throw new Error(
          `No fue posible enviar el paquete. Faltan: ${lista}. Carga los documentos pendientes y vuelve a intentarlo.`,
        );
      }

      if (allowedAttachments.length === 0) {
        await markError("validacion", "paquete vacío");
        throw new Error("El paquete de contratación no contiene adjuntos válidos.");
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
        throw new Error(
          "No fue posible contactar al proveedor de correo. El intento quedó registrado; puedes reintentarlo.",
        );
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
        await supabaseAdmin
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

      const { error: envUpErr } = await supabaseAdmin
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
        await supabaseAdmin
          .from("envios_contratacion")
          .update({
            estado_envio: "enviado_trazabilidad_parcial",
            proveedor_message_id: messageId,
            error: "[trazabilidad] correo enviado pero falló el registro interno",
          })
          .eq("id", intentoId);
        return { ok: true, messageId, warning: "trazabilidad_parcial" as const, deduped: false };
      }

      return { ok: true, messageId, warning: null, deduped: false };
    } catch (e) {
      // Seguro de último recurso: si el intento sigue en "preparando", marcarlo error
      // para liberar el índice único parcial y permitir un nuevo intento.
      try {
        if (intentoId) {
          await supabaseAdmin
            .from("envios_contratacion")
            .update({
              estado_envio: "error",
              error: `[fatal] ${e instanceof Error ? e.message : String(e)}`.slice(0, 2000),
            })
            .eq("id", intentoId)
            .eq("estado_envio", "preparando");
        }
      } catch (finalErr) {
        console.error("[contratacion] fallback markError failed", intentoId, finalErr);
      }
      throw e;
    }
  });
