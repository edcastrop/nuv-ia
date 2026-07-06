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
import { auditar, TOLERANCIAS_DEFAULT, QA_MOTOR_VERSION, type Modalidad, type Tolerancias } from "@/lib/qaMath";


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
    const { createHash } = await import("crypto");
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

const certificarDraftSchema = z.object({
  snapshot: draftInputSchema,
});

export const certificarSimulacionDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => certificarDraftSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const snap = data.snapshot;
    const d = (snap.datos ?? {}) as Record<string, unknown>;

    const productoStr = String(d.producto ?? snap.producto ?? "").toUpperCase();
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

    const bancoProducto = `${String(d.banco ?? snap.banco ?? "")} ${String(d.producto ?? snap.producto ?? "")}`;
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
    if (criticos > 0 || result.score.dictamen !== "aprobado") {
      throw new Error("NUVIA no puede certificar esta simulación: la auditoría no está aprobada sin hallazgos críticos.");
    }

    const bancoFinal = String(d.banco ?? snap.banco ?? "") || "SIN_BANCO";
    const productoFinal = String(d.producto ?? snap.producto ?? "") || null;
    const monedaFinal = String(d.moneda ?? snap.moneda ?? "") || null;
    const clienteNombre =
      (typeof d.cliente === "string" && d.cliente.trim())
        ? d.cliente.trim()
        : (typeof d.titular === "string" && d.titular.trim())
          ? d.titular.trim()
          : null;

    const { data: extIns, error: errExt } = await supabase
      .from("extractos_lecturas")
      .insert({
        expediente_id: null,
        asesor_id: userId,
        aprobado_por: userId,
        banco: bancoFinal,
        producto: productoFinal,
        moneda: monedaFinal,
        datos: d as never,
        scores: {} as never,
        confianza_global: 1,
        estado: "certificada",
        motor_version: "v1",
      })
      .select("id")
      .single();
    if (errExt) throw new Error(`No se pudo registrar el extracto certificado: ${errExt.message}`);

    const extractoId = extIns!.id as string;
    const inputsSnap = {
      modalidad,
      extractoLecturaId: extractoId,
      expedienteId: null,
      reconstruccion: { saldoCapital: saldo, tasaEa: tasa, tasaEaPactada: tasaPactada, cuotasPendientes: cuotasPend, cuotasPagadas: cuotasPag, seguros, coberturaFrechPp: frech, coberturaFrechValorMensual: frechValorMensual, coberturaFrechCuotasRestantes: frechCuotasRestantes, valorDesembolsado: desemb, saldoUVR, valorUVR, cuotaBaseSinSubsidio, cuotaFinancieraSinSeguros },
      extracto: { saldoCapital: saldo, tasaEa: tasa, cuota: cuotaExt, seguros, coberturaFrechPp: frech, coberturaFrechValorMensual: frechValorMensual },
      origenCertificacion: "simulador_certificado",
    };

    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: null,
        analista_id: userId,
        extracto_id: extractoId,
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
        alertas: JSON.parse(JSON.stringify([])),
        ejecutado_by: userId,
        origen: "simulador_escalado",
        banco: bancoFinal,
        producto: productoFinal,
        cliente_nombre: clienteNombre,
        simulador_snapshot: JSON.parse(JSON.stringify(snap)),
      } as never)
      .select("id,codigo")
      .single();
    if (errAud) throw new Error(`No se pudo certificar la simulación: ${errAud.message}`);

    await supabase.from("qa_auditoria_log").insert({
      auditoria_id: aud!.id,
      accion: "crear",
      payload: { score: result.score.score, dictamen: result.score.dictamen, fuente: "simulador_certificado" } as never,
      user_id: userId,
    });

    return { auditoriaId: aud!.id as string, codigo: (aud as { codigo: string | null }).codigo ?? null };
  });

// ─────────────────────────────────────────────────────────────
// 2. Escalar simulación → Cola de Revisión NUVIA QA AI
//    Crea una auditoría REAL en qa_auditorias (origen=simulador_escalado)
//    con expediente_id=null, para que llegue al director en /qa-ai igual
//    que llegaba antes con las lecturas de extracto — con su código
//    NUV_AUD_YYYY_XX_00000 y su score/dictamen. No se crea expediente
//    hasta que el analista, después de recibir la simulación auditada,
//    ejecute "Certificar y crear caso" en el simulador.
// ─────────────────────────────────────────────────────────────

