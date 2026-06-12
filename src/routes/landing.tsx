import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, LineChart, FileCheck2, Cpu, BarChart3,
  Search, TrendingUp, Settings2, Compass, Lightbulb, Users, Building2,
  ShieldCheck, Wallet, FolderKanban, Bot, Radio, FileText, Activity,
  Instagram, MapPin, Phone, Globe, Calendar, Award,
} from "lucide-react";
import { AnimatedBackground } from "@/components/home/widgets/AnimatedBackground";

export const Route = createFileRoute("/landing")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "NUVIA · Inteligencia Financiera para Créditos Hipotecarios" },
      {
        name: "description",
        content:
          "NUVIA es la tecnología financiera de NUVEX para analizar, optimizar y gestionar créditos hipotecarios y leasing habitacional en Colombia.",
      },
      { property: "og:title", content: "NUVIA · Inteligencia Financiera para Créditos Hipotecarios" },
      {
        property: "og:description",
        content:
          "Tecnología desarrollada en Colombia para transformar la manera en que las familias entienden y gestionan sus créditos de vivienda.",
      },
    ],
  }),
});

const BLUE = "#445DA3";
const GREEN = "#84B98F";
const DARK = "#0A0B10";

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen text-white antialiased"
      style={{ background: DARK, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <Navbar scrolled={scrolled} />
      <Hero />
      <SectionQueEs />
      <SectionComoAyudamos />
      <SectionImpacto />
      <SectionProposito />
      <SectionNuvex />
      <SectionEcosistema />
      <SectionRedes />
      <CtaFinal />
      <FooterPremium />
    </div>
  );
}

/* ──────────────────────────── NAVBAR ──────────────────────────── */

function Navbar({ scrolled }: { scrolled: boolean }) {
  const links = [
    { href: "#tecnologia", label: "Tecnología" },
    { href: "#como", label: "Cómo funciona" },
    { href: "#impacto", label: "Impacto" },
    { href: "#nuvex", label: "NUVEX" },
    { href: "#contacto", label: "Contacto" },
    { href: "#redes", label: "Redes" },
  ];
  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(10,11,16,0.72)" : "transparent",
        backdropFilter: scrolled ? "blur(18px) saturate(140%)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">NUVIA</span>
        </a>
        <nav className="hidden md:flex items-center gap-7">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[13px] text-white/65 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            href="https://www.nuvex.com.co"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center px-3.5 py-2 rounded-full text-[12.5px] font-medium text-white/80 hover:text-white border border-white/12 hover:border-white/25 transition-all"
          >
            Conocer NUVEX
          </a>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[12.5px] font-semibold text-white transition-all hover:shadow-[0_8px_28px_-8px_rgba(68,93,163,0.7)]"
            style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
          >
            Ingresar a NUVIA
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div
      className="relative h-8 w-8 rounded-lg flex items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
    >
      <span className="text-white text-[13px] font-bold tracking-tight">N</span>
      <div className="absolute inset-0 opacity-30" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.7), transparent 60%)" }} />
    </div>
  );
}

/* ──────────────────────────── HERO ──────────────────────────── */

