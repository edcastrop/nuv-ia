import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tipos compartidos con el cliente
export type TareaPrioridad = "baja" | "media" | "alta" | "critica";
export type TareaEstado = "pendiente" | "en_progreso" | "completada" | "cancelada";
export type BitacoraTipo =
  | "comentario"
  | "evidencia"
  | "llamada"
  | "email"
  | "whatsapp"
  | "sistema";

const PRIORIDADES = ["baja", "media", "alta", "critica"] as const;
const ESTADOS = ["pendiente", "en_progreso", "completada", "cancelada"] as const;
const TIPOS_BITACORA = [
  "comentario",
  "evidencia",
  "llamada",
  "email",
  "whatsapp",
  "sistema",
] as const;

const ORDEN_PRIORIDAD: Record<TareaPrioridad, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

// ============================================================
// Tareas
// ============================================================

export const listTareas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ expediente_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("expediente_tareas")
      .select(
        "id, expediente_id, responsable_id, titulo, descripcion, prioridad, fecha_objetivo, estado, completada_at, created_by, created_at, updated_at",
      )
      .eq("expediente_id", data.expediente_id);
    if (error) throw new Error(error.message);
    const ordenadas = (rows ?? []).slice().sort((a, b) => {
      const pa = ORDEN_PRIORIDAD[(a.prioridad as TareaPrioridad) ?? "media"];
      const pb = ORDEN_PRIORIDAD[(b.prioridad as TareaPrioridad) ?? "media"];
      if (pa !== pb) return pa - pb;
      const fa = a.fecha_objetivo ? Date.parse(a.fecha_objetivo as string) : Infinity;
      const fb = b.fecha_objetivo ? Date.parse(b.fecha_objetivo as string) : Infinity;
      return fa - fb;
    });
    return { tareas: ordenadas };
  });

export const crearTarea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expediente_id: z.string().uuid(),
        titulo: z.string().min(1).max(200),
        descripcion: z.string().max(2000).optional().nullable(),
        prioridad: z.enum(PRIORIDADES).default("media"),
        fecha_objetivo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        responsable_id: z.string().uuid().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("expediente_tareas")
      .insert({
        expediente_id: data.expediente_id,
        titulo: data.titulo.trim(),
        descripcion: data.descripcion?.trim() || null,
        prioridad: data.prioridad,
        fecha_objetivo: data.fecha_objetivo || null,
        responsable_id: data.responsable_id || null,
        created_by: context.userId,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tarea: row };
  });

export const actualizarTareaEstado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), estado: z.enum(ESTADOS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { estado: data.estado };
    if (data.estado === "completada") patch.completada_at = new Date().toISOString();
    else patch.completada_at = null;
    const { data: row, error } = await context.supabase
      .from("expediente_tareas")
      .update(patch as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tarea: row };
  });

export const asignarTarea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), responsable_id: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("expediente_tareas")
      .update({ responsable_id: data.responsable_id } as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tarea: row };
  });

// ============================================================
// Bitácora clínica
// ============================================================

export const listBitacora = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expediente_id: z.string().uuid(),
        limit: z.number().int().min(1).max(200).optional(),
        before: z.string().datetime().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("expediente_bitacora")
      .select("id, expediente_id, usuario_id, comentario, tipo, metadata, created_at")
      .eq("expediente_id", data.expediente_id)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.before) q = q.lt("created_at", data.before);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entradas: rows ?? [] };
  });

export const agregarBitacora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        expediente_id: z.string().uuid(),
        comentario: z.string().min(1).max(4000),
        tipo: z.enum(TIPOS_BITACORA).default("comentario"),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("expediente_bitacora")
      .insert({
        expediente_id: data.expediente_id,
        usuario_id: context.userId,
        comentario: data.comentario.trim(),
        tipo: data.tipo,
        metadata: (data.metadata ?? {}) as never,
      } as never)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entrada: row };
  });
