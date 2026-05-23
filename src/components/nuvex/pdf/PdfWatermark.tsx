import logoNuvex from "@/assets/logo-nuvex.png";

/**
 * Marca de agua institucional NUVEX (5% opacidad).
 * Se renderiza dentro de cada `.nuvex-print-page` con position absolute,
 * detrás del contenido (zIndex 0). El contenido debe ir con `position: relative`
 * y `zIndex: 1` para quedar por encima.
 */
export function PdfWatermark({
  opacity = 0.05,
  rotate = -28,
  widthPct = 78,
}: {
  opacity?: number;
  rotate?: number;
  /** Ancho como % del contenedor (default 78%). */
  widthPct?: number;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <img
        src={logoNuvex}
        alt=""
        style={{
          width: `${widthPct}%`,
          maxWidth: "180mm",
          opacity,
          transform: `rotate(${rotate}deg)`,
          objectFit: "contain",
          userSelect: "none",
        }}
        draggable={false}
      />
    </div>
  );
}

export default PdfWatermark;
