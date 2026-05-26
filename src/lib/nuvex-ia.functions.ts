import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Helpers de rol
// ============================================================
async function getRoles(
  supabase: { from: (t: "user_roles") => { select: (c: string) => { eq: (col: string, v: string) => Promise<{ data: Array<{ role: string }> | null }> } } },
  userId: string,
): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role);
}

function alcance(roles: string[]) {
  const isAdmin = roles.some((r) => ["super_admin", "admin", "gerencia"].includes(r));
  const isContabilidad = roles.includes("contabilidad");
  const isJuridico = roles.some((r) => ["juridica", "director_juridico"].includes(r));
  const isCartera = roles.includes("cartera");
  const isLicenciado = roles.includes("licenciado");
  return { isAdmin, isContabilidad, isJuridico, isCartera, isLicenciado };
}

/**
 * Resuelve la "audiencia" del usuario en base a sus roles.
 * Determina qué artículos KB puede ver y se registra en auditoría.
 */
function resolverAudiencia(roles: string[]): "interno" | "apoderado" | "cliente" {
  if (roles.includes("apoderado")) return "apoderado";
  if (roles.includes("cliente")) return "cliente";
  return "interno"; // staff NUVEX por defecto
}


// ============================================================
// MÉTRICAS IA
// ============================================================
export const getMetricasIA = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    const roles = await getRoles(supabase, userId);
    const { isAdmin, isLicenciado } = alcance(roles);

    const expBase = supabase.from("expedientes").select("id, estado, estado_caso, asesor_id, honorarios_final, fecha_simulacion, updated_at", { count: "exact" });
    const exp = isAdmin ? expBase : expBase.eq("asesor_id", userId);
    const { data: expedientes } = await exp;
    const lista = (expedientes ?? []) as Array<{ id: string; estado: string; estado_caso: string; honorarios_final: number | null; updated_at: string }>;

    const activos = lista.filter((e) => !["proceso_cerrado", "caso_finalizado", "negado_banco"].includes(e.estado_caso)).length;
    const aprobados = lista.filter((e) => ["aprobado", "aprobado_banco", "honorarios_pagados", "paz_y_salvo_generado", "proceso_cerrado"].includes(e.estado_caso)).length;
    const hace15 = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const estancados = lista.filter((e) => new Date(e.updated_at).getTime() < hace15 && !["proceso_cerrado", "caso_finalizado", "negado_banco"].includes(e.estado_caso)).length;

    // Cartera
    const carteraQ = supabase.from("cartera").select("honorarios_totales, pagado, estado_cartera, responsable_id");
    const carteraResp = isLicenciado && !isAdmin ? await carteraQ.eq("responsable_id", userId) : await carteraQ;
    const cartera = ((carteraResp.data ?? []) as Array<{ honorarios_totales: number; pagado: number; estado_cartera: string }>);
    const honorariosPendientes = cartera.reduce((s, c) => s + (Number(c.honorarios_totales) - Number(c.pagado)), 0);

    // Cuentas de cobro del mes
    const mesIni = new Date();
    mesIni.setDate(1); mesIni.setHours(0, 0, 0, 0);
    const ccQ = supabase.from("cuentas_cobro").select("total, estado, user_id, created_at").gte("created_at", mesIni.toISOString());
    const ccResp = isLicenciado && !isAdmin ? await ccQ.eq("user_id", userId) : await ccQ;
    const ccs = ((ccResp.data ?? []) as Array<{ total: number; estado: string }>);
    const facturacionMes = ccs.filter((c) => ["pagada", "aprobada", "enviada"].includes(c.estado)).reduce((s, c) => s + Number(c.total), 0);

    const comQ = supabase.from("comisiones").select("comision_potencial, comision_pagada, estado, user_id");
    const comResp = isLicenciado && !isAdmin ? await comQ.eq("user_id", userId) : await comQ;
    const coms = ((comResp.data ?? []) as Array<{ comision_potencial: number; comision_pagada: number; estado: string }>);
    const comisionesPendientes = coms.reduce((s, c) => s + Math.max(0, Number(c.comision_potencial) - Number(c.comision_pagada)), 0);

    return { activos, aprobados, estancados, honorariosPendientes, facturacionMes, comisionesPendientes };
  });

