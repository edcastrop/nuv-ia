// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Reconstrucción encadenada
//
// Orquesta la reconstrucción de variables usando el motor Fase 1
// (importado sin modificar) más el motor de hipótesis. Registra
// trazabilidad completa de qué variables se infirieron.
// ─────────────────────────────────────────────────────────────

import {
  calcularCuotaFinanciera,
  calcularPlazoDesdeCuota,
  calcularSaldoDesdeCuota,
  pesosDesdeUVR,
  teaToTem,
  temToTea,
  uvrDesdePesos,
} from "../engine";
import type {
  CategoriaFinanciera,
  EvidenciaVariable,
  HipotesisReconstruccion,
  VariableDetectada,
} from "./types";
import { generarHipotesisTEA } from "./hipotesis";

function firstVal(
  vars: VariableDetectada[],
  cat: CategoriaFinanciera,
): number | null {
  const v = vars.find((x) => !x.excluida && x.categoria === cat && typeof x.valor === "number");
  return v ? (v.valor as number) : null;
}

function ev(
  cat: CategoriaFinanciera,
  valor: number,
  unidad: EvidenciaVariable["unidad"],
  formula: string,
  datos: CategoriaFinanciera[],
  inferidas: CategoriaFinanciera[] = [],
  supuestos: string[] = [],
): EvidenciaVariable {
  return {
    categoria: cat,
    estado: inferidas.length ? "INFERIDA" : "CALCULADA",
    valor,
    unidad,
    confianzaMatematica: "ALTA",
    formula,
    datosUsados: datos,
    variablesInferidas: inferidas,
    supuestos,
    residuoAbs: null,
    residuoPct: null,
    advertencias: [],
  };
}

export interface ReconstruccionResult {
  evidencias: EvidenciaVariable[];
  hipotesis: HipotesisReconstruccion[];
}

