import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  calcularAmortizacion, convertirTasa, evaluarSpread, uvrACop, copAUvr, calcularVPN,
} from "@/lib/qaCopilotTools";

// ────────────────────────────────────────────────────────────────────────
// NUVIA QA Copilot v2
// Chat conversacional persistente con:
//   • Memoria (mensajes previos por conversación)
//   • Tool calling (KB semántica, usura/UVR, matemática financiera)
//   • Sugerencias de dictamen que el Director debe confirmar
// ────────────────────────────────────────────────────────────────────────

const MODEL = "google/gemini-3-flash-preview";
const EMBED_MODEL = "openai/text-embedding-3-small";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MAX_TOOL_STEPS = 8;

type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string; name?: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

// ─── Tool schema (OpenAI-compatible) ─────────────────────────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "buscar_kb",
      description:
        "Busca en la base de conocimiento NUVIA (normativa colombiana, perfiles de banco, fórmulas). Devuelve fragmentos relevantes con fuente.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Consulta en lenguaje natural" },
          categoria: {
            type: "string",
            enum: ["normativa", "banco", "formula", "caso_historico"],
            description: "Filtro opcional",
          },
          banco: { type: "string", description: "Filtro opcional por banco" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_usura",
      description: "Devuelve la tasa de usura EA y el interés bancario corriente EA vigentes para una fecha dada.",
      parameters: {
        type: "object",
        properties: { fecha: { type: "string", description: "YYYY-MM-DD" } },
        required: ["fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "consultar_uvr",
      description: "Devuelve el valor de UVR de cierre mensual para una fecha dada (COP por UVR).",
      parameters: {
        type: "object",
        properties: { fecha: { type: "string", description: "YYYY-MM-DD" } },
        required: ["fecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convertir_tasa",
      description: "Convierte entre tipos de tasa (EA, NM/NAM, periódica mensual).",
      parameters: {
        type: "object",
        properties: {
          valor: { type: "number", description: "Valor de la tasa (decimal, ej. 0.14 para 14%)" },
          de: { type: "string", enum: ["ea", "nm", "nam", "periodica_mensual"] },
          a: { type: "string", enum: ["ea", "nm", "nam", "periodica_mensual"] },
        },
        required: ["valor", "de", "a"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_amortizacion",
      description:
        "Genera cuota francesa, tabla resumen (primeros 12 meses + aniversarios), intereses totales y ahorro por abonos extra a capital.",
      parameters: {
        type: "object",
        properties: {
          saldo: { type: "number" },
          tasaEA: { type: "number", description: "EA en decimal (ej. 0.14)" },
          plazoMeses: { type: "number" },
          abonoExtraCapital: { type: "number" },
          cuotaExtraEnMes: { type: "number" },
          valorUVR: { type: "number", description: "Si es crédito UVR, valor UVR del día" },
          moneda: { type: "string", enum: ["pesos", "uvr"] },
        },
        required: ["saldo", "tasaEA", "plazoMeses"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "evaluar_spread_vs_usura",
      description: "Compara una tasa cobrada EA contra el IBC EA vigente. Emite dictamen OK / RECHAZO.",
      parameters: {
        type: "object",
        properties: {
          tasaCobradaEA: { type: "number" },
          ibcEA: { type: "number", description: "Interés bancario corriente EA vigente" },
        },
        required: ["tasaCobradaEA", "ibcEA"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "uvr_a_cop",
      description: "Convierte un monto UVR a COP usando la UVR de una fecha.",
      parameters: {
        type: "object",
        properties: { valorUVR: { type: "number" }, uvrEnFecha: { type: "number" } },
        required: ["valorUVR", "uvrEnFecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cop_a_uvr",
      description: "Convierte un monto COP a UVR usando la UVR de una fecha.",
      parameters: {
        type: "object",
        properties: { valorCOP: { type: "number" }, uvrEnFecha: { type: "number" } },
        required: ["valorCOP", "uvrEnFecha"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calcular_vpn",
      description: "VPN de flujos de caja mensuales dado una tasa de descuento EA.",
      parameters: {
        type: "object",
        properties: {
          flujos: { type: "array", items: { type: "number" } },
          tasaDescuentoEA: { type: "number" },
        },
        required: ["flujos", "tasaDescuentoEA"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "obtener_caso_actual",
      description:
        "Devuelve datos operativos del expediente y de la última auditoría vinculada a la conversación (banco, tasa pactada, tasa cobrada, seguros, dictamen).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "proponer_dictamen",
      description:
        "Crea una SUGERENCIA de dictamen para que el Director Financiero la revise y confirme manualmente. NUVIA NUNCA aplica dictamen automático — solo propone.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            enum: ["dictamen", "ajuste_calculo", "nota", "alerta_normativa"],
          },
          titulo: { type: "string" },
          decision: {
            type: "string",
            enum: ["aprobar", "aprobar_con_observaciones", "requiere_revision", "rechazar"],
            description: "Solo aplica cuando tipo = dictamen",
          },
          justificacion: { type: "string", description: "Explicación matemática con citas normativas" },
          detalles: {
            type: "object",
            description: "Cifras/ajustes propuestos (libre)",
          },
        },
        required: ["tipo", "titulo", "justificacion"],
      },
    },
  },
];

const SYSTEM_PROMPT = `Eres **NUVIA QA Copilot**, auditor senior de créditos hipotecarios y leasing habitacional en Colombia.
Tu director financiero conversa contigo para resolver casos usando matemática financiera rigurosa.

REGLAS:
1. **Nunca inventes cifras.** Usa herramientas para: buscar normativa (buscar_kb), consultar usura (consultar_usura), consultar UVR (consultar_uvr), convertir tasas (convertir_tasa), amortizar (calcular_amortizacion), evaluar spread (evaluar_spread_vs_usura), traer datos del caso (obtener_caso_actual).
2. **Cita fuente y fórmula** en cada afirmación numérica. Ej: "Según Ley 546 art. XX...", "IBC septiembre 2024 = 18,41% (SFC)".
3. **Nunca apliques dictamen automático.** Cuando concluyas, usa \`proponer_dictamen\` para crear una sugerencia; el Director confirma/rechaza manualmente.
4. **Contexto colombiano SIEMPRE**: bancos Davivienda, Bogotá, BBVA, Bancolombia, Popular, AV Villas, Colpatria, FNA; monedas Pesos y UVR; regulador SFC; UVR Banrep.
5. **Responde en español**, profesional, en Markdown breve con títulos y bullets. Usa cifras redondeadas legibles (millones con separador de miles).
6. Si el director pregunta por un caso puntual, primero llama \`obtener_caso_actual\` para traer el contexto real, luego calcula y responde.
7. Si detectas cobro por encima de usura, tasa distinta a la pactada, o error grave: llama \`proponer_dictamen\` con tipo=alerta_normativa o dictamen=rechazar.`;

// ─── Handler ────────────────────────────────────────────────────────────
export const Route = createFileRoute("/api/qa-copilot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) return Response.json({ error: "LOVABLE_API_KEY no configurada" }, { status: 500 });

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const { data: canUse } = await supabase.rpc("nuvia_qa_copilot_puede_usar", { _uid: userId });
          if (!canUse) return Response.json({ error: "Acceso restringido" }, { status: 403 });

          const body = (await request.json()) as {
            conversacionId?: string; pregunta: string; expedienteId?: string | null; auditoriaId?: string | null;
          };
          const pregunta = (body.pregunta ?? "").toString().slice(0, 4000).trim();
          if (pregunta.length < 2) return Response.json({ error: "Pregunta vacía" }, { status: 400 });

          // ── 1. Resolver/crear conversación ──
          let conversacionId = body.conversacionId ?? null;
          if (!conversacionId) {
            const { data: conv, error: convErr } = await supabase
              .from("nuvia_qa_copilot_conversaciones")
              .insert({
                user_id: userId,
                titulo: pregunta.slice(0, 60),
                expediente_id: body.expedienteId ?? null,
                auditoria_id: body.auditoriaId ?? null,
                contexto: {} as Json,
              })
              .select("id")
              .single();
            if (convErr || !conv) return Response.json({ error: convErr?.message ?? "No se pudo crear conversación" }, { status: 500 });
            conversacionId = conv.id;
          }

          // ── 2. Cargar historial + contexto del caso ──
          const { data: prevMsgs } = await supabase
            .from("nuvia_qa_copilot_mensajes")
            .select("role,content,tool_calls,tool_call_id,tool_name")
            .eq("conversacion_id", conversacionId)
            .order("created_at", { ascending: true })
            .limit(60);

          const { data: conv } = await supabase
            .from("nuvia_qa_copilot_conversaciones")
            .select("expediente_id,auditoria_id")
            .eq("id", conversacionId)
            .maybeSingle();
          const casoExpedienteId = body.expedienteId ?? conv?.expediente_id ?? null;
          const casoAuditoriaId = body.auditoriaId ?? conv?.auditoria_id ?? null;

          let contextoCaso = "";
          if (casoExpedienteId) {
            const { data: exp } = await supabase
              .from("expedientes")
              .select("id,codigo,cliente_nombre,banco,producto,moneda,cliente_data,proyeccion_data")
              .eq("id", casoExpedienteId)
              .maybeSingle();
            if (exp) {
              contextoCaso = `\n\n[Caso vinculado] ${exp.codigo ?? ""} · Cliente: ${exp.cliente_nombre ?? "-"} · Banco: ${exp.banco ?? "-"} · Producto: ${exp.producto ?? "-"} · Moneda: ${exp.moneda ?? "-"}`;
            }
          }

          // ── 3. Guardar user message ──
          await supabase.from("nuvia_qa_copilot_mensajes").insert({
            conversacion_id: conversacionId, role: "user", content: pregunta,
          });

          // ── 4. Armar mensajes para el modelo ──
          const messages: ChatMessage[] = [
            { role: "system", content: SYSTEM_PROMPT + contextoCaso },
          ];
          for (const m of prevMsgs ?? []) {
            if (m.role === "user" && m.content) messages.push({ role: "user", content: m.content });
            else if (m.role === "assistant") {
              messages.push({
                role: "assistant",
                content: m.content,
                tool_calls: (m.tool_calls as ToolCall[] | null) ?? undefined,
              });
            } else if (m.role === "tool" && m.content && m.tool_call_id) {
              messages.push({ role: "tool", content: m.content, tool_call_id: m.tool_call_id, name: m.tool_name ?? undefined });
            }
          }
          messages.push({ role: "user", content: pregunta });

          // ── 5. Loop de tool calling ──
          const sugerenciasCreadas: string[] = [];
          for (let step = 0; step < MAX_TOOL_STEPS; step++) {
            const aiResp = await fetch(`${GATEWAY}/chat/completions`, {
              method: "POST",
              headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, tool_choice: "auto" }),
            });
            if (!aiResp.ok) {
              const status = aiResp.status;
              const msg = status === 429 ? "Límite de consultas alcanzado."
                : status === 402 ? "Créditos de IA agotados."
                : `Error del servicio de IA (${status}).`;
              return Response.json({ error: msg, conversacionId }, { status });
            }
            const j = await aiResp.json();
            const choice = j.choices?.[0]?.message;
            if (!choice) return Response.json({ error: "Respuesta vacía del modelo", conversacionId }, { status: 500 });

            const toolCalls: ToolCall[] | undefined = choice.tool_calls;

            // Guardar assistant message
            await supabase.from("nuvia_qa_copilot_mensajes").insert({
              conversacion_id: conversacionId,
              role: "assistant",
              content: choice.content ?? null,
              tool_calls: (toolCalls ?? null) as unknown as Json,
            });

            messages.push({ role: "assistant", content: choice.content ?? null, tool_calls: toolCalls });

            if (!toolCalls || toolCalls.length === 0) {
              await supabase.from("nuvia_qa_copilot_conversaciones").update({ updated_at: new Date().toISOString() }).eq("id", conversacionId);
              return Response.json({
                conversacionId,
                respuesta: choice.content ?? "",
                sugerencias_creadas: sugerenciasCreadas,
              });
            }

            // Ejecutar cada tool call
            for (const tc of toolCalls) {
              let args: Record<string, unknown> = {};
              try { args = JSON.parse(tc.function.arguments || "{}"); } catch { args = {}; }
              const result = await runTool(tc.function.name, args, {
                supabase, apiKey: LOVABLE_API_KEY, casoExpedienteId, casoAuditoriaId,
                conversacionId, userId,
              });
              if (tc.function.name === "proponer_dictamen" && result && typeof result === "object" && "sugerencia_id" in result) {
                sugerenciasCreadas.push(String((result as { sugerencia_id: string }).sugerencia_id));
              }
              const content = JSON.stringify(result).slice(0, 6000);
              await supabase.from("nuvia_qa_copilot_mensajes").insert({
                conversacion_id: conversacionId,
                role: "tool",
                content,
                tool_call_id: tc.id,
                tool_name: tc.function.name,
              });
              messages.push({ role: "tool", content, tool_call_id: tc.id, name: tc.function.name });
            }
          }

          return Response.json({ conversacionId, respuesta: "(Se alcanzó el límite de pasos de razonamiento)", sugerencias_creadas: sugerenciasCreadas });
        } catch (e) {
          return Response.json({ error: e instanceof Error ? e.message : "Error inesperado" }, { status: 500 });
        }
      },
    },
  },
});

// ─── Ejecutor de herramientas ───────────────────────────────────────────
type ToolCtx = {
  supabase: ReturnType<typeof createClient<Database>>;
  apiKey: string;
  casoExpedienteId: string | null;
  casoAuditoriaId: string | null;
  conversacionId: string;
  userId: string;
};

async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  try {
    switch (name) {
      case "buscar_kb": return await buscarKB(args, ctx);
      case "consultar_usura": return await consultarUsura(args, ctx);
      case "consultar_uvr": return await consultarUVR(args, ctx);
      case "convertir_tasa":
        return convertirTasa(Number(args.valor), args.de as never, args.a as never);
      case "calcular_amortizacion":
        return calcularAmortizacion({
          saldo: Number(args.saldo), tasaEA: Number(args.tasaEA), plazoMeses: Number(args.plazoMeses),
          abonoExtraCapital: args.abonoExtraCapital != null ? Number(args.abonoExtraCapital) : undefined,
          cuotaExtraEnMes: args.cuotaExtraEnMes != null ? Number(args.cuotaExtraEnMes) : undefined,
          valorUVR: args.valorUVR != null ? Number(args.valorUVR) : null,
          moneda: (args.moneda as "pesos" | "uvr" | undefined) ?? "pesos",
        });
      case "evaluar_spread_vs_usura":
        return evaluarSpread(Number(args.tasaCobradaEA), Number(args.ibcEA));
      case "uvr_a_cop": return uvrACop(Number(args.valorUVR), Number(args.uvrEnFecha));
      case "cop_a_uvr": return copAUvr(Number(args.valorCOP), Number(args.uvrEnFecha));
      case "calcular_vpn":
        return calcularVPN((args.flujos as number[]) ?? [], Number(args.tasaDescuentoEA));
      case "obtener_caso_actual": return await obtenerCasoActual(ctx);
      case "proponer_dictamen": return await proponerDictamen(args, ctx);
      default: return { ok: false, error: `Herramienta desconocida: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error en herramienta" };
  }
}

async function buscarKB(args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const query = String(args.query ?? "").slice(0, 500);
  if (!query) return { ok: false, error: "Query vacía" };
  const embR = await fetch(`${GATEWAY}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ctx.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: query }),
  });
  if (!embR.ok) {
    // Fallback: búsqueda por texto en título/contenido si no hay embeddings
    const { data } = await ctx.supabase
      .from("nuvia_qa_kb")
      .select("titulo,contenido,categoria,banco,fuente")
      .ilike("contenido", `%${query.slice(0, 40)}%`)
      .limit(4);
    return { ok: true, modo: "texto", resultados: data ?? [] };
  }
  const embJson = (await embR.json()) as { data?: Array<{ embedding: number[] }> };
  const emb = embJson.data?.[0]?.embedding;
  if (!emb) return { ok: false, error: "Sin embedding" };
  const { data, error } = await ctx.supabase.rpc("match_nuvia_kb", {
    query_embedding: emb as unknown as string,
    match_count: 5,
    filter_categoria: (args.categoria as string) ?? null,
    filter_banco: (args.banco as string) ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    modo: "semantica",
    resultados: (data ?? []).map((r: { titulo: string; contenido: string; categoria: string; banco: string | null; fuente: string | null; similarity: number }) => ({
      titulo: r.titulo, categoria: r.categoria, banco: r.banco, fuente: r.fuente,
      similaridad: Number(r.similarity).toFixed(3),
      contenido: r.contenido.slice(0, 900),
    })),
  };
}

async function consultarUsura(args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const fecha = String(args.fecha ?? "").slice(0, 10);
  if (!fecha) return { ok: false, error: "Fecha requerida" };
  const primerDiaMes = fecha.slice(0, 7) + "-01";
  const { data } = await ctx.supabase
    .from("nuvia_usura_mensual")
    .select("fecha,tasa_usura_ea,interes_bancario_corriente_ea")
    .lte("fecha", primerDiaMes)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: false, error: "Sin dato de usura para esa fecha" };
  return {
    ok: true,
    fecha_dato: data.fecha,
    tasa_usura_ea: Number(data.tasa_usura_ea),
    tasa_usura_ea_pct: (Number(data.tasa_usura_ea) * 100).toFixed(2) + "%",
    ibc_ea: Number(data.interes_bancario_corriente_ea),
    ibc_ea_pct: (Number(data.interes_bancario_corriente_ea) * 100).toFixed(2) + "%",
    fuente: "SFC",
  };
}

async function consultarUVR(args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const fecha = String(args.fecha ?? "").slice(0, 10);
  if (!fecha) return { ok: false, error: "Fecha requerida" };
  const primerDiaMes = fecha.slice(0, 7) + "-01";
  const { data } = await ctx.supabase
    .from("nuvia_uvr_mensual")
    .select("fecha,valor")
    .lte("fecha", primerDiaMes)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { ok: false, error: "Sin dato UVR para esa fecha" };
  return { ok: true, fecha_dato: data.fecha, valor_uvr: Number(data.valor), fuente: "Banrep" };
}

async function obtenerCasoActual(ctx: ToolCtx): Promise<unknown> {
  if (!ctx.casoExpedienteId) return { ok: false, error: "No hay caso vinculado a la conversación" };
  const { data: exp } = await ctx.supabase
    .from("expedientes")
    .select("id,codigo,cliente_nombre,banco,producto,moneda,cliente_data,proyeccion_data,fees_data")
    .eq("id", ctx.casoExpedienteId)
    .maybeSingle();
  let auditoria: unknown = null;
  if (ctx.casoAuditoriaId) {
    const { data: a } = await ctx.supabase
      .from("qa_auditorias")
      .select("id,modalidad,qa_score,categoria,dictamen,outputs,diferencias,alertas,ejecutado_at")
      .eq("id", ctx.casoAuditoriaId)
      .maybeSingle();
    auditoria = a;
  } else if (ctx.casoExpedienteId) {
    const { data: a } = await ctx.supabase
      .from("qa_auditorias")
      .select("id,modalidad,qa_score,categoria,dictamen,outputs,diferencias,alertas,ejecutado_at")
      .eq("expediente_id", ctx.casoExpedienteId)
      .order("ejecutado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    auditoria = a;
  }
  return { ok: true, expediente: exp, auditoria };
}

async function proponerDictamen(args: Record<string, unknown>, ctx: ToolCtx): Promise<unknown> {
  const { data, error } = await ctx.supabase
    .from("nuvia_qa_copilot_sugerencias")
    .insert({
      conversacion_id: ctx.conversacionId,
      expediente_id: ctx.casoExpedienteId,
      auditoria_id: ctx.casoAuditoriaId,
      tipo: String(args.tipo ?? "nota"),
      titulo: String(args.titulo ?? "Sugerencia NUVIA"),
      propuesta: {
        decision: args.decision ?? null,
        detalles: args.detalles ?? {},
      } as unknown as Json,
      justificacion: String(args.justificacion ?? ""),
      creada_por: ctx.userId,
      estado: "pendiente",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    sugerencia_id: data.id,
    nota: "Sugerencia creada en estado 'pendiente'. El Director Financiero debe confirmarla o rechazarla desde la UI.",
  };
}
