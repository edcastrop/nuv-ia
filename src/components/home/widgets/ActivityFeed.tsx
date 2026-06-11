import type { ReactNode } from "react";

export interface ActivityItem {
  id: string;
  icon?: ReactNode;
  title: string;
  modulo?: string;
  when: string; // ya formateado
}

export function ActivityFeed({
  items,
  title = "Actividad reciente",
  emptyLabel = "Sin actividad reciente.",
}: {
  items: ActivityItem[];
  title?: string;
  emptyLabel?: string;
}) {
  return (
    <section className="glass-card p-5" style={{ color: "var(--nuvia-text-primary)" }}>
      <h2
        className="text-[13px] font-bold uppercase tracking-[0.18em] mb-4"
        style={{ color: "var(--nuvia-text-muted)" }}
      >
        {title}
      </h2>
      {items.length === 0 ? (
        <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--nuvia-text-muted)" }}>
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3">
              <span
                className="mt-1 h-2 w-2 shrink-0 rounded-full"
                style={{ background: "var(--nuvia-accent-blue)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] leading-snug">{it.title}</div>
                <div
                  className="mt-0.5 text-[10.5px] uppercase tracking-wider"
                  style={{ color: "var(--nuvia-text-muted)" }}
                >
                  {it.modulo ? `${it.modulo} · ` : ""}
                  {it.when}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
