import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Sparkles,
  LineChart,
  ArrowRight,
  ShieldCheck,
  Calculator,
  DollarSign,
  TrendingUp,
  Bell,
  PiggyBank,
  Gauge,
  Activity,
  Cpu,
  Scale,
  Users,
  GitBranch,
} from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated/herramientas/")({
  head: () => ({
    meta: [
      { title: "Herramientas NUVEX" },
      { name: "description", content: "Command center de motores inteligentes NUVIA: capacidad de pago, proyección financiera y amortización." },
    ],
  }),
  component: HerramientasLanding,
});

/* -------------------------------------------------------------------------- */
/*  Background — profundidad + partículas suaves                              */
/* -------------------------------------------------------------------------- */

function CommandBg() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 15% 10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(70% 55% at 85% 90%, rgba(132,185,143,0.22), transparent 60%), radial-gradient(50% 40% at 50% 40%, rgba(123,97,255,0.14), transparent 65%)",
        }}
      />
      {/* subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
      />
      {/* floating particles */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {Array.from({ length: 18 }).map((_, i) => {
          const cx = (i * 53) % 100;
          const cy = (i * 89) % 100;
          const dur = 4 + (i % 5);
          return (
            <circle
              key={i}
              cx={`${cx}%`}
              cy={`${cy}%`}
              r={1.2}
              fill={i % 2 === 0 ? NUVEX.azul : NUVEX.verde}
              opacity={0.6}
            >
              <animate attributeName="opacity" values="0.15;0.9;0.15" dur={`${dur}s`} repeatCount="indefinite" />
              <animate attributeName="r" values="0.8;2.2;0.8" dur={`${dur}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Orb holográfico + mini cards flotantes                                    */
/* -------------------------------------------------------------------------- */

function HeroOrb() {
  const mini = [
    { Icon: DollarSign, x: "8%", y: "18%", delay: 0 },
    { Icon: TrendingUp, x: "78%", y: "10%", delay: 0.4 },
    { Icon: Calculator, x: "82%", y: "62%", delay: 0.8 },
    { Icon: Gauge, x: "6%", y: "68%", delay: 1.2 },
    { Icon: PiggyBank, x: "42%", y: "0%", delay: 1.6 },
    { Icon: Bell, x: "46%", y: "82%", delay: 2 },
  ];
  return (
    <div className="relative h-[340px] w-full">
      {/* halos */}
      <div
        className="absolute inset-0 rounded-[32px]"
        style={{
          background:
            "radial-gradient(50% 50% at 50% 50%, rgba(68,93,163,0.35), transparent 70%)",
        }}
      />
      {/* orbit rings */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 340" fill="none">
        <defs>
          <linearGradient id="ring" x1="0" x2="1">
            <stop offset="0%" stopColor={NUVEX.azul} stopOpacity="0.7" />
            <stop offset="100%" stopColor={NUVEX.verde} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {[70, 110, 150].map((r, i) => (
          <ellipse
            key={i}
            cx="200"
            cy="170"
            rx={r + 30}
            ry={r * 0.42}
            stroke="url(#ring)"
            strokeWidth="0.7"
            strokeDasharray="2 6"
            opacity={0.55 - i * 0.12}
          />
        ))}
      </svg>

      {/* central orb */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="relative flex h-32 w-32 items-center justify-center rounded-full border border-white/20 backdrop-blur-xl"
          style={{
            background:
              "conic-gradient(from 120deg, rgba(68,93,163,0.9), rgba(123,97,255,0.85), rgba(132,185,143,0.9), rgba(68,93,163,0.9))",
            boxShadow: `0 0 80px rgba(68,93,163,0.55), inset 0 0 40px rgba(255,255,255,0.15)`,
          }}
        >
          <div className="absolute inset-2 rounded-full bg-[#050816]/70 backdrop-blur-xl flex items-center justify-center">
            <span
              className="text-4xl font-black tracking-tighter"
              style={{
                background: `linear-gradient(135deg, #ffffff, ${NUVEX.verde})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              N
            </span>
          </div>
        </div>
      </motion.div>

      {/* floating mini cards */}
      {mini.map(({ Icon, x, y, delay }, i) => (
        <motion.div
          key={i}
          className="absolute flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 backdrop-blur-xl"
          style={{
            left: x,
            top: y,
            background: "rgba(255,255,255,0.05)",
            boxShadow: `0 12px 40px -12px ${i % 2 ? NUVEX.verde : NUVEX.azul}`,
          }}
          animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 5 + (i % 3), repeat: Infinity, ease: "easeInOut", delay }}
        >
          <Icon className="h-5 w-5 text-white/85" />
        </motion.div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Página                                                                    */
/* -------------------------------------------------------------------------- */

function HerramientasLanding() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <CommandBg />

      <div className="relative mx-auto w-full max-w-[1360px] px-6 py-8 space-y-8">
        {/* ============================ HERO ============================ */}
        <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] items-center">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10.5px] uppercase tracking-[0.22em] font-bold"
              style={{
                borderColor: "rgba(132,185,143,0.35)",
                background: "rgba(132,185,143,0.08)",
                color: NUVEX.verde,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#84B98F] animate-pulse" />
              NUVIA · Motores Financieros
            </div>

            <h1 className="mt-4 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
              Herramientas{" "}
              <span
                style={{
                  background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Inteligentes
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/60">
              Motores de análisis, validación y proyección financiera para acelerar
              decisiones. Un command center para el AFC.
            </p>

            <div className="mt-6 flex flex-wrap gap-2">
              <Pill Icon={ShieldCheck} label="Finanzas Inteligentes" color={NUVEX.azul} />
              <Pill Icon={Sparkles} label="IA Predictiva" color="#7B61FF" />
              <Pill Icon={Activity} label="Auditoría Técnica" color={NUVEX.verde} />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <HeroOrb />
          </motion.div>
        </section>

        {/* ============================ TOOLS ============================ */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } } }}
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <ToolCard
            to="/herramientas/capacidad-pago"
            Icon={ShieldCheck}
            badge="REGLA 30% / 40% VIS"
            title="Capacidad de pago"
            description="Valida al instante el nivel de endeudamiento permitido bajo Ley 546 y Decreto 583."
            features={["Regla automática", "Validación VIS / No VIS", "Alertas IA"]}
            accent={NUVEX.azul}
          />
          <ToolCard
            to="/herramientas/proyeccion"
            Icon={LineChart}
            badge="LECTURA IA + ESCENARIOS"
            title="Proyección financiera"
            description="Lee extractos, interpreta composición y construye escenarios comparativos."
            features={["OCR financiero", "Escenarios comparativos", "Ahorro proyectado"]}
            accent="#7B61FF"
          />
          <ToolCard
            to="/herramientas/amortizacion"
            Icon={Calculator}
            badge="PESOS + UVR"
            title="NUVIA Amortization Engine"
            description="Motor técnico para analizar composición exacta de cualquier cuota."
            features={["Sistema francés", "Tabla completa", "Exportable PDF"]}
            accent={NUVEX.verde}
          />
        </motion.div>

        {/* ============================ INSIGHT BAR ============================ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-5"
          style={{ boxShadow: "0 20px 80px rgba(68,93,163,.15)" }}
        >
          <div className="flex items-center gap-4">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15"
              style={{
                background: "linear-gradient(135deg, rgba(132,185,143,0.25), rgba(68,93,163,0.25))",
              }}
            >
              <Sparkles className="h-5 w-5 text-[#84B98F]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#84B98F]">
                Tip NUVIA · AI System Message
              </div>
              <div className="mt-0.5 text-sm text-white/75">
                Usa estas herramientas para <b className="text-white">validar viabilidad antes de crear el expediente</b>.
                Puedes convertir la simulación en caso con un clic desde el resultado.
              </div>
            </div>
            {/* animated waveform */}
            <svg className="hidden md:block h-8 w-56 shrink-0" viewBox="0 0 220 32" fill="none">
              <defs>
                <linearGradient id="wave" x1="0" x2="1">
                  <stop offset="0%" stopColor={NUVEX.azul} />
                  <stop offset="100%" stopColor={NUVEX.verde} />
                </linearGradient>
              </defs>
              <path
                d="M0 16 Q 20 4, 40 16 T 80 16 T 120 16 T 160 16 T 200 16 T 240 16"
                stroke="url(#wave)"
                strokeWidth="1.6"
                fill="none"
              >
                <animate attributeName="d"
                  values="M0 16 Q 20 4, 40 16 T 80 16 T 120 16 T 160 16 T 200 16 T 240 16;
                          M0 16 Q 20 28, 40 16 T 80 16 T 120 16 T 160 16 T 200 16 T 240 16;
                          M0 16 Q 20 4, 40 16 T 80 16 T 120 16 T 160 16 T 200 16 T 240 16"
                  dur="4s" repeatCount="indefinite" />
              </path>
            </svg>
          </div>
        </motion.div>

        {/* ============================ STATUS BAR ============================ */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.7 } } }}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <StatusWidget Icon={Cpu} label="Modelo IA" value="Gemini 2.5 Pro" status="Activo" statusColor={NUVEX.azul} />
          <StatusWidget Icon={Scale} label="Supervisión legal" value="Ley 546 / Decreto 583" status="Vigente" statusColor={NUVEX.verde} />
          <StatusWidget Icon={GitBranch} label="Versión sistema" value="v2.4.1" status="Stable" statusColor="#7B61FF" />
          <StatusWidget Icon={Users} label="Usuarios activos" value="32 live sessions" status="Live" statusColor={NUVEX.verde} pulse />
        </motion.div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Pieces                                                                    */
/* -------------------------------------------------------------------------- */

function Pill({ Icon, label, color }: { Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-xl"
      style={{
        borderColor: `${color}55`,
        background: `linear-gradient(135deg, ${color}18, rgba(255,255,255,0.02))`,
      }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      {label}
    </div>
  );
}

function ToolCard({
  to,
  Icon,
  badge,
  title,
  description,
  features,
  accent,
}: {
  to: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  badge: string;
  title: string;
  description: string;
  features: string[];
  accent: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20, scale: 0.97 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" } },
      }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className="group relative"
    >
      {/* animated gradient border */}
      <div
        className="absolute -inset-px rounded-[22px] opacity-60 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `conic-gradient(from 90deg at 50% 50%, ${accent}55, transparent 30%, transparent 70%, ${accent}55)`,
        }}
      />
      <Link
        to={to}
        className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] bg-[rgba(10,16,34,0.6)] p-6 backdrop-blur-2xl"
        style={{ boxShadow: `0 20px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.02) inset` }}
      >
        {/* top gradient line */}
        <span
          className="pointer-events-none absolute inset-x-6 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
        {/* hover glow */}
        <span
          className="pointer-events-none absolute -inset-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl"
          style={{ background: `radial-gradient(circle at 50% 0%, ${accent}30, transparent 60%)` }}
        />

        <div className="relative flex items-start justify-between">
          <motion.div
            whileHover={{ rotate: -3, scale: 1.06 }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, ${accent}55, ${accent}10)`,
              boxShadow: `0 12px 40px -12px ${accent}`,
            }}
          >
            <Icon className="h-6 w-6 text-white" />
          </motion.div>
          <span
            className="rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.18em]"
            style={{
              borderColor: `${accent}55`,
              color: accent,
              background: `${accent}12`,
            }}
          >
            {badge}
          </span>
        </div>

        <h3 className="relative mt-5 text-[22px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="relative mt-2 text-[13.5px] leading-relaxed text-white/60">{description}</p>

        <ul className="relative mt-5 space-y-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[12.5px] text-white/70">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
              />
              {f}
            </li>
          ))}
        </ul>

        <div className="relative mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
          <span className="text-[13px] font-medium text-white/80 group-hover:text-white">
            Abrir herramienta
          </span>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 transition-transform group-hover:translate-x-1"
            style={{
              background: `linear-gradient(135deg, ${accent}66, ${accent}22)`,
              boxShadow: `0 8px 24px -8px ${accent}`,
            }}
          >
            <ArrowRight className="h-4 w-4 text-white" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function StatusWidget({
  Icon,
  label,
  value,
  status,
  statusColor,
  pulse,
}: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  status: string;
  statusColor: string;
  pulse?: boolean;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-2xl px-4 py-3"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10"
        style={{ background: `${statusColor}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: statusColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</div>
        <div className="text-[13px] font-medium text-white/90 truncate">{value}</div>
      </div>
      <div
        className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
        style={{ borderColor: `${statusColor}44`, background: `${statusColor}14`, color: statusColor }}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulse" : ""}`}
          style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
        />
        {status}
      </div>
    </motion.div>
  );
}
