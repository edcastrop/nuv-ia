import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

type Audiencia = "interno" | "apoderado" | "cliente";

const DATASETS = [
  "casos_aprobados", "casos_negados", "casos_estancados", "casos_activos", "casos_sin_movimiento",
  "expedientes_incompletos",
  "honorarios_pendientes", "clientes_morosos",
  "cuentas_cobro_pendientes", "cuentas_cobro_rechazadas", "facturacion_mes",
  "comisiones_pendientes",
  "buscar_cliente",
  "ninguno",
] as const;

function resolverAudiencia(roles: string[]): Audiencia {
  if (roles.includes("apoderado")) return "apoderado";
  if (roles.includes("cliente")) return "cliente";
  return "interno";
}

function alcance(roles: string[]) {
  const isAdmin = roles.some((r) => ["super_admin", "admin", "gerencia"].includes(r));
  const isContabilidad = roles.includes("contabilidad");
  const isJuridico = roles.some((r) => ["juridica", "director_juridico"].includes(r));
  const isLicenciado = roles.includes("licenciado");
  return { isAdmin, isContabilidad, isJuridico, isLicenciado };
}

function sseEvent(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export const Route = createFileRoute("/api/nuvex-ia-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const t0 = Date.now();
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return new Response("Unauthorized", { status: 401 });
          }
          const token = authHeader.slice(7);

          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
          if (!LOVABLE_API_KEY) {
            return new Response("LOVABLE_API_KEY no configurada", { status: 500 });
          }

          const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
          if (claimsErr || !claimsData?.claims?.sub) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          const userId = claimsData.claims.sub;

          // ── Rate limiting: máx 30 consultas por usuario por minuto ──────────

          const ventana = new Date(Date.now() - 60_000).toISOString();

          const { count: recentCount } = await supabase
            .from("nuvex_ia_log")
            .select("id", { count: "exact", head: true })
            .eq("usuario_id", userId)
            .gte("created_at", ventana);

          if ((recentCount ?? 0) >= 30) {
            return new Response(
              JSON.stringify({ error: "Has superado el límite de 30 consultas por minuto. Intenta de nuevo en unos segundos." }),
              { status: 429, headers: { "Content-Type": "application/json" } },
            );
          }

          // ────────────────────────────────────────────────────────────────────

          const BodySchema = z.object({
            pregunta: z.string().min(2).max(1000),
            modulo: z.string().max(80).nullable().optional(),
            origen: z.enum(["nuvex_ia", "nuvex_gpt", "cliente"]).optional().default("nuvex_ia"),
          });

          const bodyRaw = await request.json();
          const bodyParsed = BodySchema.safeParse(bodyRaw);

          if (!bodyParsed.success) {
            return new Response(
              JSON.stringify({ error: "Solicitud inválida", detalle: bodyParsed.error.flatten() }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const { pregunta, modulo: moduloRaw, origen } = bodyParsed.data;
          const modulo = (moduloRaw ?? "").toLowerCase() || null;

          // Roles + audiencia
          const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
          const roles: string[] = ((rolesData ?? []) as Array<{ role: string }>).map((r) => r.role);
          const { isAdmin, isContabilidad, isJuridico, isLicenciado } = alcance(roles);
          const audiencia = resolverAudiencia(roles);
          const rolPrincipal =
            roles.find((r) => ["super_admin", "admin", "gerencia"].includes(r)) ?? roles[0] ?? "licenciado";

          const { data: prof } = await supabase.from("profiles").select("nombre").eq("id", userId).maybeSingle();
          const nombre = (prof?.nombre as string | undefined) ?? null;

          const registrar = async (respuesta: string, fuente: "kb" | "modelo" | "escalado") => {
            await supabase.from("nuvex_ia_log").insert({
              usuario_id: userId,
              nombre_usuario: nombre,
              rol: rolPrincipal,
              modulo,
              pregunta: pregunta.slice(0, 2000),
              respuesta: respuesta.slice(0, 8000),
              origen,
              fuente,
              audiencia,
              tiempo_respuesta_ms: Date.now() - t0,
            });
          };

          const encoder = new TextEncoder();

          // Apoderado bloqueado por defecto
          if (roles.includes("apoderado") && !isAdmin) {
            const msg = "El acceso de clientes a NUVEX IA aún no está habilitado.";
            await registrar(msg, "escalado");
            const stream = new ReadableStream({
              start(c) {
                c.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "escalado", escalable: false })));
                c.enqueue(encoder.encode(sseEvent({ type: "token", value: msg })));
                c.enqueue(encoder.encode(sseEvent({ type: "done", filas: 0 })));
                c.close();
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }

          // PASO 0: KB
          const terms = pregunta.toLowerCase().replace(/[^\wáéíóúñü\s]/gi, " ").split(/\s+/).filter((t) => t.length >= 3).slice(0, 6);
          let kbQ = supabase
            .from("nuvex_kb")
            .select("id, categoria, pregunta, respuesta, tags, audiencias")
            .eq("estado", "activo")
            .overlaps("audiencias", [audiencia, "publico"])
            .limit(6);
          if (terms.length > 0) {
            kbQ = kbQ.or(terms.map((t) => `pregunta.ilike.%${t}%,respuesta.ilike.%${t}%,categoria.ilike.%${t}%`).join(","));
          }
          const { data: kbRaw } = await kbQ;
          type KBRow = { categoria: string; pregunta: string; respuesta: string };
          let articulos = (kbRaw ?? []) as KBRow[];
          if (modulo) {
            articulos = articulos.sort((a, b) =>
              (b.categoria.toLowerCase().includes(modulo) ? 1 : 0) - (a.categoria.toLowerCase().includes(modulo) ? 1 : 0));
          }
          const norm = (s: string) => s.toLowerCase().replace(/[¿?¡!.,;:]/g, "").trim();
          const np = norm(pregunta);
          const hit = articulos.find((a) => {
            const nq = norm(a.pregunta);
            return nq.length >= 8 && (np.includes(nq) || nq.includes(np));
          }) ?? null;

          if (hit) {
            const respuesta = `${hit.respuesta}\n\n*Fuente: NUVEX KB · ${hit.categoria}*`;
            await registrar(respuesta, "kb");
            const stream = new ReadableStream({
              start(c) {
                c.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "kb", escalable: false })));
                // Simular streaming por palabras para UX consistente
                const palabras = respuesta.split(/(\s+)/);
                let i = 0;
                const send = () => {
                  const chunk = palabras.slice(i, i + 3).join("");
                  if (chunk) c.enqueue(encoder.encode(sseEvent({ type: "token", value: chunk })));
                  i += 3;
                  if (i < palabras.length) setTimeout(send, 12);
                  else {
                    c.enqueue(encoder.encode(sseEvent({ type: "done", filas: 0 })));
                    c.close();
                  }
                };
                send();
              },
            });
            return new Response(stream, {
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
            });
          }

          // PASO 1: Clasificar dataset
          const clasResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: `Clasifica la pregunta en un dataset NUVEX. Datasets: ${DATASETS.join(", ")}. Si menciona cliente por nombre/cédula usa "buscar_cliente". Conceptual = "ninguno".` },
                { role: "user", content: pregunta },
              ],
              tools: [{
                type: "function",
                function: {
                  name: "elegir_dataset",
                  parameters: {
                    type: "object",
                    properties: {
                      dataset: { type: "string", enum: [...DATASETS] },
                      termino: { type: "string" },
                    },
                    required: ["dataset"], additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: "function", function: { name: "elegir_dataset" } },
            }),
          });

          let dataset = "ninguno";
          let termino = "";
          if (clasResp.ok) {
            const j = await clasResp.json();
            try {
              const a = JSON.parse(j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}");
              dataset = a.dataset ?? "ninguno";
              termino = (a.termino ?? "").trim();
            } catch { /* noop */ }
          }

          // PASO 2: Datos
          const restringeAsesor = !isAdmin;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let filas: any[] = [];
          const baseExp = () => {
            let q = supabase.from("expedientes").select("id, cliente_nombre, cedula, banco, estado_caso, honorarios_final, updated_at, asesor_id").limit(30);
            if (restringeAsesor) q = q.eq("asesor_id", userId);
            return q;
          };

          if (dataset === "casos_aprobados") {
            const { data: r } = await baseExp().in("estado_caso", ["aprobado", "aprobado_banco", "honorarios_pagados", "proceso_cerrado", "paz_y_salvo_generado"]); filas = r ?? [];
          } else if (dataset === "casos_negados") {
            const { data: r } = await baseExp().in("estado_caso", ["negado_banco", "devuelto_banco"]); filas = r ?? [];
          } else if (dataset === "casos_activos") {
            const { data: r } = await baseExp().not("estado_caso", "in", "(proceso_cerrado,caso_finalizado,negado_banco)"); filas = r ?? [];
          } else if (dataset === "casos_estancados" || dataset === "casos_sin_movimiento") {
            const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
            const { data: r } = await baseExp().lt("updated_at", hace15).not("estado_caso", "in", "(proceso_cerrado,caso_finalizado,negado_banco)"); filas = r ?? [];
          } else if (dataset === "expedientes_incompletos") {
            const { data: r } = await baseExp().in("estado_caso", ["lead_creado", "extracto_recibido", "documentacion_completa", "pendiente_contratacion"]); filas = r ?? [];
          } else if (dataset === "buscar_cliente" && termino) {
            let q = supabase.from("expedientes").select("id, cliente_nombre, cedula, banco, estado_caso, honorarios_final, updated_at, asesor_id").or(`cliente_nombre.ilike.%${termino}%,cedula.ilike.%${termino}%`).limit(20);
            if (restringeAsesor) q = q.eq("asesor_id", userId);
            const { data: r } = await q; filas = r ?? [];
          } else if (dataset === "honorarios_pendientes" || dataset === "clientes_morosos") {
            if (isJuridico && !isAdmin && !isContabilidad && !isLicenciado) {
              const msg = "Esta información está restringida para tu perfil de acceso.";
              await registrar(msg, "escalado");
              const stream = new ReadableStream({
                start(c) {
                  c.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "escalado", escalable: false })));
                  c.enqueue(encoder.encode(sseEvent({ type: "token", value: msg })));
                  c.enqueue(encoder.encode(sseEvent({ type: "done", filas: 0 })));
                  c.close();
                },
              });
              return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
            }
            let q = supabase.from("cartera").select("id, expediente_id, honorarios_totales, pagado, estado_cartera, fecha_vencimiento, responsable_id").limit(30);
            if (isLicenciado && !isAdmin) q = q.eq("responsable_id", userId);
            const { data: r } = await q;
            filas = (r ?? []).filter((c: { honorarios_totales: number; pagado: number }) => Number(c.honorarios_totales) - Number(c.pagado) > 0);
            if (dataset === "clientes_morosos") {
              const hoy = new Date().toISOString().slice(0, 10);
              filas = filas.filter((c: { fecha_vencimiento: string }) => c.fecha_vencimiento < hoy);
            }
          } else if (dataset === "cuentas_cobro_pendientes") {
            let q = supabase.from("cuentas_cobro").select("id, numero, total, estado, user_id, created_at").in("estado", ["borrador", "enviada", "en_revision"]).limit(30);
            if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
            const { data: r } = await q; filas = r ?? [];
          } else if (dataset === "cuentas_cobro_rechazadas") {
            let q = supabase.from("cuentas_cobro").select("id, numero, total, estado, motivo_devolucion, user_id, created_at").in("estado", ["rechazada", "devuelta"]).limit(30);
            if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
            const { data: r } = await q; filas = r ?? [];
          } else if (dataset === "facturacion_mes") {
            if (isJuridico && !isAdmin && !isContabilidad) {
              const msg = "Esta información está restringida para tu perfil de acceso.";
              await registrar(msg, "escalado");
              const stream = new ReadableStream({
                start(c) {
                  c.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "escalado", escalable: false })));
                  c.enqueue(encoder.encode(sseEvent({ type: "token", value: msg })));
                  c.enqueue(encoder.encode(sseEvent({ type: "done", filas: 0 })));
                  c.close();
                },
              });
              return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
            }
            const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0, 0, 0, 0);
            let q = supabase.from("cuentas_cobro").select("id, numero, total, estado, user_id, created_at").gte("created_at", mesIni.toISOString()).limit(50);
            if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
            const { data: r } = await q; filas = r ?? [];
          } else if (dataset === "comisiones_pendientes") {
            let q = supabase.from("comisiones").select("id, expediente_id, user_id, valor, comision_potencial, comision_pagada, estado").limit(30);
            if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
            const { data: r } = await q;
            filas = (r ?? []).filter((c: { comision_potencial: number; comision_pagada: number }) => Number(c.comision_potencial) - Number(c.comision_pagada) > 0);
          }

          // PASO 3: Modelo en streaming
          const kbBlock = articulos.length
            ? articulos.map((a, i) => `### [KB-${i + 1}] ${a.categoria} — ${a.pregunta}\n${a.respuesta}`).join("\n\n")
            : "No hay artículos relevantes en la base de conocimiento.";
          const datosBlock = filas.length
            ? `Dataset: ${dataset}\nRegistros (máx 15):\n${JSON.stringify(filas.slice(0, 15), null, 2)}`
            : "Sin datos estructurados para esta consulta.";
          const systemPrompt = `Eres **NUVEX IA**. Rol usuario: ${rolPrincipal}. Módulo: ${modulo ?? "ninguno"}. Origen: ${origen}.
Reglas: responde en español, profesional, Markdown. Usa SOLO KB + datos. Si no hay info suficiente responde EXACTAMENTE con la línea __ESCALAR__ y breve explicación. Respeta restricciones por rol.

BASE DE CONOCIMIENTO:
${kbBlock}

DATOS:
${datosBlock}`;

          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: pregunta },
              ],
              stream: true,
            }),
          });

          if (!aiResp.ok || !aiResp.body) {
            const status = aiResp.status;
            const msg = status === 429 ? "Límite de consultas alcanzado. Intenta en unos minutos."
              : status === 402 ? "Créditos de IA agotados."
              : "Error del servicio de IA.";
            await registrar(msg, "escalado");
            const stream = new ReadableStream({
              start(c) {
                c.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "escalado", escalable: true })));
                c.enqueue(encoder.encode(sseEvent({ type: "token", value: msg })));
                c.enqueue(encoder.encode(sseEvent({ type: "done", filas: filas.length })));
                c.close();
              },
            });
            return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
          }

          // Transformar SSE de OpenAI → eventos NUVEX, acumulando texto para log
          const stream = new ReadableStream({
            async start(controller) {
              controller.enqueue(encoder.encode(sseEvent({ type: "meta", fuente: "modelo", escalable: false })));
              const reader = aiResp.body!.getReader();
              const decoder = new TextDecoder();
              let buffer = "";
              let acumulado = "";
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split("\n");
                  buffer = lines.pop() ?? "";
                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;
                    const payload = trimmed.slice(5).trim();
                    if (payload === "[DONE]") continue;
                    try {
                      const j = JSON.parse(payload);
                      const delta = j.choices?.[0]?.delta?.content;
                      if (typeof delta === "string" && delta.length > 0) {
                        acumulado += delta;
                        controller.enqueue(encoder.encode(sseEvent({ type: "token", value: delta })));
                      }
                    } catch { /* ignore */ }
                  }
                }
                const escalable = acumulado.includes("__ESCALAR__");
                const respuestaFinal = escalable
                  ? (acumulado.replace(/__ESCALAR__/g, "").trim() || "No tengo suficiente información para responder con seguridad.")
                  : acumulado;
                await registrar(respuestaFinal, escalable ? "escalado" : "modelo");
                controller.enqueue(encoder.encode(sseEvent({
                  type: "done", filas: filas.length, escalable, dataset,
                })));
              } catch (e) {
                console.error("nuvex-ia-stream error", e);
                controller.enqueue(encoder.encode(sseEvent({ type: "error", message: "Error al transmitir" })));
              } finally {
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          });
        } catch (e) {
          console.error("nuvex-ia-stream fatal", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Error" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
