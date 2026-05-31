// Pipeline Maestro NUVEX — definición de las 14 etapas operativas y mapeo
// desde caso_estado (BD) hacia la etapa visible. NO modifica enums ni BD:
// es 100% cliente, derivado de los datos que ya existen.
//
// Si en el futuro se agrega columna etapa_pipeline en BD, computeEtapaActual
// puede usarla como override; mientras tanto deriva del caso_estado actual.

export type EtapaPipelineId =
  | "lead"
  | "extracto"
  | "proyeccion"
  | "presentacion"
  | "cierre"
  | "contratacion"
  | "radicacion"
  | "banco"
  | "informe"
  | "cuenta"
  | "pago"
  | "comision"
  | "paz_salvo"
  | "finalizado";

export interface EtapaPipeline {
  id: EtapaPipelineId;
  numero: number;
  titulo: string;
  descripcion: string;
  /** Roles responsables operativos de mover esta etapa. */
  responsables: ReadonlyArray<string>;
}

export const ETAPAS_PIPELINE: ReadonlyArray<EtapaPipeline> = [
  { id: "lead",         numero: 1,  titulo: "Lead",                descripcion: "Ingreso y validación inicial del lead.",                   responsables: ["asesor"] },
  { id: "extracto",     numero: 2,  titulo: "Extracto",            descripcion: "Recepción y lectura del extracto bancario.",               responsables: ["asesor", "licenciado"] },
  { id: "proyeccion",   numero: 3,  titulo: "Proyección + QA",     descripcion: "Proyección financiera; no avanza sin QA aprobado.",        responsables: ["licenciado", "director_financiero_qa"] },
  { id: "presentacion", numero: 4,  titulo: "Presentación",        descripcion: "Presentación de propuesta al cliente.",                    responsables: ["asesor"] },
  { id: "cierre",       numero: 5,  titulo: "Cierre",              descripcion: "Negociación y aceptación de propuesta.",                   responsables: ["asesor"] },
  { id: "contratacion", numero: 6,  titulo: "Contratación",        descripcion: "Generación y firma de contrato y poder.",                  responsables: ["juridica", "director_juridico", "operaciones"] },
  { id: "radicacion",   numero: 7,  titulo: "Radicación",          descripcion: "Radicación del expediente ante el banco.",                 responsables: ["operaciones"] },
  { id: "banco",        numero: 8,  titulo: "Banco → Jurídica → Dir. Fra. → AFC", descripcion: "Estudio en banco y traslado interno (sin contacto directo con cliente).", responsables: ["operaciones", "juridica", "director_financiero_qa", "licenciado"] },
  { id: "informe",      numero: 9,  titulo: "Informe",             descripcion: "Resultado final del banco e informe al cliente.",          responsables: ["licenciado"] },
  { id: "cuenta",       numero: 10, titulo: "Cuenta de cobro",     descripcion: "Generación y envío de cuenta de cobro.",                   responsables: ["licenciado", "contabilidad"] },
  { id: "pago",         numero: 11, titulo: "Pago de honorarios",  descripcion: "Confirmación del pago de honorarios.",                     responsables: ["contabilidad", "cartera"] },
  { id: "comision",     numero: 12, titulo: "Comisión",            descripcion: "Liquidación y pago de comisión al AFC.",                   responsables: ["contabilidad"] },
  { id: "paz_salvo",    numero: 13, titulo: "Paz y salvo",         descripcion: "Emisión del paz y salvo al cliente.",                      responsables: ["juridica", "operaciones"] },
  { id: "finalizado",   numero: 14, titulo: "Caso finalizado",     descripcion: "Cierre operativo y métricas finales.",                     responsables: ["gerencia"] },
];

/**
 * Mapeo caso_estado (enum BD) → etapa del pipeline.
 * Cualquier estado no listado cae en "lead" como fallback seguro.
 */
const CASO_ESTADO_A_ETAPA: Record<string, EtapaPipelineId> = {
  lead_creado: "lead",
  prospecto: "lead",

  extracto_recibido: "extracto",

  simulado: "proyeccion",
  simulacion_realizada: "proyeccion",
  proyeccion_pendiente_qa: "proyeccion",
  proyeccion_devuelta_qa: "proyeccion",
  proyeccion_aprobada_qa: "proyeccion",

  propuesta_enviada: "presentacion",
  propuesta_presentada: "presentacion",

  negociacion: "cierre",
  acepto_propuesta: "cierre",

  pendiente_contratacion: "contratacion",
  enviado_contratacion: "contratacion",
  contrato_generado: "contratacion",
  contrato_enviado: "contratacion",
  contrato_firmado: "contratacion",
  poder_generado: "contratacion",
  poder_firmado: "contratacion",
  documentacion_completa: "contratacion",

  radicacion_preparada: "radicacion",
  radicacion_pendiente: "radicacion",
  radicado_banco: "radicacion",

  en_estudio_banco: "banco",
  aprobado: "banco",
  aprobado_banco: "banco",
  documentos_banco_firmados: "banco",
  docs_complementarios_banco: "banco",
  devuelto_banco: "banco",
  negado_banco: "banco",

  condiciones_aplicadas: "informe",
  aplicado_banco: "informe",
  resultado_final_generado: "informe",

  cuenta_cobro_generada: "cuenta",
  cuenta_cobro_enviada: "cuenta",

  honorarios_pendientes: "pago",
  honorarios_pagados: "pago",

  // "comision" (12) se deriva del estado de la tabla comisiones, no del caso_estado.
  // Se mantiene aquí para fallback si en el futuro entra un caso_estado dedicado.

  paz_y_salvo_generado: "paz_salvo",

  proceso_cerrado: "finalizado",
  caso_finalizado: "finalizado",

  prejuridico: "banco",
};

/**
 * Datos mínimos del expediente para computar la etapa actual.
 * Acepta `unknown` extra sin romper.
 */
export interface PipelineInput {
  estado_caso?: string | null;
  validacion_estado?: string | null;
  /** Override opcional desde futura columna etapa_pipeline. */
  etapa_pipeline?: EtapaPipelineId | null;
}

export function computeEtapaActual(exp: PipelineInput | null | undefined): EtapaPipelineId {
  if (!exp) return "lead";
  if (exp.etapa_pipeline) return exp.etapa_pipeline;
  const e = (exp.estado_caso || "").toLowerCase();
  return CASO_ESTADO_A_ETAPA[e] ?? "lead";
}

export function getEtapaByIndex(idx: number): EtapaPipeline {
  return ETAPAS_PIPELINE[Math.max(0, Math.min(ETAPAS_PIPELINE.length - 1, idx))];
}

export function getEtapaById(id: EtapaPipelineId): EtapaPipeline {
  return ETAPAS_PIPELINE.find((x) => x.id === id) ?? ETAPAS_PIPELINE[0];
}

export function indexOfEtapa(id: EtapaPipelineId): number {
  const i = ETAPAS_PIPELINE.findIndex((x) => x.id === id);
  return i < 0 ? 0 : i;
}

/** Todos los valores de estado_caso (BD) que caen en una etapa dada. */
export function estadosParaEtapa(etapaId: EtapaPipelineId): string[] {
  return Object.entries(CASO_ESTADO_A_ETAPA)
    .filter(([, v]) => v === etapaId)
    .map(([k]) => k);
}
