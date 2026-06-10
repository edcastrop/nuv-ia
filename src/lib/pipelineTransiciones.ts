// P7 — Reglas de transición del Pipeline Maestro NUVEX (frontend).
// Valida avances/retrocesos entre etapas a partir del caso_estado actual,
// y expone un wrapper sobre cambiarEstadoCaso que bloquea avances inválidos
// y registra entrada en expediente_historial con accion_origen + observación.

import {
  cambiarEstadoCaso,
  type CasoEstado,
  type AccionOrigen,
} from "@/lib/casoEstados";
import { supabase } from "@/integrations/supabase/client";
import {
  computeEtapaActual,
  indexOfEtapa,
  getEtapaById,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";

export interface TransicionResult {
  ok: boolean;
  /** Motivo legible cuando ok=false. */
  reason?: string;
  etapaAnterior: EtapaPipelineId;
  etapaNueva: EtapaPipelineId;
  /** Diferencia de etapas: >0 avance, <0 retroceso, 0 lateral. */
  delta: number;
}

/**
 * Etapas que NO permiten salto >1 hacia adelante. Esto evita,
 * por ejemplo, pasar de "lead" directo a "contratacion".
 *
 * Los retrocesos siempre se permiten (con auditoría) salvo desde "finalizado".
 */
const MAX_AVANCE_POR_ETAPA: Partial<Record<EtapaPipelineId, number>> = {
  // Lead permite saltar directo a proyección al guardar una simulación.
  lead: 2,
  extracto: 1,
  // Tras aprobación QA el analista puede saltar a contratación
  // (presentación y cierre son etapas opcionales de seguimiento comercial).
  proyeccion: 4,
  presentacion: 2,
  cierre: 1,
  contratacion: 1,
  radicacion: 1,
  banco: 1,
  informe: 1,
  cuenta: 1,
  pago: 1,
  comision: 1,
  paz_salvo: 1,
  finalizado: 0,
};

/**
 * Pre-requisitos blandos por etapa destino. Si la etapa actual es anterior
 * al pre-requisito, se bloquea el avance (mensaje explicativo).
 */
const PRERREQUISITO_DE: Partial<Record<EtapaPipelineId, EtapaPipelineId>> = {
  presentacion: "proyeccion",
  cierre: "proyeccion",
  // Contratación sólo exige tener la proyección lista (QA aprobada).
  contratacion: "proyeccion",
  radicacion: "contratacion",
  banco: "radicacion",
  informe: "banco",
  cuenta: "informe",
  pago: "cuenta",
  comision: "pago",
  paz_salvo: "comision",
  finalizado: "paz_salvo",
};


export function validateTransicion(
  estadoAnterior: CasoEstado | null | undefined,
  estadoNuevo: CasoEstado,
): TransicionResult {
  const etapaAnterior = computeEtapaActual({ estado_caso: estadoAnterior ?? null });
  const etapaNueva = computeEtapaActual({ estado_caso: estadoNuevo });
  const iA = indexOfEtapa(etapaAnterior);
  const iN = indexOfEtapa(etapaNueva);
  const delta = iN - iA;

  // Lateral o retroceso: siempre permitido (queda en auditoría).
  if (delta <= 0) {
    if (etapaAnterior === "finalizado") {
      return {
        ok: false,
        reason: "El caso ya está finalizado. Reabre el expediente antes de cambiar el estado.",
        etapaAnterior,
        etapaNueva,
        delta,
      };
    }
    return { ok: true, etapaAnterior, etapaNueva, delta };
  }

  // Avance: revisar salto máximo permitido desde etapa actual.
  const maxAvance = MAX_AVANCE_POR_ETAPA[etapaAnterior] ?? 1;
  if (delta > maxAvance) {
    const destino = getEtapaById(etapaNueva);
    return {
      ok: false,
      reason: `No puedes saltar de "${getEtapaById(etapaAnterior).titulo}" directo a "${destino.titulo}". Avanza una etapa a la vez.`,
      etapaAnterior,
      etapaNueva,
      delta,
    };
  }

  // Pre-requisito por etapa destino.
  const prereq = PRERREQUISITO_DE[etapaNueva];
  if (prereq && indexOfEtapa(prereq) > iA) {
    return {
      ok: false,
      reason: `La etapa "${getEtapaById(etapaNueva).titulo}" requiere haber pasado por "${getEtapaById(prereq).titulo}" primero.`,
      etapaAnterior,
      etapaNueva,
      delta,
    };
  }

  return { ok: true, etapaAnterior, etapaNueva, delta };
}

export class TransicionInvalidaError extends Error {
  result: TransicionResult;
  constructor(result: TransicionResult) {
    super(result.reason ?? "Transición inválida");
    this.name = "TransicionInvalidaError";
    this.result = result;
  }
}

/**
 * Wrapper validado de cambiarEstadoCaso. Lee el estado actual del expediente,
 * valida la transición y, si pasa, delega en cambiarEstadoCaso (que ya escribe
 * en expediente_historial con accion_origen + observación).
 */
export async function cambiarEstadoValidado(opts: {
  expedienteId: string;
  estadoAnterior: CasoEstado | null | undefined;
  estadoNuevo: CasoEstado;
  accion: AccionOrigen;
  observacion?: string;
  submotivo?: string;
}): Promise<TransicionResult> {
  const r = validateTransicion(opts.estadoAnterior, opts.estadoNuevo);
  if (!r.ok) throw new TransicionInvalidaError(r);
  await cambiarEstadoCaso(
    opts.expedienteId,
    opts.estadoNuevo,
    opts.accion,
    opts.observacion,
    opts.submotivo,
  );
  return r;
}

/**
 * Convenience: como cambiarEstadoCaso pero lee primero el estado actual
 * del expediente y valida la transición contra las reglas del pipeline.
 * Lanza TransicionInvalidaError si el avance no está permitido.
 */
export async function cambiarEstadoConValidacion(
  expedienteId: string,
  nuevoEstado: CasoEstado,
  accion: AccionOrigen,
  observacion?: string,
  submotivo?: string,
): Promise<TransicionResult> {
  const { data, error } = await supabase
    .from("expedientes")
    .select("estado_caso, aceptacion_cliente_at" as never)
    .eq("id", expedienteId)
    .single();
  if (error) throw error;
  const anterior = (data as unknown as { estado_caso?: CasoEstado })?.estado_caso ?? null;
  const aceptacionAt = (data as unknown as { aceptacion_cliente_at?: string | null })?.aceptacion_cliente_at ?? null;
  const etapaAnterior = computeEtapaActual({ estado_caso: anterior ?? null });
  const etapaNueva = computeEtapaActual({ estado_caso: nuevoEstado });

  if (etapaAnterior === "resultado_banco" && etapaNueva === "informe") {
    const result: TransicionResult = {
      ok: !!aceptacionAt,
      reason: aceptacionAt ? undefined : "Registra primero la aceptación del cliente antes de completar el informe final.",
      etapaAnterior,
      etapaNueva,
      delta: indexOfEtapa(etapaNueva) - indexOfEtapa(etapaAnterior),
    };
    if (!result.ok) throw new TransicionInvalidaError(result);
    await cambiarEstadoCaso(expedienteId, nuevoEstado, accion, observacion, submotivo);
    return result;
  }

  return cambiarEstadoValidado({
    expedienteId,
    estadoAnterior: anterior,
    estadoNuevo: nuevoEstado,
    accion,
    observacion,
    submotivo,
  });
}
