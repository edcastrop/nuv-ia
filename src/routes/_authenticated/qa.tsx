import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { listValidaciones, type ValidacionQA } from "@/lib/validacionQA";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/qa")({
  component: QADashboard,
  head: () => ({ meta: [{ title: "Validación Financiera QA · NUVEX" }] }),
});

function QADashboard() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const [items, setItems] = useState<ValidacionQA[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await listValidaciones(500);
      setItems(all);
      const ids = Array.from(new Set(all.flatMap((v) => [v.solicitada_por, v.validada_por]).filter(Boolean) as string[]));
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const m = new Map<string, string>();
        (data ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const pendientes = items.filter((v) => !v.resultado).length;
    const aprobadasHoy = items.filter((v) => v.resultado === "aprobada" && v.validada_at?.startsWith(hoy)).length;
    const devueltasHoy = items.filter((v) => v.resultado === "devuelta" && v.validada_at?.startsWith(hoy)).length;
    const tiempos = items.filter((v) => v.tiempo_validacion_min != null).map((v) => v.tiempo_validacion_min!);
    const promedio = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
    return { pendientes, aprobadasHoy, devueltasHoy, promedio };
  }, [items]);

  const ranking = useMemo(() => {
    const map = new Map<string, { total: number; aprobadas: number; devueltas: number; aprobadasPrimera: number }>();
    for (const v of items) {
      const k = v.solicitada_por;
      const cur = map.get(k) ?? { total: 0, aprobadas: 0, devueltas: 0, aprobadasPrimera: 0 };
      cur.total += 1;
      if (v.resultado === "aprobada") {
        cur.aprobadas += 1;
        if (v.primera_revision) cur.aprobadasPrimera += 1;
      } else if (v.resultado === "devuelta") {
        cur.devueltas += 1;
      }
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([uid, s]) => ({
        uid,
        nombre: nombres.get(uid) ?? "—",
        ...s,
        calidad: s.total ? Math.round((s.aprobadasPrimera / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [items, nombres]);

  if (rolesLoading || loading) return <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!canValidarProyeccion)
    return <div className="p-8 text-center text-sm text-[#B42318]">Acceso restringido a Director Financiero QA.</div>;

  const colorCalidad = (q: number) => (q >= 95 ? "#1F7A45" : q >= 85 ? "#8A5A00" : "#991B1B");
  const bgCalidad = (q: number) => (q >= 95 ? "#EAF7EE" : q >= 85 ? "#FFF7E6" : "#FEE2E2");

  const pendientes = items.filter((v) => !v.resultado);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#0A1226]">Validación financiera QA</h1>
        <p className="text-[12px] text-[#242424]/60 mt-0.5">
          Dashboard de control de calidad sobre las proyecciones presentadas por los licenciados.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Pendientes por validar" value={stats.pendientes} color="#8A5A00" />
        <Stat label="Aprobadas hoy" value={stats.aprobadasHoy} color="#1F7A45" />
        <Stat label="Devueltas hoy" value={stats.devueltasHoy} color="#991B1B" />
        <Stat label="Tiempo prom. (min)" value={stats.promedio} color="#445DA3" />
      </div>

      <Card>
        <div className="border-b border-[#E3E7EE] pb-2 mb-3 text-sm font-semibold text-[#0A1226]">
          Proyecciones pendientes ({pendientes.length})
        </div>
        {pendientes.length === 0 ? (
          <div className="p-4 text-center text-sm text-[#242424]/60">Sin pendientes 🎉</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-3 py-2 text-left">Solicitada</th>
                <th className="px-3 py-2 text-left">Licenciado</th>
                <th className="px-3 py-2 text-left">Expediente</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {pendientes.map((v) => (
                <tr key={v.id} className="hover:bg-[#F7F9FB]">
                  <td className="px-3 py-2">{new Date(v.solicitada_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{nombres.get(v.solicitada_por) ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{v.expediente_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-right">
                    <Link to="/casos/$id" params={{ id: v.expediente_id }} className="text-[12px] text-[#445DA3] hover:underline">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card>
        <div className="border-b border-[#E3E7EE] pb-2 mb-3 text-sm font-semibold text-[#0A1226]">
          Ranking de licenciados — Calidad
        </div>
        <table className="w-full text-[12.5px]">
          <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
            <tr>
              <th className="px-3 py-2 text-left">Licenciado</th>
              <th className="px-3 py-2 text-right">Simulaciones</th>
              <th className="px-3 py-2 text-right">Aprobadas</th>
              <th className="px-3 py-2 text-right">Devueltas</th>
              <th className="px-3 py-2 text-right">Calidad %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EE]">
            {ranking.map((r) => (
              <tr key={r.uid}>
                <td className="px-3 py-2">{r.nombre}</td>
                <td className="px-3 py-2 text-right">{r.total}</td>
                <td className="px-3 py-2 text-right">{r.aprobadas}</td>
                <td className="px-3 py-2 text-right">{r.devueltas}</td>
                <td className="px-3 py-2 text-right">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: bgCalidad(r.calidad), color: colorCalidad(r.calidad) }}
                  >
                    {r.calidad}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
