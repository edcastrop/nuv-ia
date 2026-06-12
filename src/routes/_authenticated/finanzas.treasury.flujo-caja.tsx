import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";
import { NCard } from "@/components/nuvia/NCard";
import { flujoCajaForecast } from "@/lib/treasury.functions";
import { LineChart, Calendar, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/flujo-caja")({
  component: FlujoCajaPage,
  head: () => ({ meta: [{ title: "Flujo de Caja · NUVIA Treasury AI" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const PROB_META = {
  alta: { label: "Alta probabilidad", color: "#9BCB9F", bg: "rgba(132,185,143,0.10)", border: "rgba(132,185,143,0.45)" },
  media: { label: "Media probabilidad", color: "#F6C453", bg: "rgba(246,196,83,0.10)", border: "rgba(246,196,83,0.45)" },
  baja: { label: "Baja probabilidad", color: "#FF8585", bg: "rgba(255,107,107,0.10)", border: "rgba(255,107,107,0.45)" },
} as const;

function FlujoCajaPage() {
  const fn = useServerFn(flujoCajaForecast);
  const { data } = useQuery({ queryKey: ["tFlujo"], queryFn: () => fn() });
  const items = data?.items ?? [];

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <LineChart size={12} />, label: "Treasury AI · Flujo de Caja", tone: "blue" }}
        title="Proyección de ingresos 90 días"
        description="Forecast determinístico desde cartera + cuentas de cobro, clasificado por probabilidad de recaudo."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Vencido (mora)" value={money(data?.ventanas.vencido ?? 0)} icon={<AlertTriangle size={14} />} tone="danger" />
        <KpiCard label="Próximos 30 días" value={money(data?.ventanas.d30 ?? 0)} icon={<Calendar size={14} />} tone="blue" />
        <KpiCard label="Próximos 60 días" value={money(data?.ventanas.d60 ?? 0)} icon={<Calendar size={14} />} tone="blue" />
        <KpiCard label="Próximos 90 días" value={money(data?.ventanas.d90 ?? 0)} icon={<TrendingUp size={14} />} tone="green" />
      </KpiGrid>

      <SemanasChart semanas={data?.semanas ?? []} />

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        {(["alta", "media", "baja"] as const).map((p) => {
          const meta = PROB_META[p];
          const subset = items.filter((i) => i.probabilidad === p);
          const total = data?.totales[p] ?? 0;
          return (
            <NCard key={p} variant="elevated" padding="sm">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="uppercase font-semibold" style={{ color: meta.color, fontSize: 9, letterSpacing: "0.12em" }}>
                    {meta.label}
                  </div>
                  <div className="font-bold tabular-nums" style={{ color: "var(--nuvia-text-primary)", fontSize: 18 }}>
                    {money(total)}
                  </div>
                </div>
                <span
                  className="inline-flex rounded-full px-2 py-0.5 font-semibold tabular-nums"
                  style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontSize: 10 }}
                >
                  {subset.length}
                </span>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }} className="space-y-1.5">
                {subset.slice(0, 50).map((i) => (
                  <div
                    key={`${i.origen}-${i.id}`}
                    className="rounded-md p-2"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--nuvia-border)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ color: "var(--nuvia-text-primary)", fontSize: 11.5 }} className="truncate">
                        {i.label}
                      </span>
                      <span className="tabular-nums font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 12 }}>
                        {money(i.valor)}
                      </span>
                    </div>
                    <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 10 }} className="tabular-nums">
                      {i.fecha} · {i.dias < 0 ? `${Math.abs(i.dias)}d en mora` : `en ${i.dias}d`}
                    </div>
                  </div>
                ))}
                {!subset.length && (
                  <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 12, textAlign: "center", padding: "16px 0" }}>
                    Sin ingresos proyectados.
                  </div>
                )}
              </div>
            </NCard>
          );
        })}
      </div>
    </PageLayout>
  );
}

function SemanasChart({ semanas }: { semanas: Array<{ label: string; bruto: number; ponderado: number }> }) {
  const max = Math.max(...semanas.map((s) => s.bruto), 1);
  const W = 720;
  const H = 180;
  const padL = 40;
  const padB = 22;
  const barW = (W - padL - 10) / Math.max(semanas.length, 1) - 6;
  return (
    <NCard variant="elevated">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
          Forecast semanal (12 semanas)
        </h3>
        <div className="flex items-center gap-3" style={{ fontSize: 10, color: "var(--nuvia-text-secondary)" }}>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 10, height: 10, background: "#A5B5E0", display: "inline-block", borderRadius: 2 }} /> Bruto
          </span>
          <span className="inline-flex items-center gap-1">
            <span style={{ width: 10, height: 10, background: "#9BCB9F", display: "inline-block", borderRadius: 2 }} /> Ponderado
          </span>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ minWidth: 600 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((g, i) => {
            const y = (H - padB) - (H - padB - 10) * g;
            return (
              <g key={i}>
                <line x1={padL} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 3" />
                <text x={4} y={y + 3} fontSize="9" fill="rgba(220,226,240,0.5)">
                  {money(max * g)}
                </text>
              </g>
            );
          })}
          {semanas.map((s, idx) => {
            const x = padL + idx * (barW + 6) + 3;
            const hB = ((H - padB - 10) * s.bruto) / max;
            const hP = ((H - padB - 10) * s.ponderado) / max;
            return (
              <g key={s.label}>
                <rect x={x} y={H - padB - hB} width={barW / 2 - 1} height={hB} fill="#A5B5E0" rx={2} opacity={0.85} />
                <rect x={x + barW / 2 + 1} y={H - padB - hP} width={barW / 2 - 1} height={hP} fill="#9BCB9F" rx={2} />
                <text x={x + barW / 2} y={H - 6} fontSize="9" fill="rgba(220,226,240,0.6)" textAnchor="middle">
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </NCard>
  );
}
