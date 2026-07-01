import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Sparkles, X, Clock3, TrendingUp } from "lucide-react";

/* -------------------------------- Casos ---------------------------------- */

interface Caso {
  nombre: string;
  ciudad: string;
  banco: string;
  tiempo: string;
  dinero: number;
  testimonio: string;
}

const CASOS: Caso[] = [
  { nombre: "María Fernanda Ríos",    ciudad: "Bogotá",       banco: "Bancolombia",        tiempo: "4 años", dinero:  86_400_000, testimonio: "Gracias a NUVEX me ahorré casi 86 millones en intereses y me quitaron 4 años del crédito." },
  { nombre: "Carlos Andrés Mejía",    ciudad: "Medellín",     banco: "Davivienda",         tiempo: "5 años", dinero: 112_700_000, testimonio: "Con NUVEX entendí mi crédito por primera vez... y terminé pagando 112 millones menos." },
  { nombre: "Laura Camila Torres",    ciudad: "Bucaramanga",  banco: "Banco de Bogotá",    tiempo: "3 años", dinero:  64_900_000, testimonio: "Nunca imaginé que iba a recuperar 3 años y casi 65 millones sin cambiar de banco." },
  { nombre: "Juan Sebastián Gómez",   ciudad: "Cali",         banco: "Banco Popular",      tiempo: "6 años", dinero: 138_200_000, testimonio: "NUVEX me mostró cómo salir 6 años antes del crédito y ahorrarme más de 138 millones." },
  { nombre: "Paola Andrea Vargas",    ciudad: "Barranquilla", banco: "Davivienda",         tiempo: "4 años", dinero:  91_300_000, testimonio: "Sentí que por fin alguien defendía mi bolsillo. Me ahorré 91 millones y 4 años de cuotas." },
  { nombre: "Andrés Felipe Duarte",   ciudad: "Cúcuta",       banco: "Banco de Occidente", tiempo: "2 años", dinero:  42_800_000, testimonio: "Con NUVEX me quitaron 2 años del crédito y 42 millones que hubieran sido puro interés." },
  { nombre: "Juliana Marcela Peña",   ciudad: "Pereira",      banco: "Caja Social",        tiempo: "3 años", dinero:  58_600_000, testimonio: "Yo pensaba que ya no había nada que hacer. NUVEX me devolvió 3 años y 58 millones." },
  { nombre: "Ricardo Alfonso Bernal", ciudad: "Cartagena",    banco: "AV Villas",          tiempo: "5 años", dinero: 104_500_000, testimonio: "Ahorré 104 millones en intereses y recorté 5 años. Ojalá lo hubiera hecho antes." },
  { nombre: "Natalia Sofía Herrera",  ciudad: "Manizales",    banco: "Davibank",           tiempo: "4 años", dinero:  79_200_000, testimonio: "NUVEX me ahorró 79 millones y me sacó del crédito 4 años antes. Increíble." },
  { nombre: "Diego Alejandro Prieto", ciudad: "Ibagué",       banco: "FNA",                tiempo: "6 años", dinero: 126_900_000, testimonio: "Con NUVEX terminé pagando 126 millones menos y salí del crédito 6 años antes de lo previsto." },
];

const COOLDOWN_KEY = "nuvia:landing-social-proof:cooldown-until:v2";
const COOLDOWN_MS = 10 * 60 * 1000; // 10 min
const VISIBLE_MS = 8_000;
const MIN_GAP_MS = 18_000;
const MAX_GAP_MS = 35_000;
const FIRST_APPEAR_MS = 2_200;

function fmtMoney(v: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function readCooldown(): number {
  try {
    if (typeof window === "undefined") return 0;
    const v = Number(window.localStorage.getItem(COOLDOWN_KEY) ?? "0");
    return Number.isFinite(v) ? v : 0;
  } catch { return 0; }
}
function setCooldown(until: number) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COOLDOWN_KEY, String(until));
  } catch { /* noop */ }
}

/* ----------------------------- Toast Item -------------------------------- */

