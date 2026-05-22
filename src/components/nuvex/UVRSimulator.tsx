import { useMemo, useState } from "react";
import { Alert, Card, MetricCard, SectionTitle, TextField } from "./ui";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { PRODUCTOS_UVR, NUVEX } from "./constants";
import { parseCurrency, parseDecimal, parsePercentage, formatCOP, formatNumber, formatPercentage } from "../../lib/format";
import {
  calculateUVRManual,
  calculateUVRProjection,
  pickBestProposal,
  type UVRInput,
} from "../../lib/finance";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import { ScenarioTable, ImpactCard, SavingsCard, buildUVRScenarioRows, getVecesStyle } from "./ScenarioTable";
import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { DiscountModule, computeDiscount, defaultDiscount, type DiscountState } from "./DiscountModule";
import { ResultadoFinal, type ProyeccionNuvex } from "./ResultadoFinal";
import { SaveExpedienteButton } from "./SaveExpedienteButton";
import type { Expediente } from "@/lib/expedientes";
import { ExtractoReader, type ExtractoApplyPayload } from "./ExtractoReader";
import { IntervinientesFields } from "./IntervinientesFields";
import { CoberturaFields } from "./CoberturaFields";
import {
  defaultCobertura,
  defaultIntervinientes,
  type Cobertura,
  type Interviniente,
} from "./intervinientes";


