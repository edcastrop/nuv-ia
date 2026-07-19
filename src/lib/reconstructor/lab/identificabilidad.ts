// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Motor de identificabilidad
// ─────────────────────────────────────────────────────────────

import type {
  CategoriaFinanciera,
  DiagnosticoIdentificabilidad,
  VariableDetectada,
} from "./types";

function has(vars: VariableDetectada[], cat: CategoriaFinanciera): boolean {
  return vars.some((v) => !v.excluida && v.categoria === cat && typeof v.valor === "number");
}

interface Regla {
  categoria: CategoriaFinanciera;
  requiere: CategoriaFinanciera[];
  descripcion: string;
  alternativa?: CategoriaFinanciera[]; // conjunto alternativo suficiente
  soloEstimable?: boolean;
  supuestosEstimacion?: string[];
}

const REGLAS: Regla[] = [
  {
    categoria: "TEA",
    requiere: ["SALDO_PESOS", "CUOTA_FINANCIERA", "PLAZO_RESTANTE"],
    alternativa: ["SALDO_UVR", "CUOTA_FINANCIERA", "VALOR_UVR", "PLAZO_RESTANTE"],
    descripcion:
      "TEA calculable con saldo, cuota financiera periódica y plazo restante en unidades compatibles.",
  },
  {
    categoria: "TEM",
    requiere: ["TEA"],
    alternativa: ["SALDO_PESOS", "CUOTA_FINANCIERA", "PLAZO_RESTANTE"],
    descripcion: "TEM derivable desde TEA o desde saldo/cuota/plazo.",
  },
  {
    categoria: "CUOTA_FINANCIERA",
    requiere: ["SALDO_PESOS", "TEA", "PLAZO_RESTANTE"],
    descripcion: "PMT con saldo, tasa y plazo restante.",
  },
  {
    categoria: "PLAZO_RESTANTE",
    requiere: ["SALDO_PESOS", "CUOTA_FINANCIERA", "TEA"],
    descripcion: "Despeje logarítmico con saldo, cuota y tasa.",
  },
  {
    categoria: "SALDO_PESOS",
    requiere: ["CUOTA_FINANCIERA", "TEA", "PLAZO_RESTANTE"],
    alternativa: ["SALDO_UVR", "VALOR_UVR"],
    descripcion: "PV con cuota, tasa y plazo restante; o SALDO_UVR × VALOR_UVR.",
  },
  {
    categoria: "PLAZO_APROBADO",
    requiere: ["CUOTAS_PAGADAS", "CUOTAS_PENDIENTES"],
    descripcion: "Suma exacta de cuotas pagadas y pendientes.",
  },
  {
    categoria: "VALOR_DESEMBOLSADO",
    requiere: ["CUOTA_ORIGINAL", "TEA", "PLAZO_APROBADO"],
    descripcion: "PV bajo tasa y cuota originales.",
    soloEstimable: true,
    supuestosEstimacion: [
      "Tasa constante",
      "Cuota constante",
      "Sin abonos extraordinarios",
      "Sin periodos de gracia",
      "Sin reestructuraciones",
      "Sin cambios de plazo",
      "Sin reliquidaciones",
    ],
  },
];

export function evaluarIdentificabilidad(
  variables: VariableDetectada[],
): DiagnosticoIdentificabilidad[] {
  const out: DiagnosticoIdentificabilidad[] = [];
  for (const regla of REGLAS) {
    if (has(variables, regla.categoria)) continue; // ya reportada
    const faltanPrimario = regla.requiere.filter((c) => !has(variables, c));
    const faltanAlt = regla.alternativa
      ? regla.alternativa.filter((c) => !has(variables, c))
      : null;
    const puedePrimario = faltanPrimario.length === 0;
    const puedeAlt = faltanAlt !== null && faltanAlt.length === 0;
    const puede = puedePrimario || puedeAlt;

    if (puede) {
      out.push({
        categoria: regla.categoria,
        identificabilidad: regla.soloEstimable ? "ESTIMABLE" : "CALCULABLE",
        requiere: puedePrimario ? regla.requiere : regla.alternativa ?? regla.requiere,
        faltan: [],
        razon: regla.soloEstimable
          ? `Sólo estimable bajo supuestos: ${(regla.supuestosEstimacion ?? []).join(", ")}.`
          : regla.descripcion,
      });
    } else {
      out.push({
        categoria: regla.categoria,
        identificabilidad: "NO_DETERMINABLE",
        requiere: regla.requiere,
        faltan: faltanPrimario,
        razon: `Faltan: ${faltanPrimario.join(", ") || "datos suficientes"}. ${regla.descripcion}`,
      });
    }
  }
  return out;
}
