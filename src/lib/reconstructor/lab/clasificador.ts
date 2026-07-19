// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Clasificador determinista
//
// Recibe el ExtractoData del parser existente (Record de strings) y
// produce un ExtractoLabInput normalizado + variables detectadas
// clasificadas por categoría financiera. No usa IA.
// ─────────────────────────────────────────────────────────────

import { parseMontoExtracto } from "@/lib/cuotaBase";
import { parseUVRNumber } from "@/lib/uvrNumber";
import { categoriaPara, detectarBanco } from "./diccionarios";
import type {
  Banco,
  CampoDetectado,
  Candidato,
  CategoriaFinanciera,
  Confianza,
  ExtractoLabInput,
  MonedaLab,
  UnidadValor,
  VariableDetectada,
} from "./types";

// El parser existente devuelve Record<string, string | Record<string,string>>.
// Aplanamos a Record<string,string> ignorando datos anidados de confianza.
type Plano = Record<string, string>;

function aplanar(data: Record<string, unknown>): Plano {
  const out: Plano = {};
  for (const [k, v] of Object.entries(data ?? {})) {
    if (typeof v === "string") out[k] = v;
    // se ignoran los objetos anidados (confianza por campo) — se leen aparte
  }
  return out;
}

function readConfianza(data: Record<string, unknown>): Record<string, Confianza> {
  const conf = data?.confianza;
  const out: Record<string, Confianza> = {};
  if (conf && typeof conf === "object") {
    for (const [k, v] of Object.entries(conf as Record<string, unknown>)) {
      if (typeof v !== "string") continue;
      const up = v.toUpperCase();
      out[k] = up === "ALTA" ? "ALTA" : up === "MEDIA" ? "MEDIA" : up === "BAJA" ? "BAJA" : "NULA";
    }
  }
  return out;
}

const CATEGORIAS_UVR = new Set<CategoriaFinanciera>(["SALDO_UVR", "VALOR_UVR"]);

function inferirUnidad(cat: CategoriaFinanciera): UnidadValor {
  if (cat === "TEA" || cat === "TEM") return "PORCENTAJE";
  if (
    cat === "PLAZO_APROBADO" ||
    cat === "PLAZO_RESTANTE" ||
    cat === "CUOTAS_PAGADAS" ||
    cat === "CUOTAS_PENDIENTES"
  ) {
    return "CUOTAS";
  }
  if (cat === "FECHA") return "FECHA";
  if (cat === "NUMERO_CREDITO" || cat === "INFORMATIVO" || cat === "OTRO") return "TEXTO";
  if (cat === "SALDO_UVR") return "UVR";
  if (cat === "VALOR_UVR") return "PESOS"; // pesos por UVR
  return "PESOS";
}

function parseValor(cat: CategoriaFinanciera, raw: string): number | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  if (cat === "TEA" || cat === "TEM") {
    const n = Number(trimmed.replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (
    cat === "PLAZO_APROBADO" ||
    cat === "PLAZO_RESTANTE" ||
    cat === "CUOTAS_PAGADAS" ||
    cat === "CUOTAS_PENDIENTES"
  ) {
    const n = Number(trimmed.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  if (CATEGORIAS_UVR.has(cat)) {
    const n = parseUVRNumber(trimmed);
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }
  if (cat === "FECHA" || cat === "TEXTO" || cat === "INFORMATIVO" || cat === "OTRO") return null;
  // Pesos
  const n = parseMontoExtracto(trimmed);
  return Number.isFinite(n) && n !== 0 ? n : trimmed === "0" ? 0 : n === 0 ? null : n;
}

function detectarMoneda(banco: Banco, plano: Plano): MonedaLab {
  const declarada = (plano.moneda ?? "").toUpperCase();
  if (declarada === "PESOS") return "PESOS";
  if (declarada === "UVR") {
    // Evidencia dura: saldoUVR > 0
    const saldo = parseUVRNumber(plano.saldoUVR ?? plano.saldoCapitalUVR ?? "");
    if (typeof saldo === "number" && saldo > 0) return "UVR";
    // Sin evidencia dura, degradar a PESOS para FNA (patrón Fase 1).
    if (banco === "FNA") return "PESOS";
    return "UVR";
  }
  return "DESCONOCIDA";
}

/** Normaliza ExtractoData (del parser existente) → ExtractoLabInput. */
export function normalizarExtracto(dataUnknown: unknown): ExtractoLabInput {
  const data = (dataUnknown ?? {}) as Record<string, unknown>;
  const plano = aplanar(data);
  const confMap = readConfianza(data);
  const banco = detectarBanco(plano.banco);
  const moneda = detectarMoneda(banco, plano);

  const campos: CampoDetectado[] = [];
  for (const [clave, rawUnknown] of Object.entries(plano)) {
    if (clave === "confianza" || clave === "moneda" || clave === "banco") continue;
    const raw = rawUnknown;
    if (typeof raw !== "string" || !raw.trim()) continue;
    const cat = categoriaPara(clave, banco);
    const valor = parseValor(cat, raw);
    campos.push({
      etiquetaOriginal: clave,
      valorOriginal: raw,
      valorNormalizado: valor,
      unidad: inferirUnidad(cat),
      paginaOrigen: null,
      confianzaExtraccion: confMap[clave] ?? "MEDIA",
      fuente: "EXTRACTO_ESTRUCTURADO",
    });
  }

  return {
    banco,
    producto: plano.producto ?? plano.tipoCredito ?? "",
    moneda,
    fechaCorte: plano.fechaCorte ?? null,
    camposDetectados: campos,
  };
}

/** Clasifica los campos en variables detectadas por categoría, con
 *  detección de candidatos ambiguos (dos valores distintos para la
 *  misma categoría). */
export function clasificarVariables(input: ExtractoLabInput): {
  variables: VariableDetectada[];
  candidatos: Candidato[];
} {
  const porCat = new Map<CategoriaFinanciera, VariableDetectada[]>();
  for (const campo of input.camposDetectados) {
    const cat = categoriaPara(campo.etiquetaOriginal, input.banco);
    if (cat === "OTRO" || cat === "INFORMATIVO") continue;
    const conf: Confianza =
      cat === "OTRO" ? "BAJA" : campo.confianzaExtraccion === "NULA" ? "BAJA" : "ALTA";
    const v: VariableDetectada = {
      id: `${cat}:${campo.etiquetaOriginal}`,
      categoria: cat,
      etiquetaOriginal: campo.etiquetaOriginal,
      valor: campo.valorNormalizado,
      unidad: campo.unidad,
      paginaOrigen: campo.paginaOrigen,
      fuente: campo.fuente,
      confianzaExtraccion: campo.confianzaExtraccion,
      confianzaClasificacion: conf,
      excluida: false,
      notas: [],
    };
    const arr = porCat.get(cat) ?? [];
    arr.push(v);
    porCat.set(cat, arr);
  }

  const variables: VariableDetectada[] = [];
  const candidatos: Candidato[] = [];
  for (const [cat, arr] of porCat.entries()) {
    const distintos = Array.from(
      new Set(arr.map((v) => v.valor).filter((n): n is number => typeof n === "number")),
    );
    if (distintos.length > 1) {
      // Ambigüedad: se conservan todas y se anota el candidato
      for (const v of arr) v.notas.push("Múltiples candidatos para la misma categoría");
      candidatos.push({
        categoria: cat,
        valores: distintos,
        motivo: "Se detectaron dos o más valores distintos para la misma categoría.",
      });
    }
    variables.push(...arr);
  }
  return { variables, candidatos };
}
