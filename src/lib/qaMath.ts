// NUVIA Financial QA AI — Motor matemático determinístico
// 100% TypeScript puro · sin dependencias externas · testeable

export const QA_MOTOR_VERSION = "1.2.1";
export const DEFAULT_VARIACION_UVR_EA = 5.5;

export type Modalidad = "hipotecario" | "leasing" | "uvr";
export type Severidad = "info" | "warning" | "critica";
export type Categoria = "excelente" | "aprobado" | "revisar" | "rechazado";
export type Dictamen = "aprobado" | "aprobado_obs" | "requiere_revision" | "rechazado";
export type InconsistenciaTipo =
  | "tasa" | "seguros" | "cuota" | "frech" | "uvr"
  | "flujo" | "simulacion" | "extracto" | "honorario" | "plazo" | "saldo";

export interface Tolerancias {
  cuotaPct: number;     // %
  cuotaAbs: number;     // COP
  saldoAbs: number;     // COP
  tasaEaAbs: number;    // pp (puntos porcentuales)
  segurosAbs: number;   // COP
  frechAbs: number;     // pp
  simCuotasMax: number; // cuotas
  simAhorroAbs: number; // COP
  penInfo: number;
  penWarning: number;
  penCritica: number;
  penDiffCuotaMax: number;
  penDiffSimMax: number;
  penFaltantesMax: number;
  // Umbrales de dictamen (Fase 2 — configurables vía qa_reglas)
  umbScoreExcelente: number;  // >= excelente → APROBADO
  umbScoreAprobado: number;   // >= aprobado  → APROBADO C/OBS
  umbScoreRevisar: number;    // >= revisar   → REQUIERE REVISIÓN, < → RECHAZADO
}

export const TOLERANCIAS_DEFAULT: Tolerancias = {
  cuotaPct: 0.5, cuotaAbs: 5000, saldoAbs: 10000,
  tasaEaAbs: 0.05, segurosAbs: 2000, frechAbs: 0.10,
  simCuotasMax: 2, simAhorroAbs: 500_000,
  penInfo: 1, penWarning: 5, penCritica: 15,
  penDiffCuotaMax: 10, penDiffSimMax: 25, penFaltantesMax: 10,
  umbScoreExcelente: 95, umbScoreAprobado: 85, umbScoreRevisar: 70,
};


// ──────────────────────────────────────────────────────────────
// 1. Conversiones de tasa
// ──────────────────────────────────────────────────────────────
export const eaToMv = (ea: number) => Math.pow(1 + ea, 1 / 12) - 1;
export const mvToEa = (mv: number) => Math.pow(1 + mv, 12) - 1;
export const eaToNa = (ea: number) => eaToMv(ea) * 12;

// ──────────────────────────────────────────────────────────────
// 2. Cuota teórica (sistema francés)
// ──────────────────────────────────────────────────────────────
export function cuotaTeorica(saldo: number, iPeriodica: number, n: number): number {
  if (n <= 0 || saldo <= 0) return 0;
  if (iPeriodica <= 0) return saldo / n;
  return (saldo * iPeriodica) / (1 - Math.pow(1 + iPeriodica, -n));
}

// ──────────────────────────────────────────────────────────────
// 3. Tabla de amortización
// ──────────────────────────────────────────────────────────────
// Tope duro de cobertura FRECH / Tasa Fresh: 84 cuotas (7 años).
// Pasada esa marca el crédito vuelve a la tasa pactada completa.
export const FRECH_MAX_CUOTAS = 84;

export interface FilaAmort {
  k: number;
  cuota: number;        // cuota financiera (capital + interés) del período
  interes: number;
  capital: number;
  seguros: number;
  fresh: number;        // descuento/cobertura FRECH/Fresh aplicado al pago del cliente
  cuotaTotal: number;   // cuota + seguros
  saldo: number;
  subsidioActivo: boolean; // true mientras aplique FRECH/Fresh
  saldoUvr?: number;
  valorUvr?: number;
  cuotaUvr?: number;
  interesUvr?: number;
  capitalUvr?: number;
  correccionUvr?: number;
}

export function amortizacion(
  saldo: number,
  iPeriodica: number,
  n: number,
  seguros: number = 0,
  opts?: { iPostSubsidio?: number; cuotasSubsidio?: number; subsidioMensual?: number; cuotaOverride?: number },
): FilaAmort[] {
  const seg = Math.max(0, seguros || 0);
  const cuotasSub = Math.max(0, Math.min(n, Math.round(opts?.cuotasSubsidio ?? 0)));
  const subsidioMensual = Math.max(0, opts?.subsidioMensual ?? 0);
  const hasSwitch = !!opts && opts.iPostSubsidio !== undefined && opts.iPostSubsidio !== iPeriodica && cuotasSub > 0 && cuotasSub < n;
  const C1 = Math.max(0, opts?.cuotaOverride ?? 0) || cuotaTeorica(saldo, iPeriodica, n);
  const filas: FilaAmort[] = [];
  let s = saldo;
  let C = C1;
  let currI = iPeriodica;
  for (let k = 1; k <= n; k++) {
    if (hasSwitch && k === cuotasSub + 1) {
      // Termina el subsidio: re-amortiza saldo residual a tasa post-subsidio sobre cuotas restantes.
      currI = opts!.iPostSubsidio!;
      C = cuotaTeorica(s, currI, n - k + 1);
    }
    const interes = s * currI;
    const capital = C - interes;
    s = Math.max(0, s - capital);
    const subsidioActivo = hasSwitch ? k <= cuotasSub : (opts?.cuotasSubsidio ?? 0) > 0 && k <= (opts?.cuotasSubsidio ?? 0);
    const fresh = subsidioActivo ? Math.min(subsidioMensual, C + seg) : 0;
    filas.push({ k, cuota: C, interes, capital, seguros: seg, fresh, cuotaTotal: C + seg - fresh, saldo: s, subsidioActivo });
  }
  return filas;
}

