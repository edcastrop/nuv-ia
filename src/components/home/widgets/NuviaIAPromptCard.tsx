import { Sparkles, ArrowRight } from "lucide-react";

export interface NuviaIAPromptCardProps {
  /** Prompt sugerido del día según rol */
  prompt: string;
  /** Hint corto opcional bajo el prompt */
  hint?: string;
  /** Handler para abrir el panel NUVIA IA con el prompt precargado */
  onAsk?: (prompt: string) => void;
}

export function NuviaIAPromptCard({ prompt, hint, onAsk }: NuviaIAPromptCardProps) {
  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-lg)] p-5"
      style={{
        background:
          "linear-gradient(135deg, rgba(68,93,163,0.18) 0%, var(--nuvia-bg-tertiary) 60%, rgba(132,185,143,0.16) 100%)",
        border: "1px solid var(--nuvia-border)",
        color: "var(--nuvia-text-primary)",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "rgba(132,185,143,0.18)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-accent-green)",
          }}
        >
          <Sparkles size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--nuvia-text-muted)" }}
          >
            NUVIA IA · Sugerencia del día
          </div>
          <p className="mt-1 text-[15px] leading-snug font-medium">{prompt}</p>
          {hint && (
            <p
              className="mt-1 text-[12px] leading-relaxed"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {hint}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAsk?.(prompt)}
          className="hidden md:inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
          style={{
            background: "var(--nuvia-gradient-primary)",
            color: "var(--nuvia-text-primary)",
            boxShadow: "0 10px 24px -10px rgba(68,93,163,0.55)",
          }}
        >
          Preguntar
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
