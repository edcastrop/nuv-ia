import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json, Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

import { auditar, QA_MOTOR_VERSION, TOLERANCIAS_DEFAULT, type Inconsistencia, type Modalidad, type Tolerancias } from "./qaMath";
import { auditarLeasing, QA_LEASING_MOTOR_VERSION } from "./qaLeasing";
import { mapCasoToExpedienteEstado } from "./casoEstados";


// ─────────────────────────────────────────────────────────────
// Fase 2 — Carga de reglas activas desde qa_reglas
// ─────────────────────────────────────────────────────────────
async function cargarToleranciasActivasInterno(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: boolean) => Promise<{ data: Array<{ codigo: string; payload: Record<string, unknown> }> | null }> } } },
): Promise<Partial<Tolerancias>> {
  const { data } = await supabase.from("qa_reglas").select("codigo,payload").eq("activa", true);
  const map = new Map<string, Record<string, unknown>>((data ?? []).map((r) => [r.codigo, (r.payload ?? {}) as Record<string, unknown>]));
  const num = (v: unknown): number | undefined => {
    if (v === null || v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const out: Partial<Tolerancias> = {};
  const tCuota = map.get("tol.cuota") ?? {};
  if (num(tCuota.abs) !== undefined) out.cuotaAbs = num(tCuota.abs);
  if (num(tCuota.pct) !== undefined) out.cuotaPct = num(tCuota.pct);
  const tSaldo = map.get("tol.saldo") ?? {};
  if (num(tSaldo.abs) !== undefined) out.saldoAbs = num(tSaldo.abs);
  const tTasa = map.get("tol.tasa_ea") ?? {};
  if (num(tTasa.abs) !== undefined) out.tasaEaAbs = num(tTasa.abs);
  const tSeg = map.get("tol.seguros") ?? {};
  if (num(tSeg.abs) !== undefined) out.segurosAbs = num(tSeg.abs);
  const tFrech = map.get("tol.frech") ?? {};
  if (num(tFrech.abs) !== undefined) out.frechAbs = num(tFrech.abs);
  const uSimC = map.get("umb.sim_cuotas") ?? {};
  if (num(uSimC.max) !== undefined) out.simCuotasMax = num(uSimC.max);
  const uSimA = map.get("umb.sim_ahorro") ?? {};
  if (num(uSimA.abs) !== undefined) out.simAhorroAbs = num(uSimA.abs);
  const uExc = map.get("umb.score.excelente") ?? {};
  if (num(uExc.min) !== undefined) out.umbScoreExcelente = num(uExc.min);
  const uApr = map.get("umb.score.aprobado") ?? {};
  if (num(uApr.min) !== undefined) out.umbScoreAprobado = num(uApr.min);
  const uRev = map.get("umb.score.revisar") ?? {};
  if (num(uRev.min) !== undefined) out.umbScoreRevisar = num(uRev.min);
  const pI = map.get("pen.info") ?? {};
  if (num(pI.value) !== undefined) out.penInfo = num(pI.value);
  const pW = map.get("pen.warning") ?? {};
  if (num(pW.value) !== undefined) out.penWarning = num(pW.value);
  const pC = map.get("pen.critica") ?? {};
  if (num(pC.value) !== undefined) out.penCritica = num(pC.value);
  const pDC = map.get("pen.diff_cuota") ?? {};
  if (num(pDC.max) !== undefined) out.penDiffCuotaMax = num(pDC.max);
  const pDS = map.get("pen.diff_sim") ?? {};
  if (num(pDS.max) !== undefined) out.penDiffSimMax = num(pDS.max);
  const pF = map.get("pen.faltantes") ?? {};
  if (num(pF.max) !== undefined) out.penFaltantesMax = num(pF.max);
  return out;
}



const ModalidadEnum = z.enum(["hipotecario", "leasing", "uvr"]);

type QAInconsistenciaView = {
  id: string;
  auditoria_id: string;
  tipo: string;
  severidad: string;
  campo: string | null;
  valor_extracto: number | null;
  valor_calculado: number | null;
  diferencia: number | null;
  mensaje: string;
  sugerencia: string | null;
  created_at: string;
};

const mapInconsistencias = (auditoriaId: string, incs: Inconsistencia[]): QAInconsistenciaView[] =>
  incs.map((i, idx) => ({
    id: `runtime-${idx}`,
    auditoria_id: auditoriaId,
    tipo: i.tipo,
    severidad: i.severidad,
    campo: i.campo ?? null,
    valor_extracto: i.valorExtracto ?? null,
    valor_calculado: i.valorCalculado ?? null,
    diferencia: i.diferencia ?? null,
    mensaje: i.mensaje,
    sugerencia: i.sugerencia ?? null,
    created_at: new Date(0).toISOString(),
  }));

// ─────────────────────────────────────────────────────────────
// Notifica a Directores Financieros QA + Super Admins que llegó
// una nueva proyección/auditoría a revisar. Se ejecuta en el
// servidor justo después de insertar en `qa_auditorias`, para
// que el bell + toast + sonido lleguen en tiempo real vía la
// suscripción de `notificaciones_usuario` en el cliente.
// Nunca rompe la acción principal: cualquier fallo se traga.
// ─────────────────────────────────────────────────────────────
async function notificarQASolicitadaServer(
  supabase: { from: (t: string) => unknown },
  params: { expedienteId: string | null; analistaId: string | null; auditoriaId: string; dictamen: string; score: number },
): Promise<void> {
  try {
    if (!params.expedienteId) return;
    const sb = supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          in: (k: string, v: string[]) => Promise<{ data: Array<{ user_id: string }> | null }>;
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { cliente_nombre?: string | null; banco?: string | null } | null }> };
        };
        insert: (rows: unknown[]) => Promise<unknown>;
      };
    };

    const { data: roleRows } = await sb
      .from("user_roles")
      .select("user_id")
      .in("role", ["director_financiero_qa", "super_admin"]);
    const ids = Array.from(new Set((roleRows ?? []).map((r) => r.user_id).filter(Boolean)));
    const targets = params.analistaId ? ids.filter((u) => u !== params.analistaId) : ids;
    if (targets.length === 0) return;

    const { data: exp } = await sb
      .from("expedientes")
      .select("cliente_nombre,banco")
      .eq("id", params.expedienteId)
      .maybeSingle();
    const cliente = exp?.cliente_nombre ?? null;
    const banco = exp?.banco ?? null;
    const partes = [cliente, banco].filter(Boolean).join(" · ");

    const severidad: "alta" | "media" =
      params.dictamen === "rechazado" || params.dictamen === "devuelto" || params.score < 70 ? "alta" : "media";

    await sb.from("notificaciones_usuario").insert(
      targets.map((u) => ({
        user_id: u,
        tipo: "qa_solicitada",
        titulo: "Nueva proyección para auditar",
        mensaje: partes ? `${partes} — score ${Math.round(params.score)}` : `Score ${Math.round(params.score)}`,
        link: `/qa-ai/${params.auditoriaId}`,
        severidad,
        metadata: { expediente_id: params.expedienteId, auditoria_id: params.auditoriaId, dictamen: params.dictamen, score: params.score },
      })),
    );
  } catch {
    /* swallow */
  }
}


const AuditarInputSchema = z.object({
  expedienteId: z.string().uuid().nullable().optional(),
  simulacionId: z.string().uuid().nullable().optional(),
  extractoId: z.string().uuid().nullable().optional(),
  analistaId: z.string().uuid().nullable().optional(),
  modalidad: ModalidadEnum,
  reconstruccion: z.object({
    saldoCapital: z.number().nonnegative(),
    tasaEa: z.number().nonnegative(),
    tasaEaPactada: z.number().nonnegative().optional(),
    cuotasPendientes: z.number().int().nonnegative(),
    seguros: z.number().nonnegative().default(0),
    coberturaFrechPp: z.number().nonnegative().optional(),
    coberturaFrechValorMensual: z.number().nonnegative().optional(),
    coberturaFrechCuotasRestantes: z.number().int().nonnegative().optional(),
    valorDesembolsado: z.number().nonnegative().optional(),
    saldoUVR: z.number().nonnegative().optional(),
    valorUVR: z.number().nonnegative().optional(),
    variacionUvrEa: z.number().nonnegative().optional(),
    cuotaBaseSinSubsidio: z.number().nonnegative().optional(),
    cuotaFinancieraSinSeguros: z.number().nonnegative().optional(),
  }),
  extracto: z.object({
    saldoCapital: z.number().nonnegative().optional(),
    tasaEa: z.number().nonnegative().optional(),
    cuota: z.number().nonnegative().optional(),
    seguros: z.number().nonnegative().optional(),
    coberturaFrechPp: z.number().nonnegative().optional(),
    coberturaFrechValorMensual: z.number().nonnegative().optional(),
  }).default({}),
  simulacion: z.object({
    cuotasEliminadas: z.number().optional(),
    ahorroProyectado: z.number().optional(),
    nuevoPlazo: z.number().optional(),
  }).optional(),
});

export const auditarCaso = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuditarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const overrides = await cargarToleranciasActivasInterno(supabase as never);
    const analistaRealId = await resolverAnalistaRealQA(supabase as unknown as QaSupabase, {
      expedienteId: data.expedienteId ?? null,
      inputAnalistaId: data.analistaId ?? null,
      fallbackUserId: userId,
    });

    const result = auditar({
      modalidad: data.modalidad as Modalidad,
      reconstruccion: {
        modalidad: data.modalidad as Modalidad,
        saldoCapital: data.reconstruccion.saldoCapital,
        tasaEa: data.reconstruccion.tasaEa,
        tasaEaPactada: data.reconstruccion.tasaEaPactada,
        cuotasPendientes: data.reconstruccion.cuotasPendientes,
        seguros: data.reconstruccion.seguros,
        coberturaFrechPp: data.reconstruccion.coberturaFrechPp,
        coberturaFrechValorMensual: data.reconstruccion.coberturaFrechValorMensual,
        coberturaFrechCuotasRestantes: data.reconstruccion.coberturaFrechCuotasRestantes,
        valorDesembolsado: data.reconstruccion.valorDesembolsado,
        saldoUVR: data.reconstruccion.saldoUVR,
        valorUVR: data.reconstruccion.valorUVR,
        variacionUvrEa: data.reconstruccion.variacionUvrEa,
        cuotaBaseSinSubsidio: data.reconstruccion.cuotaBaseSinSubsidio,
        cuotaFinancieraSinSeguros: data.reconstruccion.cuotaFinancieraSinSeguros,
      },
      extracto: data.extracto,
      simulacion: data.simulacion,
      tolerancias: overrides,
    });


    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: data.expedienteId ?? null,
        analista_id: analistaRealId,
        simulacion_id: data.simulacionId ?? null,
        extracto_id: data.extractoId ?? null,
        modalidad: data.modalidad,
        motor_version: QA_MOTOR_VERSION,
        qa_score: result.score.score,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        auto_ejecutada: false,
        inputs: JSON.parse(JSON.stringify(data)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          totalCorreccionUvr: result.reconstruccion.totalCorreccionUvr,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
          todasCuotas: result.reconstruccion.todasCuotas,
          veredicto: result.veredicto,
        })),
        diferencias: JSON.parse(JSON.stringify(result.inconsistencias)),
        alertas: JSON.parse(JSON.stringify(result.inconsistencias.filter((i) => i.severidad === "critica"))),
        ejecutado_by: userId,
      })
      .select("id")
      .single();
    if (errAud) throw new Error(errAud.message);

    const auditoriaId = aud!.id;

    if (result.inconsistencias.length) {
      await supabase.from("qa_inconsistencias").insert(
        result.inconsistencias.map((i) => ({
          auditoria_id: auditoriaId,
          tipo: i.tipo,
          severidad: i.severidad,
          campo: i.campo ?? null,
          valor_extracto: i.valorExtracto ?? null,
          valor_calculado: i.valorCalculado ?? null,
          diferencia: i.diferencia ?? null,
          mensaje: i.mensaje,
          sugerencia: i.sugerencia ?? null,
        })),
      );
      const criticas = result.inconsistencias.filter((i) => i.severidad === "critica");
      if (criticas.length) {
        await supabase.from("qa_alertas").insert(
          criticas.map((i) => ({
            auditoria_id: auditoriaId,
            expediente_id: data.expedienteId ?? null,
            tipo: i.tipo,
            severidad: i.severidad,
            mensaje: i.mensaje,
          })),
        );
      }
    }

    await supabase.from("qa_auditoria_log").insert({
      auditoria_id: auditoriaId,
      accion: "crear",
      payload: { score: result.score.score, dictamen: result.score.dictamen },
      user_id: userId,
    });

    await notificarQASolicitadaServer(supabase as never, {
      expedienteId: data.expedienteId ?? null,
      analistaId: analistaRealId,
      auditoriaId,
      dictamen: String(result.score.dictamen),
      score: Number(result.score.score) || 0,
    });

    return { auditoriaId, ...result };
  });


