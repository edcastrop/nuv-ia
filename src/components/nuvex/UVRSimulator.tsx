import { useMemo, useState } from "react";
import { Alert, Card, SectionTitle, TextField } from "./ui";
import { SituacionActualBlock } from "./SituacionActualBlock";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { CreditoMetaFields } from "./CreditoMetaFields";
import { NUVEX } from "./constants";
import {
  parseCurrency,
  parseDecimal,
  parsePercentage,
  formatCOP,
  formatNumber,
  formatPercentage,
  formatUVR,
} from "../../lib/format";
import {
  calculateUVRManual,
  calculateUVRManualByCuotas,
  calculateUVRProjection,
  pickBestProposal,
  type UVRInput,
} from "../../lib/finance";

import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { EnviarDocumentoButton } from "./EnviarDocumentoButton";
import {
  DiscountModule,
  computeDiscount,
  defaultDiscount,
  type DiscountState,
} from "./DiscountModule";
// ResultadoFinal removido del simulador: vive en el Expediente (Etapa 9+).
import { SaveExpedienteButton } from "./SaveExpedienteButton";
import type { Expediente } from "@/lib/expedientes";
import { ExtractoReader, type ExtractoApplyPayload } from "./ExtractoReader";
import { FreshBlock } from "./FreshBlock";
import {
  PropuestasComerciales,
  type RecomendadaSeleccionada,
} from "./PropuestasComerciales";
import {
  defaultCobertura,
  defaultIntervinientes,
  type Cobertura,
  type Interviniente,
} from "./intervinientes";
import { getDefaultVariacionUVR, setDefaultVariacionUVR } from "../../lib/uvrConfig";
import { useAsesorDefault } from "@/hooks/useAsesorDefault";
import { freshFromCobertura } from "@/lib/cobertura";
import { Settings2 } from "lucide-react";
import { AuditPanel } from "./AuditPanel";
import { useNivelAutonomia } from "@/hooks/useNivelAutonomia";

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
  const [saldoPesos, setSaldoPesos] = useState(initCred.saldoPesos ?? "");
  const [saldoUVR, setSaldoUVR] = useState(initCred.saldoUVR ?? "");
  const [valorUVR, setValorUVR] = useState(initCred.valorUVR ?? "");
  const [cuotaActualPesos, setCuotaActualPesos] = useState(initCred.cuotaActualPesos ?? "");
  const [seguros, setSeguros] = useState(initCred.seguros ?? "");
  const [teaCobrada, setTeaCobrada] = useState(initCred.teaCobrada ?? "");
  const [variacionUVR, setVariacionUVR] = useState(
    initCred.variacionUVR ?? getDefaultVariacionUVR(),
  );
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState(initCred.nuevaCuotaManual ?? "");
  const [cuotasEliminarManual, setCuotasEliminarManual] = useState(
    initCred.cuotasEliminarManual ?? "",
  );
  const [modoPersonalizada, setModoPersonalizada] = useState<"cuota" | "cuotas">(
    initCred.cuotasEliminarManual && !initCred.nuevaCuotaManual ? "cuotas" : "cuota",
  );
  const [showConfigVariacion, setShowConfigVariacion] = useState(false);
  const [variacionDefaultInput, setVariacionDefaultInput] = useState(getDefaultVariacionUVR());

  // Prellenar el campo "Asesor NUVEX" con el nombre del perfil autenticado
  useAsesorDefault(client.asesor, (nombre) => setClient((prev) => ({ ...prev, asesor: nombre })));
  const { metricas: metricasAutonomia } = useNivelAutonomia();

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientes = Math.max(0, plazoInicial - cuotasPagadas);
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const valorDesembolsadoNum = parseCurrency(valorDesembolsado);
  const cuotaActualPesosNum = parseCurrency(cuotaActualPesos);
  const cuotaPagadaClienteNum = parseCurrency(cobertura.cuotaPagadaCliente);
  const cuotaBaseSimulacionNum = parseCurrency(cobertura.cuotaBaseSimulacion);
  const cuotaSimulacionPesosNum =
    cuotaBaseSimulacionNum > 0 ? cuotaBaseSimulacionNum : cuotaActualPesosNum;
  const cuotaClienteHoyNum = cuotaPagadaClienteNum > 0 ? cuotaPagadaClienteNum : cuotaActualPesosNum;
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaSimulacionPesosNum - segurosNum);
  const saldoPesosNum = parseCurrency(saldoPesos);
  const dineroPagadoFecha = cuotaClienteHoyNum * cuotasPagadas;

  const input: UVRInput = useMemo(
    () => ({
      valorDesembolsado: valorDesembolsadoNum,
      saldoPesos: saldoPesosNum,
      saldoUVR: parseDecimal(saldoUVR),
      valorUVR: parseDecimal(valorUVR),
      cuotaActualPesos: cuotaSimulacionPesosNum,
      cuotaSinSeguros: cuotaSinSegurosNum,
      seguros: segurosNum,
      teaCobrada: parsePercentage(teaCobrada),
      variacionUVR: parsePercentage(variacionUVR),
      cuotasPendientes,
      plazoInicial,
      porcentajeHonorarios: honorariosPct,
    }),
    [
      valorDesembolsadoNum,
      saldoPesosNum,
      saldoUVR,
      valorUVR,
      cuotaSimulacionPesosNum,
      cuotaSinSegurosNum,
      segurosNum,
      teaCobrada,
      variacionUVR,
      cuotasPendientes,
      plazoInicial,
      honorariosPct,
    ],
  );

  const validaciones: string[] = [];
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial)
    validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (input.saldoUVR <= 0 && saldoUVR) validaciones.push("Saldo UVR debe ser mayor a 0.");
  if (input.valorUVR <= 0 && valorUVR) validaciones.push("Valor UVR debe ser mayor a 0.");
  if (cuotaSimulacionPesosNum > 0 && segurosNum > cuotaSimulacionPesosNum)
    validaciones.push("Los seguros no pueden ser mayores que la cuota actual.");
  if (cuotaSimulacionPesosNum > 0 && segurosNum > 0 && cuotaSinSegurosNum <= 0)
    validaciones.push("La cuota sin seguros debe ser mayor a cero para calcular la proyección.");

  const cuotaSinSegurosValida =
    cuotaSimulacionPesosNum === 0 ||
    segurosNum === 0 ||
    (segurosNum < cuotaSimulacionPesosNum && cuotaSinSegurosNum > 0);

  const datosCompletos =
    input.saldoUVR > 0 &&
    input.valorUVR > 0 &&
    input.cuotaActualPesos > 0 &&
    input.teaCobrada > 0 &&
    cuotasPendientes > 0 &&
    cuotaSinSegurosValida;

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
    let v: number;
    let baseResult;
    if (modoPersonalizada === "cuotas") {
      const ce = parseDecimal(cuotasEliminarManual);
      if (!ce) return null;
      baseResult = calculateUVRManualByCuotas(input, calc.escenarioActual, ce);
      v = baseResult.nuevaCuotaPesos;
    } else {
      v = parseCurrency(nuevaCuotaManual);
      if (!v) return null;
      baseResult = calculateUVRManual(input, calc.escenarioActual, v);
    }
    // Tolerancia $2.000: si la cuota manual coincide con una propuesta automática,
    // se usan los resultados de esa propuesta para evitar discrepancias por redondeo.
    if (baseResult.valid) {
      const TOLERANCIA = 2000;
      for (const p of calc.propuestas) {
        if (Math.abs(v - p.nuevaCuotaConSeguroAprox) <= TOLERANCIA) {
          return {
            ...baseResult,
            nuevaCuotaPesos: v,
            nuevaCuotaUVR: p.nuevaCuotaUVR,
            nuevoPlazo: p.nuevoPlazo,
            cuotasEliminadas: p.cuotasEliminadas,
            añosEliminados: p.añosEliminados,
            incrementoMensual: v - input.cuotaActualPesos,
            totalProyectado: p.totalAproxPagar,
            ahorroIntereses: p.ahorroIntereses,
            ahorroSeguros: p.ahorroSeguros,
            ahorroTotal: p.ahorroTotal,
            honorarios: p.honorariosNuvex,
            valid: true,
          };
        }
      }
    }
    return baseResult;
  }, [datosCompletos, input, calc, nuevaCuotaManual, cuotasEliminarManual, modoPersonalizada]);


  // Recomendada elegida desde el bloque comercial de Propuestas (cards editables)
  const [recomendadaPicked, setRecomendadaPicked] = useState<RecomendadaSeleccionada | null>(null);
  const manualValido = recomendadaPicked?.fuente === "manual";
  const recomendada = recomendadaPicked
    ? {
        añosEliminados: recomendadaPicked.añosEliminados,
        ahorroIntereses: recomendadaPicked.ahorroIntereses,
        ahorroSeguros: recomendadaPicked.ahorroSeguros,
        ahorroTotal: recomendadaPicked.ahorroTotal,
        honorarios: recomendadaPicked.honorarios,
        nuevaCuota: recomendadaPicked.nuevaCuota,
        nuevoPlazo: recomendadaPicked.nuevoPlazo,
        totalProyectado: recomendadaPicked.totalProyectado,
      }
    : null;

  const ahorroNegativo = recomendada && (recomendada.ahorroTotal < 0 || recomendada.honorarios < 0);

  const cuotasBaseSimulacion = Math.max(0, cuotasPendientes);
  const totalActualPesos = calc?.escenarioActual.totalPagoPesos ?? 0;
  const baseCredito = valorDesembolsadoNum > 0 ? valorDesembolsadoNum : saldoPesosNum;
  const vecesActual = baseCredito > 0 ? (dineroPagadoFecha + totalActualPesos) / baseCredito : 0;
  
  const vecesOpt =
    recomendada && baseCredito > 0
      ? (dineroPagadoFecha + recomendada.totalProyectado) / baseCredito
      : 0;

  const metrics = [
    { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
    { label: "Saldo actual en pesos", value: formatCOP(input.saldoPesos) },
    { label: "Saldo actual en UVR", value: formatNumber(input.saldoUVR, 4) },
    { label: "Valor UVR actual", value: formatUVR(input.valorUVR) },
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
    metrics.push({
      label: "Tasa mensual utilizada",
      value: formatPercentage(calc.tasaMensual * 100, 4),
    });
    metrics.push({
      label: "Total proyectado a pagar",
      value: formatCOP(calc.escenarioActual.totalPagoPesos),
    });
    metrics.push({
      label: "N° veces pagado el crédito",
      value: `${formatNumber(vecesActual, 2)} veces`,
    });
  }

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
        modo="uvr"
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
            productoBancarioId: p.cliente.productoBancarioId ?? prev.productoBancarioId ?? null,
            plazoInicial: p.cliente.plazoInicial || prev.plazoInicial,
            cuotasPagadas: p.cliente.cuotasPagadas || prev.cuotasPagadas,
          }));
          if (p.uvr?.saldoUVR) setSaldoUVR(p.uvr.saldoUVR);
          if (p.uvr?.valorUVR) setValorUVR(p.uvr.valorUVR);
          if (p.uvr?.saldoPesos) setSaldoPesos(p.uvr.saldoPesos);
          if (p.uvr && "valorDesembolsado" in p.uvr) setValorDesembolsado(p.uvr.valorDesembolsado || "");
          if (p.uvr?.cuotaActualPesos) setCuotaActualPesos(p.uvr.cuotaActualPesos);
          if (p.uvr?.seguros) setSeguros(p.uvr.seguros);
          if (p.uvr?.teaCobrada) setTeaCobrada(p.uvr.teaCobrada);
          if (p.cobertura?.activo) {
            setCobertura({
              activo: true,
              valorCobertura: p.cobertura.valorCobertura || "",
              tasaCobertura: p.cobertura.tasaCobertura || "",
              tipoBeneficio: p.cobertura.tipoBeneficio || "",
              cuotaPagadaCliente: p.cobertura.cuotaPagadaCliente || "",
              cuotaConInteresSinSeguros: p.cobertura.cuotaConInteresSinSeguros || "",
              segurosMensuales: p.cobertura.segurosMensuales || p.uvr?.seguros || "",
              cuotaBaseSimulacion: p.cobertura.cuotaBaseSimulacion || "",
              requiereVerificacion: !!p.cobertura.requiereVerificacion,
            });
          } else {
            setCobertura(defaultCobertura);
          }
        }}
      />
      <Card>
        <div id="datos-cliente-card" />
        <SectionTitle sub="Información general del cliente y del crédito en UVR">
          Datos del cliente
        </SectionTitle>

        <ClientFields
          data={client}
          onChange={setClient}
          modalidad="uvr"
          cuotasPendientes={cuotasPendientes}
          hideCreditFields
        />


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

      <FreshBlock data={cobertura} onChange={setCobertura} />

      <Card>
        <SectionTitle sub="Información financiera del crédito en UVR">
          Datos del crédito
        </SectionTitle>
        <CreditoMetaFields
          data={client}
          onChange={setClient}
          modalidad="uvr"
          cuotasPendientes={cuotasPendientes}
        />
        {cobertura.activo && (cobertura.tipoBeneficio || cobertura.cuotaBaseSimulacion) && (
          <div
            className="mt-4 mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px]"
            style={{
              background: "rgba(132,185,143,0.10)",
              border: "1px solid rgba(132,185,143,0.45)",
              color: "#1F7A45",
            }}
          >
            <span className="font-bold">Cuota base de simulación activa.</span>
            <span>
              Beneficio detectado: <strong>{cobertura.tipoBeneficio || "Cobertura"}</strong>. La
              cuota usada para simular es la cuota real del crédito (sin subsidio), no la cuota que
              paga hoy el cliente.
            </span>
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TextField
            label="Valor desembolsado"
            value={valorDesembolsado}
            onChange={setValorDesembolsado}
            placeholder="120.000.000"
          />
          <TextField
            label="Saldo actual en pesos"
            value={saldoPesos}
            onChange={setSaldoPesos}
            placeholder="98.500.000"
          />
          <TextField
            label="Saldo actual en UVR"
            value={saldoUVR}
            onChange={setSaldoUVR}
            placeholder="371029,7251"
          />
          <TextField
            label="Valor UVR actual"
            value={valorUVR}
            onChange={setValorUVR}
            placeholder="372,1234"
          />
          <TextField
            label="Cuota actual en pesos con seguros"
            value={cuotaActualPesos}
            onChange={setCuotaActualPesos}
            placeholder="1.480.000"
          />
          <TextField
            label="Seguros mensuales"
            value={seguros}
            onChange={setSeguros}
            placeholder="230.000"
          />
          <TextField
            label="Cuota sin seguros"
            value={cuotaSimulacionPesosNum > 0 && segurosNum >= 0 ? formatCOP(cuotaSinSegurosNum) : ""}
            readOnly
            hint="Calculada automáticamente"
          />
          <TextField
            label="Tasa cobrada EA (%)"
            value={teaCobrada}
            onChange={setTeaCobrada}
            placeholder="8,50"
            hint="Solo la tasa cobrada. La tasa pactada nunca se usa para simular."
          />
          <div>
            <TextField
              label="Variación UVR EA (%) · utilizada para simulación"
              value={variacionUVR}
              onChange={setVariacionUVR}
              placeholder="6,00"
              hint="Editable por el analista. Se guarda en el expediente."
            />
            <button
              type="button"
              onClick={() => setShowConfigVariacion((v) => !v)}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#445DA3] hover:underline"
            >
              <Settings2 className="h-3 w-3" />
              {showConfigVariacion ? "Ocultar configuración" : "Configurar valor por defecto"}
            </button>
            {showConfigVariacion && (
              <div className="mt-2 rounded-lg border border-[#445DA3]/30 bg-[#445DA3]/5 p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#445DA3]">
                  Configuración UVR · Variación por defecto
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  Este valor se usará automáticamente como respaldo en nuevas simulaciones cuando no
                  haya un dato actualizado.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={variacionDefaultInput}
                    onChange={(e) => setVariacionDefaultInput(e.target.value)}
                    placeholder="6"
                    className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDefaultVariacionUVR(variacionDefaultInput);
                      setShowConfigVariacion(false);
                    }}
                    className="rounded-md bg-[#445DA3] px-3 py-1 text-xs font-semibold text-white"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {datosCompletos && (
        <>
          <SituacionActualBlock
            hero={{
              saldoActual: formatCOP(input.saldoPesos),
              cuotaActual: formatCOP(input.cuotaActualPesos),
              cuotasPendientes: String(cuotasPendientes),
              totalProyectado: calc ? formatCOP(calc.escenarioActual.totalPagoPesos) : "—",
            }}
            vecesPagado={vecesActual}
            costoTotal={{
              valorDesembolsado: valorDesembolsadoNum,
              dineroPagado: dineroPagadoFecha,
              totalProyectadoPendiente: calc ? calc.escenarioActual.totalPagoPesos : 0,
            }}
            secundarios={[
              { label: "Variación UVR EA", value: formatPercentage(input.variacionUVR) },
              {
                label: "Tasa mensual utilizada",
                value: calc ? formatPercentage(calc.tasaMensual * 100, 4) : "—",
              },
              { label: "Seguros mensuales", value: formatCOP(input.seguros) },
              { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
            ]}
            detalle={[
              { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
              { label: "Dinero pagado a la fecha", value: formatCOP(dineroPagadoFecha) },
              { label: "Plazo inicial", value: `${plazoInicial} meses` },
              { label: "Cuotas pagadas", value: String(cuotasPagadas) },
              { label: "Saldo actual en UVR", value: formatNumber(input.saldoUVR, 4) },
              { label: "Valor UVR actual", value: formatUVR(input.valorUVR) },
            ]}
          />


          {ahorroNegativo && (
            <Alert tone="error">
              Revisar datos. El ahorro u honorarios calculados son negativos.
            </Alert>
          )}

          {datosCompletos && calc && (
            <PropuestasComerciales
              mode="uvr"
              input={input}
              escenarioActual={calc.escenarioActual}
              plazoInicial={plazoInicial}
              cuotasPendientes={cuotasBaseSimulacion}
              baseCredito={baseCredito}
              onRecomendadaChange={setRecomendadaPicked}
            />
          )}

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
              const coberturaFresh = freshFromCobertura(cobertura, {
                cuotasPagadasCredito: cuotasPagadas,
                saldoCapital: saldoPesosNum,
                fuente: cobertura.activo ? "ocr" : "manual",
                detectadoOCR: !!cobertura.tipoBeneficio,
              });
              return (
                <SaveExpedienteButton
                  expedienteId={init?.id}
                  onSaved={onSaved}
                  payload={{
                    modo: "uvr",
                    cliente: { ...client, intervinientes, cobertura },
                    credito: {
                      valorDesembolsado,
                      saldoPesos,
                      saldoUVR,
                      valorUVR,
                      cuotaActualPesos,
                      seguros,
                      teaCobrada,
                      variacionUVR,
                      nuevaCuotaManual,
                      cuotasEliminarManual,
                      cuotaPagadaCliente: cobertura.cuotaPagadaCliente || "",
                      valorBeneficio: cobertura.valorCobertura || "",
                      tipoBeneficio: cobertura.tipoBeneficio || "",
                      cuotaConInteresSinSeguros: cobertura.cuotaConInteresSinSeguros || "",
                      cuotaBaseSimulacion: cobertura.cuotaBaseSimulacion || cuotaActualPesos,
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
            <AuditPanel
              nivelAutonomia={metricasAutonomia.nivelAutonomia}
              expedienteId={init?.id}

              input={{
                moneda: "uvr",
                extracto: {},
                analista: {
                  banco: client.banco,
                  producto: client.tipoProducto,
                  saldoCapital: saldoPesosNum,
                  cuotaActual: cuotaSimulacionPesosNum,
                  seguros: segurosNum,
                  teaPct: parsePercentage(teaCobrada),
                  plazoInicial,
                  cuotasPagadas,
                  cuotasPendientes,
                },
                propuesta: {
                  cuotaActual: cuotaSimulacionPesosNum,
                  cuotasPendientes,
                  nuevaCuota: recomendada.nuevaCuota,
                  nuevoPlazo: recomendada.nuevoPlazo,
                  cuotasEliminadas: Math.max(0, cuotasPendientes - recomendada.nuevoPlazo),
                  ahorroIntereses: recomendada.ahorroIntereses,
                  ahorroSeguros: recomendada.ahorroSeguros,
                  ahorroTotal: recomendada.ahorroTotal,
                  honorarios: recomendada.honorarios,
                },
              }}
            />
          )}

          {recomendada && (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={async () => {
                  if (
                    !recomendada ||
                    !calc ||
                    calc.propuestas.length === 0
                  ) {
                    alert("Primero debes calcular la simulación UVR antes de exportar el PDF.");
                    return;
                  }
                  await exportElementToPdf(
                    "pdf-content-uvr",
                    `NUVEX_Propuesta_UVR_${sanitizeFileName(client.nombre)}.pdf`,
                  );
                }}
                className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01]"
                style={{ backgroundColor: NUVEX.negro }}
              >
                Exportar propuesta comercial
              </button>
              <EnviarDocumentoButton
                expedienteId={init?.id}
                tipo="propuesta_comercial"
                elementId="pdf-content-uvr"
                filename={`NUVEX_Propuesta_UVR_${sanitizeFileName(client.nombre)}.pdf`}
                disabled={!recomendada || !calc || calc.propuestas.length === 0}
                disabledReason="Primero calcula la simulación UVR."
                label="Enviar propuesta al cliente"
              />
            </div>
          )}

          {recomendada &&
            (() => {
              const d = computeDiscount(recomendada.honorarios, discount);
              return (
                <PrintDocument
                  mode="uvr"
                  client={{ ...client, intervinientes, cobertura }}
                  cuotasPendientes={cuotasBaseSimulacion}
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
                    plazoActual: cuotasBaseSimulacion,
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

          {/* Resultado bancario, otrosí, cuenta de cobro, paz y salvo: ahora viven en el Expediente. */}
        </>
      )}
    </div>
  );
}
