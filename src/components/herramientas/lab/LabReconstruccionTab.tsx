// Laboratorio NUVIA · Pestaña RECONSTRUCCIÓN
import type {
  CategoriaFinanciera,
  DiagnosticoIdentificabilidad,
  EvidenciaVariable,
  HipotesisReconstruccion,
} from "@/lib/reconstructor/lab/types";

export interface LabReconstruccionTabProps {
  faltantes: CategoriaFinanciera[];
  reconstrucciones: EvidenciaVariable[];
  hipotesis: HipotesisReconstruccion[];
  identificabilidad: DiagnosticoIdentificabilidad[];
}

export function LabReconstruccionTab({
  faltantes,
  reconstrucciones,
  hipotesis,
  identificabilidad,
}: LabReconstruccionTabProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          Variables faltantes
        </h4>
        {faltantes.length === 0 ? (
          <p className="text-[12.5px] text-white/60">Sin faltantes críticas.</p>
        ) : (
          <ul className="space-y-1 text-[12.5px] text-white/80">
            {faltantes.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          Reconstrucciones
        </h4>
        <ul className="space-y-2 text-[12.5px] text-white/80">
          {reconstrucciones.map((e, i) => (
            <li key={i} className="rounded border border-white/10 p-2">
              <div className="flex justify-between">
                <span className="font-semibold text-white">{e.categoria}</span>
                <span className="text-white/70">{e.estado}</span>
              </div>
              <div className="text-white/70">
                Valor: {e.valor === null ? "—" : e.valor.toFixed(4)} · Confianza mat.: {e.confianzaMatematica}
              </div>
              <div className="text-[11px] text-white/50">{e.formula}</div>
              {e.variablesInferidas.length > 0 && (
                <div className="text-[11px] text-amber-300/80">
                  Inferidas: {e.variablesInferidas.join(", ")}
                </div>
              )}
              {e.supuestos.length > 0 && (
                <div className="text-[11px] text-white/50">Supuestos: {e.supuestos.join(", ")}</div>
              )}
              {e.advertencias.length > 0 && (
                <div className="text-[11px] text-amber-300">⚠ {e.advertencias.join("; ")}</div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {hipotesis.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
            Hipótesis evaluadas (composición de cuota)
          </h4>
          <ul className="space-y-2 text-[12.5px] text-white/80">
            {hipotesis.map((h) => (
              <li key={h.id} className="rounded border border-white/10 p-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-white">{h.id}</span>
                  <span className={h.seleccionada ? "text-emerald-300" : h.descartada ? "text-white/50" : "text-amber-300"}>
                    {h.seleccionada ? "SELECCIONADA" : h.descartada ? "DESCARTADA" : "AMBIGUA"}
                  </span>
                </div>
                <div className="text-[11px] text-white/60">{h.descripcion}</div>
                <div className="text-[11px] text-white/50">
                  Composición: {h.composicionCuota.join(" + ")} · Error rel.: {h.error === null ? "—" : (h.error * 100).toFixed(4) + " %"}
                </div>
                {h.razonDescarte && <div className="text-[11px] text-white/50">{h.razonDescarte}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          Identificabilidad
        </h4>
        <ul className="space-y-1 text-[12.5px] text-white/80">
          {identificabilidad.map((d, i) => (
            <li key={i}>
              <span className="font-semibold text-white">{d.categoria}</span> · {d.identificabilidad}
              <span className="text-[11px] text-white/50"> — {d.razon}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
