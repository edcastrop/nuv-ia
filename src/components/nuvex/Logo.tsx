import logoNuvex from "@/assets/logo-nuvex.png";

type Variant = "color" | "white";

interface LogoProps {
  variant?: Variant;
  className?: string;
  height?: number;
  alt?: string;
}

/**
 * Logo oficial NUVEX.
 * - variant="color": logo azul original (sobre fondos claros)
 * - variant="white": logo en blanco (sobre fondos oscuros) usando filtro CSS
 */
export function Logo({ variant = "color", className = "", height = 40, alt = "NUVEX — Finanzas Inteligentes" }: LogoProps) {
  return (
    <img
      src={logoNuvex}
      alt={alt}
      style={{
        height,
        width: "auto",
        filter: variant === "white" ? "brightness(0) invert(1)" : undefined,
      }}
      className={className}
      draggable={false}
    />
  );
}

export default Logo;
