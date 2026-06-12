import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NUVEX } from "@/components/nuvex/constants";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { ExecutiveHero, NCard, PageLayout } from "@/components/nuvia";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  type Canal, type Mensaje, type DMResumen,
  listMisDMs, listDirectorio, getOrCreateDM, listMensajes, suscribirMensajes,
  enviarMensaje, subirAdjunto, getAdjuntoUrl, marcarCanalLeido, getOtroMiembroLectura,
} from "@/lib/colaboracion";
import { Send, Paperclip, Download, Search, Check, CheckCheck, Image as ImageIcon, FileText, Plus, AlertCircle, ArrowLeft } from "lucide-react";
import { EmojiPickerPopover } from "@/components/colaboracion/EmojiPicker";
import { PresenceDot } from "@/components/presencia/PresenceDot";
import { VoiceRecorder } from "@/components/colaboracion/VoiceRecorder";
import { VoiceNotePlayer } from "@/components/colaboracion/VoiceNotePlayer";

const AZUL = NUVEX.azul;

interface Props {
  initialCanalId?: string;
  onCanalChange?: (id: string) => void;
}

export function MensajeriaView({ initialCanalId, onCanalChange }: Props) {
  const { user } = useAuth();
  const [dms, setDms] = useState<DMResumen[]>([]);
  const [dir, setDir] = useState<Awaited<ReturnType<typeof listDirectorio>>>([]);
  const [canal, setCanalState] = useState<Canal | null>(null);
  const [otroLectura, setOtroLectura] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [adjs, setAdjs] = useState<Mensaje["adjuntos"]>([]);
  const [enviando, setEnviando] = useState(false);
  const [q, setQ] = useState("");
  const [showNuevo, setShowNuevo] = useState(false);
  const [accesoError, setAccesoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const setCanal = (c: Canal | null) => {
    setCanalState(c);
    if (c) onCanalChange?.(c.id);
  };

  const recargarDMs = () => listMisDMs().then(setDms);

  useEffect(() => { recargarDMs(); listDirectorio().then(setDir); }, []);

  // Resolver initialCanalId
  useEffect(() => {
    if (!initialCanalId) return;
    if (canal?.id === initialCanalId) return;
    let cancel = false;
    (async () => {
      setAccesoError(null);
      const { data, error } = await supabase
        .from("colab_canales" as never)
        .select("*")
        .eq("id", initialCanalId)
        .maybeSingle();
      if (cancel) return;
      if (error || !data) {
        setAccesoError("No tienes acceso a esta conversación o la conversación no existe.");
        setCanalState(null);
        return;
      }
      setCanalState(data as unknown as Canal);
    })();
    return () => { cancel = true; };
  }, [initialCanalId]);

  useEffect(() => {
    if (!canal) return;
    listMensajes(canal.id).then(setMsgs);
    getOtroMiembroLectura(canal.id).then(setOtroLectura);
    marcarCanalLeido(canal.id).then(recargarDMs);
    const unsub = suscribirMensajes(canal.id, (m) => {
      setMsgs((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
      if (m.user_id !== user?.id) marcarCanalLeido(canal.id).then(recargarDMs);
    });
    return () => { unsub(); };
  }, [canal?.id, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const dmsFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dms;
    return dms.filter((d) => d.otro.nombre.toLowerCase().includes(s) || d.otro.roles.some((r) => r.toLowerCase().includes(s)));
  }, [dms, q]);

  const abrirConUsuario = async (uid: string) => {
    const c = await getOrCreateDM(uid);
    setCanal(c);
    setShowNuevo(false);
    await recargarDMs();
  };

  const onEnviar = async () => {
    if (!canal || (!texto.trim() && adjs.length === 0)) return;
    setEnviando(true);
    try {
      await enviarMensaje(canal.id, texto.trim(), adjs);
      setTexto(""); setAdjs([]);
      await recargarDMs();
    } catch (e) { alert((e as Error).message); }
    finally { setEnviando(false); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f || !canal) return;
    try { const a = await subirAdjunto(canal.id, f); setAdjs((p) => [...p, a]); }
    catch (e) { alert((e as Error).message); }
  };

  const onVoiceSend = async (file: File) => {
    if (!canal) return;
    const a = await subirAdjunto(canal.id, file);
    await enviarMensaje(canal.id, "", [a]);
    await recargarDMs();
  };

  const totalNoLeidos = dms.reduce((s, d) => s + d.no_leidos, 0);
  const hasCanal = !!canal;

  return (
    <PageLayout maxWidth="full">
      <ExecutiveHero
        badge={{ icon: <MessageCircle size={12} />, label: "NUVEX · Mensajería", tone: "blue" }}
        title="Mensajería Directa"
        description="Conversaciones 1 a 1 entre colaboradores. Mensajes con estados de envío y lectura, adjuntos e historial completo."
        meta={
          totalNoLeidos > 0 ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{
                background: "rgba(255,107,107,0.14)",
                border: "1px solid rgba(255,107,107,0.40)",
                color: "var(--nuvia-danger)",
              }}
            >
              {totalNoLeidos} sin leer
            </span>
          ) : undefined
        }
        actions={
          <button
            onClick={() => setShowNuevo(true)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:opacity-95"
            style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)", boxShadow: "var(--nuvia-shadow-sm)" }}
          >
            <Plus size={13} /> Nuevo mensaje
          </button>
        }
      />
      {/* keep AZUL referenced for legacy chat surfaces below */}
      <span aria-hidden className="hidden" style={{ color: AZUL }} />

      {accesoError && (
        <NCard className="border-l-4" style={{ borderLeftColor: "var(--nuvia-danger)" }}>
          <div className="flex items-start gap-2 text-sm" style={{ color: "var(--nuvia-text-primary)" }}>
            <AlertCircle size={16} className="mt-0.5" style={{ color: "var(--nuvia-danger)" }} />
            <div>{accesoError}</div>
          </div>
        </NCard>
      )}

      <div
        className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4"
        style={{ height: "calc(100dvh - 180px)" }}
      >
        {/* Lista de conversaciones — oculta en móvil cuando hay canal abierto */}
        <NCard
          padding="none"
          className={`md:col-span-4 p-0 overflow-hidden flex-col ${hasCanal ? "hidden md:flex" : "flex flex-1"}`}
        >
          <div className="p-3 border-b" style={{ borderColor: "var(--nuvia-border)" }}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--nuvia-text-secondary)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversación…" className="nuvia-input nuvia-input-sm pl-7" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dmsFiltrados.length === 0 && (
              <div className="p-6 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
                Aún no tienes conversaciones. Pulsa "Nuevo mensaje".
              </div>
            )}
            {dmsFiltrados.map((d) => {
              const activo = canal?.id === d.canal.id;
              return (
                <button
                  key={d.canal.id}
                  onClick={() => setCanal(d.canal)}
                  className="w-full flex items-start gap-3 px-3 py-2.5 text-left border-b transition hover:bg-white/[0.04]"
                  style={{
                    borderColor: "var(--nuvia-border)",
                    background: activo ? "rgba(68,93,163,0.18)" : "transparent",
                  }}
                >
                  <UserAvatar userId={d.otro.user_id} name={d.otro.nombre} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-[13px] font-semibold truncate" style={{ color: "var(--nuvia-text-primary)" }}>{d.otro.nombre}</div>
                        <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} />
                      </div>
                      {d.ultimo_mensaje && <div className="text-[10px] shrink-0" style={{ color: "var(--nuvia-text-secondary)" }}>{formatRel(d.ultimo_mensaje.created_at)}</div>}
                    </div>
                    <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{d.otro.roles.join(", ") || "—"}</div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-[12px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {d.ultimo_mensaje?.user_id === user?.id && "Tú: "}
                        {d.ultimo_mensaje?.texto || (d.ultimo_mensaje ? "📎 adjunto" : "Sin mensajes")}
                      </div>
                      {d.no_leidos > 0 && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--nuvia-accent-blue)", color: "var(--nuvia-text-primary)" }}>{d.no_leidos}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </NCard>

        {/* Panel de chat — oculto en móvil cuando no hay canal */}
        <NCard
          padding="none"
          className={`md:col-span-8 p-0 overflow-hidden flex-col ${hasCanal ? "flex flex-1" : "hidden md:flex"}`}
        >
          {!canal ? (
            <div className="flex-1 flex items-center justify-center text-sm p-6 text-center" style={{ color: "var(--nuvia-text-secondary)" }}>
              Selecciona una conversación o inicia una nueva.
            </div>
          ) : (
            <>
              <ChatHeader dms={dms} canal={canal} onBack={() => setCanalState(null)} />
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.03))" }}>
                {msgs.length === 0 && <div className="text-center text-sm py-10" style={{ color: "var(--nuvia-text-secondary)" }}>Sin mensajes aún. Saluda 👋</div>}
                {msgs.map((m) => (
                  <MensajeBurbuja key={m.id} m={m} esMio={m.user_id === user?.id} otroLectura={otroLectura} />
                ))}
                <div ref={endRef} />
              </div>

              {adjs.length > 0 && (
                <div className="border-t px-3 md:px-5 py-2 flex gap-2 flex-wrap" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
                  {adjs.map((a, i) => (
                    <div key={i} className="text-[11px] border rounded px-2 py-1 flex items-center gap-1" style={{ background: "var(--nuvia-bg-tertiary)", borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
                      {iconAdj(a.mime)} {a.nombre}
                      <button onClick={() => setAdjs((p) => p.filter((_, j) => j !== i))} className="ml-1" style={{ color: "var(--nuvia-danger)" }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t px-2 md:px-4 py-2 md:py-3 flex items-end gap-1.5 md:gap-2" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                <button onClick={() => fileRef.current?.click()} className="rounded-lg border p-2 transition hover:bg-white/[0.06] shrink-0" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }} title="Adjuntar archivo / imagen / PDF">
                  <Paperclip size={16} />
                </button>
                <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ""; }} />
                <VoiceRecorder onSend={onVoiceSend} disabled={enviando} />
                <EmojiPickerPopover onPick={(e) => setTexto((t) => t + e)} />
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar(); } }}
                  rows={1}
                  placeholder="Escribe un mensaje…"
                  className="nuvia-input nuvia-input-sm flex-1 min-w-0 resize-none"
                />
                <button onClick={onEnviar} disabled={enviando} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 md:px-4 py-2 text-sm font-semibold disabled:opacity-50 shrink-0" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }} aria-label="Enviar">
                  <Send size={14} /> <span className="hidden sm:inline">Enviar</span>
                </button>
              </div>
            </>
          )}
        </NCard>
      </div>

      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowNuevo(false)}>
          <div className="w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl p-4 md:p-5 max-h-[85vh] overflow-y-auto" style={{ background: "var(--nuvia-bg-tertiary)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>Nuevo mensaje directo</h3>
              <button onClick={() => setShowNuevo(false)} className="text-xl leading-none px-2" style={{ color: "var(--nuvia-text-secondary)" }}>×</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dir.filter((p) => p.user_id !== user?.id).map((p) => (
                <button key={p.user_id} onClick={() => abrirConUsuario(p.user_id)} className="flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-white/[0.05]" style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.03)" }}>
                  <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--nuvia-text-primary)" }}>{p.nombre}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{p.roles.join(", ") || "—"}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function ChatHeader({ dms, canal, onBack }: { dms: DMResumen[]; canal: Canal; onBack: () => void }) {
  const d = dms.find((x) => x.canal.id === canal.id);
  const BackBtn = (
    <button onClick={onBack} className="md:hidden rounded-lg p-1.5 -ml-1 transition hover:bg-white/[0.06] shrink-0" style={{ color: "var(--nuvia-text-secondary)" }} aria-label="Volver">
      <ArrowLeft size={18} />
    </button>
  );
  if (!d) return (
    <div className="border-b px-3 md:px-5 py-3 flex items-center gap-2 text-sm font-semibold" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)", background: "var(--nuvia-bg-secondary)" }}>
      {BackBtn}
      {canal.nombre}
    </div>
  );
  return (
    <div className="border-b px-3 md:px-5 py-3 flex items-center gap-2 md:gap-3" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
      {BackBtn}
      <UserAvatar userId={d.otro.user_id} name={d.otro.nombre} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-semibold truncate" style={{ color: "var(--nuvia-text-primary)" }}>{d.otro.nombre}</div>
          <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} />
        </div>
        <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>
          <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} showText />
          {d.otro.roles.length > 0 && <span className="ml-2 hidden sm:inline">· {d.otro.roles.join(", ")}</span>}
        </div>
      </div>
    </div>
  );
}

function MensajeBurbuja({ m, esMio, otroLectura }: { m: Mensaje; esMio: boolean; otroLectura: string | null }) {
  if (m.borrado) {
    return <div className={`text-[11px] italic ${esMio ? "text-right" : ""}`} style={{ color: "var(--nuvia-text-secondary)" }}>— mensaje eliminado —</div>;
  }
  const leido = esMio && otroLectura && new Date(m.created_at) <= new Date(otroLectura);
  return (
    <div className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[85%] md:max-w-[72%] rounded-2xl px-3 py-2 text-sm"
        style={esMio
          ? { background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)", boxShadow: "var(--nuvia-shadow-sm)" }
          : { background: "var(--nuvia-bg-card)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border)" }}
      >
        {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.adjuntos.map((a, i) => (
              a.mime?.startsWith("audio/") ? (
                <VoiceNotePlayer key={i} path={a.path} mime={a.mime} nombre={a.nombre} esMio={esMio} />
              ) : (
                <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]" style={esMio ? { background: "rgba(255,255,255,0.18)", color: "var(--nuvia-text-primary)" } : { background: "rgba(255,255,255,0.05)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
                  {iconAdj(a.mime)} <span className="truncate max-w-[180px]">{a.nombre}</span> <Download size={10} />
                </button>
              )
            ))}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-1 text-[10px] ${esMio ? "justify-end" : ""}`} style={{ color: esMio ? "rgba(255,255,255,0.76)" : "var(--nuvia-text-secondary)" }}>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {esMio && (leido ? <CheckCheck size={12} style={{ color: "var(--nuvia-success)" }} /> : <Check size={12} />)}
        </div>
      </div>
    </div>
  );
}

function iconAdj(mime?: string) {
  if (mime?.startsWith("image/")) return <ImageIcon size={11} />;
  if (mime === "application/pdf") return <FileText size={11} />;
  return <Paperclip size={11} />;
}

function formatRel(iso: string) {
  const d = new Date(iso); const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 7) return d.toLocaleDateString("es-CO", { weekday: "short" });
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}
