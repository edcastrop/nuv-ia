import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shield, Users, FolderOpen, Key, Activity, Palette, Cpu } from "lucide-react";
import { PageLayout, ExecutiveHero, NCard } from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { CASO_ESTADOS, labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { useUserRole } from "@/hooks/useUserRole";
import { getReporteCostosIA, type ReporteCostosIA } from "@/lib/costosIA.functions";

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
  const [costosIA, setCostosIA] = useState<ReporteCostosIA | null>(null);

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
      try {
        const r = await getReporteCostosIA();
        setCostosIA(r);
      } catch {
        // silencioso — el KPI muestra "—"
      }
      setLoading(false);
    })();
  }, [rolesLoading, isSuperAdmin]);

  if (rolesLoading) {
    return (
      <PageLayout>
        <div className="p-12 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }
  if (!isSuperAdmin) return <Navigate to="/inicio" />;

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

  const navLinks = [
    { to: "/super-admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/super-admin/expedientes", label: "Expedientes", icon: FolderOpen },
    { to: "/super-admin/permisos", label: "Permisos", icon: Key },
    { to: "/super-admin/auditoria", label: "Auditoría", icon: Activity },
    { to: "/super-admin/marca", label: "Marca", icon: Palette },
    { to: "/super-admin/costos-ia", label: "Costos IA", icon: Cpu },
  ] as const;

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Shield size={12} />, label: "Control global", tone: "blue" }}
        title="Super Admin"
        description="Panel global de control NUVEX: usuarios, expedientes, permisos y auditoría."
        actions={
          <div className="flex flex-wrap gap-2 text-xs">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--nuvia-border)",
                  color: "var(--nuvia-text-primary)",
                }}
              >
                <l.icon size={12} /> {l.label}
              </Link>
            ))}
          </div>
        }
      />

      {loading ? (
        <NCard><div className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando métricas…</div></NCard>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Total expedientes" value={total.toString()} />
            <Stat label="Aprobados" value={aprobados.toString()} accent="green" />
            <Stat label="Honorarios proyectados" value={fmt(honProyectados)} />
            <Stat label="Honorarios cobrados" value={fmt(honCobrados)} accent="green" />
            <Stat label="Pendiente contratación" value={pendContratacion.toString()} />
            <Stat label="Pendiente radicación" value={pendRadicacion.toString()} />
            <Stat label="En mora (>30d)" value={enMora.toString()} accent="danger" />
            <Stat label="Analistas F. Comerciales activos" value={porLicenciado.size.toString()} accent="blue" />
            <Stat
              label={`Costo IA mes (${costosIA?.mesActual ?? "—"})`}
              value={costosIA ? fmt(costosIA.totales.costo_mes_cop) : "—"}
              accent="blue"
            />
            <Stat
              label="Costo IA histórico"
              value={costosIA ? fmt(costosIA.totales.costo_total_cop) : "—"}
              accent="green"
            />
          </div>

          <NCard>
            <h3 className="mb-3 text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              Expedientes por estado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {porEstado.map((e) => (
                <div
                  key={e.key}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                  style={{
                    border: "1px solid var(--nuvia-border)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: e.bg, color: e.color }}
                  >
                    {e.label}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{e.count}</span>
                </div>
              ))}
            </div>
          </NCard>

          <NCard>
            <h3 className="mb-3 text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              Expedientes por Analista Financiero Comercial
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>
                  <th className="text-left py-2" style={{ color: "var(--nuvia-text-secondary)" }}>Analista F. Comercial</th>
                  <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Casos</th>
                  <th className="text-right" style={{ color: "var(--nuvia-text-secondary)" }}>Honorarios</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(porLicenciado.values()).sort((a, b) => b.honorarios - a.honorarios).map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="py-2" style={{ color: "var(--nuvia-text-primary)" }}>{l.nombre}</td>
                    <td className="text-right" style={{ color: "var(--nuvia-text-primary)" }}>{l.total}</td>
                    <td className="text-right font-semibold" style={{ color: "var(--nuvia-accent-green)" }}>{fmt(l.honorarios)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </NCard>
        </>
      )}
    </PageLayout>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "green" | "blue" | "danger" }) {
  const valueColor =
    accent === "green" ? "var(--nuvia-accent-green)" :
    accent === "blue" ? "var(--nuvia-accent-blue)" :
    accent === "danger" ? "var(--nuvia-danger)" :
    "var(--nuvia-text-primary)";
  return (
    <NCard>
      <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: valueColor }}>{value}</div>
    </NCard>
  );
}

export { labelEstado };
