import { useEffect, useState } from "react";
import { useUserRole, type AppRole } from "./useUserRole";

/**
 * Orden de prioridad NUVIA (Fase 6) para resolver el Home cuando el usuario
 * tiene varios roles. Cliente (rol futuro) queda fuera de este sprint.
 */
export const HOME_ROLE_PRIORITY: AppRole[] = [
  "super_admin",
  "admin",
  "gerencia",
  "director_financiero_qa",
  "director_juridico",
  // Auditor financiero: en BD se mapea como director_financiero_qa (no hay rol "auditor").
  // Si se crea uno propio en el futuro, agregar aquí antes de "analista" equivalente.
  "juridica",
  "operaciones",
  "auxiliar_operativo",
  "cartera",
  "contabilidad",
  "licenciado", // = Analista Financiero Comercial (asesor)
  "asesor",
  "apoderado",
];

const STORAGE_KEY = "nuvia.home.role.override.v1";

function pickPrimary(roles: AppRole[]): AppRole | null {
  if (!roles.length) return null;
  for (const r of HOME_ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? null;
}

/**
 * useResolvedHomeRole — devuelve el rol "vista" para el Home.
 * - Respeta selector manual (localStorage) si sigue dentro de los roles del usuario.
 * - Cae al primario por prioridad.
 * - NO modifica permisos; solo determina qué layout se renderiza.
 */
export function useResolvedHomeRole() {
  const { roles, loading } = useUserRole();
  const [override, setOverride] = useState<AppRole | null>(() => {
    if (typeof window === "undefined") return null;
    return (localStorage.getItem(STORAGE_KEY) as AppRole | null) || null;
  });

  // Sanitizar override si el usuario ya no tiene ese rol
  useEffect(() => {
    if (loading) return;
    if (override && !roles.includes(override)) {
      setOverride(null);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [roles, override, loading]);

  const primary = pickPrimary(roles);
  const active: AppRole | null = override ?? primary;

  const setActiveRole = (role: AppRole) => {
    setOverride(role);
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch {
      /* ignore */
    }
  };

  return {
    roles,
    activeRole: active,
    primaryRole: primary,
    setActiveRole,
    multiRol: roles.length > 1,
    loading,
  };
}
