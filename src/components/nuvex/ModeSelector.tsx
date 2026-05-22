import { Home, TrendingUp, ArrowRight, MapPin, Building2, Phone, Globe } from "lucide-react";
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
      {/* Glow orbs */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-25" style={{ background: NUVEX.azul }} />
      <div className="absolute -bottom-40 right-10 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20" style={{ background: NUVEX.verde }} />

      {/* Ondas */}
      <svg className="pointer-events-none absolute inset-x-0 top-1/3 w-full opacity-[0.08]" viewBox="0 0 1440 200" preserveAspectRatio="none">
        <path d="M0,100 C320,180 720,20 1440,120 L1440,200 L0,200 Z" fill="url(#wave)" />
        <defs>
          <linearGradient id="wave" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={NUVEX.azul} />
            <stop offset="100%" stopColor={NUVEX.verde} />
          </linearGradient>
        </defs>
      </svg>

      {/* HEADER */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 pt-8 sm:px-10">
        <div className="flex items-center gap-3 animate-fade-in">
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
      </header>

      {/* CENTRO */}
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-48 pt-14 sm:px-10 sm:pt-20">
        <div className="text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#84B98F]/40 bg-white/[0.04] backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: NUVEX.verde }}>
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
        </div>

        {/* TARJETAS */}
        <div className="mt-12 grid gap-6 md:grid-cols-2 animate-fade-in">
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
        </div>
      </main>

      {/* FOOTER FLOTANTE */}
      <footer className="absolute inset-x-0 bottom-4 z-10 px-4 sm:px-8">
        <div className="mx-auto max-w-6xl rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-1 gap-4 text-[12px] text-white/70 md:grid-cols-4 md:divide-x md:divide-white/10">
            <FooterBlock Icon={MapPin} title="Bucaramanga" lines={["Carrera 16 # 37-48 piso 4", "Centro de Bucaramanga"]} />
            <FooterBlock Icon={Building2} title="Bogotá · Aliado Jurídico" lines={["Calle 93 # 18-28 Of. 704", "Bogotá D.C. - Colombia"]} />
            <FooterBlock Icon={Phone} title="Contacto" lines={["+57 316 402 3779"]} />
            <FooterBlock Icon={Globe} title="Web" lines={["www.nuvex.com.co"]} />
          </div>
        </div>
      </footer>
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
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl bg-white p-7 text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
    >
      {/* Borde inferior color */}
      <span className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: color }} />
      {/* Glow hover */}
      <span
        className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `0 0 0 1px ${color}55, 0 0 40px ${color}33` }}
      />

      <div className="flex items-start justify-between">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: `${color}15`, color }}
        >
          <Icon className="h-7 w-7" strokeWidth={2} />
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white"
          style={{ background: color }}
        >
          {badge}
        </span>
      </div>

      <h2 className="mt-6 text-xl font-semibold tracking-tight" style={{ color: NUVEX.negro }}>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[#242424]/65">{description}</p>

      <div className="mt-6 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
          Iniciar simulación
        </span>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-1"
          style={{ background: color }}
        >
          <ArrowRight className="h-5 w-5" />
        </span>
      </div>
    </button>
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
