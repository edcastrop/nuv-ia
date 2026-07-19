// Laboratorio NUVIA · Pestaña EXTRACTO
import type { ExtractoLabInput } from "@/lib/reconstructor/lab/types";

export function LabExtractoTab({ input }: { input: ExtractoLabInput | null }) {
  if (!input) {
    return (
      <p className="text-[13px] text-white/60">
        Carga un extracto para ver los campos detectados por el lector NUVIA.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-2 text-[12.5px] text-white/80 md:grid-cols-3">
        <Info label="Banco" value={input.banco} />
        <Info label="Producto" value={input.producto || "—"} />
        <Info label="Moneda" value={input.moneda} />
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          Campos detectados ({input.camposDetectados.length})
        </h4>
        <ul className="max-h-96 space-y-1 overflow-auto text-[12px] text-white/70">
          {input.camposDetectados.map((c, i) => (
            <li key={`${c.etiquetaOriginal}-${i}`} className="flex justify-between gap-2">
              <span className="text-white/60">{c.etiquetaOriginal}</span>
              <span className="text-white/90">{c.valorOriginal}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">{label}</div>
      <div className="text-[13px] font-semibold text-white">{value}</div>
    </div>
  );
}
