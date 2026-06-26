import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageLayout, NCard } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { listAuditoriasAprobadas } from "@/lib/qaAI.functions";
import {
  Trophy, ArrowLeft, Eye, Calendar, Hash, User, Building2, Gauge,
  CheckCircle2, AlertCircle, FileText,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/aprobados")({
  component: CasosAprobadosPage,
  head: () => ({ meta: [{ title: "Casos Aprobados · NUVIA QA" }] }),
});

const C = {
  bg: "#060B17", surface: "#0D1323", surface2: "#111A2E",
  border: "rgba(255,255,255,0.08)", text: "#FFFFFF", textSec: "#A8B3CF",
  primary: "#5B8CFF", success: "#1FD286", warning: "#FFB547",
};

type Row = {
  id: string; expediente_id: string | null; analista_id: string | null;
  extracto_id: string | null; modalidad: string; qa_score: number | null;
  categoria: string | null; dictamen: string | null; ejecutado_at: string | null;
  cliente_nombre: string | null; banco: string | null; analista_nombre: string | null;
  tiene_extracto: boolean; extracto_path: string | null;
};

function CasosAprobadosPage() {
  const fetchAprobados = useServerFn(listAuditoriasAprobadas);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await fetchAprobados({ data: { limit: 500 } });
        setRows((d as { rows: Row[] }).rows);
      } catch (e: any) {
        setErr(e?.message ?? "Error cargando casos aprobados");
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchAprobados]);

  const total = rows.length;
  const avgScore = total
    ? (rows.reduce((s, r) => s + (r.qa_score ?? 0), 0) / total).toFixed(1)
    : "0";

  return (
    <PageLayout>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0D1323 0%, #111A2E 60%, #0D1323 100%)",
        border: `1px solid ${C.border}`, borderRadius: 18, padding: "22px 24px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
              borderRadius: 999, background: "rgba(31,210,134,0.12)", color: C.success,
              border: "1px solid rgba(31,210,134,0.3)", fontSize: 10.5, fontWeight: 600, letterSpacing: 0.8,
              textTransform: "uppercase", marginBottom: 10,
            }}>
              <Trophy size={12} /> Aprobados por NUVIA
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, margin: 0, letterSpacing: -0.4 }}>
              Casos certificados
            </h1>
            <p style={{ fontSize: 13, color: C.textSec, margin: "6px 0 0", maxWidth: 720 }}>
              Expedientes que superaron la auditoría matemática de NUVIA con dictamen aprobado u observado.
            </p>
          </div>
          <Link to="/qa-ai">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 500, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", color: C.textSec,
              border: `1px solid ${C.border}`,
            }}>
              <ArrowLeft size={14} /> Volver al Command Center
            </button>
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <KpiBadge icon={<CheckCircle2 size={16} />} value={String(total)} label="Total aprobados" tone="success" />
        <KpiBadge icon={<Gauge size={16} />} value={avgScore} label="Score promedio" tone="primary" />
      </div>

      {err && (
        <NCard>
          <div style={{ color: "#FF5D73", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} /> {err}
          </div>
        </NCard>
      )}

      {loading ? (
        <NCard><p style={{ color: C.textSec, fontSize: 13 }}>Cargando casos aprobados…</p></NCard>
      ) : rows.length === 0 ? (
        <NCard>
          <div style={{ textAlign: "center", padding: "40px 0", color: C.textSec, fontSize: 13 }}>
            <FileText size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p>No hay casos aprobados por NUVIA en este momento.</p>
          </div>
        </NCard>
      ) : (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden",
        }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.surface2 }}>
                  <Th>Cliente</Th>
                  <Th>Banco</Th>
                  <Th>Analista</Th>
                  <Th>Modalidad</Th>
                  <Th style={{ textAlign: "center" }}>Score</Th>
                  <Th>Dictamen</Th>
                  <Th style={{ textAlign: "right" }}>Fecha</Th>
                  <Th style={{ textAlign: "center" }}>Acción</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 999,
                          background: "linear-gradient(135deg, #5B8CFF, #7B61FF)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#fff",
                        }}>
                          {(r.cliente_nombre ?? "?").charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: C.text, fontWeight: 500 }}>{r.cliente_nombre ?? "—"}</span>
                      </div>
                    </Td>
                    <Td><span style={{ color: C.textSec }}>{r.banco ?? "—"}</span></Td>
                    <Td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <User size={12} style={{ color: C.primary }} />
                        <span style={{ color: C.text }}>{r.analista_nombre ?? "—"}</span>
                      </div>
                    </Td>
                    <Td><span style={{ color: C.textSec, textTransform: "uppercase" }}>{r.modalidad}</span></Td>
                    <Td style={{ textAlign: "center" }}>
                      <span style={{
                        fontWeight: 700, color: (r.qa_score ?? 0) >= 95 ? C.success : (r.qa_score ?? 0) >= 85 ? C.warning : "#FF5D73",
                      }}>
                        {r.qa_score ?? 0}
                      </span>
                    </Td>
                    <Td><DictamenBadge dictamen={r.dictamen} /></Td>
                    <Td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <Calendar size={12} style={{ color: C.textSec }} />
                        <span style={{ color: C.textSec }}>{(r.ejecutado_at ?? "").slice(0, 10)}</span>
                      </div>
                    </Td>
                    <Td style={{ textAlign: "center" }}>
                      <Link to={`/qa-ai/$id`} params={{ id: r.id }}>
                        <button style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          background: "rgba(91,140,255,0.12)", color: C.primary,
                          border: "1px solid rgba(91,140,255,0.3)",
                        }}>
                          <Eye size={12} /> Ver
                        </button>
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: "12px 16px", textAlign: "left", fontSize: 10.5, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: 0.6, color: "#6B7693",
      borderBottom: "1px solid rgba(255,255,255,0.08)", whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </th>
  );
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ padding: "10px 16px", whiteSpace: "nowrap", ...style }}>
      {children}
    </td>
  );
}

function KpiBadge({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: "success" | "primary" }) {
  const color = tone === "success" ? C.success : C.primary;
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: "16px 18px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
        background: tone === "success" ? "rgba(31,210,134,0.12)" : "rgba(91,140,255,0.12)", color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function DictamenBadge({ dictamen }: { dictamen: string | null }) {
  if (dictamen === "aprobado") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
        background: "rgba(31,210,134,0.12)", color: "#1FD286", border: "1px solid rgba(31,210,134,0.3)",
      }}>
        <CheckCircle2 size={10} /> Aprobado
      </span>
    );
  }
  if (dictamen === "aprobado_obs") {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
        background: "rgba(255,181,71,0.12)", color: "#FFB547", border: "1px solid rgba(255,181,71,0.3)",
      }}>
        <AlertCircle size={10} /> Observado
      </span>
    );
  }
  return <span style={{ color: C.textSec }}>{dictamen ?? "—"}</span>;
}
