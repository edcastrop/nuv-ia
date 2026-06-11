// Pipeline Maestro V2 — Linear Operations Center
// Foco: SLA, dinero en riesgo, cuellos de botella, responsables.
// Fase 7.6.1B (Opción B aprobada).
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  Clock,
  DollarSign,
  Flame,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  Users,
} from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { PageLayout, ExecutiveHero, KpiGrid, KpiCard, NCard, SectionHeader, EmptyState } from "@/components/nuvia";

export const Route = createFileRoute("/_authenticated/pipeline-v2")({
  component: PipelineV2Page,
});

// SLA por etapa (días hábiles aproximados). Coincide con UMBRAL del Kanban legado.
const SLA_DIAS: Record<EtapaPipelineId, number> = {
  lead: 3,
  extracto: 5,
  proyeccion: 5,
  presentacion: 7,
  cierre: 7,
  contratacion: 10,
  radicacion: 7,
  banco: 21,
  resultado_banco: 5,
  aceptacion_cliente: 5,
  informe: 5,
  cuenta: 5,
  pago: 10,
  comision: 7,
  paz_salvo: 5,
  finalizado: 0,
};

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

interface StageStats {
  id: EtapaPipelineId;
  numero: number;
  titulo: string;
  responsables: ReadonlyArray<string>;
  casos: Expediente[];
  count: number;
  diasProm: number;
  diasMax: number;
  slaDias: number;
  slaCumplido: number; // % dentro de SLA
  enRiesgo: Expediente[]; // sobre SLA
  dineroEnRiesgo: number; // suma honorarios_final de casos sobre SLA
  semaforo: "ok" | "warn" | "crit";
}

