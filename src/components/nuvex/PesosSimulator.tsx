import { useMemo, useState } from "react";
import { Alert, Card, MetricCard, SectionTitle, TextField } from "./ui";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";

import {
  parseCurrency,
  parseDecimal,
  parsePercentage,
  formatCOP,
  formatNumber,
  formatPercentage,
} from "../../lib/format";
import {
  calculatePesosManual,
  calculatePesosManualByCuotas,
  calculatePesosProjection,
  pickBestProposal,
  type PesosInput,
} from "../../lib/finance";
import { ComparativeTable } from "./ComparativeTable";
import { RecommendedResult } from "./RecommendedResult";
import {
  ScenarioTable,
  buildPesosScenarioRows,
  ImpactCard,
  SavingsCard,
  getVecesStyle,
} from "./ScenarioTable";
import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { EnviarDocumentoButton } from "./EnviarDocumentoButton";
import { NUVEX } from "./constants";
import {
  DiscountModule,
  computeDiscount,
  defaultDiscount,
  type DiscountState,
} from "./DiscountModule";
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
import { freshFromCobertura } from "@/lib/cobertura";
import { normalizeCreditMoneyInput } from "@/lib/creditoSanity";

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
  const [extractoArchivoPath, setExtractoArchivoPath] = useState<string>(() =>
    typeof initCred.archivoPath === "string" ? initCred.archivoPath : "",
  );
  const [discount, setDiscount] = useState<DiscountState>(() =>
    init?.discount_data && Object.keys(init.discount_data).length
      ? (init.discount_data as unknown as DiscountState)
      : defaultDiscount,
  );
  const initClient = (init?.cliente_data as ClientData | undefined) ?? undefined;
  const [client, setClient] = useState<ClientData>(() => initClient ?? defaultClient);
  const [intervinientes, setIntervinientes] = useState<Interviniente[]>(() =>
    initClient?.intervinientes && initClient.intervinientes.length > 0
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
  const [cuotasEliminarManual, setCuotasEliminarManual] = useState(
    initCred.cuotasEliminarManual ?? "",
  );
  const [modoPersonalizada, setModoPersonalizada] = useState<"cuota" | "cuotas">(
    initCred.cuotasEliminarManual && !initCred.nuevaCuotaManual ? "cuotas" : "cuota",
  );

  // Prellenar el campo "Asesor NUVEX" con el nombre del perfil autenticado
  useAsesorDefault(client.asesor, (nombre) => setClient((prev) => ({ ...prev, asesor: nombre })));

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const saneCredito = normalizeCreditMoneyInput({
    valorDesembolsado,
    saldoCapital,
    cuotaActual,
    seguros,
    cuotaBaseSimulacion: cobertura.cuotaBaseSimulacion,
    cuotaConSubsidio: cobertura.cuotaPagadaCliente,
    cuotaConInteresSinSeguros: cobertura.cuotaConInteresSinSeguros,
    valorBeneficioMensual: cobertura.valorCobertura,
  });
  const valorDesembolsadoNum =
    saneCredito.numbers.valorDesembolsado ?? parseCurrency(valorDesembolsado);
  const cuotaActualNum = saneCredito.numbers.cuotaActual ?? parseCurrency(cuotaActual);
  const cuotaPagadaClienteNum = parseCurrency(cobertura.cuotaPagadaCliente);
  const cuotaBaseSimulacionRaw =
    saneCredito.numbers.cuotaBaseSimulacion ?? parseCurrency(cobertura.cuotaBaseSimulacion);
  const saldoCapitalNum = saneCredito.numbers.saldoCapital ?? parseCurrency(saldoCapital);
  const baseReferenciaCredito = Math.max(saldoCapitalNum, valorDesembolsadoNum, 1);
  const cuotaMaximaRazonable = Math.max(8_000_000, baseReferenciaCredito * 0.04);
  const cuotaBaseSimulacionNum =
    cuotaBaseSimulacionRaw > 0 && cuotaBaseSimulacionRaw <= cuotaMaximaRazonable
      ? cuotaBaseSimulacionRaw
      : 0;
  const cuotaActualValida =
    cuotaActualNum > 0 && cuotaActualNum <= cuotaMaximaRazonable ? cuotaActualNum : 0;
  const cuotaPagadaClienteValida =
    cuotaPagadaClienteNum > 0 && cuotaPagadaClienteNum <= cuotaMaximaRazonable
      ? cuotaPagadaClienteNum
      : 0;
  const cuotaSimulacionNum =
    cuotaBaseSimulacionNum > 0 ? cuotaBaseSimulacionNum : cuotaActualValida;
  const cuotaClienteHoyNum =
    cuotaPagadaClienteValida > 0 ? cuotaPagadaClienteValida : cuotaActualValida;
  const segurosNum = saneCredito.numbers.seguros ?? parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaSimulacionNum - segurosNum);
  const dineroPagadoFecha = cuotaClienteHoyNum * cuotasPagadas;

  const input: PesosInput = useMemo(
    () => ({
      saldoCapital: saldoCapitalNum,
      cuotaActual: cuotaSimulacionNum,
      seguros: segurosNum,
      tea: parsePercentage(tea),
      cuotasPendientes,
      porcentajeHonorarios: honorariosPct,
    }),
    [saldoCapitalNum, cuotaSimulacionNum, segurosNum, tea, cuotasPendientes, honorariosPct],
  );

  const validaciones: string[] = [];
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial)
    validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (plazoInicial > 0 && cuotasPagadas === plazoInicial)
    validaciones.push("Este crédito ya está amortizado.");
  if (cuotaSimulacionNum > 0 && segurosNum > cuotaSimulacionNum)
    validaciones.push("Los seguros no pueden ser mayores que la cuota actual.");
  if (cuotaActualNum > cuotaMaximaRazonable || cuotaBaseSimulacionRaw > cuotaMaximaRazonable)
    validaciones.push(
      "La cuota mensual está fuera de rango para este crédito. Revise la lectura del extracto antes de simular.",
    );
  if (segurosNum > 0 && segurosNum > Math.max(500_000, cuotaSimulacionNum * 0.2))
    validaciones.push(
      "Los seguros mensuales están fuera de rango. Revise la lectura del extracto.",
    );
  if (cuotaSimulacionNum > 0 && segurosNum > 0 && cuotaSinSegurosNum <= 0)
    validaciones.push("La cuota sin seguros debe ser mayor a cero para calcular la proyección.");

  const cuotaSinSegurosValida =
    cuotaSimulacionNum === 0 ||
    segurosNum === 0 ||
    (segurosNum < cuotaSimulacionNum && cuotaSinSegurosNum > 0);
  const rangosFinancierosValidos =
    cuotaSimulacionNum > 0 &&
    cuotaSimulacionNum <= cuotaMaximaRazonable &&
    (segurosNum === 0 || segurosNum <= Math.max(500_000, cuotaSimulacionNum * 0.2));

  const datosCompletos =
    input.saldoCapital > 0 &&
    input.cuotaActual > 0 &&
    input.tea > 0 &&
    cuotasPendientes > 0 &&
    cuotaSinSegurosValida &&
    rangosFinancierosValidos;

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
    let v: number;
    let baseResult;
    if (modoPersonalizada === "cuotas") {
      const ce = parseDecimal(cuotasEliminarManual);
      if (!ce) return null;
      baseResult = calculatePesosManualByCuotas(input, ce);
      v = baseResult.nuevaCuotaConSeguro;
    } else {
      v = parseCurrency(nuevaCuotaManual);
      if (!v) return null;
      baseResult = calculatePesosManual(input, v);
    }
    // Tolerancia $2.000: si la cuota manual coincide con una propuesta automática,
    // se usan los resultados de esa propuesta para evitar discrepancias por redondeo.
    if (baseResult.valid && calc) {
      const TOLERANCIA = 2000;
      for (const p of calc.propuestas) {
        if (Math.abs(v - p.nuevaCuotaConSeguro) <= TOLERANCIA) {
          return {
            ...baseResult,
            nuevaCuotaConSeguro: v,
            nuevaCuotaSinSeguro: v - input.seguros,
            nuevoPlazo: p.nuevoPlazo,
            cuotasEliminadas: p.cuotasEliminadas,
            añosEliminados: p.añosEliminados,
            totalProyectado: p.totalAproxPagar,
            ahorroIntereses: p.ahorroIntereses,
            ahorroSeguros: p.ahorroSeguros,
            ahorroTotal: p.ahorroTotal,
            honorarios: p.honorariosNuvex,
            incrementoMensual: v - input.cuotaActual,
            valid: true,
          };
        }
      }
    }
    return baseResult;
  }, [datosCompletos, input, nuevaCuotaManual, cuotasEliminarManual, modoPersonalizada, calc]);

  const manualValido = !!(manual && manual.valid);

  // Recomendación efectiva: manual cuando es válida; si no, la mejor automática
  const recomendada =
    manualValido && manual
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

  const cuotasBaseSimulacion = Math.max(0, cuotasPendientes);
  const totalActualPendiente = input.cuotaActual * cuotasBaseSimulacion;
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
    {
      label: "Tasa mensual utilizada",
      value: calc ? formatPercentage(calc.tasaMensual * 100, 4) : "—",
    },
    { label: "Total por pagar", value: formatCOP(totalActualPendiente) },
  ];

  const scenarioRows = recomendada
    ? buildPesosScenarioRows({
        cuotaActual: input.cuotaActual,
        cuotasPendientes: cuotasBaseSimulacion,
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

  const vecesOpt =
    recomendada && saldoCapitalNum > 0 ? recomendada.totalProyectado / saldoCapitalNum : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-6 py-6">
      {onReset && (
        <div className="flex justify-end">
          <button onClick={onReset} className="text-xs text-[#445DA3] hover:underline">
            ← Cambiar modo
          </button>
        </div>
      )}
      <ExtractoReader
        modo="pesos"
        existingArchivoPath={extractoArchivoPath}
        onApply={(p: ExtractoApplyPayload) => {
          if (p.archivoPath) setExtractoArchivoPath(p.archivoPath);
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
          if (p.pesos?.valorDesembolsado) setValorDesembolsado(p.pesos.valorDesembolsado);
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
              cuotaConInteresSinSeguros: p.cobertura.cuotaConInteresSinSeguros || "",
              segurosMensuales: p.cobertura.segurosMensuales || p.pesos?.seguros || "",
              cuotaBaseSimulacion: p.cobertura.cuotaBaseSimulacion || "",
              requiereVerificacion: !!p.cobertura.requiereVerificacion,
            });
          }
        }}
      />
      <Card>
        <div id="datos-cliente-card" />
        <SectionTitle sub="Información general del cliente y del crédito">
          Datos del cliente
        </SectionTitle>

        <ClientFields
          data={client}
          onChange={setClient}
          modalidad="pesos"
          cuotasPendientes={cuotasPendientes}
        />


        <div className="mt-6">
          <IntervinientesFields
            producto={client.tipoProducto}
            data={intervinientes}
            onChange={setIntervinientes}
            onTitularSync={(nombre, cedula) =>
              setClient((c) => ({
                ...c,
                nombre: nombre || c.nombre,
                cedula: cedula || c.cedula,
              }))
            }
          />
        </div>

        <div className="mt-6">
          <CoberturaFields
            producto={client.tipoProducto}
            data={cobertura}
            onChange={setCobertura}
          />
        </div>

        {validaciones.map((v, i) => (
          <div key={i} className="mt-3">
            <Alert tone="error">{v}</Alert>
          </div>
        ))}
        {cuotasPendientes > 0 && cuotasPendientes <= 72 && (
          <div className="mt-3">
            <Alert>Cuotas pendientes ≤ 72. Revise viabilidad de la propuesta.</Alert>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle sub="Información financiera del crédito en pesos">
          Datos del crédito
        </SectionTitle>
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
              Beneficio detectado: <strong>{cobertura.tipoBeneficio || "Cobertura"}</strong>. La
              cuota mensual usada para simular es la cuota real del crédito (sin subsidio), no la
              cuota que paga hoy el cliente.
            </span>
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-4">
          <TextField
            label="Valor desembolsado"
            value={valorDesembolsado}
            onChange={setValorDesembolsado}
            placeholder="250.000.000"
          />
          <TextField
            label="Saldo a capital"
            value={saldoCapital}
            onChange={setSaldoCapital}
            placeholder="221.903.943"
          />
          <TextField
            label="Cuota mensual actual con seguros"
            value={cuotaActual}
            onChange={setCuotaActual}
            placeholder="2.260.000"
            hint={
              cobertura.activo && cobertura.cuotaBaseSimulacion
                ? "Cuota BASE de simulación (sin subsidio)"
                : undefined
            }
          />
          <TextField
            label="Seguros mensuales"
            value={seguros}
            onChange={setSeguros}
            placeholder="180.000"
          />
          <TextField
            label="Cuota mensual sin seguros"
            value={cuotaSimulacionNum > 0 && segurosNum >= 0 ? formatCOP(cuotaSinSegurosNum) : ""}
            readOnly
            hint="Calculada automáticamente"
          />
          <TextField
            label="Tasa Efectiva Anual (%)"
            value={tea}
            onChange={setTea}
            placeholder="11,15"
          />
        </div>
      </Card>

      {datosCompletos && (
        <>
          <Card>
            <SectionTitle sub="Resumen ejecutivo del crédito actual">
              Situación actual del crédito
            </SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {metrics.map((m) => {
                if (m.label === "N° veces pagado el crédito") {
                  return (
                    <div
                      key={m.label}
                      className="rounded-xl border p-4"
                      style={{ backgroundColor: vsActual.bg, borderColor: vsActual.color }}
                    >
                      <div
                        className="text-[11px] font-semibold uppercase tracking-wider"
                        style={{ color: vsActual.color, opacity: 0.85 }}
                      >
                        {m.label}
                      </div>
                      <div
                        className="mt-1.5 text-lg font-extrabold leading-tight"
                        style={{ color: vsActual.color }}
                      >
                        {m.value}
                      </div>
                    </div>
                  );
                }
                return <MetricCard key={m.label} label={m.label} value={m.value} />;
              })}
            </div>
          </Card>

          {ahorroNegativo && (
            <Alert tone="error">
              Revisar datos. El ahorro u honorarios calculados son negativos.
            </Alert>
          )}

          {calc && calc.propuestas.length > 0 && (
            <>
              <Card>
                <SectionTitle sub="Compare cada propuesta y la recomendada en verde">
                  Tabla comparativa de propuestas
                </SectionTitle>
                <ComparativeTable
                  mode="pesos"
                  pesos={calc.propuestas}
                  bestIndex={bestIndex}
                  honorariosPct={honorariosPct}
                />
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
            <SectionTitle sub="Escenario adicional para negociación comercial. Reemplaza la propuesta recomendada cuando es válida.">
              🎯 Propuesta personalizada NUVEX
            </SectionTitle>
            <div className="mb-4 inline-flex rounded-lg border border-[#E3E7EE] bg-white p-1">
              <button
                type="button"
                onClick={() => setModoPersonalizada("cuota")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  modoPersonalizada === "cuota"
                    ? "text-white shadow"
                    : "text-[#242424]/70 hover:text-[#242424]"
                }`}
                style={modoPersonalizada === "cuota" ? { backgroundColor: NUVEX.azul } : undefined}
              >
                Calcular por nueva cuota
              </button>
              <button
                type="button"
                onClick={() => setModoPersonalizada("cuotas")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  modoPersonalizada === "cuotas"
                    ? "text-white shadow"
                    : "text-[#242424]/70 hover:text-[#242424]"
                }`}
                style={modoPersonalizada === "cuotas" ? { backgroundColor: NUVEX.azul } : undefined}
              >
                Calcular por cuotas a eliminar
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {modoPersonalizada === "cuota" ? (
                <TextField
                  label="Nueva cuota deseada"
                  value={nuevaCuotaManual}
                  onChange={setNuevaCuotaManual}
                  placeholder="2.800.000"
                />
              ) : (
                <TextField
                  label="Cuotas a eliminar"
                  value={cuotasEliminarManual}
                  onChange={setCuotasEliminarManual}
                  placeholder="36"
                />
              )}
            </div>
            {manual && !manual.valid && manual.motivo && (
              <div className="mt-3">
                <Alert tone="error">{manual.motivo}</Alert>
              </div>
            )}
            {manual && manual.valid && (
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <MetricCard
                  label="Nueva cuota"
                  value={formatCOP(manual.nuevaCuotaConSeguro)}
                  accent="green"
                />
                <MetricCard
                  label="Incremento mensual"
                  value={formatCOP(manual.incrementoMensual)}
                />
                <MetricCard label="Nuevo plazo" value={`${manual.nuevoPlazo} meses`} />
                <MetricCard label="Cuotas eliminadas" value={String(manual.cuotasEliminadas)} />
                <MetricCard label="Años eliminados" value={manual.añosEliminados.toFixed(1)} />
                <MetricCard label="Ahorro intereses" value={formatCOP(manual.ahorroIntereses)} />
                <MetricCard label="Ahorro seguros" value={formatCOP(manual.ahorroSeguros)} />
                <MetricCard
                  label="Ahorro total"
                  value={formatCOP(manual.ahorroTotal)}
                  accent="green"
                />
                <MetricCard
                  label="Honorarios NUVEX"
                  value={formatCOP(manual.honorarios)}
                  accent="blue"
                />
                <MetricCard label="Total proyectado" value={formatCOP(manual.totalProyectado)} />
              </div>
            )}
          </Card>

          {recomendada && (
            <DiscountModule
              honorariosBase={recomendada.honorarios}
              state={discount}
              onChange={setDiscount}
            />
          )}

          {recomendada &&
            (() => {
              const d = computeDiscount(recomendada.honorarios, discount);
              // Centralización Fresh: derivamos y persistimos en credito_data
              // para que TODOS los módulos lo reutilicen sin recapturar datos.
              const coberturaFresh = freshFromCobertura(cobertura, {
                cuotasPagadasCredito: cuotasPagadas,
                saldoCapital: saldoCapitalNum,
                fuente: cobertura.activo ? "ocr" : "manual",
                detectadoOCR: !!cobertura.tipoBeneficio,
              });
              return (
                <SaveExpedienteButton
                  expedienteId={init?.id}
                  onSaved={onSaved}
                  payload={{
                    modo: "pesos",
                    cliente: { ...client, intervinientes, cobertura },
                    credito: {
                      valorDesembolsado,
                      saldoCapital,
                      cuotaActual,
                      seguros,
                      tea,
                      nuevaCuotaManual,
                      cuotasEliminarManual,
                      cuotaPagadaCliente: cobertura.cuotaPagadaCliente || "",
                      valorBeneficio: cobertura.valorCobertura || "",
                      tipoBeneficio: cobertura.tipoBeneficio || "",
                      cuotaConInteresSinSeguros: cobertura.cuotaConInteresSinSeguros || "",
                      cuotaBaseSimulacion: cobertura.cuotaBaseSimulacion || cuotaActual,
                      segurosMensuales: cobertura.segurosMensuales || seguros,
                      tieneBeneficio: cobertura.activo ? "si" : "no",
                      coberturaFresh: coberturaFresh as unknown as string,
                      archivoPath: extractoArchivoPath,
                    },
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
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={async () => {
                  if (!recomendada || !calc || calc.propuestas.length === 0) {
                    alert(
                      "Primero debes calcular la simulación en pesos antes de exportar el PDF.",
                    );
                    return;
                  }
                  await exportElementToPdf(
                    "pdf-content-pesos",
                    `NUVEX_Propuesta_Pesos_${sanitizeFileName(client.nombre)}.pdf`,
                  );
                }}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.negro }}
              >
                Exportar PDF profesional
              </button>
              <EnviarDocumentoButton
                expedienteId={init?.id}
                tipo="propuesta_comercial"
                elementId="pdf-content-pesos"
                filename={`NUVEX_Propuesta_Pesos_${sanitizeFileName(client.nombre)}.pdf`}
                disabled={!recomendada || !calc || calc.propuestas.length === 0}
                disabledReason="Primero calcula la simulación en pesos."
                label="Enviar propuesta al cliente"
              />
            </div>
          )}

          {recomendada &&
            (() => {
              const d = computeDiscount(recomendada.honorarios, discount);
              return (
                <PrintDocument
                  mode="pesos"
                  client={{ ...client, intervinientes, cobertura }}
                  cuotasPendientes={cuotasBaseSimulacion}
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
                    plazoActual: cuotasBaseSimulacion,
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

          {recomendada &&
            (() => {
              const d = computeDiscount(recomendada.honorarios, discount);
              const proyeccion: ProyeccionNuvex = {
                cuotaProyectada: recomendada.nuevaCuota,
                plazoProyectado: recomendada.nuevoPlazo,
                cuotasEliminadasProyectadas: cuotasBaseSimulacion - recomendada.nuevoPlazo,
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
                  cuotasPendientes={cuotasBaseSimulacion}
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