// ============================================================
// ALERTAS INTELIGENTES
// ============================================================
export const getAlertasInteligentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    const roles = await getRoles(supabase, userId);
    const { isAdmin, isLicenciado } = alcance(roles);

    const alertas: Array<{ tipo: string; titulo: string; descripcion: string; severidad: "alta" | "media" | "baja"; cantidad: number }> = [];

    // Casos sin movimiento 15 días
    const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    let q1 = supabase.from("expedientes").select("id, cliente_nombre, updated_at, asesor_id, estado_caso", { count: "exact", head: false }).lt("updated_at", hace15).not("estado_caso", "in", "(proceso_cerrado,caso_finalizado,negado_banco)");
    if (!isAdmin) q1 = q1.eq("asesor_id", userId);
    const { data: sinMov } = await q1;
    if ((sinMov ?? []).length > 0) {
      alertas.push({ tipo: "sin_movimiento", titulo: "Casos sin movimiento", descripcion: `${sinMov!.length} expedientes sin actividad en los últimos 15 días`, severidad: "media", cantidad: sinMov!.length });
    }

    // Honorarios vencidos
    const hoy = new Date().toISOString().slice(0, 10);
    const cartQ = supabase.from("cartera").select("id, fecha_vencimiento, honorarios_totales, pagado, responsable_id, estado_cartera").lt("fecha_vencimiento", hoy).neq("estado_cartera", "pago_total").neq("estado_cartera", "cerrado");
    const cartResp = isLicenciado && !isAdmin ? await cartQ.eq("responsable_id", userId) : await cartQ;
    const vencidos = (cartResp.data ?? []).filter((c: { honorarios_totales: number; pagado: number }) => Number(c.honorarios_totales) - Number(c.pagado) > 0);
    if (vencidos.length > 0) {
      alertas.push({ tipo: "honorarios_vencidos", titulo: "Honorarios vencidos", descripcion: `${vencidos.length} carteras con honorarios pendientes vencidos`, severidad: "alta", cantidad: vencidos.length });
    }

    // Cuentas de cobro pendientes
    const ccQ = supabase.from("cuentas_cobro").select("id, estado, user_id").in("estado", ["borrador", "enviada", "en_revision"]);
    const ccResp = isLicenciado && !isAdmin ? await ccQ.eq("user_id", userId) : await ccQ;
    if ((ccResp.data ?? []).length > 0) {
      alertas.push({ tipo: "cc_pendientes", titulo: "Cuentas de cobro pendientes", descripcion: `${ccResp.data.length} cuentas en revisión o sin enviar`, severidad: "media", cantidad: ccResp.data.length });
    }

    // Aprobados sin cuenta de cobro
    let q4 = supabase.from("expedientes").select("id, asesor_id, estado_caso").in("estado_caso", ["aprobado_banco", "aprobado", "resultado_final_generado"]);
    if (!isAdmin) q4 = q4.eq("asesor_id", userId);
    const { data: aprobados } = await q4;
    if ((aprobados ?? []).length > 0) {
      alertas.push({ tipo: "aprobados_sin_factura", titulo: "Casos aprobados sin facturar", descripcion: `${aprobados!.length} casos aprobados pendientes de cuenta de cobro`, severidad: "alta", cantidad: aprobados!.length });
    }

    // Facturados sin pago
    const cartFact = (cartResp.data ?? []).filter((c: { estado_cartera: string; honorarios_totales: number; pagado: number }) => ["cuenta_cobro_generada", "cuenta_cobro_enviada", "pago_parcial"].includes(c.estado_cartera) && Number(c.pagado) < Number(c.honorarios_totales));
    if (cartFact.length > 0) {
      alertas.push({ tipo: "facturados_sin_pago", titulo: "Facturados sin pago completo", descripcion: `${cartFact.length} carteras facturadas con pago pendiente`, severidad: "media", cantidad: cartFact.length });
    }

    return { alertas };
  });

// ============================================================
// CONSULTA EN LENGUAJE NATURAL
// ============================================================
const DATASETS = [
  "casos_aprobados", "casos_negados", "casos_estancados", "casos_activos", "casos_sin_movimiento",
  "expedientes_incompletos",
  "honorarios_pendientes", "clientes_morosos",
  "cuentas_cobro_pendientes", "cuentas_cobro_rechazadas", "facturacion_mes",
  "comisiones_pendientes",
  "buscar_cliente",
  "ninguno",
] as const;

// ============================================================
// Búsqueda en NUVEX KB (base de conocimiento)
// ============================================================
type KBRow = { id: string; categoria: string; pregunta: string; respuesta: string; tags: string[] | null; audiencias?: string[] | null };

