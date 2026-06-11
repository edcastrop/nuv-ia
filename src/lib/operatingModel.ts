/**
 * NUVIA Operating Model v2 — Fase 7.6.1
 *
 * Fuente única de verdad para las 19 etapas oficiales del ciclo de vida
 * del caso. Datos derivados del catálogo `etapa_definicion` en BD.
 *
 * Este módulo es **client-safe**: solo constantes, tipos y helpers puros.
 * Lecturas a BD viven en `operatingModel.functions.ts`.
 *
 * Importante: NO reemplaza `pipelineEtapas.ts` (Pipeline Maestro 1-14).
 * Coexisten — `pipelineEtapas` sigue operando para vistas heredadas,
 * `operatingModel` es el nuevo modelo canónico v2.
 */

export type EtapaId =
  | "lead"
  | "diagnostico"
  | "recoleccion_documental"
  | "analisis_financiero"
  | "auditoria_financiera"
  | "presentacion"
  | "contratacion"
  | "firma_poderes"
  | "validacion_operativa"
  | "radicacion"
  | "seguimiento"
  | "respuesta_banco"
  | "implementacion"
  | "informe_final"
  | "cuenta_cobro"
  | "pago_honorarios"
  | "paz_salvo"
  | "testimonio"
  | "referidos";

export type Ciclo = "comercial" | "cierre" | "operativo" | "financiero" | "relacion";

export interface EtapaDefinicion {
  id: EtapaId;
  numero: number;
  nombre: string;
  responsableDefault: string;
  slaDiasHabiles: number;
  ciclo: Ciclo;
  ordenVisual: number;
}

/**
 * Las 19 etapas oficiales en orden cronológico.
 * Espejo del catálogo `etapa_definicion`; cualquier cambio debe ir
 * acompañado de migración + seed.
 */
export const ETAPAS_OPERATING_MODEL: readonly EtapaDefinicion[] = [
  { id: "lead", numero: 1, nombre: "Lead", responsableDefault: "asesor_comercial", slaDiasHabiles: 2, ciclo: "comercial", ordenVisual: 1 },
  { id: "diagnostico", numero: 2, nombre: "Diagnóstico", responsableDefault: "asesor_comercial", slaDiasHabiles: 3, ciclo: "comercial", ordenVisual: 2 },
  { id: "recoleccion_documental", numero: 3, nombre: "Recolección Documental", responsableDefault: "asesor_comercial", slaDiasHabiles: 5, ciclo: "comercial", ordenVisual: 3 },
  { id: "analisis_financiero", numero: 4, nombre: "Análisis Financiero", responsableDefault: "analista_financiero", slaDiasHabiles: 3, ciclo: "comercial", ordenVisual: 4 },
  { id: "auditoria_financiera", numero: 5, nombre: "Auditoría Financiera", responsableDefault: "auditor_financiero", slaDiasHabiles: 2, ciclo: "comercial", ordenVisual: 5 },
  { id: "presentacion", numero: 6, nombre: "Presentación Cliente", responsableDefault: "asesor_comercial", slaDiasHabiles: 5, ciclo: "comercial", ordenVisual: 6 },
  { id: "contratacion", numero: 7, nombre: "Firma Contrato", responsableDefault: "juridica", slaDiasHabiles: 3, ciclo: "cierre", ordenVisual: 7 },
  { id: "firma_poderes", numero: 8, nombre: "Firma Poderes", responsableDefault: "juridica", slaDiasHabiles: 3, ciclo: "cierre", ordenVisual: 8 },
  { id: "validacion_operativa", numero: 9, nombre: "Validación Operativa", responsableDefault: "operaciones", slaDiasHabiles: 1, ciclo: "operativo", ordenVisual: 9 },
  { id: "radicacion", numero: 10, nombre: "Radicación Banco", responsableDefault: "apoderado", slaDiasHabiles: 1, ciclo: "operativo", ordenVisual: 10 },
  { id: "seguimiento", numero: 11, nombre: "Seguimiento Banco", responsableDefault: "apoderado", slaDiasHabiles: 30, ciclo: "operativo", ordenVisual: 11 },
  { id: "respuesta_banco", numero: 12, nombre: "Respuesta Banco", responsableDefault: "apoderado", slaDiasHabiles: 2, ciclo: "operativo", ordenVisual: 12 },
  { id: "implementacion", numero: 13, nombre: "Implementación Cliente", responsableDefault: "asesor_comercial", slaDiasHabiles: 7, ciclo: "operativo", ordenVisual: 13 },
  { id: "informe_final", numero: 14, nombre: "Informe Final", responsableDefault: "analista_financiero", slaDiasHabiles: 3, ciclo: "financiero", ordenVisual: 14 },
  { id: "cuenta_cobro", numero: 15, nombre: "Cuenta de Cobro", responsableDefault: "cartera", slaDiasHabiles: 2, ciclo: "financiero", ordenVisual: 15 },
  { id: "pago_honorarios", numero: 16, nombre: "Pago Honorarios", responsableDefault: "cartera", slaDiasHabiles: 15, ciclo: "financiero", ordenVisual: 16 },
  { id: "paz_salvo", numero: 17, nombre: "Paz y Salvo", responsableDefault: "juridica", slaDiasHabiles: 3, ciclo: "financiero", ordenVisual: 17 },
  { id: "testimonio", numero: 18, nombre: "Testimonio", responsableDefault: "asesor_comercial", slaDiasHabiles: 15, ciclo: "relacion", ordenVisual: 18 },
  { id: "referidos", numero: 19, nombre: "Referidos", responsableDefault: "asesor_comercial", slaDiasHabiles: 30, ciclo: "relacion", ordenVisual: 19 },
] as const;

