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
        @keyframes nuviaAuroraFlow {
          0% { transform: translate3d(-8%, -6%, 0) rotate(0deg) scale(1); filter: hue-rotate(0deg); }
          35% { transform: translate3d(8%, 4%, 0) rotate(12deg) scale(1.08); filter: hue-rotate(12deg); }
          70% { transform: translate3d(-2%, 9%, 0) rotate(-10deg) scale(1.16); filter: hue-rotate(-8deg); }
          100% { transform: translate3d(-8%, -6%, 0) rotate(0deg) scale(1); filter: hue-rotate(0deg); }
        }
        @keyframes nuviaSweep {
          0% { transform: translateX(-130%) rotate(16deg); opacity: 0; }
          18% { opacity: .42; }
          52% { opacity: .18; }
          100% { transform: translateX(130%) rotate(16deg); opacity: 0; }
        }
        @keyframes nuviaPulseGrid {
          0%, 100% { opacity: .12; transform: scale(1); }
          50% { opacity: .26; transform: scale(1.015); }
        }
      `}</style>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(68,93,163,0.34), transparent 28%), radial-gradient(circle at 78% 18%, rgba(132,185,143,0.24), transparent 30%), radial-gradient(circle at 52% 76%, rgba(68,93,163,0.32), transparent 34%), #05070D",
        }}
      />
      <div
        className="pointer-events-none absolute inset-[-22%] z-0 blur-3xl"
        style={{
          background:
            "conic-gradient(from 120deg at 50% 50%, rgba(68,93,163,0.0), rgba(68,93,163,0.42), rgba(132,185,143,0.30), rgba(68,93,163,0.38), rgba(68,93,163,0.0))",
          animation: "nuviaAuroraFlow 11s ease-in-out infinite",
          opacity: 0.86,
        }}
      />
      <motion.div
        className="pointer-events-none absolute top-[-10rem] left-[-9rem] z-0 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(68,93,163,0.65), transparent 68%)", opacity: 0.82 }}
        animate={{ x: [0, 130, 30, 0], y: [0, 58, 112, 0], scale: [1, 1.24, 1.08, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-[-12rem] right-[-10rem] z-0 h-[42rem] w-[42rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(132,185,143,0.52), transparent 68%)", opacity: 0.76 }}
        animate={{ x: [0, -120, -32, 0], y: [0, -55, -110, 0], scale: [1, 1.2, 1.05, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="pointer-events-none absolute top-[-20%] bottom-[-20%] z-0 w-[28rem] blur-2xl"
        style={{
          left: "10%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.16), rgba(68,93,163,0.18), transparent)",
          animation: "nuviaSweep 5.5s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at 50% 18%, black 0%, transparent 62%)",
          animation: "nuviaPulseGrid 4s ease-in-out infinite",
        }}
      />
    </>
  );
}

function ProyeccionHerramientaPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070D]">
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
