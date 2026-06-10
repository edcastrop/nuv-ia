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
}: {
  payload: UpsertPayload;
  expedienteId?: string;
  onSaved?: (e: Expediente) => void;
  onSeguirSimulando?: () => void;
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
      if (wasNew) {
        try {
          await cambiarEstadoConValidacion(e.id, "simulado", "simulacion_guardada");
        } catch (err) {
          console.warn("[estado] simulado", err);
        }
      }
      // ENVÍO AUTOMÁTICO A AUDITORÍA QA (un solo clic)
      let qaOk = false;
      try {
        await enviarAValidacionQA(e.id);
        qaOk = true;
      } catch (err) {
        console.warn("[qa] envío automático falló", err);
      }
      setQaEnviada(qaOk);
      setMsg(
        (expedienteId ? "Expediente actualizado" : "Expediente creado") +
          (qaOk ? " · enviado a auditoría QA" : ""),
      );
      onSaved?.(e);
      if (wasNew) setCreado(e);
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
