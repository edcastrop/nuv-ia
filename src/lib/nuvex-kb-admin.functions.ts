import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  const ok = roles.some((r: string) => ["super_admin", "admin", "gerencia"].includes(r));
  if (!ok) throw new Error("No autorizado");
  return roles;
}

export const kbList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const { data, error } = await supabase
      .from("nuvex_kb")
      .select("id, categoria, pregunta, respuesta, tags, audiencias, estado, created_at, updated_at")
      .order("categoria", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; categoria: string; pregunta: string; respuesta: string;
      tags: string[]; audiencias: string[]; estado: string; created_at: string; updated_at: string;
    }>;
  });


export const kbUpsert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      categoria: z.string().min(2).max(120),
      pregunta: z.string().min(3).max(500),
      respuesta: z.string().min(3).max(8000),
      tags: z.array(z.string().min(1).max(40)).max(20).default([]),
      audiencias: z.array(z.enum(["interno", "apoderado", "cliente", "publico"]))
        .min(1).max(4).default(["interno"]),
      estado: z.enum(["activo", "borrador", "archivado"]).default("activo"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    await ensureManager(supabase, userId);

    if (data.id) {
      const { error } = await supabase.from("nuvex_kb").update({
        categoria: data.categoria,
        pregunta: data.pregunta,
        respuesta: data.respuesta,
        tags: data.tags,
        audiencias: data.audiencias,
        estado: data.estado,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    } else {
      const { data: row, error } = await supabase.from("nuvex_kb").insert({
        categoria: data.categoria,
        pregunta: data.pregunta,
        respuesta: data.respuesta,
        tags: data.tags,
        audiencias: data.audiencias,
        estado: data.estado,
        creado_por: userId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { id: row.id as string };
    }
  });


export const kbDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    await ensureManager(supabase, userId);
    const { error } = await supabase.from("nuvex_kb").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const FiltrosSchema = z.object({
  desde: z.string().datetime().optional(),
  hasta: z.string().datetime().optional(),
  origen: z.enum(["nuvex_ia", "nuvex_gpt", "cliente"]).optional(),
  fuente: z.enum(["kb", "modelo", "escalado"]).optional(),
  modulo: z.string().max(60).optional(),
  rol: z.string().max(60).optional(),
  audiencia: z.enum(["interno", "apoderado", "cliente", "publico"]).optional(),
}).default({});

type Filtros = z.infer<typeof FiltrosSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros(q: any, f: Filtros) {
  const desde = f.desde ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  q = q.gte("created_at", desde);
  if (f.hasta) q = q.lte("created_at", f.hasta);
  if (f.origen) q = q.eq("origen", f.origen);
  if (f.fuente) q = q.eq("fuente", f.fuente);
  if (f.modulo) q = q.eq("modulo", f.modulo);
  if (f.rol) q = q.eq("rol", f.rol);
  if (f.audiencia) q = q.eq("audiencia", f.audiencia);
  return q;
}

export const kbAnalitica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FiltrosSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    await ensureManager(supabase, userId);

    let q = supabase
      .from("nuvex_ia_log")
      .select("origen, fuente, modulo, rol, audiencia, pregunta, tiempo_respuesta_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(2000);
    q = aplicarFiltros(q, data);
    const { data: logs } = await q;

    const rows = (logs ?? []) as Array<{
      origen: string; fuente: string; modulo: string | null; rol: string | null;
      audiencia: string | null;
      pregunta: string; tiempo_respuesta_ms: number | null; created_at: string;
    }>;

    const total = rows.length;
    const por = (key: "origen" | "fuente" | "modulo" | "rol" | "audiencia") => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = (r[key] ?? "—") as string;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return [...m.entries()].map(([nombre, count]) => ({ nombre, count }))
        .sort((a, b) => b.count - a.count).slice(0, 10);
    };

    const escalados = rows.filter((r) => r.fuente === "escalado").length;
    const desdeKb = rows.filter((r) => r.fuente === "kb").length;
    const avgMs = total ? Math.round(rows.reduce((s, r) => s + (r.tiempo_respuesta_ms ?? 0), 0) / total) : 0;

    return {
      total, desdeKb, escalados, avgMs,
      top_origen: por("origen"),
      top_fuente: por("fuente"),
      top_modulo: por("modulo"),
      top_rol: por("rol"),
      top_audiencia: por("audiencia"),
      ultimas_escaladas: rows.filter((r) => r.fuente === "escalado").slice(0, 20)
        .map((r) => ({ pregunta: r.pregunta, created_at: r.created_at, modulo: r.modulo })),
    };
  });

export const kbAnaliticaExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FiltrosSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    await ensureManager(supabase, userId);

    let q = supabase
      .from("nuvex_ia_log")
      .select("created_at, origen, fuente, modulo, rol, audiencia, nombre_usuario, pregunta, respuesta, tiempo_respuesta_ms")
      .order("created_at", { ascending: false })
      .limit(5000);
    q = aplicarFiltros(q, data);
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);

    const headers = ["fecha", "origen", "fuente", "modulo", "rol", "audiencia", "usuario", "pregunta", "respuesta", "tiempo_ms"];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    };
    const lines = [headers.join(",")];
    for (const r of (logs ?? []) as Array<Record<string, unknown>>) {
      lines.push([
        r.created_at, r.origen, r.fuente, r.modulo, r.rol, r.audiencia,
        r.nombre_usuario, r.pregunta, r.respuesta, r.tiempo_respuesta_ms,
      ].map(escape).join(","));
    }
    return { csv: lines.join("\n"), total: (logs ?? []).length };
  });
