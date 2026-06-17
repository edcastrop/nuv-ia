import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type AppRole =
  | "admin"
  | "super_admin"
  | "gerencia"
  | "asesor"
  | "licenciado"
  | "juridica"
  | "operaciones"
  | "cartera"
  | "contabilidad"
  | "director_financiero_qa"
  | "director_juridico"
  | "auxiliar_operativo"
  | "apoderado";

const ROLE_CACHE_PREFIX = "nuvia.userRoles.";
let memoryRoles = new Map<string, AppRole[]>();

function readRoleCache(userId?: string): AppRole[] {
  if (!userId || typeof window === "undefined") return [];
  const inMemory = memoryRoles.get(userId);
  if (inMemory) return inMemory;
  try {
    const raw = window.localStorage.getItem(`${ROLE_CACHE_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AppRole[];
    if (Array.isArray(parsed)) {
      memoryRoles.set(userId, parsed);
      return parsed;
    }
  } catch {
    // cache auxiliar inválido: se ignora.
  }
  return [];
}

function writeRoleCache(userId: string, roles: AppRole[]) {
  memoryRoles.set(userId, roles);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${ROLE_CACHE_PREFIX}${userId}`, JSON.stringify(roles));
  } catch {
    // cache auxiliar: no debe afectar navegación.
  }
}

export function isManager(roles: AppRole[]): boolean {
  return roles.includes("admin") || roles.includes("super_admin") || roles.includes("gerencia");
}

export function isSuperAdmin(roles: AppRole[]): boolean {
  return roles.includes("super_admin") || roles.includes("admin");
}

export function canManageFinanzas(roles: AppRole[]): boolean {
  return roles.some((r) => ["super_admin", "admin", "gerencia", "contabilidad"].includes(r));
}

export function isLicenciado(roles: AppRole[]): boolean {
  return roles.includes("licenciado");
}

export function isDirectorQA(roles: AppRole[]): boolean {
  return roles.includes("director_financiero_qa") || roles.includes("super_admin");
}

export function isDirectorJuridico(roles: AppRole[]): boolean {
  return roles.includes("director_juridico") || roles.includes("super_admin");
}

export function isApoderadoRole(roles: AppRole[]): boolean {
  return roles.includes("apoderado");
}

export function canValidarProyeccion(roles: AppRole[]): boolean {
  return roles.some((r) => ["super_admin", "director_financiero_qa", "gerencia"].includes(r));
}

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>(() => readRoleCache(user?.id));
  const [loading, setLoading] = useState(() => authLoading && readRoleCache(user?.id).length === 0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    const cached = readRoleCache(user.id);
    if (cached.length > 0) {
      setRoles(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    const timeout = window.setTimeout(() => {
      if (cancel) return;
      setRoles(readRoleCache(user.id));
      setLoading(false);
    }, 3500);
    (async () => {
      try {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        if (cancel) return;
        const nextRoles = (data ?? []).map((r) => r.role as AppRole);
        writeRoleCache(user.id, nextRoles);
        setRoles(nextRoles);
        setLoading(false);
      } catch {
        if (cancel) return;
        setRoles(readRoleCache(user.id));
        setLoading(false);
      }
    })();
    return () => { cancel = true; window.clearTimeout(timeout); };
  }, [user, authLoading]);

  return {
    roles,
    isManager: isManager(roles),
    isSuperAdmin: isSuperAdmin(roles),
    isLicenciado: isLicenciado(roles),
    isDirectorQA: isDirectorQA(roles),
    isDirectorJuridico: isDirectorJuridico(roles),
    isApoderado: isApoderadoRole(roles),
    canValidarProyeccion: canValidarProyeccion(roles),
    loading: loading || authLoading,
  };
}
