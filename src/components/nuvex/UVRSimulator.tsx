import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildUvrQaSnapshot,
  hashQaSnapshot,
  decideAutoQADispatch,
  decideAutoQAResult,
} from "@/lib/nuviaQaSnapshot";
import { useServerFn } from "@tanstack/react-start";
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
import {
  parseUVRNumberCandidates,
  resolveUVRByCoherence,
  validateUVRCoherence,
} from "../../lib/uvrNumber";

import { PrintDocument } from "./PrintDocument";
import { exportElementToPdf, sanitizeFileName } from "../../lib/pdfExport";
import { EnviarDocumentoButton } from "./EnviarDocumentoButton";
import { WhatsAppPropuestaButton } from "./WhatsAppPropuestaButton";
import { marcarAccionPropuesta } from "@/lib/propuestaAcciones.functions";
import {
  DiscountModule,
  computeDiscount,
  defaultDiscount,
  normalizeDiscountState,
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
import { emitDraftRawReady } from "@/components/nuvex/NuviaDraftAuditCard";
import { AutoQAPanel, type AutoQAResult } from "./AutoQAPanel";
import {
  clearSimulatorDraft,
  parseStoredJson,
  readSimulatorDraft,
  useSimulatorDraft,
} from "./useSimulatorDraft";
import { deriveDraftKey, purgeStaleAnonEntries } from "./pendingSoportes";

import { aprobarAuditoriaPorAuditor } from "@/lib/qaAI.functions";

export function UVRSimulator({
  initialExpediente,
  onSaved,
  onReset,
  simuladorReturn,
  fromSimulador,
  qaEmbedded,
  auditoriaId,
}: {
  initialExpediente?: Expediente;
  onSaved?: (e: Expediente) => void;
  onReset?: () => void;
  simuladorReturn?: { maestroId?: string; modo?: "pesos" | "uvr" };
  fromSimulador?: boolean;
  qaEmbedded?: boolean;
  auditoriaId?: string;
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
    discount: normalizeDiscountState(
      init?.discount_data && Object.keys(init.discount_data).length
        ? init.discount_data
        : defaultDiscount,
    ),
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
  const [discount, setDiscount] = useState<DiscountState>(() => normalizeDiscountState(draft.discount));
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
  const [aprobando, setAprobando] = useState(false);
  const doAprobar = useServerFn(aprobarAuditoriaPorAuditor);
  const [showConfigVariacion, setShowConfigVariacion] = useState(false);
  const [variacionDefaultInput, setVariacionDefaultInput] = useState(getDefaultVariacionUVR());

  // NUVIA QA Gate (UVR): el veredicto sólo se emite cuando el analista
  // ingresó Variación UVR EA histórica Y Variación UVR EA propuestas (>0).
  // Sin ambos, las proyecciones de saldo/corrección monetaria no son
  // concluyentes y NUVIA no puede emitir dictamen.
  const uvrVarsReady = useMemo(() => {
    const hist = parsePercentage(variacionUVR);
    const prop = parsePercentage(variacionUVRPropuestas);
    return Number.isFinite(hist) && hist > 0 && Number.isFinite(prop) && prop > 0;
  }, [variacionUVR, variacionUVRPropuestas]);
  // ── Auto-QA de expediente (modo `init?.id`) ────────────────────────
  // Control determinístico por INTENCIÓN pegajosa + hash. Ver
  // PesosSimulator para la descripción canónica. En UVR exigimos además
  // `uvrVarsReady` y completitud UVR (saldoUVR y valorUVR > 0). Retry
  // manual mediante `retryAutoQA` cuando ocurre un error.
  const [autoQAIntent, setAutoQAIntent] = useState<{
    archivoPath?: string | null;
    archivoNombre?: string | null;
  } | null>(null);
  const [autoQAError, setAutoQAError] = useState<string | null>(null);
  const inflightHashRef = useRef<string | null>(null);
  const lastAttemptedHashRef = useRef<string | null>(null);
  const lastSuccessfulHashRef = useRef<string | null>(null);
  const lastFailedHashRef = useRef<string | null>(null);



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
  useEffect(() => {
    if (init?.id) return;
    purgeStaleAnonEntries();
  }, [init?.id]);
  const draftScopeKey = useMemo(
    () =>
      deriveDraftKey({
        cedula: client.cedula,
        nombre: client.nombre,
        numeroCredito: client.numeroCredito,
        banco: client.banco,
      }),
    [client.cedula, client.nombre, client.numeroCredito, client.banco],
  );
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
  const cuotasPendientesAuto = Math.max(0, plazoInicial - cuotasPagadas + (esFna ? 1 : 0));
  const cuotasPendientes =
    plazoInicial > 0
      ? cuotasPendientesAuto
      : (cuotasPendientesGuardadas > 0 ? cuotasPendientesGuardadas : cuotasPendientesAuto);
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

  // V2 QA: modo sandbox de revisión QA — retransmite inputs UVR vivos
  // para la Comparativa Analista vs Auditor.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = init?.id;
    if (!id || !id.startsWith("qa-review-")) return;
    window.dispatchEvent(
      new CustomEvent("nuvex:simulador-inputs", {
        detail: {
          expedienteId: id,
          modo: "uvr",
          saldoCapital: saldoPesosNum,
          tasaEa: tasaEANum,
          seguros: segurosNum,
          cuotaBase: cuotaSimulacionPesosNum,
          cuotasPendientes,
          saldoUVR: parseDecimal(saldoUVR),
          valorUVR: parseDecimal(valorUVR),
          variacionUVR: parsePercentage(variacionUVR),
          nuevaCuota: recomendada?.nuevaCuota ?? null,
        },
      }),
    );
  }, [
    init?.id, saldoPesosNum, tasaEANum, segurosNum, cuotaSimulacionPesosNum,
    cuotasPendientes, saldoUVR, valorUVR, variacionUVR, recomendada?.nuevaCuota,
  ]);

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

  const handleAprobar = async () => {
    if (aprobando || !auditoriaId) return;
    const notas = window.prompt("Notas para el analista (opcional):", "") ?? "";
    if (!window.confirm("¿Aprobar esta auditoría y notificar al analista para que continúe el caso?")) return;
    setAprobando(true);
    try {
      const res = await doAprobar({ data: { auditoriaId, notas } }) as { ok: boolean; codigo: string | null };
      alert(`✓ Auditoría ${res.codigo ?? ""} aprobada. El analista fue notificado.`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setAprobando(false);
    }
  };

  // ── Snapshot canónico UVR desde el estado del formulario ─────────
  const currentQaSnapshot = useMemo(() => {
    const saldoUVRN = parseDecimal(saldoUVR);
    const valorUVRN = parseDecimal(valorUVR);
    const saldoPesosN = parseCurrency(saldoPesos);
    const cuotaN = parseCurrency(cuotaActualPesos);
    const teaN = parsePercentage(teaCobrada);
    if (!(cuotaN > 0 && teaN > 0)) return null;
    if (!(saldoUVRN > 0 && valorUVRN > 0)) return null;
    const d = recomendada ? computeDiscount(recomendada.honorarios, discount) : null;
    return buildUvrQaSnapshot({
      banco: client.banco || null,
      producto: client.tipoProducto || null,
      cedula: client.cedula || null,
      numeroCredito: client.numeroCredito || null,
      cliente: client.nombre || null,
      saldoUVR: saldoUVRN,
      valorUVR: valorUVRN,
      saldoPesos: saldoPesosN > 0 ? saldoPesosN : undefined,
      cuotaActualPesos: cuotaN,
      seguros: parseCurrency(seguros) || 0,
      teaCobrada: teaN,
      valorDesembolsado: parseCurrency(valorDesembolsado) || undefined,
      variacionUVR: parsePercentage(variacionUVR) || undefined,
      variacionUVRPropuestas: parsePercentage(variacionUVRPropuestas) || undefined,
      plazoInicial,
      cuotasPagadas,
      cuotasPendientes,
      tasaCobertura: parsePercentage(cobertura.tasaCobertura) || undefined,
      valorCobertura: parseCurrency(cobertura.valorCobertura) || undefined,
      beneficioFrechMensual: beneficioFrechMensualExtracto ?? undefined,
      honorariosBase: recomendada ? recomendada.honorarios : null,
      honorariosFinal: d ? d.final : null,
      descuento: d ? d.descuento : null,
      propuesta: recomendada
        ? {
            index: recomendada.index,
            nuevaCuota: recomendada.nuevaCuota,
            nuevoPlazo: recomendada.nuevoPlazo,
            cuotasEliminadas: recomendada.cuotasEliminadas,
            añosEliminados: recomendada.añosEliminados,
            ahorroIntereses: recomendada.ahorroIntereses,
            ahorroSeguros: recomendada.ahorroSeguros,
            ahorroTotal: recomendada.ahorroTotal,
            honorarios: recomendada.honorarios,
            totalProyectado: recomendada.totalProyectado,
            fuente: manualValido ? "manual" : "automatica",
          }
        : null,
    });
  }, [
    client.banco,
    client.tipoProducto,
    client.cedula,
    client.numeroCredito,
    client.nombre,
    saldoPesos,
    saldoUVR,
    valorUVR,
    cuotaActualPesos,
    seguros,
    teaCobrada,
    variacionUVR,
    variacionUVRPropuestas,
    valorDesembolsado,
    plazoInicial,
    cuotasPagadas,
    cuotasPendientes,
    cobertura.tasaCobertura,
    cobertura.valorCobertura,
    beneficioFrechMensualExtracto,
    recomendada,
    discount,
    manualValido,
  ]);

  // Modo standalone: emitir snapshot desde el formulario (no `p.raw`).
  useEffect(() => {
    if (init?.id) return;
    if (!currentQaSnapshot) return;
    emitDraftRawReady(currentQaSnapshot);
  }, [init?.id, currentQaSnapshot]);

  // Modo expediente: disparo controlado del Auto-QA con INTENCIÓN pegajosa.
  // Requiere completitud UVR (`currentQaSnapshot` no nulo) + variaciones UVR.
  useEffect(() => {
    if (!init?.id) return;
    if (!autoQAIntent) return;
    if (!currentQaSnapshot) return;
    if (!uvrVarsReady) return;
    const snapshot: typeof currentQaSnapshot = {
      ...currentQaSnapshot,
      archivoPath: autoQAIntent.archivoPath ?? currentQaSnapshot.archivoPath ?? null,
      archivoNombre: autoQAIntent.archivoNombre ?? currentQaSnapshot.archivoNombre ?? null,
    };
    const hash = hashQaSnapshot(snapshot);
    const decision = decideAutoQADispatch({
      hasIntent: true,
      currentHash: hash,
      inflightHash: inflightHashRef.current,
      successHash: lastSuccessfulHashRef.current,
      failedHash: lastFailedHashRef.current,
    });
    if (decision.kind === "skip") return;
    if (decision.kind === "clear-intent") {
      setAutoQAIntent(null);
      return;
    }
    inflightHashRef.current = hash;
    lastAttemptedHashRef.current = hash;
    void triggerSimuladorAutoQA({
      expedienteId: init.id,
      raw: {
        banco: snapshot.banco ?? null,
        producto: snapshot.producto ?? null,
        moneda: snapshot.moneda ?? null,
        datos: (snapshot.datos ?? {}) as Record<string, unknown>,
        archivoPath: snapshot.archivoPath ?? null,
        archivoNombre: snapshot.archivoNombre ?? null,
      },
      onStart: () => {
        setAutoQALoading(true);
        setAutoQA(null);
        setAutoQAError(null);
      },
      onResult: (r) => {
        setAutoQALoading(false);
        const rec = decideAutoQAResult({ resultHash: hash, inflightHash: inflightHashRef.current });
        if (rec.kind === "obsolete") return;
        lastSuccessfulHashRef.current = hash;
        inflightHashRef.current = null;
        setAutoQA(r);
      },
      onError: (e) => {
        setAutoQALoading(false);
        if (inflightHashRef.current === hash) inflightHashRef.current = null;
        lastFailedHashRef.current = hash;
        setAutoQAError(e instanceof Error ? e.message : "Error al ejecutar Auto-QA.");
      },
    });
  }, [init?.id, autoQAIntent, currentQaSnapshot, uvrVarsReady]);

  const retryAutoQA = () => {
    lastFailedHashRef.current = null;
    setAutoQAError(null);
    setAutoQAIntent((prev) => (prev ? { ...prev } : prev));
  };




  return (
    <div className={`relative isolate overflow-hidden ${qaEmbedded ? "" : "min-h-screen"}`}>
      {!qaEmbedded && <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <AnimatedBackground />
      </div>}
      <div className={`relative z-10 mx-auto max-w-7xl space-y-4 ${qaEmbedded ? "px-5 pb-5 pt-0" : "px-6 py-6"}`}>
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
        {!qaEmbedded && <ExtractoReader
          modo="uvr"
          existingArchivoPath={extractoArchivoPath}
          expedienteId={init?.id}
          draftKey={draftScopeKey}
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

            // ─── VALIDACIÓN DE COHERENCIA UVR (bloqueo previo a mutar estado) ───
            // No permitimos aplicar datos al formulario sin validar que los tres
            // valores críticos existan, sean válidos y sean matemáticamente
            // coherentes: saldoUVR × valorUVR ≈ saldoCapital en pesos (±1 %).
            const saldoUvrCands = parseUVRNumberCandidates(p.uvr?.saldoUVR);
            const valorUvrCands = parseUVRNumberCandidates(p.uvr?.valorUVR);
            const saldoPesosCands = parseUVRNumberCandidates(p.uvr?.saldoPesos);
            let saldoUvrN: number | undefined = saldoUvrCands.length === 1 ? saldoUvrCands[0] : undefined;
            let valorUvrN: number | undefined = valorUvrCands.length === 1 ? valorUvrCands[0] : undefined;
            const saldoPesosN: number | undefined = saldoPesosCands.length === 1 ? saldoPesosCands[0] : undefined;
            let resueltoPorCoherencia = false;

            if (
              (saldoUvrN === undefined || valorUvrN === undefined) &&
              saldoPesosN !== undefined &&
              saldoUvrCands.length > 0 &&
              valorUvrCands.length > 0
            ) {
              const r = resolveUVRByCoherence({
                saldoUVRCandidates: saldoUvrN !== undefined ? [saldoUvrN] : saldoUvrCands,
                valorUVRCandidates: valorUvrN !== undefined ? [valorUvrN] : valorUvrCands,
                saldoPesos: saldoPesosN,
              });
              if (r.resolved) {
                saldoUvrN = r.saldoUVR;
                valorUvrN = r.valorUVR;
                resueltoPorCoherencia = true;
              }
            }

            const coh = validateUVRCoherence(saldoUvrN, valorUvrN, saldoPesosN);
            if (!coh.ejecutable) {
              toast.error(
                "No fue posible validar la coherencia UVR porque faltan o son inválidos uno o más datos críticos. Revisa el saldo a capital en UVR, el valor de la UVR y el saldo a capital en pesos antes de continuar.",
                {
                  duration: 10000,
                  action: {
                    label: "Revisar valores",
                    onClick: () => {
                      /* el analista puede corregir los campos y reejecutar */
                    },
                  },
                },
              );
              return;
            }
            if (!coh.isCoherent) {
              const diff = ((coh.diffPct ?? 0) * 100).toFixed(2);
              toast.error(
                `Discrepancia UVR: saldoUVR × valorUVR = ${formatCOP(coh.productoPesos ?? 0)} vs saldo a capital en pesos = ${formatCOP(coh.saldoPesos ?? 0)} (diferencia ${diff}% > 1%). Corrige los valores antes de aplicar.`,
                {
                  duration: 12000,
                  action: {
                    label: "Revisar valores",
                    onClick: () => {
                      /* bloqueo hasta que el analista corrija */
                    },
                  },
                },
              );
              return;
            }
            if (resueltoPorCoherencia) {
              toast.info("Formato UVR interpretado mediante validación de coherencia.");
            }
            // ─── FIN VALIDACIÓN ───

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
            // Escribimos valores UVR normalizados (los resueltos por el parser)
            // en lugar del raw, para que parseDecimal downstream sea determinista.
            setSaldoUVR(String(saldoUvrN));
            setValorUVR(String(valorUvrN));
            setSaldoPesos(String(saldoPesosN));
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
            // Auto-QA / snapshot: NO se dispara desde `onApply`. Registramos
            // sólo la INTENCIÓN (`pendingAutoQAToken`) para que, tras que
            // React aplique todos los setState del formulario, el efecto
            // dedicado construya el snapshot con `buildUvrQaSnapshot` y —
            // sólo si `uvrVarsReady` — ejecute la auditoría. En modo
            // standalone, el useEffect emisor reemite `nuvia:draftRawReady`
            // con el snapshot canónico del formulario (nunca `p.raw`).
            if (init?.id) {
              setPendingAutoQAToken({
                archivoPath: p.archivoPath ?? null,
                archivoNombre: p.raw?.archivoNombre ?? null,
              });
              setAutoQA(null);
            }
          }}
        />}
        {!qaEmbedded && init?.id && pendingAutoQAToken && !uvrVarsReady && (

          <Card>
            <div
              className="rounded-lg px-4 py-3 text-[13px] leading-snug"
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.45)",
                color: "#92400E",
              }}
            >
              <div className="font-semibold mb-1">⏸ NUVIA QA · Pendiente de variables UVR</div>
              <div>
                Sin <b>Variación UVR EA histórica</b> y <b>Variación UVR EA propuestas</b> las proyecciones de saldo, corrección monetaria y ahorro no son concluyentes. NUVIA emitirá su dictamen automáticamente cuando ambos campos estén diligenciados ({">"} 0%).
              </div>
            </div>
          </Card>
        )}
        {!qaEmbedded && init?.id && (autoQALoading || autoQA) && (
          <AutoQAPanel loading={autoQALoading} result={autoQA} simuladorReturn={simuladorReturn} />
        )}
        {!qaEmbedded && <Card>
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
        </Card>}

        {!qaEmbedded && <FreshBlock data={cobertura} onChange={setCobertura} />}

        <Card>
          <div id="qa-simulador-campos" />
          <SectionTitle sub="Información financiera del crédito en UVR">
            {qaEmbedded ? "Corrección del auditor · Datos del crédito" : "Datos del crédito"}
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

        {qaEmbedded && <FreshBlock data={cobertura} onChange={setCobertura} />}


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
                    if (init?.id) {
                      try {
                        await marcarAccionPropuesta({ data: { expedienteId: init.id, accion: "export" } });
                      } catch (e) {
                        console.warn("[marcarAccionPropuesta:export]", e);
                      }
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.01]"
                  style={{
                    background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                    color: "#E1E8F8",
                    border: "1px solid rgba(255,255,255,0.14)",
                    boxShadow: "0 8px 22px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
                  }}
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
                  onSent={async () => {
                    if (!init?.id) return;
                    try {
                      await marcarAccionPropuesta({ data: { expedienteId: init.id, accion: "email" } });
                    } catch (e) {
                      console.warn("[marcarAccionPropuesta:email]", e);
                    }
                  }}
                />
                <WhatsAppPropuestaButton
                  nombre={client.nombre}
                  banco={client.banco}
                  telefono={client.celular}
                  asesor={client.asesor}
                  cuotaActual={cuotaSimulacionPesosNum}
                  onGenerated={async () => {
                    if (!init?.id) return;
                    try {
                      await marcarAccionPropuesta({ data: { expedienteId: init.id, accion: "whatsapp" } });
                    } catch (e) {
                      console.warn("[marcarAccionPropuesta:whatsapp]", e);
                    }
                  }}
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

            {recomendada && auditoriaId && (
              <div className="mt-3 flex flex-col items-end gap-1.5">
                <button
                  onClick={handleAprobar}
                  disabled={aprobando || !uvrVarsReady}
                  title={
                    !uvrVarsReady
                      ? "NUVIA no puede liberar el caso hasta que diligencies Variación UVR EA histórica y Variación UVR EA propuestas (> 0%)."
                      : undefined
                  }
                  className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold shadow transition-transform hover:scale-[1.01]"
                  style={{
                    background: uvrVarsReady ? "var(--nuvia-success)" : "rgba(148,163,184,0.4)",
                    color: uvrVarsReady ? "#0b0b0b" : "#475569",
                    cursor: aprobando || !uvrVarsReady ? "not-allowed" : "pointer",
                    opacity: aprobando ? 0.7 : 1,
                  }}
                >
                  {aprobando ? "Aprobando…" : "✓ Aprobar y liberar al analista"}
                </button>
                {!uvrVarsReady && (
                  <div className="text-[11px] font-medium" style={{ color: "#92400E" }}>
                    ⏸ Pendiente: ingresa Variación UVR EA histórica y propuestas para que NUVIA emita el dictamen.
                  </div>
                )}
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
