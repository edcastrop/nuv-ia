import { SectionTitle, TextField } from "./ui";
import { NUVEX } from "./constants";
import type { Cobertura } from "./intervinientes";

interface Props {
  producto?: string | null;
  data: Cobertura;
  onChange: (next: Cobertura) => void;
}

export function CoberturaFields({ data, onChange }: Props) {
  const active = data.activo || !!data.valorCobertura || !!data.tasaCobertura;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: NUVEX.verde, backgroundColor: NUVEX.verdeClaro }}
    >
      <div className="flex items-start justify-between gap-4">
        <SectionTitle sub="Cobertura FRECH / Tasa Fresh. Se incluye en la propuesta y los documentos generados si está activa.">
          Beneficio de cobertura (FRECH / Fresh)
        </SectionTitle>
        <label className="flex items-center gap-2 text-xs font-medium text-[#242424] shrink-0">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) =>
              onChange({
                ...data,
                activo: e.target.checked,
                valorCobertura: e.target.checked ? data.valorCobertura : "",
                tasaCobertura: e.target.checked ? data.tasaCobertura : "",
              })
            }
          />
          Activar
        </label>
      </div>
      {active && (
        <>
          <div className="grid gap-4 md:grid-cols-2 mt-2">
            <TextField
              label="Valor de cobertura"
              value={data.valorCobertura}
              onChange={(v) => onChange({ ...data, valorCobertura: v, activo: true })}
              placeholder="$ 12.000.000"
            />
            <TextField
              label="Tasa de cobertura (%)"
              value={data.tasaCobertura}
              onChange={(v) => onChange({ ...data, tasaCobertura: v, activo: true })}
              placeholder="4,00"
            />
          </div>
          <p className="mt-3 text-[11px] text-[#242424]/70">
            Estos datos no modifican la fórmula financiera base. Se muestran, guardan
            y exportan como referencia oficial.
          </p>
        </>
      )}
    </div>
  );
}
