import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * NUVIA · Submit button con gradiente azul→verde (fuente: Login/Registro).
 */
interface Props {
  children?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  className?: string;
  /** Mostrar flecha al final (default true). */
  withArrow?: boolean;
}

export function NuviaSubmit({
  children,
  loading = false,
  loadingText = "Procesando…",
  disabled,
  type = "submit",
  onClick,
  className = "",
  withArrow = true,
}: Props) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      className={`nuvia-submit group ${className}`}
    >
      <span className="relative z-10 inline-flex items-center justify-center gap-2">
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            {loadingText}
          </>
        ) : (
          <>
            {children}
            {withArrow && (
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            )}
          </>
        )}
      </span>
    </motion.button>
  );
}
