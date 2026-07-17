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
import { Paperclip, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  auditarSimulacionDraft,
  escalarConsultaTecnica,
  estadoAprobacionAuditoria,
  type DraftAuditResult,
  type DraftAuditHallazgo,
} from "@/lib/simuladorDraftQA.functions";
import { hashQaSnapshot } from "@/lib/nuviaQaSnapshot";


// ─────────────────────────────────────────────────────────────
// Snapshot que los simuladores emiten al parsear un extracto
// ─────────────────────────────────────────────────────────────

export type DraftRawSnapshot = {
  banco?: string | null;
  producto?: string | null;
  moneda?: string | null;
  tipoCredito?: string | null;
  datos?: Record<string, unknown> | null;
  archivoPath?: string | null;
  archivoNombre?: string | null;
  // Honorarios/propuesta ya aprobados por el analista en el simulador.
  // Viajan snapshot → handleSaveAsCase → certificarExpedienteServer → INSERT
  // expedientes, para que honorarios_base/_final/descuento/propuesta_data no
  // nazcan en 0 en el flujo de certificación draft.
  honorariosBase?: number | null;
  honorariosFinal?: number | null;
  descuento?: number | null;
  propuesta?: Record<string, unknown> | null;
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
  | { kind: "invalidated" }
  | { kind: "error"; message: string };

// Pura, testeable: dado el estado anterior y los hashes, decide la transición
// que provoca la llegada de un snapshot.
export type SnapshotTransition =
  | { kind: "ignore" }
  | { kind: "hydrate" }
  | { kind: "invalidate" }
  | { kind: "ready" };

export function evaluateSnapshotTransition(args: {
  prevKind: PanelState["kind"];
  doneHash: string | null;
  lastEmittedHash: string | null;
  newHash: string;
  wasFirst: boolean;
}): SnapshotTransition {
  const { prevKind, doneHash, lastEmittedHash, newHash, wasFirst } = args;
  if (!newHash) return { kind: "ignore" };
  if (lastEmittedHash === newHash) return { kind: "ignore" };
  if (wasFirst) return { kind: "hydrate" };
  if (prevKind === "done") {
    if (doneHash && doneHash === newHash) return { kind: "ignore" };
    return { kind: "invalidate" };
  }
  if (prevKind === "invalidated") return { kind: "ready" };
  return { kind: "ready" };
}

type Props = {
  mode: "pesos" | "uvr" | null;
  onCertificar: (payload: { snapshot: DraftRawSnapshot; result: DraftAuditResult }) => void;
  onSalir: () => void;
  onNuevaSimulacion?: () => void;
  /**
   * Cuando el analista aterriza en /herramientas/simulador?auditoriaId=<id>
   * tras una aprobación del Director QA (normal u override), este prop
   * dispara el lookup a `estadoAprobacionAuditoria` para saltar la ejecución
   * local del motor y habilitar directamente "Certificar y crear caso".
   */
  auditoriaId?: string;
};

type DirectorApproval = {
  aprobadoAt: string;
  override: boolean;
  overrideJustificacion: string | null;
  score: number;
  codigo: string | null;
};

export function NuviaDraftAuditCard({ mode, onCertificar, onSalir, onNuevaSimulacion, auditoriaId }: Props) {
  const [state, setState] = useState<PanelState>({ kind: mode ? "waiting" : "idle" });
  const [showHallazgos, setShowHallazgos] = useState(false);
  const [escalarOpen, setEscalarOpen] = useState(false);
  const [directorApproval, setDirectorApproval] = useState<DirectorApproval | null>(null);
  const snapshotRef = useRef<DraftRawSnapshot | null>(null);
  // Hash del snapshot con el que se resolvió `done` (aprobación local o server).
  const doneHashRef = useRef<string | null>(null);
  // Último hash emitido para deduplicar re-emisiones idénticas.
  const lastEmittedHashRef = useRef<string | null>(null);
  const firstSnapshotReceivedRef = useRef<boolean>(false);
  const stateRef = useRef<PanelState>({ kind: mode ? "waiting" : "idle" });
  useEffect(() => { stateRef.current = state; }, [state]);




  const runAudit = useServerFn(auditarSimulacionDraft);
  const fetchAprobacion = useServerFn(estadoAprobacionAuditoria);

  // Lookup de aprobación del Director QA cuando se llega vía ?auditoriaId=.
  useEffect(() => {
    if (!auditoriaId) {
      setDirectorApproval(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const res = await fetchAprobacion({ data: { id: auditoriaId } });
        if (cancel) return;
        if (res.aprobada && res.aprobadoAt) {
          setDirectorApproval({
            aprobadoAt: res.aprobadoAt,
            override: !!res.override,
            overrideJustificacion: res.overrideJustificacion ?? null,
            score: res.score ?? 0,
            codigo: res.codigo ?? null,
          });
        }
      } catch {
        /* silencioso: si falla, el analista sigue viendo el flujo normal */
      }
    })();
    return () => { cancel = true; };
  }, [auditoriaId, fetchAprobacion]);


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
    // Utiliza el hash CANÓNICO compartido con los simuladores para que
    // ambos lados decidan igual qué es "el mismo snapshot" y qué es una
    // edición real del analista.
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DraftRawSnapshot>).detail;
      if (!detail || !detail.datos) return;
      const newHash = hashQaSnapshot(detail);
      const wasFirst = !firstSnapshotReceivedRef.current;
      const decision = evaluateSnapshotTransition({
        prevKind: stateRef.current.kind,
        doneHash: doneHashRef.current,
        lastEmittedHash: lastEmittedHashRef.current,
        newHash,
        wasFirst,
      });
      firstSnapshotReceivedRef.current = true;
      snapshotRef.current = detail;
      if (decision.kind === "ignore") return;
      lastEmittedHashRef.current = newHash;
      if (decision.kind === "hydrate") {
        // Primer snapshot tras montar: hidratación. No invalidar aprobaciones.
        setState((s) => (s.kind === "done" ? s : { kind: "ready" }));
        return;
      }
      if (decision.kind === "invalidate") {
        // El analista editó datos después de un dictamen exitoso: invalida
        // aprobación local y muestra banner de re-auditoría obligatoria.
        setDirectorApproval(null);
        doneHashRef.current = null;
        setState({ kind: "invalidated" });
        return;
      }
      // ready
      setState({ kind: "ready" });
    };
    window.addEventListener(NUVIA_DRAFT_EVENT, handler as EventListener);
    return () => window.removeEventListener(NUVIA_DRAFT_EVENT, handler as EventListener);
  }, []);


  // Re-consulta la aprobación cuando la pestaña vuelve al foco o el
  // documento se hace visible: si Realtime falla o no llega, la fuente
  // de verdad (backend) se vuelve a leer y el botón queda habilitado.
  useEffect(() => {
    if (!auditoriaId) return;
    const refetch = async () => {
      try {
        const res = await fetchAprobacion({ data: { id: auditoriaId } });
        if (res.aprobada && res.aprobadoAt) {
          setDirectorApproval({
            aprobadoAt: res.aprobadoAt,
            override: !!res.override,
            overrideJustificacion: res.overrideJustificacion ?? null,
            score: res.score ?? 0,
            codigo: res.codigo ?? null,
          });
        }
      } catch { /* silencioso */ }
    };
    const onFocus = () => { void refetch(); };
    const onVisible = () => { if (document.visibilityState === "visible") void refetch(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auditoriaId, fetchAprobacion]);

  // Cuando existe aprobación formal del Director QA y hay snapshot listo,
  // promovemos el panel a "done" sintético con certificable=true para saltar
  // la ejecución local del motor. Cualquier cambio real de inputs vuelve el
  // estado a "ready" (handler de arriba), lo cual invalida esta promoción —
  // deseable: si el analista editó los inputs, no debe poder certificar con
  // la aprobación previa.
  useEffect(() => {
    if (!directorApproval) return;
    if (state.kind !== "ready") return;
    const synthetic: DraftAuditResult = {
      score: directorApproval.score || 100,
      categoria: "aprobado",
      dictamen: "aprobado",
      criticos: 0,
      totalHallazgos: 0,
      hallazgos: [],
      certificable: true,
      hashCalculo: "",
    };
    setState({ kind: "done", result: synthetic });
  }, [directorApproval, state.kind]);


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
            {directorApproval && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200"
                title={
                  directorApproval.override
                    ? `Override manual del Director QA. Justificación: ${directorApproval.overrideJustificacion ?? "—"}`
                    : "Aprobada por Director QA"
                }
              >
                {directorApproval.override ? "Aprobado por Director QA (override)" : "Aprobado por Director QA"}
                {directorApproval.codigo ? ` · ${directorApproval.codigo}` : ""}
              </span>
            )}
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
              Herramientas · Simulador · Nada se guarda en el ERP
            </span>

            <div className="ml-auto flex items-center gap-2">
              {onNuevaSimulacion && (
                <button
                  type="button"
                  onClick={onNuevaSimulacion}
                  title="Descarta la simulación actual y empieza limpio (borra nombre, cédula y datos del crédito de esta pantalla)."
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.06]"
                >
                  Nueva simulación
                </button>
              )}
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

          {/* Alerta de conciliación por abono extraordinario */}
          {done?.conciliacion?.detectada === true && (
            <div
              className={`rounded-xl border px-3 py-2 text-[12px] leading-snug ${
                done.conciliacion.requiereAuditoria
                  ? "border-rose-400/40 bg-rose-400/10 text-rose-100"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-100"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-current/40 bg-black/20 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em]">
                  {done.conciliacion.requiereAuditoria
                    ? "Auditoría obligatoria"
                    : "Posible abono extraordinario no normalizado"}
                </span>
                {done.conciliacion.nivel && (
                  <span className="text-[10.5px] uppercase tracking-[0.14em] opacity-70">
                    Nivel: {done.conciliacion.nivel.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[12px]">
                {done.conciliacion.requiereAuditoria
                  ? "NUVIA detectó hallazgos críticos que no se explican por un abono extraordinario. La certificación queda bloqueada hasta que Dirección QA audite el caso."
                  : "NUVIA detectó una posible reducción de saldo o cuota por un movimiento no normalizado (por ejemplo un abono extraordinario). Valida el impacto antes de enviar la propuesta comercial."}
              </p>
              {done.conciliacion.recomendacionAnalista && (
                <p className="mt-1 text-[11.5px] opacity-80">
                  {done.conciliacion.recomendacionAnalista}
                </p>
              )}
            </div>
          )}

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
        const conc = state.result.conciliacion;
        const scoreTxt = state.result.score.toFixed(0);
        if (conc?.requiereAuditoria === true)
          return { bg: "bg-rose-400/15", br: "border-rose-400/40", tx: "text-rose-100", label: `NUVIA · AUDITORÍA OBLIGATORIA · ${scoreTxt}/100` };
        if (state.result.certificable && conc?.detectada === true)
          return { bg: "bg-amber-400/15", br: "border-amber-400/40", tx: "text-amber-100", label: `NUVIA · APROBADA CON ALERTA · ${scoreTxt}/100` };
        if (state.result.certificable)
          return { bg: "bg-emerald-400/15", br: "border-emerald-400/40", tx: "text-emerald-100", label: `NUVIA · APROBADA · ${scoreTxt}/100` };
        if (state.result.dictamen === "rechazado")
          return { bg: "bg-rose-400/15", br: "border-rose-400/40", tx: "text-rose-100", label: `NUVIA · RECHAZADA · ${scoreTxt}/100` };
        return { bg: "bg-amber-400/15", br: "border-amber-400/40", tx: "text-amber-100", label: `NUVIA · HALLAZGOS · ${scoreTxt}/100` };
      }
      case "invalidated":
        return { bg: "bg-amber-400/15", br: "border-amber-400/40", tx: "text-amber-100", label: "NUVIA · Requiere re-auditoría" };
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
    case "invalidated":
      return "La simulación fue modificada. Debe ejecutar nuevamente la Auditoría NUVIA.";
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
  type Adjunto = { path: string; nombre: string };
  const initialAdjuntos: Adjunto[] = snapshot?.archivoPath
    ? [{ path: snapshot.archivoPath, nombre: snapshot.archivoNombre ?? "extracto" }]
    : [];
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>(initialAdjuntos);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const escalar = useServerFn(escalarConsultaTecnica);

  const MAX_FILES = 20;
  const yaTieneExtracto = adjuntos.length > 0;
  const cuposDisponibles = MAX_FILES - adjuntos.length;

  const uploadOne = async (f: File, uid: string): Promise<Adjunto> => {
    if (f.size > 20 * 1024 * 1024) throw new Error(`"${f.name}" supera 20 MB`);
    const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: upErr } = await supabase.storage
      .from("extractos")
      .upload(path, f, { cacheControl: "3600", upsert: false, contentType: f.type || "application/octet-stream" });
    if (upErr) throw new Error(`${f.name}: ${upErr.message}`);
    return { path, nombre: f.name };
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    if (adjuntos.length + files.length > MAX_FILES) {
      toast.error(`Máximo ${MAX_FILES} archivos. Puedes subir ${cuposDisponibles} más.`);
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      if (!uid) throw new Error("Sesión no disponible");
      const nuevos: Adjunto[] = [];
      for (const f of files) {
        try {
          nuevos.push(await uploadOne(f, uid));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Error subiendo archivo");
        }
      }
      if (nuevos.length > 0) {
        setAdjuntos((prev) => [...prev, ...nuevos]);
        toast.success(`${nuevos.length} archivo(s) adjuntado(s).`);
      }
    } catch (e) {
      toast.error(`No se pudo subir: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setUploading(false);
    }
  };

  const removeAdjunto = (idx: number) => {
    setAdjuntos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleEnviar = async () => {
    if (!yaTieneExtracto) {
      toast.error("Adjunta al menos un extracto antes de enviar a auditoría.");
      return;
    }
    setSaving(true);
    try {
      const [primary, ...extras] = adjuntos;
      const r = await escalar({
        data: {
          snapshot: (snapshot ?? {}) as Record<string, unknown>,
          banco: snapshot?.banco ?? null,
          producto: snapshot?.producto ?? null,
          tipoCredito: snapshot?.tipoCredito ?? null,
          moneda: snapshot?.moneda ?? null,
          hallazgos: hallazgos as unknown[],
          archivoPath: primary.path,
          archivoNombre: primary.nombre,
          adjuntosExtra: extras,
          notasParaAuditor: notas.trim() || undefined,
        },
      });
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

        {/* Adjuntar extracto original — obligatorio para simulaciones manuales */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploading && !saving) setDragOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!uploading && !saving) setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            if (uploading || saving) return;
            const files = e.dataTransfer.files;
            if (files && files.length > 0) void handleFiles(files);
          }}
          className={`mt-4 rounded-lg border px-3 py-3 transition-colors ${
            dragOver
              ? "border-sky-400/60 bg-sky-400/[0.1] ring-2 ring-sky-400/40"
              : yaTieneExtracto
                ? "border-emerald-400/30 bg-emerald-400/[0.06]"
                : "border-amber-400/40 bg-amber-400/[0.06]"
          }`}
        >
          <div className="flex items-start gap-2">
            {yaTieneExtracto ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-300" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-300" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-white">
                {dragOver
                  ? "Suelta los archivos aquí"
                  : yaTieneExtracto
                    ? `${adjuntos.length} archivo(s) adjunto(s)`
                    : "Adjunta el extracto original"}
              </div>
              <div className="mt-0.5 text-[11.5px] text-white/60">
                {yaTieneExtracto
                  ? `Viajarán junto con la simulación. Puedes agregar hasta ${MAX_FILES} archivos (${cuposDisponibles} disponibles).`
                  : `Arrastra los archivos aquí o haz clic en el botón. Se aceptan hasta ${MAX_FILES} archivos, cualquier formato (PDF, imagen, Excel, Word, ZIP, etc.).`}
              </div>
              {adjuntos.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {adjuntos.map((a, idx) => (
                    <div
                      key={a.path}
                      className="inline-flex items-center gap-1.5 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-white/80"
                    >
                      <Paperclip size={12} />
                      <span className="max-w-[180px] truncate">{a.nombre}</span>
                      <button
                        type="button"
                        onClick={() => removeAdjunto(idx)}
                        disabled={saving || uploading}
                        className="ml-1 text-white/40 hover:text-red-300 disabled:opacity-40"
                        aria-label="Quitar archivo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) void handleFiles(files);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || saving || cuposDisponibles <= 0}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-white/[0.1] disabled:opacity-50"
                >
                  <Upload size={12} />
                  {uploading
                    ? "Subiendo…"
                    : cuposDisponibles <= 0
                      ? "Límite alcanzado"
                      : yaTieneExtracto
                        ? "Agregar más archivos"
                        : "Subir extracto (cualquier formato)"}
                </button>
                <span className="text-[10.5px] text-white/40">
                  Máx. {MAX_FILES} archivos · 20 MB c/u · Drag &amp; drop habilitado
                </span>
              </div>
            </div>
          </div>
        </div>



        <label className="mt-4 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
          Comentarios para el auditor (comunicación con el cliente, contexto extra)
          <textarea
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
            disabled={saving || uploading || !yaTieneExtracto}
            title={!yaTieneExtracto ? "Adjunta el extracto original para continuar" : undefined}
            className="rounded-lg border border-amber-400/40 bg-amber-400/20 px-4 py-2 text-[12.5px] font-semibold text-amber-100 shadow-[0_10px_30px_-15px_rgba(251,191,36,0.6)] hover:bg-amber-400/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Enviando…" : "Enviar a NUVIA QA AI"}
          </button>
        </div>
      </div>
    </div>
  );
}

