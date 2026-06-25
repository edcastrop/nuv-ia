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
  pmt,
  type UVRInput,
} from "../../lib/finance";

import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { EnviarDocumentoButton } from "./EnviarDocumentoButton";
import { WhatsAppPropuestaButton } from "./WhatsAppPropuestaButton";
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
  type PropuestasComercialesDraft,
  type PropuestasComercialesSnapshot,
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
import { triggerSimuladorAutoQA } from "@/lib/simuladorAutoQA";
import { AutoQAPanel, type AutoQAResult } from "./AutoQAPanel";
import {
  clearSimulatorDraft,
  parseStoredJson,
  readSimulatorDraft,
  useSimulatorDraft,
} from "./useSimulatorDraft";

export function UVRSimulator({
  initialExpediente,
  onSaved,
  onReset,
  simuladorReturn,
  fromSimulador,
}: {
  initialExpediente?: Expediente;
  onSaved?: (e: Expediente) => void;
  onReset?: () => void;
  simuladorReturn?: { maestroId?: string; modo?: "pesos" | "uvr" };
  fromSimulador?: boolean;
} = {}) {
  const parseOcrMoney = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === "string" && !v.trim()) return undefined;
    const n = parseCurrency(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const init = initialExpediente;
  const initCred = (init?.credito_data ?? {}) as Record<string, string>;
  const initClient = (init?.cliente_data as ClientData | undefined) ?? undefined;
  const draft = readSimulatorDraft("uvr", init?.id, {
    extractoArchivoPath: typeof initCred.archivoPath === "string" ? initCred.archivoPath : "",
    discount:
      init?.discount_data && Object.keys(init.discount_data).length
        ? (init.discount_data as unknown as DiscountState)
        : defaultDiscount,
    client: initClient ?? defaultClient,
    intervinientes:
      initClient?.intervinientes && initClient.intervinientes.length > 0
        ? initClient.intervinientes
        : defaultIntervinientes(initClient?.tipoProducto),
    cobertura: initClient?.cobertura ?? defaultCobertura,
    valorDesembolsado: initCred.valorDesembolsado ?? "",
    saldoPesos: initCred.saldoPesos ?? initCred.saldoCapital ?? "",
    saldoUVR: initCred.saldoUVR ?? "",
    valorUVR: initCred.valorUVR ?? "",
    cuotaActualPesos: initCred.cuotaActualPesos ?? initCred.cuotaActual ?? "",
    seguros: initCred.seguros ?? "",
    teaCobrada: initCred.teaCobrada ?? initCred.tea ?? "",
    variacionUVR: initCred.variacionUVR ?? getDefaultVariacionUVR(),
    variacionUVRPropuestas: initCred.variacionUVRPropuestas ?? "",
    nuevaCuotaManual: initCred.nuevaCuotaManual ?? "",
    cuotasEliminarManual: initCred.cuotasEliminarManual ?? "",
    modoPersonalizada:
      initCred.cuotasEliminarManual && !initCred.nuevaCuotaManual
        ? ("cuotas" as const)
        : ("cuota" as const),
    interesMensualExtracto: initCred.interesMensualExtracto ?? initCred.interesMensual ?? "",
    capitalMensualExtracto: initCred.capitalMensualExtracto ?? initCred.capitalMensual ?? "",
    beneficioFrechMensualExtracto:
      initCred.beneficioFrechMensualExtracto ??
      initCred.beneficioFrechMensual ??
      initCred.valorBeneficio ??
      "",
    propuestasComerciales: parseStoredJson<PropuestasComercialesDraft>(initCred.propuestasComerciales),
  });
  const monedaAlerta = useMonedaMismatchAlert();
  const [extractoArchivoPath, setExtractoArchivoPath] = useState<string>(
    () => draft.extractoArchivoPath,
  );
  const [autoQA, setAutoQA] = useState<AutoQAResult | null>(null);
  const [autoQALoading, setAutoQALoading] = useState(false);
  const [discount, setDiscount] = useState<DiscountState>(() => draft.discount);
  const [client, setClient] = useState<ClientData>(() => draft.client);
  const [intervinientes, setIntervinientes] = useState<Interviniente[]>(() => draft.intervinientes);
  const [cobertura, setCobertura] = useState<Cobertura>(() => draft.cobertura);
  const [valorDesembolsado, setValorDesembolsado] = useState(draft.valorDesembolsado);
  const [saldoPesos, setSaldoPesos] = useState(draft.saldoPesos);
  const [saldoUVR, setSaldoUVR] = useState(draft.saldoUVR);
  const [valorUVR, setValorUVR] = useState(draft.valorUVR);
  const [cuotaActualPesos, setCuotaActualPesos] = useState(draft.cuotaActualPesos);
  const [seguros, setSeguros] = useState(draft.seguros);
  const [teaCobrada, setTeaCobrada] = useState(draft.teaCobrada);
  const [variacionUVR, setVariacionUVR] = useState(draft.variacionUVR);
  const [variacionUVRPropuestas, setVariacionUVRPropuestas] = useState<string>(
    (draft as { variacionUVRPropuestas?: string }).variacionUVRPropuestas ?? "",
  );
  const [nuevaCuotaManual, setNuevaCuotaManual] = useState(draft.nuevaCuotaManual);
  const [cuotasEliminarManual, setCuotasEliminarManual] = useState(draft.cuotasEliminarManual);
  const [modoPersonalizada, setModoPersonalizada] = useState<"cuota" | "cuotas">(
    draft.modoPersonalizada,
  );
  // Lecturas OCR mensuales del extracto (solo para el PDF de propuesta).
  const [interesMensualExtracto, setInteresMensualExtracto] = useState<number | undefined>(() => parseOcrMoney(draft.interesMensualExtracto));
  const [capitalMensualExtracto, setCapitalMensualExtracto] = useState<number | undefined>(() => parseOcrMoney(draft.capitalMensualExtracto));
  const [beneficioFrechMensualExtracto, setBeneficioFrechMensualExtracto] = useState<number | undefined>(() => parseOcrMoney(draft.beneficioFrechMensualExtracto));
  const [propuestasComercialesDraft, setPropuestasComercialesDraft] =
    useState<PropuestasComercialesDraft | undefined>(() => draft.propuestasComerciales);
  const [propuestasComercialesSnapshot, setPropuestasComercialesSnapshot] =
    useState<PropuestasComercialesSnapshot | null>(null);
  const [showConfigVariacion, setShowConfigVariacion] = useState(false);
  const [variacionDefaultInput, setVariacionDefaultInput] = useState(getDefaultVariacionUVR());

  const handleClientChange = (next: ClientData) => {
    setClient(next);
    if (next.intervinientes?.length) setIntervinientes(next.intervinientes);
    if (next.cobertura) setCobertura(next.cobertura);
  };

  // Prellenar el campo "Asesor NUVEX" con el nombre del perfil autenticado
  useAsesorDefault(client.asesor, (nombre) => setClient((prev) => ({ ...prev, asesor: nombre })));
  const { metricas: metricasAutonomia } = useNivelAutonomia();
  const estadoCasoActual = (init as unknown as { estado_caso?: string | null } | undefined)?.estado_caso ?? "";
  const puedeEnviarAContratacion =
    !init?.id ||
    !!fromSimulador ||
    ["simulacion_realizada", "simulado", "propuesta_presentada", "propuesta_enviada", "proyeccion_devuelta_qa"].includes(estadoCasoActual);
  const currentDraft = useMemo(
    () => ({
      extractoArchivoPath,
      discount,
      client,
      intervinientes,
      cobertura,
      valorDesembolsado,
      saldoPesos,
      saldoUVR,
      valorUVR,
      cuotaActualPesos,
      seguros,
      teaCobrada,
      variacionUVR,
      variacionUVRPropuestas,
      interesMensualExtracto,
      capitalMensualExtracto,
      beneficioFrechMensualExtracto,
      nuevaCuotaManual,
      cuotasEliminarManual,
      modoPersonalizada,
      propuestasComerciales: propuestasComercialesDraft,
    }),
    [
      extractoArchivoPath,
      discount,
      client,
      intervinientes,
      cobertura,
      valorDesembolsado,
      saldoPesos,
      saldoUVR,
      valorUVR,
      cuotaActualPesos,
      seguros,
      teaCobrada,
      variacionUVR,
      variacionUVRPropuestas,
      interesMensualExtracto,
      capitalMensualExtracto,
      beneficioFrechMensualExtracto,
      nuevaCuotaManual,
      cuotasEliminarManual,
      modoPersonalizada,
      propuestasComercialesDraft,
    ],
  );
  useSimulatorDraft("uvr", init?.id, currentDraft);
  const handleSaved = (e: Expediente) => {
    clearSimulatorDraft("uvr", init?.id);
    onSaved?.(e);
  };
  const handleResetMode = () => {
    clearSimulatorDraft("uvr", init?.id);
    onReset?.();
  };

  const plazoInicial = parseDecimal(client.plazoInicial);
  const cuotasPagadas = parseDecimal(client.cuotasPagadas);
  const cuotasPendientesGuardadas = parseDecimal(client.cuotasPendientes ?? "");
  const esFna = /fondo\s+nacional\s+del\s+ahorro|\bfna\b/i.test(
    `${client.banco} ${client.tipoProducto}`,
  );
  const cuotasPendientes =
    cuotasPendientesGuardadas > 0
      ? cuotasPendientesGuardadas
      : Math.max(0, plazoInicial - cuotasPagadas + (esFna ? 1 : 0));
  const honorariosPct = parsePercentage(client.porcentajeHonorarios) || 6;

  const valorDesembolsadoNum = parseCurrency(valorDesembolsado);
  const cuotaActualPesosNum = parseCurrency(cuotaActualPesos);
  const cuotaPagadaClienteNum = parseCurrency(cobertura.cuotaPagadaCliente);
  const cuotaBaseSimulacionNum = parseCurrency(cobertura.cuotaBaseSimulacion);
  const cuotaSimulacionPesosNum =
    cuotaBaseSimulacionNum > 0 ? cuotaBaseSimulacionNum : cuotaActualPesosNum;
  const cuotaClienteHoyNum =
    cuotaPagadaClienteNum > 0 ? cuotaPagadaClienteNum : cuotaActualPesosNum;
  const segurosNum = parseCurrency(seguros);
  const cuotaSinSegurosNum = Math.max(0, cuotaSimulacionPesosNum - segurosNum);
  const saldoPesosNum = parseCurrency(saldoPesos);
  const dineroPagadoFecha = cuotaClienteHoyNum * cuotasPagadas;

  // ── Capital e intereses pagados — reconstrucción desde saldo actual ──
  const tasaEANum = parsePercentage(teaCobrada);
  const tasaMensual = tasaEANum > 0
    ? Math.pow(1 + tasaEANum / 100, 1 / 12) - 1
    : 0;

  let capitalPagadoCalc = 0;
  let interesesPagadosCalc = 0;
  let interesMensualActual = 0;
  let capitalMensualActual = 0;

  const cuotaSimBase = cuotaSinSegurosNum > 0
    ? cuotaSinSegurosNum
    : Math.max(0, cuotaSimulacionPesosNum - segurosNum);

  if (tasaMensual > 0 && saldoPesosNum > 0 && cuotasPendientes > 0) {
    interesMensualActual = saldoPesosNum * tasaMensual;
    capitalMensualActual = Math.max(0, cuotaSimBase - interesMensualActual);

    if (cuotasPagadas > 0) {
      const saldoInicialReconstruido = valorDesembolsadoNum > 0
        ? valorDesembolsadoNum
        : saldoPesosNum * Math.pow(1 + tasaMensual, cuotasPagadas)
          - cuotaSimBase * (Math.pow(1 + tasaMensual, cuotasPagadas) - 1) / tasaMensual;

      if (saldoInicialReconstruido > 0) {
        let saldo = saldoInicialReconstruido;
        const cuotaFija = pmt(
          tasaMensual,
          plazoInicial > 0 ? plazoInicial : cuotasPagadas + cuotasPendientes,
          saldoInicialReconstruido
        );
        for (let i = 0; i < cuotasPagadas && saldo > 0; i++) {
          const intCuota = saldo * tasaMensual;
          const capCuota = Math.max(0, cuotaFija - intCuota);
          interesesPagadosCalc += intCuota;
          capitalPagadoCalc += capCuota;
          saldo = Math.max(0, saldo - capCuota);
        }
        capitalPagadoCalc = Math.min(capitalPagadoCalc, saldoInicialReconstruido);
        capitalPagadoCalc = Math.max(0, capitalPagadoCalc);
        interesesPagadosCalc = Math.max(0, interesesPagadosCalc);
      }
    }
  } else if (saldoPesosNum > 0 && valorDesembolsadoNum > saldoPesosNum) {
    capitalPagadoCalc = valorDesembolsadoNum - saldoPesosNum;
    interesesPagadosCalc = Math.max(0, dineroPagadoFecha - capitalPagadoCalc);
  }

  // ── Cuotas pendientes con cobertura FRECH (84 cuotas máximo desde inicio) ──
  const CUOTAS_MAX_FRECH = 84;
  const tieneCobertura = cobertura?.activo === true || !!cobertura?.tipoBeneficio;
  const cuotasPendientesConCobertura = tieneCobertura
    ? Math.max(0, CUOTAS_MAX_FRECH - cuotasPagadas)
    : 0;

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
      variacionUVRPropuestas: variacionUVRPropuestas ? parsePercentage(variacionUVRPropuestas) : undefined,
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
      variacionUVRPropuestas,
      cuotasPendientes,
      plazoInicial,
      honorariosPct,
    ],
  );

  const validaciones: string[] = [];
  const saldoUvrConsistente =
    input.saldoPesos <= 0 ||
    input.saldoUVR <= 0 ||
    input.valorUVR <= 0 ||
    Math.abs(input.saldoUVR * input.valorUVR - input.saldoPesos) / input.saldoPesos <= 0.01;
  if (plazoInicial > 0 && cuotasPagadas > plazoInicial)
    validaciones.push("Las cuotas pagadas no pueden ser mayores al plazo inicial.");
  if (input.saldoUVR <= 0 && saldoUVR) validaciones.push("Saldo UVR debe ser mayor a 0.");
  if (input.valorUVR <= 0 && valorUVR) validaciones.push("Valor UVR debe ser mayor a 0.");
  if (!saldoUvrConsistente)
    validaciones.push(
      "Saldo en pesos, Saldo UVR y Valor UVR no coinciden. Revisa los valores antes de simular.",
    );
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
    saldoUvrConsistente &&
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
        index: recomendadaPicked.index,
        cuotasEliminadas: recomendadaPicked.cuotasEliminadas,
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

  // Broadcast de la propuesta recomendada viva (UVR) → Análisis de Capacidad
  // de Pago la escucha para recalcular el % de endeudamiento sobre la cuota
  // de la propuesta seleccionada (1, 2, 3 o 4) ANTES de guardar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!recomendada || !init?.id) return;
    window.dispatchEvent(
      new CustomEvent("nuvex:recomendada-change", {
        detail: { expedienteId: init.id, nuevaCuota: recomendada.nuevaCuota, index: recomendada.index },
      }),
    );
  }, [recomendada?.nuevaCuota, recomendada?.index, init?.id]);

  const ahorroNegativo = recomendada && (recomendada.ahorroTotal < 0 || recomendada.honorarios < 0);

  const cuotasBaseSimulacion = Math.max(0, cuotasPendientes);
  const totalActualPesos = calc?.escenarioActual.totalPagoPesos ?? 0;
  // Base coherente del crédito: el valor desembolsado declarado. Si no está
  // disponible, usamos el SALDO ACTUAL como base alternativa (mirada hacia
  // adelante: total proyectado pendiente / saldo actual). Es la MISMA fórmula
  // que usa el bloque ejecutivo, así el número grande, el semáforo y la tabla
  // siempre coinciden.
  const baseCredito = valorDesembolsadoNum > 0 ? valorDesembolsadoNum : 0;
  const saldoBase = input.saldoPesos > 0 ? input.saldoPesos : 0;
  const vecesActual =
    baseCredito > 0
      ? (dineroPagadoFecha + totalActualPesos) / baseCredito
      : saldoBase > 0
        ? totalActualPesos / saldoBase
        : 0;

  const vecesOpt = recomendada
    ? baseCredito > 0
      ? (dineroPagadoFecha + recomendada.totalProyectado) / baseCredito
      : saldoBase > 0
        ? recomendada.totalProyectado / saldoBase
        : 0
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
      label: baseCredito > 0 ? "N° veces pagado el crédito" : "N° veces (sobre saldo actual)",
      value: `${formatNumber(vecesActual, 2)} veces`,
    });
  }

  return (
    <div className="relative min-h-screen isolate overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <AnimatedBackground />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl space-y-4 px-6 py-6">
        {onReset && (
          <div className="flex justify-end">
            <button
              onClick={handleResetMode}
              className="text-xs font-medium text-[#445DA3] hover:underline"
            >
              ← Cambiar modo
            </button>
          </div>
        )}
        <ExtractoReader
          modo="uvr"
          existingArchivoPath={extractoArchivoPath}
          expedienteId={init?.id}
          onApply={async (p: ExtractoApplyPayload) => {
            // Alerta crítica: bloquear si el extracto está en Pesos pero estamos en simulador UVR.
            if (p.monedaDetectada && p.monedaDetectada !== "uvr") {
              const continuar = await monedaAlerta.confirm({
                detectada: p.monedaDetectada,
                simulador: "uvr",
              });
              if (!continuar) {
                toast.error(
                  "Carga cancelada: el extracto es Pesos pero el simulador es UVR. Usa el simulador de Pesos.",
                  { duration: 6000 },
                );
                return;
              }
              toast.warning("Aplicando extracto Pesos en simulador UVR. Revisa los resultados.");
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
              cuotasPendientes: p.cliente.cuotasPendientes || prev.cuotasPendientes,
            }));
            if (p.uvr?.saldoUVR) setSaldoUVR(p.uvr.saldoUVR);
            if (p.uvr?.valorUVR) setValorUVR(p.uvr.valorUVR);
            if (p.uvr?.saldoPesos) setSaldoPesos(p.uvr.saldoPesos);
            if (p.uvr && "valorDesembolsado" in p.uvr)
              setValorDesembolsado(p.uvr.valorDesembolsado || "");
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
            setInteresMensualExtracto(parseOcrMoney(p.extracto?.interesMensual));
            setCapitalMensualExtracto(parseOcrMoney(p.extracto?.capitalMensual));
            setBeneficioFrechMensualExtracto(parseOcrMoney(p.extracto?.beneficioFrechMensual));
            // Auto-QA condicional: sólo cuando el simulador fue abierto desde un
            // Expediente Maestro (init?.id). En modo standalone no se ejecuta.
            if (init?.id && p.raw) {
              void triggerSimuladorAutoQA({
                expedienteId: init.id,
                raw: { ...p.raw, archivoPath: p.archivoPath ?? null },
                onStart: () => {
                  setAutoQALoading(true);
                  setAutoQA(null);
                },
                onResult: (r) => {
                  setAutoQA(r);
                  setAutoQALoading(false);
                },
                onError: () => setAutoQALoading(false),
              });
            }
          }}
        />
        {init?.id && (autoQALoading || autoQA) && (
          <AutoQAPanel loading={autoQALoading} result={autoQA} simuladorReturn={simuladorReturn} />
        )}
        <Card>
          <div id="datos-cliente-card" />
          <SectionTitle sub="Información general del cliente y del crédito en UVR">
            Datos del cliente
          </SectionTitle>

          <ClientFields
            data={client}
            onChange={handleClientChange}
            modalidad="uvr"
            cuotasPendientes={cuotasPendientes}
            hideCreditFields
            expedienteId={init?.id}
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
                cuota usada para simular es la cuota real del crédito (sin subsidio), no la cuota
                que paga hoy el cliente.
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
              value={
                cuotaSimulacionPesosNum > 0 && segurosNum >= 0 ? formatCOP(cuotaSinSegurosNum) : ""
              }
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
                    Este valor se usará automáticamente como respaldo en nuevas simulaciones cuando
                    no haya un dato actualizado.
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

            <TextField
              label="Variación UVR EA propuestas (%) · opcional"
              value={variacionUVRPropuestas}
              onChange={setVariacionUVRPropuestas}
              placeholder="5,00"
              hint="Modo Excel: si se diligencia, las propuestas se proyectan con esta UVR (típico 5%) mientras el escenario actual mantiene la UVR vigente. Vacío = misma UVR en ambos lados (modo NUVIA conservador)."
            />

            {/* Nota explicativa sobre hipótesis UVR */}
            <div className="mt-3">
              <Alert tone="info">
                {variacionUVRPropuestas && parsePercentage(variacionUVRPropuestas) > 0 ? (
                  <>
                    <span className="font-semibold">Hipótesis de UVR (modo Excel):</span> el escenario actual se proyecta con {variacionUVR || "—"}% EA y las propuestas con {variacionUVRPropuestas}% EA. El ahorro mostrado incluye tanto el efecto real de eliminar cuotas como el supuesto de menor inflación futura en las propuestas.
                  </>
                ) : (
                  <>
                    <span className="font-semibold">Hipótesis de UVR:</span> El ahorro mostrado asume que la UVR mantiene la misma variación anual ({variacionUVR ? variacionUVR : "—"}%) tanto en el escenario actual como en las propuestas. Si la inflación futura baja, el ahorro real podría ser mayor.
                  </>
                )}
              </Alert>
            </div>
          </div>
        </Card>


        {datosCompletos && (
          <>
            <SituacionActualBlock
              clienteNombre={client.nombre}
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
                baseCredito,
                saldoActual: input.saldoPesos,
              }}
              puntosNeuralgicos={{
                tiempoMeses: cuotasPendientes,
                segurosProyectados: (input.seguros || 0) * cuotasPendientes,
                interesesProyectados: calc
                  ? Math.max(
                      0,
                      calc.escenarioActual.totalPagoPesos -
                        input.saldoPesos -
                        (input.seguros || 0) * cuotasPendientes,
                    )
                  : 0,
              }}
              tea={input.teaCobrada}
              teaUmbral={6}
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
                { label: "TEA cobrada", value: formatPercentage(input.teaCobrada) },
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
                baseCredito={baseCredito > 0 ? baseCredito : saldoBase}
                dineroPagado={baseCredito > 0 ? dineroPagadoFecha : 0}
                perfilCliente={client.perfil}
                ingresos={client.ingresos}
                onIngresosChange={(ingresos) => setClient((prev) => ({ ...prev, ingresos }))}
                initialState={propuestasComercialesDraft}
                onStateChange={(snapshot) => {
                  setPropuestasComercialesDraft({
                    cuotasList: snapshot.cuotasList,
                    recomendadaIdx: snapshot.recomendadaIdx,
                  });
                  setPropuestasComercialesSnapshot(snapshot);
                }}
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
                    onSaved={handleSaved}
                    onSeguirSimulando={handleResetMode}
                    enviarAuditoriaManual={puedeEnviarAContratacion}
                    fromSimulador={fromSimulador}
                    nivelAutonomia={metricasAutonomia.nivelAutonomia}
                    auditInput={{
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
                    payload={{
                      modo: "uvr",
                      cliente: { ...client, intervinientes, cobertura },
                      credito: {
                        valorDesembolsado,
                        saldoCapital: saldoPesos,
                        saldoPesos,
                        saldoUVR,
                        valorUVR,
                        cuotaActual: cuotaActualPesos,
                        cuotaActualPesos,
                        seguros,
                        tea: teaCobrada,
                        teaCobrada,
                        variacionUVR,
                        variacionUVRPropuestas,
                        nuevaCuotaManual,
                        cuotasEliminarManual,
                        propuestasComerciales: JSON.stringify(propuestasComercialesDraft ?? null),
                        cuotaPagadaCliente: cobertura.cuotaPagadaCliente || "",
                        valorBeneficio: cobertura.valorCobertura || "",
                        tipoBeneficio: cobertura.tipoBeneficio || "",
                        cuotaConInteresSinSeguros: cobertura.cuotaConInteresSinSeguros || "",
                        cuotaBaseSimulacion: cobertura.cuotaBaseSimulacion || cuotaActualPesos,
                        segurosMensuales: cobertura.segurosMensuales || seguros,
                        tieneBeneficio: cobertura.activo ? "si" : "no",
                        coberturaFresh: coberturaFresh as unknown as string,
                        interesMensualExtracto: interesMensualExtracto === undefined ? "" : String(Math.round(interesMensualExtracto)),
                        capitalMensualExtracto: capitalMensualExtracto === undefined ? "" : String(Math.round(capitalMensualExtracto)),
                        beneficioFrechMensualExtracto: beneficioFrechMensualExtracto === undefined ? "" : String(Math.round(beneficioFrechMensualExtracto)),
                        archivoPath: extractoArchivoPath,
                      },
                      propuesta: {
                        nuevaCuota: recomendada.nuevaCuota,
                        nuevoPlazo: recomendada.nuevoPlazo,
                        index: recomendada.index,
                        cuotasEliminadas: recomendada.cuotasEliminadas,
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

            {recomendada && !init?.id && (
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
                    if (!recomendada || !calc || calc.propuestas.length === 0) {
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
                <WhatsAppPropuestaButton
                  nombre={client.nombre}
                  banco={client.banco}
                  telefono={client.celular}
                  asesor={client.asesor}
                  cuotaActual={cuotaSimulacionPesosNum}
                  propuestas={(() => {
                    const analyst = propuestasComercialesSnapshot?.propuestas ?? [];
                    if (analyst.length > 0) {
                      return analyst.map(p => ({
                        nuevaCuota: p.nuevaCuota,
                        incrementoMensual: p.incrementoMensual,
                        añosEliminados: p.añosEliminados,
                        ahorroTotal: p.ahorroTotal,
                        honorarios: p.honorarios,
                        honorariosFinal: computeDiscount(p.honorarios, discount).final,
                      }));
                    }
                    return (calc?.propuestas ?? []).map(p => ({
                      nuevaCuota: p.nuevaCuotaConSeguroAprox,
                      incrementoMensual: p.abonoAdicionalMensual,
                      añosEliminados: p.añosEliminados,
                      ahorroTotal: p.ahorroTotal,
                      honorarios: p.honorariosNuvex,
                      honorariosFinal: computeDiscount(p.honorariosNuvex, discount).final,
                    }));
                  })()}
                  recomendadaIndex={
                    propuestasComercialesSnapshot?.recommendedIndex ??
                    (bestIndex >= 0 ? bestIndex : 0)
                  }
                  disabled={!recomendada || !calc || calc.propuestas.length === 0}
                  disabledReason="Primero calcula la simulación UVR."
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
                    propuestasComerciales={propuestasComercialesSnapshot?.propuestas}
                    bestIndex={propuestasComercialesSnapshot?.recommendedIndex ?? bestIndex}
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
                    dineroPagadoFecha={dineroPagadoFecha}
                    valorDesembolsado={Math.max(valorDesembolsadoNum, saldoPesosNum)}
                    creditState={{
                      plazoInicialMeses: plazoInicial,
                      cuotasPagadas,
                      cuotasPendientes: cuotasBaseSimulacion,
                      cuotaActual: input.cuotaActualPesos,
                      seguros: input.seguros,
                      cuotaSinSeguros: cuotaSinSegurosNum,
                      saldoCapital: saldoPesosNum,
                      tasaMensualPct: calc ? calc.tasaMensual * 100 : 0,
                      capitalPagado: capitalPagadoCalc,
                      interesesPagados: interesesPagadosCalc,
                      interesMensual: interesMensualActual,
                      capitalMensual: capitalMensualActual,
                      tieneCobertura,
                      tipoBeneficio: cobertura?.tipoBeneficio || "",
                      valorBeneficioMensual: cobertura?.valorCobertura
                        ? Number(cobertura.valorCobertura) : 0,
                      cuotaConCobertura: cobertura?.cuotaPagadaCliente
                        ? Number(cobertura.cuotaPagadaCliente) : 0,
                      cuotasPendientesConCobertura,
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
