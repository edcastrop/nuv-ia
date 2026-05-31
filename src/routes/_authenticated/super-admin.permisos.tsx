import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";
import { Save, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/super-admin/permisos")({
  component: PermisosMatrix,
  head: () => ({ meta: [{ title: "Permisos · Super Admin · NUVEX" }] }),
});

const ROLES: AppRole[] = [
  "gerencia",
  "asesor",
  "licenciado",
  "juridica",
  "operaciones",
  "cartera",
  "contabilidad",
  "director_financiero_qa",
  "director_juridico",
  "auxiliar_operativo",
  "apoderado",
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

  if (rolesLoading || loading) return <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck size={20} className="text-[#445DA3]" />
            <div>
              <h1 className="text-lg font-semibold text-[#0A1226]">Matriz de permisos</h1>
              <p className="text-[12px] text-[#242424]/60">Super Admin tiene todos los permisos por defecto.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-[12px] text-[#242424]/70">{msg}</span>}
            <button
              onClick={save}
              disabled={saving || dirty.size === 0}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#445DA3" }}
            >
              <Save size={14} /> Guardar {dirty.size > 0 ? `(${dirty.size})` : ""}
            </button>
          </div>
        </div>
      </Card>

      {grouped.map(([modulo, list]) => (
        <Card key={modulo}>
          <div className="text-sm font-semibold text-[#0A1226] capitalize mb-2">{modulo}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="bg-[#F7F9FB] text-[10.5px] uppercase tracking-wide text-[#242424]/60">
                  <th className="px-3 py-2 text-left sticky left-0 bg-[#F7F9FB]">Acción</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-2 py-2 text-center whitespace-nowrap">{roleLabel(r, true)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E7EE]">
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white">{p.accion}</td>
                    {ROLES.map((r) => {
                      const v = matrix.get(key(r, p.modulo, p.accion)) ?? false;
                      const d = dirty.has(key(r, p.modulo, p.accion));
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          <button
                            onClick={() => toggle(r, p.modulo, p.accion)}
                            className="h-5 w-5 rounded border transition"
                            style={{
                              background: v ? "#1F7A45" : "#fff",
                              borderColor: d ? "#445DA3" : "#CBD3E0",
                              boxShadow: d ? "0 0 0 2px rgba(68,93,163,0.2)" : "none",
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
        </Card>
      ))}
    </div>
  );
}
