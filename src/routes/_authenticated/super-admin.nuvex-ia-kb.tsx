import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUserRole } from "@/hooks/useUserRole";
import {
  kbList, kbUpsert, kbDelete, kbAnalitica, kbAnaliticaExport,
} from "@/lib/nuvex-kb-admin.functions";

export const Route = createFileRoute("/_authenticated/super-admin/nuvex-ia-kb")({
  component: AdminKB,
  head: () => ({ meta: [{ title: "NUVEX IA · Base de conocimiento" }] }),
});

type Tab = "kb" | "analitica";

const CATEGORIAS_SUGERIDAS = [
  "Ley 546", "Decreto 583", "Matemática financiera", "Simulador",
  "Honorarios", "Cuentas de cobro", "Cartera", "Comisiones",
  "Proceso jurídico", "Operaciones", "Contratación", "Radicación",
  "QA proyecciones", "Apoderados", "Academia", "Roles y permisos",
  "Notificaciones", "Cuentas receptoras", "Pagos Wompi", "Auditoría",
  "Soporte interno", "FAQ clientes", "Otros",
];

function AdminKB() {
  const { isSuperAdmin, loading } = useUserRole();
  const [tab, setTab] = useState<Tab>("kb");

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <div className="p-12 text-center text-sm text-[#B42318]">No autorizado.</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#050814]">NUVEX IA · Base de Conocimiento</h1>
        <p className="text-sm text-[#242424]/60">
          Cerebro único de NUVEX IA. Cada respuesta de KB se entrega con cero tokens.
        </p>
      </div>

      <div className="flex gap-2 border-b border-[#E3E7EE] mb-6">
        {[
          { k: "kb", label: "Artículos" },
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
      {tab === "analitica" && <AnaliticaTab />}
    </div>
  );
}

function KbTab() {
  const listFn = useServerFn(kbList);
  const upsertFn = useServerFn(kbUpsert);
  const deleteFn = useServerFn(kbDelete);

  const [rows, setRows] = useState<Awaited<ReturnType<typeof kbList>>>([]);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<null | {
    id?: string;
    categoria: string;
    pregunta: string;
    respuesta: string;
    tags: string;
    audiencias: ("interno" | "apoderado" | "cliente" | "publico")[];
    estado: "activo" | "borrador" | "archivado";
  }>(null);


  const reload = async () => setRows(await listFn());
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      r.pregunta.toLowerCase().includes(q) ||
      r.categoria.toLowerCase().includes(q) ||
      (r.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  const handleSave = async () => {
    if (!editing) return;
    await upsertFn({

      data: {
        id: editing.id,
        categoria: editing.categoria.trim(),
        pregunta: editing.pregunta.trim(),
        respuesta: editing.respuesta.trim(),
        tags: editing.tags.split(",").map((t) => t.trim()).filter(Boolean),
        audiencias: editing.audiencias,
        estado: editing.estado,
      },
    });
    setEditing(null);
    reload();
  };


  return (
    <div className="grid lg:grid-cols-[1fr_440px] gap-6">
      <div className="bg-white rounded-2xl border border-[#E3E7EE] overflow-hidden">
        <div className="p-4 border-b border-[#E3E7EE] flex items-center gap-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar por pregunta, categoría o tag…"
            className="flex-1 px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
          />
          <button
            onClick={() => setEditing({
              categoria: CATEGORIAS_SUGERIDAS[0],
              pregunta: "",
              respuesta: "",
              tags: "",
              audiencias: ["interno"],
              estado: "activo",
            })}

            className="px-4 py-2 rounded-lg text-white text-sm font-semibold"
            style={{ background: "#445DA3" }}
          >
            + Nuevo artículo
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto divide-y divide-[#E3E7EE]">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#242424]/50">Sin artículos.</div>
          )}
          {filtered.map((a) => (
            <div key={a.id} className="p-4 hover:bg-[#F7F9FB]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        background:
                          a.estado === "activo" ? "rgba(132,185,143,0.15)" :
                          a.estado === "borrador" ? "rgba(245,158,11,0.15)" :
                          "rgba(180,35,24,0.12)",
                        color:
                          a.estado === "activo" ? "#2E7D45" :
                          a.estado === "borrador" ? "#92400E" :
                          "#B42318",
                      }}
                    >
                      {a.estado}
                    </span>
                    <span className="text-[11px] text-[#445DA3] font-semibold">{a.categoria}</span>
                  </div>
                  <div className="font-semibold text-[#050814] text-sm mt-1">{a.pregunta}</div>
                  <div className="text-[11px] text-[#242424]/50 mt-0.5">
                    {(a.tags ?? []).join(" · ") || "sin tags"}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setEditing({
                      id: a.id,
                      categoria: a.categoria,
                      pregunta: a.pregunta,
                      respuesta: a.respuesta,
                      tags: (a.tags ?? []).join(", "),
                      audiencias: ((a.audiencias ?? ["interno"]) as ("interno" | "apoderado" | "cliente" | "publico")[]),
                      estado: a.estado as "activo" | "borrador" | "archivado",
                    })}

                    className="text-xs px-3 py-1.5 rounded-lg border border-[#E3E7EE] hover:bg-white"
                  >
                    Editar
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("¿Eliminar artículo?")) return;
                      await deleteFn({ data: { id: a.id } });
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
          <h3 className="font-bold text-[#050814] mb-4">
            {editing.id ? "Editar artículo" : "Nuevo artículo"}
          </h3>
          <div className="space-y-3">
            <Field label="Categoría">
              <input
                list="kb-categorias"
                value={editing.categoria}
                onChange={(e) => setEditing({ ...editing, categoria: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              />
              <datalist id="kb-categorias">
                {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Pregunta">
              <input
                value={editing.pregunta}
                onChange={(e) => setEditing({ ...editing, pregunta: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              />
            </Field>
            <Field label="Respuesta (markdown)">
              <textarea
                value={editing.respuesta}
                onChange={(e) => setEditing({ ...editing, respuesta: e.target.value })}
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
            <Field label="Audiencias (quién puede ver este artículo)">
              <div className="grid grid-cols-2 gap-1.5">
                {(["interno", "apoderado", "cliente", "publico"] as const).map((aud) => {
                  const checked = editing.audiencias.includes(aud);
                  const label =
                    aud === "interno" ? "Interno (staff NUVEX)" :
                    aud === "apoderado" ? "Apoderados" :
                    aud === "cliente" ? "Clientes" :
                    "Público (todos)";
                  return (
                    <label
                      key={aud}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-[#E3E7EE] cursor-pointer hover:bg-[#F7F9FB] text-xs"
                      style={{ background: checked ? "rgba(68,93,163,0.08)" : "white", borderColor: checked ? "#445DA3" : "#E3E7EE" }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...editing.audiencias, aud]
                            : editing.audiencias.filter((x) => x !== aud);
                          setEditing({ ...editing, audiencias: next.length ? next : ["interno"] });
                        }}
                        className="accent-[#445DA3]"
                      />
                      <span className="font-medium text-[#050814]">{label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#242424]/50 mt-1">
                Si marcas "Público", el artículo será visible para todas las audiencias.
              </p>
            </Field>
            <Field label="Estado">
              <select
                value={editing.estado}
                onChange={(e) => setEditing({ ...editing, estado: e.target.value as "activo" | "borrador" | "archivado" })}
                className="w-full px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm"
              >
                <option value="activo">Activo</option>
                <option value="borrador">Borrador</option>
                <option value="archivado">Archivado</option>
              </select>
            </Field>

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

type Filtros = {
  desde?: string; hasta?: string;
  origen?: "nuvex_ia" | "nuvex_gpt" | "cliente";
  fuente?: "kb" | "modelo" | "escalado";
  modulo?: string; rol?: string;
  audiencia?: "interno" | "apoderado" | "cliente" | "publico";
};

function toIsoStart(d: string) { return d ? new Date(d + "T00:00:00").toISOString() : undefined; }
function toIsoEnd(d: string) { return d ? new Date(d + "T23:59:59").toISOString() : undefined; }

function AnaliticaTab() {
  const fn = useServerFn(kbAnalitica);
  const exportFn = useServerFn(kbAnaliticaExport);
  const [data, setData] = useState<Awaited<ReturnType<typeof kbAnalitica>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [desdeStr, setDesdeStr] = useState("");
  const [hastaStr, setHastaStr] = useState("");
  const [origen, setOrigen] = useState<string>("");
  const [fuente, setFuente] = useState<string>("");
  const [audiencia, setAudiencia] = useState<string>("");
  const [modulo, setModulo] = useState("");
  const [rol, setRol] = useState("");

  const buildFiltros = (): Filtros => ({
    desde: toIsoStart(desdeStr),
    hasta: toIsoEnd(hastaStr),
    origen: (origen || undefined) as Filtros["origen"],
    fuente: (fuente || undefined) as Filtros["fuente"],
    audiencia: (audiencia || undefined) as Filtros["audiencia"],
    modulo: modulo.trim() || undefined,
    rol: rol.trim() || undefined,
  });

  const cargar = async () => {
    setLoading(true);
    try { setData(await fn({ data: buildFiltros() })); } finally { setLoading(false); }
  };

  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const exportar = async () => {
    setExporting(true);
    try {
      const { csv } = await exportFn({ data: buildFiltros() });
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nuvex-ia-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally { setExporting(false); }
  };

  const limpiar = () => {
    setDesdeStr(""); setHastaStr(""); setOrigen(""); setFuente("");
    setAudiencia(""); setModulo(""); setRol("");
  };

  const inputCls = "px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm bg-white";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#050814]">Filtros</h3>
          <div className="flex gap-2">
            <button onClick={limpiar} className="px-3 py-2 rounded-lg border border-[#E3E7EE] text-sm">Limpiar</button>
            <button onClick={cargar} disabled={loading}
              className="px-3 py-2 rounded-lg text-sm text-white"
              style={{ background: "#445DA3" }}>
              {loading ? "Cargando…" : "Aplicar"}
            </button>
            <button onClick={exportar} disabled={exporting || !data?.total}
              className="px-3 py-2 rounded-lg text-sm text-white disabled:opacity-50"
              style={{ background: "#2E7D45" }}>
              {exporting ? "Exportando…" : "Exportar CSV"}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Field label="Desde"><input type="date" value={desdeStr} onChange={(e) => setDesdeStr(e.target.value)} className={inputCls} /></Field>
          <Field label="Hasta"><input type="date" value={hastaStr} onChange={(e) => setHastaStr(e.target.value)} className={inputCls} /></Field>
          <Field label="Origen">
            <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="nuvex_ia">nuvex_ia</option>
              <option value="nuvex_gpt">nuvex_gpt</option>
              <option value="cliente">cliente</option>
            </select>
          </Field>
          <Field label="Fuente">
            <select value={fuente} onChange={(e) => setFuente(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              <option value="kb">KB</option>
              <option value="modelo">Modelo</option>
              <option value="escalado">Escalado</option>
            </select>
          </Field>
          <Field label="Audiencia">
            <select value={audiencia} onChange={(e) => setAudiencia(e.target.value)} className={inputCls}>
              <option value="">Todas</option>
              <option value="interno">Interno</option>
              <option value="apoderado">Apoderado</option>
              <option value="cliente">Cliente</option>
              <option value="publico">Público</option>
            </select>
          </Field>
          <Field label="Módulo"><input value={modulo} onChange={(e) => setModulo(e.target.value)} placeholder="ej. cartera" className={inputCls} /></Field>
          <Field label="Rol"><input value={rol} onChange={(e) => setRol(e.target.value)} placeholder="ej. licenciado" className={inputCls} /></Field>
        </div>
      </div>

      {!data ? (
        <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Consultas" value={data.total} />
            <Stat label="Resueltas con KB" value={`${data.total ? Math.round((data.desdeKb / data.total) * 100) : 0}%`} tone="ok" />
            <Stat label="Escaladas" value={data.escalados} tone="warn" />
            <Stat label="Tiempo medio" value={`${data.avgMs} ms`} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <RankList title="Por interfaz (origen)" rows={data.top_origen} />
            <RankList title="Por fuente de respuesta" rows={data.top_fuente} />
            <RankList title="Top módulos" rows={data.top_modulo} />
            <RankList title="Top roles" rows={data.top_rol} />
            <RankList title="Por audiencia" rows={data.top_audiencia} />
          </div>

          <div className="bg-white rounded-2xl border border-[#E3E7EE] p-5">
            <h3 className="font-bold text-[#050814] mb-3">Últimas consultas escaladas</h3>
            <div className="space-y-2">
              {data.ultimas_escaladas.length === 0 && (
                <div className="text-sm text-[#242424]/50">Sin escalamientos recientes.</div>
              )}
              {data.ultimas_escaladas.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-[#E3E7EE] pb-2 last:border-0">
                  <div className="truncate">
                    <span className="text-[11px] text-[#445DA3] font-semibold uppercase mr-2">{r.modulo ?? "—"}</span>
                    {r.pregunta}
                  </div>
                  <div className="text-[11px] text-[#242424]/50 shrink-0 ml-3">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
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
        {rows.map((r) => (
          <div key={r.nombre}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#050814] font-medium">{r.nombre}</span>
              <span className="text-[#242424]/60">{r.count}</span>
            </div>
            <div className="h-1.5 bg-[#F7F9FB] rounded overflow-hidden">
              <div
                className="h-full"
                style={{ width: `${(r.count / max) * 100}%`, background: "#445DA3" }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
