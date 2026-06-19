// Avatar circular con iniciales del analista. Color NUVIA uniforme.
import { useMemo } from "react";

export function getIniciales(nombre?: string | null, email?: string | null): string {
  const n = (nombre ?? "").trim();
  if (n) {
    // Convención: primera letra del primer nombre + primera letra del primer apellido.
    // Ej: "Marcela Gomez Sierra" → MG (no MS).
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    // Heurística: si hay 3+ tokens asumimos [nombre(s)... apellido1 apellido2] y tomamos
    // el primer token y el penúltimo (primer apellido). Con 2 tokens, primer+segundo.
    const first = parts[0][0];
    const second = parts.length >= 3 ? parts[parts.length - 2][0] : parts[1][0];
    return (first + second).toUpperCase();
  }
  const e = (email ?? "").trim();
  if (e) return e.slice(0, 2).toUpperCase();
  return "—";
}

export function AnalistaAvatar({
  nombre,
  email,
  size = 22,
  title,
}: {
  nombre?: string | null;
  email?: string | null;
  size?: number;
  title?: string;
}) {
  const iniciales = useMemo(() => getIniciales(nombre, email), [nombre, email]);
  return (
    <span
      title={title ?? nombre ?? email ?? "Sin asignar"}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-[var(--nuvia-text-primary)]"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-blue) 55%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 45%, transparent))",
        border: "1px solid color-mix(in oklab, var(--nuvia-accent-blue) 38%, transparent)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        letterSpacing: 0.3,
      }}
    >
      {iniciales}
    </span>
  );
}
