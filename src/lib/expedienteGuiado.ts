// Expediente Guiado NUVEX — capa visual y de orientación.
// 100% LECTURA. No persiste ni cambia estados.
// Mapea los 41 estados_caso internos a 13 etapas visuales para el expediente,
// calcula "Tu siguiente acción", "Qué falta" y checklist por rol.

import type { Expediente } from "@/lib/expedientes";
import type { AppRole } from "@/hooks/useUserRole";
import type { CasoEstado } from "@/lib/casoEstados";

export type EtapaEstado = "completado" | "en_proceso" | "pendiente" | "bloqueado" | "requiere_accion";

export interface EtapaGuiada {
  id: EtapaGuiadaId;
  numero: number;
  titulo: string;
  descripcion: string;
  responsables: AppRole[];
}

export type EtapaGuiadaId =
  | "lead"
  | "proyeccion"
  | "auditoria_qa"
  | "contratacion"
  | "documentacion_bancaria"
  | "radicacion"
  | "respuesta_banco"
  | "resultado_otrosi"
  | "informe_final"
  | "cuenta_cobro"
  | "pago"
  | "paz_salvo"
  | "caso_cerrado";

export const ETAPAS_GUIADAS: EtapaGuiada[] = [
  { id: "lead", numero: 1, titulo: "Lead", descripcion: "Captura del lead y extracto del cliente.", responsables: ["asesor", "licenciado"] },
  { id: "proyeccion", numero: 2, titulo: "Proyección", descripcion: "Simulación y propuesta financiera.", responsables: ["licenciado"] },
  { id: "auditoria_qa", numero: 3, titulo: "Auditoría QA", descripcion: "Validación de la proyección por Dirección Financiera.", responsables: ["director_financiero_qa"] },
  { id: "contratacion", numero: 4, titulo: "Contratación", descripcion: "Contrato y poder firmados por el cliente.", responsables: ["asesor", "operaciones", "juridica", "director_juridico"] },
  { id: "documentacion_bancaria", numero: 5, titulo: "Documentación Bancaria", descripcion: "Checklist documental completo para radicar.", responsables: ["operaciones", "juridica"] },
  { id: "radicacion", numero: 6, titulo: "Radicación", descripcion: "Solicitud radicada en el banco.", responsables: ["operaciones", "apoderado"] },
  { id: "respuesta_banco", numero: 7, titulo: "Respuesta Banco", descripcion: "Banco evalúa la solicitud.", responsables: ["operaciones", "juridica"] },
  { id: "resultado_otrosi", numero: 8, titulo: "Resultado / Otrosí", descripcion: "Aplicación de condiciones y otrosí si aplica.", responsables: ["director_financiero_qa", "apoderado"] },
  { id: "informe_final", numero: 9, titulo: "Informe Final", descripcion: "Informe final entregado al cliente.", responsables: ["director_financiero_qa", "licenciado"] },
  { id: "cuenta_cobro", numero: 10, titulo: "Cuenta de Cobro", descripcion: "Cuenta de cobro generada y enviada.", responsables: ["contabilidad"] },
  { id: "pago", numero: 11, titulo: "Pago", descripcion: "Honorarios pagados por el cliente.", responsables: ["contabilidad", "cartera"] },
  { id: "paz_salvo", numero: 12, titulo: "Paz y Salvo", descripcion: "Paz y salvo emitido.", responsables: ["contabilidad", "juridica"] },
  { id: "caso_cerrado", numero: 13, titulo: "Caso Cerrado", descripcion: "Caso archivado y comisión liberada.", responsables: ["gerencia"] },
];

