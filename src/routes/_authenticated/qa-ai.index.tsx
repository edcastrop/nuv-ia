import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLayout, NCard } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { qaCommandCenter } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";
import { CommandCenter, type CCRow, type CCBank, type CCAnalista, type CCError, type CCTrend } from "@/components/qa-ai/command/CommandCenter";
import { Brain, Plus, Bell, Settings, Sparkles, Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/")({
  component: QaAiDashboard,
  head: () => ({ meta: [{ title: "NUVIA Financial QA AI · Command Center" }] }),
});

type CCData = {
  rows: CCRow[]; bancos: CCBank[]; analistas: CCAnalista[];
  topErrores: CCError[]; tendencia: CCTrend[]; prioridad: Record<string, number>;
};

function QaAiDashboard() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const fetchCC = useServerFn(qaCommandCenter);
  const [data, setData] = useState<CCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copilotoOpen, setCopilotoOpen] = useState(false);

  useEffect(() => {
    if (rolesLoading || !canValidarProyeccion) { setLoading(false); return; }
    (async () => {
      const d = await fetchCC({ data: { limit: 500, days: 30 } });
      setData(d as CCData);
      setLoading(false);
    })();
  }, [rolesLoading, canValidarProyeccion, fetchCC]);

  if (rolesLoading || loading) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando Command Center…</p></NCard></PageLayout>;
  }
  if (!canValidarProyeccion) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-danger)" }}>Acceso restringido al Director Financiero QA.</p></NCard></PageLayout>;
  }

  return (
    <PageLayout>
      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg, #0D1323 0%, #111A2E 60%, #0D1323 100%)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: "22px 24px",
        marginBottom: 16, boxShadow: "0 24px 60px -32px rgba(91,140,255,0.35)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 999, background: "rgba(91,140,255,0.12)", color: "#5B8CFF",
              border: "1px solid rgba(91,140,255,0.3)", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8,
              textTransform: "uppercase", marginBottom: 10,
            }}>
              <Brain size={12} /> Financial Intelligence OS
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: -0.4 }}>
              NUVIA Financial QA AI
            </h1>
            <p style={{ fontSize: 13, color: "#A8B3CF", margin: "6px 0 0", maxWidth: 720 }}>
              Centro de control de auditoría matemática, reconstrucción financiera y gestión de riesgo operativo.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <HeaderButton onClick={() => setCopilotoOpen(true)} icon={<Sparkles size={14} />} label="Copiloto QA" />
            <Link to="/qa-ai/nuevo"><HeaderButton primary icon={<Plus size={14} />} label="Auditar nuevo" /></Link>
            <Link to="/qa-ai/alertas"><HeaderButton icon={<Bell size={14} />} label="Alertas" /></Link>
            <Link to="/qa-ai/config"><HeaderButton icon={<Settings size={14} />} label="Reglas" /></Link>
          </div>
        </div>
      </div>

      {data && (
        <CommandCenter
          rows={data.rows} bancos={data.bancos} analistas={data.analistas}
          topErrores={data.topErrores} tendencia={data.tendencia} prioridad={data.prioridad}
        />
      )}

      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} />
    </PageLayout>
  );
}

function HeaderButton({ icon, label, primary, onClick }: { icon: React.ReactNode; label: string; primary?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer",
      background: primary ? "linear-gradient(135deg, #5B8CFF 0%, #7B61FF 100%)" : "rgba(255,255,255,0.04)",
      color: primary ? "#FFFFFF" : "#A8B3CF",
      border: primary ? "1px solid rgba(91,140,255,0.5)" : "1px solid rgba(255,255,255,0.1)",
      boxShadow: primary ? "0 8px 24px -10px rgba(91,140,255,0.6)" : "none",
    }}>{icon} {label}</button>
  );
}
