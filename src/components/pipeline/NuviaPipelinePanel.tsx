// Panel lateral derecho colapsable con NUVIA IA para el pipeline.
// Muestra diagnóstico automático + chat libre con contexto del pipeline.
import { useEffect, useRef, useState } from "react";
import { Sparkles, ChevronRight, Send, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";

export type PipelineCtx = {
  total: number;
  estancados: number;
  promedioDias: number;
  honorarios: number;
  fases: Array<{ id: string; label: string; count: number }>;
  funnel: Array<{ numero: number; titulo: string; count: number; passed: number; pct: number; drop: number }>;
  topEstancados: Array<{ cliente: string; banco: string | null; etapa: string; dias: number; analista: string }>;
  sinAsesor: number;
  duplicados: number;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "nuvex.pipeline.nuvia.open";

export function NuviaPipelinePanel({ contexto }: { contexto: PipelineCtx }) {
  const [open, setOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEY) !== "0";
  });
  const [diagnostico, setDiagnostico] = useState<string>("");
  const [loadingDiag, setLoadingDiag] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    }
  }, [open]);

  const cargarDiagnostico = async () => {
    if (contexto.total === 0) {
      setDiagnostico("_Sin casos visibles. Ajusta filtros para obtener diagnóstico._");
      return;
    }
    setLoadingDiag(true);
    setError(null);
    try {
      const r = await fetch("/api/pipeline-nuvia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "diagnostico", contexto }),
      });
      const j = (await r.json()) as { respuesta?: string; error?: string };
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setDiagnostico(j.respuesta ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoadingDiag(false);
    }
  };

  useEffect(() => {
    if (open && !diagnostico && !loadingDiag && contexto.total > 0) {
      cargarDiagnostico();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contexto.total]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat, diagnostico, loadingDiag]);

  const enviar = async () => {
    const pregunta = input.trim();
    if (!pregunta || sending) return;
    setInput("");
    setChat((c) => [...c, { role: "user", content: pregunta }]);
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/pipeline-nuvia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: "chat", pregunta, contexto }),
      });
      const j = (await r.json()) as { respuesta?: string; error?: string };
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`);
      setChat((c) => [...c, { role: "assistant", content: j.respuesta ?? "" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      setError(msg);
      setChat((c) => [...c, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full border shadow-[0_18px_40px_-12px_rgba(68,93,163,0.65)] transition hover:scale-105"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-blue) 80%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 55%, transparent))",
          borderColor: "color-mix(in oklab, var(--nuvia-accent-green) 55%, transparent)",
          color: "var(--nuvia-text-primary)",
        }}
        title="Abrir NUVIA IA"
        aria-label="Abrir NUVIA IA"
      >
        <Sparkles className="h-6 w-6" />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full opacity-60"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.10) inset, 0 0 28px -4px color-mix(in oklab, var(--nuvia-accent-green) 70%, transparent)",
          }}
        />
      </button>
    );
  }


  return (
    <aside
      className="fixed right-0 top-[56px] z-30 flex h-[calc(100vh-56px)] w-[360px] flex-col border-l border-[var(--nuvia-border)] text-[var(--nuvia-text-primary)] shadow-2xl"
      style={{
        zIndex: 30,
        background:
          "linear-gradient(180deg, var(--nuvia-bg-secondary) 0%, var(--nuvia-bg-primary) 100%)",
      }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-[var(--nuvia-border)] px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-blue) 60%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 40%, transparent))",
            }}
          >
            <Sparkles className="h-4 w-4 text-[var(--nuvia-text-primary)]" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">NUVIA IA</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
              Copiloto Pipeline
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={cargarDiagnostico}
            disabled={loadingDiag}
            title="Re-analizar"
            className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] p-1.5 text-[var(--nuvia-text-secondary)] transition hover:text-[var(--nuvia-text-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingDiag ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setOpen(false)}
            title="Colapsar"
            className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] p-1.5 text-[var(--nuvia-text-secondary)] transition hover:text-[var(--nuvia-text-primary)]"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {/* Snapshot rápido */}
        <div className="mb-3 grid grid-cols-3 gap-1.5 text-center">
          <Mini label="Total" value={contexto.total} />
          <Mini label="Estanc." value={contexto.estancados} danger={contexto.estancados > 0} />
          <Mini label="S/Asign." value={contexto.sinAsesor} warn={contexto.sinAsesor > 0} />
        </div>

        {/* Diagnóstico */}
        <section className="mb-4 rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.025)] p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-accent-green)]">
            <Sparkles className="h-3 w-3" /> Diagnóstico ejecutivo
          </div>
          {loadingDiag ? (
            <div className="flex items-center gap-2 text-xs text-[var(--nuvia-text-secondary)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> NUVIA está leyendo tu pipeline…
            </div>
          ) : diagnostico ? (
            <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_strong]:text-[var(--nuvia-text-primary)] [&_li]:my-0.5">
              <ReactMarkdown>{diagnostico}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-xs text-[var(--nuvia-text-secondary)]">
              Pulsa el ícono ↻ para obtener un diagnóstico.
            </div>
          )}
        </section>

        {/* Chat */}
        {chat.length > 0 && (
          <div className="space-y-2">
            {chat.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-xs ${
                  m.role === "user"
                    ? "ml-6 border border-[color-mix(in_oklab,var(--nuvia-accent-blue)_30%,transparent)] bg-[color-mix(in_oklab,var(--nuvia-accent-blue)_10%,transparent)]"
                    : "mr-6 border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.03)]"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            ))}
            {sending && (
              <div className="mr-6 flex items-center gap-2 rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-[var(--nuvia-text-secondary)]">
                <Loader2 className="h-3 w-3 animate-spin" /> NUVIA piensa…
              </div>
            )}
          </div>
        )}

        {error && !sending && (
          <div className="mt-3 rounded-lg border border-[color-mix(in_oklab,var(--nuvia-danger)_30%,transparent)] bg-[color-mix(in_oklab,var(--nuvia-danger)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--nuvia-danger)]">
            {error}
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--nuvia-border)] p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {[
            "¿Qué casos debo mover hoy?",
            "¿Dónde tengo más caída de conversión?",
            "Sugiéreme reasignaciones",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="rounded-full border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-2 py-0.5 text-[10px] text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-accent-blue)] hover:text-[var(--nuvia-text-primary)]"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-1.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Pregúntale a NUVIA…"
            rows={2}
            className="nuvia-input flex-1 resize-none py-2 text-xs"
          />
          <button
            onClick={enviar}
            disabled={sending || !input.trim()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: "var(--nuvia-gradient-primary)" }}
            aria-label="Enviar"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </footer>
    </aside>
  );
}

function Mini({ label, value, danger, warn }: { label: string; value: number; danger?: boolean; warn?: boolean }) {
  const color = danger ? "var(--nuvia-danger)" : warn ? "var(--nuvia-warning)" : "var(--nuvia-text-primary)";
  return (
    <div className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.03)] px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">{label}</div>
      <div className="text-base font-semibold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
