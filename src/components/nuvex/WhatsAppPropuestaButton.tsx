import { useState, useCallback } from "react";
import { MessageCircle, Copy, X, Check } from "lucide-react";
import { formatCOP } from "../../lib/format";

export interface WhatsAppPropuestaItem {
  nuevaCuota: number;
  añosEliminados: number;
  ahorroTotal: number;
}

interface Props {
  nombre?: string;
  banco?: string;
  telefono?: string;
  cuotaActual: number;
  propuestas: WhatsAppPropuestaItem[];
  recomendadaIndex?: number;
  asesor?: string;
  disabled?: boolean;
  disabledReason?: string;
}

function primerNombre(nombre?: string): string {
  return (nombre || "").trim().split(/\s+/)[0] || "";
}

function compactCOP(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const m = n / 1_000_000;
    const v = m >= 100 ? Math.round(m).toString() : m.toFixed(1).replace(/\.0$/, "");
    return `$${v}M`;
  }
  return formatCOP(n);
}

export function buildWhatsAppMessage(p: {
  nombre?: string;
  banco?: string;
  cuotaActual: number;
  propuestas: WhatsAppPropuestaItem[];
  recomendadaIndex?: number;
  asesor?: string;
}): string {
  const nombre = primerNombre(p.nombre) || "hola";
  const banco = p.banco || "tu banco";
  const total = p.propuestas.length;

  const incrementos = p.propuestas
    .map(x => Math.max(0, x.nuevaCuota - p.cuotaActual))
    .filter(v => v >= 0);
  const años = p.propuestas.map(x => Math.max(0, Math.round(x.añosEliminados)));
  const ahorros = p.propuestas.map(x => Math.max(0, x.ahorroTotal));

  const incMin = incrementos.length ? Math.min(...incrementos) : 0;
  const incMax = incrementos.length ? Math.max(...incrementos) : 0;
  const añosMin = años.length ? Math.min(...años) : 0;
  const añosMax = años.length ? Math.max(...años) : 0;
  const ahorroMin = ahorros.length ? Math.min(...ahorros) : 0;
  const ahorroMax = ahorros.length ? Math.max(...ahorros) : 0;

  const recIdx = typeof p.recomendadaIndex === "number" ? p.recomendadaIndex : 0;
  const rec = p.propuestas[recIdx];
  const recInc = rec ? Math.max(0, rec.nuevaCuota - p.cuotaActual) : incMin;
  const recAños = rec ? Math.max(0, Math.round(rec.añosEliminados)) : añosMax;
  const recAhorro = rec ? Math.max(0, rec.ahorroTotal) : ahorroMax;

  const incRange = incMin === incMax ? formatCOP(recInc) : `${formatCOP(incMin)} y ${formatCOP(incMax)}`;
  const añosRange = añosMin === añosMax ? `${recAños} años` : `${añosMin} y ${añosMax} años`;
  const ahorroRange = ahorroMin === ahorroMax ? compactCOP(recAhorro) : `${compactCOP(ahorroMin)} y ${compactCOP(ahorroMax)}`;

  const firma = p.asesor ? `\n— ${p.asesor} · NUVEX` : "\n— Equipo NUVEX";

  return [
    `Hola ${nombre} 👋`,
    ``,
    `Soy de *NUVEX*. Revisamos tu crédito con *${banco}* y trabajamos *100% a éxito*: solo cobramos si el banco aprueba la optimización.`,
    ``,
    `Te preparamos *${total} propuestas* y te recomendamos *1* en particular.`,
    ``,
    `Con un aumento pequeño en tu cuota (entre *${incRange}* al mes) podrías:`,
    `• Recortar entre *${añosRange}* de tu crédito`,
    `• Ahorrar entre *${ahorroRange}* en intereses y seguros`,
    ``,
    `📎 Te envío la propuesta en PDF con el detalle.`,
    `¿La revisamos juntos y avanzamos hoy?` + firma,
  ].join("\n");
}

export function WhatsAppPropuestaButton(props: Props) {
  const { disabled, disabledReason } = props;
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpen = () => {
    if (disabled) {
      if (disabledReason) alert(disabledReason);
      return;
    }
    if (!props.propuestas.length) {
      alert("Primero calcula las propuestas antes de generar el mensaje.");
      return;
    }
    setOpen(true);
    setCopied(false);
  };

  const message = open ? buildWhatsAppMessage(props) : "";

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = message;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("No se pudo copiar automáticamente. Selecciona el texto y usa Ctrl+C / Cmd+C.");
      }
      document.body.removeChild(textarea);
    }
  }, [message]);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        title={disabled ? disabledReason : "Generar mensaje de WhatsApp"}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#25D366" }}
      >
        <MessageCircle size={16} strokeWidth={2.4} />
        Mensaje WhatsApp
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>

            <div className="mb-4 flex items-center gap-2">
              <div
                className="grid h-8 w-8 place-items-center rounded-lg"
                style={{ backgroundColor: "#25D366" }}
              >
                <MessageCircle size={16} className="text-white" strokeWidth={2.4} />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Mensaje para WhatsApp</h3>
            </div>

            <p className="mb-3 text-sm text-gray-500">
              Copia el texto y pégalo en tu chat de WhatsApp.
            </p>

            <textarea
              readOnly
              value={message}
              className="mb-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 outline-none focus:ring-2 focus:ring-[#25D366]/30"
              rows={14}
              onFocus={(e) => e.currentTarget.select()}
            />

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: "#25D366" }}
              >
                {copied ? <Check size={16} strokeWidth={2.4} /> : <Copy size={16} strokeWidth={2.4} />}
                {copied ? "Copiado" : "Copiar mensaje"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
