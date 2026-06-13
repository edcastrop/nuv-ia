// NUVIA Financial QA AI — Motor matemático determinístico
// 100% TypeScript puro · sin dependencias externas · testeable

export const QA_MOTOR_VERSION = "1.2.0";
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
  return { motorVersion: QA_MOTOR_VERSION, reconstruccion: rec, inconsistencias: incs, score, faltantes };
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
