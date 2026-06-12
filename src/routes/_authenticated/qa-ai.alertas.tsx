import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageLayout, ExecutiveHero, NCard, SectionHeader, NSelect, KpiGrid, KpiCard, EmptyState } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { listAlertasQA, actualizarAlertaQA } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { AlertTriangle, Bell, CheckCircle2, Inbox, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";

export const Route = createFileRoute("/_authenticated/qa-ai/alertas")({
  component: AlertasQA,
  head: () => ({ meta: [{ title: "Alertas QA · NUVIA QA AI" }] }),
});

type Alerta = Awaited<ReturnType<typeof listAlertasQA>>["rows"][number];

const SEV_COLOR: Record<string, string> = {
  critica: "var(--nuvia-danger)",
  warning: "var(--nuvia-warning)",
  info: "var(--nuvia-accent)",
};
const EST_COLOR: Record<string, string> = {
  abierta: "var(--nuvia-danger)",
  reconocida: "var(--nuvia-warning)",
  resuelta: "var(--nuvia-success)",
};

function AlertasQA() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const list = useServerFn(listAlertasQA);
  const update = useServerFn(actualizarAlertaQA);

  const [rows, setRows] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [severidad, setSeveridad] = useState<string>("");
  const [estado, setEstado] = useState<string>("");
  const [banco, setBanco] = useState<string>("");
  const [analistaId, setAnalistaId] = useState<string>("");
  const [dlg, setDlg] = useState<{ alerta: Alerta; accion: "reconocer" | "resolver" } | null>(null);
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [copilotoOpen, setCopilotoOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const payload: Record<string, string> = {};
    if (severidad) payload.severidad = severidad;
    if (estado) payload.estado = estado;
    if (banco) payload.banco = banco;
    if (analistaId) payload.analistaId = analistaId;
    try {
      const r = await list({ data: payload as never });
      setRows(r.rows);
    } catch { /* ignore */ }
    setLoading(false);
  }, [list, severidad, estado, banco, analistaId]);

  useEffect(() => { if (!rolesLoading) fetchRows(); }, [rolesLoading, fetchRows]);

  if (rolesLoading) return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</p></NCard></PageLayout>;

  const abiertas = rows.filter((r) => r.estado === "abierta").length;
  const reconocidas = rows.filter((r) => r.estado === "reconocida").length;
  const criticas = rows.filter((r) => r.severidad === "critica" && r.estado !== "resuelta").length;

  const bancos = Array.from(new Set(rows.map((r) => r.banco).filter(Boolean))) as string[];
  const analistas = Array.from(new Set(rows.map((r) => r.analistaId).filter(Boolean))) as string[];

  const ejecutarAccion = async () => {
    if (!dlg) return;
    setBusy(true);
    try {
      await update({ data: { id: dlg.alerta.id, accion: dlg.accion, notas: notas || undefined } });
      setDlg(null); setNotas("");
      await fetchRows();
    } catch { /* ignore */ }
    setBusy(false);
  };

  const sevOpts = [{ value: "", label: "Todas las severidades" }, { value: "critica", label: "Crítica" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }];
  const estOpts = [{ value: "", label: "Todos los estados" }, { value: "abierta", label: "Abiertas" }, { value: "reconocida", label: "Reconocidas" }, { value: "resuelta", label: "Resueltas" }];
  const bancoOpts = [{ value: "", label: "Todos los bancos" }, ...bancos.map((b) => ({ value: b, label: b }))];
  const analistaOpts = [{ value: "", label: "Todos los analistas" }, ...analistas.map((a) => ({ value: a, label: a.slice(0, 8) }))];

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Bell size={12} />, label: "QA AI · Alertas", tone: "danger" }}
        title="Panel de Alertas QA"
        description="Inconsistencias críticas detectadas por el motor matemático. Reconoce y resuelve cada alerta antes de avanzar el caso."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setCopilotoOpen(true)}
              className="nuvia-input nuvia-input-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              <Sparkles size={14} /> Copiloto QA
            </button>
            <Link to="/qa-ai">
              <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
                <ShieldCheck size={14} /> Volver al dashboard
              </button>
            </Link>
          </div>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Críticas activas" value={criticas} icon={<AlertTriangle size={14} />} tone="danger" />
        <KpiCard label="Abiertas" value={abiertas} icon={<Bell size={14} />} tone="warning" />
        <KpiCard label="Reconocidas" value={reconocidas} icon={<CheckCircle2 size={14} />} tone="blue" />
        <KpiCard label="Total cargadas" value={rows.length} icon={<Inbox size={14} />} tone="blue" />
      </KpiGrid>

      <NCard padding="lg">
        <SectionHeader title="Filtros" description="Refina por severidad, estado, banco o analista." />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
          <NSelect value={severidad} onValueChange={setSeveridad} options={sevOpts} />
          <NSelect value={estado} onValueChange={setEstado} options={estOpts} />
          <NSelect value={banco} onValueChange={setBanco} options={bancoOpts} />
          <NSelect value={analistaId} onValueChange={setAnalistaId} options={analistaOpts} />
        </div>
      </NCard>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader title={`Alertas (${rows.length})`} description={loading ? "Cargando…" : "Click en una fila para ver el dictamen completo."} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<CheckCircle2 size={28} />} title="Sin alertas" description="No hay alertas que coincidan con los filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Fecha", "Sev", "Tipo", "Banco", "Expediente", "Mensaje", "Score", "Estado", "Acciones"].map((h) => (
                    <th key={h} className="text-left px-3 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{new Date(a.createdAt).toLocaleDateString("es-CO")}</td>
                    <td className="px-3 py-2 font-semibold uppercase" style={{ color: SEV_COLOR[a.severidad] ?? "var(--nuvia-text-primary)" }}>{a.severidad}</td>
                    <td className="px-3 py-2" style={{ color: "var(--nuvia-text-primary)" }}>{a.tipo}</td>
                    <td className="px-3 py-2" style={{ color: "var(--nuvia-text-secondary)" }}>{a.banco ?? "—"}</td>
                    <td className="px-3 py-2" style={{ color: "var(--nuvia-text-primary)" }}>{a.codigo ?? (a.expedienteId ? a.expedienteId.slice(0, 8) : "—")}</td>
                    <td className="px-3 py-2 max-w-md truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{a.mensaje}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{a.score !== null ? Number(a.score).toFixed(1) : "—"}</td>
                    <td className="px-3 py-2 font-medium uppercase text-[11px]" style={{ color: EST_COLOR[a.estado] ?? "var(--nuvia-text-primary)" }}>{a.estado}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {a.estado === "abierta" && (
                          <button
                            disabled={!canValidarProyeccion}
                            onClick={() => { setDlg({ alerta: a, accion: "reconocer" }); setNotas(""); }}
                            className="text-[11px] px-2 py-1 rounded"
                            style={{ background: "var(--nuvia-accent)", color: "#fff", opacity: canValidarProyeccion ? 1 : 0.4, cursor: canValidarProyeccion ? "pointer" : "not-allowed" }}
                          >Reconocer</button>
                        )}
                        {a.estado !== "resuelta" && (
                          <button
                            disabled={!canValidarProyeccion}
                            onClick={() => { setDlg({ alerta: a, accion: "resolver" }); setNotas(""); }}
                            className="text-[11px] px-2 py-1 rounded"
                            style={{ background: "var(--nuvia-success)", color: "#fff", opacity: canValidarProyeccion ? 1 : 0.4, cursor: canValidarProyeccion ? "pointer" : "not-allowed" }}
                          >Resolver</button>
                        )}
                        {a.auditoriaId && (
                          <Link to="/qa-ai/$id" params={{ id: a.auditoriaId }} className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--nuvia-accent)" }}>
                            Dictamen <ArrowRight size={10} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      <Dialog open={!!dlg} onOpenChange={(o) => { if (!o) { setDlg(null); setNotas(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg?.accion === "reconocer" ? "Reconocer alerta" : "Resolver alerta"}</DialogTitle>
          </DialogHeader>
          {dlg && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Tipo:</span> {dlg.alerta.tipo} · <span className="font-semibold">Severidad:</span> {dlg.alerta.severidad}</p>
              <p className="text-muted-foreground">{dlg.alerta.mensaje}</p>
              <div>
                <label className="text-xs font-medium">Notas {dlg.accion === "resolver" && "(recomendado)"}</label>
                <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Describe la acción tomada o la justificación…" rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => { setDlg(null); setNotas(""); }} className="text-xs px-3 py-2 rounded border">Cancelar</button>
            <button onClick={ejecutarAccion} disabled={busy} className="text-xs px-3 py-2 rounded text-white" style={{ background: dlg?.accion === "resolver" ? "var(--nuvia-success)" : "var(--nuvia-accent)" }}>
              {busy ? "Guardando…" : "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} />
    </PageLayout>
  );
}
