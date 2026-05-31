import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { CASO_ESTADOS, labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/super-admin/")({
  component: SuperAdminDashboard,
  head: () => ({ meta: [{ title: "Super Admin · NUVEX" }] }),
});

interface Row {
  id: string;
  asesor_id: string;
  cliente_nombre: string;
  banco: string | null;
  estado: string;
  estado_caso: CasoEstado | null;
  honorarios_final: number | null;
  updated_at: string;
}

function SuperAdminDashboard() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (rolesLoading) return;
    if (!isSuperAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from("expedientes")
        .select("id, asesor_id, cliente_nombre, banco, estado, estado_caso, honorarios_final, updated_at" as never)
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

  if (rolesLoading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!rolesLoading && !isSuperAdmin) return <Navigate to="/" />;

  const total = rows.length;
  const porEstado = CASO_ESTADOS.map((e) => ({
    ...e,
    count: rows.filter((r) => r.estado_caso === e.key).length,
  }));
  const porLicenciado = new Map<string, { nombre: string; total: number; honorarios: number }>();
  for (const r of rows) {
    const cur = porLicenciado.get(r.asesor_id) ?? { nombre: nombres.get(r.asesor_id) || "—", total: 0, honorarios: 0 };
    cur.total += 1;
    cur.honorarios += Number(r.honorarios_final) || 0;
    porLicenciado.set(r.asesor_id, cur);
  }
  const honProyectados = rows.reduce((acc, r) => acc + (Number(r.honorarios_final) || 0), 0);
  const honCobrados = rows.filter((r) => r.estado === "PAGADO" || r.estado_caso === "honorarios_pagados")
    .reduce((acc, r) => acc + (Number(r.honorarios_final) || 0), 0);
  const aprobados = rows.filter((r) => r.estado_caso === "aprobado" || r.estado === "APROBADO").length;
  const pendContratacion = rows.filter((r) => r.estado_caso === "pendiente_contratacion").length;
  const pendRadicacion = rows.filter((r) => r.estado_caso === "radicacion_pendiente").length;
  const enMora = rows.filter((r) => {
    const dias = (Date.now() - new Date(r.updated_at).getTime()) / 86400000;
    return dias > 30 && !["honorarios_pagados", "proceso_cerrado", "paz_y_salvo_generado"].includes(r.estado_caso ?? "");
  }).length;

  const fmt = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#242424]">Super Admin</h1>
          <div className="text-sm text-[#242424]/60">Panel global de control NUVEX</div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
         <Link to="/super-admin/usuarios" className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 font-medium">Usuarios</Link>
         <Link to="/super-admin/expedientes" className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 font-medium">Expedientes</Link>
         <Link to="/super-admin/permisos" className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 font-medium">Permisos</Link>
         <Link to="/super-admin/auditoria" className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 font-medium">Auditoría</Link>
         <Link to="/super-admin/marca" className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 font-medium">Marca</Link>
        </div>
      </div>

      {loading ? <Card><div className="text-sm text-[#242424]/60">Cargando métricas…</div></Card> : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total expedientes" value={total.toString()} />
            <Stat label="Aprobados" value={aprobados.toString()} />
            <Stat label="Honorarios proyectados" value={fmt(honProyectados)} />
            <Stat label="Honorarios cobrados" value={fmt(honCobrados)} />
            <Stat label="Pendiente contratación" value={pendContratacion.toString()} />
            <Stat label="Pendiente radicación" value={pendRadicacion.toString()} />
            <Stat label="En mora (>30d)" value={enMora.toString()} />
            <Stat label="Analistas F. Comerciales activos" value={porLicenciado.size.toString()} />
          </div>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-[#242424]">Expedientes por estado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {porEstado.map((e) => (
                <div key={e.key} className="flex items-center justify-between rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
                  <span style={{ color: e.color }}>{e.label}</span>
                  <span className="font-semibold">{e.count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 text-base font-semibold text-[#242424]">Expedientes por licenciado</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                  <th className="text-left py-2">Licenciado</th>
                  <th className="text-right">Casos</th>
                  <th className="text-right">Honorarios</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(porLicenciado.values()).sort((a, b) => b.honorarios - a.honorarios).map((l, i) => (
                  <tr key={i} className="border-t border-[#E3E7EE]">
                    <td className="py-2">{l.nombre}</td>
                    <td className="text-right">{l.total}</td>
                    <td className="text-right">{fmt(l.honorarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-[11px] uppercase tracking-wider text-[#242424]/60">{label}</div>
      <div className="mt-1 text-xl font-semibold text-[#242424]">{value}</div>
    </Card>
  );
}

// Re-export for typing consistency
export { labelEstado };
