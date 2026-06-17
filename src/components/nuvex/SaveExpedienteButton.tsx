import { useState } from "react";
import { upsertExpediente, type UpsertPayload, type Expediente } from "@/lib/expedientes";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { enviarAValidacionQA } from "@/lib/validacionQA";
import { NUVEX } from "./constants";
import { CasoCreadoModal } from "./CasoCreadoModal";

export function SaveExpedienteButton({
  payload,
  expedienteId,
  onSaved,
  onSeguirSimulando,
  enviarAuditoriaManual = true,
  fromSimulador = false,
}: {
  payload: UpsertPayload;
  expedienteId?: string;
  onSaved?: (e: Expediente) => void;
  onSeguirSimulando?: () => void;
  enviarAuditoriaManual?: boolean;
  fromSimulador?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creado, setCreado] = useState<Expediente | null>(null);
  const [qaEnviada, setQaEnviada] = useState(false);

  const handle = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const wasNew = !expedienteId;
      const e = await upsertExpediente({ ...payload, id: expedienteId });
      // En el simulador corto el expediente ya existe como cascarón operativo;
      // al "crear" desde el simulador lo formalizamos igual que si fuera nuevo.
      if (wasNew || fromSimulador) {
        try {
          await cambiarEstadoConValidacion(e.id, "simulado", "simulacion_guardada");
        } catch (err) {
          console.warn("[estado] simulado", err);
        }
      }
      // ENVÍO AUTOMÁTICO A AUDITORÍA QA manual/director (un solo clic).
      // Cuando el simulador viene desde Expediente Maestro, este envío se
      // desactiva para no duplicar la ruta antigua: allí manda la Auto-QA.
      let qaOk = false;
      if (enviarAuditoriaManual) {
        try {
          await enviarAValidacionQA(e.id);
          qaOk = true;
        } catch (err) {
          console.warn("[qa] envío automático falló", err);
        }
      }
      setQaEnviada(qaOk);
      setMsg(
        (fromSimulador ? "Expediente creado" : expedienteId ? "Expediente actualizado" : "Expediente creado") +
          (qaOk ? " · enviado a auditoría QA" : ""),
      );
      onSaved?.(e);
      if (wasNew || fromSimulador) setCreado(e);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg && <span className="text-xs text-[#242424]/70">{msg}</span>}
        <button
          onClick={handle}
          disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50"
          style={{ backgroundColor: NUVEX.azul }}
        >
          {saving
            ? "Enviando…"
            : fromSimulador
              ? "Crear expediente"
              : expedienteId && !enviarAuditoriaManual
                ? "Actualizar expediente"
                : expedienteId
                  ? "Actualizar y enviar a auditoría QA"
                  : "Crear expediente y enviar a auditoría QA"}
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
