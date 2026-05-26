import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Video, Image as ImageIcon, ListChecks, Link as LinkIcon, HelpCircle, FileQuestion, CheckCircle2, ClipboardCheck } from "lucide-react";
import {
  getModulo, getLecciones, getEvaluaciones, listProgresoLecciones, listMisIntentos,
  type Modulo, type Leccion, type Evaluacion, type LeccionTipo,
} from "@/lib/academia";

export const Route = createFileRoute("/_authenticated/academia/modulos/$moduloId")({
  component: ModuloView,
  head: () => ({ meta: [{ title: "Módulo · Academia NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

const ICONS: Record<LeccionTipo, typeof FileText> = {
  texto: FileText, pdf: FileText, video: Video, imagen: ImageIcon,
  checklist: ListChecks, enlace: LinkIcon, faq: HelpCircle,
};

function ModuloView() {
  const { moduloId } = useParams({ from: "/_authenticated/academia/modulos/$moduloId" });
  const [loading, setLoading] = useState(true);
  const [modulo, setModulo] = useState<Modulo | null>(null);
  const [lecciones, setLecciones] = useState<Leccion[]>([]);
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [completadas, setCompletadas] = useState<Set<string>>(new Set());
  const [aprobadas, setAprobadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [m, lecs, evs] = await Promise.all([getModulo(moduloId), getLecciones(moduloId), getEvaluaciones(moduloId)]);
      setModulo(m); setLecciones(lecs); setEvaluaciones(evs);
      const [prog, intentos] = await Promise.all([
        listProgresoLecciones(lecs.map((l) => l.id)),
        listMisIntentos(evs.map((e) => e.id)),
      ]);
      setCompletadas(prog);
      setAprobadas(new Set(intentos.filter((i) => i.aprobado).map((i) => i.evaluacion_id)));
      setLoading(false);
    })();
  }, [moduloId]);

  if (loading) return <div className="p-12 text-center text-sm text-white/60" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Cargando…</div>;
  if (!modulo) return <div className="p-12 text-center text-sm text-white/70" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Módulo no encontrado.</div>;

  return (
    <div className="relative min-h-[calc(100vh-92px)]" style={{ background: "#050816" }}>
      <div className="mx-auto max-w-[1100px] px-6 py-10 space-y-8">
        <Link to="/academia" className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white">
          <ArrowLeft size={14} /> Volver a la academia
        </Link>

        <header>
          <h1 className="text-3xl font-semibold text-white">{modulo.titulo}</h1>
          {modulo.descripcion && <p className="mt-2 text-white/65 text-[15px]">{modulo.descripcion}</p>}
        </header>

        <section className="space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Lecciones</h2>
          {lecciones.length === 0 && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/55">No hay lecciones aún.</div>}
          {lecciones.map((l, i) => {
            const Icon = ICONS[l.tipo] ?? FileText;
            const done = completadas.has(l.id);
            return (
              <Link key={l.id} to="/academia/lecciones/$leccionId" params={{ leccionId: l.id }}
                className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${AZUL}22`, border: `1px solid ${AZUL}55` }}>
                  <Icon size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold text-white truncate">{i + 1}. {l.titulo}</div>
                  <div className="text-[11px] text-white/50 capitalize">{l.tipo} · {l.duracion_min} min</div>
                </div>
                {done && <CheckCircle2 size={16} style={{ color: VERDE }} />}
              </Link>
            );
          })}
        </section>

        {evaluaciones.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-white/50">Evaluaciones</h2>
            {evaluaciones.map((e) => {
              const ok = aprobadas.has(e.id);
              return (
                <Link key={e.id} to="/academia/evaluaciones/$evaluacionId" params={{ evaluacionId: e.id }}
                  className="flex items-center gap-4 rounded-xl border p-4 transition hover:bg-white/[0.07]"
                  style={{ borderColor: ok ? `${VERDE}55` : "rgba(255,255,255,0.10)", background: ok ? `${VERDE}10` : "rgba(255,255,255,0.04)" }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${VERDE}22`, border: `1px solid ${VERDE}55` }}>
                    <ClipboardCheck size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13.5px] font-semibold text-white">{e.titulo}</div>
                    <div className="text-[11px] text-white/50">Nota mínima {e.nota_minima}% · {e.intentos_permitidos} intentos</div>
                  </div>
                  {ok ? <span className="text-[11px] font-semibold" style={{ color: VERDE }}>Aprobada</span> : <FileQuestion size={16} className="text-white/40" />}
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
