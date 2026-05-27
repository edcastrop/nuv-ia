import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import {
  listApoderados, createApoderado, updateApoderado, deleteApoderado,
  BANCOS_DISPONIBLES,
  type ApoderadoNuvex, type ApoderadoInput,
} from "@/lib/apoderados";
import { Pencil, Trash2, Plus, X, Star, Building2, ShieldAlert } from "lucide-react";
import { CitySelect } from "@/components/ui/CitySelect";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/apoderados-nuvex")({
  component: ApoderadosPageGuard,
  head: () => ({ meta: [{ title: "Apoderados NUVEX" }] }),
});

function ApoderadosPageGuard() {
  const { isSuperAdmin, loading } = useUserRole();
  if (loading) {
    return <div className="p-10 text-center text-sm text-[#242424]/60">Verificando permisos…</div>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <Card>
          <div className="flex flex-col items-center text-center gap-3 py-8">
            <ShieldAlert size={36} className="text-[#B42318]" />
            <h2 className="text-lg font-semibold text-[#242424]">Acceso restringido</h2>
            <p className="text-sm text-[#242424]/70">
              No tienes permiso para acceder a este módulo. La configuración de Apoderados es exclusiva del Super Admin.
            </p>
            <Link to="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: NUVEX.azul }}>
              Volver al inicio
            </Link>
          </div>
        </Card>
      </div>
    );
  }
  return <ApoderadosPage />;
}


const empty: ApoderadoInput = {
  nombre: "", cedula: "", lugar_expedicion: "", ciudad: "", celular: "", correo: "", activo: true,
  predeterminado_general: false, predeterminado_fna: false, bancos_asignados: [],
};