export function amortizacionUvr(
  saldoUvrInicial: number,
  valorUvrInicial: number,
  iPeriodica: number,
  variacionMensualUvr: number,
  cuotaUvr: number,
  n: number,
  seguros: number = 0,
  opts?: { cuotasSubsidio?: number; subsidioMensual?: number },
): FilaAmort[] {
  const filas: FilaAmort[] = [];
  const seg = Math.max(0, seguros || 0);
  const cuotasSub = Math.max(0, Math.min(n, Math.round(opts?.cuotasSubsidio ?? 0)));
  const subsidioMensual = Math.max(0, opts?.subsidioMensual ?? 0);
  let saldoUvr = Math.max(0, saldoUvrInicial || 0);
  let valorUvr = Math.max(0, valorUvrInicial || 0);

  for (let k = 1; k <= n && saldoUvr > 0.000001 && valorUvr > 0 && cuotaUvr > 0; k++) {
    const valorUvrProy = valorUvr * (1 + variacionMensualUvr);
    const interesUvr = saldoUvr * iPeriodica;
    let capitalUvr = cuotaUvr - interesUvr;
    if (capitalUvr > saldoUvr) capitalUvr = saldoUvr;
    const saldoUvrFinal = Math.max(0, saldoUvr - capitalUvr);
    const cuotaPesos = cuotaUvr * valorUvrProy;
    const interesPesos = interesUvr * valorUvrProy;
    const capitalPesos = capitalUvr * valorUvrProy;
    const saldoFinalPesos = saldoUvrFinal * valorUvrProy;
    const correccionUvr = saldoUvr * (valorUvrProy - valorUvr);
    const subsidioActivo = k <= cuotasSub;
    const fresh = subsidioActivo ? Math.min(subsidioMensual, cuotaPesos + seg) : 0;

    filas.push({
      k,
      cuota: cuotaPesos,
      interes: interesPesos,
      capital: capitalPesos,
      seguros: seg,
      fresh,
      cuotaTotal: cuotaPesos + seg - fresh,
      saldo: saldoFinalPesos,
      subsidioActivo,
      saldoUvr: saldoUvrFinal,
      valorUvr: valorUvrProy,
      cuotaUvr,
      interesUvr,
      capitalUvr,
      correccionUvr,
    });

    saldoUvr = saldoUvrFinal;
    valorUvr = valorUvrProy;
  }
  return filas;
}

// ──────────────────────────────────────────────────────────────
// 4. Reconstrucción matemática del crédito
// ──────────────────────────────────────────────────────────────
export interface ReconstruccionInput {
  modalidad: Modalidad;
  saldoCapital: number;
  tasaEa: number;           // % anual efectiva — tasa que el cliente paga (cobrada / vigente)
  /** Tasa pactada / contractual sin beneficios. Se usa como BASE para la cuota
   *  teórica sin subsidio cuando hay cobertura FRECH/Fresh activa. */
  tasaEaPactada?: number;
  cuotasPendientes: number;
  seguros: number;          // COP / mes (total)
  coberturaFrechPp?: number; // pp anuales EA descontados
  coberturaFrechValorMensual?: number; // COP / mes descontados mientras aplique FRECH/Fresh
  /** Cuotas restantes con cobertura FRECH/Fresh. Si se omite y hay cobertura,
   *  se asume el tope duro FRECH_MAX_CUOTAS (84) acotado a las pendientes. */
  coberturaFrechCuotasRestantes?: number;
  valorDesembolsado?: number;
  saldoUVR?: number;
  valorUVR?: number;
  variacionUvrEa?: number;
  cuotaBaseSinSubsidio?: number;
  cuotaFinancieraSinSeguros?: number;
}

export interface Reconstruccion {
  iMv: number;
  /** Tasa EA usada como base para la cuota teórica sin beneficio. */
  tasaEaBase: number;
  cuotaTeorica: number;
  cuotaConSubsidio: number;
  cuotaTotalConSeguros: number;
  beneficioMensualFrech: number;
  costoTotal: number;
  vecesPagado: number;
  primerasCuotas: FilaAmort[];  // 12
  ultimasCuotas: FilaAmort[];   // 12
  todasCuotas: FilaAmort[];
  totalIntereses: number;
  /** Cuotas efectivas con subsidio aplicadas en la reconstrucción. */
  cuotasFrechAplicadas: number;
  totalCorreccionUvr?: number;
  saldoFinalPesosPrimerMes?: number;
}

