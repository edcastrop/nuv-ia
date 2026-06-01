import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { useUserRole } from "@/hooks/useUserRole";
import {
  cargarProductividad,
  isoDesdeDias,
  RANGOS_PRODUCTIVIDAD,
  type ProductividadUsuario,
  type RangoKey,
} from "@/lib/productividad";
import { Activity, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/productividad")({
  component: ProductividadPage,
  head: () => ({ meta: [{ title: "Productividad y tiempos · NUVEX" }] }),
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
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-[#242424]/65">No tienes permiso para ver esta sección.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
          NUVEX · Gerencia · Productividad
        </div>
        <h1 className="text-2xl font-semibold text-[#242424] flex items-center gap-2">
          <Activity size={22} style={{ color: NUVEX.azul }} /> Productividad y tiempos
        </h1>
        <p className="text-sm text-[#242424]/65 mt-1">
          Transiciones de estado, cierres, alertas recibidas y tiempo promedio de ciclo (creación → cierre) por colaborador.
        </p>
        <div className="mt-3 flex gap-2">
          {RANGOS_PRODUCTIVIDAD.map((r) => (
            <button key={r.key} onClick={() => setRango(r.key)}
              className="rounded-full px-3 py-1 text-[12px] font-semibold border"
              style={{
                background: rango === r.key ? NUVEX.azul : "#fff",
                color: rango === r.key ? "#fff" : "#242424",
                borderColor: rango === r.key ? NUVEX.azul : "#E3E7EE",
              }}>
              {r.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Transiciones" value={totales.cambios} />
        <Kpi label="Casos cerrados" value={totales.cerrados} color="#1F7A45" />
        <Kpi label="Alertas recibidas" value={totales.alertas} color="#9A3412" />
        <Kpi label="Ciclo promedio (h)" value={totales.promCiclo} />
      </div>

      <Card>
        {loading && <div className="py-6 text-center text-sm text-[#242424]/60">Calculando métricas…</div>}
        {err && <div className="py-6 text-center text-sm text-[#B42318]">{err}</div>}
        {!loading && !err && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-4">Colaborador</th>
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
                    <tr key={r.user_id} className="border-b border-[#F0F2F6] hover:bg-[#F7F9FB]">
                      <td className="py-2 pr-4">
                        <div className="font-medium text-[#242424]">{r.nombre}</div>
                        <div className="text-[11px] text-[#242424]/55">{r.email}</div>
                      </td>
                      <td className="py-2 pr-4 text-right text-[#242424]">{r.cambios_estado}</td>
                      <td className="py-2 pr-4 text-right font-semibold" style={{ color: r.casos_cerrados > 0 ? "#1F7A45" : "#9CA3AF" }}>
                        {r.casos_cerrados}
                      </td>
                      <td className="py-2 pr-4 text-right text-[#242424]/75">{r.casos_activos}</td>
                      <td className="py-2 pr-4 text-right" style={{ color: r.alertas_recibidas > 0 ? "#9A3412" : "#9CA3AF" }}>
                        {r.alertas_recibidas}
                      </td>
                      <td className="py-2 pr-4 text-right text-[#242424]/75">
                        {r.horas_promedio_ciclo > 0 ? r.horas_promedio_ciclo : "—"}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: score > 0 ? "#1F7A45" : "#9CA3AF" }}>
                          <TrendingUp size={12} /> {score}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-[#242424]/55 text-[12px]">Sin actividad registrada en este rango.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 text-[11px] text-[#242424]/55">
          Score = transiciones + (cerrados × 3) − alertas recibidas. Indicador interno orientativo, no reemplaza la evaluación gerencial.
        </div>
      </Card>
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
