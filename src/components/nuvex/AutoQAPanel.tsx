import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, AlertTriangle, CheckCircle2, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { NUVEX } from "./constants";

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

// Paleta NUVIA semaforizada — dark glass over deep navy
const MAP: Record<string, { label: string; emoji: string; chipBg: string; chipFg: string; chipBorder: string; glow: string; accent: string }> = {
  excelente: { label: "QA CERTIFIED", emoji: "🟢", chipBg: "rgba(132,185,143,0.18)", chipFg: "#BEEFCB", chipBorder: "rgba(132,185,143,0.55)", glow: "rgba(132,185,143,0.45)", accent: "#84B98F" },
  aprobado:  { label: "QA OBSERVADO", emoji: "🟡", chipBg: "rgba(253,224,71,0.16)", chipFg: "#FDE68A", chipBorder: "rgba(253,224,71,0.45)", glow: "rgba(253,191,36,0.35)", accent: "#FACC15" },
  revisar:   { label: "QA REVISIÓN",  emoji: "🟠", chipBg: "rgba(251,146,60,0.18)", chipFg: "#FED7AA", chipBorder: "rgba(251,146,60,0.5)",  glow: "rgba(251,146,60,0.4)",  accent: "#FB923C" },
  rechazado: { label: "QA FAILED",    emoji: "🔴", chipBg: "rgba(248,113,113,0.18)", chipFg: "#FECACA", chipBorder: "rgba(248,113,113,0.55)", glow: "rgba(248,113,113,0.5)", accent: "#F87171" },
};

const sevDot = (s?: AutoQASeveridad) => {
  switch (s) {
    case "critica": return "#F87171";
    case "alta":    return "#FB923C";
    case "media":   return "#FACC15";
    case "baja":    return "#60A5FA";
    default:        return "#84B98F";
  }
};

export function AutoQAPanel({
  loading,
  result,
  simuladorReturn,
}: {
  loading?: boolean;
  result?: AutoQAResult | null;
  simuladorReturn?: { maestroId?: string; modo?: "pesos" | "uvr" };
}) {
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl border p-4 backdrop-blur-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.65), rgba(30,41,59,0.55))",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "0 18px 48px -28px rgba(68,93,163,0.6)",
        }}
      >
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${NUVEX.verde}, transparent)` }}
        />
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10"
            style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.85), rgba(132,185,143,0.85))" }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white">Ejecutando auditoría QA automática…</div>
            <div className="text-[11px] text-white/55">NUVIA Financial QA AI está validando el extracto.</div>
          </div>
        </div>
      </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border p-5 backdrop-blur-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(15,23,42,0.72), rgba(30,41,59,0.58))",
        borderColor: "rgba(255,255,255,0.10)",
        boxShadow: `0 24px 60px -32px ${cfg.glow}, 0 1px 0 rgba(255,255,255,0.04) inset`,
      }}
    >
      {/* hairline top accent */}
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}, transparent)` }}
      />
      {/* radial glow */}
      <span
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl"
        style={{ background: cfg.glow, opacity: 0.35 }}
      />

      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.06, rotate: -2 }}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15"
            style={{
              background: "linear-gradient(135deg, rgba(68,93,163,0.95), rgba(132,185,143,0.9))",
              boxShadow: `0 14px 30px -18px ${cfg.glow}`,
            }}
          >
            <ShieldCheck className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: NUVEX.verde }}>
              <Sparkles size={11} /> NUVIA Financial QA AI
            </div>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
                style={{ background: cfg.chipBg, color: cfg.chipFg, borderColor: cfg.chipBorder }}
              >
                <span>{cfg.emoji}</span>
                <span>{cfg.label}</span>
              </span>
              <div className="text-[12.5px] text-white/70">
                <span className="font-semibold text-white/85">Score:</span>{" "}
                <span className="font-extrabold tabular-nums" style={{ color: cfg.accent }}>
                  {Number(result.score).toFixed(0)}
                </span>
                <span className="text-white/40">/100</span>
                {result.hallazgosCount > 0 && (
                  <span className="ml-2 text-[11px] text-white/50">
                    · {result.hallazgosCount} hallazgo{result.hallazgosCount === 1 ? "" : "s"}
                    {result.criticos ? ` (${result.criticos} crítico${result.criticos === 1 ? "" : "s"})` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <Link
          to="/qa-ai/$id"
          params={{ id: result.auditoriaId }}
          search={
            simuladorReturn
              ? { from: "simulador" as const, maestroId: simuladorReturn.maestroId, modo: simuladorReturn.modo }
              : {}
          }
          className="group inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-[12px] font-semibold text-white backdrop-blur-xl transition-all hover:border-white/30"
          style={{
            background: "linear-gradient(135deg, rgba(68,93,163,0.9), rgba(132,185,143,0.9))",
            boxShadow: `0 14px 32px -16px ${cfg.glow}`,
          }}
        >
          Ver Dictamen Completo
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Score bar */}
      <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, Number(result.score)))}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${NUVEX.azul}, ${cfg.accent})`, boxShadow: `0 0 18px ${cfg.glow}` }}
        />
      </div>

      <ul className="relative mt-4 space-y-2">
        {showItems.map((h, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.35 }}
            className="flex items-start gap-2.5 text-[12.5px] text-white/80"
          >
            {todoOk ? (
              <CheckCircle2 className="mt-[2px] h-4 w-4 shrink-0" style={{ color: NUVEX.verde }} />
            ) : (
              <span
                className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                style={{ background: sevDot(h.severidad), boxShadow: `0 0 8px ${sevDot(h.severidad)}` }}
              />
            )}
            <span>{h.mensaje}</span>
          </motion.li>
        ))}
      </ul>

      {!todoOk && result.criticos ? (
        <div
          className="relative mt-4 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11.5px]"
          style={{
            background: "rgba(248,113,113,0.10)",
            borderColor: "rgba(248,113,113,0.4)",
            color: "#FECACA",
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Hay {result.criticos} hallazgo{result.criticos === 1 ? "" : "s"} crítico{result.criticos === 1 ? "" : "s"} — revísalos antes de continuar.
        </div>
      ) : null}
    </motion.div>
  );
}