export function reconstruir(input: ReconstruccionInput): Reconstruccion {
  const eaCobrada = (input.tasaEa || 0) / 100;
  const eaPactada = (input.tasaEaPactada || 0) / 100;
  const cob = input.coberturaFrechPp ? input.coberturaFrechPp / 100 : 0;
  const beneficioMensual = Math.max(0, input.coberturaFrechValorMensual ?? 0);
  const hayCobertura = cob > 0 || beneficioMensual > 0;
  const n = Math.max(0, Math.round(input.cuotasPendientes));
  const seguros = Math.max(0, input.seguros || 0);
  const valorUvrDerivado = (input.valorUVR ?? 0) > 0
    ? input.valorUVR!
    : ((input.saldoUVR ?? 0) > 0 && input.saldoCapital > 0 ? input.saldoCapital / input.saldoUVR! : 0);
  const saldoUvrDerivado = (input.saldoUVR ?? 0) > 0
    ? input.saldoUVR!
    : (valorUvrDerivado > 0 && input.saldoCapital > 0 ? input.saldoCapital / valorUvrDerivado : 0);

  if (input.modalidad === "uvr" && saldoUvrDerivado > 0 && valorUvrDerivado > 0) {
    // UVR NO se liquida como pesos. El saldo se amortiza en UVR, la UVR se
    // reajusta mes a mes y el saldo en COP puede crecer aunque baje en UVR.
    // La tasa de interés SIEMPRE es la TE cobrada del extracto, no la pactada.
    const saldoUvr = Math.max(0, saldoUvrDerivado);
    const valorUvr = Math.max(0, valorUvrDerivado);
    const iMvUvr = eaToMv(eaCobrada);
    const variacionEa = Math.max(0, input.variacionUvrEa ?? DEFAULT_VARIACION_UVR_EA) / 100;
    const variacionMensual = eaToMv(variacionEa);
    const cuotaUvr = cuotaTeorica(saldoUvr, iMvUvr, n);
    const cuotaFinancieraBase = cuotaUvr * valorUvr;
    const cuotaSinSubsidioOficial = Math.max(0, input.cuotaBaseSinSubsidio ?? 0);
    const cuotaTeoricaActual = cuotaSinSubsidioOficial > 0 ? cuotaSinSubsidioOficial : cuotaFinancieraBase + seguros;
    const cuotaTotal = Math.max(0, cuotaTeoricaActual - beneficioMensual);
    const cuotasFrechAplicadas = hayCobertura
      ? Math.max(0, Math.min(n, Math.round(input.coberturaFrechCuotasRestantes ?? FRECH_MAX_CUOTAS)))
      : 0;
    const tabla = amortizacionUvr(
      saldoUvr,
      valorUvr,
      iMvUvr,
      variacionMensual,
      cuotaUvr,
      n,
      seguros,
      hayCobertura ? { cuotasSubsidio: cuotasFrechAplicadas, subsidioMensual: beneficioMensual } : undefined,
    );
    const totalIntereses = tabla.reduce((s, f) => s + f.interes, 0);
    const totalCorreccionUvr = tabla.reduce((s, f) => s + (f.correccionUvr ?? 0), 0);
    const costoTotal = tabla.reduce((s, f) => s + f.cuotaTotal, 0);
    const desembolso = input.valorDesembolsado && input.valorDesembolsado > 0 ? input.valorDesembolsado : input.saldoCapital;

    return {
      iMv: iMvUvr,
      tasaEaBase: eaCobrada * 100,
      cuotaTeorica: cuotaTeoricaActual,
      cuotaConSubsidio: cuotaTotal,
      cuotaTotalConSeguros: cuotaTotal,
      beneficioMensualFrech: beneficioMensual,
      costoTotal,
      vecesPagado: desembolso > 0 ? costoTotal / desembolso : 0,
      primerasCuotas: tabla.slice(0, 12),
      ultimasCuotas: tabla.slice(-12),
      todasCuotas: tabla,
      totalIntereses,
      cuotasFrechAplicadas,
      totalCorreccionUvr,
      saldoFinalPesosPrimerMes: tabla[0]?.saldo,
    };
  }

  // BASE para la cuota teórica SIN beneficio:
  // - Si hay cobertura y existe tasa pactada > cobrada → usar pactada
  //   (la cobrada ya viene neta del subsidio y subestima la cuota teórica real).
  // - En cualquier otro caso → usar la tasa cobrada / única reportada.
  const eaBase = hayCobertura && eaPactada > eaCobrada ? eaPactada : eaCobrada;
  const iMv = eaToMv(eaBase);
  const cuotaOficialSinSeguros = Math.max(0, input.cuotaFinancieraSinSeguros ?? 0);
  const CFormula = cuotaTeorica(input.saldoCapital, iMv, n);
  const usarCuotaOficial = !hayCobertura && cuotaOficialSinSeguros > 0 && Math.abs(cuotaOficialSinSeguros - CFormula) <= Math.max(2_500, CFormula * 0.005);
  const C = usarCuotaOficial ? cuotaOficialSinSeguros : CFormula;

  // Cuota con subsidio:
  // - Si cobertura en pp → descontar de la base (pactada − pp).
  // - Si solo es valor mensual → mantener la cuota teórica y restar el COP.
  const iSub = cob > 0 ? eaToMv(Math.max(0, eaBase - cob)) : eaToMv(eaCobrada);
  const CSub = cob > 0
    ? cuotaTeorica(input.saldoCapital, iSub, n)
    : (beneficioMensual > 0 ? Math.max(0, C - beneficioMensual) : C);
  const beneficioPorTasa = Math.max(0, C - CSub);
  const beneficio = beneficioMensual > 0 ? beneficioMensual : beneficioPorTasa;

  const cuotaFinancieraBase = beneficioMensual > 0 ? C : (cob > 0 ? CSub : C);
  const cuotaTotal = cuotaFinancieraBase + seguros - (beneficioMensual > 0 ? beneficioMensual : 0);

  // Tope FRECH (84 cuotas) — si no llega override, asumimos cobertura completa hasta el tope.
  const cuotasFrechAplicadas = hayCobertura
    ? Math.max(0, Math.min(n, Math.round(input.coberturaFrechCuotasRestantes ?? FRECH_MAX_CUOTAS)))
    : 0;

  // Amortización: arranca con subsidio activo (tasa subsidiada o descuento COP);
  // tras `cuotasFrechAplicadas` cambia a la tasa base sin beneficio.
  const iArranque = beneficioMensual > 0 ? iMv : (cob > 0 ? iSub : iMv);
  const tabla = amortizacion(
    input.saldoCapital,
    iArranque,
    n,
    seguros,
    hayCobertura
      ? { iPostSubsidio: iMv, cuotasSubsidio: cuotasFrechAplicadas, subsidioMensual: beneficioMensual }
      : (usarCuotaOficial ? { cuotaOverride: cuotaOficialSinSeguros } : undefined),
  );
  const totalIntereses = tabla.reduce((s, f) => s + f.interes, 0);
  const costoTotal = tabla.reduce((s, f) => s + f.cuotaTotal, 0);
  const desembolso = input.valorDesembolsado && input.valorDesembolsado > 0
    ? input.valorDesembolsado : input.saldoCapital;
  const veces = desembolso > 0 ? costoTotal / desembolso : 0;

  return {
    iMv,
    tasaEaBase: eaBase * 100,
    cuotaTeorica: C,
    cuotaConSubsidio: CSub,
    cuotaTotalConSeguros: cuotaTotal,
    beneficioMensualFrech: beneficio,
    costoTotal,
    vecesPagado: veces,
    primerasCuotas: tabla.slice(0, 12),
    ultimasCuotas: tabla.slice(-12),
    todasCuotas: tabla,
    totalIntereses,
    cuotasFrechAplicadas,
  };
}

// ──────────────────────────────────────────────────────────────
// 5. Comparación contra extracto bancario
// ──────────────────────────────────────────────────────────────
export interface ExtractoSnapshot {
  saldoCapital?: number;
  tasaEa?: number;
  cuota?: number;
  seguros?: number;
  coberturaFrechPp?: number;
  coberturaFrechValorMensual?: number;
}

export interface Inconsistencia {
  tipo: InconsistenciaTipo;
  severidad: Severidad;
  campo?: string;
  valorExtracto?: number;
  valorCalculado?: number;
  diferencia?: number;
  mensaje: string;
  sugerencia?: string;
}

function severidadCuota(diff: number, base: number, tol: Tolerancias): Severidad | null {
  const limit = Math.max(tol.cuotaAbs, (base * tol.cuotaPct) / 100);
  if (Math.abs(diff) <= limit) return null;
  if (Math.abs(diff) > limit * 3) return "critica";
  if (Math.abs(diff) > limit * 1.5) return "warning";
  return "info";
}

