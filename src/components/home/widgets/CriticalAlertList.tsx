import { AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type AlertSeverity = "critical" | "warning" | "info";

export interface CriticalAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  to?: string;
  meta?: string; // ej. "hace 2 h"
}

const severityMap: Record<AlertSeverity, { color: string; Icon: typeof AlertTriangle }> = {
  critical: { color: "var(--nuvia-danger)", Icon: AlertTriangle },
  warning: { color: "var(--nuvia-warning)", Icon: AlertCircle },
  info: { color: "var(--nuvia-accent-blue)", Icon: Info },
};

export function CriticalAlertList({
  alerts,
  title = "Pendientes críticos",
  emptyLabel = "Sin alertas activas.",
}: {
  alerts: CriticalAlert[];
  title?: string;
  emptyLabel?: string;
}) {
  return (
    <section
      className="glass-card p-5"
      style={{ color: "var(--nuvia-text-primary)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
          {title}
        </h2>
        <span
          className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          {alerts.length}
        </span>
      </div>

      {alerts.length === 0 ? (
        <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--nuvia-text-muted)" }}>
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const { color, Icon } = severityMap[a.severity];
            const Body = (
              <div
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]"
                style={{
                  background: "rgba(5,8,22,0.35)",
                  border: "1px solid var(--nuvia-border)",
                }}
              >
                <span
                  className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `color-mix(in oklab, ${color} 16%, transparent)`,
                    color,
                  }}
                >
                  <Icon size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-snug">{a.title}</div>
                  {a.detail && (
                    <div
                      className="mt-0.5 text-[11.5px] leading-snug"
                      style={{ color: "var(--nuvia-text-secondary)" }}
                    >
                      {a.detail}
                    </div>
                  )}
                  {a.meta && (
                    <div
                      className="mt-1 text-[10.5px] uppercase tracking-wider"
                      style={{ color: "var(--nuvia-text-muted)" }}
                    >
                      {a.meta}
                    </div>
                  )}
                </div>
                {a.to && (
                  <ArrowRight size={14} style={{ color: "var(--nuvia-text-muted)" }} className="mt-1 shrink-0" />
                )}
              </div>
            );
            return (
              <li key={a.id}>{a.to ? <Link to={a.to}>{Body}</Link> : Body}</li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
