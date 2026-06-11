/**
 * Torre de Control NUVIA — widgets ejecutivos.
 * Diseñados con tokens NUVIA (sin hex hardcoded). Mantienen ADN Login/Registro.
 */
import { useState } from "react";
import {
  TrendingUp, TrendingDown, Minus, Sparkles, AlertTriangle, ArrowRight, X,
  Target, Briefcase, PieChart, Activity, ShieldAlert,
} from "lucide-react";
import type {
  TorreKpi, FunnelStage, AgingBucket, ProductivityRow,
  ProjectedRevenuePoint, RiskRow,
} from "@/lib/torreControlMetrics.functions";
import type { ExecutiveInsight } from "@/lib/torreControlInsights.functions";

// ---------- format helpers ----------
const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);
const fmtNum = (v: number) => new Intl.NumberFormat("es-CO").format(v || 0);
const fmtKpi = (k: TorreKpi) =>
  k.unit === "currency" ? fmtCOP(k.value) : k.unit === "percent" ? `${k.value.toFixed(1)}%` : fmtNum(k.value);

// =============== ExecutiveHero ===============
export function ExecutiveHero({
  nombre, period, onPeriodChange, starValue, starLabel,
}: {
  nombre: string;
  period: "today" | "7d" | "mtd" | "qtd" | "ytd";
  onPeriodChange: (p: "today" | "7d" | "mtd" | "qtd" | "ytd") => void;
  starValue: string;
  starLabel: string;
}) {
  const opts: Array<{ k: typeof period; label: string }> = [
    { k: "today", label: "Hoy" }, { k: "7d", label: "7d" },
    { k: "mtd", label: "MTD" }, { k: "qtd", label: "QTD" }, { k: "ytd", label: "YTD" },
  ];
  return (
    <div
      className="relative overflow-hidden rounded-2xl px-6 py-7 sm:px-8 sm:py-9"
      style={{
        background: "var(--nuvia-gradient-primary)",
        border: "1px solid var(--nuvia-border)",
        boxShadow: "var(--nuvia-shadow-lg)",
      }}
    >
      <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] tracking-[0.22em] uppercase"
            style={{ border: "1px solid var(--nuvia-border-strong)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }}>
            <Sparkles className="h-3 w-3" /> Torre de Control · NUVIA
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--nuvia-text-primary)" }}>
            Buenos días, {nombre || "Dirección"}
          </h1>
          <p className="mt-2 text-sm sm:text-base max-w-xl" style={{ color: "var(--nuvia-text-secondary)" }}>
            {starLabel}: <span style={{ color: "var(--nuvia-text-primary)" }} className="font-semibold">{starValue}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl p-1"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--nuvia-border)" }}>
          {opts.map((o) => {
            const active = o.k === period;
            return (
              <button
                key={o.k}
                onClick={() => onPeriodChange(o.k)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                style={{
                  background: active ? "var(--nuvia-bg-card)" : "transparent",
                  color: active ? "var(--nuvia-text-primary)" : "var(--nuvia-text-secondary)",
                  border: active ? "1px solid var(--nuvia-border-strong)" : "1px solid transparent",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============== Sparkline ===============
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120, h = 32;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// =============== KpiStripCard ===============
const KPI_ICON: Record<TorreKpi["key"], React.ComponentType<{ className?: string }>> = {
  ahorro: Target, casos: Briefcase, conversion: TrendingUp,
  honorarios: PieChart, cartera: Activity, productividad: Sparkles,
};

export function KpiStripCard({ kpi, onClick }: { kpi: TorreKpi; onClick?: () => void }) {
  const Icon = KPI_ICON[kpi.key];
  const deltaPositive = (kpi.delta ?? 0) >= 0;
  const DeltaIcon = kpi.delta == null ? Minus : deltaPositive ? TrendingUp : TrendingDown;
  const deltaColor = kpi.delta == null
    ? "var(--nuvia-text-muted)"
    : deltaPositive ? "var(--nuvia-accent-green)" : "var(--nuvia-danger)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card text-left w-full p-5 rounded-2xl transition hover:[transform:translateY(-1px)]"
      style={{ border: "1px solid var(--nuvia-border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
          <Icon className="h-3.5 w-3.5" />
          {kpi.label}
        </div>
        <div className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: deltaColor }}>
          <DeltaIcon className="h-3 w-3" />
          {kpi.delta == null ? "—" : `${deltaPositive ? "+" : ""}${kpi.delta}%`}
        </div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: "var(--nuvia-text-primary)" }}>
        {fmtKpi(kpi)}
      </div>
      <div className="mt-3 opacity-80">
        <Sparkline data={kpi.spark} color="var(--nuvia-accent-blue)" />
      </div>
    </button>
  );
}

// =============== FunnelChart ===============
export function FunnelChart({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4" style={{ color: "var(--nuvia-accent-blue)" }} />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
          Funnel comercial
        </h3>
      </div>
      <div className="space-y-2.5">
        {stages.map((s, i) => {
          const pct = (s.count / max) * 100;
          const conv = i > 0 && stages[i - 1].count > 0
            ? ((s.count / stages[i - 1].count) * 100).toFixed(0) + "%"
            : null;
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: "var(--nuvia-text-secondary)" }}>{s.label}</span>
                <span style={{ color: "var(--nuvia-text-primary)" }} className="font-medium">
                  {s.count} {conv && <span style={{ color: "var(--nuvia-text-muted)" }}>· conv {conv}</span>}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--nuvia-bg-secondary)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.max(pct, 4)}%`, background: "var(--nuvia-gradient-primary)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============== AgingStackedBar ===============
const AGING_COLOR: Record<AgingBucket["bucket"], string> = {
  "0-30": "var(--nuvia-accent-green)",
  "31-60": "var(--nuvia-accent-blue)",
  "61-90": "var(--nuvia-warning)",
  "90+": "var(--nuvia-danger)",
};

export function AgingStackedBar({ aging }: { aging: AgingBucket[] }) {
  const total = aging.reduce((s, a) => s + a.total, 0);
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: "var(--nuvia-accent-blue)" }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
            Cartera por aging
          </h3>
        </div>
        <div className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>
          Total: <span style={{ color: "var(--nuvia-text-primary)" }} className="font-semibold">{fmtCOP(total)}</span>
        </div>
      </div>
      <div className="flex h-4 w-full overflow-hidden rounded-full" style={{ background: "var(--nuvia-bg-secondary)" }}>
        {aging.map((a) => {
          const pct = total > 0 ? (a.total / total) * 100 : 0;
          if (pct === 0) return null;
          return <div key={a.bucket} style={{ width: `${pct}%`, background: AGING_COLOR[a.bucket] }} title={a.bucket} />;
        })}
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {aging.map((a) => (
          <div key={a.bucket} className="rounded-xl p-3" style={{ background: "var(--nuvia-bg-secondary)", border: "1px solid var(--nuvia-border)" }}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-muted)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: AGING_COLOR[a.bucket] }} />
              {a.bucket} días
            </div>
            <div className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{fmtCOP(a.total)}</div>
            <div className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>{a.count} casos</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============== AreaProductivityBars ===============
export function AreaProductivityBars({ rows }: { rows: ProductivityRow[] }) {
  const max = Math.max(...rows.map((r) => r.casos), 1);
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Briefcase className="h-4 w-4" style={{ color: "var(--nuvia-accent-blue)" }} />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
          Productividad por área
        </h3>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const slaColor = r.sla_pct >= 85 ? "var(--nuvia-accent-green)" : r.sla_pct >= 70 ? "var(--nuvia-warning)" : "var(--nuvia-danger)";
          return (
            <div key={r.area}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span style={{ color: "var(--nuvia-text-secondary)" }}>{r.area}</span>
                <span className="flex items-center gap-3">
                  <span style={{ color: "var(--nuvia-text-primary)" }} className="font-medium">{r.casos}</span>
                  <span style={{ color: slaColor }} className="font-semibold">SLA {r.sla_pct}%</span>
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--nuvia-bg-secondary)" }}>
                <div className="h-full" style={{ width: `${(r.casos / max) * 100}%`, background: "var(--nuvia-gradient-primary)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============== ProjectedRevenueChart ===============
export function ProjectedRevenueChart({ points }: { points: ProjectedRevenuePoint[] }) {
  const meta = points[0]?.meta ?? 0;
  const facturado = points[0]?.facturado ?? 0;
  const proyectado = points[1]?.proyectado ?? 0;
  const pctFact = meta > 0 ? Math.min(100, (facturado / meta) * 100) : 0;
  const pctProy = meta > 0 ? Math.min(100, (proyectado / meta) * 100) : 0;
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-4 w-4" style={{ color: "var(--nuvia-accent-blue)" }} />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
          Honorarios — facturado vs proyección vs meta
        </h3>
      </div>
      <div className="space-y-4">
        <Bar label="Facturado MTD" value={facturado} pct={pctFact} color="var(--nuvia-accent-green)" />
        <Bar label="Proyección fin de mes" value={proyectado} pct={pctProy} color="var(--nuvia-accent-blue)" />
        <Bar label="Meta del mes" value={meta} pct={100} color="var(--nuvia-border-strong)" />
      </div>
    </div>
  );
}
function Bar({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span style={{ color: "var(--nuvia-text-secondary)" }}>{label}</span>
        <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{fmtCOP(value)}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--nuvia-bg-secondary)" }}>
        <div className="h-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
      </div>
    </div>
  );
}

// =============== ExecutiveInsightsCard ===============
const SEV_COLOR: Record<ExecutiveInsight["severidad"], string> = {
  info: "var(--nuvia-accent-blue)",
  warning: "var(--nuvia-warning)",
  danger: "var(--nuvia-danger)",
};

export function ExecutiveInsightsCard({
  insights, loading, onAnalyze, cached, generatedAt,
}: {
  insights: ExecutiveInsight[] | null;
  loading: boolean;
  onAnalyze: () => void;
  cached?: boolean;
  generatedAt?: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--nuvia-accent-green)" }} />
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
            NUVIA IA · Executive Insights
          </h3>
        </div>
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border-strong)" }}
        >
          {loading ? "Analizando…" : insights ? "Re-analizar" : "Analizar con NUVIA IA"}
        </button>
      </div>
      {!insights && !loading && (
        <p className="text-sm" style={{ color: "var(--nuvia-text-muted)" }}>
          Genera recomendaciones ejecutivas a partir del snapshot agregado del periodo. No se envían datos personales al modelo.
        </p>
      )}
      {loading && (
        <p className="text-sm" style={{ color: "var(--nuvia-text-muted)" }}>NUVIA está leyendo el snapshot del periodo…</p>
      )}
      {insights && (
        <ul className="space-y-3">
          {insights.map((i) => (
            <li key={i.id} className="flex gap-3 rounded-xl p-3"
              style={{ background: "var(--nuvia-bg-secondary)", border: "1px solid var(--nuvia-border)" }}>
              <span className="mt-0.5 h-2 w-2 rounded-full shrink-0" style={{ background: SEV_COLOR[i.severidad] }} />
              <div className="min-w-0">
                <div className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{i.titulo}</div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>{i.narrativa}</div>
                <div className="mt-1.5 text-xs flex items-center gap-1" style={{ color: "var(--nuvia-accent-blue)" }}>
                  <ArrowRight className="h-3 w-3" /> {i.accion}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {insights && generatedAt && (
        <div className="mt-3 text-[10px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
          {cached ? "Cache" : "Nuevo"} · generado {new Date(generatedAt).toLocaleString("es-CO")}
        </div>
      )}
    </div>
  );
}

// =============== RiskTable ===============
export function RiskTable({ rows }: { rows: RiskRow[] }) {
  return (
    <div className="glass-card rounded-2xl p-5" style={{ border: "1px solid var(--nuvia-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="h-4 w-4" style={{ color: "var(--nuvia-warning)" }} />
        <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
          Riesgos y alertas ejecutivas
        </h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--nuvia-text-muted)" }}>
          Sin alertas en el periodo. Operación dentro de parámetros.
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--nuvia-border)" }}>
          {rows.map((r) => (
            <li key={r.id} className="py-2.5 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"
                style={{ color: r.severidad === "danger" ? "var(--nuvia-danger)" : r.severidad === "warning" ? "var(--nuvia-warning)" : "var(--nuvia-accent-blue)" }} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: "var(--nuvia-text-primary)" }}>{r.cliente}</div>
                <div className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>
                  {r.banco ? `${r.banco} · ` : ""}{r.motivo}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =============== KpiDetailModal ===============
export function KpiDetailModal({
  kpi, onClose, extra,
}: { kpi: TorreKpi | null; onClose: () => void; extra?: React.ReactNode }) {
  if (!kpi) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="glass-modal w-full max-w-lg rounded-2xl p-6"
        style={{ border: "1px solid var(--nuvia-border-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "var(--nuvia-text-muted)" }}>
              KPI · Detalle
            </div>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{kpi.label}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition hover:[background:var(--nuvia-bg-secondary)]">
            <X className="h-4 w-4" style={{ color: "var(--nuvia-text-secondary)" }} />
          </button>
        </div>
        <div className="text-3xl font-semibold mb-2" style={{ color: "var(--nuvia-text-primary)" }}>{fmtKpi(kpi)}</div>
        <div className="text-sm mb-4" style={{ color: "var(--nuvia-text-secondary)" }}>
          {kpi.delta == null ? "Sin comparativo previo" : `Variación: ${kpi.delta >= 0 ? "+" : ""}${kpi.delta}% vs periodo anterior`}
        </div>
        <div className="rounded-xl p-3 mb-4" style={{ background: "var(--nuvia-bg-secondary)", border: "1px solid var(--nuvia-border)" }}>
          <Sparkline data={kpi.spark} color="var(--nuvia-accent-blue)" />
        </div>
        {extra}
        <p className="text-xs" style={{ color: "var(--nuvia-text-muted)" }}>
          Navegación al módulo correspondiente disponible en Fase 7.5.
        </p>
      </div>
    </div>
  );
}

// Hook auxiliar de modal
export function useKpiModal() {
  const [active, setActive] = useState<TorreKpi | null>(null);
  return { active, open: setActive, close: () => setActive(null) };
}
