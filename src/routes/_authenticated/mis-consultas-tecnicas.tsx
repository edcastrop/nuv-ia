// Bandeja del analista: sus propias consultas técnicas escaladas desde el
// simulador NUVIA. Muestra estado, dictamen de Dirección y permite volver al
// simulador para rehacer la simulación con los ajustes sugeridos.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Calculator,
} from "lucide-react";
import {
  listMisConsultasTecnicas,
  type ConsultaTecnicaRow,
} from "@/lib/simuladorDraftQA.functions";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";

export const Route = createFileRoute("/_authenticated/mis-consultas-tecnicas")({
  component: MisConsultasTecnicasPage,
  head: () => ({ meta: [{ title: "Mis consultas técnicas · NUVIA" }] }),
});

function MisConsultasTecnicasPage() {
  const listFn = useServerFn(listMisConsultasTecnicas);
  const [rows, setRows] = useState<ConsultaTecnicaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await listFn();
      setRows(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const kpis = useMemo(() => {
    const total = rows.length;
    const pend = rows.filter((r) => r.estado === "pendiente").length;
    const resu = rows.filter((r) => r.estado === "aprobada").length;
    const desc = rows.filter((r) => r.estado === "rechazada").length;
    return { total, pend, resu, desc };
  }, [rows]);

  const hallazgosDe = (h: unknown): Array<{ mensaje: string; severidad?: string; campo?: string }> => {
    if (!Array.isArray(h)) return [];
    return h.filter((x): x is { mensaje: string; severidad?: string; campo?: string } =>
      typeof x === "object" && x !== null && typeof (x as { mensaje?: unknown }).mensaje === "string",
    );
  };

  const badge = (estado: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      pendiente: { bg: "color-mix(in oklab, var(--nuvia-warning) 18%, transparent)", fg: "var(--nuvia-warning)" },
      aprobada: { bg: "color-mix(in oklab, var(--nuvia-accent-green) 18%, transparent)", fg: "var(--nuvia-accent-green)" },
      rechazada: { bg: "color-mix(in oklab, var(--nuvia-danger) 18%, transparent)", fg: "var(--nuvia-danger)" },
    };
    const c = map[estado] ?? { bg: "rgba(255,255,255,0.08)", fg: "var(--nuvia-text-secondary)" };
    return (
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize"
        style={{ background: c.bg, color: c.fg }}
      >
        {estado}
      </span>
    );
  };

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldAlert size={12} />, label: "Mis consultas técnicas", tone: "blue" }}
        title="Consultas escaladas a Dirección"
        description="Simulaciones que NUVIA no pudo certificar y enviaste a Dirección Financiera. Aquí ves el dictamen y puedes rehacer la simulación."
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
        <KpiCard label="Total" value={String(kpis.total)} />
        <KpiCard label="Pendientes" value={String(kpis.pend)} icon={<ShieldAlert size={14} />} tone="warning" />
        <KpiCard label="Resueltas" value={String(kpis.resu)} icon={<CheckCircle2 size={14} />} tone="green" />
        <KpiCard label="Descartadas" value={String(kpis.desc)} icon={<XCircle size={14} />} tone="danger" />
      </KpiGrid>

      <NCard variant="elevated">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--nuvia-text-secondary)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-[var(--nuvia-accent-green)]" />
            <div className="text-base font-semibold text-[var(--nuvia-text-primary)]">
              No tienes consultas técnicas
            </div>
            <div className="mt-1 text-xs text-[var(--nuvia-text-secondary)]">
              Cuando NUVIA marque hallazgos y escales al Director, aparecerán aquí.
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const isOpen = expanded === row.id;
              const hallazgos = hallazgosDe(row.hallazgos);
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.02)]"
                >
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--nuvia-text-primary)]">
                          {[row.banco, row.producto].filter(Boolean).join(" · ") || "Simulación"}
                        </span>
                        {badge(row.estado)}
                        <span className="text-[10px] text-[var(--nuvia-text-secondary)]">
                          Enviada {new Date(row.createdAt).toLocaleString("es-CO")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--nuvia-text-secondary)]">
                        {hallazgos.length} hallazgo(s)
                        {row.resolvedAt && ` · Resuelta ${new Date(row.resolvedAt).toLocaleString("es-CO")}`}
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
                    <div className="border-t border-[var(--nuvia-border)] p-3 space-y-3">
                      {row.notasAnalista && (
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Tus notas al escalar
                          </div>
                          <div className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(0,0,0,0.15)] p-2 text-xs text-[var(--nuvia-text-primary)] whitespace-pre-wrap">
                            {row.notasAnalista}
                          </div>
                        </div>
                      )}

                      {hallazgos.length > 0 && (
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                            Hallazgos de NUVIA
                          </div>
                          <div className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(0,0,0,0.15)] p-2 text-xs text-[var(--nuvia-text-primary)] max-h-[220px] overflow-auto">
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
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--nuvia-text-secondary)]">
                          Dictamen de Dirección
                        </div>
                        <div
                          className="rounded-md border p-2 text-xs whitespace-pre-wrap"
                          style={{
                            borderColor:
                              row.estado === "aprobada"
                                ? "color-mix(in oklab, var(--nuvia-accent-green) 45%, transparent)"
                                : row.estado === "rechazada"
                                  ? "color-mix(in oklab, var(--nuvia-danger) 45%, transparent)"
                                  : "var(--nuvia-border)",
                            background: "rgba(0,0,0,0.15)",
                            color: "var(--nuvia-text-primary)",
                          }}
                        >
                          {row.dictamenDirector?.trim() || (
                            <span className="text-[var(--nuvia-text-secondary)]">
                              Aún sin dictamen — Dirección lo está revisando.
                            </span>
                          )}
                        </div>
                      </div>

                      {row.estado === "aprobada" && (
                        <div className="flex justify-end">
                          <Link
                            to="/herramientas/simulador"
                            className="inline-flex items-center gap-1 rounded-md bg-[var(--nuvia-accent-blue)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                          >
                            <Calculator className="h-3 w-3" /> Rehacer simulación
                          </Link>
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
