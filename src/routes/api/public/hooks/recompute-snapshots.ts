/**
 * NUVIA Command Center — Cron diario 03:00 hora Colombia (08:00 UTC).
 *
 * Materializa los 3 snapshots ejecutivos:
 *   - executive_metrics_daily
 *   - health_score_daily
 *   - scoreboard_snapshot_daily  (por área)
 *
 * Seguridad: ruta /api/public/ bypasea auth en producción.
 *  - Exige header `apikey` con la anon key del proyecto (estándar pg_cron NUVIA).
 *  - Solo escribe en tablas del Command Center; nunca toca módulos congelados.
 */
import { createFileRoute } from "@tanstack/react-router";

const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

const AREA_BY_ROLE: Record<string, string> = {
  asesor: "comercial",
  juridica: "juridica",
  apoderado: "juridica",
  licenciado: "juridica",
  operaciones: "operaciones",
  auxiliar_operativo: "operaciones",
  cartera: "cartera",
  contabilidad: "cartera",
};

export const Route = createFileRoute("/api/public/hooks/recompute-snapshots")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("apikey");
        if (!provided || !ANON_KEY || provided !== ANON_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hoy = new Date().toISOString().slice(0, 10);
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthStartIso = monthStart.toISOString();

        try {
          // ---------- 1) Métricas ejecutivas ----------
          const [honos, expCreadosMTD, expCerradosMTD, expActivos, cartera, expConSLA] =
            await Promise.all([
              supabaseAdmin
                .from("honorarios_calculos")
                .select("ahorro_total, honorario_ofertado, estado, created_at")
                .gte("created_at", monthStartIso),
              supabaseAdmin
                .from("expedientes")
                .select("id", { count: "exact", head: true })
                .gte("created_at", monthStartIso),
              supabaseAdmin
                .from("expedientes")
                .select("id, asesor_id, estado, updated_at")
                .in("estado", ["APROBADO", "FACTURADO", "PAGADO"])
                .gte("updated_at", monthStartIso),
              supabaseAdmin
                .from("expedientes")
                .select("id", { count: "exact", head: true })
                .not("estado_caso", "in", "(perdido,cerrado)"),
              supabaseAdmin
                .from("cartera")
                .select("honorarios_totales, pagado, fecha_vencimiento, estado_cartera"),
              supabaseAdmin
                .from("expedientes")
                .select("id, fecha_sla, estado_caso")
                .not("fecha_sla", "is", null),
            ]);

          const honorariosMTD = (honos.data ?? [])
            .filter((h: any) => h.estado === "aprobado" || h.estado === "ofertado")
            .reduce((s: number, r: any) => s + num(r.honorario_ofertado), 0);
          const ahorroMTD = (honos.data ?? []).reduce(
            (s: number, r: any) => s + num(r.ahorro_total),
            0,
          );
          const casosCerradosMTD = (expCerradosMTD.data ?? []).length;
          const casosCreadosMTD = expCreadosMTD.count ?? 0;
          const conversionMTD =
            casosCreadosMTD > 0
              ? Number(((casosCerradosMTD / casosCreadosMTD) * 100).toFixed(1))
              : 0;
          const casosActivos = expActivos.count ?? 0;
          const carteraTotal = (cartera.data ?? []).reduce(
            (s: number, r: any) => s + Math.max(0, num(r.honorarios_totales) - num(r.pagado)),
            0,
          );
          const carteraRecuperadaMTD = (cartera.data ?? [])
            .filter((r: any) => r.estado_cartera === "pagada")
            .reduce((s: number, r: any) => s + num(r.pagado), 0);

          const totalSLA = (expConSLA.data ?? []).length;
          const slaVencidos = (expConSLA.data ?? []).filter(
            (r: any) =>
              r.fecha_sla &&
              new Date(r.fecha_sla as string).getTime() < Date.now() &&
              !["perdido", "cerrado"].includes((r.estado_caso as string) ?? ""),
          ).length;
          const slaScore = totalSLA > 0 ? clamp(100 - (slaVencidos / totalSLA) * 100) : 100;

          const metricsJson = {
            honorarios_mtd: honorariosMTD,
            ahorro_mtd: ahorroMTD,
            casos_cerrados_mtd: casosCerradosMTD,
            casos_creados_mtd: casosCreadosMTD,
            casos_activos: casosActivos,
            conversion_mtd: conversionMTD,
            cartera_total: carteraTotal,
            cartera_recuperada_mtd: carteraRecuperadaMTD,
            sla_vencidos: slaVencidos,
            sla_total: totalSLA,
          };

          await supabaseAdmin
            .from("executive_metrics_daily")
            .upsert({ fecha: hoy, metrics_json: metricsJson, calculated_at: new Date().toISOString() });

          // ---------- 2) Health Score ----------
          // 25% Producción: casos activos / objetivo (200 default) cap 100
          const produccionScore = clamp((casosActivos / 200) * 100);
          // 25% Conversión: ya 0-100
          const conversionScore = clamp(conversionMTD);
          // 20% Cartera: 100 - (cartera vencida / total) × 100
          const carteraVencida = (cartera.data ?? [])
            .filter(
              (r: any) =>
                r.fecha_vencimiento &&
                new Date(r.fecha_vencimiento as string).getTime() < Date.now() &&
                num(r.honorarios_totales) - num(r.pagado) > 0,
            )
            .reduce((s: number, r: any) => s + Math.max(0, num(r.honorarios_totales) - num(r.pagado)), 0);
          const carteraScore =
            carteraTotal > 0 ? clamp(100 - (carteraVencida / carteraTotal) * 100) : 100;
          // 15% SLA
          // 15% Actividad: usuarios activos últimos 7d / total usuarios
          const { data: profilesAll } = await supabaseAdmin.from("profiles").select("id, ultimo_acceso");
          const total = (profilesAll ?? []).length || 1;
          const activos7d = (profilesAll ?? []).filter(
            (p: any) =>
              p.ultimo_acceso && Date.now() - new Date(p.ultimo_acceso as string).getTime() <= 7 * 86400000,
          ).length;
          const actividadScore = clamp((activos7d / total) * 100);

          // 10% Satisfacción Cliente = 50% NPS_norm + 25% tasa_testimonios + 25% tasa_referidos
          const [clientesAll, testimoniosOk, referidosCount, clientesCerrados] = await Promise.all([
            supabaseAdmin.from("clientes").select("nps_ultimo"),
            supabaseAdmin
              .from("testimonios")
              .select("id", { count: "exact", head: true })
              .eq("consentimiento_uso", true),
            supabaseAdmin.from("casos_referidos").select("id", { count: "exact", head: true }),
            supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }),
          ]);
          const npsValues = (clientesAll.data ?? [])
            .map((c: any) => Number(c.nps_ultimo))
            .filter((n) => Number.isFinite(n));
          // NPS normalizado a 0-100 (NPS va de -100 a 100; aquí asumimos 0-10 escala individual)
          const npsAvg =
            npsValues.length > 0
              ? npsValues.reduce((s, n) => s + n, 0) / npsValues.length
              : 7; // neutral mientras no haya data
          const npsNorm = clamp((npsAvg / 10) * 100);
          const cerradosCount = clientesCerrados.count ?? 0;
          const tasaTestimonios = cerradosCount > 0 ? clamp(((testimoniosOk.count ?? 0) / cerradosCount) * 100) : 0;
          const tasaReferidos = cerradosCount > 0 ? clamp(((referidosCount.count ?? 0) / cerradosCount) * 100) : 0;
          const satisfaccionScore = clamp(0.5 * npsNorm + 0.25 * tasaTestimonios + 0.25 * tasaReferidos);

          // Health Score v2 (Fase 7.6.1)
          const healthScore =
            0.25 * produccionScore +
            0.20 * conversionScore +
            0.20 * carteraScore +
            0.15 * slaScore +
            0.10 * actividadScore +
            0.10 * satisfaccionScore;

          const estado: "excelente" | "saludable" | "atencion" | "riesgo" | "critico" =
            healthScore >= 90
              ? "excelente"
              : healthScore >= 75
                ? "saludable"
                : healthScore >= 60
                  ? "atencion"
                  : healthScore >= 40
                    ? "riesgo"
                    : "critico";

          // Tendencia: comparar con score de ayer
          const { data: ayerHS } = await supabaseAdmin
            .from("health_score_daily")
            .select("score")
            .order("fecha", { ascending: false })
            .limit(1)
            .maybeSingle();
          const tendencia: "mejora" | "estable" | "deterioro" = ayerHS
            ? healthScore > num(ayerHS.score) + 1
              ? "mejora"
              : healthScore < num(ayerHS.score) - 1
                ? "deterioro"
                : "estable"
            : "estable";

          await supabaseAdmin.from("health_score_daily").upsert({
            fecha: hoy,
            score: Math.round(healthScore * 10) / 10,
            componentes_json: {
              produccion: Math.round(produccionScore),
              conversion: Math.round(conversionScore),
              cartera: Math.round(carteraScore),
              sla: Math.round(slaScore),
              actividad: Math.round(actividadScore),
              satisfaccion: Math.round(satisfaccionScore),
            },
            estado,
            tendencia,
            calculated_at: new Date().toISOString(),
          });

          // ---------- 2b) SLA dinámico por banco (Fase 7.6.1) ----------
          const { data: expBancos } = await supabaseAdmin
            .from("expedientes")
            .select("id, banco, estado_caso, fecha_radicacion, fecha_respuesta_banco, fecha_sla, created_at");
          const byBanco = new Map<string, any[]>();
          for (const e of expBancos ?? []) {
            const b = ((e as any).banco as string)?.trim();
            if (!b) continue;
            if (!byBanco.has(b)) byBanco.set(b, []);
            byBanco.get(b)!.push(e);
          }
          const { data: reqsAll } = await supabaseAdmin
            .from("banco_requerimientos")
            .select("banco, expediente_id");
          const reqsByBanco = new Map<string, number>();
          for (const r of reqsAll ?? []) {
            const b = ((r as any).banco as string)?.trim();
            if (!b) continue;
            reqsByBanco.set(b, (reqsByBanco.get(b) ?? 0) + 1);
          }
          const slaInserts: any[] = [];
          for (const [banco, casos] of byBanco.entries()) {
            const conRespuesta = casos.filter(
              (c: any) => c.fecha_radicacion && c.fecha_respuesta_banco,
            );
            const tiempos = conRespuesta.map((c: any) => {
              const ini = new Date(c.fecha_radicacion).getTime();
              const fin = new Date(c.fecha_respuesta_banco).getTime();
              return Math.max(0, (fin - ini) / 86400000);
            });
            const muestra = tiempos.length;
            const prom = muestra > 0 ? tiempos.reduce((s, t) => s + t, 0) / muestra : null;
            const max = muestra > 0 ? Math.round(Math.max(...tiempos)) : null;
            const min = muestra > 0 ? Math.round(Math.min(...tiempos)) : null;
            const abiertos = casos.filter(
              (c: any) =>
                c.fecha_radicacion &&
                !c.fecha_respuesta_banco &&
                !["perdido", "cerrado", "finalizado"].includes((c.estado_caso as string) ?? ""),
            ).length;
            const vencidos = casos.filter(
              (c: any) =>
                c.fecha_sla &&
                new Date(c.fecha_sla as string).getTime() < Date.now() &&
                !c.fecha_respuesta_banco,
            ).length;
            const totalCasos = casos.length || 1;
            const tasaReq = ((reqsByBanco.get(banco) ?? 0) / totalCasos) * 100;
            const favorables = casos.filter((c: any) =>
              ["aprobado", "favorable", "implementado", "finalizado"].includes(
                (c.estado_caso as string) ?? "",
              ),
            ).length;
            const tasaFav = (favorables / totalCasos) * 100;
            slaInserts.push({
              banco,
              fecha: hoy,
              casos_abiertos: abiertos,
              casos_vencidos: vencidos,
              tiempo_promedio_dias: prom != null ? Math.round(prom * 100) / 100 : null,
              tiempo_max_dias: max,
              tiempo_min_dias: min,
              tasa_requerimientos: Math.round(tasaReq * 100) / 100,
              tasa_favorable: Math.round(tasaFav * 100) / 100,
              muestra,
            });
          }
          if (slaInserts.length) {
            await supabaseAdmin
              .from("banco_sla_metricas")
              .upsert(slaInserts, { onConflict: "banco,fecha" });
          }


          // ---------- 3) Scoreboard por área ----------
          // Mapear usuarios → área
          const { data: rolesData } = await supabaseAdmin
            .from("user_roles")
            .select("user_id, role");
          const userArea = new Map<string, string>();
          for (const r of rolesData ?? []) {
            const area = AREA_BY_ROLE[(r as any).role];
            if (area && !userArea.has((r as any).user_id)) {
              userArea.set((r as any).user_id, area);
            }
          }

          // Casos cerrados por asesor MTD (proxy de productividad)
          const cerradosByAsesor = new Map<string, number>();
          for (const e of expCerradosMTD.data ?? []) {
            const id = (e as any).asesor_id as string | null;
            if (id) cerradosByAsesor.set(id, (cerradosByAsesor.get(id) ?? 0) + 1);
          }

          // Borrar snapshots de hoy (idempotente)
          await supabaseAdmin.from("scoreboard_snapshot_daily").delete().eq("fecha", hoy);

          // Agrupar por área y calcular score normalizado contra promedio del área
          const byArea = new Map<string, Array<{ usuario_id: string; cerrados: number }>>();
          for (const [usuario_id, area] of userArea.entries()) {
            const cerrados = cerradosByAsesor.get(usuario_id) ?? 0;
            if (!byArea.has(area)) byArea.set(area, []);
            byArea.get(area)!.push({ usuario_id, cerrados });
          }

          const inserts: any[] = [];
          for (const [area, miembros] of byArea.entries()) {
            const promedio =
              miembros.reduce((s, m) => s + m.cerrados, 0) / Math.max(1, miembros.length);
            const max = Math.max(1, ...miembros.map((m) => m.cerrados));
            const sorted = [...miembros].sort((a, b) => b.cerrados - a.cerrados);
            sorted.forEach((m, idx) => {
              const score = max > 0 ? clamp((m.cerrados / max) * 100) : 0;
              const percentil =
                miembros.length > 1
                  ? Math.round(((miembros.length - idx - 1) / (miembros.length - 1)) * 100)
                  : 100;
              inserts.push({
                fecha: hoy,
                area,
                usuario_id: m.usuario_id,
                kpis_json: { casos_cerrados_mtd: m.cerrados },
                score: Math.round(score * 10) / 10,
                posicion: idx + 1,
                percentil,
                promedio_area: Math.round(promedio * 100) / 100,
                tendencia: "estable",
              });
            });
          }

          if (inserts.length) {
            const { error: insErr } = await supabaseAdmin
              .from("scoreboard_snapshot_daily")
              .insert(inserts);
            if (insErr) throw insErr;
          }

          return Response.json({
            ok: true,
            fecha: hoy,
            scoreboard_rows: inserts.length,
            health_score: Math.round(healthScore * 10) / 10,
          });
        } catch (err: any) {
          console.error("[recompute-snapshots] error", err);
          return new Response(
            JSON.stringify({ error: err?.message ?? "snapshot failed" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
