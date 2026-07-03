import { useEffect, useMemo, useRef } from "react";
import {
  auditarSimulacion,
  type AuditoriaInput,
  type AuditoriaResultado,
  type Severidad,
} from "@/lib/auditEngine";
import { decidirPdf, etiquetaNivel, type NivelAutonomia } from "@/lib/autonomia";
import { persistirAuditoriaSimulacion } from "@/lib/persistirAuditoria";

// ─────────────────────────────────────────────────────────────
// NUVIA dark palette · superficie navy + acentos semánticos.
// Nada de fondos blancos. Todo respeta tokens NUVIA.
// ─────────────────────────────────────────────────────────────

const sevStyle: Record<Severidad, { bg: string; br: string; tx: string }> = {
  critica: {
    bg: "rgba(255,107,107,0.14)",
    br: "rgba(255,107,107,0.36)",
    tx: "#FFB4B4",
  },
  alta: {
    bg: "rgba(246,196,83,0.14)",
    br: "rgba(246,196,83,0.36)",
    tx: "#F6C453",
  },
  media: {
    bg: "rgba(246,196,83,0.10)",
    br: "rgba(246,196,83,0.28)",
    tx: "#F5C77A",
  },
  info: {
    bg: "rgba(255,255,255,0.04)",
    br: "var(--nuvia-border)",
    tx: "var(--nuvia-text-secondary)",
  },
};

function scoreColor(score: number): string {
  if (score >= 95) return "var(--nuvia-success)";
  if (score >= 85) return "var(--nuvia-warning)";
  return "var(--nuvia-danger)";
}

function nivelStyle(n: NivelAutonomia): { bg: string; br: string; tx: string } {
  if (n === 3) return { bg: "rgba(132,185,143,0.14)", br: "rgba(132,185,143,0.36)", tx: "var(--nuvia-success)" };
  if (n === 2) return { bg: "rgba(68,93,163,0.18)", br: "rgba(68,93,163,0.36)", tx: "var(--nuvia-accent-blue)" };
  return { bg: "rgba(255,255,255,0.04)", br: "var(--nuvia-border)", tx: "var(--nuvia-text-secondary)" };
}

export function AuditBadge({
  resultado,
  nivel,
}: {
  resultado: AuditoriaResultado;
  nivel: NivelAutonomia;
}) {
  const decision = decidirPdf(nivel, resultado);
  const style =
    decision.accion === "permitir"
      ? { bg: "rgba(132,185,143,0.14)", br: "rgba(132,185,143,0.36)", tx: "var(--nuvia-success)" }
      : decision.accion === "permitir_con_marca"
        ? { bg: "rgba(246,196,83,0.14)", br: "rgba(246,196,83,0.36)", tx: "var(--nuvia-warning)" }
        : { bg: "rgba(255,107,107,0.14)", br: "rgba(255,107,107,0.36)", tx: "#FFB4B4" };
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
      style={{ background: style.bg, borderColor: style.br, color: style.tx }}
      title={decision.motivo}
    >
      <span style={{ color: scoreColor(resultado.score.total) }}>{resultado.score.total}</span>
      <span style={{ opacity: 0.7 }}>/100</span>
      <span style={{ opacity: 0.45 }}>·</span>
      <span>{decision.marca ?? (decision.accion === "permitir" ? "Apto" : "Bloqueado")}</span>
    </span>
  );
}

export interface AuditPanelProps {
  input: AuditoriaInput;
  nivelAutonomia: NivelAutonomia;
  expedienteId?: string;
}

