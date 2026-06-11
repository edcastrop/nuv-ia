import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { BrandLockup, BrandMark } from "./BrandMark";

/**
 * NUVIA · AuthShell
 * Layout split-screen canónico (fuente: Login/Registro).
 *
 *  - Izquierda: canvas oscuro con grid + orbs animados + slot `brandSide`.
 *  - Derecha:   contenedor centrado con slot `children` (típicamente <GlassCard/>).
 *
 * Reusable para: login, registro, MFA, recuperar password, onboarding inicial, etc.
 */
interface Props {
  /** Contenido del panel izquierdo (narrativa de marca, métricas, etc.). */
  brandSide?: ReactNode;
  /** Contenido del panel derecho (la tarjeta del formulario). */
  children: ReactNode;
  /** Ancho del panel izquierdo en desktop. Default 55%. */
  leftWidth?: "55%" | "45%" | "50%";
}

const BLUE = "#445DA3";
const GREEN = "#84B98F";

export function AuthShell({ brandSide, children, leftWidth = "55%" }: Props) {
  const lwClass =
    leftWidth === "45%" ? "lg:w-[45%]" : leftWidth === "50%" ? "lg:w-[50%]" : "lg:w-[55%]";

  return (
    <div
      className="min-h-screen w-full flex flex-col lg:flex-row text-white"
      style={{ background: "#0A0B10" }}
    >
      {/* LEFT — Brand canvas */}
      <aside
        className={`relative overflow-hidden ${lwClass} min-h-[36vh] lg:min-h-screen nuvia-auth-bg`}
      >
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none nuvia-grid-overlay" />

        <motion.div
          className="absolute -top-40 -left-40 h-[28rem] w-[28rem] rounded-full blur-[120px] opacity-40"
          style={{ background: BLUE }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-48 right-0 h-[32rem] w-[32rem] rounded-full blur-[140px] opacity-30"
          style={{ background: GREEN }}
          animate={{ x: [0, -40, 0], y: [0, -20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 flex flex-col justify-between h-full p-8 lg:p-14">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <BrandLockup />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="hidden lg:block max-w-xl"
          >
            {brandSide}
          </motion.div>

          <div className="hidden lg:flex items-center justify-between text-[11px] text-white/35">
            <span>© {new Date().getFullYear()} NUVIA Systems</span>
            <span className="tracking-widest uppercase">SOC 2 · ISO 27001</span>
          </div>
        </div>
      </aside>

      {/* RIGHT — Form area */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-14 relative">
        <div className="absolute top-6 left-6 lg:hidden flex items-center gap-2">
          <BrandMark size={28} />
          <span className="text-sm font-semibold tracking-[0.2em]">NUVIA</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="w-full max-w-2xl"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
