// Panel del modo "Draft" del simulador NUVIA.
//
// Escucha el evento `nuvia:draftRawReady` disparado por PesosSimulator y
// UVRSimulator cuando el analista sube y parsea un extracto en modo
// exploración. Cuando el snapshot está listo, permite:
//
//   1. Correr la AUDITORÍA MATEMÁTICA de NUVIA en memoria (sin persistir).
//   2. Ver hallazgos + veredicto.
//   3. Si la auditoría certifica → habilita "Certificar y crear caso".
//   4. Si hay hallazgos que el analista no puede resolver → "Escalar a
//      Dirección Financiera" (crea consulta técnica SIN caso).
//
// No toca en absoluto el generador del PDF de propuesta comercial ni el
// flujo formal de creación de expediente: sólo controla CUÁNDO se
// desbloquea la creación del caso.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  auditarSimulacionDraft,
  escalarConsultaTecnica,
  type DraftAuditResult,
  type DraftAuditHallazgo,
} from "@/lib/simuladorDraftQA.functions";

// ─────────────────────────────────────────────────────────────
// Snapshot que los simuladores emiten al parsear un extracto
// ─────────────────────────────────────────────────────────────

export type DraftRawSnapshot = {
  banco?: string | null;
  producto?: string | null;
  moneda?: string | null;
  tipoCredito?: string | null;
  datos?: Record<string, unknown> | null;
};

const NUVIA_DRAFT_EVENT = "nuvia:draftRawReady";

export function emitDraftRawReady(snapshot: DraftRawSnapshot) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(NUVIA_DRAFT_EVENT, { detail: snapshot }));
}

type PanelState =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "ready" }
  | { kind: "loading" }
  | { kind: "done"; result: DraftAuditResult }
  | { kind: "error"; message: string };

type Props = {
  mode: "pesos" | "uvr" | null;
  onCertificar: (payload: { snapshot: DraftRawSnapshot; result: DraftAuditResult }) => void;
  onSalir: () => void;
  onNuevaSimulacion?: () => void;
};

