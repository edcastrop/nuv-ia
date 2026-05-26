import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, CheckCircle2, XCircle } from "lucide-react";
import {
  getEvaluacion, getPreguntas, getModulo, guardarIntento, intentarEmitirCertificado,
  calificar, type Evaluacion, type Pregunta,
} from "@/lib/academia";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/academia/evaluaciones/$evaluacionId")({
  component: EvaluacionView,
  head: () => ({ meta: [{ title: "Evaluación · Academia NUVEX" }] }),
});

const VERDE = "#84B98F";
const ROJO = "#E11D48";

function EvaluacionView() {
  const { evaluacionId } = useParams({ from: "/_authenticated/academia/evaluaciones/$evaluacionId" });
  const [evaluacion, setEvaluacion] = useState<Evaluacion | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<string, (string | number)[]>>({});
  const [resultado, setResultado] = useState<{ porcentaje: number; aprobado: boolean; nota: number; total: number; certCodigo?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [cursoId, setCursoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const e = await getEvaluacion(evaluacionId);
      setEvaluacion(e);
      if (e) {
        const [pgs, mod] = await Promise.all([getPreguntas(e.id), getModulo(e.modulo_id)]);
        setPreguntas(pgs);
        if (mod) setCursoId(mod.curso_id);
      }
      setLoading(false);
    })();
  }, [evaluacionId]);

  if (loading) return <div className="p-12 text-center text-sm text-white/60" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Cargando…</div>;
  if (!evaluacion) return <div className="p-12 text-center text-sm text-white/70" style={{ background: "#050816", minHeight: "calc(100vh - 92px)" }}>Evaluación no encontrada.</div>;

  const toggle = (pid: string, val: string | number, tipo: string) => {
    setRespuestas((prev) => {
      const cur = prev[pid] ?? [];
      if (tipo === "multiple") {
        const exists = cur.includes(val);
        return { ...prev, [pid]: exists ? cur.filter((v) => v !== val) : [...cur, val] };
      }
      return { ...prev, [pid]: [val] };
    });
  };

  const enviar = async () => {
    setEnviando(true);
    const r = calificar(preguntas, respuestas);
    const aprobado = r.porcentaje >= Number(evaluacion.nota_minima);
    await guardarIntento({
      evaluacionId: evaluacion.id,
      respuestas: respuestas as unknown as Record<string, unknown>,
      nota: r.nota,
      porcentaje: r.porcentaje,
      aprobado,
    });
    let certCodigo: string | null = null;
    if (aprobado && cursoId) {
      const certId = await intentarEmitirCertificado(cursoId);
      if (certId) {
        const { data } = await (supabase as unknown as { from: (t: string) => any }).from("academia_certificaciones").select("codigo").eq("id", certId).maybeSingle();
        certCodigo = (data as { codigo?: string } | null)?.codigo ?? null;
      }
    }
    setResultado({ ...r, aprobado, certCodigo });
    setEnviando(false);
  };

  return (
    <div className="relative min-h-[calc(100vh-92px)]" style={{ background: "#050816" }}>
      <div className="mx-auto max-w-[900px] px-6 py-10 space-y-6">
        <Link to="/academia/modulos/$moduloId" params={{ moduloId: evaluacion.modulo_id }} className="inline-flex items-center gap-2 text-[12px] text-white/60 hover:text-white">
          <ArrowLeft size={14} /> Volver al módulo
        </Link>

        <header className="space-y-1">
          <h1 className="text-3xl font-semibold text-white">{evaluacion.titulo}</h1>
          <p className="text-[12px] text-white/55">Nota mínima para aprobar: {evaluacion.nota_minima}%</p>
        </header>

        {resultado ? (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: resultado.aprobado ? `${VERDE}66` : `${ROJO}66`, background: resultado.aprobado ? `${VERDE}10` : `${ROJO}10` }}>
            {resultado.aprobado
              ? <CheckCircle2 size={48} style={{ color: VERDE }} className="mx-auto" />
              : <XCircle size={48} style={{ color: ROJO }} className="mx-auto" />}
            <div className="mt-3 text-3xl font-semibold text-white">{resultado.porcentaje}%</div>
            <div className="mt-1 text-sm text-white/70">{resultado.nota.toFixed(2)} / {resultado.total.toFixed(2)} pts</div>
            <div className="mt-2 text-base font-semibold" style={{ color: resultado.aprobado ? VERDE : ROJO }}>
              {resultado.aprobado ? "Aprobado" : "Reprobado"}
            </div>
            {resultado.certCodigo && (
              <Link to="/academia/certificados/$codigo" params={{ codigo: resultado.certCodigo }}
                className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
                style={{ background: "#C9A84C" }}>
                <Award size={14} /> Ver certificado
              </Link>
            )}
          </div>
        ) : preguntas.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-sm text-white/60">No hay preguntas configuradas.</div>
        ) : (
          <div className="space-y-5">
            {preguntas.map((p, i) => {
              const opciones = p.tipo === "verdadero_falso" ? ["Verdadero", "Falso"] : p.opciones;
              const seleccion = respuestas[p.id] ?? [];
              return (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-[13px] font-semibold text-white">{i + 1}. {p.enunciado}</div>
                  <div className="mt-3 space-y-2">
                    {opciones.map((op, idx) => {
                      const val = p.tipo === "verdadero_falso" ? (op === "Verdadero") ? "true" : "false" : idx;
                      const checked = seleccion.map(String).includes(String(val));
                      return (
                        <label key={idx} className="flex items-center gap-3 rounded-lg border border-white/10 px-3 py-2 cursor-pointer hover:bg-white/[0.04]"
                          style={{ background: checked ? "rgba(132,185,143,0.10)" : undefined, borderColor: checked ? "#84B98F66" : undefined }}>
                          <input
                            type={p.tipo === "multiple" ? "checkbox" : "radio"}
                            name={p.id}
                            checked={checked}
                            onChange={() => toggle(p.id, val, p.tipo)}
                          />
                          <span className="text-[13px] text-white/85">{op}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <button
              onClick={enviar} disabled={enviando}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #445DA3, #84B98F)" }}
            >
              {enviando ? "Enviando…" : "Enviar evaluación"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
