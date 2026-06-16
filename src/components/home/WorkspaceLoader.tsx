/**
 * WorkspaceLoader — splash de carga del workspace NUVIA.
 * Animación dopamina: anillos orbitales, monograma "N" respirando,
 * barra de progreso con shimmer y micro-status rotativo.
 * Distinta de la red neuronal usada en login/registro/home.
 */
import { useEffect, useState } from "react";

const BLUE = "#445DA3";
const GREEN = "#84B98F";
const PURPLE = "#705AB8";

const STATUSES = [
  "Sincronizando expedientes",
  "Cargando políticas de banco",
  "Calibrando NUVEX IA",
  "Preparando tu tablero",
  "Listo en un instante",
];

export function WorkspaceLoader({ label = "Cargando tu workspace NUVIA" }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % STATUSES.length), 1400);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative min-h-[70vh] w-full overflow-hidden flex items-center justify-center"
      style={{
        background:
          "radial-gradient(900px 600px at 30% 20%, rgba(68,93,163,0.25), transparent 60%), radial-gradient(700px 500px at 80% 80%, rgba(132,185,143,0.18), transparent 55%), linear-gradient(160deg, #0A0B10 0%, #0F121C 55%, #0A0B10 100%)",
      }}
    >
      {/* Halo grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-7">
        {/* Núcleo: anillos orbitales + monograma */}
        <div className="relative h-44 w-44">
          {/* Ondas expansivas */}
          <span className="nv-wl-ripple" />
          <span className="nv-wl-ripple nv-wl-ripple--2" />
          <span className="nv-wl-ripple nv-wl-ripple--3" />

          {/* Anillo cónico giratorio */}
          <div
            className="absolute inset-0 rounded-full nv-wl-conic"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, ${GREEN} 60deg, ${BLUE} 180deg, ${PURPLE} 280deg, transparent 360deg)`,
              maskImage:
                "radial-gradient(circle, transparent 56%, black 58%, black 70%, transparent 72%)",
              WebkitMaskImage:
                "radial-gradient(circle, transparent 56%, black 58%, black 70%, transparent 72%)",
              filter: "blur(0.4px)",
            }}
          />

          {/* Anillo punteado contrarotación */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full nv-wl-counter"
            aria-hidden
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.6"
              strokeDasharray="1 4"
            />
          </svg>

          {/* Órbitas con satélites */}
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full nv-wl-orbit"
            aria-hidden
          >
            <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(132,185,143,0.18)" strokeWidth="0.4" />
            <circle cx="88" cy="50" r="2.2" fill={GREEN}>
              <animate attributeName="r" values="1.8;2.8;1.8" dur="2.4s" repeatCount="indefinite" />
            </circle>
          </svg>
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 h-full w-full nv-wl-orbit-rev"
            aria-hidden
          >
            <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(68,93,163,0.22)" strokeWidth="0.4" />
            <circle cx="20" cy="50" r="1.6" fill={BLUE}>
              <animate attributeName="r" values="1.2;2.2;1.2" dur="3.1s" repeatCount="indefinite" />
            </circle>
          </svg>

          {/* Núcleo cristal con "N" */}
          <div
            className="absolute inset-[28%] rounded-full flex items-center justify-center nv-wl-core"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 60%, rgba(0,0,0,0.2))",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow:
                "0 0 30px rgba(132,185,143,0.35), inset 0 0 18px rgba(68,93,163,0.4)",
              backdropFilter: "blur(6px)",
            }}
          >
            <span
              className="text-[28px] font-semibold tracking-tight"
              style={{
                background: `linear-gradient(135deg, #fff 0%, ${GREEN} 60%, ${BLUE} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              N
            </span>
          </div>
        </div>

        {/* Label principal + shimmer */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="nv-wl-shimmer text-[15px] font-medium tracking-wide"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
            {label}
          </div>
          <div
            key={i}
            className="text-[12px] tracking-wide uppercase nv-wl-fadein"
            style={{ color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em" }}
          >
            {STATUSES[i]}
          </div>
        </div>

        {/* Barra de progreso indeterminada */}
        <div
          className="relative h-[3px] w-[260px] overflow-hidden rounded-full"
          style={{ background: "rgba(255,255,255,0.08)" }}
        >
          <div
            className="absolute inset-y-0 left-0 w-1/3 rounded-full nv-wl-bar"
            style={{
              background: `linear-gradient(90deg, transparent, ${GREEN}, ${BLUE}, transparent)`,
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes nv-wl-spin { to { transform: rotate(360deg); } }
        @keyframes nv-wl-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes nv-wl-ripple {
          0% { transform: scale(0.35); opacity: 0.55; }
          80% { opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes nv-wl-bar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
        @keyframes nv-wl-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes nv-wl-core {
          0%,100% { transform: scale(1); box-shadow: 0 0 30px rgba(132,185,143,0.35), inset 0 0 18px rgba(68,93,163,0.4); }
          50% { transform: scale(1.06); box-shadow: 0 0 46px rgba(132,185,143,0.55), inset 0 0 22px rgba(68,93,163,0.55); }
        }
        @keyframes nv-wl-fadein {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .nv-wl-conic { animation: nv-wl-spin 4.5s linear infinite; }
        .nv-wl-counter { animation: nv-wl-spin-rev 22s linear infinite; }
        .nv-wl-orbit { animation: nv-wl-spin 7s linear infinite; transform-origin: 50% 50%; }
        .nv-wl-orbit-rev { animation: nv-wl-spin-rev 9s linear infinite; transform-origin: 50% 50%; }
        .nv-wl-core { animation: nv-wl-core 2.8s ease-in-out infinite; }
        .nv-wl-bar { animation: nv-wl-bar 1.6s cubic-bezier(.4,0,.2,1) infinite; }
        .nv-wl-fadein { animation: nv-wl-fadein 0.45s ease-out both; }

        .nv-wl-ripple {
          position: absolute; inset: 0; border-radius: 9999px;
          border: 1px solid rgba(132,185,143,0.5);
          animation: nv-wl-ripple 2.6s ease-out infinite;
        }
        .nv-wl-ripple--2 { animation-delay: 0.85s; border-color: rgba(68,93,163,0.5); }
        .nv-wl-ripple--3 { animation-delay: 1.7s; border-color: rgba(112,90,184,0.45); }

        .nv-wl-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.55) 0%, #fff 50%, rgba(255,255,255,0.55) 100%);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: nv-wl-shimmer 2.4s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .nv-wl-conic, .nv-wl-counter, .nv-wl-orbit, .nv-wl-orbit-rev,
          .nv-wl-core, .nv-wl-bar, .nv-wl-shimmer, .nv-wl-ripple { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
