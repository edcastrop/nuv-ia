import { usePresenciaOnline } from "@/hooks/usePresenciaOnline";
import { formatUltimaVez } from "@/lib/presencia";

interface Props {
  userId: string;
  lastSeenAt?: string | null;
  visible?: boolean;        // presencia_visible — si false, siempre offline
  size?: "sm" | "md";
  showText?: boolean;       // muestra texto "En línea" / "Última vez…" al lado
  className?: string;
}

/**
 * Indicador estilo redes sociales: punto verde si está en línea ahora,
 * gris si no, con tooltip mostrando la última vez.
 * Respeta el toggle de privacidad (visible=false → siempre gris, sin texto).
 */
export function PresenceDot({ userId, lastSeenAt, visible = true, size = "sm", showText = false, className = "" }: Props) {
  const online = usePresenciaOnline();
  const isOnline = visible && online.has(userId);
  const dim = size === "sm" ? 8 : 10;
  const color = isOnline ? "#22c55e" : "#9ca3af";
  const titulo = !visible
    ? "Estado oculto"
    : isOnline
      ? "En línea ahora"
      : formatUltimaVez(lastSeenAt);

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={titulo}>
      <span
        aria-label={titulo}
        style={{
          display: "inline-block",
          width: dim,
          height: dim,
          borderRadius: "9999px",
          background: color,
          boxShadow: isOnline ? "0 0 0 2px rgba(34,197,94,0.18)" : "none",
        }}
      />
      {showText && (
        <span className="text-[11px] text-[#242424]/60">
          {!visible ? "Estado oculto" : isOnline ? "En línea" : formatUltimaVez(lastSeenAt)}
        </span>
      )}
    </span>
  );
}
