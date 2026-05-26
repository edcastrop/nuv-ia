import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUserRole } from "@/hooks/useUserRole";
import {
  listCategorias,
  listArticulos,
  upsertArticulo,
  deleteArticulo,
  listTickets,
  actualizarTicket,
  analiticaGpt,
} from "@/lib/nuvex-gpt.functions";

export const Route = createFileRoute("/_authenticated/super-admin/nuvex-gpt")({
  component: AdminGpt,
  head: () => ({ meta: [{ title: "NUVEX GPT · Administración" }] }),
});

type Tab = "kb" | "tickets" | "analitica";

const ROLES = [
  "super_admin", "admin", "gerencia", "director_qa", "juridica", "analista_juridico",
  "contabilidad", "licenciado", "asesor", "auxiliar_operativo", "apoderado", "cartera",
];

function AdminGpt() {
  const { isSuperAdmin, loading } = useUserRole();
  const [tab, setTab] = useState<Tab>("kb");

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <div className="p-12 text-center text-sm text-[#B42318]">No autorizado.</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050814]">NUVEX GPT · Copiloto Operativo</h1>
        <p className="text-sm text-[#242424]/60">Base de conocimiento, tickets escalados y analítica de consultas.</p>
      </div>

      <div className="flex gap-2 border-b border-[#E3E7EE] mb-6">
        {[
          { k: "kb", label: "Base de Conocimiento" },
          { k: "tickets", label: "Tickets escalados" },
          { k: "analitica", label: "Analítica" },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as Tab)}
            className="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition"
            style={{
              color: tab === t.k ? "#445DA3" : "rgba(36,36,36,0.6)",
              borderColor: tab === t.k ? "#445DA3" : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "kb" && <KbTab />}
      {tab === "tickets" && <TicketsTab />}
      {tab === "analitica" && <AnaliticaTab />}
    </div>
  );
}