export function UVRSimulator({
  initialExpediente,
  onSaved,
  onReset,
}: {
  initialExpediente?: Expediente;
  onSaved?: (e: Expediente) => void;
  onReset?: () => void;
} = {}) {
  const init = initialExpediente;
  const initCred = (init?.credito_data ?? {}) as Record<string, string>;
  const [discount, setDiscount] = useState<DiscountState>(
    () => (init?.discount_data && Object.keys(init.discount_data).length
      ? (init.discount_data as unknown as DiscountState)
      : defaultDiscount),
  );
  const initClient = (init?.cliente_data as ClientData | undefined) ?? undefined;
  const [client, setClient] = useState<ClientData>(() => initClient ?? defaultClient);
  const [intervinientes, setIntervinientes] = useState<Interviniente[]>(
    () => initClient?.intervinientes && initClient.intervinientes.length > 0
      ? initClient.intervinientes
      : defaultIntervinientes(initClient?.tipoProducto),
  );
  const [cobertura, setCobertura] = useState<Cobertura>(
    () => initClient?.cobertura ?? defaultCobertura,
  );
  const [valorDesembolsado, setValorDesembolsado] = useState(initCred.valorDesembolsado ?? "");
  const [saldoPesos, setSaldoPesos] = useState(initCred.saldoPesos ?? "");
  const [saldoUVR, setSaldoUVR] = useState(initCred.saldoUVR ?? "");
  const [valorUVR, setValorUVR] = useState(initCred.valorUVR ?? "");
  const [cuotaActualPesos, setCuotaActualPesos] = useState(initCred.cuotaActualPesos ?? "");
  const [seguros, setSeguros] = useState(initCred.seguros ?? "");
  const [teaCobrada, setTeaCobrada] = useState(initCred.teaCobrada ?? "");
  const [variacionUVR, setVariacionUVR] = useState(initCred.variacionUVR ?? "");
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState(initCred.nuevaCuotaManual ?? "");

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const valorDesembolsadoNum = parseCurrency(valorDesembolsado);
  const cuotaActualPesosNum = parseCurrency(cuotaActualPesos);
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaActualPesosNum - segurosNum);
  const saldoPesosNum = parseCurrency(saldoPesos);
  const dineroPagadoFecha = cuotaActualPesosNum * cuotasPagadas;

  const input: UVRInput = useMemo(() => ({
    valorDesembolsado: valorDesembolsadoNum,
    saldoPesos: saldoPesosNum,
    saldoUVR: parseDecimal(saldoUVR),
    valorUVR: parseDecimal(valorUVR),
    cuotaActualPesos: cuotaActualPesosNum,
    cuotaSinSeguros: cuotaSinSegurosNum,
    seguros: segurosNum,
    teaCobrada: parsePercentage(teaCobrada),
    variacionUVR: parsePercentage(variacionUVR),
    cuotasPendientes,
    plazoInicial,
    porcentajeHonorarios: honorariosPct,
  }), [valorDesembolsadoNum, saldoPesosNum, saldoUVR, valorUVR, cuotaActualPesosNum, cuotaSinSegurosNum, segurosNum, teaCobrada, variacionUVR, cuotasPendientes, plazoInicial, honorariosPct]);

  const validaciones: string[] = [];
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial) validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (input.saldoUVR <= 0 && saldoUVR) validaciones.push("Saldo UVR debe ser mayor a 0.");
  if (input.valorUVR <= 0 && valorUVR) validaciones.push("Valor UVR debe ser mayor a 0.");
  if (cuotaActualPesosNum > 0 && segurosNum > cuotaActualPesosNum) validaciones.push("Los seguros no pueden ser mayores que la cuota actual.");
  if (cuotaActualPesosNum > 0 && segurosNum > 0 && cuotaSinSegurosNum <= 0) validaciones.push("La cuota sin seguros debe ser mayor a cero para calcular la proyección.");

  const cuotaSinSegurosValida = cuotaActualPesosNum === 0 || segurosNum === 0 || (segurosNum < cuotaActualPesosNum && cuotaSinSegurosNum > 0);

  const datosCompletos =
    input.saldoUVR > 0 && input.valorUVR > 0 && input.cuotaActualPesos > 0 &&
    input.teaCobrada > 0 && cuotasPendientes > 0 && cuotaSinSegurosValida;

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

  const manualValido = !!(manual && manual.valid);

  const recomendada = manualValido && manual
    ? {
        añosEliminados: manual.añosEliminados,
        ahorroIntereses: manual.ahorroIntereses,
        ahorroSeguros: manual.ahorroSeguros,
        ahorroTotal: manual.ahorroTotal,
        honorarios: manual.honorarios,
        nuevaCuota: manual.nuevaCuotaPesos,
        nuevoPlazo: manual.nuevoPlazo,
        totalProyectado: manual.totalProyectado,
      }
    : best
      ? {
          añosEliminados: best.añosEliminados,
          ahorroIntereses: best.ahorroIntereses,
          ahorroSeguros: best.ahorroSeguros,
          ahorroTotal: best.ahorroTotal,
          honorarios: best.honorariosNuvex,
          nuevaCuota: best.nuevaCuotaConSeguroAprox,
          nuevoPlazo: best.nuevoPlazo,
          totalProyectado: best.totalAproxPagar,
        }
      : null;

  const ahorroNegativo = recomendada && (recomendada.ahorroTotal < 0 || recomendada.honorarios < 0);

  const totalActualPesos = calc?.escenarioActual.totalPagoPesos ?? 0;
  const vecesActual = saldoPesosNum > 0 ? totalActualPesos / saldoPesosNum : 0;
  const vsActual = getVecesStyle(vecesActual);
  const vecesOpt = recomendada && saldoPesosNum > 0 ? recomendada.totalProyectado / saldoPesosNum : 0;

  const metrics = [
    { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
    { label: "Saldo actual en pesos", value: formatCOP(input.saldoPesos) },
    { label: "Saldo actual en UVR", value: formatNumber(input.saldoUVR, 2) },
    { label: "Valor UVR actual", value: formatCOP(input.valorUVR) },
    { label: "Cuota actual con seguros", value: formatCOP(input.cuotaActualPesos) },
    { label: "Seguros mensuales", value: formatCOP(input.seguros) },
    { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
    { label: "Cuotas pagadas", value: String(cuotasPagadas) },
    { label: "Cuotas pendientes", value: String(cuotasPendientes) },
    { label: "Dinero pagado a la fecha", value: formatCOP(dineroPagadoFecha) },
    { label: "Variación UVR EA", value: formatPercentage(input.variacionUVR) },
    { label: "Plazo inicial", value: `${plazoInicial} meses` },
  ];

  if (calc) {
    metrics.push({ label: "Total proyectado a pagar", value: formatCOP(calc.escenarioActual.totalPagoPesos) });
    metrics.push({ label: "N° veces pagado el crédito", value: `${formatNumber(vecesActual, 2)} veces` });
  }

  const scenarioRows = recomendada && calc
    ? buildUVRScenarioRows({
        cuotaActual: input.cuotaActualPesos,
        cuotasPendientes,
        totalActualPendiente: calc.escenarioActual.totalPagoPesos,
        saldoPesos: saldoPesosNum,
        nuevaCuota: recomendada.nuevaCuota,
        nuevoPlazo: recomendada.nuevoPlazo,
        totalProyectado: recomendada.totalProyectado,
        ahorroIntereses: recomendada.ahorroIntereses,
        ahorroSeguros: recomendada.ahorroSeguros,
        ahorroTotal: recomendada.ahorroTotal,
      })
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      {onReset && (
        <div className="flex justify-end">
          <button onClick={onReset} className="text-xs text-[#445DA3] hover:underline">← Cambiar modo</button>
        </div>
      )}
      <ExtractoReader
        modo="uvr"
        onApply={(p: ExtractoApplyPayload) => {
          setClient((prev) => ({
            ...prev,
            nombre: p.cliente.nombre || prev.nombre,
            cedula: p.cliente.cedula || prev.cedula,
            numeroCredito: p.cliente.numeroCredito || prev.numeroCredito,
            banco: p.cliente.banco || prev.banco,
            tipoProducto: p.cliente.tipoProducto || prev.tipoProducto,
            plazoInicial: p.cliente.plazoInicial || prev.plazoInicial,
            cuotasPagadas: p.cliente.cuotasPagadas || prev.cuotasPagadas,
          }));
          if (p.uvr?.saldoUVR) setSaldoUVR(p.uvr.saldoUVR);
          if (p.uvr?.valorUVR) setValorUVR(p.uvr.valorUVR);
          if (p.uvr?.cuotaActualPesos) setCuotaActualPesos(p.uvr.cuotaActualPesos);
          if (p.uvr?.seguros) setSeguros(p.uvr.seguros);
          if (p.uvr?.teaCobrada) setTeaCobrada(p.uvr.teaCobrada);
        }}
      />
      <Card>
        <div id="datos-cliente-card" />
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
          <TextField label="Cuota actual en pesos con seguros" value={cuotaActualPesos} onChange={setCuotaActualPesos} placeholder="1.480.000" />
          <TextField label="Seguros mensuales" value={seguros} onChange={setSeguros} placeholder="230.000" />
          <TextField
            label="Cuota sin seguros"
            value={cuotaActualPesosNum > 0 && segurosNum >= 0 ? formatCOP(cuotaSinSegurosNum) : ""}
            readOnly
            hint="Calculada automáticamente"
          />
          <TextField label="Tasa cobrada EA (%)" value={teaCobrada} onChange={setTeaCobrada} placeholder="8,50" />
          <TextField label="Variación UVR EA (%)" value={variacionUVR} onChange={setVariacionUVR} placeholder="5,20" />
        </div>
      </Card>

      {datosCompletos && (
        <>
          <Card>
            <SectionTitle sub="Resumen ejecutivo del crédito UVR actual">Situación actual del crédito</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {metrics.map((m) => {
                if (m.label === "N° veces pagado el crédito") {
                  return (
                    <div key={m.label} className="rounded-xl border p-4" style={{ backgroundColor: vsActual.bg, borderColor: vsActual.color }}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: vsActual.color, opacity: 0.85 }}>{m.label}</div>
                      <div className="mt-1.5 text-lg font-extrabold leading-tight" style={{ color: vsActual.color }}>{m.value}</div>
                    </div>
                  );
                }
                return <MetricCard key={m.label} label={m.label} value={m.value} />;
              })}
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

              {recomendada && (
                <>
                  <RecommendedResult
                    mode="uvr"
                    personalizada={manualValido}
                    honorariosPct={honorariosPct}
                    items={recomendada}
                  />
                  <Card>
                    <SectionTitle>Escenario actual vs escenario optimizado</SectionTitle>
                    <div className="grid gap-4 lg:grid-cols-12">
                      <div className="lg:col-span-6">
                        <ScenarioTable rows={scenarioRows} />
                      </div>
                      <div className="lg:col-span-3">
                        <SavingsCard
                          mode="uvr"
                          ahorroTotal={recomendada.ahorroTotal}
                          añosEliminados={recomendada.añosEliminados}
                        />
                      </div>
                      <div className="lg:col-span-3">
                        <ImpactCard vecesActual={vecesActual} vecesOptimizado={vecesOpt} />
                      </div>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}

          <Card>
            <SectionTitle sub="Si se calcula, reemplaza automáticamente a la propuesta recomendada">Calculadora manual por nueva cuota propuesta</SectionTitle>
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

          {recomendada && (
            <DiscountModule honorariosBase={recomendada.honorarios} state={discount} onChange={setDiscount} />
          )}

          {recomendada && (() => {
            const d = computeDiscount(recomendada.honorarios, discount);
            return (
              <SaveExpedienteButton
                expedienteId={init?.id}
                onSaved={onSaved}
                payload={{
                  modo: "uvr",
                  cliente: client,
                  credito: { valorDesembolsado, saldoPesos, saldoUVR, valorUVR, cuotaActualPesos, seguros, teaCobrada, variacionUVR, nuevaCuotaManual },
                  propuesta: {
                    nuevaCuota: recomendada.nuevaCuota,
                    nuevoPlazo: recomendada.nuevoPlazo,
                    añosEliminados: recomendada.añosEliminados,
                    ahorroIntereses: recomendada.ahorroIntereses,
                    ahorroSeguros: recomendada.ahorroSeguros,
                    ahorroTotal: recomendada.ahorroTotal,
                    honorarios: recomendada.honorarios,
                    totalProyectado: recomendada.totalProyectado,
                    fuente: manualValido ? "manual" : "automatica",
                  },
                  discountState: discount as unknown as Record<string, unknown>,
                  honorariosBase: recomendada.honorarios,
                  honorariosFinal: d.final,
                  descuento: d.descuento,
                }}
              />
            );
          })()}

          {recomendada && (
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  if (!recomendada || !calc || calc.propuestas.length === 0 || scenarioRows.length === 0) {
                    alert("Primero debes calcular la simulación UVR antes de exportar el PDF.");
                    return;
                  }
                  await exportElementToPdf(
                    "pdf-content-uvr",
                    `NUVEX_Propuesta_UVR_${sanitizeFileName(client.nombre)}.pdf`
                  );
                }}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.negro }}
              >
                Exportar PDF profesional
              </button>
            </div>
          )}

          {recomendada && (() => {
            const d = computeDiscount(recomendada.honorarios, discount);
            return (
              <PrintDocument
                mode="uvr"
                client={client}
                cuotasPendientes={cuotasPendientes}
                metrics={metrics}
                uvrPropuestas={calc!.propuestas}
                bestIndex={bestIndex}
                honorariosPct={honorariosPct}
                personalizada={manualValido}
                recommended={{
                  añosEliminados: recomendada.añosEliminados,
                  ahorroIntereses: recomendada.ahorroIntereses,
                  ahorroSeguros: recomendada.ahorroSeguros,
                  ahorroTotal: recomendada.ahorroTotal,
                  honorarios: recomendada.honorarios,
                  nuevaCuota: recomendada.nuevaCuota,
                }}
                scenario={{
                  cuotaActual: input.cuotaActualPesos,
                  nuevaCuota: recomendada.nuevaCuota,
                  plazoActual: cuotasPendientes,
                  nuevoPlazo: recomendada.nuevoPlazo,
                  totalActual: totalActualPesos,
                  totalOptimizado: recomendada.totalProyectado,
                  vecesActual,
                  vecesOptimizado: vecesOpt,
                }}
                commercial={{
                  honorariosBase: recomendada.honorarios,
                  descuento: d.descuento,
                  finales: d.final,
                  vigencia: discount.vigencia || undefined,
                  hasDiscount: d.hasDiscount,
                }}
              />
            );
          })()}

          {recomendada && (() => {
            const d = computeDiscount(recomendada.honorarios, discount);
            const proyeccion: ProyeccionNuvex = {
              cuotaProyectada: recomendada.nuevaCuota,
              plazoProyectado: recomendada.nuevoPlazo,
              cuotasEliminadasProyectadas: cuotasPendientes - recomendada.nuevoPlazo,
              añosEliminadosProyectados: recomendada.añosEliminados,
              ahorroInteresesProyectado: recomendada.ahorroIntereses,
              ahorroSegurosProyectado: recomendada.ahorroSeguros,
              ahorroProyectado: recomendada.ahorroTotal,
              honorariosProyectados: recomendada.honorarios,
              honorariosBase: recomendada.honorarios,
              descuentoAplicado: d.descuento,
              honorariosFinales: d.final,
              fechaSimulacion: new Date().toISOString().slice(0, 10),
              fuente: manualValido ? "manual" : "automatica",
            };
            return (
              <ResultadoFinal
                mode="uvr"
                client={client}
                proyeccion={proyeccion}
                cuotasPendientes={cuotasPendientes}
                cuotaActualConSeguro={input.cuotaActualPesos}
                seguros={input.seguros}
                honorariosPct={honorariosPct}
                expedienteId={init?.id}
                aprobadoInicial={init?.aprobado_data ?? null}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
