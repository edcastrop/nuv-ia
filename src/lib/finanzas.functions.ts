// Server fns Entrega 4 — Nómina, Tesorería y Alertas IA financiera (NUVEX).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Empleados ----------
export const upsertEmpleado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nombre: z.string().min(2).max(255),
        documento: z.string().max(50).optional(),
        cargo: z.string().max(120).optional(),
        area: z.string().max(120).optional(),
        tipo_contrato: z.enum(["indefinido", "fijo", "prestacion", "obra_labor"]).default("indefinido"),
        valor_mensual: z.number().min(0),
        activo: z.boolean().default(true),
        user_id: z.string().uuid().optional(),
        observaciones: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      nombre: data.nombre,
      documento: data.documento ?? null,
      cargo: data.cargo ?? null,
      area: data.area ?? null,
      tipo_contrato: data.tipo_contrato,
      valor_mensual: data.valor_mensual,
      activo: data.activo,
      user_id: data.user_id ?? null,
      observaciones: data.observaciones ?? null,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("nomina_empleados" as never).update(payload as never).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase
        .from("nomina_empleados" as never)
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (ins as unknown as { id: string }).id;
    }
    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "empleado",
      entidad_id: id,
      accion: data.id ? "actualizado" : "creado",
      user_id: userId,
      valor_nuevo: payload,
    } as never);
    return { ok: true, id };
  });