// ============ KB ============
function KbTab() {
  const listCats = useServerFn(listCategorias);
  const listArts = useServerFn(listArticulos);
  const upsert = useServerFn(upsertArticulo);
  const del = useServerFn(deleteArticulo);

  const [cats, setCats] = useState<Awaited<ReturnType<typeof listCategorias>>>([]);
  const [arts, setArts] = useState<Awaited<ReturnType<typeof listArticulos>>>([]);
  const [editing, setEditing] = useState<null | {
    id?: string;
    categoria_id: string;
    titulo: string;
    contenido: string;
    tags: string;
    roles_permitidos: string[];
    activo: boolean;
  }>(null);
  const [filter, setFilter] = useState("");

  const reload = async () => {
    const [c, a] = await Promise.all([listCats(), listArts()]);
    setCats(c);
    setArts(a);
  };

  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return arts;
    return arts.filter((a) => a.titulo.toLowerCase().includes(q) || (a.tags ?? []).some((t: string) => t.toLowerCase().includes(q)));
  }, [arts, filter]);

  const catName = (id: string) => cats.find((c) => c.id === id)?.nombre ?? "—";

  const handleSave = async () => {
    if (!editing) return;
    await upsert({
      data: {
        id: editing.id,
        categoria_id: editing.categoria_id,
        titulo: editing.titulo,
        contenido: editing.contenido,
        tags: editing.tags.split(",").map((t) => t.trim()).filter(Boolean),
        roles_permitidos: editing.roles_permitidos,
        activo: editing.activo,
      },
    });
    setEditing(null);
    reload();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_420px] gap-6">
      <div className="bg-white rounded-2xl border border-[#E3E7EE] overflow-hidden">
        <div className="p-4 border-b border-[#E3E7EE] flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por título o tag…"
            className="flex-1 px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
          />
          <button
            onClick={() =>
              setEditing({
                categoria_id: cats[0]?.id ?? "",
                titulo: "",
                contenido: "",
                tags: "",
                roles_permitidos: [],
                activo: true,
              })
            }
            className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ background: "#445DA3" }}
          >
            + Nuevo artículo
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-[#E3E7EE]">
          {filtered.length === 0 && <div className="p-8 text-center text-sm text-[#242424]/50">Sin artículos.</div>}
          {filtered.map((a) => (
            <div key={a.id} className="p-4 hover:bg-[#F7F9FB]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background: a.activo ? "rgba(132,185,143,0.15)" : "rgba(180,35,24,0.12)",
                        color: a.activo ? "#2E7D45" : "#B42318",
                      }}
                    >
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                    <span className="text-[11px] text-[#445DA3] font-semibold">{catName(a.categoria_id)}</span>
                  </div>
                  <div className="font-semibold text-[#050814] text-sm mt-1 truncate">{a.titulo}</div>
                  <div className="text-[11px] text-[#242424]/50 mt-0.5">
                    {(a.tags ?? []).join(" · ")}
                    {a.roles_permitidos?.length ? ` · Roles: ${a.roles_permitidos.join(", ")}` : " · Todos los roles"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      setEditing({
                        id: a.id,
                        categoria_id: a.categoria_id,
                        titulo: a.titulo,
                        contenido: a.contenido,
                        tags: (a.tags ?? []).join(", "),
                        roles_permitidos: a.roles_permitidos ?? [],
                        activo: a.activo,
                      })
                    }
                    className="text-xs px-3 py-1.5 rounded-lg border border-[#E3E7EE] hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar artículo?")) return;
                      await del({ data: { id: a.id } });
                      reload();
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg text-[#B42318] hover:bg-[#FEF2F2]"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5 h-fit sticky top-20">
          <h3 className="font-bold text-[#050814] mb-4">{editing.id ? "Editar artículo" : "Nuevo artículo"}</h3>
          <div className="space-y-3">
            <Field label="Categoría">
              <select
                value={editing.categoria_id}
                onChange={(e) => setEditing({ ...editing, categoria_id: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Título">
              <input
                value={editing.titulo}
                onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              />
            </Field>
            <Field label="Contenido (markdown)">
              <textarea
                value={editing.contenido}
                onChange={(e) => setEditing({ ...editing, contenido: e.target.value })}
                rows={10}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm font-mono"
              />
            </Field>
            <Field label="Tags (separados por coma)">
              <input
                value={editing.tags}
                onChange={(e) => setEditing({ ...editing, tags: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              />
            </Field>
            <Field label="Roles permitidos (vacío = todos)">
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r) => {
                  const on = editing.roles_permitidos.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setEditing({
                          ...editing,
                          roles_permitidos: on
                            ? editing.roles_permitidos.filter((x) => x !== r)
                            : [...editing.roles_permitidos, r],
                        })
                      }
                      className="px-2 py-1 rounded text-[10px] font-semibold uppercase"
                      style={{
                        background: on ? "#445DA3" : "rgba(68,93,163,0.08)",
                        color: on ? "#fff" : "#445DA3",
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.activo}
                onChange={(e) => setEditing({ ...editing, activo: e.target.checked })}
              />
              Activo
            </label>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 rounded-lg text-white text-sm font-semibold"
                style={{ background: "#445DA3" }}
              >
                Guardar
              </button>
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">{label}</div>
      {children}
    </div>
  );
}

// ============ Tickets ============
function TicketsTab() {
  const list = useServerFn(listTickets);
  const upd = useServerFn(actualizarTicket);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listTickets>>>([]);

  const reload = async () => setRows(await list());
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-[#E3E7EE] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wider text-[#242424]/60">
          <tr>
            <th className="text-left p-3">Área</th>
            <th className="text-left p-3">Asunto</th>
            <th className="text-left p-3">Prioridad</th>
            <th className="text-left p-3">Estado</th>
            <th className="text-left p-3">Creado</th>
            <th className="text-left p-3">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E3E7EE]">
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-[#242424]/50">Sin tickets.</td>
            </tr>
          )}
          {rows.map((t) => (
            <tr key={t.id}>
              <td className="p-3 font-semibold text-[#445DA3] uppercase text-[11px]">{t.area}</td>
              <td className="p-3">
                <div className="font-medium">{t.asunto}</div>
                <div className="text-[11px] text-[#242424]/50 line-clamp-1">{t.descripcion}</div>
              </td>
              <td className="p-3 text-[11px] uppercase">{t.prioridad}</td>
              <td className="p-3">
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                  style={{
                    background:
                      t.estado === "resuelto" ? "rgba(132,185,143,0.15)" :
                      t.estado === "en_proceso" ? "rgba(245,158,11,0.15)" :
                      "rgba(68,93,163,0.12)",
                    color:
                      t.estado === "resuelto" ? "#2E7D45" :
                      t.estado === "en_proceso" ? "#92400E" :
                      "#445DA3",
                  }}
                >
                  {t.estado}
                </span>
              </td>
              <td className="p-3 text-[11px] text-[#242424]/60">{new Date(t.created_at).toLocaleString()}</td>
              <td className="p-3">
                <select
                  value={t.estado}
                  onChange={async (e) => {
                    await upd({ data: { id: t.id, estado: e.target.value as "abierto" | "en_proceso" | "resuelto" | "cerrado" } });
                    reload();
                  }}
                  className="px-2 py-1 rounded border border-[#E3E7EE] text-xs"
                >
                  <option value="abierto">Abierto</option>
                  <option value="en_proceso">En proceso</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============ Analítica ============
function AnaliticaTab() {
  const fn = useServerFn(analiticaGpt);
  const [data, setData] = useState<Awaited<ReturnType<typeof analiticaGpt>> | null>(null);

  useEffect(() => {
    fn().then(setData);
  }, []);

  if (!data) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Consultas (30 días)" value={data.total} />
        <Stat label="Sin respuesta" value={data.sin_respuesta} tone="warn" />
        <Stat
          label="% resueltas"
          value={data.total ? `${Math.round(((data.total - data.sin_respuesta) / data.total) * 100)}%` : "—"}
          tone="ok"
        />
        <Stat label="Categorías activas" value={data.top_categorias.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <RankList title="Top categorías" rows={data.top_categorias} />
        <RankList title="Top módulos" rows={data.top_modulos} />
        <RankList title="Top roles" rows={data.top_roles} />
        <RankList title="Top preguntas" rows={data.top_preguntas} />
      </div>

      <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5">
        <h3 className="font-bold text-[#050814] mb-3">Últimas consultas sin respuesta</h3>
        <div className="space-y-2">
          {data.ultimas_sin_respuesta.length === 0 && (
            <div className="text-sm text-[#242424]/50">Todas las consultas tuvieron respuesta.</div>
          )}
          {data.ultimas_sin_respuesta.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm border-b border-[#E3E7EE] pb-2">
              <div className="truncate">{r.pregunta}</div>
              <div className="text-[11px] text-[#242424]/50 shrink-0 ml-3">{new Date(r.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E3E7EE] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">{label}</div>
      <div
        className="text-2xl font-bold mt-1"
        style={{ color: tone === "warn" ? "#B42318" : tone === "ok" ? "#2E7D45" : "#050814" }}
      >
        {value}
      </div>
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: { nombre: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5">
      <h3 className="font-bold text-[#050814] mb-3">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-[#242424]/50">Sin datos.</div>}
        {rows.map((r, i) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className="truncate pr-2">{r.nombre}</span>
              <span className="font-semibold text-[#445DA3]">{r.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#F1F4F9] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(r.count / max) * 100}%`, background: "linear-gradient(90deg,#445DA3,#84B98F)" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
