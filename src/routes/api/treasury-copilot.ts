import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/treasury-copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }), {
              status: 500, headers: { "Content-Type": "application/json" },
            });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });

          const body = (await request.json()) as { messages: Msg[]; contexto: unknown };
          const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
          const contexto = body.contexto ?? {};

          const systemPrompt = `Eres **NUVIA Treasury Copilot**, un asistente financiero experto en tesorería, cartera y flujo de caja.

Responde SIEMPRE en español, profesional y concreto, en Markdown.
- Usa SOLO la información del snapshot proporcionado abajo.
- Si la pregunta no se puede responder con esos datos, dilo explícitamente y sugiere qué cargar.
- Cuando cites cifras usa formato "$1.234.567" (es-CO).
- Para listas usa bullet points o tablas pequeñas en Markdown.
- Sé breve: máximo 6-8 líneas salvo que pidan detalle.

SNAPSHOT FINANCIERO (fecha ${(contexto as { fecha?: string }).fecha ?? "hoy"}):
\`\`\`json
${JSON.stringify(contexto, null, 2)}
\`\`\``;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                ...messages.map((m) => ({ role: m.role, content: m.content })),
              ],
            }),
          });

          if (!aiResp.ok) {
            const status = aiResp.status;
            const msg =
              status === 429 ? "Límite de consultas alcanzado. Intenta en unos minutos."
              : status === 402 ? "Créditos de IA agotados."
              : "Error del servicio de IA.";
            return new Response(JSON.stringify({ error: msg }), {
              status, headers: { "Content-Type": "application/json" },
            });
          }
          const j = await aiResp.json();
          const respuesta = j.choices?.[0]?.message?.content ?? "Sin respuesta.";
          return new Response(JSON.stringify({ respuesta }), {
            status: 200, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