export function compararExtracto(
  rec: Reconstruccion,
  ext: ExtractoSnapshot,
  inputRec: ReconstruccionInput,
  tol: Tolerancias,
): Inconsistencia[] {
  const out: Inconsistencia[] = [];

  if (inputRec.modalidad === "uvr" && inputRec.saldoUVR && inputRec.valorUVR && inputRec.cuotaFinancieraSinSeguros && inputRec.tasaEa && inputRec.cuotasPendientes) {
    const iUvr = eaToMv(inputRec.tasaEa / 100);
    const cuotaUvrOficial = inputRec.cuotaFinancieraSinSeguros / inputRec.valorUVR;
    if (iUvr > 0 && cuotaUvrOficial > inputRec.saldoUVR * iUvr) {
      const nInferido = Math.log(cuotaUvrOficial / (cuotaUvrOficial - inputRec.saldoUVR * iUvr)) / Math.log(1 + iUvr);
      if (Number.isFinite(nInferido) && Math.abs(nInferido - inputRec.cuotasPendientes) > tol.simCuotasMax) {
        const diferencia = Math.round(nInferido) - inputRec.cuotasPendientes;
        out.push({
          tipo: "plazo",
          severidad: Math.abs(diferencia) > 24 ? "critica" : "warning",
          campo: "cuotas_pendientes_uvr",
          valorExtracto: inputRec.cuotasPendientes,
          valorCalculado: Math.round(nInferido),
          diferencia,
          mensaje: `La cuota financiera UVR oficial amortiza en ${Math.round(nInferido)} cuotas, pero el extracto reporta ${inputRec.cuotasPendientes} pendientes.`,
          sugerencia: "Mantener el plazo del extracto para proyección comercial y validar con el banco si la cuota UVR será recalculada o si tasa/cuota/plazo fueron leídos con otro criterio.",
        });
      }
    }
  }

  if (ext.cuota && ext.cuota > 0) {
    const diff = ext.cuota - rec.cuotaTotalConSeguros;
    const sev = severidadCuota(diff, ext.cuota, tol);
    if (sev) {
      out.push({
        tipo: "cuota", severidad: sev, campo: "cuota",
        valorExtracto: ext.cuota, valorCalculado: rec.cuotaTotalConSeguros, diferencia: diff,
        mensaje: `Diferencia en cuota mensual: $${Math.round(diff).toLocaleString("es-CO")}`,
        sugerencia: "Verifique tasa, plazo restante, seguros y cobertura FRECH.",
      });
    }
  }

  if (ext.saldoCapital && ext.saldoCapital > 0) {
    const diff = ext.saldoCapital - inputRec.saldoCapital;
    if (Math.abs(diff) > tol.saldoAbs) {
      out.push({
        tipo: "saldo", severidad: Math.abs(diff) > tol.saldoAbs * 5 ? "critica" : "warning",
        campo: "saldo_capital", valorExtracto: ext.saldoCapital, valorCalculado: inputRec.saldoCapital,
        diferencia: diff,
        mensaje: `Saldo capital extracto vs lectura difiere en $${Math.round(diff).toLocaleString("es-CO")}`,
      });
    }
  }

  if (ext.tasaEa && ext.tasaEa > 0) {
    const diff = ext.tasaEa - inputRec.tasaEa;
    if (Math.abs(diff) > tol.tasaEaAbs) {
      out.push({
        tipo: "tasa", severidad: Math.abs(diff) > 0.5 ? "critica" : "warning",
        campo: "tasa_ea", valorExtracto: ext.tasaEa, valorCalculado: inputRec.tasaEa,
        diferencia: diff, mensaje: `Tasa EA difiere en ${diff.toFixed(2)} pp`,
        sugerencia: "Revise si la tasa registrada es la efectiva pactada vigente.",
      });
    }
  }

  if (ext.seguros !== undefined && ext.seguros >= 0 && inputRec.seguros >= 0) {
    const diff = ext.seguros - inputRec.seguros;
    if (Math.abs(diff) > tol.segurosAbs) {
      out.push({
        tipo: "seguros", severidad: "warning",
        campo: "seguros", valorExtracto: ext.seguros, valorCalculado: inputRec.seguros,
        diferencia: diff, mensaje: `Total seguros difiere en $${Math.round(diff).toLocaleString("es-CO")}`,
      });
    }
  }

  if (ext.coberturaFrechPp !== undefined && (inputRec.coberturaFrechPp ?? 0) > 0) {
    const diff = (ext.coberturaFrechPp ?? 0) - (inputRec.coberturaFrechPp ?? 0);
    if (Math.abs(diff) > tol.frechAbs) {
      out.push({
        tipo: "frech", severidad: "warning",
        campo: "cobertura_frech", valorExtracto: ext.coberturaFrechPp,
        valorCalculado: inputRec.coberturaFrechPp, diferencia: diff,
        mensaje: `Cobertura FRECH difiere en ${diff.toFixed(2)} pp`,
      });
    }
  }

  return out;
}

// ──────────────────────────────────────────────────────────────
// 6. Comparación contra simulación del analista NUVEX
// ──────────────────────────────────────────────────────────────
export interface SimulacionAnalista {
  cuotasEliminadas?: number;
  ahorroProyectado?: number;
  nuevoPlazo?: number;
}

export function compararSimulacion(
  rec: Reconstruccion,
  inputRec: ReconstruccionInput,
  sim: SimulacionAnalista,
  tol: Tolerancias,
): Inconsistencia[] {
  const out: Inconsistencia[] = [];
  if (sim.ahorroProyectado !== undefined && sim.ahorroProyectado > 0) {
    const ahorroReal = rec.totalIntereses; // ahorro máximo teórico si se pagara totalidad
    const diff = sim.ahorroProyectado - ahorroReal;
    if (Math.abs(diff) > tol.simAhorroAbs) {
      out.push({
        tipo: "simulacion", severidad: Math.abs(diff) > tol.simAhorroAbs * 3 ? "critica" : "warning",
        campo: "ahorro_proyectado", valorExtracto: sim.ahorroProyectado, valorCalculado: ahorroReal,
        diferencia: diff,
        mensaje: `Ahorro proyectado por el analista difiere de la reconstrucción matemática en $${Math.round(diff).toLocaleString("es-CO")}`,
        sugerencia: "Recalcule honorarios y oferta al cliente con la cifra matemática.",
      });
    }
  }
  if (sim.nuevoPlazo !== undefined && sim.nuevoPlazo > 0) {
    if (sim.nuevoPlazo > inputRec.cuotasPendientes) {
      out.push({
        tipo: "plazo", severidad: "warning", campo: "nuevo_plazo",
        valorExtracto: sim.nuevoPlazo, valorCalculado: inputRec.cuotasPendientes,
        mensaje: "El nuevo plazo simulado excede las cuotas pendientes del extracto.",
      });
    }
  }
  return out;
}

// ──────────────────────────────────────────────────────────────
// 7. Score, categoría y dictamen
// ──────────────────────────────────────────────────────────────
export interface ScoreResultado {
  score: number;
  categoria: Categoria;
  dictamen: Dictamen;
  penalizaciones: { tipo: string; valor: number }[];
}

