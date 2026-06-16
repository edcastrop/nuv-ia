import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Users } from "lucide-react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";

export const Route = createFileRoute("/_authenticated/super-admin/usuarios")({
  component: SuperAdminUsuarios,
  head: () => ({ meta: [{ title: "Usuarios · Super Admin" }] }),
});

const ROLES: AppRole[] = [
  "super_admin", "admin", "gerencia", "licenciado", "asesor",
  "juridica", "operaciones", "cartera", "contabilidad",
  "director_financiero_qa", "director_juridico", "auxiliar_operativo", "apoderado",
];

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

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

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
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Users size={12} />, label: "Gestión de identidad", tone: "blue" }}
        title="Usuarios"
        description="Activa, desactiva y asigna roles a los usuarios registrados en NUVIA."
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
      />

      <section
        className="rounded-2xl p-5"
        style={{ background: "var(--nuvia-bg-card)", border: "1px solid var(--nuvia-border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--nuvia-text-secondary)" }}>
                <th className="text-left py-2 font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Nombre</th>
                <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Email</th>
                <th className="text-left font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Roles</th>
                <th className="text-right font-semibold" style={{ color: "var(--nuvia-text-secondary)" }}>Activo</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const rs = rolesByUser.get(p.id) ?? [];
                return (
                  <tr key={p.id} className="align-top" style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="py-2.5 pr-2" style={{ color: "var(--nuvia-text-primary)" }}>{p.nombre || "—"}</td>
                    <td className="py-2.5 pr-2" style={{ color: "var(--nuvia-text-secondary)" }}>{p.email || "—"}</td>
                    <td className="py-2.5 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {ROLES.map((r) => {
                          const has = rs.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => toggleRole(p.id, r, has)}
                              disabled={busyId === p.id}
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium transition disabled:opacity-50"
                              style={has
                                ? { background: "var(--nuvia-accent-blue)", color: "#fff", border: "1px solid var(--nuvia-accent-blue)" }
                                : { background: "rgba(255,255,255,0.03)", color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)" }}
                            >{roleLabel(r, true)}</button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => toggleActivo(p)}
                        disabled={busyId === p.id}
                        className="rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50"
                        style={p.activo
                          ? { background: "rgba(132,185,143,0.15)", color: "#9BCB9F", border: "1px solid rgba(132,185,143,0.45)" }
                          : { background: "rgba(255,107,107,0.12)", color: "#FF8585", border: "1px solid rgba(255,107,107,0.40)" }}
                      >{p.activo ? "Activo" : "Inactivo"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          Los usuarios se registran a través de la pantalla de inicio de sesión. Desde aquí asignas roles y los activas o desactivas.
        </div>
      </section>
    </PageLayout>
  );
}
