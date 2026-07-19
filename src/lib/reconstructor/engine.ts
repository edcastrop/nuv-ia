// ─────────────────────────────────────────────────────────────
// Reconstructor Financiero NUVIA · Motor puro
//
// Sin efectos secundarios, sin persistencia, sin IA.
// Toda la lógica financiera vive aquí; la UI sólo captura y presenta.
//
// Reutiliza EXCLUSIVAMENTE `pmt` y `roundPlazoNuvex` de src/lib/finance.ts
// (contratos verificados: pmt recibe TEM decimal + cuotas + saldo, devuelve
// cuota positiva sin redondeo ni seguros; roundPlazoNuvex sólo produce el
// plazo operacional NUVEX de visualización).
// ─────────────────────────────────────────────────────────────

import { pmt, roundPlazoNuvex } from "@/lib/finance";
import { validateUVRCoherence } from "@/lib/uvrNumber";
import {
  BISECT_MAX_ITER,
  BISECT_RESIDUO_ABS,
  BISECT_RESIDUO_REL,
  CUOTA_MINIMA_ABS,
  TEM_MAX_DECIMAL,
  TEM_MAX_EXPANDIDA_DECIMAL,
  TEM_MIN_DECIMAL,
  TOL_CUOTA_PCT,
  TOL_SALDO_PCT,
} from "./tolerancias";
import type {
  Confianza,
  CuotaNormalizada,
  FuenteDato,
  PlazoTriple,
  RangoResultado,
  RangoValor,
  ReconstructorInput,
  ReconstructorOutput,
  Resultado,
  UvrDiagnostico,
} from "./types";
import { auditar } from "./audit";

// ─────────────────────────────────────────────────────────────
// Utilidades numéricas
// ─────────────────────────────────────────────────────────────

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);
const isPos = (v: unknown): v is number => isNum(v) && v > 0;
const nz = (v: number | undefined): number => (isNum(v) ? v : 0);

export function teaToTem(teaPorcentaje: number): number {
  const tea = teaPorcentaje / 100;
  if (!isNum(tea) || tea <= -1) return NaN;
  return Math.pow(1 + tea, 1 / 12) - 1;
}

export function temToTea(temDecimal: number): number {
  if (!isNum(temDecimal) || temDecimal <= -1) return NaN;
  return (Math.pow(1 + temDecimal, 12) - 1) * 100;
}

/**
 * Cuota financiera de un francés puro. Delegamos en `pmt` de finance.ts
 * cuyo contrato ya fue verificado (TEM decimal, saldo positivo, sin efectos).
 */
export function calcularCuotaFinanciera(
  saldo: number,
  temDecimal: number,
  cuotas: number,
): number {
  return pmt(temDecimal, cuotas, saldo);
}

/**
 * Saldo actual dado cuota financiera, TEM y cuotas pendientes.
 * Presente-value del francés.
 */
export function calcularSaldoDesdeCuota(
  cuotaFinanciera: number,
  temDecimal: number,
  cuotasPendientes: number,
): number {
  if (cuotasPendientes <= 0) return 0;
  if (temDecimal === 0) return cuotaFinanciera * cuotasPendientes;
  return (cuotaFinanciera * (1 - Math.pow(1 + temDecimal, -cuotasPendientes))) / temDecimal;
}

/**
 * Plazo matemático (posiblemente fraccional) requerido para amortizar
 * `saldo` con `cuotaFinanciera` a `temDecimal`. Devuelve motivo cuando
 * la cuota no cubre intereses o el sistema no tiene solución positiva.
 */
