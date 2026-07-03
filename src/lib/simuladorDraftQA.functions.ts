// Server functions para el modo "draft" del simulador NUVIA.
//
// - auditarSimulacionDraft: corre la auditoría matemática de NUVIA en memoria
//   contra un snapshot del extracto. NO persiste nada (ni extractos_lecturas
//   ni qa_auditorias ni qa_inconsistencias). Devuelve hallazgos + veredicto.
//
// - escalarConsultaTecnica: crea una consulta técnica en la tabla
//   `consultas_tecnicas` para que el director financiero la resuelva SIN
//   crear un expediente_maestro.
//
// - marcarAuditoriaCertificada: marca una auditoría real (ya persistida)
//   como certificada por NUVIA (certificado_nuvia=true + hash_calculo).
//
// Todo lo referente al PDF de propuesta comercial se mantiene intacto: no se
// toca aquí. La certificación es sólo una marca de trazabilidad.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { auditar, TOLERANCIAS_DEFAULT, type Modalidad, type Tolerancias } from "@/lib/qaMath";

// ─────────────────────────────────────────────────────────────
// Utilidades locales (duplicadas de qaAI.functions.ts para
// mantener este módulo autocontenido y evitar acoplarlo al
// motor de persistencia).
// ─────────────────────────────────────────────────────────────

const parseNum = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  const s = String(v).replace(/\./g, "").replace(/,/g, ".").replace(/[^0-9.\-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const inferRemainingPayments = (
  saldo: number,
  tasaEaPct: number,
  cuotaFinanciera: number,
): number => {
  if (!(saldo > 0 && tasaEaPct > 0 && cuotaFinanciera > 0)) return 0;
  const i = Math.pow(1 + tasaEaPct / 100, 1 / 12) - 1;
  if (!(i > 0) || cuotaFinanciera <= saldo * i) return 0;
  const n = Math.log(cuotaFinanciera / (cuotaFinanciera - saldo * i)) / Math.log(1 + i);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const nearestStandardTerm = (months: number): number => {
  const standards = [60, 84, 120, 180, 240, 300, 360];
  return standards.reduce(
    (best, cur) => (Math.abs(cur - months) < Math.abs(best - months) ? cur : best),
    standards[0],
  );
};

async function cargarToleranciasActivas(
  supabase: unknown,
): Promise<Partial<Tolerancias>> {
  try {
    const client = supabase as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            k: string,
            v: boolean,
          ) => Promise<{ data: Array<{ codigo: string; payload: Record<string, unknown> }> | null }>;
        };
      };
    };
    const { data } = await client.from("qa_reglas").select("codigo,payload").eq("activa", true);
    const map = new Map<string, Record<string, unknown>>(
      (data ?? []).map((r) => [r.codigo, (r.payload ?? {}) as Record<string, unknown>]),
    );
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
    const uExc = map.get("umb.score.excelente") ?? {};
    if (num(uExc.min) !== undefined) out.umbScoreExcelente = num(uExc.min);
    const uApr = map.get("umb.score.aprobado") ?? {};
    if (num(uApr.min) !== undefined) out.umbScoreAprobado = num(uApr.min);
    const uRev = map.get("umb.score.revisar") ?? {};
    if (num(uRev.min) !== undefined) out.umbScoreRevisar = num(uRev.min);
    return out;
  } catch {
    return {};
  }
}

// ─────────────────────────────────────────────────────────────
// 1. Dry-run: auditar en memoria un snapshot del extracto
// ─────────────────────────────────────────────────────────────

export type DraftAuditHallazgo = {
  mensaje: string;
  severidad: "info" | "warning" | "critica";
  campo?: string | null;
  motor?: string | null;
};

export type DraftAuditResult = {
  score: number;
  categoria: "excelente" | "aprobado" | "revisar" | "rechazado";
  dictamen: "aprobado" | "aprobado_obs" | "requiere_revision" | "rechazado";
  criticos: number;
  totalHallazgos: number;
  hallazgos: DraftAuditHallazgo[];
  certificable: boolean;
  hashCalculo: string;
  motivoBloqueo?: string;
};

const draftInputSchema = z.object({
  banco: z.string().nullable().optional(),
  producto: z.string().nullable().optional(),
  moneda: z.string().nullable().optional(),
  datos: z.record(z.unknown()).default({}),
});