export function etapaById(id: EtapaId): EtapaDefinicion | undefined {
  return ETAPAS_OPERATING_MODEL.find((e) => e.id === id);
}

export function etapaByNumero(n: number): EtapaDefinicion | undefined {
  return ETAPAS_OPERATING_MODEL.find((e) => e.numero === n);
}

/**
 * Reglas de retorno cuando un banco emite `requerimiento_adicional` en E12.
 * Mapea el tipo de requerimiento a la etapa destino donde el caso debe
 * regresar para ser resuelto, manteniendo trazabilidad completa.
 */
export const REQUERIMIENTO_RETORNO: Record<string, EtapaId> = {
  documento_cliente: "recoleccion_documental",
  documento_corregido: "recoleccion_documental",
  poder_corregido: "firma_poderes",
  formato_banco: "validacion_operativa",
  paquete_incompleto: "validacion_operativa",
  aclaracion: "seguimiento",
};

/**
 * Eventos canónicos del caso (event bus). Cada string es la clave usada
 * en `caso_eventos.tipo_evento`.
 */
export const EVENTOS_CASO = {
  estadoCambiado: "caso.estado_cambiado",
  slaVencido: "caso.sla_vencido",
  estancado7d: "caso.estancado_7d",
  estancado15d: "caso.estancado_15d",
  estancado30d: "caso.estancado_30d",
  documentoFaltante: "caso.documento_faltante",
  validacionOperativaAprobada: "caso.validacion_operativa_aprobada",
  validacionOperativaRechazada: "caso.validacion_operativa_rechazada",
  radicado: "caso.radicado",
  respuestaBancoRecibida: "caso.respuesta_banco_recibida",
  requerimientoBanco: "caso.requerimiento_banco",
  cuentaCobroGenerada: "caso.cuenta_cobro_generada",
  pagoReportado: "caso.pago_reportado",
  pagoConciliado: "caso.pago_conciliado",
  pazSalvoEmitido: "caso.paz_salvo_emitido",
  finalizado: "caso.finalizado",
  testimonioCapturado: "cliente.testimonio_capturado",
  referidoGenerado: "cliente.referido_generado",
  promotorActivado: "cliente.promotor_activado",
} as const;

export type EventoCaso = (typeof EVENTOS_CASO)[keyof typeof EVENTOS_CASO];
