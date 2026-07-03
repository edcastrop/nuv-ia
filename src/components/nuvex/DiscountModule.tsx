import { Card, SectionTitle, TextField, Alert } from "./ui";
import { NSelect } from "@/components/nuvia";
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

export function normalizeDiscountState(value: unknown): DiscountState {
  const raw = value && typeof value === "object" ? (value as Partial<DiscountState>) : {};
  const type: DiscountType = raw.type === "fixed" ? "fixed" : "percent";
  const vigencia = String(raw.vigencia ?? "");

  return {
    type,
    value: String(raw.value ?? ""),
    vigencia,
  };
}

export function computeDiscount(honorariosBase: number, d: DiscountState) {
  const normalized = normalizeDiscountState(d);
  const raw = parseFloat(
    String(normalized.value).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."),
  ) || 0;
  let descuentoSolicitado = 0;
  if (normalized.type === "percent") descuentoSolicitado = (honorariosBase * raw) / 100;
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
  const safeState = normalizeDiscountState(state);
  const { descuento, final, hasDiscount, bloqueado, aplicaPiso } = computeDiscount(
    honorariosBase,
    safeState,
  );
  const set = <K extends keyof DiscountState>(k: K, v: DiscountState[K]) =>
    onChange({ ...safeState, [k]: v });

  return (
    <Card>
      <SectionTitle sub="Aplica únicamente un descuento comercial manual en porcentaje o valor fijo.">
        Descuento comercial (opcional)
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold tracking-[0.08em] uppercase" style={{ color: "rgba(225,232,248,0.65)" }}>
            Tipo de descuento
          </span>
          <NSelect
            value={safeState.type}
            onValueChange={(v) => set("type", v as DiscountType)}
            options={[
              { value: "percent", label: "Porcentaje (%)" },
              { value: "fixed", label: "Valor fijo ($)" },
            ]}
            compact={false}
          />
        </label>
        <TextField
          label={safeState.type === "percent" ? "Descuento (%)" : "Descuento ($)"}
          value={safeState.value}
          onChange={(v) => set("value", v)}
          placeholder={safeState.type === "percent" ? "20" : "3.000.000"}
        />
        <TextField
          label="Vigencia comercial (opcional)"
          value={safeState.vigencia}
          onChange={(v) => set("vigencia", v)}
          placeholder="30 nov 2026"
        />
        <div
          className="flex flex-col justify-center rounded-xl p-3.5"
          style={{
            background:
              "linear-gradient(140deg, rgba(31,210,134,0.14) 0%, rgba(31,210,134,0.05) 100%)",
            border: "1px solid rgba(31,210,134,0.40)",
            boxShadow:
              "0 0 24px -8px rgba(31,210,134,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#7EE5B0" }}>
            Honorarios finales
          </div>
          <div className="mt-1 text-xl font-extrabold leading-tight" style={{ color: "#B8F5D2" }}>
            {formatCOP(final)}
          </div>
          {hasDiscount && (
            <div className="mt-1 text-[10px] font-medium" style={{ color: "rgba(184,245,210,0.80)" }}>
              Originales {formatCOP(honorariosBase)} · −{formatCOP(descuento)}
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
