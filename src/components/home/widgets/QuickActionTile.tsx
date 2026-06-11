import type { ComponentType } from "react";
import { Link } from "@tanstack/react-router";

export interface QuickAction {
  to: string;
  label: string;
  desc?: string;
  icon: ComponentType<{ size?: number }>;
  tone?: "blue" | "green";
}

export interface QuickActionGridProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActionGrid({ actions, title = "Accesos rápidos" }: QuickActionGridProps) {
  if (!actions.length) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
          {title}
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <QuickActionTile key={a.to + a.label} action={a} />
        ))}
      </div>
    </section>
  );
}

export function QuickActionTile({ action }: { action: QuickAction }) {
  const Icon = action.icon;
  const accent =
    action.tone === "green" ? "var(--nuvia-accent-green)" : "var(--nuvia-accent-blue)";
  return (
    <Link
      to={action.to}
      className="glass-card group relative block p-4 transition-all hover:-translate-y-0.5"
      style={{ color: "var(--nuvia-text-primary)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style={{
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
            border: "1px solid var(--nuvia-border)",
            color: accent,
          }}
        >
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold leading-tight">{action.label}</div>
          {action.desc && (
            <div
              className="mt-0.5 text-[11.5px] truncate"
              style={{ color: "var(--nuvia-text-muted)" }}
            >
              {action.desc}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
