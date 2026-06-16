import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";
import { ArrowLeft, Save, ShieldCheck } from "lucide-react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";

export const Route = createFileRoute("/_authenticated/super-admin/permisos")({
  component: PermisosMatrix,
  head: () => ({ meta: [{ title: "Permisos · Super Admin · NUVEX" }] }),
});

const ROLES: AppRole[] = [
  "gerencia", "asesor", "licenciado", "juridica", "operaciones",
  "cartera", "contabilidad", "director_financiero_qa", "director_juridico",
  "auxiliar_operativo", "apoderado",
];

interface Permiso { id: string; modulo: string; accion: string; descripcion: string | null }
interface RolPerm { role: AppRole; modulo: string; accion: string; permitido: boolean }

function PermisosMatrix() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [perms, setPerms] = useState<Permiso[]>([]);
  const [matrix, setMatrix] = useState<Map<string, boolean>>(new Map());
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const key = (r: AppRole, m: string, a: string) => `${r}|${m}|${a}`;

  useEffect(() => {
    (async () => {
      const [{ data: cat }, { data: rp }] = await Promise.all([
        supabase.from("permisos_catalogo" as never).select("*").order("modulo").order("accion"),
        supabase.from("rol_permisos" as never).select("role,modulo,accion,permitido"),
      ]);
      setPerms((cat as unknown as Permiso[]) ?? []);
      const m = new Map<string, boolean>();
      ((rp as unknown as RolPerm[]) ?? []).forEach((r) => m.set(key(r.role, r.modulo, r.accion), r.permitido));
      setMatrix(m);
      setLoading(false);
    })();
  }, []);

  const toggle = (r: AppRole, m: string, a: string) => {
    const k = key(r, m, a);
    const cur = matrix.get(k) ?? false;
    const nm = new Map(matrix);
    nm.set(k, !cur);
    setMatrix(nm);
    const nd = new Set(dirty);
    nd.add(k);
    setDirty(nd);
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const rows = Array.from(dirty).map((k) => {
        const [role, modulo, accion] = k.split("|");
        return { role: role as AppRole, modulo, accion, permitido: matrix.get(k) ?? false };
      });
      if (rows.length) {
        const { error } = await supabase
          .from("rol_permisos" as never)
          .upsert(rows as never, { onConflict: "role,modulo,accion" });
        if (error) throw error;
      }
      setDirty(new Set());
      setMsg(`Guardados ${rows.length} cambios`);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const g = new Map<string, Permiso[]>();
    perms.forEach((p) => {
      if (!g.has(p.modulo)) g.set(p.modulo, []);
      g.get(p.modulo)!.push(p);
    });
    return Array.from(g.entries());
  }, [perms]);

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <div className="p-8 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

  const cardBase = {
    background: "var(--nuvia-bg-card)",
    border: "1px solid var(--nuvia-border)",
  } as const;
  const stickyBg = "rgba(255,255,255,0.04)";

  return (
    <PageLayout maxWidth="full">
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Control de acceso", tone: "blue" }}
        title="Matriz de permisos"
        description="Super Admin tiene todos los permisos por defecto. Modifica los toggles para ajustar roles."
        meta={
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--nuvia-accent-blue)" }}>
            <ArrowLeft size={12} /> Super Admin
          </Link>
        }
        actions={
          <div className="flex items-center gap-3">
            {msg && <span className="text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>{msg}</span>}
            <button
              onClick={save}
              disabled={saving || dirty.size === 0}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold transition disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
                color: "#fff",
              }}
            >
              <Save size={14} /> Guardar {dirty.size > 0 ? `(${dirty.size})` : ""}
            </button>
          </div>
        }
      />

      <div className="space-y-4">
        {grouped.map(([modulo, list]) => (
          <section key={modulo} className="rounded-2xl p-5" style={cardBase}>
            <div className="text-sm font-semibold capitalize mb-3" style={{ color: "var(--nuvia-text-primary)" }}>{modulo}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-wide" style={{ background: stickyBg }}>
                    <th
                      className="px-3 py-2 text-left sticky left-0 font-semibold"
                      style={{ background: stickyBg, color: "var(--nuvia-text-secondary)" }}
                    >
                      Acción
                    </th>
                    {ROLES.map((r) => (
                      <th
                        key={r}
                        className="px-2 py-2 text-center whitespace-nowrap font-semibold"
                        style={{ color: "var(--nuvia-text-secondary)" }}
                      >
                        {roleLabel(r, true)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                      <td
                        className="px-3 py-2 font-medium sticky left-0"
                        style={{ background: "var(--nuvia-bg-card)", color: "var(--nuvia-text-primary)" }}
                      >
                        {p.accion}
                      </td>
                      {ROLES.map((r) => {
                        const v = matrix.get(key(r, p.modulo, p.accion)) ?? false;
                        const d = dirty.has(key(r, p.modulo, p.accion));
                        return (
                          <td key={r} className="px-2 py-2 text-center">
                            <button
                              onClick={() => toggle(r, p.modulo, p.accion)}
                              className="h-5 w-5 rounded transition"
                              style={{
                                background: v ? "var(--nuvia-accent-green)" : "rgba(255,255,255,0.04)",
                                border: `1px solid ${d ? "var(--nuvia-accent-blue)" : v ? "var(--nuvia-accent-green)" : "var(--nuvia-border)"}`,
                                boxShadow: d ? "0 0 0 2px rgba(68,93,163,0.25)" : "none",
                              }}
                              aria-label={`${r} ${p.accion}`}
                            >
                              {v && <span className="text-white text-[10px] leading-none">✓</span>}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </PageLayout>
  );
}
