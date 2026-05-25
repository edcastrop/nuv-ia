import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  BANK_PROFILES,
  CAMPOS_MOTOR,
  type BankProfile,
  type CampoMotor,
  type Moneda,
  type Producto,
} from "./motorExtractos/bankProfiles";
import { normalizeCreditMoneyInput } from "./creditoSanity";

// =============================================================
// Motor de Extractos NUVEX V1
// Estrategia:
//   1) Llamada 1 a Gemini Flash con todas las imágenes → identifica
//      banco, producto y moneda (rápido y barato).
//   2) Selecciona el BankProfile correspondiente.
//   3) Llamada 2 a Gemini Pro con el system prompt especializado
//      del banco → extrae los campos NUVEX y un score 0–100 por campo.
//   4) Devuelve datos + scores + confianza global.
// =============================================================

const InputSchema = z.object({
  images: z
    .array(
      z.object({
        mime: z.string().min(3).max(50),
        dataUrl: z.string().min(20).max(15_000_000),
      }),
    )
    .min(1)
    .max(10),
});

export interface CostoLlamada {
  paso: "deteccion" | "extraccion";
  modelo: string;
  tokensInput: number;
  tokensOutput: number;
  costoUSD: number;
}

export interface MotorResultado {
  banco: string;
  producto: Producto;
  moneda: Moneda;
  bankProfileId: string | null;
  datos: Record<CampoMotor, string>;
  scores: Record<CampoMotor, number>;
  confianzaGlobal: number;
  alertas: string[];
  rawDeteccion: string;
  costo: {
    totalUSD: number;
    llamadas: CostoLlamada[];
  };
}

export type MotorResponse = { error: string | null; data: MotorResultado | null };

// ---------------- Esquema de salida del parser ----------------

const fieldsSchemaProps: Record<string, { type: "string" }> = {};
for (const k of CAMPOS_MOTOR) fieldsSchemaProps[k] = { type: "string" };

const scoresSchemaProps: Record<string, { type: "number" }> = {};
for (const k of CAMPOS_MOTOR) scoresSchemaProps[k] = { type: "number" };

const parserTool = {
  type: "function" as const,
  function: {
    name: "extract_extracto_nuvex",
    description:
      "Extrae los campos del extracto bancario hipotecario/leasing y asigna un puntaje de confianza 0-100 por cada campo. NO inventes. Campo no visible = cadena vacía con score 0.",
    parameters: {
      type: "object",
      properties: {
        datos: {
          type: "object",
          description:
            "Valores extraídos como strings. Montos: solo dígitos. Tasas: con punto decimal (ej '11.25'). Vacío si no aparece.",
          properties: fieldsSchemaProps,
          required: [...CAMPOS_MOTOR],
          additionalProperties: false,
        },
        scores: {
          type: "object",
          description:
            "Score 0-100 por campo. 100=literal y explícito, 90=alto, 70=inferido, 30=dudoso, 0=ausente.",
          properties: scoresSchemaProps,
          required: [...CAMPOS_MOTOR],
          additionalProperties: false,
        },
        alertas: {
          type: "array",
          items: { type: "string" },
          description: "Inconsistencias o advertencias breves para el licenciado.",
        },
      },
      required: ["datos", "scores", "alertas"],
      additionalProperties: false,
    },
  },
};

const detectorTool = {
  type: "function" as const,
  function: {
    name: "detectar_banco_producto",
    description: "Identifica banco, producto y moneda del extracto a partir de las imágenes.",
    parameters: {
      type: "object",
      properties: {
        banco: { type: "string", description: "Nombre del banco emisor tal como aparece." },
        producto: {
          type: "string",
          enum: ["CREDITO_HIPOTECARIO", "LEASING_HABITACIONAL", ""],
        },
        moneda: { type: "string", enum: ["PESOS", "UVR", ""] },
        evidencia: {
          type: "string",
          description: "Texto literal corto del extracto que justifica la detección.",
        },
      },
      required: ["banco", "producto", "moneda", "evidencia"],
      additionalProperties: false,
    },
  },
};

// ---------------- Helpers ----------------

