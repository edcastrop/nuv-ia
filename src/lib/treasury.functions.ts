// NUVIA Treasury AI · Fase 1 MVP — Motor de conciliación bancaria.
// Sólo lectura sobre tablas existentes (cartera, cuentas_cobro, honorarios_calculos, clientes, expedientes).
// Escritura sobre treasury_*. Propaga conciliaciones a cartera_pagos / pago_conciliacion sólo al confirmar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────── Tipos ───────────────────────────
export type MovParsed = {
  fecha: string; // YYYY-MM-DD
  valor: number;
  tipo: "credito" | "debito";
  descripcion_raw?: string | null;
  referencia?: string | null;
  contraparte?: string | null;
  canal?: string | null;
};

// ─────────────────────────── Auditoría helper ───────────────────────────
async function audit(
  supabase: any,
  userId: string,
  entidad: string,
  entidad_id: string | null,
  accion: string,
  valor_anterior: unknown,
  valor_nuevo: unknown,
) {
  await supabase.from("treasury_auditoria" as never).insert({
    entidad,
    entidad_id,
    accion,
    valor_anterior: (valor_anterior ?? null) as never,
    valor_nuevo: (valor_nuevo ?? null) as never,
    user_id: userId,
  } as never);
}

// ─────────────────────────── KPIs Dashboard ───────────────────────────
export const treasuryKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

    const [bancos, movsMes, movsConc, movsPend, cartera, ccPend, alertas] = await Promise.all([
      supabase.from("treasury_bancos" as never).select("saldo_actual").eq("activo", true),
      supabase
        .from("treasury_movimientos" as never)
        .select("valor,tipo")
        .gte("fecha", firstOfMonth),
      supabase
        .from("treasury_movimientos" as never)
        .select("id", { count: "exact", head: true })
        .eq("estado_match", "conciliado"),
      supabase
        .from("treasury_movimientos" as never)
        .select("id", { count: "exact", head: true })
        .in("estado_match", ["no_identificado", "sugerido"]),
      supabase
        .from("cartera" as never)
        .select("honorarios_totales,pagado,estado_cartera"),
      supabase
        .from("cuentas_cobro" as never)
        .select("total")
        .in("estado", ["enviada", "aprobada", "pendiente"]),
      supabase
        .from("treasury_movimientos" as never)
        .select("id", { count: "exact", head: true })
        .eq("estado_match", "no_identificado"),
    ]);

    const saldoBancario = ((bancos.data ?? []) as Array<{ saldo_actual: number }>).reduce(
      (a, b) => a + Number(b.saldo_actual || 0),
      0,
    );
    const ingresosMes = ((movsMes.data ?? []) as Array<{ valor: number; tipo: string }>)
      .filter((m) => m.tipo === "credito")
      .reduce((a, b) => a + Number(b.valor), 0);
    const carteraPendiente = ((cartera.data ?? []) as Array<{ honorarios_totales: number; pagado: number }>)
      .reduce((a, b) => a + Math.max(0, Number(b.honorarios_totales) - Number(b.pagado)), 0);
    const honorariosPendientes = ((ccPend.data ?? []) as Array<{ total: number }>).reduce(
      (a, b) => a + Number(b.total),
      0,
    );

    return {
      saldoBancario,
      ingresosMes,
      conciliados: movsConc.count ?? 0,
      pendientes: movsPend.count ?? 0,
      carteraPendiente,
      honorariosPendientes,
      flujo30: carteraPendiente + honorariosPendientes, // determinístico Fase 1
      alertas: alertas.count ?? 0,
    };
  });

// ─────────────────────────── Bancos ───────────────────────────
export const listBancos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treasury_bancos" as never)
      .select("*")
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      nombre: string;
      alias: string | null;
      numero_cuenta: string | null;
      saldo_actual: number;
      activo: boolean;
    }>;
  });

export const upsertBanco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nombre: z.string().min(2).max(120),
        alias: z.string().max(60).optional(),
        numero_cuenta: z.string().max(60).optional(),
        saldo_actual: z.number().min(0).default(0),
        activo: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      nombre: data.nombre,
      alias: data.alias ?? null,
      numero_cuenta: data.numero_cuenta ?? null,
      saldo_actual: data.saldo_actual,
      activo: data.activo,
    };
    let id = data.id;
    if (id) {
      const { error } = await supabase.from("treasury_bancos" as never).update(payload as never).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await supabase
        .from("treasury_bancos" as never)
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      id = (ins as { id: string }).id;
    }
    await audit(supabase, userId, "banco", id!, data.id ? "actualizado" : "creado", null, payload);
    return { ok: true, id };
  });