const fmtCOP = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${Math.round(n)}`;

function PipelineV2Page() {
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [q, setQ] = useState("");
  const [banco, setBanco] = useState("");
  const [expanded, setExpanded] = useState<EtapaPipelineId | null>(null);

  const cargar = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await listExpedientes();
      setRows(data);
      setLastUpdated(Date.now());
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    cargar(false);
    const t = setInterval(() => cargar(true), 60_000);
    return () => clearInterval(t);
  }, []);

  const bancos = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.banco && s.add(r.banco));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "es"));
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

  const stages: StageStats[] = useMemo(() => {
    return ETAPAS_PIPELINE.filter((e) => e.id !== "finalizado").map((e) => {
      const casos = filtered.filter(
        (r) =>
          computeEtapaActual({
            estado_caso: (r as unknown as { estado_caso?: string | null }).estado_caso ?? null,
          } as Parameters<typeof computeEtapaActual>[0]) === e.id,
      );
      const dias = casos.map((c) => diasDesde(c.updated_at));
      const diasProm = dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : 0;
      const diasMax = dias.length ? Math.max(...dias) : 0;
      const slaDias = SLA_DIAS[e.id] ?? 7;
      const enRiesgo = casos.filter((c) => diasDesde(c.updated_at) > slaDias);
      const slaCumplido = casos.length === 0 ? 100 : ((casos.length - enRiesgo.length) / casos.length) * 100;
      const dineroEnRiesgo = enRiesgo.reduce(
        (acc, c) => acc + (Number(c.honorarios_final) || Number(c.honorarios_base) || 0),
        0,
      );
      const semaforo: StageStats["semaforo"] =
        slaCumplido >= 80 ? "ok" : slaCumplido >= 50 ? "warn" : "crit";
      return {
        id: e.id,
        numero: e.numero,
        titulo: e.titulo,
        responsables: e.responsables,
        casos,
        count: casos.length,
        diasProm,
        diasMax,
        slaDias,
        slaCumplido,
        enRiesgo,
        dineroEnRiesgo,
        semaforo,
      };
    });
  }, [filtered]);

  // KPIs globales
  const totales = useMemo(() => {
    const activos = stages.reduce((a, s) => a + s.count, 0);
    const enRiesgo = stages.reduce((a, s) => a + s.enRiesgo.length, 0);
    const dinero = stages.reduce((a, s) => a + s.dineroEnRiesgo, 0);
    const slaGlobal = activos === 0 ? 100 : ((activos - enRiesgo) / activos) * 100;
    const cuellos = stages.filter((s) => s.semaforo === "crit").length;
    return { activos, enRiesgo, dinero, slaGlobal, cuellos };
  }, [stages]);

  const cuellos = useMemo(
    () =>
      [...stages]
        .filter((s) => s.count > 0)
        .sort((a, b) => a.slaCumplido - b.slaCumplido)
        .slice(0, 5),
    [stages],
  );

  const casosCriticos = useMemo(() => {
    const all = stages.flatMap((s) =>
      s.enRiesgo.map((c) => ({
        caso: c,
        etapa: s,
        dias: diasDesde(c.updated_at),
        exceso: diasDesde(c.updated_at) - s.slaDias,
      })),
    );
    return all.sort((a, b) => b.exceso - a.exceso).slice(0, 6);
  }, [stages]);

  const hace = Math.round((Date.now() - lastUpdated) / 1000);
  const haceLabel = hace < 60 ? `hace ${hace}s` : `hace ${Math.round(hace / 60)}min`;

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-[var(--nuvia-text-secondary)]">
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Cargando Operations Center…
        </div>
      </div>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Activity size={11} />, label: "Pipeline V2 · Operations", tone: "blue" }}
        title="Operations Center"
        description="Velocidad operativa · SLA en tiempo real · cuellos de botella · dinero en riesgo."
        meta={
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--nuvia-text-secondary)]">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · {haceLabel}
          </span>
        }
        actions={
          <>
            <button
              onClick={() => cargar(true)}
              className="glass-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              disabled={refreshing}
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              Refrescar
            </button>
            <Link
              to="/pipeline"
              className="glass-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              Vista Kanban
              <ArrowUpRight size={12} />
            </Link>
          </>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Casos activos"
          value={totales.activos}
          tone="blue"
          icon={<Users size={14} />}
          hint={`${filtered.length} totales tras filtro`}
        />
        <KpiCard
          label="SLA cumplido"
          value={`${totales.slaGlobal.toFixed(0)}%`}
          tone={totales.slaGlobal >= 80 ? "green" : totales.slaGlobal >= 50 ? "warning" : "danger"}
          icon={<Gauge size={14} />}
          hint={`${totales.enRiesgo} fuera de SLA`}
        />
        <KpiCard
          label="Dinero en riesgo"
          value={fmtCOP(totales.dinero)}
          tone="danger"
          icon={<DollarSign size={14} />}
          hint="honorarios sobre SLA"
        />
        <KpiCard
          label="Cuellos de botella"
          value={totales.cuellos}
          tone={totales.cuellos === 0 ? "green" : totales.cuellos <= 2 ? "warning" : "danger"}
          icon={<Flame size={14} />}
          hint="etapas en estado crítico"
        />
      </KpiGrid>

      <PageLayout.BodyWithAside>
        <PageLayout.Main>
        <NCard variant="default" padding="none" className="overflow-hidden">

          {/* Filtros */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--nuvia-border)]">
            <div className="relative flex-1 max-w-md">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--nuvia-text-secondary)]"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar cliente, cédula, crédito…"
                className="w-full pl-7 pr-3 py-1.5 text-xs rounded-md bg-white/5 border border-[var(--nuvia-border)] text-[var(--nuvia-text-primary)] placeholder:text-[var(--nuvia-text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--nuvia-accent-blue)]"
              />
            </div>
            <select
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-md bg-white/5 border border-[var(--nuvia-border)] text-[var(--nuvia-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--nuvia-accent-blue)]"
            >
              <option value="">Todos los bancos</option>
              {bancos.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Tabla de etapas */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr
                  className="text-left text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-2 py-2 w-8">#</th>
                  <th className="px-2 py-2">Etapa</th>
                  <th className="px-2 py-2 text-right">Casos</th>
                  <th className="px-2 py-2 text-right">Días prom</th>
                  <th className="px-2 py-2 text-right">SLA</th>
                  <th className="px-2 py-2 text-right">SLA %</th>
                  <th className="px-2 py-2 text-right">En riesgo</th>
                  <th className="px-2 py-2 text-right">$ en riesgo</th>
                  <th className="px-2 py-2">Responsable</th>
                  <th className="px-3 py-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => {
                  const isOpen = expanded === s.id;
                  const dot =
                    s.semaforo === "ok"
                      ? "bg-emerald-400"
                      : s.semaforo === "warn"
                        ? "bg-amber-400"
                        : "bg-rose-400";
                  const slaColor =
                    s.semaforo === "ok"
                      ? "text-emerald-400"
                      : s.semaforo === "warn"
                        ? "text-amber-400"
                        : "text-rose-400";
                  return (
                    <>
                      <tr
                        key={s.id}
                        onClick={() => setExpanded(isOpen ? null : s.id)}
                        className="border-t border-[var(--nuvia-border)] cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <td className="px-3 py-2">
                          <span className={`inline-block size-2 rounded-full ${dot}`} />
                        </td>
                        <td className="px-2 py-2 font-mono text-[10px] text-[var(--nuvia-text-secondary)]">
                          E{s.numero}
                        </td>
                        <td className="px-2 py-2 font-medium text-[var(--nuvia-text-primary)]">
                          {s.titulo}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{s.count}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-[var(--nuvia-text-secondary)]">
                          {s.diasProm.toFixed(1)}d
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-[var(--nuvia-text-secondary)]">
                          {s.slaDias}d
                        </td>
                        <td className={`px-2 py-2 text-right tabular-nums font-semibold ${slaColor}`}>
                          {s.slaCumplido.toFixed(0)}%
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {s.enRiesgo.length > 0 ? (
                            <span className="text-rose-400">{s.enRiesgo.length}</span>
                          ) : (
                            <span className="text-[var(--nuvia-text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {s.dineroEnRiesgo > 0 ? (
                            <span className="text-rose-400">{fmtCOP(s.dineroEnRiesgo)}</span>
                          ) : (
                            <span className="text-[var(--nuvia-text-secondary)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-[var(--nuvia-text-secondary)]">
                          {s.responsables.slice(0, 2).join(", ")}
                        </td>
                        <td className="px-3 py-2 text-[var(--nuvia-text-secondary)]">
                          <ChevronRight
                            size={14}
                            className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                          />
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-[rgba(255,255,255,0.02)]">
                          <td colSpan={11} className="px-3 py-2">
                            {s.casos.length === 0 ? (
                              <EmptyState
                                compact
                                tone="neutral"
                                title="Sin casos en esta etapa"
                                description="Cuando haya movimiento aparecerá aquí."
                              />
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                {s.casos.slice(0, 12).map((c) => {
                                  const d = diasDesde(c.updated_at);
                                  const over = d > s.slaDias;
                                  return (
                                    <Link
                                      key={c.id}
                                      to="/expediente/$id"
                                      params={{ id: c.id }}
                                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] hover:bg-white/[0.06]"
                                    >
                                      <div className="min-w-0">
                                        <div className="truncate text-[12px] text-[var(--nuvia-text-primary)]">
                                          {c.cliente_nombre}
                                        </div>
                                        <div className="text-[10px] text-[var(--nuvia-text-secondary)] truncate">
                                          {c.banco ?? "Sin banco"} · {c.cedula ?? "—"}
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <div
                                          className={`tabular-nums text-[11px] font-semibold ${over ? "text-rose-400" : "text-[var(--nuvia-text-secondary)]"}`}
                                        >
                                          {d}d
                                        </div>
                                        <div className="text-[10px] text-[var(--nuvia-text-secondary)] tabular-nums">
                                          {fmtCOP(Number(c.honorarios_final) || Number(c.honorarios_base) || 0)}
                                        </div>
                                      </div>
                                    </Link>
                                  );
                                })}
                                {s.casos.length > 12 && (
                                  <div className="text-[10px] text-[var(--nuvia-text-secondary)] px-2 py-1">
                                    +{s.casos.length - 12} más…
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </NCard>
        </PageLayout.Main>
        <PageLayout.Aside>


          <NCard variant="default">
            <SectionHeader
              title="Cuellos de botella"
              description="Etapas con peor cumplimiento de SLA."
            />
            {cuellos.length === 0 ? (
              <EmptyState
                compact
                tone="green"
                icon={<Gauge size={20} />}
                title="Sin cuellos detectados"
                description="Todas las etapas están dentro de su SLA objetivo."
              />
            ) : (
              <div className="mt-3 space-y-2">
                {cuellos.map((s, i) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-[var(--nuvia-text-secondary)] w-4 text-right">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[12px] text-[var(--nuvia-text-primary)] truncate">
                          E{s.numero} · {s.titulo}
                        </div>
                        <div className="text-[10px] text-[var(--nuvia-text-secondary)]">
                          {s.count} casos · prom {s.diasProm.toFixed(1)}d / SLA {s.slaDias}d
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`text-[12px] font-semibold tabular-nums ${s.semaforo === "crit" ? "text-rose-400" : "text-amber-400"}`}
                      >
                        {s.slaCumplido.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-[var(--nuvia-text-secondary)]">SLA</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </NCard>

          <NCard variant="default">
            <SectionHeader
              title="Casos críticos"
              description="Mayor exceso sobre el SLA de su etapa."
            />
            {casosCriticos.length === 0 ? (
              <EmptyState
                compact
                tone="green"
                icon={<Clock size={20} />}
                title="Ningún caso fuera de SLA"
                description="Excelente. Todo el pipeline avanza dentro de los umbrales."
              />
            ) : (
              <div className="mt-3 space-y-1.5">
                {casosCriticos.map(({ caso, etapa, dias, exceso }) => (
                  <Link
                    key={caso.id}
                    to="/expediente/$id"
                    params={{ id: caso.id }}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] hover:bg-white/[0.06]"
                  >
                    <div className="min-w-0">
                      <div className="text-[12px] text-[var(--nuvia-text-primary)] truncate">
                        {caso.cliente_nombre}
                      </div>
                      <div className="text-[10px] text-[var(--nuvia-text-secondary)] truncate">
                        E{etapa.numero} {etapa.titulo} · {caso.banco ?? "—"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-semibold tabular-nums text-rose-400 inline-flex items-center gap-1">
                        <TrendingDown size={11} />+{exceso}d
                      </div>
                      <div className="text-[10px] text-[var(--nuvia-text-secondary)] tabular-nums">
                        {dias}d en etapa
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </NCard>

          {totales.cuellos > 0 && (
            <NCard
              variant="default"
              className="border-rose-500/30"
              style={{
                background:
                  "linear-gradient(180deg, rgba(244,63,94,0.06), rgba(255,255,255,0.01))",
              }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[12px] font-semibold text-[var(--nuvia-text-primary)]">
                    {totales.cuellos} cuello(s) crítico(s)
                  </div>
                  <div className="text-[11px] text-[var(--nuvia-text-secondary)] mt-0.5">
                    Hay {fmtCOP(totales.dinero)} en honorarios en etapas con SLA bajo. Prioriza
                    revisión inmediata del responsable de cada etapa.
                  </div>
                </div>
              </div>
            </NCard>
          )}
        </PageLayout.Aside>
      </PageLayout.BodyWithAside>
    </PageLayout>
  );
}