// Normaliza un monto COP en cualquier formato (US "1,065,000.00" o CO "1.065.000,00")
// → cadena numérica limpia. Preserva decimales si existen.
export function parseCOP(raw: string): string {
  if (!raw) return "";
  let s = String(raw)
    .replace(/[^\d.,-]/g, "")
    .trim();
  if (!s) return "";
  const neg = s.startsWith("-");
  if (neg) s = s.slice(1);
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let intPart = s,
    decPart = "";
  if (lastComma === -1 && lastDot === -1) {
    intPart = s;
  } else if (lastComma > lastDot) {
    // formato CO: coma = decimal, punto = miles
    const decRaw = s.slice(lastComma + 1);
    if (decRaw.length <= 2) {
      intPart = s.slice(0, lastComma);
      decPart = decRaw;
    } else {
      intPart = s.replace(/[.,]/g, "");
    }
  } else if (lastDot > lastComma) {
    // formato US: punto = decimal, coma = miles. Solo si la parte tras el punto tiene 1-2 dígitos.
    const decRaw = s.slice(lastDot + 1);
    if (decRaw.length <= 2 && lastComma !== -1) {
      intPart = s.slice(0, lastDot);
      decPart = decRaw;
    } else if (decRaw.length <= 2 && !/[.,]/.test(s.slice(0, lastDot))) {
      intPart = s.slice(0, lastDot);
      decPart = decRaw;
    } else {
      intPart = s.replace(/[.,]/g, "");
    }
  }
  intPart = intPart.replace(/[.,]/g, "");
  if (!/^\d+$/.test(intPart)) return "";
  const out = decPart ? `${intPart}.${decPart}` : intPart;
  return neg ? `-${out}` : out;
}

function parseTasa(raw: string): string {
  if (!raw) return "";
  const m = String(raw)
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  const n = parseFloat(m);
  return Number.isFinite(n) ? String(n) : "";
}

const SYSTEM_DETECTOR = `Eres un clasificador de extractos bancarios colombianos. Mira las imágenes y llena la función detectar_banco_producto. NO inventes — usa solo lo visible.`;

function buildParserSystem(profile: BankProfile): string {
  return `Eres NUVEX IA, parser especializado de extractos bancarios colombianos.
Estás procesando un extracto del banco: ${profile.banco}.
Productos soportados por esta plantilla: ${profile.productos.join(", ")}.

REGLAS GLOBALES:
- Llama SIEMPRE la función extract_extracto_nuvex.
- Montos en pesos: solo dígitos (ej "221903943"). Tasas EA en porcentaje con punto decimal (ej "11.25").
- Fechas en formato YYYY-MM-DD si es posible, vacío si no es claro.
- Si un campo NO aparece literalmente en el extracto: devuelve cadena vacía "" y score 0. NO INVENTES.
- Score 100 = etiqueta literal exacta visible. 90 = visible con leve normalización. 70 = inferido del contexto. 30 = dudoso. 0 = ausente.

REGLAS GLOBALES DE BENEFICIO / COBERTURA / SUBSIDIO / FRECH / FRESH (aplica a TODOS los bancos):
- Detecta beneficio SOLO si existe un VALOR NUMÉRICO MAYOR A CERO en alguno de:
  "Valor subsidio Gobierno", "Valor subsidio", "Valor Beneficio", "Valor cobertura",
  "Cobertura FRECH", "Interés Cte. Cobertura", "Interés cobertura", "Subsidio a la tasa".
- Si NO hay valor numérico > 0 → beneficioActivo="no", tipoBeneficio="", valorBeneficioMensual="",
  tasaCobertura="", cuotaSinSubsidio="", cuotaConSubsidio="", todos con score 0.
- NO marques beneficio sólo porque aparezca la palabra "cobertura" o "FRECH" en texto legal o avisos.
- Si hay valor > 0:
  * beneficioActivo = "si" (score 100).
  * valorBeneficioMensual = el valor mensual del subsidio/cobertura (solo dígitos).
  * tipoBeneficio = "Subsidio Gobierno", "FRECH", "Fresh", "Cobertura VIS", "Mi Casa Ya"
    según el rótulo literal. Si solo dice "Cobertura" o "Subsidio" → "Subsidio Gobierno".
  * cuotaSinSubsidio = valor de "Valor cuota sin subsidio" / "Cuota sin cobertura" si aparece.
  * cuotaConSubsidio = valor de "Valor cuota con subsidio" / "Cuota con cobertura" si aparece.
  * tasaCobertura = porcentaje sólo si el extracto lo trae explícito (ej "Tasa cobertura 5.00%").
    Si no aparece, deja "" con score 0 (NO inventes; la simulación puede usar el valor mensual).
- Si el extracto pertenece a un producto VIS con cobertura por defecto pero no hay valor
  visible en este corte → beneficioActivo="no", el licenciado lo ajustará manualmente.

REGLAS ESPECÍFICAS DEL BANCO:
${profile.hints}

CAMPO 'banco': devuelve "${profile.banco}" con score 100.
CAMPO 'producto': "CREDITO_HIPOTECARIO" o "LEASING_HABITACIONAL".
CAMPO 'moneda': "PESOS" o "UVR".
CAMPO 'cuotasPagadas': si no es explícito y conoces el "número de cuota actual a pagar", úsalo y deja score=90.
CAMPO 'cuotasPendientes': si no es explícito calcula plazoInicial - cuotasPagadas y deja score=70.
CAMPO 'sistemaAmortizacion': "abono constante a capital" / "cuota fija" / "UVR". Vacío si no es claro.`;
}

