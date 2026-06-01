import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";
import { Users, ArrowRightLeft, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/gestion-usuarios")({
  component: GestionUsuariosPage,
  head: () => ({ meta: [{ title: "Gestión operativa de usuarios · NUVEX" }] }),
});

interface UsuarioRow {
  id: string;
  nombre: string | null;
  email: string | null;
  estado_acceso: string;
  roles: string[];
  casosActivos: number;
  casosTotales: number;
}

const ESTADOS_ACTIVOS = ["caso_finalizado", "proceso_cerrado", "negado_banco"];

function GestionUsuariosPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const autorizado = isSuperAdmin || roles.includes("gerencia" as never);

  const [rows, setRows] = useState<UsuarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reasignar, setReasignar] = useState<UsuarioRow | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [{ data: profs, error: e1 }, { data: ur }, { data: exps }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, email, estado_acceso").eq("estado_acceso", "aprobado").order("nombre"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("expedientes").select("asesor_id, estado_caso"),
      ]);
      if (e1) throw e1;

      const rolesByUser = new Map<string, string[]>();
      ((ur ?? []) as Array<{ user_id: string; role: string }>).forEach((r) => {
        const list = rolesByUser.get(r.user_id) ?? [];
        list.push(r.role);
        rolesByUser.set(r.user_id, list);
      });

      const totByUser = new Map<string, { activos: number; total: number }>();
      ((exps ?? []) as Array<{ asesor_id: string | null; estado_caso: string | null }>).forEach((e) => {
        if (!e.asesor_id) return;
        const slot = totByUser.get(e.asesor_id) ?? { activos: 0, total: 0 };
        slot.total++;
        if (!e.estado_caso || !ESTADOS_ACTIVOS.includes(e.estado_caso)) slot.activos++;
        totByUser.set(e.asesor_id, slot);
      });

      const out: UsuarioRow[] = ((profs ?? []) as Array<{ id: string; nombre: string | null; email: string | null; estado_acceso: string }>).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        email: p.email,
        estado_acceso: p.estado_acceso,
        roles: rolesByUser.get(p.id) ?? [],
        casosActivos: totByUser.get(p.id)?.activos ?? 0,
        casosTotales: totByUser.get(p.id)?.total ?? 0,
      }));
      out.sort((a, b) => b.casosActivos - a.casosActivos);
      setRows(out);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (autorizado) void refresh(); }, [autorizado]);

  const totales = useMemo(() => ({
    usuarios: rows.length,
    activos: rows.reduce((s, r) => s + r.casosActivos, 0),
    sinCasos: rows.filter((r) => r.casosActivos === 0).length,
    sobrecargados: rows.filter((r) => r.casosActivos > 15).length,
  }), [rows]);

  if (!autorizado) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[#242424]/65">No tienes permiso para acceder a esta sección.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
          NUVEX · Gerencia Administrativa y Operaciones
        </div>
        <h1 className="text-2xl font-semibold text-[#242424] flex items-center gap-2">
          <Users size={22} style={{ color: NUVEX.azul }} /> Gestión operativa de usuarios
        </h1>
        <p className="text-sm text-[#242424]/65 mt-1">
          Carga operativa por colaborador, roles asignados y reasignación de casos.
          La gestión de roles, permisos y aprobación de accesos se mantiene en Super Admin.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Usuarios activos" value={totales.usuarios} />
        <Kpi label="Casos activos" value={totales.activos} />
        <Kpi label="Sin casos asignados" value={totales.sinCasos} />
        <Kpi label="Sobrecargados (>15)" value={totales.sobrecargados} color="#9A3412" />
      </div>

      <Card>
        {loading && <div className="py-6 text-center text-sm text-[#242424]/60">Cargando usuarios…</div>}
        {err && <div className="py-6 text-center text-sm text-[#B42318]">{err}</div>}
        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4">Roles</th>
                  <th className="py-2 pr-4 text-right">Casos activos</th>
                  <th className="py-2 pr-4 text-right">Casos totales</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F0F2F6] hover:bg-[#F7F9FB]">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-[#242424]">{r.nombre || "—"}</div>
                      <div className="text-[11px] text-[#242424]/55">{r.email}</div>
                    </td>
                    <td className="py-2 pr-4 text-[12px] text-[#242424]/75">
                      {r.roles.length === 0 ? <span className="text-[#242424]/40">Sin rol</span> :
                        r.roles.map((rr) => (
                          <span key={rr} className="inline-block mr-1 mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                            style={{ background: "#EEF2FF", color: "#3730A3", borderColor: "#C7D2FE" }}>
                            {roleLabel(rr, true)}
                          </span>
                        ))}
                    </td>
                    <td className="py-2 pr-4 text-right font-semibold"
                      style={{ color: r.casosActivos > 15 ? "#9A3412" : r.casosActivos === 0 ? "#9CA3AF" : "#242424" }}>
                      {r.casosActivos}
                    </td>
                    <td className="py-2 pr-4 text-right text-[#242424]/70">{r.casosTotales}</td>
                    <td className="py-2 pr-2 text-right">
                      {r.casosActivos > 0 && (
                        <button onClick={() => setReasignar(r)}
                          className="inline-flex items-center gap-1 text-[11px] text-[#445DA3] hover:underline">
                          <ArrowRightLeft size={12} /> Reasignar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {reasignar && (
        <ReasignarModal
          origen={reasignar}
          usuarios={rows.filter((u) => u.id !== reasignar.id)}
          onClose={() => setReasignar(null)}
          onDone={async () => { setReasignar(null); await refresh(); }}
        />
      )}

      <div className="text-[11px] text-[#242424]/55">
        ¿Necesitas aprobar accesos o cambiar roles? <Link to="/super-admin/accesos" className="text-[#445DA3] hover:underline">Ir a Super Admin · Accesos</Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, color = "#242424" }: { label: string; value: number; color?: string }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </Card>
  );
}