export function calcularScore(
  inconsistencias: Inconsistencia[],
  faltantes: number,
  tol: Tolerancias,
): ScoreResultado {
  let score = 100;
  const pen: { tipo: string; valor: number }[] = [];

  const add = (tipo: string, v: number) => { if (v > 0) { pen.push({ tipo, valor: v }); score -= v; } };

  const info = inconsistencias.filter((i) => i.severidad === "info").length;
  const warn = inconsistencias.filter((i) => i.severidad === "warning").length;
  const crit = inconsistencias.filter((i) => i.severidad === "critica").length;
  add("inconsistencias_info", info * tol.penInfo);
  add("inconsistencias_warning", warn * tol.penWarning);
  add("inconsistencias_critica", crit * tol.penCritica);

  const diffCuota = inconsistencias.find((i) => i.tipo === "cuota");
  if (diffCuota) add("diff_cuota", Math.min(tol.penDiffCuotaMax, 5));
  const diffSim = inconsistencias.find((i) => i.tipo === "simulacion");
  if (diffSim) add("diff_simulacion", Math.min(tol.penDiffSimMax, 10));
  add("campos_faltantes", Math.min(tol.penFaltantesMax, faltantes * 2));

  score = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

  let dictamen: Dictamen;
  if (crit > 0) dictamen = "rechazado";
  else if (score >= tol.umbScoreExcelente) dictamen = "aprobado";
  else if (score >= tol.umbScoreAprobado) dictamen = "aprobado_obs";
  else if (score >= tol.umbScoreRevisar) dictamen = "requiere_revision";
  else dictamen = "rechazado";

  let categoria: Categoria;
  if (dictamen === "rechazado") categoria = "rechazado";
  else if (score >= tol.umbScoreExcelente) categoria = "excelente";
  else if (score >= tol.umbScoreAprobado) categoria = "aprobado";
  else if (score >= tol.umbScoreRevisar) categoria = "revisar";
  else categoria = "rechazado";

  return { score, categoria, dictamen, penalizaciones: pen };
}

// ──────────────────────────────────────────────────────────────
// 8. Auditoría completa (orquestador puro)
// ──────────────────────────────────────────────────────────────
export interface AuditarInput {
  modalidad: Modalidad;
  reconstruccion: ReconstruccionInput;
  extracto: ExtractoSnapshot;
  simulacion?: SimulacionAnalista;
  tolerancias?: Partial<Tolerancias>;
}

export interface AuditarOutput {
  motorVersion: string;
  reconstruccion: Reconstruccion;
  inconsistencias: Inconsistencia[];
  score: ScoreResultado;
  faltantes: string[];
  veredicto: Veredicto;
}

function camposFaltantes(input: AuditarInput): string[] {
  const f: string[] = [];
  const r = input.reconstruccion, e = input.extracto;
  if (!r.saldoCapital) f.push("saldoCapital");
  if (!r.tasaEa) f.push("tasaEa");
  if (!r.cuotasPendientes) f.push("cuotasPendientes");
  if (e.cuota === undefined) f.push("extracto.cuota");
  if (e.saldoCapital === undefined) f.push("extracto.saldoCapital");
  return f;
}

export function auditar(input: AuditarInput): AuditarOutput {
  const tol: Tolerancias = { ...TOLERANCIAS_DEFAULT, ...(input.tolerancias ?? {}) };
  const rec = reconstruir(input.reconstruccion);
  const incExt = compararExtracto(rec, input.extracto, input.reconstruccion, tol);
  const incSim = input.simulacion
    ? compararSimulacion(rec, input.reconstruccion, input.simulacion, tol)
    : [];
  const faltantes = camposFaltantes(input);
  const incs = [...incExt, ...incSim];
  const score = calcularScore(incs, faltantes.length, tol);
  const veredicto = construirVeredicto(input, rec, incs, score);
  return { motorVersion: QA_MOTOR_VERSION, reconstruccion: rec, inconsistencias: incs, score, faltantes, veredicto };
}

// ──────────────────────────────────────────────────────────────
// 9. Veredicto narrativo (determinístico)
// ──────────────────────────────────────────────────────────────
// Genera un dictamen estilo "quién tiene la razón" comparando:
//   Extracto · Excel del analista · Simulador NUVIA · Auditoría NUVIA
// Es 100% matemático (sin IA). Su propósito es que el analista entienda
// dónde está la inconsistencia sin tener que reconstruir el caso a mano.

export type VeredictoEstado = "ok" | "warning" | "error" | "neutral";

export interface VeredictoFila {
  fuente: "extracto" | "excel" | "simulador" | "auditoria";
  estado: VeredictoEstado;
  titulo: string;
  detalle: string;
}

export interface Veredicto {
  titular: string;
  resumen: string;
  filas: VeredictoFila[];
  extractoTieneErrores: "no" | "inconsistencia" | "si";
  causasProbables: string[];
  recomendaciones: string[];
  hallazgos?: VeredictoHallazgo[];
  plazoImplicito?: number;
  plazoReportado?: number;
  desfasePlazo?: number;
}

export interface VeredictoHallazgo {
  codigo: string;
  severidad: Severidad;
  titulo: string;
  detalle: string;
  pista: string; // qué debe hacer el analista
}

