// Server functions del Centro de Cartera NUVEX.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RESEND_GATEWAY = "https://connector-gateway.lovable.dev/resend";

function calcVencimiento(fecha: string, dias = 5): string {
  const d = new Date(fecha + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// ---------- 1. Crear cartera ----------
export const crearCartera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expedienteId: z.string().uuid(),
        fechaAplicacionBanco: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fechaResultadoFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        formaPago: z.enum(["contado", "financiado"]),
        responsableId: z.string().uuid(),
        cuotas: z
          .array(
            z.object({
              numero: z.number().int().positive(),
              valor: z.number().positive(),
              fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            }),
          )
          .optional()
          .default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: exp, error } = await supabase
      .from("expedientes")
      .select("id, estado_caso, honorarios_final")
      .eq("id", data.expedienteId)
      .single();
    if (error || !exp) throw new Error("Expediente no encontrado.");

    const estado = (exp as { estado_caso?: string }).estado_caso ?? "";
    const permitidos = new Set([
      "condiciones_aplicadas",
      "resultado_final_generado",
      "cuenta_cobro_generada",
      "cuenta_cobro_enviada",
      "honorarios_pagados",
      "paz_y_salvo_generado",
      "proceso_cerrado",
    ]);
    if (!permitidos.has(estado)) {
      throw new Error(
        "La cartera solo puede crearse cuando el caso está en 'Condiciones aplicadas' o estados posteriores.",
      );
    }

    const honorarios = Number(exp.honorarios_final ?? 0);
    if (data.formaPago === "financiado" && data.cuotas.length > 0) {
      const suma = data.cuotas.reduce((a, c) => a + c.valor, 0);
      if (Math.abs(suma - honorarios) > 1) {
        throw new Error(`La suma de las cuotas (${suma}) debe igualar los honorarios (${honorarios}).`);
      }
    }

    const fechaVenc = calcVencimiento(data.fechaAplicacionBanco, 5);

    const { data: ins, error: errIns } = await supabase
      .from("cartera" as never)
      .insert({
        expediente_id: data.expedienteId,
        responsable_id: data.responsableId,
        forma_pago: data.formaPago,
        fecha_aplicacion_banco: data.fechaAplicacionBanco,
        fecha_resultado_final: data.fechaResultadoFinal ?? null,
        fecha_vencimiento: fechaVenc,
        honorarios_totales: honorarios,
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (errIns) throw new Error(errIns.message);
    const carteraId = (ins as { id: string }).id;

    if (data.formaPago === "financiado" && data.cuotas.length > 0) {
      const rows = data.cuotas.map((c) => ({ ...c, cartera_id: carteraId }));
      await supabase.from("cartera_cuotas" as never).insert(rows as never);
    }

    await supabase.from("cartera_auditoria" as never).insert({
      cartera_id: carteraId,
      user_id: userId,
      accion: "cartera_creada",
      observacion: `Forma: ${data.formaPago} · Vence: ${fechaVenc}`,
    } as never);

    return { id: carteraId, fechaVencimiento: fechaVenc };
  });

// ---------- 2. Registrar pago ----------
export const registrarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        carteraId: z.string().uuid(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        valor: z.number().positive(),
        metodo: z.string().max(80).optional(),
        bancoReceptor: z.string().max(120).optional(),
        comprobanteNum: z.string().max(120).optional(),
        comprobanteBase64: z.string().optional(),
        comprobanteFilename: z.string().max(255).optional(),
        observaciones: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let comprobanteUrl: string | null = null;
    if (data.comprobanteBase64 && data.comprobanteFilename) {
      const bytes = Uint8Array.from(atob(data.comprobanteBase64), (c) => c.charCodeAt(0));
      const path = `${data.carteraId}/${Date.now()}-${data.comprobanteFilename}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("cartera-comprobantes")
        .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
      if (upErr) throw new Error("No se pudo subir comprobante: " + upErr.message);
      comprobanteUrl = path;
    }

    const { error } = await supabase.from("cartera_pagos" as never).insert({
      cartera_id: data.carteraId,
      fecha: data.fecha,
      valor: data.valor,
      metodo: data.metodo ?? null,
      banco_receptor: data.bancoReceptor ?? null,
      comprobante_num: data.comprobanteNum ?? null,
      comprobante_url: comprobanteUrl,
      observaciones: data.observaciones ?? null,
      user_id: userId,
    } as never);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ---------- 3. Crear acuerdo ----------
export const crearAcuerdo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        carteraId: z.string().uuid(),
        valorTotal: z.number().positive(),
        numeroCuotas: z.number().int().positive(),
        fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        observaciones: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("cartera_acuerdos" as never).insert({
      cartera_id: data.carteraId,
      valor_total: data.valorTotal,
      numero_cuotas: data.numeroCuotas,
      fecha_inicio: data.fechaInicio,
      fecha_fin: data.fechaFin,
      observaciones: data.observaciones ?? null,
      user_id: userId,
    } as never);
    if (error) throw new Error(error.message);

    await supabase
      .from("cartera" as never)
      .update({ estado_cartera: "acuerdo_pago" } as never)
      .eq("id", data.carteraId);

    return { ok: true };
  });

// ---------- 4. Enviar a prejurídico ----------
export const enviarPrejuridico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ carteraId: z.string().uuid(), observacion: z.string().max(2000).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: c } = await supabase
      .from("cartera" as never)
      .select("expediente_id")
      .eq("id", data.carteraId)
      .single();
    const expedienteId = (c as { expediente_id?: string } | null)?.expediente_id;
    if (!expedienteId) throw new Error("Cartera no encontrada");

    await supabase
      .from("cartera" as never)
      .update({ estado_cartera: "prejuridico" } as never)
      .eq("id", data.carteraId);

    await supabase
      .from("expedientes")
      .update({ estado_caso: "prejuridico" as never })
      .eq("id", expedienteId);

    await supabase.from("expediente_historial").insert({
      expediente_id: expedienteId,
      estado_caso_nuevo: "prejuridico" as never,
      accion_origen: "prejuridico",
      observacion: data.observacion ?? "Enviado a área prejurídica",
      user_id: userId,
    } as never);

    await supabase.from("cartera_auditoria" as never).insert({
      cartera_id: data.carteraId,
      user_id: userId,
      accion: "enviado_prejuridico",
      observacion: data.observacion ?? null,
    } as never);

    return { ok: true };
  });

// ---------- 5. Marcar comunicación enviada manualmente ----------
export const registrarComunicacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        carteraId: z.string().uuid(),
        tipo: z.string().min(1).max(80),
        canal: z.enum(["email", "whatsapp"]),
        estado: z.string().max(40).default("enviado"),
        asunto: z.string().max(500).optional(),
        destinatario: z.string().max(255).optional(),
        body: z.string().max(20000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("cartera_comunicaciones" as never).insert({
      cartera_id: data.carteraId,
      tipo: data.tipo,
      canal: data.canal,
      estado: data.estado,
      asunto: data.asunto ?? null,
      destinatario: data.destinatario ?? null,
      body: data.body ?? null,
      user_id: userId,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- 6. Enviar correo de cartera vía Resend ----------
const ASUNTOS: Record<string, (cliente: string) => string> = {
  email_cuenta_cobro: (c) => `Cuenta de Cobro NUVEX - ${c}`,
  email_recordatorio: () => `Recordatorio de Honorarios NUVEX`,
  email_vencimiento: () => `Vencimiento Honorarios NUVEX`,
  email_mora_7: () => `Honorarios Pendientes NUVEX`,
  email_mora_15: () => `Solicitud Formal de Pago`,
  email_prejuridico: () => `Aviso Prejurídico NUVEX`,
};

function buildEmailBody(tipo: string, ctx: { cliente: string; saldo: number; venc: string; banco?: string | null }): string {
  const money = (n: number) => "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
  const baseClose = `\n\nQuedamos atentos.\nEquipo NUVEX — Finanzas Inteligentes`;
  switch (tipo) {
    case "email_cuenta_cobro":
      return `Estimado(a) ${ctx.cliente},\n\nAdjuntamos la cuenta de cobro por ${money(ctx.saldo)} correspondiente a los honorarios NUVEX${ctx.banco ? " por el proceso adelantado con " + ctx.banco : ""}.\nFecha de vencimiento: ${ctx.venc}.${baseClose}`;
    case "email_recordatorio":
      return `Estimado(a) ${ctx.cliente},\n\nRecordamos que el pago de honorarios NUVEX por ${money(ctx.saldo)} tiene como fecha de vencimiento el ${ctx.venc}.${baseClose}`;
    case "email_vencimiento":
      return `Estimado(a) ${ctx.cliente},\n\nLe informamos que el día de hoy vence el pago de honorarios NUVEX por ${money(ctx.saldo)}.${baseClose}`;
    case "email_mora_7":
      return `Estimado(a) ${ctx.cliente},\n\nSu obligación con NUVEX por ${money(ctx.saldo)} presenta 7 días de mora. Le solicitamos regularizar el pago a la mayor brevedad.${baseClose}`;
    case "email_mora_15":
      return `Estimado(a) ${ctx.cliente},\n\nMediante la presente realizamos solicitud formal de pago por ${money(ctx.saldo)}. Su obligación lleva 15 días de mora. De no realizarse el pago, su caso será remitido a cobro prejurídico.${baseClose}`;
    case "email_prejuridico":
      return `Sr(a) ${ctx.cliente},\n\nDada la mora superior a 30 días, su caso ha sido trasladado a área prejurídica por valor de ${money(ctx.saldo)}.${baseClose}`;
    default:
      return "";
  }
}

export const enviarCorreoCartera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        carteraId: z.string().uuid(),
        tipo: z.enum([
          "email_cuenta_cobro",
          "email_recordatorio",
          "email_vencimiento",
          "email_mora_7",
          "email_mora_15",
          "email_prejuridico",
        ]),
        destinatariosOverride: z.array(z.string().email()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: c } = await supabase
      .from("cartera" as never)
      .select("*")
      .eq("id", data.carteraId)
      .single();
    if (!c) throw new Error("Cartera no encontrada");
    const cartera = c as unknown as {
      id: string;
      expediente_id: string;
      honorarios_totales: number;
      pagado: number;
      fecha_vencimiento: string;
    };

    const { data: exp } = await supabase
      .from("expedientes")
      .select("cliente_nombre, banco, cliente_data")
      .eq("id", cartera.expediente_id)
      .single();
    if (!exp) throw new Error("Expediente no encontrado");

    const clienteData = (exp.cliente_data ?? {}) as Record<string, string>;
    const destinatarios =
      data.destinatariosOverride && data.destinatariosOverride.length > 0
        ? data.destinatariosOverride
        : [clienteData.correo, clienteData.email].filter(Boolean) as string[];
    if (destinatarios.length === 0) throw new Error("No hay correo del cliente en el expediente.");

    const saldo = Number(cartera.honorarios_totales) - Number(cartera.pagado);
    const asunto = ASUNTOS[data.tipo](exp.cliente_nombre);
    const body = buildEmailBody(data.tipo, {
      cliente: exp.cliente_nombre,
      saldo,
      venc: cartera.fecha_vencimiento,
      banco: exp.banco,
    });

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) throw new Error("Resend no está configurado.");

    const from = process.env.CARTERA_FROM_EMAIL || process.env.CONTRATACION_FROM_EMAIL || "NUVEX <onboarding@resend.dev>";

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
        subject: asunto,
        text: body,
        html: body
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>"),
      }),
    });
    const json = (await resp.json().catch(() => ({}))) as Record<string, unknown>;
    if (!resp.ok) {
      await supabase.from("cartera_comunicaciones" as never).insert({
        cartera_id: data.carteraId,
        tipo: data.tipo,
        canal: "email",
        estado: "error",
        asunto,
        destinatario: destinatarios.join(", "),
        body,
        user_id: userId,
      } as never);
      throw new Error(`Resend [${resp.status}]: ${JSON.stringify(json).slice(0, 400)}`);
    }
    const msgId = typeof json.id === "string" ? json.id : null;

    await supabase.from("cartera_comunicaciones" as never).insert({
      cartera_id: data.carteraId,
      tipo: data.tipo,
      canal: "email",
      estado: "enviado",
      asunto,
      destinatario: destinatarios.join(", "),
      body,
      proveedor_msg_id: msgId,
      user_id: userId,
    } as never);

    // Si es cuenta de cobro → cambiar estado cartera y caso
    if (data.tipo === "email_cuenta_cobro") {
      await supabase
        .from("cartera" as never)
        .update({ estado_cartera: "cuenta_cobro_enviada", fecha_cuenta_cobro: new Date().toISOString().slice(0, 10) } as never)
        .eq("id", data.carteraId);
      await supabase
        .from("expedientes")
        .update({ estado_caso: "cuenta_cobro_enviada" as never })
        .eq("id", cartera.expediente_id);
    }

    return { ok: true, messageId: msgId };
  });
