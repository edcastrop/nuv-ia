import { ESTADO_COLORS, type EstadoExpediente } from "@/lib/expedientes";

export function EstadoBadge({ estado }: { estado: EstadoExpediente }) {
  const c = ESTADO_COLORS[estado];
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
      style={{ backgroundColor: c.bg, color: c.color, borderColor: c.border }}
    >
      {estado}
    </span>
  );
}