export function AuditPanel({ input, nivelAutonomia, expedienteId }: AuditPanelProps) {
  const resultado = useMemo(() => auditarSimulacion(input), [input]);
  const decision = decidirPdf(nivelAutonomia, resultado);

  // Persistencia debounced del snapshot de auditoría por expediente.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!expedienteId) return;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void persistirAuditoriaSimulacion(expedienteId, input, resultado).catch(() => {
        /* no-op: best-effort */
      });
    }, 1500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [expedienteId, input, resultado]);

  const nivel = nivelStyle(nivelAutonomia);

  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background:
          "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid var(--nuvia-border)",
        boxShadow: "0 24px 60px -30px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
        color: "var(--nuvia-text-primary)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            Auditoría financiera NUVEX
          </h3>
          <p className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
            Motor de validación automática · 40 extracto / 30 matemática / 20 campos / 10 documental
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{ background: nivel.bg, borderColor: nivel.br, color: nivel.tx }}
          >
            Nivel {nivelAutonomia} · {etiquetaNivel(nivelAutonomia)}
          </span>
          <AuditBadge resultado={resultado} nivel={nivelAutonomia} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <ScoreCell label="Score total" value={resultado.score.total} max={100} highlight />
        <ScoreCell label="Extracto vs analista" value={resultado.score.extracto} max={40} />
        <ScoreCell label="Matemática" value={resultado.score.matematica} max={30} />
        <ScoreCell label="Campos" value={resultado.score.campos} max={20} />
        <ScoreCell label="Documental" value={resultado.score.documental} max={10} />
      </div>

      {decision.accion !== "permitir" && (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm"
          style={
            decision.accion === "bloquear"
              ? {
                  background: "rgba(255,107,107,0.12)",
                  borderColor: "rgba(255,107,107,0.32)",
                  color: "#FFB4B4",
                }
              : {
                  background: "rgba(246,196,83,0.12)",
                  borderColor: "rgba(246,196,83,0.32)",
                  color: "#F6C453",
                }
          }
        >
          <strong className="block">
            {decision.accion === "bloquear" ? "PDF bloqueado" : decision.marca}
          </strong>
          <span className="text-xs" style={{ opacity: 0.85 }}>
            {decision.motivo}
          </span>
        </div>
      )}

      {resultado.clasificacion.requiereRevision && (
        <div
          className="mt-3 rounded-xl border px-4 py-3 text-sm"
          style={{
            background: "rgba(255,107,107,0.12)",
            borderColor: "rgba(255,107,107,0.32)",
            color: "#FFB4B4",
          }}
        >
          <strong className="block">REQUIERE REVISIÓN DIRECCIÓN FINANCIERA</strong>
          <ul className="mt-1 list-disc pl-5 text-xs" style={{ opacity: 0.9 }}>
            {resultado.clasificacion.factores.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {resultado.inconsistencias.length > 0 && (
        <div className="mt-4">
          <h4
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            Inconsistencias ({resultado.inconsistencias.length})
          </h4>
          <ul className="mt-2 space-y-1.5">
            {resultado.inconsistencias.slice(0, 8).map((i, idx) => {
              const s = sevStyle[i.severidad];
              return (
                <li
                  key={`${i.campo}-${idx}`}
                  className="rounded-lg border px-3 py-2 text-xs"
                  style={{ background: s.bg, borderColor: s.br, color: s.tx }}
                >
                  <span className="font-semibold uppercase">{i.severidad}</span>{" "}
                  <span style={{ color: "var(--nuvia-text-primary)" }}>· {i.mensaje}</span>
                </li>
              );
            })}
          </ul>
          {resultado.inconsistencias.length > 8 && (
            <p className="mt-2 text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
              +{resultado.inconsistencias.length - 8} adicionales
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreCell({
  label,
  value,
  max,
  highlight,
}: {
  label: string;
  value: number;
  max: number;
  highlight?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const valColor = value === max ? "var(--nuvia-success)" : scoreColor(pct);
  return (
    <div
      className="rounded-xl border px-3 py-2"
      style={
        highlight
          ? {
              background:
                "linear-gradient(150deg, rgba(68,93,163,0.28), rgba(68,93,163,0.10))",
              borderColor: "rgba(68,93,163,0.45)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }
          : {
              background: "rgba(255,255,255,0.03)",
              borderColor: "var(--nuvia-border)",
            }
      }
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: highlight ? "rgba(255,255,255,0.72)" : "var(--nuvia-text-secondary)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-lg font-bold tabular-nums"
        style={{ color: highlight ? "var(--nuvia-text-primary)" : valColor }}
      >
        {value}
        <span
          className="ml-1 text-xs font-medium"
          style={{ color: highlight ? "rgba(255,255,255,0.55)" : "var(--nuvia-text-secondary)" }}
        >
          /{max}
        </span>
      </div>
    </div>
  );
}
