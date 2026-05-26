import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ KB ============
export const listCategorias = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gpt_kb_categorias")
      .select("id,nombre,descripcion,orden,activo")
      .order("orden");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listArticulos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gpt_kb_articulos")
      .select("id,titulo,contenido,tags,roles_permitidos,activo,categoria_id,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertArticulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        categoria_id: z.string().uuid(),
        titulo: z.string().min(2).max(255),
        contenido: z.string().min(1).max(20000),
        tags: z.array(z.string().max(40)).max(20).default([]),
        roles_permitidos: z.array(z.string().max(40)).max(20).default([]),
        activo: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const payload = {
      categoria_id: data.categoria_id,
      titulo: data.titulo,
      contenido: data.contenido,
      tags: data.tags,
      roles_permitidos: data.roles_permitidos,
      activo: data.activo,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("gpt_kb_articulos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: ins, error } = await context.supabase
        .from("gpt_kb_articulos")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id };
    }
  });

export const deleteArticulo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("gpt_kb_articulos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertCategoria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nombre: z.string().min(2).max(120),
        descripcion: z.string().max(500).optional(),
        orden: z.number().int().min(0).max(999).default(0),
        activo: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const payload = {
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      orden: data.orden,
      activo: data.activo,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("gpt_kb_categorias")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: ins, error } = await context.supabase
        .from("gpt_kb_categorias")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins.id };
    }
  });

// ============ Conversaciones / Mensajes ============
export const listConversaciones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gpt_conversaciones")
      .select("id,titulo,modulo_contexto,updated_at,created_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getMensajes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ conversacion_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: msgs, error } = await context.supabase
      .from("gpt_mensajes")
      .select("id,role,content,created_at")
      .eq("conversacion_id", data.conversacion_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return msgs ?? [];
  });

export const saveTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        conversacion_id: z.string().uuid().nullable(),
        modulo_contexto: z.string().max(80).nullable().optional(),
        user_content: z.string().min(1).max(8000),
        assistant_content: z.string().min(1).max(20000),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let convId = data.conversacion_id;
    if (!convId) {
      const titulo = data.user_content.slice(0, 80);
      const { data: conv, error } = await context.supabase
        .from("gpt_conversaciones")
        .insert({
          user_id: context.userId,
          titulo,
          modulo_contexto: data.modulo_contexto ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      convId = conv.id;
    } else {
      await context.supabase
        .from("gpt_conversaciones")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", convId);
    }

    const { error: msgErr } = await context.supabase.from("gpt_mensajes").insert([
      { conversacion_id: convId, role: "user", content: data.user_content },
      { conversacion_id: convId, role: "assistant", content: data.assistant_content },
    ]);
    if (msgErr) throw new Error(msgErr.message);
    return { conversacion_id: convId };
  });

// ============ Tickets ============
export const crearTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        area: z.enum(["juridica", "operaciones", "contabilidad", "director_qa", "soporte"]),
        asunto: z.string().min(3).max(200),
        descripcion: z.string().min(3).max(4000),
        prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
        conversacion_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { data: ticket, error } = await context.supabase
      .from("gpt_tickets")
      .insert({
        user_id: context.userId,
        conversacion_id: data.conversacion_id ?? null,
        area: data.area,
        asunto: data.asunto,
        descripcion: data.descripcion,
        prioridad: data.prioridad,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ticket.id };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("gpt_tickets")
      .select("id,user_id,area,asunto,descripcion,estado,prioridad,created_at,resuelto_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const actualizarTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        estado: z.enum(["abierto", "en_proceso", "resuelto", "cerrado"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("gpt_tickets")
      .update({
        estado: data.estado,
        resuelto_at: data.estado === "resuelto" ? new Date().toISOString() : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Analítica ============
export const analiticaGpt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error } = await context.supabase
      .from("gpt_consultas_log")
      .select("pregunta,categoria_detectada,modulo,rol,respondida,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const rows = logs ?? [];
    const total = rows.length;
    const sin_respuesta = rows.filter((r) => !r.respondida).length;

    const countBy = <T extends string | null>(key: (r: (typeof rows)[number]) => T) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = (key(r) ?? "sin_definir") as string;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m.entries())
        .map(([nombre, count]) => ({ nombre, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    return {
      total,
      sin_respuesta,
      top_categorias: countBy((r) => r.categoria_detectada),
      top_modulos: countBy((r) => r.modulo),
      top_roles: countBy((r) => r.rol),
      top_preguntas: countBy((r) => r.pregunta?.slice(0, 80) ?? null),
      ultimas_sin_respuesta: rows
        .filter((r) => !r.respondida)
        .slice(0, 20)
        .map((r) => ({ pregunta: r.pregunta, created_at: r.created_at })),
    };
  });
