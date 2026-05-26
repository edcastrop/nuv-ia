import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, BookOpen, Trophy, CheckCircle2, Clock, Award } from "lucide-react";
import {
  type Curso, type Modulo, type Leccion, type Evaluacion, type Certificacion,
  getMyAcademiaRol, getCursoByRol, getModulos, getLecciones, getEvaluaciones,
  listProgresoLecciones, listMisIntentos, listMisCertificaciones, ROL_LABEL,
} from "@/lib/academia";

export const Route = createFileRoute("/_authenticated/academia/")({
  component: AcademiaHome,
  head: () => ({ meta: [{ title: "Academia NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

interface ModuloFull extends Modulo {
  lecciones: Leccion[];
  evaluaciones: Evaluacion[];
  leccionesCompletadas: number;
  evalsAprobadas: number;
}

function AcademiaHome() {
  const [loading, setLoading] = useState(true);
  const [curso, setCurso] = useState<Curso | null>(null);
  const [rolLabel, setRolLabel] = useState<string>("");
  const [modulos, setModulos] = useState<ModuloFull[]>([]);
  const [certs, setCerts] = useState<Certificacion[]>([]);

  useEffect(() => {
    (async () => {
      const rol = await getMyAcademiaRol();
      if (!rol) { setLoading(false); return; }
      setRolLabel(ROL_LABEL[rol]);
      const c = await getCursoByRol(rol);
      setCurso(c);
      if (!c) { setLoading(false); return; }
      const mods = await getModulos(c.id);
      const full: ModuloFull[] = [];
      const allLeccionIds: string[] = [];
      const allEvalIds: string[] = [];
      const perMod: { mod: Modulo; lecs: Leccion[]; evs: Evaluacion[] }[] = [];
      for (const m of mods) {
        const [lecs, evs] = await Promise.all([getLecciones(m.id), getEvaluaciones(m.id)]);
        perMod.push({ mod: m, lecs, evs });
        lecs.forEach((l) => allLeccionIds.push(l.id));
        evs.forEach((e) => allEvalIds.push(e.id));
      }
      const [progreso, intentos, miscerts] = await Promise.all([
        listProgresoLecciones(allLeccionIds),
        listMisIntentos(allEvalIds),
        listMisCertificaciones(),
      ]);
      const evalsAprobMap = new Set(intentos.filter((i) => i.aprobado).map((i) => i.evaluacion_id));
      for (const { mod, lecs, evs } of perMod) {
        full.push({
          ...mod,
          lecciones: lecs,
          evaluaciones: evs,
          leccionesCompletadas: lecs.filter((l) => progreso.has(l.id)).length,
          evalsAprobadas: evs.filter((e) => evalsAprobMap.has(e.id)).length,
        });
      }
      setModulos(full);
      setCerts(miscerts);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-sm text-white/60" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Cargando academia…</div>;
  }

  if (!curso) {
    return (
      <div className="p-12 text-center text-sm text-white/70" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>
        Aún no hay un curso publicado para tu rol.
      </div>
    );
  }

  const totalLecciones = modulos.reduce((a, m) => a + m.lecciones.length, 0);
  const lecCompl = modulos.reduce((a, m) => a + m.leccionesCompletadas, 0);
  const totalEvals = modulos.reduce((a, m) => a + m.evaluaciones.length, 0);
  const evalsAprob = modulos.reduce((a, m) => a + m.evalsAprobadas, 0);
  const modCompletados = modulos.filter((m) => m.lecciones.length > 0 && m.leccionesCompletadas === m.lecciones.length).length;
  const progresoPct = totalLecciones > 0 ? Math.round((lecCompl / totalLecciones) * 100) : 0;

  return (
    <div className="relative min-h-[calc(100vh-92px)] overflow-hidden" style={{ background: "#050816" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[500px] w-[700px] rounded-full opacity-[0.10] blur-[140px]" style={{ background: AZUL }} />
        <div className="absolute top-40 right-1/4 h-[500px] w-[700px] rounded-full opacity-[0.08] blur-[140px]" style={{ background: VERDE }} />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 py-10 space-y-10">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ background: `${VERDE}22`, border: `1px solid ${VERDE}55`, color: VERDE }}>
            <GraduationCap size={12} /> {rolLabel}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-white">{curso.titulo}</h1>
          {curso.descripcion && <p className="max-w-3xl text-[15px] text-white/65">{curso.descripcion}</p>}
        </header>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Progreso" value={`${progresoPct}%`} color={VERDE} />
          <Stat label="Módulos completados" value={`${modCompletados}/${modulos.length}`} />
          <Stat label="Lecciones pendientes" value={`${totalLecciones - lecCompl}`} />
          <Stat label="Evaluaciones aprobadas" value={`${evalsAprob}/${totalEvals}`} />
          <Stat label="Certificaciones" value={`${certs.length}`} color="#C9A84C" />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Módulos</h2>
          {modulos.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-white/60">
              El Super Admin aún no ha publicado módulos para este curso.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulos.map((m, i) => {
                const total = m.lecciones.length;
                const pct = total > 0 ? Math.round((m.leccionesCompletadas / total) * 100) : 0;
                return (
                  <Link key={m.id} to="/academia/modulos/$moduloId" params={{ moduloId: m.id }}
                    className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-white/20">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: `linear-gradient(135deg, ${AZUL}33, ${VERDE}22)`, border: `1px solid ${AZUL}55` }}>
                        <BookOpen size={18} className="text-white" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Módulo {i + 1}</span>
                    </div>
                    <div className="mt-4 text-[15px] font-semibold text-white">{m.titulo}</div>
                    {m.descripcion && <div className="mt-1 text-[12.5px] text-white/55 line-clamp-2">{m.descripcion}</div>}
                    <div className="mt-4 flex items-center gap-3 text-[11px] text-white/50">
                      <span className="inline-flex items-center gap-1"><Clock size={11} /> {total} lecc.</span>
                      <span className="inline-flex items-center gap-1"><Trophy size={11} /> {m.evaluaciones.length} eval.</span>
                      <span className="inline-flex items-center gap-1"><CheckCircle2 size={11} /> {m.leccionesCompletadas}/{total}</span>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${AZUL}, ${VERDE})` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {certs.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Mis certificaciones</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {certs.map((c) => (
                <Link key={c.id} to="/academia/certificados/$codigo" params={{ codigo: c.codigo }}
                  className="flex items-center gap-4 rounded-2xl border border-[#C9A84C]/40 bg-[#C9A84C]/[0.08] p-5 transition hover:bg-[#C9A84C]/[0.12]">
                  <Award size={28} style={{ color: "#C9A84C" }} />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{c.codigo}</div>
                    <div className="text-[11px] text-white/55">Nota final: {c.nota_final}% · {new Date(c.emitida_at).toLocaleDateString()}</div>
                  </div>
                  <span className="text-[11px] text-white/60">Ver →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: color ?? "#fff" }}>{value}</div>
    </div>
  );
}
