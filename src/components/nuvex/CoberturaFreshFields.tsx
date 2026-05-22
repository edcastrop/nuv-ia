import { useEffect } from "react";
import type { CoberturaFresh } from "@/lib/proyeccion";
import { parseCurrency, parseDecimal } from "@/lib/format";

interface Props {
  data: CoberturaFresh;
  onChange: (next: CoberturaFresh) => void;
}

const AZUL = "#445DA3";

export function CoberturaFreshFields({ data, onChange }: Props) {
  // Mantener cuotasPendientes derivado cuando el usuario edita totales/pagadas
  useEffect(() => {
    const pend = Math.max(0, (data.cuotasTotales || 0) - (data.cuotasPagadas || 0));
    if (pend !== data.cuotasPendientes) {
      onChange({ ...data, cuotasPendientes: pend });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.cuotasTotales, data.cuotasPagadas]);

  const set = <K extends keyof CoberturaFresh>(k: K, v: CoberturaFresh[K]) =>
    onChange({ ...data, [k]: v });

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(135deg, rgba(132,185,143,0.08), rgba(68,93,163,0.05))",
        border: "1px solid rgba(132,185,143,0.25)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-white">Cobertura Fresh</h3>
          <p className="text-[11.5px] text-white/55 mt-0.5">
            Componente visual de la cuota. No altera ahorro, intereses ni honorarios NUVEX.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[11.5px] font-medium text-white/75">Tiene cobertura Fresh</span>
          <input
            type="checkbox"
            checked={data.activo}
            onChange={(e) => set("activo", e.target.checked)}
            className="h-4 w-4"
            style={{ accentColor: AZUL }}
          />
        </label>
      </div>

      {data.activo && (
        <div className="grid gap-3 md:grid-cols-3">
          <Field
            label="Valor Fresh mensual ($)"
            value={data.valorMensual ? String(data.valorMensual) : ""}
            onChange={(v) => set("valorMensual", parseCurrency(v))}
            placeholder="120.000"
          />
          <Field
            label="Tasa cobertura Fresh (%)"
            value={data.tasa ? String(data.tasa) : ""}
            onChange={(v) => set("tasa", parseDecimal(v))}
            placeholder="5,00"
          />
          <Field
            label="Cuotas Fresh totales"
            value={String(data.cuotasTotales)}
            onChange={(v) => set("cuotasTotales", Math.max(0, Math.round(parseDecimal(v))))}
            placeholder="84"
          />
          <Field
            label="Cuotas Fresh pagadas"
            value={String(data.cuotasPagadas)}
            onChange={(v) => set("cuotasPagadas", Math.max(0, Math.round(parseDecimal(v))))}
            placeholder="0"
          />
          <Field
            label="Cuotas Fresh pendientes"
            value={String(data.cuotasPendientes)}
            onChange={(v) => set("cuotasPendientes", Math.max(0, Math.round(parseDecimal(v))))}
            placeholder="84"
          />
          <div className="rounded-lg px-3 py-2.5 text-[11px] text-white/65"
               style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.10)" }}>
            Por defecto: <span className="text-white">84 cuotas</span>. Pendientes = totales − pagadas.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-white/55 mb-1.5">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
      />
    </label>
  );
}