async function buscarKB(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  pregunta: string,
  modulo: string | null,
  audiencia: "interno" | "apoderado" | "cliente",
): Promise<{ hit: KBRow | null; contexto: KBRow[] }> {
  const terms = pregunta
    .toLowerCase()
    .replace(/[^\wáéíóúñü\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);

  // Filtro de audiencia: el artículo debe contener la audiencia del usuario
  // o estar marcado como "publico" (visible para todos).
  let q = supabase
    .from("nuvex_kb")
    .select("id, categoria, pregunta, respuesta, tags, audiencias")
    .eq("estado", "activo")
    .overlaps("audiencias", [audiencia, "publico"])
    .limit(6);

  if (terms.length > 0) {
    const orFilter = terms
      .map((t) => `pregunta.ilike.%${t}%,respuesta.ilike.%${t}%,categoria.ilike.%${t}%`)
      .join(",");
    q = q.or(orFilter);
  }

  const { data } = await q;
  let articulos = (data ?? []) as KBRow[];

  if (modulo) {
    articulos = articulos.sort((a, b) => {
      const sa = a.categoria.toLowerCase().includes(modulo) ? 1 : 0;
      const sb = b.categoria.toLowerCase().includes(modulo) ? 1 : 0;
      return sb - sa;
    });
  }

  const norm = (s: string) => s.toLowerCase().replace(/[¿?¡!.,;:]/g, "").trim();
  const np = norm(pregunta);
  const hit = articulos.find((a) => {
    const nq = norm(a.pregunta);
    if (nq.length < 8) return false;
    return np.includes(nq) || nq.includes(np);
  }) ?? null;

  return { hit, contexto: articulos };
}


async function registrarLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  params: {
    userId: string;
    nombre: string | null;
    rol: string;
    modulo: string | null;
    pregunta: string;
    respuesta: string;
    origen: "nuvex_ia" | "nuvex_gpt" | "cliente";
    fuente: "kb" | "modelo" | "escalado";
    tiempoMs: number;
    audiencia: "interno" | "apoderado" | "cliente";
  },
) {
  await supabase.from("nuvex_ia_log").insert({
    usuario_id: params.userId,
    nombre_usuario: params.nombre,
    rol: params.rol,
    modulo: params.modulo,
    pregunta: params.pregunta.slice(0, 2000),
    respuesta: params.respuesta.slice(0, 8000),
    origen: params.origen,
    fuente: params.fuente,
    tiempo_respuesta_ms: params.tiempoMs,
    audiencia: params.audiencia,
  });
}


