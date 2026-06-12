import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { PageLayout, ExecutiveHero, NCard, SectionHeader } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { listReglasQA, actualizarReglaQA, listHistorialReglaQA } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import { Settings, Save, History, ShieldCheck, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/config")({
  component: ConfigReglasQA,
  head: () => ({ meta: [{ title: "Configuración QA · Reglas y tolerancias" }] }),
});

type Regla = {
  id: string; codigo: string; descripcion: string; tipo: "tolerancia" | "umbral" | "penalizacion";
  payload: Record<string, unknown>; activa: boolean; version: number;
  updated_by: string | null; updated_at: string;
};

const TIPO_LABEL: Record<string, { title: string; desc: string }> = {
  tolerancia: { title: "Tolerancias", desc: "Umbrales de diferencia tolerados entre extracto y reconstrucción matemática." },
  umbral: { title: "Umbrales de dictamen y simulación", desc: "Scores mínimos para cada categoría de dictamen y límites de la simulación NUVEX." },
  penalizacion: { title: "Penalizaciones de score", desc: "Puntos descontados al QA Score por cada inconsistencia o faltante." },
};

function ConfigReglasQA() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const list = useServerFn(listReglasQA);
  const update = useServerFn(actualizarReglaQA);
  const histFn = useServerFn(listHistorialReglaQA);

  const [reglas, setReglas] = useState<Regla[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);
  const [historial, setHistorial] = useState<Record<string, Awaited<ReturnType<typeof listHistorialReglaQA>>["rows"]>>({});
  const [openHist, setOpenHist] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await list();
      setReglas(r.rows as Regla[]);
      const d: Record<string, Record<string, string>> = {};
      r.rows.forEach((row) => {
        d[row.id] = {};
        Object.entries((row.payload ?? {}) as Record<string, unknown>).forEach(([k, v]) => { d[row.id][k] = String(v); });
      });
      setDrafts(d);
    } catch { /* ignore */ }
    setLoading(false);
  }, [list]);

  useEffect(() => { cargar(); }, [cargar]);

  if (rolesLoading || loading) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando reglas…</p></NCard></PageLayout>;
  }

  const guardar = async (r: Regla) => {
    setSavingId(r.id); setMsg(null);
    try {
      const payload: Record<string, number | string | boolean> = {};
      Object.entries(drafts[r.id] ?? {}).forEach(([k, v]) => {
        const n = Number(v);
        payload[k] = v !== "" && Number.isFinite(n) ? n : v;
      });
      const res = await update({ data: { id: r.id, payload } });
      const nuevaVer = (res.regla as { version: number } | null)?.version ?? r.version + 1;
      setMsg({ id: r.id, text: `Guardado · versión ${nuevaVer}`, ok: true });
      await cargar();
    } catch (e) {
      setMsg({ id: r.id, text: e instanceof Error ? e.message : "Error al guardar", ok: false });
    }
    setSavingId(null);
  };

  const toggleHistorial = async (r: Regla) => {
    if (openHist === r.id) { setOpenHist(null); return; }
    setOpenHist(r.id);
    if (!historial[r.id]) {
      try {
        const h = await histFn({ data: { reglaId: r.id, limit: 5 } });
        setHistorial((prev) => ({ ...prev, [r.id]: h.rows }));
      } catch { /* ignore */ }
    }
  };

  const maxVersion = Math.max(1, ...reglas.map((r) => r.version));
  const grupos: Array<"tolerancia" | "umbral" | "penalizacion"> = ["tolerancia", "umbral", "penalizacion"];

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Settings size={12} />, label: `Reglas QA · v${maxVersion}`, tone: "blue" }}
        title="Configuración del motor QA"
        description="Tolerancias, umbrales de dictamen y penalizaciones que consume el auditor matemático. Cada cambio incrementa la versión y queda en bitácora."
        actions={
          <Link to="/qa-ai">
            <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
              <ShieldCheck size={14} /> Volver al dashboard
            </button>
          </Link>
        }
      />

      {!canValidarProyeccion && (
        <NCard padding="md">
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-warning)" }}>
            <Lock size={14} /> Solo lectura · contacta a Dirección Financiera QA para modificar tolerancias.
          </div>
        </NCard>
      )}

      {grupos.map((tipo) => {
        const grupo = reglas.filter((r) => r.tipo === tipo);
        if (!grupo.length) return null;
        return (
          <NCard key={tipo} padding="lg">
            <SectionHeader title={TIPO_LABEL[tipo].title} description={TIPO_LABEL[tipo].desc} />
            <div className="space-y-3 mt-3">
              {grupo.map((r) => {
                const keys = Object.keys(r.payload ?? {});
                return (
                  <div key={r.id} className="p-3 rounded" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--nuvia-border)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <code className="font-mono" style={{ color: "var(--nuvia-accent)" }}>{r.codigo}</code>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--nuvia-text-secondary)" }}>v{r.version}</span>
                          {!r.activa && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--nuvia-danger)", color: "#fff" }}>inactiva</span>}
                        </div>
                        <p className="text-sm mt-1" style={{ color: "var(--nuvia-text-primary)" }}>{r.descripcion}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          {keys.map((k) => (
                            <label key={k} className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                              {k}
                              <input
                                className="nuvia-input nuvia-input-sm mt-0.5"
                                value={drafts[r.id]?.[k] ?? ""}
                                disabled={!canValidarProyeccion}
                                onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: { ...(d[r.id] ?? {}), [k]: e.target.value } }))}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <button
                          onClick={() => guardar(r)}
                          disabled={!canValidarProyeccion || savingId === r.id}
                          className="text-[11px] px-3 py-1.5 rounded inline-flex items-center gap-1.5 text-white"
                          style={{ background: "var(--nuvia-accent)", opacity: canValidarProyeccion ? 1 : 0.4, cursor: canValidarProyeccion ? "pointer" : "not-allowed" }}
                        >
                          <Save size={11} /> {savingId === r.id ? "…" : "Guardar"}
                        </button>
                        <button onClick={() => toggleHistorial(r)} className="text-[11px] inline-flex items-center gap-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                          <History size={10} /> Historial
                        </button>
                      </div>
                    </div>
                    {msg?.id === r.id && (
                      <p className="text-[11px] mt-2" style={{ color: msg.ok ? "var(--nuvia-success)" : "var(--nuvia-danger)" }}>{msg.text}</p>
                    )}
                    {openHist === r.id && (
                      <div className="mt-3 pt-3 text-[11px]" style={{ borderTop: "1px dashed var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
                        {historial[r.id]?.length ? (
                          <ul className="space-y-1">
                            {historial[r.id].map((h) => (
                              <li key={h.id}>
                                <span className="font-mono">v{h.version_anterior} → v{h.version_nueva}</span> · {new Date(h.changed_at).toLocaleString("es-CO")} · {h.changed_by?.slice(0, 8) ?? "system"}
                                <code className="ml-2 text-[10px]">{JSON.stringify(h.payload_nuevo)}</code>
                              </li>
                            ))}
                          </ul>
                        ) : <p>Sin cambios registrados.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </NCard>
        );
      })}
    </PageLayout>
  );
}