function SocialProofCard({ caso, closing, onClose }: { caso: Caso; closing: boolean; onClose: () => void }) {
  return createPortal(
    <div
      style={{
        position: "fixed", bottom: 32, left: 32, zIndex: 2147483590,
        width: 390, maxWidth: "calc(100vw - 40px)",
      }}
      className="nuvia-social-proof-anchor"
    >
      <style>{`
        @keyframes nuviaSpSlideIn {
          from { transform: translateX(-120%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes nuviaSpSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to   { transform: translateX(-120%); opacity: 0; }
        }
        @media (max-width: 640px) {
          .nuvia-social-proof-anchor {
            left: 50% !important;
            right: auto !important;
            transform: translateX(-50%);
            bottom: 16px !important;
            width: calc(100vw - 24px) !important;
          }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "relative",
          minHeight: 130,
          padding: "14px 16px 14px 14px",
          borderRadius: 16,
          background: "linear-gradient(155deg, rgba(14,24,44,.94), rgba(9,16,32,.96))",
          border: "1px solid rgba(255,255,255,.10)",
          color: "#E7EEFB",
          fontFamily: "Inter, ui-sans-serif, system-ui",
          backdropFilter: "blur(14px)",
          boxShadow: "0 18px 50px rgba(0,0,0,.45), 0 0 0 1px rgba(77,124,254,.18), 0 0 30px rgba(46,204,113,.14)",
          animation: closing
            ? "nuviaSpSlideOut .25s ease-in forwards"
            : "nuviaSpSlideIn .35s cubic-bezier(.2,1,.3,1)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 8, right: 8,
            background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.10)",
            color: "#B9C6DE", borderRadius: 8, padding: 4, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X size={12} />
        </button>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 999,
          background: "linear-gradient(90deg, rgba(46,204,113,.22), rgba(77,124,254,.18))",
          border: "1px solid rgba(46,204,113,.4)",
          fontSize: 10, fontWeight: 700, color: "#9BE8B8", letterSpacing: 0.4,
        }}>
          <CheckCircle2 size={10} /> Caso optimizado
        </div>

        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(77,124,254,.24), rgba(46,204,113,.18))",
            border: "1px solid rgba(255,255,255,.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={14} color="#9BE8B8" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 13.5, fontWeight: 800, color: "#FFFFFF",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {caso.nombre}
            </div>
            <div style={{ fontSize: 11, color: "#8397B8", marginTop: 1 }}>
              {caso.ciudad} · <span style={{
                display: "inline-block", padding: "1px 6px", borderRadius: 6,
                background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.08)",
                color: "#B9C6DE", fontSize: 10, fontWeight: 600,
              }}>{caso.banco}</span>
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 10,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <div style={{
            padding: "7px 9px", borderRadius: 10,
            background: "rgba(77,124,254,.10)", border: "1px solid rgba(77,124,254,.30)",
          }}>
            <div style={{ fontSize: 9.5, color: "#8397B8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock3 size={10} /> Recuperó
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#BCD0FF", marginTop: 1 }}>
              {caso.tiempo}
            </div>
          </div>
          <div style={{
            padding: "7px 9px", borderRadius: 10,
            background: "rgba(46,204,113,.10)", border: "1px solid rgba(46,204,113,.30)",
          }}>
            <div style={{ fontSize: 9.5, color: "#8397B8", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={10} /> Ahorró
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#9BE8B8", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmtMoney(caso.dinero)}
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 9, fontSize: 11.5, color: "#C9D5EA", lineHeight: 1.35,
          fontStyle: "italic",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          "{caso.testimonio}"
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Provider --------------------------------- */

export function NuviaSocialProofToast() {
  const [current, setCurrent] = useState<Caso | null>(null);
  const [closing, setClosing] = useState(false);
  const idxRef = useRef<number>(Math.floor(Math.random() * CASOS.length));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = useMemo(() => () => {
    const cooldownUntil = readCooldown();
    const now = Date.now();
    const base = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS);
    const delay = Math.max(base, cooldownUntil - now);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      idxRef.current = (idxRef.current + 1) % CASOS.length;
      setClosing(false);
      setCurrent(CASOS[idxRef.current]);
    }, delay);
  }, []);

  useEffect(() => {
    // Primer disparo rápido en landing: el ciclo random queda para los siguientes.
    const first = setTimeout(() => {
      if (readCooldown() > Date.now()) {
        scheduleNext();
        return;
      }
      setClosing(false);
      setCurrent(CASOS[idxRef.current]);
    }, FIRST_APPEAR_MS);
    return () => {
      clearTimeout(first);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [scheduleNext]);

  useEffect(() => {
    if (!current) return;
    const closeStart = setTimeout(() => setClosing(true), VISIBLE_MS);
    const dequeue = setTimeout(() => {
      setCurrent(null);
      setClosing(false);
      scheduleNext();
    }, VISIBLE_MS + 280);
    return () => { clearTimeout(closeStart); clearTimeout(dequeue); };
  }, [current, scheduleNext]);

  const closeNow = () => {
    setClosing(true);
    setCooldown(Date.now() + COOLDOWN_MS);
    setTimeout(() => {
      setCurrent(null);
      setClosing(false);
      scheduleNext();
    }, 260);
  };

  if (!current) return null;
  return <SocialProofCard caso={current} closing={closing} onClose={closeNow} />;
}
