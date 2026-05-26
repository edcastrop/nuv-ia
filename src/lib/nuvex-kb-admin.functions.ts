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
      .select("id, categoria, pregunta, respuesta, tags, estado, created_at, updated_at")
      .order("categoria", { ascending: true })
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string; categoria: string; pregunta: string; respuesta: string;
      tags: string[]; estado: string; created_at: string; updated_at: string;
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

export const kbAnalitica = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    await ensureManager(supabase, userId);

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabase
      .from("nuvex_ia_log")
      .select("origen, fuente, modulo, rol, pregunta, tiempo_respuesta_ms, created_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = (logs ?? []) as Array<{
      origen: string; fuente: string; modulo: string | null; rol: string | null;
      pregunta: string; tiempo_respuesta_ms: number | null; created_at: string;
    }>;

    const total = rows.length;
    const por = (key: "origen" | "fuente" | "modulo" | "rol") => {
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
      total,
      desdeKb,
      escalados,
      avgMs,
      top_origen: por("origen"),
      top_fuente: por("fuente"),
      top_modulo: por("modulo"),
      top_rol: por("rol"),
      ultimas_escaladas: rows.filter((r) => r.fuente === "escalado").slice(0, 20)
        .map((r) => ({ pregunta: r.pregunta, created_at: r.created_at, modulo: r.modulo })),
    };
  });
