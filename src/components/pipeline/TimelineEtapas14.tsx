// P13 — Timeline temporal de las 14 etapas con duración real por etapa.
// Deriva los tiempos de expediente_historial (estado_caso_nuevo) y el
// estado actual del expediente. Complementa PipelineStepper14 (sin tiempos)
// y HistorialCaso (log cronológico crudo).

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/nuvex/ui";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  indexOfEtapa,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";

interface Props {
  expedienteId: string;
  refreshKey?: number;
}

interface EtapaTiming {
  id: EtapaPipelineId;
  ingreso: string | null;
  salida: string | null;
  dias: number | null;
}

function diasEntre(a: string, b: string | null): number {
  const inicio = new Date(a).getTime();
  const fin = b ? new Date(b).getTime() : Date.now();
  return Math.max(0, Math.round((fin - inicio) / (1000 * 60 * 60 * 24)));
}

export function TimelineEtapas14({ expedienteId, refreshKey = 0 }: Props) {
  const [timings, setTimings] = useState<Map<EtapaPipelineId, EtapaTiming>>(new Map());
  const [etapaActualId, setEtapaActualId] = useState<EtapaPipelineId>("lead");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: exp }, { data: hist }] = await Promise.all([
        supabase
          .from("expedientes")
          .select("estado_caso, created_at")
          .eq("id", expedienteId)
          .maybeSingle(),
        supabase
          .from("expediente_historial")
          .select("estado_caso_nuevo, created_at")
          .eq("expediente_id", expedienteId)
          .not("estado_caso_nuevo", "is", null)
          .order("created_at", { ascending: true }),
      ]);
      if (!alive) return;

      const actual = computeEtapaActual({
        estado_caso: (exp?.estado_caso as string | null) ?? null,
      } as Parameters<typeof computeEtapaActual>[0]);
      setEtapaActualId(actual);

      // Construye ingreso por etapa: primera vez que aparece esa etapa en historial.
      // Si nunca hay historial, usa created_at del expediente para "lead".
      const ingresos = new Map<EtapaPipelineId, string>();
      const { mapEstadoToEtapa } = await import("@/lib/pipelineEtapas");
      for (const row of hist ?? []) {
        const etapa = mapEstadoToEtapa(row.estado_caso_nuevo as string);
        if (!ingresos.has(etapa)) ingresos.set(etapa, row.created_at);
      }
      if (!ingresos.has("lead") && exp?.created_at) {
        ingresos.set("lead", exp.created_at);
      }

      const idxActual = indexOfEtapa(actual);
      const result = new Map<EtapaPipelineId, EtapaTiming>();
      ETAPAS_PIPELINE.forEach((e, i) => {
        const ingreso = ingresos.get(e.id) ?? null;
        // salida = ingreso de la siguiente etapa con timestamp
        let salida: string | null = null;
        for (let j = i + 1; j < ETAPAS_PIPELINE.length; j++) {
          const next = ingresos.get(ETAPAS_PIPELINE[j].id);
          if (next) { salida = next; break; }
        }
        const dias =
          ingreso && (salida || i === idxActual) ? diasEntre(ingreso, salida) : null;
        result.set(e.id, { id: e.id, ingreso, salida, dias });
      });
      setTimings(result);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [expedienteId, refreshKey]);

  const idxActual = indexOfEtapa(etapaActualId);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[#242424]">Timeline del pipeline</h3>
          <div className="text-[11px] text-[#242424]/60">
            Días reales por etapa (E1 → E14)
          </div>
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#445DA3]" />}
      </div>

      <ol className="relative space-y-2 border-l border-[#E3E7EE] pl-4">
        {ETAPAS_PIPELINE.map((e, i) => {
          const t = timings.get(e.id);
          const done = i < idxActual;
          const current = i === idxActual;
          const Icon = done ? CheckCircle2 : current ? Clock : Circle;
          const color = done ? "#1F7A45" : current ? "#445DA3" : "#9CA3AF";
          return (
            <li key={e.id} className="relative">
              <span
                className="absolute -left-[22px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white"
                style={{ color }}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/55">
                    Etapa {e.numero}
                  </div>
                  <div className="truncate text-sm font-medium" style={{ color: done || current ? "#0A1226" : "#6B7280" }}>
                    {e.titulo}
                  </div>
                </div>
                <div className="text-right text-[11px] text-[#242424]/70">
                  {t?.ingreso ? (
                    <div>
                      {new Date(t.ingreso).toLocaleDateString("es-CO")}
                      {t.dias !== null && (
                        <span className="ml-2 rounded bg-[#F1F3F8] px-1.5 py-0.5 font-medium" style={{ color }}>
                          {t.dias}d {current ? "(en curso)" : ""}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[#9CA3AF]">— pendiente</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
