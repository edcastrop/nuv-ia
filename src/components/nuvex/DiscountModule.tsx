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

const LEGACY_QUICK_DECISION_VIGENCIAS = new Set([
  "12h",
  "12 h",
  "12 horas",
  "24h",
  "24 h",
  "24 horas",
  "48h",
  "48 h",
  "48 horas",
]);

export function normalizeDiscountState(value: unknown): DiscountState {
  const raw = value && typeof value === "object" ? (value as Partial<DiscountState>) : {};
  const type: DiscountType = raw.type === "fixed" ? "fixed" : "percent";
  const vigencia = String(raw.vigencia ?? "").trim();

  return {
    type,
    value: String(raw.value ?? ""),
    vigencia: LEGACY_QUICK_DECISION_VIGENCIAS.has(vigencia.toLowerCase()) ? "" : vigencia,
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-[#242424]/70">
            Tipo de descuento
          </span>
          <select
            value={safeState.type}
            onChange={(e) => set("type", e.target.value as DiscountType)}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
          >
            <option value="percent">Porcentaje (%)</option>
            <option value="fixed">Valor fijo ($)</option>
          </select>
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
