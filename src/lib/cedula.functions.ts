// Lector de cédula colombiana (amarilla con hologramas y digital).
// Server function que llama Lovable AI (visión) con tool-calling para
// devolver los datos clave del documento de identidad.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  images: z
    .array(
      z.object({
        mime: z.string().min(3).max(50),
        dataUrl: z.string().min(20).max(15_000_000),
      }),
    )
    .min(1)
    .max(4),
});

const tool = {
  type: "function" as const,
  function: {
    name: "extract_cedula",
    description:
      "Extrae los datos del documento de identidad colombiano (cédula amarilla o digital). No inventes datos; si un campo no aparece de forma clara, devuélvelo vacío y baja la confianza.",
    parameters: {
      type: "object",
      properties: {
        tipoDocumento: { type: "string", enum: ["CC", "CE", "PEP", "PA", ""], description: "CC para Cédula de Ciudadanía, CE Cédula de Extranjería, PEP Permiso Especial de Permanencia, PA Pasaporte." },
        numeroCedula: { type: "string", description: "Solo dígitos, sin puntos ni espacios." },
        primerApellido: { type: "string" },
        segundoApellido: { type: "string" },
        primerNombre: { type: "string" },
        segundoNombre: { type: "string" },
        nombreCompleto: { type: "string", description: "Nombres y apellidos concatenados en orden de lectura natural: 'Nombre Apellido'." },
        fechaNacimiento: { type: "string", description: "YYYY-MM-DD si es posible." },
        lugarNacimiento: { type: "string" },
        fechaExpedicion: { type: "string", description: "YYYY-MM-DD si es posible." },
        lugarExpedicion: { type: "string", description: "Municipio y departamento donde se expidió. Ej: 'Bogotá D.C.'." },
        sexo: { type: "string", enum: ["M", "F", ""] },
        rh: { type: "string" },
        confianza: {
          type: "object",
          properties: {
            numeroCedula: { type: "string", enum: ["alta", "media", "baja"] },
            nombreCompleto: { type: "string", enum: ["alta", "media", "baja"] },
            lugarExpedicion: { type: "string", enum: ["alta", "media", "baja"] },
            fechaExpedicion: { type: "string", enum: ["alta", "media", "baja"] },
          },
          required: ["numeroCedula", "nombreCompleto", "lugarExpedicion", "fechaExpedicion"],
          additionalProperties: false,
        },
      },
      required: [
        "tipoDocumento",
        "numeroCedula",
        "primerApellido",
        "segundoApellido",
        "primerNombre",
        "segundoNombre",
        "nombreCompleto",
        "fechaNacimiento",
        "lugarNacimiento",
        "fechaExpedicion",
        "lugarExpedicion",
        "sexo",
        "rh",
        "confianza",
      ],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `Eres NUVEX IA, experto en lectura de documentos de identidad colombianos (Cédula de Ciudadanía amarilla con hologramas, Cédula Digital, Cédula de Extranjería, Pasaporte).

Tarea: analiza la(s) imagen(es) y llama la función extract_cedula con los datos detectados.

Reglas:
- NO inventes datos. Si un campo no aparece claramente, devuélvelo como cadena vacía "" y baja la confianza a "baja".
- numeroCedula: solo dígitos (sin puntos, comas ni espacios).
- nombreCompleto: arma "Primer Nombre Segundo Nombre Primer Apellido Segundo Apellido", sin dobles espacios.
- Para fechas usa YYYY-MM-DD si puedes; si solo ves día/mes/año en texto, normaliza.
- lugarExpedicion: si dice solo el municipio, agrégale la abreviatura del departamento cuando sea inequívoco (ej. "Bogotá D.C.", "Medellín, Antioquia").
- Si la imagen no es una cédula colombiana válida, devuelve todos los campos vacíos y confianzas en "baja".`;

export type CedulaData = {
  tipoDocumento: string;
  numeroCedula: string;
  primerApellido: string;
  segundoApellido: string;
  primerNombre: string;
  segundoNombre: string;
  nombreCompleto: string;
  fechaNacimiento: string;
  lugarNacimiento: string;
  fechaExpedicion: string;
  lugarExpedicion: string;
  sexo: string;
  rh: string;
  confianza: {
    numeroCedula: "alta" | "media" | "baja";
    nombreCompleto: "alta" | "media" | "baja";
    lugarExpedicion: "alta" | "media" | "baja";
    fechaExpedicion: "alta" | "media" | "baja";
  };
};

export type CedulaResponse = { error: string | null; data: CedulaData | null };

export const extractCedula = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<CedulaResponse> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { error: "LOVABLE_API_KEY no está configurada en el servidor.", data: null };
    }

    const userContent = [
      {
        type: "text" as const,
        text: "Analiza estas imágenes del documento de identidad y llama la función extract_cedula.",
      },
      ...data.images.map((img) => ({
        type: "image_url" as const,
        image_url: { url: img.dataUrl },
      })),
    ];

    const callModel = (model: string) =>
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
          tool_choice: { type: "function", function: { name: "extract_cedula" } },
        }),
      });

    let resp = await callModel("google/gemini-2.5-flash");
    if (!resp.ok && (resp.status >= 500 || resp.status === 408)) {
      try { await resp.text(); } catch { /* drain */ }
      resp = await callModel("google/gemini-2.5-pro");
    }

    if (!resp.ok) {
      if (resp.status === 429) return { error: "Demasiadas solicitudes. Intenta de nuevo en un momento.", data: null };
      if (resp.status === 402) return { error: "Se agotaron los créditos de IA. Recarga tu workspace para continuar.", data: null };
      const text = await resp.text().catch(() => "");
      console.error("Lovable AI error (cedula):", resp.status, text);
      return { error: `Error de IA (${resp.status}).`, data: null };
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const argsRaw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "";
    if (!argsRaw) return { error: "La IA no devolvió datos estructurados. Intenta con otra imagen.", data: null };

    try {
      const parsed = JSON.parse(argsRaw) as CedulaData;
      // Normalizaciones suaves
      if (parsed.numeroCedula) parsed.numeroCedula = parsed.numeroCedula.replace(/\D/g, "");
      if (!parsed.nombreCompleto) {
        parsed.nombreCompleto = [
          parsed.primerNombre,
          parsed.segundoNombre,
          parsed.primerApellido,
          parsed.segundoApellido,
        ].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      } else {
        parsed.nombreCompleto = parsed.nombreCompleto.replace(/\s+/g, " ").trim();
      }
      return { error: null, data: parsed };
    } catch (e) {
      console.error("JSON parse error (cedula):", e, argsRaw);
      return { error: "No se pudo interpretar la respuesta de la IA.", data: null };
    }
  });
