import { createFileRoute, Link } from "@tanstack/react-router";
import { Wrench, Sparkles, LineChart, ArrowRight, ShieldCheck, FileBarChart } from "lucide-react";

export const Route = createFileRoute("/_authenticated/herramientas/")({
  head: () => ({
    meta: [
      { title: "Herramientas NUVEX" },
      { name: "description", content: "Motor de análisis de capacidad de pago y proyección financiera sin crear caso." },
    ],
  }),
  component: HerramientasLanding,
});

function HerramientasLanding() {
  return (
    <div className="min-h-screen bg-[#0E0E0E] text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)", boxShadow: "0 10px 30px -10px rgba(132,185,143,0.55)" }}>
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Herramientas NUVEX</h1>
            <p className="text-sm text-white/55">
              Motores de cálculo disponibles para analistas y comerciales — sin necesidad de construir el caso.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ToolCard
            to="/herramientas/capacidad-pago"
            title="Análisis de capacidad de pago"
            Icon={ShieldCheck}
            tagline="Regla 30% / 40% VIS · Motor IA"
            description="Sube nóminas, carta laboral y renta del titular (y opcional codeudor) y calcula al instante el % de endeudamiento contra una cuota propuesta. Ideal para sustentar propuestas comerciales antes de radicar."
            bullets={[
              "Soporta empleados mensuales/quincenales e independientes",
              "Lee PDFs e imágenes con IA, semáforo automático",
              "No requiere expediente — úsalo en frío con el cliente",
            ]}
          />
          <ToolCard
            to="/herramientas/proyeccion"
            title="Proyección financiera"
            Icon={LineChart}
            tagline="Lectura IA del extracto + escenarios"
            description="Carga un extracto bancario (cualquier banco hipotecario o leasing) y construye escenarios ilimitados con abonos extra y/o renegociación. Compara intereses evitados y meses eliminados."
            bullets={[
              "Motor de lectura inteligente para todos los bancos",
              "Compara escenarios actual vs optimizado",
              "Exporta PDF para enviar al cliente",
            ]}
          />
        </div>

        <div className="mt-10 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-[#84B98F] mt-0.5" />
            <div className="text-sm text-white/65">
              <b className="text-white">Tip:</b> usa estas herramientas para validar la viabilidad antes de crear el caso. Si el cliente acepta la propuesta, podrás convertir la simulación en un expediente con un clic desde la propia herramienta.
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 md:grid-cols-3 text-xs text-white/40">
          <Meta Icon={FileBarChart} title="Motor IA Gemini 2.5 Pro" sub="Lectura de extractos y nóminas" />
          <Meta Icon={ShieldCheck} title="Reglas Superfinanciera" sub="30% No VIS · 40% VIS" />
          <Meta Icon={LineChart} title="Proyección mes a mes" sub="Amortización completa" />
        </div>
      </div>
    </div>
  );
}

function ToolCard({ to, title, Icon, tagline, description, bullets }: {
  to: string; title: string; Icon: React.ComponentType<{ className?: string }>;
  tagline: string; description: string; bullets: string[];
}) {
  return (
    <Link to={to}
      className="group relative overflow-hidden rounded-3xl p-7 transition-all hover:translate-y-[-2px]"
      style={{
        background: "linear-gradient(180deg, rgba(36,36,36,0.65), rgba(16,16,16,0.65))",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 30px 60px -40px rgba(0,0,0,0.9)",
      }}>
      <div className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(68,93,163,0.25), transparent 70%)" }} />
      <div className="relative">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#84B98F]">{tagline}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{description}</p>
        <ul className="mt-4 space-y-1.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-[12.5px] text-white/55">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-[#84B98F]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-white/80 group-hover:text-white">
          Abrir herramienta <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function Meta({ Icon, title, sub }: { Icon: React.ComponentType<{ className?: string }>; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
      <Icon className="h-4 w-4 text-white/50" />
      <div>
        <div className="text-[12px] font-medium text-white/70">{title}</div>
        <div className="text-[10.5px] text-white/40">{sub}</div>
      </div>
    </div>
  );
}
