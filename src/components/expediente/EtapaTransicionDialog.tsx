import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, ArrowRight, X, Sparkles } from "lucide-react";
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
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-in fade-in"
        onClick={close}
      />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-200"
        style={{ border: "1px solid rgba(0,0,0,0.06)" }}
      >
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#5C6770] hover:bg-[#F2F4F8] hover:text-[#0F1115]"
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
      {/* Cabecera celebrativa */}
      <div
        className="relative px-7 pt-8 pb-6 text-white"
        style={{
          background:
            "linear-gradient(135deg, #0F2419 0%, #1F7A45 55%, #14361F 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "rgba(115,230,156,0.35)" }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            {esCierreFinal ? <Sparkles size={22} /> : <CheckCircle2 size={26} />}
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] opacity-80">
              {esCierreFinal ? "Caso cerrado con éxito" : "Etapa completada con éxito"}
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-tight">
              {esCierreFinal
                ? `¡Felicitaciones, cerraste el caso!`
                : `¡Acabas de finalizar ${anterior.titulo}!`}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/80">
              {esCierreFinal
                ? "Todas las etapas del pipeline quedaron completadas. El expediente queda archivado."
                : `Avanzaste al paso ${actual.numero} de 15.`}
            </p>
          </div>
        </div>
      </div>

      {/* Cuerpo — siguiente etapa */}
      <div className="px-7 py-6">
        {siguiente && !esCierreFinal && (
          <div
            className="rounded-xl p-4"
            style={{ background: "#F4F7FB", border: "1px solid #E3E7EE" }}
          >
            <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#445DA3]">
              <ArrowRight size={13} />
              Continúas con
            </div>
            <div className="mt-1.5 text-[16px] font-bold text-[#0F1115]">
              Etapa {siguiente.numero} · {siguiente.titulo}
            </div>
            <div className="mt-0.5 text-[12.5px] text-[#5C6770]">
              {siguiente.descripcion}
            </div>
            {responsableSiguiente && (
              <div className="mt-2 text-[11.5px]">
                <span className="font-semibold text-[#5C6770]">Responsable: </span>
                <span className="text-[#0F1115]">{responsableSiguiente}</span>
              </div>
            )}
          </div>
        )}

        {acciones.length > 0 && (
          <div className="mt-4">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#5C6770]">
              {esCierreFinal ? "Cierre operativo" : "Acciones sugeridas"}
            </div>
            <ul className="mt-2 space-y-1.5">
              {acciones.map((a) => (
                <li
                  key={a}
                  className="flex items-start gap-2 text-[13px] text-[#242424]"
                >
                  <span
                    className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: "#84B98F" }}
                  />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#E3E7EE] bg-[#FAFBFD] px-7 py-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:opacity-95"
          style={{
            background: "linear-gradient(135deg, #445DA3 0%, #84B98F 100%)",
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
        className="relative px-7 pt-8 pb-6 text-white"
        style={{
          background:
            "linear-gradient(135deg, #3A1F08 0%, #B45309 55%, #2E1808 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl"
          style={{ background: "rgba(255,180,80,0.35)" }}
        />
        <div className="relative flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] opacity-80">
              Aún no puedes avanzar
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-tight">
              No se pudo cerrar la etapa
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-white/85">
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
          style={{ background: "#FEF6EB", border: "1px solid #F3D9A8" }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#8A4B0A]">
            Motivo
          </div>
          <div className="mt-1 text-[13.5px] leading-relaxed text-[#3A1F08]">
            {razon}
          </div>
        </div>

        {faltantes.length > 0 && (
          <div className="mt-4">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#5C6770]">
              Para completar esta etapa te falta
            </div>
            <ul className="mt-2 space-y-1.5">
              {faltantes.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[13px] text-[#242424]"
                >
                  <span className="mt-0.5 text-[#C2410C]">✗</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[#E3E7EE] bg-[#FAFBFD] px-7 py-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-xl bg-[#0F1115] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#1F2329]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