async function callLovableAI(
  model: string,
  systemPrompt: string,
  userContent: unknown[],
  tool: typeof parserTool | typeof detectorTool,
): Promise<Response> {
  const apiKey = process.env.LOVABLE_API_KEY;
  return fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: tool.function.name } },
    }),
  });
}

function findProfileByName(banco: string, producto?: Producto): BankProfile | null {
  const t = banco.toLowerCase();
  const candidates = BANK_PROFILES.filter(
    (p) => p.matchAny.some((rx) => rx.test(banco)) || p.banco.toLowerCase() === t,
  );
  if (!candidates.length) return null;
  if (producto) {
    const exact = candidates.find((p) => p.productos.includes(producto));
    if (exact) return exact;
  }
  return candidates[0];
}

interface ToolCall {
  function?: { arguments?: string };
}
interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
}
interface ChatResp {
  choices?: Array<{ message?: { tool_calls?: ToolCall[] }; finish_reason?: string }>;
  usage?: Usage;
}
type DeteccionMotor = { banco: string; producto: Producto; moneda: Moneda; evidencia: string };
type ParserPayload = {
  datos: Record<string, string>;
  scores: Record<string, number>;
  alertas: string[];
};

function normalizeParsedMotor(
  parsed: ParserPayload,
  det: DeteccionMotor,
  profile: BankProfile,
): { datos: Record<CampoMotor, string>; scores: Record<CampoMotor, number> } {
  const datos: Record<CampoMotor, string> = {} as Record<CampoMotor, string>;
  const scores: Record<CampoMotor, number> = {} as Record<CampoMotor, number>;
  for (const k of CAMPOS_MOTOR) {
    datos[k] = String(parsed.datos?.[k] ?? "").trim();
    const s = Number(parsed.scores?.[k] ?? 0);
    scores[k] = Number.isFinite(s) ? Math.max(0, Math.min(100, Math.round(s))) : 0;
  }

  const CAMPOS_MONETARIOS: CampoMotor[] = [
    "valorDesembolsado",
    "saldoCapital",
    "cuotaActual",
    "interesCuota",
    "capitalCuota",
    "seguros",
    "valorUVR",
    "saldoUVR",
    "valorBeneficioMensual",
    "cuotaSinSubsidio",
    "cuotaConSubsidio",
  ];
  for (const k of CAMPOS_MONETARIOS) {
    if (datos[k]) datos[k] = parseCOP(datos[k]);
  }
  for (const k of ["tasaEA", "tasaMensual", "tasaCobertura"] as CampoMotor[]) {
    if (datos[k]) datos[k] = parseTasa(datos[k]);
  }

  const valorBenef = parseFloat(datos.valorBeneficioMensual || "0");
  if (Number.isFinite(valorBenef) && valorBenef > 0) {
    datos.beneficioActivo = "si";
    scores.beneficioActivo = Math.max(scores.beneficioActivo, 95);
  } else {
    datos.beneficioActivo = "no";
    datos.valorBeneficioMensual = "";
    datos.tipoBeneficio = "";
    datos.tasaCobertura = "";
    datos.cuotaSinSubsidio = "";
    datos.cuotaConSubsidio = "";
  }

  if (datos.cedula && /^0+$/.test(datos.cedula.replace(/\D/g, ""))) {
    datos.cedula = "";
    scores.cedula = 0;
  }

  datos.banco = profile.banco;
  scores.banco = 100;
  if (!datos.producto && det.producto) datos.producto = det.producto;
  if (!datos.moneda && det.moneda) datos.moneda = det.moneda;

  const sane = normalizeCreditMoneyInput({
    valorDesembolsado: datos.valorDesembolsado,
    saldoCapital: datos.saldoCapital,
    cuotaActual: datos.cuotaActual,
    seguros: datos.seguros,
    cuotaSinSubsidio: datos.cuotaSinSubsidio,
    cuotaConSubsidio: datos.cuotaConSubsidio,
    cuotaConInteresSinSeguros: datos.cuotaSinSubsidio || datos.cuotaConSubsidio,
    valorBeneficioMensual: datos.valorBeneficioMensual,
    interesCuota: datos.interesCuota,
    capitalCuota: datos.capitalCuota,
  });
  for (const [field, value] of Object.entries(sane.values)) {
    if (value) datos[field as CampoMotor] = value;
  }

  return { datos, scores };
}