export function reconstruirCadena(
  variables: VariableDetectada[],
): ReconstruccionResult {
  const evidencias: EvidenciaVariable[] = [];
  const trazadas = new Set<CategoriaFinanciera>();

  // Snapshot mutable de variables enriquecido con reconstrucciones
  const vars: VariableDetectada[] = variables.map((v) => ({ ...v }));
  const anadir = (e: EvidenciaVariable) => {
    if (e.valor === null || !Number.isFinite(e.valor)) return;
    if (trazadas.has(e.categoria)) return;
    evidencias.push(e);
    trazadas.add(e.categoria);
    vars.push({
      id: `RECON:${e.categoria}`,
      categoria: e.categoria,
      etiquetaOriginal: e.categoria,
      valor: e.valor,
      unidad: e.unidad,
      paginaOrigen: null,
      fuente: e.variablesInferidas.length ? "INFERIDA" : "CALCULADA",
      confianzaExtraccion: "NULA",
      confianzaClasificacion: "ALTA",
      excluida: false,
      notas: [],
    });
  };

  // Iteración controlada: hasta 4 pasadas
  for (let i = 0; i < 4; i++) {
    const antes = trazadas.size;

    // 1) Plazo aprobado = pagadas + pendientes
    if (!firstVal(vars, "PLAZO_APROBADO")) {
      const p = firstVal(vars, "CUOTAS_PAGADAS");
      const q = firstVal(vars, "CUOTAS_PENDIENTES");
      if (p !== null && q !== null) {
        anadir(
          ev(
            "PLAZO_APROBADO",
            p + q,
            "CUOTAS",
            "PLAZO_APROBADO = CUOTAS_PAGADAS + CUOTAS_PENDIENTES",
            ["CUOTAS_PAGADAS", "CUOTAS_PENDIENTES"],
          ),
        );
      }
    }

    // 2) SALDO_PESOS desde SALDO_UVR × VALOR_UVR
    if (!firstVal(vars, "SALDO_PESOS")) {
      const su = firstVal(vars, "SALDO_UVR");
      const vu = firstVal(vars, "VALOR_UVR");
      if (su && vu) {
        anadir(
          ev(
            "SALDO_PESOS",
            pesosDesdeUVR(su, vu),
            "PESOS",
            "SALDO_PESOS = SALDO_UVR × VALOR_UVR",
            ["SALDO_UVR", "VALOR_UVR"],
            ["SALDO_PESOS"],
          ),
        );
      }
    }

    // 3) SALDO_UVR desde SALDO_PESOS ÷ VALOR_UVR
    if (!firstVal(vars, "SALDO_UVR")) {
      const sp = firstVal(vars, "SALDO_PESOS");
      const vu = firstVal(vars, "VALOR_UVR");
      if (sp && vu) {
        anadir(
          ev(
            "SALDO_UVR",
            uvrDesdePesos(sp, vu),
            "UVR",
            "SALDO_UVR = SALDO_PESOS ÷ VALOR_UVR",
            ["SALDO_PESOS", "VALOR_UVR"],
            ["SALDO_UVR"],
          ),
        );
      }
    }

    // 4) TEM ↔ TEA
    if (!firstVal(vars, "TEM")) {
      const tea = firstVal(vars, "TEA");
      if (tea !== null && tea > 0) {
        anadir(
          ev(
            "TEM",
            teaToTem(tea) * 100,
            "PORCENTAJE",
            "TEM = ((1+TEA)^(1/12) − 1)",
            ["TEA"],
          ),
        );
      }
    }
    if (!firstVal(vars, "TEA")) {
      const tem = firstVal(vars, "TEM");
      if (tem !== null && tem > 0) {
        anadir(
          ev(
            "TEA",
            temToTea(tem / 100),
            "PORCENTAJE",
            "TEA = (1+TEM)^12 − 1",
            ["TEM"],
          ),
        );
      }
    }

    // 5) CUOTA_FINANCIERA con saldo, TEA, plazo restante
    if (!firstVal(vars, "CUOTA_FINANCIERA")) {
      const s = firstVal(vars, "SALDO_PESOS");
      const t = firstVal(vars, "TEA");
      const n = firstVal(vars, "PLAZO_RESTANTE");
      if (s && t !== null && n && n > 0) {
        anadir(
          ev(
            "CUOTA_FINANCIERA",
            calcularCuotaFinanciera(s, teaToTem(t), n),
            "PESOS",
            "PMT(TEM, n, saldo)",
            ["SALDO_PESOS", "TEA", "PLAZO_RESTANTE"],
          ),
        );
      }
    }

    // 6) SALDO desde cuota, TEA, plazo restante (si falta)
    if (!firstVal(vars, "SALDO_PESOS")) {
      const c = firstVal(vars, "CUOTA_FINANCIERA");
      const t = firstVal(vars, "TEA");
      const n = firstVal(vars, "PLAZO_RESTANTE");
      if (c && t !== null && n && n > 0) {
        anadir(
          ev(
            "SALDO_PESOS",
            calcularSaldoDesdeCuota(c, teaToTem(t), n),
            "PESOS",
            "PV(TEM, n, cuota)",
            ["CUOTA_FINANCIERA", "TEA", "PLAZO_RESTANTE"],
          ),
        );
      }
    }

    // 7) PLAZO_RESTANTE despeje
    if (!firstVal(vars, "PLAZO_RESTANTE")) {
      const s = firstVal(vars, "SALDO_PESOS");
      const c = firstVal(vars, "CUOTA_FINANCIERA");
      const t = firstVal(vars, "TEA");
      if (s && c && t !== null && t >= 0) {
        const res = calcularPlazoDesdeCuota(s, c, teaToTem(t));
        if (Number.isFinite(res.plazo)) {
          anadir(
            ev("PLAZO_RESTANTE", res.plazo, "CUOTAS", "n = log(c/(c−iS))/log(1+i)", [
              "SALDO_PESOS",
              "CUOTA_FINANCIERA",
              "TEA",
            ]),
          );
        }
      }
    }

    if (trazadas.size === antes) break;
  }

  // 8) Hipótesis de TEA a partir de la composición de cuota (si no hay TEA)
  const hipotesis: HipotesisReconstruccion[] = [];
  if (!firstVal(vars, "TEA")) {
    const saldo = firstVal(vars, "SALDO_PESOS");
    const n = firstVal(vars, "PLAZO_RESTANTE");
    if (saldo && n && n > 0) {
      const hs = generarHipotesisTEA(vars, { saldo, plazoRestante: n, moneda: "PESOS" });
      hipotesis.push(...hs);
      const seleccionada = hs.find((h) => h.seleccionada && h.resultado);
      if (seleccionada && seleccionada.resultado) {
        anadir({
          ...seleccionada.resultado,
          variablesInferidas: ["CUOTA_FINANCIERA"],
        });
      }
    }
  }

  return { evidencias, hipotesis };
}