// Mapeo estado_caso → etapa visual (orden creciente).
const ESTADO_A_ETAPA: Partial<Record<CasoEstado, EtapaGuiadaId>> = {
  lead_creado: "lead",
  prospecto: "lead",
  extracto_recibido: "lead",
  simulacion_realizada: "proyeccion",
  simulado: "proyeccion",
  proyeccion_pendiente_qa: "auditoria_qa",
  proyeccion_devuelta_qa: "proyeccion",
  proyeccion_aprobada_qa: "contratacion",
  propuesta_presentada: "contratacion",
  propuesta_enviada: "contratacion",
  acepto_propuesta: "contratacion",
  negociacion: "contratacion",
  pendiente_contratacion: "contratacion",
  enviado_contratacion: "contratacion",
  contrato_enviado: "contratacion",
  contrato_generado: "contratacion",
  contrato_firmado: "contratacion",
  poder_generado: "contratacion",
  poder_firmado: "contratacion",
  documentacion_completa: "documentacion_bancaria",
  radicacion_pendiente: "radicacion",
  radicacion_preparada: "radicacion",
  // Una vez radicado, la etapa de Radicación queda completada
  // y la actual pasa a Respuesta Banco (banco evaluando).
  radicado_banco: "respuesta_banco",

  en_estudio_banco: "respuesta_banco",
  docs_complementarios_banco: "respuesta_banco",
  devuelto_banco: "respuesta_banco",
  negado_banco: "respuesta_banco",
  // Aprobación del banco cierra "Respuesta Banco" → pasa a Resultado/Otrosí
  aprobado: "resultado_otrosi",
  aprobado_banco: "resultado_otrosi",
  documentos_banco_firmados: "resultado_otrosi",
  condiciones_aplicadas: "resultado_otrosi",
  // Aplicación del banco cierra Resultado/Otrosí → pasa a Informe Final
  aplicado_banco: "informe_final",
  resultado_final_generado: "cuenta_cobro",
  cuenta_cobro_generada: "cuenta_cobro",
  // Cuenta enviada cierra Cuenta de Cobro → pasa a Pago
  cuenta_cobro_enviada: "pago",
  honorarios_pendientes: "pago",
  // Pago efectuado cierra Pago → pasa a Paz y Salvo
  honorarios_pagados: "paz_salvo",
  // Paz y salvo cierra esa etapa → pasa a Caso Cerrado
  paz_y_salvo_generado: "caso_cerrado",
  caso_finalizado: "caso_cerrado",
  proceso_cerrado: "caso_cerrado",
  prejuridico: "respuesta_banco",
};

export function etapaActualGuiada(exp: Expediente): EtapaGuiadaId {
  const ec = (exp as unknown as { estado_caso?: string }).estado_caso as CasoEstado | undefined;
  if (ec && ESTADO_A_ETAPA[ec]) return ESTADO_A_ETAPA[ec]!;
  // Fallback por estado legacy
  switch (exp.estado) {
    case "SIMULADO": return "proyeccion";
    case "ENVIADO_CONTRATACION":
    case "FIRMADO": return "contratacion";
    case "RADICADO": return "radicacion";
    case "APROBADO":
    case "CONDICIONES_APLICADAS": return "resultado_otrosi";
    case "FACTURADO": return "cuenta_cobro";
    case "PAGADO": return "pago";
    default: return "lead";
  }
}

export function indexEtapaGuiada(id: EtapaGuiadaId): number {
  return ETAPAS_GUIADAS.findIndex((e) => e.id === id);
}

// Mapea cada etapa visual a la pestaña y al ancla del bloque correspondiente
// dentro de la vista de expediente. Lo usa el stepper para "saltar" al sitio
// correcto al hacer clic en una etapa.
export const ETAPA_A_DESTINO: Record<
  EtapaGuiadaId,
  { tab: TabId; scrollToId?: string }
> = {
  lead: { tab: "resumen" },
  proyeccion: { tab: "financiero", scrollToId: "simulador-financiero-qa" },
  auditoria_qa: { tab: "auditoria", scrollToId: "validacion-qa" },
  contratacion: { tab: "documentos", scrollToId: "documentos-juridicos" },
  documentacion_bancaria: { tab: "documentos", scrollToId: "checklist-documental" },
  radicacion: { tab: "tareas", scrollToId: "validacion-radicacion" },
  respuesta_banco: { tab: "financiero", scrollToId: "resultado-bancario" },
  resultado_otrosi: { tab: "financiero", scrollToId: "resultado-bancario" },
  informe_final: { tab: "financiero", scrollToId: "cierre-operativo" },
  cuenta_cobro: { tab: "financiero", scrollToId: "cierre-operativo" },
  pago: { tab: "financiero", scrollToId: "cierre-operativo" },
  paz_salvo: { tab: "financiero", scrollToId: "cierre-operativo" },
  caso_cerrado: { tab: "historial" },
};

export function porcentajeAvance(exp: Expediente): number {
  const idx = indexEtapaGuiada(etapaActualGuiada(exp));
  return Math.round(((idx + 1) / ETAPAS_GUIADAS.length) * 100);
}

const ESTADOS_REQUIERE_ACCION: ReadonlySet<string> = new Set([
  "proyeccion_devuelta_qa",
  "docs_complementarios_banco",
  "devuelto_banco",
  "honorarios_pendientes",
]);