export const listAuditoriasQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().positive().max(500).default(100) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_auditorias")
      .select("id,codigo,expediente_id,analista_id,extracto_id,modalidad,qa_score,categoria,dictamen,ejecutado_at,auditor_aprobado_at,auditor_aprobado_by")
      // Bandeja operativa: nunca listar auditorías anuladas.
      .eq("estado_registro", "activa")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const baseRows = rows ?? [];
    const expIds = [...new Set(baseRows.map((r) => r.expediente_id).filter((id): id is string => !!id))];
    const extIds = [...new Set(baseRows.map((r) => r.extracto_id).filter((id): id is string => !!id))];

    const [expRes, extRes] = await Promise.all([
      expIds.length
        ? context.supabase.from("expedientes").select("id,cliente_nombre,banco,asesor_id").in("id", expIds)
        : Promise.resolve({ data: [] as Array<{ id: string; cliente_nombre: string | null; banco: string | null; asesor_id: string | null }> }),
      extIds.length
        ? context.supabase.from("extractos_lecturas").select("id,archivo_path").in("id", extIds)
        : Promise.resolve({ data: [] as Array<{ id: string; archivo_path: string | null }> }),
    ]);

    const expMap = new Map((expRes.data ?? []).map((e) => [e.id, e]));
    const effectiveAnaIds = [...new Set(baseRows.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      return exp?.asesor_id ?? r.analista_id;
    }).filter((id): id is string => !!id))];
    const profRes = effectiveAnaIds.length
      ? await context.supabase.from("profiles").select("id,nombre").in("id", effectiveAnaIds)
      : { data: [] as Array<{ id: string; nombre: string | null }> };
    const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
    const extMap = new Map((extRes.data ?? []).map((e) => [e.id, e]));

    const enriched = baseRows.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      const analistaId = exp?.asesor_id ?? r.analista_id;
      const prof = analistaId ? profMap.get(analistaId) : undefined;
      const ext = r.extracto_id ? extMap.get(r.extracto_id) : undefined;
      return {
        ...r,
        analista_id: analistaId,
        cliente_nombre: exp?.cliente_nombre ?? null,
        banco: exp?.banco ?? null,
        analista_nombre: prof?.nombre ?? null,
        tiene_extracto: !!(ext && ext.archivo_path),
        extracto_path: ext?.archivo_path ?? null,
      };

    });

    return { rows: enriched };
  });


export const listAuditoriasAprobadas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().positive().max(500).default(200) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_auditorias")
      .select("id,codigo,expediente_id,analista_id,extracto_id,modalidad,qa_score,categoria,dictamen,ejecutado_at,auditor_aprobado_at,auditor_aprobado_by")
      .in("dictamen", ["aprobado", "aprobado_obs"])
      // Bandeja operativa: excluir anuladas.
      .eq("estado_registro", "activa")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const baseRows = rows ?? [];
    const expIds = [...new Set(baseRows.map((r) => r.expediente_id).filter((id): id is string => !!id))];
    const extIds = [...new Set(baseRows.map((r) => r.extracto_id).filter((id): id is string => !!id))];

    const [expRes, extRes] = await Promise.all([
      expIds.length
        ? context.supabase.from("expedientes").select("id,cliente_nombre,banco,asesor_id").in("id", expIds)
        : Promise.resolve({ data: [] as Array<{ id: string; cliente_nombre: string | null; banco: string | null; asesor_id: string | null }> }),
      extIds.length
        ? context.supabase.from("extractos_lecturas").select("id,archivo_path").in("id", extIds)
        : Promise.resolve({ data: [] as Array<{ id: string; archivo_path: string | null }> }),
    ]);

    const expMap = new Map((expRes.data ?? []).map((e) => [e.id, e]));
    const effectiveAnaIds = [...new Set(baseRows.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      return exp?.asesor_id ?? r.analista_id;
    }).filter((id): id is string => !!id))];
    const profRes = effectiveAnaIds.length
      ? await context.supabase.from("profiles").select("id,nombre").in("id", effectiveAnaIds)
      : { data: [] as Array<{ id: string; nombre: string | null }> };
    const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
    const extMap = new Map((extRes.data ?? []).map((e) => [e.id, e]));

    const enriched = baseRows.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      const analistaId = exp?.asesor_id ?? r.analista_id;
      const prof = analistaId ? profMap.get(analistaId) : undefined;
      const ext = r.extracto_id ? extMap.get(r.extracto_id) : undefined;
      return {
        ...r,
        analista_id: analistaId,
        cliente_nombre: exp?.cliente_nombre ?? null,
        banco: exp?.banco ?? null,
        analista_nombre: prof?.nombre ?? null,
        tiene_extracto: !!(ext && ext.archivo_path),
        extracto_path: ext?.archivo_path ?? null,
      };
    });

    return { rows: enriched };
  });

export const obtenerAuditoriaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: aud, error } = await context.supabase
      .from("qa_auditorias").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    let auditoria = aud;
    let inconsistenciasOverride: QAInconsistenciaView[] | null = null;
    const inputs = (auditoria.inputs ?? {}) as Record<string, unknown>;
    const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
    const extSnap = (inputs.extracto ?? {}) as Record<string, unknown>;
    const savedOutputs = (auditoria.outputs ?? {}) as Record<string, unknown>;
    const firstSaved = Array.isArray(savedOutputs.primerasCuotas) ? savedOutputs.primerasCuotas[0] as Record<string, unknown> | undefined : undefined;
    const savedTodas = Array.isArray(savedOutputs.todasCuotas) ? savedOutputs.todasCuotas : [];
    const cuotasRec = Math.max(0, Math.round(Number(rec.cuotasPendientes ?? 0)));
    const staleUvrOutputs = String(inputs.modalidad ?? auditoria.modalidad) === "uvr" && (
      !firstSaved || !(Number(firstSaved.saldoUvr ?? 0) > 0) || !(Number(firstSaved.valorUvr ?? 0) > 0) || firstSaved.correccionUvr === undefined ||
      (cuotasRec > 0 && savedTodas.length > 0 && savedTodas.length !== cuotasRec)
    );
    const needsFrechView = !(Number(rec.coberturaFrechValorMensual ?? 0) > 0);
    const needsUvrView = String(inputs.modalidad ?? auditoria.modalidad) === "uvr" && (
      !(Number(rec.saldoUVR ?? 0) > 0) || !(Number(rec.valorUVR ?? 0) > 0) ||
      !(Number(rec.cuotaBaseSinSubsidio ?? 0) > 0) || !(Number(rec.cuotaFinancieraSinSeguros ?? 0) > 0) || staleUvrOutputs
    );
    if ((needsFrechView || needsUvrView) && auditoria.extracto_id) {
      const { data: ext } = await context.supabase
        .from("extractos_lecturas")
        .select("datos")
        .eq("id", auditoria.extracto_id as string)
        .single();
      const d = (ext?.datos ?? {}) as Record<string, unknown>;
      const valorFrech = parseNum(d.valorCobertura) ?? parseNum(d.valorSubsidioGobierno);
      const tasaFrech = parseNum(d.tasaCobertura);
      const cuotaBaseSinSubsidio = parseNum(d.cuotaSinSubsidio) ?? parseNum(d.cuotaBaseSimulacion) ?? parseNum(d.cuotaActual);
      const seguros = parseNum(d.seguros) ?? Number(rec.seguros ?? 0);
      const cuotaFinancieraSinSeguros = parseNum(d.cuotaConInteresSinSeguros) ?? parseNum(d.cuotaSinSeguros) ?? (cuotaBaseSinSubsidio ? Math.max(0, cuotaBaseSinSubsidio - seguros) : undefined);
      if ((valorFrech && valorFrech > 0) || (tasaFrech && tasaFrech > 0) || needsUvrView) {
        const cuotasPend = Number(rec.cuotasPendientes ?? 0);
        const cuotasPag = Number(rec.cuotasPagadas ?? 0);
        const frechCuotasRestantes = Math.max(0, Math.min(cuotasPend, 84 - cuotasPag));
        const modalidadFinal = (inputs.modalidad as Modalidad | undefined) ?? (auditoria.modalidad as Modalidad);
        const nextInputs: Record<string, unknown> = {
          ...inputs,
          reconstruccion: {
            ...rec,
            coberturaFrechPp: rec.coberturaFrechPp ?? tasaFrech,
            coberturaFrechValorMensual: rec.coberturaFrechValorMensual ?? valorFrech,
            coberturaFrechCuotasRestantes: rec.coberturaFrechCuotasRestantes ?? frechCuotasRestantes,
            saldoUVR: rec.saldoUVR ?? parseNum(d.saldoUVR),
            valorUVR: rec.valorUVR ?? parseNum(d.valorUVR),
            cuotaBaseSinSubsidio: rec.cuotaBaseSinSubsidio ?? cuotaBaseSinSubsidio,
            cuotaFinancieraSinSeguros: rec.cuotaFinancieraSinSeguros ?? cuotaFinancieraSinSeguros,
          },
          extracto: {
            ...extSnap,
            cuota: valorFrech && valorFrech > 0
              ? parseNum(d.cuotaPagadaCliente) ?? parseNum(d.valorAPagar) ?? extSnap.cuota
              : extSnap.cuota,
            coberturaFrechPp: extSnap.coberturaFrechPp ?? tasaFrech,
            coberturaFrechValorMensual: extSnap.coberturaFrechValorMensual ?? valorFrech,
          },
        };
        try {
          const result = auditar({
            modalidad: modalidadFinal,
            reconstruccion: { ...(nextInputs.reconstruccion as Record<string, unknown>), modalidad: modalidadFinal } as never,
            extracto: nextInputs.extracto as never,
          });
          inconsistenciasOverride = mapInconsistencias(data.id, result.inconsistencias);
          auditoria = ({
            ...auditoria,
            motor_version: QA_MOTOR_VERSION,
            qa_score: result.score.score,
            categoria: result.score.categoria,
            dictamen: result.score.dictamen,
            inputs: nextInputs,
            outputs: {
              ...(auditoria.outputs as Record<string, unknown> | null ?? {}),
              cuotaTeorica: result.reconstruccion.cuotaTeorica,
              cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
              cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
              beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
              costoTotal: result.reconstruccion.costoTotal,
              vecesPagado: result.reconstruccion.vecesPagado,
              totalIntereses: result.reconstruccion.totalIntereses,
              totalCorreccionUvr: result.reconstruccion.totalCorreccionUvr,
              iMv: result.reconstruccion.iMv,
              primerasCuotas: result.reconstruccion.primerasCuotas,
              ultimasCuotas: result.reconstruccion.ultimasCuotas,
              todasCuotas: result.reconstruccion.todasCuotas,
              veredicto: result.veredicto,
            },
            diferencias: result.inconsistencias,
            alertas: result.inconsistencias.filter((i) => i.severidad === "critica"),
          } as unknown) as typeof aud;
        } catch {
          auditoria = { ...auditoria, inputs: nextInputs } as typeof aud;
        }
      }
    }
    const { data: incs } = await context.supabase
      .from("qa_inconsistencias").select("*").eq("auditoria_id", data.id);
    const inconsistenciasDb: QAInconsistenciaView[] = (incs ?? []).map((i) => ({
      id: String(i.id),
      auditoria_id: String(i.auditoria_id),
      tipo: String(i.tipo),
      severidad: String(i.severidad),
      campo: i.campo ?? null,
      valor_extracto: i.valor_extracto ?? null,
      valor_calculado: i.valor_calculado ?? null,
      diferencia: i.diferencia ?? null,
      mensaje: String(i.mensaje),
      sugerencia: i.sugerencia ?? null,
      created_at: String(i.created_at),
    }));
    let extracto: {
      id: string; archivo_path: string | null; archivo_nombre: string | null;
      banco: string | null; producto: string | null; moneda: string | null;
      datos: Json; created_at: string | null;
    } | null = null;

    if (auditoria.extracto_id) {
      const { data: extRow } = await context.supabase
        .from("extractos_lecturas")
        .select("id,archivo_path,archivo_nombre,banco,producto,moneda,datos,created_at")
        .eq("id", auditoria.extracto_id as string)
        .maybeSingle();
      if (extRow) {
        extracto = {
          id: String(extRow.id),
          archivo_path: (extRow.archivo_path as string | null) ?? null,
          archivo_nombre: (extRow.archivo_nombre as string | null) ?? null,
          banco: (extRow.banco as string | null) ?? null,
          producto: (extRow.producto as string | null) ?? null,
          moneda: (extRow.moneda as string | null) ?? null,
          datos: (extRow.datos as Json) ?? null,
          created_at: (extRow.created_at as string | null) ?? null,
        };
      }
    }
    let analistaIdVista = (auditoria.analista_id as string | null) ?? null;
    let expedienteInfo: {
      cliente_nombre: string | null;
      banco: string | null;
      codigo: string | null;
      cedula: string | null;
      numero_credito: string | null;
      producto: string | null;
      discount_data: Json | null;
      honorarios_base: number | null;
      honorarios_final: number | null;
      descuento: number | null;
      propuesta_data: Json | null;
    } | null = null;
    // Hidratación defensiva: si el expediente quedó con "Sin nombre" pero el
    // extracto sí extrajo el nombre/banco/cédula, propagamos y hacemos
    // backfill silencioso para que /casos, /pipeline y esta vista dejen de
    // mostrar "Sin nombre" al analista y al auditor.
    const dEx = (extracto?.datos ?? {}) as Record<string, unknown>;
    const extNombre = typeof dEx.cliente === "string" ? dEx.cliente.trim() : "";
    const extBanco = typeof dEx.banco === "string" ? dEx.banco.trim() : "";
    const extCedula = typeof dEx.cedula === "string" ? dEx.cedula.trim() : "";
    const extNumCred = typeof dEx.numeroCredito === "string" ? dEx.numeroCredito.trim() : "";
    if (auditoria.expediente_id) {
      const { data: expRow } = await context.supabase
        .from("expedientes")
        .select("asesor_id,cliente_nombre,banco,codigo,cedula,numero_credito,producto,cliente_data,credito_data,discount_data,honorarios_base,honorarios_final,descuento,propuesta_data")
        .eq("id", auditoria.expediente_id as string)
        .maybeSingle();
      if (expRow?.asesor_id) analistaIdVista = expRow.asesor_id as string;
      if (analistaIdVista && analistaIdVista !== auditoria.analista_id) {
        auditoria = { ...auditoria, analista_id: analistaIdVista } as typeof aud;
      }
      if (expRow) {
        const nombreActual = (expRow.cliente_nombre as string | null) ?? null;
        const bancoActual = (expRow.banco as string | null) ?? null;
        const cedulaActual = (expRow.cedula as string | null) ?? null;
        const numCredActual = (expRow.numero_credito as string | null) ?? null;
        const productoActual = (expRow.producto as string | null) ?? null;
        const necesitaNombre = !nombreActual || nombreActual.trim() === "" || nombreActual.trim().toLowerCase() === "sin nombre";
        const patch: Record<string, unknown> = {};
        if (necesitaNombre && extNombre) patch.cliente_nombre = extNombre;
        if ((!bancoActual || bancoActual.trim() === "") && (extBanco || (extracto?.banco ?? ""))) patch.banco = extBanco || String(extracto?.banco ?? "");
        if ((!cedulaActual || cedulaActual.trim() === "") && extCedula) patch.cedula = extCedula;
        if ((!numCredActual || numCredActual.trim() === "") && extNumCred) patch.numero_credito = extNumCred;
        if ((!productoActual || productoActual.trim() === "") && (extracto?.producto ?? "")) patch.producto = String(extracto?.producto ?? "");

        // ── Reconstrucción defensiva del expediente huérfano (Marsela/Audelina).
        //    Si cliente_data / credito_data quedaron vacíos (bug histórico de
        //    re-save del simulador) pero el extracto sí trae la información,
        //    los rehidratamos para que el caso vuelva a ser navegable en
        //    /casos y en la reconstrucción QA.
        const prevCliente = (expRow.cliente_data ?? {}) as Record<string, unknown>;
        const prevCredito = (expRow.credito_data ?? {}) as Record<string, unknown>;
        const isBlank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
        const clienteVacio = !prevCliente || Object.values(prevCliente).every(isBlank);
        const creditoVacio = !prevCredito || Object.values(prevCredito).every(isBlank);
        const val = <T,>(k: string): T | undefined => dEx[k] as T | undefined;
        if (clienteVacio && (extNombre || extBanco || extCedula || extNumCred)) {
          patch.cliente_data = {
            ...prevCliente,
            nombre: extNombre || (patch.cliente_nombre as string) || (prevCliente.nombre ?? ""),
            cedula: extCedula || (prevCliente.cedula ?? ""),
            banco: extBanco || String(extracto?.banco ?? "") || (prevCliente.banco ?? ""),
            numeroCredito: extNumCred || (prevCliente.numeroCredito ?? ""),
            tipoProducto: String(extracto?.producto ?? "") || (prevCliente.tipoProducto ?? ""),
            asesor: (prevCliente.asesor ?? "") as string,
            plazoInicial: String(val<unknown>("plazoInicial") ?? prevCliente.plazoInicial ?? ""),
            cuotasPagadas: String(val<unknown>("cuotasPagadas") ?? prevCliente.cuotasPagadas ?? ""),
            porcentajeHonorarios: (prevCliente.porcentajeHonorarios ?? "6") as string,
            cobertura: (prevCliente.cobertura ?? { activo: false, tasaCobertura: "", valorCobertura: "" }) as unknown,
          };
        }
        if (creditoVacio && (val("saldoCapital") || val("cuotaActual") || val("tasaEA"))) {
          patch.credito_data = {
            ...prevCredito,
            tea: String(val<unknown>("tasaEA") ?? val<unknown>("tea") ?? prevCredito.tea ?? ""),
            teaCobrada: String(val<unknown>("teaCobrada") ?? prevCredito.teaCobrada ?? ""),
            cuotaActual: String(val<unknown>("cuotaActual") ?? prevCredito.cuotaActual ?? ""),
            cuotaActualPesos: String(val<unknown>("cuotaActualPesos") ?? prevCredito.cuotaActualPesos ?? ""),
            saldoCapital: String(val<unknown>("saldoCapital") ?? prevCredito.saldoCapital ?? ""),
            saldoPesos: String(val<unknown>("saldoPesos") ?? prevCredito.saldoPesos ?? ""),
            saldoUVR: String(val<unknown>("saldoUVR") ?? prevCredito.saldoUVR ?? ""),
            valorUVR: String(val<unknown>("valorUVR") ?? prevCredito.valorUVR ?? ""),
            seguros: String(val<unknown>("seguros") ?? prevCredito.seguros ?? ""),
            valorDesembolsado: String(val<unknown>("valorDesembolsado") ?? prevCredito.valorDesembolsado ?? ""),
            variacionUVR: String(prevCredito.variacionUVR ?? ""),
            nuevaCuotaManual: String(prevCredito.nuevaCuotaManual ?? ""),
          };
        }

        if (Object.keys(patch).length > 0) {
          try {
            await context.supabase
              .from("expedientes")
              .update(patch as never)
              .eq("id", auditoria.expediente_id as string);
          } catch { /* backfill best-effort */ }
        }
        expedienteInfo = {
          cliente_nombre: (patch.cliente_nombre as string | undefined) ?? nombreActual ?? (extNombre || null),
          banco: (patch.banco as string | undefined) ?? bancoActual ?? (extBanco || (extracto?.banco ?? null)),
          codigo: (expRow.codigo as string | null) ?? null,
          cedula: (patch.cedula as string | undefined) ?? cedulaActual ?? (extCedula || null),
          numero_credito: (patch.numero_credito as string | undefined) ?? numCredActual ?? (extNumCred || null),
          producto: (patch.producto as string | undefined) ?? productoActual ?? null,
          discount_data: ((expRow as Record<string, unknown>).discount_data ?? null) as Json | null,
          honorarios_base: ((expRow as Record<string, unknown>).honorarios_base ?? null) as number | null,
          honorarios_final: ((expRow as Record<string, unknown>).honorarios_final ?? null) as number | null,
          descuento: ((expRow as Record<string, unknown>).descuento ?? null) as number | null,
          propuesta_data: ((expRow as Record<string, unknown>).propuesta_data ?? null) as Json | null,
        };
      }
    }
    if (!expedienteInfo && (extNombre || extBanco)) {
      expedienteInfo = {
        cliente_nombre: extNombre || null,
        banco: extBanco || (extracto?.banco ?? null),
        codigo: null,
        cedula: extCedula || null,
        numero_credito: extNumCred || null,
        producto: (extracto?.producto ?? null) as string | null,
        discount_data: null,
        honorarios_base: null,
        honorarios_final: null,
        descuento: null,
        propuesta_data: null,
      };
    }
    const [analistaProf, ejecutorProf] = await Promise.all([
      analistaIdVista
        ? context.supabase.from("profiles").select("id,nombre,email").eq("id", analistaIdVista).maybeSingle()
        : Promise.resolve({ data: null }),
      (auditoria.ejecutado_by as string)
        ? context.supabase.from("profiles").select("id,nombre,email").eq("id", auditoria.ejecutado_by as string).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { auditoria, inconsistencias: inconsistenciasOverride ?? inconsistenciasDb, extracto, analista: analistaProf.data, ejecutor: ejecutorProf.data, expediente: expedienteInfo };
  });


