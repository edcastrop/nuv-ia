// P14 — Vista Kanban del Pipeline Maestro NUVEX (14 columnas E1→E14).
// P15 — Filtros (búsqueda, banco, solo estancados).
// P16 — Filtros persistidos en URL via search params (compartibles).

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Loader2, Flag, Clock, AlertTriangle } from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { Card } from "@/components/nuvex/ui";

const pipelineSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  banco: fallback(z.string(), "").default(""),
  stuck: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/pipeline")({
  validateSearch: zodValidator(pipelineSearchSchema),
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
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/pipeline" });
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [qLocal, setQLocal] = useState(search.q);

  const { q, banco, stuck: soloStuck } = search;

  type PipelineSearch = z.infer<typeof pipelineSearchSchema>;

  // Debounce text input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== q) {
        navigate({ search: (prev: PipelineSearch) => ({ ...prev, q: qLocal }), replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, q, navigate]);

  const setBanco = (v: string) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, banco: v }), replace: true });
  const setSoloStuck = (v: boolean) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, stuck: v }), replace: true });
  const clearAll = () => {
    setQLocal("");
    navigate({ search: { q: "", banco: "", stuck: false }, replace: true });
  };

  useEffect(() => {
    listExpedientes()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);


  const bancos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.banco && s.add(r.banco));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (banco && r.banco !== banco) return false;
      if (term) {
        const hay = `${r.cliente_nombre} ${r.cedula ?? ""} ${r.numero_credito ?? ""} ${r.banco ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, banco]);

  const grupos = useMemo(() => {
    const m = new Map<EtapaPipelineId, Expediente[]>();
    ETAPAS_PIPELINE.forEach((e) => m.set(e.id, []));
    filtered.forEach((r) => {
      const etapa = computeEtapaActual({
        estado_caso: (r as unknown as { estado_caso?: string | null }).estado_caso ?? null,
      } as Parameters<typeof computeEtapaActual>[0]);
      const dias = diasDesde(r.updated_at);
      const umbral = UMBRAL_DIAS[etapa] ?? 0;
      if (soloStuck && !(umbral > 0 && dias > umbral)) return;
      m.get(etapa)?.push(r);
    });
    return m;
  }, [filtered, soloStuck]);

  const totalVisible = Array.from(grupos.values()).reduce((a, b) => a + b.length, 0);

  // P17 — Exportar CSV de los casos visibles (respeta filtros + etapa derivada).
  const exportarCSV = () => {
    const etapaTitulo = new Map(ETAPAS_PIPELINE.map((e) => [e.id, `E${e.numero} ${e.titulo}`]));
    const headers = ["Cliente", "Cédula", "Banco", "Crédito", "Etapa", "Estado", "Días", "Actualizado"];
    const lines: string[] = [headers.join(",")];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    ETAPAS_PIPELINE.forEach((etapa) => {
      (grupos.get(etapa.id) ?? []).forEach((r) => {
        lines.push([
          esc(r.cliente_nombre),
          esc(r.cedula),
          esc(r.banco),
          esc(r.numero_credito),
          esc(etapaTitulo.get(etapa.id)),
          esc(r.estado),
          esc(diasDesde(r.updated_at)),
          esc(r.updated_at?.slice(0, 10)),
        ].join(","));
      });
    });
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0A1226]">Pipeline Maestro</h1>
          <div className="text-[12px] text-[#242424]/60">
            {totalVisible} de {rows.length} casos · 14 etapas
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder="Buscar cliente, cédula, crédito…"
            className="h-8 w-[240px] rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#0A1226] placeholder:text-[#9CA3AF] focus:border-[#445DA3] focus:outline-none"
          />
          <select
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="h-8 rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#0A1226] focus:border-[#445DA3] focus:outline-none"
          >
            <option value="">Todos los bancos</option>
            {bancos.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E3E7EE] bg-white px-2 py-1 text-[12px] text-[#0A1226]">
            <input
              type="checkbox"
              checked={soloStuck}
              onChange={(e) => setSoloStuck(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Solo estancados
          </label>
          {(q || banco || soloStuck) && (
            <button
              onClick={clearAll}
              className="h-8 rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#445DA3] hover:bg-[#F1F3F8]"
            >
              Limpiar
            </button>
          )}
          <Link to="/casos" className="text-[12px] text-[#445DA3] hover:underline">
            Ver lista →
          </Link>
        </div>
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
