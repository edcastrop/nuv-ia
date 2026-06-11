import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  InsightCard,
  NCard,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import {
  cargarProductividad,
  isoDesdeDias,
  RANGOS_PRODUCTIVIDAD,
  type ProductividadUsuario,
  type RangoKey,
} from "@/lib/productividad";
import { Activity, TrendingUp, Users, Timer, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/productividad")({
  component: ProductividadPage,
  head: () => ({ meta: [{ title: "Productividad y tiempos · NUVIA" }] }),
});

function ProductividadPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const autorizado = isSuperAdmin || roles.includes("gerencia" as never);

  const [rango, setRango] = useState<RangoKey>("30d");
  const [rows, setRows] = useState<ProductividadUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!autorizado) return;
    const dias = RANGOS_PRODUCTIVIDAD.find((r) => r.key === rango)?.dias ?? 30;
    setLoading(true);
    cargarProductividad(isoDesdeDias(dias))
      .then((data) => { setRows(data); setErr(null); })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [rango, autorizado]);

  const totales = useMemo(() => ({
    cambios: rows.reduce((s, r) => s + r.cambios_estado, 0),
    cerrados: rows.reduce((s, r) => s + r.casos_cerrados, 0),
    alertas: rows.reduce((s, r) => s + r.alertas_recibidas, 0),
    promCiclo: (() => {
      const vals = rows.filter((r) => r.horas_promedio_ciclo > 0).map((r) => r.horas_promedio_ciclo);
      return vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : 0;
    })(),
  }), [rows]);

  if (!autorizado) {
    return (
      <PageLayout>
        <EmptyState title="Sin acceso" description="Esta sección es exclusiva para Gerencia y Super Admin." />
      </PageLayout>
    );
  }

  const rangoActions = (
    <div className="flex gap-2 flex-wrap">
      {RANGOS_PRODUCTIVIDAD.map((r) => (
        <button
          key={r.key}
          onClick={() => setRango(r.key)}
          className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition"
          style={{
            background:
              rango === r.key
                ? "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))"
                : "rgba(255,255,255,0.04)",
            color: rango === r.key ? "#fff" : "var(--nuvia-text-secondary)",
            border: rango === r.key ? "1px solid transparent" : "1px solid var(--nuvia-border)",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Activity size={12} />, label: "Gerencia · Productividad", tone: "blue" }}
        title="Productividad y Tiempos"
        description="Transiciones, cierres, alertas y tiempo promedio de ciclo por colaborador."
        actions={rangoActions}
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<TrendingUp size={16} />} tone="blue" label="Transiciones" value={totales.cambios} />
        <KpiCard icon={<Users size={16} />} tone="green" label="Casos cerrados" value={totales.cerrados} />
        <KpiCard icon={<AlertTriangle size={16} />} tone={totales.alertas > 0 ? "warning" : "neutral"} label="Alertas recibidas" value={totales.alertas} />
        <KpiCard icon={<Timer size={16} />} tone="neutral" label="Ciclo promedio (h)" value={totales.promCiclo} />
      </KpiGrid>

      <InsightCard scope="productividad" />

      <NCard padding="md">
        <SectionHeader title="Ranking por colaborador" description="Score = transiciones + (cerrados × 3) − alertas." />
        {loading && <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Calculando métricas…</div>}
        {err && <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-danger)" }}>{err}</div>}
        {!loading && !err && rows.length === 0 && (
          <EmptyState title="Sin actividad registrada" description="No hay datos para el rango seleccionado." />
        )}
        {!loading && !err && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "var(--nuvia-text-body)" }}>
              <thead>
                <tr>
                  <th className="text-left py-2 pr-4">Colaborador</th>
                  <th className="py-2 pr-4 text-right">Transiciones</th>
                  <th className="py-2 pr-4 text-right">Cerrados</th>
                  <th className="py-2 pr-4 text-right">Activos</th>
                  <th className="py-2 pr-4 text-right">Alertas</th>
                  <th className="py-2 pr-4 text-right">Ciclo prom. (h)</th>
                  <th className="py-2 pr-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const score = r.cambios_estado + r.casos_cerrados * 3 - r.alertas_recibidas;
                  return (
                    <tr key={r.user_id}>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{r.nombre}</div>
                        <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{r.email}</div>
                      </td>
                      <td className="py-2 pr-4 text-right">{r.cambios_estado}</td>
                      <td className="py-2 pr-4 text-right font-semibold" style={{ color: r.casos_cerrados > 0 ? "var(--nuvia-success)" : "var(--nuvia-text-secondary)" }}>{r.casos_cerrados}</td>
                      <td className="py-2 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>{r.casos_activos}</td>
                      <td className="py-2 pr-4 text-right" style={{ color: r.alertas_recibidas > 0 ? "var(--nuvia-warning)" : "var(--nuvia-text-secondary)" }}>{r.alertas_recibidas}</td>
                      <td className="py-2 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>{r.horas_promedio_ciclo > 0 ? r.horas_promedio_ciclo : "—"}</td>
                      <td className="py-2 pr-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: score > 0 ? "var(--nuvia-success)" : "var(--nuvia-text-secondary)" }}>
                          <TrendingUp size={12} /> {score}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}
