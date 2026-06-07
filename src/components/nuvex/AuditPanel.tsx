import { useMemo } from "react";
import {
  auditarSimulacion,
  type AuditoriaInput,
  type AuditoriaResultado,
  type Severidad,
} from "@/lib/auditEngine";
import { decidirPdf, etiquetaNivel, type NivelAutonomia } from "@/lib/autonomia";

const sevColor: Record<Severidad, string> = {
  critica: "bg-red-100 text-red-800 border-red-200",
  alta: "bg-orange-100 text-orange-800 border-orange-200",
  media: "bg-amber-100 text-amber-800 border-amber-200",
  info: "bg-slate-100 text-slate-700 border-slate-200",
};

function scoreColor(score: number): string {
  if (score >= 95) return "text-emerald-600";
  if (score >= 85) return "text-amber-600";
  return "text-red-600";
}

function nivelColor(n: NivelAutonomia): string {
  return n === 3
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : n === 2
      ? "bg-blue-50 text-blue-700 border-blue-200"
      : "bg-slate-50 text-slate-700 border-slate-200";
}

export function AuditBadge({
  resultado,
  nivel,
}: {
  resultado: AuditoriaResultado;
  nivel: NivelAutonomia;
}) {
  const decision = decidirPdf(nivel, resultado);
  const color =
    decision.accion === "permitir"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : decision.accion === "permitir_con_marca"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${color}`}
      title={decision.motivo}
    >
      <span className={scoreColor(resultado.score.total)}>{resultado.score.total}</span>
      <span>/100</span>
      <span className="opacity-60">·</span>
      <span>{decision.marca ?? (decision.accion === "permitir" ? "Apto" : "Bloqueado")}</span>
    </span>
  );
}

export interface AuditPanelProps {
  input: AuditoriaInput;
  nivelAutonomia: NivelAutonomia;
}

export function AuditPanel({ input, nivelAutonomia }: AuditPanelProps) {
  const resultado = useMemo(() => auditarSimulacion(input), [input]);
  const decision = decidirPdf(nivelAutonomia, resultado);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Auditoría financiera NUVEX
          </h3>
          <p className="text-xs text-slate-500">
            Motor de validación automática · 40 extracto / 30 matemática / 20 campos / 10 documental
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${nivelColor(nivelAutonomia)}`}>
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
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            decision.accion === "bloquear"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          <strong className="block">
            {decision.accion === "bloquear" ? "PDF bloqueado" : decision.marca}
          </strong>
          <span className="text-xs">{decision.motivo}</span>
        </div>
      )}

      {resultado.clasificacion.requiereRevision && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong className="block">REQUIERE REVISIÓN DIRECCIÓN FINANCIERA</strong>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {resultado.clasificacion.factores.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {resultado.inconsistencias.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Inconsistencias ({resultado.inconsistencias.length})
          </h4>
          <ul className="mt-2 space-y-1.5">
            {resultado.inconsistencias.slice(0, 8).map((i, idx) => (
              <li
                key={`${i.campo}-${idx}`}
                className={`rounded-lg border px-3 py-2 text-xs ${sevColor[i.severidad]}`}
              >
                <span className="font-semibold uppercase">{i.severidad}</span> · {i.mensaje}
              </li>
            ))}
          </ul>
          {resultado.inconsistencias.length > 8 && (
            <p className="mt-2 text-xs text-slate-500">
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
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        highlight ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className={`text-[10px] uppercase tracking-wide ${highlight ? "text-slate-300" : "text-slate-500"}`}>
        {label}
      </div>
      <div className={`mt-1 text-lg font-bold ${highlight ? "text-white" : scoreColor(value === max ? 100 : pct)}`}>
        {value}
        <span className={`ml-1 text-xs font-medium ${highlight ? "text-slate-300" : "text-slate-400"}`}>
          /{max}
        </span>
      </div>
    </div>
  );
}
