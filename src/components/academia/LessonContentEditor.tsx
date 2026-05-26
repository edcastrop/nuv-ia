import { useState } from "react";
import { Upload, Plus, Trash2, Link as LinkIcon, ExternalLink } from "lucide-react";
import type { LeccionTipo } from "@/lib/academia";
import { subirMaterialAcademia, urlEmbedVideo, detectarProveedorVideo } from "@/lib/academia-storage";

type Contenido = Record<string, unknown>;

interface Props {
  leccionId: string;
  tipo: LeccionTipo;
  value: Contenido;
  onChange: (next: Contenido) => void;
}

const ipt = "w-full rounded border border-[#E3E7EE] bg-white px-2 py-1.5 text-[12px] outline-none focus:border-[#445DA3]";
const lbl = "text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60";

export function LessonContentEditor({ leccionId, tipo, value, onChange }: Props) {
  switch (tipo) {
    case "video": return <VideoEditor value={value} onChange={onChange} />;
    case "pdf": return <FileEditor value={value} onChange={onChange} leccionId={leccionId} accept="application/pdf" label="PDF" />;
    case "imagen": return <FileEditor value={value} onChange={onChange} leccionId={leccionId} accept="image/*" label="Imagen" />;
    case "texto": return <TextoEditor value={value} onChange={onChange} />;
    case "checklist": return <ChecklistEditor value={value} onChange={onChange} />;
    case "faq": return <FAQEditor value={value} onChange={onChange} />;
    case "enlace": return <EnlaceEditor value={value} onChange={onChange} />;
    default: return null;
  }
}