const escalarInputSchema = z.object({
  snapshot: z.record(z.unknown()),
  banco: z.string().nullable().optional(),
  producto: z.string().nullable().optional(),
  tipoCredito: z.string().nullable().optional(),
  moneda: z.string().nullable().optional(),
  hallazgos: z.array(z.unknown()).default([]),
  notas: z.string().max(4000).optional(),
  notasParaAuditor: z.string().max(4000).optional(),
});

export const escalarConsultaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => escalarInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const snap = (data.snapshot ?? {}) as Record<string, unknown>;
    const d = (snap.datos ?? snap) as Record<string, unknown>;

    // ── 1. Normalización idéntica a auditarLecturaAutomatica ──
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

    // ── 2. Crear extractos_lecturas (sin expediente) para que el auditor
    //       vea el snapshot del extracto en la UI de siempre.
    const bancoFinal = String(d.banco ?? data.banco ?? "") || "SIN_BANCO";
    const productoFinal = String(d.producto ?? data.producto ?? "") || null;
    const monedaFinal = String(d.moneda ?? data.moneda ?? "") || null;
    const clienteNombre =
      (typeof d.cliente === "string" && d.cliente.trim())
        ? d.cliente.trim()
        : (typeof d.titular === "string" && d.titular.trim())
          ? d.titular.trim()
          : null;

    const { data: extIns, error: errExt } = await supabase
      .from("extractos_lecturas")
      .insert({
        expediente_id: null,
        asesor_id: userId,
        banco: bancoFinal,
        producto: productoFinal,
        moneda: monedaFinal,
        datos: d as never,
        scores: {} as never,
        confianza_global: 0.9,
        estado: "validada",
        motor_version: "v1",
      })
      .select("id")
      .single();
    if (errExt) throw new Error(`No se pudo registrar el extracto: ${errExt.message}`);
    const extractoId = extIns!.id as string;

    // ── 3. Snapshot completo de la simulación (para trazabilidad y
    //       para que el analista pueda restaurar exactamente lo que envió).
    const simuladorSnapshot = {
      ...snap,
      escaladoAt: new Date().toISOString(),
      hallazgosNuvia: data.hallazgos,
    };

    const inputsSnap = {
      modalidad,
      extractoLecturaId: extractoId,
      expedienteId: null,
      reconstruccion: {
        saldoCapital: saldo,
        tasaEa: tasa,
        tasaEaPactada: tasaPactada,
        cuotasPendientes: cuotasPend,
        cuotasPagadas: cuotasPag,
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
        saldoCapital: saldo,
        tasaEa: tasa,
        cuota: cuotaExt,
        seguros,
        coberturaFrechPp: frech,
        coberturaFrechValorMensual: frechValorMensual,
      },
      origenEscalacion: "simulador_escalado",
      notasParaAuditor: data.notasParaAuditor ?? data.notas ?? null,
    };

    // ── 4. Insertar la auditoría (código NUV_AUD_YYYY_XX_00000 lo pone el trigger)
    const { data: aud, error: errAud } = await supabase
      .from("qa_auditorias")
      .insert({
        expediente_id: null,
        analista_id: userId,
        extracto_id: extractoId,
        modalidad,
        motor_version: QA_MOTOR_VERSION,
        qa_score: result.score.score,
        categoria: result.score.categoria,
        dictamen: result.score.dictamen,
        auto_ejecutada: false,
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
        origen: "simulador_escalado",
        banco: bancoFinal,
        producto: productoFinal,
        cliente_nombre: clienteNombre,
        notas_analista_al_auditor: data.notasParaAuditor ?? data.notas ?? null,
        simulador_snapshot: JSON.parse(JSON.stringify(simuladorSnapshot)),
      } as never)
      .select("id, codigo")
      .single();
    if (errAud) throw new Error(`No se pudo escalar la simulación: ${errAud.message}`);
    const auditoriaId = aud!.id as string;
    const codigo = (aud as { codigo: string | null }).codigo ?? null;

    // ── 5. Inconsistencias + alertas + log
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
            expediente_id: null,
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
      payload: { score: result.score.score, dictamen: result.score.dictamen, fuente: "simulador_escalado" } as never,
      user_id: userId,
    });

    // ── 6. Notificar al Director Financiero QA — link a la Cola de Revisión.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: directores } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["director_financiero_qa", "super_admin"]);
      const uniqIds = Array.from(
        new Set((directores ?? []).map((r) => r.user_id as string).filter(Boolean).filter((u) => u !== userId)),
      );
      if (uniqIds.length > 0) {
        const { data: analista } = await supabase
          .from("profiles").select("nombre, email").eq("id", userId).maybeSingle();
        const nombreAnalista =
          (analista?.nombre as string | null) ?? (analista?.email as string | null) ?? "Un analista";
        const meta = [bancoFinal, productoFinal, clienteNombre].filter(Boolean).join(" · ") || "simulación";
        const criticos = result.inconsistencias.filter((i) => i.severidad === "critica").length;
        const severidad: "alta" | "media" = criticos > 0 || result.score.score < 80 ? "alta" : "media";

        await supabaseAdmin.from("notificaciones_usuario").insert(
          uniqIds.map((uid) => ({
            user_id: uid,
            tipo: "qa_solicitada",
            severidad,
            titulo: codigo ? `Simulación escalada · ${codigo}` : "Simulación escalada para auditar",
            mensaje: `${nombreAnalista} escaló ${meta} · score ${Math.round(result.score.score)} · ${result.inconsistencias.length} hallazgo(s)${criticos > 0 ? ` (${criticos} crítico(s))` : ""}.`,
            link: `/qa-ai/${auditoriaId}`,
            metadata: {
              auditoria_id: auditoriaId,
              codigo,
              analista_id: userId,
              origen: "simulador_escalado",
              score: result.score.score,
              dictamen: result.score.dictamen,
            } as never,
          })),
        );
      }
    } catch (e) {
      console.warn("[escalarConsultaTecnica] no se pudo notificar al director", e);
    }

    return {
      id: auditoriaId,
      auditoriaId,
      codigo,
      score: result.score.score,
      dictamen: result.score.dictamen,
      criticos: result.inconsistencias.filter((i) => i.severidad === "critica").length,
      totalHallazgos: result.inconsistencias.length,
      createdAt: new Date().toISOString(),
      restoreToken: null as string | null,
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

// ─────────────────────────────────────────────────────────────
// 4. Bandeja del Director Financiero: listar y resolver
// ─────────────────────────────────────────────────────────────

type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export type ConsultaTecnicaRow = {
  id: string;
  estado: string;
  analistaId: string;
  analistaNombre: string | null;
  analistaEmail: string | null;
  banco: string | null;
  producto: string | null;
  tipoCredito: string | null;
  moneda: string | null;
  notasAnalista: string | null;
  hallazgos: Json;
  snapshot: Json;
  dictamenDirector: string | null;
  ajustesSugeridos: Json;
  directorId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const listConsultasSchema = z.object({
  estado: z.enum(["pendiente", "aprobada", "rechazada", "devuelta", "todas"]).default("pendiente"),
});

export const listConsultasTecnicas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listConsultasSchema.parse(input))
  .handler(async ({ data, context }): Promise<ConsultaTecnicaRow[]> => {
    const { supabase } = context;
    let query = supabase
      .from("consultas_tecnicas")
      .select(
        "id, estado, analista_id, banco, producto, tipo_credito, moneda, notas_analista, hallazgos_nuvia, snapshot_simulacion, dictamen_director, ajustes_sugeridos, director_id, resolved_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.estado !== "todas") query = query.eq("estado", data.estado);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const analistaIds = Array.from(
      new Set((rows ?? []).map((r) => r.analista_id as string).filter(Boolean)),
    );
    const profileMap = new Map<string, { nombre: string | null; email: string | null }>();
    if (analistaIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, email")
        .in("id", analistaIds);
      for (const p of profs ?? []) {
        profileMap.set(p.id as string, {
          nombre: (p.nombre as string | null) ?? null,
          email: (p.email as string | null) ?? null,
        });
      }
    }

    return (rows ?? []).map((r) => {
      const p = profileMap.get(r.analista_id as string);
      return {
        id: r.id as string,
        estado: r.estado as string,
        analistaId: r.analista_id as string,
        analistaNombre: p?.nombre ?? null,
        analistaEmail: p?.email ?? null,
        banco: (r.banco as string | null) ?? null,
        producto: (r.producto as string | null) ?? null,
        tipoCredito: (r.tipo_credito as string | null) ?? null,
        moneda: (r.moneda as string | null) ?? null,
        notasAnalista: (r.notas_analista as string | null) ?? null,
        hallazgos: r.hallazgos_nuvia,
        snapshot: r.snapshot_simulacion,
        dictamenDirector: (r.dictamen_director as string | null) ?? null,
        ajustesSugeridos: r.ajustes_sugeridos,
        directorId: (r.director_id as string | null) ?? null,
        resolvedAt: (r.resolved_at as string | null) ?? null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
      };
    });
  });

const resolverSchema = z.object({
  id: z.string().uuid(),
  estado: z.enum(["aprobada", "rechazada", "devuelta"]),
  dictamen: z.string().min(3).max(4000),
  ajustesSugeridos: z.record(z.unknown()).optional(),
});

export const resolverConsultaTecnica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => resolverSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Recuperamos analista_id + metadatos para notificar
    const { data: prev, error: readErr } = await supabase
      .from("consultas_tecnicas")
      .select("analista_id, banco, producto")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    const { error } = await supabase
      .from("consultas_tecnicas")
      .update({
        estado: data.estado,
        dictamen_director: data.dictamen,
        ajustes_sugeridos: (data.ajustesSugeridos ?? null) as never,
        director_id: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // 2. Notificamos al analista (best-effort)
    if (prev?.analista_id) {
      const meta = [prev.banco, prev.producto].filter(Boolean).join(" · ") || "Simulación";
      const titulo =
        data.estado === "aprobada"
          ? "Dirección aprobó tu consulta técnica"
          : data.estado === "devuelta"
            ? "Dirección devolvió tu consulta técnica para revisión"
            : "Dirección rechazó tu consulta técnica";
      try {
        await supabase.from("notificaciones_usuario").insert({
          user_id: prev.analista_id as string,
          tipo: "consulta_tecnica",
          severidad: data.estado === "aprobada" ? "info" : "warning",
          titulo,
          mensaje: `${meta} — ${data.dictamen.slice(0, 220)}`,
          link: "/mis-consultas-tecnicas",
          metadata: { consultaId: data.id, estado: data.estado } as never,
        });
      } catch (e) {
        console.warn("[consultas_tecnicas] no se pudo notificar al analista", e);
      }
    }

    return { ok: true as const };
  });

// ─────────────────────────────────────────────────────────────
// 5. Bandeja del analista: sus propias consultas técnicas
// ─────────────────────────────────────────────────────────────

export const listMisConsultasTecnicas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConsultaTecnicaRow[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("consultas_tecnicas")
      .select(
        "id, estado, analista_id, banco, producto, tipo_credito, moneda, notas_analista, hallazgos_nuvia, snapshot_simulacion, dictamen_director, ajustes_sugeridos, director_id, resolved_at, created_at, updated_at",
      )
      .eq("analista_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      estado: r.estado as string,
      analistaId: r.analista_id as string,
      analistaNombre: null,
      analistaEmail: null,
      banco: (r.banco as string | null) ?? null,
      producto: (r.producto as string | null) ?? null,
      tipoCredito: (r.tipo_credito as string | null) ?? null,
      moneda: (r.moneda as string | null) ?? null,
      notasAnalista: (r.notas_analista as string | null) ?? null,
      hallazgos: r.hallazgos_nuvia,
      snapshot: r.snapshot_simulacion,
      dictamenDirector: (r.dictamen_director as string | null) ?? null,
      ajustesSugeridos: r.ajustes_sugeridos,
      directorId: (r.director_id as string | null) ?? null,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  });

