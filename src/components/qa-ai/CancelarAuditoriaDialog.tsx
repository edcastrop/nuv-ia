import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  anularAuditoriaServer,
  MENSAJE_ANULACION_QA,
  normalizarMotivoAnulacionQA,
  type AnulacionQACode,
} from "@/lib/qaAI.functions";
import { AlertTriangle, X } from "lucide-react";

/**
 * Modal de anulación lógica de una auditoría QA.
 *
 * - La normalización del motivo (`trim` + colapso de espacios) es idéntica
 *   a la de la RPC `anular_qa_auditoria` y a la del wrapper server-side,
 *   por lo que la longitud mostrada al usuario refleja EXACTAMENTE la que
 *   se validará en el servidor.
 * - La acción es irreversible desde la UI. La reactivación no está expuesta:
 *   si se necesita revertir en un caso extraordinario, debe hacerse por vía
 *   administrativa auditada, no desde este componente.
 */
export function CancelarAuditoriaDialog({
  auditoriaId,
  open,
  onClose,
  onCancelled,
}: {
  auditoriaId: string;
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const anular = useServerFn(anularAuditoriaServer);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  const motivoNorm = normalizarMotivoAnulacionQA(motivo);
  const motivoValido = motivoNorm.length >= 3 && motivoNorm.length <= 1000;

  if (!open) return null;

  const handleAnular = async () => {
    if (!motivoValido || !confirmar || enviando) return;
    setError(null);
    setEnviando(true);
    try {
      const res = await anular({ data: { auditoriaId, motivo: motivoNorm } });
      const code = res.code as AnulacionQACode;
      if (res.ok) {
        onCancelled();
        onClose();
      } else {
        setError(MENSAJE_ANULACION_QA[code] ?? "No se pudo anular la auditoría.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo anular la auditoría.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(2,6,23,0.65)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancelar-qa-titulo"
    >
      <div
        className="w-full max-w-md rounded-2xl p-5"
        style={{
          background: "var(--nuvia-surface, #0F172A)",
          border: "1px solid var(--nuvia-border)",
          boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)",
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "rgba(220,38,38,0.15)", color: "#FCA5A5" }}
            >
              <AlertTriangle size={16} />
            </span>
            <h2
              id="cancelar-qa-titulo"
              className="text-[15px] font-semibold"
              style={{ color: "var(--nuvia-text-primary)" }}
            >
              Anular auditoría NUVIA
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 hover:opacity-80"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: "var(--nuvia-text-secondary)" }}>
          La anulación es <b>lógica e irreversible desde esta pantalla</b>. La auditoría
          desaparecerá de las bandejas operativas pero permanecerá en el historial
          con etiqueta <b>ANULADA</b>. No podrá utilizarse para crear un caso.
        </p>

        <label
          htmlFor="motivo-anulacion"
          className="block text-[11px] uppercase tracking-wide mb-1"
          style={{ color: "var(--nuvia-text-secondary)" }}
        >
          Motivo (obligatorio, 3 a 1000 caracteres)
        </label>
        <textarea
          id="motivo-anulacion"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={1200}
          rows={4}
          className="w-full rounded-lg p-2.5 text-[12.5px]"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
          placeholder="Ej.: OCR incorrecto duplicado por dos cargas del mismo extracto."
        />
        <div
          className="mt-1 text-[11px] flex justify-between"
          style={{ color: motivoValido ? "var(--nuvia-text-secondary)" : "#FCA5A5" }}
        >
          <span>{motivoValido ? "Motivo válido." : "Motivo demasiado corto o vacío."}</span>
          <span>{motivoNorm.length}/1000</span>
        </div>

        <label className="mt-3 flex items-start gap-2 text-[12px]" style={{ color: "var(--nuvia-text-primary)" }}>
          <input
            type="checkbox"
            checked={confirmar}
            onChange={(e) => setConfirmar(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Entiendo que esta acción es <b>irreversible</b> desde esta pantalla y que
            quedará registrada en el historial de auditoría.
          </span>
        </label>

        {error && (
          <div
            className="mt-3 rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.35)",
              color: "#FCA5A5",
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            className="rounded-lg px-3 py-2 text-[12px] font-semibold"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-primary)",
              cursor: enviando ? "not-allowed" : "pointer",
              opacity: enviando ? 0.6 : 1,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleAnular}
            disabled={!motivoValido || !confirmar || enviando}
            className="rounded-lg px-3 py-2 text-[12px] font-semibold"
            style={{
              background: "rgba(220,38,38,0.9)",
              color: "#FFFFFF",
              border: "1px solid rgba(220,38,38,0.6)",
              cursor: !motivoValido || !confirmar || enviando ? "not-allowed" : "pointer",
              opacity: !motivoValido || !confirmar || enviando ? 0.6 : 1,
            }}
          >
            {enviando ? "Anulando…" : "Anular auditoría"}
          </button>
        </div>
      </div>
    </div>
  );
}
