import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
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

  return (
    <Card>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-start gap-3">
          <ClipboardCheck size={20} className="text-[#445DA3] mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-[#0A1226]">Validación financiera QA</div>
            <div className="text-[12px] text-[#242424]/70 mt-0.5">
              Toda proyección requiere aprobación del Director Financiero QA antes de presentarse al cliente.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendiente && (
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "#FFF7E6", color: "#8A5A00" }}>
              Pendiente de validación
            </span>
          )}
          {aprobada && (
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "#EAF7EE", color: "#1F7A45" }}>
              ✓ Proyección aprobada
            </span>
          )}
          {devuelta && (
            <span className="rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>
              Devuelta — corregir
            </span>
          )}
        </div>
      </div>

      {devuelta && ultima?.observacion && (
        <div className="mt-3 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12px] text-[#7F1D1D]">
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

      <div className="mt-3 flex flex-wrap gap-2">
        {puedeEnviar && (
          <button
            disabled={busy}
            onClick={handleEnviar}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "#445DA3" }}
          >
            <Send size={13} /> Enviar a validación financiera
          </button>
        )}
        {canValidarProyeccion && (
          <>
            <button
              type="button"
              onClick={() => scrollToQaSection("lector-extracto-qa")}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C9D7F1] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#445DA3] hover:bg-[#F7F9FB]"
            >
              Ver / subir extracto
            </button>
            <button
              type="button"
              onClick={() => scrollToQaSection("simulador-financiero-qa")}
              className="inline-flex items-center gap-2 rounded-lg border border-[#C9D7F1] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#445DA3] hover:bg-[#F7F9FB]"
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
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#1F7A45" }}
            >
              <CheckCircle2 size={13} /> Aprobar proyección
            </button>
            <button
              disabled={busy}
              onClick={() => setShowDevolver(true)}
              className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#991B1B" }}
            >
              <XCircle size={13} /> Devolver
            </button>
          </>
        )}
        {!puedeEnviar && !pendiente && !aprobada && !devuelta && puedeSolicitarRol && (
          <div className="text-[11px] text-[#242424]/60">
            Estado actual del caso: <b>{String(estadoCaso)}</b>. Completa la simulación (estado <i>simulacion_realizada</i>) para habilitar el envío a validación.
          </div>
        )}
      </div>

      {showDevolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-sm font-semibold text-[#0A1226]">Devolver proyección</div>
            <label className="mt-3 block text-[11px] uppercase tracking-wider text-[#242424]/60">Motivo</label>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value as MotivoDevolucionQA)}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm"
            >
              {MOTIVOS_QA.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <label className="mt-3 block text-[11px] uppercase tracking-wider text-[#242424]/60">
              Observación (obligatoria)
            </label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm"
              placeholder="Explique qué debe corregir el Analista Financiero Comercial…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDevolver(false)}
                className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium"
              >Cancelar</button>
              <button
                onClick={handleDevolver}
                disabled={busy || !observacion.trim()}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: "#991B1B" }}
              >Confirmar devolución</button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
