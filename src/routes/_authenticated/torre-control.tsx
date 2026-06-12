import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { getTorreMetrics, type TorreKpi, type TorrePeriod } from "@/lib/torreControlMetrics.functions";
import { getTorreInsights } from "@/lib/torreControlInsights.functions";
import {
  ExecutiveHero, KpiStripCard, FunnelChart, AgingStackedBar,
  AreaProductivityBars, ProjectedRevenueChart, ExecutiveInsightsCard, RiskTable, KpiDetailModal,
} from "@/components/torre-control/widgets";
import {
  CommandCenterTabs, HealthScoreGauge,
} from "@/components/torre-control/command-center/CommandCenter";

const ROLES_TORRE = ["super_admin", "admin", "gerencia", "director_financiero_qa", "director_juridico"];

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

  const fetchMetrics = useServerFn(getTorreMetrics);
  const fetchInsights = useServerFn(getTorreInsights);

  const autorizado = useMemo(
    () => roles.some((r) => ROLES_TORRE.includes(r)),
    [roles],
  );

  const metricsQuery = useQuery({
    queryKey: ["torre-control", "metrics", period],
    queryFn: () => fetchMetrics({ data: { period } }),
    enabled: !rolesLoading && autorizado,
    staleTime: 60_000, // 60s
    refetchOnWindowFocus: false,
  });

  const insightsMutation = useMutation({
    mutationFn: () => fetchInsights({ data: { period } }),
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
  const ahorroKpi = m?.kpis.find((k) => k.key === "ahorro");
  const starValue = ahorroKpi ? fmtCOP(ahorroKpi.value) : "—";
  const starLabel = "Ahorro generado en el periodo";

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
        {(m?.kpis ?? Array.from({ length: 6 })).map((kpi, i) =>
          kpi ? (
            <KpiStripCard key={(kpi as TorreKpi).key} kpi={kpi as TorreKpi} onClick={() => setActiveKpi(kpi as TorreKpi)} />
          ) : (
            <div key={i} className="glass-card rounded-2xl p-5 h-32 animate-pulse" style={{ border: "1px solid var(--nuvia-border)" }} />
          ),
        )}
      </div>

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
