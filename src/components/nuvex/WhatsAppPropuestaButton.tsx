import { useState, useCallback } from "react";
import { MessageCircle, Copy, X, Check } from "lucide-react";
import { formatCOP } from "../../lib/format";

export interface WhatsAppPropuestaItem {
  nuevaCuota: number;
  /** Aumento mensual calculado por el escenario comercial. Si llega, tiene prioridad sobre nuevaCuota - cuotaActual. */
  incrementoMensual?: number;
  añosEliminados: number;
  ahorroTotal: number;
  /** Honorarios base (sin descuento). Si no se envía, se omite el bloque de honorarios. */
  honorarios?: number;
  /** Honorarios finales con descuento aplicado. Si no se envía, se asume igual a honorarios. */
  honorariosFinal?: number;
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

/**
 * Tiempos de proceso por banco. Conservar sincronizado con
 * los SLA reales acordados por el equipo comercial.
 */
const TIEMPOS_POR_BANCO: Array<{ match: RegExp; tiempo: string }> = [
  { match: /davivienda/i, tiempo: "30 a 40 días" },
  { match: /leasing.*bancolombia|bancolombia.*leasing/i, tiempo: "30 días" },
  { match: /bancolombia/i, tiempo: "30 días" },
  { match: /caja\s*social|colmena/i, tiempo: "30 días" },
  { match: /bogot[áa]/i, tiempo: "30 a 40 días" },
  { match: /av.?\s*villas/i, tiempo: "30 a 40 días" },
  { match: /popular/i, tiempo: "30 a 40 días" },
  { match: /occidente/i, tiempo: "30 a 40 días" },
  { match: /fondo.*nacional.*ahorro|fna/i, tiempo: "60 días" },
];

function tiempoProcesoBanco(banco?: string): string {
  const b = (banco || "").trim();
  if (!b) return "30 a 40 días";
  for (const { match, tiempo } of TIEMPOS_POR_BANCO) {
    if (match.test(b)) return tiempo;
  }
  return "30 a 40 días";
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

  // Índice de la propuesta recomendada (por defecto la primera)
  const recIdx =
    typeof p.recomendadaIndex === "number" &&
    p.recomendadaIndex >= 0 &&
    p.recomendadaIndex < p.propuestas.length
      ? p.recomendadaIndex
      : 0;
  const recomendada = p.propuestas[recIdx];

  // Datos de la recomendada
  const incRecomendado = recomendada
    ? Math.max(0, typeof recomendada.incrementoMensual === "number" ? recomendada.incrementoMensual : recomendada.nuevaCuota - p.cuotaActual)
    : 0;
  const ahorroRecomendado = recomendada ? Math.max(0, recomendada.ahorroTotal) : 0;
  const añosRecomendado = recomendada ? Math.max(0, Math.round(recomendada.añosEliminados)) : 0;
  const honBaseRecomendado = recomendada && typeof recomendada.honorarios === "number" ? recomendada.honorarios : 0;
  const honFinalRecomendado = recomendada && typeof recomendada.honorariosFinal === "number" ? recomendada.honorariosFinal : honBaseRecomendado;
  const hayDescuentoRecomendado = honFinalRecomendado > 0 && honFinalRecomendado < honBaseRecomendado;

  // Rango global para contexto (todas las propuestas)
  const incrementos = p.propuestas
    .map(x => Math.max(0, typeof x.incrementoMensual === "number" ? x.incrementoMensual : x.nuevaCuota - p.cuotaActual))
    .filter(v => v >= 0);
  const incMin = incrementos.length ? Math.min(...incrementos) : 0;
  const incMax = incrementos.length ? Math.max(...incrementos) : 0;
  const incRange = incMin === incMax ? formatCOP(incMin) : `${formatCOP(incMin)} y ${formatCOP(incMax)}`;

  const años = p.propuestas.map(x => Math.max(0, Math.round(x.añosEliminados)));
  const añosMin = años.length ? Math.min(...años) : 0;
  const añosMax = años.length ? Math.max(...años) : 0;
  const añosRange = añosMin === añosMax ? `${añosMax} años` : `${añosMin} y ${añosMax} años`;

  const ahorros = p.propuestas.map(x => Math.max(0, x.ahorroTotal));
  const ahorroPrimera = ahorros[0] ?? 0;
  const ahorroUltima = ahorros[ahorros.length - 1] ?? ahorroPrimera;
  const ahorroLo = Math.min(ahorroPrimera, ahorroUltima);
  const ahorroHi = Math.max(ahorroPrimera, ahorroUltima);
  const ahorroRange = ahorroLo === ahorroHi ? compactCOP(ahorroHi) : `${compactCOP(ahorroLo)} y ${compactCOP(ahorroHi)}`;

  // Honorarios: rango base (1ª y última)
  const honorariosBase = p.propuestas
    .map(x => (typeof x.honorarios === "number" ? x.honorarios : null))
    .filter((v): v is number => v != null && v > 0);
  const tieneHonorarios = honorariosBase.length > 0;
  const honPrimera = honorariosBase[0] ?? 0;
  const honUltima = honorariosBase[honorariosBase.length - 1] ?? honPrimera;
  const honLo = Math.min(honPrimera, honUltima);
  const honHi = Math.max(honPrimera, honUltima);
  const honRange = honLo === honHi ? formatCOP(honHi) : `${formatCOP(honLo)} y ${formatCOP(honHi)}`;

  const tiempo = tiempoProcesoBanco(p.banco);
  const asesor = (p.asesor || "").trim();

  const lines: string[] = [];
  lines.push(`Hola ${nombre} 👋`);
  lines.push("");
  if (asesor) {
    lines.push(`Soy *${asesor}*, tu analista asignado en *NUVEX*.`);
  } else {
    lines.push(`Te escribo desde *NUVEX*, soy tu analista asignado.`);
  }
  lines.push("");
  lines.push(`Revisé tu crédito con *${banco}* y tengo *muy buenas noticias* para ti 🎉`);
  lines.push("");
  lines.push(`Preparé *${total} propuestas* de optimización y te sugiero una en particular que me parece la mejor para tu caso.`);
  lines.push("");

  // Bloque de la propuesta recomendada con números concretos
  if (recomendada) {
    lines.push(`*Con la propuesta que te sugiero:*`);
    if (incRecomendado > 0) {
      lines.push(`• Tu cuota subiría *${formatCOP(incRecomendado)}* al mes`);
    }
    if (añosRecomendado > 0) {
      lines.push(`• Podrías *eliminar ${añosRecomendado === 1 ? "1 año" : `${añosRecomendado} años`}* de deuda`);
    }
    if (ahorroRecomendado > 0) {
      lines.push(`• Eso significa *${compactCOP(ahorroRecomendado)}* que dejarías de pagar en intereses y seguros`);
    }
    lines.push("");
  }

  // Contexto de rango si hay varias propuestas
  if (total > 1) {
    lines.push(`En general, según la propuesta que elijas, el aumento en tu cuota estaría entre *${incRange}* al mes, y podrías eliminar entre *${añosRange}* de tu crédito.`);
    lines.push("");
  }

  // Énfasis en el beneficio por pronta firma
  if (tieneHonorarios && recomendada) {
    lines.push(`💰 *Sobre los honorarios:*`);
    if (hayDescuentoRecomendado && honFinalRecomendado > 0) {
      lines.push(
        `Si tomas la decisión de que optimicemos tu crédito, te daría un *beneficio en el valor de los honorarios*: un *descuento por pronta firma* en la proyección que te sugiero, quedando en *${formatCOP(honFinalRecomendado)}* en vez de *${formatCOP(honBaseRecomendado)}*.`
      );
    } else if (honBaseRecomendado > 0) {
      lines.push(
        `El valor de los honorarios para la proyección que te sugiero es de *${formatCOP(honBaseRecomendado)}*. Si tomas la decisión en la llamada con el especialista, podemos evaluar un beneficio por pronta firma.`
      );
    }
    lines.push(`Nuestros honorarios se cobran como un *porcentaje del número de millones que eliminemos de tu deuda* — solo ganas si ganas.`);
    if (total > 1) {
      lines.push(`El rango general de honorarios según la propuesta que elijas está entre *${honRange}*.`);
    }
    lines.push("");
  }

  // Garantía de éxito
  lines.push(
    `Trabajamos *100% a éxito*: si no logramos la eliminación de esos intereses, *no pagas nada*. Eso queda claro por contrato, así que puedes estar tranquilo.`
  );
  lines.push("");

  // Flexibilidad
  if (total > 1) {
    lines.push(`Si prefieres otra proyección distinta a la que te sugiero, la podemos evaluar en la llamada sin problema.`);
    lines.push("");
  }

  lines.push(`⏱ *Tiempo estimado con ${banco}:* ${tiempo}.`);
  lines.push("");
  lines.push(`📎 Te envío la propuesta en PDF con todo el detalle.`);
  lines.push("");
  lines.push(`¿Te animas a que agendemos una llamada con el especialista? ¿En qué horario te queda mejor hoy o mañana?`);
  lines.push("");
  lines.push(asesor ? `— ${asesor} · NUVEX` : `— Equipo NUVEX`);

  return lines.join("\n");
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
              rows={18}
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
