import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";
import { generarAlertasFinanzas, marcarAlertaLeida } from "@/lib/finanzas.functions";

export const Route = createFileRoute("/_authenticated/finanzas/alertas")({
  component: AlertasPage,
  head: () => ({ meta: [{ title: "Alertas IA · Finanzas NUVEX" }] }),
});

type Alerta = {
  id: string;
  tipo: string;
  severidad: string;
  titulo: string;
  mensaje_ia: string | null;
  leida: boolean;
  created_at: string;
};

function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [tick, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const generar = useServerFn(generarAlertasFinanzas);
  const marcar = useServerFn(marcarAlertaLeida);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finanzas_alertas" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setAlertas((data ?? []) as unknown as Alerta[]);
    })();
  }, [tick]);

  async function correr() {
    setRunning(true); setMsg(null);
    try {
      const r = await generar({});
      setMsg(`Análisis completado. Nuevas alertas: ${r.creadas}.`);
      setTick((t) => t + 1);
    } catch (err) { setMsg(err instanceof Error ? err.message : "Error"); }
    finally { setRunning(false); }
  }

  async function resolver(id: string) {
    await marcar({ data: { id } });
    setTick((t) => t + 1);
  }

  const sevColor = (s: string) =>
    s === "alta" ? "#B42318" : s === "media" ? "#C97A00" : "#445DA3";

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-[#0A1226]">Alertas IA financiera</h1>
            <p className="text-[12px] text-[#242424]/60">Detección automática de cartera vencida, cuentas de cobro demoradas y otros eventos críticos.</p>
          </div>
          <button onClick={correr} disabled={running} className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60" style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}>
            {running ? "Analizando…" : "Ejecutar análisis IA"}
          </button>
        </div>
        {msg && <div className="mt-2 text-[12px] text-[#1F7A45]">{msg}</div>}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-[#0A1226] mb-2">Alertas activas ({alertas.filter((a) => !a.leida).length})</h2>
        {alertas.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[#242424]/60">Sin alertas. Ejecuta el análisis IA para detectar eventos.</div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => (
              <li key={a.id} className={`rounded-lg border p-3 ${a.leida ? "bg-[#FAFAFA] opacity-60" : "bg-white"}`} style={{ borderColor: a.leida ? "#E5E7EB" : sevColor(a.severidad) }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded" style={{ backgroundColor: sevColor(a.severidad) }}>{a.severidad}</span>
                      <span className="text-[10px] uppercase tracking-wider text-[#242424]/60">{a.tipo}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[#0A1226]">{a.titulo}</div>
                    {a.mensaje_ia && <div className="mt-1 text-[12.5px] text-[#242424]/80">{a.mensaje_ia}</div>}
                    <div className="mt-1 text-[10.5px] text-[#242424]/50">{new Date(a.created_at).toLocaleString("es-CO")}</div>
                  </div>
                  {!a.leida && (
                    <button onClick={() => resolver(a.id)} className="text-[11px] font-semibold text-[#445DA3] hover:underline whitespace-nowrap">
                      Marcar resuelta
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
