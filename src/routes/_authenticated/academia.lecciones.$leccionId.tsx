import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink } from "lucide-react";
import { getLeccion, marcarLeccionCompletada, listProgresoLecciones, type Leccion } from "@/lib/academia";

export const Route = createFileRoute("/_authenticated/academia/lecciones/$leccionId")({
  component: LeccionView,
  head: () => ({ meta: [{ title: "Lección · Academia NUVEX" }] }),
});

const VERDE = "#84B98F";

function LeccionView() {
  const { leccionId } = useParams({ from: "/_authenticated/academia/lecciones/$leccionId" });
  const navigate = useNavigate();
  const [leccion, setLeccion] = useState<Leccion | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const l = await getLeccion(leccionId);
      setLeccion(l);
      if (l) {
        const s = await listProgresoLecciones([l.id]);
        setDone(s.has(l.id));
      }
      setLoading(false);
    })();
  }, [leccionId]);

  if (loading) return <div className="p-12 text-center text-sm text-white/60" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Cargando…</div>;
  if (!leccion) return <div className="p-12 text-center text-sm text-white/70" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Lección no encontrada.</div>;

  const c = leccion.contenido as Record<string, unknown>;

  return (
    <div className="relative min-h-[calc(100vh-92px)]" style={{ background: "#050816" }}>
      <div className="mx-auto max-w-[900px] px-6 py-10 space-y-8">
        <Link to="/academia/modulos/$moduloId" params={{ moduloId: leccion.modulo_id }} className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white">
          <ArrowLeft size={14} /> Volver al módulo
        </Link>

        <header className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{leccion.tipo}</div>
          <h1 className="text-3xl font-semibold text-white">{leccion.titulo}</h1>
        </header>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-white/85 text-[14.5px] leading-relaxed">
          {renderContenido(leccion.tipo, c)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              await marcarLeccionCompletada(leccion.id);
              setDone(true);
              setTimeout(() => navigate({ to: "/academia/modulos/$moduloId", params: { moduloId: leccion.modulo_id } }), 600);
            }}
            disabled={done}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold transition disabled:opacity-60"
            style={{ background: done ? `${VERDE}33` : `linear-gradient(135deg, ${VERDE}, #5a9c70)`, color: "#fff", border: `1px solid ${VERDE}` }}
          >
            <CheckCircle2 size={14} /> {done ? "Completada" : "Marcar como completada"}
          </button>
        </div>
      </div>
    </div>
  );
}

function renderContenido(tipo: string, c: Record<string, unknown>) {
  const cuerpo = typeof c.cuerpo === "string" ? c.cuerpo : "";
  const url = typeof c.url === "string" ? c.url : "";
  const items = Array.isArray(c.items) ? (c.items as string[]) : [];

  switch (tipo) {
    case "texto":
      return <div className="whitespace-pre-wrap">{cuerpo || <em className="text-white/50">Sin contenido aún.</em>}</div>;
    case "pdf":
      return url ? (
        <iframe src={url} className="w-full h-[600px] rounded-lg bg-white" title={tipo} />
      ) : <em className="text-white/50">PDF no configurado.</em>;
    case "video":
      return url ? (
        <div className="aspect-video"><iframe src={url} className="w-full h-full rounded-lg" allowFullScreen title="video" /></div>
      ) : <em className="text-white/50">Video no configurado.</em>;
    case "imagen":
      return url ? <img src={url} alt={tipo} className="w-full rounded-lg" /> : <em className="text-white/50">Imagen no configurada.</em>;
    case "checklist":
      return (
        <ul className="space-y-2">
          {items.length === 0 && <em className="text-white/50">Sin ítems.</em>}
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2"><CheckCircle2 size={14} className="mt-0.5" style={{ color: VERDE }} /><span>{it}</span></li>
          ))}
        </ul>
      );
    case "enlace":
      return url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#84B98F] hover:underline">
          {cuerpo || url} <ExternalLink size={13} />
        </a>
      ) : <em className="text-white/50">Sin URL.</em>;
    case "faq": {
      const faqs = Array.isArray(c.faqs) ? (c.faqs as { q: string; a: string }[]) : [];
      return (
        <div className="space-y-3">
          {faqs.length === 0 && <em className="text-white/50">Sin preguntas.</em>}
          {faqs.map((f, i) => (
            <div key={i}>
              <div className="font-semibold text-white">{f.q}</div>
              <div className="text-white/70 mt-1">{f.a}</div>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <em className="text-white/50">Tipo no soportado.</em>;
  }
}
