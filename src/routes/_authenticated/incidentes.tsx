import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
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
import { ShieldCheck, Plus, X, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/incidentes")({
  component: IncidentesPage,
  head: () => ({ meta: [{ title: "Centro de Incidentes · NUVEX" }] }),
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

  // filtros
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

  const userMap = useMemo(() => new Map(usuarios.map((u) => [u.id, u.nombre || u.email || u.id.slice(0,8)])), [usuarios]);
  const expMap = useMemo(() => new Map(expedientes.map((e) => [e.id, e.cliente_nombre])), [expedientes]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              NUVEX · Gerencia Administrativa y Operaciones
            </div>
            <h1 className="text-2xl font-semibold text-[#242424] flex items-center gap-2">
              <ShieldCheck size={22} style={{ color: NUVEX.azul }} /> Centro de Incidentes Operativos
            </h1>
            <p className="text-sm text-[#242424]/65 mt-1">
              Reporta, asigna y resuelve incidentes detectados en cualquier expediente o proceso interno.
            </p>
          </div>
          <button
            onClick={() => setOpenNew(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: NUVEX.azul }}
          >
            <Plus size={16} /> Reportar incidente
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Abiertos" value={kpis.abiertos} color="#991B1B" />
        <Kpi label="En gestión" value={kpis.enGestion} color="#8A5A00" />
        <Kpi label="Resueltos" value={kpis.resueltos} color="#1F7A45" />
        <Kpi label="Críticos activos" value={kpis.criticos} color="#7A0E0E" icon={<AlertTriangle size={16} />} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Select value={fEstado} onChange={(v) => setFEstado(v as IncidenteEstado | "todos")}
            options={[["todos","Todos los estados"],["abierto","Abierto"],["en_gestion","En gestión"],["resuelto","Resuelto"],["cerrado","Cerrado"]]} />
          <Select value={fSeveridad} onChange={(v) => setFSeveridad(v as IncidenteSeveridad | "todas")}
            options={[["todas","Toda severidad"],["critica","Crítica"],["alta","Alta"],["media","Media"],["baja","Baja"]]} />
          <Select value={fTipo} onChange={(v) => setFTipo(v as IncidenteTipo | "todos")}
            options={[["todos","Todos los tipos"],["documental","Documental"],["juridico","Jurídico"],["financiero","Financiero"],["banco","Banco"],["cliente","Cliente"],["sistema","Sistema"],["otro","Otro"]]} />
        </div>

        {loading && <div className="py-6 text-center text-sm text-[#242424]/60">Cargando incidentes…</div>}
        {err && <div className="py-6 text-center text-sm text-[#B42318]">{err}</div>}

        {!loading && !err && items.length === 0 && (
          <div className="py-10 text-center text-sm text-[#242424]/60">No hay incidentes con esos filtros.</div>
        )}

        {!loading && !err && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Tipo</th>
                  <th className="py-2 pr-4">Severidad</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Expediente</th>
                  <th className="py-2 pr-4">Asignado</th>
                  <th className="py-2 pr-4">Reportado</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const sev = SEVERIDAD_STYLE[i.severidad];
                  const est = ESTADO_STYLE[i.estado];
                  return (
                    <tr key={i.id} className="border-b border-[#F0F2F6] hover:bg-[#F7F9FB]">
                      <td className="py-2 pr-4 font-medium text-[#242424]">
                        <button onClick={() => setEditing(i)} className="text-left hover:underline">{i.titulo}</button>
                      </td>
                      <td className="py-2 pr-4 text-[#242424]/70">{TIPO_LABEL[i.tipo]}</td>
                      <td className="py-2 pr-4">
                        <Pill style={sev} />
                      </td>
                      <td className="py-2 pr-4">
                        <Pill style={est} />
                      </td>
                      <td className="py-2 pr-4">
                        {i.expediente_id ? (
                          <Link to="/casos/$id" params={{ id: i.expediente_id }} className="text-[#445DA3] hover:underline">
                            {expMap.get(i.expediente_id) || i.expediente_id.slice(0, 8)}
                          </Link>
                        ) : <span className="text-[#242424]/45">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-[#242424]/75">{i.asignado_a ? (userMap.get(i.asignado_a) || "—") : <span className="text-[#242424]/45">Sin asignar</span>}</td>
                      <td className="py-2 pr-4 text-[#242424]/60 text-[11px]">{new Date(i.created_at).toLocaleString("es-CO")}</td>
                      <td className="py-2 pr-2 text-right">
                        {isSuperAdmin && (
                          <button
                            onClick={async () => {
                              if (!confirm("¿Eliminar incidente?")) return;
                              await eliminarIncidente(i.id);
                              await refresh();
                            }}
                            className="text-[#B42318] hover:bg-[#FEE2E2] p-1 rounded"
                            title="Eliminar"
                          ><Trash2 size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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
    </div>
  );
}

function Kpi({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#242424]/55">
        {icon}<span>{label}</span>
      </div>
      <div className="text-2xl font-semibold mt-1" style={{ color }}>{value}</div>
    </Card>
  );
}

function Pill({ style }: { style: { bg: string; color: string; border: string; label: string } }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}>
      {style.label}
    </span>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string,string]> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[12px] text-[#242424]">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
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
                className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
                {(Object.keys(TIPO_LABEL) as IncidenteTipo[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </Field>
            <Field label="Severidad">
              <select value={severidad} onChange={(e) => setSeveridad(e.target.value as IncidenteSeveridad)}
                disabled={!canManage && mode === "editar"}
                className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
                {(Object.keys(SEVERIDAD_STYLE) as IncidenteSeveridad[]).map((s) => <option key={s} value={s}>{SEVERIDAD_STYLE[s].label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Expediente relacionado (opcional)">
            <select value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)}
              disabled={mode === "editar"}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
              <option value="">— Sin expediente —</option>
              {expedientes.map((x) => <option key={x.id} value={x.id}>{x.cliente_nombre}</option>)}
            </select>
          </Field>
          <Field label="Asignar a">
            <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)}
              className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
              <option value="">— Sin asignar —</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre || u.email}</option>)}
            </select>
          </Field>
          {mode === "editar" && (
            <>
              <Field label="Estado">
                <select value={estado} onChange={(e) => setEstado(e.target.value as IncidenteEstado)}
                  className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm">
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
