// Torre de Control Operativa NUVEX — Fase 1
// 14 etapas con mapeo desde estado_caso + SLAs fijos por etapa.
// Los umbrales SLA son configurables en el futuro; por ahora viven en código.

import type { CasoEstado } from "@/lib/casoEstados";

export interface EtapaTorre {
  numero: number;
  key: string;
  label: string;
  descripcion: string;
  estados: CasoEstado[];
  /** Horas dentro de la etapa antes de marcar AMARILLO (próximo a vencer). */
  slaAmarilloHoras: number;
  /** Horas dentro de la etapa antes de marcar ROJO (vencido). */
  slaRojoHoras: number;
}

const H = (dias: number) => dias * 24;

export const ETAPAS_TORRE: EtapaTorre[] = [
  {
    numero: 1,
    key: "registro",
    label: "Registro del cliente",
    descripcion: "Lead recibido, prospecto inicial, extracto/simulación.",
    estados: ["lead_creado", "prospecto", "extracto_recibido", "simulacion_realizada", "simulado"],
    slaAmarilloHoras: H(3),
    slaRojoHoras: H(7),
  },
  {
    numero: 2,
    key: "contrato",
    label: "Firma de contrato",
    descripcion: "Contrato generado / enviado, pendiente de firma del cliente.",
    estados: ["pendiente_contratacion", "enviado_contratacion", "contrato_enviado", "contrato_generado"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 3,
    key: "poderes",
    label: "Firma de poderes",
    descripcion: "Poder generado, en espera de firma del cliente.",
    estados: ["contrato_firmado", "poder_generado"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 4,
    key: "proyeccion",
    label: "Proyección financiera",
    descripcion: "Propuesta presentada / enviada al cliente.",
    estados: ["propuesta_presentada", "propuesta_enviada", "acepto_propuesta", "negociacion"],
    slaAmarilloHoras: H(2),
    slaRojoHoras: H(5),
  },
  {
    numero: 5,
    key: "qa",
    label: "Auditoría Dirección Financiera",
    descripcion: "Proyección en QA o devuelta por dirección financiera.",
    estados: ["proyeccion_pendiente_qa", "proyeccion_devuelta_qa", "proyeccion_aprobada_qa"],
    slaAmarilloHoras: 12,
    slaRojoHoras: 24,
  },
  {
    numero: 6,
    key: "checklist",
    label: "Checklist documental",
    descripcion: "Poder firmado, recolección y validación documental.",
    estados: ["poder_firmado", "documentacion_completa"],
    slaAmarilloHoras: H(2),
    slaRojoHoras: H(3),
  },
  {
    numero: 7,
    key: "radicacion",
    label: "Radicación bancaria",
    descripcion: "Listo para radicar o radicación preparada.",
    estados: ["radicacion_pendiente", "radicacion_preparada"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 8,
    key: "respuesta_banco",
    label: "Respuesta banco",
    descripcion: "Radicado, en estudio, o requerimiento adicional del banco.",
    estados: ["radicado_banco", "en_estudio_banco", "docs_complementarios_banco"],
    slaAmarilloHoras: H(7),
    slaRojoHoras: H(15),
  },
  {
    numero: 9,
    key: "revision",
    label: "Revisión jurídica y financiera",
    descripcion: "Aprobado por banco, validando firmas y condiciones.",
    estados: ["aprobado", "aprobado_banco", "documentos_banco_firmados"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 10,
    key: "informe_final",
    label: "Informe final",
    descripcion: "Condiciones aplicadas, resultado final pendiente.",
    estados: ["condiciones_aplicadas", "aplicado_banco", "resultado_final_generado"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 11,
    key: "cuenta_cobro",
    label: "Cuenta de cobro",
    descripcion: "Cuenta generada o enviada al cliente.",
    estados: ["cuenta_cobro_generada", "cuenta_cobro_enviada"],
    slaAmarilloHoras: H(2),
    slaRojoHoras: H(5),
  },
  {
    numero: 12,
    key: "pago",
    label: "Pago cliente",
    descripcion: "Honorarios pendientes de pago.",
    estados: ["honorarios_pendientes"],
    slaAmarilloHoras: H(3),
    slaRojoHoras: H(7),
  },
  {
    numero: 13,
    key: "paz_y_salvo",
    label: "Paz y salvo",
    descripcion: "Pago confirmado, pendiente emisión de paz y salvo.",
    estados: ["honorarios_pagados", "paz_y_salvo_generado"],
    slaAmarilloHoras: 24,
    slaRojoHoras: 48,
  },
  {
    numero: 14,
    key: "cerrado",
    label: "Caso cerrado",
    descripcion: "Caso finalizado o proceso cerrado.",
    estados: ["caso_finalizado", "proceso_cerrado"],
    slaAmarilloHoras: 0,
    slaRojoHoras: 0,
  },
];

/** Estados que se consideran "detenidos" para alertas operativas. */
export const ESTADOS_DETENIDOS: CasoEstado[] = [
  "devuelto_banco",
  "negado_banco",
  "prejuridico",
  "proyeccion_devuelta_qa",
];

/** Estados finales/cerrados — no cuentan como activos. */
export const ESTADOS_CERRADOS: CasoEstado[] = ["caso_finalizado", "proceso_cerrado"];

export type SemaforoNivel = "verde" | "amarillo" | "rojo" | "neutro";

export const SEMAFORO_COLORS: Record<SemaforoNivel, { bg: string; color: string; border: string; label: string }> = {
  verde:    { bg: "#DDF4E3", color: "#1F7A45", border: "#A6E2B6", label: "En tiempo" },
  amarillo: { bg: "#FFF7E6", color: "#8A5A00", border: "#F5D899", label: "Próximo a vencer" },
  rojo:     { bg: "#FEE2E2", color: "#991B1B", border: "#FCA5A5", label: "Vencido" },
  neutro:   { bg: "#F1F2F4", color: "#242424", border: "#E3E7EE", label: "—" },
};

export interface ExpedienteResumen {
  id: string;
  cliente_nombre: string;
  banco: string | null;
  estado_caso: CasoEstado | null;
  updated_at: string;
}

export interface EtapaConteo {
  etapa: EtapaTorre;
  total: number;
  verde: number;
  amarillo: number;
  rojo: number;
  expedientes: Array<ExpedienteResumen & { horas: number; nivel: SemaforoNivel }>;
}

export function nivelSemaforo(etapa: EtapaTorre, horas: number): SemaforoNivel {
  if (etapa.key === "cerrado") return "neutro";
  if (horas >= etapa.slaRojoHoras) return "rojo";
  if (horas >= etapa.slaAmarilloHoras) return "amarillo";
  return "verde";
}

export function horasDesde(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, (Date.now() - t) / 3_600_000);
}

export function agruparPorEtapa(expedientes: ExpedienteResumen[]): EtapaConteo[] {
  // index estado → etapa
  const idx = new Map<string, EtapaTorre>();
  ETAPAS_TORRE.forEach((e) => e.estados.forEach((s) => idx.set(s, e)));
  const grupos = new Map<string, EtapaConteo>();
  ETAPAS_TORRE.forEach((e) =>
    grupos.set(e.key, { etapa: e, total: 0, verde: 0, amarillo: 0, rojo: 0, expedientes: [] }),
  );
  for (const exp of expedientes) {
    if (!exp.estado_caso) continue;
    const etapa = idx.get(exp.estado_caso);
    if (!etapa) continue;
    const g = grupos.get(etapa.key);
    if (!g) continue;
    const horas = horasDesde(exp.updated_at);
    const nivel = nivelSemaforo(etapa, horas);
    g.total += 1;
    if (nivel === "verde") g.verde += 1;
    else if (nivel === "amarillo") g.amarillo += 1;
    else if (nivel === "rojo") g.rojo += 1;
    g.expedientes.push({ ...exp, horas, nivel });
  }
  // ordenar expedientes: rojo primero, luego amarillo, luego verde, por más horas
  grupos.forEach((g) =>
    g.expedientes.sort((a, b) => {
      const rank: Record<SemaforoNivel, number> = { rojo: 0, amarillo: 1, verde: 2, neutro: 3 };
      const r = rank[a.nivel] - rank[b.nivel];
      return r !== 0 ? r : b.horas - a.horas;
    }),
  );
  return Array.from(grupos.values());
}

export function contarDetenidos(expedientes: ExpedienteResumen[]): number {
  const set = new Set<string>(ESTADOS_DETENIDOS);
  return expedientes.filter((e) => e.estado_caso && set.has(e.estado_caso)).length;
}

export function contarActivos(expedientes: ExpedienteResumen[]): number {
  const cerr = new Set<string>(ESTADOS_CERRADOS);
  return expedientes.filter((e) => !e.estado_caso || !cerr.has(e.estado_caso)).length;
}

export function contarVencidos(grupos: EtapaConteo[]): number {
  return grupos.reduce((acc, g) => acc + g.rojo, 0);
}
