import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditar, QA_MOTOR_VERSION, TOLERANCIAS_DEFAULT, type Inconsistencia, type Modalidad, type Tolerancias } from "./qaMath";

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
        analista_id: data.analistaId ?? null,
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

    return { auditoriaId, ...result };
  });

export const listAuditoriasQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().positive().max(500).default(100) }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("qa_auditorias")
      .select("id,expediente_id,analista_id,extracto_id,modalidad,qa_score,categoria,dictamen,ejecutado_at")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);

    const baseRows = rows ?? [];
    const expIds = [...new Set(baseRows.map((r) => r.expediente_id).filter((id): id is string => !!id))];
    const anaIds = [...new Set(baseRows.map((r) => r.analista_id).filter((id): id is string => !!id))];
    const extIds = [...new Set(baseRows.map((r) => r.extracto_id).filter((id): id is string => !!id))];

    const [expRes, profRes, extRes] = await Promise.all([
      expIds.length
        ? context.supabase.from("expedientes").select("id,cliente_nombre,banco").in("id", expIds)
        : Promise.resolve({ data: [] as Array<{ id: string; cliente_nombre: string | null; banco: string | null }> }),
      anaIds.length
        ? context.supabase.from("profiles").select("id,nombre").in("id", anaIds)
        : Promise.resolve({ data: [] as Array<{ id: string; nombre: string | null }> }),
      extIds.length
        ? context.supabase.from("extractos_lecturas").select("id,archivo_path").in("id", extIds)
        : Promise.resolve({ data: [] as Array<{ id: string; archivo_path: string | null }> }),
    ]);

    const expMap = new Map((expRes.data ?? []).map((e) => [e.id, e]));
    const profMap = new Map((profRes.data ?? []).map((p) => [p.id, p]));
    const extMap = new Map((extRes.data ?? []).map((e) => [e.id, e]));

    const enriched = baseRows.map((r) => {
      const exp = r.expediente_id ? expMap.get(r.expediente_id) : undefined;
      const prof = r.analista_id ? profMap.get(r.analista_id) : undefined;
      const ext = r.extracto_id ? extMap.get(r.extracto_id) : undefined;
      return {
        ...r,
        cliente_nombre: exp?.cliente_nombre ?? null,
        banco: exp?.banco ?? null,
        analista_nombre: prof?.nombre ?? null,
        tiene_extracto: !!(ext && ext.archivo_path),
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
      datos: Record<string, unknown> | null; created_at: string | null;
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
          datos: (extRow.datos as Record<string, unknown> | null) ?? null,
          created_at: (extRow.created_at as string | null) ?? null,
        };
      }
    }
    return { auditoria, inconsistencias: inconsistenciasOverride ?? inconsistenciasDb, extracto };
  });


export const qaKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows } = await context.supabase
      .from("qa_auditorias")
      .select("qa_score,dictamen,ejecutado_at")
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
      .select("id,expediente_id,banco,producto,datos")
      .eq("id", data.extractoLecturaId)
      .single();
    if (errExt) throw new Error(errExt.message);
    const d = (ext.datos ?? {}) as Record<string, unknown>;

    const productoStr = String(d.producto ?? ext.producto ?? "").toUpperCase();
    const modalidad: Modalidad =
      productoStr.includes("LEASING") ? "leasing"
      : (d.saldoUVR || d.valorUVR) ? "uvr" : "hipotecario";

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

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: ext.expediente_id,
        analista_id: userId,
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
