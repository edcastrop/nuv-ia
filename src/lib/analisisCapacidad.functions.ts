// Motor de análisis de capacidad de pago para radicación bancaria.
// Lee nóminas, carta laboral y renta del titular (y opcional codeudor),
// extrae ingresos con Lovable AI y calcula el % de endeudamiento contra
// la cuota propuesta al banco. Reglas: 30% No-VIS, 40% VIS.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FileSchema = z.object({
  nombre: z.string().min(1).max(255),
  mime: z.string().min(3).max(80),
  // Acepta data: URL (image/* o application/pdf). Hasta ~12MB base64.
  dataUrl: z.string().min(20).max(18_000_000),
  // Etiqueta opcional para guiar a la IA: "nomina", "carta_laboral", "renta"
  tipo: z.enum(["nomina", "carta_laboral", "renta", "otro"]).default("otro"),
});

const PersonaSchema = z.object({
  rol: z.enum(["titular", "codeudor"]),
  tipoPersona: z.enum(["empleado_mensual", "empleado_quincenal"]),
  archivos: z.array(FileSchema).min(1).max(12),
});

const InputSchema = z.object({
  expedienteId: z.string().uuid(),
  cuotaPropuesta: z.number().positive(),
  esVis: z.boolean().default(false),
  personas: z.array(PersonaSchema).min(1).max(2),
});

export type AnalisisPersonaResultado = {
  rol: "titular" | "codeudor";
  tipoPersona: "empleado_mensual" | "empleado_quincenal";
  ingresoMensualPromedio: number;
  ingresosDetectados: Array<{
    documento: string;
    periodo: string;
    valor: number;
    tipo: string;
  }>;
  confianza: "alta" | "media" | "baja";
  observaciones: string[];
};

export type AnalisisCapacidadResultado = {
  error: string | null;
  data: {
    cuotaPropuesta: number;
    esVis: boolean;
    limiteAplicable: number; // 0.30 o 0.40
    ingresoTotal: number;
    porcentajeEndeudamiento: number; // 0..1
    semaforo: "verde" | "amarillo" | "rojo" | "sin_datos";
    mensaje: string;
    personas: AnalisisPersonaResultado[];
    modelo: string;
  } | null;
};