/* ---------------- Video ---------------- */
function VideoEditor({ value, onChange }: { value: Contenido; onChange: (n: Contenido) => void }) {
  const url = String(value.url ?? "");
  const descripcion = String(value.descripcion ?? "");
  const proveedor = url ? detectarProveedorVideo(url) : null;
  return (
    <div className="space-y-2">
      <div>
        <div className={lbl}>URL del video (YouTube, Loom, Vimeo o Drive)</div>
        <input className={ipt} value={url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://www.youtube.com/watch?v=…" />
        {proveedor && <div className="mt-0.5 text-[10px] text-[#445DA3]">Detectado: {proveedor}</div>}
      </div>
      <div>
        <div className={lbl}>Descripción (opcional)</div>
        <textarea rows={2} className={ipt} value={descripcion} onChange={(e) => onChange({ ...value, descripcion: e.target.value })} placeholder="Qué aprenderá el alumno en este video" />
      </div>
      {url && (
        <div className="aspect-video w-full overflow-hidden rounded border border-[#E3E7EE]">
          <iframe src={urlEmbedVideo(url)} className="h-full w-full" allow="autoplay; encrypted-media; fullscreen" />
        </div>
      )}
    </div>
  );
}

/* ---------------- PDF / Imagen (URL externa o subida) ---------------- */
function FileEditor({ value, onChange, leccionId, accept, label }: { value: Contenido; onChange: (n: Contenido) => void; leccionId: string; accept: string; label: string }) {
  const url = String(value.url ?? "");
  const descripcion = String(value.descripcion ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subir = async (f: File) => {
    setErr(null); setSubiendo(true);
    try {
      const u = await subirMaterialAcademia(f, `lecciones/${leccionId}`);
      onChange({ ...value, url: u });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error al subir");
    } finally { setSubiendo(false); }
  };

  return (
    <div className="space-y-2">
      <div>
        <div className={lbl}>URL externa de {label}</div>
        <input className={ipt} value={url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://drive.google.com/…  o  https://dropbox.com/…" />
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[#445DA3] bg-white px-2 py-1 text-[11px] font-semibold text-[#445DA3] hover:bg-[#445DA3]/10">
          <Upload size={11} /> {subiendo ? "Subiendo…" : `Subir ${label} (máx 20 MB)`}
          <input type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f); }} />
        </label>
        {url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#445DA3]"><ExternalLink size={11} /> Abrir</a>}
      </div>
      {err && <div className="text-[10px] text-[#B42318]">{err}</div>}
      <div>
        <div className={lbl}>Descripción (opcional)</div>
        <textarea rows={2} className={ipt} value={descripcion} onChange={(e) => onChange({ ...value, descripcion: e.target.value })} />
      </div>
      {url && label === "Imagen" && <img src={url} alt="" className="max-h-48 rounded border border-[#E3E7EE]" />}
    </div>
  );
}

/* ---------------- Texto enriquecido ---------------- */
function TextoEditor({ value, onChange }: { value: Contenido; onChange: (n: Contenido) => void }) {
  const cuerpo = String(value.cuerpo ?? "");
  return (
    <div className="space-y-1">
      <div className={lbl}>Contenido (soporta Markdown: **negritas**, *cursivas*, listas, links)</div>
      <textarea rows={10} className={`${ipt} font-mono text-[11.5px]`} value={cuerpo} onChange={(e) => onChange({ ...value, cuerpo: e.target.value })} placeholder="Escribe el contenido de la lección…" />
    </div>
  );
}

/* ---------------- Checklist ---------------- */
function ChecklistEditor({ value, onChange }: { value: Contenido; onChange: (n: Contenido) => void }) {
  const items = Array.isArray(value.items) ? (value.items as string[]) : [];
  const setItems = (next: string[]) => onChange({ ...value, items: next });
  return (
    <div className="space-y-1.5">
      <div className={lbl}>Ítems del checklist</div>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-[#242424]/50 w-5">{i + 1}.</span>
          <input className={ipt} value={it} onChange={(e) => { const n = [...items]; n[i] = e.target.value; setItems(n); }} />
          <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-[#B42318]"><Trash2 size={12} /></button>
        </div>
      ))}
      <button onClick={() => setItems([...items, ""])} className="inline-flex items-center gap-1 rounded bg-[#84B98F] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={11} /> Agregar ítem</button>
    </div>
  );
}

/* ---------------- FAQ ---------------- */
function FAQEditor({ value, onChange }: { value: Contenido; onChange: (n: Contenido) => void }) {
  const faqs = Array.isArray(value.faqs) ? (value.faqs as { q: string; a: string }[]) : [];
  const setFaqs = (next: { q: string; a: string }[]) => onChange({ ...value, faqs: next });
  return (
    <div className="space-y-2">
      <div className={lbl}>Preguntas frecuentes</div>
      {faqs.map((f, i) => (
        <div key={i} className="rounded border border-[#E3E7EE] bg-white p-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#242424]/50">FAQ {i + 1}</span>
            <button onClick={() => setFaqs(faqs.filter((_, j) => j !== i))} className="ml-auto text-[#B42318]"><Trash2 size={11} /></button>
          </div>
          <input className={ipt} placeholder="Pregunta" value={f.q} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, q: e.target.value }; setFaqs(n); }} />
          <textarea rows={2} className={ipt} placeholder="Respuesta" value={f.a} onChange={(e) => { const n = [...faqs]; n[i] = { ...f, a: e.target.value }; setFaqs(n); }} />
        </div>
      ))}
      <button onClick={() => setFaqs([...faqs, { q: "", a: "" }])} className="inline-flex items-center gap-1 rounded bg-[#84B98F] px-2 py-1 text-[11px] font-semibold text-white"><Plus size={11} /> Agregar FAQ</button>
    </div>
  );
}

/* ---------------- Enlace ---------------- */
function EnlaceEditor({ value, onChange }: { value: Contenido; onChange: (n: Contenido) => void }) {
  return (
    <div className="space-y-2">
      <div>
        <div className={lbl}>URL del recurso</div>
        <div className="flex items-center gap-2">
          <LinkIcon size={12} className="text-[#445DA3]" />
          <input className={ipt} value={String(value.url ?? "")} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://…" />
        </div>
      </div>
      <div>
        <div className={lbl}>Texto del enlace</div>
        <input className={ipt} value={String(value.texto ?? "")} onChange={(e) => onChange({ ...value, texto: e.target.value })} placeholder="Abrir documento" />
      </div>
      <div>
        <div className={lbl}>Descripción (opcional)</div>
        <textarea rows={2} className={ipt} value={String(value.descripcion ?? "")} onChange={(e) => onChange({ ...value, descripcion: e.target.value })} />
      </div>
    </div>
  );
}
