import { MessageCircle } from "lucide-react";
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

function sanitizePhone(raw?: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("57")) return digits;
  if (digits.length === 10) return `57${digits}`;
  return digits;
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
  const { telefono, disabled, disabledReason } = props;

  const handleClick = () => {
    if (disabled) {
      if (disabledReason) alert(disabledReason);
      return;
    }
    if (!props.propuestas.length) {
      alert("Primero calcula las propuestas antes de generar el mensaje.");
      return;
    }
    const msg = buildWhatsAppMessage(props);
    const phone = sanitizePhone(telefono);
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={disabled ? disabledReason : "Abrir WhatsApp con el mensaje de la propuesta"}
      className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      style={{ backgroundColor: "#25D366" }}
    >
      <MessageCircle size={16} strokeWidth={2.4} />
      Mensaje WhatsApp
    </button>
  );
}