export const qaKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("qa_auditorias")
      .select("qa_score,dictamen,ejecutado_at")
      // KPIs operativos: excluir anuladas.
      .eq("estado_registro", "activa")
      .order("ejecutado_at", { ascending: false })
      .limit(500);
    const r = rows ?? [];
    const total = r.length;
    const aprobados = r.filter((x) => x.dictamen === "aprobado").length;
    const obs = r.filter((x) => x.dictamen === "aprobado_obs").length;
    const rechazados = r.filter((x) => x.dictamen === "rechazado").length;
    const pendientesRevision = r.filter((x) => x.dictamen === "requiere_revision").length;
    const promedio = total ? r.reduce((s, x) => s + Number(x.qa_score || 0), 0) / total : 0;
    const { count: alertasAbiertas } = await context.supabase
      .from("qa_alertas").select("id", { count: "exact", head: true }).eq("estado", "abierta");
    const { count: alertasCriticasAbiertas } = await context.supabase
      .from("qa_alertas").select("id", { count: "exact", head: true })
      .eq("estado", "abierta").eq("severidad", "critica");
    const { data: incs } = await context.supabase
      .from("qa_inconsistencias").select("tipo").limit(2000);
    const counts = new Map<string, number>();
    (incs ?? []).forEach((i) => counts.set(i.tipo, (counts.get(i.tipo) ?? 0) + 1));
    let topTipo: string | null = null;
    let topCount = 0;
    counts.forEach((c, t) => { if (c > topCount) { topCount = c; topTipo = t; } });
    return {
      total, aprobados, obs, rechazados, pendientesRevision, promedio,
      alertasAbiertas: alertasAbiertas ?? 0,
      alertasCriticasAbiertas: alertasCriticasAbiertas ?? 0,
      topTipo, topCount,
    };
  });

// ─────────────────────────────────────────────────────────────
// FASE 2 — Panel de Alertas QA
// ─────────────────────────────────────────────────────────────
const AlertaFilterSchema = z.object({
  severidad: z.enum(["info", "warning", "critica"]).optional(),
  estado: z.enum(["abierta", "reconocida", "resuelta"]).optional(),
  banco: z.string().optional(),
  analistaId: z.string().uuid().optional(),
}).default({});

export const listAlertasQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AlertaFilterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    // Si hay filtro por banco, pre-resolvemos expediente_ids en servidor para
    // evitar traer alertas que luego se descartan en cliente.
    let expedienteIdsBanco: string[] | null = null;
    if (data.banco) {
      const { data: expsB } = await context.supabase
        .from("expedientes").select("id").ilike("banco", `%${data.banco}%`).limit(2000);
      expedienteIdsBanco = (expsB ?? []).map((e) => e.id);
      if (expedienteIdsBanco.length === 0) return { rows: [] };
    }

    let q = context.supabase
      .from("qa_alertas")
      .select("id,auditoria_id,expediente_id,tipo,severidad,mensaje,estado,reconocida_by,reconocida_at,resuelta_by,resuelta_at,notas,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.severidad) q = q.eq("severidad", data.severidad);
    if (data.estado) q = q.eq("estado", data.estado);
    if (expedienteIdsBanco) q = q.in("expediente_id", expedienteIdsBanco);
    const { data: alertas, error } = await q;
    if (error) throw new Error(error.message);
    const audIds = Array.from(new Set((alertas ?? []).map((a) => a.auditoria_id).filter(Boolean))) as string[];
    const expIds = Array.from(new Set((alertas ?? []).map((a) => a.expediente_id).filter(Boolean))) as string[];
    const [auds, exps] = await Promise.all([
      audIds.length
        ? context.supabase.from("qa_auditorias").select("id,qa_score,dictamen,modalidad,analista_id").in("id", audIds)
        : Promise.resolve({ data: [] as Array<{ id: string; qa_score: number; dictamen: string; modalidad: string; analista_id: string | null }> }),
      expIds.length
        ? context.supabase.from("expedientes").select("id,codigo,cliente_nombre,banco,asesor_id").in("id", expIds)
        : Promise.resolve({ data: [] as Array<{ id: string; codigo: string | null; cliente_nombre: string | null; banco: string | null; asesor_id: string | null }> }),
    ]);
    const audMap = new Map((auds.data ?? []).map((a) => [a.id, a]));
    const expMap = new Map((exps.data ?? []).map((e) => [e.id, e]));
    let rows = (alertas ?? []).map((a) => {
      const aud = audMap.get(a.auditoria_id!);
      const exp = expMap.get(a.expediente_id!);
      return {
        id: a.id,
        auditoriaId: a.auditoria_id,
        expedienteId: a.expediente_id,
        tipo: a.tipo,
        severidad: a.severidad,
        mensaje: a.mensaje,
        estado: a.estado,
        notas: a.notas ?? null,
        createdAt: a.created_at,
        reconocidaAt: a.reconocida_at,
        resueltaAt: a.resuelta_at,
        score: aud?.qa_score ?? null,
        dictamen: aud?.dictamen ?? null,
        modalidad: aud?.modalidad ?? null,
        analistaId: aud?.analista_id ?? exp?.asesor_id ?? null,
        codigo: exp?.codigo ?? null,
        cliente: exp?.cliente_nombre ?? null,
        banco: exp?.banco ?? null,
      };
    });
    if (data.analistaId) rows = rows.filter((r) => r.analistaId === data.analistaId);
    return { rows };
  });


const ActualizarAlertaSchema = z.object({
  id: z.string().uuid(),
  accion: z.enum(["reconocer", "resolver"]),
  notas: z.string().max(2000).optional(),
});

export const actualizarAlertaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActualizarAlertaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const patch: {
      updated_at: string;
      estado?: "abierta" | "reconocida" | "resuelta";
      reconocida_by?: string | null;
      reconocida_at?: string | null;
      resuelta_by?: string | null;
      resuelta_at?: string | null;
      notas?: string | null;
    } = { updated_at: nowIso };
    if (data.accion === "reconocer") {
      patch.estado = "reconocida";
      patch.reconocida_by = userId;
      patch.reconocida_at = nowIso;
    } else {
      patch.estado = "resuelta";
      patch.resuelta_by = userId;
      patch.resuelta_at = nowIso;
      if (data.notas) patch.notas = data.notas;
    }
    const { data: row, error } = await supabase
      .from("qa_alertas").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    if (row?.auditoria_id) {
      await supabase.from("qa_auditoria_log").insert({
        auditoria_id: row.auditoria_id,
        accion: data.accion === "reconocer" ? "reconocer_alerta" : "cerrar",
        payload: { alertaId: data.id, notas: data.notas ?? null },
        user_id: userId,
      });
    }

    return { ok: true, alerta: row };
  });

// ─────────────────────────────────────────────────────────────
// FASE 2 — Configuración de reglas QA
// ─────────────────────────────────────────────────────────────
export const listReglasQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("qa_reglas")
      .select("id,codigo,descripcion,tipo,payload,activa,version,updated_by,updated_at")
      .order("tipo", { ascending: true })
      .order("codigo", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// Esquemas por código de regla (Fase 3): valida que el payload entregue
// las llaves correctas con tipos correctos según el código de regla.
const PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  "tol.cuota": z.object({ abs: z.number().nonnegative().optional(), pct: z.number().nonnegative().max(1).optional() }),
  "tol.saldo": z.object({ abs: z.number().nonnegative() }),
  "tol.tasa_ea": z.object({ abs: z.number().nonnegative().max(1) }),
  "tol.seguros": z.object({ abs: z.number().nonnegative() }),
  "tol.frech": z.object({ abs: z.number().nonnegative().max(1) }),
  "umb.sim_cuotas": z.object({ max: z.number().nonnegative() }),
  "umb.sim_ahorro": z.object({ abs: z.number().nonnegative() }),
  "umb.score.excelente": z.object({ min: z.number().min(0).max(100) }),
  "umb.score.aprobado": z.object({ min: z.number().min(0).max(100) }),
  "umb.score.revisar": z.object({ min: z.number().min(0).max(100) }),
  "pen.info": z.object({ value: z.number().nonnegative().max(100) }),
  "pen.warning": z.object({ value: z.number().nonnegative().max(100) }),
  "pen.critica": z.object({ value: z.number().nonnegative().max(100) }),
  "pen.diff_cuota": z.object({ max: z.number().nonnegative().max(100) }),
  "pen.diff_sim": z.object({ max: z.number().nonnegative().max(100) }),
  "pen.faltantes": z.object({ max: z.number().nonnegative().max(100) }),
};

