/**
 * NUVIA Operating Model — ServerFns (Fase 7.6.1)
 *
 * Funciones servidor para:
 *  - Lectura del catálogo de etapas/subestados
 *  - Métricas SLA dinámicas por banco
 *  - Registro de validación operativa (E9)
 *  - Emisión idempotente de eventos al event bus
 *  - Upsert de Cliente Maestro desde expedientes
 *  - Retorno de caso a etapa previa por requerimiento de banco
 *
 * Reglas:
 *  - Todas exigen requireSupabaseAuth.
 *  - Métricas ejecutivas (SLA bancos) solo roles directivos.
 *  - Escrituras operativas (validación, eventos) abiertas a autenticados.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { REQUERIMIENTO_RETORNO, EVENTOS_CASO, type EtapaId } from "./operatingModel";

const ROLES_EJECUTIVOS = [
  "super_admin",
  "admin",
  "gerencia",
  "director_financiero_qa",
  "director_juridico",
];

async function isExec(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: any) => ROLES_EJECUTIVOS.includes(r.role));
}

// ============================================================
// Catálogo
// ============================================================

export const getOperatingModelCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [etapas, subs] = await Promise.all([
      supabase
        .from("etapa_definicion")
        .select("id, numero, nombre, objetivo, responsable_default, sla_dias_habiles, ciclo, orden_visual, activa")
        .eq("activa", true)
        .order("orden_visual"),
      supabase
        .from("etapa_subestado_catalogo")
        .select("etapa_id, subestado, es_inicial, es_final, orden")
        .order("orden"),
    ]);
    if (etapas.error) throw new Error(etapas.error.message);
    if (subs.error) throw new Error(subs.error.message);
    return { etapas: etapas.data ?? [], subestados: subs.data ?? [] };
  });

// ============================================================
// SLA dinámico por banco — lectura
// ============================================================

const BankSlaInput = z.object({
  dias: z.number().int().min(1).max(180).default(30),
});

export const getBankSlaRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BankSlaInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isExec(supabase, userId))) throw new Error("Forbidden");

    const desde = new Date();
    desde.setDate(desde.getDate() - data.dias);
    const desdeStr = desde.toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("banco_sla_metricas")
      .select("banco, fecha, casos_abiertos, casos_vencidos, tiempo_promedio_dias, tiempo_max_dias, tasa_requerimientos, tasa_favorable, muestra")
      .gte("fecha", desdeStr)
      .order("fecha", { ascending: false });
    if (error) throw new Error(error.message);

    // Agrupar por banco quedándonos con el snapshot más reciente
    const latestByBank = new Map<string, any>();
    for (const r of rows ?? []) {
      const b = r.banco as string;
      if (!latestByBank.has(b)) latestByBank.set(b, r);
    }
    const ranking = Array.from(latestByBank.values()).sort(
      (a: any, b: any) => Number(a.tiempo_promedio_dias ?? 0) - Number(b.tiempo_promedio_dias ?? 0),
    );
    return { ranking, generated_at: new Date().toISOString() };
  });

// ============================================================
// Validación Operativa (E9)
// ============================================================

const ValOpInput = z.object({
  expediente_id: z.string().uuid(),
  resultado: z.enum(["pendiente", "aprobado", "rechazado", "observaciones"]),
  checklist_json: z.record(z.string(), z.boolean()).default({}),
  motivo_rechazo: z.string().max(500).optional().nullable(),
  etapa_destino_si_rechazo: z.string().max(60).optional().nullable(),
  observaciones: z.string().max(1000).optional().nullable(),
});

export const registrarValidacionOperativa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ValOpInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ins, error } = await supabase
      .from("validacion_operativa")
      .insert({
        expediente_id: data.expediente_id,
        validado_por: userId,
        resultado: data.resultado,
        checklist_json: data.checklist_json,
        motivo_rechazo: data.motivo_rechazo ?? null,
        etapa_destino_si_rechazo: data.etapa_destino_si_rechazo ?? null,
        observaciones: data.observaciones ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const tipo =
      data.resultado === "aprobado"
        ? EVENTOS_CASO.validacionOperativaAprobada
        : data.resultado === "rechazado"
          ? EVENTOS_CASO.validacionOperativaRechazada
          : null;
    if (tipo) {
      await emitCasoEventoInternal(supabase, {
        expediente_id: data.expediente_id,
        tipo_evento: tipo,
        payload: {
          validacion_id: ins.id,
          motivo: data.motivo_rechazo,
          etapa_destino: data.etapa_destino_si_rechazo,
        },
        origen: "registrarValidacionOperativa",
        idempotency_key: `valop:${ins.id}`,
      });
    }
    return { ok: true, id: ins.id as string };
  });

// ============================================================
// Event bus — emisión idempotente
// ============================================================

const EventoInput = z.object({
  expediente_id: z.string().uuid().nullable().optional(),
  cliente_id: z.string().uuid().nullable().optional(),
  tipo_evento: z.string().min(3).max(80),
  payload: z.record(z.string(), z.any()).default({}),
  origen: z.string().max(60).optional(),
  idempotency_key: z.string().min(4).max(120),
});

async function emitCasoEventoInternal(
  supabase: any,
  input: {
    expediente_id?: string | null;
    cliente_id?: string | null;
    tipo_evento: string;
    payload: Record<string, unknown>;
    origen?: string;
    idempotency_key: string;
  },
): Promise<{ ok: true; deduped: boolean }> {
  const { error } = await supabase.from("caso_eventos").insert({
    expediente_id: input.expediente_id ?? null,
    cliente_id: input.cliente_id ?? null,
    tipo_evento: input.tipo_evento,
    payload_json: input.payload,
    origen: input.origen ?? null,
    idempotency_key: input.idempotency_key,
  });
  if (error) {
    // Conflict por idempotency_key => evento ya existe, dedupe silencioso
    if (String(error.message).toLowerCase().includes("duplicate")) {
      return { ok: true, deduped: true };
    }
    throw new Error(error.message);
  }
  return { ok: true, deduped: false };
}

export const emitCasoEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventoInput.parse(d))
  .handler(async ({ data, context }) => {
    return await emitCasoEventoInternal(context.supabase, data);
  });

// ============================================================
// Retorno de caso por requerimiento de banco (E12 → E3/E8/E9)
// ============================================================

const RequerimientoInput = z.object({
  expediente_id: z.string().uuid(),
  banco: z.string().min(1).max(80),
  tipo: z.enum(["documento_cliente", "documento_corregido", "poder_corregido", "formato_banco", "paquete_incompleto", "aclaracion"]),
  descripcion: z.string().max(500).optional().nullable(),
});

export const registrarRequerimientoBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RequerimientoInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const etapaDestino: EtapaId = REQUERIMIENTO_RETORNO[data.tipo] ?? "validacion_operativa";

    const { data: ins, error } = await supabase
      .from("banco_requerimientos")
      .insert({
        expediente_id: data.expediente_id,
        banco: data.banco,
        tipo: data.tipo,
        descripcion: data.descripcion ?? null,
        etapa_destino: etapaDestino,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await emitCasoEventoInternal(supabase, {
      expediente_id: data.expediente_id,
      tipo_evento: EVENTOS_CASO.requerimientoBanco,
      payload: {
        requerimiento_id: ins.id,
        banco: data.banco,
        tipo: data.tipo,
        etapa_destino: etapaDestino,
        registrado_por: userId,
      },
      origen: "registrarRequerimientoBanco",
      idempotency_key: `req:${ins.id}`,
    });

    return { ok: true, id: ins.id as string, etapa_destino: etapaDestino };
  });

// ============================================================
// Cliente Maestro — upsert desde expediente
// ============================================================

const UpsertClienteInput = z.object({
  cedula: z.string().min(4).max(30),
  nombre_completo: z.string().min(2).max(200),
  email: z.string().email().optional().nullable(),
  telefono: z.string().max(40).optional().nullable(),
  ciudad: z.string().max(80).optional().nullable(),
  expediente_id: z.string().uuid().optional(),
});

export const upsertClienteMaestro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertClienteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: existing } = await supabase
      .from("clientes")
      .select("id, total_expedientes")
      .eq("cedula", data.cedula)
      .maybeSingle();

    let clienteId: string;
    if (existing) {
      clienteId = existing.id as string;
      await supabase
        .from("clientes")
        .update({
          nombre_completo: data.nombre_completo,
          email: data.email ?? null,
          telefono: data.telefono ?? null,
          ciudad: data.ciudad ?? null,
        })
        .eq("id", clienteId);
    } else {
      const { data: ins, error } = await supabase
        .from("clientes")
        .insert({
          cedula: data.cedula,
          nombre_completo: data.nombre_completo,
          email: data.email ?? null,
          telefono: data.telefono ?? null,
          ciudad: data.ciudad ?? null,
          fecha_primer_caso: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      clienteId = ins.id as string;
    }

    if (data.expediente_id) {
      await supabase
        .from("expedientes")
        .update({ cliente_id: clienteId })
        .eq("id", data.expediente_id)
        .is("cliente_id", null);
    }
    return { ok: true, cliente_id: clienteId };
  });
