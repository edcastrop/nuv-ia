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
      {/* HEADER · COMPACT */}
      <div style={{
        background: "linear-gradient(135deg, #0D1323 0%, #111A2E 60%, #0D1323 100%)",
        border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "10px 16px",
        marginBottom: 10, boxShadow: "0 12px 28px -20px rgba(91,140,255,0.35)",
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Brain size={16} color="#5B8CFF" />
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: -0.2, whiteSpace: "nowrap" }}>
            NUVIA Financial QA AI
          </h1>
          <span style={{ fontSize: 11, color: "#6B7693", whiteSpace: "nowrap" }}>· Command Center</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <HeaderButton onClick={() => setCopilotoOpen(true)} icon={<Sparkles size={12} />} label="Copiloto" />
          <Link to="/qa-ai/nuevo"><HeaderButton primary icon={<Plus size={12} />} label="Auditar" /></Link>
          <Link to="/qa-ai/aprobados"><HeaderButton tone="success" icon={<Trophy size={12} />} label="Aprobados" /></Link>
          <Link to="/qa-ai/alertas"><HeaderButton icon={<Bell size={12} />} label="Alertas" /></Link>
          <Link to="/qa-ai/config"><HeaderButton icon={<Settings size={12} />} label="Reglas" /></Link>
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

function HeaderButton({ icon, label, primary, tone, onClick }: { icon: React.ReactNode; label: string; primary?: boolean; tone?: "success"; onClick?: () => void }) {
  const isSuccess = tone === "success";
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer",
      background: primary ? "linear-gradient(135deg, #5B8CFF 0%, #7B61FF 100%)" : isSuccess ? "rgba(31,210,134,0.10)" : "rgba(255,255,255,0.04)",
      color: primary ? "#FFFFFF" : isSuccess ? "#1FD286" : "#A8B3CF",
      border: primary ? "1px solid rgba(91,140,255,0.5)" : isSuccess ? "1px solid rgba(31,210,134,0.35)" : "1px solid rgba(255,255,255,0.1)",
      boxShadow: primary ? "0 8px 24px -10px rgba(91,140,255,0.6)" : "none",
    }}>{icon} {label}</button>
  );
}
