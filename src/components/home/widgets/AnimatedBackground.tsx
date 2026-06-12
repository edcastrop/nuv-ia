import { motion } from "framer-motion";

const BLUE = "#445DA3";
const GREEN = "#84B98F";

/**
 * AnimatedBackground — fondo NUVIA animado al estilo del login.
 * Orbes flotantes con framer-motion + red neuronal SVG.
 * Debe ir dentro de un contenedor `relative overflow-hidden`.
 */
export function AnimatedBackground() {
  return (
    <>
      {/* Capa base con gradientes radiales */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1100px 700px at 20% 10%, rgba(68,93,163,0.32), transparent 60%), radial-gradient(900px 600px at 90% 90%, rgba(132,185,143,0.26), transparent 55%), linear-gradient(160deg, #0A0B10 0%, #0F121C 55%, #0A0B10 100%)",
        }}
      />

      {/* Grid sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      {/* Orbes flotantes animados (framer-motion) */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-[120px] opacity-50"
        style={{ background: BLUE }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-20 right-[-10rem] h-[26rem] w-[26rem] rounded-full blur-[120px] opacity-40"
        style={{ background: GREEN }}
        animate={{ x: [0, -50, 0], y: [0, 25, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute top-[40%] left-[35%] h-[24rem] w-[24rem] rounded-full blur-[130px] opacity-35"
        style={{ background: "#705AB8" }}
        animate={{ x: [0, 60, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-[-10rem] right-[10%] h-[22rem] w-[22rem] rounded-full blur-[120px] opacity-30"
        style={{ background: "#C9A84C" }}
        animate={{ x: [0, -40, 0], y: [0, -30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Red neuronal SVG animada */}
      <NeuralCanvas />
    </>
  );
}

function NeuralCanvas() {
  const nodes = [
    { x: 8, y: 18 }, { x: 22, y: 10 }, { x: 38, y: 24 }, { x: 56, y: 14 }, { x: 74, y: 28 }, { x: 92, y: 16 },
    { x: 14, y: 42 }, { x: 32, y: 50 }, { x: 50, y: 38 }, { x: 68, y: 52 }, { x: 86, y: 44 },
    { x: 18, y: 70 }, { x: 36, y: 78 }, { x: 54, y: 66 }, { x: 72, y: 80 }, { x: 90, y: 68 },
    { x: 26, y: 92 }, { x: 48, y: 96 }, { x: 70, y: 92 },
  ];
  const links: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,4],[4,5],
    [0,6],[1,7],[2,8],[3,9],[4,10],[5,10],
    [6,7],[7,8],[8,9],[9,10],
    [6,11],[7,12],[8,13],[9,14],[10,15],
    [11,12],[12,13],[13,14],[14,15],
    [11,16],[12,17],[13,17],[14,18],[15,18],
    [2,8],[8,13],[3,9],[9,14],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 w-full h-full opacity-70"
      aria-hidden
    >
      <defs>
        <linearGradient id="nv-home-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={BLUE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={GREEN} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="nv-home-node">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="60%" stopColor={GREEN} stopOpacity="0.7" />
          <stop offset="100%" stopColor={BLUE} stopOpacity="0" />
        </radialGradient>
        <filter id="nv-home-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter="url(#nv-home-glow)">
        {links.map(([a, b], i) => {
          const A = nodes[a]; const B = nodes[b];
          return (
            <line
              key={i}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="url(#nv-home-link)"
              strokeWidth="0.16"
              opacity={0.45}
            >
              <animate attributeName="opacity" values="0.1;0.65;0.1" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>

      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="1.4" fill="url(#nv-home-node)">
            <animate attributeName="r" values="1.0;1.9;1.0" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.55;1;0.55" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy={n.y} r="0.45" fill="#fff" opacity="0.9" />
        </g>
      ))}

      {links.slice(0, 10).map(([a, b], i) => {
        const A = nodes[a]; const B = nodes[b];
        return (
          <circle key={`p${i}`} r="0.5" fill={GREEN} opacity="0.95">
            <animate attributeName="cx" values={`${A.x};${B.x}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${A.y};${B.y}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </svg>
  );
}
