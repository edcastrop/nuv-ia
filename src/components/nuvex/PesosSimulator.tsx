import { useMemo, useState } from "react";
import { Alert, Card, SectionTitle, TextField } from "./ui";
import { SituacionActualBlock } from "./SituacionActualBlock";
import { ClientFields, defaultClient, type ClientData } from "./ClientFields";
import { CreditoMetaFields } from "./CreditoMetaFields";

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
// ResultadoFinal removido del simulador: vive en el Expediente (Etapa 9+).
import { SaveExpedienteButton } from "./SaveExpedienteButton";
import type { Expediente } from "@/lib/expedientes";
import { ExtractoReader, type ExtractoApplyPayload } from "./ExtractoReader";
import { AnimatedBackground } from "@/components/home/widgets/AnimatedBackground";
import { toast } from "sonner";
import { useMonedaMismatchAlert } from "./MonedaMismatchDialog";
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
import { useAsesorDefault } from "@/hooks/useAsesorDefault";
import { freshFromCobertura } from "@/lib/cobertura";
import { normalizeCreditMoneyInput } from "@/lib/creditoSanity";
import { AuditPanel } from "./AuditPanel";
import { useNivelAutonomia } from "@/hooks/useNivelAutonomia";
import { triggerSimuladorAutoQA } from "@/lib/simuladorAutoQA";


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
  const monedaAlerta = useMonedaMismatchAlert();
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
  const { metricas: metricasAutonomia } = useNivelAutonomia();

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
  const totalActualPendiente = input.cuotaActual * cuotasBaseSimulacion;
  // Base coherente del crédito: el valor desembolsado declarado por el banco.
  // Si no está disponible, usamos el SALDO ACTUAL como base alternativa
  // (total proyectado pendiente / saldo actual), la MISMA fórmula del bloque
  // ejecutivo para que todos los números coincidan.
  const baseCreditoReferencia = valorDesembolsadoNum > 0 ? valorDesembolsadoNum : 0;
  const saldoBase = input.saldoCapital > 0 ? input.saldoCapital : 0;
  const vecesActual =
    baseCreditoReferencia > 0
      ? (dineroPagadoFecha + totalActualPendiente) / baseCreditoReferencia
      : saldoBase > 0
        ? totalActualPendiente / saldoBase
        : 0;


  const metrics = [
    { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
    { label: "Saldo actual", value: formatCOP(input.saldoCapital) },
    { label: "Cuota actual con seguros", value: formatCOP(input.cuotaActual) },
    { label: "Seguros mensuales", value: formatCOP(input.seguros) },
    { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
    { label: "Cuotas pagadas", value: String(cuotasPagadas) },
    { label: "Cuotas pendientes", value: String(cuotasPendientes) },
    { label: "Dinero pagado a la fecha", value: formatCOP(dineroPagadoFecha) },
    {
      label:
        baseCreditoReferencia > 0
          ? "N° veces pagado el crédito"
          : "N° veces (sobre saldo actual)",
      value: `${formatNumber(vecesActual, 2)} veces`,
    },
    { label: "Plazo inicial", value: `${plazoInicial} meses` },
    { label: "TEA", value: formatPercentage(input.tea) },
    {
      label: "Tasa mensual utilizada",
      value: calc ? formatPercentage(calc.tasaMensual * 100, 4) : "—",
    },
    { label: "Total por pagar", value: formatCOP(totalActualPendiente) },
  ];

  const vecesOpt = recomendada
    ? baseCreditoReferencia > 0
      ? (dineroPagadoFecha + recomendada.totalProyectado) / baseCreditoReferencia
      : saldoBase > 0
        ? recomendada.totalProyectado / saldoBase
        : 0
    : 0;

  return (
    <div className="relative min-h-screen isolate overflow-hidden">
      {/* Fondo animado NUVIA (estilo login) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <AnimatedBackground />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl space-y-4 px-6 py-6">
      {onReset && (
        <div className="flex justify-end">
          <button onClick={onReset} className="text-xs font-medium text-[#445DA3] hover:underline">
            ← Cambiar modo
          </button>
        </div>
      )}
      <ExtractoReader
        modo="pesos"
        existingArchivoPath={extractoArchivoPath}
        onApply={async (p: ExtractoApplyPayload) => {
          // Alerta crítica: bloquear si el extracto está en UVR pero estamos en simulador de Pesos.
          if (p.monedaDetectada && p.monedaDetectada !== "pesos") {
            const continuar = await monedaAlerta.confirm({
              detectada: p.monedaDetectada,
              simulador: "pesos",
            });
            if (!continuar) {
              toast.error(
                "Carga cancelada: el extracto es UVR pero el simulador es Pesos. Usa el simulador UVR.",
                { duration: 6000 },
              );
              return;
            }
            toast.warning("Aplicando extracto UVR en simulador de Pesos. Revisa los resultados.");
          }
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
          if (p.pesos?.saldoCapital) setSaldoCapital(p.pesos.saldoCapital);
          if (p.pesos && "valorDesembolsado" in p.pesos) setValorDesembolsado(p.pesos.valorDesembolsado || "");
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
          } else {
            setCobertura(defaultCobertura);
          }
          // Auto-QA condicional: sólo cuando el simulador fue abierto desde un
          // Expediente Maestro (init?.id). En modo standalone no se ejecuta.
          if (init?.id && p.raw) {
            void triggerSimuladorAutoQA({
              expedienteId: init.id,
              raw: { ...p.raw, archivoPath: p.archivoPath ?? null },
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

      <Card>
        <SectionTitle sub="Información financiera del crédito en pesos">
          Datos del crédito
        </SectionTitle>
        <CreditoMetaFields
          data={client}
          onChange={setClient}
          modalidad="pesos"
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
              cuota mensual usada para simular es la cuota real del crédito (sin subsidio), no la
              cuota que paga hoy el cliente.
            </span>
          </div>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-4">
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

      <FreshBlock data={cobertura} onChange={setCobertura} />

      {datosCompletos && (
        <>
          <SituacionActualBlock
            clienteNombre={client.nombre}
            hero={{
              saldoActual: formatCOP(input.saldoCapital),
              cuotaActual: formatCOP(input.cuotaActual),
              cuotasPendientes: String(cuotasPendientes),
              totalProyectado: formatCOP(totalActualPendiente),
            }}
            vecesPagado={vecesActual}
            costoTotal={{
              valorDesembolsado: valorDesembolsadoNum,
              dineroPagado: dineroPagadoFecha,
              totalProyectadoPendiente: totalActualPendiente,
              baseCredito: baseCreditoReferencia,
              saldoActual: input.saldoCapital,
            }}
            puntosNeuralgicos={{
              tiempoMeses: cuotasPendientes,
              segurosProyectados: (input.seguros || 0) * cuotasPendientes,
              interesesProyectados: Math.max(
                0,
                totalActualPendiente - input.saldoCapital - (input.seguros || 0) * cuotasPendientes,
              ),
            }}
            tea={input.tea}
            secundarios={[
              {
                label: "Tasa mensual utilizada",
                value: calc ? formatPercentage(calc.tasaMensual * 100, 4) : "—",
              },
              { label: "Seguros mensuales", value: formatCOP(input.seguros) },
              { label: "Cuota sin seguros", value: formatCOP(cuotaSinSegurosNum) },
              { label: "Cuotas pagadas", value: String(cuotasPagadas) },
            ]}
            detalle={[
              { label: "Valor desembolsado", value: formatCOP(valorDesembolsadoNum) },
              { label: "Dinero pagado a la fecha", value: formatCOP(dineroPagadoFecha) },
              { label: "Plazo inicial", value: `${plazoInicial} meses` },
              { label: "TEA", value: formatPercentage(input.tea) },
            ]}
          />


          {ahorroNegativo && (
            <Alert tone="error">
              Revisar datos. El ahorro u honorarios calculados son negativos.
            </Alert>
          )}

          {datosCompletos && (
            <PropuestasComerciales
              mode="pesos"
              input={input}
              cuotasPendientes={cuotasBaseSimulacion}
              baseCredito={baseCreditoReferencia > 0 ? baseCreditoReferencia : saldoBase}
              dineroPagado={baseCreditoReferencia > 0 ? dineroPagadoFecha : 0}
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
            <AuditPanel
              nivelAutonomia={metricasAutonomia.nivelAutonomia}
              expedienteId={init?.id}

              input={{
                moneda: "pesos",
                extracto: {},
                analista: {
                  banco: client.banco,
                  producto: client.tipoProducto,
                  saldoCapital: saldoCapitalNum,
                  cuotaActual: cuotaActualNum,
                  seguros: parseCurrency(seguros),
                  teaPct: parsePercentage(tea),
                  plazoInicial,
                  cuotasPagadas,
                  cuotasPendientes,
                },
                propuesta: {
                  cuotaActual: cuotaActualNum,
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
                Exportar propuesta comercial
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

          {/* Resultado bancario, otrosí, cuenta de cobro, paz y salvo: ahora viven en el Expediente. */}
        </>
      )}
      {monedaAlerta.dialog}
      </div>
    </div>
  );
}
