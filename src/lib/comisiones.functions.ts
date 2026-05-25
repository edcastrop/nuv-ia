// Server fns para Cuentas de cobro v2 (Entrega 3 — Finanzas NUVEX).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { wrapNuvexEmail } from "@/lib/emailBrand.server";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

// ---------- Enviar cuenta de cobro por correo a Contabilidad ----------
export const enviarCuentaCobroEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cuentaCobroId: z.string().uuid(),
        pdfBase64: z.string().min(100),
        pdfFilename: z.string().max(255),
        destinatarios: z.array(z.string().email()).min(1).max(5).optional(),
        mensaje: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cc, error } = await supabase
      .from("cuentas_cobro" as never)
      .select("*")
      .eq("id", data.cuentaCobroId)
      .single();
    if (error || !cc) throw new Error("Cuenta de cobro no encontrada.");
    const cuenta = cc as unknown as {
      id: string;
      numero: string;
      total: number;
      user_id: string;
      estado: string;
    };

    const { data: prof } = await supabase
      .from("profiles")
      .select("nombre, email")
      .eq("id", cuenta.user_id)
      .maybeSingle();

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("Email no está configurado.");

    const destinatarios = data.destinatarios && data.destinatarios.length > 0
      ? data.destinatarios
      : [process.env.CONTABILIDAD_EMAIL || "contabilidad@nuvex.com.co"];

    const from = process.env.CONTABILIDAD_FROM_EMAIL
      || process.env.CARTERA_FROM_EMAIL
      || process.env.CONTRATACION_FROM_EMAIL
      || "NUVEX <onboarding@resend.dev>";

    const asunto = `Cuenta de Cobro NUVEX ${cuenta.numero} — ${prof?.nombre ?? "Licenciado"}`;
    const bodyText =
      `Cordial saludo,\n\nAdjuntamos cuenta de cobro NUVEX ${cuenta.numero} por valor de COP ${Number(cuenta.total).toLocaleString("es-CO")}.\n` +
      `Licenciado: ${prof?.nombre ?? "—"} (${prof?.email ?? "—"})\n` +
      (data.mensaje ? `\nMensaje: ${data.mensaje}\n` : "") +
      `\nQuedamos atentos a su aprobación y trámite de pago.\n\nEquipo NUVEX — Finanzas Inteligentes`;

    const resp = await fetch(`${RESEND_GATEWAY}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from,
        to: destinatarios,
        reply_to: prof?.email ? [prof.email] : undefined,
        subject: asunto,
        text: bodyText,
        html: await wrapNuvexEmail({ subject: asunto, bodyText }),
        attachments: [{ filename: data.pdfFilename, content: data.pdfBase64 }],
      }),
    });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      throw new Error(`Resend [${resp.status}]: ${JSON.stringify(json).slice(0, 400)}`);
    }

    // Avanzar estado y registrar historial
    await supabase
      .from("cuentas_cobro" as never)
      .update({ estado: "enviada", fecha_envio: new Date().toISOString() } as never)
      .eq("id", data.cuentaCobroId);

    await supabase
      .from("comisiones" as never)
      .update({ estado: "pendiente" } as never)
      .eq("cuenta_cobro_id", data.cuentaCobroId);

    await supabase.from("cuentas_cobro_historial" as never).insert({
      cuenta_cobro_id: data.cuentaCobroId,
      user_id: userId,
      accion: "enviada_contabilidad",
      observacion: `Email a ${destinatarios.join(", ")}${data.mensaje ? " · " + data.mensaje : ""}`,
    } as never);

    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "cuenta_cobro",
      entidad_id: data.cuentaCobroId,
      accion: "enviada_contabilidad",
      user_id: userId,
      valor_nuevo: { estado: "enviada", destinatarios },
    } as never);

    return { ok: true };
  });

// ---------- Marcar pagada con comprobante obligatorio ----------
export const marcarCuentaCobroPagada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cuentaCobroId: z.string().uuid(),
        comprobanteBase64: z.string().min(50),
        comprobanteFilename: z.string().max(255),
        observacion: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const bytes = Uint8Array.from(atob(data.comprobanteBase64), (c) => c.charCodeAt(0));
    const path = `${data.cuentaCobroId}/${Date.now()}-${data.comprobanteFilename}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("comprobantes-finanzas")
      .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
    if (upErr) throw new Error("No se pudo subir comprobante: " + upErr.message);

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("cuentas_cobro" as never)
      .update({ estado: "pagada", fecha_pago: ahora, comprobante_url: path } as never)
      .eq("id", data.cuentaCobroId);
    if (error) throw new Error(error.message);

    await supabase
      .from("comisiones" as never)
      .update({ estado: "pagada" } as never)
      .eq("cuenta_cobro_id", data.cuentaCobroId);

    await supabase.from("cuentas_cobro_historial" as never).insert({
      cuenta_cobro_id: data.cuentaCobroId,
      user_id: userId,
      accion: "estado_pagada",
      observacion: data.observacion ?? "Pago registrado con comprobante",
    } as never);

    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "cuenta_cobro",
      entidad_id: data.cuentaCobroId,
      accion: "pagada",
      user_id: userId,
      documento_url: path,
      motivo: data.observacion ?? null,
    } as never);

    // Movimiento de tesorería: egreso por pago de comisiones
    const { data: cc } = await supabase
      .from("cuentas_cobro" as never)
      .select("total, numero, user_id")
      .eq("id", data.cuentaCobroId)
      .maybeSingle();
    const ccrow = cc as unknown as { total: number; numero: string; user_id: string } | null;
    if (ccrow) {
      await supabase.from("tesoreria_movimientos" as never).insert({
        tipo: "egreso",
        categoria: "comisiones",
        valor: Number(ccrow.total),
        fecha: ahora.slice(0, 10),
        descripcion: `Pago cuenta de cobro ${ccrow.numero}`,
        cuenta_cobro_id: data.cuentaCobroId,
        user_id: userId,
        comprobante_url: path,
      } as never);
    }

    return { ok: true, comprobantePath: path };
  });

// ---------- Rechazar con motivo obligatorio ----------
export const rechazarCuentaCobro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        cuentaCobroId: z.string().uuid(),
        motivo: z.string().min(5).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("cuentas_cobro" as never)
      .update({ estado: "rechazada" } as never)
      .eq("id", data.cuentaCobroId);
    if (error) throw new Error(error.message);

    await supabase
      .from("comisiones" as never)
      .update({ estado: "rechazada" } as never)
      .eq("cuenta_cobro_id", data.cuentaCobroId);

    await supabase.from("cuentas_cobro_historial" as never).insert({
      cuenta_cobro_id: data.cuentaCobroId,
      user_id: userId,
      accion: "estado_rechazada",
      observacion: data.motivo,
    } as never);

    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "cuenta_cobro",
      entidad_id: data.cuentaCobroId,
      accion: "rechazada",
      user_id: userId,
      motivo: data.motivo,
    } as never);

    return { ok: true };
  });