export function NuviaDraftAuditCard({ mode, onCertificar, onSalir, onNuevaSimulacion }: Props) {
  const [state, setState] = useState<PanelState>({ kind: mode ? "waiting" : "idle" });
  const [showHallazgos, setShowHallazgos] = useState(false);
  const [escalarOpen, setEscalarOpen] = useState(false);
  const snapshotRef = useRef<DraftRawSnapshot | null>(null);

  const runAudit = useServerFn(auditarSimulacionDraft);

  // 1. Cuando cambia el modo (pesos/uvr) o llega un raw nuevo, actualizamos estado.
  useEffect(() => {
    if (!mode) {
      setState({ kind: "idle" });
      snapshotRef.current = null;
    } else if (!snapshotRef.current) {
      setState({ kind: "waiting" });
    }
  }, [mode]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DraftRawSnapshot>).detail;
      if (!detail || !detail.datos) return;
      snapshotRef.current = detail;
      setState((prev) => {
        // Si estábamos esperando o ya había un resultado viejo, marcamos "listo".
        if (prev.kind === "done" || prev.kind === "error") return { kind: "ready" };
        return { kind: "ready" };
      });
    };
    window.addEventListener(NUVIA_DRAFT_EVENT, handler as EventListener);
    return () => window.removeEventListener(NUVIA_DRAFT_EVENT, handler as EventListener);
  }, []);

  // 2. Ejecutar auditoría dry-run
  const handleAuditar = async () => {
    const snap = snapshotRef.current;
    if (!snap || !snap.datos) {
      toast.error("Aún no hay datos del extracto para auditar.");
      return;
    }
    setState({ kind: "loading" });
    try {
      const result = await runAudit({
        data: {
          banco: snap.banco ?? null,
          producto: snap.producto ?? null,
          moneda: snap.moneda ?? null,
          datos: snap.datos as Record<string, unknown>,
        },
      });
      setState({ kind: "done", result });
      setShowHallazgos(result.totalHallazgos > 0);
      if (result.certificable) {
        toast.success(`Auditoría NUVIA aprobada · score ${result.score.toFixed(0)}/100`, {
          duration: 5000,
        });
      } else if (result.dictamen === "rechazado") {
        toast.error(`Auditoría rechazada · ${result.motivoBloqueo ?? "revisa inputs"}`, {
          duration: 6000,
        });
      } else {
        toast.warning(`Auditoría con hallazgos · ${result.motivoBloqueo ?? ""}`, {
          duration: 6000,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al auditar";
      setState({ kind: "error", message: msg });
      toast.error(`No se pudo ejecutar la auditoría: ${msg}`);
    }
  };

  const done = state.kind === "done" ? state.result : null;
  const canCertificar = !!done?.certificable;
  const canEscalar = !!done && done.totalHallazgos > 0 && !done.certificable;

  return (
    <>
      <div className="sticky top-0 z-[60] border-b border-white/10 bg-gradient-to-r from-[#0B1220] via-[#0E1A2E] to-[#0B1220] backdrop-blur">
        <div className="mx-auto flex max-w-[1360px] flex-col gap-3 px-5 py-3">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Modo exploración
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Herramientas · Simulador · Nada se guarda en el ERP
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/herramientas"
                onClick={onSalir}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.06]"
              >
                Salir
              </Link>
            </div>
          </div>

          {/* Audit row */}
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge state={state} />

            <div className="flex-1 min-w-[280px] text-[12.5px] leading-snug text-slate-300/90">
              {renderStatusMessage(state, !!mode)}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAuditar}
                disabled={state.kind === "loading" || state.kind === "idle" || state.kind === "waiting"}
                className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-sky-100 shadow-[0_10px_30px_-15px_rgba(56,189,248,0.55)] transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {state.kind === "loading" ? "Auditando…" : done ? "Reevaluar" : "Auditar con NUVIA"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!done || !snapshotRef.current) return;
                  onCertificar({ snapshot: snapshotRef.current, result: done });
                }}
                disabled={!canCertificar}
                title={
                  canCertificar
                    ? "Certificar la simulación y crear el expediente maestro"
                    : done
                      ? done.motivoBloqueo ?? "La auditoría no está aprobada"
                      : "Ejecuta la auditoría de NUVIA primero"
                }
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-emerald-100 shadow-[0_10px_30px_-15px_rgba(52,211,153,0.6)] transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Certificar y crear caso
              </button>

              <button
                type="button"
                onClick={() => setEscalarOpen(true)}
                disabled={!canEscalar}
                title={
                  canEscalar
                    ? "Enviar consulta al Director Financiero sin crear caso"
                    : "Sólo disponible cuando la auditoría reporta hallazgos"
                }
                className="rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Escalar a Dirección
              </button>
            </div>
          </div>

          {/* Hallazgos expandibles */}
          {done && done.totalHallazgos > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-slate-200">
              <button
                type="button"
                onClick={() => setShowHallazgos((v) => !v)}
                className="flex w-full items-center justify-between text-left text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300"
              >
                <span>
                  {done.totalHallazgos} hallazgo(s) · {done.criticos} crítico(s)
                </span>
                <span className="text-slate-500">{showHallazgos ? "Ocultar" : "Ver detalle"}</span>
              </button>
              {showHallazgos && (
                <ul className="mt-2 space-y-1.5">
                  {done.hallazgos.map((h, i) => (
                    <HallazgoRow key={i} h={h} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {escalarOpen && done && (
        <EscalarDialog
          snapshot={snapshotRef.current}
          hallazgos={done.hallazgos}
          onClose={() => setEscalarOpen(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function StatusBadge({ state }: { state: PanelState }) {
  const style = (() => {
    switch (state.kind) {
      case "idle":
      case "waiting":
        return { bg: "bg-slate-400/10", br: "border-slate-400/30", tx: "text-slate-300", label: "Esperando" };
      case "ready":
        return { bg: "bg-sky-400/10", br: "border-sky-400/30", tx: "text-sky-200", label: "Listo" };
      case "loading":
        return { bg: "bg-sky-400/15", br: "border-sky-400/40", tx: "text-sky-100", label: "Auditando" };
      case "done": {
        if (state.result.certificable)
          return { bg: "bg-emerald-400/15", br: "border-emerald-400/40", tx: "text-emerald-100", label: `NUVIA · APROBADA · ${state.result.score.toFixed(0)}/100` };
        if (state.result.dictamen === "rechazado")
          return { bg: "bg-rose-400/15", br: "border-rose-400/40", tx: "text-rose-100", label: `NUVIA · RECHAZADA · ${state.result.score.toFixed(0)}/100` };
        return { bg: "bg-amber-400/15", br: "border-amber-400/40", tx: "text-amber-100", label: `NUVIA · HALLAZGOS · ${state.result.score.toFixed(0)}/100` };
      }
      case "error":
        return { bg: "bg-rose-400/15", br: "border-rose-400/40", tx: "text-rose-100", label: "Error" };
    }
  })();
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${style.br} ${style.bg} px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${style.tx}`}
    >
      {style.label}
    </span>
  );
}

function renderStatusMessage(state: PanelState, hasMode: boolean) {
  if (!hasMode) return "Elige Pesos o UVR para comenzar la simulación.";
  switch (state.kind) {
    case "idle":
    case "waiting":
      return "Sube el extracto en el formulario. Cuando NUVIA lo lea, podrás auditar en un clic.";
    case "ready":
      return "Extracto listo. Ejecuta la auditoría de NUVIA para verificar la matemática financiera antes de crear el caso.";
    case "loading":
      return "NUVIA está reconciliando saldo, tasa, cuotas, seguros y coberturas. Un momento.";
    case "done":
      if (state.result.certificable)
        return "Auditoría matemática aprobada. Puedes certificar y crear el caso para generar la propuesta comercial.";
      return state.result.motivoBloqueo ?? "La auditoría reporta observaciones.";
    case "error":
      return `Error al auditar: ${state.message}`;
  }
}

function HallazgoRow({ h }: { h: DraftAuditHallazgo }) {
  const color =
    h.severidad === "critica"
      ? "text-rose-300"
      : h.severidad === "warning"
        ? "text-amber-300"
        : "text-slate-400";
  const dot =
    h.severidad === "critica"
      ? "bg-rose-400"
      : h.severidad === "warning"
        ? "bg-amber-400"
        : "bg-slate-500";
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className={`text-[12px] leading-snug ${color}`}>
        <span className="font-semibold uppercase tracking-[0.12em]">
          {h.severidad === "critica" ? "Crítico" : h.severidad === "warning" ? "Warning" : "Info"}
        </span>
        <span className="mx-1 opacity-40">·</span>
        <span className="text-slate-200">{h.mensaje}</span>
        {h.campo && <span className="ml-2 text-[10.5px] uppercase tracking-[0.14em] text-slate-500">({h.campo})</span>}
      </span>
    </li>
  );
}

function EscalarDialog({
  snapshot,
  hallazgos,
  onClose,
}: {
  snapshot: DraftRawSnapshot | null;
  hallazgos: DraftAuditHallazgo[];
  onClose: () => void;
}) {
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const escalar = useServerFn(escalarConsultaTecnica);

  const payload = useMemo(
    () => ({
      snapshot: (snapshot ?? {}) as Record<string, unknown>,
      banco: snapshot?.banco ?? null,
      producto: snapshot?.producto ?? null,
      tipoCredito: snapshot?.tipoCredito ?? null,
      moneda: snapshot?.moneda ?? null,
      hallazgos: hallazgos as unknown[],
    }),
    [snapshot, hallazgos],
  );

  const handleEnviar = async () => {
    setSaving(true);
    try {
      const r = await escalar({ data: { ...payload, notasParaAuditor: notas.trim() || undefined } });
      const codigo = (r as { codigo?: string | null }).codigo ?? null;
      toast.success("Simulación enviada a la Cola de Revisión NUVIA QA AI.", {
        description: codigo ? `Ref auditoría: ${codigo}` : `Ref: ${(r as { id: string }).id.slice(0, 8)}`,
        duration: 6500,
      });
      onClose();
    } catch (e) {
      toast.error(`No se pudo enviar la simulación: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0B1220] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">Escalar simulación al auditor</h3>
        <p className="mt-1 text-[13px] text-white/60">
          Se enviará la simulación completa (extracto + hallazgos NUVIA) a la{" "}
          <strong>Cola de Revisión NUVIA Financial QA AI</strong> con su código de auditoría propio.
          El Director Financiero la audita, corrige lo que corresponda y te la devuelve aprobada
          desde el panel de siempre. <strong>Esto no crea un caso en el ERP</strong>.
        </p>

        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-slate-300">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-500">Contexto</div>
          <div className="mt-1">
            {snapshot?.banco ?? "—"} · {snapshot?.producto ?? "—"} · {hallazgos.length} hallazgo(s)
          </div>
        </div>

        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Comentarios para el auditor (comunicación con el cliente, contexto extra)
          <textarea
            autoFocus
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={4}
            placeholder="Ej. El cliente confirma FRECH activo desde 2019 aunque el extracto no lo detalla · Reporta que la cuota bajó de $2.4M a $1.8M en 2023 · Está pagando dos seguros pero solo aparece uno en el extracto…"
            className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] font-normal normal-case tracking-normal text-white placeholder:text-white/30 focus:border-amber-400/40 focus:outline-none"
          />
          <span className="mt-1 block text-[10.5px] normal-case tracking-normal text-white/40">
            Todo lo que el cliente te haya dicho por WhatsApp o llamada ayuda al auditor a decidir más rápido.
          </span>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-semibold text-white/80 hover:bg-white/[0.06]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={saving}
            className="rounded-lg border border-amber-400/40 bg-amber-400/20 px-4 py-2 text-[12.5px] font-semibold text-amber-100 shadow-[0_10px_30px_-15px_rgba(251,191,36,0.6)] hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Enviando…" : "Enviar a NUVIA QA AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

