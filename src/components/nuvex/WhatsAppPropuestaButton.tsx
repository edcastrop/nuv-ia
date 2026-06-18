import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
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

function nombreAnalista(nombre?: string): string {
  const partes = (nombre || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "";
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[1]}`;
}

// Heurística de género por primer nombre (es-CO). Devuelve "F" | "M".
const NOMBRES_MASCULINOS = new Set([
  "andres","jose","jesus","nicolas","tomas","matias","elias","lucas","ezequiel",
  "joaquin","ismael","ezequias","ivan","adan","jonas","abraham","noe","moises",
  "david","daniel","samuel","gabriel","rafael","miguel","angel","manuel","emanuel",
  "israel","ariel","uriel","raul","saul","cesar","oscar","omar","edgar","hector",
  "victor","nestor","javier","alexander","alexis","felix","luis","jesús","andrés",
  "tomás","matías","elías","joaquín","ismaél","iván","adán","jonás","noé","moisés",
  "ángel","emanuél","raúl","saúl","césar","óscar","omár","édgar","héctor","víctor",
  "néstor","javiér","félix","luís","eduard","cristhian","cristian","christian",
  "yeison","jhon","jhonatan","jonathan","brayan","kevin","yair","alvaro","álvaro",
]);
const NOMBRES_FEMENINOS = new Set([
  "marcela","marsela","carmen","isabel","beatriz","raquel","ester","esther","ruth",
  "abigail","sarai","damaris","judith","miriam","noemi","noemí","ines","inés",
  "soledad","caridad","mercedes","dolores","pilar","rosario","consuelo","amparo",
  "azucena","jazmin","jazmín","yamileth","yamile","yulieth","yuliana","leidy",
  "yeimy","yenny","yiseth","luz","cruz","trinidad","piedad","libertad",
]);

function generoAnalista(nombre?: string): "F" | "M" {
  const first = primerNombre(nombre).toLowerCase();
  if (!first) return "F";
  if (NOMBRES_MASCULINOS.has(first)) return "M";
  if (NOMBRES_FEMENINOS.has(first)) return "F";
  const last = first[first.length - 1];
  if (last === "a") return "F";
  if (last === "o") return "M";
  return "F";
}

function millonesCOP(n: number): string {
  if (Math.abs(n) >= 1_000_000) {
    const millones = n / 1_000_000;
    const valor = millones >= 100 ? Math.round(millones).toString() : millones.toFixed(1).replace(/\.0$/, "");
    return `$${valor.replace(".", ",")} millones`;
  }
  return formatCOP(n);
}

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
  const recIdx =
    typeof p.recomendadaIndex === "number" &&
    p.recomendadaIndex >= 0 &&
    p.recomendadaIndex < p.propuestas.length
      ? p.recomendadaIndex
      : 0;
  const recomendada = p.propuestas[recIdx];
  const incRecomendado = recomendada
    ? Math.max(0, typeof recomendada.incrementoMensual === "number" ? recomendada.incrementoMensual : recomendada.nuevaCuota - p.cuotaActual)
    : 0;
  const ahorroRecomendado = recomendada ? Math.max(0, recomendada.ahorroTotal) : 0;
  const añosRecomendado = recomendada ? Math.max(0, Math.round(recomendada.añosEliminados)) : 0;
  const honBaseRecomendado = recomendada && typeof recomendada.honorarios === "number" ? recomendada.honorarios : 0;
  const honFinalRecomendado = recomendada && typeof recomendada.honorariosFinal === "number" ? recomendada.honorariosFinal : honBaseRecomendado;
  const hayDescuentoRecomendado = honFinalRecomendado > 0 && honFinalRecomendado < honBaseRecomendado;

  const incrementos = p.propuestas.map((x) =>
    Math.max(0, typeof x.incrementoMensual === "number" ? x.incrementoMensual : x.nuevaCuota - p.cuotaActual),
  );
  const incMin = incrementos.length ? Math.min(...incrementos) : 0;
  const incMax = incrementos.length ? Math.max(...incrementos) : 0;
  const incRange = incMin === incMax ? formatCOP(incMin) : `${formatCOP(incMin)} y ${formatCOP(incMax)}`;

  const años = p.propuestas.map((x) => Math.max(0, Math.round(x.añosEliminados)));
  const añosMin = años.length ? Math.min(...años) : 0;
  const añosMax = años.length ? Math.max(...años) : 0;
  const añosRange = añosMin === añosMax ? `${añosMax} años` : `${añosMin} y ${añosMax} años`;

  const ahorros = p.propuestas.map((x) => Math.max(0, x.ahorroTotal));
  const ahorroLo = ahorros.length ? Math.min(...ahorros) : 0;
  const ahorroHi = ahorros.length ? Math.max(...ahorros) : 0;
  const ahorroRange = ahorroLo === ahorroHi ? millonesCOP(ahorroHi) : `${millonesCOP(ahorroLo)} y ${millonesCOP(ahorroHi)}`;
  const tieneHonorarios = p.propuestas.some((x) => typeof x.honorarios === "number" && x.honorarios > 0);
  const tiempo = tiempoProcesoBanco(p.banco);
  const asesor = (p.asesor || "").trim();
  const genero = generoAnalista(asesor);
  const analistaRol = genero === "M" ? "analista financiero asignado" : "analista financiera asignada";
  const cierre = genero === "M" ? "Quedo atento." : "Quedo atenta.";

  const lines: string[] = [];
  lines.push(`Hola ${nombre} 👋`);
  lines.push("");
  if (asesor) {
    lines.push(`Soy *${nombreAnalista(asesor)}*, tu ${analistaRol} en *NUVEX*.`);
  } else {
    lines.push(`Te escribo desde *NUVEX*, soy tu ${analistaRol}.`);
  }
  lines.push("");
  lines.push(`Revisé tu crédito con *${banco}* y tengo *muy buenas noticias* para ti 🎉`);
  lines.push("");

  if (total > 1) {
    lines.push(`📊 *Panorama general de tu caso:*`);
    lines.push("");
    lines.push(`Encontramos la posibilidad de que puedas *eliminar de tu crédito entre ${añosRange}*, lo que representaría un ahorro aproximado de entre *${ahorroRange}* en intereses y seguros, dependiendo de la alternativa que decidas tomar.`);
    lines.push("");
    lines.push(`Lo anterior lo lograremos con un proceso *jurídico-financiero*, incrementando tu cuota entre *${incRange}* mensuales.`);
    lines.push("");
    lines.push(`Preparé *${total} escenarios diferentes* para ti y hay uno en particular que considero el más conveniente 👇`);
    lines.push("");
  } else {
    lines.push(`Te preparé una propuesta de optimización pensada para tu caso 👇`);
    lines.push("");
  }

  if (recomendada) {
    lines.push(`⭐ *Propuesta sugerida por NUVEX*`);
    lines.push("");
    if (incRecomendado > 0) lines.push(`• Incremento mensual: *${formatCOP(incRecomendado)}*`);
    if (añosRecomendado > 0) lines.push(`• Tiempo eliminado: *${añosRecomendado === 1 ? "1 año" : `${añosRecomendado} años`}*`);
    if (ahorroRecomendado > 0) lines.push(`• Ahorro proyectado: *${millonesCOP(ahorroRecomendado)}*`);
    lines.push("");
  }

  if (tieneHonorarios && recomendada) {
    lines.push(`💰 *Honorarios a éxito*`);
    lines.push("");
    if (hayDescuentoRecomendado && honFinalRecomendado > 0) {
      lines.push(`Si decides avanzar con nosotros, puedo otorgarte un *beneficio por pronta firma*, dejando los honorarios de esta propuesta en *${formatCOP(honFinalRecomendado)}* en lugar de *${formatCOP(honBaseRecomendado)}*.`);
    } else if (honBaseRecomendado > 0) {
      lines.push(`Los honorarios de esta propuesta serían de *${formatCOP(honBaseRecomendado)}*. Si decides avanzar en la llamada, podemos revisar un beneficio por pronta firma.`);
    }
    lines.push("");
    lines.push(`Nuestros honorarios solo se generan si obtenemos el resultado aprobado por el banco. Es decir, si no logramos la optimización, *no pagas nada*. Todo esto queda respaldado por contrato.`);
    lines.push("");
  }

  if (total > 1) {
    lines.push(`Si alguna de las otras alternativas te resulta más atractiva, también podemos revisarla juntos durante la llamada.`);
    lines.push("");
  }

  lines.push(`⏱ *Tiempo estimado del proceso con ${banco}:* entre ${tiempo}.`);
  lines.push("");
  lines.push(`📎 Te envío el PDF con el detalle completo de las propuestas.`);
  lines.push("");
  lines.push(`¿Te gustaría que revisáramos juntos cuál de las alternativas se adapta mejor a tus finanzas?`);
  lines.push("");
  lines.push(`Quedo atent@.`);
  lines.push("");
  lines.push(asesor ? `${nombreAnalista(asesor)}` : `Equipo NUVEX`);
  lines.push(`NUVEX Finanzas Inteligentes`);

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

  const modal = open ? (
    <div
      className="fixed inset-0 z-[2147483647] flex h-[100dvh] items-center justify-center overflow-hidden bg-black/60 p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="relative flex min-h-0 w-full max-w-lg flex-col rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        style={{ height: "min(760px, calc(100dvh - 2rem))" }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="mb-4 flex shrink-0 items-center gap-2 pr-8">
          <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ backgroundColor: "#25D366" }}>
            <MessageCircle size={16} className="text-white" strokeWidth={2.4} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Mensaje para WhatsApp</h3>
        </div>

        <p className="mb-3 shrink-0 text-sm text-gray-500">Copia el texto y pégalo en tu chat de WhatsApp.</p>

        <textarea
          readOnly
          value={message}
          className="mb-4 min-h-0 w-full flex-1 resize-none overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-800 outline-none focus:ring-2 focus:ring-[#25D366]/30"
          onFocus={(e) => e.currentTarget.select()}
        />

        <div className="flex shrink-0 items-center justify-end gap-3">
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
  ) : null;

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

      {modal && typeof document !== "undefined" ? createPortal(modal, document.body) : null}
    </>
  );
}