// ─────────────────────────── Listado de extractos ───────────────────────────
export const listExtractos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treasury_extractos" as never)
      .select("id,archivo_nombre,formato,periodo_inicio,periodo_fin,total_movs,total_ingresos,total_egresos,estado,banco_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      archivo_nombre: string;
      formato: string;
      periodo_inicio: string | null;
      periodo_fin: string | null;
      total_movs: number;
      total_ingresos: number;
      total_egresos: number;
      estado: "procesando" | "listo" | "error";
      banco_id: string | null;
      created_at: string;
    }>;
  });

// ─────────────────────────── Parser CSV/TXT ───────────────────────────
function parseCsv(text: string): MovParsed[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const sep = (lines[0].includes(";") ? ";" : ",");
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (n: string[]) => {
    for (const x of n) {
      const i = header.indexOf(x);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iFecha = idx(["fecha", "date"]);
  const iValor = idx(["valor", "monto", "amount", "importe"]);
  const iTipo = idx(["tipo", "type", "movimiento"]);
  const iDesc = idx(["descripcion", "descripción", "description", "concepto", "detalle"]);
  const iRef = idx(["referencia", "reference", "ref", "documento"]);

  const out: MovParsed[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = lines[r].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 2) continue;
    const fechaRaw = iFecha >= 0 ? cols[iFecha] : "";
    const valorRaw = iValor >= 0 ? cols[iValor] : "";
    const valor = Number(valorRaw.replace(/[^\d\-.,]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    if (!isFinite(valor)) continue;
    let fecha = fechaRaw;
    // Normalize dd/mm/yyyy or dd-mm-yyyy
    const dm = fechaRaw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dm) fecha = `${dm[3]}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
    const tipoRaw = (iTipo >= 0 ? cols[iTipo] : "").toLowerCase();
    let tipo: "credito" | "debito" =
      valor < 0 || /deb|egreso|retiro|pago|salida/.test(tipoRaw) ? "debito" : "credito";
    out.push({
      fecha,
      valor: Math.abs(valor),
      tipo,
      descripcion_raw: iDesc >= 0 ? cols[iDesc] : null,
      referencia: iRef >= 0 ? cols[iRef] : null,
    });
  }
  return out;
}

// ─────────────────────────── Ingest Extracto ───────────────────────────
export const ingestExtracto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        banco_id: z.string().uuid().nullable(),
        archivo_nombre: z.string().min(1).max(255),
        formato: z.enum(["csv", "txt", "pdf", "xlsx"]),
        contenido_texto: z.string().max(2_000_000).optional(), // CSV/TXT
        contenido_base64: z.string().max(8_000_000).optional(), // PDF
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Insert extracto en estado procesando
    const { data: ext, error: extErr } = await supabase
      .from("treasury_extractos" as never)
      .insert({
        banco_id: data.banco_id,
        archivo_nombre: data.archivo_nombre,
        formato: data.formato,
        estado: "procesando",
        uploaded_by: userId,
        parse_log: {} as never,
      } as never)
      .select("id")
      .single();
    if (extErr) throw new Error(extErr.message);
    const extracto_id = (ext as { id: string }).id;

    let movs: MovParsed[] = [];
    const parseLog: Record<string, unknown> = {};

    try {
      if ((data.formato === "csv" || data.formato === "txt") && data.contenido_texto) {
        movs = parseCsv(data.contenido_texto);
        parseLog.parser = "csv-native";
      } else if (data.formato === "pdf" && data.contenido_base64) {
        // AI Gateway parsing
        const key = process.env.LOVABLE_API_KEY;
        if (!key) throw new Error("LOVABLE_API_KEY no configurado");
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": key,
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Eres un extractor de movimientos bancarios. Devuelve SOLO JSON válido con la estructura {\"movimientos\":[{\"fecha\":\"YYYY-MM-DD\",\"valor\":number,\"tipo\":\"credito|debito\",\"descripcion_raw\":string,\"referencia\":string|null}]}. Nada de texto adicional.",
              },
              {
                role: "user",
                content: [
                  { type: "text", text: "Extrae todos los movimientos del siguiente extracto bancario PDF." },
                  {
                    type: "file",
                    file: {
                      filename: data.archivo_nombre,
                      file_data: `data:application/pdf;base64,${data.contenido_base64}`,
                    },
                  },
                ],
              },
            ],
            response_format: { type: "json_object" },
          }),
        });
        if (!aiResp.ok) {
          const txt = await aiResp.text();
          throw new Error(`AI Gateway ${aiResp.status}: ${txt.slice(0, 200)}`);
        }
        const aiJson = await aiResp.json();
        const content = aiJson.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(content);
        movs = Array.isArray(parsed.movimientos) ? parsed.movimientos : [];
        parseLog.parser = "ai-gemini";
      } else if (data.formato === "xlsx") {
        throw new Error("XLSX no soportado en MVP. Exporta a CSV o sube el PDF.");
      } else {
        throw new Error("Contenido vacío o formato no soportado.");
      }

      if (!movs.length) throw new Error("No se detectaron movimientos en el archivo.");

      // 2) Insertar movimientos
      const ingresos = movs.filter((m) => m.tipo === "credito").reduce((a, b) => a + Number(b.valor), 0);
      const egresos = movs.filter((m) => m.tipo === "debito").reduce((a, b) => a + Number(b.valor), 0);
      const fechas = movs.map((m) => m.fecha).filter(Boolean).sort();
      const rows = movs.map((m) => ({
        extracto_id,
        fecha: m.fecha,
        valor: m.valor,
        tipo: m.tipo,
        descripcion_raw: m.descripcion_raw ?? null,
        referencia: m.referencia ?? null,
        contraparte: m.contraparte ?? null,
        canal: m.canal ?? null,
      }));
      const { error: insMovErr } = await supabase.from("treasury_movimientos" as never).insert(rows as never);
      if (insMovErr) throw new Error(insMovErr.message);

      // 3) Actualizar extracto
      await supabase
        .from("treasury_extractos" as never)
        .update({
          estado: "listo",
          total_movs: movs.length,
          total_ingresos: ingresos,
          total_egresos: egresos,
          periodo_inicio: fechas[0] ?? null,
          periodo_fin: fechas[fechas.length - 1] ?? null,
          parse_log: parseLog as never,
        } as never)
        .eq("id", extracto_id);

      await audit(supabase, userId, "extracto", extracto_id, "cargado", null, {
        archivo: data.archivo_nombre,
        total_movs: movs.length,
      });

      return { ok: true, extracto_id, total_movs: movs.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("treasury_extractos" as never)
        .update({ estado: "error", parse_log: { error: msg } as never } as never)
        .eq("id", extracto_id);
      throw new Error(msg);
    }
  });

// ─────────────────────────── Match Engine ───────────────────────────
type Candidato = {
  match_tipo: "cartera" | "cuenta_cobro" | "honorario" | "comision" | "otro";
  match_id: string;
  score: number;
  motivo: Record<string, unknown>;
};

export const runMatchEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ extracto_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Cargar config umbrales
    const { data: cfg } = await supabase
      .from("treasury_config" as never)
      .select("key,value")
      .in("key", ["umbral_auto_conciliar", "umbral_sugerir", "tolerancia_pct"]);
    const cfgMap = new Map<string, number>(
      ((cfg ?? []) as Array<{ key: string; value: any }>).map((r) => [r.key, Number(r.value)]),
    );
    const umbralAuto = cfgMap.get("umbral_auto_conciliar") ?? 92;
    const umbralSug = cfgMap.get("umbral_sugerir") ?? 70;
    const tolPct = cfgMap.get("tolerancia_pct") ?? 1.5;

    // Movimientos a procesar (sólo créditos no_identificados)
    const { data: movs } = await supabase
      .from("treasury_movimientos" as never)
      .select("id,fecha,valor,descripcion_raw,referencia")
      .eq("extracto_id", data.extracto_id)
      .eq("tipo", "credito")
      .eq("estado_match", "no_identificado");

    // Reglas activas
    const { data: rules } = await supabase
      .from("treasury_match_rules" as never)
      .select("id,patron,match_tipo,match_id_default,cliente_id_default")
      .eq("activa", true);

    // Universos de cruce
    const { data: carteras } = await supabase
      .from("cartera" as never)
      .select("id,honorarios_totales,pagado,expediente_id,expedientes!inner(id,cliente_nombre,cedula)")
      .neq("estado_cartera", "pagado");
    const { data: ccs } = await supabase
      .from("cuentas_cobro" as never)
      .select("id,numero,total,estado")
      .in("estado", ["enviada", "aprobada", "pendiente"]);

    let conciliados = 0;
    let sugeridos = 0;

    for (const m of (movs ?? []) as Array<{
      id: string;
      fecha: string;
      valor: number;
      descripcion_raw: string | null;
      referencia: string | null;
    }>) {
      const desc = (m.descripcion_raw ?? "").toLowerCase();
      const ref = (m.referencia ?? "").toLowerCase();
      const candidatos: Candidato[] = [];

      // 1) Reglas aprendidas (boost +15)
      for (const r of (rules ?? []) as Array<{
        id: string;
        patron: string;
        match_tipo: any;
        match_id_default: string | null;
      }>) {
        try {
          const re = new RegExp(r.patron, "i");
          if ((desc && re.test(desc)) || (ref && re.test(ref))) {
            if (r.match_id_default) {
              candidatos.push({
                match_tipo: r.match_tipo,
                match_id: r.match_id_default,
                score: 60,
                motivo: { regla: r.id, boost: 15 },
              });
            }
          }
        } catch {
          /* regex inválido, ignorar */
        }
      }

      // 2) Cruce contra cartera (saldo pendiente)
      for (const c of (carteras ?? []) as Array<{
        id: string;
        honorarios_totales: number;
        pagado: number;
        expedientes: { cliente_nombre: string | null; cedula: string | null } | any;
      }>) {
        const saldo = Number(c.honorarios_totales) - Number(c.pagado);
        if (saldo <= 0) continue;
        const exp = Array.isArray(c.expedientes) ? c.expedientes[0] : c.expedientes;
        const nombre = (exp?.cliente_nombre ?? "").toLowerCase();
        const cedula = (exp?.cedula ?? "").toLowerCase();
        let score = 0;
        const motivo: Record<string, unknown> = {};
        const diff = Math.abs(saldo - m.valor);
        const pct = saldo > 0 ? (diff / saldo) * 100 : 100;
        if (pct === 0) {
          score += 45;
          motivo.valor = "exacto";
        } else if (pct <= tolPct) {
          score += 30;
          motivo.valor = `±${pct.toFixed(2)}%`;
        }
        if (nombre && desc.includes(nombre.split(" ")[0])) {
          score += 25;
          motivo.nombre = nombre;
        }
        if (cedula && (desc.includes(cedula) || ref.includes(cedula))) {
          score += 20;
          motivo.cedula = cedula;
        }
        if (score > 0) candidatos.push({ match_tipo: "cartera", match_id: c.id, score, motivo });
      }

      // 3) Cruce contra cuentas de cobro
      for (const cc of (ccs ?? []) as Array<{ id: string; numero: string; total: number }>) {
        let score = 0;
        const motivo: Record<string, unknown> = {};
        const diff = Math.abs(Number(cc.total) - m.valor);
        const pct = Number(cc.total) > 0 ? (diff / Number(cc.total)) * 100 : 100;
        if (pct === 0) {
          score += 45;
          motivo.valor = "exacto";
        } else if (pct <= tolPct) {
          score += 30;
          motivo.valor = `±${pct.toFixed(2)}%`;
        }
        const num = (cc.numero || "").toLowerCase();
        if (num && (desc.includes(num) || ref.includes(num))) {
          score += 25;
          motivo.numero = cc.numero;
        }
        if (score > 0) candidatos.push({ match_tipo: "cuenta_cobro", match_id: cc.id, score, motivo });
      }

      // Top 3
      candidatos.sort((a, b) => b.score - a.score);
      const top = candidatos.slice(0, 3);

      // Borrar candidatos previos del movimiento
      await supabase.from("treasury_match_candidatos" as never).delete().eq("movimiento_id", m.id);

      if (top.length) {
        await supabase.from("treasury_match_candidatos" as never).insert(
          top.map((c, i) => ({
            movimiento_id: m.id,
            score: c.score,
            match_tipo: c.match_tipo,
            match_id: c.match_id,
            motivo: c.motivo as never,
            posicion: i + 1,
          })) as never,
        );

        const best = top[0];
        if (best.score >= umbralAuto) {
          await supabase
            .from("treasury_movimientos" as never)
            .update({
              estado_match: "sugerido",
              confianza: Math.min(100, best.score),
              match_tipo: best.match_tipo,
              match_id: best.match_id,
            } as never)
            .eq("id", m.id);
          conciliados++;
        } else if (best.score >= umbralSug) {
          await supabase
            .from("treasury_movimientos" as never)
            .update({
              estado_match: "sugerido",
              confianza: Math.min(100, best.score),
              match_tipo: best.match_tipo,
              match_id: best.match_id,
            } as never)
            .eq("id", m.id);
          sugeridos++;
        }
      }
    }

    await audit(supabase, userId, "extracto", data.extracto_id, "match_engine_ejecutado", null, {
      conciliados_auto: conciliados,
      sugeridos,
    });

    return { ok: true, conciliados_auto: conciliados, sugeridos };
  });

// ─────────────────────────── Movimientos por extracto ───────────────────────────
export const listMovimientos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ extracto_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("treasury_movimientos" as never)
      .select("*")
      .eq("extracto_id", data.extracto_id)
      .order("fecha", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: cands } = await context.supabase
      .from("treasury_match_candidatos" as never)
      .select("*")
      .in(
        "movimiento_id",
        ((rows ?? []) as Array<{ id: string }>).map((r) => r.id).slice(0, 500),
      )
      .order("score", { ascending: false });

    return {
      movimientos: ((rows ?? []) as unknown) as Array<{
        id: string;
        fecha: string;
        valor: number;
        tipo: "credito" | "debito";
        descripcion_raw: string | null;
        referencia: string | null;
        estado_match: "no_identificado" | "sugerido" | "conciliado" | "descartado";
        confianza: number;
        match_tipo: string | null;
        match_id: string | null;
      }>,
      candidatos: ((cands ?? []) as unknown) as Array<{
        id: string;
        movimiento_id: string;
        score: number;
        match_tipo: string;
        match_id: string;
        motivo: Record<string, string | number | boolean | null>;
        posicion: number;
      }>,
    };
  });


// ─────────────────────────── Confirmar / Descartar / Asignar ───────────────────────────
export const confirmarMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        movimiento_id: z.string().uuid(),
        match_tipo: z.enum(["cartera", "cuenta_cobro", "honorario", "comision", "otro"]),
        match_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: mov, error } = await supabase
      .from("treasury_movimientos" as never)
      .select("id,valor,fecha,descripcion_raw,referencia")
      .eq("id", data.movimiento_id)
      .single();
    if (error) throw new Error(error.message);
    const m = mov as { id: string; valor: number; fecha: string; descripcion_raw: string | null; referencia: string | null };

    // Propagación según tipo
    if (data.match_tipo === "cartera") {
      await supabase.from("cartera_pagos" as never).insert({
        cartera_id: data.match_id,
        fecha: m.fecha,
        valor: m.valor,
        metodo: "transferencia",
        comprobante_num: m.referencia ?? null,
        observaciones: `Conciliado desde Treasury AI (mov ${m.id.slice(0, 8)})`,
        user_id: userId,
      } as never);
      // Recalcular pagado en cartera (suma incremental)
      const { data: pagos } = await supabase
        .from("cartera_pagos" as never)
        .select("valor")
        .eq("cartera_id", data.match_id);
      const totalPagado = ((pagos ?? []) as Array<{ valor: number }>).reduce((a, b) => a + Number(b.valor), 0);
      await supabase.from("cartera" as never).update({ pagado: totalPagado } as never).eq("id", data.match_id);
    } else if (data.match_tipo === "cuenta_cobro") {
      await supabase
        .from("cuentas_cobro" as never)
        .update({ estado: "pagada", fecha_pago: new Date().toISOString() } as never)
        .eq("id", data.match_id);
    }

    await supabase
      .from("treasury_movimientos" as never)
      .update({
        estado_match: "conciliado",
        confianza: 100,
        match_tipo: data.match_tipo,
        match_id: data.match_id,
        conciliado_by: userId,
        conciliado_at: new Date().toISOString(),
      } as never)
      .eq("id", data.movimiento_id);

    await audit(supabase, userId, "movimiento", data.movimiento_id, "conciliado", null, {
      match_tipo: data.match_tipo,
      match_id: data.match_id,
    });
    return { ok: true };
  });

export const asignarMatchManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        movimiento_id: z.string().uuid(),
        match_tipo: z.enum(["cartera", "cuenta_cobro", "honorario", "comision", "otro"]),
        match_id: z.string().uuid(),
        aprender: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Aprendizaje: derivar patrón de la descripción
    if (data.aprender) {
      const { data: mov } = await supabase
        .from("treasury_movimientos" as never)
        .select("descripcion_raw,referencia")
        .eq("id", data.movimiento_id)
        .single();
      const m = mov as { descripcion_raw: string | null; referencia: string | null } | null;
      const base = (m?.descripcion_raw ?? m?.referencia ?? "").trim();
      if (base) {
        // Token estable: primeros 2 tokens alfabéticos
        const token = base
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, " ")
          .split(/\s+/)
          .filter((t) => t.length >= 3 && /[a-z]/.test(t))
          .slice(0, 2)
          .join(".*");
        if (token) {
          const patron = token;
          await supabase.from("treasury_match_rules" as never).insert({
            patron,
            match_tipo: data.match_tipo,
            match_id_default: data.match_id,
            created_by: userId,
            veces_aplicada: 1,
            ultimo_uso: new Date().toISOString(),
            activa: true,
          } as never);
        }
      }
    }

    // Confirmar match
    return confirmarMatch({ data: { movimiento_id: data.movimiento_id, match_tipo: data.match_tipo, match_id: data.match_id } } as never);
  });

export const descartarMovimiento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ movimiento_id: z.string().uuid(), motivo: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("treasury_movimientos" as never)
      .update({ estado_match: "descartado", notas: data.motivo ?? null } as never)
      .eq("id", data.movimiento_id);
    await audit(supabase, userId, "movimiento", data.movimiento_id, "descartado", null, { motivo: data.motivo });
    return { ok: true };
  });

// ─────────────────────────── Buscador para asignación manual ───────────────────────────
export const buscarTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ q: z.string().min(1).max(120) }).parse(i))
  .handler(async ({ data, context }) => {
    const q = data.q.toLowerCase();
    const [carteras, ccs] = await Promise.all([
      context.supabase
        .from("cartera" as never)
        .select("id,honorarios_totales,pagado,expedientes!inner(cliente_nombre,cedula,numero_caso)")
        .limit(20),
      context.supabase
        .from("cuentas_cobro" as never)
        .select("id,numero,total,estado")
        .ilike("numero", `%${q}%`)
        .limit(20),
    ]);
    const carteraResults = ((carteras.data ?? []) as Array<any>)
      .filter((c) => {
        const exp = Array.isArray(c.expedientes) ? c.expedientes[0] : c.expedientes;
        return (
          (exp?.cliente_nombre ?? "").toLowerCase().includes(q) ||
          (exp?.cedula ?? "").toLowerCase().includes(q) ||
          (exp?.numero_caso ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 10)
      .map((c) => {
        const exp = Array.isArray(c.expedientes) ? c.expedientes[0] : c.expedientes;
        const saldo = Number(c.honorarios_totales) - Number(c.pagado);
        return {
          tipo: "cartera" as const,
          id: c.id,
          label: `${exp?.cliente_nombre ?? "—"} (${exp?.cedula ?? "?"}) · Saldo $${Math.round(saldo).toLocaleString("es-CO")}`,
        };
      });
    const ccResults = ((ccs.data ?? []) as Array<any>).map((cc) => ({
      tipo: "cuenta_cobro" as const,
      id: cc.id,
      label: `CC ${cc.numero} · $${Math.round(cc.total).toLocaleString("es-CO")} · ${cc.estado}`,
    }));
    return { results: [...carteraResults, ...ccResults] };
  });

// ─────────────────────────── Auditoría ───────────────────────────
export const listAuditoria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("treasury_auditoria" as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      entidad: string;
      entidad_id: string | null;
      accion: string;
      valor_anterior: unknown;
      valor_nuevo: unknown;
      user_id: string | null;
      created_at: string;
    }>;
  });
