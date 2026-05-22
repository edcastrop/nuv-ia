import { useMemo, useState } from "react";
import { Alert, Card, MetricCard, SectionTitle, TextField } from "./ui";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { PRODUCTOS_PESOS } from "./constants";
import { parseCurrency, parseDecimal, parsePercentage, formatCOP, formatNumber, formatPercentage } from "../../lib/format";
import {
  calculatePesosManual,
  calculatePesosProjection,
  pickBestProposal,
  type PesosInput,
} from "../../lib/finance";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import { ScenarioTable, buildPesosScenarioRows, ImpactCard, SavingsCard, getVecesStyle } from "./ScenarioTable";
import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { NUVEX } from "./constants";
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
import { useAsesorDefault } from "@/hooks/useAsesorDefault";


export function PesosSimulator({
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
  const [saldoCapital, setSaldoCapital] = useState(initCred.saldoCapital ?? "");
  const [cuotaActual, setCuotaActual] = useState(initCred.cuotaActual ?? "");
  const [seguros, setSeguros] = useState(initCred.seguros ?? "");
  const [tea, setTea] = useState(initCred.tea ?? "");
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState(initCred.nuevaCuotaManual ?? "");

  // Prellenar el campo "Asesor NUVEX" con el nombre del perfil autenticado
  useAsesorDefault(client.asesor, (nombre) => setClient((prev) => ({ ...prev, asesor: nombre })));


  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const valorDesembolsadoNum = parseCurrency(valorDesembolsado);
  const cuotaActualNum = parseCurrency(cuotaActual);
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaActualNum - segurosNum);
  const saldoCapitalNum = parseCurrency(saldoCapital);
  const dineroPagadoFecha = cuotaActualNum * cuotasPagadas;

  const input: PesosInput = useMemo(() => ({
    saldoCapital: saldoCapitalNum,
    cuotaActual: cuotaActualNum,
    seguros: segurosNum,
    tea: parsePercentage(tea),
    cuotasPendientes,
    porcentajeHonorarios: honorariosPct,
  }), [saldoCapitalNum, cuotaActualNum, segurosNum, tea, cuotasPendientes, honorariosPct]);

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

  const manualValido = !!(manual && manual.valid);

  // Recomendación efectiva: manual cuando es válida; si no, la mejor automática
  const recomendada = manualValido && manual
    ? {
        añosEliminados: manual.añosEliminados,
        ahorroIntereses: manual.ahorroIntereses,
        ahorroSeguros: manual.ahorroSeguros,
        ahorroTotal: manual.ahorroTotal,
        honorarios: manual.honorarios,
        nuevaCuota: manual.nuevaCuotaConSeguro,
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
          nuevaCuota: best.nuevaCuotaConSeguro,
          nuevoPlazo: best.nuevoPlazo,
          totalProyectado: best.totalAproxPagar,
        }
      : null;

  const ahorroNegativo = recomendada && (recomendada.ahorroTotal < 0 || recomendada.honorarios < 0);

  const totalActualPendiente = cuotaActualNum * cuotasPendientes;
  const vecesActual = saldoCapitalNum > 0 ? totalActualPendiente / saldoCapitalNum : 0;
  const vsActual = getVecesStyle(vecesActual);

  const metrics = [
    { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
    { label: "Saldo actual", value: formatCOP(input.saldoCapital) },
    { label: "Cuota actual con seguros", value: formatCOP(input.cuotaActual) },
    { label: "Seguros mensuales", value: formatCOP(input.seguros) },
    { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
    { label: "Cuotas pagadas", value: String(cuotasPagadas) },
    { label: "Cuotas pendientes", value: String(cuotasPendientes) },
    { label: "Dinero pagado a la fecha", value: formatCOP(dineroPagadoFecha) },
    { label: "N° veces pagado el crédito", value: `${formatNumber(vecesActual, 2)} veces` },
    { label: "Plazo inicial", value: `${plazoInicial} meses` },
    { label: "TEA", value: formatPercentage(input.tea) },
    { label: "Total por pagar", value: formatCOP(totalActualPendiente) },
  ];

  const scenarioRows = recomendada
    ? buildPesosScenarioRows({
        cuotaActual: input.cuotaActual,
        cuotasPendientes,
        totalActualPendiente,
        saldoCapital: saldoCapitalNum,
        nuevaCuota: recomendada.nuevaCuota,
        nuevoPlazo: recomendada.nuevoPlazo,
        totalProyectado: recomendada.totalProyectado,
        ahorroIntereses: recomendada.ahorroIntereses,
        ahorroSeguros: recomendada.ahorroSeguros,
        ahorroTotal: recomendada.ahorroTotal,
      })
    : [];

  const vecesOpt = recomendada && saldoCapitalNum > 0 ? recomendada.totalProyectado / saldoCapitalNum : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      {onReset && (
        <div className="flex justify-end">
          <button onClick={onReset} className="text-xs text-[#445DA3] hover:underline">← Cambiar modo</button>
        </div>
      )}
      <ExtractoReader
        modo="pesos"
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
          if (p.pesos?.saldoCapital) setSaldoCapital(p.pesos.saldoCapital);
          if (p.pesos?.cuotaActual) setCuotaActual(p.pesos.cuotaActual);
          if (p.pesos?.seguros) setSeguros(p.pesos.seguros);
          if (p.pesos?.tea) setTea(p.pesos.tea);
          if (p.cobertura?.activo) {
            setCobertura({
              activo: true,
              valorCobertura: p.cobertura.valorCobertura || "",
              tasaCobertura: p.cobertura.tasaCobertura || "",
              tipoBeneficio: p.cobertura.tipoBeneficio || "",
              cuotaPagadaCliente: p.cobertura.cuotaPagadaCliente || "",
              cuotaBaseSimulacion: p.cobertura.cuotaBaseSimulacion || "",
              requiereVerificacion: !!p.cobertura.requiereVerificacion,
            });
          }
        }}
      />
      <Card>
        <div id="datos-cliente-card" />
        <SectionTitle sub="Información general del cliente y del crédito">Datos del cliente</SectionTitle>

        <ClientFields data={client} onChange={setClient} productos={PRODUCTOS_PESOS} cuotasPendientes={cuotasPendientes} />

        <div className="mt-6">
          <IntervinientesFields producto={client.tipoProducto} data={intervinientes} onChange={setIntervinientes} />
        </div>

        <div className="mt-6">
          <CoberturaFields producto={client.tipoProducto} data={cobertura} onChange={setCobertura} />
        </div>

        {validaciones.map((v, i) => (
          <div key={i} className="mt-3"><Alert tone="error">{v}</Alert></div>
        ))}
        {cuotasPendientes > 0 && cuotasPendientes <= 72 && (
          <div className="mt-3"><Alert>Cuotas pendientes ≤ 72. Revise viabilidad de la propuesta.</Alert></div>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Información financiera del crédito en pesos">Datos del crédito</SectionTitle>
        {cobertura.activo && (cobertura.tipoBeneficio || cobertura.cuotaBaseSimulacion) && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "rgba(132,185,143,0.10)",
              border: "1px solid rgba(132,185,143,0.45)",
              color: "#1F7A45",
            }}
          >
            <span className="font-bold">Cuota base de simulación activa.</span>
            <span>
              Beneficio detectado: <strong>{cobertura.tipoBeneficio || "Cobertura"}</strong>.
              La cuota mensual usada para simular es la cuota real del crédito (sin subsidio), no la cuota que paga hoy el cliente.
            </span>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <TextField label="Valor desembolsado" value={valorDesembolsado} onChange={setValorDesembolsado} placeholder="250.000.000" />
          <TextField label="Saldo a capital" value={saldoCapital} onChange={setSaldoCapital} placeholder="221.903.943" />
          <TextField label="Cuota mensual actual con seguros" value={cuotaActual} onChange={setCuotaActual} placeholder="2.260.000" hint={cobertura.activo && cobertura.cuotaBaseSimulacion ? "Cuota BASE de simulación (sin subsidio)" : undefined} />
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
                <ComparativeTable mode="pesos" pesos={calc.propuestas} bestIndex={bestIndex} honorariosPct={honorariosPct} />
              </Card>

              {recomendada && (
                <>
                  <RecommendedResult
                    mode="pesos"
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
                          mode="pesos"
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
                  modo: "pesos",
                  cliente: { ...client, intervinientes, cobertura },
                  credito: { valorDesembolsado, saldoCapital, cuotaActual, seguros, tea, nuevaCuotaManual },
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
                  if (!recomendada || !calc || calc.propuestas.length === 0) {
                    alert("Primero debes calcular la simulación en pesos antes de exportar el PDF.");
                    return;
                  }
                  await exportElementToPdf(
                    "pdf-content-pesos",
                    `NUVEX_Propuesta_Pesos_${sanitizeFileName(client.nombre)}.pdf`
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
                mode="pesos"
                client={{ ...client, intervinientes, cobertura }}
                cuotasPendientes={cuotasPendientes}
                metrics={metrics}
                pesosPropuestas={calc!.propuestas}
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
                  cuotaActual: input.cuotaActual,
                  nuevaCuota: recomendada.nuevaCuota,
                  plazoActual: cuotasPendientes,
                  nuevoPlazo: recomendada.nuevoPlazo,
                  totalActual: totalActualPendiente,
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
                mode="pesos"
                client={{ ...client, intervinientes, cobertura }}
                proyeccion={proyeccion}
                cuotasPendientes={cuotasPendientes}
                cuotaActualConSeguro={input.cuotaActual}
                seguros={input.seguros}
                honorariosPct={honorariosPct}
                expedienteId={init?.id}
                aprobadoInicial={init?.aprobado_data ?? null}
                estado={init?.estado}
                fechaPagoHonorarios={init?.updated_at ? init.updated_at.slice(0, 10) : undefined}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}
