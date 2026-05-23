import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";

interface Props {
  open: boolean;
  nuevoEstado: CasoEstado | null;
  onConfirm: (observacion: string) => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmEstadoModal({ open, nuevoEstado, onConfirm, onCancel }: Props) {
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!nuevoEstado) return;
    setBusy(true);
    try { await onConfirm(obs); setObs(""); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambio de estado del caso</DialogTitle>
          <DialogDescription>
            ¿Confirmas que deseas cambiar el estado del caso a:
            {" "}
            <strong>{nuevoEstado ? labelEstado(nuevoEstado) : "—"}</strong>?
          </DialogDescription>
        </DialogHeader>
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
            disabled={busy || !nuevoEstado}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ background: "#445DA3" }}
          >{busy ? "Guardando…" : "Confirmar"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
