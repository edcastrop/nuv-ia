import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronRight, Save, ArrowLeft, Layers, BarChart3, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  listCursos, getModulos, getLecciones, getEvaluaciones, getPreguntas,
  ROL_LIST, ROL_LABEL, type Curso, type Modulo, type Leccion, type Evaluacion, type Pregunta,
  type AcademiaRol, type LeccionTipo, type PreguntaTipo,
} from "@/lib/academia";
import { LessonContentEditor } from "@/components/academia/LessonContentEditor";
import { SeguimientoPanel } from "@/components/academia/SeguimientoPanel";
import { CertificadosPanel } from "@/components/academia/CertificadosPanel";

export const Route = createFileRoute("/_authenticated/super-admin/academia")({
  component: AdminAcademia,
  head: () => ({ meta: [{ title: "Admin Academia · NUVEX" }] }),
});

const sb = supabase as unknown as { from: (t: string) => any };

type Tab = "contenido" | "seguimiento" | "certificados";

function AdminAcademia() {
  const { isSuperAdmin, loading: rolesLoading } = useUserRole();
  const [tab, setTab] = useState<Tab>("contenido");
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => { setCursos(await listCursos()); };
  useEffect(() => { (async () => { await reload(); setLoading(false); })(); }, []);

  if (rolesLoading || loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!isSuperAdmin) return <div className="p-12 text-center text-sm text-[#B42318]">No autorizado.</div>;

  const tabs: { id: Tab; label: string; icon: typeof Layers }[] = [
    { id: "contenido", label: "Contenido", icon: Layers },
    { id: "seguimiento", label: "Seguimiento", icon: BarChart3 },
    { id: "certificados", label: "Certificados", icon: Award },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/super-admin" className="inline-flex items-center gap-1 text-[11px] text-[#445DA3] mb-1"><ArrowLeft size={12} /> Super Admin</Link>
          <h1 className="text-2xl font-semibold text-[#0A1226]">Administración de la Academia</h1>
          <div className="text-sm text-[#242424]/60">Gestiona cursos, módulos, lecciones, evaluaciones, inscritos y certificados por rol.</div>
        </div>
        {tab === "contenido" && <CrearCursoButton onCreated={reload} />}
      </div>

      <div className="flex items-center gap-1 border-b border-[#E3E7EE]">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-semibold transition ${active ? "border-[#445DA3] text-[#0A1226]" : "border-transparent text-[#242424]/55 hover:text-[#0A1226]"}`}>
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "contenido" && (
        <div className="space-y-3">
          {cursos.map((c) => <CursoCard key={c.id} curso={c} onChanged={reload} />)}
        </div>
      )}
      {tab === "seguimiento" && <SeguimientoPanel cursos={cursos} />}
      {tab === "certificados" && <CertificadosPanel cursos={cursos} />}
    </div>
  );
}

function CrearCursoButton({ onCreated }: { onCreated: () => void }) {
  const [rol, setRol] = useState<AcademiaRol>("licenciado");
  const [titulo, setTitulo] = useState("");
  return (
    <div className="flex items-center gap-2">
      <select value={rol} onChange={(e) => setRol(e.target.value as AcademiaRol)} className="rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs">
        {ROL_LIST.map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
      </select>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nuevo curso…" className="rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs w-56" />
      <button
        onClick={async () => {
          if (!titulo.trim()) return;
          await sb.from("academia_cursos").insert({ rol_destino: rol, titulo: titulo.trim(), orden: 999 });
          setTitulo("");
          onCreated();
        }}
        className="inline-flex items-center gap-1 rounded-lg bg-[#445DA3] px-3 py-1.5 text-xs font-semibold text-white">
        <Plus size={12} /> Curso
      </button>
    </div>
  );
}

function CursoCard({ curso, onChanged }: { curso: Curso; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [nuevoModulo, setNuevoModulo] = useState("");
  const [titulo, setTitulo] = useState(curso.titulo);
  const [desc, setDesc] = useState(curso.descripcion ?? "");

  const loadMods = async () => setModulos(await getModulos(curso.id));
  useEffect(() => { if (open) loadMods(); }, [open]);

  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white">
      <div className="flex items-center gap-3 p-4">
        <button onClick={() => setOpen((o) => !o)}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
        <div className="rounded-md bg-[#445DA3]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#445DA3]">{curso.rol_destino}</div>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="flex-1 rounded-lg border border-[#E3E7EE] px-2 py-1 text-sm font-semibold" />
        <button onClick={async () => { await sb.from("academia_cursos").update({ activo: !curso.activo }).eq("id", curso.id); onChanged(); }} title={curso.activo ? "Activo" : "Inactivo"}>
          {curso.activo ? <ToggleRight size={20} className="text-[#1F7A45]" /> : <ToggleLeft size={20} className="text-[#242424]/40" />}
        </button>
        <button onClick={async () => { await sb.from("academia_cursos").update({ titulo, descripcion: desc }).eq("id", curso.id); onChanged(); }} className="inline-flex items-center gap-1 rounded-lg bg-[#0A1226] px-3 py-1.5 text-xs font-semibold text-white"><Save size={12} /> Guardar</button>
        <button onClick={async () => { if (confirm("¿Eliminar curso completo? Esto borra módulos, lecciones y evaluaciones.")) { await sb.from("academia_cursos").delete().eq("id", curso.id); onChanged(); } }}><Trash2 size={14} className="text-[#B42318]" /></button>
      </div>
      {open && (
        <div className="border-t border-[#E3E7EE] p-4 space-y-3 bg-[#F7F9FB]">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción del curso" className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs" rows={2} />

          <div className="flex items-center gap-2">
            <input value={nuevoModulo} onChange={(e) => setNuevoModulo(e.target.value)} placeholder="Nuevo módulo…" className="flex-1 rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs" />
            <button onClick={async () => {
              if (!nuevoModulo.trim()) return;
              await sb.from("academia_modulos").insert({ curso_id: curso.id, titulo: nuevoModulo.trim(), orden: modulos.length + 1 });
              setNuevoModulo(""); loadMods();
            }} className="inline-flex items-center gap-1 rounded-lg bg-[#445DA3] px-3 py-1.5 text-xs font-semibold text-white"><Plus size={12} /> Módulo</button>
          </div>

          {modulos.map((m) => <ModuloEditor key={m.id} modulo={m} onChanged={loadMods} />)}
        </div>
      )}
    </div>
  );
}

function ModuloEditor({ modulo, onChanged }: { modulo: Modulo; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(modulo.titulo);
  const [desc, setDesc] = useState(modulo.descripcion ?? "");
  const [lecciones, setLecciones] = useState<Leccion[]>([]);
  const [evals, setEvals] = useState<Evaluacion[]>([]);

  const load = async () => {
    setLecciones(await getLecciones(modulo.id));
    setEvals(await getEvaluaciones(modulo.id));
  };
  useEffect(() => { if (open) load(); }, [open]);

  return (
    <div className="rounded-lg border border-[#E3E7EE] bg-white">
      <div className="flex items-center gap-2 p-3">
        <button onClick={() => setOpen((o) => !o)}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="flex-1 rounded border border-[#E3E7EE] px-2 py-1 text-xs" />
        <button onClick={async () => { await sb.from("academia_modulos").update({ titulo, descripcion: desc }).eq("id", modulo.id); onChanged(); }} className="text-[11px] text-[#445DA3] font-semibold">Guardar</button>
        <button onClick={async () => { if (confirm("¿Eliminar módulo?")) { await sb.from("academia_modulos").delete().eq("id", modulo.id); onChanged(); } }}><Trash2 size={12} className="text-[#B42318]" /></button>
      </div>
      {open && (
        <div className="border-t border-[#E3E7EE] p-3 space-y-3 bg-[#FAFBFD]">
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción" className="w-full rounded border border-[#E3E7EE] px-2 py-1 text-xs" />

          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60">Lecciones</div>
            {lecciones.map((l) => <LeccionEditor key={l.id} leccion={l} onChanged={load} />)}
            <NuevaLeccion moduloId={modulo.id} onCreated={load} />
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60">Evaluaciones</div>
            {evals.map((e) => <EvalEditor key={e.id} evaluacion={e} onChanged={load} />)}
            <NuevaEvaluacion moduloId={modulo.id} onCreated={load} />
          </div>
        </div>
      )}
    </div>
  );
}

function NuevaLeccion({ moduloId, onCreated }: { moduloId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<LeccionTipo>("texto");
  return (
    <div className="flex items-center gap-2 pt-1">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva lección…" className="flex-1 rounded border border-[#E3E7EE] px-2 py-1 text-xs" />
      <select value={tipo} onChange={(e) => setTipo(e.target.value as LeccionTipo)} className="rounded border border-[#E3E7EE] px-2 py-1 text-xs">
        {["texto","pdf","video","imagen","checklist","enlace","faq"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <button onClick={async () => {
        if (!titulo.trim()) return;
        await sb.from("academia_lecciones").insert({ modulo_id: moduloId, titulo: titulo.trim(), tipo, orden: 999, contenido: {} });
        setTitulo(""); onCreated();
      }} className="inline-flex items-center gap-1 rounded bg-[#84B98F] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={10} /> Lección</button>
    </div>
  );
}

function LeccionEditor({ leccion, onChanged }: { leccion: Leccion; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [tipo, setTipo] = useState<LeccionTipo>(leccion.tipo);
  const [duracion, setDuracion] = useState(leccion.duracion_min);
  const [contenido, setContenido] = useState<Record<string, unknown>>(leccion.contenido ?? {});
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setGuardando(true);
    await sb.from("academia_lecciones").update({ titulo, tipo, duracion_min: duracion, contenido }).eq("id", leccion.id);
    setGuardando(false);
    onChanged();
  };

  return (
    <div className="rounded border border-[#E3E7EE] bg-white">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={() => setOpen((o) => !o)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
        <span className="rounded bg-[#445DA3]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#445DA3]">{leccion.tipo}</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="flex-1 rounded border border-[#E3E7EE] px-1 py-0.5 text-[11px]" />
        <button onClick={async () => { if (confirm("¿Eliminar lección?")) { await sb.from("academia_lecciones").delete().eq("id", leccion.id); onChanged(); } }}><Trash2 size={11} className="text-[#B42318]" /></button>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[#E3E7EE] p-3 bg-[#FAFBFD]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold uppercase text-[#242424]/55">Tipo</span>
              <select value={tipo} onChange={(e) => { setTipo(e.target.value as LeccionTipo); setContenido({}); }} className="rounded border border-[#E3E7EE] px-2 py-1 text-[11px]">
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="imagen">Imagen</option>
                <option value="texto">Texto</option>
                <option value="checklist">Checklist</option>
                <option value="faq">FAQ</option>
                <option value="enlace">Enlace</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-semibold uppercase text-[#242424]/55">Duración</span>
              <input type="number" value={duracion} onChange={(e) => setDuracion(Number(e.target.value) || 0)} className="w-16 rounded border border-[#E3E7EE] px-2 py-1 text-[11px]" />
              <span className="text-[10px] text-[#242424]/50">min</span>
            </div>
          </div>

          <LessonContentEditor leccionId={leccion.id} tipo={tipo} value={contenido} onChange={setContenido} />

          <div className="flex items-center justify-end">
            <button onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1 rounded bg-[#0A1226] px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
              <Save size={11} /> {guardando ? "Guardando…" : "Guardar lección"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NuevaEvaluacion({ moduloId, onCreated }: { moduloId: string; onCreated: () => void }) {
  const [titulo, setTitulo] = useState("");
  return (
    <div className="flex items-center gap-2 pt-1">
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nueva evaluación…" className="flex-1 rounded border border-[#E3E7EE] px-2 py-1 text-xs" />
      <button onClick={async () => {
        if (!titulo.trim()) return;
        await sb.from("academia_evaluaciones").insert({ modulo_id: moduloId, titulo: titulo.trim() });
        setTitulo(""); onCreated();
      }} className="inline-flex items-center gap-1 rounded bg-[#445DA3] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={10} /> Evaluación</button>
    </div>
  );
}

function EvalEditor({ evaluacion, onChanged }: { evaluacion: Evaluacion; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState(evaluacion.titulo);
  const [nota, setNota] = useState(evaluacion.nota_minima);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);

  const load = async () => setPreguntas(await getPreguntas(evaluacion.id));
  useEffect(() => { if (open) load(); }, [open]);

  return (
    <div className="rounded border border-[#E3E7EE] bg-white">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <button onClick={() => setOpen((o) => !o)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="flex-1 rounded border border-[#E3E7EE] px-1 py-0.5 text-[11px]" />
        <input type="number" value={nota} onChange={(e) => setNota(Number(e.target.value) || 0)} className="w-16 rounded border border-[#E3E7EE] px-1 py-0.5 text-[11px]" />
        <span className="text-[10px] text-[#242424]/50">%</span>
        <button onClick={async () => { await sb.from("academia_evaluaciones").update({ titulo, nota_minima: nota }).eq("id", evaluacion.id); onChanged(); }} className="text-[10px] text-[#445DA3] font-semibold">Guardar</button>
        <button onClick={async () => { if (confirm("¿Eliminar evaluación?")) { await sb.from("academia_evaluaciones").delete().eq("id", evaluacion.id); onChanged(); } }}><Trash2 size={11} className="text-[#B42318]" /></button>
      </div>
      {open && (
        <div className="space-y-2 border-t border-[#E3E7EE] p-2 bg-[#FAFBFD]">
          {preguntas.map((p) => <PreguntaEditor key={p.id} pregunta={p} onChanged={load} />)}
          <NuevaPregunta evaluacionId={evaluacion.id} onCreated={load} />
        </div>
      )}
    </div>
  );
}

function NuevaPregunta({ evaluacionId, onCreated }: { evaluacionId: string; onCreated: () => void }) {
  const [tipo, setTipo] = useState<PreguntaTipo>("unica");
  return (
    <div className="flex items-center gap-2">
      <select value={tipo} onChange={(e) => setTipo(e.target.value as PreguntaTipo)} className="rounded border border-[#E3E7EE] px-2 py-1 text-[11px]">
        <option value="unica">Única</option>
        <option value="multiple">Múltiple</option>
        <option value="verdadero_falso">V/F</option>
      </select>
      <button onClick={async () => {
        const base = tipo === "verdadero_falso" ? { opciones: [], respuesta_correcta: [] } : { opciones: ["Opción 1","Opción 2"], respuesta_correcta: [] };
        await sb.from("academia_preguntas").insert({ evaluacion_id: evaluacionId, enunciado: "Nueva pregunta", tipo, ...base, orden: 999 });
        onCreated();
      }} className="inline-flex items-center gap-1 rounded bg-[#84B98F] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={10} /> Pregunta</button>
    </div>
  );
}

function PreguntaEditor({ pregunta, onChanged }: { pregunta: Pregunta; onChanged: () => void }) {
  const [enunciado, setEnunciado] = useState(pregunta.enunciado);
  const [opciones, setOpciones] = useState((pregunta.opciones ?? []).join("\n"));
  const [correcta, setCorrecta] = useState(JSON.stringify(pregunta.respuesta_correcta ?? []));

  return (
    <div className="rounded border border-[#E3E7EE] bg-white p-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="rounded bg-[#0A1226]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase">{pregunta.tipo}</span>
        <input value={enunciado} onChange={(e) => setEnunciado(e.target.value)} className="flex-1 rounded border border-[#E3E7EE] px-2 py-1 text-[11px]" />
        <button onClick={async () => { if (confirm("¿Eliminar?")) { await sb.from("academia_preguntas").delete().eq("id", pregunta.id); onChanged(); } }}><Trash2 size={11} className="text-[#B42318]" /></button>
      </div>
      {pregunta.tipo !== "verdadero_falso" && (
        <textarea value={opciones} onChange={(e) => setOpciones(e.target.value)} rows={3} className="w-full rounded border border-[#E3E7EE] px-2 py-1 text-[11px]" placeholder="Una opción por línea" />
      )}
      <div className="flex items-center gap-2">
        <input value={correcta} onChange={(e) => setCorrecta(e.target.value)} className="flex-1 rounded border border-[#E3E7EE] px-2 py-1 text-[11px] font-mono" placeholder={pregunta.tipo === "verdadero_falso" ? '["true"] o ["false"]' : '[0] o [0,2]'} />
        <button onClick={async () => {
          let parsed: (string | number)[] = [];
          try { parsed = JSON.parse(correcta); } catch { alert("Respuesta correcta inválida"); return; }
          const opcs = pregunta.tipo === "verdadero_falso" ? [] : opciones.split("\n").map((s) => s.trim()).filter(Boolean);
          await sb.from("academia_preguntas").update({ enunciado, opciones: opcs, respuesta_correcta: parsed }).eq("id", pregunta.id);
          onChanged();
        }} className="inline-flex items-center gap-1 rounded bg-[#0A1226] px-2 py-1 text-[11px] font-semibold text-white"><Save size={10} /> Guardar</button>
      </div>
    </div>
  );
}
