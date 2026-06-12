import { Link } from "@tanstack/react-router";
import { ArrowRight, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

export type AutoQASeveridad = "critica" | "alta" | "media" | "baja" | string;

export type AutoQAHallazgo = {
  mensaje: string;
  severidad?: AutoQASeveridad;
};

export type AutoQAResult = {
  auditoriaId: string;
  score: number;
  categoria: "excelente" | "aprobado" | "revisar" | "rechazado" | string;
  hallazgosCount: number;
  criticos?: number;
  hallazgosTop: AutoQAHallazgo[];
};

const MAP: Record<string, { label: string; emoji: string; bg: string; fg: string; border: string; accent: string }> = {
  excelente: { label: "QA CERTIFIED", emoji: "🟢", bg: "#DDF4E3", fg: "#1F7A45", border: "#A6E2B6", accent: "#1F7A45" },
  aprobado:  { label: "QA OBSERVADO", emoji: "🟡", bg: "#FEF3C7", fg: "#92400E", border: "#FDE68A", accent: "#92400E" },
  revisar:   { label: "QA REVISIÓN",  emoji: "🟠", bg: "#FFEDD5", fg: "#9A3412", border: "#FED7AA", accent: "#9A3412" },
  rechazado: { label: "QA FAILED",    emoji: "🔴", bg: "#FEE2E2", fg: "#991B1B", border: "#FCA5A5", accent: "#991B1B" },
};

const sevDot = (s?: AutoQASeveridad) => {
  switch (s) {
    case "critica": return "#DC2626";
    case "alta":    return "#EA580C";
    case "media":   return "#D97706";
    case "baja":    return "#2563EB";
    default:        return "#16A34A";
  }
};

export function AutoQAPanel({ loading, result }: { loading?: boolean; result?: AutoQAResult | null }) {
  if (loading) {
    return (
      <div
        className="rounded-2xl border bg-white p-4 shadow-sm flex items-center gap-3"
        style={{ borderColor: "#E2E8F0" }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-[#445DA3]" />
        <div>
          <div className="text-[13px] font-semibold text-slate-800">Ejecutando auditoría QA automática…</div>
          <div className="text-[11px] text-slate-500">NUVIA Financial QA AI está validando el extracto.</div>
        </div>
      </div>
    );
  }
  if (!result) return null;
  const cfg = MAP[result.categoria] ?? MAP.aprobado;
  const todoOk = (result.hallazgosCount ?? 0) === 0;
  const showItems: AutoQAHallazgo[] = todoOk
    ? [
        { mensaje: "Cuota consistente", severidad: "ok" },
        { mensaje: "Tasa consistente", severidad: "ok" },
        { mensaje: "Seguros identificados", severidad: "ok" },
      ]
    : result.hallazgosTop.slice(0, 3);

  return (
    <div
      className="rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: cfg.border, boxShadow: `0 6px 24px -16px ${cfg.accent}` }}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold"
            style={{ background: cfg.bg, color: cfg.fg, borderColor: cfg.border }}
          >
            <span>{cfg.emoji}</span>
            <span>{cfg.label}</span>
          </span>
          <div className="text-[13px] text-slate-600">
            <span className="font-semibold text-slate-800">Score:</span>{" "}
            <span className="font-bold" style={{ color: cfg.accent }}>{Number(result.score).toFixed(0)}/100</span>
            {result.hallazgosCount > 0 && (
              <span className="ml-2 text-[11px] text-slate-500">
                · {result.hallazgosCount} hallazgo{result.hallazgosCount === 1 ? "" : "s"}
                {result.criticos ? ` (${result.criticos} crítico${result.criticos === 1 ? "" : "s"})` : ""}
              </span>
            )}
          </div>
        </div>
        <Link
          to="/qa-ai/$id"
          params={{ id: result.auditoriaId }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
          style={{ background: cfg.accent }}
        >
          Ver Dictamen Completo <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-3 space-y-1.5">
        {showItems.map((h, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] text-slate-700">
            {todoOk ? (
              <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0" style={{ color: "#1F7A45" }} />
            ) : (
              <span
                className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: sevDot(h.severidad) }}
              />
            )}
            <span>{h.mensaje}</span>
          </li>
        ))}
      </ul>

      {!todoOk && result.criticos ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11.5px]"
          style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: "#991B1B" }}>
          <AlertTriangle className="h-3.5 w-3.5" />
          Hay {result.criticos} hallazgo{result.criticos === 1 ? "" : "s"} crítico{result.criticos === 1 ? "" : "s"} — revísalos antes de continuar.
        </div>
      ) : null}
    </div>
  );
}
