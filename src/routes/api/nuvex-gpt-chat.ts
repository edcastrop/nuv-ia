import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/nuvex-gpt-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userData.user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const userId = userData.user.id;

          // ── Rate limiting: máx 30 consultas por usuario por minuto ──────────

          const ventana = new Date(Date.now() - 60_000).toISOString();

          const { count: recentCount } = await supabase
            .from("nuvex_ia_log")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .gte("created_at", ventana);

          if ((recentCount ?? 0) >= 30) {
            return new Response(
              JSON.stringify({ error: "Has superado el límite de 30 consultas por minuto. Intenta de nuevo en unos segundos." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }

          // ────────────────────────────────────────────────────────────────────

          const body = (await request.json()) as {
            messages: Array<{ role: "user" | "assistant"; content: string }>;
            modulo_contexto?: string | null;
            conversacion_id?: string | null;
          };

          const messages = (body.messages ?? []).slice(-12);
          const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
          const modulo = (body.modulo_contexto ?? "").toLowerCase();

          // Resolve user role
          const { data: rolesData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          const roles: string[] = ((rolesData ?? []) as Array<{ role: string }>).map((r) => r.role);
          const rolPrincipal =
            roles.find((r) => ["super_admin", "admin", "gerencia"].includes(r)) ??
            roles[0] ??
            "licenciado";

          // KB retrieval: nuvex_kb (cerebro único)
          const q = lastUserMsg.trim();
          const terms = q
            .toLowerCase()
            .replace(/[^\wáéíóúñü\s]/gi, " ")
            .split(/\s+/)
            .filter((t) => t.length >= 3)
            .slice(0, 6);

          const orFilters =
            terms.length > 0
              ? terms
                  .map((t) => `pregunta.ilike.%${t}%,respuesta.ilike.%${t}%,categoria.ilike.%${t}%`)
                  .join(",")
              : "";

          let kbQuery = supabase
            .from("nuvex_kb")
            .select("id,categoria,pregunta,respuesta,tags")
            .eq("estado", "activo")
            .limit(6);
          if (orFilters) kbQuery = kbQuery.or(orFilters);

          const { data: kbRaw } = await kbQuery;
          let articulos = (kbRaw ?? []) as Array<{
            categoria: string;
            pregunta: string;
            respuesta: string;
            tags: string[] | null;
          }>;

          if (modulo) {
            articulos = articulos.sort((a, b) => {
              const sa = a.categoria.toLowerCase().includes(modulo) ? 1 : 0;
              const sb = b.categoria.toLowerCase().includes(modulo) ? 1 : 0;
              return sb - sa;
            });
          }

          const kbContext = articulos.length
            ? articulos
                .map((a, i) => `### [${i + 1}] ${a.categoria} — ${a.pregunta}\n${a.respuesta}`)
                .join("\n\n---\n\n")
            : "No hay artículos relevantes en la base de conocimiento NUVEX para esta consulta.";

          const systemPrompt = `Eres **NUVEX GPT**, el Copiloto Operativo Corporativo de NUVEX Finanzas Inteligentes.

ROL DEL USUARIO: ${rolPrincipal}
MÓDULO ACTUAL: ${modulo || "ninguno"}

REGLAS ESTRICTAS:
1. Responde SIEMPRE en español, tono profesional y cercano, breve y operativo.
2. Si la pregunta empieza con "¿Cómo hago…?" o pide pasos, responde en formato numerado: "Paso 1 / Paso 2 / Paso 3 / Paso 4".
3. Si es académica (qué es X, cómo funciona X conceptualmente), responde con: **Resumen**, **Concepto**, **Ejemplo práctico**, y al final sugiere el módulo Academia.
4. Si la información NO está en la base de conocimiento entregada, responde EXACTAMENTE:
   "No tengo información suficiente para responder con seguridad. Te recomiendo escalar esta consulta."
5. Si la pregunta pide información restringida para el rol "${rolPrincipal}" (por ejemplo, un Licenciado pidiendo nómina o cuentas internas de Contabilidad), responde:
   "Esta información está restringida para tu perfil de acceso."
6. Nunca inventes artículos de ley, decretos, normas, tarifas, ni datos financieros que no estén en la base de conocimiento.
7. Usa formato Markdown (encabezados, listas, negritas) para facilitar la lectura.
8. Cuando sea útil, sugiere escalar a Jurídica, Operaciones, Contabilidad o Director Financiero QA.

BASE DE CONOCIMIENTO RELEVANTE (úsala como fuente única de verdad):
${kbContext}`;

          // Log query en nuvex_ia_log (cerebro único)
          const categoriaDetectada = articulos[0]?.categoria ?? null;
          void supabase.from("nuvex_ia_log").insert({
            usuario_id: userId,
            rol: rolPrincipal,
            modulo: modulo || null,
            pregunta: q.slice(0, 2000),
            respuesta: categoriaDetectada ? `[KB: ${categoriaDetectada}]` : null,
            origen: "nuvex_gpt",
            fuente: articulos.length > 0 ? "kb" : "modelo",
          });

          // Call Lovable AI Gateway
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [{ role: "system", content: systemPrompt }, ...messages],
              stream: true,
            }),
          });

          if (!aiResp.ok) {
            if (aiResp.status === 429) {
              return new Response(
                JSON.stringify({
                  error: "Has superado el límite de consultas. Intenta de nuevo en unos minutos.",
                }),
                { status: 429, headers: { "Content-Type": "application/json" } },
              );
            }
            if (aiResp.status === 402) {
              return new Response(
                JSON.stringify({
                  error: "Créditos de Lovable AI agotados. Recarga en Settings > Workspace > Usage.",
                }),
                { status: 402, headers: { "Content-Type": "application/json" } },
              );
            }
            const txt = await aiResp.text();
            console.error("AI gateway error:", aiResp.status, txt);
            return new Response(JSON.stringify({ error: "Error del servicio de IA" }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          return new Response(aiResp.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (e) {
          console.error("nuvex-gpt-chat error", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
