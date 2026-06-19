import { useMemo, useState } from "react";
import { upsertExpediente, type UpsertPayload, type Expediente } from "@/lib/expedientes";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { aprobarAutomaticamentePorMotor, enviarAValidacionQA } from "@/lib/validacionQA";
import { auditarSimulacion, type AuditoriaInput } from "@/lib/auditEngine";
import { decidirPdf, type NivelAutonomia } from "@/lib/autonomia";
import { NUVEX } from "./constants";
import { CasoCreadoModal } from "./CasoCreadoModal";

export function SaveExpedienteButton({
  payload,
  expedienteId,
  onSaved,
  onSeguirSimulando,
  enviarAuditoriaManual = true,
  fromSimulador = false,
  auditInput,
  nivelAutonomia,
}: {
  payload: UpsertPayload;
  expedienteId?: string;
  onSaved?: (e: Expediente) => void;
  onSeguirSimulando?: () => void;
  enviarAuditoriaManual?: boolean;
  fromSimulador?: boolean;
  // Si se proveen, el botón decide entre auto-aprobar (motor NUVIA apto) o
  // enviar a QA manual. Si no, mantiene el comportamiento anterior (siempre
  // envía a QA cuando `enviarAuditoriaManual` está activo).
  auditInput?: AuditoriaInput;
  nivelAutonomia?: NivelAutonomia;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creado, setCreado] = useState<Expediente | null>(null);
  const [qaEnviada, setQaEnviada] = useState(false);

  const decision = useMemo(() => {
    if (!auditInput || !nivelAutonomia) return null;
    try {
      const resultado = auditarSimulacion(auditInput);
      return decidirPdf(nivelAutonomia, resultado);
    } catch {
      return null;
    }
  }, [auditInput, nivelAutonomia]);

  const autoAprobable = enviarAuditoriaManual && decision?.accion === "permitir";

  const handle = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const wasNew = !expedienteId;
      const e = await upsertExpediente({ ...payload, id: expedienteId });
      if (wasNew || fromSimulador) {
        try {
          await cambiarEstadoConValidacion(e.id, "simulado", "simulacion_guardada");
        } catch (err) {
          console.warn("[estado] simulado", err);
        }
      }

      let qaOk = false;
      let autoAprobado = false;
      if (enviarAuditoriaManual) {
        if (decision?.accion === "permitir") {
          // Motor NUVIA → apto. Saltamos QA y dejamos el caso listo para Contratación.
          try {
            await aprobarAutomaticamentePorMotor(
              e.id,
              `Motor NUVIA: ${decision.motivo}`,
            );
            autoAprobado = true;
          } catch (err) {
            console.warn("[qa] auto-aprobación NUVIA falló, envío a QA manual", err);
            try {
              await enviarAValidacionQA(e.id);
              qaOk = true;
            } catch (err2) {
              console.warn("[qa] envío manual también falló", err2);
            }
          }
        } else {
          // Marca de advertencia o bloqueo → red de seguridad: QA manual.
          try {
            await enviarAValidacionQA(e.id);
            qaOk = true;
          } catch (err) {
            console.warn("[qa] envío automático falló", err);
          }
        }
      }
      setQaEnviada(qaOk || autoAprobado);
      setMsg(
        (fromSimulador ? "Expediente creado" : expedienteId ? "Expediente actualizado" : "Expediente creado") +
          (autoAprobado
            ? " · aprobado por NUVIA, listo para Contratación"
            : qaOk
              ? " · enviado a auditoría QA"
              : ""),
      );
      onSaved?.(e);
      if (wasNew || fromSimulador) setCreado(e);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const buttonLabel = (() => {
    if (saving) return "Enviando…";
    if (expedienteId && !enviarAuditoriaManual) return "Actualizar expediente";
    if (autoAprobable) {
      return expedienteId
        ? "Actualizar y enviar a Contratación"
        : "Crear y enviar a Contratación";
    }
    if (decision?.accion === "permitir_con_marca") {
      return expedienteId
        ? "Actualizar y enviar a auditoría QA (advertencia)"
        : "Crear y enviar a auditoría QA (advertencia)";
    }
    if (decision?.accion === "bloquear") {
      return expedienteId
        ? "Actualizar y enviar a auditoría QA (revisión obligatoria)"
        : "Crear y enviar a auditoría QA (revisión obligatoria)";
    }
    if (fromSimulador) return "Crear expediente";
    return expedienteId
      ? "Actualizar y enviar a auditoría QA"
      : "Crear expediente y enviar a auditoría QA";
  })();

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg && <span className="text-xs text-[#242424]/70">{msg}</span>}
        <button
          onClick={handle}
          disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50"
          style={{ backgroundColor: autoAprobable ? "#1F6F4A" : NUVEX.azul }}
        >
          {buttonLabel}
        </button>
      </div>
      {creado && (
        <CasoCreadoModal
          expediente={creado}
          qaEnviada={qaEnviada}
          onClose={() => setCreado(null)}
          onSeguirSimulando={onSeguirSimulando}
        />
      )}
    </>
  );
}
