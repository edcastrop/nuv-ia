import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Send, X, Sparkles, Check, XCircle, Clock, FileText, Loader2 } from "lucide-react";

type Msg = { role: "user" | "assistant" | "tool"; content: string; tool_name?: string | null };
type Sugerencia = {
  id: string;
  tipo: string;
  titulo: string;
  propuesta: { decision?: string | null; detalles?: Record<string, unknown> } | null;
  justificacion: string | null;
  estado: "pendiente" | "aprobada" | "rechazada";
  created_at: string;
};

const SUGERENCIAS_INIT = [
  "Trae el caso vinculado y revisa la tasa cobrada vs. la pactada.",
  "Verifica si el spread supera la usura vigente al desembolso.",
  "Simula la amortización real con abono extra a capital de $500.000/mes.",
  "Cita la normativa aplicable si el banco cobró seguros no autorizados.",
];

export function CopilotoQADrawer({
  open, onClose, auditoriaId = null, expedienteId = null,
}: {
  open: boolean;
  onClose: () => void;
  auditoriaId?: string | null;
  expedienteId?: string | null;
}) {
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [tab, setTab] = useState<"chat" | "sugerencias">("chat");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset al cambiar de auditoría
  useEffect(() => {
    if (!open) return;
    setConversacionId(null);
    setMsgs([]);
    setSugerencias([]);
  }, [auditoriaId, expedienteId, open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, loading]);

  const cargarSugerencias = useCallback(async (convId: string) => {
    const { data } = await supabase
      .from("nuvia_qa_copilot_sugerencias")
      .select("id,tipo,titulo,propuesta,justificacion,estado,created_at")
      .eq("conversacion_id", convId)
      .order("created_at", { ascending: false });
    setSugerencias((data ?? []) as unknown as Sugerencia[]);
  }, []);

  const resolverSugerencia = async (id: string, nuevoEstado: "aprobada" | "rechazada") => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id ?? null;
    const { error } = await supabase
      .from("nuvia_qa_copilot_sugerencias")
      .update({ estado: nuevoEstado, aprobada_por: uid, aprobada_at: new Date().toISOString() })
      .eq("id", id);
    if (!error && conversacionId) cargarSugerencias(conversacionId);
  };

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
        body: JSON.stringify({ pregunta, conversacionId, auditoriaId, expedienteId }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Error del Copiloto");
      if (j.conversacionId && !conversacionId) setConversacionId(j.conversacionId);
      setMsgs((m) => [...m, { role: "assistant", content: j.respuesta ?? "(sin respuesta)" }]);
      if (Array.isArray(j.sugerencias_creadas) && j.sugerencias_creadas.length > 0 && j.conversacionId) {
        cargarSugerencias(j.conversacionId);
        setTab("sugerencias");
      }
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: `⚠ ${e instanceof Error ? e.message : "Error"}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const pendientes = sugerencias.filter((s) => s.estado === "pendiente").length;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998, backdropFilter: "blur(2px)" }} />
      <aside
        style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: "min(520px, 96vw)",
          background: "#0B1220", borderLeft: "1px solid var(--nuvia-border)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.55)",
          zIndex: 9999, display: "flex", flexDirection: "column",
        }}
      >
        <header style={{ padding: "14px 16px", borderBottom: "1px solid var(--nuvia-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="flex items-center gap-2">
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg,#445DA3,#84B98F)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Brain size={16} color="#fff" />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                NUVIA QA Copilot
              </p>
              <p className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                Discute matemática financiera · propone dictamen · tú confirmas
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--nuvia-text-secondary)" }}>
            <X size={16} />
          </button>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--nuvia-border)" }}>
          {(["chat", "sugerencias"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "10px 12px", background: "transparent",
                border: "none", cursor: "pointer",
                color: tab === t ? "var(--nuvia-text-primary)" : "var(--nuvia-text-secondary)",
                borderBottom: tab === t ? "2px solid #84B98F" : "2px solid transparent",
                fontSize: 12, fontWeight: 600, letterSpacing: 0.4, textTransform: "uppercase",
              }}
            >
              {t === "chat" ? "Conversación" : `Sugerencias${pendientes ? ` · ${pendientes}` : ""}`}
            </button>
          ))}
        </div>

        {tab === "chat" && (
          <>
            <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {msgs.length === 0 && (
                <div className="space-y-3">
                  <p className="text-xs flex items-center gap-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                    <Sparkles size={12} /> Ejemplos de conversación
                  </p>
                  {SUGERENCIAS_INIT.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="w-full text-left text-[13px] px-3 py-2 rounded"
                      style={{
                        background: "rgba(132,185,143,0.06)",
                        border: "1px solid rgba(132,185,143,0.25)",
                        color: "var(--nuvia-text-primary)", cursor: "pointer",
                      }}
                    >
                      {s}
                    </button>
                  ))}
                  <p className="text-[11px] mt-4" style={{ color: "var(--nuvia-text-secondary)" }}>
                    Base de conocimiento: Ley 546, SFC, usura mensual, valor UVR mensual, perfiles de banco (Davivienda, Bogotá, BBVA, Bancolombia, Popular, AV Villas, FNA) y casos históricos.
                    {expedienteId ? " Caso vinculado detectado." : ""}
                  </p>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className="mb-3">
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                    {m.role === "user" ? "Tú" : "NUVIA"}
                  </p>
                  <div
                    className="text-[13px] whitespace-pre-wrap px-3 py-2 rounded"
                    style={{
                      background: m.role === "user" ? "rgba(68,93,163,0.12)" : "rgba(132,185,143,0.05)",
                      border: `1px solid ${m.role === "user" ? "rgba(68,93,163,0.35)" : "rgba(132,185,143,0.25)"}`,
                      color: "var(--nuvia-text-primary)",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <p className="text-xs flex items-center gap-2" style={{ color: "var(--nuvia-text-secondary)" }}>
                  <Loader2 size={12} className="animate-spin" /> NUVIA está razonando y consultando KB…
                </p>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              style={{ padding: 12, borderTop: "1px solid var(--nuvia-border)", display: "flex", gap: 8 }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Discute el caso con NUVIA (usura, UVR, spread, amortización)…"
                className="nuvia-input nuvia-input-sm"
                style={{ flex: 1 }}
                disabled={loading}
              />
              <button
                type="submit" disabled={loading || !input.trim()}
                style={{
                  flexShrink: 0,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(135deg,#445DA3,#84B98F)", color: "#fff", border: "none",
                  padding: "0 14px", height: 36, borderRadius: "0.625rem",
                  cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                  opacity: loading || !input.trim() ? 0.5 : 1,
                }}
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
          </>
        )}

        {tab === "sugerencias" && (
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {sugerencias.length === 0 && (
              <div className="text-center" style={{ color: "var(--nuvia-text-secondary)", padding: 32 }}>
                <FileText size={28} className="mx-auto mb-2" style={{ opacity: 0.5 }} />
                <p className="text-sm">Aún no hay sugerencias.</p>
                <p className="text-[11px] mt-1">
                  NUVIA propondrá dictamen cuando discutas un caso puntual.
                </p>
              </div>
            )}
            {sugerencias.map((s) => {
              const iconoEstado = s.estado === "pendiente" ? <Clock size={12} />
                : s.estado === "aprobada" ? <Check size={12} /> : <XCircle size={12} />;
              const colorEstado = s.estado === "pendiente" ? "#F59E0B"
                : s.estado === "aprobada" ? "#84B98F" : "#EF4444";
              return (
                <div key={s.id} className="mb-3 p-3 rounded" style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${colorEstado}55`,
                }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider" style={{ color: colorEstado }}>
                        {s.tipo}
                      </p>
                      <p className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                        {s.titulo}
                      </p>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1"
                      style={{ background: `${colorEstado}22`, color: colorEstado, textTransform: "uppercase" }}
                    >
                      {iconoEstado}{s.estado}
                    </span>
                  </div>
                  {s.propuesta?.decision && (
                    <p className="text-[11px] mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                      Decisión propuesta: <strong style={{ color: "var(--nuvia-text-primary)" }}>{s.propuesta.decision}</strong>
                    </p>
                  )}
                  {s.justificacion && (
                    <p className="text-[12px] whitespace-pre-wrap mb-2" style={{ color: "var(--nuvia-text-primary)" }}>
                      {s.justificacion}
                    </p>
                  )}
                  {s.propuesta?.detalles && Object.keys(s.propuesta.detalles).length > 0 && (
                    <pre className="text-[10px] p-2 rounded overflow-x-auto mb-2" style={{ background: "rgba(0,0,0,0.35)", color: "var(--nuvia-text-secondary)" }}>
{JSON.stringify(s.propuesta.detalles, null, 2)}
                    </pre>
                  )}
                  {s.estado === "pendiente" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => resolverSugerencia(s.id, "aprobada")}
                        style={{
                          flex: 1, height: 30, borderRadius: 6, border: "none", cursor: "pointer",
                          background: "#84B98F", color: "#0B1220", fontWeight: 600, fontSize: 12,
                        }}
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => resolverSugerencia(s.id, "rechazada")}
                        style={{
                          flex: 1, height: 30, borderRadius: 6, cursor: "pointer",
                          background: "transparent", color: "#EF4444",
                          border: "1px solid #EF444455", fontWeight: 600, fontSize: 12,
                        }}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </>
  );
}
