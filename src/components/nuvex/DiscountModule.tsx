import { Card, SectionTitle, TextField, Alert } from "./ui";
import { NUVEX } from "./constants";
import { formatCOP } from "../../lib/format";
import { HONORARIOS_MIN_BASE, HONORARIOS_MIN_FINAL } from "../../lib/finance";

export type DiscountType = "percent" | "fixed";

export interface DiscountState {
  type: DiscountType;
  value: string;
  vigencia: string;
}

export const defaultDiscount: DiscountState = {
  type: "percent",
  value: "",
  vigencia: "",
};

export function computeDiscount(honorariosBase: number, d: DiscountState) {
  const raw = parseFloat(
    String(d.value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  ) || 0;
  let descuentoSolicitado = 0;
  if (d.type === "percent") descuentoSolicitado = (honorariosBase * raw) / 100;
  else descuentoSolicitado = raw;
  descuentoSolicitado = Math.max(0, Math.min(descuentoSolicitado, honorariosBase));

  // Piso comercial: cuando los honorarios base están en el mínimo ($2.000.000),
  // el final no puede bajar de $1.800.000.
  const aplicaPiso = honorariosBase <= HONORARIOS_MIN_BASE + 0.5;
  const finalSolicitado = honorariosBase - descuentoSolicitado;
  const bloqueado = aplicaPiso && descuentoSolicitado > 0 && finalSolicitado < HONORARIOS_MIN_FINAL;

  const descuento = bloqueado ? 0 : descuentoSolicitado;
  const final = Math.max(0, honorariosBase - descuento);

  return {
    descuento,
    final,
    hasDiscount: descuento > 0,
    rawValue: raw,
    bloqueado,
    aplicaPiso,
    descuentoSolicitado,
    finalSolicitado,
  };
}

export function DiscountModule({
  honorariosBase,
  state,
  onChange,
}: {
  honorariosBase: number;
  state: DiscountState;
  onChange: (s: DiscountState) => void;
}) {
  const { descuento, final, hasDiscount, bloqueado, aplicaPiso } = computeDiscount(
    honorariosBase,
    state,
  );
  const set = <K extends keyof DiscountState>(k: K, v: DiscountState[K]) =>
    onChange({ ...state, [k]: v });

  return (
    <Card>
      <SectionTitle sub="Beneficio comercial autorizado para impulsar el cierre">
        Descuento comercial sobre honorarios
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[#242424]/70">
            Tipo de descuento
          </span>
          <select
            value={state.type}
            onChange={(e) => set("type", e.target.value as DiscountType)}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
          >
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Valor fijo ($)</option>
          </select>
        </label>
        <TextField
          label={state.type === "percent" ? "Descuento (%)" : "Descuento ($)"}
          value={state.value}
          onChange={(v) => set("value", v)}
          placeholder={state.type === "percent" ? "20" : "3.000.000"}
        />
        <TextField
          label="Vigencia del beneficio (opcional)"
          value={state.vigencia}
          onChange={(v) => set("vigencia", v)}
          placeholder="48 horas / 30 nov 2026"
        />
        <div
          className="flex flex-col justify-center rounded-xl p-3"
          style={{ backgroundColor: NUVEX.verdeClaro, border: `2px solid ${NUVEX.verde}` }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#1F7A45" }}>
            Honorarios finales
          </div>
          <div className="mt-0.5 text-xl font-extrabold leading-tight" style={{ color: "#1F7A45" }}>
            {formatCOP(final)}
          </div>
          {hasDiscount && (
            <div className="text-[10px]" style={{ color: "#1F7A45", opacity: 0.85 }}>
              Honorarios originales {formatCOP(honorariosBase)} · Descuento −{formatCOP(descuento)}
            </div>
          )}
        </div>
      </div>
      {bloqueado && (
        <div className="mt-3">
          <Alert tone="error">
            El descuento supera el límite comercial autorizado para honorarios mínimos. El honorario final no puede ser inferior a {formatCOP(HONORARIOS_MIN_FINAL)}.
          </Alert>
        </div>
      )}
      {aplicaPiso && !bloqueado && (
        <div className="mt-3">
          <Alert>
            Honorarios en mínimo comercial ({formatCOP(HONORARIOS_MIN_BASE)}). Descuento máximo permitido: {formatCOP(HONORARIOS_MIN_BASE - HONORARIOS_MIN_FINAL)}.
          </Alert>
        </div>
      )}
    </Card>
  );
}
