import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Copiloto QA: IA bajo demanda que INTERPRETA auditorías, alertas, reglas
// y dictámenes ya existentes. NO recalcula matemática — solo lee y explica.
export const Route = createFileRoute("/api/qa-copilot")({
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
            return Response.json({ error: "LOVABLE_API_KEY no configurada" }, { status: 500 });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          // Validar acceso QA (mismo guard que el resto del módulo)
          const { data: canUse } = await supabase.rpc("can_use_qa_ai", { _uid: userId });
          if (!canUse) return Response.json({ error: "Acceso restringido al módulo QA AI" }, { status: 403 });

          const body = (await request.json()) as { pregunta?: string; auditoriaId?: string | null };
          const pregunta = (body.pregunta ?? "").toString().slice(0, 800).trim();
          if (pregunta.length < 3) return Response.json({ error: "Pregunta demasiado corta" }, { status: 400 });
          const auditoriaId = body.auditoriaId ?? null;

          // ── Contexto agregado: NUNCA pasa inputs crudos al modelo, solo
          //    datos ya auditados y reglas configuradas.
          const [audsR, alertasR, reglasR, incsR] = await Promise.all([
            supabase
              .from("qa_auditorias")
              .select("id,modalidad,qa_score,categoria,dictamen,ejecutado_at")
              .order("ejecutado_at", { ascending: false })
              .limit(100),
            supabase
              .from("qa_alertas")
              .select("severidad,estado,tipo,mensaje,created_at")
              .order("created_at", { ascending: false })
              .limit(50),
            supabase
              .from("qa_reglas")
              .select("codigo,descripcion,tipo,payload,activa,version")
              .eq("activa", true)
              .order("codigo"),
            supabase
              .from("qa_inconsistencias")
              .select("tipo,severidad")
              .limit(500),
          ]);

          const auds = audsR.data ?? [];
          const total = auds.length;
          const aprob = auds.filter((a) => a.dictamen === "aprobado").length;
          const obs = auds.filter((a) => a.dictamen === "aprobado_obs").length;
          const rev = auds.filter((a) => a.dictamen === "requiere_revision").length;
          const rech = auds.filter((a) => a.dictamen === "rechazado").length;
          const scoreProm = total ? auds.reduce((s, a) => s + Number(a.qa_score ?? 0), 0) / total : 0;

          const alertas = alertasR.data ?? [];
          const alertasAbiertas = alertas.filter((a) => a.estado === "abierta");
          const alertasCriticas = alertasAbiertas.filter((a) => a.severidad === "critica");

          const reglas = reglasR.data ?? [];

          const tipoCount = new Map<string, number>();
          (incsR.data ?? []).forEach((i) => tipoCount.set(i.tipo, (tipoCount.get(i.tipo) ?? 0) + 1));
          const topIncs = Array.from(tipoCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

          // Contexto opcional: auditoría puntual (solo lectura del dictamen ya emitido)
          let auditoriaFoco = "";
          if (auditoriaId) {
            const { data: a } = await supabase
              .from("qa_auditorias")
              .select("modalidad,qa_score,categoria,dictamen,outputs,diferencias,alertas,motor_version,ejecutado_at")
              .eq("id", auditoriaId).maybeSingle();
            if (a) {
              auditoriaFoco = `\n## AUDITORÍA EN FOCO (${auditoriaId})\n` +
                `- Modalidad: ${a.modalidad}\n- Score: ${a.qa_score}\n- Categoría: ${a.categoria}\n` +
                `- Dictamen: ${a.dictamen}\n- Motor: v${a.motor_version}\n` +
                `- Ejecutada: ${a.ejecutado_at}\n` +
                `- Outputs (resumen): ${JSON.stringify(a.outputs).slice(0, 1200)}\n` +
                `- Inconsistencias detectadas: ${JSON.stringify(a.diferencias).slice(0, 1500)}\n` +
                `- Alertas críticas: ${JSON.stringify(a.alertas).slice(0, 800)}`;
            }
          }

          const ctx =
`## RESUMEN GLOBAL (últimas ${total} auditorías)
- Aprobados: ${aprob} · Con observaciones: ${obs} · Requieren revisión: ${rev} · Rechazados: ${rech}
- QA Score promedio: ${scoreProm.toFixed(1)}/100

## ALERTAS
- Abiertas: ${alertasAbiertas.length} · Críticas abiertas: ${alertasCriticas.length}
- Últimas críticas: ${alertasCriticas.slice(0, 5).map((a) => `[${a.tipo}] ${a.mensaje}`).join(" | ") || "ninguna"}

## TOP INCONSISTENCIAS
${topIncs.map(([t, c]) => `- ${t}: ${c}`).join("\n") || "- sin datos"}

## REGLAS ACTIVAS (${reglas.length})
${reglas.map((r) => `- ${r.codigo} (v${r.version}) [${r.tipo}]: ${JSON.stringify(r.payload)}`).join("\n")}
${auditoriaFoco}`;

          const systemPrompt =
`Eres **Copiloto QA de NUVIA**, un auditor matemático financiero senior.
REGLAS ESTRICTAS:
1. NO recalculas matemática. El motor determinístico ya corrió: tus cifras provienen exclusivamente del CONTEXTO.
2. Solo interpretas auditorías, alertas, reglas y dictámenes ya emitidos.
3. Si la información no está en el contexto, responde "No tengo evidencia auditada para responder eso" — NO inventes.
4. Cita los códigos de regla (ej. tol.cuota) cuando expliques una penalización.
5. Responde en español, profesional, en Markdown breve. Sin emojis.

CONTEXTO AUDITADO (datos reales, no recalcular):
${ctx}`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: pregunta },
              ],
            }),
          });

          if (!aiResp.ok) {
            const status = aiResp.status;
            const msg = status === 429 ? "Límite de consultas alcanzado. Intenta en unos minutos."
              : status === 402 ? "Créditos de IA agotados. Recarga en Workspace → Usage."
              : "Error del servicio de IA.";
            return Response.json({ error: msg }, { status });
          }
          const j = await aiResp.json();
          const respuesta = j.choices?.[0]?.message?.content ?? "Sin respuesta.";
          return Response.json({
            respuesta,
            contexto: { auditorias: total, alertasAbiertas: alertasAbiertas.length, reglasActivas: reglas.length },
          });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Error inesperado" }, { status: 500 });
        }
      },
    },
  },
});