const ESTADOS_BLOQUEADOS: ReadonlySet<string> = new Set([
  "negado_banco",
  "prejuridico",
]);

export function estadoDeEtapa(exp: Expediente, etapa: EtapaGuiadaId): EtapaEstado {
  const actual = etapaActualGuiada(exp);
  const ec = (exp as unknown as { estado_caso?: string }).estado_caso ?? "";
  const idxActual = indexEtapaGuiada(actual);
  const idxThis = indexEtapaGuiada(etapa);
  if (idxThis < idxActual) return "completado";
  if (idxThis > idxActual) return "pendiente";
  // Es la actual
  if (ESTADOS_BLOQUEADOS.has(ec)) return "bloqueado";
  if (ESTADOS_REQUIERE_ACCION.has(ec)) return "requiere_accion";
  return "en_proceso";
}

// ============================================================
// Siguiente acción dinámica por rol + estado del expediente
// ============================================================

export interface SiguienteAccion {
  rol: AppRole | "todos";
  titulo: string;
  descripcion: string;
  botonLabel: string;
  // ID HTML al cual hacer scroll (corresponde a divs en el expediente)
  scrollToId?: string;
  // Pestaña a la que pertenece la acción
  tab?: TabId;
  prioridad: "alta" | "media" | "baja";
}

export type TabId =
  | "resumen"
  | "tareas"
  | "documentos"
  | "comunicaciones"
  | "financiero"
  | "juridico"
  | "auditoria"
  | "historial";

