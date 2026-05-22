import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  images: z
    .array(
      z.object({
        mime: z.string().min(3).max(50),
        // data URL like "data:image/png;base64,...."
        dataUrl: z.string().min(20).max(15_000_000),
      }),
    )
    .min(1)
    .max(10),
});

const tool = {
  type: "function" as const,
  function: {
    name: "extract_extracto",
    description:
      "Extrae los datos clave de un extracto bancario de crédito hipotecario colombiano. Si un dato no aparece de forma clara, deja la cadena vacía y marca confianza 'baja'. No inventes valores.",
    parameters: {
      type: "object",
      properties: {
        banco: { type: "string" },
        cliente: { type: "string" },
        cedula: { type: "string" },
        numeroCredito: { type: "string" },
        producto: { type: "string" },
        tipoCredito: { type: "string" },
        moneda: { type: "string", enum: ["PESOS", "UVR", ""] },
        saldoCapital: { type: "string", description: "Saldo a capital en pesos. Solo número, sin símbolos." },
        valorDesembolsado: { type: "string", description: "Valor inicialmente desembolsado del crédito, en pesos. Solo dígitos." },
        cuotaMensual: { type: "string", description: "Cuota mensual total con seguros en pesos. Solo número." },
        seguros: { type: "string", description: "Valor mensual de seguros en pesos. Solo número." },
        cuotaSinSeguros: { type: "string" },
        plazoInicial: { type: "string", description: "Plazo total inicial aprobado en meses." },
        cuotasPagadas: { type: "string" },
        cuotasPendientes: { type: "string" },
        tea: { type: "string", description: "Tasa oficial para la simulación: SOLO la TASA DE INTERÉS COBRADA. Si no aparece explícitamente, deja vacío." },
        teaCobrada: { type: "string", description: "Tasa de interés cobrada (la efectivamente aplicada en el periodo)." },
        teaPactada: { type: "string", description: "Tasa de interés pactada (referencia contractual). NO usar para simulación." },
        tasaMensual: { type: "string" },
        interesCuota: { type: "string" },
        capitalCuota: { type: "string" },
        valorUVR: { type: "string", description: "Valor de la UVR del día, si aplica." },
        saldoUVR: { type: "string", description: "Saldo a capital en UVR, si aplica." },
        valorCobertura: { type: "string", description: "Valor del beneficio de cobertura (cobertura FRECH / cobertura de tasa), en pesos (solo dígitos). Vacío si no aplica." },
        tasaCobertura: { type: "string", description: "Tasa (puntos porcentuales) del beneficio de cobertura. Vacío si no aplica." },
        tieneCobertura: { type: "string", enum: ["si", "no", ""], description: "'si' cuando el extracto mencione cobertura FRECH, cobertura de tasa, beneficio de cobertura, subsidio a la tasa o equivalente." },
        fechaExtracto: { type: "string" },
        confianza: {
          type: "object",
          properties: {
            banco: { type: "string", enum: ["alta", "media", "baja"] },
            cliente: { type: "string", enum: ["alta", "media", "baja"] },
            cedula: { type: "string", enum: ["alta", "media", "baja"] },
            numeroCredito: { type: "string", enum: ["alta", "media", "baja"] },
            producto: { type: "string", enum: ["alta", "media", "baja"] },
            moneda: { type: "string", enum: ["alta", "media", "baja"] },
            saldoCapital: { type: "string", enum: ["alta", "media", "baja"] },
            cuotaMensual: { type: "string", enum: ["alta", "media", "baja"] },
            seguros: { type: "string", enum: ["alta", "media", "baja"] },
            plazoInicial: { type: "string", enum: ["alta", "media", "baja"] },
            cuotasPagadas: { type: "string", enum: ["alta", "media", "baja"] },
            tea: { type: "string", enum: ["alta", "media", "baja"] },
            teaCobrada: { type: "string", enum: ["alta", "media", "baja"] },
            teaPactada: { type: "string", enum: ["alta", "media", "baja"] },
            valorUVR: { type: "string", enum: ["alta", "media", "baja"] },
            saldoUVR: { type: "string", enum: ["alta", "media", "baja"] },
            valorCobertura: { type: "string", enum: ["alta", "media", "baja"] },
            tasaCobertura: { type: "string", enum: ["alta", "media", "baja"] },
            valorDesembolsado: { type: "string", enum: ["alta", "media", "baja"] },
          },
          required: [
            "banco","cliente","cedula","numeroCredito","producto","moneda",
            "saldoCapital","cuotaMensual","seguros","plazoInicial","cuotasPagadas","tea","teaCobrada","teaPactada","valorUVR","saldoUVR","valorCobertura","tasaCobertura","valorDesembolsado",
          ],
          additionalProperties: false,
        },
      },
      required: [
        "banco","cliente","cedula","numeroCredito","producto","tipoCredito","moneda",
        "saldoCapital","valorDesembolsado","cuotaMensual","seguros","cuotaSinSeguros","plazoInicial",
        "cuotasPagadas","cuotasPendientes","tea","teaCobrada","teaPactada","tasaMensual","interesCuota","capitalCuota",
        "valorUVR","saldoUVR","valorCobertura","tasaCobertura","tieneCobertura","fechaExtracto","confianza",
      ],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Eres NUVEX IA, un asistente experto en extractos bancarios de créditos hipotecarios colombianos (Bancolombia, Davivienda, Caja Social, FNA, BBVA, AV Villas, Banco de Bogotá, La Hipotecaria, Banco de Occidente, Caja Honor).

Tu tarea: analizar las imágenes del extracto que recibirás y extraer los datos clave en formato estructurado llamando la función extract_extracto.

REGLAS ESTRICTAS:
- NO inventes datos. Si un campo no aparece claramente, devuélvelo como cadena vacía "" y marca la confianza como "baja".
- Marca la moneda como "UVR" si el extracto referencia UVR/saldo en UVR/valor UVR, de lo contrario "PESOS".
- Para montos en pesos, devuelve solo dígitos sin puntos, comas ni símbolos (ej: "221903943").
- "valorDesembolsado": monto inicial desembolsado del crédito (también llamado "valor desembolsado", "monto desembolso", "valor del crédito desembolsado", "desembolso inicial"). En pesos, solo dígitos. Si no aparece, vacío "".
- "saldoCapital": SIEMPRE el saldo a capital actual en PESOS (no en UVR). Para créditos UVR, busca "saldo en pesos", "saldo capital pesos", "equivalente en pesos" del saldo. Solo dígitos.
- TASAS DE INTERÉS — regla obligatoria (PRIORIDAD ALTA, casi siempre debes llenar "teaCobrada"):
  * Identifica todas las tasas que aparezcan: "tasa de interés cobrada" / "tasa cobrada" / "tasa aplicada" / "tasa efectivamente aplicada" / "tasa vigente" / "tasa actual" / "tasa de interés del periodo" / "tasa remuneratoria" y "tasa pactada" / "tasa contractual" / "tasa nominal pactada".
  * "teaCobrada": llénalo SIEMPRE que el extracto muestre cualquier tasa que represente la efectivamente aplicada al periodo. Es muy común que aparezca como "Tasa Cobrada", "Tasa de interés cobrada EA", "Tasa EA cobrada", o simplemente como la tasa vigente del periodo en la sección de condiciones del crédito.
  * "teaPactada": llénalo cuando aparezca explícitamente la tasa pactada/contractual.
  * Si el extracto muestra una sola tasa sin distinguir, asume que es la cobrada y úsala como "teaCobrada" (confianza "media").
  * Si aparecen ambas (cobrada y pactada), "teaCobrada" = cobrada, "teaPactada" = pactada. NUNCA confundas una con otra.
  * El campo "tea" debe ser EXACTAMENTE igual a "teaCobrada" (mismo valor textual). Solo déjalo vacío si REALMENTE no hay ninguna tasa visible en el extracto.
  * Para créditos UVR la tasa cobrada suele estar entre 4% y 8% EA; para Pesos entre 9% y 18% EA. Si lo que ves cae en esos rangos y es la única tasa, casi seguro es la cobrada.
- Para tasas (TEA), devuelve el porcentaje con punto decimal (ej: "11.15").
- Para fechas, formato YYYY-MM-DD si es posible.
- Si encuentras múltiples valores posibles para un campo crítico (cuota, saldo, tasa), elige el más reciente / del periodo del extracto y baja la confianza a "media".
- BENEFICIO DE COBERTURA — regla obligatoria:
  * Si el extracto menciona "cobertura FRECH", "cobertura de tasa", "beneficio de cobertura", "subsidio a la tasa", "cobertura condicionada", "cobertura tasa de interés" o equivalente, marca tieneCobertura="si".
  * Si NO aparece, tieneCobertura="no".
  * Cuando tieneCobertura="si": extrae "valorCobertura" (monto mensual o saldo de cobertura en pesos, solo dígitos) y "tasaCobertura" (puntos porcentuales de la cobertura, ej "5.00" o "2.50").
  * Cuando tieneCobertura="si" y el campo "producto" no incluya ya la frase "con Beneficio de Cobertura", AÑÁDELA al final del producto (ej: "Hipotecario en Pesos con Beneficio de Cobertura"). Esto activa la sección de cobertura en el simulador.
- Confianza "alta" solo si el dato es 100% explícito en el extracto. "media" si requiere inferencia simple. "baja" si dudoso o ausente.`;

export type ExtractoData = Record<string, string | Record<string, string>>;
export type ExtractoResponse = { error: string | null; data: ExtractoData | null };

export const extractStatement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<ExtractoResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY no está configurada en el servidor.", data: null };
    }

    const userContent = [
      {
        type: "text" as const,
        text: "Analiza estas páginas del extracto bancario y llama la función extract_extracto con los datos detectados.",
      },
      ...data.images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "extract_extracto" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return { error: "Demasiadas solicitudes. Intenta de nuevo en un momento.", data: null };
      }
      if (resp.status === 402) {
        return {
          error: "Se agotaron los créditos de IA. Recarga tu workspace de Lovable para continuar.",
          data: null,
        };
      }
      const text = await resp.text();
      console.error("Lovable AI error:", resp.status, text);
      return { error: `Error de IA (${resp.status}).`, data: null };
    }

    const json = (await resp.json()) as {
      choices?: Array<{
        message?: {
          tool_calls?: Array<{ function?: { arguments?: string } }>;
        };
      }>;
    };

    const argsRaw =
      json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
    if (!argsRaw) {
      return { error: "La IA no devolvió datos estructurados. Intenta con otra imagen.", data: null };
    }

    try {
      const parsed = JSON.parse(argsRaw) as ExtractoData;
      // Normalizar banco: Colpatria ahora es Davibank
      const bancoRaw = typeof parsed.banco === "string" ? parsed.banco : "";
      if (/colpatria/i.test(bancoRaw)) {
        parsed.banco = "Davibank";
      }

      // Fallback: derivar tasa cobrada si la IA la dejó vacía
      const numStr = (k: string) => {
        const v = parsed[k];
        return typeof v === "string" ? v.replace(/[^\d.]/g, "") : "";
      };
      const num = (k: string) => {
        const s = numStr(k);
        const n = parseFloat(s);
        return isFinite(n) ? n : 0;
      };
      const teaCobradaEmpty = !numStr("teaCobrada");
      const teaEmpty = !numStr("tea");

      if (teaCobradaEmpty) {
        // 1) usar tasaMensual si vino
        const tm = num("tasaMensual");
        if (tm > 0 && tm < 5) {
          const tea = (Math.pow(1 + tm / 100, 12) - 1) * 100;
          parsed.teaCobrada = tea.toFixed(4);
        } else {
          // 2) calcular desde interes/saldo (en UVR si aplica, sino en pesos)
          const moneda = (parsed.moneda as string) || "";
          let interes = 0;
          let saldo = 0;
          if (moneda === "UVR") {
            // intentar UVR puro primero
            interes = num("interesCuota");
            saldo = num("saldoUVR");
            const vUVR = num("valorUVR");
            // si interesCuota viene en pesos, convertir a UVR
            if (interes > 0 && saldo > 0 && vUVR > 0 && interes > saldo) {
              interes = interes / vUVR;
            }
          } else {
            interes = num("interesCuota");
            saldo = num("saldoCapital");
          }
          if (interes > 0 && saldo > 0) {
            const tasaMes = interes / saldo;
            if (tasaMes > 0 && tasaMes < 0.05) {
              const tea = (Math.pow(1 + tasaMes, 12) - 1) * 100;
              parsed.teaCobrada = tea.toFixed(4);
              // marcar confianza media
              if (parsed.confianza && typeof parsed.confianza === "object") {
                (parsed.confianza as Record<string, string>).teaCobrada = "media";
              }
            }
          }
        }
      }

      // tea = teaCobrada si tea está vacío
      if (teaEmpty && numStr("teaCobrada")) {
        parsed.tea = parsed.teaCobrada;
      }

      return { error: null, data: parsed };
    } catch (e) {
      console.error("JSON parse error:", e, argsRaw);
      return { error: "No se pudo interpretar la respuesta de la IA.", data: null };
    }
  });


