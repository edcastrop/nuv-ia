// Centraliza las etiquetas visibles de cada rol del sistema.
// El valor en BD (app_role) NO cambia. Solo cambia lo que ve el usuario.
// Esto evita tocar enum, RLS, triggers, has_role(), academia_rol_del_usuario(), etc.

import type { AppRole } from "@/hooks/useUserRole";

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  gerencia: "Gerencia Administrativa y Operaciones",
  asesor: "Asesor",
  // Rebrand operativo (Lote R): Licenciado → Analista Financiero Comercial.
  // El valor en BD sigue siendo "licenciado" para no romper comisiones, RLS, ni Academia.
  licenciado: "Analista Financiero Comercial",
  juridica: "Jurídica",
  operaciones: "Operaciones",
  cartera: "Cartera",
  contabilidad: "Contabilidad",
  director_financiero_qa: "Director Financiero QA",
  director_juridico: "Director Jurídico",
  auxiliar_operativo: "Auxiliar Operativo",
  apoderado: "Apoderado",
};

/** Etiqueta corta (cuando el espacio es limitado: chips, badges). */
export const ROLE_LABELS_SHORT: Record<string, string> = {
  ...ROLE_LABELS,
  gerencia: "Gerencia Admin. y Ops.",
  licenciado: "Analista F. Comercial",
  director_financiero_qa: "Dir. Fra. QA",
  director_juridico: "Dir. Jurídico",
  auxiliar_operativo: "Aux. Operativo",
};

export function roleLabel(role: string | AppRole | null | undefined, short = false): string {
  if (!role) return "—";
  const map = short ? ROLE_LABELS_SHORT : ROLE_LABELS;
  return map[role as string] ?? String(role);
}

/** Para listas de roles separados por coma. */
export function roleLabels(rolesList: ReadonlyArray<string> | null | undefined, short = false): string {
  if (!rolesList || rolesList.length === 0) return "—";
  return rolesList.map((r) => roleLabel(r, short)).join(", ");
}
