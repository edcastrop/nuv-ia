// Pipeline Maestro NUVEX — 15 etapas operativas.
// El Simulador termina en etapa 5 (presentación / generación de propuesta).
// A partir de la etapa 6 (Contratación) en adelante, todo vive en el Expediente.

export type EtapaPipelineId =
  | "lead"
  | "extracto"
  | "proyeccion"
  | "presentacion"
  | "cierre"
  | "contratacion"
  | "radicacion"
  | "banco"
  | "resultado_banco"
  | "aceptacion_cliente"
  | "informe"
  | "cuenta"
  | "pago"
  | "comision" // @deprecated — se mantiene por compatibilidad; ahora rola en "pago".
  | "paz_salvo"
  | "finalizado";

export interface EtapaPipeline {
  id: EtapaPipelineId;
  numero: number;
  titulo: string;
  descripcion: string;
  responsables: ReadonlyArray<string>;
}

export const ETAPAS_PIPELINE: ReadonlyArray<EtapaPipeline> = [
  { id: "lead",               numero: 1,  titulo: "Lead",                descripcion: "Ingreso y validación inicial del lead.",                              responsables: ["asesor"] },
  { id: "extracto",           numero: 2,  titulo: "Extracto",            descripcion: "Recepción y lectura del extracto bancario.",                          responsables: ["asesor", "licenciado"] },
  { id: "proyeccion",         numero: 3,  titulo: "Proyección + QA",     descripcion: "Proyección financiera; no avanza sin QA aprobado.",                   responsables: ["licenciado", "director_financiero_qa"] },
  { id: "presentacion",       numero: 4,  titulo: "Presentación",        descripcion: "Presentación de propuesta al cliente.",                               responsables: ["asesor"] },
  { id: "cierre",             numero: 5,  titulo: "Cierre",              descripcion: "Negociación y aceptación de propuesta.",                              responsables: ["asesor"] },
  { id: "contratacion",       numero: 6,  titulo: "Contratación",        descripcion: "Generación y firma de contrato y poder.",                             responsables: ["juridica", "director_juridico", "operaciones"] },
  { id: "radicacion",         numero: 7,  titulo: "Radicación",          descripcion: "Radicación del expediente ante el banco.",                            responsables: ["operaciones"] },
  { id: "banco",              numero: 8,  titulo: "Estudio Banco",       descripcion: "Estudio en banco y traslado interno (sin contacto directo con cliente).", responsables: ["operaciones", "juridica", "director_financiero_qa"] },
  { id: "resultado_banco",    numero: 9,  titulo: "Resultado Bancario",  descripcion: "Registro de respuesta del banco, comparativo NUVEX vs Banco y reajuste de honorarios.", responsables: ["director_financiero_qa", "apoderado"] },
  { id: "aceptacion_cliente", numero: 10, titulo: "Aceptación Cliente",  descripcion: "Aceptación expresa del cliente (WhatsApp, correo o carta).",          responsables: ["asesor", "licenciado"] },
  { id: "informe",            numero: 11, titulo: "Informe Final",       descripcion: "Generación y envío del informe final al cliente.",                    responsables: ["director_financiero_qa", "apoderado"] },
  { id: "cuenta",             numero: 12, titulo: "Facturación",         descripcion: "Generación y envío de cuenta de cobro al cliente.",                   responsables: ["contabilidad"] },
  { id: "pago",               numero: 13, titulo: "Pago de honorarios", descripcion: "Confirmación del pago de honorarios y liquidación de comisión AFC.",  responsables: ["contabilidad", "cartera"] },
  { id: "paz_salvo",          numero: 14, titulo: "Paz y Salvo",         descripcion: "Emisión del paz y salvo al cliente.",                                  responsables: ["contabilidad", "juridica"] },
  { id: "finalizado",         numero: 15, titulo: "Caso Cerrado",        descripcion: "Cierre operativo con indicadores finales del caso.",                   responsables: ["gerencia"] },
];

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
  documentos_banco_firmados: "banco",
  docs_complementarios_banco: "banco",
  devuelto_banco: "banco",
  negado_banco: "banco",
  prejuridico: "banco",

  aprobado: "resultado_banco",
  aprobado_banco: "resultado_banco",
  condiciones_aplicadas: "resultado_banco",
  aplicado_banco: "resultado_banco",
  resultado_banco_registrado: "resultado_banco",

  aceptacion_cliente_pendiente: "aceptacion_cliente",
  aceptacion_cliente_recibida: "aceptacion_cliente",

  resultado_final_generado: "informe",
  informe_enviado: "informe",

  cuenta_cobro_generada: "cuenta",
  cuenta_cobro_enviada: "cuenta",

  honorarios_pendientes: "pago",
  honorarios_pagados: "pago",
  comision_liquidada: "pago",
  comision_pagada: "pago",

  paz_y_salvo_generado: "paz_salvo",

  proceso_cerrado: "finalizado",
  caso_finalizado: "finalizado",
  caso_cerrado: "finalizado",
};

export interface PipelineInput {
  estado_caso?: string | null;
  validacion_estado?: string | null;
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

export function estadosParaEtapa(etapaId: EtapaPipelineId): string[] {
  return Object.entries(CASO_ESTADO_A_ETAPA)
    .filter(([, v]) => v === etapaId)
    .map(([k]) => k);
}
