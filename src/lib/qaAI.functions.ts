import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditar, QA_MOTOR_VERSION, type Modalidad } from "./qaMath";

const ModalidadEnum = z.enum(["hipotecario", "leasing", "uvr"]);

const AuditarInputSchema = z.object({
  expedienteId: z.string().uuid().nullable().optional(),
  simulacionId: z.string().uuid().nullable().optional(),
  extractoId: z.string().uuid().nullable().optional(),
  analistaId: z.string().uuid().nullable().optional(),
  modalidad: ModalidadEnum,
  reconstruccion: z.object({
    saldoCapital: z.number().nonnegative(),
    tasaEa: z.number().nonnegative(),
    cuotasPendientes: z.number().int().nonnegative(),
    seguros: z.number().nonnegative().default(0),
    coberturaFrechPp: z.number().nonnegative().optional(),
    valorDesembolsado: z.number().nonnegative().optional(),
  }),
  extracto: z.object({
    saldoCapital: z.number().nonnegative().optional(),
    tasaEa: z.number().nonnegative().optional(),
    cuota: z.number().nonnegative().optional(),
    seguros: z.number().nonnegative().optional(),
    coberturaFrechPp: z.number().nonnegative().optional(),
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
    const result = auditar({
      modalidad: data.modalidad as Modalidad,
      reconstruccion: {
        modalidad: data.modalidad as Modalidad,
        saldoCapital: data.reconstruccion.saldoCapital,
        tasaEa: data.reconstruccion.tasaEa,
        cuotasPendientes: data.reconstruccion.cuotasPendientes,
        seguros: data.reconstruccion.seguros,
        coberturaFrechPp: data.reconstruccion.coberturaFrechPp,
        valorDesembolsado: data.reconstruccion.valorDesembolsado,
      },
      extracto: data.extracto,
      simulacion: data.simulacion,
    });

    const { supabase, userId } = context;

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
        inputs: JSON.parse(JSON.stringify(data)),
        outputs: JSON.parse(JSON.stringify({
          cuotaTeorica: result.reconstruccion.cuotaTeorica,
          cuotaConSubsidio: result.reconstruccion.cuotaConSubsidio,
          cuotaTotalConSeguros: result.reconstruccion.cuotaTotalConSeguros,
          beneficioMensualFrech: result.reconstruccion.beneficioMensualFrech,
          costoTotal: result.reconstruccion.costoTotal,
          vecesPagado: result.reconstruccion.vecesPagado,
          totalIntereses: result.reconstruccion.totalIntereses,
          iMv: result.reconstruccion.iMv,
          primerasCuotas: result.reconstruccion.primerasCuotas,
          ultimasCuotas: result.reconstruccion.ultimasCuotas,
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
      .select("id,expediente_id,analista_id,modalidad,qa_score,categoria,dictamen,ejecutado_at")
      .order("ejecutado_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const obtenerAuditoriaQA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: aud, error } = await context.supabase
      .from("qa_auditorias").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { data: incs } = await context.supabase
      .from("qa_inconsistencias").select("*").eq("auditoria_id", data.id);
    return { auditoria: aud, inconsistencias: incs ?? [] };
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
    const promedio = total ? r.reduce((s, x) => s + Number(x.qa_score || 0), 0) / total : 0;
    const { count: alertasAbiertas } = await context.supabase
      .from("qa_alertas").select("id", { count: "exact", head: true }).eq("estado", "abierta");
    return { total, aprobados, obs, rechazados, promedio, alertasAbiertas: alertasAbiertas ?? 0 };
  });
