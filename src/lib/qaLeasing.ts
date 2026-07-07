// NUVIA Financial QA AI — Motor de auditoría para Leasing Habitacional (COP)
// Determinístico. Reutiliza `proyectarLeasing` como fuente de verdad matemática
// y devuelve inconsistencias/score compatibles con la persistencia estándar
// (`qa_auditorias`, `qa_inconsistencias`, `qa_alertas`).

import { proyectarLeasing, type ResultadoLeasing } from "@/lib/proyeccion";
import {
  TOLERANCIAS_DEFAULT,
  calcularScore,
  type Inconsistencia,
  type ScoreResultado,
  type Tolerancias,
} from "@/lib/qaMath";

export const QA_LEASING_MOTOR_VERSION = "leasing-1.0.0";

export interface LeasingQAInput {
  saldoCapital: number;
  valorLeasing?: number;            // valor total pactado (opcional, informativo)
  valorResidual: number;            // opción de compra en COP
  opcionCompraPct?: number;         // % pactado (informativo)
  cuotasPendientes: number;
  cuotasPagadas?: number;
  teaCobradaPct: number;            // TEA aplicada en el extracto
  teaPactadaPct?: number;           // TEA del contrato (si se conoce)
  seguros: number;
  canonBancoReportado?: number;     // canon total mensual del extracto
  sistemaAmortizacion?: string;     // p.ej. "PESOS - C. FIJA", "IBR + spread", "UVR"
  incluirOpcionCompra?: boolean;
  fechaCorte?: string;
}

export interface LeasingQAResult {
  motorVersion: string;
  inconsistencias: Inconsistencia[];
  score: ScoreResultado;
  reconstruccion: {
    canonFinancieroBase: number;
    canonTotalBase: number;
    valorResidual: number;
    saldoFinalProyectado: number;
    totalIntereses: number;
    totalSeguros: number;
    totalPagado: number;
    vecesPagado: number;
    convergeAlResidual: boolean;
    residualComoPctDelSaldo: number;
    fechaFinalizacion: Date | null;
  };
  proyeccion: ResultadoLeasing;
  veredicto: string;
  faltantes: string[];
}

/** Rango típico de la opción de compra en Colombia (% del valor del leasing/saldo). */
const RESIDUAL_PCT_MIN = 1;
const RESIDUAL_PCT_MAX = 20;

/** Patrones que indican tasa variable / indexada — motor actual solo soporta fija. */
const VARIABLE_RATE_RX = /(ibr|dtf|uvr|ipc|variable|indexad)/i;

