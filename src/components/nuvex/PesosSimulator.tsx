import { useMemo, useState } from "react";
import { Alert, Card, MetricCard, SectionTitle, TextField } from "./ui";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { PRODUCTOS_PESOS } from "./constants";
import { parseCurrency, parseDecimal, parsePercentage, formatCOP, formatPercentage } from "../../lib/format";
import {
  calculatePesosManual,
  calculatePesosProjection,
  pickBestProposal,
  type PesosInput,
} from "../../lib/finance";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import { ScenarioTable, buildPesosScenarioRows, ImpactCard } from "./ScenarioTable";
import { PrintDocument } from "./PrintDocument";

export function PesosSimulator() {
  const [client, setClient] = useState<ClientData>(defaultClient);
  const [saldoCapital, setSaldoCapital] = useState("");
  const [cuotaActual, setCuotaActual] = useState("");
  const [seguros, setSeguros] = useState("");
  const [tea, setTea] = useState("");
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState("");

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const cuotaActualNum = parseCurrency(cuotaActual);
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaActualNum - segurosNum);

  const input: PesosInput = useMemo(() => ({
    saldoCapital: parseCurrency(saldoCapital),
    cuotaActual: cuotaActualNum,
    seguros: segurosNum,
    tea: parsePercentage(tea),
    cuotasPendientes,
    porcentajeHonorarios: honorariosPct,
  }), [saldoCapital, cuotaActualNum, segurosNum, tea, cuotasPendientes, honorariosPct]);

  const validaciones: string[] = [];
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial) validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (plazoInicial > 0 && cuotasPagadas === plazoInicial) validaciones.push("Este crédito ya está amortizado.");
  if (cuotaActualNum > 0 && segurosNum > cuotaActualNum) validaciones.push("Los seguros no pueden ser mayores que la cuota actual.");
  if (cuotaActualNum > 0 && segurosNum > 0 && cuotaSinSegurosNum <= 0) validaciones.push("La cuota sin seguros debe ser mayor a cero para calcular la proyección.");

  const cuotaSinSegurosValida = cuotaActualNum === 0 || segurosNum === 0 || (segurosNum < cuotaActualNum && cuotaSinSegurosNum > 0);

  const datosCompletos =
    input.saldoCapital > 0 && input.cuotaActual > 0 && input.tea > 0 && cuotasPendientes > 0 && cuotaSinSegurosValida;

  const calc = useMemo(() => {
    if (!datosCompletos) return null;
    return calculatePesosProjection(input);
  }, [datosCompletos, input]);

  const { best, bestIndex } = useMemo(() => {
    if (!calc) return { best: null, bestIndex: -1 };
    return pickBestProposal(calc.propuestas);
  }, [calc]);

  const manual = useMemo(() => {
    if (!datosCompletos) return null;
    const v = parseCurrency(nuevaCuotaManual);
    if (!v) return null;
    return calculatePesosManual(input, v);
  }, [datosCompletos, input, nuevaCuotaManual]);

  const ahorroNegativo = best && (best.ahorroTotal < 0 || best.honorariosNuvex < 0);

  const metrics = [
    { label: "Saldo a capital", value: formatCOP(input.saldoCapital) },
    { label: "Cuota actual con seguros", value: formatCOP(input.cuotaActual) },
    { label: "Seguros mensuales", value: formatCOP(input.seguros) },
    { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
    { label: "Plazo inicial", value: `${plazoInicial} meses` },
    { label: "Cuotas pagadas", value: String(cuotasPagadas) },
    { label: "Cuotas pendientes", value: String(cuotasPendientes) },
    { label: "TEA", value: formatPercentage(input.tea) },
    { label: "Total por pagar", value: formatCOP(input.cuotaActual * cuotasPendientes) },
  ];

  const scenarioRows = best
    ? buildPesosScenarioRows({
        cuotaActual: input.cuotaActual,
        cuotasPendientes,
        totalActualPendiente: input.cuotaActual * cuotasPendientes,
        nuevaCuota: best.nuevaCuotaConSeguro,
        nuevoPlazo: best.nuevoPlazo,
        totalProyectado: best.totalAproxPagar,
        ahorroTotal: best.ahorroTotal,
        añosEliminados: best.añosEliminados,
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Card>
        <SectionTitle sub="Información general del cliente y del crédito">Datos del cliente</SectionTitle>
        <ClientFields data={client} onChange={setClient} productos={PRODUCTOS_PESOS} cuotasPendientes={cuotasPendientes} />
        {validaciones.map((v, i) => (
          <div key={i} className="mt-3"><Alert tone="error">{v}</Alert></div>
        ))}
        {cuotasPendientes > 0 && cuotasPendientes <= 72 && (
          <div className="mt-3"><Alert>Cuotas pendientes ≤ 72. Revise viabilidad de la propuesta.</Alert></div>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Información financiera del crédito en pesos">Datos del crédito</SectionTitle>
        <div className="grid gap-4 md:grid-cols-4">
          <TextField label="Saldo a capital" value={saldoCapital} onChange={setSaldoCapital} placeholder="221.903.943" />
          <TextField label="Cuota mensual actual con seguros" value={cuotaActual} onChange={setCuotaActual} placeholder="2.260.000" />
          <TextField label="Seguros mensuales" value={seguros} onChange={setSeguros} placeholder="180.000" />
          <TextField
            label="Cuota mensual sin seguros"
            value={cuotaActualNum > 0 && segurosNum >= 0 ? formatCOP(cuotaSinSegurosNum) : ""}
            readOnly
            hint="Calculada automáticamente"
          />
          <TextField label="Tasa Efectiva Anual (%)" value={tea} onChange={setTea} placeholder="11,15" />
        </div>
      </Card>

      {datosCompletos && (
        <>
          <Card>
            <SectionTitle sub="Resumen ejecutivo del crédito actual">Situación actual del crédito</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {metrics.map((m) => <MetricCard key={m.label} label={m.label} value={m.value} />)}
            </div>
          </Card>

          {ahorroNegativo && (
            <Alert tone="error">Revisar datos. El ahorro u honorarios calculados son negativos.</Alert>
          )}

          {calc && calc.propuestas.length > 0 && (
            <>
              <Card>
                <SectionTitle sub="Compare cada propuesta y la recomendada en verde">Tabla comparativa de propuestas</SectionTitle>
                <ComparativeTable mode="pesos" pesos={calc.propuestas} bestIndex={bestIndex} honorariosPct={honorariosPct} />
              </Card>

              {best && (
                <>
                  <RecommendedResult
                    mode="pesos"
                    honorariosPct={honorariosPct}
                    items={{
                      añosEliminados: best.añosEliminados,
                      ahorroIntereses: best.ahorroIntereses,
                      ahorroSeguros: best.ahorroSeguros,
                      ahorroTotal: best.ahorroTotal,
                      honorarios: best.honorariosNuvex,
                      nuevaCuota: best.nuevaCuotaConSeguro,
                    }}
                  />
                  <Card>
                    <SectionTitle>Escenario actual vs escenario optimizado</SectionTitle>
                    <ScenarioTable rows={scenarioRows} />
                  </Card>
                </>
              )}
            </>
          )}

          <Card>
            <SectionTitle sub="Calcule el nuevo plazo a partir de una cuota propuesta por el cliente">Calculadora manual por nueva cuota propuesta</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Nueva cuota propuesta por el cliente" value={nuevaCuotaManual} onChange={setNuevaCuotaManual} placeholder="2.800.000" />
            </div>
            {manual && !manual.valid && manual.motivo && (
              <div className="mt-3"><Alert tone="error">{manual.motivo}</Alert></div>
            )}
            {manual && manual.valid && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="Nueva cuota" value={formatCOP(manual.nuevaCuotaConSeguro)} accent="green" />
                <MetricCard label="Incremento mensual" value={formatCOP(manual.incrementoMensual)} />
                <MetricCard label="Nuevo plazo" value={`${manual.nuevoPlazo} meses`} />
                <MetricCard label="Cuotas eliminadas" value={String(manual.cuotasEliminadas)} />
                <MetricCard label="Años eliminados" value={manual.añosEliminados.toFixed(1)} />
                <MetricCard label="Ahorro intereses" value={formatCOP(manual.ahorroIntereses)} />
                <MetricCard label="Ahorro seguros" value={formatCOP(manual.ahorroSeguros)} />
                <MetricCard label="Ahorro total" value={formatCOP(manual.ahorroTotal)} accent="green" />
                <MetricCard label="Honorarios NUVEX" value={formatCOP(manual.honorarios)} accent="blue" />
                <MetricCard label="Total proyectado" value={formatCOP(manual.totalProyectado)} />
              </div>
            )}
          </Card>

          {best && (
            <div className="flex justify-end">
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-[#242424] px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
              >
                Exportar PDF profesional
              </button>
            </div>
          )}

          {best && (
            <PrintDocument
              mode="pesos"
              client={client}
              cuotasPendientes={cuotasPendientes}
              metrics={metrics}
              pesosPropuestas={calc!.propuestas}
              bestIndex={bestIndex}
              honorariosPct={honorariosPct}
              recommended={{
                añosEliminados: best.añosEliminados,
                ahorroIntereses: best.ahorroIntereses,
                ahorroSeguros: best.ahorroSeguros,
                ahorroTotal: best.ahorroTotal,
                honorarios: best.honorariosNuvex,
                nuevaCuota: best.nuevaCuotaConSeguro,
              }}
              scenarioRows={scenarioRows}
            />
          )}
        </>
      )}
    </div>
  );
}
