// Panel lateral derecho colapsable con la "Torre de control" del Pipeline.
// Mantiene KPIs, flujo operativo, alertas y momentum fuera del header
// para que los leads (Kanban) sean los protagonistas.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Gauge,
  LayoutGrid,
  Radar,
  ShieldAlert,
  TrendingUp,
  PiggyBank,
  X,
} from "lucide-react";

export type ControlFase = { id: string; label: string; count: number };
export type PipelineControlBucket = {
  id: string;
  nombre: string;
  total: number;
  ahorro: number;
  casos: number;
};
export type PipelineControlBreakdown = {
  total: number;
  ahorro: number;
  casos: number;
  sinAnalista: number;
  bancos: PipelineControlBucket[];
  analistas: PipelineControlBucket[];
  oficinas: PipelineControlBucket[];
};

export type PipelineControlProps = {
  total: number;
  estancados: number;
  promedio: number;
  honorarios: number;
  fases: ControlFase[];
  criticos: number;
  listos: number;
  breakdown: PipelineControlBreakdown;
  soloStuck: boolean;
  onToggleStuck: () => void;
  fmtCOP: (n: number) => string;
  /** Controlado desde el header (chip "Control"). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Filtrar pipeline al hacer click en un banco/analista. */
  onSelectBanco?: (banco: string) => void;
  onSelectAnalista?: (analistaId: string) => void;
};

