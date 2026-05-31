import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";

export const Route = createFileRoute("/_authenticated/super-admin/usuarios")({
  component: SuperAdminUsuarios,
  head: () => ({ meta: [{ title: "Usuarios · Super Admin" }] }),
});

const ROLES: AppRole[] = ["super_admin", "admin", "gerencia", "licenciado", "juridica", "operaciones", "cartera", "asesor"];

interface Profile {
  id: string;
  nombre: string | null;
  email: string | null;
  activo: boolean;
}

function SuperAdminUsuarios() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, AppRole[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    const { data: ps } = await supabase.from("profiles").select("id,nombre,email,activo" as never);
    setProfiles((ps ?? []) as unknown as Profile[]);
    const { data: rs } = await supabase.from("user_roles").select("user_id,role");
    const m = new Map<string, AppRole[]>();
    (rs ?? []).forEach((r) => {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      m.set(r.user_id, arr);
    });
    setRolesByUser(m);
    setLoading(false);
  };

  useEffect(() => { if (!rolesLoading && isSuperAdmin) reload(); else if (!rolesLoading) setLoading(false); }, [rolesLoading, isSuperAdmin]);

  if (rolesLoading || loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  const toggleActivo = async (p: Profile) => {
    setBusyId(p.id);
    try {
      await supabase.from("profiles").update({ activo: !p.activo } as never).eq("id", p.id);
      await reload();
    } finally { setBusyId(null); }
  };

  const toggleRole = async (userId: string, role: AppRole, has: boolean) => {
    setBusyId(userId);
    try {
      if (has) {
        await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
      } else {
        await supabase.from("user_roles").insert({ user_id: userId, role } as never);
      }
      await reload();
    } finally { setBusyId(null); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#242424]">Usuarios</h1>
        <div className="text-sm text-[#242424]/60">Activar / desactivar y asignar roles</div>
      </div>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <th className="text-left py-2">Nombre</th>
                <th className="text-left">Email</th>
                <th className="text-left">Roles</th>
                <th className="text-right">Activo</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const rs = rolesByUser.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="border-t border-[#E3E7EE] align-top">
                    <td className="py-2 pr-2">{p.nombre || "—"}</td>
                    <td className="py-2 pr-2 text-[#242424]/70">{p.email || "—"}</td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {ROLES.map((r) => {
                          const has = rs.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => toggleRole(p.id, r, has)}
                              disabled={busyId === p.id}
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium border"
                              style={has
                                ? { background: "#445DA3", color: "#fff", borderColor: "#445DA3" }
                                : { background: "#fff", color: "#242424", borderColor: "#E3E7EE" }}
                            >{roleLabel(r, true)}</button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => toggleActivo(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg border px-2 py-1 text-[11px] font-medium"
                        style={p.activo
                          ? { background: "#EAF7EE", color: "#1F7A45", borderColor: "#84B98F" }
                          : { background: "#FDECEC", color: "#B42318", borderColor: "#F5C2C2" }}
                      >{p.activo ? "Activo" : "Inactivo"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px] text-[#242424]/60">
          Los usuarios se registran a través de la pantalla de inicio de sesión. Desde aquí asignas roles y los activas o desactivas.
        </div>
      </Card>
    </div>
  );
}
