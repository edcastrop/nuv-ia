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
            <label className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-tertiary)" }}>
              Submotivo <span style={{ color: "rgb(255,107,107)" }}>*</span>
            </label>
            <div className="mt-1">
              <NSelect
                value={submotivo}
                onValueChange={(v) => setSubmotivo(v)}
                placeholder="Seleccionar submotivo…"
                options={opciones.map((o) => ({ value: o, label: o }))}
                compact
              />
            </div>
          </div>
        )}

        {needsRadicadoId && (
          <div>
            <label className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-tertiary)" }}>
              ID de radicado en banco <span style={{ color: "rgb(255,107,107)" }}>*</span>
            </label>
            <input
              type="text"
              value={radicadoId}
              onChange={(e) => setRadicadoId(e.target.value)}
              placeholder="Ej: 2026-RAD-987654"
              className="nuvia-input nuvia-input-sm mt-1 w-full"
              maxLength={120}
              autoFocus
            />
            <p className="mt-1 text-[11px]" style={{ color: "var(--nuvia-text-tertiary)" }}>
              Número o código entregado por el banco al radicar la solicitud.
            </p>
          </div>
        )}

        <div>
          <label className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-tertiary)" }}>
            {needsRadicadoId ? (
              <>Observación del banco <span style={{ color: "rgb(255,107,107)" }}>*</span></>
            ) : (
              <>Observación (opcional)</>
            )}
          </label>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            rows={3}
            className="nuvia-input mt-1 w-full"
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
            className="rounded-lg px-4 py-2 text-xs font-medium transition"
            style={{ border: "1px solid var(--nuvia-border-medium)", background: "rgba(255,255,255,0.04)", color: "var(--nuvia-text-secondary)" }}
          >Cancelar</button>
          <button
            onClick={handle}
            disabled={busy || !canConfirm}
            className="rounded-lg px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed"
            style={{
              background: canConfirm ? "var(--nuvia-accent-blue)" : "rgba(68,93,163,0.35)",
              color: "#ffffff",
              border: canConfirm ? "1px solid var(--nuvia-accent-blue)" : "1px solid rgba(68,93,163,0.5)",
              boxShadow: canConfirm ? "0 6px 18px rgba(68,93,163,0.35)" : "none",
            }}
            title={
              !canConfirm
                ? needsRadicadoId
                  ? "Completa el ID de radicado (mínimo 3 caracteres) y la observación del banco"
                  : "Completa los campos requeridos"
                : "Confirmar cambio de estado"
            }
          >{busy ? "Guardando…" : "Confirmar y guardar"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