function toNumber(value: string): number {
  const n = parseFloat(value || "0");
  return Number.isFinite(n) ? n : 0;
}

function closeMoney(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(2_500, Math.max(Math.abs(a), Math.abs(b)) * 0.005);
}

function formatNumeric(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
}

function applyBancolombiaDeterministicCorrections(
  profile: BankProfile,
  datos: Record<CampoMotor, string>,
  scores: Record<CampoMotor, number>,
): string[] {
  if (profile.id !== "bancolombia") return [];

  const alertas: string[] = [];
  const cuotaActual = toNumber(datos.cuotaActual);
  const cuotaSinSubsidio = toNumber(datos.cuotaSinSubsidio);
  const beneficio = toNumber(datos.valorBeneficioMensual);
  const saldoCapital = toNumber(datos.saldoCapital);
  const interes = toNumber(datos.interesCuota);
  let cuotaConSubsidio = toNumber(datos.cuotaConSubsidio);

  if (beneficio > 0 && cuotaSinSubsidio > 0) {
    const cuotaConSubsidioCalculada = cuotaSinSubsidio - beneficio;
    if (cuotaConSubsidioCalculada > 0 && !closeMoney(cuotaConSubsidio, cuotaConSubsidioCalculada)) {
      datos.cuotaConSubsidio = formatNumeric(cuotaConSubsidioCalculada);
      scores.cuotaConSubsidio = Math.max(scores.cuotaConSubsidio, 95);
      cuotaConSubsidio = cuotaConSubsidioCalculada;
      alertas.push("Bancolombia: cuota con subsidio corregida por cuota sin subsidio - subsidio.");
    }
  }

  if (cuotaActual > 0 && cuotaConSubsidio > 0) {
    const segurosCalculados = cuotaActual - cuotaConSubsidio;
    const segurosActuales = toNumber(datos.seguros);
    if (
      segurosCalculados > 0 &&
      segurosCalculados < cuotaActual * 0.3 &&
      !closeMoney(segurosActuales, segurosCalculados)
    ) {
      datos.seguros = formatNumeric(segurosCalculados);
      scores.seguros = Math.max(scores.seguros, 95);
      alertas.push("Bancolombia: seguros corregidos por Valor a Pagar - cuota con subsidio.");
    }
  }

  if (beneficio > 0 && saldoCapital > 0 && interes > 0 && datos.tasaEA) {
    const tasaCalculadaContaminada =
      (Math.pow(1 + (interes + beneficio) / saldoCapital, 12) - 1) * 100;
    const tasaEAActual = toNumber(datos.tasaEA);
    if (tasaEAActual > 0 && Math.abs(tasaEAActual - tasaCalculadaContaminada) <= 0.15) {
      scores.tasaEA = Math.min(scores.tasaEA || 70, 70);
      alertas.push(
        "Bancolombia: tasa EA requiere verificación manual porque parece calculada desde intereses + subsidio; debe tomarse sólo de 'Tasa interés cobrada'.",
      );
    }
  }

  return alertas;
}

