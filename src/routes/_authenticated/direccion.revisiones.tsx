// Bandeja "Dirección · Revisiones": casos en fase comercial que requieren
// intervención de Dirección según criterios de leadFases (QA<70, honorarios bajo piso,
// descuento alto, ahorro bajo, plazo excesivo, banco faltante).
//
// Esta vista NO reemplaza al Pipeline: lo complementa. Los casos siguen
// viviendo en sus etapas del Pipeline Maestro; aquí Dirección los ve agrupados.

import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert, Eye, ShieldCheck, AlertTriangle, RefreshCw, Loader2, Search } from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import { supabase } from "@/integrations/supabase/client";
import { motivosRevision, faseLead, type QALite } from "@/lib/leadFases";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";
import { AnalistaAvatar } from "@/components/pipeline/AnalistaAvatar";

export const Route = createFileRoute("/_authenticated/direccion/revisiones")({
  component: DireccionRevisionesPage,
  head: () => ({ meta: [{ title: "Revisiones de Dirección · NUVIA" }] }),
});

type ProfileLite = { id: string; nombre: string | null; email: string | null };

function DireccionRevisionesPage() {
  const [rows, setRows] = useState<Expediente[]>([]);
  const [qaMap, setQaMap] = useState<Map<string, NonNullable<QALite>>>(new Map());
  const [profiles, setProfiles] = useState<Map<string, ProfileLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const load = async () => {
    setRefreshing(true);
    try {
      const data = await listExpedientes();
      setRows(data ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // QA reciente
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
    if (ids.length === 0) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_auditorias")
        .select("id, expediente_id, qa_score, dictamen, created_at")
        .in("expediente_id", ids)
        .order("created_at", { ascending: false });
      if (cancel || !data) return;
      const next = new Map<string, NonNullable<QALite>>();
      for (const row of data as Array<{ id: string; expediente_id: string; qa_score: number | null; dictamen: string | null }>) {
        if (!row.expediente_id || next.has(row.expediente_id)) continue;
        next.set(row.expediente_id, { id: row.id, score: Number(row.qa_score ?? 0), dictamen: row.dictamen });
      }
      setQaMap(next);
    })();
    return () => { cancel = true; };
  }, [rows]);

  // Perfiles
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.asesor_id).filter(Boolean)));
    if (ids.length === 0) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre, email")
        .in("id", ids);
      if (cancel || !data) return;
      const next = new Map<string, ProfileLite>();
      for (const p of data as ProfileLite[]) next.set(p.id, p);
      setProfiles(next);
    })();
    return () => { cancel = true; };
  }, [rows]);

  type RevisionRow = { exp: Expediente; qa: NonNullable<QALite> | undefined; motivos: ReturnType<typeof motivosRevision> };
  const enRevision = useMemo<RevisionRow[]>(() => {
    const term = q.trim().toLowerCase();
    const out: RevisionRow[] = [];
    for (const r of rows) {
      const qa = qaMap.get(r.id);
      const fase = faseLead(r, qa);
      if (fase !== "en_revision") continue;
      const motivos = motivosRevision(r, qa);
      if (term) {
        const hay = `${r.cliente_nombre ?? ""} ${r.cedula ?? ""} ${r.banco ?? ""}`.toLowerCase();
        if (!hay.includes(term)) continue;
      }
      out.push({ exp: r, qa, motivos });
    }
    out.sort((a, b) => b.motivos.length - a.motivos.length);
    return out;
  }, [rows, qaMap, q]);

  const kpis = useMemo(() => {
    const total = enRevision.length;
    const qaBajo = enRevision.filter((x) => x.motivos.some((m) => m.code === "qa_bajo")).length;
    const honPiso = enRevision.filter((x) => x.motivos.some((m) => m.code === "honorarios_piso")).length;
    const descAlto = enRevision.filter((x) => x.motivos.some((m) => m.code === "descuento_alto")).length;
    const ahorroBajo = enRevision.filter((x) => x.motivos.some((m) => m.code === "ahorro_bajo")).length;
    return { total, qaBajo, honPiso, descAlto, ahorroBajo };
  }, [enRevision]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldAlert size={12} />, label: "Dirección · Revisiones", tone: "amber" }}
        title="Leads en revisión"
        description="Casos en fase comercial que requieren decisión de Dirección antes de avanzar."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 text-xs font-semibold text-[var(--nuvia-text-primary)] hover:border-[var(--nuvia-accent-blue)] disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refrescar
          </button>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="En revisión" value={String(kpis.total)} icon={<ShieldAlert size={14} />} tone="warning" />
        <KpiCard label="QA < 70" value={String(kpis.qaBajo)} icon={<AlertTriangle size={14} />} tone="danger" />
        <KpiCard label="Honorarios bajo piso" value={String(kpis.honPiso)} icon={<AlertTriangle size={14} />} tone="warning" />
        <KpiCard label="Descuento alto" value={String(kpis.descAlto)} icon={<AlertTriangle size={14} />} tone="warning" />
      </KpiGrid>

      <NCard variant="elevated">
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nuvia-text-secondary)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar cliente, cédula o banco…"
              className="nuvia-input nuvia-input-sm w-full pl-9"
            />
          </div>
          <span className="text-xs text-[var(--nuvia-text-secondary)]">{enRevision.length} caso(s)</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-[var(--nuvia-text-secondary)]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : enRevision.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-[var(--nuvia-accent-green)]" />
            <div className="text-base font-semibold text-[var(--nuvia-text-primary)]">Sin casos en revisión</div>
            <div className="mt-1 text-xs text-[var(--nuvia-text-secondary)]">
              Todos los leads activos cumplen los criterios financieros y de QA.
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "var(--nuvia-text-secondary)", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Cliente</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Banco</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Analista</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)" }}>Motivos</th>
                  <th style={{ padding: "6px 8px", color: "var(--nuvia-text-secondary)", textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {enRevision.map(({ exp, qa, motivos }) => {
                  const prof = profiles.get(exp.asesor_id);
                  return (
                    <tr key={exp.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                      <td style={{ padding: "10px 8px", color: "var(--nuvia-text-primary)" }}>
                        <div className="font-semibold">{exp.cliente_nombre || "Sin nombre"}</div>
                        <div className="text-[10px] text-[var(--nuvia-text-secondary)]">{exp.cedula || "s/cédula"}</div>
                      </td>
                      <td style={{ padding: "10px 8px", color: "var(--nuvia-text-secondary)" }}>{exp.banco || "—"}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <div className="flex items-center gap-1.5">
                          <AnalistaAvatar nombre={prof?.nombre} email={prof?.email} size={20} />
                          <span style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>
                            {prof?.nombre ?? prof?.email ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <div className="flex flex-wrap gap-1">
                          {motivos.map((m) => (
                            <span
                              key={m.code}
                              title={m.detalle}
                              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                background: "color-mix(in oklab, var(--nuvia-warning) 14%, transparent)",
                                color: "var(--nuvia-warning)",
                                border: "1px solid color-mix(in oklab, var(--nuvia-warning) 36%, transparent)",
                              }}
                            >
                              {m.label}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 8px", textAlign: "right" }}>
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to="/casos/$id"
                            params={{ id: exp.id }}
                            title="Abrir expediente"
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-semibold text-[var(--nuvia-text-primary)] hover:border-[var(--nuvia-accent-blue)]"
                          >
                            <Eye className="h-3 w-3" /> Expediente
                          </Link>
                          {qa && (
                            <Link
                              to="/qa-ai/$id"
                              params={{ id: qa.id }}
                              title={`QA ${Math.round(qa.score)}/100`}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-2 py-1 text-[10px] font-semibold text-[var(--nuvia-text-primary)] hover:border-[var(--nuvia-accent-blue)]"
                            >
                              <ShieldAlert className="h-3 w-3" /> QA {Math.round(qa.score)}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}
