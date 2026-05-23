import { useEffect, useMemo } from "react";
import { Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";
import type { CoberturaFresh } from "@/lib/proyeccion";
import {
  FRESH_DEFAULT_TOTAL,
  FRESH_TIPOS,
  computeFreshDerivados,
  freshIncompleto,
  normalizeTipoBeneficio,
  type FreshTipoBeneficio,
} from "@/lib/cobertura";
import { formatCOP } from "@/lib/format";
import { parseCurrency, parseDecimal } from "@/lib/format";

interface Props {
  data: CoberturaFresh;
  onChange: (next: CoberturaFresh) => void;
  /** Cuotas pagadas reales del crédito (para derivar Fresh pagadas con tope 84). */
  cuotasPagadasCredito?: number;
}

const AZUL = "#445DA3";
const VERDE = "#84B98F";

export function CoberturaFreshFields({ data, onChange, cuotasPagadasCredito }: Props) {
  // Recalcular derivados cada vez que cambian totales, pagadas del crédito o valor mensual.
  useEffect(() => {
    if (!data.activo) return;
    const d = computeFreshDerivados(data, cuotasPagadasCredito);
    if (
      d.cuotasPagadas !== data.cuotasPagadas ||
      d.cuotasPendientes !== data.cuotasPendientes ||
      d.beneficioRecibido !== (data.beneficioRecibido ?? 0) ||
      d.beneficioRestante !== (data.beneficioRestante ?? 0)
    ) {
      onChange({
        ...data,
        cuotasPagadas: d.cuotasPagadas,
        cuotasPendientes: d.cuotasPendientes,
        beneficioRecibido: d.beneficioRecibido,
        beneficioRestante: d.beneficioRestante,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    data.activo,
    data.valorMensual,
    data.cuotasTotales,
    data.cuotasPagadas,
    cuotasPagadasCredito,
  ]);

  const set = <K extends keyof CoberturaFresh>(k: K, v: CoberturaFresh[K]) =>
    onChange({ ...data, [k]: v, activo: true, fuente: data.fuente === "ocr" ? "mixto" : "manual" });

  const tipo = normalizeTipoBeneficio(data.tipoBeneficio);
  const validation = useMemo(() => freshIncompleto(data), [data]);
  const beneficioRecibido =
    data.beneficioRecibido ?? data.valorMensual * data.cuotasPagadas;
  const beneficioRestante =
    data.beneficioRestante ?? data.valorMensual * data.cuotasPendientes;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "linear-gradient(135deg, rgba(132,185,143,0.08), rgba(68,93,163,0.05))",
        border: "1px solid rgba(132,185,143,0.25)",
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" style={{ color: VERDE }} />
            <h3 className="text-[15px] font-semibold text-white">Beneficio de Cobertura</h3>
            {data.detectadoOCR && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: "rgba(132,185,143,0.16)",
                  color: VERDE,
                  border: `1px solid ${VERDE}55`,
                }}
              >
                <Sparkles className="h-3 w-3" /> Detectado desde extracto
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-white/55 mt-0.5">
            FRECH · Tasa Fresh · Cobertura VIS · Mi Casa Ya · Subsidio Gobierno. Duración máxima 84 cuotas.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-[11.5px] font-medium text-white/75">Tiene cobertura</span>
          <input
            type="checkbox"
            checked={data.activo}
            onChange={(e) =>
              onChange({
                ...data,
                activo: e.target.checked,
                fuente: data.fuente ?? "manual",
              })
            }
            className="h-4 w-4"
            style={{ accentColor: AZUL }}
          />
        </label>
      </div>

      {data.activo && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-white/55 mb-1.5">
                Tipo de beneficio
              </span>
              <select
                value={tipo}
                onChange={(e) => set("tipoBeneficio", e.target.value as FreshTipoBeneficio)}
                className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                }}
              >
                {FRESH_TIPOS.map((t) => (
                  <option key={t.value} value={t.value} style={{ background: "#0A1226" }}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="Valor Fresh mensual ($)"
              value={data.valorMensual ? String(data.valorMensual) : ""}
              onChange={(v) => set("valorMensual", parseCurrency(v))}
              placeholder="500.000"
            />
            <Field
              label="Tasa cobertura Fresh (%)"
              value={data.tasa ? String(data.tasa) : ""}
              onChange={(v) => set("tasa", parseDecimal(v))}
              placeholder="5,00"
            />
            <Field
              label="Cuotas Fresh totales"
              value={String(data.cuotasTotales || FRESH_DEFAULT_TOTAL)}
              onChange={(v) => {
                const n = Math.min(
                  FRESH_DEFAULT_TOTAL,
                  Math.max(0, Math.round(parseDecimal(v))),
                );
                set("cuotasTotales", n);
              }}
              placeholder="84"
              hint="Máximo 84"
            />
            <Field
              label="Cuotas Fresh pagadas"
              value={String(data.cuotasPagadas)}
              onChange={(v) => {
                const total = data.cuotasTotales || FRESH_DEFAULT_TOTAL;
                const n = Math.min(total, Math.max(0, Math.round(parseDecimal(v))));
                set("cuotasPagadas", n);
              }}
              placeholder="0"
              readOnly={cuotasPagadasCredito !== undefined}
              hint={
                cuotasPagadasCredito !== undefined
                  ? "Derivado de cuotas pagadas del crédito"
                  : undefined
              }
            />
            <Field
              label="Cuotas Fresh pendientes"
              value={String(data.cuotasPendientes)}
              readOnly
              hint="Total − pagadas (tope 84)"
            />
          </div>

          {/* RESUMEN DEL BENEFICIO DE COBERTURA */}
          <div
            className="mt-5 rounded-2xl p-5"
            style={{
              background: `linear-gradient(135deg, ${AZUL}1F, ${AZUL}0A)`,
              border: `1px solid ${AZUL}66`,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h4
                className="text-[12px] font-bold uppercase tracking-widest"
                style={{ color: "#cfd8f5" }}
              >
                Resumen del Beneficio de Cobertura
              </h4>
              <span
                className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
              >
                {FRESH_TIPOS.find((t) => t.value === tipo)?.label ?? "Cobertura"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <ResumenCell label="Valor Fresh mensual" value={formatCOP(data.valorMensual)} />
              <ResumenCell
                label="Cuotas subsidiadas pagadas"
                value={String(data.cuotasPagadas)}
              />
              <ResumenCell
                label="Cuotas subsidiadas pendientes"
                value={String(data.cuotasPendientes)}
              />
              <ResumenCell
                label="Beneficio recibido"
                value={formatCOP(beneficioRecibido)}
                accent={VERDE}
              />
              <ResumenCell
                label="Beneficio restante estimado"
                value={formatCOP(beneficioRestante)}
                accent={VERDE}
              />
            </div>
          </div>

          {!validation.ok && (
            <div
              className="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]"
              style={{
                background: "rgba(244,162,97,0.10)",
                border: "1px solid rgba(244,162,97,0.40)",
                color: "#F4A261",
              }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Información de cobertura incompleta. Verifique manualmente:{" "}
                <strong>{validation.faltantes.join(", ")}</strong>. El expediente no debe
                guardarse con datos incompletos.
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  hint,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium uppercase tracking-wider text-white/55 mb-1.5">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none transition focus:border-white/30"
        style={{
          background: readOnly ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          opacity: readOnly ? 0.85 : 1,
        }}
      />
      {hint && <span className="mt-1 block text-[10px] text-white/40">{hint}</span>}
    </label>
  );
}

function ResumenCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2.5"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div
        className="mt-1 text-[15px] font-bold leading-tight"
        style={{ color: accent ?? "#fff" }}
      >
        {value}
      </div>
    </div>
  );
}
