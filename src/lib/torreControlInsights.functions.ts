/**
 * Torre de Control NUVIA — Insights IA on-demand.
 *
 * - Protegida con requireSupabaseAuth + verificación de rol directivo.
 * - Cache en memoria 1h por (userId, period).
 * - NO envía PII al modelo. Solo snapshot agregado (números).
 * - Usa Lovable AI Gateway directamente vía fetch (mismo patrón que
 *   src/routes/api/nuvex-ia-stream.ts).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getTorreMetrics, type TorreMetricsPayload } from "./torreControlMetrics.functions";

const ROLES_EJECUTIVOS = [
  "super_admin",
  "admin",
  "gerencia",
  "director_financiero_qa",
  "director_juridico",
] as const;

const InputSchema = z.object({
  period: z.enum(["today", "7d", "mtd", "qtd", "ytd"]).default("mtd"),
});

export interface ExecutiveInsight {
  id: string;
  severidad: "info" | "warning" | "danger";
  titulo: string;
  narrativa: string;
  accion: string;
}

export interface InsightsPayload {
  period: string;
  generatedAt: string;
  cached: boolean;
  insights: ExecutiveInsight[];
}

// In-memory cache (worker process; aceptable para v1)
type CacheEntry = { at: number; payload: InsightsPayload };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1h

function buildSnapshot(m: TorreMetricsPayload): string {
  const k = Object.fromEntries(m.kpis.map((x) => [x.key, { value: x.value, delta: x.delta }]));
  const aging = Object.fromEntries(m.aging.map((a) => [a.bucket, a.total]));
  return JSON.stringify({
    periodo: m.period,
    kpis: k,
    funnel: m.funnel.map((f) => ({ etapa: f.label, casos: f.count })),
    aging,
    productividad: m.productividad.map((p) => ({ area: p.area, casos: p.casos, sla_pct: p.sla_pct })),
    proyeccion: {
      meta_mes: m.meta.metaHonorariosMes,
      facturado_mtd: m.proyeccionHonorarios[0]?.facturado ?? 0,
      proyectado_fin_mes: m.proyeccionHonorarios[1]?.proyectado ?? 0,
    },
    casos_estancados: m.risks.length,
  });
}

function fallbackInsights(m: TorreMetricsPayload): ExecutiveInsight[] {
  const out: ExecutiveInsight[] = [];
  const honFact = m.kpis.find((k) => k.key === "honorarios")?.value ?? 0;
  const meta = m.meta.metaHonorariosMes;
  if (honFact < meta * 0.4) {
    out.push({
      id: "meta-baja",
      severidad: "warning",
      titulo: "Avance bajo vs meta del mes",
      narrativa: `Facturado actual representa el ${((honFact / meta) * 100).toFixed(0)}% de la meta mensual.`,
      accion: "Revisar pipeline de honorarios próximos a facturar y acelerar QA.",
    });
  }
  if (m.risks.length >= 3) {
    out.push({
      id: "estancados",
      severidad: "danger",
      titulo: `${m.risks.length} casos sin movimiento`,
      narrativa: "Existen casos activos con más de 7 días sin actualización.",
      accion: "Reasignar carga o priorizar seguimiento del responsable.",
    });
  }
  const vencida = m.aging.find((a) => a.bucket === "90+")?.total ?? 0;
  if (vencida > 0) {
    out.push({
      id: "cartera-90",
      severidad: "warning",
      titulo: "Cartera vencida >90 días",
      narrativa: `Hay cartera con más de 90 días por valor estimado.`,
      accion: "Activar plan de cobro prejurídico y revisar acuerdos.",
    });
  }
  if (!out.length) {
    out.push({
      id: "ok",
      severidad: "info",
      titulo: "Operación dentro de parámetros",
      narrativa: "No se detectaron desviaciones críticas en el periodo.",
      accion: "Mantener foco en cierres y conversión del pipeline activo.",
    });
  }
  return out;
}

export const getTorreInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authz
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);
    if (!roles.some((r) => (ROLES_EJECUTIVOS as readonly string[]).includes(r))) {
      throw new Error("Forbidden");
    }

    const cacheKey = `${userId}::${data.period}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return { ...hit.payload, cached: true } satisfies InsightsPayload;
    }

    // Compute metrics snapshot (reuse server fn handler — call as plain fn)
    const metrics = await getTorreMetrics({ data: { period: data.period } });
    const snapshot = buildSnapshot(metrics);

    let insights: ExecutiveInsight[] = [];
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (LOVABLE_API_KEY) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Eres NUVIA, asistente ejecutivo de un ERP de negociación bancaria. " +
                  "Recibes un snapshot agregado (sin datos personales) y devuelves entre 3 y 5 insights " +
                  "ejecutivos priorizados en JSON estricto. Cada insight: {id, severidad (info|warning|danger), titulo, narrativa, accion}. " +
                  "No inventes cifras: solo razona sobre el snapshot. Responde SOLO con JSON: {\"insights\":[...]}.",
              },
              { role: "user", content: snapshot },
            ],
            temperature: 0.2,
          }),
        });
        if (resp.ok) {
          const json = (await resp.json()) as any;
          const txt: string = json?.choices?.[0]?.message?.content ?? "";
          const cleaned = txt.replace(/^```json|```$/g, "").trim();
          try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed?.insights)) {
              insights = parsed.insights
                .slice(0, 5)
                .map((i: any, idx: number) => ({
                  id: String(i.id ?? `ia-${idx}`),
                  severidad: (["info", "warning", "danger"].includes(i.severidad) ? i.severidad : "info") as ExecutiveInsight["severidad"],
                  titulo: String(i.titulo ?? "Insight"),
                  narrativa: String(i.narrativa ?? "").slice(0, 400),
                  accion: String(i.accion ?? "").slice(0, 240),
                }));
            }
          } catch {
            /* fall through to fallback */
          }
        }
      } catch (err) {
        console.error("[torre-insights] gateway error", err);
      }
    }

    if (!insights.length) insights = fallbackInsights(metrics);

    const payload: InsightsPayload = {
      period: data.period,
      generatedAt: new Date().toISOString(),
      cached: false,
      insights,
    };
    cache.set(cacheKey, { at: Date.now(), payload });
    return payload;
  });
