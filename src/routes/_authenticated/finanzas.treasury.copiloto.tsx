import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { treasuryCopilotContext } from "@/lib/treasury.functions";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, Sparkles, User, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/copiloto")({
  component: CopilotoPage,
  head: () => ({ meta: [{ title: "Copiloto IA · NUVIA Treasury" }] }),
});

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "¿Cuánto me deben hoy?",
  "Proyecta el flujo de caja a 60 días",
  "¿Qué clientes están en mora >30 días?",
  "Resume mis cuentas de cobro pendientes",
  "¿Cuál es mi saldo bancario actual?",
];

function CopilotoPage() {
  const fn = useServerFn(treasuryCopilotContext);
  const { data: contexto } = useQuery({ queryKey: ["tCopilotCtx"], queryFn: () => fn() });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const resp = await fetch("/api/treasury-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ messages: next, contexto }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error ?? "Error del copiloto");
      setMessages((prev) => [...prev, { role: "assistant", content: j.respuesta }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: `❌ ${(e as Error).message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: "Treasury AI · Copiloto", tone: "blue" }}
        title="Copiloto IA · Tesorería conversacional"
        description="Pregunta en lenguaje natural sobre cartera, flujo de caja, cuentas de cobro y saldos. Respuestas con datos en tiempo real."
      />

      <NCard variant="elevated" padding="none">
        <div
          ref={scrollRef}
          style={{ height: 460, overflowY: "auto", padding: 20 }}
          className="space-y-4"
        >
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div
                className="inline-flex items-center justify-center rounded-xl mb-3"
                style={{
                  width: 48, height: 48,
                  background: "linear-gradient(135deg, rgba(68,93,163,0.4), rgba(132,185,143,0.3))",
                  color: "#fff",
                }}
              >
                <Sparkles size={22} />
              </div>
              <div style={{ color: "var(--nuvia-text-primary)", fontSize: 14, fontWeight: 600 }}>
                Pregúntame lo que necesites saber de tu tesorería
              </div>
              <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 12, marginTop: 4 }}>
                Tengo acceso en vivo a tu cartera, CC, bancos y flujo de caja proyectado.
              </div>
              <div className="mt-5 flex flex-wrap gap-2 justify-center">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full px-3 py-1.5 text-xs transition hover:-translate-y-0.5"
                    style={{
                      background: "rgba(165,181,224,0.10)",
                      color: "#A5B5E0",
                      border: "1px solid rgba(165,181,224,0.35)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} />
          ))}
          {loading && (
            <div className="flex items-center gap-2" style={{ color: "var(--nuvia-text-secondary)", fontSize: 12 }}>
              <Loader2 size={14} className="animate-spin" />
              <span>Pensando…</span>
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--nuvia-border)",
            padding: 12,
            background: "rgba(8,12,22,0.4)",
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={1}
            placeholder="Pregúntale a Treasury Copilot…"
            className="nuvia-input flex-1"
            style={{ resize: "none", minHeight: 38, maxHeight: 120 }}
          />
          <button
            onClick={() => send()}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #4F69B8 0%, #445DA3 100%)",
              color: "#fff",
              boxShadow: "0 6px 16px -6px rgba(68,93,163,0.9)",
            }}
          >
            <Send size={13} /> Enviar
          </button>
        </div>
      </NCard>
    </PageLayout>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className="shrink-0 grid place-items-center rounded-lg"
        style={{
          width: 28, height: 28,
          background: isUser
            ? "linear-gradient(135deg, rgba(68,93,163,0.6), rgba(68,93,163,0.4))"
            : "linear-gradient(135deg, rgba(132,185,143,0.45), rgba(68,93,163,0.35))",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {isUser ? <User size={13} /> : <Brain size={13} />}
      </div>
      <div
        className="max-w-[78%] rounded-xl px-3 py-2"
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, #4F69B8 0%, #3D5494 100%)",
                color: "#fff",
                fontSize: 13,
              }
            : {
                background: "rgba(255,255,255,0.04)",
                color: "var(--nuvia-text-primary)",
                border: "1px solid var(--nuvia-border)",
                fontSize: 13,
              }
        }
      >
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
        ) : (
          <div className="copilot-prose">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
