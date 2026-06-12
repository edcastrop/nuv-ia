import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  PageLayout, ExecutiveHero, KpiGrid, KpiCard,
  NCard, SectionHeader, EmptyState,
} from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { qaKpis, listAuditoriasQA } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";
import {
  Brain, ShieldCheck, CheckCircle2, AlertTriangle, XCircle,
  Gauge, Inbox, ArrowRight, Plus, Bell, Settings, Activity, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/")({
  component: QaAiDashboard,
  head: () => ({ meta: [{ title: "NUVIA Financial QA AI · Auditor matemático" }] }),
});

type Row = {
  id: string; expediente_id: string | null; analista_id: string | null;
  modalidad: string; qa_score: number; categoria: string; dictamen: string; ejecutado_at: string;
};

function QaAiDashboard() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const fetchKpis = useServerFn(qaKpis);
  const fetchList = useServerFn(listAuditoriasQA);
  const [kpis, setKpis] = useState<{ total: number; aprobados: number; obs: number; rechazados: number; pendientesRevision: number; promedio: number; alertasAbiertas: number; alertasCriticasAbiertas: number; topTipo: string | null; topCount: number } | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [copilotoOpen, setCopilotoOpen] = useState(false);

  useEffect(() => {
    if (rolesLoading || !canValidarProyeccion) { setLoading(false); return; }
    (async () => {
      const [k, l] = await Promise.all([fetchKpis(), fetchList({ data: { limit: 50 } })]);
      setKpis(k); setRows(l.rows as Row[]); setLoading(false);
    })();
  }, [rolesLoading, canValidarProyeccion, fetchKpis, fetchList]);

  if (rolesLoading || loading) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</p></NCard></PageLayout>;
  }
  if (!canValidarProyeccion) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-danger)" }}>Acceso restringido al Director Financiero QA.</p></NCard></PageLayout>;
  }

  const scoreTone = (s: number) => s >= 95 ? "var(--nuvia-success)" : s >= 85 ? "var(--nuvia-warning)" : "var(--nuvia-danger)";
  const dictamenLabel: Record<string, string> = {
    aprobado: "APROBADO", aprobado_obs: "APROBADO C/OBS", requiere_revision: "REVISAR", rechazado: "RECHAZADO",
  };

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: "QA AI · Beta", tone: "blue" }}
        title="NUVIA Financial QA AI"
        description="Auditor matemático autónomo: reconstruye cada simulación desde cero, la contrasta con el extracto bancario y emite dictamen automático."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link to="/qa-ai/nuevo">
              <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer", background: "var(--nuvia-accent)", color: "#fff", border: "none" }}>
                <Plus size={14} /> Auditar nuevo
              </button>
            </Link>
            <Link to="/qa-ai/alertas">
              <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
                <Bell size={14} /> Ver alertas
              </button>
            </Link>
            {canValidarProyeccion && (
              <Link to="/qa-ai/config">
                <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
                  <Settings size={14} /> Configurar reglas
                </button>
              </Link>
            )}
          </div>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Casos auditados" value={kpis?.total ?? 0} icon={<ShieldCheck size={14} />} tone="blue" />
        <KpiCard label="Aprobados" value={kpis?.aprobados ?? 0} icon={<CheckCircle2 size={14} />} tone="green" />
        <KpiCard label="Con observaciones" value={kpis?.obs ?? 0} icon={<AlertTriangle size={14} />} tone="warning" />
        <KpiCard label="Rechazados" value={kpis?.rechazados ?? 0} icon={<XCircle size={14} />} tone="danger" />
      </KpiGrid>
      <KpiGrid cols={4}>
        <KpiCard label="QA Score promedio" value={`${(kpis?.promedio ?? 0).toFixed(1)} / 100`} icon={<Gauge size={14} />} tone="blue" />
        <KpiCard label="Alertas críticas abiertas" value={kpis?.alertasCriticasAbiertas ?? 0} icon={<AlertTriangle size={14} />} tone="danger" />
        <KpiCard label="Pendientes revisión" value={kpis?.pendientesRevision ?? 0} icon={<Activity size={14} />} tone="warning" />
        <KpiCard label="Inconsistencia top" value={kpis?.topTipo ? `${kpis.topTipo} (${kpis.topCount})` : "—"} icon={<Inbox size={14} />} tone="blue" />
      </KpiGrid>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader title={`Auditorías recientes (${rows.length})`} description="Últimas 50 ejecuciones del motor matemático." />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<Inbox size={28} />} title="Sin auditorías" description="Ejecuta tu primera auditoría matemática." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Fecha", "Modalidad", "Score", "Dictamen", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-4 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{new Date(r.ejecutado_at).toLocaleString("es-CO")}</td>
                    <td className="px-4 py-2 capitalize" style={{ color: "var(--nuvia-text-primary)" }}>{r.modalidad}</td>
                    <td className="px-4 py-2 tabular-nums font-semibold" style={{ color: scoreTone(Number(r.qa_score)) }}>{Number(r.qa_score).toFixed(1)}</td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-primary)" }}>{dictamenLabel[r.dictamen] ?? r.dictamen}</td>
                    <td className="px-4 py-2 text-right">
                      <Link to="/qa-ai/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--nuvia-accent)" }}>
                        Ver <ArrowRight size={12} />
                      </Link>
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
