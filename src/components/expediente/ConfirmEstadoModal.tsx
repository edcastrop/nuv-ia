import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { NSelect } from "@/components/nuvia/NSelect";
import { labelEstado, requiereSubmotivo, submotivosPara, type CasoEstado } from "@/lib/casoEstados";

export interface ConfirmEstadoExtras {
  radicadoIdBanco?: string;
}

interface Props {
  open: boolean;
  nuevoEstado: CasoEstado | null;
  onConfirm: (observacion: string, submotivo?: string, extras?: ConfirmEstadoExtras) => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmEstadoModal({ open, nuevoEstado, onConfirm, onCancel }: Props) {
  const [obs, setObs] = useState("");
  const [submotivo, setSubmotivo] = useState("");
  const [radicadoId, setRadicadoId] = useState("");
  const [busy, setBusy] = useState(false);

  const needsSubmotivo = nuevoEstado ? requiereSubmotivo(nuevoEstado) : false;
  const needsRadicadoId = nuevoEstado === "radicado_banco";
  const opciones = nuevoEstado ? submotivosPara(nuevoEstado) : [];

  const radicadoOk = !needsRadicadoId || radicadoId.trim().length >= 3;
  const obsOk = !needsRadicadoId || obs.trim().length >= 3;
  const canConfirm =
    !!nuevoEstado && (!needsSubmotivo || !!submotivo) && radicadoOk && obsOk;

  const reset = () => {
    setObs("");
    setSubmotivo("");
    setRadicadoId("");
  };

  const handle = async () => {
    if (!nuevoEstado || !canConfirm) return;
    setBusy(true);
    try {
      await onConfirm(
        obs,
        needsSubmotivo ? submotivo : undefined,
        needsRadicadoId ? { radicadoIdBanco: radicadoId.trim() } : undefined,
      );
      reset();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { onCancel(); reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambio de estado del caso</DialogTitle>
          <DialogDescription>
            ¿Confirmas que deseas cambiar el estado del caso a:
            {" "}
            <strong>{nuevoEstado ? labelEstado(nuevoEstado) : "—"}</strong>?
          </DialogDescription>
        </DialogHeader>

        {needsSubmotivo && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">
              Submotivo <span className="text-[#B42318]">*</span>
            </label>
            <select
              value={submotivo}
              onChange={(e) => setSubmotivo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white"
            >
              <option value="">Seleccionar submotivo…</option>
              {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )}

        {needsRadicadoId && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">
              ID de radicado en banco <span className="text-[#B42318]">*</span>
            </label>
            <input
              type="text"
              value={radicadoId}
              onChange={(e) => setRadicadoId(e.target.value)}
              placeholder="Ej: 2026-RAD-987654"
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
              maxLength={120}
              autoFocus
            />
            <p className="mt-1 text-[11px] text-[#242424]/60">
              Número o código entregado por el banco al radicar la solicitud.
            </p>
          </div>
        )}

        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">
            {needsRadicadoId ? (
              <>Observación del banco <span className="text-[#B42318]">*</span></>
            ) : (
              <>Observación (opcional)</>
            )}
          </label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
            placeholder={
              needsRadicadoId
                ? "¿Cómo fue la radicación? Asesor que atendió, tiempos, observaciones del banco, etc."
                : "Nota o contexto del cambio"
            }
            maxLength={1000}
          />
        </div>

        <DialogFooter>
          <button
            onClick={() => { onCancel(); reset(); }}
            disabled={busy}
            className="rounded-lg border border-[#E3E7EE] px-4 py-2 text-xs font-medium bg-white"
          >Cancelar</button>
          <button
            onClick={handle}
            disabled={busy || !canConfirm}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "#445DA3" }}
          >{busy ? "Guardando…" : "Confirmar"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
