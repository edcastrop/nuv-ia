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
        cuotaMensual: { type: "string", description: "Cuota mensual total con seguros en pesos. Solo número." },
        seguros: { type: "string", description: "Valor mensual de seguros en pesos. Solo número." },
        cuotaSinSeguros: { type: "string" },
        plazoInicial: { type: "string", description: "Plazo total inicial aprobado en meses." },
        cuotasPagadas: { type: "string" },
        cuotasPendientes: { type: "string" },
        tea: { type: "string", description: "Tasa Efectiva Anual en %, por ejemplo 11.15" },
        tasaMensual: { type: "string" },
        interesCuota: { type: "string" },
        capitalCuota: { type: "string" },
        valorUVR: { type: "string", description: "Valor de la UVR del día, si aplica." },
        saldoUVR: { type: "string", description: "Saldo a capital en UVR, si aplica." },
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
            valorUVR: { type: "string", enum: ["alta", "media", "baja"] },
            saldoUVR: { type: "string", enum: ["alta", "media", "baja"] },
          },
          required: [
            "banco","cliente","cedula","numeroCredito","producto","moneda",
            "saldoCapital","cuotaMensual","seguros","plazoInicial","cuotasPagadas","tea","valorUVR","saldoUVR",
          ],
          additionalProperties: false,
        },
      },
      required: [
        "banco","cliente","cedula","numeroCredito","producto","tipoCredito","moneda",
        "saldoCapital","cuotaMensual","seguros","cuotaSinSeguros","plazoInicial",
        "cuotasPagadas","cuotasPendientes","tea","tasaMensual","interesCuota","capitalCuota",
        "valorUVR","saldoUVR","fechaExtracto","confianza",
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
- Para tasas (TEA), devuelve el porcentaje con punto decimal (ej: "11.15").
- Para fechas, formato YYYY-MM-DD si es posible.
- Si encuentras múltiples valores posibles para un campo crítico (cuota, saldo, tasa), elige el más reciente / del periodo del extracto y baja la confianza a "media".
- Confianza "alta" solo si el dato es 100% explícito en el extracto. "media" si requiere inferencia simple. "baja" si dudoso o ausente.`;

export const extractStatement = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY no está configurada en el servidor.");
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
      const parsed = JSON.parse(argsRaw) as Record<string, string | Record<string, string>>;
      return { error: null as string | null, data: parsed };
    } catch (e) {
      console.error("JSON parse error:", e, argsRaw);
      return { error: "No se pudo interpretar la respuesta de la IA.", data: null as Record<string, string | Record<string, string>> | null };
    }
  });