const ActualizarReglaSchema = z.object({
  id: z.string().uuid(),
  payload: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
  activa: z.boolean().optional(),
});

export const actualizarReglaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ActualizarReglaSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: canEdit } = await supabase.rpc("can_use_qa_ai", { _uid: userId });
    if (!canEdit) throw new Error("Forbidden: rol no autorizado para editar reglas QA");

    // Cargar la regla para conocer su código (driver de la validación por esquema)
    const { data: reglaActual, error: errLoad } = await supabase
      .from("qa_reglas").select("codigo").eq("id", data.id).single();
    if (errLoad) throw new Error(errLoad.message);

    // Coerce numeric strings → numbers
    const cleanPayload: Record<string, number | string | boolean> = {};
    Object.entries(data.payload).forEach(([k, v]) => {
      if (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))) cleanPayload[k] = Number(v);
      else cleanPayload[k] = v;
    });

    // Validar contra el esquema específico del código de regla
    const schema = PAYLOAD_SCHEMAS[reglaActual.codigo];
    if (schema) {
      const parsed = schema.safeParse(cleanPayload);
      if (!parsed.success) {
        throw new Error(`Payload inválido para ${reglaActual.codigo}: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      }
    }

    const patch: { payload: Record<string, number | string | boolean>; activa?: boolean } = { payload: cleanPayload };
    if (data.activa !== undefined) patch.activa = data.activa;
    const { data: row, error } = await supabase
      .from("qa_reglas").update(patch).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    return { ok: true, regla: row };
  });

export const listHistorialReglaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reglaId: z.string().uuid(), limit: z.number().int().positive().max(50).default(10) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_reglas_historial")
      .select("id,codigo,version_anterior,version_nueva,payload_anterior,payload_nuevo,activa_anterior,activa_nueva,changed_by,changed_at")
      .eq("regla_id", data.reglaId)
      .order("changed_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    // Join con profiles para mostrar nombre del autor del cambio
    const userIds = Array.from(new Set((rows ?? []).map((r) => r.changed_by).filter(Boolean))) as string[];
    const { data: profs } = userIds.length
      ? await context.supabase.from("profiles").select("id,nombre,email").in("id", userIds)
      : { data: [] as Array<{ id: string; nombre: string | null; email: string | null }> };
    const pMap = new Map((profs ?? []).map((p) => [p.id, p]));
    const enriched = (rows ?? []).map((r) => {
      const p = r.changed_by ? pMap.get(r.changed_by) : null;
      return { ...r, changedByNombre: p?.nombre ?? null, changedByEmail: p?.email ?? null };
    });
    return { rows: enriched };
  });


export const cargarToleranciasActivas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const overrides = await cargarToleranciasActivasInterno(context.supabase as never);
    return { defaults: TOLERANCIAS_DEFAULT, activas: overrides, merged: { ...TOLERANCIAS_DEFAULT, ...overrides } };
  });


// ─────────────────────────────────────────────────────────────
// Reuso de extractos existentes (no recapturar datos)
// ─────────────────────────────────────────────────────────────
export const listExpedientesConExtracto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: extractos, error } = await context.supabase
      .from("extractos_lecturas")
      .select("id,expediente_id,banco,producto,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const ids = Array.from(new Set((extractos ?? []).map((e) => e.expediente_id).filter(Boolean))) as string[];
    const { data: exps } = ids.length
      ? await context.supabase.from("expedientes").select("id,codigo,cliente_nombre").in("id", ids)
      : { data: [] as Array<{ id: string; codigo: string | null; cliente_nombre: string | null }> };
    const map = new Map((exps ?? []).map((e) => [e.id, e]));
    return {
      rows: (extractos ?? []).map((e) => ({
        extractoId: e.id,
        expedienteId: e.expediente_id,
        banco: e.banco,
        producto: e.producto,
        codigo: map.get(e.expediente_id!)?.codigo ?? null,
        cliente: map.get(e.expediente_id!)?.cliente_nombre ?? null,
        fecha: e.created_at,
      })),
    };
  });

export const obtenerExtractoQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ extractoId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: ext, error } = await context.supabase
      .from("extractos_lecturas")
      .select("id,expediente_id,banco,producto,datos")
      .eq("id", data.extractoId)
      .single();
    if (error) throw new Error(error.message);
    const d = (ext.datos ?? {}) as Record<string, unknown>;
    const num = (v: unknown): number | undefined => {
      if (v === null || v === undefined || v === "") return undefined;
      const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : undefined;
    };
    const productoStr = String(d.producto ?? ext.producto ?? "").toUpperCase();
    const modalidad: "hipotecario" | "leasing" | "uvr" =
      productoStr.includes("LEASING") ? "leasing"
      : (d.saldoUVR || d.valorUVR) ? "uvr" : "hipotecario";
    return {
      extracto: {
        id: ext.id,
        expedienteId: ext.expediente_id,
        banco: String(d.banco ?? ext.banco ?? ""),
        producto: productoStr,
        modalidad,
        saldoCapital: num(d.saldoCapital),
        tasaEa: num(d.tasaEA),
        cuotaActual: num(d.cuotaActual),
        seguros: num(d.seguros),
        cuotasPagadas: num(d.cuotasPagadas),
        cuotasPendientes: num(d.cuotasPendientes),
        valorDesembolsado: num(d.valorDesembolsado),
        valorUVR: num(d.valorUVR),
        saldoUVR: num(d.saldoUVR),
        coberturaFrechPp: num(d.tasaCobertura),
        titular: String(d.titular ?? ""),
      },
    };
  });

// ─────────────────────────────────────────────────────────────
// FASE 4 — Auto-ejecución desde el lector de extractos
// ─────────────────────────────────────────────────────────────
const parseNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const cleaned = String(v).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

type QaSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
      };
    };
  };
};

async function resolverAnalistaRealQA(
  supabase: QaSupabase,
  params: { expedienteId?: string | null; extractoAsesorId?: string | null; inputAnalistaId?: string | null; fallbackUserId: string },
): Promise<string> {
  if (params.expedienteId) {
    const { data: expRow } = await supabase
      .from("expedientes")
      .select("asesor_id")
      .eq("id", params.expedienteId)
      .maybeSingle();
    const asesorId = typeof expRow?.asesor_id === "string" ? expRow.asesor_id : null;
    if (asesorId) return asesorId;
  }
  return params.extractoAsesorId ?? params.inputAnalistaId ?? params.fallbackUserId;
}

const inferRemainingPayments = (saldo: number, tasaEaPct: number, cuotaFinanciera: number): number => {
  if (!(saldo > 0 && tasaEaPct > 0 && cuotaFinanciera > 0)) return 0;
  const i = Math.pow(1 + tasaEaPct / 100, 1 / 12) - 1;
  if (!(i > 0) || cuotaFinanciera <= saldo * i) return 0;
  const n = Math.log(cuotaFinanciera / (cuotaFinanciera - saldo * i)) / Math.log(1 + i);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const nearestStandardTerm = (months: number): number => {
  const standards = [60, 84, 120, 180, 240, 300, 360];
  return standards.reduce((best, cur) => Math.abs(cur - months) < Math.abs(best - months) ? cur : best, standards[0]);
};

export const auditarLecturaAutomatica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ extractoLecturaId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ext, error: errExt } = await supabase
      .from("extractos_lecturas")
      .select("id,expediente_id,asesor_id,banco,producto,datos")
      .eq("id", data.extractoLecturaId)
      .single();
    if (errExt) throw new Error(errExt.message);
    const d = (ext.datos ?? {}) as Record<string, unknown>;

    const productoStr = String(d.producto ?? ext.producto ?? "").toUpperCase();
    const modalidad: Modalidad =
      productoStr.includes("LEASING") ? "leasing"
      : (d.saldoUVR || d.valorUVR) ? "uvr" : "hipotecario";

    // ─────────────────────────────────────────────────────────────
    // Ruta LEASING HABITACIONAL — motor determinístico dedicado.
    // No mezcla con qaMath (hipotecario/UVR) para no distorsionar tolerancias.
    // ─────────────────────────────────────────────────────────────
    if (modalidad === "leasing") {
      const saldoL = parseNum(d.saldoCapital) ?? 0;
      const residualL = parseNum(d.valorOpcionCompra) ?? 0;
      const valorLeasingL = parseNum(d.valorLeasing);
      const opcionPctL = parseNum(d.opcionCompraPct);
      const teaCobradaL = parseNum(d.teaCobrada) ?? parseNum(d.tea) ?? parseNum(d.tasaEA) ?? 0;
      const teaPactadaL = parseNum(d.teaPactada);
      const segurosL = parseNum(d.seguros) ?? 0;
      const canonBancoL = parseNum(d.cuotaActual) ?? parseNum(d.canonActual) ?? parseNum(d.cuotaPagadaCliente);
      const cuotasPendL = parseNum(d.cuotasPendientes) ?? 0;
      const cuotasPagL = parseNum(d.cuotasPagadas) ?? 0;
      const sistemaAmL = typeof d.sistemaAmortizacion === "string" ? d.sistemaAmortizacion : undefined;
      const incluirOCL = d.incluirOpcionCompra === true;

      const resL = auditarLeasing({
        saldoCapital: saldoL,
        valorResidual: residualL,
        valorLeasing: valorLeasingL,
        opcionCompraPct: opcionPctL,
        cuotasPendientes: cuotasPendL,
        cuotasPagadas: cuotasPagL,
        teaCobradaPct: teaCobradaL,
        teaPactadaPct: teaPactadaL,
        seguros: segurosL,
        canonBancoReportado: canonBancoL,
        sistemaAmortizacion: sistemaAmL,
        incluirOpcionCompra: incluirOCL,
        fechaCorte: typeof d.fechaCorte === "string" ? d.fechaCorte : undefined,
      });

      const inputsSnapL = {
        modalidad,
        extractoLecturaId: ext.id,
        expedienteId: ext.expediente_id,
        leasing: {
          saldoCapital: saldoL,
          valorResidual: residualL,
          valorLeasing: valorLeasingL ?? null,
          opcionCompraPct: opcionPctL ?? null,
          cuotasPendientes: cuotasPendL,
          cuotasPagadas: cuotasPagL,
          teaCobradaPct: teaCobradaL,
          teaPactadaPct: teaPactadaL ?? null,
          seguros: segurosL,
          canonBancoReportado: canonBancoL ?? null,
          sistemaAmortizacion: sistemaAmL ?? null,
          incluirOpcionCompra: incluirOCL,
        },
      };

      const analistaRealIdL = await resolverAnalistaRealQA(supabase as unknown as QaSupabase, {
        expedienteId: ext.expediente_id ?? null,
        extractoAsesorId: typeof ext.asesor_id === "string" ? ext.asesor_id : null,
        fallbackUserId: userId,
      });

      const { data: audL, error: errAudL } = await supabase
        .from("qa_auditorias")
        .insert({
          expediente_id: ext.expediente_id,
          analista_id: analistaRealIdL,
          extracto_id: ext.id,
          modalidad,
          motor_version: QA_LEASING_MOTOR_VERSION,
          qa_score: resL.score.score,
          categoria: resL.score.categoria,
          dictamen: resL.score.dictamen,
          auto_ejecutada: true,
          inputs: JSON.parse(JSON.stringify(inputsSnapL)),
          outputs: JSON.parse(JSON.stringify({
            reconstruccion: resL.reconstruccion,
            veredicto: resL.veredicto,
            faltantes: resL.faltantes,
          })),
          diferencias: JSON.parse(JSON.stringify(resL.inconsistencias)),
          alertas: JSON.parse(JSON.stringify(resL.inconsistencias.filter((i) => i.severidad === "critica"))),
          ejecutado_by: userId,
        })
        .select("id")
        .single();
      if (errAudL) throw new Error(errAudL.message);
      const auditoriaIdL = audL!.id;

      if (resL.inconsistencias.length) {
        await supabase.from("qa_inconsistencias").insert(
          resL.inconsistencias.map((i) => ({
            auditoria_id: auditoriaIdL,
            tipo: i.tipo,
            severidad: i.severidad,
            campo: i.campo ?? null,
            valor_extracto: i.valorExtracto ?? null,
            valor_calculado: i.valorCalculado ?? null,
            diferencia: i.diferencia ?? null,
            mensaje: i.mensaje,
            sugerencia: i.sugerencia ?? null,
          })),
        );
        const criticasL = resL.inconsistencias.filter((i) => i.severidad === "critica");
        if (criticasL.length) {
          await supabase.from("qa_alertas").insert(
            criticasL.map((i) => ({
              auditoria_id: auditoriaIdL,
              expediente_id: ext.expediente_id,
              tipo: i.tipo,
              severidad: i.severidad,
              mensaje: i.mensaje,
            })),
          );
        }
      }

      await supabase.from("qa_auditoria_log").insert({
        auditoria_id: auditoriaIdL,
        accion: "crear",
        payload: { score: resL.score.score, dictamen: resL.score.dictamen, fuente: "lector_extractos", modalidad: "leasing" },
        user_id: userId,
      });

      await notificarQASolicitadaServer(supabase as never, {
        expedienteId: ext.expediente_id ?? null,
        analistaId: analistaRealIdL,
        auditoriaId: auditoriaIdL,
        dictamen: String(resL.score.dictamen),
        score: Number(resL.score.score) || 0,
      });

      return {
        auditoriaId: auditoriaIdL,
        score: resL.score.score,
        categoria: resL.score.categoria,
        dictamen: resL.score.dictamen,
        hallazgos: resL.inconsistencias.length,
        criticos: resL.inconsistencias.filter((i) => i.severidad === "critica").length,
      };
    }



    const saldo = parseNum(d.saldoCapital) ?? 0;
    const tasa = parseNum(d.tasaEA) ?? parseNum(d.teaCobrada) ?? 0;
    const tasaPactada = parseNum(d.teaPactada);
    let cuotasPend = parseNum(d.cuotasPendientes) ?? 0;
    const cuotasPag = parseNum(d.cuotasPagadas) ?? 0;
    const seguros = parseNum(d.seguros) ?? 0;
    const frech = parseNum(d.tasaCobertura);
    const frechValorMensual = parseNum(d.valorCobertura) ?? parseNum(d.valorSubsidioGobierno);
    const desemb = parseNum(d.valorDesembolsado);
    const saldoUVR = parseNum(d.saldoUVR);
    const valorUVR = parseNum(d.valorUVR);
    const cuotaBaseSinSubsidio = parseNum(d.cuotaSinSubsidio) ?? parseNum(d.cuotaBaseSimulacion) ?? parseNum(d.cuotaActual);
    const cuotaFinancieraSinSeguros = parseNum(d.cuotaConInteresSinSeguros) ?? parseNum(d.cuotaSinSeguros) ?? (cuotaBaseSinSubsidio ? Math.max(0, cuotaBaseSinSubsidio - seguros) : undefined);
    const bancoProducto = `${String(d.banco ?? ext.banco ?? "")} ${String(d.producto ?? ext.producto ?? "")}`;
    if (/fondo\s+nacional\s+del\s+ahorro|\bfna\b/i.test(bancoProducto)) {
      const inferred = inferRemainingPayments(saldo, tasa, cuotaFinancieraSinSeguros ?? 0);
      const plazoLeido = parseNum(d.plazoInicial) ?? 0;
      if (inferred > 0 && cuotasPag > 0) {
        const totalIncluyendoActual = cuotasPag + inferred - 1;
        const plazoEstandar = nearestStandardTerm(totalIncluyendoActual);
        const plazoCorregido = Math.abs(plazoEstandar - totalIncluyendoActual) <= 2 ? plazoEstandar : totalIncluyendoActual;
        if (plazoLeido >= 300 && plazoLeido <= 366 && plazoCorregido < plazoLeido - 24) {
          cuotasPend = inferred;
        } else if (!cuotasPend || Math.abs(cuotasPend - inferred) > 12) {
          cuotasPend = inferred;
        }
      }
    }
    const cuotaExt = ((frech && frech > 0) || (frechValorMensual && frechValorMensual > 0))
      ? parseNum(d.cuotaPagadaCliente) ?? parseNum(d.valorAPagar) ?? parseNum(d.cuotaActual)
      : parseNum(d.cuotaActual);

    // FRECH/Fresh cubre máximo 84 cuotas (7 años) en total.
    // Las cuotas restantes con cobertura = max(0, 84 − cuotasPagadas), acotadas a las pendientes.
    const FRECH_MAX = 84;
    const tieneFrech = (frech && frech > 0) || (frechValorMensual && frechValorMensual > 0);
    const frechCuotasRestantes = tieneFrech
      ? Math.max(0, Math.min(cuotasPend, FRECH_MAX - cuotasPag))
      : undefined;

    const overrides = await cargarToleranciasActivasInterno(supabase as never);
    const result = auditar({
      modalidad,
      reconstruccion: {
        modalidad,
        saldoCapital: saldo,
        tasaEa: tasa,
        tasaEaPactada: tasaPactada,
        cuotasPendientes: cuotasPend,
        seguros,
        coberturaFrechPp: frech,
        coberturaFrechValorMensual: frechValorMensual,
        coberturaFrechCuotasRestantes: frechCuotasRestantes,
        valorDesembolsado: desemb,
        saldoUVR,
        valorUVR,
        cuotaBaseSinSubsidio,
        cuotaFinancieraSinSeguros,
      },
      extracto: {
        saldoCapital: saldo || undefined,
        tasaEa: tasa || undefined,
        cuota: cuotaExt,
        seguros: seguros || undefined,
        coberturaFrechPp: frech,
        coberturaFrechValorMensual: frechValorMensual,
      },
      tolerancias: overrides,
    });

    const proyeccionesAplicadasIds = Array.isArray(d.proyeccionesAplicadas) ? (d.proyeccionesAplicadas as string[]) : [];
    const proyeccionesAplicadasAt = typeof d.proyeccionesAplicadasAt === "string" ? d.proyeccionesAplicadasAt : null;
    const plazoRecalculadoPorProyeccion = d.plazoRecalculadoPorProyeccion === true;
    const cuotasPendientesExtractoOriginal = parseNum(d.cuotasPendientesExtracto);

    const inputsSnap = {
      modalidad,
      extractoLecturaId: ext.id,
      expedienteId: ext.expediente_id,
      reconstruccion: { saldoCapital: saldo, tasaEa: tasa, tasaEaPactada: tasaPactada, cuotasPendientes: cuotasPend, cuotasPagadas: cuotasPag, seguros, coberturaFrechPp: frech, coberturaFrechValorMensual: frechValorMensual, coberturaFrechCuotasRestantes: frechCuotasRestantes, valorDesembolsado: desemb, saldoUVR, valorUVR, cuotaBaseSinSubsidio, cuotaFinancieraSinSeguros },
      extracto: { saldoCapital: saldo, tasaEa: tasa, cuota: cuotaExt, seguros, coberturaFrechPp: frech, coberturaFrechValorMensual: frechValorMensual },
      proyecciones: {
        aplicadas: proyeccionesAplicadasIds,
        aplicadasAt: proyeccionesAplicadasAt,
        plazoRecalculadoPorProyeccion,
        cuotasPendientesExtractoOriginal: cuotasPendientesExtractoOriginal ?? null,
        cuotasPendientesRecalculadas: cuotasPend,
        saldoCapitalAplicado: saldo || null,
        cuotaClienteAplicada: cuotaExt ?? null,
        cuotaFinancieraAplicada: cuotaFinancieraSinSeguros ?? null,
        segurosAplicados: seguros || null,
        tasaEaAplicada: tasa || null,
        saldoUvrAplicado: saldoUVR ?? null,
        valorUvrAplicado: valorUVR ?? null,
        formulaPlazo: modalidad === "uvr"
          ? "n = ln(C_UVR / (C_UVR - Saldo_UVR × i)) / ln(1 + i)"
          : "n = ln(C / (C - Saldo × i)) / ln(1 + i)",
        count: proyeccionesAplicadasIds.length,
      },
    };

    // Resolver el analista real del caso (asesor_id del expediente). Si el
    // expediente aún no tiene asesor, usa el asesor guardado en la lectura.
    const analistaRealId = await resolverAnalistaRealQA(supabase as unknown as QaSupabase, {
      expedienteId: ext.expediente_id ?? null,
      extractoAsesorId: typeof ext.asesor_id === "string" ? ext.asesor_id : null,
      fallbackUserId: userId,
    });

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: ext.expediente_id,
        analista_id: analistaRealId,
        extracto_id: ext.id,
        modalidad,
        motor_version: QA_MOTOR_VERSION,
        qa_score: result.score.score,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        auto_ejecutada: true,
        inputs: JSON.parse(JSON.stringify(inputsSnap)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          totalCorreccionUvr: result.reconstruccion.totalCorreccionUvr,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
          todasCuotas: result.reconstruccion.todasCuotas,
          veredicto: result.veredicto,
        })),
        diferencias: JSON.parse(JSON.stringify(result.inconsistencias)),
        alertas: JSON.parse(JSON.stringify(result.inconsistencias.filter((i) => i.severidad === "critica"))),
        ejecutado_by: userId,
      })
      .select("id")
      .single();
    if (errAud) throw new Error(errAud.message);
    const auditoriaId = aud!.id;

    if (result.inconsistencias.length) {
      await supabase.from("qa_inconsistencias").insert(
        result.inconsistencias.map((i) => ({
          auditoria_id: auditoriaId,
          tipo: i.tipo,
          severidad: i.severidad,
          campo: i.campo ?? null,
          valor_extracto: i.valorExtracto ?? null,
          valor_calculado: i.valorCalculado ?? null,
          diferencia: i.diferencia ?? null,
          mensaje: i.mensaje,
          sugerencia: i.sugerencia ?? null,
        })),
      );
      const criticas = result.inconsistencias.filter((i) => i.severidad === "critica");
      if (criticas.length) {
        await supabase.from("qa_alertas").insert(
          criticas.map((i) => ({
            auditoria_id: auditoriaId,
            expediente_id: ext.expediente_id,
            tipo: i.tipo,
            severidad: i.severidad,
            mensaje: i.mensaje,
          })),
        );
      }
    }

    await supabase.from("qa_auditoria_log").insert({
      auditoria_id: auditoriaId,
      accion: "crear",
      payload: { score: result.score.score, dictamen: result.score.dictamen, fuente: "lector_extractos" },
      user_id: userId,
    });

    await notificarQASolicitadaServer(supabase as never, {
      expedienteId: ext.expediente_id ?? null,
      analistaId: analistaRealId,
      auditoriaId,
      dictamen: String(result.score.dictamen),
      score: Number(result.score.score) || 0,
    });



    return {
      auditoriaId,
      score: result.score.score,
      categoria: result.score.categoria,
      dictamen: result.score.dictamen,
      hallazgos: result.inconsistencias.length,
      criticos: result.inconsistencias.filter((i) => i.severidad === "critica").length,
    };
  });

// Última auditoría QA por expediente (para bloque expediente y guard)
export const ultimaAuditoriaQAPorExpediente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ expedienteId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: aud } = await context.supabase
      .from("qa_auditorias")
      .select("id,qa_score,categoria,dictamen,ejecutado_at,ejecutado_by,auto_ejecutada,modalidad")
      .eq("expediente_id", data.expedienteId)
      // Bloque de expediente: solo mostrar la última auditoría vigente.
      .eq("estado_registro", "activa")
      .order("ejecutado_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!aud) return { auditoria: null, inconsistencias: [], alertasAbiertas: 0 };
    const { data: incs } = await context.supabase
      .from("qa_inconsistencias")
      .select("tipo,severidad,mensaje,sugerencia,campo")
      .eq("auditoria_id", aud.id)
      .order("severidad", { ascending: true })
      .limit(10);
    const { count } = await context.supabase
      .from("qa_alertas")
      .select("id", { count: "exact", head: true })
      .eq("expediente_id", data.expedienteId)
      .eq("estado", "abierta");
    return { auditoria: aud, inconsistencias: incs ?? [], alertasAbiertas: count ?? 0 };
  });

// ─────────────────────────────────────────────────────────────
// Re-ejecutar auditoría existente (recalcula con motor actual)
// ─────────────────────────────────────────────────────────────
export const reejecutarAuditoriaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: aud, error } = await supabase
      .from("qa_auditorias")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    // Auditoría anulada: nunca reejecutar.
    if ((aud as { estado_registro?: string }).estado_registro === "anulada") {
      return {
        ok: false as const,
        bloqueada: true as const,
        motivo: "auditoria_anulada",
        score: (aud as { qa_score: number }).qa_score,
        dictamen: (aud as { dictamen: string }).dictamen,
      };
    }


    // ── GUARDARRAÍL: una auditoría formalmente aprobada por el Director
    //    (auditor_aprobado_at ≠ NULL) NO puede ser reejecutada automática
    //    ni manualmente. Eso protege el score/dictamen aprobado contra
    //    autosync, foco de pestaña y recálculos posteriores.
    //    Si el negocio necesita reabrir, debe hacerse por una acción
    //    explícita separada (devolver al analista, no aquí).
    if ((aud as { auditor_aprobado_at: string | null }).auditor_aprobado_at) {
      return {
        ok: false as const,
        bloqueada: true as const,
        motivo: "auditoria_aprobada_por_auditor",
        score: (aud as { qa_score: number }).qa_score,
        dictamen: (aud as { dictamen: string }).dictamen,
      };
    }


    const inputs = (aud.inputs ?? {}) as Record<string, unknown>;
    const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
    const extSnap = (inputs.extracto ?? {}) as Record<string, unknown>;

    // Backfill desde extracto (FRESH + tasaEaPactada)
    let extDatos: Record<string, unknown> | null = null;
    if (aud.extracto_id) {
      const { data: ext } = await supabase
        .from("extractos_lecturas")
        .select("datos")
        .eq("id", aud.extracto_id as string)
        .single();
      extDatos = (ext?.datos ?? null) as Record<string, unknown> | null;
    }

    if (extDatos) {
      const d = extDatos;
      const tasaPactada = parseNum(d.teaPactada);
      const valorFrech = parseNum(d.valorCobertura) ?? parseNum(d.valorSubsidioGobierno);
      const tasaFrech = parseNum(d.tasaCobertura);
      const cuotaBaseSinSubsidio = parseNum(d.cuotaSinSubsidio) ?? parseNum(d.cuotaBaseSimulacion) ?? parseNum(d.cuotaActual);
      const seguros = parseNum(d.seguros) ?? Number(rec.seguros ?? 0);
      const cuotaFinancieraSinSeguros = parseNum(d.cuotaConInteresSinSeguros) ?? parseNum(d.cuotaSinSeguros) ?? (cuotaBaseSinSubsidio ? Math.max(0, cuotaBaseSinSubsidio - seguros) : undefined);
      let cuotasPend = Number(rec.cuotasPendientes ?? 0);
      const cuotasPag = Number(rec.cuotasPagadas ?? 0);
      const bancoProducto = `${String(d.banco ?? "")} ${String(d.producto ?? "")}`;
      const isFna = /fondo\s+nacional\s+del\s+ahorro|\bfna\b/i.test(bancoProducto);
      const cuotasFnaInferidas = isFna
        ? inferRemainingPayments(Number(rec.saldoCapital ?? 0), Number(rec.tasaEa ?? 0), cuotaFinancieraSinSeguros ?? 0)
        : 0;
      const plazoLeidoFna = parseNum(d.plazoInicial) ?? 0;
      const totalFna = cuotasPag > 0 && cuotasFnaInferidas > 0 ? cuotasPag + cuotasFnaInferidas - 1 : 0;
      const plazoFnaEstandar = totalFna > 0 ? nearestStandardTerm(totalFna) : 0;
      const plazoFnaCorregido = totalFna > 0 && Math.abs(plazoFnaEstandar - totalFna) <= 2 ? plazoFnaEstandar : totalFna;
      const needsFnaPlazo = isFna && cuotasFnaInferidas > 0 && cuotasPag > 0 && (
        (plazoLeidoFna >= 300 && plazoLeidoFna <= 366 && plazoFnaCorregido < plazoLeidoFna - 24) ||
        !cuotasPend ||
        Math.abs(cuotasPend - cuotasFnaInferidas) > 12
      );
      if (needsFnaPlazo) cuotasPend = cuotasFnaInferidas;
      const frechCuotasRestantes = Math.max(0, Math.min(cuotasPend, 84 - cuotasPag));

      const needsFrech = !(Number(rec.coberturaFrechValorMensual ?? 0) > 0) && ((valorFrech && valorFrech > 0) || (tasaFrech && tasaFrech > 0));
      const needsPactada = !(Number(rec.tasaEaPactada ?? 0) > 0) && tasaPactada && tasaPactada > 0;
      const needsUvr = (String(inputs.modalidad ?? aud.modalidad) === "uvr") && (
        !(Number(rec.saldoUVR ?? 0) > 0) || !(Number(rec.valorUVR ?? 0) > 0) ||
        !(Number(rec.cuotaBaseSinSubsidio ?? 0) > 0) || !(Number(rec.cuotaFinancieraSinSeguros ?? 0) > 0)
      );

      if (needsFrech || needsPactada || needsUvr || needsFnaPlazo) {
        inputs.reconstruccion = {
          ...rec,
          ...(needsFnaPlazo ? { cuotasPendientes: cuotasFnaInferidas, cuotaFinancieraSinSeguros } : {}),
          ...(needsPactada ? { tasaEaPactada: tasaPactada } : {}),
          ...(needsUvr ? {
            saldoUVR: rec.saldoUVR ?? parseNum(d.saldoUVR),
            valorUVR: rec.valorUVR ?? parseNum(d.valorUVR),
            cuotaBaseSinSubsidio: rec.cuotaBaseSinSubsidio ?? cuotaBaseSinSubsidio,
            cuotaFinancieraSinSeguros: rec.cuotaFinancieraSinSeguros ?? cuotaFinancieraSinSeguros,
          } : {}),
          ...(needsFrech ? {
            coberturaFrechPp: rec.coberturaFrechPp ?? tasaFrech,
            coberturaFrechValorMensual: rec.coberturaFrechValorMensual ?? valorFrech,
            coberturaFrechCuotasRestantes: rec.coberturaFrechCuotasRestantes ?? frechCuotasRestantes,
          } : {}),
        };
        if (needsFrech) {
          inputs.extracto = {
            ...extSnap,
            cuota: valorFrech && valorFrech > 0
              ? parseNum(d.cuotaPagadaCliente) ?? parseNum(d.valorAPagar) ?? extSnap.cuota
              : extSnap.cuota,
            coberturaFrechPp: extSnap.coberturaFrechPp ?? tasaFrech,
            coberturaFrechValorMensual: extSnap.coberturaFrechValorMensual ?? valorFrech,
          };
        }
      }
    }


    const recFinalSnap = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
    const extFinalSnap = (inputs.extracto ?? {}) as Record<string, unknown>;
    const proySnap = (inputs.proyecciones ?? {}) as Record<string, unknown>;
    const proyCount = Number(proySnap.count ?? (Array.isArray(proySnap.aplicadas) ? proySnap.aplicadas.length : 0));
    if (proyCount > 0) {
      inputs.proyecciones = {
        ...proySnap,
        saldoCapitalAplicado: parseNum(recFinalSnap.saldoCapital) ?? null,
        cuotaClienteAplicada: parseNum(extFinalSnap.cuota) ?? null,
        cuotaFinancieraAplicada: parseNum(recFinalSnap.cuotaFinancieraSinSeguros) ?? null,
        segurosAplicados: parseNum(recFinalSnap.seguros) ?? null,
        tasaEaAplicada: parseNum(recFinalSnap.tasaEa) ?? null,
        saldoUvrAplicado: parseNum(recFinalSnap.saldoUVR) ?? null,
        valorUvrAplicado: parseNum(recFinalSnap.valorUVR) ?? null,
        formulaPlazo: ((inputs.modalidad as Modalidad | undefined) ?? (aud.modalidad as Modalidad)) === "uvr"
          ? "n = ln(C_UVR / (C_UVR - Saldo_UVR × i)) / ln(1 + i)"
          : "n = ln(C / (C - Saldo × i)) / ln(1 + i)",
      };
    }


    const modalidadFinal = (inputs.modalidad as Modalidad | undefined) ?? (aud.modalidad as Modalidad);
    const overrides = await cargarToleranciasActivasInterno(supabase as never);

    const result = auditar({
      modalidad: modalidadFinal,
      reconstruccion: { ...(inputs.reconstruccion as Record<string, unknown>), modalidad: modalidadFinal } as never,
      extracto: inputs.extracto as never,
      simulacion: inputs.simulacion as never,
      tolerancias: overrides,
    });

    // Actualizar registro existente
    const { error: updErr } = await supabase
      .from("qa_auditorias")
      .update({
        motor_version: QA_MOTOR_VERSION,
        qa_score: result.score.score,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        inputs: JSON.parse(JSON.stringify(inputs)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          totalCorreccionUvr: result.reconstruccion.totalCorreccionUvr,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
          todasCuotas: result.reconstruccion.todasCuotas,
          veredicto: result.veredicto,
        })),
        diferencias: JSON.parse(JSON.stringify(result.inconsistencias)),
        alertas: JSON.parse(JSON.stringify(result.inconsistencias.filter((i) => i.severidad === "critica"))),
        ejecutado_at: new Date().toISOString(),
        ejecutado_by: userId,
      })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    // Borrar inconsistencias viejas e insertar nuevas
    await supabase.from("qa_inconsistencias").delete().eq("auditoria_id", data.id);
    if (result.inconsistencias.length) {
      await supabase.from("qa_inconsistencias").insert(
        result.inconsistencias.map((i) => ({
          auditoria_id: data.id,
          tipo: i.tipo,
          severidad: i.severidad,
          campo: i.campo ?? null,
          valor_extracto: i.valorExtracto ?? null,
          valor_calculado: i.valorCalculado ?? null,
          diferencia: i.diferencia ?? null,
          mensaje: i.mensaje,
          sugerencia: i.sugerencia ?? null,
        })),
      );
    }

    // Borrar alertas viejas e insertar nuevas críticas
    await supabase.from("qa_alertas").delete().eq("auditoria_id", data.id);
    const criticas = result.inconsistencias.filter((i) => i.severidad === "critica");
    if (criticas.length) {
      await supabase.from("qa_alertas").insert(
        criticas.map((i) => ({
          auditoria_id: data.id,
          expediente_id: aud.expediente_id,
          tipo: i.tipo,
          severidad: i.severidad,
          mensaje: i.mensaje,
        })),
      );
    }

    await supabase.from("qa_auditoria_log").insert({
      auditoria_id: data.id,
      accion: "recalcular",
      payload: { score: result.score.score, dictamen: result.score.dictamen, motor_version: QA_MOTOR_VERSION },
      user_id: userId,
    });

    return { ok: true, score: result.score.score, dictamen: result.score.dictamen };
  });

// ─────────────────────────────────────────────────────────────
// FASE NUVIA — Command Center (read-only aggregation)
// ─────────────────────────────────────────────────────────────
export const qaCommandCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    limit: z.number().int().positive().max(1000).default(500),
    days: z.number().int().positive().max(180).default(30),
    refreshKey: z.number().optional(),
    mineOnly: z.boolean().optional().default(false),
  }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sinceISO = new Date(Date.now() - data.days * 86400000).toISOString();

    // Guard de autorización: solo roles con `can_use_qa_ai` (super_admin,
    // admin, gerencia, director_financiero_qa) pueden ver el universo
    // completo. Si el cliente pide `mineOnly: false` sin tener el rol,
    // forzamos `mineOnly = true` en servidor para evitar leakage,
    // independientemente de lo que mande el cliente.
    if (!data.mineOnly) {
      const { data: canUse, error: canUseErr } = await supabase.rpc("can_use_qa_ai", { _uid: userId });
      if (canUseErr || !canUse) {
        data.mineOnly = true;
      }
    }


    // Cuando `mineOnly` está activo, primero calculamos el universo de auditorías
    // del usuario actual: las que él ejecutó (`analista_id`) más las de expedientes
    // donde él es el asesor asignado. Esto permite que un analista comercial vea
    // en `/qa-ai/mis` únicamente los casos que le pertenecen.
    let ownExpIds: string[] = [];
    if (data.mineOnly) {
      const { data: ownExps } = await supabase
        .from("expedientes")
        .select("id")
        .eq("asesor_id", userId);
      ownExpIds = (ownExps ?? []).map((e) => e.id as string);
    }

    let audQuery = supabase
      .from("qa_auditorias")
      .select("id,codigo,expediente_id,analista_id,extracto_id,modalidad,motor_version,qa_score,categoria,dictamen,ejecutado_at,updated_at,alertas,inputs,auditor_aprobado_at,auditor_aprobado_by,origen,banco,producto,cliente_nombre")
      .eq("estado_registro", "activa")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (data.mineOnly) {
      const filters = [`analista_id.eq.${userId}`];
      if (ownExpIds.length) filters.push(`expediente_id.in.(${ownExpIds.join(",")})`);
      audQuery = audQuery.or(filters.join(","));
    }
    const { data: audRaw, error: audError } = await audQuery;
    if (audError) throw new Error(audError.message);

    const audits = audRaw ?? [];


    const expIds = [...new Set(audits.map((r) => r.expediente_id).filter((id): id is string => !!id))];
    const extIds = [...new Set(audits.map((r) => r.extracto_id).filter((id): id is string => !!id))];

    const [expRes, extRes, alertasRes, incsRes] = await Promise.all([
      expIds.length ? supabase.from("expedientes")
        .select("id,cliente_nombre,banco,producto,estado_caso,subestado,sla_vence_at,validacion_estado,asesor_id,honorarios_final,credito_data")
        .in("id", expIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      extIds.length ? supabase.from("extractos_lecturas").select("id,archivo_path").in("id", extIds)
        : Promise.resolve({ data: [] as Array<{ id: string; archivo_path: string | null }> }),
      supabase.from("qa_alertas")
        .select("id,auditoria_id,severidad,estado,tipo,created_at")
        .gte("created_at", sinceISO),
      supabase.from("qa_inconsistencias")
        .select("auditoria_id,tipo,severidad,created_at")
        .gte("created_at", sinceISO)
        .limit(5000),
    ]);

    const expMap = new Map((expRes.data ?? []).map((e) => [e.id as string, e]));
    const effectiveAnaIds = [...new Set(audits.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      return (exp?.asesor_id as string | null | undefined) ?? r.analista_id;
    }).filter((id): id is string => !!id))];
    const profRes = effectiveAnaIds.length ? await supabase.from("profiles").select("id,nombre").in("id", effectiveAnaIds)
      : { data: [] as Array<{ id: string; nombre: string | null }> };
    const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
    const extMap = new Map((extRes.data ?? []).map((e) => [e.id, e]));
    const alertas = alertasRes.data ?? [];
    const incs = incsRes.data ?? [];

    const alertasByAud = new Map<string, { abiertas: number; criticas: number }>();
    alertas.forEach((a) => {
      const k = String(a.auditoria_id ?? "");
      if (!k) return;
      const cur = alertasByAud.get(k) ?? { abiertas: 0, criticas: 0 };
      if (a.estado === "abierta") cur.abiertas += 1;
      if (a.estado === "abierta" && a.severidad === "critica") cur.criticas += 1;
      alertasByAud.set(k, cur);
    });

    const nowMs = Date.now();
    const rows = audits.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      const analistaId = ((exp?.asesor_id as string | null | undefined) ?? r.analista_id) || null;
      const prof = analistaId ? profMap.get(analistaId) : undefined;
      const ext = r.extracto_id ? extMap.get(r.extracto_id) : undefined;
      const al = alertasByAud.get(r.id) ?? { abiertas: 0, criticas: 0 };
      const sla = exp?.sla_vence_at ? new Date(exp.sla_vence_at as string).getTime() : null;
      const slaVencido = sla !== null && sla < nowMs;
      const credito = (exp?.credito_data ?? {}) as Record<string, unknown>;
      const ticket = Number(credito.saldoCapital ?? credito.saldo_capital ?? credito.valor_credito ?? 0) || Number(exp?.honorarios_final ?? 0);
      const fresh = (() => {
        const inp = (r.inputs ?? {}) as Record<string, unknown>;
        const rec = (inp.reconstruccion ?? {}) as Record<string, unknown>;
        return Number(rec.coberturaFrechValorMensual ?? 0) > 0 || Number(rec.coberturaFrechPp ?? 0) > 0;
      })();
      return {
        id: r.id,
        codigo: (r as unknown as { codigo: string | null }).codigo ?? null,
        expediente_id: r.expediente_id, analista_id: analistaId,
        modalidad: r.modalidad as string,
        motor_version: (r as unknown as { motor_version: string | null }).motor_version ?? null,
        qa_score: Number(r.qa_score ?? 0),
        categoria: r.categoria as string, dictamen: r.dictamen as string,
        auditor_aprobado_at: (r as unknown as { auditor_aprobado_at: string | null }).auditor_aprobado_at ?? null,
        ejecutado_at: r.ejecutado_at as string,
        updated_at: (r as unknown as { updated_at: string | null }).updated_at ?? null,
        cliente_nombre: (exp?.cliente_nombre as string | null) ?? ((r as { cliente_nombre?: string | null }).cliente_nombre ?? null),
        banco: (exp?.banco as string | null) ?? ((r as { banco?: string | null }).banco ?? null),
        producto: (exp?.producto as string | null) ?? ((r as { producto?: string | null }).producto ?? null),

        estado_caso: (exp?.estado_caso as string | null) ?? null,
        subestado: (exp?.subestado as string | null) ?? null,
        validacion_estado: (exp?.validacion_estado as string | null) ?? null,
        analista_nombre: (prof?.nombre as string | null) ?? null,
        extracto_path: (ext?.archivo_path as string | null) ?? null,
        alertas_abiertas: al.abiertas, alertas_criticas: al.criticas,
        sla_vence_at: (exp?.sla_vence_at as string | null) ?? null,
        sla_vencido: slaVencido,
        ticket, fresh,
      };
    });

    // Bank risk
    const bankAgg = new Map<string, { auditados: number; sumScore: number; errores: number }>();
    rows.forEach((r) => {
      const k = r.banco ?? "—";
      const cur = bankAgg.get(k) ?? { auditados: 0, sumScore: 0, errores: 0 };
      cur.auditados += 1;
      cur.sumScore += r.qa_score;
      if (r.dictamen === "rechazado" || r.dictamen === "requiere_revision") cur.errores += 1;
      bankAgg.set(k, cur);
    });
    const bancos = [...bankAgg.entries()].map(([banco, v]) => {
      const prom = v.auditados ? v.sumScore / v.auditados : 0;
      const pctErr = v.auditados ? (v.errores / v.auditados) * 100 : 0;
      const riesgo = (prom < 90 || pctErr > 15) ? "alto" : prom < 95 ? "medio" : "bajo";
      return { banco, auditados: v.auditados, promedio: prom, pctError: pctErr, riesgo };
    }).sort((a, b) => (a.riesgo === b.riesgo ? a.promedio - b.promedio : (a.riesgo === "alto" ? -1 : b.riesgo === "alto" ? 1 : a.riesgo === "medio" ? -1 : 1)));

    // Analyst ranking
    const anaAgg = new Map<string, { id: string | null; nombre: string; auditados: number; sumScore: number; aprob: number; rech: number }>();
    rows.forEach((r) => {
      const k = r.analista_id ?? "—";
      const cur = anaAgg.get(k) ?? { id: r.analista_id, nombre: r.analista_nombre ?? "Sin analista", auditados: 0, sumScore: 0, aprob: 0, rech: 0 };
      cur.auditados += 1; cur.sumScore += r.qa_score;
      if (r.dictamen === "aprobado" || r.dictamen === "aprobado_obs") cur.aprob += 1;
      if (r.dictamen === "rechazado") cur.rech += 1;
      anaAgg.set(k, cur);
    });
    const analistas = [...anaAgg.values()].map((v) => {
      const prom = v.auditados ? v.sumScore / v.auditados : 0;
      const precision = v.auditados ? (v.aprob / v.auditados) * 100 : 0;
      const nivel = precision >= 95 && v.auditados >= 10 ? 3 : precision >= 85 ? 2 : 1;
      return { ...v, promedio: prom, precision, nivel };
    }).sort((a, b) => b.precision - a.precision);

    // Top errors
    const errAgg = new Map<string, { tipo: string; total: number; criticas: number; ultimos7: number }>();
    const sevenAgo = nowMs - 7 * 86400000;
    incs.forEach((i) => {
      const cur = errAgg.get(i.tipo as string) ?? { tipo: i.tipo as string, total: 0, criticas: 0, ultimos7: 0 };
      cur.total += 1;
      if (i.severidad === "critica") cur.criticas += 1;
      if (new Date(i.created_at as string).getTime() > sevenAgo) cur.ultimos7 += 1;
      errAgg.set(i.tipo as string, cur);
    });
    const topErrores = [...errAgg.values()].sort((a, b) => b.total - a.total).slice(0, 8);

    // 30d trend (by day)
    const trendMap = new Map<string, { fecha: string; score: number; n: number; aprobados: number; observados: number; rechazados: number; criticos: number }>();
    for (let d = data.days - 1; d >= 0; d--) {
      const key = new Date(nowMs - d * 86400000).toISOString().slice(0, 10);
      trendMap.set(key, { fecha: key, score: 0, n: 0, aprobados: 0, observados: 0, rechazados: 0, criticos: 0 });
    }
    rows.forEach((r) => {
      const k = (r.ejecutado_at ?? "").slice(0, 10);
      const t = trendMap.get(k);
      if (!t) return;
      t.score += r.qa_score; t.n += 1;
      if (r.dictamen === "aprobado") t.aprobados += 1;
      else if (r.dictamen === "aprobado_obs") t.observados += 1;
      else if (r.dictamen === "rechazado") t.rechazados += 1;
      if (r.alertas_criticas > 0) t.criticos += 1;
    });
    const tendencia = [...trendMap.values()].map((t) => ({
      ...t, scoreProm: t.n ? t.score / t.n : 0,
    }));

    // Priority counts
    const prioridad = {
      bloqueados: rows.filter((r) => r.dictamen === "rechazado" || r.estado_caso === "bloqueado").length,
      esperandoDictamen: rows.filter((r) => r.dictamen === "requiere_revision").length,
      devueltos: rows.filter((r) => r.validacion_estado === "devuelto").length,
      alertasCriticas: rows.reduce((s, r) => s + r.alertas_criticas, 0),
      uvrSinRevision: rows.filter((r) => r.modalidad === "uvr" && (r.dictamen === "requiere_revision" || r.qa_score < 90)).length,
      slaVencidos: rows.filter((r) => r.sla_vencido).length,
    };

    return { rows, bancos, analistas, topErrores, tendencia, prioridad };
  });

// ─────────────────────────────────────────────────────────────
// Helper compartido: liberación operativa tras aprobar una auditoría QA.
// Reutilizado por `aprobarAuditoriaPorAuditor` (flujo normal, con
// guardarraíl de score/dictamen) y por `aprobarAuditoriaConOverride`
// (Director Financiero QA / Super Admin, salta el guardarraíl).
// El único diferencial entre ambos flujos es el texto de auditoría
// (observación de historial + mensaje al analista): cuando viene
// `opts.override`, marcamos explícitamente "OVERRIDE manual" + la
// justificación para que el rastro auditable sea inequívoco.
// ─────────────────────────────────────────────────────────────
type AuditoriaLiberable = {
  id: string;
  codigo: string | null;
  analista_id: string | null;
  expediente_id: string | null;
  qa_score: number | null;
  dictamen: string | null;
};

async function ejecutarLiberacionOperativaAuditor(
  supabase: SupabaseClient<Database>,
  userId: string,
  aud: AuditoriaLiberable,
  opts: { notas?: string | null; override?: { justificacion: string } | null },
): Promise<{ liberacionOperativaOk: boolean; liberacionOperativaError: string | null }> {
  let liberacionOperativaOk = false;
  let liberacionOperativaError: string | null = null;

  const notas = opts.notas ?? null;
  const override = opts.override ?? null;
  const codigoCorto = aud.codigo ?? aud.id.slice(0, 8);

  if (aud.expediente_id) {
    try {
      // 1) Snapshot de la propuesta vigente en `aprobado_data`
      const { data: exp } = await supabase
        .from("expedientes")
        .select(
          "estado_caso, propuesta_data, credito_data, cliente_data, honorarios_base, honorarios_final, descuento, discount_data, banco, producto, numero_credito",
        )
        .eq("id", aud.expediente_id)
        .maybeSingle();

      if (exp) {
        const e = exp as Record<string, unknown>;
        const estadoCasoAnterior = (e.estado_caso as string | null) ?? null;

        const disc = (e.discount_data ?? null) as { vigencia?: string | null; percent?: number | null } | null;
        const snapshot = {
          fechaAprobacion: new Date().toISOString(),
          aprobadoPor: userId,
          validacionId: null,
          origen: override ? "qa_ai_auditor_override" : "qa_ai_auditor",
          auditoriaId: aud.id,
          auditoriaCodigo: aud.codigo,
          override: override ? { justificacion: override.justificacion } : null,
          propuesta: e.propuesta_data ?? null,
          credito: e.credito_data ?? null,
          cliente: e.cliente_data ?? null,
          honorariosBase: e.honorarios_base ?? null,
          honorariosFinal: e.honorarios_final ?? null,
          descuento: e.descuento ?? null,
          discountData: e.discount_data ?? null,
          vigencia: disc?.vigencia ?? null,
          banco: e.banco ?? null,
          producto: e.producto ?? null,
          numeroCredito: e.numero_credito ?? null,
        };

        // 2) Cambio de estado_caso → proyeccion_aprobada_qa
        const nuevoEstadoCaso = "proyeccion_aprobada_qa" as const;
        const estadoDerivado = mapCasoToExpedienteEstado(nuevoEstadoCaso);

        await supabase
          .from("expedientes")
          .update({
            aprobado_data: snapshot as unknown as Json,
            estado_caso: nuevoEstadoCaso,
            estado: estadoDerivado,
          } as never)
          .eq("id", aud.expediente_id);

        // 3) Historial de la transición
        const observacionBase = override
          ? `Aprobado con OVERRIDE manual por auditor QA AI – ${codigoCorto} · Justificación: ${override.justificacion}`
          : `Aprobado por auditor QA AI – ${codigoCorto}${notas ? ` · ${notas}` : ""}`;

        await supabase.from("expediente_historial").insert({
          expediente_id: aud.expediente_id,
          estado_caso_anterior: estadoCasoAnterior,
          estado_caso_nuevo: nuevoEstadoCaso,
          accion_origen: "manual",
          observacion: observacionBase,
          user_id: userId,
        } as never);

        // 4) Notificar a jurídica de que el caso quedó listo para contratación
        try {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("user_id, role")
            .in("role", ["juridica", "director_juridico"] as never);
          const destinos = Array.from(
            new Set(((roles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
          );
          if (destinos.length) {
            await supabase.from("notificaciones_usuario").insert(
              destinos.map((uid) => ({
                user_id: uid,
                titulo: override ? "Caso liberado por override QA" : "Nuevo caso aprobado por QA",
                mensaje: override
                  ? `Caso liberado con OVERRIDE manual por Dirección Financiera QA (${codigoCorto}). Listo para gestión jurídica.`
                  : `Caso liberado por auditor QA AI (${codigoCorto}). Listo para gestión jurídica.`,
                tipo: "qa_aprobada",
                link: `/casos/${aud.expediente_id}`,
                metadata: {
                  expediente_id: aud.expediente_id,
                  auditoria_id: aud.id,
                  codigo: aud.codigo,
                  override: !!override,
                } as unknown as Json,
              })),
            );
          }
        } catch {
          /* notificaciones best-effort */
        }

        liberacionOperativaOk = true;
      }
    } catch (e) {
      liberacionOperativaError = e instanceof Error ? e.message : String(e);
      console.warn("[qaAI] no se pudo liberar operativamente el caso", e);
    }
  }

  try {
    // Destinatarios operativos: analista_id de la auditoría + asesor_id +
    // licenciado_id del expediente. Deduplicados. Se excluye al auditor
    // (userId) para no auto-notificarlo.
    let asesorId: string | null = null;
    let licenciadoId: string | null = null;
    if (aud.expediente_id) {
      const { data: expRow } = await supabase
        .from("expedientes")
        .select("asesor_id, licenciado_id")
        .eq("id", aud.expediente_id)
        .maybeSingle();
      const r = (expRow as { asesor_id: string | null; licenciado_id: string | null } | null) ?? null;
      asesorId = r?.asesor_id ?? null;
      licenciadoId = r?.licenciado_id ?? null;
    }
    const destinos = Array.from(
      new Set(
        [aud.analista_id ?? null, asesorId, licenciadoId]
          .filter((v): v is string => !!v)
          .filter((v) => v !== userId),
      ),
    );

    if (destinos.length) {
      const titulo = override
        ? `Auditoría ${codigoCorto} aprobada con override manual`
        : `Auditoría ${codigoCorto} aprobada`;
      const mensaje =
        (override
          ? `Tu auditoría QA fue liberada con OVERRIDE manual por Dirección Financiera QA. Justificación: ${override.justificacion}.`
          : `Tu auditoría QA fue verificada y aprobada por el auditor.`) +
        (liberacionOperativaOk
          ? ` El caso quedó liberado y avanzó a Contratación.`
          : ` Puedes continuar con la propuesta comercial del caso.`) +
        (!override && notas ? ` Notas: ${notas}` : "");
      const link = aud.expediente_id ? `/qa-ai/${aud.id}` : `/herramientas/simulador?auditoriaId=${aud.id}`;
      const metadata = {
        auditoria_id: aud.id,
        codigo: aud.codigo,
        expediente_id: aud.expediente_id,
        score: aud.qa_score,
        dictamen: aud.dictamen,
        liberacion_operativa: liberacionOperativaOk,
        liberacion_operativa_error: liberacionOperativaError,
        override: !!override,
      } as unknown as Json;

      await supabase.from("notificaciones_usuario").insert(
        destinos.map((uid) => ({
          user_id: uid,
          titulo,
          mensaje,
          tipo: "qa_auditoria_aprobada",
          link,
          metadata,
        })),
      );
    }
  } catch {
    /* no-op best-effort */
  }

  return { liberacionOperativaOk, liberacionOperativaError };
}

/**
 * Aprobar manualmente una auditoría como auditor, sellando fecha + autor +
 * notas y notificando al analista para que pueda continuar el caso.
 */
export const aprobarAuditoriaPorAuditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      auditoriaId: z.string().uuid(),
      notas: z.string().trim().max(2000).optional().default(""),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .select("id,codigo,analista_id,expediente_id,qa_score,dictamen,categoria,auditor_aprobado_at,estado_registro")
      .eq("id", data.auditoriaId)
      .maybeSingle();
    if (errAud) throw new Error(errAud.message);
    if (!aud) throw new Error("Auditoría no encontrada");
    if ((aud as { estado_registro?: string }).estado_registro === "anulada") {
      throw new Error("Esta auditoría fue anulada y no puede ser aprobada.");
    }

    const yaAprobada = !!aud.auditor_aprobado_at;

    // ── Guardarraíl NUVIA: un auditor NO puede certificar casos por debajo del
    // umbral operativo. Score < 85, dictamen "rechazado" o "requiere_revision"
    // exigen que el analista corrija el caso y vuelva a auditar antes de liberar.
    if (!yaAprobada) {
      const scoreAud = Number(aud.qa_score ?? 0);
      const dictamenAud = String(aud.dictamen ?? "");
      const categoriaAud = String((aud as { categoria?: string | null }).categoria ?? "");
      const bloqueaDictamen = dictamenAud === "rechazado" || dictamenAud === "requiere_revision";
      const bloqueaCategoria = categoriaAud === "rechazado" || categoriaAud === "revisar";
      if (scoreAud < 85 || bloqueaDictamen || bloqueaCategoria) {
        throw new Error(
          `No se puede aprobar: la certificación es ${Math.round(scoreAud)}/100 (${dictamenAud || categoriaAud || "no apta"}). ` +
          `Se requiere score ≥ 85 y dictamen APROBADO o APROBADO CON OBSERVACIONES. ` +
          `Devuelva el caso al analista, corrija los hallazgos y reejecute la auditoría.`,
        );
      }
    }

    const { error: errUpd } = await supabase
      .from("qa_auditorias")
      .update({
        auditor_aprobado_at: new Date().toISOString(),
        auditor_aprobado_by: userId,
        auditor_notas: data.notas || null,
      })
      .eq("id", data.auditoriaId);
    if (errUpd) throw new Error(errUpd.message);

    let liberacionOperativaOk = false;
    let liberacionOperativaError: string | null = null;

    if (!yaAprobada) {
      const res = await ejecutarLiberacionOperativaAuditor(
        supabase,
        userId,
        aud as AuditoriaLiberable,
        { notas: data.notas || null, override: null },
      );
      liberacionOperativaOk = res.liberacionOperativaOk;
      liberacionOperativaError = res.liberacionOperativaError;
    }

    return {
      ok: true,
      yaAprobada,
      codigo: aud.codigo,
      aprobadoAt: new Date().toISOString(),
      liberacionOperativaOk,
      liberacionOperativaError,
    };
  });

/**
 * Aprobar una auditoría **saltando el guardarraíl automático** de
 * score/dictamen. Solo Director Financiero QA o Super Admin. Requiere
 * justificación explícita (≥ 20 caracteres) que queda persistida en
 * `auditor_override_justificacion` para rastro auditable. La liberación
 * operativa (snapshot, cambio de estado, historial, notificaciones) usa el
 * mismo helper que el flujo normal, con textos que marcan el OVERRIDE.
 */
export const aprobarAuditoriaConOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      auditoriaId: z.string().uuid(),
      justificacion: z
        .string()
        .trim()
        .min(20, "La justificación debe tener al menos 20 caracteres.")
        .max(2000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1) Autorización estricta: solo director_financiero_qa o super_admin.
    // No usamos isDirectorQA (que incluye admin/gerencia) porque este
    // override es una decisión operativa del dueño del criterio QA.
    const { data: rolesRows, error: errRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (errRoles) throw new Error(errRoles.message);
    const userRoles = new Set((rolesRows ?? []).map((r) => String(r.role)));
    if (!userRoles.has("director_financiero_qa") && !userRoles.has("super_admin")) {
      throw new Error(
        "No autorizado: solo Director Financiero QA o Super Admin pueden aplicar override manual sobre el guardarraíl.",
      );
    }

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .select("id,codigo,analista_id,expediente_id,qa_score,dictamen,categoria,auditor_aprobado_at,estado_registro")
      .eq("id", data.auditoriaId)
      .maybeSingle();
    if (errAud) throw new Error(errAud.message);
    if (!aud) throw new Error("Auditoría no encontrada");
    if ((aud as { estado_registro?: string }).estado_registro === "anulada") {
      throw new Error("Esta auditoría fue anulada y no puede ser aprobada con override.");
    }

    const yaAprobada = !!aud.auditor_aprobado_at;
    if (yaAprobada) {
      throw new Error("Esta auditoría ya fue aprobada. No se puede aplicar override sobre una aprobación existente.");
    }

    // 2) Sellar aprobación + marca de override + justificación.
    const { error: errUpd } = await supabase
      .from("qa_auditorias")
      .update({
        auditor_aprobado_at: new Date().toISOString(),
        auditor_aprobado_by: userId,
        auditor_notas: null,
        auditor_override: true,
        auditor_override_justificacion: data.justificacion,
      } as never)
      .eq("id", data.auditoriaId);
    if (errUpd) throw new Error(errUpd.message);

    // 3) Liberación operativa compartida (mismo flujo que la aprobación normal).
    const { liberacionOperativaOk, liberacionOperativaError } =
      await ejecutarLiberacionOperativaAuditor(
        supabase,
        userId,
        aud as AuditoriaLiberable,
        { notas: null, override: { justificacion: data.justificacion } },
      );

    return {
      ok: true,
      yaAprobada: false,
      codigo: aud.codigo,
      aprobadoAt: new Date().toISOString(),
      override: true,
      liberacionOperativaOk,
      liberacionOperativaError,
    };
  });

// ─────────────────────────────────────────────────────────────
// NUVIA · Validación matemática de la reconstrucción del AUDITOR
// El auditor edita los inputs en el sandbox `qa-review-<auditoriaId>`.
// Esta función toma esos overrides, los fusiona contra el snapshot
// reconstruido, vuelve a correr `auditar()` y persiste el nuevo
// `qa_score` / `dictamen` / `outputs` para que el certificado refleje
// el delta (ej. 85 → 95). Preserva el score anterior en
// `auditor_score_anterior` y marca `auditor_validated_at`.
// ─────────────────────────────────────────────────────────────
export const validarReconstruccionAuditor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      auditoriaId: z.string().uuid(),
      overrides: z.object({
        saldoCapital: z.number().optional(),
        tasaEa: z.number().optional(),
        seguros: z.number().optional(),
        cuotaBase: z.number().optional(),
        cuotasPendientes: z.number().optional(),
        saldoUVR: z.number().optional(),
        valorUVR: z.number().optional(),
        variacionUVR: z.number().optional(),
      }).passthrough(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: aud, error } = await supabase
      .from("qa_auditorias")
      .select("*")
      .eq("id", data.auditoriaId)
      .single();
    if (error) throw new Error(error.message);
    if ((aud as { estado_registro?: string }).estado_registro === "anulada") {
      throw new Error("Esta auditoría fue anulada. Reconstrucción bloqueada.");
    }



    const inputs = (aud.inputs ?? {}) as Record<string, unknown>;
    const rec = { ...(inputs.reconstruccion ?? {}) } as Record<string, unknown>;
    const o = data.overrides;

    const num = (v: unknown) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    // Fusión de overrides del auditor sobre la reconstrucción base
    if (num(o.saldoCapital) !== undefined) rec.saldoCapital = o.saldoCapital;
    if (num(o.tasaEa) !== undefined) rec.tasaEa = o.tasaEa;
    if (o.seguros !== undefined && Number.isFinite(o.seguros)) rec.seguros = o.seguros;
    if (num(o.cuotasPendientes) !== undefined) rec.cuotasPendientes = o.cuotasPendientes;
    if (num(o.cuotaBase) !== undefined) {
      rec.cuotaBaseSinSubsidio = o.cuotaBase;
      const seg = Number(rec.seguros ?? 0);
      rec.cuotaFinancieraSinSeguros = Math.max(0, Number(o.cuotaBase) - seg);
    }
    if (num(o.saldoUVR) !== undefined) rec.saldoUVR = o.saldoUVR;
    if (num(o.valorUVR) !== undefined) rec.valorUVR = o.valorUVR;
    if (o.variacionUVR !== undefined && Number.isFinite(o.variacionUVR)) rec.variacionUvrEa = o.variacionUVR;

    inputs.reconstruccion = rec;

    const modalidadFinal = (inputs.modalidad as Modalidad | undefined) ?? (aud.modalidad as Modalidad);
    const overrides = await cargarToleranciasActivasInterno(supabase as never);

    const result = auditar({
      modalidad: modalidadFinal,
      reconstruccion: { ...rec, modalidad: modalidadFinal } as never,
      extracto: inputs.extracto as never,
      simulacion: inputs.simulacion as never,
      tolerancias: overrides,
    });

    const scoreAnterior = Number(aud.qa_score ?? 0);
    const scoreNuevo = Number(result.score.score) || 0;

    const { error: updErr } = await supabase
      .from("qa_auditorias")
      .update({
        motor_version: QA_MOTOR_VERSION,
        qa_score: scoreNuevo,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        inputs: JSON.parse(JSON.stringify(inputs)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          totalCorreccionUvr: result.reconstruccion.totalCorreccionUvr,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
          todasCuotas: result.reconstruccion.todasCuotas,
          veredicto: result.veredicto,
        })),
        diferencias: JSON.parse(JSON.stringify(result.inconsistencias)),
        alertas: JSON.parse(JSON.stringify(result.inconsistencias.filter((i) => i.severidad === "critica"))),
        ejecutado_at: new Date().toISOString(),
        ejecutado_by: userId,
        auditor_validated_at: new Date().toISOString(),
        auditor_score_anterior: scoreAnterior,
      } as never)
      .eq("id", data.auditoriaId);
    if (updErr) throw new Error(updErr.message);

    await supabase.from("qa_inconsistencias").delete().eq("auditoria_id", data.auditoriaId);
    if (result.inconsistencias.length) {
      await supabase.from("qa_inconsistencias").insert(
        result.inconsistencias.map((i) => ({
          auditoria_id: data.auditoriaId,
          tipo: i.tipo,
          severidad: i.severidad,
          campo: i.campo ?? null,
          valor_extracto: i.valorExtracto ?? null,
          valor_calculado: i.valorCalculado ?? null,
          diferencia: i.diferencia ?? null,
          mensaje: i.mensaje,
          sugerencia: i.sugerencia ?? null,
        })),
      );
    }

    return {
      ok: true,
      scoreAnterior,
      scoreNuevo,
      delta: Math.round((scoreNuevo - scoreAnterior) * 100) / 100,
      categoria: result.score.categoria,
      dictamen: result.score.dictamen,
      veredicto: result.veredicto,
      inconsistencias: result.inconsistencias.length,
      criticas: result.inconsistencias.filter((i) => i.severidad === "critica").length,
    };
  });

// ─────────────────────────────────────────────────────────────
// NUVIA · Anulación lógica de auditoría QA
// ─────────────────────────────────────────────────────────────
//
// Envuelve la RPC `public.anular_qa_auditoria(_auditoria_id, _motivo)`,
// única vía autorizada para pasar `estado_registro` de 'activa' a 'anulada'.
//
// - La normalización del motivo debe ser IDÉNTICA en las 3 capas
//   (UI, wrapper, RPC): trim + colapso de espacios y longitud 3..1000.
// - Idempotente: si ya estaba anulada, la RPC responde
//   `already_cancelled` (ok=true, idempotent=true).
// - Códigos de negocio expuestos al front:
//     `cancelled` | `already_cancelled` | `not_found` | `invalid_reason`
//     | `linked_to_expediente` | `not_owner` | `approved_by_director`
//     | `unauthenticated`
// - Reglas de autorización y bloqueos por vínculo con expediente viven
//   en la RPC (SECURITY DEFINER) — este wrapper NO decide, solo traduce.
export function normalizarMotivoAnulacionQA(input: string): string {
  return String(input ?? "").trim().replace(/\s+/g, " ");
}

export type AnulacionQACode =
  | "ok"
  | "already_cancelled"
  | "not_found"
  | "invalid_reason"
  | "linked_to_expediente"
  | "not_owner"
  | "approved_by_director"
  | "forbidden_role";

export const MENSAJE_ANULACION_QA: Record<AnulacionQACode, string> = {
  ok: "Auditoría anulada correctamente.",
  already_cancelled: "Esta auditoría ya estaba anulada.",
  not_found: "La auditoría no existe o no es visible.",
  invalid_reason: "El motivo debe tener entre 3 y 1000 caracteres.",
  linked_to_expediente:
    "No se puede anular: la auditoría ya está vinculada a un expediente.",
  not_owner:
    "No autorizado: solo el analista propietario puede anular esta auditoría.",
  approved_by_director:
    "No autorizado: la auditoría fue aprobada por el Director. Solicite a Dirección QA la anulación.",
  forbidden_role:
    "No autorizado: su rol no puede anular auditorías. Solicite apoyo a Dirección QA.",
};

export const anularAuditoriaServer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      auditoriaId: z.string().uuid(),
      motivo: z
        .string()
        .transform((s) => s.trim().replace(/\s+/g, " "))
        .refine((s) => s.length >= 3 && s.length <= 1000, {
          message: "El motivo debe tener entre 3 y 1000 caracteres.",
        }),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rpc, error } = await supabase.rpc("anular_qa_auditoria", {
      _auditoria_id: data.auditoriaId,
      _motivo: data.motivo,
    });
    if (error) throw new Error(error.message);
    const res = (rpc ?? {}) as {
      ok?: boolean;
      code?: AnulacionQACode;
      idempotent?: boolean;
      auditoria_id?: string;
      anulada_at?: string;
    };
    return {
      ok: !!res.ok,
      code: (res.code ?? "not_found") as AnulacionQACode,
      idempotent: !!res.idempotent,
      auditoriaId: res.auditoria_id ?? data.auditoriaId,
      anuladaAt: res.anulada_at ?? null,
    };
  });

