import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLayout, NCard } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { qaCommandCenter } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";
import { CommandCenter, type CCRow, type CCBank, type CCAnalista, type CCError, type CCTrend } from "@/components/qa-ai/command/CommandCenter";
import { Brain, Plus, Bell, Settings, Sparkles, Trophy, Search } from "lucide-react";

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
  const [globalQ, setGlobalQ] = useState("");

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
      {/* Ambient background wash */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
        background:
          "radial-gradient(1200px 700px at 15% -10%, rgba(91,140,255,0.10), transparent 60%)," +
          "radial-gradient(900px 600px at 95% 10%, rgba(123,97,255,0.09), transparent 60%)," +
          "radial-gradient(800px 500px at 60% 100%, rgba(31,210,134,0.06), transparent 60%)," +
          "linear-gradient(180deg, #050816 0%, #04060F 100%)",
      }} />

      {/* EXECUTIVE HEADER · 78px sticky */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        height: 78, marginBottom: 16,
        background: "rgba(8,17,31,0.72)",
        backdropFilter: "blur(20px) saturate(140%)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 22,
        padding: "0 20px",
        display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 20,
        boxShadow: "0 0 40px rgba(34,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}>
        {/* Left · Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: "linear-gradient(135deg, rgba(91,140,255,0.25), rgba(123,97,255,0.20))",
            border: "1px solid rgba(91,140,255,0.35)",
            display: "grid", placeItems: "center",
            boxShadow: "0 0 24px rgba(91,140,255,0.25)",
          }}>
            <Brain size={20} color="#8FB4FF" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F5F7FF", letterSpacing: 0.08, lineHeight: 1.1, whiteSpace: "nowrap" }}>
              NUVIA Financial QA AI
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 500, color: "#6B7693", letterSpacing: 1.6, textTransform: "uppercase", marginTop: 2 }}>
              Command Center
            </div>
          </div>
        </div>

        {/* Center · Global search */}
        <div style={{
          position: "relative", maxWidth: 560, width: "100%", justifySelf: "center",
        }}>
          <Search size={14} color="#6B7693" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={globalQ}
            onChange={(e) => setGlobalQ(e.target.value)}
            placeholder="Buscar cliente, analista, banco, código…   ⌘K"
            style={{
              width: "100%", height: 40, borderRadius: 12,
              background: "rgba(5,8,22,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#F5F7FF", fontSize: 12.5, fontWeight: 500,
              padding: "0 14px 0 38px", outline: "none",
              transition: "border-color .22s, box-shadow .22s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(91,140,255,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91,140,255,0.14)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {/* Right · Actions */}
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <HeaderBtn onClick={() => setCopilotoOpen(true)} icon={<Sparkles size={13} />} label="Copiloto" />
          <Link to="/qa-ai/nuevo"><HeaderBtn primary icon={<Plus size={13} />} label="Auditar" /></Link>
          <Link to="/qa-ai/aprobados"><HeaderBtn tone="success" icon={<Trophy size={13} />} label="Aprobados" /></Link>
          <Link to="/qa-ai/alertas"><HeaderBtn icon={<Bell size={13} />} label="Alertas" /></Link>
          <Link to="/qa-ai/config"><HeaderBtn icon={<Settings size={13} />} label="Rules" /></Link>
        </div>
      </div>

      {data && (
        <CommandCenter
          rows={data.rows} bancos={data.bancos} analistas={data.analistas}
          topErrores={data.topErrores} tendencia={data.tendencia} prioridad={data.prioridad}
          globalQ={globalQ}
        />
      )}

      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} />
    </PageLayout>
  );
}

function HeaderBtn({ icon, label, primary, tone, onClick }: { icon: React.ReactNode; label: string; primary?: boolean; tone?: "success"; onClick?: () => void }) {
  const isSuccess = tone === "success";
  const bg = primary
    ? "linear-gradient(135deg, #5B8CFF 0%, #7B61FF 100%)"
    : isSuccess ? "rgba(31,210,134,0.10)" : "rgba(255,255,255,0.04)";
  const color = primary ? "#FFFFFF" : isSuccess ? "#1FD286" : "#B6C1DC";
  const border = primary
    ? "1px solid rgba(140,170,255,0.55)"
    : isSuccess ? "1px solid rgba(31,210,134,0.30)" : "1px solid rgba(255,255,255,0.08)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 36, padding: "0 14px", borderRadius: 10,
        fontSize: 12, fontWeight: 600, letterSpacing: 0.04, cursor: "pointer",
        background: bg, color, border,
        boxShadow: primary ? "0 8px 22px -12px rgba(91,140,255,0.7)" : "none",
        transition: "transform .22s ease, box-shadow .22s ease, background .22s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {icon} {label}
    </button>
  );
}
