import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLayout, NCard } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { qaCommandCenter } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import {
  CommandCenter,
  type CCRow,
  type CCBank,
  type CCAnalista,
  type CCError,
  type CCTrend,
} from "@/components/qa-ai/command/CommandCenter";
import { QASLABanner } from "@/components/qa-ai/QASLABanner";
import { Brain, Search, Trophy, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/mis")({
  component: MisAuditoriasPage,
  head: () => ({ meta: [{ title: "Mis auditorías · NUVIA Financial QA AI" }] }),
});

type CCData = {
  rows: CCRow[];
  bancos: CCBank[];
  analistas: CCAnalista[];
  topErrores: CCError[];
  tendencia: CCTrend[];
  prioridad: Record<string, number>;
};

const REFRESH_MS = 20_000;

function MisAuditoriasPage() {
  const { loading: rolesLoading } = useUserRole();
  const fetchCC = useServerFn(qaCommandCenter);
  const [data, setData] = useState<CCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalQ, setGlobalQ] = useState("");

  useEffect(() => {
    if (rolesLoading) return;
    let cancelled = false;
    let timer: number | null = null;
    const load = async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const d = await fetchCC({
          data: { limit: 500, days: 30, mineOnly: true, refreshKey: Date.now() },
        });
        if (cancelled) return;
        setData(d as CCData);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load(false);
    timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [rolesLoading, fetchCC]);

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <NCard>
          <p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Cargando mis auditorías…
          </p>
        </NCard>
      </PageLayout>
    );
  }

  const totalMias = data?.rows.length ?? 0;

  return (
    <PageLayout>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          pointerEvents: "none",
          background:
            "radial-gradient(1200px 700px at 15% -10%, rgba(91,140,255,0.10), transparent 60%)," +
            "radial-gradient(900px 600px at 95% 10%, rgba(123,97,255,0.09), transparent 60%)," +
            "radial-gradient(800px 500px at 60% 100%, rgba(31,210,134,0.06), transparent 60%)," +
            "linear-gradient(180deg, #050816 0%, #04060F 100%)",
        }}
      />

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          height: 78,
          marginBottom: 16,
          background: "rgba(8,17,31,0.72)",
          backdropFilter: "blur(20px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 22,
          padding: "0 20px",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto",
          alignItems: "center",
          gap: 20,
          boxShadow:
            "0 0 40px rgba(34,91,255,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              flexShrink: 0,
              background:
                "linear-gradient(135deg, rgba(91,140,255,0.25), rgba(123,97,255,0.20))",
              border: "1px solid rgba(91,140,255,0.35)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 0 24px rgba(91,140,255,0.25)",
            }}
          >
            <Brain size={20} color="#8FB4FF" strokeWidth={2.2} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#F5F7FF",
                letterSpacing: 0.08,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
              }}
            >
              Mis auditorías
            </div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: "#6B7693",
                letterSpacing: 1.6,
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              NUVIA Financial QA AI · {totalMias} caso{totalMias === 1 ? "" : "s"}
            </div>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 560, width: "100%", justifySelf: "center" }}>
          <Search
            size={14}
            color="#6B7693"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            value={globalQ}
            onChange={(e) => setGlobalQ(e.target.value)}
            placeholder="Buscar cliente, banco, código, producto…"
            style={{
              width: "100%",
              height: 40,
              borderRadius: 12,
              background: "rgba(5,8,22,0.6)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#F5F7FF",
              fontSize: 12.5,
              fontWeight: 500,
              padding: "0 14px 0 38px",
              outline: "none",
              transition: "border-color .22s, box-shadow .22s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "rgba(91,140,255,0.45)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(91,140,255,0.14)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <Link to="/qa-ai/aprobados">
            <HeaderBtn tone="success" icon={<Trophy size={13} />} label="Aprobados" />
          </Link>
          <Link to="/qa-ai/alertas">
            <HeaderBtn icon={<Bell size={13} />} label="Alertas" />
          </Link>
        </div>
      </div>

      <QASLABanner />

      {data && (
        <CommandCenter
          rows={data.rows}
          bancos={data.bancos}
          analistas={data.analistas}
          topErrores={data.topErrores}
          tendencia={data.tendencia}
          prioridad={data.prioridad}
          globalQ={globalQ}
          showCreateCaseCTA
        />
      )}

      {data && data.rows.length === 0 && (
        <NCard>
          <div style={{ padding: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#F5F7FF", marginBottom: 6 }}>
              Aún no tienes auditorías registradas
            </div>
            <div style={{ fontSize: 12, color: "#6B7693" }}>
              Cuando envíes una simulación a NUVIA Financial QA AI, aparecerá aquí con su score,
              dictamen y estado.
            </div>
          </div>
        </NCard>
      )}
    </PageLayout>
  );
}

function HeaderBtn({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "success";
  onClick?: () => void;
}) {
  const isSuccess = tone === "success";
  const bg = isSuccess ? "rgba(31,210,134,0.10)" : "rgba(255,255,255,0.04)";
  const color = isSuccess ? "#1FD286" : "#B6C1DC";
  const border = isSuccess
    ? "1px solid rgba(31,210,134,0.30)"
    : "1px solid rgba(255,255,255,0.08)";
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 36,
        padding: "0 14px",
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.04,
        cursor: "pointer",
        background: bg,
        color,
        border,
        transition: "transform .22s ease, background .22s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {icon} {label}
    </button>
  );
}
