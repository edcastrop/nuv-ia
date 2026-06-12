import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";

export const Route = createFileRoute("/_authenticated/herramientas/proyeccion")({
  head: () => ({
    meta: [
      { title: "Proyección financiera · Herramientas NUVIA" },
      { name: "description", content: "Lectura IA del extracto + escenarios ilimitados sin crear caso." },
    ],
  }),
  component: ProyeccionHerramientaPage,
});

function AmbientBg() {
  return (
    <>
      <style>{`
        @keyframes nuviaNodePulse {
          0%, 100% { opacity: .38; r: 1.4px; }
          50% { opacity: .95; r: 3px; }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 18% 8%, rgba(68,93,163,0.18), transparent 56%), radial-gradient(circle at 82% 86%, rgba(132,185,143,0.14), transparent 58%), #050816",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
        aria-hidden="true"
      >
        <svg className="h-full w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="proyeccion-link" x1="0" x2="1">
              <stop offset="0%" stopColor="#445DA3" />
              <stop offset="100%" stopColor="#84B98F" />
            </linearGradient>
          </defs>
          {Array.from({ length: 26 }).map((_, i) => {
            const x1 = (i * 137) % 100;
            const y1 = (i * 71) % 100;
            const x2 = (x1 + 17 + (i % 7) * 4) % 100;
            const y2 = (y1 + 23 + (i % 5) * 5) % 100;
            return (
              <line key={`l${i}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="url(#proyeccion-link)" strokeWidth="0.6">
                <animate attributeName="opacity" values="0.2;0.9;0.2" dur={`${5 + (i % 5)}s`} repeatCount="indefinite" />
              </line>
            );
          })}
          {Array.from({ length: 34 }).map((_, i) => {
            const cx = (i * 53) % 100;
            const cy = (i * 89) % 100;
            return <circle key={`n${i}`} cx={`${cx}%`} cy={`${cy}%`} r="1.6" fill={i % 2 === 0 ? "#445DA3" : "#84B98F"} style={{ animation: `nuviaNodePulse ${3 + (i % 4)}s ease-in-out infinite` }} />;
          })}
        </svg>
      </div>
      <motion.div
        className="pointer-events-none absolute top-[-10rem] left-[-8rem] z-0 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #445DA3, transparent 70%)", opacity: 0.22 }}
        animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[-10rem] right-[-8rem] z-0 h-[40rem] w-[40rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #84B98F, transparent 70%)", opacity: 0.18 }}
        animate={{ x: [0, -70, 0], y: [0, -40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function ProyeccionHerramientaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816]">
      <AmbientBg />
      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <Link
            to="/herramientas"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
          </Link>
        </div>
        <ProyeccionFinancieraView />
      </div>
    </div>
  );
}
