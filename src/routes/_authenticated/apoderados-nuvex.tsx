import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import {
  listApoderados, createApoderado, updateApoderado, deleteApoderado,
  type ApoderadoNuvex, type ApoderadoInput,
} from "@/lib/apoderados";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/apoderados-nuvex")({
  component: ApoderadosPage,
  head: () => ({ meta: [{ title: "Apoderados NUVEX" }] }),
});

const empty: ApoderadoInput = {
  nombre: "", cedula: "", lugar_expedicion: "", ciudad: "", celular: "", correo: "", activo: true,
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
              Listado de apoderados disponibles para el Poder Especial.
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
                  <th className="py-2 pr-3">Expedida</th>
                  <th className="py-2 pr-3">Ciudad</th>
                  <th className="py-2 pr-3">Celular</th>
                  <th className="py-2 pr-3">Correo</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-[#F0F2F7] last:border-0">
                    <td className="py-2 pr-3 font-medium text-[#242424]">{a.nombre}</td>
                    <td className="py-2 pr-3">{a.cedula}</td>
                    <td className="py-2 pr-3 text-[#242424]/70">{a.lugar_expedicion ?? "—"}</td>
                    <td className="py-2 pr-3 text-[#242424]/70">{a.ciudad ?? "—"}</td>
                    <td className="py-2 pr-3 text-[#242424]/70">{a.celular ?? "—"}</td>
                    <td className="py-2 pr-3 text-[#242424]/70">{a.correo ?? "—"}</td>
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
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[#242424]">
                {editing === "new" ? "Nuevo apoderado" : "Editar apoderado"}
              </h2>
              <button onClick={close} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nombre completo *" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} className="sm:col-span-2" />
              <Field label="Cédula *" value={form.cedula} onChange={(v) => setForm({ ...form, cedula: v })} />
              <Field label="Lugar de expedición" value={form.lugar_expedicion} onChange={(v) => setForm({ ...form, lugar_expedicion: v })} />
              <Field label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
              <Field label="Celular" value={form.celular} onChange={(v) => setForm({ ...form, celular: v })} />
              <Field label="Correo" value={form.correo} onChange={(v) => setForm({ ...form, correo: v })} />
              <label className="flex items-center gap-2 text-sm text-[#242424] sm:col-span-2 mt-2">
                <input
                  type="checkbox"
                  checked={form.activo}
                  onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                />
                Activo
              </label>
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
