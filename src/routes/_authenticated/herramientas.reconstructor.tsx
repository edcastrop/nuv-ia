import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Wrench, Sparkles } from "lucide-react";
import { ReconstructorFinancieroTool } from "@/components/herramientas/ReconstructorFinancieroTool";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated/herramientas/reconstructor")({
  head: () => ({
    meta: [
      { title: "Reconstructor Financiero · Herramientas NUVEX" },
      {
        name: "description",
        content:
          "Reconstruye tasa, cuota, saldo y plazo de créditos hipotecarios y leasing habitacional en Pesos o UVR. Sin persistencia y sin datos personales.",
      },
    ],
  }),
  component: ReconstructorPage,
});

function ReconstructorPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(65% 55% at 15% 10%, rgba(68,93,163,0.35), transparent 60%), radial-gradient(60% 55% at 85% 90%, rgba(132,185,143,0.22), transparent 60%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-6xl px-6 py-8">
        <Link
          to="/herramientas"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
        </Link>

        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 flex items-center gap-4"
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
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#84B98F]">
              <Sparkles size={11} /> NUVIA · Motor determinista
            </div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              Reconstructor Financiero NUVIA
            </h1>
            <p className="mt-1 text-[13px] text-white/60">
              Halla, reconstruye, valida y concilia variables financieras. Sin persistencia, sin IA
              generativa y sin datos personales.
            </p>
          </div>
        </motion.header>

        <ReconstructorFinancieroTool />
      </div>
    </div>
  );
}
