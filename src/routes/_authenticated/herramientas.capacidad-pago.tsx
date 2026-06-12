import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Calculator, Sparkles } from "lucide-react";
import { CapacidadPagoTool } from "@/components/herramientas/CapacidadPagoTool";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated/herramientas/capacidad-pago")({
  head: () => ({
    meta: [
      { title: "Capacidad de pago · Herramientas NUVEX" },
      { name: "description", content: "Calcula el % de endeudamiento del cliente con IA, sin crear expediente." },
    ],
  }),
  component: CapacidadPagoPage,
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
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-40" preserveAspectRatio="none">
        <defs>
          <linearGradient id="cap-link" x1="0" x2="1">
            <stop offset="0%" stopColor={NUVEX.azul} />
            <stop offset="100%" stopColor={NUVEX.verde} />
          </linearGradient>
        </defs>
        {Array.from({ length: 22 }).map((_, i) => {
          const x1 = (i * 137) % 100;
          const y1 = (i * 71) % 100;
          const x2 = (x1 + 17 + (i % 7) * 4) % 100;
          const y2 = (y1 + 23 + (i % 5) * 5) % 100;
          return (
            <line key={`l${i}`} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`} stroke="url(#cap-link)" strokeWidth="0.6">
              <animate attributeName="opacity" values="0.2;0.9;0.2" dur={`${5 + (i % 5)}s`} repeatCount="indefinite" />
            </line>
          );
        })}
        {Array.from({ length: 28 }).map((_, i) => {
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

function CapacidadPagoPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <NeuralBg />
      <div className="relative mx-auto w-full max-w-5xl px-6 py-8">
        <Link
          to="/herramientas"
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white mb-6 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
        </Link>

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-4 mb-6"
        >
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 backdrop-blur-xl"
            style={{
              background: "linear-gradient(135deg, rgba(68,93,163,0.85), rgba(132,185,143,0.85))",
              boxShadow: `0 16px 40px -16px ${NUVEX.verde}`,
            }}
          >
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-[#84B98F]">
              <Sparkles size={11} /> NUVIA · Motor financiero
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Análisis de capacidad de pago</h1>
          </div>
        </motion.header>

        <CapacidadPagoTool />
      </div>
    </div>
  );
}
