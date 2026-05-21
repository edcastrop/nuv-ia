import { useMemo, useState } from "react";
import { Alert, Card, MetricCard, SectionTitle, TextField } from "./ui";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { PRODUCTOS_UVR } from "./constants";
import { parseCurrency, parseDecimal, parsePercentage, formatCOP, formatNumber, formatPercentage } from "../../lib/format";
import {
  calculateUVRManual,
  calculateUVRProjection,
  pickBestProposal,
  type UVRInput,
} from "../../lib/finance";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import { ScenarioTable, type ScenarioRow } from "./ScenarioTable";
import { PrintDocument } from "./PrintDocument";

export function UVRSimulator() {
  const [client, setClient] = useState<ClientData>(defaultClient);
  const [valorDesembolsado, setValorDesembolsado] = useState("");
  const [saldoPesos, setSaldoPesos] = useState("");
  const [saldoUVR, setSaldoUVR] = useState("");
  const [valorUVR, setValorUVR] = useState("");
  const [cuotaActualPesos, setCuotaActualPesos] = useState("");
  const [seguros, setSeguros] = useState("");
  const [teaCobrada, setTeaCobrada] = useState("");
  const [variacionUVR, setVariacionUVR] = useState("");
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState("");

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const cuotaActualPesosNum = parseCurrency(cuotaActualPesos);
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaActualPesosNum - segurosNum);

  const input: UVRInput = useMemo(() => ({
    valorDesembolsado: parseCurrency(valorDesembolsado),
    saldoPesos: parseCurrency(saldoPesos),
    saldoUVR: parseDecimal(saldoUVR),
    valorUVR: parseDecimal(valorUVR),
    cuotaActualPesos: cuotaActualPesosNum,
    cuotaSinSeguros: cuotaSinSegurosNum,
    seguros: segurosNum,
    teaCobrada: parsePercentage(teaCobrada),
    variacionUVR: parsePercentage(variacionUVR),
    cuotasPendientes,
    porcentajeHonorarios: honorariosPct,
  }), [valorDesembolsado, saldoPesos, saldoUVR, valorUVR, cuotaActualPesosNum, cuotaSinSegurosNum, segurosNum, teaCobrada, variacionUVR, cuotasPendientes, honorariosPct]);

  const validaciones: string[] = [];
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial) validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (input.saldoUVR <= 0 && saldoUVR) validaciones.push("Saldo UVR debe ser mayor a 0.");
  if (input.valorUVR <= 0 && valorUVR) validaciones.push("Valor UVR debe ser mayor a 0.");

  const datosCompletos =
    input.saldoUVR > 0 && input.valorUVR > 0 && input.cuotaActualPesos > 0 &&
    input.teaCobrada > 0 && cuotasPendientes > 0;

  const calc = useMemo(() => {
    if (!datosCompletos) return null;
    return calculateUVRProjection(input);
  }, [datosCompletos, input]);

  const { best, bestIndex } = useMemo(() => {
    if (!calc) return { best: null, bestIndex: -1 };
    return pickBestProposal(calc.propuestas);
  }, [calc]);

  const manual = useMemo(() => {
    if (!datosCompletos || !calc) return null;
    const v = parseCurrency(nuevaCuotaManual);
    if (!v) return null;
    return calculateUVRManual(input, calc.escenarioActual, v);
  }, [datosCompletos, input, calc, nuevaCuotaManual]);

  const ahorroNegativo = best && (best.ahorroTotal < 0 || best.honorariosNuvex < 0);

  const metrics = [
    { label: "Saldo actual en pesos", value: formatCOP(input.saldoPesos) },
    { label: "Saldo actual en UVR", value: formatNumber(input.saldoUVR, 2) },
    { label: "Valor UVR actual", value: formatCOP(input.valorUVR) },
    { label: "Cuota actual", value: formatCOP(input.cuotaActualPesos) },
    { label: "Seguros", value: formatCOP(input.seguros) },
    { label: "Plazo inicial", value: `${plazoInicial} meses` },
    { label: "Cuotas pendientes", value: String(cuotasPendientes) },
    { label: "Variación UVR EA", value: formatPercentage(input.variacionUVR) },
  ];

  if (calc) {
    metrics.push({
      label: "Total proyectado a pagar",
      value: formatCOP(calc.escenarioActual.totalPagoPesos),
    });
  }

  const scenarioRows: ScenarioRow[] = best && calc
    ? [
        { concepto: "Cuota mensual (aprox.)", actual: formatCOP(input.cuotaActualPesos), optimizado: formatCOP(best.nuevaCuotaConSeguroAprox) },
        { concepto: "Plazo restante (meses)", actual: String(cuotasPendientes), optimizado: String(best.nuevoPlazo) },
        { concepto: "Años por pagar", actual: formatNumber(cuotasPendientes / 12, 1), optimizado: formatNumber(best.nuevoPlazo / 12, 1) },
        { concepto: "Total a pagar (proyectado)", actual: formatCOP(calc.escenarioActual.totalPagoPesos), optimizado: formatCOP(best.totalAproxPagar) },
        { concepto: "Ahorro estimado", actual: "—", optimizado: formatCOP(best.ahorroTotal) },
        { concepto: "Años eliminados", actual: "—", optimizado: formatNumber(best.añosEliminados, 0) },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Card>
        <SectionTitle sub="Información general del cliente y del crédito en UVR">Datos del cliente</SectionTitle>
        <ClientFields data={client} onChange={setClient} productos={PRODUCTOS_UVR} cuotasPendientes={cuotasPendientes} />
        {validaciones.map((v, i) => (
          <div key={i} className="mt-3"><Alert tone="error">{v}</Alert></div>
        ))}
        {cuotasPendientes > 0 && cuotasPendientes <= 72 && (
          <div className="mt-3"><Alert>Cuotas pendientes ≤ 72. Revise viabilidad de la propuesta.</Alert></div>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Información financiera del crédito en UVR">Datos del crédito</SectionTitle>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField label="Valor desembolsado" value={valorDesembolsado} onChange={setValorDesembolsado} placeholder="120.000.000" />
          <TextField label="Saldo actual en pesos" value={saldoPesos} onChange={setSaldoPesos} placeholder="98.500.000" />
          <TextField label="Saldo actual en UVR" value={saldoUVR} onChange={setSaldoUVR} placeholder="371029,7251" />
          <TextField label="Valor UVR actual" value={valorUVR} onChange={setValorUVR} placeholder="372,1234" />
          <TextField label="Cuota actual en pesos (con seguro)" value={cuotaActualPesos} onChange={setCuotaActualPesos} placeholder="1.480.000" />
          <TextField label="Cuota sin seguros" value={cuotaSinSeguros} onChange={setCuotaSinSeguros} placeholder="1.250.000" />
          <TextField label="Seguros mensuales" value={seguros} onChange={setSeguros} placeholder="230.000" />
          <TextField label="Tasa cobrada EA (%)" value={teaCobrada} onChange={setTeaCobrada} placeholder="8,50" />
          <TextField label="Variación UVR EA (%)" value={variacionUVR} onChange={setVariacionUVR} placeholder="5,20" />
        </div>
      </Card>

      {datosCompletos && (
        <>
          <Card>
            <SectionTitle sub="Resumen ejecutivo del crédito UVR actual">Situación actual del crédito</SectionTitle>
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
                <ComparativeTable mode="uvr" uvr={calc.propuestas} bestIndex={bestIndex} honorariosPct={honorariosPct} />
              </Card>

              {best && (
                <>
                  <RecommendedResult
                    mode="uvr"
                    honorariosPct={honorariosPct}
                    items={{
                      añosEliminados: best.añosEliminados,
                      ahorroIntereses: best.ahorroIntereses,
                      ahorroSeguros: best.ahorroSeguros,
                      ahorroTotal: best.ahorroTotal,
                      honorarios: best.honorariosNuvex,
                      nuevaCuota: best.nuevaCuotaConSeguroAprox,
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
            <SectionTitle sub="Calcule el nuevo plazo a partir de una cuota propuesta en pesos">Calculadora manual por nueva cuota propuesta</SectionTitle>
            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Nueva cuota propuesta por el cliente (pesos)" value={nuevaCuotaManual} onChange={setNuevaCuotaManual} placeholder="1.800.000" />
            </div>
            {manual && !manual.valid && manual.motivo && (
              <div className="mt-3"><Alert tone="error">{manual.motivo}</Alert></div>
            )}
            {manual && manual.valid && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard label="Nueva cuota" value={formatCOP(manual.nuevaCuotaPesos)} accent="green" />
                <MetricCard label="Incremento mensual" value={formatCOP(manual.incrementoMensual)} />
                <MetricCard label="Nuevo plazo" value={`${manual.nuevoPlazo} meses`} />
                <MetricCard label="Cuotas eliminadas" value={String(manual.cuotasEliminadas)} />
                <MetricCard label="Años eliminados" value={manual.añosEliminados.toFixed(1)} />
                <MetricCard label="Ahorro intereses y corrección" value={formatCOP(manual.ahorroIntereses)} />
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
              mode="uvr"
              client={client}
              cuotasPendientes={cuotasPendientes}
              metrics={metrics}
              uvrPropuestas={calc!.propuestas}
              bestIndex={bestIndex}
              honorariosPct={honorariosPct}
              recommended={{
                añosEliminados: best.añosEliminados,
                ahorroIntereses: best.ahorroIntereses,
                ahorroSeguros: best.ahorroSeguros,
                ahorroTotal: best.ahorroTotal,
                honorarios: best.honorariosNuvex,
                nuevaCuota: best.nuevaCuotaConSeguroAprox,
              }}
              scenarioRows={scenarioRows}
            />
          )}
        </>
      )}
    </div>
  );
}
