import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
} from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { generarAlertasFinanzas, marcarAlertaLeida } from "@/lib/finanzas.functions";
import { BellRing, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/alertas")({
  component: AlertasPage,
  head: () => ({ meta: [{ title: "Alertas IA · Finanzas NUVIA" }] }),
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

const sevToken = (s: string) => {
  if (s === "alta") return { color: "var(--nuvia-danger)", bg: "rgba(180,35,24,0.14)", border: "rgba(180,35,24,0.45)" };
  if (s === "media") return { color: "var(--nuvia-warning)", bg: "rgba(201,122,0,0.14)", border: "rgba(201,122,0,0.45)" };
  return { color: "var(--nuvia-accent-blue)", bg: "rgba(68,93,163,0.14)", border: "rgba(68,93,163,0.45)" };
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
    setRunning(true);
    setMsg(null);
    try {
      const r = await generar({});
      setMsg(`Análisis completado. Nuevas alertas: ${r.creadas}.`);
      setTick((t) => t + 1);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  async function resolver(id: string) {
    await marcar({ data: { id } });
    setTick((t) => t + 1);
  }

  const activas = alertas.filter((a) => !a.leida);
  const altas = activas.filter((a) => a.severidad === "alta").length;
  const medias = activas.filter((a) => a.severidad === "media").length;
  const resueltas = alertas.filter((a) => a.leida).length;

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <BellRing size={12} />, label: "Finanzas IA", tone: "blue" }}
        title="Alertas IA financiera"
        description="Detección automática de cartera vencida, cuentas de cobro demoradas y otros eventos críticos."
        actions={
          <button
            onClick={correr}
            disabled={running}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
          >
            <Sparkles size={14} />
            {running ? "Analizando…" : "Ejecutar análisis IA"}
          </button>
        }
      />

      {msg && (
        <NCard padding="md">
          <div className="text-[12px]" style={{ color: "var(--nuvia-success)" }}>{msg}</div>
        </NCard>
      )}

      <KpiGrid cols={4}>
        <KpiCard icon={<BellRing size={16} />} tone="blue" label="Activas" value={String(activas.length)} />
        <KpiCard icon={<AlertTriangle size={16} />} tone={altas > 0 ? "danger" : "neutral"} label="Severidad alta" value={String(altas)} />
        <KpiCard icon={<AlertTriangle size={16} />} tone={medias > 0 ? "warning" : "neutral"} label="Severidad media" value={String(medias)} />
        <KpiCard icon={<CheckCircle2 size={16} />} tone="green" label="Resueltas" value={String(resueltas)} />
      </KpiGrid>

      <NCard padding="md">
        <SectionHeader title={`Alertas activas (${activas.length})`} description="Histórico últimas 100" />
        {alertas.length === 0 ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            Sin alertas. Ejecuta el análisis IA para detectar eventos.
          </div>
        ) : (
          <ul className="space-y-2">
            {alertas.map((a) => {
              const t = sevToken(a.severidad);
              return (
                <li
                  key={a.id}
                  className="rounded-lg p-3"
                  style={{
                    background: a.leida ? "rgba(255,255,255,0.02)" : t.bg,
                    border: `1px solid ${a.leida ? "var(--nuvia-border)" : t.border}`,
                    opacity: a.leida ? 0.65 : 1,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                          style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}
                        >
                          {a.severidad}
                        </span>
                        <span
                          className="text-[10px] uppercase tracking-wider"
                          style={{ color: "var(--nuvia-text-muted)" }}
                        >
                          {a.tipo}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                        {a.titulo}
                      </div>
                      {a.mensaje_ia && (
                        <div className="mt-1 text-[12.5px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                          {a.mensaje_ia}
                        </div>
                      )}
                      <div className="mt-1 text-[10.5px]" style={{ color: "var(--nuvia-text-muted)" }}>
                        {new Date(a.created_at).toLocaleString("es-CO")}
                      </div>
                    </div>
                    {!a.leida && (
                      <button
                        onClick={() => resolver(a.id)}
                        className="text-[11px] font-semibold hover:underline whitespace-nowrap"
                        style={{ color: "var(--nuvia-accent-blue)" }}
                      >
                        Marcar resuelta
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </NCard>
    </PageLayout>
  );
}