export function PipelineControlPanel(props: PipelineControlProps) {
  const { open, onOpenChange } = props;

  // Atajo: "c" para alternar el panel de control
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
      if (isTyping) return;
      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const { total, estancados, promedio, honorarios, fases, criticos, listos, breakdown, soloStuck, onToggleStuck, fmtCOP, onSelectBanco, onSelectAnalista } = props;

  const faseColors: Record<string, string> = {
    comercial: "var(--nuvia-accent-blue)",
    operativa: "var(--nuvia-accent-purple, #8a7cd6)",
    banco: "var(--nuvia-warning)",
    cobro: "var(--nuvia-accent-green)",
    fin: "color-mix(in oklab, var(--nuvia-accent-green) 70%, white)",
  };
  const bottleneck = [...fases].filter((f) => f.id !== "fin").sort((a, b) => b.count - a.count)[0];

  return (
    <>
      {/* Overlay (cuando está abierto) — el botón de apertura vive ahora en el header */}
      {open && (
        <div
          aria-hidden
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-[45] bg-black/30 backdrop-blur-[2px]"
          style={{ zIndex: 45 }}
        />
      )}


      {/* Drawer */}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-[60] flex h-full w-full max-w-[380px] flex-col border-l transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          zIndex: 60,
          background: "linear-gradient(180deg, var(--nuvia-bg-secondary) 0%, var(--nuvia-bg-primary) 100%)",
          borderColor: "var(--nuvia-border)",
          boxShadow: open ? "-24px 0 48px -24px rgba(0,0,0,0.55)" : "none",
        }}
      >
        {/* Header del drawer */}
        <div className="flex items-center justify-between border-b border-[var(--nuvia-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="grid h-8 w-8 place-items-center rounded-lg"
              style={{
                background: "var(--nuvia-gradient-primary)",
                boxShadow: "0 0 18px -6px color-mix(in oklab, var(--nuvia-accent-blue) 60%, transparent)",
              }}
            >
              <Radar className="h-4 w-4 text-[var(--nuvia-text-primary)]" />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-accent-green)]">
                NUVIA · Torre de control
              </div>
              <div className="text-sm font-semibold text-[var(--nuvia-text-primary)]">Pipeline en vivo</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            title="Cerrar (C)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--nuvia-border)] text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-accent-blue)] hover:text-[var(--nuvia-text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* KPIs */}
          <div>
            <SectionLabel>Indicadores</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <KpiMini
                label="Activos"
                value={String(total)}
                icon={<LayoutGrid className="h-3 w-3" />}
              />
              <KpiMini
                label="En riesgo"
                value={String(estancados)}
                subtext={`${Math.round((estancados / Math.max(1, total)) * 100)}%`}
                tone="danger"
                icon={<ShieldAlert className="h-3 w-3" />}
              />
              <KpiMini
                label="Velocidad"
                value={`${promedio}d`}
                icon={<Gauge className="h-3 w-3 text-[var(--nuvia-accent-blue)]" />}
              />
              <KpiMini
                label="Valor"
                value={fmtCOP(honorarios)}
                tone="success"
                icon={<Coins className="h-3 w-3" />}
              />
            </div>
          </div>

          {/* Flujo operativo */}
          {total > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <SectionLabel className="mb-0">Flujo operativo</SectionLabel>
                {bottleneck && (
                  <span className="text-[10px] tabular-nums text-[var(--nuvia-warning)]">
                    Cuello: <span className="font-bold text-[var(--nuvia-text-primary)]">{bottleneck.label}</span>
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {fases.map((f, idx) => {
                  const pct = Math.round((f.count / Math.max(1, total)) * 100);
                  const isBottleneck = f.id === bottleneck?.id;
                  const color = faseColors[f.id] ?? "var(--nuvia-accent-blue)";
                  return (
                    <div
                      key={f.id}
                      className="relative overflow-hidden rounded-lg border px-2.5 py-2"
                      style={{
                        borderColor: `color-mix(in oklab, ${color} ${isBottleneck ? 50 : 22}%, transparent)`,
                        background: `linear-gradient(135deg, color-mix(in oklab, ${color} ${isBottleneck ? 14 : 6}%, transparent), transparent)`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-semibold text-[var(--nuvia-text-secondary)]">{idx + 1}.</span>
                          <span className="font-semibold text-[var(--nuvia-text-primary)]">{f.label}</span>
                          {isBottleneck && (
                            <span
                              className="rounded px-1 text-[9px] font-bold uppercase text-[var(--nuvia-bg-primary)]"
                              style={{ background: color }}
                            >
                              cuello
                            </span>
                          )}
                        </div>
                        <div className="flex items-baseline gap-1.5 tabular-nums">
                          <span className="text-sm font-bold text-[var(--nuvia-text-primary)]">{f.count}</span>
                          <span className="text-[10px] font-semibold" style={{ color }}>{pct}%</span>
                        </div>
                      </div>
                      <div
                        className="absolute bottom-0 left-0 h-[2px]"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alertas */}
          {total > 0 && (
            <div>
              <SectionLabel>Alertas</SectionLabel>
              <div className="space-y-2">
                <AlertRow
                  tone="danger"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label="Críticos"
                  value={criticos}
                  hint="Más de 2× el SLA"
                />
                <AlertRow
                  tone="warning"
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Estancados"
                  value={estancados}
                  hint="Sobre SLA por etapa"
                  active={soloStuck}
                  onClick={onToggleStuck}
                />
                <AlertRow
                  tone="success"
                  icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  label="Listos para cierre"
                  value={listos}
                  hint="En pago y paz y salvo"
                />
              </div>
            </div>
          )}

          {/* Ahorro acumulado */}
          <AhorroAcumuladoSection
            fmtCOP={fmtCOP}
            breakdown={breakdown}
            onSelectBanco={onSelectBanco}
            onSelectAnalista={onSelectAnalista}
            onClose={() => onOpenChange(false)}
          />

          {/* Momentum */}
          <div>
            <SectionLabel>Momentum</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              <MomentumChip value="+12" label="semana" />
              <MomentumChip value="+18%" label="velocidad" accent />
              <MomentumChip value="+7" label="cierres hoy" accent />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-secondary)] ${className}`}>
      {children}
    </div>
  );
}

function KpiMini({
  label,
  value,
  subtext,
  tone,
  icon,
}: {
  label: string;
  value: string;
  subtext?: string;
  tone?: "danger" | "success";
  icon?: ReactNode;
}) {
  const accent =
    tone === "danger" ? "var(--nuvia-danger)" : tone === "success" ? "var(--nuvia-accent-green)" : "var(--nuvia-text-primary)";
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{
        borderColor: "var(--nuvia-border)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
        {icon}
        {label}
      </div>
      <div
        className="mt-0.5 text-lg font-bold tabular-nums leading-none"
        style={{ color: accent, textShadow: tone ? `0 0 18px color-mix(in oklab, ${accent} 35%, transparent)` : undefined }}
      >
        {value}
      </div>
      {subtext && (
        <div className="mt-0.5 text-[10px] text-[var(--nuvia-text-secondary)]">{subtext}</div>
      )}
    </div>
  );
}

function AlertRow({
  tone,
  icon,
  label,
  value,
  hint,
  active,
  onClick,
}: {
  tone: "danger" | "warning" | "success";
  icon: ReactNode;
  label: string;
  value: number;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const color =
    tone === "danger" ? "var(--nuvia-danger)" : tone === "warning" ? "var(--nuvia-warning)" : "var(--nuvia-accent-green)";
  const clickable = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
        clickable ? "cursor-pointer hover:brightness-110" : "cursor-default"
      }`}
      style={{
        borderColor: active ? color : `color-mix(in oklab, ${color} 30%, transparent)`,
        background: active
          ? `color-mix(in oklab, ${color} 14%, transparent)`
          : `color-mix(in oklab, ${color} 6%, transparent)`,
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md" style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}>
          {icon}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums" style={{ color }}>{value}</span>
            <span className="text-xs font-semibold text-[var(--nuvia-text-primary)]">{label}</span>
          </div>
          {hint && <div className="truncate text-[10px] text-[var(--nuvia-text-secondary)]">{hint}</div>}
        </div>
      </div>
      {clickable && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--nuvia-text-secondary)]" />}
    </button>
  );
}

function MomentumChip({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div
      className="rounded-lg border px-2 py-1.5 text-center"
      style={{
        borderColor: "var(--nuvia-border)",
        background: "rgba(255,255,255,0.025)",
      }}
    >
      <div className="flex items-center justify-center gap-1">
        <TrendingUp className="h-3 w-3 text-[var(--nuvia-accent-green)]" />
        <span
          className="text-xs font-bold tabular-nums"
          style={{ color: accent ? "var(--nuvia-accent-green)" : "var(--nuvia-text-primary)" }}
        >
          {value}
        </span>
      </div>
      <div className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">{label}</div>
    </div>
  );
}

// =============================================================
// Sección "Sumatoria pipeline" — datos en vivo visibles en tablero.
// =============================================================

type CorteId = "bancos" | "analistas" | "oficinas";

function fmtAbreviado(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "$ 0";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$ ${(v / 1_000_000_000).toFixed(1)} MM`;
  if (abs >= 1_000_000) return `$ ${(v / 1_000_000).toFixed(1)} M`;
  if (abs >= 1_000) return `$ ${(v / 1_000).toFixed(0)}k`;
  return `$ ${Math.round(v)}`;
}

function AhorroAcumuladoSection({
  fmtCOP,
  breakdown,
  onSelectBanco,
  onSelectAnalista,
  onClose,
}: {
  fmtCOP: (n: number) => string;
  breakdown: PipelineControlBreakdown;
  onSelectBanco?: (banco: string) => void;
  onSelectAnalista?: (analistaId: string) => void;
  onClose: () => void;
}) {
  const [corte, setCorte] = useState<CorteId>("bancos");

  const buckets = useMemo(() => {
    if (corte === "bancos") return breakdown.bancos;
    if (corte === "analistas") return breakdown.analistas;
    return breakdown.oficinas;
  }, [breakdown, corte]);

  const handleClick = (b: PipelineControlBucket) => {
    if (corte === "bancos" && onSelectBanco) {
      onSelectBanco(b.id);
      onClose();
    } else if (corte === "analistas" && onSelectAnalista) {
      onSelectAnalista(b.id);
      onClose();
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SectionLabel className="mb-0">
          <span className="inline-flex items-center gap-1.5">
            <PiggyBank className="h-3 w-3 text-[var(--nuvia-accent-green)]" /> Sumatoria pipeline
          </span>
        </SectionLabel>
      </div>

      {/* Total */}
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: "color-mix(in oklab, var(--nuvia-accent-green) 30%, transparent)",
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-green) 10%, transparent), transparent)",
        }}
      >
        <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
          Total visible · todos los analistas
        </div>
        <div
          className="mt-0.5 text-2xl font-bold tabular-nums leading-none text-[var(--nuvia-accent-green)]"
          style={{
            textShadow:
              "0 0 24px color-mix(in oklab, var(--nuvia-accent-green) 40%, transparent)",
          }}
        >
          {fmtCOP(breakdown.total)}
        </div>
        <div className="mt-1 text-[11px] text-[var(--nuvia-text-secondary)]">
          {`${breakdown.casos} casos · ahorro ${fmtAbreviado(breakdown.ahorro)}${breakdown.sinAnalista > 0 ? ` · ${breakdown.sinAnalista} sin analista` : ""}`}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-1">
        {(
          [
            { id: "bancos", label: "Bancos" },
            { id: "analistas", label: "Analistas" },
            { id: "oficinas", label: "Oficinas" },
          ] as { id: CorteId; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setCorte(t.id)}
            className="flex-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition"
            style={{
              borderColor: corte === t.id ? "var(--nuvia-accent-blue)" : "var(--nuvia-border)",
              background:
                corte === t.id
                  ? "color-mix(in oklab, var(--nuvia-accent-blue) 14%, transparent)"
                  : "rgba(255,255,255,0.02)",
              color:
                corte === t.id ? "var(--nuvia-text-primary)" : "var(--nuvia-text-secondary)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desglose */}
      <div className="mt-2 space-y-1">
        {corte === "analistas" && breakdown.casos > 0 && (
          <div className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: "color-mix(in oklab, var(--nuvia-accent-green) 35%, transparent)", background: "color-mix(in oklab, var(--nuvia-accent-green) 9%, transparent)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-[var(--nuvia-text-primary)]">Todos los analistas</span>
              <span className="text-xs font-bold tabular-nums text-[var(--nuvia-accent-green)]">{fmtAbreviado(breakdown.total)}</span>
            </div>
            <div className="mt-0.5 text-[10px] text-[var(--nuvia-text-secondary)]">{breakdown.casos} casos · ahorro {fmtAbreviado(breakdown.ahorro)}</div>
          </div>
        )}
        {buckets.length === 0 && (
          <div className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.02)] px-3 py-2 text-[11px] text-[var(--nuvia-text-secondary)]">
            Sin casos visibles en este corte.
          </div>
        )}
        {buckets.map((b) => {
            const clickable =
              (corte === "bancos" && !!onSelectBanco) ||
              (corte === "analistas" && !!onSelectAnalista);
            const pct =
              breakdown.total > 0 ? Math.round((b.total / breakdown.total) * 100) : 0;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleClick(b)}
                disabled={!clickable}
                className={`group relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left transition ${
                  clickable ? "cursor-pointer hover:border-[var(--nuvia-accent-blue)]" : "cursor-default"
                }`}
                style={{
                  borderColor: "var(--nuvia-border)",
                  background: "rgba(255,255,255,0.025)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--nuvia-text-primary)]">
                    {b.nombre}
                  </div>
                  <div className="flex shrink-0 items-baseline gap-1.5 tabular-nums">
                    <span className="text-xs font-bold text-[var(--nuvia-accent-green)]">
                      {fmtAbreviado(b.total)}
                    </span>
                    <span className="text-[10px] text-[var(--nuvia-text-secondary)]">{b.casos}</span>
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-[var(--nuvia-text-secondary)]">Ahorro {fmtAbreviado(b.ahorro)}</div>
                <div
                  className="absolute bottom-0 left-0 h-[2px]"
                  style={{
                    width: `${pct}%`,
                    background: "var(--nuvia-accent-green)",
                    opacity: 0.6,
                  }}
                />
              </button>
            );
          })}
      </div>
    </div>
  );
}
