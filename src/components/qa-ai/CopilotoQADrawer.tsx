import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, X, Sparkles } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGERENCIAS = [
  "¿Qué casos presentan inconsistencias?",
  "¿Qué simulaciones tienen mayor riesgo?",
  "¿Qué analista requiere revisión?",
  "¿Qué banco presenta más diferencias?",
];

export function CopilotoQADrawer({
  open, onClose, auditoriaId = null,
}: { open: boolean; onClose: () => void; auditoriaId?: string | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  const send = async (texto: string) => {
    const pregunta = texto.trim();
    if (!pregunta || loading) return;
    setMsgs((m) => [...m, { role: "user", content: pregunta }]);
    setInput("");
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sesión expirada");
      const r = await fetch("/api/qa-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pregunta, auditoriaId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error del Copiloto");
      setMsgs((m) => [...m, { role: "assistant", content: j.respuesta }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "Error"}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 60 }} />
      <aside
        style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: "min(440px, 96vw)",
          background: "var(--nuvia-surface)", borderLeft: "1px solid var(--nuvia-border)",
          zIndex: 61, display: "flex", flexDirection: "column",
        }}
      >
        <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nuvia-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="flex items-center gap-2">
            <Brain size={16} style={{ color: "var(--nuvia-accent)" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>Copiloto QA</p>
              <p className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                Interpreta auditorías existentes · no recalcula matemática
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--nuvia-text-secondary)" }}>
            <X size={16} />
          </button>
        </header>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {msgs.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                <Sparkles size={12} /> Sugerencias
              </p>
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left text-[13px] px-3 py-2 rounded"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)", cursor: "pointer" }}
                >
                  {s}
                </button>
              ))}
              <p className="text-[11px] mt-4" style={{ color: "var(--nuvia-text-secondary)" }}>
                Contexto: últimas 100 auditorías, alertas abiertas, reglas activas
                {auditoriaId ? " y la auditoría en foco." : "."}
              </p>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className="mb-3">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                {m.role === "user" ? "Tú" : "Copiloto"}
              </p>
              <div
                className="text-[13px] whitespace-pre-wrap px-3 py-2 rounded"
                style={{
                  background: m.role === "user" ? "rgba(59,130,246,0.10)" : "rgba(255,255,255,0.03)",
                  border: "1px solid var(--nuvia-border)",
                  color: "var(--nuvia-text-primary)",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <p className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>Pensando…</p>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          style={{ padding: 12, borderTop: "1px solid var(--nuvia-border)", display: "flex", gap: 8 }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre auditorías, alertas o reglas…"
            className="nuvia-input nuvia-input-sm"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            type="submit" disabled={loading || !input.trim()}
            className="nuvia-input nuvia-input-sm"
            style={{ background: "var(--nuvia-accent)", color: "#fff", border: "none", padding: "0 14px", cursor: "pointer", opacity: loading || !input.trim() ? 0.5 : 1 }}
          >
            <Send size={14} />
          </button>
        </form>
      </aside>
    </>
  );
}
