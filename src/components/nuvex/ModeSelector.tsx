import { Home, TrendingUp, ArrowRight, MapPin, Building2, Phone, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { NUVEX } from "./constants";

export function ModeSelector({ onPick }: { onPick: (m: "pesos" | "uvr") => void }) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        background: `radial-gradient(1200px 600px at 10% 0%, rgba(68,93,163,0.35), transparent 60%), radial-gradient(900px 500px at 100% 100%, rgba(132,185,143,0.22), transparent 55%), linear-gradient(135deg, #071526 0%, #0B1B2B 50%, #10253A 100%)`,
      }}
    >
      {/* Grid sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Floating orbs animados (estilo Login) */}
      <motion.div
        className="pointer-events-none absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-[120px] opacity-40"
        style={{ background: NUVEX.azul }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full blur-[140px] opacity-30"
        style={{ background: NUVEX.verde }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Red neuronal de fondo */}
      <NeuralCanvas />

      {/* HEADER */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 pt-8 sm:px-10"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
          >
            N
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight text-white">NUVEX</div>
            <div className="-mt-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55">Finanzas Inteligentes</div>
          </div>
        </div>
        <p className="hidden text-xs italic text-white/55 sm:block">
          "El ahorro no es un lujo, es un derecho."
        </p>
      </motion.header>

      {/* CENTRO */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-48 pt-14 sm:px-10 sm:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="text-center"
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border border-[#84B98F]/40 bg-white/[0.04] backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: NUVEX.verde }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: NUVEX.verde }} />
            Acceso licenciados NUVEX
          </div>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
            Simulador{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
            >
              NUVEX
            </span>
            <br className="hidden sm:block" /> de Optimización de Créditos
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/65 sm:text-base">
            Seleccione el tipo de simulador para iniciar la propuesta de optimización financiera.
          </p>
          <div
            className="mx-auto mt-6 h-px w-32 rounded-full"
            style={{ background: `linear-gradient(90deg, transparent, ${NUVEX.azul}, ${NUVEX.verde}, transparent)` }}
          />
        </motion.div>

        {/* TARJETAS con stagger */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.15, delayChildren: 0.35 } },
          }}
          className="mt-12 grid gap-6 md:grid-cols-2"
        >
          <SimCard
            onClick={() => onPick("pesos")}
            color={NUVEX.azul}
            badge="PESOS"
            title="Simulador en Pesos"
            description="Créditos hipotecarios y leasing habitacional denominados en pesos colombianos con o sin beneficio de cobertura."
            Icon={Home}
          />
          <SimCard
            onClick={() => onPick("uvr")}
            color={NUVEX.verde}
            badge="UVR"
            title="Simulador en UVR"
            description="Créditos hipotecarios y leasing habitacional en UVR con proyección de corrección monetaria."
            Icon={TrendingUp}
          />
        </motion.div>
      </main>

      {/* FOOTER FLOTANTE */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="absolute inset-x-0 bottom-4 z-10 px-4 sm:px-8"
      >
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-1 gap-4 text-[12px] text-white/70 md:grid-cols-4 md:divide-x md:divide-white/10">
            <FooterBlock Icon={MapPin} title="Bucaramanga" lines={["Carrera 16 # 37-48 piso 4", "Centro de Bucaramanga"]} />
            <FooterBlock Icon={Building2} title="Bogotá · Aliado Jurídico" lines={["Calle 93 # 18-28 Of. 704", "Bogotá D.C. - Colombia"]} />
            <FooterBlock Icon={Phone} title="Contacto" lines={["+57 316 402 3779"]} />
            <FooterBlock Icon={Globe} title="Web" lines={["www.nuvex.com.co"]} />
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

function SimCard({
  onClick,
  color,
  badge,
  title,
  description,
  Icon,
}: {
  onClick: () => void;
  color: string;
  badge: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <motion.button
      onClick={onClick}
      variants={{
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
      }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      className="group relative block text-left"
    >
      {/* Glow exterior animado */}
      <span
        className="pointer-events-none absolute -inset-0.5 rounded-[32px] opacity-0 blur transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${color}55` }}
      />
      <div className="relative flex h-full flex-col rounded-[32px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-2xl transition-colors duration-300 group-hover:border-white/20 group-hover:bg-white/[0.06] sm:p-10">
        {/* Acento superior */}
        <span
          className="absolute inset-x-8 top-0 h-px opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
        {/* Shimmer en hover */}
        <span
          className="pointer-events-none absolute inset-0 rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background: `radial-gradient(600px circle at 50% -10%, ${color}22, transparent 60%)`,
          }}
        />

        <div className="relative mb-10 flex items-start justify-between">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -2 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border"
            style={{ background: `${color}1A`, borderColor: `${color}33`, color }}
          >
            <Icon className="h-6 w-6" strokeWidth={1.8} />
          </motion.div>
          <span
            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ background: `${color}1A`, borderColor: `${color}55`, color }}
          >
            {badge}
          </span>
        </div>

        <h2 className="relative text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
          {title}
        </h2>
        <p className="relative mt-3 flex-grow text-sm leading-relaxed text-white/55">
          {description}
        </p>

        <div className="relative mt-10 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70 transition-colors group-hover:text-white">
            Iniciar simulación
          </span>
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-transform duration-300 group-hover:translate-x-1 group-hover:scale-110"
            style={{ background: color, boxShadow: `0 12px 32px -10px ${color}` }}
          >
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function FooterBlock({
  Icon,
  title,
  lines,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  lines: string[];
}) {
  return (
    <div className="flex items-start gap-3 px-0 md:px-4 first:md:pl-0">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/80">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50">{title}</div>
        {lines.map((l) => (
          <div key={l} className="truncate text-white/80">{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Red neuronal de fondo (idéntica al Login) ---------- */
function NeuralCanvas() {
  const nodes = [
    { x: 12, y: 22 }, { x: 28, y: 14 }, { x: 44, y: 28 }, { x: 62, y: 18 }, { x: 80, y: 32 },
    { x: 18, y: 48 }, { x: 36, y: 56 }, { x: 54, y: 44 }, { x: 72, y: 58 }, { x: 88, y: 50 },
    { x: 22, y: 76 }, { x: 40, y: 84 }, { x: 58, y: 72 }, { x: 76, y: 86 }, { x: 90, y: 74 },
  ];
  const links: Array<[number, number]> = [
    [0,1],[1,2],[2,3],[3,4],[0,5],[1,6],[2,7],[3,8],[4,9],
    [5,6],[6,7],[7,8],[8,9],[5,10],[6,11],[7,12],[8,13],[9,14],
    [10,11],[11,12],[12,13],[13,14],[2,8],[1,7],[6,12],[7,13],
  ];
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      aria-hidden
    >
      <defs>
        <linearGradient id="mode-nv-link" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={NUVEX.azul} stopOpacity="0.55" />
          <stop offset="100%" stopColor={NUVEX.verde} stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="mode-nv-node">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="60%" stopColor={NUVEX.verde} stopOpacity="0.7" />
          <stop offset="100%" stopColor={NUVEX.azul} stopOpacity="0" />
        </radialGradient>
        <filter id="mode-nv-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <g filter="url(#mode-nv-glow)">
        {links.map(([a, b], i) => {
          const A = nodes[a]; const B = nodes[b];
          return (
            <line
              key={i}
              x1={A.x} y1={A.y} x2={B.x} y2={B.y}
              stroke="url(#mode-nv-link)"
              strokeWidth="0.18"
              opacity={0.5}
            >
              <animate attributeName="opacity" values="0.15;0.7;0.15" dur={`${4 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
      </g>

      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="1.6" fill="url(#mode-nv-node)">
            <animate attributeName="r" values="1.2;2;1.2" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;1;0.6" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
          </circle>
          <circle cx={n.x} cy={n.y} r="0.5" fill="#fff" opacity="0.9" />
        </g>
      ))}

      {links.slice(0, 8).map(([a, b], i) => {
        const A = nodes[a]; const B = nodes[b];
        return (
          <circle key={`p${i}`} r="0.55" fill={NUVEX.verde} opacity="0.95">
            <animate attributeName="cx" values={`${A.x};${B.x}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`${A.y};${B.y}`} dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${3 + (i % 3)}s`} repeatCount="indefinite" />
          </circle>
        );
      })}
    </svg>
  );
}
