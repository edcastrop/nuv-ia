// Panel lateral derecho colapsable con la "Torre de control" del Pipeline.
// Mantiene KPIs, flujo operativo, alertas y momentum fuera del header
// para que los leads (Kanban) sean los protagonistas.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
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
import {
  getAhorroAcumulado,
  type AhorroAcumulado,
  type AhorroBucket,
  type AhorroRango,
} from "@/lib/pipelineAhorro.functions";

export type ControlFase = { id: string; label: string; count: number };

export type PipelineControlProps = {
  total: number;
  estancados: number;
  promedio: number;
  honorarios: number;
  fases: ControlFase[];
  criticos: number;
  listos: number;
  soloStuck: boolean;
  onToggleStuck: () => void;
  fmtCOP: (n: number) => string;
  /** Controlado desde el header (chip "Control"). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

  const { total, estancados, promedio, honorarios, fases, criticos, listos, soloStuck, onToggleStuck, fmtCOP } = props;

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
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px]"
        />
      )}


      {/* Drawer */}
      <aside
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 flex h-full w-full max-w-[380px] flex-col border-l transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
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

// Re-export para evitar warnings de imports sin usar en algunos bundlers
export { ArrowRight };
