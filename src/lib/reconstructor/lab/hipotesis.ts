// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Motor de hipótesis (composición de cuota)
//
// Genera hipótesis explícitas sobre qué componente reportado por el
// extracto representa la CUOTA FINANCIERA (base de la ecuación de
// amortización). Ejecuta la bisección con cada hipótesis y las
// clasifica por error. NUNCA elige silenciosamente si dos hipótesis
// caen dentro de la misma tolerancia — devuelve AMBIGUA.
// ─────────────────────────────────────────────────────────────

import { bisectTem, temToTea } from "../engine";
import { TOL_CUOTA_PCT } from "../tolerancias";
import type {
  CategoriaFinanciera,
  EvidenciaVariable,
  HipotesisReconstruccion,
  VariableDetectada,
} from "./types";

interface Contexto {
  saldo: number;
  plazoRestante: number;
  moneda: "PESOS" | "UVR";
}

function firstVal(
  vars: VariableDetectada[],
  cat: CategoriaFinanciera,
): number | null {
  const v = vars.find((x) => !x.excluida && x.categoria === cat && typeof x.valor === "number");
  return v ? (v.valor as number) : null;
}

interface CandidataCuota {
  id: string;
  descripcion: string;
  composicion: string[];
  cuota: number;
}

function candidatasCuota(vars: VariableDetectada[]): CandidataCuota[] {
  const cf = firstVal(vars, "CUOTA_FINANCIERA");
  const total = firstVal(vars, "TOTAL_A_PAGAR");
  const tot2 = firstVal(vars, "TOTAL_FACTURADO");
  const subt = firstVal(vars, "SUBTOTAL_CUOTA");
  const cap = firstVal(vars, "CAPITAL");
  const intr = firstVal(vars, "INTERES");
  const seguros = vars
    .filter((v) => !v.excluida && v.categoria === "SEGURO" && typeof v.valor === "number")
    .reduce((a, v) => a + (v.valor as number), 0);
  const otros =
    (firstVal(vars, "OTROS_CARGOS") ?? 0) + (firstVal(vars, "ADMINISTRACION") ?? 0);
  const anticipo = firstVal(vars, "ANTICIPO") ?? 0;

  const out: CandidataCuota[] = [];
  if (cf !== null && cf > 0) {
    out.push({
      id: "CUOTA_FINANCIERA_REPORTADA",
      descripcion: "Cuota financiera reportada directamente por el extracto.",
      composicion: ["CUOTA_FINANCIERA"],
      cuota: cf,
    });
  }
  if (cap !== null && intr !== null && cap + intr > 0) {
    out.push({
      id: "CAPITAL_MAS_INTERES",
      descripcion: "Capital + intereses del periodo.",
      composicion: ["CAPITAL", "INTERES"],
      cuota: cap + intr,
    });
  }
  if (subt !== null && subt > 0) {
    out.push({
      id: "SUBTOTAL_CUOTA",
      descripcion: "Subtotal cuota (FNA): abono a capital + intereses.",
      composicion: ["SUBTOTAL_CUOTA"],
      cuota: subt,
    });
  }
  if (total !== null && total > 0) {
    const cuota = total - seguros - otros - anticipo;
    if (cuota > 0) {
      out.push({
        id: "TOTAL_MENOS_ACCESORIOS",
        descripcion: "Total a pagar menos seguros, cargos y anticipos.",
        composicion: ["TOTAL_A_PAGAR", "-SEGURO", "-OTROS_CARGOS", "-ANTICIPO"],
        cuota,
      });
    }
  }
  if (tot2 !== null && tot2 > 0 && tot2 !== total) {
    const cuota = tot2 - seguros - otros - anticipo;
    if (cuota > 0) {
      out.push({
        id: "TOTAL_FACT_MENOS_ACCESORIOS",
        descripcion: "Total facturado menos seguros, cargos y anticipos.",
        composicion: ["TOTAL_FACTURADO", "-SEGURO", "-OTROS_CARGOS", "-ANTICIPO"],
        cuota,
      });
    }
  }
  return out;
}

/** Genera y evalúa hipótesis de composición de cuota para inferir la TEA. */
export function generarHipotesisTEA(
  vars: VariableDetectada[],
  ctx: Contexto,
): HipotesisReconstruccion[] {
  const candidatas = candidatasCuota(vars);
  if (!candidatas.length || ctx.saldo <= 0 || ctx.plazoRestante <= 0) return [];

  const hips: HipotesisReconstruccion[] = candidatas.map((c) => {
    const r = bisectTem(ctx.saldo, c.cuota, ctx.plazoRestante);
    const residuoRel = Number.isFinite(r.residuo) ? r.residuo / c.cuota : Infinity;
    let ev: EvidenciaVariable | null = null;
    if (r.ok) {
      const tea = temToTea(r.tem);
      ev = {
        categoria: "TEA",
        estado: "CALCULADA",
        valor: tea,
        unidad: "PORCENTAJE",
        confianzaMatematica: residuoRel <= 1e-6 ? "ALTA" : residuoRel <= 1e-3 ? "MEDIA" : "BAJA",
        formula: `bisección PMT(saldo=${ctx.saldo.toFixed(2)}, cuota=${c.cuota.toFixed(2)}, n=${ctx.plazoRestante})`,
        datosUsados: ["SALDO_PESOS", "PLAZO_RESTANTE"],
        variablesInferidas: [],
        supuestos: [`Composición cuota: ${c.composicion.join(" + ")}`],
        residuoAbs: r.residuo,
        residuoPct: residuoRel,
        advertencias: [],
      };
    }
    return {
      id: c.id,
      descripcion: c.descripcion,
      composicionCuota: c.composicion,
      resultado: ev,
      error: r.ok ? residuoRel : null,
      seleccionada: false,
      descartada: false,
    };
  });

  // Ordenar por error creciente
  hips.sort((a, b) => (a.error ?? Infinity) - (b.error ?? Infinity));

  // Determinar si hay ambigüedad material
  const validas = hips.filter((h) => h.resultado && (h.error ?? Infinity) <= TOL_CUOTA_PCT);
  if (validas.length >= 2) {
    // Dos o más caen dentro de la misma tolerancia → AMBIGUA, no elegir
    for (const h of validas) {
      if (h.resultado) h.resultado.estado = "AMBIGUA";
    }
  } else if (validas.length === 1) {
    validas[0].seleccionada = true;
  } else if (hips.length && hips[0].resultado) {
    // Ninguna cae en tolerancia — mejor esfuerzo, marcado como ESTIMADA
    hips[0].seleccionada = true;
    hips[0].resultado.estado = "ESTIMADA";
    hips[0].resultado.advertencias.push(
      "Ninguna hipótesis alcanzó la tolerancia; resultado presentado como estimación.",
    );
  }
  // Marcar descartadas
  for (const h of hips) {
    if (!h.seleccionada && h.resultado?.estado !== "AMBIGUA") {
      h.descartada = true;
      h.razonDescarte = `Error ${((h.error ?? 0) * 100).toFixed(3)} % supera tolerancia o hay mejor hipótesis.`;
    }
  }
  return hips;
}
