// Laboratorio NUVIA · Pestaña DIAGNÓSTICO
import type { DiagnosticoEjecutivo } from "@/lib/reconstructor/lab/types";

export function LabDiagnosticoTab({ diagnostico }: { diagnostico: DiagnosticoEjecutivo | null }) {
  if (!diagnostico) {
    return <p className="text-[13px] text-white/60">Aún no hay diagnóstico.</p>;
  }
  const d = diagnostico;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Kpi label="Encontradas" value={d.variablesEncontradas} />
        <Kpi label="Faltantes" value={d.variablesFaltantes} />
        <Kpi label="Reconstruidas" value={d.variablesReconstruidas} />
        <Kpi label="Estimadas" value={d.variablesEstimadas} />
        <Kpi label="Imposibles" value={d.variablesImposibles} />
        <Kpi label="Inconsistencias" value={d.inconsistencias} />
        <Kpi label="Ambigüedades" value={d.ambiguedades} />
        <Kpi
          label="Confiabilidad"
          value={`${d.confiabilidadGlobal} · ${(d.confiabilidadGlobalScore * 100).toFixed(1)} %`}
        />
      </div>

      <Section title="Conclusiones" items={d.conclusiones} />
      <Section title="Recomendaciones" items={d.recomendaciones} />
      <Section title="Pendientes con el banco" items={d.pendientes} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">{label}</div>
      <div className="mt-1 text-[16px] font-bold text-white">{value}</div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
        {title}
      </h4>
      <ul className="space-y-1 text-[12.5px] text-white/80">
        {items.map((it, i) => (
          <li key={i}>• {it}</li>
        ))}
      </ul>
    </section>
  );
}
