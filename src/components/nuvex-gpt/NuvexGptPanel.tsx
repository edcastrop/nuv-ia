import { useState, useRef, useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, AlertCircle, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { streamNuvexGpt, modulosDesdePath, PREGUNTAS_SUGERIDAS, type ChatMsg } from "@/lib/nuvex-gpt";
import { useServerFn } from "@tanstack/react-start";
import { saveTurn } from "@/lib/nuvex-gpt.functions";
import { EscalarTicketDialog } from "./EscalarTicketDialog";
import { toast } from "sonner";

export function NuvexGptButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 text-white shadow-2xl transition hover:scale-105"
        style={{
          background: "linear-gradient(135deg, #445DA3, #84B98F)",
          boxShadow: "0 10px 30px -8px rgba(68,93,163,0.55)",
        }}
        aria-label="Abrir NUVEX GPT"
      >
        <Brain size={20} />
        <span className="hidden sm:inline text-sm font-semibold">NUVEX GPT</span>
      </button>
      <NuvexGptPanel open={open} onOpenChange={setOpen} />
    </>
  );
}

function NuvexGptPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const location = useLocation();
  const modulo = modulosDesdePath(location.pathname);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [escalarOpen, setEscalarOpen] = useState(false);
  const [lastAssistant, setLastAssistant] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const save = useServerFn(saveTurn);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setInput("");
    const userMsg: ChatMsg = { role: "user", content: q };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    let acc = "";
    try {
      acc = await streamNuvexGpt({
        messages: next,
        modulo_contexto: modulo,
        conversacion_id: convId,
        onDelta: (chunk) => {
          acc += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: m.content + chunk } : m));
            }
            return [...prev, { role: "assistant", content: chunk }];
          });
        },
      });
      setLastAssistant(acc);
      try {
        const res = await save({
          data: {
            conversacion_id: convId,
            modulo_contexto: modulo,
            user_content: q,
            assistant_content: acc || "(sin respuesta)",
          },
        });
        if (!convId) setConvId(res.conversacion_id);
      } catch {
        // ignorar fallo de guardado, no romper UX
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al consultar NUVEX GPT");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader
            className="px-5 py-4 border-b"
            style={{ background: "linear-gradient(135deg, #050814, #0A1226)" }}
          >
            <SheetTitle className="flex items-center gap-2 text-white">
              <Sparkles size={18} style={{ color: "#84B98F" }} />
              <div className="flex flex-col items-start">
                <span className="text-base font-bold">NUVEX GPT</span>
                <span className="text-[10px] font-normal text-white/60 uppercase tracking-wider">
                  Copiloto Operativo Corporativo
                </span>
              </div>
            </SheetTitle>
            {modulo && (
              <div className="text-[10px] text-white/50 uppercase tracking-wider mt-1">
                Contexto: {modulo}
              </div>
            )}
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F7F9FB]">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="text-sm text-[#242424]/70">
                  Hola 👋, soy tu copiloto NUVEX. ¿En qué te ayudo hoy?
                </div>
                <div className="flex flex-wrap gap-2">
                  {PREGUNTAS_SUGERIDAS.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-[#445DA3]/20 bg-white px-3 py-1.5 text-[11px] text-[#445DA3] hover:bg-[#445DA3]/5"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto max-w-[85%] bg-[#445DA3] text-white"
                    : "mr-auto max-w-[92%] bg-white text-[#242424] border border-[#E3E7EE]"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none prose-headings:mt-1 prose-headings:mb-2 prose-p:my-1 prose-ul:my-1 prose-ol:my-1">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  <div>{m.content}</div>
                )}
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="mr-auto max-w-[80%] bg-white border border-[#E3E7EE] rounded-xl px-3 py-2 text-sm text-[#242424]/50">
                Pensando…
              </div>
            )}

            {!loading && lastAssistant && (
              <div className="pt-1">
                <button
                  onClick={() => setEscalarOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-[#445DA3] hover:underline"
                >
                  <AlertCircle size={12} /> Escalar a un ticket
                </button>
              </div>
            )}
          </div>

          <div className="border-t bg-white px-3 py-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu pregunta…"
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                <Send size={16} />
              </Button>
            </form>
            <div className="mt-1 text-[10px] text-[#242424]/40 text-center">
              NUVEX GPT puede equivocarse. Verifica información crítica.
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EscalarTicketDialog
        open={escalarOpen}
        onOpenChange={setEscalarOpen}
        conversacionId={convId}
        preFillDescripcion={
          lastAssistant
            ? `Consulta original:\n${messages[messages.length - 2]?.content ?? ""}\n\nRespuesta NUVEX GPT:\n${lastAssistant}`
            : ""
        }
      />
    </>
  );
}