// ---------- Pago de nómina con comprobante ----------
export const pagarNomina = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        empleado_id: z.string().uuid(),
        periodo: z.string().min(4).max(20),
        valor: z.number().min(0),
        fecha_pago: z.string().min(10).max(10),
        comprobante_num: z.string().max(120).optional(),
        comprobanteBase64: z.string().min(50),
        comprobanteFilename: z.string().max(255),
        observaciones: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const bytes = Uint8Array.from(atob(data.comprobanteBase64), (c) => c.charCodeAt(0));
    const path = `nomina/${data.empleado_id}/${Date.now()}-${data.comprobanteFilename}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("comprobantes-finanzas")
      .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
    if (upErr) throw new Error("No se pudo subir comprobante: " + upErr.message);

    const { data: pago, error } = await supabase
      .from("nomina_pagos" as never)
      .insert({
        empleado_id: data.empleado_id,
        periodo: data.periodo,
        valor: data.valor,
        fecha_pago: data.fecha_pago,
        estado: "pagado",
        comprobante_num: data.comprobante_num ?? null,
        comprobante_url: path,
        observaciones: data.observaciones ?? null,
        user_id: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const pagoId = (pago as unknown as { id: string }).id;

    // Movimiento tesorería
    await supabase.from("tesoreria_movimientos" as never).insert({
      tipo: "egreso",
      categoria: "nomina",
      valor: data.valor,
      fecha: data.fecha_pago,
      descripcion: `Nómina periodo ${data.periodo}`,
      nomina_pago_id: pagoId,
      user_id: userId,
      comprobante_url: path,
    } as never);

    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "nomina_pago",
      entidad_id: pagoId,
      accion: "pagado",
      user_id: userId,
      documento_url: path,
      valor_nuevo: { valor: data.valor, periodo: data.periodo },
    } as never);

    return { ok: true, id: pagoId, path };
  });

// ---------- Movimiento manual de tesorería ----------
export const registrarMovimiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tipo: z.enum(["ingreso", "egreso"]),
        categoria: z.string().min(2).max(60),
        valor: z.number().min(0),
        fecha: z.string().min(10).max(10),
        descripcion: z.string().max(500).optional(),
        comprobanteBase64: z.string().optional(),
        comprobanteFilename: z.string().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let path: string | null = null;
    if (data.comprobanteBase64 && data.comprobanteFilename) {
      const bytes = Uint8Array.from(atob(data.comprobanteBase64), (c) => c.charCodeAt(0));
      path = `tesoreria/${Date.now()}-${data.comprobanteFilename}`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("comprobantes-finanzas")
        .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
      if (upErr) throw new Error("No se pudo subir comprobante: " + upErr.message);
    }
    const { data: mov, error } = await supabase
      .from("tesoreria_movimientos" as never)
      .insert({
        tipo: data.tipo,
        categoria: data.categoria,
        valor: data.valor,
        fecha: data.fecha,
        descripcion: data.descripcion ?? null,
        comprobante_url: path,
        user_id: userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const id = (mov as unknown as { id: string }).id;

    await supabase.from("finanzas_auditoria" as never).insert({
      entidad: "tesoreria_movimiento",
      entidad_id: id,
      accion: "registrado",
      user_id: userId,
      documento_url: path,
      valor_nuevo: { tipo: data.tipo, categoria: data.categoria, valor: data.valor },
    } as never);

    return { ok: true, id };
  });

// ---------- Generar alertas IA financiera ----------
export const generarAlertasFinanzas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    let creadas = 0;

    // 1) Cartera vencida > 30 días
    const { data: cart } = await supabase
      .from("cartera" as never)
      .select("id, expediente_id, fecha_vencimiento, honorarios_totales, pagado, estado_cartera")
      .neq("estado_cartera", "pago_total")
      .neq("estado_cartera", "cerrado");
    const hoy = new Date();
    for (const c of (cart ?? []) as unknown as Array<{
      id: string; expediente_id: string; fecha_vencimiento: string;
      honorarios_totales: number; pagado: number;
    }>) {
      const saldo = Number(c.honorarios_totales) - Number(c.pagado);
      if (saldo <= 0) continue;
      const dias = Math.floor((hoy.getTime() - new Date(c.fecha_vencimiento).getTime()) / 86400000);
      if (dias > 30) {
        const { data: existe } = await supabase
          .from("finanzas_alertas" as never)
          .select("id")
          .eq("cartera_id", c.id)
          .eq("tipo", "cartera_vencida")
          .eq("leida", false)
          .maybeSingle();
        if (!existe) {
          await supabase.from("finanzas_alertas" as never).insert({
            tipo: "cartera_vencida",
            severidad: dias > 60 ? "alta" : "media",
            cartera_id: c.id,
            expediente_id: c.expediente_id,
            titulo: `Cartera vencida ${dias} días`,
            mensaje_ia: `Saldo $${Math.round(saldo).toLocaleString("es-CO")} sin pagar. Sugerido: contacto WhatsApp + recordatorio email.`,
          } as never);
          creadas++;
        }
      }
    }

    // 2) Cuentas de cobro enviadas > 7 días sin aprobar
    const { data: ccs } = await supabase
      .from("cuentas_cobro" as never)
      .select("id, numero, total, fecha_envio, estado")
      .eq("estado", "enviada");
    for (const cc of (ccs ?? []) as unknown as Array<{
      id: string; numero: string; total: number; fecha_envio: string;
    }>) {
      if (!cc.fecha_envio) continue;
      const dias = Math.floor((hoy.getTime() - new Date(cc.fecha_envio).getTime()) / 86400000);
      if (dias > 7) {
        const { data: existe } = await supabase
          .from("finanzas_alertas" as never)
          .select("id")
          .eq("cuenta_cobro_id", cc.id)
          .eq("tipo", "cc_demorada")
          .eq("leida", false)
          .maybeSingle();
        if (!existe) {
          await supabase.from("finanzas_alertas" as never).insert({
            tipo: "cc_demorada",
            severidad: dias > 15 ? "alta" : "media",
            cuenta_cobro_id: cc.id,
            titulo: `CC ${cc.numero} sin aprobar (${dias}d)`,
            mensaje_ia: `Total $${Math.round(Number(cc.total)).toLocaleString("es-CO")}. Sugerido: reenviar a Contabilidad o escalar a Gerencia.`,
          } as never);
          creadas++;
        }
      }
    }

    return { ok: true, creadas };
  });

export const marcarAlertaLeida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("finanzas_alertas" as never)
      .update({ leida: true } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
