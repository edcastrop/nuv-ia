import { Link } from "@tanstack/react-router";

export type QACategoria = "excelente" | "aprobado" | "revisar" | "rechazado" | null | undefined;

const MAP: Record<NonNullable<QACategoria>, { label: string; emoji: string; bg: string; fg: string; border: string }> = {
  excelente:  { label: "QA CERTIFIED",  emoji: "🟢", bg: "#DDF4E3", fg: "#1F7A45", border: "#A6E2B6" },
  aprobado:   { label: "QA OBSERVADO",  emoji: "🟡", bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A" },
  revisar:    { label: "QA REVISIÓN",   emoji: "🟠", bg: "#FFEDD5", fg: "#9A3412", border: "#FED7AA" },
  rechazado:  { label: "QA FAILED",     emoji: "🔴", bg: "#FEE2E2", fg: "#991B1B", border: "#FCA5A5" },
};

export function QABadge({
  categoria,
  score,
  auditoriaId,
  size = "sm",
  className = "",
}: {
  categoria: QACategoria;
  score?: number | null;
  auditoriaId?: string | null;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  if (!categoria) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold ${className}`}
        style={{ background: "#F1F5F9", color: "#475569", borderColor: "#CBD5E1" }}
        title="Sin auditoría QA aún"
      >
        ⚪ QA Pendiente
      </span>
    );
  }
  const c = MAP[categoria];
  const pad = size === "xs" ? "px-1.5 py-[1px] text-[10px]" : size === "md" ? "px-3 py-1 text-xs" : "px-2 py-[2px] text-[11px]";
  const content = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-semibold ${pad} ${className}`}
      style={{ background: c.bg, color: c.fg, borderColor: c.border }}
      title={score != null ? `${c.label} · Score ${Number(score).toFixed(1)}/100` : c.label}
    >
      <span>{c.emoji}</span>
      <span>{c.label}</span>
      {score != null && <span className="opacity-70 font-medium">· {Number(score).toFixed(0)}</span>}
    </span>
  );
  if (auditoriaId) {
    return <Link to="/qa-ai/$id" params={{ id: auditoriaId }} className="hover:opacity-80">{content}</Link>;
  }
  return content;
}