export const auditarSimulacionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => draftInputSchema.parse(input))
  .handler(async ({ data, context }): Promise<DraftAuditResult> => {
    const { supabase } = context;
    const d = (data.datos ?? {}) as Record<string, unknown>;

    // Normalización (misma lógica que auditarLecturaAutomatica en qaAI.functions.ts)
    const productoStr = String(d.producto ?? data.producto ?? "").toUpperCase();
    const modalidad: Modalidad = productoStr.includes("LEASING")
      ? "leasing"
      : d.saldoUVR || d.valorUVR
        ? "uvr"
        : "hipotecario";

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
    const cuotaBaseSinSubsidio =
      parseNum(d.cuotaSinSubsidio) ?? parseNum(d.cuotaBaseSimulacion) ?? parseNum(d.cuotaActual);
    const cuotaFinancieraSinSeguros =
      parseNum(d.cuotaConInteresSinSeguros) ??
      parseNum(d.cuotaSinSeguros) ??
      (cuotaBaseSinSubsidio ? Math.max(0, cuotaBaseSinSubsidio - seguros) : undefined);

    const bancoProducto = `${String(d.banco ?? data.banco ?? "")} ${String(d.producto ?? data.producto ?? "")}`;
    if (/fondo\s+nacional\s+del\s+ahorro|\bfna\b/i.test(bancoProducto)) {
      const inferred = inferRemainingPayments(saldo, tasa, cuotaFinancieraSinSeguros ?? 0);
      const plazoLeido = parseNum(d.plazoInicial) ?? 0;
      if (inferred > 0 && cuotasPag > 0) {
        const totalIncluyendoActual = cuotasPag + inferred - 1;
        const plazoEstandar = nearestStandardTerm(totalIncluyendoActual);
        const plazoCorregido =
          Math.abs(plazoEstandar - totalIncluyendoActual) <= 2
            ? plazoEstandar
            : totalIncluyendoActual;
        if (plazoLeido >= 300 && plazoLeido <= 366 && plazoCorregido < plazoLeido - 24) {
          cuotasPend = inferred;
        } else if (!cuotasPend || Math.abs(cuotasPend - inferred) > 12) {
          cuotasPend = inferred;
        }
      }
    }

    const cuotaExt =
      (frech && frech > 0) || (frechValorMensual && frechValorMensual > 0)
        ? parseNum(d.cuotaPagadaCliente) ?? parseNum(d.valorAPagar) ?? parseNum(d.cuotaActual)
        : parseNum(d.cuotaActual);

    const FRECH_MAX = 84;
    const tieneFrech = (frech && frech > 0) || (frechValorMensual && frechValorMensual > 0);
    const frechCuotasRestantes = tieneFrech
      ? Math.max(0, Math.min(cuotasPend, FRECH_MAX - cuotasPag))
      : undefined;

    const overrides = await cargarToleranciasActivas(supabase);
    const tol: Tolerancias = { ...TOLERANCIAS_DEFAULT, ...overrides };

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
      tolerancias: tol,
    });

    const criticos = result.inconsistencias.filter((i) => i.severidad === "critica").length;
    const total = result.inconsistencias.length;
    const dictamen = result.score.dictamen;
    const categoria = result.score.categoria;

    // Hash determinístico del cálculo → evidencia trazable de la certificación.
    const hashPayload = JSON.stringify({
      banco: data.banco ?? null,
      producto: data.producto ?? null,
      moneda: data.moneda ?? null,
      inputs: {
        saldo,
        tasa,
        tasaPactada: tasaPactada ?? null,
        cuotasPend,
        cuotasPag,
        seguros,
        frech: frech ?? null,
        frechValorMensual: frechValorMensual ?? null,
        desemb: desemb ?? null,
        saldoUVR: saldoUVR ?? null,
        valorUVR: valorUVR ?? null,
        cuotaExt: cuotaExt ?? null,
      },
      score: result.score.score,
      dictamen,
    });
    const hashCalculo = createHash("sha256").update(hashPayload).digest("hex").slice(0, 32);

    const certificable = criticos === 0 && dictamen === "aprobado";

    let motivoBloqueo: string | undefined;
    if (!certificable) {
      if (criticos > 0) motivoBloqueo = `${criticos} hallazgo(s) crítico(s). Corrige o escala a Dirección Financiera.`;
      else if (dictamen === "rechazado") motivoBloqueo = "La auditoría rechaza los inputs. Simulación no viable.";
      else if (dictamen === "requiere_revision") motivoBloqueo = "La auditoría requiere revisión antes de certificar.";
      else motivoBloqueo = "La auditoría requiere ajustes menores.";
    }

    return {
      score: result.score.score,
      categoria,
      dictamen,
      criticos,
      totalHallazgos: total,
      hallazgos: result.inconsistencias.slice(0, 20).map((i) => ({
        mensaje: i.mensaje,
        severidad: i.severidad,
        campo: (i as { campo?: string | null }).campo ?? null,
        motor: (i as { motor?: string | null }).motor ?? null,
      })),
      certificable,
      hashCalculo,
      motivoBloqueo,
    };
  });

// ─────────────────────────────────────────────────────────────
// 2. Escalar consulta técnica al Director Financiero (sin caso)
// ─────────────────────────────────────────────────────────────

const escalarInputSchema = z.object({
  snapshot: z.record(z.unknown()),
  banco: z.string().nullable().optional(),
  producto: z.string().nullable().optional(),
  tipoCredito: z.string().nullable().optional(),
  moneda: z.string().nullable().optional(),
  hallazgos: z.array(z.unknown()).default([]),
  notas: z.string().max(4000).optional(),
});

export const escalarConsultaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => escalarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: row, error } = await supabase
      .from("consultas_tecnicas")
      .insert({
        analista_id: userId,
        estado: "pendiente",
        banco: data.banco ?? null,
        producto: data.producto ?? null,
        tipo_credito: data.tipoCredito ?? null,
        moneda: data.moneda ?? null,
        snapshot_simulacion: data.snapshot as never,
        hallazgos_nuvia: data.hallazgos as never,
        notas_analista: data.notas ?? null,
      })
      .select("id,restore_token,created_at")
      .single();
    if (error) throw new Error(error.message);

    return {
      id: row.id as string,
      restoreToken: (row.restore_token as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });

// ─────────────────────────────────────────────────────────────
// 3. Marcar una auditoría real como certificada por NUVIA
// ─────────────────────────────────────────────────────────────

const marcarInputSchema = z.object({
  auditoriaId: z.string().uuid(),
  hashCalculo: z.string().min(8).max(128),
});

export const marcarAuditoriaCertificada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => marcarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("audit_simulaciones")
      .update({
        certificado_nuvia: true,
        hash_calculo: data.hashCalculo,
      })
      .eq("id", data.auditoriaId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
