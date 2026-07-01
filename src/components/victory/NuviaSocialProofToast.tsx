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

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function SocialProofCard({ caso, closing, onClose }: { caso: Caso; closing: boolean; onClose: () => void }) {
  return createPortal(
    <div
      style={{
        position: "fixed", bottom: 32, right: 32, zIndex: 2147483590,
        width: 410, maxWidth: "calc(100vw - 40px)",
      }}
      className="nuvia-social-proof-anchor"
    >
      <style>{`
        @keyframes nuviaSpSlideIn {
          from { transform: translateX(120%) scale(.98); opacity: 0; }
          to   { transform: translateX(0) scale(1); opacity: 1; }
        }
        @keyframes nuviaSpSlideOut {
          from { transform: translateX(0) scale(1); opacity: 1; }
          to   { transform: translateX(120%) scale(.98); opacity: 0; }
        }
        @keyframes nuviaSpShine {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes nuviaSpPulse {
          0%, 100% { opacity: .55; }
          50%      { opacity: 1; }
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
          minHeight: 138,
          padding: "16px 18px 16px 16px",
          borderRadius: 20,
          background:
            "linear-gradient(160deg, rgba(19,27,51,.94) 0%, rgba(13,18,36,.96) 60%, rgba(5,8,22,.98) 100%)",
          border: "1px solid rgba(255,255,255,.08)",
          color: "#E7EEFB",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
          backdropFilter: "blur(22px) saturate(140%)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(68,93,163,.14), 0 0 40px rgba(132,185,143,.10)",
          animation: closing
            ? "nuviaSpSlideOut .28s ease-in forwards"
            : "nuviaSpSlideIn .42s cubic-bezier(.2,1,.3,1)",
          overflow: "hidden",
        }}
      >
        {/* Top gradient border · NUVIA blue → green */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, #445DA3, #84B98F, transparent)",
        }} />
        {/* Ambient corner glows */}
        <div style={{
          position: "absolute", top: -40, right: -40, width: 160, height: 160,
          background: "radial-gradient(circle, rgba(132,185,143,.16), transparent 70%)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: -50, left: -50, width: 180, height: 180,
          background: "radial-gradient(circle, rgba(68,93,163,.14), transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Subtle shine sweep */}
        <div style={{
          position: "absolute", top: 0, left: 0, width: "40%", height: "100%",
          background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,.05) 50%, transparent 70%)",
          animation: "nuviaSpShine 3.2s ease-in-out .4s 1",
          pointerEvents: "none",
        }} />

        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute", top: 10, right: 10,
            background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)",
            color: "#8397B8", borderRadius: 8, width: 22, height: 22, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .18s ease", zIndex: 2,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.10)"; e.currentTarget.style.color = "#E7EEFB"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.color = "#8397B8"; }}
        >
          <X size={11} strokeWidth={2.5} />
        </button>

        {/* Badge NUVIA */}
        <div style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: "linear-gradient(90deg, rgba(132,185,143,.14), rgba(68,93,163,.14))",
          border: "1px solid rgba(132,185,143,.30)",
          fontSize: 9.5, fontWeight: 700, color: "#B8E1C1",
          letterSpacing: 0.6, textTransform: "uppercase",
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%", background: "#84B98F",
            boxShadow: "0 0 8px #84B98F", animation: "nuviaSpPulse 1.8s ease-in-out infinite",
          }} />
          Optimizado por NUVEX
        </div>

        {/* Cliente */}
        <div style={{ position: "relative", marginTop: 11, display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #445DA3, #84B98F)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 800, color: "#fff",
            letterSpacing: 0.3,
            boxShadow: "0 4px 14px rgba(68,93,163,.35), inset 0 1px 0 rgba(255,255,255,.18)",
          }}>
            {initials(caso.nombre)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "#FFFFFF", letterSpacing: -0.1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {caso.nombre}
            </div>
            <div style={{ fontSize: 11, color: "#8397B8", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
              <span>{caso.ciudad}</span>
              <span style={{ opacity: .4 }}>·</span>
              <span style={{
                display: "inline-block", padding: "1.5px 7px", borderRadius: 5,
                background: "rgba(68,93,163,.16)", border: "1px solid rgba(68,93,163,.30)",
                color: "#BCD0FF", fontSize: 10, fontWeight: 600, letterSpacing: 0.1,
              }}>{caso.banco}</span>
            </div>
          </div>
        </div>

        {/* KPI grid */}
        <div style={{
          position: "relative",
          marginTop: 12,
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        }}>
          <div style={{
            padding: "8px 10px", borderRadius: 11,
            background: "linear-gradient(160deg, rgba(68,93,163,.14), rgba(68,93,163,.06))",
            border: "1px solid rgba(68,93,163,.28)",
          }}>
            <div style={{ fontSize: 9, color: "#8397B8", fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Clock3 size={10} /> Recuperó
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#BCD0FF", marginTop: 2, letterSpacing: -0.2 }}>
              {caso.tiempo}
            </div>
          </div>
          <div style={{
            padding: "8px 10px", borderRadius: 11,
            background: "linear-gradient(160deg, rgba(132,185,143,.16), rgba(132,185,143,.06))",
            border: "1px solid rgba(132,185,143,.30)",
          }}>
            <div style={{ fontSize: 9, color: "#8397B8", fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <TrendingUp size={10} /> Ahorró
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#B8E1C1", marginTop: 2, letterSpacing: -0.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {fmtMoney(caso.dinero)}
            </div>
          </div>
        </div>

        {/* Testimonio */}
        <div style={{
          position: "relative",
          marginTop: 11, paddingLeft: 10,
          borderLeft: "2px solid rgba(132,185,143,.35)",
          fontSize: 11.5, color: "#C9D5EA", lineHeight: 1.42,
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