function ApoderadosPage() {
  const [rows, setRows] = useState<ApoderadoNuvex[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApoderadoNuvex | "new" | null>(null);
  const [form, setForm] = useState<ApoderadoInput>(empty);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    listApoderados().then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); }, []);

  const openNew = () => { setForm(empty); setEditing("new"); };
  const openEdit = (a: ApoderadoNuvex) => {
    setForm({
      nombre: a.nombre, cedula: a.cedula,
      lugar_expedicion: a.lugar_expedicion ?? "",
      ciudad: a.ciudad ?? "",
      celular: a.celular ?? "", correo: a.correo ?? "",
      activo: a.activo,
      predeterminado_general: a.predeterminado_general,
      predeterminado_fna: a.predeterminado_fna,
      bancos_asignados: a.bancos_asignados ?? [],
    });
    setEditing(a);
  };
  const close = () => { setEditing(null); setForm(empty); };

  const save = async () => {
    if (!form.nombre.trim() || !form.cedula.trim()) { alert("Nombre y cédula son obligatorios"); return; }
    setSaving(true);
    try {
      if (editing === "new") await createApoderado(form);
      else if (editing) await updateApoderado(editing.id, form);
      close(); reload();
    } catch (e) { alert((e as Error).message); }
    finally { setSaving(false); }
  };

  const toggleActivo = async (a: ApoderadoNuvex) => {
    try { await updateApoderado(a.id, { activo: !a.activo }); reload(); }
    catch (e) { alert((e as Error).message); }
  };

  const remove = async (a: ApoderadoNuvex) => {
    if (!confirm(`¿Eliminar a ${a.nombre}?`)) return;
    try { await deleteApoderado(a.id); reload(); }
    catch (e) { alert((e as Error).message); }
  };

  const toggleBanco = (b: string) => {
    setForm((f) => ({
      ...f,
      bancos_asignados: f.bancos_asignados.includes(b)
        ? f.bancos_asignados.filter((x) => x !== b)
        : [...f.bancos_asignados, b],
    }));
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              Módulo administrativo
            </div>
            <h1 className="text-2xl font-semibold text-[#242424]">Apoderados NUVEX</h1>
            <p className="text-sm text-[#242424]/70 mt-1">
              Listado de apoderados disponibles para el Poder Especial. Marca un predeterminado para FNA y otro general.
            </p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: NUVEX.azul }}
          >
            <Plus size={15} /> Nuevo
          </button>
        </div>
      </Card>

      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-[#242424]/60">Cargando…</div>
        ) : err ? (
          <div className="py-8 text-center text-sm text-[#B42318]">{err}</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-[#242424]/60">
            Aún no hay apoderados. Crea el primero con el botón “Nuevo”.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-[#242424]/60 border-b border-[#E3E7EE]">
                <tr>
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2 pr-3">Predet.</th>
                  <th className="py-2 pr-3">Bancos asignados</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-[#F0F2F7] last:border-0">
                    <td className="py-2 pr-3 font-medium text-[#242424]">
                      {a.nombre}
                      <div className="text-[11px] text-[#242424]/60">
                        {a.lugar_expedicion ?? "—"} · {a.ciudad ?? "—"}
                      </div>
                    </td>
                    <td className="py-2 pr-3">{a.cedula}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-col gap-1">
                        {a.predeterminado_general && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }}>
                            <Star size={10} /> General
                          </span>
                        )}
                        {a.predeterminado_fna && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#FEF3C7", color: "#854D0E" }}>
                            <Star size={10} /> FNA
                          </span>
                        )}
                        {!a.predeterminado_general && !a.predeterminado_fna && (
                          <span className="text-[11px] text-[#242424]/40">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-[#242424]/70">
                      {a.bancos_asignados && a.bancos_asignados.length > 0
                        ? <span className="text-[11px]">{a.bancos_asignados.join(", ")}</span>
                        : <span className="text-[11px] text-[#242424]/40">Todos</span>}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => toggleActivo(a)}
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={
                          a.activo
                            ? { background: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }
                            : { background: "#F0F2F7", color: "#6B7280" }
                        }
                      >
                        {a.activo ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-[#F7F9FB]" title="Editar">
                          <Pencil size={14} style={{ color: NUVEX.azul }} />
                        </button>
                        <button onClick={() => remove(a)} className="p-1.5 rounded hover:bg-[#FDECEC]" title="Eliminar">
                          <Trash2 size={14} style={{ color: NUVEX.rojoTexto }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#242424]">
                {editing === "new" ? "Nuevo apoderado" : "Editar apoderado"}
              </h2>
              <button onClick={close} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre completo *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} className="sm:col-span-2" />
              <Field label="Cédula *" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} />
              <label className="block">
                <div className="text-[11px] uppercase tracking-wider text-[#242424]/60 font-semibold mb-1">Lugar de expedición</div>
                <CitySelect value={form.lugar_expedicion} onChange={(v) => setForm({ ...form, lugar_expedicion: v })} placeholder="Selecciona municipio de expedición…" />
              </label>
              <label className="block">
                <div className="text-[11px] uppercase tracking-wider text-[#242424]/60 font-semibold mb-1">Ciudad</div>
                <CitySelect value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
              </label>
              <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} />
              <Field label="Correo" value={form.correo} onChange={(v) => setForm({ ...form, correo: v })} className="sm:col-span-2" />

              <div className="sm:col-span-2 mt-2 rounded-xl border border-[#E3E7EE] p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-[#242424]/60 font-semibold">
                  Estado y predeterminados
                </div>
                <label className="flex items-center gap-2 text-sm text-[#242424]">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
                  Activo
                </label>
                <label className="flex items-center gap-2 text-sm text-[#242424]">
                  <input
                    type="checkbox"
                    checked={form.predeterminado_general}
                    onChange={(e) => setForm({ ...form, predeterminado_general: e.target.checked })}
                  />
                  <Star size={13} style={{ color: NUVEX.verdeTextoFuerte }} />
                  Predeterminado General (todos los bancos excepto FNA)
                </label>
                <label className="flex items-center gap-2 text-sm text-[#242424]">
                  <input
                    type="checkbox"
                    checked={form.predeterminado_fna}
                    onChange={(e) => setForm({ ...form, predeterminado_fna: e.target.checked })}
                  />
                  <Star size={13} style={{ color: "#854D0E" }} />
                  Predeterminado FNA
                </label>
                <p className="text-[11px] text-[#242424]/60">
                  Al guardar, cualquier otro apoderado con la misma marca quedará desmarcado automáticamente.
                </p>
              </div>

              <div className="sm:col-span-2 mt-2 rounded-xl border border-[#E3E7EE] p-3">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#242424]/60 font-semibold mb-2">
                  <Building2 size={13} /> Bancos asignados
                </div>
                <p className="text-[11px] text-[#242424]/60 mb-2">
                  Si no marcas ninguno, el apoderado podrá usarse con cualquier banco.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {BANCOS_DISPONIBLES.map((b) => (
                    <label key={b} className="flex items-center gap-2 text-sm text-[#242424]">
                      <input
                        type="checkbox"
                        checked={form.bancos_asignados.includes(b)}
                        onChange={() => toggleBanco(b)}
                      />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={close} className="rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm">Cancelar</button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: NUVEX.azul }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="text-[11px] uppercase tracking-wider text-[#242424]/60 font-semibold mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm focus:outline-none focus:border-[#445DA3]"
      />
    </label>
  );
}
