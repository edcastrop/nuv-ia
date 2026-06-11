import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, X, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import {
  ETAPA_FEEDBACK_EVENT,
  type EtapaFeedbackEventDetail,
  getEtapaSiguiente,
  getResponsablesLegibles,
  ACCIONES_POR_ETAPA,
} from "@/lib/etapaFeedback";
import { getEtapaById, type EtapaPipelineId } from "@/lib/pipelineEtapas";

type State =
  | { open: false }
  | {
      open: true;
      kind: "success";
      etapaAnteriorId: EtapaPipelineId;
      etapaNuevaId: EtapaPipelineId;
    }
  | {
      open: true;
      kind: "error";
      etapaActualId: EtapaPipelineId;
      etapaDestinoId?: EtapaPipelineId;
      razon: string;
      faltantes: string[];
    };

function fireCierreConfetti() {
  if (typeof window === "undefined") return;
  const duration = 1800;
  const end = Date.now() + duration;
  const colors = ["#445DA3", "#84B98F", "#A7F3C4", "#FFD15C", "#FFFFFF"];
  // Ráfaga inicial central
  confetti({
    particleCount: 120,
    spread: 80,
    startVelocity: 45,
    origin: { x: 0.5, y: 0.35 },
    colors,
    zIndex: 200,
  });
  // Ráfagas laterales sostenidas
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      zIndex: 200,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      zIndex: 200,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export function EtapaTransicionDialog() {
  const [state, setState] = useState<State>({ open: false });

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<EtapaFeedbackEventDetail>;
      const d = e.detail;
      if (!d) return;
      if (d.kind === "success") {
        setState({
          open: true,
          kind: "success",
          etapaAnteriorId: d.etapaAnteriorId,
          etapaNuevaId: d.etapaNuevaId,
        });
        if (d.etapaNuevaId === "finalizado") fireCierreConfetti();
      } else {
        setState({
          open: true,
          kind: "error",
          etapaActualId: d.etapaActualId,
          etapaDestinoId: d.etapaDestinoId,
          razon: d.razon,
          faltantes: d.faltantes ?? [],
        });
      }
    };
    window.addEventListener(ETAPA_FEEDBACK_EVENT, handler);
    return () => window.removeEventListener(ETAPA_FEEDBACK_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState({ open: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state.open]);

  if (!state.open) return null;
  const close = () => setState({ open: false });

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 backdrop-blur-sm animate-in fade-in"
        style={{ background: "rgba(5,8,22,0.72)" }}
        onClick={close}
      />
      <div
        className="glass-modal relative w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ color: "var(--nuvia-text-primary)" }}
      >
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition"
          style={{ color: "var(--nuvia-text-muted)", background: "rgba(255,255,255,0.04)" }}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
        {state.kind === "success" ? (
          <SuccessBody
            etapaAnteriorId={state.etapaAnteriorId}
            etapaNuevaId={state.etapaNuevaId}
            onClose={close}
          />
        ) : (
          <ErrorBody
            etapaActualId={state.etapaActualId}
            etapaDestinoId={state.etapaDestinoId}
            razon={state.razon}
            faltantes={state.faltantes}
            onClose={close}
          />
        )}
      </div>
    </div>
  );
}

