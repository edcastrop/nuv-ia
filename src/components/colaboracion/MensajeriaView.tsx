import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
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
    <div className="mx-auto max-w-[1500px] px-3 py-3 md:px-6 md:py-6 space-y-3 md:space-y-4">
      <Card className="!p-3 md:!p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] md:text-[11px] uppercase tracking-wider font-semibold" style={{ color: AZUL }}>NUVEX</div>
            <h1 className="text-lg md:text-2xl font-semibold text-[#242424]">Mensajería Directa</h1>
            <p className="hidden md:block text-sm text-[#242424]/60 mt-1">
              Conversaciones 1 a 1 entre colaboradores. Mensajes con estados de envío y lectura, adjuntos e historial completo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {totalNoLeidos > 0 && (
              <span className="rounded-full px-2 py-0.5 md:py-1 text-[10px] md:text-[11px] font-semibold text-white" style={{ background: "#B42318" }}>
                {totalNoLeidos} sin leer
              </span>
            )}
            <button onClick={() => setShowNuevo(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 text-[11px] md:text-[12px] font-semibold text-white" style={{ background: AZUL }}>
              <Plus size={13} /> <span className="hidden xs:inline">Nuevo</span><span className="hidden sm:inline"> mensaje</span>
            </button>
          </div>
        </div>
      </Card>

      {accesoError && (
        <Card className="border-l-4 border-l-[#B42318]">
          <div className="flex items-start gap-2 text-sm text-[#242424]">
            <AlertCircle size={16} className="text-[#B42318] mt-0.5" />
            <div>{accesoError}</div>
          </div>
        </Card>
      )}

      <div
        className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4"
        style={{ height: "calc(100dvh - 180px)" }}
      >
        {/* Lista de conversaciones — oculta en móvil cuando hay canal abierto */}
        <Card
          className={`md:col-span-4 p-0 overflow-hidden flex-col ${hasCanal ? "hidden md:flex" : "flex flex-1"}`}
        >
          <div className="p-3 border-b border-[#E3E7EE]">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#242424]/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conversación…" className="w-full rounded-lg border border-[#E3E7EE] pl-7 pr-3 py-2 text-[13px] outline-none focus:border-[#445DA3]" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {dmsFiltrados.length === 0 && (
              <div className="p-6 text-center text-sm text-[#242424]/50">
                Aún no tienes conversaciones. Pulsa "Nuevo mensaje".
              </div>
            )}
            {dmsFiltrados.map((d) => {
              const activo = canal?.id === d.canal.id;
              return (
                <button key={d.canal.id} onClick={() => setCanal(d.canal)} className="w-full flex items-start gap-3 px-3 py-2.5 text-left border-b border-[#F0F2F6] active:bg-[#F0F4FB]" style={activo ? { background: "#F0F4FB" } : {}}>
                  <UserAvatar userId={d.otro.user_id} name={d.otro.nombre} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="text-[13px] font-semibold text-[#242424] truncate">{d.otro.nombre}</div>
                        <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} />
                      </div>
                      {d.ultimo_mensaje && <div className="text-[10px] text-[#242424]/50 shrink-0">{formatRel(d.ultimo_mensaje.created_at)}</div>}
                    </div>
                    <div className="text-[11px] text-[#242424]/55 truncate">{d.otro.roles.join(", ") || "—"}</div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <div className="text-[12px] text-[#242424]/70 truncate">
                        {d.ultimo_mensaje?.user_id === user?.id && "Tú: "}
                        {d.ultimo_mensaje?.texto || (d.ultimo_mensaje ? "📎 adjunto" : "Sin mensajes")}
                      </div>
                      {d.no_leidos > 0 && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: AZUL }}>{d.no_leidos}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Panel de chat — oculto en móvil cuando no hay canal */}
        <Card
          className={`md:col-span-8 p-0 overflow-hidden flex-col ${hasCanal ? "flex flex-1" : "hidden md:flex"}`}
        >
          {!canal ? (
            <div className="flex-1 flex items-center justify-center text-sm text-[#242424]/50 p-6 text-center">
              Selecciona una conversación o inicia una nueva.
            </div>
          ) : (
            <>
              <ChatHeader dms={dms} canal={canal} onBack={() => setCanalState(null)} />
              <div className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-2">
                {msgs.length === 0 && <div className="text-center text-sm text-[#242424]/50 py-10">Sin mensajes aún. Saluda 👋</div>}
                {msgs.map((m) => (
                  <MensajeBurbuja key={m.id} m={m} esMio={m.user_id === user?.id} otroLectura={otroLectura} />
                ))}
                <div ref={endRef} />
              </div>

              {adjs.length > 0 && (
                <div className="border-t border-[#E3E7EE] px-3 md:px-5 py-2 flex gap-2 flex-wrap bg-[#F7F9FB]">
                  {adjs.map((a, i) => (
                    <div key={i} className="text-[11px] bg-white border border-[#E3E7EE] rounded px-2 py-1 flex items-center gap-1">
                      {iconAdj(a.mime)} {a.nombre}
                      <button onClick={() => setAdjs((p) => p.filter((_, j) => j !== i))} className="text-[#B42318] ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-[#E3E7EE] px-2 md:px-4 py-2 md:py-3 flex items-end gap-1.5 md:gap-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
                <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-[#E3E7EE] p-2 hover:bg-[#F7F9FB] shrink-0" title="Adjuntar archivo / imagen / PDF">
                  <Paperclip size={16} className="text-[#242424]/70" />
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
                  className="flex-1 min-w-0 rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm resize-none outline-none focus:border-[#445DA3]"
                />
                <button onClick={onEnviar} disabled={enviando} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 md:px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 shrink-0" style={{ background: AZUL }} aria-label="Enviar">
                  <Send size={14} /> <span className="hidden sm:inline">Enviar</span>
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={() => setShowNuevo(false)}>
          <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl p-4 md:p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-[#242424]">Nuevo mensaje directo</h3>
              <button onClick={() => setShowNuevo(false)} className="text-[#242424]/50 text-xl leading-none px-2">×</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dir.filter((p) => p.user_id !== user?.id).map((p) => (
                <button key={p.user_id} onClick={() => abrirConUsuario(p.user_id)} className="flex items-center gap-3 rounded-xl border border-[#E3E7EE] p-3 text-left hover:bg-[#F7F9FB] active:bg-[#F0F4FB]">
                  <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#242424] truncate">{p.nombre}</div>
                    <div className="text-[11px] text-[#242424]/55 truncate">{p.roles.join(", ") || "—"}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatHeader({ dms, canal, onBack }: { dms: DMResumen[]; canal: Canal; onBack: () => void }) {
  const d = dms.find((x) => x.canal.id === canal.id);
  const BackBtn = (
    <button onClick={onBack} className="md:hidden rounded-lg p-1.5 -ml-1 hover:bg-[#F0F4FB] text-[#242424]/70 shrink-0" aria-label="Volver">
      <ArrowLeft size={18} />
    </button>
  );
  if (!d) return (
    <div className="border-b border-[#E3E7EE] px-3 md:px-5 py-3 flex items-center gap-2 text-sm font-semibold text-[#242424]">
      {BackBtn}
      {canal.nombre}
    </div>
  );
  return (
    <div className="border-b border-[#E3E7EE] px-3 md:px-5 py-3 flex items-center gap-2 md:gap-3">
      {BackBtn}
      <UserAvatar userId={d.otro.user_id} name={d.otro.nombre} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-[14px] font-semibold text-[#242424] truncate">{d.otro.nombre}</div>
          <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} />
        </div>
        <div className="text-[11px] text-[#242424]/55 truncate">
          <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} showText />
          {d.otro.roles.length > 0 && <span className="ml-2 hidden sm:inline">· {d.otro.roles.join(", ")}</span>}
        </div>
      </div>
    </div>
  );
}

function MensajeBurbuja({ m, esMio, otroLectura }: { m: Mensaje; esMio: boolean; otroLectura: string | null }) {
  if (m.borrado) {
    return <div className={`text-[11px] italic text-[#242424]/40 ${esMio ? "text-right" : ""}`}>— mensaje eliminado —</div>;
  }
  const leido = esMio && otroLectura && new Date(m.created_at) <= new Date(otroLectura);
  return (
    <div className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[85%] md:max-w-[72%] rounded-2xl px-3 py-2 text-sm" style={esMio ? { background: AZUL, color: "#fff" } : { background: "#F0F2F6", color: "#242424" }}>
        {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.adjuntos.map((a, i) => (
              a.mime?.startsWith("audio/") ? (
                <VoiceNotePlayer key={i} path={a.path} mime={a.mime} nombre={a.nombre} esMio={esMio} />
              ) : (
                <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]" style={esMio ? { background: "rgba(255,255,255,0.18)", color: "#fff" } : { background: "#fff", border: "1px solid #E3E7EE", color: "#242424" }}>
                  {iconAdj(a.mime)} <span className="truncate max-w-[180px]">{a.nombre}</span> <Download size={10} />
                </button>
              )
            ))}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-1 text-[10px] ${esMio ? "text-white/75 justify-end" : "text-[#242424]/50"}`}>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {esMio && (leido ? <CheckCheck size={12} className="text-[#A8D5B3]" /> : <Check size={12} />)}
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
