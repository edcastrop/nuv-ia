import { useEffect, useState } from "react";
import { NCard, SectionHeader, NSelect } from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import {
  aprobarQA,
  devolverQA,
  enviarAValidacionQA,
  MOTIVOS_QA,
  obtenerUltimaValidacion,
  type MotivoDevolucionQA,
  type ValidacionQA,
} from "@/lib/validacionQA";
import type { CasoEstado } from "@/lib/casoEstados";
import { CheckCircle2, Send, XCircle, AlertTriangle, ClipboardCheck } from "lucide-react";

interface Props {
  expedienteId: string;
  estadoCaso: CasoEstado | string;
  onChanged?: () => void;
}

export function ValidacionQABlock({ expedienteId, estadoCaso, onChanged }: Props) {
  const { isLicenciado, isSuperAdmin, roles, canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const puedeSolicitarRol = isLicenciado || isSuperAdmin || roles.includes("gerencia");
  const [ultima, setUltima] = useState<ValidacionQA | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDevolver, setShowDevolver] = useState(false);
  const [motivo, setMotivo] = useState<MotivoDevolucionQA>("error_financiero");
  const [observacion, setObservacion] = useState("");

  const reload = async () => {
    setLoading(true);
    setUltima(await obtenerUltimaValidacion(expedienteId));
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expedienteId]);

  if (rolesLoading || loading) return null;

  const validacionPendiente = !!ultima && !ultima.resultado;
  const pendiente = estadoCaso === "proyeccion_pendiente_qa" || validacionPendiente;
  const aprobada = estadoCaso === "proyeccion_aprobada_qa" || ultima?.resultado === "aprobada";
  const devuelta = estadoCaso === "proyeccion_devuelta_qa" || ultima?.resultado === "devuelta";
  const estadoHabilita = ["simulacion_realizada", "simulado", "extracto_recibido", "proyeccion_devuelta_qa"].includes(
    String(estadoCaso),
  );
  const puedeEnviar = puedeSolicitarRol && !pendiente && !aprobada && estadoHabilita;
  const puedeValidarPendiente = canValidarProyeccion && validacionPendiente;

  const handleEnviar = async () => {
    setBusy(true);
    try {
      await enviarAValidacionQA(expedienteId);
      await reload();
      onChanged?.();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAprobar = async () => {
    if (!ultima) return;
    setBusy(true);
    try {
      await aprobarQA(ultima.id);
      await reload();
      onChanged?.();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDevolver = async () => {
    if (!ultima) return;
    if (!observacion.trim()) {
      alert("La observación es obligatoria");
      return;
    }
    setBusy(true);
    try {
      await devolverQA(ultima.id, motivo, observacion);
      setShowDevolver(false);
      setObservacion("");
      await reload();
      onChanged?.();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const scrollToQaSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const statusBadge = pendiente
    ? { bg: "rgba(245,199,122,0.16)", border: "rgba(245,199,122,0.32)", color: "#F5C77A", label: "Pendiente de validación" }
    : aprobada
      ? { bg: "rgba(125,232,176,0.16)", border: "rgba(125,232,176,0.32)", color: "#7DE8B0", label: "✓ Proyección aprobada" }
      : devuelta
        ? { bg: "rgba(255,107,107,0.16)", border: "rgba(255,107,107,0.32)", color: "#FFB4B4", label: "Devuelta — corregir" }
        : null;

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<ClipboardCheck size={16} />}
        title="Validación financiera QA"
        description="Toda proyección requiere aprobación del Director Financiero QA antes de presentarse al cliente."
        action={
          statusBadge ? (
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ background: statusBadge.bg, border: `1px solid ${statusBadge.border}`, color: statusBadge.color }}
            >
              {statusBadge.label}
            </span>
          ) : undefined
        }
      />

      {devuelta && ultima?.observacion && (
        <div
          className="mb-3 rounded-lg p-3 text-[12px]"
          style={{
            background: "rgba(255,107,107,0.12)",
            border: "1px solid rgba(255,107,107,0.32)",
            color: "#FFB4B4",
          }}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5" />
            <div>
              <div className="font-semibold">
                Motivo: {MOTIVOS_QA.find((m) => m.value === ultima.motivo)?.label ?? "—"}
              </div>
              <div className="mt-1">{ultima.observacion}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {puedeEnviar && (
          <button
            disabled={busy}
            onClick={handleEnviar}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
            style={{
              background: "rgba(68,93,163,0.28)",
              border: "1px solid rgba(68,93,163,0.5)",
              color: "var(--nuvia-text-primary)",
            }}
          >
            <Send size={13} /> Enviar a validación financiera
          </button>
        )}
        {canValidarProyeccion && (
          <>
            <button
              type="button"
              onClick={() => scrollToQaSection("lector-extracto-qa")}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--nuvia-border)",
                color: "var(--nuvia-text-primary)",
              }}
            >
              Ver / subir extracto
            </button>
            <button
              type="button"
              onClick={() => scrollToQaSection("simulador-financiero-qa")}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--nuvia-border)",
                color: "var(--nuvia-text-primary)",
              }}
            >
              Revisar / editar simulación
            </button>
          </>
        )}
        {puedeValidarPendiente && ultima && (
          <>
            <button
              disabled={busy}
              onClick={handleAprobar}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
              style={{
                background: "rgba(125,232,176,0.2)",
                border: "1px solid rgba(125,232,176,0.4)",
                color: "#7DE8B0",
              }}
            >
              <CheckCircle2 size={13} /> Aprobar proyección
            </button>
            <button
              disabled={busy}
              onClick={() => setShowDevolver(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold disabled:opacity-50"
              style={{
                background: "rgba(255,107,107,0.2)",
                border: "1px solid rgba(255,107,107,0.4)",
                color: "#FFB4B4",
              }}
            >
              <XCircle size={13} /> Devolver
            </button>
          </>
        )}
        {!puedeEnviar && !pendiente && !aprobada && !devuelta && puedeSolicitarRol && (
          <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
            Estado actual: <b style={{ color: "var(--nuvia-text-primary)" }}>{String(estadoCaso)}</b>. Completa la simulación (estado <i>simulacion_realizada</i>) para habilitar el envío a validación.
          </div>
        )}
      </div>

      {showDevolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md rounded-2xl p-5"
            style={{
              background: "var(--nuvia-bg-card)",
              border: "1px solid var(--nuvia-border-strong)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              Devolver proyección
            </div>
            <label
              className="mt-3 block text-[11px] uppercase tracking-wider"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              Motivo
            </label>
            <div className="mt-1">
              <NSelect
                value={motivo}
                onValueChange={(v) => setMotivo(v as MotivoDevolucionQA)}
                options={MOTIVOS_QA.map((m) => ({ value: m.value, label: m.label }))}
                compact={false}
              />
            </div>
            <label
              className="mt-3 block text-[11px] uppercase tracking-wider"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              Observación (obligatoria)
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={4}
              className="nuvia-input mt-1 w-full"
              placeholder="Explique qué debe corregir el Analista Financiero Comercial…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDevolver(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--nuvia-border)",
                  color: "var(--nuvia-text-primary)",
                }}
              >Cancelar</button>
              <button
                onClick={handleDevolver}
                disabled={busy || !observacion.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{
                  background: "rgba(255,107,107,0.22)",
                  border: "1px solid rgba(255,107,107,0.4)",
                  color: "#FFB4B4",
                }}
              >Confirmar devolución</button>
            </div>
          </div>
        </div>
      )}
    </NCard>
  );
}
