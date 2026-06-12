import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Wrench, Sparkles, LineChart, ArrowRight, ShieldCheck, FileBarChart } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated/herramientas/")({
  head: () => ({
    meta: [
      { title: "Herramientas NUVEX" },
      { name: "description", content: "Motor de análisis de capacidad de pago y proyección financiera sin crear caso." },
    ],
  }),
  component: HerramientasLanding,
});

function NeuralBg() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(68,93,163,0.35), transparent 55%), radial-gradient(circle at 80% 85%, rgba(132,185,143,0.28), transparent 55%)",
        }}
      />
      <motion.div
        className="pointer-events-none absolute top-[-10rem] left-[-8rem] h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NUVEX.azul}, transparent 70%)`, opacity: 0.55 }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[-10rem] right-[-8rem] h-[40rem] w-[40rem] rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NUVEX.verde}, transparent 70%)`, opacity: 0.5 }}
        animate={{ x: [0, -70, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-1/3 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, #9333EA, transparent 70%)`, opacity: 0.25 }}
        animate={{ x: [-40, 40, -40], y: [-20, 20, -20] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Neural canvas SVG */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-50" preserveAspectRatio="none">
        <defs>
          <linearGradient id="herr-link" x1="0" x2="1">
            <stop offset="0%" stopColor={NUVEX.azul} />
            <stop offset="100%" stopColor={NUVEX.verde} />
          </linearGradient>
        </defs>
        {Array.from({ length: 26 }).map((_, i) => {
          const x1 = (i * 137) % 100;
          const y1 = (i * 71) % 100;
          const x2 = (x1 + 17 + (i % 7) * 4) % 100;
          const y2 = (y1 + 23 + (i % 5) * 5) % 100;
          return (
            <line
              key={`l${i}`}
              x1={`${x1}%`}
              y1={`${y1}%`}
              x2={`${x2}%`}
              y2={`${y2}%`}
              stroke="url(#herr-link)"
              strokeWidth="0.6"
            >
              <animate attributeName="opacity" values="0.2;0.9;0.2" dur={`${5 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
        {Array.from({ length: 34 }).map((_, i) => {
          const cx = (i * 53) % 100;
          const cy = (i * 89) % 100;
          return (
            <circle key={`n${i}`} cx={`${cx}%`} cy={`${cy}%`} r="1.6" fill={i % 2 === 0 ? NUVEX.azul : NUVEX.verde}>
              <animate attributeName="r" values="1.4;3;1.4" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;1;0.4" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>
    </>
  );
}

function HerramientasLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white flex flex-col">
      <NeuralBg />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-10 flex-1 flex flex-col justify-center gap-10">

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, rgba(68,93,163,0.85), rgba(132,185,143,0.85))",
              boxShadow: `0 16px 40px -16px ${NUVEX.verde}`,
            }}
          >
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] font-bold text-[#84B98F] whitespace-nowrap">
              <Sparkles size={11} className="shrink-0" /> NUVIA · Motores
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">Herramientas NUVEX</h1>
          </div>
        </motion.header>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.15, delayChildren: 0.25 } },
          }}
          className="grid gap-6 md:grid-cols-2"
        >
          <ToolCard
            to="/herramientas/capacidad-pago"
            title="Capacidad de pago"
            Icon={ShieldCheck}
            tagline="Regla 30% / 40% VIS"
            description="Calcula al instante el % de endeudamiento con IA — sin crear expediente."
          />
          <ToolCard
            to="/herramientas/proyeccion"
            title="Proyección financiera"
            Icon={LineChart}
            tagline="Lectura IA + escenarios"
            description="Lee cualquier extracto y compara escenarios con abonos o renegociación."
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-5"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#84B98F] mt-0.5" />
            <div className="text-sm text-white/65">
              <b className="text-white">Tip:</b> usa estas herramientas para validar viabilidad antes de crear el caso. Puedes convertir la simulación en expediente con un clic.
            </div>
          </div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.8 } } }}
          className="grid gap-3 md:grid-cols-3 text-xs text-white/40"
        >
          <Meta Icon={FileBarChart} title="Gemini 2.5 Pro" sub="Lectura de extractos y nóminas" />
          <Meta Icon={ShieldCheck} title="Superfinanciera" sub="30% No VIS · 40% VIS" />
          <Meta Icon={LineChart} title="Mes a mes" sub="Amortización completa" />
        </motion.div>
      </div>
    </div>
  );
}

function ToolCard({
  to,
  title,
  Icon,
  tagline,
  description,
}: {
  to: string;
  title: string;
  Icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  description: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 24, scale: 0.97 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: "easeOut" } },
      }}
      whileHover={{ y: -6 }}
    >
      <Link
        to={to}
        className="group relative block overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-2xl transition-colors duration-500 hover:bg-white/[0.06]"
        style={{ boxShadow: "0 30px 60px -40px rgba(0,0,0,0.9)" }}
      >
        <span
          className="pointer-events-none absolute inset-x-8 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.6), transparent)" }}
        />
        <span
          className="pointer-events-none absolute -inset-px rounded-[32px] opacity-0 transition-opacity duration-500 group-hover:opacity-100 blur-xl"
          style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.25), rgba(132,185,143,0.25))" }}
        />
        <div className="relative">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -2 }}
            className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.85), rgba(132,185,143,0.85))" }}
          >
            <Icon className="h-6 w-6 text-white" />
          </motion.div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#84B98F]">{tagline}</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p>
          <div className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/80 group-hover:text-white">
            Abrir herramienta <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Meta({ Icon, title, sub }: { Icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-xl p-3"
    >
      <Icon className="h-4 w-4 text-white/50" />
      <div>
        <div className="text-[12px] font-medium text-white/70">{title}</div>
        <div className="text-[10.5px] text-white/40">{sub}</div>
      </div>
    </motion.div>
  );
}
