// Vista "2 etapas" para leads del Pipeline NUVEX.
// - "en_revision":    E1 · entrada del pipeline. Todo lead nuevo arranca aquí:
//                     sin proyección validada, con auditoría pendiente, o con
//                     alertas (QA<70, honorarios bajo piso, descuento alto,
//                     ahorro bajo, plazo excesivo, banco sin perfil,
//                     auditoría en curso o rechazada).
// - "con_proyeccion": E2 · lead ya limpio: tiene proyección, auditoría QA
//                     aprobada y ningún motivo de revisión abierto. Listo para
//                     avanzar a contratación.
//
// Pure helpers: NO tocan DB, NO mutan tipos existentes. Aditivos sobre Expediente.

import type { Expediente } from "@/lib/expedientes";
import { computeEtapaActual, type EtapaPipelineId } from "@/lib/pipelineEtapas";

export const PISO_HONORARIOS = 1_800_000;
export const DESCUENTO_ALTO = 25;     // %
export const AHORRO_MINIMO_PCT = 5;   // %
export const PLAZO_MAX = 360;         // meses

export type FaseLead = "con_proyeccion" | "en_revision";

const ETAPAS_LEAD: ReadonlyArray<EtapaPipelineId> = ["lead", "extracto", "proyeccion", "presentacion", "cierre"];

export type QALite = {
  id: string;
  score: number;
  dictamen: string | null;
  auditor_aprobado_at?: string | null;
} | null | undefined;


function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const x = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
}

function leerPropuesta(exp: Expediente): Record<string, unknown> {
  const p = (exp as unknown as { propuesta_data?: unknown }).propuesta_data;
  return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
}

export interface ProgresoLead {
  extracto: boolean;
  simulacion: boolean;
  qa: boolean;
  qaScore: number | null;
}

export function progresoLead(exp: Expediente, qa: QALite): ProgresoLead {
  const propuesta = leerPropuesta(exp);
  const hasPropuesta = n(propuesta.nuevaCuota) > 0 || n(propuesta.nuevoPlazo) > 0 || n(propuesta.ahorroTotal) > 0;
  const hasExtracto = !!exp.banco || !!exp.numero_credito || hasPropuesta;
  return {
    extracto: hasExtracto,
    simulacion: hasPropuesta,
    qa: !!qa,
    qaScore: qa?.score ?? null,
  };
}

export interface MotivoRevision {
  code: "qa_bajo" | "honorarios_piso" | "descuento_alto" | "ahorro_bajo" | "plazo_excesivo" | "banco_sin_perfil";
  label: string;
  detalle: string;
}

export function motivosRevision(exp: Expediente, qa: QALite): MotivoRevision[] {
  const motivos: MotivoRevision[] = [];
  const propuesta = leerPropuesta(exp);

  if (qa && qa.score < 70) {
    motivos.push({
      code: "qa_bajo",
      label: "QA < 70",
      detalle: `Score QA ${Math.round(qa.score)}/100${qa.dictamen ? ` · ${qa.dictamen}` : ""}`,
    });
  }

  const hon = n(exp.honorarios_final);
  if (hon > 0 && hon < PISO_HONORARIOS) {
    motivos.push({
      code: "honorarios_piso",
      label: "Honorarios bajo piso",
      detalle: `Honorarios $${hon.toLocaleString("es-CO")} < piso $${PISO_HONORARIOS.toLocaleString("es-CO")}`,
    });
  }

  const desc = n(exp.descuento);
  if (desc > DESCUENTO_ALTO) {
    motivos.push({
      code: "descuento_alto",
      label: `Descuento ${desc}%`,
      detalle: `Descuento aplicado ${desc}% supera el umbral del ${DESCUENTO_ALTO}%`,
    });
  }

  const totalProy = n(propuesta.totalProyectado);
  const ahorro = n(propuesta.ahorroTotal);
  if (totalProy > 0 && ahorro > 0) {
    const pct = (ahorro / totalProy) * 100;
    if (pct < AHORRO_MINIMO_PCT) {
      motivos.push({
        code: "ahorro_bajo",
        label: `Ahorro ${pct.toFixed(1)}%`,
        detalle: `Ahorro proyectado ${pct.toFixed(1)}% < mínimo ${AHORRO_MINIMO_PCT}%`,
      });
    }
  }

  const plazo = n(propuesta.nuevoPlazo);
  if (plazo > PLAZO_MAX) {
    motivos.push({
      code: "plazo_excesivo",
      label: `Plazo ${plazo}m`,
      detalle: `Plazo proyectado ${plazo} meses > máximo ${PLAZO_MAX}`,
    });
  }

  // Banco vacío en un caso ya con simulación → perfil bancario faltante
  const hasPropuesta = n(propuesta.nuevaCuota) > 0 || n(propuesta.nuevoPlazo) > 0;
  if (hasPropuesta && (!exp.banco || !exp.banco.trim())) {
    motivos.push({
      code: "banco_sin_perfil",
      label: "Banco faltante",
      detalle: "El caso tiene simulación pero no tiene banco asignado",
    });
  }

  return motivos;
}

/**
 * Devuelve la fase visible (2 etapas) solo para leads en fase comercial.
 * Para cualquier etapa posterior (contratación → finalizado) devuelve null:
 * esos casos no son "leads" y mantienen su etapa operativa.
 */
export function faseLead(exp: Expediente, qa: QALite): FaseLead | null {
  const etapa = computeEtapaActual({
    estado_caso: (exp as unknown as { estado_caso?: string | null }).estado_caso ?? null,
  });
  if (!ETAPAS_LEAD.includes(etapa)) return null;
  return motivosRevision(exp, qa).length > 0 ? "en_revision" : "con_proyeccion";
}

export function esEtapaLead(etapaId: EtapaPipelineId): boolean {
  return ETAPAS_LEAD.includes(etapaId);
}
