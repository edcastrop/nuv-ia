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
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    let cancel = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancel) return;
        setRoles((data ?? []).map((r) => r.role as AppRole));
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [user, authLoading]);

  return {
    roles,
    isManager: isManager(roles),
    isSuperAdmin: isSuperAdmin(roles),
    isLicenciado: isLicenciado(roles),
    loading: loading || authLoading,
  };
}