function validateMotorConsistency(profile: BankProfile, datos: Record<CampoMotor, string>) {
  const alertas: string[] = [];
  let critical = false;

  if (profile.id === "bancolombia") {
    const cuotaActual = toNumber(datos.cuotaActual);
    const cuotaConSubsidio = toNumber(datos.cuotaConSubsidio);
    const cuotaSinSubsidio = toNumber(datos.cuotaSinSubsidio);
    const beneficio = toNumber(datos.valorBeneficioMensual);
    const capital = toNumber(datos.capitalCuota);
    const interes = toNumber(datos.interesCuota);
    const seguros = toNumber(datos.seguros);
    const plazo = Math.round(toNumber(datos.plazoInicial));
    const cuotaActualNumero = Math.round(toNumber(datos.cuotasPagadas));
    const pendientes = Math.round(toNumber(datos.cuotasPendientes));

    if (
      beneficio > 0 &&
      cuotaSinSubsidio > 0 &&
      cuotaConSubsidio > 0 &&
      !closeMoney(cuotaSinSubsidio - beneficio, cuotaConSubsidio)
    ) {
      critical = true;
      alertas.push(
        "Inconsistencia Bancolombia: cuota sin subsidio - subsidio no coincide con cuota con subsidio.",
      );
    }
    if (
      cuotaActual > 0 &&
      cuotaConSubsidio > 0 &&
      seguros > 0 &&
      !closeMoney(cuotaConSubsidio + seguros, cuotaActual)
    ) {
      critical = true;
      alertas.push(
        "Inconsistencia Bancolombia: valor a pagar no coincide con cuota con subsidio + seguros.",
      );
    }
    if (
      cuotaActual > 0 &&
      capital > 0 &&
      interes > 0 &&
      seguros > 0 &&
      !closeMoney(capital + interes + seguros, cuotaActual)
    ) {
      critical = true;
      alertas.push(
        "Inconsistencia Bancolombia: capital + intereses + seguros no coincide con el valor a pagar.",
      );
    }
    if (
      plazo > 0 &&
      cuotaActualNumero > 0 &&
      pendientes > 0 &&
      cuotaActualNumero + pendientes !== plazo &&
      cuotaActualNumero + pendientes - 1 !== plazo
    ) {
      critical = true;
      alertas.push(
        "Inconsistencia Bancolombia: número de cuota + cuotas pendientes no coincide con el plazo inicial.",
      );
    }
  }

  return { critical, alertas };
}

// ---------------- Server Function ----------------
// Precios USD por 1M tokens (pass-through Lovable AI Gateway)
const PRECIOS: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-pro": { in: 1.25, out: 10.0 },
  "google/gemini-2.5-flash": { in: 0.3, out: 2.5 },
};
const calcCosto = (modelo: string, tokIn: number, tokOut: number) => {
  const p = PRECIOS[modelo] ?? { in: 0, out: 0 };
  return (tokIn / 1_000_000) * p.in + (tokOut / 1_000_000) * p.out;
};
const llamadas: CostoLlamada[] = [];

