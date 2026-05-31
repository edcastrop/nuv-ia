// P9 — KPIs del Pipeline Maestro (E1–E14) para Dashboard Gerencia.
// Cuenta expedientes por etapa y calcula tiempo medio de permanencia
// en la etapa actual usando expediente_historial.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";

interface ExpRow {
  id: string;
  estado_caso: string | null;
  created_at: string;
}
interface HistRow {
  expediente_id: string;
  estado_caso_nuevo: string | null;
  created_at: string;
}

interface EtapaStat {
  id: EtapaPipelineId;
  numero: number;
  titulo: string;
  count: number;
  avgDiasEnEtapa: number | null;
}

function diasEntre(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function KpisPipeline14() {
  const [stats, setStats] = useState<EtapaStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: exps, error: e1 }, { data: hist, error: e2 }] = await Promise.all([
          supabase.from("expedientes").select("id, estado_caso, created_at").limit(1000),
          supabase
            .from("expediente_historial")
            .select("expediente_id, estado_caso_nuevo, created_at")
            .order("created_at", { ascending: true })
            .limit(5000),
        ]);
        if (e1) throw e1;
        if (e2) throw e2;

        const expRows = (exps ?? []) as unknown as ExpRow[];
        const histRows = (hist ?? []) as unknown as HistRow[];

        // Última entrada a la etapa actual por expediente
        const ultimaEntradaPorExp = new Map<string, { etapa: EtapaPipelineId; ts: string }>();
        for (const r of histRows) {
          if (!r.estado_caso_nuevo) continue;
          const ep = computeEtapaActual({ estado_caso: r.estado_caso_nuevo });
          const prev = ultimaEntradaPorExp.get(r.expediente_id);
          if (!prev || prev.etapa !== ep) {
            // primera vez o cambio de etapa → registra ts
            ultimaEntradaPorExp.set(r.expediente_id, { etapa: ep, ts: r.created_at });
          }
          // si etapa igual, se mantiene el ts de entrada original
        }

        const now = new Date().toISOString();
        const acumPorEtapa = new Map<EtapaPipelineId, { count: number; sumDias: number }>();
        for (const exp of expRows) {
          const etapa = computeEtapaActual({ estado_caso: exp.estado_caso });
          const entrada = ultimaEntradaPorExp.get(exp.id);
          const tsEntrada =
            entrada && entrada.etapa === etapa ? entrada.ts : exp.created_at;
          const dias = diasEntre(tsEntrada, now);
          const slot = acumPorEtapa.get(etapa) ?? { count: 0, sumDias: 0 };
          slot.count += 1;
          slot.sumDias += dias;
          acumPorEtapa.set(etapa, slot);
        }

        const out: EtapaStat[] = ETAPAS_PIPELINE.map((e) => {
          const a = acumPorEtapa.get(e.id);
          return {
            id: e.id,
            numero: e.numero,
            titulo: e.titulo,
            count: a?.count ?? 0,
            avgDiasEnEtapa: a && a.count > 0 ? a.sumDias / a.count : null,
          };
        });

        if (alive) setStats(out);
      } catch (err) {
        if (alive) setError((err as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const max = useMemo(
    () => (stats ? Math.max(1, ...stats.map((s) => s.count)) : 1),
    [stats],
  );
  const total = useMemo(
    () => (stats ? stats.reduce((acc, s) => acc + s.count, 0) : 0),
    [stats],
  );

  return (
    <section
      className="rounded-xl border p-5 shadow-sm"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "#111827" }}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Pipeline Maestro · KPIs por etapa</h3>
          <p className="text-xs" style={{ color: "#94A3B8" }}>
            Expedientes activos en cada etapa y tiempo medio de permanencia.
          </p>
        </div>
        <span className="text-xs" style={{ color: "#94A3B8" }}>
          {total} expedientes
        </span>
      </header>

      {error ? (
        <p className="text-sm text-rose-400">No se pudieron cargar los KPIs: {error}</p>
      ) : !stats ? (
        <p className="text-sm" style={{ color: "#94A3B8" }}>Calculando…</p>
      ) : (
        <ol className="space-y-1.5">
          {stats.map((s) => {
            const pct = (s.count / max) * 100;
            return (
              <li key={s.id} className="flex items-center gap-3 text-xs">
                <span
                  className="w-6 shrink-0 text-right font-mono"
                  style={{ color: "#94A3B8" }}
                >
                  E{s.numero}
                </span>
                <span className="w-40 shrink-0 truncate text-white/90">
                  {s.titulo}
                </span>
                <div
                  className="relative h-5 flex-1 overflow-hidden rounded"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${pct}%`,
                      background: s.count > 0 ? "#445DA3" : "transparent",
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-white">
                  {s.count}
                </span>
                <span
                  className="w-20 shrink-0 text-right font-mono"
                  style={{ color: "#94A3B8" }}
                >
                  {s.avgDiasEnEtapa == null
                    ? "—"
                    : `${s.avgDiasEnEtapa.toFixed(1)}d`}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
