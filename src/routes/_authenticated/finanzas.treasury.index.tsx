import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";
import { NCard } from "@/components/nuvia/NCard";
import { treasuryKpis, listExtractos } from "@/lib/treasury.functions";
import { Banknote, TrendingUp, CheckCircle2, AlertTriangle, Wallet, FileText, LineChart, Bell, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/")({
  component: TreasuryDashboard,
  head: () => ({ meta: [{ title: "Dashboard Tesorería · NUVIA Treasury AI" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function TreasuryDashboard() {
  const kpisFn = useServerFn(treasuryKpis);
  const extFn = useServerFn(listExtractos);
  const { data: k } = useQuery({ queryKey: ["treasuryKpis"], queryFn: () => kpisFn() });
  const { data: ext } = useQuery({ queryKey: ["treasuryExtractos"], queryFn: () => extFn() });

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Sparkles size={12} />, label: "Treasury AI · Dashboard", tone: "blue" }}
        title="Tesorería en tiempo real"
        description="Saldos, conciliación, cartera y flujo de caja en un solo panel."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Saldo bancario" value={money(k?.saldoBancario ?? 0)} icon={<Banknote size={14} />} tone="blue" />
        <KpiCard label="Ingresos mes" value={money(k?.ingresosMes ?? 0)} icon={<TrendingUp size={14} />} tone="green" />
        <KpiCard label="Conciliados" value={String(k?.conciliados ?? 0)} icon={<CheckCircle2 size={14} />} tone="green" hint="movimientos" />
        <KpiCard label="Pendientes" value={String(k?.pendientes ?? 0)} icon={<AlertTriangle size={14} />} tone="warning" hint="por revisar" />
        <KpiCard label="Cartera por cobrar" value={money(k?.carteraPendiente ?? 0)} icon={<Wallet size={14} />} tone="warning" />
        <KpiCard label="Honorarios pendientes" value={money(k?.honorariosPendientes ?? 0)} icon={<FileText size={14} />} tone="warning" />
        <KpiCard label="Flujo esperado 30d" value={money(k?.flujo30 ?? 0)} icon={<LineChart size={14} />} tone="blue" />
        <KpiCard label="Alertas activas" value={String(k?.alertas ?? 0)} icon={<Bell size={14} />} tone="danger" hint="sin identificar" />
      </KpiGrid>

      <NCard variant="elevated">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
            Últimos extractos cargados
          </h3>
          <span style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>
            {ext?.length ?? 0} en historial
          </span>
        </div>
        {!ext || ext.length === 0 ? (
          <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            Aún no se han cargado extractos. Ve a <strong style={{ color: "#A5B5E0" }}>Conciliación IA</strong> para subir el primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--nuvia-text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Archivo</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Formato</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Movs</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)", textAlign: "right" }}>Ingresos</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)", textAlign: "right" }}>Egresos</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {ext.map((e) => (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }}>{e.archivo_nombre}</td>
                    <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)", textTransform: "uppercase" }}>{e.formato}</td>
                    <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }} className="tabular-nums">{e.total_movs}</td>
                    <td style={{ padding: "8px", color: "#9BCB9F", textAlign: "right" }} className="tabular-nums">{money(e.total_ingresos)}</td>
                    <td style={{ padding: "8px", color: "#F4A38C", textAlign: "right" }} className="tabular-nums">{money(e.total_egresos)}</td>
                    <td style={{ padding: "8px" }}>
                      <EstadoBadge estado={e.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}

function EstadoBadge({ estado }: { estado: "procesando" | "listo" | "error" }) {
  const map = {
    procesando: { bg: "rgba(246,196,83,0.16)", fg: "#F6C453", label: "Procesando" },
    listo: { bg: "rgba(132,185,143,0.16)", fg: "#9BCB9F", label: "Listo" },
    error: { bg: "rgba(255,107,107,0.16)", fg: "#FF8585", label: "Error" },
  }[estado];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold uppercase"
      style={{ background: map.bg, color: map.fg, fontSize: 9, letterSpacing: "0.12em" }}
    >
      {map.label}
    </span>
  );
}
