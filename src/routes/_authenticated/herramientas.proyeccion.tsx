import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";

export const Route = createFileRoute("/_authenticated/herramientas/proyeccion")({
  head: () => ({
    meta: [
      { title: "Proyección financiera · Herramientas NUVEX" },
      { name: "description", content: "Lectura IA del extracto + escenarios ilimitados sin crear caso." },
    ],
  }),
  component: ProyeccionHerramientaPage,
});

function AmbientBg() {
  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-[-12rem] left-[-10rem] h-[40rem] w-[40rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #445DA3, transparent 70%)", opacity: 0.35 }}
        animate={{ x: [0, 80, 0], y: [0, 50, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none fixed bottom-[-12rem] right-[-10rem] h-[44rem] w-[44rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #84B98F, transparent 70%)", opacity: 0.30 }}
        animate={{ x: [0, -80, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none fixed top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #9333EA, transparent 70%)", opacity: 0.18 }}
        animate={{ x: [-40, 40, -40], y: [-20, 20, -20] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function ProyeccionHerramientaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0B0C]">
      <AmbientBg />
      <div className="relative">
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <Link
            to="/herramientas"
            className="inline-flex items-center gap-1.5 text-sm text-white/65 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
          </Link>
        </div>
        <ProyeccionFinancieraView />
      </div>
    </div>
  );
}