function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-32 pb-28 sm:pt-40 sm:pb-36">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <AnimatedBackground />
      </div>
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 -z-10"
        style={{ background: `linear-gradient(to bottom, transparent, ${DARK})` }}
      />

      <div className="mx-auto max-w-5xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.22em] mb-7"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 12px ${GREEN}` }} />
          Tecnología financiera colombiana
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.05 }}
          className="text-[44px] sm:text-[68px] leading-[1.02] font-semibold tracking-[-0.03em]"
        >
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, #ffffff 0%, #cfd6e6 50%, #97a4c4 100%)` }}
          >
            NUVIA
          </span>
          <br />
          <span className="text-white/85 text-[28px] sm:text-[40px] font-medium tracking-[-0.02em]">
            Inteligencia financiera automatizada para créditos hipotecarios y leasing habitacional.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="mt-7 mx-auto max-w-2xl text-[15.5px] leading-[1.65] text-white/60"
        >
          Ayudamos a familias a entender, analizar y optimizar sus créditos de vivienda mediante
          inteligencia artificial, automatización financiera y tecnología desarrollada en Colombia.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold text-white transition-all hover:shadow-[0_18px_44px_-14px_rgba(68,93,163,0.8)]"
            style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
          >
            Ingresar a NUVIA
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#tecnologia"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium text-white/90 border border-white/12 hover:border-white/30 hover:bg-white/[0.04] transition-all"
          >
            Conocer la tecnología
          </a>
        </motion.div>

        {/* Glass status bar — sutil prueba visual */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-16 mx-auto max-w-3xl rounded-2xl p-1.5"
          style={{
            background: "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.14))",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div
            className="rounded-[14px] px-6 py-4 flex items-center justify-between gap-6 text-[12px] text-white/70"
            style={{ background: "rgba(10,12,20,0.6)", backdropFilter: "blur(18px)" }}
          >
            <span className="flex items-center gap-2">
              <Activity size={14} style={{ color: GREEN }} />
              Motor operativo
            </span>
            <span className="hidden sm:flex items-center gap-2">
              <Cpu size={14} style={{ color: BLUE }} />
              IA financiera
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-white/60" />
              Desarrollado en Colombia
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ──────────────────────── SECCIÓN 1 — QUÉ ES ──────────────────────── */

function SectionQueEs() {
  const cards = [
    { Icon: LineChart, title: "Análisis financiero inteligente", desc: "Modelos que interpretan extractos y estructuras de crédito con precisión." },
    { Icon: BarChart3, title: "Proyecciones automatizadas", desc: "Escenarios hipotecarios construidos en segundos, no en horas." },
    { Icon: FileCheck2, title: "Automatización documental", desc: "Documentos legales y financieros generados con trazabilidad total." },
    { Icon: Cpu, title: "Inteligencia operacional", desc: "Información estratégica en tiempo real para decisiones de negocio." },
  ];
  return (
    <Section id="tecnologia" eyebrow="Qué es NUVIA">
      <SectionTitle>
        Una nueva forma de entender los <Accent>créditos de vivienda</Accent>.
      </SectionTitle>
      <SectionLead>
        NUVIA transforma información financiera compleja en decisiones simples. Nuestra tecnología
        permite analizar créditos hipotecarios y leasing habitacional, construir escenarios financieros,
        automatizar procesos documentales y brindar información estratégica para la toma de decisiones.
      </SectionLead>

      <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="group relative rounded-2xl p-6 h-full transition-all"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, rgba(68,93,163,0.25), rgba(132,185,143,0.18))",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <c.Icon size={18} className="text-white" />
            </div>
            <div className="text-[15px] font-semibold text-white tracking-tight">{c.title}</div>
            <div className="mt-2 text-[13.5px] leading-[1.6] text-white/55">{c.desc}</div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ──────────────────────── SECCIÓN 2 — CÓMO AYUDAMOS ──────────────────────── */

function SectionComoAyudamos() {
  const steps = [
    { n: "01", Icon: Search, title: "Analizamos", desc: "Información financiera del crédito." },
    { n: "02", Icon: Lightbulb, title: "Identificamos", desc: "Oportunidades de optimización." },
    { n: "03", Icon: TrendingUp, title: "Proyectamos", desc: "Escenarios y simulaciones." },
    { n: "04", Icon: Settings2, title: "Acompañamos", desc: "El proceso operativo." },
    { n: "05", Icon: Compass, title: "Decidimos", desc: "Información estratégica accionable." },
  ];
  return (
    <Section id="como" eyebrow="Cómo ayudamos">
      <SectionTitle>
        Tecnología aplicada al <Accent>ahorro financiero</Accent>.
      </SectionTitle>
      <SectionLead>
        Un proceso continuo que combina ciencia de datos, automatización y experiencia humana.
      </SectionLead>

      <div className="mt-16 relative">
        <div
          aria-hidden
          className="hidden lg:block absolute top-7 left-[6%] right-[6%] h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="relative"
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className="relative h-14 w-14 rounded-full flex items-center justify-center mb-5"
                  style={{
                    background: "rgba(10,12,20,0.9)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: `inset 0 0 0 4px rgba(10,12,20,0.9), 0 0 0 1px rgba(68,93,163,0.25)`,
                  }}
                >
                  <s.Icon size={20} style={{ color: i % 2 === 0 ? BLUE : GREEN }} />
                </div>
                <div className="text-[10.5px] font-bold tracking-[0.22em] text-white/40 mb-1.5">PASO {s.n}</div>
                <div className="text-[15px] font-semibold text-white">{s.title}</div>
                <div className="mt-1.5 text-[13px] text-white/55 max-w-[16ch]">{s.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────── SECCIÓN 3 — IMPACTO ──────────────────────── */

function SectionImpacto() {
  const kpis = [
    { value: "+1.000", label: "Familias acompañadas", Icon: Users },
    { value: "+40.000M", label: "Pesos optimizados", Icon: Wallet, sub: "En créditos hipotecarios" },
    { value: "5 años", label: "Transformando finanzas", Icon: Calendar },
    { value: "100%", label: "Tecnología colombiana", Icon: Award },
  ];
  return (
    <Section id="impacto" eyebrow="Impacto NUVEX">
      <SectionTitle>
        Tecnología respaldada por <Accent>experiencia</Accent>.
      </SectionTitle>
      <SectionLead>
        Cinco años acompañando a familias colombianas en una de las decisiones financieras más
        importantes de su vida.
      </SectionLead>

      <div
        className="mt-16 rounded-3xl p-1.5"
        style={{
          background: "linear-gradient(135deg, rgba(68,93,163,0.25), rgba(132,185,143,0.18))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          className="rounded-[22px] p-6 sm:p-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          style={{ background: "rgba(10,12,20,0.85)", backdropFilter: "blur(20px)" }}
        >
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <k.Icon size={16} className="text-white/40 mb-4" />
              <div
                className="text-[34px] sm:text-[40px] font-semibold tracking-[-0.03em] leading-none bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, #ffffff, ${i % 2 === 0 ? BLUE : GREEN})` }}
              >
                {k.value}
              </div>
              <div className="mt-3 text-[13px] text-white/70 font-medium">{k.label}</div>
              {k.sub && <div className="mt-1 text-[11.5px] text-white/40">{k.sub}</div>}
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────── SECCIÓN 4 — TECNOLOGÍA CON PROPÓSITO ──────────────────── */

function SectionProposito() {
  return (
    <Section eyebrow="Tecnología con propósito">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionTitle align="left">
            Creemos que el ahorro no es un lujo, es un <Accent>derecho</Accent>.
          </SectionTitle>
          <p className="mt-6 text-[15.5px] leading-[1.7] text-white/65">
            En NUVEX creemos que la tecnología debe ayudar a las personas a tomar mejores
            decisiones financieras. Por eso desarrollamos NUVIA, una plataforma que combina
            inteligencia financiera, automatización e innovación para acompañar a las familias
            en la gestión de sus créditos de vivienda.
          </p>
          <div className="mt-8 flex flex-wrap gap-2.5">
            {["Inteligencia Financiera", "Automatización", "Innovación", "Propósito Social"].map((t) => (
              <span
                key={t}
                className="px-3.5 py-1.5 rounded-full text-[11.5px] text-white/75"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
        <ConceptualVisual />
      </div>
    </Section>
  );
}

function ConceptualVisual() {
  return (
    <div
      className="relative rounded-3xl aspect-[4/3] overflow-hidden"
      style={{
        background: `radial-gradient(800px 500px at 70% 20%, rgba(68,93,163,0.5), transparent 60%), radial-gradient(700px 400px at 20% 80%, rgba(132,185,143,0.4), transparent 60%), #0d1020`,
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="grLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity="0.6" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="grArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity="0.35" />
            <stop offset="100%" stopColor={GREEN} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* grid */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={i} x1="0" x2="400" y1={40 + i * 30} y2={40 + i * 30} stroke="rgba(255,255,255,0.04)" />
        ))}

        {/* área */}
        <path
          d="M0,220 L40,200 L80,210 L120,170 L160,180 L200,140 L240,130 L280,100 L320,110 L360,70 L400,80 L400,300 L0,300 Z"
          fill="url(#grArea)"
        />
        {/* línea */}
        <path
          d="M0,220 L40,200 L80,210 L120,170 L160,180 L200,140 L240,130 L280,100 L320,110 L360,70 L400,80"
          fill="none"
          stroke="url(#grLine)"
          strokeWidth="2.5"
        />

        {/* puntos */}
        {[40,80,120,160,200,240,280,320,360].map((x, i) => {
          const ys = [200,210,170,180,140,130,100,110,70];
          return (
            <circle key={x} cx={x} cy={ys[i]} r="3" fill="white">
              <animate attributeName="r" values="2.5;4.5;2.5" dur={`${3 + i % 3}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </svg>

      <div className="absolute bottom-5 left-5 right-5 rounded-2xl p-4 flex items-center justify-between"
        style={{ background: "rgba(10,12,20,0.7)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-white/45">Proyección</div>
          <div className="text-[14px] text-white font-medium mt-0.5">Ahorro estimado en intereses</div>
        </div>
        <div className="text-[20px] font-semibold" style={{ color: GREEN }}>+ 24.3%</div>
      </div>
    </div>
  );
}

/* ──────────────────── SECCIÓN 5 — CREADO POR NUVEX ──────────────────── */

function SectionNuvex() {
  return (
    <Section id="nuvex" eyebrow="Creado por NUVEX">
      <div
        className="relative rounded-3xl p-10 sm:p-14 overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-32 -right-32 h-80 w-80 rounded-full blur-[120px] opacity-40"
          style={{ background: BLUE }}
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full blur-[120px] opacity-30"
          style={{ background: GREEN }}
        />

        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
          <div>
            <div className="flex items-center gap-2 mb-5">
              <Building2 size={14} className="text-white/40" />
              <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/45">Fintech Colombiana</span>
            </div>
            <h2 className="text-[32px] sm:text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Desarrollado por <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
              >
                NUVEX Finanzas Inteligentes
              </span>
            </h2>
            <p className="mt-6 text-[15px] leading-[1.7] text-white/65 max-w-xl">
              NUVEX es una fintech colombiana especializada en optimización de créditos hipotecarios,
              leasing habitacional, automatización documental e inteligencia financiera. Nuestra
              misión es conectar tecnología con propósito social para transformar la vida
              financiera de las personas.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="https://www.nuvex.com.co"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-medium border border-white/15 hover:border-white/30 hover:bg-white/[0.04] transition-all"
              >
                Visitar nuvex.com.co
                <ArrowRight size={14} />
              </a>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10.5px] font-bold uppercase tracking-[0.18em]"
                style={{ background: "rgba(132,185,143,0.12)", border: `1px solid rgba(132,185,143,0.35)`, color: GREEN }}
              >
                <ShieldCheck size={12} /> Marca registrada
              </span>
            </div>
          </div>

          <div className="relative">
            <div
              className="aspect-square rounded-3xl flex flex-col items-center justify-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                className="h-24 w-24 rounded-2xl flex items-center justify-center mb-5 shadow-[0_20px_60px_-20px_rgba(68,93,163,0.7)]"
                style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
              >
                <span className="text-white text-3xl font-bold tracking-tight">N</span>
              </div>
              <div className="text-[22px] font-semibold tracking-tight">NUVEX</div>
              <div className="text-[12px] text-white/50 mt-1">Finanzas Inteligentes</div>

              <div className="absolute bottom-5 inset-x-5 flex items-center justify-between text-[10.5px] text-white/40 font-mono">
                <span>® 2026</span>
                <span>Colombia</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────── SECCIÓN 6 — ECOSISTEMA ──────────────────── */

function SectionEcosistema() {
  const items = [
    { Icon: LineChart, title: "Motor de Proyecciones", desc: "Escenarios hipotecarios precisos." },
    { Icon: Wallet, title: "Motor de Honorarios", desc: "Cálculos automatizados y trazables." },
    { Icon: FolderKanban, title: "Expediente Maestro", desc: "Centraliza cada caso de principio a fin." },
    { Icon: Radio, title: "Pipeline Maestro", desc: "Etapas operativas controladas." },
    { Icon: Bot, title: "NUVIA IA", desc: "Inteligencia conversacional especializada." },
    { Icon: Activity, title: "Control Operativo", desc: "Torre de control en tiempo real." },
    { Icon: FileText, title: "Automatización Documental", desc: "Documentos legales sin errores." },
    { Icon: BarChart3, title: "Analítica Financiera", desc: "Métricas que mueven el negocio." },
  ];
  return (
    <Section eyebrow="Ecosistema NUVIA">
      <SectionTitle>
        Un sistema completo, <Accent>diseñado en módulos</Accent>.
      </SectionTitle>
      <SectionLead>
        Cada motor cumple un rol específico. Juntos forman la plataforma operativa más completa
        para créditos de vivienda en Colombia.
      </SectionLead>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: (i % 4) * 0.05 }}
            className="group relative rounded-2xl p-5 transition-all hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
              style={{
                background: "rgba(10,12,20,0.6)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <it.Icon size={17} style={{ color: i % 2 === 0 ? BLUE : GREEN }} />
            </div>
            <div className="text-[14px] font-semibold tracking-tight text-white">{it.title}</div>
            <div className="mt-1.5 text-[12.5px] leading-[1.55] text-white/55">{it.desc}</div>
            <div
              aria-hidden
              className="absolute inset-x-0 -bottom-px h-px opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: `linear-gradient(90deg, transparent, ${GREEN}, transparent)` }}
            />
          </motion.div>
        ))}
      </div>
    </Section>
  );
}

/* ──────────────────── SECCIÓN 7 — REDES ──────────────────── */

function SectionRedes() {
  const redes = [
    {
      Icon: Instagram,
      name: "Instagram",
      handle: "@nuvex_finanzas",
      desc: "Casos de éxito, contenido educativo y actualidad financiera.",
      cta: "Seguir en Instagram",
      url: "https://www.instagram.com/nuvex_finanzas",
      gradient: "linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
    },
    {
      Icon: TikTokIcon,
      name: "TikTok",
      handle: "@nuvex_finanzas",
      desc: "Tips financieros, análisis de créditos y contenido educativo en video.",
      cta: "Seguir en TikTok",
      url: "https://www.tiktok.com/@nuvex_finanzas",
      gradient: "linear-gradient(135deg, #25F4EE, #ffffff, #FE2C55)",
    },
  ];
  return (
    <Section id="redes" eyebrow="Redes sociales">
      <SectionTitle>
        Aprende más sobre <Accent>finanzas inteligentes</Accent>.
      </SectionTitle>
      <SectionLead>
        Compartimos educación financiera, casos reales, análisis hipotecarios y contenido
        especializado para ayudar a más familias a tomar mejores decisiones.
      </SectionLead>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {redes.map((r) => (
          <a
            key={r.name}
            href={r.url}
            target="_blank"
            rel="noreferrer"
            className="group relative rounded-3xl p-8 overflow-hidden transition-all hover:-translate-y-1"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              aria-hidden
              className="absolute -top-20 -right-20 h-56 w-56 rounded-full blur-[100px] opacity-0 group-hover:opacity-40 transition-opacity"
              style={{ background: r.gradient }}
            />
            <div
              className="h-14 w-14 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: r.gradient }}
            >
              <r.Icon size={22} className="text-white" />
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-[22px] font-semibold tracking-tight">{r.name}</div>
              <div className="text-[12.5px] text-white/45">{r.handle}</div>
            </div>
            <p className="mt-3 text-[14px] text-white/60 leading-[1.6] max-w-md">{r.desc}</p>
            <div className="mt-7 inline-flex items-center gap-2 text-[13px] font-medium text-white/85 group-hover:text-white">
              {r.cta}
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </a>
        ))}
      </div>
    </Section>
  );
}

function TikTokIcon({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.66a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.09Z" />
    </svg>
  );
}

/* ──────────────────────── CTA FINAL ──────────────────────── */

function CtaFinal() {
  return (
    <Section>
      <div
        className="relative rounded-[28px] p-10 sm:p-16 text-center overflow-hidden"
        style={{
          background: `radial-gradient(800px 400px at 50% 0%, rgba(68,93,163,0.35), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01))`,
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Sparkles size={22} className="mx-auto mb-5" style={{ color: GREEN }} />
        <h2 className="text-[32px] sm:text-[48px] leading-[1.05] font-semibold tracking-[-0.03em]">
          La inteligencia financiera del <br className="hidden sm:block" />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
          >
            futuro comienza hoy.
          </span>
        </h2>
        <p className="mt-6 mx-auto max-w-2xl text-[15px] leading-[1.7] text-white/60">
          Accede a la plataforma tecnológica desarrollada por NUVEX para transformar la manera en
          que se analizan y gestionan los créditos de vivienda.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-semibold text-white transition-all hover:shadow-[0_18px_44px_-14px_rgba(68,93,163,0.8)]"
            style={{ background: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
          >
            Ingresar a NUVIA
            <ArrowRight size={16} />
          </Link>
          <a
            href="https://www.nuvex.com.co"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-medium text-white/90 border border-white/15 hover:border-white/30 hover:bg-white/[0.04] transition-all"
          >
            Conocer NUVEX
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ──────────────────────── FOOTER ──────────────────────── */

function FooterPremium() {
  return (
    <footer id="contacto" className="relative mt-24 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark />
              <span className="text-[16px] font-semibold tracking-tight">NUVIA</span>
            </div>
            <p className="mt-5 text-[13.5px] text-white/55 leading-[1.7] max-w-sm">
              Tecnología creada por <span className="text-white/80">NUVEX Finanzas Inteligentes</span>.
              NUVEX es una marca registrada.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://www.instagram.com/nuvex_finanzas"
                target="_blank"
                rel="noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center border border-white/12 hover:border-white/30 hover:bg-white/5 transition-all"
                aria-label="Instagram"
              >
                <Instagram size={15} />
              </a>
              <a
                href="https://www.tiktok.com/@nuvex_finanzas"
                target="_blank"
                rel="noreferrer"
                className="h-9 w-9 rounded-full flex items-center justify-center border border-white/12 hover:border-white/30 hover:bg-white/5 transition-all"
                aria-label="TikTok"
              >
                <TikTokIcon size={15} />
              </a>
            </div>
          </div>

          <FooterCol title="Contacto">
            <FooterLine Icon={MapPin}>
              Carrera 16 # 37-48 Piso 4<br />Centro de Bucaramanga
            </FooterLine>
            <FooterLine Icon={Building2}>Bogotá · Bucaramanga</FooterLine>
            <FooterLine Icon={Phone}>+57 316 402 3779</FooterLine>
            <FooterLine Icon={Globe}>
              <a href="https://www.nuvex.com.co" target="_blank" rel="noreferrer" className="hover:text-white">
                www.nuvex.com.co
              </a>
            </FooterLine>
          </FooterCol>

          <FooterCol title="Plataforma">
            <FooterAnchor href="#tecnologia">Tecnología</FooterAnchor>
            <FooterAnchor href="#como">Cómo funciona</FooterAnchor>
            <FooterAnchor href="#impacto">Impacto</FooterAnchor>
            <FooterAnchor href="#nuvex">NUVEX</FooterAnchor>
          </FooterCol>

          <FooterCol title="Acceso">
            <Link to="/login" className="block text-[13px] text-white/60 hover:text-white transition-colors">
              Ingresar a NUVIA
            </Link>
            <a
              href="https://www.nuvex.com.co"
              target="_blank"
              rel="noreferrer"
              className="block text-[13px] text-white/60 hover:text-white transition-colors"
            >
              Sitio NUVEX
            </a>
            <FooterAnchor href="#redes">Redes sociales</FooterAnchor>
          </FooterCol>
        </div>

        <div className="mt-14 pt-8 border-t flex flex-wrap items-center justify-between gap-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="text-[12px] text-white/40">
            © 2026 NUVIA by NUVEX Finanzas Inteligentes. Todos los derechos reservados.
          </div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/35">
            Hecho en Colombia 🇨🇴
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/40 mb-5">{title}</div>
      <div className="space-y-3.5">{children}</div>
    </div>
  );
}
function FooterLine({ Icon, children }: { Icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] text-white/60 leading-[1.55]">
      <Icon size={14} className="mt-0.5 text-white/40 flex-shrink-0" />
      <div>{children}</div>
    </div>
  );
}
function FooterAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="block text-[13px] text-white/60 hover:text-white transition-colors">
      {children}
    </a>
  );
}

/* ──────────────────────── PRIMITIVES ──────────────────────── */

function Section({
  id,
  eyebrow,
  children,
}: {
  id?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {eyebrow && (
          <div className="mb-6 flex items-center gap-2">
            <span className="h-px w-8" style={{ background: "rgba(255,255,255,0.2)" }} />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-white/50">{eyebrow}</span>
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function SectionTitle({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <h2
      className={`text-[32px] sm:text-[46px] leading-[1.05] font-semibold tracking-[-0.03em] max-w-3xl ${
        align === "center" ? "mx-auto text-center" : ""
      }`}
    >
      {children}
    </h2>
  );
}

function SectionLead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 max-w-2xl text-[15.5px] leading-[1.7] text-white/60">{children}</p>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{ backgroundImage: `linear-gradient(135deg, ${BLUE}, ${GREEN})` }}
    >
      {children}
    </span>
  );
}