/** Devuelve la acción más relevante para el usuario en función de su rol y estado del expediente. */
export function getSiguienteAccion(exp: Expediente, roles: AppRole[]): SiguienteAccion | null {
  const ec = (exp as unknown as { estado_caso?: string }).estado_caso ?? "";
  const etapa = etapaActualGuiada(exp);
  const has = (r: AppRole) => roles.includes(r);
  const isSuper = has("super_admin") || has("admin");
  const isAnalista = has("licenciado") || has("asesor");
  const isContratacion = has("juridica") || has("director_juridico") || has("operaciones") || has("auxiliar_operativo") || has("apoderado");
  const isFinanciero = has("director_financiero_qa");
  const isContable = has("contabilidad") || has("cartera");
  const canSeeAnalystGuide = isAnalista || isSuper;
  const canSeeContractGuide = isContratacion || isSuper;
  const canSeeFinanceGuide = isFinanciero || isSuper;
  const canSeeAccountingGuide = isContable || isSuper;

  if (ec === "negado_banco" || ec === "prejuridico") {
    return {
      rol: "todos",
      titulo: ec === "prejuridico" ? "Caso en gestión prejurídica" : "Solicitud negada por el banco",
      descripcion:
        ec === "prejuridico"
          ? "El expediente está escalado a gestión prejurídica. Revisa historial y comunicaciones antes de moverlo."
          : "El banco negó la solicitud. Revisa la respuesta registrada y define el cierre o una nueva estrategia con el equipo responsable.",
      botonLabel: "Ver respuesta",
      scrollToId: "resultado-bancario",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  if (etapa === "caso_cerrado" || ec === "proceso_cerrado" || ec === "caso_finalizado") {
    return {
      rol: "todos",
      titulo: "Caso cerrado",
      descripcion: "Este expediente ya está archivado y no requiere acción.",
      botonLabel: "Ver historial",
      tab: "historial",
      prioridad: "baja",
    };
  }

  // 1) Devolución QA → analista debe corregir
  if (ec === "proyeccion_devuelta_qa" && canSeeAnalystGuide) {
    return {
      rol: "licenciado",
      titulo: "Corrige la proyección devuelta por QA",
      descripcion: "Dirección Financiera devolvió la proyección con observaciones. Ajusta y reenvía a auditoría.",
      botonLabel: "Abrir simulador",
      scrollToId: "simulador-financiero-qa",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 2) Pendiente QA → Director Financiero
  if (ec === "proyeccion_pendiente_qa" && canSeeFinanceGuide) {
    return {
      rol: "director_financiero_qa",
      titulo: "Audita la proyección financiera",
      descripcion: "Hay una proyección esperando tu validación QA.",
      botonLabel: "Auditar proyección",
      scrollToId: "validacion-qa",
      tab: "auditoria",
      prioridad: "alta",
    };
  }

  // 3) Respuesta banco → analista debe subir aceptación / generar otrosí
  if ((ec === "aprobado" || ec === "aprobado_banco" || ec === "condiciones_aplicadas") &&
      canSeeAnalystGuide) {
    return {
      rol: "licenciado",
      titulo: "Sube la evidencia de aceptación del cliente",
      descripcion: "Carga la aceptación del cliente al resultado bancario / otrosí.",
      botonLabel: "Subir evidencia",
      scrollToId: "resultado-bancario",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 4) Resultado final generado → contabilidad genera cuenta de cobro
  if (ec === "resultado_final_generado" && canSeeAccountingGuide) {
    return {
      rol: "contabilidad",
      titulo: "Genera la cuenta de cobro",
      descripcion: "El informe final está listo. Procede a generar la cuenta de cobro al cliente.",
      botonLabel: "Generar cuenta de cobro",
      scrollToId: "cierre-operativo",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 5) Cuenta enviada / honorarios pendientes → contabilidad valida pago
  if ((ec === "cuenta_cobro_enviada" || ec === "honorarios_pendientes") && canSeeAccountingGuide) {
    return {
      rol: "contabilidad",
      titulo: "Valida el pago del cliente",
      descripcion: "Confirma el ingreso de los honorarios para liberar el paz y salvo.",
      botonLabel: "Validar pago",
      scrollToId: "cierre-operativo",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 6) Honorarios pagados → contabilidad emite paz y salvo
  if (ec === "honorarios_pagados" && (has("contabilidad") || has("juridica") || isSuper)) {
    return {
      rol: "contabilidad",
      titulo: "Emite el paz y salvo",
      descripcion: "Los honorarios fueron pagados. Genera el paz y salvo del cliente.",
      botonLabel: "Emitir paz y salvo",
      scrollToId: "cierre-operativo",
      tab: "financiero",
      prioridad: "media",
    };
  }

  // 7) Contratación → jurídica / operaciones toman el expediente que el analista ya envió.
  if (etapa === "contratacion" && canSeeContractGuide) {
    const isSigningStep = ec === "contrato_generado" || ec === "contrato_enviado" || ec === "poder_generado";
    return {
      rol: "juridica",
      titulo: isSigningStep ? "Gestiona firmas de contrato y poder" : "Prepara contrato, poder y solicitud",
      descripcion:
        isSigningStep
          ? "El expediente ya está en Contratación. Haz seguimiento a las firmas del cliente y actualiza el avance documental."
          : "El analista ya envió la proyección aprobada con cédula y extracto. Genera los documentos jurídicos para continuar.",
      botonLabel: "Abrir documentos",
      scrollToId: "documentos-juridicos",
      tab: "documentos",
      prioridad: "alta",
    };
  }

  // 8) Etapa radicación / documentación → jurídica / operaciones
  if ((etapa === "documentacion_bancaria" || etapa === "radicacion") && canSeeContractGuide) {
    return {
      rol: "juridica",
      titulo: "Completa la documentación para radicar",
      descripcion: "Valida poder, solicitud de cambio de plazos y checklist documental antes de radicar.",
      botonLabel: "Ir a documentos",
      scrollToId: "documentos-juridicos",
      tab: "documentos",
      prioridad: "alta",
    };
  }

  // 9) Devuelto / docs complementarios → ops + analista
  if ((ec === "devuelto_banco" || ec === "docs_complementarios_banco") && (has("operaciones") || has("juridica") || has("licenciado") || has("asesor") || isSuper)) {
    return {
      rol: "operaciones",
      titulo: "Subsana lo que pidió el banco",
      descripcion: "El banco solicitó información adicional o devolvió el caso. Subsana y reenvía.",
      botonLabel: "Ver detalle",
      scrollToId: "resultado-bancario",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 10) Asesor / licenciado con simulación lista → debe enviar a Contratación, no volver a simular.
  if (proyeccionListaParaEnviar(exp, ec) && canSeeAnalystGuide) {
    return {
      rol: "licenciado",
      titulo: "Envía el caso a Contratación",
      descripcion:
        "La simulación y la propuesta ya están listas. Usa el envío del módulo financiero; si NUVIA la aprueba, pasa directo a Contratación.",
      botonLabel: "Enviar a Contratación",
      scrollToId: "simulador-financiero-qa",
      tab: "financiero",
      prioridad: "alta",
    };
  }

  // 10.1) Asesor / licenciado en lead / proyección sin propuesta lista
  if ((etapa === "lead" || etapa === "proyeccion") && canSeeAnalystGuide) {
    return {
      rol: "asesor",
      titulo: "Avanza con la proyección financiera",
      descripcion:
        "Completa la simulación. Si NUVIA la aprueba, pasa directo a Contratación; solo se enruta a auditoría QA si NUVIA detecta inconsistencias.",
      botonLabel: "Ir a financiero",
      scrollToId: "simulador-financiero-qa",
      tab: "financiero",
      prioridad: "media",
    };
  }

  // 10.5) Asesor — caso en auditoría QA (NUVIA enrutó por marca/bloqueo)
  if (etapa === "auditoria_qa" && isAnalista) {
    return {
      rol: "asesor",
      titulo: "Proyección en auditoría QA",
      descripcion:
        "NUVIA detectó observaciones y envió la proyección a Dirección Financiera para validación. Te avisaremos con el veredicto.",
      botonLabel: "Ver auditoría",
      scrollToId: "validacion-qa",
      tab: "auditoria",
      prioridad: "baja",
    };
  }

  // 11) Asesor — caso ya entregado a Contratación
  if (etapa === "contratacion" && isAnalista) {
    return {
      rol: "asesor",
      titulo: "Caso enviado a Contratación",
      descripcion:
        "El equipo de Contratación está generando contrato y poder con los datos y soportes (cédula + extracto) que cargaste. Recibirás aviso cuando el cliente deba firmar.",
      botonLabel: "Ver documentos",
      scrollToId: "documentos-juridicos",
      tab: "documentos",
      prioridad: "baja",
    };
  }

  // 12) Asesor — documentación bancaria / radicación en manos de jurídica/operaciones
  if ((etapa === "documentacion_bancaria" || etapa === "radicacion") && isAnalista) {
    return {
      rol: "asesor",
      titulo: etapa === "radicacion" ? "Radicación en curso" : "Documentación bancaria en preparación",
      descripcion:
        etapa === "radicacion"
          ? "Operaciones está radicando la solicitud ante el banco. No requiere acción de tu parte por ahora."
          : "Jurídica y Operaciones están consolidando el paquete documental para radicar al banco.",
      botonLabel: "Ver checklist",
      scrollToId: "checklist-documental",
      tab: "documentos",
      prioridad: "baja",
    };
  }

  // 13) Asesor — banco evaluando
  if (etapa === "respuesta_banco" && isAnalista) {
    return {
      rol: "asesor",
      titulo: "Banco evaluando la solicitud",
      descripcion:
        "El banco está revisando el caso. Te avisaremos en cuanto haya respuesta o solicite documentos complementarios.",
      botonLabel: "Ver estado",
      scrollToId: "resultado-bancario",
      tab: "financiero",
      prioridad: "baja",
    };
  }

  // 14) Asesor — etapas finales (resultado/otrosí, informe / cuenta / pago / paz y salvo)
  if (
    (etapa === "resultado_otrosi" || etapa === "informe_final" || etapa === "cuenta_cobro" || etapa === "pago" || etapa === "paz_salvo") &&
    isAnalista
  ) {
    const titulos: Record<string, string> = {
      resultado_otrosi: "Aplicando resultado del banco",
      informe_final: "Informe final en preparación",
      cuenta_cobro: "Cuenta de cobro en gestión",
      pago: "A la espera del pago del cliente",
      paz_salvo: "Paz y salvo en emisión",
    };
    return {
      rol: "asesor",
      titulo: titulos[etapa] ?? "Caso en cierre",
      descripcion: "Contabilidad y Dirección Financiera están cerrando el caso. No requiere acción del asesor.",
      botonLabel: "Ver cierre",
      scrollToId: "cierre-operativo",
      tab: "financiero",
      prioridad: "baja",
    };
  }

  // 15) Gerencia → solo después de resolver la acción operativa del rol responsable.
  if ((has("gerencia") || has("admin") || has("super_admin")) && diasDesde(exp.updated_at) >= 3) {
    return {
      rol: "gerencia",
      titulo: `Este expediente lleva ${diasDesde(exp.updated_at)} días sin actividad`,
      descripcion: "Revisa quién es el responsable actual y escala si es necesario.",
      botonLabel: "Ver control operativo",
      tab: "resumen",
      prioridad: "media",
    };
  }

  // 16) Fallback seguro: ningún rol autenticado debe quedarse sin guía.
  // Si no es su turno operativo, se muestra seguimiento coherente de la etapa actual.
  if (roles.length > 0) {
    const seguimiento: Record<EtapaGuiadaId, Omit<SiguienteAccion, "rol" | "prioridad">> = {
      lead: {
        titulo: "Caso en captura inicial",
        descripcion: "El equipo comercial está completando datos y soportes iniciales del cliente.",
        botonLabel: "Ver resumen",
        tab: "resumen",
      },
      proyeccion: {
        titulo: proyeccionListaParaEnviar(exp, ec) ? "Proyección lista para Contratación" : "Proyección financiera en preparación",
        descripcion: proyeccionListaParaEnviar(exp, ec)
          ? "El analista ya tiene una propuesta guardada y puede enviarla a Contratación desde el módulo financiero."
          : "El analista está trabajando la simulación financiera antes de avanzar el expediente.",
        botonLabel: proyeccionListaParaEnviar(exp, ec) ? "Enviar a Contratación" : "Ver financiero",
        scrollToId: "simulador-financiero-qa",
        tab: "financiero",
      },
      auditoria_qa: {
        titulo: "Proyección en auditoría QA",
        descripcion: "Dirección Financiera está revisando una observación detectada por NUVIA.",
        botonLabel: "Ver auditoría",
        scrollToId: "validacion-qa",
        tab: "auditoria",
      },
      contratacion: {
        titulo: "Caso en Contratación",
        descripcion: "El expediente ya pasó la proyección y está en generación o firma de documentos jurídicos.",
        botonLabel: "Ver documentos",
        scrollToId: "documentos-juridicos",
        tab: "documentos",
      },
      documentacion_bancaria: {
        titulo: "Documentación bancaria en preparación",
        descripcion: "Jurídica y Operaciones están consolidando el paquete documental para radicar al banco.",
        botonLabel: "Ver checklist",
        scrollToId: "checklist-documental",
        tab: "documentos",
      },
      radicacion: {
        titulo: "Radicación en curso",
        descripcion: "Operaciones está radicando o preparando la solicitud ante el banco.",
        botonLabel: "Ver radicación",
        scrollToId: "validacion-radicacion",
        tab: "tareas",
      },
      respuesta_banco: {
        titulo: "Banco evaluando la solicitud",
        descripcion: "El banco está revisando el caso o pidió una subsanación documental.",
        botonLabel: "Ver respuesta",
        scrollToId: "resultado-bancario",
        tab: "financiero",
      },
      resultado_otrosi: {
        titulo: "Resultado bancario en gestión",
        descripcion: "El equipo responsable está aplicando condiciones, otrosí o documentos finales del banco.",
        botonLabel: "Ver resultado",
        scrollToId: "resultado-bancario",
        tab: "financiero",
      },
      informe_final: {
        titulo: "Informe final en preparación",
        descripcion: "Dirección Financiera está consolidando el cierre operativo del caso.",
        botonLabel: "Ver cierre",
        scrollToId: "cierre-operativo",
        tab: "financiero",
      },
      cuenta_cobro: {
        titulo: "Cuenta de cobro en gestión",
        descripcion: "Contabilidad está preparando o revisando la cuenta de cobro del caso.",
        botonLabel: "Ver cierre",
        scrollToId: "cierre-operativo",
        tab: "financiero",
      },
      pago: {
        titulo: "Pago en validación",
        descripcion: "Contabilidad y Cartera están validando el pago de honorarios.",
        botonLabel: "Ver cierre",
        scrollToId: "cierre-operativo",
        tab: "financiero",
      },
      paz_salvo: {
        titulo: "Paz y salvo en emisión",
        descripcion: "El caso está en cierre administrativo y documental.",
        botonLabel: "Ver cierre",
        scrollToId: "cierre-operativo",
        tab: "financiero",
      },
      caso_cerrado: {
        titulo: "Caso cerrado",
        descripcion: "Este expediente ya está archivado y no requiere acción.",
        botonLabel: "Ver historial",
        tab: "historial",
      },
    };
    const item = seguimiento[etapa];
    return { rol: "todos", prioridad: "baja", ...item };
  }

  return null;
}

// ============================================================
// Bloqueos: "Qué falta para continuar"
// ============================================================

export interface Bloqueo {
  que_falta: string;
  responsable_rol: AppRole;
  prioridad: "alta" | "media" | "baja";
  scrollToId?: string;
  tab?: TabId;
}

export function getBloqueos(exp: Expediente): Bloqueo[] {
  const etapa = etapaActualGuiada(exp);
  const ec = (exp as unknown as { estado_caso?: string }).estado_caso ?? "";
  const out: Bloqueo[] = [];

  // Bloqueos por etapa
  if (etapa === "auditoria_qa") {
    out.push({ que_falta: "Validación QA de la proyección", responsable_rol: "director_financiero_qa", prioridad: "alta", scrollToId: "validacion-qa", tab: "auditoria" });
  }

  if (etapa === "documentacion_bancaria" || etapa === "radicacion") {
    out.push({ que_falta: "Poder firmado por el cliente", responsable_rol: "asesor", prioridad: "alta", scrollToId: "documentos-juridicos", tab: "documentos" });
    out.push({ que_falta: "Solicitud Cambio de Plazos generada", responsable_rol: "juridica", prioridad: "alta", scrollToId: "documentos-juridicos", tab: "documentos" });
    out.push({ que_falta: "Checklist documental 100% completo", responsable_rol: "operaciones", prioridad: "alta", scrollToId: "checklist-documental", tab: "documentos" });
    // Validación de identidad: el analista la confirmó al subir la cédula; ya no es un bloqueo separado.
  }

  if (etapa === "respuesta_banco") {
    out.push({ que_falta: "Respuesta del banco a la radicación", responsable_rol: "operaciones", prioridad: "alta", scrollToId: "resultado-bancario", tab: "financiero" });
    if (ec === "docs_complementarios_banco") {
      out.push({ que_falta: "Documentos complementarios solicitados por el banco", responsable_rol: "operaciones", prioridad: "alta", scrollToId: "resultado-bancario", tab: "financiero" });
    }
    if (ec === "devuelto_banco") {
      out.push({ que_falta: "Subsanación de la devolución del banco", responsable_rol: "operaciones", prioridad: "alta", scrollToId: "resultado-bancario", tab: "financiero" });
    }
  }

  if (etapa === "resultado_otrosi") {
    out.push({ que_falta: "Aceptación del cliente al resultado / otrosí", responsable_rol: "asesor", prioridad: "alta", scrollToId: "resultado-bancario", tab: "financiero" });
  }

  if (etapa === "cuenta_cobro" && ec !== "cuenta_cobro_enviada") {
    out.push({ que_falta: "Generar y enviar la cuenta de cobro", responsable_rol: "contabilidad", prioridad: "alta", scrollToId: "cierre-operativo", tab: "financiero" });
  }

  if (etapa === "pago" && ec !== "honorarios_pagados") {
    out.push({ que_falta: "Pago de honorarios por parte del cliente", responsable_rol: "contabilidad", prioridad: "alta", scrollToId: "cierre-operativo", tab: "financiero" });
  }

  if (etapa === "paz_salvo") {
    out.push({ que_falta: "Emitir paz y salvo", responsable_rol: "contabilidad", prioridad: "media", scrollToId: "cierre-operativo", tab: "financiero" });
  }

  return out;
}

// ============================================================
// Checklist por rol
// ============================================================

export interface ChecklistItem {
  label: string;
  completado: boolean;
  scrollToId?: string;
  tab?: TabId;
}

function tieneCedulaDatos(exp: Expediente): boolean {
  return Boolean(exp.cliente_nombre && exp.cedula && exp.banco);
}
function tienePropuesta(exp: Expediente): boolean {
  const p = (exp as unknown as { propuesta_data?: Record<string, unknown> }).propuesta_data ?? {};
  return Boolean(p && Number(p.nuevaCuota ?? 0) > 0);
}

function proyeccionListaParaEnviar(exp: Expediente, ec: string): boolean {
  return ["simulacion_realizada", "simulado", "propuesta_presentada", "propuesta_enviada"].includes(ec) && tienePropuesta(exp);
}

function ordenEstado(ec: string): number {
  const ORD: Record<string, number> = {
    lead_creado: 1, prospecto: 2, extracto_recibido: 3, simulacion_realizada: 4, simulado: 5,
    proyeccion_pendiente_qa: 6, proyeccion_devuelta_qa: 6, proyeccion_aprobada_qa: 7,
    propuesta_presentada: 8, propuesta_enviada: 9, acepto_propuesta: 10,
    pendiente_contratacion: 11, enviado_contratacion: 12, contrato_generado: 13, contrato_firmado: 14,
    poder_generado: 15, poder_firmado: 16, documentacion_completa: 17,
    radicacion_pendiente: 18, radicacion_preparada: 19, radicado_banco: 20,
    en_estudio_banco: 21, docs_complementarios_banco: 21, devuelto_banco: 21,
    aprobado: 22, aprobado_banco: 22, condiciones_aplicadas: 23, aplicado_banco: 23,
    resultado_final_generado: 24,
    cuenta_cobro_generada: 25, cuenta_cobro_enviada: 26,
    honorarios_pendientes: 27, honorarios_pagados: 28,
    paz_y_salvo_generado: 29, caso_finalizado: 30,
  };
  return ORD[ec] ?? 0;
}
function paso(ec: string, minOrden: number): boolean {
  return ordenEstado(ec) >= minOrden;
}

export function getChecklistRol(exp: Expediente, roles: AppRole[]): ChecklistItem[] {
  const ec = (exp as unknown as { estado_caso?: string }).estado_caso ?? "";
  const has = (r: AppRole) => roles.includes(r);
  const items: ChecklistItem[] = [];

  if (has("licenciado") || has("asesor") || has("super_admin") || has("admin")) {
    items.push({ label: "Datos del cliente completos", completado: tieneCedulaDatos(exp), tab: "resumen" });
    items.push({ label: "Propuesta generada", completado: tienePropuesta(exp), scrollToId: "simulador-financiero-qa", tab: "financiero" });
    items.push({ label: "Propuesta enviada", completado: paso(ec, 9), tab: "financiero" });
    items.push({ label: "Contrato firmado", completado: paso(ec, 14), tab: "documentos" });
    items.push({ label: "Poder firmado", completado: paso(ec, 16), tab: "documentos" });
    items.push({ label: "Aceptación cliente cargada", completado: paso(ec, 22), tab: "financiero" });
  }

  if (has("director_financiero_qa") || has("super_admin")) {
    items.push({ label: "Proyección recibida para QA", completado: paso(ec, 6), scrollToId: "validacion-qa", tab: "auditoria" });
    items.push({ label: "Proyección aprobada QA", completado: paso(ec, 7) && ec !== "proyeccion_devuelta_qa", tab: "auditoria" });
    items.push({ label: "Resultado banco revisado", completado: paso(ec, 22), tab: "financiero" });
    items.push({ label: "Informe final generado", completado: paso(ec, 24), tab: "financiero" });
  }

  if (has("contabilidad") || has("cartera") || has("super_admin")) {
    items.push({ label: "Cuenta de cobro generada", completado: paso(ec, 25), tab: "financiero" });
    items.push({ label: "Cuenta de cobro enviada", completado: paso(ec, 26), tab: "financiero" });
    items.push({ label: "Pago validado", completado: paso(ec, 28), tab: "financiero" });
    items.push({ label: "Paz y salvo emitido", completado: paso(ec, 29), tab: "financiero" });
  }

  if (has("juridica") || has("director_juridico") || has("operaciones") || has("apoderado") || has("super_admin")) {
    items.push({ label: "Poder validado", completado: paso(ec, 16), tab: "documentos" });
    items.push({ label: "Documentación completa", completado: paso(ec, 17), tab: "documentos" });
    items.push({ label: "Radicación realizada", completado: paso(ec, 20), tab: "documentos" });
    items.push({ label: "Respuesta banco cargada", completado: paso(ec, 22), tab: "financiero" });
  }

  if (has("gerencia") || has("admin") || has("super_admin")) {
    items.push({ label: "Expediente sin bloqueos", completado: getBloqueos(exp).length === 0, tab: "resumen" });
    items.push({ label: "SLA dentro de tiempo (<5 días en etapa)", completado: diasDesde(exp.updated_at) < 5, tab: "resumen" });
    items.push({ label: "Responsable asignado", completado: Boolean(exp.asesor_id), tab: "resumen" });
  }

  // De-duplicate by label keeping completado=true precedence
  const map = new Map<string, ChecklistItem>();
  for (const it of items) {
    const prev = map.get(it.label);
    if (!prev) map.set(it.label, it);
    else if (it.completado && !prev.completado) map.set(it.label, it);
  }
  return Array.from(map.values());
}

export function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
}

// Color tokens para el semáforo
export const ESTADO_COLOR: Record<EtapaEstado, { bg: string; fg: string; border: string; label: string }> = {
  completado:      { bg: "#EAF7EE", fg: "#1F7A45", border: "#2E8B57", label: "Completado" },
  en_proceso:      { bg: "#EEF1FA", fg: "#445DA3", border: "#445DA3", label: "En proceso" },
  pendiente:       { bg: "#F2F4F8", fg: "#6B7280", border: "#CBD3E0", label: "Pendiente" },
  bloqueado:       { bg: "#FEE2E2", fg: "#991B1B", border: "#DC2626", label: "Bloqueado" },
  requiere_accion: { bg: "#FFF7E6", fg: "#8A5A00", border: "#F0B429", label: "Requiere acción" },
};
