import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getDashboardMetrics, ESTADOS, ESTADO_COLORS, type DashboardMetrics, type Expediente } from "@/lib/expedientes";
import { Card, SectionTitle } from "@/components/nuvex/ui";
import { formatCOP, formatNumber } from "@/lib/format";
import { NUVEX } from "@/components/nuvex/constants";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard Gerencial · NUVEX" }] }),
});

function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getDashboardMetrics()
      .then((r) => { setMetrics(r.metrics); setRows(r.rows); })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando indicadores…</div>;
  if (err || !metrics) return <div className="p-12 text-center text-sm text-[#B42318]">{err}</div>;

  const funnel = ESTADOS.map((e) => ({ estado: e, count: metrics.porEstado[e] || 0, color: ESTADO_COLORS[e].color }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <SectionTitle sub="Indicadores en tiempo real de producción, aprobación, acertividad y honorarios.">Dashboard Gerencial NUVEX</SectionTitle>
        <div className="grid gap-3 md:grid-cols-4">
          <KPI label="Expedientes totales" value={String(metrics.total)} accent={NUVEX.negro} />
          <KPI label="Tasa de aprobación" value={`${formatNumber(metrics.tasaAprobacion, 1)}%`} accent={NUVEX.verdeTextoFuerte} />
          <KPI label="Acertividad promedio" value={`${formatNumber(metrics.acertividadPromedio, 1)}%`} accent={NUVEX.azul} />
          <KPI label="Tasa de cierre" value={`${formatNumber(metrics.tasaCierre, 1)}%`} accent={NUVEX.verde} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle sub="Distribución de expedientes por estado del proceso">Funnel de producción</SectionTitle>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={funnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                <XAxis dataKey="estado" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {funnel.map((f, i) => <Cell key={i} fill={f.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle sub="Resumen comercial">Honorarios</SectionTitle>
          <div className="space-y-3">
            <Row label="Pipeline (firmado → facturado)" value={formatCOP(metrics.pipeline)} color={NUVEX.azul} />
            <Row label="Facturado" value={formatCOP(metrics.honorariosFacturados)} color="#9333EA" />
            <Row label="Pagado" value={formatCOP(metrics.honorariosPagados)} color={NUVEX.verdeTextoFuerte} />
            <div className="pt-2 mt-2 border-t border-[#E3E7EE] text-xs text-[#242424]/55">
              Base bruta acumulada: <span className="font-semibold text-[#242424]">{formatCOP(metrics.honorariosBase)}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle>Últimos expedientes</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Banco</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Honorarios</th>
                <th className="py-2 pr-3 text-right">Acertividad</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((r) => (
                <tr key={r.id} className="border-b border-[#F0F3F8]">
                  <td className="py-2 pr-3 font-medium">{r.cliente_nombre}</td>
                  <td className="py-2 pr-3 text-[#242424]/75">{r.banco || "—"}</td>
                  <td className="py-2 pr-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: ESTADO_COLORS[r.estado].color }}>
                      {r.estado}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-semibold">{formatCOP(Number(r.honorarios_final))}</td>
                  <td className="py-2 pr-3 text-right">{r.acertividad_global != null ? `${formatNumber(Number(r.acertividad_global), 1)}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="mt-1.5 text-2xl font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-[#242424]/70">{label}</div>
      <div className="font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
