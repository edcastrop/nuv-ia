import logoNuvex from "@/assets/logo-nuvex.png";
import { NUVEX, CORPORATIVO } from "../constants";

type Variant = "commercial" | "operational";

/**
 * Header institucional NUVEX para PDFs.
 * - variant="commercial": banda azul-oscuro con logo invertido (familia comercial).
 * - variant="operational": fondo blanco con franja azul inferior (familia operativa).
 *
 * Logo 2.5× más grande que la versión anterior (≈ 60-72px de alto).
 */
export function PdfBrandHeader({
  variant = "commercial",
  fecha,
  cliente,
  documento,
}: {
  variant?: Variant;
  fecha: string;
  cliente?: string;
  /** Etiqueta del documento (ej. "Propuesta financiera", "Resultado final"). */
  documento: string;
}) {
  const isCommercial = variant === "commercial";
  const bg = isCommercial
    ? `linear-gradient(135deg, ${NUVEX.azul} 0%, #2E4178 100%)`
    : "#FFFFFF";
  const fg = isCommercial ? "#FFFFFF" : NUVEX.negro;
  const subFg = isCommercial ? "rgba(255,255,255,0.78)" : "#5C6770";

  return (
    <div
      style={{
        position: "relative",
        background: bg,
        color: fg,
        padding: "18px 22px 16px",
        borderBottom: isCommercial ? "none" : `3px solid ${NUVEX.azul}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
        <img
          src={logoNuvex}
          alt="NUVEX"
          style={{
            height: 64,
            width: "auto",
            filter: isCommercial ? "brightness(0) invert(1)" : undefined,
            display: "block",
          }}
          draggable={false}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: fg,
              textTransform: "uppercase",
            }}
          >
            NUVEX Finanzas Inteligentes
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: "0.18em",
              color: subFg,
              textTransform: "uppercase",
            }}
          >
            {CORPORATIVO.ciudades}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.32em",
            color: subFg,
            textTransform: "uppercase",
          }}
        >
          {documento}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: fg, letterSpacing: "0.04em" }}>
          {fecha}
        </div>
        {cliente && (
          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              color: subFg,
              maxWidth: 220,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cliente}
          </div>
        )}
      </div>
    </div>
  );
}

export default PdfBrandHeader;
