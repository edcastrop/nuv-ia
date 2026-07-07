import { useMemo, useState } from "react";
import { Alert, Card, SectionTitle, TextField } from "./ui";
import type { ClientData } from "./ClientFields";
import {
  proyectarLeasing,
  type ResultadoLeasing,
  type CuotaLeasing,
} from "@/lib/proyeccion";
import { parseCurrency, parsePercentage, formatCOP, formatPercentage } from "@/lib/format";
import { formatFecha } from "@/lib/proyeccion";

/**
 * Panel dedicado a Leasing Habitacional en pesos con opción de compra.
 *
 * Motor: `proyectarLeasing` (Sistema Francés con Valor Residual).
 * Este componente es AUDITIVO: no modifica el flujo hipotecario. Se muestra
 * únicamente cuando `client.modalidadProducto === "leasing_habitacional"`.
 */

interface Props {
  client: ClientData;
  onChange: (next: ClientData) => void;
  saldoCapital: string;
  seguros: string;
  tea: string;
  canonActual: string; // = cuotaActual del simulador padre
}

const CANON_EXTRA_PRESETS = [50_000, 100_000, 150_000, 200_000];

export function LeasingHabitacionalPanel({
  client,
  onChange,
  saldoCapital,
  seguros,
  tea,
  canonActual,
}: Props) {
  const [canonExtra, setCanonExtra] = useState<number>(0);
  const [canonExtraManual, setCanonExtraManual] = useState<string>("");

  const set = <K extends keyof ClientData>(k: K, v: ClientData[K]) =>
    onChange({ ...client, [k]: v });

  const saldoNum = parseCurrency(saldoCapital);
  const residualNum = parseCurrency(client.valorOpcionCompra || "");
  const teaNum = parsePercentage(tea);
  const segurosNum = parseCurrency(seguros);
  const canonBancoNum = parseCurrency(canonActual);
  const cuotasPendientesNum = Math.max(1, parseInt(client.cuotasPendientes || "0", 10) || 0);

  const inputValido =
    saldoNum > 0 && residualNum > 0 && teaNum > 0 && cuotasPendientesNum > 0;

  const escenarioActual: ResultadoLeasing | null = useMemo(() => {
    if (!inputValido) return null;
    return proyectarLeasing({
      saldoInicial: saldoNum,
      valorResidual: residualNum,
      cuotasPendientes: cuotasPendientesNum,
      teaPct: teaNum,
      seguros: segurosNum,
      fechaInicio: new Date(),
      incluirOpcionCompra: client.incluirOpcionCompra,
      canonBancoReportado: canonBancoNum > 0 ? canonBancoNum : undefined,
    });
  }, [
    inputValido,
    saldoNum,
    residualNum,
    cuotasPendientesNum,
    teaNum,
    segurosNum,
    client.incluirOpcionCompra,
    canonBancoNum,
  ]);

  const escenarioOptimizado: ResultadoLeasing | null = useMemo(() => {
    if (!inputValido || canonExtra <= 0) return null;
    return proyectarLeasing({
      saldoInicial: saldoNum,
      valorResidual: residualNum,
      cuotasPendientes: cuotasPendientesNum,
      teaPct: teaNum,
      seguros: segurosNum,
      fechaInicio: new Date(),
      incluirOpcionCompra: client.incluirOpcionCompra,
      aporteMensualExtra: canonExtra,
      canonBancoReportado: canonBancoNum > 0 ? canonBancoNum : undefined,
    });
  }, [
    inputValido,
    saldoNum,
    residualNum,
    cuotasPendientesNum,
    teaNum,
    segurosNum,
    client.incluirOpcionCompra,
    canonExtra,
    canonBancoNum,
  ]);

  // Alertas QA
  const qaAlerts = useMemo(() => {
    if (!escenarioActual) return [] as { tipo: "warn" | "error"; msg: string }[];
    const out: { tipo: "warn" | "error"; msg: string }[] = [];
    const qa = escenarioActual.qa;
    if (qa.canonReconstruidoDifPct !== null && Math.abs(qa.canonReconstruidoDifPct) > 1) {
      out.push({
        tipo: "warn",
        msg: `Canon reconstruido difiere del canon reportado por el banco en ${qa.canonReconstruidoDifPct.toFixed(2)}%. Verifica TEA, seguros o valor residual.`,
      });
    }
    if (!escenarioActual.saldoConvergeAlResidual) {
      out.push({
        tipo: "error",
        msg: `El saldo final proyectado (${formatCOP(escenarioActual.saldoFinalProyectado)}) no converge al valor residual (${formatCOP(escenarioActual.valorResidual)}). Revisa cánones pendientes y tasa.`,
      });
    }
    if (qa.residualComoPctDelSaldo > 0 && (qa.residualComoPctDelSaldo < 7 || qa.residualComoPctDelSaldo > 15)) {
      out.push({
        tipo: "warn",
        msg: `La opción de compra representa ${qa.residualComoPctDelSaldo.toFixed(1)}% del saldo. El rango típico está entre 7% y 15%.`,
      });
    }
    if (qa.capitalCero) {
      out.push({
        tipo: "error",
        msg: "En alguna cuota el capital sería 0 o negativo (canon no cubre intereses). Revisa TEA vs canon reportado.",
      });
    }
    return out;
  }, [escenarioActual]);

  return (
    <Card>
      <SectionTitle sub="Modo NUVEX Leasing — sistema francés con valor residual (opción de compra)">
        Leasing Habitacional · Datos específicos
      </SectionTitle>

      <div className="grid gap-4 md:grid-cols-4">
        <TextField
          label="Valor del leasing"
          value={client.valorOpcionCompra ? "" : ""}
          // El "valor total del leasing" no altera la simulación; se toma
          // el saldo actual como PV. Este campo queda a título informativo.
          onChange={() => undefined}
          placeholder="325.990.284"
          hint="Se toma el saldo actual como valor presente."
          readOnly
        />
        <TextField
          label="Valor opción de compra (residual)"
          value={client.valorOpcionCompra || ""}
          onChange={(v) => set("valorOpcionCompra", v)}
          placeholder="32.599.028"
        />
        <TextField
          label="Sistema de amortización"
          value={client.sistemaAmortizacion || ""}
          onChange={(v) => set("sistemaAmortizacion", v)}
          placeholder="PESOS - C. FIJA"
        />
        <TextField
          label="Fecha de corte"
          value={client.fechaCorte || ""}
          onChange={(v) => set("fechaCorte", v)}
          placeholder="AAAA-MM-DD"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={!!client.incluirOpcionCompra}
            onChange={(e) => set("incluirOpcionCompra", e.target.checked)}
          />
          Incluir opción de compra dentro de la proyección de pago final
        </label>
        <span className="text-[11px] opacity-70">
          Si está desactivado, el residual se mantiene como saldo final del leasing.
        </span>
      </div>

      {qaAlerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {qaAlerts.map((a, i) => (
            <Alert key={i} tone={a.tipo === "error" ? "error" : "warn"}>
              {a.msg}
            </Alert>
          ))}
        </div>
      )}

      {escenarioActual && (
        <>
          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <Kpi label="Canon financiero (reconstruido)" value={formatCOP(escenarioActual.canonFinancieroBase)} />
            <Kpi label="Canon total (con seguros)" value={formatCOP(escenarioActual.canonTotalBase)} />
            <Kpi label="Saldo final proyectado" value={formatCOP(escenarioActual.saldoFinalProyectado)} />
            <Kpi label="Valor residual" value={formatCOP(escenarioActual.valorResidual)} />
            <Kpi label="Total intereses" value={formatCOP(escenarioActual.totalIntereses)} />
            <Kpi label="Total seguros" value={formatCOP(escenarioActual.totalSeguros)} />
            <Kpi label="Costo total del leasing" value={formatCOP(escenarioActual.totalPagado)} />
            <Kpi label="Veces pagado (vs saldo)" value={`${escenarioActual.vecesPagado.toFixed(2)} x`} />
            <Kpi label="Fecha estimada de terminación" value={formatFecha(escenarioActual.fechaFinalizacion)} />
            <Kpi
              label="Residual / saldo"
              value={`${escenarioActual.qa.residualComoPctDelSaldo.toFixed(1)} %`}
            />
            <Kpi label="TEA aplicada" value={formatPercentage(teaNum)} />
            <Kpi label="Cánones pendientes" value={String(cuotasPendientesNum)} />
          </div>

          <div className="mt-6">
            <SectionTitle sub="Aumenta el canon mensual para ver el impacto en plazo y ahorros">
              Escenarios de optimización
            </SectionTitle>
            <div className="flex flex-wrap items-center gap-2">
              {CANON_EXTRA_PRESETS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setCanonExtra(v);
                    setCanonExtraManual("");
                  }}
                  className="rounded-lg px-3 py-1.5 text-[12px]"
                  style={{
                    background: canonExtra === v ? "rgba(132,185,143,0.20)" : "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  + {formatCOP(v)}
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={canonExtraManual}
                  onChange={(e) => {
                    setCanonExtraManual(e.target.value);
                    const n = parseCurrency(e.target.value);
                    setCanonExtra(n > 0 ? n : 0);
                  }}
                  placeholder="Valor manual"
                  className="nuvia-input nuvia-input-sm"
                  style={{ maxWidth: 180 }}
                />
                {canonExtra > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCanonExtra(0);
                      setCanonExtraManual("");
                    }}
                    className="text-[12px] underline opacity-80"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {escenarioOptimizado && (
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <Kpi label="Nuevo canon total" value={formatCOP(escenarioOptimizado.canonTotalBase + canonExtra)} />
                <Kpi
                  label="Cánones eliminados"
                  value={String(Math.max(0, escenarioActual.cuotas.length - escenarioOptimizado.cuotas.length))}
                />
                <Kpi
                  label="Ahorro en intereses"
                  value={formatCOP(Math.max(0, escenarioActual.totalIntereses - escenarioOptimizado.totalIntereses))}
                />
                <Kpi
                  label="Ahorro en seguros"
                  value={formatCOP(Math.max(0, escenarioActual.totalSeguros - escenarioOptimizado.totalSeguros))}
                />
                <Kpi
                  label="Ahorro total"
                  value={formatCOP(
                    Math.max(
                      0,
                      escenarioActual.totalIntereses -
                        escenarioOptimizado.totalIntereses +
                        (escenarioActual.totalSeguros - escenarioOptimizado.totalSeguros),
                    ),
                  )}
                />
                <Kpi
                  label="Fecha estimada optimizada"
                  value={formatFecha(escenarioOptimizado.fechaFinalizacion)}
                />
                <Kpi
                  label="Opción de compra restante"
                  value={
                    client.incluirOpcionCompra
                      ? "Incluida en pago final"
                      : formatCOP(escenarioOptimizado.valorResidual)
                  }
                />
                <Kpi
                  label="Costo total optimizado"
                  value={formatCOP(escenarioOptimizado.totalPagado)}
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            <SectionTitle sub="Amortización cuota a cuota — sistema francés con valor residual">
              Tabla de amortización
            </SectionTitle>
            <TablaAmortizacion cuotas={escenarioActual.cuotas} />
          </div>
        </>
      )}

      {!inputValido && (
        <Alert tone="info">
          Diligencia saldo a capital, TEA, cánones pendientes y valor de la opción de compra
          para ver la proyección.
        </Alert>
      )}
    </Card>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div className="text-[11px] opacity-70">{label}</div>
      <div className="text-[15px] font-semibold" style={{ color: "#E6F0FF" }}>
        {value}
      </div>
    </div>
  );
}

function TablaAmortizacion({ cuotas }: { cuotas: CuotaLeasing[] }) {
  const preview = cuotas.length > 24 ? [...cuotas.slice(0, 12), ...cuotas.slice(-12)] : cuotas;
  const showEllipsis = cuotas.length > 24;
  return (
    <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
      <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.06)" }}>
            {["#", "Fecha", "Saldo inicial", "Interés", "Capital", "Seguros", "Canon financiero", "Canon total", "Saldo final"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "right", color: "#CDE0FF", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((c, idx) => (
            <>
              {showEllipsis && idx === 12 && (
                <tr key="ellipsis">
                  <td colSpan={9} style={{ padding: "6px 10px", textAlign: "center", color: "#9BB0CC" }}>
                    … {cuotas.length - 24} cánones ocultos …
                  </td>
                </tr>
              )}
              <tr
                key={c.numero}
                style={{
                  background: c.esOpcionCompra ? "rgba(132,185,143,0.15)" : "transparent",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <td style={{ padding: "6px 10px", color: "#E6F0FF" }}>{c.numero}</td>
                <td style={{ padding: "6px 10px", color: "#CDE0FF" }}>{formatFecha(c.fecha)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.saldoInicial)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.interes)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.capital)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.seguros)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.canonFinanciero)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF", fontWeight: 600 }}>{formatCOP(c.canonTotal)}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: "#E6F0FF" }}>{formatCOP(c.saldoFinal)}</td>
              </tr>
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
