// P14 — Vista Kanban del Pipeline Maestro NUVEX (14 columnas E1→E14).
// Read-only: agrupa expedientes por etapa derivada de estado_caso, con
// scroll horizontal y tarjetas que enlazan al detalle.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Flag, Clock, AlertTriangle } from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { Card } from "@/components/nuvex/ui";

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
});

const UMBRAL_DIAS: Partial<Record<EtapaPipelineId, number>> = {
  lead: 3, extracto: 5, proyeccion: 5, presentacion: 7, cierre: 7,
  contratacion: 10, radicacion: 7, banco: 21, informe: 5, cuenta: 5,
  pago: 10, comision: 7, paz_salvo: 5, finalizado: 0,
};

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

function PipelinePage() {
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listExpedientes()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const grupos = useMemo(() => {
    const m = new Map<EtapaPipelineId, Expediente[]>();
    ETAPAS_PIPELINE.forEach((e) => m.set(e.id, []));
    rows.forEach((r) => {
      const etapa = computeEtapaActual({
        estado_caso: (r as unknown as { estado_caso?: string | null }).estado_caso ?? null,
      } as Parameters<typeof computeEtapaActual>[0]);
      m.get(etapa)?.push(r);
    });
    return m;
  }, [rows]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0A1226]">Pipeline Maestro</h1>
          <div className="text-[12px] text-[#242424]/60">
            {rows.length} casos · 14 etapas
          </div>
        </div>
        <Link to="/casos" className="text-[12px] text-[#445DA3] hover:underline">
          Ver lista de casos →
        </Link>
      </div>

      {loading ? (
        <Card>
          <div className="flex items-center gap-2 text-sm text-[#242424]/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando pipeline…
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-3">
            {ETAPAS_PIPELINE.map((etapa) => {
              const items = grupos.get(etapa.id) ?? [];
              const umbral = UMBRAL_DIAS[etapa.id] ?? 0;
              return (
                <div
                  key={etapa.id}
                  className="w-[280px] flex-shrink-0 rounded-2xl border border-[#E3E7EE] bg-[#F7F9FC] p-2.5"
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#445DA3]">
                        E{etapa.numero}
                      </div>
                      <div className="truncate text-sm font-semibold text-[#0A1226]">
                        {etapa.titulo}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#242424]/70 ring-1 ring-[#E3E7EE]">
                      {items.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E3E7EE] bg-white/60 px-2 py-3 text-center text-[11px] text-[#9CA3AF]">
                        Sin casos
                      </div>
                    ) : (
                      items.map((r) => {
                        const dias = diasDesde(r.updated_at);
                        const stuck = umbral > 0 && dias > umbral;
                        return (
                          <Link
                            key={r.id}
                            to="/casos/$id"
                            params={{ id: r.id }}
                            className="block rounded-lg border border-[#E3E7EE] bg-white p-2.5 text-left transition hover:border-[#445DA3] hover:shadow-sm"
                          >
                            <div className="truncate text-sm font-medium text-[#0A1226]">
                              {r.cliente_nombre}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-[#242424]/60">
                              {r.banco ?? "—"} · {r.cedula ?? "s/cédula"}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 rounded bg-[#F1F3F8] px-1.5 py-0.5 text-[10px] font-medium text-[#445DA3]">
                                <Flag className="h-3 w-3" /> {r.estado}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  stuck
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {stuck ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                {dias}d
                              </span>
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
