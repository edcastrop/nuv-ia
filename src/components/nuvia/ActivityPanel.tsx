import type { ReactNode } from "react";
import { NCard } from "./NCard";
import { SectionHeader } from "./SectionHeader";
import { EmptyState } from "./EmptyState";
import { Activity } from "lucide-react";

/**
 * NUVIA · ActivityPanel (Fase 7.6.1B)
 * Panel lateral/inferior estándar para actividad, alertas, pendientes, trazabilidad.
 */
export interface ActivityItem {
  id: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  meta?: string; // tiempo relativo, autor, etc
  tone?: "info" | "success" | "warning" | "danger";
}

interface ActivityPanelProps {
  title?: string;
  description?: string;
  items: ActivityItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  action?: ReactNode;
}

const TONE_DOT: Record<NonNullable<ActivityItem["tone"]>, string> = {
  info: "var(--nuvia-accent-blue)",
  success: "var(--nuvia-success)",
  warning: "var(--nuvia-warning)",
  danger: "var(--nuvia-danger)",
};

export function ActivityPanel({
  title = "Actividad reciente",
  description,
  items,
  emptyTitle = "Sin actividad reciente",
  emptyDescription = "Cuando ocurran eventos aparecerán aquí.",
  action,
}: ActivityPanelProps) {
  return (
    <NCard variant="default">
      <SectionHeader
        icon={<Activity size={16} />}
        title={title}
        description={description}
        action={action}
      />
      {items.length === 0 ? (
        <EmptyState compact title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-start gap-3"
              style={{ paddingBlock: "var(--nuvia-space-2)" }}
            >
              <span
                className="mt-1.5 h-2 w-2 rounded-full shrink-0"
                style={{ background: TONE_DOT[it.tone ?? "info"] }}
              />
              <div className="min-w-0 flex-1">
                <div
                  className="font-medium truncate"
                  style={{
                    fontSize: "var(--nuvia-text-body)",
                    color: "var(--nuvia-text-primary)",
                  }}
                >
                  {it.title}
                </div>
                {it.description && (
                  <div
                    className="mt-0.5"
                    style={{
                      fontSize: "var(--nuvia-text-caption)",
                      color: "var(--nuvia-text-secondary)",
                    }}
                  >
                    {it.description}
                  </div>
                )}
                {it.meta && (
                  <div
                    className="mt-1 uppercase"
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: "var(--nuvia-text-secondary)",
                      opacity: 0.7,
                    }}
                  >
                    {it.meta}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </NCard>
  );
}
