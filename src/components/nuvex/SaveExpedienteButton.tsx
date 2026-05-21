import { useState } from "react";
import { upsertExpediente, type UpsertPayload, type Expediente } from "@/lib/expedientes";
import { NUVEX } from "./constants";

export function SaveExpedienteButton({
  payload,
  expedienteId,
  onSaved,
}: {
  payload: UpsertPayload;
  expedienteId?: string;
  onSaved?: (e: Expediente) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handle = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const e = await upsertExpediente({ ...payload, id: expedienteId });
      setMsg(expedienteId ? "Expediente actualizado" : "Expediente guardado");
      onSaved?.(e);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-3">
      {msg && <span className="text-xs text-[#242424]/70">{msg}</span>}
      <button
        onClick={handle}
        disabled={saving}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50"
        style={{ backgroundColor: NUVEX.azul }}
      >
        {saving ? "Guardando…" : expedienteId ? "Actualizar expediente" : "Guardar expediente"}
      </button>
    </div>
  );
}
