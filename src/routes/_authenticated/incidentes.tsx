import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageLayout, ExecutiveHero, KpiGrid, KpiCard, NCard, NSelect } from "@/components/nuvia";
import { NUVEX } from "@/components/nuvex/constants";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import {
  listarIncidentes,
  crearIncidente,
  actualizarIncidente,
  eliminarIncidente,
  ESTADO_STYLE,
  SEVERIDAD_STYLE,
  TIPO_LABEL,
  type Incidente,
  type IncidenteEstado,
  type IncidenteSeveridad,
  type IncidenteTipo,
} from "@/lib/incidentes";
import { ShieldCheck, Plus, X, AlertTriangle, Trash2, CheckCircle2, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/incidentes")({
  component: IncidentesPage,
  head: () => ({ meta: [{ title: "Centro de Incidentes · NUVIA" }] }),
});

interface Usuario { id: string; nombre: string | null; email: string | null }

function IncidentesPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const esGerencia = isSuperAdmin || roles.includes("gerencia" as never);

  const [items, setItems] = useState<Incidente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [expedientes, setExpedientes] = useState<Array<{ id: string; cliente_nombre: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [fEstado, setFEstado] = useState<IncidenteEstado | "todos">("todos");
  const [fSeveridad, setFSeveridad] = useState<IncidenteSeveridad | "todas">("todas");
  const [fTipo, setFTipo] = useState<IncidenteTipo | "todos">("todos");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Incidente | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listarIncidentes({ estado: fEstado, severidad: fSeveridad, tipo: fTipo });
      setItems(data);
    } catch (e) { setErr((e as Error).message); }
    finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [fEstado, fSeveridad, fTipo]);

  useEffect(() => {
    (async () => {
      const [{ data: us }, { data: exps }] = await Promise.all([
        supabase.from("profiles").select("id, nombre, email").eq("estado_acceso", "aprobado").order("nombre").limit(500),
        supabase.from("expedientes").select("id, cliente_nombre").order("updated_at", { ascending: false }).limit(300),
      ]);
      setUsuarios((us ?? []) as Usuario[]);
      setExpedientes((exps ?? []) as Array<{ id: string; cliente_nombre: string }>);
    })();
  }, []);

  const kpis = useMemo(() => ({
    abiertos: items.filter((i) => i.estado === "abierto").length,
    enGestion: items.filter((i) => i.estado === "en_gestion").length,
    resueltos: items.filter((i) => i.estado === "resuelto").length,
    criticos: items.filter((i) => i.severidad === "critica" && i.estado !== "cerrado").length,
  }), [items]);

  const userMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nombre || u.email || u.id.slice(0, 8)])), [usuarios]);
  const expMap = useMemo(() => new Map(expedientes.map((e) => [e.id, e.cliente_nombre])), [expedientes]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Gerencia · Operaciones", tone: "blue" }}
        title="Centro de Incidentes Operativos"
        description="Reporta, asigna y resuelve incidentes detectados en cualquier expediente o proceso interno."
        actions={
          <button
            onClick={() => setOpenNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
          >
            <Plus size={14} /> Reportar incidente
          </button>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<AlertTriangle size={14} />} tone="danger" label="Abiertos" value={String(kpis.abiertos)} />
        <KpiCard icon={<Activity size={14} />} tone="warning" label="En gestión" value={String(kpis.enGestion)} />
        <KpiCard icon={<CheckCircle2 size={14} />} tone="green" label="Resueltos" value={String(kpis.resueltos)} />
        <KpiCard icon={<AlertTriangle size={14} />} tone="danger" label="Críticos activos" value={String(kpis.criticos)} />
      </KpiGrid>

      <NCard padding="md">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <NSelect
            value={fEstado}
            onValueChange={(v) => setFEstado(v as IncidenteEstado | "todos")}
            options={[
              { value: "todos", label: "Todos los estados" },
              { value: "abierto", label: "Abierto" },
              { value: "en_gestion", label: "En gestión" },
              { value: "resuelto", label: "Resuelto" },
              { value: "cerrado", label: "Cerrado" },
            ]}
          />
          <NSelect
            value={fSeveridad}
            onValueChange={(v) => setFSeveridad(v as IncidenteSeveridad | "todas")}
            options={[
              { value: "todas", label: "Toda severidad" },
              { value: "critica", label: "Crítica" },
              { value: "alta", label: "Alta" },
              { value: "media", label: "Media" },
              { value: "baja", label: "Baja" },
            ]}
          />
          <NSelect
            value={fTipo}
            onValueChange={(v) => setFTipo(v as IncidenteTipo | "todos")}
            options={[
              { value: "todos", label: "Todos los tipos" },
              { value: "documental", label: "Documental" },
              { value: "juridico", label: "Jurídico" },
              { value: "financiero", label: "Financiero" },
              { value: "banco", label: "Banco" },
              { value: "cliente", label: "Cliente" },
              { value: "sistema", label: "Sistema" },
              { value: "otro", label: "Otro" },
            ]}
          />
        </div>

        {loading && <div className="py-6 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>Cargando incidentes…</div>}
        {err && <div className="py-6 text-center text-[12px]" style={{ color: "var(--nuvia-danger)" }}>{err}</div>}

        {!loading && !err && items.length === 0 && (
          <div className="py-10 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            No hay incidentes con esos filtros.
          </div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  {["Título", "Tipo", "Severidad", "Estado", "Expediente", "Asignado", "Reportado", ""].map((h, i) => (
                    <th
                      key={i}
                      className="py-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--nuvia-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const sev = SEVERIDAD_STYLE[i.severidad];
                  const est = ESTADO_STYLE[i.estado];
                  return (
                    <tr key={i.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                      <td className="py-2 pr-4 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        <button onClick={() => setEditing(i)} className="text-left hover:underline">{i.titulo}</button>
                      </td>
                      <td className="py-2 pr-4" style={{ color: "var(--nuvia-text-secondary)" }}>{TIPO_LABEL[i.tipo]}</td>
                      <td className="py-2 pr-4"><Pill style={sev} /></td>
                      <td className="py-2 pr-4"><Pill style={est} /></td>
                      <td className="py-2 pr-4">
                        {i.expediente_id ? (
                          <Link to="/casos/$id" params={{ id: i.expediente_id }} className="hover:underline" style={{ color: "#A5B5E0" }}>
                            {expMap.get(i.expediente_id) || i.expediente_id.slice(0, 8)}
                          </Link>
                        ) : <span style={{ color: "var(--nuvia-text-muted)" }}>—</span>}
                      </td>
                      <td className="py-2 pr-4" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {i.asignado_a ? (userMap.get(i.asignado_a) || "—") : <span style={{ color: "var(--nuvia-text-muted)" }}>Sin asignar</span>}
                      </td>
                      <td className="py-2 pr-4 text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>
                        {new Date(i.created_at).toLocaleString("es-CO")}
                      </td>
                      <td className="py-2 pr-2 text-right">
                        {isSuperAdmin && (
                          <button
                            onClick={async () => {
                              if (!confirm("¿Eliminar incidente?")) return;
                              await eliminarIncidente(i.id);
                              await refresh();
                            }}
                            className="p-1 rounded hover:bg-white/5"
                            title="Eliminar"
                          ><Trash2 size={14} style={{ color: "#FF8585" }} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      {openNew && (
        <IncidenteModal
          mode="crear"
          usuarios={usuarios}
          expedientes={expedientes}
          onClose={() => setOpenNew(false)}
          onSaved={async () => { setOpenNew(false); await refresh(); }}
        />
      )}
      {editing && (
        <IncidenteModal
          mode="editar"
          incidente={editing}
          usuarios={usuarios}
          expedientes={expedientes}
          canManage={esGerencia || editing.asignado_a === undefined}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await refresh(); }}
        />
      )}
    </PageLayout>
  );
}

function Pill({ style }: { style: { bg: string; color: string; border: string; label: string } }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      {style.label}
    </span>
  );
}

function IncidenteModal({ mode, incidente, usuarios, expedientes, canManage = true, onClose, onSaved }: {
  mode: "crear" | "editar";
  incidente?: Incidente;
  usuarios: Usuario[];
  expedientes: Array<{ id: string; cliente_nombre: string }>;
  canManage?: boolean;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [titulo, setTitulo] = useState(incidente?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(incidente?.descripcion ?? "");
  const [tipo, setTipo] = useState<IncidenteTipo>(incidente?.tipo ?? "otro");
  const [severidad, setSeveridad] = useState<IncidenteSeveridad>(incidente?.severidad ?? "media");
  const [estado, setEstado] = useState<IncidenteEstado>(incidente?.estado ?? "abierto");
  const [expedienteId, setExpedienteId] = useState<string>(incidente?.expediente_id ?? "");
  const [asignadoA, setAsignadoA] = useState<string>(incidente?.asignado_a ?? "");
  const [resolucion, setResolucion] = useState(incidente?.resolucion ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    if (!titulo.trim()) { setError("El título es obligatorio."); return; }
    setBusy(true); setError(null);
    try {
      if (mode === "crear") {
        await crearIncidente({
          titulo, descripcion, tipo, severidad,
          expediente_id: expedienteId || null,
          asignado_a: asignadoA || null,
        });
      } else if (incidente) {
        await actualizarIncidente(incidente.id, {
          titulo, descripcion, tipo, severidad, estado,
          asignado_a: asignadoA || null,
          resolucion: resolucion || null,
        });
      }
      await onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <h2 className="text-base font-semibold text-[#242424]">
            {mode === "crear" ? "Reportar incidente" : "Detalle del incidente"}
          </h2>
          <button onClick={onClose} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Título">
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!canManage && mode === "editar"}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm" />
          </Field>
          <Field label="Descripción">
            <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
              disabled={!canManage && mode === "editar"}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as IncidenteTipo)}
                disabled={!canManage && mode === "editar"}
                className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white">
                {(Object.keys(TIPO_LABEL) as IncidenteTipo[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Severidad">
              <select value={severidad} onChange={(e) => setSeveridad(e.target.value as IncidenteSeveridad)}
                disabled={!canManage && mode === "editar"}
                className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white">
                {(Object.keys(SEVERIDAD_STYLE) as IncidenteSeveridad[]).map((s) => <option key={s} value={s}>{SEVERIDAD_STYLE[s].label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Expediente relacionado (opcional)">
            <select value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)}
              disabled={mode === "editar"}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white">
              <option value="">— Sin expediente —</option>
              {expedientes.map((x) => <option key={x.id} value={x.id}>{x.cliente_nombre}</option>)}
            </select>
          </Field>
          <Field label="Asignar a">
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white">
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          </Field>
          {mode === "editar" && (
            <>
              <Field label="Estado">
                <select value={estado} onChange={(e) => setEstado(e.target.value as IncidenteEstado)}
                  className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white">
                  {(Object.keys(ESTADO_STYLE) as IncidenteEstado[]).map((s) => <option key={s} value={s}>{ESTADO_STYLE[s].label}</option>)}
                </select>
              </Field>
              <Field label="Resolución / notas de cierre">
                <textarea value={resolucion} onChange={(e) => setResolucion(e.target.value)} rows={3}
                  className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
                  placeholder="Describe la solución aplicada o cierre del incidente…" />
              </Field>
            </>
          )}
          {error && <div className="text-[12px] text-[#B42318]">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[#E3E7EE] bg-[#FAFBFC]">
          <button onClick={onClose} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: NUVEX.azul }}>
            {busy ? "Guardando…" : mode === "crear" ? "Reportar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">{label}</span>
      {children}
    </label>
  );
}
