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

/**
 * Inserta el extracto leído y dispara la auto-auditoría QA.
 * No lanza: cualquier error se reporta vía toast y se loguea.
 */
export async function triggerSimuladorAutoQA(opts: {
  expedienteId: string;
  raw: ExtractoRawSnapshot;
}): Promise<void> {
  const { expedienteId, raw } = opts;
  if (!expedienteId) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");
    const datos = normalizeQaDatos(raw);
    const { data: inserted, error: insErr } = await supabase
      .from("extractos_lecturas")
      .insert({
        expediente_id: expedienteId,
        asesor_id: user.id,
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
    const label = dictamenMsg[r.categoria as string] ?? "QA ejecutada";
    const score = typeof r.score === "number" ? ` · ${r.score.toFixed(0)}/100` : "";
    if (r.categoria === "rechazado") {
      toast.error(`${label}${score} — Revisa el expediente.`, { duration: 6000 });
    } else if (r.categoria === "revisar" || r.categoria === "aprobado") {
      toast.warning(`${label}${score}`, { duration: 5000 });
    } else {
      toast.success(`${label}${score}`, { duration: 4000 });
    }
  } catch (e) {
    console.error("[simuladorAutoQA] fallo:", e);
    toast.error(
      `No se pudo ejecutar la auditoría QA automática: ${
        e instanceof Error ? e.message : "error desconocido"
      }`,
      { duration: 6000 },
    );
  }
}
