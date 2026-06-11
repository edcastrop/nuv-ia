import { Bot, ArrowRight } from "lucide-react";

export interface IARecomendacion {
  id: string;
  title: string;
  detail?: string;
  tone?: "blue" | "green" | "warning";
}

const toneColor = {
  blue: "var(--nuvia-accent-blue)",
  green: "var(--nuvia-accent-green)",
  warning: "var(--nuvia-warning)",
};

export function IARecomendacionesCard({
  items,
  title = "Recomendaciones inteligentes",
  onOpenIA,
}: {
  items: IARecomendacion[];
  title?: string;
  onOpenIA?: () => void;
}) {
  return (
    <section
      className="glass-card p-5"
      style={{ color: "var(--nuvia-text-primary)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "rgba(132,185,143,0.16)",
              color: "var(--nuvia-accent-green)",
              border: "1px solid var(--nuvia-border)",
            }}
          >
            <Bot size={13} />
          </span>
          <h2
            className="text-[13px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            {title}
          </h2>
        </div>
        {onOpenIA && (
          <button
            onClick={onOpenIA}
            className="text-[11px] inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--nuvia-accent-blue)" }}
          >
            Abrir NUVIA IA <ArrowRight size={11} />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-[12.5px] py-6 text-center" style={{ color: "var(--nuvia-text-muted)" }}>
          NUVIA IA aún no tiene recomendaciones para mostrar.
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5"
              style={{
                background: "rgba(5,8,22,0.35)",
                border: "1px solid var(--nuvia-border)",
              }}
            >
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: toneColor[r.tone ?? "blue"] }}
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold leading-snug">{r.title}</div>
                {r.detail && (
                  <div
                    className="mt-0.5 text-[11.5px] leading-snug"
                    style={{ color: "var(--nuvia-text-secondary)" }}
                  >
                    {r.detail}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
