// Bandeja "Dirección · Consultas técnicas": simulaciones escaladas por analistas
// desde el simulador NUVIA cuando la auditoría matemática arrojó hallazgos que
// impidieron certificar. NO crean expediente_maestro — viven aquí hasta que
// Dirección resuelva.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  Search,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  listConsultasTecnicas,
  resolverConsultaTecnica,
  type ConsultaTecnicaRow,
} from "@/lib/simuladorDraftQA.functions";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";
import { AnalistaAvatar } from "@/components/pipeline/AnalistaAvatar";

export const Route = createFileRoute("/_authenticated/direccion/consultas-tecnicas")({
  component: DireccionConsultasTecnicasPage,
  head: () => ({ meta: [{ title: "Consultas técnicas · NUVIA" }] }),
});

type Estado = "pendiente" | "resuelta" | "descartada" | "todas";

function DireccionConsultasTecnicasPage() {
  const listFn = useServerFn(listConsultasTecnicas);
  const resolverFn = useServerFn(resolverConsultaTecnica);

  const [rows, setRows] = useState<ConsultaTecnicaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [estado, setEstado] = useState<Estado>("pendiente");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dictamen, setDictamen] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await listFn({ data: { estado } });
      setRows(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const hay = `${r.analistaNombre ?? ""} ${r.analistaEmail ?? ""} ${r.banco ?? ""} ${r.producto ?? ""}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const pend = rows.filter((r) => r.estado === "pendiente").length;
    const resu = rows.filter((r) => r.estado === "resuelta").length;
    const desc = rows.filter((r) => r.estado === "descartada").length;
    return { total, pend, resu, desc };
  }, [rows]);

  const handleResolver = async (id: string, decision: "resuelta" | "descartada") => {
    const texto = (dictamen[id] ?? "").trim();
    if (texto.length < 3) {
      alert("Escribe un dictamen breve antes de resolver.");
      return;
    }
    setSubmitting(id);
    try {
      await resolverFn({ data: { id, estado: decision, dictamen: texto } });
      setExpanded(null);
      setDictamen((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      alert(`No se pudo resolver: ${(e as Error).message}`);
    } finally {
      setSubmitting(null);
    }
  };

  const hallazgosDe = (h: unknown): Array<{ mensaje: string; severidad?: string; campo?: string }> => {
    if (!Array.isArray(h)) return [];
    return h.filter((x): x is { mensaje: string; severidad?: string; campo?: string } =>
      typeof x === "object" && x !== null && typeof (x as { mensaje?: unknown }).mensaje === "string",
    );
  };

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldAlert size={12} />, label: "Dirección · Consultas técnicas", tone: "warning" }}
        title="Consultas técnicas del simulador"
        description="Simulaciones que NUVIA no pudo certificar. Resuélvelas para que el analista continúe (o no) con la propuesta comercial."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-[var(--nuvia-text-primary)] hover:border-[var(--nuvia-accent-blue)] disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refrescar
          </button>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Total" value={String(kpis.total)} icon={<MessageSquare size={14} />} />
        <KpiCard label="Pendientes" value={String(kpis.pend)} icon={<ShieldAlert size={14} />} tone="warning" />
        <KpiCard label="Resueltas" value={String(kpis.resu)} icon={<CheckCircle2 size={14} />} tone="success" />
        <KpiCard label="Descartadas" value={String(kpis.desc)} icon={<XCircle size={14} />} tone="danger" />
      </KpiGrid>

      <NCard variant="elevated">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nuvia-text-secondary)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar analista, banco o producto…"
              className="nuvia-input nuvia-input-sm w-full pl-9"
            />
          </div>
          <div className="inline-flex rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.03)] p-0.5 text-[11px]">
            {(["pendiente", "resuelta", "descartada", "todas"] as const).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEstado(e)}
                className={`px-2.5 py-1 rounded-md font-semibold capitalize transition-colors ${
                  estado === e
                    ? "bg-[var(--nuvia-accent-blue)] text-white"
                    : "text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-text-primary)]"
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <span className="text-xs text-[var(--nuvia-text-secondary)]">{filtered.length} consulta(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--nuvia-text-secondary)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-[var(--nuvia-accent-green)]" />
            <div className="text-base font-semibold text-[var(--nuvia-text-primary)]">
              {estado === "pendiente" ? "No hay consultas pendientes" : "Sin resultados"}
            </div>
            <div className="mt-1 text-xs text-[var(--nuvia-text-secondary)]">
              Cuando un analista escale una simulación con hallazgos, aparecerá aquí.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((row) => {
              const isOpen = expanded === row.id;
              const hallazgos = hallazgosDe(row.hallazgos);
              const criticas = hallazgos.filter((h) => h.severidad === "critica").length;
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="flex items-center gap-3 p-3">
                    <AnalistaAvatar nombre={row.analistaNombre} email={row.analistaEmail} size={28} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--nuvia-text-primary)]">
                          {row.analistaNombre ?? row.analistaEmail ?? "Analista"}
                        </span>
                        <span className="text-[10px] text-[var(--nuvia-text-secondary)]">
                          {new Date(row.createdAt).toLocaleString("es-CO")}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize"
                          style={{
                            background:
                              row.estado === "pendiente"
                                ? "color-mix(in oklab, var(--nuvia-warning) 18%, transparent)"
                                : row.estado === "resuelta"
                                  ? "color-mix(in oklab, var(--nuvia-accent-green) 18%, transparent)"
                                  : "color-mix(in oklab, var(--nuvia-danger) 18%, transparent)",
                            color:
                              row.estado === "pendiente"
                                ? "var(--nuvia-warning)"
                                : row.estado === "resuelta"
                                  ? "var(--nuvia-accent-green)"
                                  : "var(--nuvia-danger)",
                          }}
                        >
                          {row.estado}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--nuvia-text-secondary)]">
                        {[row.banco, row.producto, row.tipoCredito, row.moneda].filter(Boolean).join(" · ") || "Sin metadatos"}
                        {" · "}
                        <span style={{ color: criticas > 0 ? "var(--nuvia-danger)" : "var(--nuvia-warning)" }}>
                          {hallazgos.length} hallazgo(s){criticas > 0 ? ` · ${criticas} crítico(s)` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-semibold text-[var(--nuvia-text-primary)] hover:border-[var(--nuvia-accent-blue)]"
                    >
                      {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isOpen ? "Cerrar" : "Ver detalle"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-[var(--nuvia-border)] p-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Notas del analista
                          </div>
                          <div className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(0,0,0,0.15)] p-2 text-xs text-[var(--nuvia-text-primary)] whitespace-pre-wrap min-h-[64px]">
                            {row.notasAnalista?.trim() || <span className="text-[var(--nuvia-text-secondary)]">Sin notas.</span>}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Hallazgos NUVIA
                          </div>
                          <div className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(0,0,0,0.15)] p-2 text-xs text-[var(--nuvia-text-primary)] max-h-[220px] overflow-auto">
                            {hallazgos.length === 0 ? (
                              <span className="text-[var(--nuvia-text-secondary)]">Sin hallazgos registrados.</span>
                            ) : (
                              <ul className="space-y-1">
                                {hallazgos.map((h, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span
                                      className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                                      style={{
                                        background:
                                          h.severidad === "critica"
                                            ? "var(--nuvia-danger)"
                                            : h.severidad === "warning"
                                              ? "var(--nuvia-warning)"
                                              : "var(--nuvia-accent-blue)",
                                      }}
                                    />
                                    <span>
                                      {h.campo && (
                                        <span className="mr-1 font-mono text-[10px] text-[var(--nuvia-text-secondary)]">
                                          [{h.campo}]
                                        </span>
                                      )}
                                      {h.mensaje}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>

                      {row.estado === "pendiente" ? (
                        <div className="mt-3">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Dictamen de Dirección
                          </div>
                          <textarea
                            value={dictamen[row.id] ?? ""}
                            onChange={(e) => setDictamen((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            rows={3}
                            placeholder="Explica al analista qué hacer: ajustar parámetros, rehacer simulación, descartar, etc."
                            className="nuvia-input w-full"
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => void handleResolver(row.id, "descartada")}
                              disabled={submitting === row.id}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-danger)] bg-[color-mix(in_oklab,var(--nuvia-danger)_15%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--nuvia-danger)] hover:bg-[color-mix(in_oklab,var(--nuvia-danger)_25%,transparent)] disabled:opacity-50"
                            >
                              <XCircle className="h-3 w-3" /> Descartar
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleResolver(row.id, "resuelta")}
                              disabled={submitting === row.id}
                              className="inline-flex items-center gap-1 rounded-md bg-[var(--nuvia-accent-green)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {submitting === row.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Resolver
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Dictamen registrado
                          </div>
                          <div className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(0,0,0,0.15)] p-2 text-xs text-[var(--nuvia-text-primary)] whitespace-pre-wrap">
                            {row.dictamenDirector?.trim() || <span className="text-[var(--nuvia-text-secondary)]">Sin dictamen.</span>}
                          </div>
                          {row.resolvedAt && (
                            <div className="mt-1 text-[10px] text-[var(--nuvia-text-secondary)]">
                              Resuelta el {new Date(row.resolvedAt).toLocaleString("es-CO")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}
