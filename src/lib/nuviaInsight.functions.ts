/**
 * NUVIA · Insight server fn (Fase 7.6.1B)
 *
 * Devuelve UNA tarjeta premium con Riesgo / Oportunidad / Acción
 * generada por NUVIA IA a partir de datos REALES del scope solicitado.
 *
 * SIN MOCKS. SIN HARDCODE. Si no hay datos suficientes:
 *   { state: "empty", reason }.
 *
 * Reglas:
 *  - Protegida con requireSupabaseAuth.
 *  - Snapshot agregado (sin PII).
 *  - Cache en memoria 1h por (userId, scope).
 *  - Fallback determinista cuando la IA no responde (también basado en datos reales).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ScopeEnum = z.enum([
  "dashboard",
  "cartera",
  "casos",
  "productividad",
  "finanzas",
  "qa",
  "torre",
]);
export type InsightScope = z.infer<typeof ScopeEnum>;

const Input = z.object({ scope: ScopeEnum });

export interface NuviaInsightPayload {
  scope: InsightScope;
  state: "ready" | "empty";
  reason?: string;
  generatedAt: string;
  cached: boolean;
  /** Riesgo, oportunidad, acción — narrativos. */
  riesgo: string | null;
  oportunidad: string | null;
  accion: string | null;
}

type CacheEntry = { at: number; payload: NuviaInsightPayload };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

const MIN_DATOS = 5; // umbral mínimo de filas para emitir insight

interface Snapshot {
  scope: InsightScope;
  counts: Record<string, number>;
  totales: Record<string, number>;
  notas: string[];
}

async function buildSnapshot(
  supabase: any,
  scope: InsightScope,
): Promise<{ snap: Snapshot; muestras: number }> {
  const snap: Snapshot = { scope, counts: {}, totales: {}, notas: [] };
  let muestras = 0;

  if (scope === "dashboard" || scope === "casos") {
    const { data } = await supabase
      .from("expedientes")
      .select("id, estado, estado_caso, honorarios_final, updated_at, banco");
    const rows = (data ?? []) as Array<{
      estado: string;
      estado_caso: string | null;
      honorarios_final: number | null;
      updated_at: string | null;
      banco: string | null;
    }>;
    muestras = rows.length;
    const porEstado: Record<string, number> = {};
    const porBanco: Record<string, number> = {};
    let estancados = 0;
    const ahora = Date.now();
    for (const r of rows) {
      porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;
      if (r.banco) porBanco[r.banco] = (porBanco[r.banco] ?? 0) + 1;
      if (r.updated_at && ahora - new Date(r.updated_at).getTime() > 10 * 86400000) {
        estancados++;
      }
    }
    snap.counts = { ...porEstado, _total: rows.length, _estancados: estancados };
    snap.totales.honorarios = rows.reduce((s, r) => s + Number(r.honorarios_final ?? 0), 0);
    const topBanco = Object.entries(porBanco).sort((a, b) => b[1] - a[1])[0];
    if (topBanco) snap.notas.push(`banco_top:${topBanco[0]}:${topBanco[1]}`);
  }

  if (scope === "cartera" || scope === "finanzas") {
    const { data } = await supabase
      .from("cartera")
      .select("honorarios_totales, pagado, fecha_vencimiento, estado_cartera");
    const rows = (data ?? []) as Array<{
      honorarios_totales: number;
      pagado: number;
      fecha_vencimiento: string;
      estado_cartera: string;
    }>;
    muestras = Math.max(muestras, rows.length);
    let totalHon = 0, totalPag = 0, vencida = 0, casos = 0;
    const hoy = Date.now();
    for (const c of rows) {
      casos++;
      totalHon += Number(c.honorarios_totales);
      totalPag += Number(c.pagado);
      const saldo = Number(c.honorarios_totales) - Number(c.pagado);
      if (saldo > 0 && new Date(c.fecha_vencimiento).getTime() < hoy) vencida += saldo;
    }
    snap.counts._cartera = casos;
    snap.totales = { ...snap.totales, totalHon, totalPag, vencida, saldo: totalHon - totalPag };
  }

  if (scope === "productividad") {
    const { data } = await supabase
      .from("expedientes")
      .select("estado, asesor_id, updated_at");
    const rows = (data ?? []) as Array<{ estado: string; asesor_id: string | null; updated_at: string | null }>;
    muestras = Math.max(muestras, rows.length);
    const porAsesor = new Map<string, number>();
    for (const r of rows) {
      if (!r.asesor_id) continue;
      porAsesor.set(r.asesor_id, (porAsesor.get(r.asesor_id) ?? 0) + 1);
    }
    snap.counts._asesores = porAsesor.size;
    snap.counts._casos = rows.length;
  }

  if (scope === "qa") {
    // QA = expedientes con estado_caso de QA o validación pendiente
    const { data } = await supabase
      .from("expedientes")
      .select("id, estado, estado_caso");
    const rows = (data ?? []) as Array<{ estado: string; estado_caso: string | null }>;
    muestras = Math.max(muestras, rows.length);
    snap.counts._qa = rows.filter((r) =>
      (r.estado_caso ?? "").toLowerCase().includes("qa") ||
      (r.estado_caso ?? "").toLowerCase().includes("valid"),
    ).length;
    snap.counts._total = rows.length;
  }

  if (scope === "torre") {
    // Reusa snapshot dashboard
    const { data } = await supabase
      .from("expedientes")
      .select("id, estado, updated_at");
    const rows = (data ?? []) as Array<{ estado: string; updated_at: string | null }>;
    muestras = Math.max(muestras, rows.length);
    snap.counts._total = rows.length;
  }

  return { snap, muestras };
}

