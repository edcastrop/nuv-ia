import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

// ─── Tipos livianos (serializables) ────────────────────────────────────
export type QAConvRow = {
  id: string; titulo: string; expediente_id: string | null; auditoria_id: string | null;
  contexto: Json; updated_at: string; created_at: string;
};

export type QAMsgRow = {
  id: string; role: "system" | "user" | "assistant" | "tool";
  content: string | null; tool_calls: Json; tool_call_id: string | null;
  tool_name: string | null; citas: Json; created_at: string;
};

export type QASugerenciaRow = {
  id: string; conversacion_id: string; expediente_id: string | null; auditoria_id: string | null;
  tipo: string; titulo: string; propuesta: Json; justificacion: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  creada_por: string | null; aprobada_por: string | null; aprobada_at: string | null;
  created_at: string;
};

// ─── Listar conversaciones del usuario ─────────────────────────────────
export const listarConversaciones = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    expedienteId: z.string().uuid().nullable().optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("nuvia_qa_copilot_conversaciones")
      .select("id,titulo,expediente_id,auditoria_id,contexto,created_at,updated_at")
      .eq("archivada", false)
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.expedienteId) q = q.eq("expediente_id", data.expedienteId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as QAConvRow[];
  });

// ─── Crear conversación ────────────────────────────────────────────────
export const crearConversacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    titulo: z.string().min(1).max(200).default("Nueva conversación"),
    expedienteId: z.string().uuid().nullable().optional(),
    auditoriaId: z.string().uuid().nullable().optional(),
    contexto: z.record(z.unknown()).default({}),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("nuvia_qa_copilot_conversaciones")
      .insert({
        user_id: userId,
        titulo: data.titulo,
        expediente_id: data.expedienteId ?? null,
        auditoria_id: data.auditoriaId ?? null,
        contexto: data.contexto as Json,
      })
      .select("id,titulo,expediente_id,auditoria_id,contexto,created_at,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as QAConvRow;
  });

// ─── Renombrar / archivar ──────────────────────────────────────────────
export const actualizarConversacion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    titulo: z.string().min(1).max(200).optional(),
    archivada: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.titulo !== undefined) patch.titulo = data.titulo;
    if (data.archivada !== undefined) patch.archivada = data.archivada;
    const { error } = await context.supabase
      .from("nuvia_qa_copilot_conversaciones")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Obtener mensajes ──────────────────────────────────────────────────
export const obtenerMensajes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversacionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("nuvia_qa_copilot_mensajes")
      .select("id,role,content,tool_calls,tool_call_id,tool_name,citas,created_at")
      .eq("conversacion_id", data.conversacionId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as QAMsgRow[];
  });

// ─── Sugerencias de dictamen ───────────────────────────────────────────
export const listarSugerencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    conversacionId: z.string().uuid().optional(),
    expedienteId: z.string().uuid().optional(),
    estado: z.enum(["pendiente", "aprobada", "rechazada"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("nuvia_qa_copilot_sugerencias")
      .select("id,conversacion_id,expediente_id,auditoria_id,tipo,titulo,propuesta,justificacion,estado,creada_por,aprobada_por,aprobada_at,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.conversacionId) q = q.eq("conversacion_id", data.conversacionId);
    if (data.expedienteId) q = q.eq("expediente_id", data.expedienteId);
    if (data.estado) q = q.eq("estado", data.estado);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as QASugerenciaRow[];
  });

export const resolverSugerencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["aprobada", "rechazada"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("nuvia_qa_copilot_sugerencias")
      .update({ estado: data.decision, aprobada_por: userId, aprobada_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Embeddings de KB (admin / job) ────────────────────────────────────
// Genera embeddings para todos los documentos de KB que aún no tienen vector.
export const embedKBFaltantes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ limit: z.number().int().min(1).max(100).default(50) }).parse(i))
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY no configurada");
    const { supabase } = context;
    const { data: docs, error } = await supabase
      .from("nuvia_qa_kb")
      .select("id,titulo,contenido,categoria,banco")
      .is("embedding", null)
      .limit(data.limit);
    if (error) throw new Error(error.message);
    if (!docs || docs.length === 0) return { procesados: 0, total_pendientes: 0 };

    let procesados = 0;
    for (const d of docs) {
      const text = `${d.categoria} · ${d.banco ?? ""} · ${d.titulo}\n${d.contenido}`.slice(0, 8000);
      const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text }),
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: Array<{ embedding: number[] }> };
      const emb = j.data?.[0]?.embedding;
      if (!emb) continue;
      const { error: upErr } = await supabase
        .from("nuvia_qa_kb")
        .update({ embedding: emb as unknown as string })
        .eq("id", d.id);
      if (!upErr) procesados++;
    }
    return { procesados, muestra_pendiente: docs.length };
  });