export const consultarIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      pregunta: z.string().min(2).max(1000),
      modulo: z.string().max(60).nullable().optional(),
      origen: z.enum(["nuvex_ia", "nuvex_gpt", "cliente"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const t0 = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const userId = context.userId as string;
    const roles = await getRoles(supabase, userId);
    const { isAdmin, isContabilidad, isJuridico, isLicenciado } = alcance(roles);
    const rolPrincipal =
      roles.find((r) => ["super_admin", "admin", "gerencia"].includes(r)) ?? roles[0] ?? "licenciado";
    const modulo = (data.modulo ?? "").toLowerCase() || null;
    const origen = data.origen ?? "nuvex_ia";
    const audiencia = resolverAudiencia(roles);


    // Restricción: apoderado no usa la página completa
    if (roles.includes("apoderado") && !isAdmin) {
      const msg = "El acceso de clientes a NUVEX IA aún no está habilitado.";
      await registrarLog(supabase, {
        userId, nombre: null, rol: "apoderado", modulo,
        pregunta: data.pregunta, respuesta: msg,
        origen, fuente: "escalado", tiempoMs: Date.now() - t0, audiencia,
      });
      return { respuesta: msg, filas: [], dataset: "ninguno", fuente: "escalado", escalable: false };
    }

    // Nombre del usuario (best-effort)
    const { data: prof } = await supabase.from("profiles").select("nombre").eq("id", userId).maybeSingle();
    const nombre = (prof?.nombre as string) ?? null;

    // ────────────────────────────────────────────
    // PASO 0: Búsqueda en NUVEX KB (cero tokens)
    // ────────────────────────────────────────────
    const { hit, contexto: kbContexto } = await buscarKB(supabase, data.pregunta, modulo, audiencia);
    if (hit) {
      const respuesta = `${hit.respuesta}\n\n*Fuente: NUVEX KB · ${hit.categoria}*`;
      await registrarLog(supabase, {
        userId, nombre, rol: rolPrincipal, modulo,
        pregunta: data.pregunta, respuesta,
        origen, fuente: "kb", tiempoMs: Date.now() - t0, audiencia,
      });
      return { respuesta, filas: [], dataset: "kb", fuente: "kb", escalable: false };
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      const msg = "El servicio de IA no está configurado.";
      await registrarLog(supabase, {
        userId, nombre, rol: rolPrincipal, modulo,
        pregunta: data.pregunta, respuesta: msg,
        origen, fuente: "escalado", tiempoMs: Date.now() - t0, audiencia,
      });
      return { respuesta: msg, filas: [], dataset: "ninguno", fuente: "escalado", escalable: true };
    }

    // ────────────────────────────────────────────
    // PASO 1: Clasificar intención con tool calling
    // ────────────────────────────────────────────
    const clasResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `Eres un clasificador. Convierte la pregunta del usuario en un dataset a consultar en NUVEX. Datasets disponibles: ${DATASETS.join(", ")}. Si la pregunta menciona un cliente por nombre o cédula usa "buscar_cliente" y extrae el término. Si es una pregunta conceptual / procedimental, responde "ninguno".` },
          { role: "user", content: data.pregunta },
        ],
        tools: [{
          type: "function",
          function: {
            name: "elegir_dataset",
            description: "Selecciona el dataset y término de búsqueda opcional",
            parameters: {
              type: "object",
              properties: {
                dataset: { type: "string", enum: [...DATASETS] },
                termino: { type: "string", description: "Nombre o cédula del cliente si aplica" },
              },
              required: ["dataset"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "elegir_dataset" } },
      }),
    });

    let dataset = "ninguno";
    let termino = "";
    if (clasResp.ok) {
      const clasJson = await clasResp.json();
      const toolCall = clasJson.choices?.[0]?.message?.tool_calls?.[0];
      try {
        const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
        dataset = args.dataset ?? "ninguno";
        termino = (args.termino ?? "").trim();
      } catch { /* noop */ }
    }

    // ────────────────────────────────────────────
    // PASO 2: Ejecutar query según dataset (RLS aplica)
    // ────────────────────────────────────────────
    const restringeAsesor = !isAdmin;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filas: any[] = [];

    const baseExp = () => {
      let q = supabase.from("expedientes").select("id, cliente_nombre, cedula, banco, estado_caso, honorarios_final, updated_at, asesor_id").limit(30);
      if (restringeAsesor) q = q.eq("asesor_id", userId);
      return q;
    };

    if (dataset === "casos_aprobados") {
      const { data: r } = await baseExp().in("estado_caso", ["aprobado", "aprobado_banco", "honorarios_pagados", "proceso_cerrado", "paz_y_salvo_generado"]);
      filas = r ?? [];
    } else if (dataset === "casos_negados") {
      const { data: r } = await baseExp().in("estado_caso", ["negado_banco", "devuelto_banco"]);
      filas = r ?? [];
    } else if (dataset === "casos_activos") {
      const { data: r } = await baseExp().not("estado_caso", "in", "(proceso_cerrado,caso_finalizado,negado_banco)");
      filas = r ?? [];
    } else if (dataset === "casos_estancados" || dataset === "casos_sin_movimiento") {
      const hace15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const { data: r } = await baseExp().lt("updated_at", hace15).not("estado_caso", "in", "(proceso_cerrado,caso_finalizado,negado_banco)");
      filas = r ?? [];
    } else if (dataset === "expedientes_incompletos") {
      const { data: r } = await baseExp().in("estado_caso", ["lead_creado", "extracto_recibido", "documentacion_completa", "pendiente_contratacion"]);
      filas = r ?? [];
    } else if (dataset === "buscar_cliente" && termino) {
      let q = supabase.from("expedientes").select("id, cliente_nombre, cedula, banco, estado_caso, honorarios_final, updated_at, asesor_id").or(`cliente_nombre.ilike.%${termino}%,cedula.ilike.%${termino}%`).limit(20);
      if (restringeAsesor) q = q.eq("asesor_id", userId);
      const { data: r } = await q;
      filas = r ?? [];
    } else if (dataset === "honorarios_pendientes" || dataset === "clientes_morosos") {
      if (isJuridico && !isAdmin && !isContabilidad && !isLicenciado) {
        const msg = "Esta información está restringida para tu perfil de acceso.";
        await registrarLog(supabase, { userId, nombre, rol: rolPrincipal, modulo, pregunta: data.pregunta, respuesta: msg, origen, fuente: "escalado", tiempoMs: Date.now() - t0, audiencia });
        return { respuesta: msg, filas: [], dataset, fuente: "escalado", escalable: false };
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
      const { data: r } = await q;
      filas = r ?? [];
    } else if (dataset === "cuentas_cobro_rechazadas") {
      let q = supabase.from("cuentas_cobro").select("id, numero, total, estado, motivo_devolucion, user_id, created_at").in("estado", ["rechazada", "devuelta"]).limit(30);
      if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
      const { data: r } = await q;
      filas = r ?? [];
    } else if (dataset === "facturacion_mes") {
      if (isJuridico && !isAdmin && !isContabilidad) {
        const msg = "Esta información está restringida para tu perfil de acceso.";
        await registrarLog(supabase, { userId, nombre, rol: rolPrincipal, modulo, pregunta: data.pregunta, respuesta: msg, origen, fuente: "escalado", tiempoMs: Date.now() - t0, audiencia });
        return { respuesta: msg, filas: [], dataset, fuente: "escalado", escalable: false };
      }
      const mesIni = new Date(); mesIni.setDate(1); mesIni.setHours(0, 0, 0, 0);
      let q = supabase.from("cuentas_cobro").select("id, numero, total, estado, user_id, created_at").gte("created_at", mesIni.toISOString()).limit(50);
      if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
      const { data: r } = await q;
      filas = r ?? [];
    } else if (dataset === "comisiones_pendientes") {
      let q = supabase.from("comisiones").select("id, expediente_id, user_id, valor, comision_potencial, comision_pagada, estado").limit(30);
      if (isLicenciado && !isAdmin) q = q.eq("user_id", userId);
      const { data: r } = await q;
      filas = (r ?? []).filter((c: { comision_potencial: number; comision_pagada: number }) => Number(c.comision_potencial) - Number(c.comision_pagada) > 0);
    }

    // ────────────────────────────────────────────
    // PASO 3: Generar respuesta con el modelo
    // ────────────────────────────────────────────
    const kbBlock = kbContexto.length
      ? kbContexto.map((a, i) => `### [KB-${i + 1}] ${a.categoria} — ${a.pregunta}\n${a.respuesta}`).join("\n\n")
      : "No hay artículos relevantes en la base de conocimiento.";

    const datosBlock = filas.length
      ? `Dataset: ${dataset}\nRegistros (máx 15):\n${JSON.stringify(filas.slice(0, 15), null, 2)}`
      : "Sin datos estructurados para esta consulta.";

    const restriccionesBlock = `RESTRICCIONES POR ROL (${rolPrincipal}):
- Licenciado: solo sus propios casos, comisiones y cartera asignada.
- Contabilidad: finanzas, comisiones y cartera (todos).
- Jurídica: casos en flujo jurídico; no ve comisiones de terceros.
- Operaciones: casos en flujo operativo.
- Apoderado: solo sus propios casos; bloqueado por defecto.
- Super Admin / Gerencia: acceso total.
Si la pregunta excede tu rol, responde: "Esta información está restringida para tu perfil de acceso."`;

    const systemPrompt = `Eres **NUVEX IA**, el cerebro único de IA de NUVEX Finanzas Inteligentes.

Contexto:
- Usuario rol: ${rolPrincipal}
- Módulo actual: ${modulo ?? "ninguno"}
- Origen: ${origen}

Reglas:
1. Responde en español, profesional, ejecutivo, en Markdown.
2. Usa SOLO la información provista (KB + datos). Nunca inventes leyes, decretos, tarifas ni cifras.
3. Si los datos están vacíos y la KB no cubre la pregunta, responde EXACTAMENTE con la línea:
   __ESCALAR__
   y debajo una breve explicación de por qué necesitas escalar.
4. Respeta las restricciones por rol.
5. Si la consulta es de un cliente futuro (origen=cliente), nunca reveles datos internos (comisiones, cartera global, honorarios de terceros).

${restriccionesBlock}

BASE DE CONOCIMIENTO RELEVANTE:
${kbBlock}

DATOS ESTRUCTURADOS:
${datosBlock}`;

    const redactResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: data.pregunta },
        ],
      }),
    });

    let respuesta = "No pude generar la respuesta.";
    if (redactResp.ok) {
      const j = await redactResp.json();
      respuesta = j.choices?.[0]?.message?.content ?? respuesta;
    }

    const escalable = respuesta.includes("__ESCALAR__");
    if (escalable) {
      respuesta = respuesta.replace(/__ESCALAR__/g, "").trim() ||
        "No tengo suficiente información para responder esta consulta con seguridad.";
    }

    await registrarLog(supabase, {
      userId, nombre, rol: rolPrincipal, modulo,
      pregunta: data.pregunta, respuesta,
      origen, fuente: escalable ? "escalado" : "modelo", audiencia,
      tiempoMs: Date.now() - t0,
    });

    return {
      respuesta,
      filas,
      dataset,
      fuente: escalable ? "escalado" : "modelo", audiencia,
      escalable,
    };
  });