export function construirVeredicto(
  input: AuditarInput,
  rec: Reconstruccion,
  inconsistencias: Inconsistencia[],
  score: ScoreResultado,
): Veredicto {
  const r = input.reconstruccion;
  const ext = input.extracto ?? {};
  const sim = input.simulacion;
  const isUvr = input.modalidad === "uvr";
  const tieneFresh = (r.coberturaFrechValorMensual ?? 0) > 0 || (r.coberturaFrechPp ?? 0) > 0;
  const hayExcel = !!sim && Object.values(sim).some((v) => v !== undefined && v !== null);
  const hallazgos: VeredictoHallazgo[] = [];

  const pushH = (h: VeredictoHallazgo) => hallazgos.push(h);

  // ── Check 1: plazo implícito por cuota oficial vs plazo reportado ──
  let plazoImplicito: number | undefined;
  const plazoReportado: number | undefined = r.cuotasPendientes;
  let desfasePlazo: number | undefined;

  try {
    if (isUvr && r.saldoUVR && r.valorUVR && r.cuotaFinancieraSinSeguros && r.tasaEa && r.cuotasPendientes) {
      const iUvr = eaToMv(r.tasaEa / 100);
      const cuotaUvr = r.cuotaFinancieraSinSeguros / r.valorUVR;
      if (iUvr > 0 && cuotaUvr > r.saldoUVR * iUvr) {
        const n = Math.log(cuotaUvr / (cuotaUvr - r.saldoUVR * iUvr)) / Math.log(1 + iUvr);
        if (Number.isFinite(n) && n > 0) plazoImplicito = Math.round(n);
      }
    } else if (!isUvr && r.saldoCapital && r.tasaEa && r.cuotasPendientes) {
      const cuotaOficial = (r.cuotaFinancieraSinSeguros && r.cuotaFinancieraSinSeguros > 0)
        ? r.cuotaFinancieraSinSeguros
        : (ext.cuota && ext.cuota > 0 ? Math.max(0, ext.cuota - (r.seguros || 0)) : 0);
      if (cuotaOficial > 0) {
        const i = eaToMv(r.tasaEa / 100);
        if (i > 0 && cuotaOficial > r.saldoCapital * i) {
          const n = Math.log(cuotaOficial / (cuotaOficial - r.saldoCapital * i)) / Math.log(1 + i);
          if (Number.isFinite(n) && n > 0) plazoImplicito = Math.round(n);
        }
      }
    }
  } catch { /* noop */ }

  if (plazoImplicito && plazoReportado) desfasePlazo = plazoImplicito - plazoReportado;
  const desfaseAbs = desfasePlazo !== undefined ? Math.abs(desfasePlazo) : 0;
  const desfaseGrande = desfaseAbs > 6;
  const desfaseCritico = desfaseAbs > 30;

  const fmtCop = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;

  if (desfaseCritico) {
    const cuotaRef = Math.round(r.cuotaFinancieraSinSeguros ?? ext.cuota ?? 0);
    pushH({
      codigo: "PLAZO_IMPLICITO_VS_REPORTADO",
      severidad: "critica",
      titulo: desfasePlazo! < 0
        ? `El extracto dice ${plazoReportado} cuotas, pero con esa cuota el crédito se acaba en ${plazoImplicito}`
        : `La cuota es muy baja: con ${plazoReportado} cuotas no alcanza a pagar el crédito`,
      detalle: desfasePlazo! < 0
        ? `Si el cliente sigue pagando ${fmtCop(cuotaRef)} cada mes con la tasa actual (${r.tasaEa}% EA), terminaría de pagar en ${plazoImplicito} meses, no en los ${plazoReportado} que aparecen en el extracto. Está pagando más de lo necesario para ese plazo.`
        : `Pagando ${fmtCop(cuotaRef)} al mes, en ${plazoReportado} meses NO se alcanza a pagar todo el saldo. Se necesitarían ${plazoImplicito} meses o una cuota más alta.`,
      pista: desfasePlazo! < 0
        ? "Pregúntele al cliente: ¿ha hecho abonos extra a capital en los últimos meses? Si NO, pídale al banco una proyección oficial — probablemente le están cobrando una cuota calculada con el plazo original y no con el plazo que realmente queda."
        : "Pídale al banco recalcular la cuota o ampliar el plazo. La cuota actual no es suficiente y al final habría un saldo sin pagar.",
    });
  } else if (desfaseGrande) {
    pushH({
      codigo: "PLAZO_IMPLICITO_LEVE",
      severidad: "warning",
      titulo: `Pequeña diferencia de plazo: ${Math.abs(desfasePlazo!)} meses`,
      detalle: `La matemática dice que la cuota actual termina el crédito en ${plazoImplicito} meses, y el extracto reporta ${plazoReportado}. La diferencia es pequeña pero conviene confirmarla.`,
      pista: "Antes de proponer una optimización del crédito, confirme con el banco cuántas cuotas le quedan exactamente al cliente.",
    });
  }

  // ── Check 2: saldo UVR × valor UVR ↔ saldo pesos ──
  let saldoUvrConsistente = true;
  if (isUvr && r.saldoUVR && r.valorUVR && r.saldoCapital) {
    const teor = r.saldoUVR * r.valorUVR;
    const diff = Math.abs(teor - r.saldoCapital);
    saldoUvrConsistente = diff / r.saldoCapital < 0.005;
    if (!saldoUvrConsistente) {
      pushH({
        codigo: "UVR_SALDO_MISMATCH",
        severidad: "critica",
        titulo: "El saldo en UVR no coincide con el saldo en pesos del extracto",
        detalle: `Multiplicando ${r.saldoUVR.toFixed(2)} UVR por el valor UVR de ${fmtCop(r.valorUVR)} debería dar ${fmtCop(teor)}, pero el extracto muestra ${fmtCop(r.saldoCapital)}. Hay una diferencia de ${fmtCop(diff)}.`,
        pista: "El valor de la UVR que está usando NO es el del día del corte del extracto. Busque la UVR oficial publicada por el Banco de la República para esa fecha y vuelva a procesar el caso.",
      });
    }
  }

  // ── Check 3: FRECH coherente (cuotaBase − FRECH ≈ cuotaFinanciera) ──
  let frechConsistente = true;
  const beneficio = r.coberturaFrechValorMensual ?? 0;
  if (beneficio > 0 && (r.cuotaBaseSinSubsidio ?? 0) > 0 && (r.cuotaFinancieraSinSeguros ?? 0) > 0) {
    const esperado = (r.cuotaBaseSinSubsidio ?? 0) - beneficio;
    const real = r.cuotaFinancieraSinSeguros ?? 0;
    frechConsistente = Math.abs(esperado - real) / Math.max(1, esperado) < 0.02;
    if (!frechConsistente) {
      pushH({
        codigo: "FRECH_INCOHERENTE",
        severidad: "warning",
        titulo: "El descuento del subsidio FRECH no cuadra con la cuota que paga el cliente",
        detalle: `La cuota sin subsidio es ${fmtCop(r.cuotaBaseSinSubsidio!)}; al restarle el FRECH de ${fmtCop(beneficio)} debería quedar ${fmtCop(esperado)}, pero el cliente está pagando ${fmtCop(real)}. No coincide.`,
        pista: "Llame al banco y pregunte dos cosas: (1) ¿el subsidio FRECH se aplica como descuento en pesos o como rebaja en la tasa de interés? y (2) ¿cuántos meses de cobertura le quedan al cliente?",
      });
    }
  }

  // ── Check 4: cuotas pagadas + pendientes ↔ plazo original (si disponible) ──
  const cuotasPagadas = (r as unknown as { cuotasPagadas?: number }).cuotasPagadas;
  if (cuotasPagadas && r.cuotasPendientes) {
    const total = cuotasPagadas + r.cuotasPendientes;
    const estandares = [60, 84, 120, 144, 180, 240, 300, 324, 360];
    const cercano = estandares.find((s) => Math.abs(s - total) <= 2);
    if (!cercano) {
      pushH({
        codigo: "PLAZO_TOTAL_ATIPICO",
        severidad: "info",
        titulo: `El plazo total del crédito no es uno de los típicos (${total} meses)`,
        detalle: `Sumando las ${cuotasPagadas} cuotas ya pagadas más las ${r.cuotasPendientes} pendientes dan ${total} meses. Los créditos hipotecarios normalmente son a 5, 10, 15, 20, 25 o 30 años (60 a 360 meses).`,
        pista: "Pregúntele al cliente si en algún momento le reestructuraron el crédito. Si no, revise si la cantidad de cuotas pagadas o pendientes está leída correctamente del extracto.",
      });
    }
  }

  // ── Check 5: tasa fuera de rangos típicos ──
  if (r.tasaEa && (r.tasaEa < 1 || r.tasaEa > 25)) {
    pushH({
      codigo: "TASA_FUERA_RANGO",
      severidad: r.tasaEa < 0.5 || r.tasaEa > 30 ? "critica" : "warning",
      titulo: `Tasa de interés inusual: ${r.tasaEa}% EA`,
      detalle: isUvr
        ? "Los créditos UVR normalmente tienen tasa entre 3% y 8% EA. Esta tasa está fuera de ese rango."
        : "Los créditos hipotecarios en pesos normalmente tienen tasa entre 8% y 20% EA. Esta tasa está fuera de ese rango.",
      pista: "Revise el extracto: probablemente lo que leyó es una tasa nominal (mensual o anual) y no la tasa efectiva anual (EA). Asegúrese de tomar la tasa correcta.",
    });
  }

  // ── Check 6: cuota total cliente vs cuota teórica (caso sin override oficial) ──
  if (ext.cuota && ext.cuota > 0 && rec.cuotaTotalConSeguros > 0) {
    const diff = ext.cuota - rec.cuotaTotalConSeguros;
    const pct = Math.abs(diff) / ext.cuota;
    if (pct > 0.03) {
      pushH({
        codigo: "CUOTA_VS_TEORICA",
        severidad: pct > 0.15 ? "critica" : "warning",
        titulo: `La cuota del extracto difiere ${(pct * 100).toFixed(1)}% de lo que debería ser`,
        detalle: `El extracto cobra ${fmtCop(ext.cuota)}, pero según el saldo, la tasa y el plazo la cuota debería ser ${fmtCop(rec.cuotaTotalConSeguros)}. Diferencia: ${fmtCop(Math.abs(diff))}.`,
        pista: tieneFresh
          ? "Verifique si la cuota del extracto incluye cuota de manejo, comisiones u otros cobros. También confirme si el seguro y el beneficio FRECH/Fresh están bien registrados."
          : "Verifique si la cuota del extracto incluye cuota de manejo, comisiones u otros cobros. También confirme si el seguro, la tasa o el plazo están bien registrados.",
      });
    }
  }

  // ── Check 7: campos críticos faltantes ──
  if (!r.saldoCapital) pushH({ codigo: "FALTA_SALDO", severidad: "critica", titulo: "Falta el saldo del crédito", detalle: "Sin saber cuánto debe el cliente hoy, NUVIA no puede revisar nada.", pista: "Tome el saldo a capital del último extracto disponible y vuelva a auditar." });
  if (!r.tasaEa) pushH({ codigo: "FALTA_TASA", severidad: "critica", titulo: "Falta la tasa de interés", detalle: "Sin la tasa actual no se puede saber si la cuota está bien calculada.", pista: "Busque en el extracto la tasa efectiva anual (EA) vigente — no la del momento del desembolso." });
  if (!r.cuotasPendientes) pushH({ codigo: "FALTA_PLAZO", severidad: "critica", titulo: "Falta el plazo que queda", detalle: "Sin saber cuántas cuotas faltan, no se puede simular el crédito.", pista: "Revise la sección del extracto que dice 'cuotas pendientes' o 'plazo remanente'." });


  // ── Estado de fuentes ──
  const sevPeor = (a: VeredictoEstado, b: VeredictoEstado): VeredictoEstado => {
    const rank = { ok: 0, neutral: 0, warning: 1, error: 2 } as Record<VeredictoEstado, number>;
    return rank[a] >= rank[b] ? a : b;
  };
  const sevExtracto: VeredictoEstado = hallazgos.some((h) => h.severidad === "critica" && h.codigo !== "PLAZO_IMPLICITO_VS_REPORTADO")
    ? "error"
    : hallazgos.some((h) => h.severidad === "warning") || desfaseGrande
      ? "warning"
      : "ok";
  const extractoDet = hallazgos.length === 0
    ? (tieneFresh
      ? "Saldo, tasa, plazo, beneficio y cuota cuadran entre sí. El extracto está internamente sano."
      : "Saldo, tasa, plazo, seguros y cuota cuadran entre sí. El extracto está internamente sano.")
    : `NUVIA encontró ${hallazgos.length} dato(s) que no cuadran (ver lista abajo).`;

  const simDet = `Proyecta el crédito usando las ${plazoReportado ?? r.cuotasPendientes} cuotas que el extracto dice que faltan, respetando la cuota oficial. No inventa ni recorta plazos.`;

  let audEstado: VeredictoEstado;
  if (score.dictamen === "rechazado") audEstado = "error";
  else if (score.score >= 95) audEstado = "ok";
  else if (score.score >= 70) audEstado = "warning";
  else audEstado = "error";
  const audDet = `Calificación ${score.score.toFixed(1)} de 100 · ${dictamenLabel[score.dictamen]}. ${
    inconsistencias.length === 0
      ? "Todos los números coinciden dentro del margen permitido."
      : `Encontró ${inconsistencias.length} diferencia(s) frente a lo que debería ser.`
  }`;

  const filas: VeredictoFila[] = [
    { fuente: "extracto", estado: sevExtracto, titulo: "Extracto del banco", detalle: extractoDet },
    { fuente: "simulador", estado: "ok", titulo: "Simulador NUVIA", detalle: simDet },
    { fuente: "auditoria", estado: audEstado, titulo: "Auditoría NUVIA", detalle: audDet },
  ];
  if (hayExcel) {
    filas.splice(1, 0, {
      fuente: "excel",
      estado: "ok",
      titulo: "Excel del analista",
      detalle: desfaseGrande
        ? `Su Excel está bien calculado: si usa el saldo, la tasa y las ${plazoReportado} cuotas del extracto, la cuota le da correcta. El problema es que el banco está cobrando una cuota distinta a la que ese plazo necesita.`
        : "El Excel calcula la cuota correctamente con los datos del extracto.",
    });
  }

  // ── Causas probables (en lenguaje claro) ──
  const causas: string[] = [];
  if (desfaseGrande && desfasePlazo! < 0) {
    causas.push("Lo más probable: el banco calculó la cuota con el plazo ORIGINAL del crédito y no la actualizó cuando bajó el saldo. Por eso la cuota termina pagando antes de tiempo.");
    causas.push("También puede ser que el cliente esté pagando un poco más cada mes sin saberlo (por ejemplo, por seguros más altos o por un abono automático).");
    causas.push("Otra opción: hubo un cambio de tasa o una reliquidación previa y el banco no recalculó la cuota.");
  } else if (desfaseGrande && desfasePlazo! > 0) {
    causas.push("La cuota es demasiado baja para el plazo que dice el extracto. Si el cliente sigue pagando así, va a quedar debiendo dinero al final.");
    causas.push(tieneFresh
      ? "Es posible que el beneficio FRECH/Fresh o los seguros estén mal aplicados en la cuota."
      : "Es posible que los seguros, la tasa o la cantidad de cuotas estén mal registrados en el extracto.");
  }
  if (!frechConsistente) causas.push("El subsidio FRECH no está reflejado correctamente en la cuota que paga el cliente.");
  if (!saldoUvrConsistente) causas.push("El valor de la UVR que se usó para convertir el saldo no corresponde a la fecha del extracto.");

  // ── Recomendaciones (lenguaje sencillo, ajustadas al tipo de crédito) ──
  const recs: string[] = hallazgos.map((h) => h.pista);

  if (recs.length === 0) {
    recs.push("Todo cuadra: puede continuar tranquilo con la simulación y la propuesta al cliente.");
  } else {
    // 1) Abonos a capital — matiz UVR
    if (isUvr) {
      recs.push(
        "Primero, pregúntele al cliente: ¿ha hecho abonos extra a capital alguna vez? En créditos UVR los abonos bajan el saldo en UVR, pero muchas veces el banco no lo refleja a tiempo en el extracto y por eso aparecen desfases.",
      );
    } else {
      recs.push(
        "Primero, pregúntele al cliente: ¿ha hecho abonos extra a capital alguna vez? Muchas veces el banco recibe el abono pero no actualiza el saldo en el extracto, y eso explica casi todos los desfases.",
      );
    }

    // 2) Proyecciones oficiales — campos según tipo
    const campos = [
      "saldo actual a capital",
      "tasa vigente (EA)",
      "cuántas cuotas le faltan",
      "valor exacto de la cuota",
      "valor de los seguros",
      "cómo se compone la cuota (capital + interés + seguros)",
      ...(isUvr ? [
        "valor de la UVR del día del corte",
        "saldo del crédito expresado en UVR",
      ] : []),
      ...(tieneFresh ? [
        "valor mensual del beneficio Fresh / FRECH",
        "cuántas cuotas de cobertura le quedan",
        "si el beneficio se aplica como descuento en pesos o como rebaja en la tasa",
      ] : []),
    ];
    recs.push(
      `Después, pídale al cliente que solicite al banco las PROYECCIONES OFICIALES de su crédito. En ese documento debe quedar claro: ${campos.join(", ")}. Con eso NUVIA puede cerrar el dictamen final.`,
    );

    // 3) Re-ejecutar — matiz UVR/Fresh
    if (isUvr && tieneFresh) {
      recs.push("Cuando llegue la proyección, súbala al caso y vuelva a ejecutar la auditoría. NUVIA va a validar la UVR del corte, la aplicación del beneficio Fresh / FRECH y la cuota real cobrada para emitir el veredicto final.");
    } else if (isUvr) {
      recs.push("Cuando llegue la proyección, súbala al caso y vuelva a ejecutar la auditoría. NUVIA va a validar la UVR del corte y la cuota en UVR para emitir el veredicto final.");
    } else if (tieneFresh) {
      recs.push("Cuando llegue la proyección, súbala al caso y vuelva a ejecutar la auditoría. NUVIA va a validar cómo se aplica el beneficio Fresh / FRECH y cuántas cuotas de cobertura quedan, y le dará el veredicto final.");
    } else {
      recs.push("Cuando el cliente le entregue las proyecciones del banco, súbalas al caso y vuelva a ejecutar la auditoría. NUVIA va a comparar el extracto contra las proyecciones y le dará el veredicto final del crédito.");
    }

    // 4) Tips específicos del producto
    if (tieneFresh) {
      recs.push("Como este crédito tiene beneficio Fresh / FRECH, confirme con el banco cuántos meses de cobertura le quedan al cliente y qué pasa con la cuota el día que se acabe el beneficio — ahí es donde suelen aparecer los desajustes.");
    }
    if (isUvr) {
      recs.push("Como es un crédito en UVR, recuerde que el saldo en pesos puede subir aunque el cliente pague juiciosamente: lo que importa es que el saldo EN UVR baje cada mes. Verifíquelo en la proyección oficial.");
    }
  }

  // ── Titular y resumen (lenguaje claro) ──
  let titular: string;
  if (desfaseCritico) {
    titular = desfasePlazo! < 0
      ? `Cuidado: el extracto dice ${plazoReportado} cuotas, pero con la cuota actual el crédito se termina en ${plazoImplicito}. El cliente está pagando más de lo necesario.`
      : `Cuidado: la cuota actual no alcanza a pagar el crédito en las ${plazoReportado} cuotas que dice el extracto.`;
  } else if (sevExtracto === "error") {
    titular = `NUVIA encontró ${hallazgos.filter((h) => h.severidad === "critica").length} error(es) graves en el extracto que debe validar con el banco.`;
  } else if (sevExtracto === "warning") {
    titular = `NUVIA encontró ${hallazgos.length} dato(s) que no cuadran y que el analista debe revisar.`;
  } else if (audEstado !== "ok") {
    titular = `La auditoría encontró ${inconsistencias.length} diferencia(s) que vale la pena revisar antes de cerrar el caso.`;
  } else {
    titular = hayExcel
      ? "Todo coincide: el Excel, el simulador y el extracto dan los mismos números."
      : "El extracto está sano: todos los números coinciden entre sí.";
  }

  const resumen = desfaseGrande
    ? `El extracto dice que al cliente le quedan ${plazoReportado} cuotas, pero pagando la cuota actual el crédito se acabaría en ${plazoImplicito} cuotas. NUVIA respeta lo que dice el extracto en sus proyecciones, pero antes de avanzar conviene confirmar con el banco si la cuota está bien calculada o si hubo abonos no registrados.`
    : sevExtracto !== "ok"
      ? "El extracto tiene datos que no cuadran entre sí. Revise los hallazgos de abajo y siga las pistas — son cosas que el analista puede resolver hablando con el cliente o con el banco."
      : "Todos los números del extracto coinciden y la tasa, el saldo y el plazo están en rangos normales. Puede continuar con tranquilidad.";


  const extractoTieneErrores: Veredicto["extractoTieneErrores"] =
    hallazgos.some((h) => h.severidad === "critica") && !desfaseCritico ? "si"
      : (desfaseGrande || hallazgos.length > 0) ? "inconsistencia"
        : "no";

  return {
    titular,
    resumen,
    filas,
    extractoTieneErrores,
    causasProbables: causas.slice(0, 3),
    recomendaciones: dedupe(recs).slice(0, 8),
    hallazgos,
    plazoImplicito,
    plazoReportado,
    desfasePlazo,
  };

  function dedupe(arr: string[]) { return Array.from(new Set(arr)); }
  // sevPeor reservada para futuras combinaciones de fuentes
  void sevPeor;
}

// Etiquetas amigables
export const dictamenLabel: Record<Dictamen, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};
export const categoriaLabel: Record<Categoria, string> = {
  excelente: "EXCELENTE",
  aprobado: "APROBADO",
  revisar: "REVISAR",
  rechazado: "RECHAZADO",
};
