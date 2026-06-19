// Server route: NUVIA IA para pipeline. Recibe contexto compactado + pregunta
// y devuelve un análisis ejecutivo en Markdown.
import { createFileRoute } from "@tanstack/react-router";

type PipelineCtx = {
  total: number;
  estancados: number;
  promedioDias: number;
  honorarios: number;
  fases: Array<{ id: string; label: string; count: number }>;
  funnel: Array<{ numero: number; titulo: string; count: number; passed: number; pct: number; drop: number }>;
  topEstancados: Array<{
    cliente: string;
    banco: string | null;
    etapa: string;
    dias: number;
    analista: string;
  }>;
  sinAsesor: number;
  duplicados: number;
};

export const Route = createFileRoute("/api/pipeline-nuvia")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response(
              JSON.stringify({ error: "LOVABLE_API_KEY no configurada" }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          const body = (await request.json()) as {
            pregunta?: string;
            modo?: "diagnostico" | "chat";
            contexto: PipelineCtx;
          };

          const modo = body.modo ?? "diagnostico";
          const ctx = body.contexto;
          const pregunta = (body.pregunta ?? "").toString().slice(0, 800).trim();

          const ctxBlock = `## Pipeline (snapshot)
- Casos totales visibles: ${ctx.total}
- Estancados (sobre SLA): ${ctx.estancados}
- Días promedio en etapa: ${ctx.promedioDias}
- Honorarios proyectados: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(ctx.honorarios)}
- Casos sin analista: ${ctx.sinAsesor}
- Cédulas duplicadas: ${ctx.duplicados}

### Distribución por fase
${ctx.fases.map((f) => `- ${f.label}: ${f.count}`).join("\n")}

### Embudo E1 → E${ctx.funnel.length}
${ctx.funnel.map((f) => `- E${f.numero} ${f.titulo}: ${f.count} en etapa · ${f.passed} pasaron (${f.pct}%) · caída ${f.drop}%`).join("\n")}

### Top 8 estancados
${ctx.topEstancados.length === 0 ? "Ninguno" : ctx.topEstancados.map((c, i) => `${i + 1}. ${c.cliente} (${c.banco ?? "—"}) · ${c.etapa} · ${c.dias}d · ${c.analista}`).join("\n")}`;

          const systemPrompt =
            modo === "diagnostico"
              ? `Eres NUVIA, copiloto ejecutivo del Pipeline NUVEX. Genera un diagnóstico en español, ultra-conciso, en Markdown.
Estructura OBLIGATORIA:
**🩺 Diagnóstico** (1-2 frases con la lectura general)
**🚨 Foco hoy** (3-5 bullets accionables, cada uno con el qué hacer + a qué caso/etapa apunta)
**💡 Recomendaciones** (2-3 bullets de optimización: reasignaciones, llamadas, retiros)

Sé directo, sin relleno corporativo, tono humano de gerente de portafolio. No inventes datos: usa SOLO el snapshot.`
              : `Eres NUVIA, copiloto ejecutivo del Pipeline NUVEX. Responde en español, Markdown, conciso (máx 250 palabras). Usa SOLO el snapshot proporcionado; si la pregunta requiere datos que no están, dilo y sugiere cómo obtenerlos. Tono humano, directo.`;

          const userPrompt =
            modo === "diagnostico"
              ? `Analiza este pipeline y dame el diagnóstico ejecutivo.\n\n${ctxBlock}`
              : `${ctxBlock}\n\n## Pregunta del analista\n${pregunta || "Dame tu lectura del pipeline."}`;

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
                { role: "user", content: userPrompt },
              ],
            }),
          });

          if (!aiResp.ok) {
            const status = aiResp.status;
            const msg =
              status === 429
                ? "NUVIA recibió demasiadas consultas. Intenta en un minuto."
                : status === 402
                  ? "Créditos de IA agotados. Recarga desde Settings → Plans & credits."
                  : `Error del servicio de IA (${status}).`;
            return new Response(JSON.stringify({ error: msg }), {
              status,
              headers: { "Content-Type": "application/json" },
            });
          }

          const json = await aiResp.json();
          const respuesta =
            (json?.choices?.[0]?.message?.content as string | undefined)?.trim() ??
            "NUVIA no pudo generar una respuesta.";

          return new Response(JSON.stringify({ respuesta }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
