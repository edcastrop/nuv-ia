import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { CASO_ESTADOS, CASO_ESTADO_BY_KEY, labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { useUserRole } from "@/hooks/useUserRole";
import { BANCOS_DISPONIBLES } from "@/lib/apoderados";

export const Route = createFileRoute("/_authenticated/super-admin/expedientes")({
  component: SuperAdminExpedientes,
  head: () => ({ meta: [{ title: "Expedientes globales · Super Admin" }] }),
});

interface Row {
  id: string;
  asesor_id: string;
  cliente_nombre: string;
  cedula: string | null;
  banco: string | null;
  producto: string | null;
  estado: string;
  estado_caso: CasoEstado | null;
  honorarios_final: number | null;
  fecha_simulacion: string;
  created_at: string;
  cliente_data: { ciudad?: string } | null;
  aprobado_data: { fechaAprobacion?: string } | null;
}

function SuperAdminExpedientes() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const [fLic, setFLic] = useState("");
  const [fBanco, setFBanco] = useState("");
  const [fEstado, setFEstado] = useState<CasoEstado | "">("");
  const [fProducto, setFProducto] = useState("");
  const [fCiudad, setFCiudad] = useState("");
  const [fFechaDesde, setFFechaDesde] = useState("");
  const [fHonMin, setFHonMin] = useState("");
  const [fHonMax, setFHonMax] = useState("");

  useEffect(() => {
    if (rolesLoading || !isSuperAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("expedientes")
        .select("id, asesor_id, cliente_nombre, cedula, banco, producto, estado, estado_caso, honorarios_final, fecha_simulacion, created_at, cliente_data, aprobado_data" as never)
        .order("updated_at", { ascending: false });
      const list = (data ?? []) as unknown as Row[];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.asesor_id)));
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const m = new Map<string, string>();
        (profs ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, [rolesLoading, isSuperAdmin]);

  const productos = useMemo(() => Array.from(new Set(rows.map((r) => r.producto).filter(Boolean))) as string[], [rows]);
  const ciudades = useMemo(() => Array.from(new Set(rows.map((r) => r.cliente_data?.ciudad).filter(Boolean))) as string[], [rows]);
  const licenciados = useMemo(() => Array.from(nombres.entries()).map(([id, n]) => ({ id, nombre: n })), [nombres]);

  const filtrados = rows.filter((r) => {
    if (fLic && r.asesor_id !== fLic) return false;
    if (fBanco && r.banco !== fBanco) return false;
    if (fEstado && r.estado_caso !== fEstado) return false;
    if (fProducto && r.producto !== fProducto) return false;
    if (fCiudad && r.cliente_data?.ciudad !== fCiudad) return false;
    if (fFechaDesde && new Date(r.created_at) < new Date(fFechaDesde)) return false;
    const hon = Number(r.honorarios_final) || 0;
    if (fHonMin && hon < Number(fHonMin)) return false;
    if (fHonMax && hon > Number(fHonMax)) return false;
    return true;
  });

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  if (rolesLoading || loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <Navigate to="/" />;

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[#242424]">Expedientes globales</h1>
        <div className="text-sm text-[#242424]/60">{filtrados.length} de {rows.length}</div>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <select value={fLic} onChange={(e) => setFLic(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white">
            <option value="">Todos los licenciados</option>
            {licenciados.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
          <select value={fBanco} onChange={(e) => setFBanco(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white">
            <option value="">Todos los bancos</option>
            {BANCOS_DISPONIBLES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={fEstado} onChange={(e) => setFEstado(e.target.value as CasoEstado | "")} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white">
            <option value="">Todos los estados</option>
            {CASO_ESTADOS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
          <select value={fProducto} onChange={(e) => setFProducto(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white">
            <option value="">Todos los productos</option>
            {productos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={fCiudad} onChange={(e) => setFCiudad(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white">
            <option value="">Todas las ciudades</option>
            {ciudades.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" value={fFechaDesde} onChange={(e) => setFFechaDesde(e.target.value)} className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white" placeholder="Creado desde" />
          <input type="number" value={fHonMin} onChange={(e) => setFHonMin(e.target.value)} placeholder="Honorarios mín." className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white" />
          <input type="number" value={fHonMax} onChange={(e) => setFHonMax(e.target.value)} placeholder="Honorarios máx." className="rounded-lg border border-[#E3E7EE] px-2 py-1.5 bg-white" />
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                <th className="text-left py-2">Cliente</th>
                <th className="text-left">Analista F. Comercial</th>
                <th className="text-left">Banco</th>
                <th className="text-left">Estado del caso</th>
                <th className="text-right">Honorarios</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const def = r.estado_caso ? CASO_ESTADO_BY_KEY[r.estado_caso] : null;
                return (
                  <tr key={r.id} className="border-t border-[#E3E7EE]">
                    <td className="py-2">
                      <div className="font-medium">{r.cliente_nombre}</div>
                      <div className="text-[11px] text-[#242424]/60">{r.cedula ?? "—"}</div>
                    </td>
                    <td className="py-2">{nombres.get(r.asesor_id) ?? "—"}</td>
                    <td className="py-2">{r.banco ?? "—"}</td>
                    <td className="py-2">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={def ? { background: def.bg, color: def.color } : { background: "#F1F2F4", color: "#242424" }}>
                        {labelEstado(r.estado_caso)}
                      </span>
                    </td>
                    <td className="py-2 text-right">{fmt(Number(r.honorarios_final) || 0)}</td>
                    <td className="py-2 text-right">
                      <Link to="/casos/$id" params={{ id: r.id }} className="text-[11px] text-[#445DA3] hover:underline">Abrir</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