export function calcularPlazoDesdeCuota(
  saldo: number,
  cuotaFinanciera: number,
  temDecimal: number,
): { plazo: number; motivo?: string } {
  if (!isPos(saldo) || !isPos(cuotaFinanciera) || !isNum(temDecimal) || temDecimal < 0) {
    return { plazo: NaN, motivo: "Datos inválidos para calcular el plazo" };
  }
  if (temDecimal === 0) {
    return { plazo: saldo / cuotaFinanciera };
  }
  const interesInicial = saldo * temDecimal;
  if (cuotaFinanciera <= interesInicial + BISECT_RESIDUO_ABS) {
    return {
      plazo: NaN,
      motivo: "La cuota no cubre los intereses; el crédito no se amortiza.",
    };
  }
  const denom = Math.log(1 + temDecimal);
  const num = Math.log(1 - (saldo * temDecimal) / cuotaFinanciera);
  if (!isFinite(num)) {
    return { plazo: NaN, motivo: "No existe plazo finito para esta combinación." };
  }
  return { plazo: -num / denom };
}

export interface BisectionResult {
  ok: boolean;
  tem: number;
  iteraciones: number;
  residuo: number;
  motivo?: string;
}

/**
 * Bisección para hallar TEM dado saldo, cuota financiera y cuotas.
 *
 *   f(tem) = pmt(tem, cuotas, saldo) - cuotaFinanciera
 *
 * Reglas:
 *  1. Verifica existencia de raíz en [TEM_MIN, TEM_MAX] usando cambio de signo.
 *  2. Si no cambia de signo, expande UNA vez hasta TEM_MAX_EXPANDIDA.
 *  3. Nunca acepta una raíz sólo por alcanzar el máximo de iteraciones:
 *     exige residuo (absoluto O relativo) por debajo de los umbrales.
 *  4. Rechaza si la solución cae fuera de límites financieramente razonables.
 *  5. Devuelve NaN/NO ok cuando no converge; nunca Infinity ni NaN silencioso.
 */
