// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Motor de coherencia (semáforos)
// ─────────────────────────────────────────────────────────────

import {
  INCONSISTENCIA_CRITICA_PCT,
  TOL_CUOTA_PCT,
  TOL_SALDO_PCT,
  TOL_UVR_PCT,
} from "../tolerancias";
import type {
  CategoriaFinanciera,
  SeveridadValidacion,
  ValidacionCoherencia,
  VariableDetectada,
} from "./types";

function primerValor(vars: VariableDetectada[], cat: CategoriaFinanciera): number | null {
  const v = vars.find((x) => !x.excluida && x.categoria === cat && typeof x.valor === "number");
  return v ? (v.valor as number) : null;
}

function sumValores(vars: VariableDetectada[], cat: CategoriaFinanciera): number {
  return vars
    .filter((x) => !x.excluida && x.categoria === cat && typeof x.valor === "number")
    .reduce((acc, v) => acc + (v.valor as number), 0);
}

function severidadPorPct(pct: number, tol: number): SeveridadValidacion {
  const abs = Math.abs(pct);
  if (abs <= tol) return "VERDE";
  if (abs <= INCONSISTENCIA_CRITICA_PCT) return "AMARILLO";
  return "ROJO";
}

function pct(esperado: number, observado: number): number {
  if (!esperado) return 0;
  return (observado - esperado) / esperado;
}

export function evaluarCoherencia(variables: VariableDetectada[]): ValidacionCoherencia[] {
  const out: ValidacionCoherencia[] = [];

  // 1) Saldo UVR × Valor UVR ≈ Saldo Pesos
  const saldoUVR = primerValor(variables, "SALDO_UVR");
  const valorUVR = primerValor(variables, "VALOR_UVR");
  const saldoPesos = primerValor(variables, "SALDO_PESOS");
  if (saldoUVR && valorUVR && saldoPesos) {
    const esperado = saldoUVR * valorUVR;
    const diffAbs = saldoPesos - esperado;
    const diffPct = pct(esperado, saldoPesos);
    out.push({
      codigo: "UVR_PRODUCTO",
      titulo: "Saldo UVR × Valor UVR ≈ Saldo en pesos",
      severidad: severidadPorPct(diffPct, TOL_UVR_PCT),
      variables: ["SALDO_UVR", "VALOR_UVR", "SALDO_PESOS"],
      esperado,
      observado: saldoPesos,
      diferenciaAbs: diffAbs,
      diferenciaPct: diffPct,
      explicacion:
        "El saldo en UVR multiplicado por el valor de la UVR debe coincidir con el saldo reportado en pesos.",
      recomendacion: "Verifica la fecha de corte del valor UVR y el redondeo del banco.",
    });
  }

  // 2) Pagadas + Pendientes = Plazo aprobado
  const pagadas = primerValor(variables, "CUOTAS_PAGADAS");
  const pendientes = primerValor(variables, "CUOTAS_PENDIENTES");
  const plazoAp = primerValor(variables, "PLAZO_APROBADO");
  if (pagadas !== null && pendientes !== null && plazoAp !== null) {
    const observado = pagadas + pendientes;
    const diffAbs = observado - plazoAp;
    const diffPct = pct(plazoAp, observado);
    out.push({
      codigo: "PLAZO_SUMA",
      titulo: "Cuotas pagadas + pendientes = plazo aprobado",
      severidad: Math.abs(diffAbs) === 0 ? "VERDE" : Math.abs(diffAbs) <= 2 ? "AMARILLO" : "ROJO",
      variables: ["CUOTAS_PAGADAS", "CUOTAS_PENDIENTES", "PLAZO_APROBADO"],
      esperado: plazoAp,
      observado,
      diferenciaAbs: diffAbs,
      diferenciaPct: diffPct,
      explicacion: "La suma de cuotas pagadas y pendientes debe igualar al plazo aprobado.",
      recomendacion: "Confirma reestructuraciones o cambios de plazo.",
    });
  }

  // 3) TEM vs TEA
  const tea = primerValor(variables, "TEA");
  const tem = primerValor(variables, "TEM");
  if (tea !== null && tem !== null && tea > 0 && tem > 0) {
    const esperado = (Math.pow(1 + tea / 100, 1 / 12) - 1) * 100;
    const diffAbs = tem - esperado;
    const diffPct = pct(esperado, tem);
    out.push({
      codigo: "TEM_TEA",
      titulo: "TEM coherente con TEA",
      severidad: severidadPorPct(diffPct, TOL_CUOTA_PCT),
      variables: ["TEA", "TEM"],
      esperado,
      observado: tem,
      diferenciaAbs: diffAbs,
      diferenciaPct: diffPct,
      explicacion: "TEM = (1+TEA)^(1/12)−1.",
      recomendacion: "Si difieren, revisa periodicidad de composición.",
    });
  }

  // 4) Total facturado ≈ Cuota financiera + Seguros + Otros cargos
  const totalFact = primerValor(variables, "TOTAL_FACTURADO") ?? primerValor(variables, "TOTAL_A_PAGAR");
  const cuotaFin = primerValor(variables, "CUOTA_FINANCIERA");
  const seguros = sumValores(variables, "SEGURO");
  const otros = sumValores(variables, "OTROS_CARGOS") + sumValores(variables, "ADMINISTRACION");
  if (totalFact !== null && cuotaFin !== null) {
    const esperado = cuotaFin + seguros + otros;
    const diffAbs = totalFact - esperado;
    const diffPct = pct(esperado || 1, totalFact);
    out.push({
      codigo: "TOTAL_FACT_COMPONENTES",
      titulo: "Total facturado ≈ cuota financiera + seguros + otros",
      severidad: severidadPorPct(diffPct, TOL_CUOTA_PCT),
      variables: ["TOTAL_FACTURADO", "CUOTA_FINANCIERA", "SEGURO", "OTROS_CARGOS"],
      esperado,
      observado: totalFact,
      diferenciaAbs: diffAbs,
      diferenciaPct: diffPct,
      explicacion:
        "El total facturado debe descomponerse en cuota financiera + seguros + cargos administrativos.",
      recomendacion: "Verifica FRECH, mora o anticipos que no estén incluidos.",
    });
  }

  // 5) Sanidad: valores negativos y tasas imposibles
  for (const v of variables) {
    if (v.excluida || typeof v.valor !== "number") continue;
    if (v.valor < 0 && v.categoria !== "FRECH" && v.categoria !== "SUBSIDIO") {
      out.push({
        codigo: "VALOR_NEGATIVO",
        titulo: `Valor negativo en ${v.categoria}`,
        severidad: "ROJO",
        variables: [v.categoria],
        esperado: null,
        observado: v.valor,
        diferenciaAbs: null,
        diferenciaPct: null,
        explicacion: "Se detectó un valor negativo en una categoría que sólo admite positivos.",
        recomendacion: "Excluye el dato o corrígelo manualmente.",
      });
    }
    if ((v.categoria === "TEA" || v.categoria === "TEM") && (v.valor < 0 || v.valor > 100)) {
      out.push({
        codigo: "TASA_IMPOSIBLE",
        titulo: `Tasa fuera de rango (${v.categoria})`,
        severidad: "ROJO",
        variables: [v.categoria],
        esperado: null,
        observado: v.valor,
        diferenciaAbs: null,
        diferenciaPct: null,
        explicacion: "La tasa reportada está fuera del rango razonable (0–100 %).",
        recomendacion: "Confirma la unidad (EA vs mensual) y el separador decimal.",
      });
    }
  }

  // Referencia estática al umbral para uso futuro
  void TOL_SALDO_PCT;

  return out;
}
