import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// NUVEX GPT (chat flotante) — solo persistencia y escalamiento.
// La KB y el log unificado viven en nuvex-ia.functions.ts / nuvex-kb-admin.functions.ts.
// ============================================================

// ============ Conversaciones / mensajes (chat flotante) ============
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

// ============ Tickets escalados ============
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
