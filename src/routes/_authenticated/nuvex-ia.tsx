import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles, Send, Loader2, TrendingUp, FileCheck2, AlertTriangle,
  Wallet, Receipt, Clock, ArrowRight, Bot, User as UserIcon, AlertCircle,
} from "lucide-react";
import { getMetricasIA, getAlertasInteligentes, consultarIA } from "@/lib/nuvex-ia.functions";
import { EscalarTicketDialog } from "@/components/nuvex-gpt/EscalarTicketDialog";

export const Route = createFileRoute("/_authenticated/nuvex-ia")({
  component: NuvexIAPage,
  head: () => ({ meta: [{ title: "NUVEX IA Operativa" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

const EJEMPLOS = [
  "¿Cómo va el caso de Adriana Vargas?",
  "¿Cuántos casos aprobados tengo?",
  "¿Qué clientes deben honorarios?",
  "¿Cuánto tengo disponible para cobrar?",
  "¿Qué expedientes están incompletos?",
];

const SUGERENCIAS = [
  "Casos aprobados este mes",
  "Honorarios pendientes",
  "Cuentas de cobro pendientes",
  "Casos sin movimiento",
  "Comisiones pendientes",
  "Expedientes incompletos",
];

type Mensaje = { rol: "user" | "ai"; texto: string; filas?: unknown[]; escalable?: boolean; preguntaOriginal?: string };

function fmtCOP(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
}

function NuvexIAPage() {
  const metricasFn = useServerFn(getMetricasIA);
  const alertasFn = useServerFn(getAlertasInteligentes);
  const consultaFn = useServerFn(consultarIA);

  const { data: metricas } = useQuery({ queryKey: ["nuvex-ia-metricas"], queryFn: () => metricasFn() });
  const { data: alertasData } = useQuery({ queryKey: ["nuvex-ia-alertas"], queryFn: () => alertasFn() });

  const [pregunta, setPregunta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [chat, setChat] = useState<Mensaje[]>([]);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [escalarOpen, setEscalarOpen] = useState(false);
  const [escalarCtx, setEscalarCtx] = useState<{ pregunta: string; respuesta: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIdx((i) => (i + 1) % EJEMPLOS.length), 3500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const enviar = async (texto?: string) => {
    const q = (texto ?? pregunta).trim();
    if (!q || enviando) return;
    setPregunta("");
    setChat((c) => [...c, { rol: "user", texto: q }]);
    setEnviando(true);
    try {
      const res = await consultaFn({ data: { pregunta: q, modulo: "nuvex-ia", origen: "nuvex_ia" } });
      const meta = res.fuente === "kb"
        ? "📚 Respuesta de la base de conocimiento NUVEX (KB)"
        : res.escalable
        ? "⚠️ Sin información suficiente — puedes escalar esta consulta"
        : undefined;
      setChat((c) => [...c, {
        rol: "ai",
        texto: res.respuesta + (meta ? `\n\n*${meta}*` : ""),
        filas: res.filas,
        escalable: res.escalable,
        preguntaOriginal: q,
      }]);
    } catch {
      setChat((c) => [...c, { rol: "ai", texto: "Hubo un error al procesar tu consulta." }]);
    } finally {
      setEnviando(false);
    }
  };

  const alertas = alertasData?.alertas ?? [];

  const Kpi = ({ icon: Icon, label, value, accent }: { icon: typeof Sparkles; label: string; value: string; accent: string }) => (
    <div
      className="relative overflow-hidden rounded-2xl p-4 backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: accent }} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">{label}</div>
          <div className="mt-1.5 text-xl font-bold text-white">{value}</div>
        </div>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
        >
          <Icon size={16} className="text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-[calc(100vh-64px)] relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #050814 0%, #0A1226 50%, #07162D 100%)",
      }}
    >
      {/* Aurora bg */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 -left-32 h-[420px] w-[420px] rounded-full opacity-[0.18] blur-[120px]" style={{ background: AZUL }} />
        <div className="absolute bottom-0 -right-32 h-[420px] w-[420px] rounded-full opacity-[0.14] blur-[120px]" style={{ background: VERDE }} />
        <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] rounded-full opacity-[0.08] blur-[100px]" style={{ background: "#a78bfa" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 py-8 lg:py-10">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4" style={{ background: "rgba(132,185,143,0.12)", border: "1px solid rgba(132,185,143,0.25)" }}>
            <Sparkles size={12} style={{ color: VERDE }} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">Inteligencia Artificial</span>
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold text-white tracking-tight">
            NUVEX <span style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>IA Operativa</span>
          </h1>
          <p className="mt-3 text-sm lg:text-base text-white/60 max-w-2xl mx-auto">
            Consulta cualquier información del sistema utilizando lenguaje natural.
          </p>
        </div>

        {/* Caja de consulta */}
        <div
          className="relative rounded-3xl p-1.5 mb-6 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, ${AZUL}55, ${VERDE}40)`,
          }}
        >
          <div className="rounded-[20px] p-4 lg:p-5" style={{ background: "rgba(8,12,28,0.88)" }}>
            <div className="flex items-end gap-3">
              <textarea
                value={pregunta}
                onChange={(e) => setPregunta(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                rows={2}
                placeholder={EJEMPLOS[placeholderIdx]}
                className="flex-1 resize-none bg-transparent text-white text-[15px] placeholder:text-white/35 outline-none"
              />
              <button
                onClick={() => enviar()}
                disabled={enviando || !pregunta.trim()}
                className="group flex h-11 items-center gap-2 rounded-xl px-4 font-medium text-white text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                  boxShadow: `0 8px 24px -8px ${AZUL}`,
                }}
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                <span>Consultar</span>
              </button>
            </div>
            {/* Sugerencias */}
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  disabled={enviando}
                  className="text-[11px] px-2.5 py-1.5 rounded-full text-white/75 hover:text-white transition disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversación */}
        {chat.length > 0 && (
          <div
            ref={scrollRef}
            className="mb-8 rounded-2xl p-5 max-h-[480px] overflow-y-auto space-y-4 backdrop-blur-xl"
            style={{ background: "rgba(8,12,28,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {chat.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.rol === "user" ? "flex-row-reverse" : ""}`}>
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: m.rol === "ai" ? `linear-gradient(135deg, ${AZUL}, ${VERDE})` : "rgba(255,255,255,0.08)",
                  }}
                >
                  {m.rol === "ai" ? <Bot size={14} className="text-white" /> : <UserIcon size={14} className="text-white/70" />}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.rol === "ai" ? "text-white/90" : "text-white"}`}
                  style={{
                    background: m.rol === "ai" ? "rgba(255,255,255,0.04)" : `linear-gradient(135deg, ${AZUL}33, ${VERDE}22)`,
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {m.rol === "ai" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*]:!my-1.5">
                      <ReactMarkdown>{m.texto}</ReactMarkdown>
                    </div>
                  ) : m.texto}
                  {m.rol === "ai" && m.filas && m.filas.length > 0 && (
                    <div className="mt-2 text-[10px] text-white/50">{m.filas.length} registro(s) consultados</div>
                  )}
                  {m.rol === "ai" && m.escalable && (
                    <button
                      onClick={() => {
                        setEscalarCtx({ pregunta: m.preguntaOriginal ?? "", respuesta: m.texto });
                        setEscalarOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition hover:scale-[1.02]"
                      style={{
                        background: "linear-gradient(135deg, #E11D48, #f0d78c)",
                        color: "white",
                        boxShadow: "0 6px 18px -6px rgba(225,29,72,0.55)",
                      }}
                    >
                      <AlertCircle size={12} /> Escalar a ticket
                    </button>
                  )}
                </div>
              </div>
            ))}
            {enviando && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}>
                  <Bot size={14} className="text-white" />
                </div>
                <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Loader2 size={14} className="animate-spin text-white/60" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Métricas IA */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp size={14} style={{ color: VERDE }} />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Métricas IA</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={FileCheck2} label="Casos activos" value={String(metricas?.activos ?? "—")} accent={AZUL} />
            <Kpi icon={FileCheck2} label="Aprobados" value={String(metricas?.aprobados ?? "—")} accent={VERDE} />
            <Kpi icon={Wallet} label="Honorarios pend." value={metricas ? fmtCOP(metricas.honorariosPendientes) : "—"} accent="#e85d3a" />
            <Kpi icon={Receipt} label="Facturación mes" value={metricas ? fmtCOP(metricas.facturacionMes) : "—"} accent="#a78bfa" />
            <Kpi icon={Wallet} label="Comisiones pend." value={metricas ? fmtCOP(metricas.comisionesPendientes) : "—"} accent="#f0d78c" />
            <Kpi icon={Clock} label="Estancados" value={String(metricas?.estancados ?? "—")} accent="#E11D48" />
          </div>
        </div>

        {/* Alertas Inteligentes */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle size={14} style={{ color: "#f0d78c" }} />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">Alertas Inteligentes</h2>
          </div>
          {alertas.length === 0 ? (
            <div
              className="rounded-2xl p-6 text-center text-sm text-white/55 backdrop-blur-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              No hay alertas activas en este momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alertas.map((a) => {
                const sevColor = a.severidad === "alta" ? "#E11D48" : a.severidad === "media" ? "#f0d78c" : VERDE;
                return (
                  <div
                    key={a.tipo}
                    className="relative overflow-hidden rounded-2xl p-4 backdrop-blur-xl group cursor-pointer transition hover:scale-[1.01]"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="absolute top-0 left-0 h-full w-1" style={{ background: sevColor }} />
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: `${sevColor}22`, color: sevColor }}>
                            {a.severidad}
                          </span>
                          <span className="text-[11px] font-bold text-white/90">{a.cantidad}</span>
                        </div>
                        <div className="text-sm font-semibold text-white">{a.titulo}</div>
                        <div className="text-[11px] text-white/55 mt-0.5">{a.descripcion}</div>
                      </div>
                      <ArrowRight size={14} className="text-white/30 group-hover:text-white/70 transition mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <EscalarTicketDialog
        open={escalarOpen}
        onOpenChange={setEscalarOpen}
        conversacionId={null}
        preFillDescripcion={
          escalarCtx
            ? `Consulta original:\n${escalarCtx.pregunta}\n\nRespuesta NUVEX IA:\n${escalarCtx.respuesta}`
            : ""
        }
      />
    </div>
  );
}