export function bisectTem(
  saldo: number,
  cuotaFinanciera: number,
  cuotas: number,
): BisectionResult {
  if (!isPos(saldo) || !isPos(cuotaFinanciera) || !Number.isInteger(cuotas) || cuotas <= 0) {
    return { ok: false, tem: NaN, iteraciones: 0, residuo: NaN, motivo: "Entradas inválidas." };
  }
  if (cuotaFinanciera < CUOTA_MINIMA_ABS) {
    return { ok: false, tem: NaN, iteraciones: 0, residuo: NaN, motivo: "Cuota financiera insignificante." };
  }
  // Cota tasa-cero: pmt(0)=saldo/cuotas. Si cuota==saldo/cuotas → TEM=0.
  const cuotaCero = saldo / cuotas;
  if (Math.abs(cuotaFinanciera - cuotaCero) < BISECT_RESIDUO_ABS) {
    return { ok: true, tem: 0, iteraciones: 0, residuo: Math.abs(cuotaFinanciera - cuotaCero) };
  }
  if (cuotaFinanciera < cuotaCero) {
    return {
      ok: false,
      tem: NaN,
      iteraciones: 0,
      residuo: NaN,
      motivo: "La cuota es inferior a saldo/cuotas: no existe TEM ≥ 0 compatible.",
    };
  }
  const f = (t: number) => pmt(t, cuotas, saldo) - cuotaFinanciera;

  let lo = TEM_MIN_DECIMAL;
  let hi = TEM_MAX_DECIMAL;
  let flo = f(lo);
  let fhi = f(hi);

  if (flo * fhi > 0) {
    // Expansión controlada al límite superior superior.
    hi = TEM_MAX_EXPANDIDA_DECIMAL;
    fhi = f(hi);
    if (flo * fhi > 0) {
      return {
        ok: false,
        tem: NaN,
        iteraciones: 0,
        residuo: NaN,
        motivo: "TEM fuera del rango razonable (>10 % mensual) o cuota inconsistente.",
      };
    }
  }

  let mid = lo;
  let fmid = flo;
  let it = 0;
  for (; it < BISECT_MAX_ITER; it++) {
    mid = (lo + hi) / 2;
    fmid = f(mid);
    if (
      Math.abs(fmid) <= BISECT_RESIDUO_ABS ||
      Math.abs(fmid) / cuotaFinanciera <= BISECT_RESIDUO_REL ||
      (hi - lo) / 2 <= 1e-12
    ) {
      // Verificación final de razonabilidad.
      if (mid < TEM_MIN_DECIMAL || mid > TEM_MAX_EXPANDIDA_DECIMAL) {
        return {
          ok: false,
          tem: NaN,
          iteraciones: it + 1,
          residuo: Math.abs(fmid),
          motivo: "TEM resultante fuera del rango razonable.",
        };
      }
      return { ok: true, tem: mid, iteraciones: it + 1, residuo: Math.abs(fmid) };
    }
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return {
    ok: false,
    tem: NaN,
    iteraciones: it,
    residuo: Math.abs(fmid),
    motivo: "La bisección no convergió dentro de las iteraciones máximas.",
  };
}

// ─────────────────────────────────────────────────────────────
// Conversiones UVR ↔ Pesos (nunca se mezclan en una misma ecuación)
// ─────────────────────────────────────────────────────────────

export function pesosDesdeUVR(uvr: number, valorUVR: number): number {
  if (!isPos(uvr) || !isPos(valorUVR)) return NaN;
  return uvr * valorUVR;
}

export function uvrDesdePesos(pesos: number, valorUVR: number): number {
  if (!isPos(pesos) || !isPos(valorUVR)) return NaN;
  return pesos / valorUVR;
}

// ─────────────────────────────────────────────────────────────
// Normalización de cuota
// ─────────────────────────────────────────────────────────────

interface NormalizarOpts {
  usarSegurosCentral?: boolean;
  usarFrechCentral?: boolean;
  usarOtrosCentral?: boolean;
}

/**
 * Reconstruye la cuota financiera a partir de la cuota total y el desglose.
 *
 * Sin FRECH:
 *   cuotaFinanciera = cuotaTotal - seguros - otrosCargos - mora
 *                     - interesesMora - administracion
 *
 * Con FRECH descontado de la cuota facturada (subsidio positivo):
 *   cuotaFinanciera = cuotaTotal - seguros - otrosCargos - mora
 *                     - interesesMora - administracion + frech
 *
 * `opcionAdquisicion` NUNCA se resta (no es un cargo mensual ordinario).
 * `cargosDesconocidos` se resta pero se marca como alerta.
 */
export function normalizarCuota(
  input: ReconstructorInput,
  opts: NormalizarOpts = {},
): CuotaNormalizada {
  const alertas: string[] = [];
  const cuotaTotal = isPos(input.cuotaTotal) ? input.cuotaTotal : null;

  const { valor: seguros, fuente: fuenteSeguros } = pickValor(
    input.seguros,
    input.seguros_min,
    input.seguros_max,
    opts.usarSegurosCentral,
  );
  const { valor: frech, fuente: fuenteFrech } = pickValor(
    input.frech,
    input.frech_min,
    input.frech_max,
    opts.usarFrechCentral,
  );
  const { valor: otrosCargos, fuente: fuenteOtros } = pickValor(
    input.otrosCargos,
    input.otrosCargos_min,
    input.otrosCargos_max,
    opts.usarOtrosCentral,
  );

  const mora = nz(input.mora);
  const interesesMora = nz(input.interesesMora);
  const administracion = nz(input.administracion);
  const cargosDesconocidos = nz(input.cargosDesconocidos);
  const opcionAdquisicion = nz(input.opcionAdquisicion);

  if (cargosDesconocidos > 0) {
    alertas.push(
      "Existen cargos desconocidos dentro de la cuota total; el resultado es aproximado.",
    );
  }
  if (opcionAdquisicion > 0) {
    alertas.push(
      "La opción de adquisición se excluye del cálculo mensual (no es cargo ordinario).",
    );
  }

  let cuotaFinancieraCalculada: number | null = null;
  if (cuotaTotal !== null) {
    cuotaFinancieraCalculada =
      cuotaTotal - seguros - otrosCargos - mora - interesesMora - administracion - cargosDesconocidos + frech;
  }

  const cuotaFinancieraReportada = isPos(input.cuotaFinancieraReportada)
    ? input.cuotaFinancieraReportada
    : null;

  let diferenciaAbs: number | null = null;
  let diferenciaPct: number | null = null;
  if (cuotaFinancieraCalculada !== null && cuotaFinancieraReportada !== null) {
    diferenciaAbs = cuotaFinancieraCalculada - cuotaFinancieraReportada;
    diferenciaPct = diferenciaAbs / cuotaFinancieraReportada;
    if (Math.abs(diferenciaPct) > TOL_CUOTA_PCT) {
      alertas.push(
        "La cuota financiera reconstruida difiere de la reportada más allá de la tolerancia.",
      );
    }
  }

  return {
    cuotaFinancieraCalculada,
    cuotaFinancieraReportada,
    diferenciaAbs,
    diferenciaPct,
    desglose: {
      cuotaTotal,
      seguros,
      frech,
      otrosCargos,
      mora,
      interesesMora,
      administracion,
      cargosDesconocidos,
      opcionAdquisicionExcluida: opcionAdquisicion,
    },
    alertas,
    fuenteSeguros,
    fuenteFrech,
    fuenteOtros,
  };
}

function pickValor(
  valor: number | undefined,
  min: number | undefined,
  max: number | undefined,
  usarCentral?: boolean,
): { valor: number; fuente: FuenteDato } {
  if (isNum(valor) && valor >= 0) return { valor, fuente: "REPORTADO" };
  if (isNum(min) && isNum(max) && min >= 0 && max >= min) {
    if (usarCentral) return { valor: (min + max) / 2, fuente: "SUPUESTO" };
    return { valor: min, fuente: "SUPUESTO" };
  }
  return { valor: 0, fuente: "AUSENTE" };
}

// ─────────────────────────────────────────────────────────────
// Reconstrucción principal
// ─────────────────────────────────────────────────────────────

export function reconstruir(input: ReconstructorInput): ReconstructorOutput {
  const moneda = input.moneda;
  const tipoCredito: "HIPOTECARIO" | "LEASING" = input.tipoCredito ?? "HIPOTECARIO";

  const datosUsados: string[] = [];
  const datosFaltantes: string[] = [];

  // 1) Normalización de cuota (rama central: mínimos como suposición)
  const cuotaNorm = normalizarCuota(input);
  if (cuotaNorm.cuotaFinancieraCalculada !== null) datosUsados.push("cuotaTotal");
  if (cuotaNorm.cuotaFinancieraReportada !== null) datosUsados.push("cuotaFinancieraReportada");

  const cuotaParaMotor =
    cuotaNorm.cuotaFinancieraReportada ?? cuotaNorm.cuotaFinancieraCalculada;

  // 2) Diagnóstico UVR (nunca sobrescribe)
  let uvr: UvrDiagnostico | null = null;
  let saldoPesos: number | null = null;

  if (moneda === "UVR") {
    if (isPos(input.saldoCapitalUVR)) datosUsados.push("saldoCapitalUVR");
    else datosFaltantes.push("saldoCapitalUVR");
    if (isPos(input.valorUVR)) datosUsados.push("valorUVR");
    else datosFaltantes.push("valorUVR");
    if (isPos(input.saldoCapitalPesos)) datosUsados.push("saldoCapitalPesos");

    const coh = validateUVRCoherence(
      input.saldoCapitalUVR ?? null,
      input.valorUVR ?? null,
      input.saldoCapitalPesos ?? null,
    );
    uvr = {
      valorReportado: isPos(input.valorUVR) ? input.valorUVR : null,
      saldoUvrReportado: isPos(input.saldoCapitalUVR) ? input.saldoCapitalUVR : null,
      saldoPesosReportado: isPos(input.saldoCapitalPesos) ? input.saldoCapitalPesos : null,
      productoReconstruido: coh.ejecutable ? coh.productoPesos! : null,
      diferenciaAbs:
        coh.ejecutable && isPos(coh.productoPesos) && isPos(coh.saldoPesos)
          ? coh.productoPesos! - coh.saldoPesos!
          : null,
      diferenciaPct: coh.ejecutable ? coh.diffPct! : null,
      coherente: coh.ejecutable && coh.isCoherent,
      motivo: coh.motivo ?? (coh.isCoherent ? "Producto UVR coherente con el saldo en pesos." : "Producto UVR fuera de tolerancia."),
    };
    // El motor UVR trabaja en UVR — nunca mezcla saldoPesos.
    saldoPesos = isPos(input.saldoCapitalPesos) ? input.saldoCapitalPesos : null;
  } else {
    if (isPos(input.saldoCapitalPesos)) datosUsados.push("saldoCapitalPesos");
    else datosFaltantes.push("saldoCapitalPesos");
    saldoPesos = isPos(input.saldoCapitalPesos) ? input.saldoCapitalPesos : null;
  }

  // Saldo que alimentará el motor (en la unidad correcta):
  const saldoMotor = moneda === "UVR" ? (input.saldoCapitalUVR ?? null) : saldoPesos;

  // Cuota que alimentará el motor: para UVR debe estar en UVR — sólo si el
  // caller entregó cuotaFinanciera en UVR (aquí no la mezclamos con pesos).
  // Para simplificar la primera entrega: en UVR se reconstruye contra la
  // cuota financiera EN UVR si viene reportada; si sólo hay cuota en pesos,
  // se marca como no determinable en UVR.
  let cuotaMotor: number | null = cuotaParaMotor;
  const cuotaMotorAlertas: string[] = [];
  if (moneda === "UVR") {
    if (isPos(cuotaParaMotor) && isPos(input.valorUVR)) {
      // Convertimos la cuota financiera en pesos a UVR (no es mezcla en la
      // ecuación: convertimos ANTES de la ecuación).
      cuotaMotor = cuotaParaMotor / input.valorUVR!;
      cuotaMotorAlertas.push(
        "Cuota UVR derivada dividiendo la cuota financiera en pesos por el valor UVR reportado.",
      );
    } else {
      cuotaMotor = null;
    }
  }

  // 3) Determinar TEM/TEA
  let tem: Resultado = resultadoVacio("TEM (mensual, decimal)");
  let tea: Resultado = resultadoVacio("TEA (%)");

  if (isPos(input.tem)) {
    const t = input.tem! / 100;
    tem = ok(t, "TEM reportada", ["tem"], "TEM ingresada por el usuario", "EXACTO", "ALTA");
    tea = ok(temToTea(t), "TEA derivada de TEM", ["tem"], "TEA = (1+TEM)^12 − 1", "EXACTO", "ALTA");
  } else if (isPos(input.tea)) {
    const t = teaToTem(input.tea!);
    tem = ok(t, "TEM derivada de TEA", ["tea"], "TEM = (1+TEA)^(1/12) − 1", "EXACTO", "ALTA");
    tea = ok(input.tea!, "TEA reportada", ["tea"], "TEA ingresada por el usuario", "EXACTO", "ALTA");
  } else if (
    isPos(saldoMotor) &&
    isPos(cuotaMotor) &&
    Number.isInteger(input.cuotasPendientes) &&
    (input.cuotasPendientes ?? 0) > 0
  ) {
    const b = bisectTem(saldoMotor, cuotaMotor, input.cuotasPendientes!);
    if (b.ok) {
      tem = ok(
        b.tem,
        `TEM hallada por bisección (${b.iteraciones} iter., residuo=${b.residuo.toFixed(4)}).`,
        ["saldoCapital", "cuotaFinanciera", "cuotasPendientes"],
        "pmt(TEM, cuotas, saldo) = cuota financiera",
        "EXACTO",
        "ALTA",
      );
      tea = ok(temToTea(b.tem), "TEA derivada de TEM reconstruida", ["saldoCapital", "cuotaFinanciera", "cuotasPendientes"], "TEA = (1+TEM)^12 − 1", "EXACTO", "ALTA");
    } else {
      tem = noDeterminable("TEM (mensual, decimal)", b.motivo ?? "Bisección no convergió.");
      tea = noDeterminable("TEA (%)", b.motivo ?? "Bisección no convergió.");
      datosFaltantes.push("tasa (no se pudo reconstruir)");
    }
  } else {
    datosFaltantes.push("tasa (TEA o TEM)");
  }

  // 4) Saldo reconstruido (si tenemos cuota, TEM y cuotas pendientes)
  let saldoReconstruido: Resultado = resultadoVacio("Saldo reconstruido");
  if (
    isPos(cuotaMotor) &&
    tem.valor !== null &&
    isPos(tem.valor) &&
    Number.isInteger(input.cuotasPendientes) &&
    (input.cuotasPendientes ?? 0) > 0
  ) {
    const s = calcularSaldoDesdeCuota(cuotaMotor, tem.valor, input.cuotasPendientes!);
    saldoReconstruido = ok(
      s,
      "Saldo presente del francés",
      ["cuotaFinanciera", "tem", "cuotasPendientes"],
      "VP = cuota × (1 − (1+TEM)^(−n)) / TEM",
      "EXACTO",
      tem.confianza,
    );
  } else if (
    isPos(cuotaMotor) &&
    tem.valor === 0 &&
    Number.isInteger(input.cuotasPendientes) &&
    (input.cuotasPendientes ?? 0) > 0
  ) {
    const s = cuotaMotor * input.cuotasPendientes!;
    saldoReconstruido = ok(s, "Saldo tasa-cero", ["cuotaFinanciera", "cuotasPendientes"], "VP = cuota × n", "EXACTO", "ALTA");
  }

  // Diferencia saldo reportado vs reconstruido (comparación siempre en la
  // unidad del motor).
  const saldoReportadoUnidad = moneda === "UVR" ? (input.saldoCapitalUVR ?? null) : saldoPesos;
  let diferenciaSaldoAbs: number | null = null;
  let diferenciaSaldoPct: number | null = null;
  if (saldoReconstruido.valor !== null && isPos(saldoReportadoUnidad)) {
    diferenciaSaldoAbs = saldoReconstruido.valor - saldoReportadoUnidad!;
    diferenciaSaldoPct = diferenciaSaldoAbs / saldoReportadoUnidad!;
  }

  // 5) Plazo (triple)
  const plazo: PlazoTriple = calcularPlazoTriple(saldoMotor, cuotaMotor, tem.valor);

  // 6) Rangos operativos
  const rangos: RangoResultado[] = [];
  agregaRango(rangos, "seguros", input.seguros_min, input.seguros_max, [
    "El valor central es el promedio simple; no debe usarse como exacto.",
  ]);
  agregaRango(rangos, "frech", input.frech_min, input.frech_max, [
    "FRECH se aplica como subsidio; puede variar por bloque.",
  ]);
  agregaRango(rangos, "otrosCargos", input.otrosCargos_min, input.otrosCargos_max, [
    "Otros cargos incluyen conceptos variables del banco.",
  ]);

  // Rango de cuota financiera: derivado del cruce min/max de seguros+otros−frech.
  const rangoCuota = deriveRangoCuota(input, cuotaNorm.desglose);
  if (rangoCuota) rangos.push(rangoCuota);

  // 7) Datos faltantes explícitos
  if (!isPos(input.cuotaTotal) && !isPos(input.cuotaFinancieraReportada))
    datosFaltantes.push("cuotaTotal o cuotaFinancieraReportada");
  if (!Number.isInteger(input.cuotasPendientes) || (input.cuotasPendientes ?? 0) <= 0)
    datosFaltantes.push("cuotasPendientes");

  // 8) Auditoría determinista
  const auditoria = auditar({
    moneda,
    tipoCredito,
    cuotaNorm,
    tem,
    saldoReconstruido,
    diferenciaSaldoPct,
    diferenciaCuotaPct: cuotaNorm.diferenciaPct,
    uvr,
    datosFaltantes,
    plazoReportado: input.plazoReportado ?? null,
    plazoMatematico: plazo.matematico.valor,
    abonoExtraordinario: !!input.abonoExtraordinarioReciente,
  });

  const clasificacionGlobal = deriveClasificacionGlobal(tem, saldoReconstruido, plazo, rangos, datosFaltantes);
  const confianzaGlobal = deriveConfianzaGlobal(auditoria.diagnostico, clasificacionGlobal, rangos);

  // Alertas extra en cuota
  if (cuotaMotorAlertas.length) cuotaNorm.alertas.push(...cuotaMotorAlertas);

  return {
    moneda,
    tipoCredito,
    cuotaNormalizada: cuotaNorm,
    tea,
    tem,
    plazo,
    saldoReconstruido,
    saldoReportado: saldoReportadoUnidad,
    diferenciaSaldoAbs,
    diferenciaSaldoPct,
    uvr,
    rangos,
    auditoria,
    clasificacionGlobal,
    confianzaGlobal,
    datosFaltantes,
    datosUsados,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers de resultado
// ─────────────────────────────────────────────────────────────

function resultadoVacio(nombre: string): Resultado {
  return {
    clasificacion: "NO_DETERMINABLE",
    confianza: "NULA",
    valor: null,
    rango: null,
    motivos: [`${nombre}: sin datos suficientes.`],
    datosUsados: [],
    datosFaltantes: [nombre],
    formula: "",
    alertas: [],
  };
}

function ok(
  valor: number,
  motivo: string,
  datosUsados: string[],
  formula: string,
  clasificacion: "EXACTO" | "ESTIMADO",
  confianza: Confianza,
): Resultado {
  return {
    clasificacion,
    confianza,
    valor,
    rango: null,
    motivos: [motivo],
    datosUsados,
    datosFaltantes: [],
    formula,
    alertas: [],
  };
}

function noDeterminable(nombre: string, motivo: string): Resultado {
  return {
    clasificacion: "NO_DETERMINABLE",
    confianza: "NULA",
    valor: null,
    rango: null,
    motivos: [motivo],
    datosUsados: [],
    datosFaltantes: [nombre],
    formula: "",
    alertas: [motivo],
  };
}

function agregaRango(
  arr: RangoResultado[],
  variable: string,
  min: number | undefined,
  max: number | undefined,
  supuestos: string[],
): void {
  if (isNum(min) && isNum(max) && max > min) {
    arr.push({
      minimo: min,
      maximo: max,
      central: (min + max) / 2,
      variable,
      supuestos,
      clasificacion: "ESTIMADO",
      confianza: "MEDIA",
    });
  }
}

function deriveRangoCuota(
  input: ReconstructorInput,
  desglose: CuotaNormalizada["desglose"],
): RangoResultado | null {
  const base = desglose.cuotaTotal;
  if (!isPos(base)) return null;
  const anyRange =
    (isNum(input.seguros_min) && isNum(input.seguros_max)) ||
    (isNum(input.frech_min) && isNum(input.frech_max)) ||
    (isNum(input.otrosCargos_min) && isNum(input.otrosCargos_max));
  if (!anyRange) return null;
  const seguros_min = nz(input.seguros_min ?? desglose.seguros);
  const seguros_max = nz(input.seguros_max ?? desglose.seguros);
  const frech_min = nz(input.frech_min ?? desglose.frech);
  const frech_max = nz(input.frech_max ?? desglose.frech);
  const otros_min = nz(input.otrosCargos_min ?? desglose.otrosCargos);
  const otros_max = nz(input.otrosCargos_max ?? desglose.otrosCargos);
  const fijos =
    desglose.mora + desglose.interesesMora + desglose.administracion + desglose.cargosDesconocidos;

  const cuotaMax = base - seguros_min - otros_min - fijos + frech_max;
  const cuotaMin = base - seguros_max - otros_max - fijos + frech_min;
  if (!(cuotaMax > cuotaMin)) return null;
  return {
    minimo: cuotaMin,
    maximo: cuotaMax,
    central: (cuotaMin + cuotaMax) / 2,
    variable: "cuotaFinanciera",
    supuestos: [
      "Rango derivado de la combinación mínima y máxima de seguros, FRECH y otros cargos.",
      "El valor central es referencial; no debe presentarse como exacto.",
    ],
    clasificacion: "ESTIMADO",
    confianza: "MEDIA",
  };
}

function calcularPlazoTriple(
  saldo: number | null,
  cuota: number | null,
  tem: number | null,
): PlazoTriple {
  if (!isPos(saldo) || !isPos(cuota) || tem === null) {
    return {
      matematico: resultadoVacio("plazo matemático"),
      matematicoRedondeado: resultadoVacio("plazo matemático redondeado"),
      operacionalNuvex: resultadoVacio("plazo operacional NUVEX"),
    };
  }
  const r = calcularPlazoDesdeCuota(saldo!, cuota!, tem!);
  if (!isFinite(r.plazo)) {
    return {
      matematico: noDeterminable("plazo matemático", r.motivo ?? "No hay solución."),
      matematicoRedondeado: noDeterminable("plazo matemático redondeado", r.motivo ?? "No hay solución."),
      operacionalNuvex: noDeterminable("plazo operacional NUVEX", r.motivo ?? "No hay solución."),
    };
  }
  const mat = ok(r.plazo, "Plazo matemático exacto", ["saldo", "cuota", "tem"], "n = −ln(1 − S·i/C) / ln(1+i)", "EXACTO", "ALTA");
  const red = ok(Math.round(r.plazo), "Redondeo aritmético", ["plazo matemático"], "round(n)", "EXACTO", "ALTA");
  const nuvex = ok(
    roundPlazoNuvex(r.plazo),
    "Plazo operacional NUVEX (solo visualización; no altera cálculos)",
    ["plazo matemático"],
    "roundPlazoNuvex(n)",
    "ESTIMADO",
    "MEDIA",
  );
  return { matematico: mat, matematicoRedondeado: red, operacionalNuvex: nuvex };
}

function deriveClasificacionGlobal(
  tem: Resultado,
  saldo: Resultado,
  plazo: PlazoTriple,
  rangos: RangoResultado[],
  datosFaltantes: string[],
): ReconstructorOutput["clasificacionGlobal"] {
  if (tem.clasificacion === "NO_DETERMINABLE" && saldo.clasificacion === "NO_DETERMINABLE")
    return "NO_DETERMINABLE";
  if (datosFaltantes.length >= 3) return "NO_DETERMINABLE";
  if (rangos.length > 0) return "RANGO";
  if (
    tem.clasificacion === "EXACTO" &&
    saldo.clasificacion === "EXACTO" &&
    plazo.matematico.clasificacion === "EXACTO"
  )
    return "EXACTO";
  return "ESTIMADO";
}

function deriveConfianzaGlobal(
  diagnostico: string,
  clasificacion: ReconstructorOutput["clasificacionGlobal"],
  rangos: RangoResultado[],
): Confianza {
  if (clasificacion === "NO_DETERMINABLE") return "NULA";
  if (diagnostico === "INCONSISTENCIA_CRITICA") return "BAJA";
  if (rangos.length > 0) return "MEDIA";
  if (diagnostico === "CREDITO_COHERENTE" && clasificacion === "EXACTO") return "ALTA";
  if (diagnostico === "COHERENTE_CON_OBSERVACIONES") return "MEDIA";
  return "MEDIA";
}

// Re-exports para tests
export type { RangoValor };
