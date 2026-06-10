// Reglas por banco para la entrega de documentación financiera tras radicar
// el poder. Cada banco tiene su propio mecanismo (correo a Jurídica, entrega
// física inmediata, o entrega física diferida en días hábiles).

export type ModalidadEntrega = "correo" | "fisica" | "ninguna";

export interface ReglaEntregaBanco {
  /** Clave canónica corta. */
  bancoCanonico:
    | "davivienda"
    | "banco_bogota"
    | "davibank"
    | "av_villas"
    | "otro";
  /** Nombre legible. */
  bancoLabel: string;
  /** ¿Cómo se entrega la documentación financiera? */
  modalidad: ModalidadEntrega;
  /**
   * Días hábiles entre la radicación del poder y la entrega física.
   * 0 = se entrega el mismo día (Banco de Bogotá).
   * Solo aplica cuando modalidad === "fisica".
   */
  diasHabilesEntrega: number;
  /**
   * Si true, se debe bloquear el botón "Radicar" hasta que el checklist
   * documental esté 100% completo (V1: Banco de Bogotá).
   */
  requiereChecklistCompletoAlRadicar: boolean;
  /** Destinatario formal cuando modalidad === "correo". */
  correoJuridica?: string;
  /** Explicación operativa visible al asesor. */
  descripcion: string;
}

const REGLAS: ReglaEntregaBanco[] = [
  {
    bancoCanonico: "davivienda",
    bancoLabel: "Davivienda",
    modalidad: "correo",
    diasHabilesEntrega: 0,
    requiereChecklistCompletoAlRadicar: false,
    correoJuridica: "juridica@nuvex.com.co",
    descripcion:
      "Se radica el poder en oficina. Luego se envía por correo a Jurídica del banco: copia del poder, cédulas (apoderado, titular(es), codeudor) y documentos financieros.",
  },
  {
    bancoCanonico: "banco_bogota",
    bancoLabel: "Banco de Bogotá",
    modalidad: "fisica",
    diasHabilesEntrega: 0,
    requiereChecklistCompletoAlRadicar: true,
    descripcion:
      "En el mismo acto de radicación se entrega TODO: poder firmado, cédulas y checklist completo. No reciben si falta documentación.",
  },
  {
    bancoCanonico: "davibank",
    bancoLabel: "Davibank",
    modalidad: "fisica",
    diasHabilesEntrega: 4,
    requiereChecklistCompletoAlRadicar: false,
    descripcion:
      "Se radica el poder. A los 4 días hábiles se entrega físicamente la documentación financiera completa (ver checklist inteligente).",
  },
  {
    bancoCanonico: "av_villas",
    bancoLabel: "AV Villas",
    modalidad: "fisica",
    diasHabilesEntrega: 8,
    requiereChecklistCompletoAlRadicar: false,
    descripcion:
      "Se radica el poder. A los 8 días hábiles se entrega físicamente la documentación financiera completa (ver checklist inteligente).",
  },
];

const REGLA_DEFAULT: ReglaEntregaBanco = {
  bancoCanonico: "otro",
  bancoLabel: "Otro banco",
  modalidad: "ninguna",
  diasHabilesEntrega: 0,
  requiereChecklistCompletoAlRadicar: false,
  descripcion:
    "Banco sin regla específica de entrega documental. Coordina con el banco la modalidad y el plazo.",
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getReglaEntrega(banco: string | null | undefined): ReglaEntregaBanco {
  if (!banco) return REGLA_DEFAULT;
  const n = norm(banco);
  if (n.includes("davivienda")) return REGLAS[0];
  if (n.includes("bogota")) return REGLAS[1];
  if (n.includes("davibank") || n === "davi bank") return REGLAS[2];
  if (n.includes("av villas") || n.includes("avvillas")) return REGLAS[3];
  return { ...REGLA_DEFAULT, bancoLabel: banco };
}

export function todasLasReglas(): ReglaEntregaBanco[] {
  return REGLAS;
}