function ReasignarModal({ origen, usuarios, onClose, onDone }: {
  origen: UsuarioRow;
  usuarios: UsuarioRow[];
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [casos, setCasos] = useState<Array<{ id: string; cliente_nombre: string; estado_caso: string | null }>>([]);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("expedientes")
        .select("id, cliente_nombre, estado_caso")
        .eq("asesor_id", origen.id)
        .not("estado_caso", "in", `(${ESTADOS_ACTIVOS.map((s) => `"${s}"`).join(",")})`)
        .order("updated_at", { ascending: false })
        .limit(200);
      setCasos((data ?? []) as Array<{ id: string; cliente_nombre: string; estado_caso: string | null }>);
    })();
  }, [origen.id]);

  const toggle = (id: string) => {
    const ns = new Set(seleccion);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    setSeleccion(ns);
  };
  const toggleAll = () => setSeleccion(seleccion.size === casos.length ? new Set() : new Set(casos.map((c) => c.id)));

  const reasignar = async () => {
    if (!destino || seleccion.size === 0) { setError("Selecciona destino y al menos un caso."); return; }
    setBusy(true); setError(null);
    try {
      const ids = Array.from(seleccion);
      const { error: e } = await supabase.from("expedientes").update({ asesor_id: destino } as never).in("id", ids);
      if (e) throw e;
      // Auditoría
      const { data: auth } = await supabase.auth.getUser();
      await supabase.from("auditoria_global").insert(
        ids.map((eid) => ({
          entidad: "expediente",
          entidad_id: eid,
          accion: "reasignar_asesor",
          user_id: auth.user?.id ?? null,
          valor_anterior: { asesor_id: origen.id } as never,
          valor_nuevo: { asesor_id: destino } as never,
        })) as never,
      );
      await onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <h2 className="text-base font-semibold text-[#242424]">Reasignar casos de {origen.nombre || origen.email}</h2>
          <button onClick={onClose} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">Reasignar a</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
              <option value="">— Selecciona destinatario —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre || u.email} ({u.casosActivos} activos)
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-[#242424]/70">{casos.length} casos activos · {seleccion.size} seleccionados</span>
            <button onClick={toggleAll} className="text-[11px] text-[#445DA3] hover:underline">
              {seleccion.size === casos.length ? "Quitar todos" : "Seleccionar todos"}
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto border border-[#E3E7EE] rounded-lg">
            {casos.length === 0 && <div className="p-4 text-[12px] text-[#242424]/55 text-center">Este usuario no tiene casos activos.</div>}
            {casos.map((c) => (
              <label key={c.id} className="flex items-center gap-2 px-3 py-2 border-b border-[#F0F2F6] hover:bg-[#F7F9FB] cursor-pointer">
                <input type="checkbox" checked={seleccion.has(c.id)} onChange={() => toggle(c.id)} />
                <div className="flex-1">
                  <div className="text-[13px] text-[#242424]">{c.cliente_nombre}</div>
                  <div className="text-[10px] text-[#242424]/55">{c.estado_caso}</div>
                </div>
              </label>
            ))}
          </div>

          {error && <div className="text-[12px] text-[#B42318]">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E3E7EE] bg-[#FAFBFC]">
          <button onClick={onClose} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-sm">Cancelar</button>
          <button onClick={reasignar} disabled={busy || !destino || seleccion.size === 0}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: NUVEX.azul }}>
            {busy ? "Reasignando…" : `Reasignar ${seleccion.size} caso(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
