import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { labelEstado, requiereSubmotivo, submotivosPara, type CasoEstado } from "@/lib/casoEstados";

interface Props {
  open: boolean;
  nuevoEstado: CasoEstado | null;
  onConfirm: (observacion: string, submotivo?: string) => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmEstadoModal({ open, nuevoEstado, onConfirm, onCancel }: Props) {
  const [obs, setObs] = useState("");
  const [submotivo, setSubmotivo] = useState("");
  const [busy, setBusy] = useState(false);

  const needsSubmotivo = nuevoEstado ? requiereSubmotivo(nuevoEstado) : false;
  const opciones = nuevoEstado ? submotivosPara(nuevoEstado) : [];
  const canConfirm = !!nuevoEstado && (!needsSubmotivo || !!submotivo);

  const handle = async () => {
    if (!nuevoEstado) return;
    if (needsSubmotivo && !submotivo) return;
    setBusy(true);
    try {
      await onConfirm(obs, needsSubmotivo ? submotivo : undefined);
      setObs("");
      setSubmotivo("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { onCancel(); setSubmotivo(""); } }}>
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
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">Observación (opcional)</label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
            placeholder="Nota o contexto del cambio"
          />
        </div>
        <DialogFooter>
          <button
            onClick={onCancel}
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