function emptyPayload(scope: InsightScope, reason: string): NuviaInsightPayload {
  return {
    scope,
    state: "empty",
    reason,
    generatedAt: new Date().toISOString(),
    cached: false,
    riesgo: null,
    oportunidad: null,
    accion: null,
  };
}

function deterministicInsight(snap: Snapshot): { riesgo: string; oportunidad: string; accion: string } {
  const { scope, counts, totales, notas } = snap;

  if (scope === "cartera" || scope === "finanzas") {
    const vencida = totales.vencida ?? 0;
    const saldo = totales.saldo ?? 0;
    return {
      riesgo:
        vencida > 0
          ? `Cartera vencida estimada en $${Math.round(vencida).toLocaleString("es-CO")} con riesgo de deterioro si no se gestiona esta semana.`
          : "No se detecta cartera vencida significativa en el periodo.",
      oportunidad:
        saldo > 0
          ? `Saldo por recaudar de $${Math.round(saldo).toLocaleString("es-CO")} disponible para acelerar flujo de caja.`
          : "Recaudo al día — foco en mantener tiempos de pago.",
      accion:
        vencida > 0
          ? "Priorizar contacto con clientes en mora >5 días y activar plan de recordatorios."
          : "Mantener seguimiento preventivo a vencimientos próximos.",
    };
  }

  if (scope === "productividad") {
    const asesores = counts._asesores ?? 0;
    const casos = counts._casos ?? 0;
    const carga = asesores ? Math.round(casos / asesores) : 0;
    return {
      riesgo:
        carga > 25
          ? `Carga promedio de ${carga} casos por asesor — riesgo de saturación operativa.`
          : "Distribución de carga dentro de rangos operativos.",
      oportunidad: `Existen ${asesores} asesores activos gestionando ${casos} expedientes — espacio para balancear o reasignar.`,
      accion:
        carga > 25
          ? "Revisar reasignación de los asesores con mayor carga vs los de menor actividad."
          : "Mantener foco en cierre de los casos más antiguos por asesor.",
    };
  }

  // dashboard / casos / qa / torre
  const total = counts._total ?? 0;
  const estancados = counts._estancados ?? 0;
  const topBanco = notas.find((n) => n.startsWith("banco_top:"));
  const bancoStr = topBanco ? topBanco.split(":")[1] : null;
  return {
    riesgo:
      estancados > 0
        ? `${estancados} expedientes con más de 10 días sin movimiento — riesgo de caducidad o pérdida de momentum comercial.`
        : "Sin expedientes estancados detectados en el periodo.",
    oportunidad:
      bancoStr
        ? `${bancoStr} concentra el mayor volumen — oportunidad de profundizar relación bancaria y SLA preferente.`
        : `Operación con ${total} expedientes activos disponibles para impulsar conversión.`,
    accion:
      estancados > 0
        ? `Priorizar revisión inmediata de los ${estancados} casos estancados y reasignar si aplica.`
        : "Mantener cadencia de seguimiento semanal por etapa del pipeline.",
  };
}

export const getNuviaInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = `${userId}::${data.scope}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return { ...hit.payload, cached: true } satisfies NuviaInsightPayload;
    }

    const { snap, muestras } = await buildSnapshot(supabase, data.scope);
    if (muestras < MIN_DATOS) {
      const payload = emptyPayload(
        data.scope,
        "Sin suficientes datos históricos para generar recomendaciones.",
      );
      cache.set(key, { at: Date.now(), payload });
      return payload;
    }

    // Intento IA real
    let ai: { riesgo: string; oportunidad: string; accion: string } | null = null;
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (LOVABLE_API_KEY) {
      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Eres NUVIA, asistente ejecutivo de un ERP de negociación bancaria colombiano (NUVEX). " +
                  "Recibes un snapshot agregado (sin datos personales) de un scope operativo. " +
                  "Devuelves SIEMPRE JSON estricto: {\"riesgo\": string, \"oportunidad\": string, \"accion\": string}. " +
                  "Cada campo: una frase clara, accionable, máximo 200 caracteres, en español. " +
                  "No inventes cifras: razona solo sobre los datos del snapshot. Sin saludos.",
              },
              { role: "user", content: JSON.stringify(snap) },
            ],
            temperature: 0.2,
          }),
        });
        if (resp.ok) {
          const j = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const txt = (j?.choices?.[0]?.message?.content ?? "").replace(/^```json|```$/g, "").trim();
          const parsed = JSON.parse(txt);
          if (parsed?.riesgo && parsed?.oportunidad && parsed?.accion) {
            ai = {
              riesgo: String(parsed.riesgo).slice(0, 240),
              oportunidad: String(parsed.oportunidad).slice(0, 240),
              accion: String(parsed.accion).slice(0, 240),
            };
          }
        }
      } catch (err) {
        console.error("[nuvia-insight] gateway", err);
      }
    }

    const insight = ai ?? deterministicInsight(snap);
    const payload: NuviaInsightPayload = {
      scope: data.scope,
      state: "ready",
      generatedAt: new Date().toISOString(),
      cached: false,
      riesgo: insight.riesgo,
      oportunidad: insight.oportunidad,
      accion: insight.accion,
    };
    cache.set(key, { at: Date.now(), payload });
    return payload;
  });