export function auditarLeasing(input: LeasingQAInput, toleranciasOverride?: Partial<Tolerancias>): LeasingQAResult {
  const tol: Tolerancias = { ...TOLERANCIAS_DEFAULT, ...(toleranciasOverride ?? {}) };
  const incs: Inconsistencia[] = [];
  const faltantes: string[] = [];

  // Detección de campos faltantes críticos
  if (!(input.saldoCapital > 0)) faltantes.push("saldoCapital");
  if (!(input.valorResidual > 0)) faltantes.push("valorResidual");
  if (!(input.teaCobradaPct > 0)) faltantes.push("teaCobradaPct");
  if (!(input.cuotasPendientes > 0)) faltantes.push("cuotasPendientes");

  // Ejecutar proyección determinística
  const proy = proyectarLeasing({
    saldoInicial: Math.max(0, input.saldoCapital),
    valorResidual: Math.max(0, input.valorResidual),
    cuotasPendientes: Math.max(1, input.cuotasPendientes),
    teaPct: input.teaCobradaPct,
    seguros: Math.max(0, input.seguros),
    fechaInicio: new Date(),
    incluirOpcionCompra: input.incluirOpcionCompra,
    canonBancoReportado: input.canonBancoReportado,
  });

  // R1 — Canon reconstruido vs canon banco (>1% Δ)
  if (
    input.canonBancoReportado &&
    input.canonBancoReportado > 0 &&
    proy.qa.canonReconstruidoDifPct !== null &&
    Math.abs(proy.qa.canonReconstruidoDifPct) > 1
  ) {
    const diff = input.canonBancoReportado - proy.canonTotalBase;
    const sev = Math.abs(proy.qa.canonReconstruidoDifPct) > 3 ? "critica" : "warning";
    incs.push({
      tipo: "cuota",
      severidad: sev,
      campo: "canonTotal",
      valorExtracto: input.canonBancoReportado,
      valorCalculado: Math.round(proy.canonTotalBase),
      diferencia: Math.round(diff),
      mensaje: `Canon reconstruido difiere del reportado por el banco en ${proy.qa.canonReconstruidoDifPct.toFixed(2)}%. Verifica TEA, seguros, residual o cánones pendientes.`,
      sugerencia: "Revisar TEA aplicada, base de seguros y cánones pendientes contra el extracto original.",
    });

    // Sub-regla: seguros mezclados en canon financiero
    if (input.seguros > 0 && Math.abs(Math.abs(diff) - input.seguros) / input.seguros < 0.1) {
      incs.push({
        tipo: "seguros",
        severidad: "warning",
        campo: "seguros",
        valorExtracto: input.canonBancoReportado,
        valorCalculado: Math.round(proy.canonTotalBase),
        diferencia: Math.round(diff),
        mensaje: `La diferencia (${Math.round(diff).toLocaleString("es-CO")}) coincide con el valor de seguros mensuales. Posible mezcla de seguros dentro del canon financiero.`,
        sugerencia: "Solicitar al banco desglose de canon financiero vs primas de seguros.",
      });
    }
  }

  // R2 — Convergencia al valor residual (>0.5% Δ)
  if (!proy.saldoConvergeAlResidual) {
    incs.push({
      tipo: "saldo",
      severidad: "critica",
      campo: "valorResidual",
      valorExtracto: input.valorResidual,
      valorCalculado: Math.round(proy.saldoFinalProyectado),
      diferencia: Math.round(proy.saldoFinalProyectado - input.valorResidual),
      mensaje: `El saldo final proyectado (${Math.round(proy.saldoFinalProyectado).toLocaleString("es-CO")}) no converge al valor residual pactado (${Math.round(input.valorResidual).toLocaleString("es-CO")}). Revisa TEA, cánones pendientes o si hay cánones extraordinarios no reportados.`,
      sugerencia: "Cotejar cánones pendientes reales contra los proyectados. Sospechar tasa variable o prepago.",
    });
  }

  // R3 — Residual como % del saldo fuera de rango [1%, 20%]
  const pctResidual = proy.qa.residualComoPctDelSaldo;
  if (pctResidual > 0 && (pctResidual < RESIDUAL_PCT_MIN || pctResidual > RESIDUAL_PCT_MAX)) {
    incs.push({
      tipo: "flujo",
      severidad: pctResidual > 25 || pctResidual < 0.5 ? "warning" : "info",
      campo: "opcionCompraPct",
      valorExtracto: pctResidual,
      valorCalculado: null as unknown as number,
      diferencia: 0,
      mensaje: `La opción de compra representa ${pctResidual.toFixed(2)}% del saldo. El rango típico en Colombia es ${RESIDUAL_PCT_MIN}%–${RESIDUAL_PCT_MAX}%.`,
      sugerencia: "Confirmar contra el contrato de leasing.",
    });
  }

  // R4 — Capital cero/negativo (canon no cubre intereses)
  if (proy.qa.capitalCero) {
    incs.push({
      tipo: "cuota",
      severidad: "critica",
      campo: "capital",
      mensaje: "En al menos una cuota el capital sería 0 o negativo (el canon no cubre intereses). Revisa la TEA aplicada versus el canon reportado.",
      sugerencia: "Sospechar tasa cobrada superior a la pactada o error en canon.",
    });
  }

  // R5 — TEA pactada vs cobrada (>0.5 pp)
  if (input.teaPactadaPct && input.teaPactadaPct > 0 && input.teaCobradaPct > 0) {
    const diffPp = input.teaCobradaPct - input.teaPactadaPct;
    if (Math.abs(diffPp) > tol.tasaEaAbs) {
      const sev = Math.abs(diffPp) > 1 ? "critica" : "warning";
      incs.push({
        tipo: "tasa",
        severidad: sev,
        campo: "tasaEA",
        valorExtracto: input.teaCobradaPct,
        valorCalculado: input.teaPactadaPct,
        diferencia: Number(diffPp.toFixed(4)),
        mensaje: `TEA cobrada (${input.teaCobradaPct.toFixed(2)}%) difiere de la pactada (${input.teaPactadaPct.toFixed(2)}%) en ${diffPp.toFixed(2)} pp.`,
        sugerencia: diffPp > 0
          ? "Cobro superior al contrato — solicitar recálculo y devolución de intereses."
          : "Cobro inferior al contrato — verificar si aplica un beneficio vigente.",
      });
    }
  } else if (!input.teaPactadaPct) {
    faltantes.push("teaPactadaPct");
  }

  // R6 — Tasa variable/indexada no soportada por el motor
  if (input.sistemaAmortizacion && VARIABLE_RATE_RX.test(input.sistemaAmortizacion)) {
    incs.push({
      tipo: "tasa",
      severidad: "warning",
      campo: "sistemaAmortizacion",
      mensaje: `Sistema "${input.sistemaAmortizacion}" indica tasa variable/indexada. El motor actual asume tasa fija — la proyección es indicativa, no vinculante.`,
      sugerencia: "Auditar contra las variaciones históricas del indexador (IBR/DTF/UVR/IPC).",
    });
  }

  // R7 — Continuidad multi-periodo: pendiente de conector con lecturas previas
  //      (se emite como faltante para que el pipeline QA lo pueda enriquecer)
  if (!input.canonBancoReportado || input.canonBancoReportado <= 0) {
    faltantes.push("canonBancoReportado");
  }

  const score = calcularScore(incs, faltantes.length, tol);

  const veredicto = construirVeredictoLeasing({
    input,
    proy,
    incs,
    score,
  });

  return {
    motorVersion: QA_LEASING_MOTOR_VERSION,
    inconsistencias: incs,
    score,
    reconstruccion: {
      canonFinancieroBase: Math.round(proy.canonFinancieroBase),
      canonTotalBase: Math.round(proy.canonTotalBase),
      valorResidual: Math.round(proy.valorResidual),
      saldoFinalProyectado: Math.round(proy.saldoFinalProyectado),
      totalIntereses: Math.round(proy.totalIntereses),
      totalSeguros: Math.round(proy.totalSeguros),
      totalPagado: Math.round(proy.totalPagado),
      vecesPagado: Number(proy.vecesPagado.toFixed(4)),
      convergeAlResidual: proy.saldoConvergeAlResidual,
      residualComoPctDelSaldo: Number(proy.qa.residualComoPctDelSaldo.toFixed(2)),
      fechaFinalizacion: proy.fechaFinalizacion,
    },
    proyeccion: proy,
    veredicto,
    faltantes,
  };
}