const tool = {
  type: "function" as const,
  function: {
    name: "extraer_ingresos",
    description:
      "Analiza los soportes financieros de UNA persona (empleado) y devuelve los ingresos mensuales detectados documento por documento. NO inventes valores; si no es claro, devuelve confianza baja y deja el valor en 0.",
    parameters: {
      type: "object",
      properties: {
        ingresoMensualPromedio: {
          type: "number",
          description:
            "Promedio del ingreso NETO mensual. Si es quincenal, suma las quincenas del mismo mes y promedia. Usa el neto a pagar (después de deducciones de ley) cuando esté disponible; si solo hay total devengado, úsalo y anótalo en observaciones.",
        },
        ingresosDetectados: {
          type: "array",
          items: {
            type: "object",
            properties: {
              documento: { type: "string", description: "Nombre del archivo o etiqueta (nomina, carta_laboral, renta)." },
              periodo: { type: "string", description: "Mes/quincena del comprobante, ej 'Marzo 2025' o '1-15 Abr 2025'. Vacío si no aplica." },
              valor: { type: "number", description: "Valor mensual o quincenal en pesos colombianos. 0 si no aplica al cálculo (ej. carta laboral repite información)." },
              tipo: {
                type: "string",
                enum: ["neto_mensual", "neto_quincenal", "devengado_mensual", "devengado_quincenal", "ingreso_declarado_renta", "salario_carta", "no_aplica"],
              },
            },
            required: ["documento", "periodo", "valor", "tipo"],
            additionalProperties: false,
          },
        },
        confianza: { type: "string", enum: ["alta", "media", "baja"] },
        observaciones: {
          type: "array",
          items: { type: "string" },
          description: "Hallazgos relevantes: inconsistencias entre nómina y renta, bonificaciones no recurrentes excluidas, descuentos por embargos, faltan documentos, etc.",
        },
      },
      required: ["ingresoMensualPromedio", "ingresosDetectados", "confianza", "observaciones"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Eres NUVEX IA, analista financiero senior. Tu tarea es leer soportes laborales colombianos (comprobantes de nómina, carta laboral y declaración de renta) de UN empleado y calcular su ingreso mensual promedio para presentación a un banco.

Reglas:
- NO inventes cifras. Si un documento es ilegible o no aplica, devuelve valor 0 y baja la confianza.
- El cálculo final es el INGRESO MENSUAL PROMEDIO neto recurrente. Si solo dispones del devengado, úsalo y anótalo en observaciones.
- Si el empleado es quincenal, suma las dos quincenas del mismo mes para obtener el ingreso mensual; luego promedia los meses disponibles.
- EXCLUYE bonificaciones extraordinarias claramente no recurrentes (prima de éxito puntual, indemnizaciones). INCLUYE auxilios fijos (transporte, alimentación cuando aparezca como recurrente).
- La carta laboral suele repetir el salario; úsala para CRUZAR consistencia, no para sumar al promedio (registra tipo "salario_carta" con valor 0 o anótala en observaciones si el salario reportado difiere del de las nóminas en más del 10%).
- La renta declarada sirve para CRUZAR consistencia anual (ingresos / 12). Regístrala con tipo "ingreso_declarado_renta" valor=ingreso mensual implícito; si difiere >15% del promedio de nóminas, agrega una observación.
- Devuelve confianza "alta" solo si tienes ≥3 nóminas mensuales (o 6 quincenales) consistentes y la carta/renta no contradicen.`;

function buildUserContent(persona: z.infer<typeof PersonaSchema>) {
  const intro = `Analiza los soportes financieros de este empleado (${persona.tipoPersona.replace("_", " ")}) y llama la función extraer_ingresos. Documentos adjuntos (${persona.archivos.length}):`;
  const parts: Array<Record<string, unknown>> = [{ type: "text", text: intro }];
  for (const f of persona.archivos) {
    parts.push({ type: "text", text: `\n— ${f.tipo.toUpperCase()}: ${f.nombre}` });
    if (f.mime.startsWith("image/")) {
      parts.push({ type: "image_url", image_url: { url: f.dataUrl } });
    } else {
      // PDFs u otros: enviar como file block (OpenRouter/Gemini)
      const base64 = f.dataUrl.includes(",") ? f.dataUrl.split(",")[1] : f.dataUrl;
      parts.push({
        type: "file",
        file: {
          filename: f.nombre,
          file_data: `data:${f.mime};base64,${base64}`,
        },
      });
    }
  }
  return parts;
}

async function analizarPersona(
  apiKey: string,
  persona: z.infer<typeof PersonaSchema>,
): Promise<{ persona: AnalisisPersonaResultado; modelo: string; error?: string }> {
  const userContent = buildUserContent(persona);

  const call = (model: string) =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extraer_ingresos" } },
      }),
    });

  // Gemini 2.5 Pro maneja mejor PDFs financieros con tablas
  const modelo = "google/gemini-2.5-pro";
  const resp = await call(modelo);

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("Lovable AI error (capacidad):", resp.status, text);
    let msg = `Error de IA (${resp.status}).`;
    if (resp.status === 429) msg = "Demasiadas solicitudes a la IA. Reintenta en un momento.";
    if (resp.status === 402) msg = "Se agotaron los créditos de IA del workspace.";
    return {
      modelo,
      error: msg,
      persona: {
        rol: persona.rol,
        tipoPersona: persona.tipoPersona,
        ingresoMensualPromedio: 0,
        ingresosDetectados: [],
        confianza: "baja",
        observaciones: [msg],
      },
    };
  }

  const json = (await resp.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
  if (!argsRaw) {
    return {
      modelo,
      persona: {
        rol: persona.rol,
        tipoPersona: persona.tipoPersona,
        ingresoMensualPromedio: 0,
        ingresosDetectados: [],
        confianza: "baja",
        observaciones: ["La IA no devolvió datos estructurados. Revisa la calidad de los soportes."],
      },
    };
  }

  try {
    const parsed = JSON.parse(argsRaw) as {
      ingresoMensualPromedio: number;
      ingresosDetectados: Array<{ documento: string; periodo: string; valor: number; tipo: string }>;
      confianza: "alta" | "media" | "baja";
      observaciones: string[];
    };
    return {
      modelo,
      persona: {
        rol: persona.rol,
        tipoPersona: persona.tipoPersona,
        ingresoMensualPromedio: Math.max(0, Number(parsed.ingresoMensualPromedio) || 0),
        ingresosDetectados: parsed.ingresosDetectados ?? [],
        confianza: parsed.confianza ?? "baja",
        observaciones: parsed.observaciones ?? [],
      },
    };
  } catch (e) {
    console.error("JSON parse error (capacidad):", e);
    return {
      modelo,
      persona: {
        rol: persona.rol,
        tipoPersona: persona.tipoPersona,
        ingresoMensualPromedio: 0,
        ingresosDetectados: [],
        confianza: "baja",
        observaciones: ["No se pudo interpretar la respuesta de la IA."],
      },
    };
  }
}

function semaforoFor(pct: number, limite: number): "verde" | "amarillo" | "rojo" {
  if (pct <= limite) return "verde";
  if (pct <= limite + 0.03) return "amarillo";
  return "rojo";
}

function mensajePara(
  pct: number,
  limite: number,
  semaforo: "verde" | "amarillo" | "rojo" | "sin_datos",
  esVis: boolean,
): string {
  const limPct = Math.round(limite * 100);
  if (semaforo === "sin_datos") return "No fue posible calcular el endeudamiento con los soportes entregados.";
  if (semaforo === "verde")
    return `La cuota propuesta está dentro del ${limPct}% permitido por el banco para crédito ${esVis ? "VIS" : "No VIS"}. Puedes radicar con tranquilidad.`;
  if (semaforo === "amarillo")
    return `La cuota propuesta está apenas por encima del ${limPct}% (actual ${(pct * 100).toFixed(1)}%). Recomendamos sustentar con ingresos adicionales o sumar codeudor antes de radicar.`;
  return `La cuota propuesta supera el ${limPct}% permitido (actual ${(pct * 100).toFixed(1)}%). El banco probablemente la rechazará. Ajusta cuota, suma codeudor o revisa los soportes.`;
}

export const analizarCapacidadPago = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<AnalisisCapacidadResultado> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY no está configurada en el servidor.", data: null };
    }

    const resultados = await Promise.all(
      data.personas.map((p) => analizarPersona(apiKey, p)),
    );

    const personas = resultados.map((r) => r.persona);
    const modelo = resultados[0]?.modelo ?? "google/gemini-2.5-pro";
    const ingresoTotal = personas.reduce((sum, p) => sum + p.ingresoMensualPromedio, 0);
    const limiteAplicable = data.esVis ? 0.40 : 0.30;

    let semaforo: "verde" | "amarillo" | "rojo" | "sin_datos" = "sin_datos";
    let pct = 0;
    if (ingresoTotal > 0) {
      pct = data.cuotaPropuesta / ingresoTotal;
      semaforo = semaforoFor(pct, limiteAplicable);
    }
    const mensaje = mensajePara(pct, limiteAplicable, semaforo, data.esVis);

    // El primer error de IA (si lo hubo) se propaga como advertencia, pero
    // igual devolvemos el resultado parcial.
    const firstError = resultados.find((r) => r.error)?.error ?? null;

    return {
      error: firstError,
      data: {
        cuotaPropuesta: data.cuotaPropuesta,
        esVis: data.esVis,
        limiteAplicable,
        ingresoTotal,
        porcentajeEndeudamiento: pct,
        semaforo,
        mensaje,
        personas,
        modelo,
      },
    };
  });
