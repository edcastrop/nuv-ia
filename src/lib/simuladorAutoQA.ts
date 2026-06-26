// Disparador condicional de NUVIA Financial QA AI desde los simuladores.
// SOLO se ejecuta cuando el simulador fue abierto desde un Expediente Maestro
// (es decir, `expedienteId` está presente). En modo standalone no hace nada.
//
// No reemplaza ExtractoReader ni la lógica de simulación: únicamente inserta
// la lectura en `extractos_lecturas` y llama a `auditarLecturaAutomatica` para
// que el badge QA y la semaforización aparezcan al volver al expediente.

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { auditarLecturaAutomatica } from "@/lib/qaAI.functions";
import type { AutoQAResult, AutoQAHallazgo } from "@/components/nuvex/AutoQAPanel";

export type ExtractoRawSnapshot = {
  banco?: string | null;
  producto?: string | null;
  moneda?: string | null;
  datos?: Record<string, unknown> | null;
  archivoPath?: string | null;
  archivoNombre?: string | null;
};

const dictamenMsg: Record<string, string> = {
  excelente: "QA CERTIFIED",
  aprobado: "QA OBSERVADO",
  revisar: "QA REVISIÓN",
  rechazado: "QA FAILED",
};

function normalizeQaDatos(raw: ExtractoRawSnapshot): Record<string, unknown> {
  const d = { ...(raw.datos ?? {}) } as Record<string, unknown>;
  const first = (...keys: string[]) => keys.map((k) => d[k]).find((v) => v !== undefined && v !== null && String(v) !== "");
  const cuota = first("cuotaActual", "cuotaBaseSimulacion", "cuotaMensual", "cuotaPagadaCliente");
  const tasa = first("tasaEA", "tea", "teaCobrada", "tasaCobrada", "tasa");
  const producto = first("producto") ?? raw.producto;
  const banco = first("banco") ?? raw.banco;
  const moneda = first("moneda") ?? raw.moneda;

  return {
    ...d,
    banco,
    producto,
    moneda,
    cuotaActual: first("cuotaActual") ?? cuota,
    tasaEA: first("tasaEA") ?? tasa,
    saldoCapital: first("saldoCapital", "saldoPesos"),
    seguros: first("seguros", "segurosMensuales"),
    cuotasPendientes: first("cuotasPendientes"),
    valorDesembolsado: first("valorDesembolsado"),
    valorUVR: first("valorUVR"),
    saldoUVR: first("saldoUVR"),
    tasaCobertura: first("tasaCobertura"),
  };
}

const SEV_ORDER: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 };

/**
 * Inserta el extracto leído y dispara la auto-auditoría QA.
 * Devuelve el resultado (o null si falló) e invoca callbacks de ciclo de vida
 * para que el simulador renderice el panel embebido y un toast accionable.
 */
export async function triggerSimuladorAutoQA(opts: {
  expedienteId: string;
  raw: ExtractoRawSnapshot;
  onStart?: () => void;
  onResult?: (r: AutoQAResult) => void;
  onError?: (err: unknown) => void;
}): Promise<AutoQAResult | null> {
  const { expedienteId, raw, onStart, onResult, onError } = opts;
  if (!expedienteId) return null;
  try {
    onStart?.();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    const datos = normalizeQaDatos(raw);
    const { data: exp } = await supabase
      .from("expedientes")
      .select("asesor_id")
      .eq("id", expedienteId)
      .maybeSingle();
    const analistaId = (exp as { asesor_id?: string | null } | null)?.asesor_id ?? user.id;
    const { data: inserted, error: insErr } = await supabase
      .from("extractos_lecturas")
      .insert({
        expediente_id: expedienteId,
        asesor_id: analistaId,
        aprobado_por: user.id,
        banco: raw.banco ?? (typeof datos.banco === "string" ? datos.banco : undefined),
        producto: raw.producto ?? (typeof datos.producto === "string" ? datos.producto : undefined),
        moneda: raw.moneda ?? (typeof datos.moneda === "string" ? datos.moneda : undefined),
        archivo_path: raw.archivoPath ?? undefined,
        archivo_nombre: raw.archivoNombre ?? undefined,
        datos: datos as never,
        estado: "aprobado",
        motor_version: "simulador-v1",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    if (!inserted?.id) throw new Error("No se pudo persistir el extracto.");

    const r = await auditarLecturaAutomatica({ data: { extractoLecturaId: inserted.id } });

    // Top 3 hallazgos ordenados por severidad
    const { data: incs } = await supabase
      .from("qa_inconsistencias")
      .select("mensaje,severidad")
      .eq("auditoria_id", r.auditoriaId);
    const hallazgosTop: AutoQAHallazgo[] = (incs ?? [])
      .map((i) => ({ mensaje: i.mensaje as string, severidad: i.severidad as string }))
      .sort((a, b) => (SEV_ORDER[a.severidad ?? ""] ?? 9) - (SEV_ORDER[b.severidad ?? ""] ?? 9))
      .slice(0, 3);

    const result: AutoQAResult = {
      auditoriaId: r.auditoriaId,
      score: r.score,
      categoria: r.categoria,
      hallazgosCount: r.hallazgos ?? 0,
      criticos: r.criticos ?? 0,
      hallazgosTop,
    };
    onResult?.(result);

    const label = dictamenMsg[r.categoria as string] ?? "QA ejecutada";
    const score = typeof r.score === "number" ? ` · ${r.score.toFixed(0)}/100` : "";
    const action = {
      label: "Ver Dictamen QA",
      onClick: () => {
        if (typeof window !== "undefined") {
          window.location.assign(`/qa-ai/${r.auditoriaId}`);
        }
      },
    };
    if (r.categoria === "rechazado") {
      toast.error(`${label}${score}`, { duration: 8000, action });
    } else if (r.categoria === "revisar" || r.categoria === "aprobado") {
      toast.warning(`${label}${score}`, { duration: 7000, action });
    } else {
      toast.success(`${label}${score}`, { duration: 6000, action });
    }
    return result;
  } catch (e) {
    console.error("[simuladorAutoQA] fallo:", e);
    onError?.(e);
    toast.error(
      `No se pudo ejecutar la auditoría QA automática: ${
        e instanceof Error ? e.message : "error desconocido"
      }`,
      { duration: 6000 },
    );
    return null;
  }
}