function construirVeredictoLeasing(args: {
  input: LeasingQAInput;
  proy: ResultadoLeasing;
  incs: Inconsistencia[];
  score: ScoreResultado;
}): string {
  const { input, proy, score, incs } = args;
  const critNames = incs.filter((i) => i.severidad === "critica").map((i) => i.campo ?? i.tipo).join(", ");
  const canonMsg = input.canonBancoReportado && input.canonBancoReportado > 0
    ? `Canon banco ${Math.round(input.canonBancoReportado).toLocaleString("es-CO")} vs reconstruido ${Math.round(proy.canonTotalBase).toLocaleString("es-CO")} (Δ ${proy.qa.canonReconstruidoDifPct?.toFixed(2) ?? "n/a"}%). `
    : "Sin canon reportado por el banco para cruzar. ";
  const residualMsg = proy.saldoConvergeAlResidual
    ? `Saldo final converge al residual pactado (${proy.qa.residualComoPctDelSaldo.toFixed(1)}% del saldo). `
    : `⚠ Saldo final NO converge al residual pactado. `;
  const dictamenLabel: Record<ScoreResultado["dictamen"], string> = {
    aprobado: "APROBADO",
    aprobado_obs: "APROBADO C/OBSERVACIONES",
    requiere_revision: "REQUIERE REVISIÓN",
    rechazado: "RECHAZADO",
  };
  const critMsg = critNames ? ` Alertas críticas: ${critNames}.` : "";
  return `Dictamen ${dictamenLabel[score.dictamen]} · Score ${score.score}/100. ${canonMsg}${residualMsg}${critMsg}`.trim();
}
