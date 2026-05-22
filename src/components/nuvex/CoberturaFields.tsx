import { SectionTitle, TextField } from "./ui";
import { NUVEX } from "./constants";
import { tieneCobertura, type Cobertura } from "./intervinientes";

interface Props {
  producto?: string | null;
  data: Cobertura;
  onChange: (next: Cobertura) => void;
}

export function CoberturaFields({ producto, data, onChange }: Props) {
  if (!tieneCobertura(producto)) return null;

  const active = data.activo || !!data.valorCobertura || !!data.tasaCobertura;

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: NUVEX.verde, backgroundColor: NUVEX.verdeClaro }}
    >
      <SectionTitle sub="Campos opcionales. Se incluyen en la propuesta y los documentos generados.">
        Beneficio de cobertura
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Valor de cobertura"
          value={data.valorCobertura}
          onChange={(v) => onChange({ ...data, valorCobertura: v, activo: active || !!v })}
          placeholder="$ 12.000.000"
        />
        <TextField
          label="Tasa de cobertura (%)"
          value={data.tasaCobertura}
          onChange={(v) => onChange({ ...data, tasaCobertura: v, activo: active || !!v })}
          placeholder="4,00"
        />
      </div>
      <p className="mt-3 text-[11px] text-[#242424]/70">
        Estos datos no modifican la fórmula financiera base. Se muestran, guardan
        y exportan como referencia oficial.
      </p>
    </div>
  );
}