function SuccessBody({
  etapaAnteriorId,
  etapaNuevaId,
  onClose,
}: {
  etapaAnteriorId: EtapaPipelineId;
  etapaNuevaId: EtapaPipelineId;
  onClose: () => void;
}) {
  const anterior = getEtapaById(etapaAnteriorId);
  const actual = getEtapaById(etapaNuevaId);
  const siguiente = getEtapaSiguiente(etapaNuevaId);
  const responsableSiguiente = siguiente ? getResponsablesLegibles(siguiente.id) : null;
  const acciones = ACCIONES_POR_ETAPA[etapaNuevaId] ?? [];
  const esCierreFinal = etapaNuevaId === "finalizado";

  return (
    <div>
      <div
        className="relative px-7 pt-8 pb-6"
        style={{
          background:
            "linear-gradient(135deg, var(--nuvia-bg-secondary) 0%, rgba(132,185,143,0.18) 55%, var(--nuvia-bg-tertiary) 100%)",
          borderBottom: "1px solid var(--nuvia-border)",
          color: "var(--nuvia-text-primary)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "rgba(132,185,143,0.25)" }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(132,185,143,0.18)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-accent-green)",
            }}
          >
            {esCierreFinal ? <Sparkles size={22} /> : <CheckCircle2 size={26} />}
          </div>
          <div className="min-w-0">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {esCierreFinal ? "Caso cerrado con éxito" : "Etapa completada con éxito"}
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-tight">
              {esCierreFinal
                ? `¡Felicitaciones, cerraste el caso!`
                : `¡Acabas de finalizar ${anterior.titulo}!`}
            </h2>
            <p
              className="mt-1 text-[13px] leading-relaxed"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {esCierreFinal
                ? "Todas las etapas del pipeline quedaron completadas. El expediente queda archivado."
                : `Avanzaste al paso ${actual.numero} de 15.`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-7 py-6">
        {siguiente && !esCierreFinal && (
          <div
            className="rounded-xl p-4"
            style={{
              background: "var(--nuvia-bg-tertiary)",
              border: "1px solid var(--nuvia-border)",
            }}
          >
            <div
              className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--nuvia-accent-blue)" }}
            >
              <ArrowRight size={13} />
              Continúas con
            </div>
            <div className="mt-1.5 text-[16px] font-bold" style={{ color: "var(--nuvia-text-primary)" }}>
              Etapa {siguiente.numero} · {siguiente.titulo}
            </div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--nuvia-text-secondary)" }}>
              {siguiente.descripcion}
            </div>
            {responsableSiguiente && (
              <div className="mt-2 text-[11.5px]">
                <span className="font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>
                  Responsable:{" "}
                </span>
                <span style={{ color: "var(--nuvia-text-primary)" }}>{responsableSiguiente}</span>
              </div>
            )}
          </div>
        )}

        {acciones.length > 0 && (
          <div className="mt-4">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {esCierreFinal ? "Cierre operativo" : "Acciones sugeridas"}
            </div>
            <ul className="mt-2 space-y-1.5">
              {acciones.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: "var(--nuvia-text-primary)" }}
                >
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "var(--nuvia-accent-green)" }}
                  />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-end gap-2 px-7 py-4"
        style={{
          borderTop: "1px solid var(--nuvia-border)",
          background: "rgba(5,8,22,0.35)",
        }}
      >
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all hover:opacity-95"
          style={{
            background: "var(--nuvia-gradient-primary)",
            color: "var(--nuvia-text-primary)",
            boxShadow: "0 10px 24px -10px rgba(68,93,163,0.55)",
          }}
        >
          Continuar
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function ErrorBody({
  etapaActualId,
  etapaDestinoId,
  razon,
  faltantes,
  onClose,
}: {
  etapaActualId: EtapaPipelineId;
  etapaDestinoId?: EtapaPipelineId;
  razon: string;
  faltantes: string[];
  onClose: () => void;
}) {
  const actual = getEtapaById(etapaActualId);
  const destino = etapaDestinoId ? getEtapaById(etapaDestinoId) : null;

  return (
    <div>
      <div
        className="relative px-7 pt-8 pb-6"
        style={{
          background:
            "linear-gradient(135deg, var(--nuvia-bg-secondary) 0%, rgba(245,158,11,0.18) 55%, var(--nuvia-bg-tertiary) 100%)",
          borderBottom: "1px solid var(--nuvia-border)",
          color: "var(--nuvia-text-primary)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "rgba(245,158,11,0.22)" }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(245,158,11,0.18)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-warning)",
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div className="min-w-0">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              Aún no puedes avanzar
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-tight">
              No se pudo cerrar la etapa
            </h2>
            <p
              className="mt-1 text-[13px] leading-relaxed"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {destino
                ? `Intentaste pasar de ${actual.titulo} a ${destino.titulo}.`
                : `Etapa actual: ${actual.titulo}.`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-7 py-6">
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.30)",
          }}
        >
          <div
            className="text-[10.5px] font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--nuvia-warning)" }}
          >
            Motivo
          </div>
          <div className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--nuvia-text-primary)" }}>
            {razon}
          </div>
        </div>

        {faltantes.length > 0 && (
          <div className="mt-4">
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              Para completar esta etapa te falta
            </div>
            <ul className="mt-2 space-y-1.5">
              {faltantes.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[13px]"
                  style={{ color: "var(--nuvia-text-primary)" }}
                >
                  <span className="mt-0.5" style={{ color: "var(--nuvia-danger)" }}>✗</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-end gap-2 px-7 py-4"
        style={{
          borderTop: "1px solid var(--nuvia-border)",
          background: "rgba(5,8,22,0.35)",
        }}
      >
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition"
          style={{
            background: "var(--nuvia-bg-tertiary)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
