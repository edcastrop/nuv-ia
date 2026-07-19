// Laboratorio NUVIA · Pestaña AUDITORÍA
import type { ValidacionCoherencia } from "@/lib/reconstructor/lab/types";

const COLOR = {
  VERDE: "#84B98F",
  AMARILLO: "#F4C15A",
  ROJO: "#E5665A",
} as const;

export function LabAuditoriaTab({ coherencia }: { coherencia: ValidacionCoherencia[] }) {
  if (!coherencia.length) {
    return <p className="text-[13px] text-white/60">Aún no hay validaciones para mostrar.</p>;
  }
  return (
    <ul className="space-y-2">
      {coherencia.map((c) => (
        <li key={c.codigo + c.titulo} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-white">{c.titulo}</span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: `${COLOR[c.severidad]}22`, color: COLOR[c.severidad] }}
            >
              {c.severidad}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-white/70">
            Esperado: {c.esperado === null ? "—" : c.esperado.toFixed(2)} · Observado:{" "}
            {c.observado === null ? "—" : c.observado.toFixed(2)}
            {c.diferenciaPct !== null && ` · Δ ${(c.diferenciaPct * 100).toFixed(3)} %`}
          </div>
          <div className="text-[11px] text-white/60">{c.explicacion}</div>
          <div className="text-[11px] text-white/50">→ {c.recomendacion}</div>
        </li>
      ))}
    </ul>
  );
}
