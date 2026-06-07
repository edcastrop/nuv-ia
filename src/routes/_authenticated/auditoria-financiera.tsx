import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { etiquetaNivel, type NivelAutonomia } from "@/lib/autonomia";

export const Route = createFileRoute("/_authenticated/auditoria-financiera")({
  component: AuditoriaFinancieraPage,
});

interface Simulacion {
  id: string;
  analista_id: string;
  banco: string | null;
  producto: string | null;
  moneda: string | null;
  score_total: number;
  nivel_riesgo: string;
  requiere_revision: boolean;
  motivo_escalamiento: string | null;
  created_at: string;
}

interface Metrica {
  analista_id: string;
  total_simulaciones: number;
  score_promedio: number;
  precision_historica: number;
  porcentaje_devoluciones: number;
  porcentaje_aprobacion_banco: number;
  nivel_autonomia: number;
}

function AuditoriaFinancieraPage() {
  const { isDirectorQA, isSuperAdmin, isManager, loading } = useUserRole();
  const autorizado = isDirectorQA || isSuperAdmin || isManager;

  const [tab, setTab] = useState<"pendientes" | "ranking" | "alertas">("pendientes");
  const [sims, setSims] = useState<Simulacion[]>([]);
  const [metricas, setMetricas] = useState<Metrica[]>([]);
  const [alertas, setAlertas] = useState<
    { id: string; tipo: string; mensaje: string; created_at: string }[]
  >([]);

  useEffect(() => {
    if (!autorizado) return;
    supabase
      .from("audit_simulaciones")
      .select("id,analista_id,banco,producto,moneda,score_total,nivel_riesgo,requiere_revision,motivo_escalamiento,created_at")
      .eq("requiere_revision", true)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setSims((data ?? []) as Simulacion[]));
    supabase
      .from("analista_metricas")
      .select("analista_id,total_simulaciones,score_promedio,precision_historica,porcentaje_devoluciones,porcentaje_aprobacion_banco,nivel_autonomia")
      .order("score_promedio", { ascending: false })
      .then(({ data }) => setMetricas((data ?? []) as Metrica[]));
    supabase
      .from("audit_alertas")
      .select("id,tipo,mensaje,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setAlertas(data ?? []));
  }, [autorizado]);

  if (loading) return <div className="p-8 text-sm text-slate-500">Cargando…</div>;
  if (!autorizado)
    return (
      <div className="p-8 text-sm text-red-600">
        Acceso restringido a Dirección Financiera.
      </div>
    );

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Auditoría Financiera NUVEX</h1>
        <p className="text-sm text-slate-600">
          Dashboard de control de calidad y licencia de autonomía de analistas.
        </p>
      </header>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm w-fit">
        {(["pendientes", "ranking", "alertas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-4 py-1.5 capitalize ${tab === t ? "bg-white shadow font-semibold" : ""}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "pendientes" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Banco</th>
                <th className="px-3 py-2 text-left">Moneda</th>
                <th className="px-3 py-2 text-right">Score</th>
                <th className="px-3 py-2 text-left">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {sims.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    Sin simulaciones pendientes de revisión
                  </td>
                </tr>
              )}
              {sims.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{s.banco ?? "—"}</td>
                  <td className="px-3 py-2 uppercase">{s.moneda ?? "—"}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${s.score_total >= 95 ? "text-emerald-600" : s.score_total >= 85 ? "text-amber-600" : "text-red-600"}`}>
                    {s.score_total}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{s.motivo_escalamiento ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "ranking" && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left">Analista</th>
                <th className="px-3 py-2 text-left">Nivel</th>
                <th className="px-3 py-2 text-right">Sims</th>
                <th className="px-3 py-2 text-right">Score prom</th>
                <th className="px-3 py-2 text-right">Precisión</th>
                <th className="px-3 py-2 text-right">% Devoluciones</th>
                <th className="px-3 py-2 text-right">% Aprob banco</th>
              </tr>
            </thead>
            <tbody>
              {metricas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                    Sin métricas aún
                  </td>
                </tr>
              )}
              {metricas.map((m) => (
                <tr key={m.analista_id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{m.analista_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">
                    Nivel {m.nivel_autonomia} · {etiquetaNivel(m.nivel_autonomia as NivelAutonomia)}
                  </td>
                  <td className="px-3 py-2 text-right">{m.total_simulaciones}</td>
                  <td className="px-3 py-2 text-right">{Number(m.score_promedio).toFixed(1)}</td>
                  <td className="px-3 py-2 text-right">{Number(m.precision_historica).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{Number(m.porcentaje_devoluciones).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right">{Number(m.porcentaje_aprobacion_banco).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "alertas" && (
        <ul className="space-y-2">
          {alertas.length === 0 && (
            <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Sin alertas
            </li>
          )}
          {alertas.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold uppercase">{a.tipo}</span>
                <span>{new Date(a.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1">{a.mensaje}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
