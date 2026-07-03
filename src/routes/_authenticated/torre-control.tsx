import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { getTorreMetrics, type TorreKpi, type TorrePeriod } from "@/lib/torreControlMetrics.functions";
import { getTorreInsights } from "@/lib/torreControlInsights.functions";
import { getReporteCostosIA } from "@/lib/costosIA.functions";
import {
  ExecutiveHero, KpiStripCard, FunnelChart, AgingStackedBar,
  AreaProductivityBars, ProjectedRevenueChart, ExecutiveInsightsCard, RiskTable, KpiDetailModal,
} from "@/components/torre-control/widgets";
import {
  CommandCenterTabs, HealthScoreGauge,
} from "@/components/torre-control/command-center/CommandCenter";
import { Cpu, ArrowRight } from "lucide-react";

const ROLES_TORRE = ["super_admin", "admin", "gerencia", "director_financiero_qa", "director_juridico"];
const ROLES_COSTOS_IA = ["super_admin", "admin", "gerencia"];

export const Route = createFileRoute("/_authenticated/torre-control")({
  component: TorreControlPage,
});

const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);

function TorreControlPage() {
  const { user } = useAuth();
  const { roles, loading: rolesLoading } = useUserRole();
  const [period, setPeriod] = useState<TorrePeriod>("mtd");
  const [activeKpi, setActiveKpi] = useState<TorreKpi | null>(null);

  const autorizado = useMemo(
    () => roles.some((r) => ROLES_TORRE.includes(r)),
    [roles],
  );

  const puedeVerCostosIA = useMemo(
    () => roles.some((r) => ROLES_COSTOS_IA.includes(r)),
    [roles],
  );

  const fetchMetrics = useServerFn(getTorreMetrics);
  const fetchInsights = useServerFn(getTorreInsights);
  const fetchCostos = useServerFn(getReporteCostosIA);

  const metricsQuery = useQuery({
    queryKey: ["torre-control", "metrics", period],
    queryFn: () => fetchMetrics({ data: { period } }),
    enabled: !rolesLoading && autorizado,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const insightsMutation = useMutation({
    mutationFn: () => fetchInsights({ data: { period } }),
  });

  const costosQuery = useQuery({
    queryKey: ["torre-control", "costos-ia"],
    queryFn: () => fetchCostos({} as any),
    enabled: !rolesLoading && autorizado && puedeVerCostosIA,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (rolesLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>
        Cargando…
      </div>
    );
  }

  if (!autorizado) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center" style={{ border: "1px solid var(--nuvia-border)" }}>
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--nuvia-text-primary)" }}>Acceso restringido</h2>
          <p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            La Torre de Control es exclusiva para roles de Dirección y Gerencia.
          </p>
        </div>
      </div>
    );
  }

  const m = metricsQuery.data;
  const nombre = (user?.user_metadata?.nombre as string) || (user?.email?.split("@")[0] ?? "");
  const ahorroKpi = m?.kpis.find((k: TorreKpi) => k.key === "ahorro");
  const starValue = ahorroKpi ? fmtCOP(ahorroKpi.value) : "—";
  const starLabel = "Ahorro generado en el periodo";

  const c = costosQuery.data;
  const costoMes = c?.totales.costo_mes_cop ?? 0;
  const usosMes = c?.totales.usos_mes ?? 0;

  const resumenSlot = (
    <div className="space-y-6">
      {metricsQuery.isError && (
        <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-danger)" }}>
          <p className="text-sm" style={{ color: "var(--nuvia-text-primary)" }}>
            No fue posible cargar las métricas ejecutivas. Reintenta en unos segundos.
          </p>
        </div>
      )}

      {/* KPI strip — 3 cols para mejor lectura ejecutiva (2 filas de 3) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(m?.kpis ?? Array.from({ length: 6 })).map((kpi: TorreKpi | undefined, i: number) =>
          kpi ? (
            <KpiStripCard key={kpi.key} kpi={kpi} onClick={() => setActiveKpi(kpi)} />
          ) : (
            <div key={i} className="glass-card rounded-2xl p-5 h-32 animate-pulse" style={{ border: "1px solid var(--nuvia-border)" }} />
          ),
        )}
      </div>

      {/* Costos IA — Card destacado */}
      {puedeVerCostosIA && (
        <div
          className="relative overflow-hidden rounded-2xl p-5 flex items-center justify-between gap-4"
          style={{
            background: "linear-gradient(135deg, rgba(20,28,52,0.6) 0%, rgba(28,42,78,0.45) 60%, rgba(68,93,163,0.30) 100%)",
            border: "1px solid rgba(238,245,255,0.12)",
            backdropFilter: "blur(34px) saturate(155%)",
            boxShadow: "0 24px 60px -28px rgba(0,0,0,0.65), inset 0 1px 0 rgba(238,245,255,0.06)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full blur-3xl"
            style={{ background: "rgba(132,185,143,0.12)" }}
          />
          <div className="relative z-10 flex items-center gap-4 min-w-0">
            <div
              className="grid h-11 w-11 place-items-center rounded-xl shrink-0"
              style={{
                background: "rgba(132,185,143,0.14)",
                color: "var(--nuvia-accent-green)",
                border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 28%, transparent)",
              }}
            >
              <Cpu className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
                Costos IA · {c?.mesActual ?? "Mes actual"}
              </div>
              <div className="text-2xl font-bold tracking-tight tabular-nums leading-none mt-1" style={{ color: "var(--nuvia-text-primary)" }}>
                {costosQuery.isLoading ? "—" : fmtCOP(costoMes)}
              </div>
              <div className="text-[12px] mt-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                {costosQuery.isLoading ? "Cargando…" : `${usosMes.toLocaleString("es-CO")} usos · Modelo ${c?.modelo ?? "—"}`}
              </div>
            </div>
          </div>
          <Link
            to="/super-admin/costos-ia"
            className="relative z-10 inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3.5 py-2 rounded-lg transition hover:opacity-90 shrink-0"
            style={{
              background: "color-mix(in oklab, var(--nuvia-accent-green) 14%, transparent)",
              color: "var(--nuvia-accent-green)",
              border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 32%, transparent)",
            }}
          >
            Ver detalle <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Funnel + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {m ? <FunnelChart stages={m.funnel} /> : <div className="glass-card rounded-2xl p-5 h-72 animate-pulse" style={{ border: "1px solid var(--nuvia-border)" }} />}
        <ExecutiveInsightsCard
          insights={insightsMutation.data?.insights ?? null}
          loading={insightsMutation.isPending}
          onAnalyze={() => insightsMutation.mutate()}
          cached={insightsMutation.data?.cached}
          generatedAt={insightsMutation.data?.generatedAt}
        />
      </div>

      {/* Cartera + Productividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {m ? <AgingStackedBar aging={m.aging} /> : <div className="glass-card rounded-2xl p-5 h-72 animate-pulse" style={{ border: "1px solid var(--nuvia-border)" }} />}
        {m ? <AreaProductivityBars rows={m.productividad} /> : <div className="glass-card rounded-2xl p-5 h-72 animate-pulse" style={{ border: "1px solid var(--nuvia-border)" }} />}
      </div>

      {/* Proyección honorarios */}
      {m && <ProjectedRevenueChart points={m.proyeccionHonorarios} />}

      {/* Riesgos */}
      {m && <RiskTable rows={m.risks} />}
    </div>
  );

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--nuvia-bg-primary)", color: "var(--nuvia-text-primary)" }}
    >
      {/* halo decorativo sutil de fondo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-[420px] w-[820px] rounded-full blur-3xl opacity-50"
        style={{ background: "radial-gradient(circle, rgba(68,93,163,0.18) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-6 max-w-[1400px] mx-auto space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-stretch">
          <ExecutiveHero
            nombre={nombre}
            period={period}
            onPeriodChange={setPeriod}
            starValue={starValue}
            starLabel={starLabel}
          />
          <HealthScoreGauge />
        </div>

        <CommandCenterTabs resumenSlot={resumenSlot} isExecutive={autorizado} />

        <KpiDetailModal kpi={activeKpi} onClose={() => setActiveKpi(null)} />
      </div>
    </div>
  );
}
