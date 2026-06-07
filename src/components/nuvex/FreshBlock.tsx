import { Card, SectionTitle, TextField } from "./ui";
import { NUVEX } from "./constants";
import type { Cobertura } from "./intervinientes";

interface Props {
  data: Cobertura;
  onChange: (next: Cobertura) => void;
}

/**
 * Bloque compacto "Beneficio Fresh".
 * Toggle SI/NO. Si SI, se muestran 3 campos: valor beneficio, tasa beneficio,
 * cuotas restantes del beneficio. Mantiene la persistencia en Cobertura
 * para no romper el resto del sistema.
 */
export function FreshBlock({ data, onChange }: Props) {
  const set = <K extends keyof Cobertura>(k: K, v: Cobertura[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <Card>
      <SectionTitle sub="Aplica solo si el crédito tiene un beneficio Fresh / cobertura vigente.">
        Beneficio Fresh
      </SectionTitle>

      <div className="inline-flex rounded-lg border border-[#E3E7EE] bg-white p-1">
        <button
          type="button"
          onClick={() => onChange({ ...data, activo: true })}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
            data.activo ? "text-white shadow" : "text-[#242424]/70"
          }`}
          style={data.activo ? { backgroundColor: NUVEX.verde } : undefined}
        >
          SI tiene beneficio
        </button>
        <button
          type="button"
          onClick={() =>
            onChange({
              ...data,
              activo: false,
              valorCobertura: "",
              tasaCobertura: "",
              cuotasRestantesBeneficio: "",
            })
          }
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition ${
            !data.activo ? "text-white shadow" : "text-[#242424]/70"
          }`}
          style={!data.activo ? { backgroundColor: NUVEX.negro } : undefined}
        >
          NO aplica
        </button>
      </div>

      {data.activo && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TextField
            label="Valor beneficio (mensual)"
            value={data.valorCobertura}
            onChange={(v) => set("valorCobertura", v)}
            placeholder="450.000"
          />
          <TextField
            label="Tasa beneficio (%)"
            value={data.tasaCobertura}
            onChange={(v) => set("tasaCobertura", v)}
            placeholder="5,00"
          />
          <TextField
            label="Cuotas restantes del beneficio"
            value={data.cuotasRestantesBeneficio ?? ""}
            onChange={(v) => set("cuotasRestantesBeneficio", v)}
            placeholder="48"
          />
        </div>
      )}
    </Card>
  );
}
