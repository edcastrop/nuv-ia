import {
  Home,
  TrendingUp,
  ArrowRight,
  MapPin,
  Building2,
  Phone,
  Globe,
  Sparkles,
  ShieldCheck,
  Calculator,
  BarChart3,
  LineChart,
  FileText,
  PiggyBank,
  Layers,
  Cpu,
  Scale,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NUVEX } from "./constants";

const BG = "#050816";
const SURFACE = "#0B1220";
const SURFACE_HI = "#101A2E";
const AZUL = NUVEX.azul; // #445DA3
const VERDE = NUVEX.verde; // #84B98F

export function ModeSelector({ onPick }: { onPick: (m: "pesos" | "uvr") => void }) {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden font-[Inter,ui-sans-serif,system-ui]"
      style={{
        background: `
          radial-gradient(1000px 500px at 8% -5%, rgba(68,93,163,0.20), transparent 60%),
          radial-gradient(900px 500px at 100% 100%, rgba(132,185,143,0.12), transparent 55%),
          radial-gradient(600px 400px at 50% 40%, rgba(68,93,163,0.10), transparent 60%),
          ${BG}
        `,
      }}
    >
      {/* Grid animado */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
        }}
      />

      {/* Ambient orbs */}
      <motion.div
        className="pointer-events-none absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full blur-[130px] opacity-[0.22]"
        style={{ background: AZUL }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-56 right-0 h-[34rem] w-[34rem] rounded-full blur-[150px] opacity-[0.18]"
        style={{ background: VERDE }}
        animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />

      <FloatingParticles />

      {/* HEADER */}
      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-6 pt-8 sm:px-10">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-base font-bold text-white shadow-[0_8px_30px_-8px_rgba(68,93,163,0.7)]"
            style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
          >
            N
          </div>
          <div className="text-[15px] font-semibold tracking-[0.02em] text-white">NUVIA</div>
        </div>
        <p className="hidden text-[12px] italic text-white/50 sm:block" style={{ letterSpacing: "0.4px" }}>
          "El ahorro no es un lujo, es un derecho."
        </p>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-14 px-6 pt-16 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        {/* IZQUIERDA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-xl"
            style={{ fontSize: 11, letterSpacing: "3px" }}
          >
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: VERDE, boxShadow: `0 0 10px ${VERDE}` }} />
            <span className="font-semibold uppercase text-white/80">Simuladores NUVIA</span>
          </div>

          <h1 className="mt-7 text-[52px] font-700 leading-[1.02] tracking-[-0.02em] text-white sm:text-[64px]" style={{ fontWeight: 700 }}>
            Simuladores
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(120deg, ${AZUL} 0%, #7B9BE0 55%, ${VERDE} 100%)` }}
            >
              NUVIA
            </span>
          </h1>

          <p className="mt-6 max-w-[520px] text-[16px] leading-relaxed text-white/60" style={{ fontWeight: 500 }}>
            Herramientas inteligentes para analizar, comparar y optimizar créditos hipotecarios y leasing habitacional.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <MiniFeature Icon={BarChart3} label="Análisis avanzado" color={AZUL} />
            <MiniFeature Icon={Calculator} label="Cálculos precisos" color={VERDE} />
            <MiniFeature Icon={ShieldCheck} label="Seguridad total" color={AZUL} />
          </div>
        </motion.div>

        {/* DERECHA — Orbital */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative mx-auto aspect-square w-full max-w-[520px]"
        >
          <OrbitalHero />
        </motion.div>
      </section>

      {/* SIMULATOR CARDS */}
      <section className="relative z-10 mx-auto mt-24 max-w-[1240px] px-6 sm:px-10">
        <div className="grid gap-7 md:grid-cols-2">
          <SimCard
            onClick={() => onPick("pesos")}
            color={AZUL}
            badge="PESOS"
            title="Simulador en Pesos"
            description="Créditos hipotecarios y leasing habitacional denominados en pesos colombianos con o sin beneficio de cobertura."
            features={["Sistema francés", "Tasa fija", "Amortización exacta"]}
            Icon={Home}
          />
          <SimCard
            onClick={() => onPick("uvr")}
            color={VERDE}
            badge="UVR"
            title="Simulador en UVR"
            description="Créditos hipotecarios y leasing habitacional en UVR con proyección de corrección monetaria."
            features={["Corrección monetaria", "Proyección UVR", "Escenarios variables"]}
            Icon={TrendingUp}
          />
        </div>
      </section>

      {/* TIP NUVIA */}
      <section className="relative z-10 mx-auto mt-10 max-w-[1240px] px-6 sm:px-10">
        <TipNuviaCard />
      </section>

      {/* STATUS BAR */}
      <section className="relative z-10 mx-auto mt-10 max-w-[1240px] px-6 sm:px-10">
        <StatusBar />
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 mx-auto mt-16 max-w-[1240px] px-6 pb-10 sm:px-10">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-6 backdrop-blur-xl">
          <div className="grid grid-cols-1 gap-6 text-[12px] text-white/60 md:grid-cols-4 md:divide-x md:divide-white/[0.06]">
            <FooterBlock Icon={MapPin} title="Bucaramanga" lines={["Carrera 16 # 37-48 piso 4"]} />
            <FooterBlock Icon={Building2} title="Bogotá — Aliado Jurídico" lines={["Calle 93 # 18-28 Of. 704"]} />
            <FooterBlock Icon={Phone} title="Contacto" lines={["+57 316 402 3779"]} />
            <FooterBlock Icon={Globe} title="Web" lines={["www.nuvia.com.co"]} />
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------- Sub-components -------------------------- */

function MiniFeature({
  Icon,
  label,
  color,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  color: string;
}) {
  return (
    <div
      className="group flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/[0.06]"
      style={{ boxShadow: "0 10px 30px -20px rgba(0,0,0,0.6)" }}
    >
      <span
        className="flex h-7 w-7 items-center justify-center rounded-lg"
        style={{ background: `${color}1F`, color, border: `1px solid ${color}33` }}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <span className="text-[12.5px] font-semibold text-white/85">{label}</span>
    </div>
  );
}

function OrbitalHero() {
  // 6 módulos orbitando
  const modules = [
    { label: "Análisis", Icon: BarChart3 },
    { label: "Proyecciones", Icon: LineChart },
    { label: "Escenarios", Icon: Layers },
    { label: "Validación", Icon: ShieldCheck },
    { label: "Reportes", Icon: FileText },
    { label: "Ahorro", Icon: PiggyBank },
  ];
  const R_OUT = 44; // % radius
  const positions = modules.map((_, i) => {
    const angle = (i / modules.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: 50 + R_OUT * Math.cos(angle),
      y: 50 + R_OUT * Math.sin(angle),
    };
  });

  return (
    <div className="relative h-full w-full">
      {/* Anillos */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={AZUL} stopOpacity="0.5" />
            <stop offset="100%" stopColor={VERDE} stopOpacity="0.5" />
          </linearGradient>
          <radialGradient id="core-g">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="60%" stopColor={AZUL} stopOpacity="0.8" />
            <stop offset="100%" stopColor={AZUL} stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.6" />
          </filter>
        </defs>

        {/* Anillos concéntricos */}
        <circle cx="50" cy="50" r="44" fill="none" stroke="url(#ring-g)" strokeWidth="0.15" opacity="0.6" strokeDasharray="0.6 0.8" />
        <circle cx="50" cy="50" r="32" fill="none" stroke="url(#ring-g)" strokeWidth="0.12" opacity="0.4" strokeDasharray="0.4 0.6" />
        <circle cx="50" cy="50" r="20" fill="none" stroke="url(#ring-g)" strokeWidth="0.1" opacity="0.3" />

        {/* Líneas centro → módulos */}
        {positions.map((p, i) => (
          <line
            key={`ln-${i}`}
            x1="50"
            y1="50"
            x2={p.x}
            y2={p.y}
            stroke="url(#ring-g)"
            strokeWidth="0.15"
            opacity="0.4"
          >
            <animate attributeName="opacity" values="0.15;0.55;0.15" dur={`${4 + i}s`} repeatCount="indefinite" />
          </line>
        ))}

        {/* Partículas viajando */}
        {positions.map((p, i) => (
          <circle key={`p-${i}`} r="0.5" fill={VERDE} opacity="0.9">
            <animate attributeName="cx" values={`50;${p.x};50`} dur={`${5 + i}s`} repeatCount="indefinite" />
            <animate attributeName="cy" values={`50;${p.y};50`} dur={`${5 + i}s`} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;1;0" dur={`${5 + i}s`} repeatCount="indefinite" />
          </circle>
        ))}

        {/* Core glow */}
        <circle cx="50" cy="50" r="14" fill="url(#core-g)" opacity="0.7" filter="url(#soft-glow)" />
      </svg>

      {/* Anillo rotante */}
      <motion.div
        className="absolute inset-[8%] rounded-full border border-white/[0.05]"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: VERDE, boxShadow: `0 0 12px ${VERDE}` }}
        />
      </motion.div>
      <motion.div
        className="absolute inset-[22%] rounded-full border border-white/[0.06]"
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
      >
        <span
          className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: AZUL, boxShadow: `0 0 10px ${AZUL}` }}
        />
      </motion.div>

      {/* Centro — logo NUVIA */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className="flex h-[86px] w-[86px] items-center justify-center rounded-2xl text-2xl font-bold text-white backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
            boxShadow: `0 0 60px ${AZUL}88, 0 0 100px ${VERDE}55, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          N
        </div>
      </motion.div>

      {/* Módulos orbitando */}
      {modules.map((m, i) => {
        const p = positions[i];
        return (
          <motion.div
            key={m.label}
            className="absolute"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
            transition={{
              opacity: { duration: 0.6, delay: 0.4 + i * 0.08 },
              scale: { duration: 0.6, delay: 0.4 + i * 0.08 },
              y: { duration: 3 + i * 0.3, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            <div
              className="-translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#0B1220]/80 px-2.5 py-1.5 backdrop-blur-xl"
              style={{ boxShadow: `0 10px 30px -12px rgba(0,0,0,0.7), 0 0 20px ${(i % 2 ? VERDE : AZUL)}22` }}
            >
              <m.Icon className="h-3 w-3" style={{ color: i % 2 ? VERDE : AZUL }} strokeWidth={2.2} />
              <span className="text-[10px] font-semibold text-white/90">{m.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function SimCard({
  onClick,
  color,
  badge,
  title,
  description,
  features,
  Icon,
}: {
  onClick: () => void;
  color: string;
  badge: string;
  title: string;
  description: string;
  features: string[];
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="group relative"
    >
      {/* Glow externo */}
      <span
        className="pointer-events-none absolute -inset-[1px] rounded-[28px] opacity-0 blur-lg transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `${color}55` }}
      />
      <div
        className="relative flex flex-col overflow-hidden rounded-[28px] border border-white/[0.08] p-9 backdrop-blur-2xl transition-all duration-300 group-hover:border-white/25"
        style={{
          background: `linear-gradient(180deg, ${SURFACE_HI}CC 0%, ${SURFACE}CC 100%)`,
          boxShadow: "0 30px 80px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Acento superior */}
        <span
          className="absolute inset-x-8 top-0 h-px opacity-60"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
        {/* Halo hover */}
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: `radial-gradient(600px circle at 50% -20%, ${color}22, transparent 60%)` }}
        />

        <div className="relative mb-8 flex items-start justify-between">
          <motion.div
            whileHover={{ scale: 1.08, rotate: -3 }}
            transition={{ type: "spring", stiffness: 320, damping: 18 }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl border backdrop-blur-xl"
            style={{
              background: `${color}18`,
              borderColor: `${color}44`,
              color,
              boxShadow: `0 0 30px ${color}33, inset 0 1px 0 rgba(255,255,255,0.1)`,
            }}
          >
            <Icon className="h-7 w-7" strokeWidth={1.8} />
          </motion.div>
          <span
            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ background: `${color}18`, borderColor: `${color}55`, color }}
          >
            {badge}
          </span>
        </div>

        <h2 className="relative text-[26px] font-semibold tracking-tight text-white">{title}</h2>
        <p className="relative mt-3 max-w-[440px] text-[13.5px] leading-relaxed text-white/60">
          {description}
        </p>

        <ul className="relative mt-7 space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2.5 text-[13px] text-white/75">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${color}` }}
              />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={onClick}
          className="relative mt-10 flex w-full items-center justify-between overflow-hidden rounded-2xl px-6 py-4 text-[12px] font-bold uppercase tracking-[0.24em] text-white transition-all duration-300 hover:brightness-110"
          style={{
            background: `linear-gradient(120deg, ${color} 0%, ${color}DD 100%)`,
            boxShadow: `0 15px 40px -12px ${color}, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          <span
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          />
          Iniciar simulación
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      </div>
    </motion.div>
  );
}

function TipNuviaCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-6 backdrop-blur-2xl sm:p-7"
      style={{
        background: `linear-gradient(120deg, ${SURFACE_HI}AA 0%, ${SURFACE}AA 100%)`,
        boxShadow: "0 30px 80px -40px rgba(0,0,0,0.8)",
      }}
    >
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(600px circle at 0% 50%, ${AZUL}18, transparent 55%), radial-gradient(500px circle at 100% 50%, ${VERDE}18, transparent 55%)`,
        }}
      />
      <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border"
            style={{
              background: `linear-gradient(135deg, ${AZUL}33, ${VERDE}33)`,
              borderColor: "rgba(255,255,255,0.12)",
              boxShadow: `0 0 25px ${AZUL}44`,
            }}
          >
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/60">Tip NUVIA</div>
            <p className="mt-2 max-w-[640px] text-[13.5px] leading-relaxed text-white/80">
              Utiliza nuestros simuladores para validar la viabilidad de tu optimización antes de crear expediente.
              Puedes convertir la simulación en expediente con un clic.
            </p>
          </div>
        </div>

        {/* Mini gráfico */}
        <div className="relative h-[70px] w-[220px] shrink-0">
          <svg viewBox="0 0 220 70" className="h-full w-full">
            <defs>
              <linearGradient id="tip-line" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={AZUL} />
                <stop offset="100%" stopColor={VERDE} />
              </linearGradient>
              <linearGradient id="tip-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VERDE} stopOpacity="0.35" />
                <stop offset="100%" stopColor={VERDE} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 60 L30 55 L60 48 L90 42 L120 30 L150 24 L180 14 L220 6"
              fill="none"
              stroke="url(#tip-line)"
              strokeWidth="2"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${VERDE}88)` }}
            />
            <path
              d="M0 60 L30 55 L60 48 L90 42 L120 30 L150 24 L180 14 L220 6 L220 70 L0 70 Z"
              fill="url(#tip-fill)"
            />
            <circle cx="220" cy="6" r="3.5" fill={VERDE}>
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
        </div>
      </div>
    </motion.div>
  );
}

function StatusBar() {
  const [users, setUsers] = useState(0);
  useEffect(() => {
    setUsers(120 + Math.floor(Math.random() * 60));
    const t = setInterval(() => {
      setUsers((u) => Math.max(90, Math.min(220, u + (Math.random() > 0.5 ? 1 : -1) * Math.ceil(Math.random() * 3))));
    }, 3500);
    return () => clearInterval(t);
  }, []);

  const items = [
    { Icon: Cpu, label: "Gemini 2.5 Pro", value: "Activo", color: VERDE, live: true },
    { Icon: Scale, label: "Supervisión legal", value: "Ley 546 de 1999", color: AZUL },
    { Icon: Layers, label: "Versión sistema", value: "v2.4.1", color: VERDE },
    { Icon: Users, label: "Usuarios activos", value: users ? users.toString() : "—", color: AZUL, live: true },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div
          key={it.label}
          className="relative overflow-hidden rounded-2xl border border-white/[0.07] p-4 backdrop-blur-xl"
          style={{
            background: `linear-gradient(180deg, ${SURFACE_HI}99, ${SURFACE}99)`,
            boxShadow: "0 20px 50px -30px rgba(0,0,0,0.8)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{ background: `${it.color}18`, borderColor: `${it.color}44`, color: it.color }}
            >
              <it.Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
                {it.label}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
                {it.live && (
                  <span
                    className="h-1.5 w-1.5 rounded-full animate-pulse"
                    style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }}
                  />
                )}
                {it.value}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
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
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-white/70">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{title}</div>
        {lines.map((l) => (
          <div key={l} className="truncate text-[12.5px] text-white/80">{l}</div>
        ))}
      </div>
    </div>
  );
}

function FloatingParticles() {
  const particles = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((i) => {
        const size = 1 + (i % 3) * 0.6;
        const left = (i * 37) % 100;
        const top = (i * 53) % 100;
        const dur = 12 + (i % 6) * 2;
        const color = i % 2 ? VERDE : AZUL;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              left: `${left}%`,
              top: `${top}%`,
              background: color,
              boxShadow: `0 0 ${4 + size * 2}px ${color}`,
              opacity: 0.5,
            }}
            animate={{ y: [0, -30, 0], opacity: [0.15, 0.7, 0.15] }}
            transition={{ duration: dur, repeat: Infinity, ease: "easeInOut", delay: i * 0.4 }}
          />
        );
      })}
    </div>
  );
}