export const extractStatementMotor = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<MotorResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY no está configurada en el servidor.", data: null };
    }

    const userContent = [
      { type: "text" as const, text: "Analiza estas páginas del extracto bancario colombiano." },
      ...data.images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];

    // PASO 1 — Detección rápida
    let detResp = await callLovableAI(
      "google/gemini-2.5-flash",
      SYSTEM_DETECTOR,
      userContent,
      detectorTool,
    );
    if (!detResp.ok && detResp.status >= 500) {
      detResp = await callLovableAI(
        "google/gemini-2.5-pro",
        SYSTEM_DETECTOR,
        userContent,
        detectorTool,
      );
    }
    if (!detResp.ok) {
      if (detResp.status === 429)
        return { error: "Demasiadas solicitudes. Intenta de nuevo.", data: null };
      if (detResp.status === 402) return { error: "Créditos de IA agotados.", data: null };
      return { error: `Error de IA detector (${detResp.status}).`, data: null };
    }

    const detJson = (await detResp.json()) as ChatResp;
    const detModel = detResp.ok
      ? detResp.status >= 500
        ? "google/gemini-2.5-pro"
        : "google/gemini-2.5-flash"
      : "google/gemini-2.5-flash";
    const detIn = detJson.usage?.prompt_tokens ?? 0;
    const detOut = detJson.usage?.completion_tokens ?? 0;
    llamadas.push({
      paso: "deteccion",
      modelo: detModel,
      tokensInput: detIn,
      tokensOutput: detOut,
      costoUSD: calcCosto(detModel, detIn, detOut),
    });
    const detArgs = detJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
    let det: DeteccionMotor = {
      banco: "",
      producto: "",
      moneda: "",
      evidencia: "",
    };
    try {
      det = { ...det, ...JSON.parse(detArgs) };
    } catch {
      /* ignore */
    }

    if (/colpatria/i.test(det.banco)) det.banco = "Davibank";

    const profile = findProfileByName(det.banco, det.producto);
    if (!profile) {
      return {
        error: `No hay parser especializado para "${det.banco || "banco desconocido"}". El motor NUVEX V1 solo procesa bancos con plantilla. Usa el lector clásico como alternativa.`,
        data: null,
      };
    }

    // PASO 2 — Parser especializado (Flash por defecto, Pro como fallback)
    let parseResp = await callLovableAI(
      "google/gemini-2.5-flash",
      buildParserSystem(profile),
      userContent,
      parserTool,
    );
    let usedProFallback = false;
    if (
      !parseResp.ok &&
      (parseResp.status === 504 || parseResp.status === 408 || parseResp.status >= 500)
    ) {
      parseResp = await callLovableAI(
        "google/gemini-2.5-pro",
        buildParserSystem(profile),
        userContent,
        parserTool,
      );
      usedProFallback = true;
    }
    if (!parseResp.ok) {
      if (parseResp.status === 429)
        return { error: "Demasiadas solicitudes. Intenta de nuevo.", data: null };
      if (parseResp.status === 402) return { error: "Créditos de IA agotados.", data: null };
      if (parseResp.status === 504 || parseResp.status === 408)
        return {
          error:
            "El extracto es muy pesado y la IA tardó demasiado. Intenta subir solo las páginas relevantes (resumen + movimientos) o reduce el tamaño del PDF.",
          data: null,
        };
      return { error: `Error de IA parser (${parseResp.status}).`, data: null };
    }

    const pJson = (await parseResp.json()) as ChatResp;
    const parseModel = usedProFallback ? "google/gemini-2.5-pro" : "google/gemini-2.5-flash";
    const pIn = pJson.usage?.prompt_tokens ?? 0;
    const pOut = pJson.usage?.completion_tokens ?? 0;
    llamadas.push({
      paso: "extraccion",
      modelo: parseModel,
      tokensInput: pIn,
      tokensOutput: pOut,
      costoUSD: calcCosto(parseModel, pIn, pOut),
    });
    const pArgs = pJson.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
    if (!pArgs) return { error: "La IA no devolvió datos estructurados.", data: null };

    let parsed: {
      datos: Record<string, string>;
      scores: Record<string, number>;
      alertas: string[];
    };
    try {
      parsed = JSON.parse(pArgs);
    } catch {
      return { error: "Respuesta del parser no interpretable.", data: null };
    }

    const { datos, scores } = normalizeParsedMotor(parsed, det, profile);
    const deterministicAlerts = applyBancolombiaDeterministicCorrections(profile, datos, scores);
    // Nota: se removió el reintento adicional con Pro para evitar timeouts del gateway.
    const finalValidation = validateMotorConsistency(profile, datos);

    // Confianza global: promedio ponderado de campos no vacíos
    let suma = 0,
      n = 0;
    for (const k of CAMPOS_MOTOR) {
      if (datos[k]) {
        suma += scores[k];
        n += 1;
      }
    }
    const confianzaGlobal = n ? Math.round((suma / n) * 100) / 100 : 0;

    return {
      error: null,
      data: {
        banco: profile.banco,
        producto: (datos.producto as Producto) || det.producto,
        moneda: (datos.moneda as Moneda) || det.moneda,
        bankProfileId: profile.id,
        datos,
        scores,
        confianzaGlobal,
        alertas: [
          ...(Array.isArray(parsed.alertas) ? parsed.alertas.map(String) : []),
          ...deterministicAlerts,
          ...finalValidation.alertas,
        ],
        rawDeteccion: det.evidencia,
        costo: {
          totalUSD: llamadas.reduce((s, l) => s + l.costoUSD, 0),
          llamadas,
        },
      },
    };
  });
