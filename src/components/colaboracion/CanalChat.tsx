import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  type Canal, type Mensaje, listMensajes, enviarMensaje, suscribirMensajes,
  subirAdjunto, getAdjuntoUrl, borrarMensaje, unirseCanal,
  marcarCanalLeido, marcarNotifsCanalLeidas,
} from "@/lib/colaboracion";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { Paperclip, Send, Trash2, Download, UserPlus, Hash, Users as UsersIcon } from "lucide-react";
import { EmojiPickerPopover } from "@/components/colaboracion/EmojiPicker";
import { VoiceRecorder } from "@/components/colaboracion/VoiceRecorder";
import { VoiceNotePlayer } from "@/components/colaboracion/VoiceNotePlayer";

export function CanalChat({ canal }: { canal: Canal }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [adjs, setAdjs] = useState<Mensaje["adjuntos"]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    listMensajes(canal.id).then((m) => { if (active) setMsgs(m); });
    const unsub = suscribirMensajes(canal.id, (nuevo) => {
      setMsgs((prev) => prev.some((x) => x.id === nuevo.id) ? prev : [...prev, nuevo]);
      marcarNotifsCanalLeidas(canal.id).catch(() => {});
    });
    // Al abrir el canal, marcar mensajes y notificaciones como leídos
    marcarCanalLeido(canal.id).catch(() => {});
    marcarNotifsCanalLeidas(canal.id).catch(() => {});
    return () => { active = false; unsub(); };
  }, [canal.id]);

  // Auto-scroll SOLO dentro del contenedor del chat (no afecta el scroll de la página).
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const onEnviar = async () => {
    if (!texto.trim() && adjs.length === 0) return;
    setEnviando(true);
    try {
      await enviarMensaje(canal.id, texto.trim(), adjs);
      setTexto(""); setAdjs([]);
    } catch (e) { alert((e as Error).message); }
    finally { setEnviando(false); }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      const adj = await subirAdjunto(canal.id, f);
      setAdjs((p) => [...p, adj]);
    } catch (e) { alert((e as Error).message); }
  };

  const onVoiceSend = async (file: File) => {
    const a = await subirAdjunto(canal.id, file);
    await enviarMensaje(canal.id, "", [a]);
  };


  return (
    <div className="flex flex-col h-full" style={{ background: "var(--nuvia-bg-tertiary)", color: "var(--nuvia-text-primary)" }}>
      <div className="border-b px-3 md:px-5 py-3 flex items-center justify-between gap-2" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] md:text-[15px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
            {canal.tipo === "area" || canal.tipo === "custom" ? <Hash size={16} className="shrink-0" style={{ color: "var(--nuvia-accent-blue)" }} /> : <UsersIcon size={16} className="shrink-0" style={{ color: "var(--nuvia-accent-blue)" }} />}
            <span className="truncate">{canal.nombre}</span>
          </div>
          {canal.descripcion && <div className="text-[12px] mt-0.5 truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{canal.descripcion}</div>}
        </div>
        {!canal.privado && (
          <button onClick={() => unirseCanal(canal.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 md:px-3 py-1.5 text-[11px] md:text-[12px] font-medium transition hover:bg-white/[0.06] shrink-0" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
            <UserPlus size={13} /> <span className="hidden sm:inline">Unirme</span>
          </button>
        )}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-3" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.03))" }}>
        {msgs.length === 0 && (
          <div className="text-center text-sm py-10" style={{ color: "var(--nuvia-text-secondary)" }}>Sin mensajes aún. Empieza la conversación.</div>
        )}
        {msgs.map((m) => <MensajeItem key={m.id} m={m} esMio={m.user_id === user?.id} />)}
        <div ref={endRef} />
      </div>

      {adjs.length > 0 && (
        <div className="border-t px-5 py-2 flex gap-2 flex-wrap" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)" }}>
          {adjs.map((a, i) => (
            <div key={i} className="text-[11px] border rounded px-2 py-1 flex items-center gap-1" style={{ background: "var(--nuvia-bg-tertiary)", borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
              📎 {a.nombre}
              <button onClick={() => setAdjs((p) => p.filter((_, j) => j !== i))} className="ml-1" style={{ color: "var(--nuvia-danger)" }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t px-2 md:px-4 py-2 md:py-3 flex items-end gap-1.5 md:gap-2" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <button onClick={() => fileRef.current?.click()} className="rounded-lg border p-2 transition hover:bg-white/[0.06] shrink-0" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }} title="Adjuntar archivo / imagen / PDF">
          <Paperclip size={16} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <VoiceRecorder onSend={onVoiceSend} disabled={enviando} />
        <EmojiPickerPopover onPick={(e) => setTexto((t) => t + e)} />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar(); } }}
          rows={1}
          placeholder={`Mensaje en ${canal.nombre}…`}
          className="nuvia-input nuvia-input-sm flex-1 min-w-0 resize-none"
        />
        <button onClick={onEnviar} disabled={enviando} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 md:px-4 py-2 text-sm font-semibold disabled:opacity-50 shrink-0" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }} aria-label="Enviar">
          <Send size={14} /> <span className="hidden sm:inline">Enviar</span>
        </button>
      </div>
    </div>
  );
}

function MensajeItem({ m, esMio }: { m: Mensaje; esMio: boolean }) {
  if (m.borrado) {
    return <div className="text-[11px] italic pl-12" style={{ color: "var(--nuvia-text-secondary)" }}>— mensaje eliminado —</div>;
  }
  return (
    <div className="flex gap-3 group">
      <UserAvatar userId={m.user_id} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{esMio ? "Tú" : "Usuario"}</span>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {esMio && (
            <button onClick={() => { if (confirm("¿Eliminar mensaje?")) borrarMensaje(m.id); }} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--nuvia-danger)" }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {m.texto && <div className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--nuvia-text-primary)" }}>{m.texto}</div>}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {m.adjuntos.map((a, i) => (
              a.mime?.startsWith("audio/") ? (
                <VoiceNotePlayer key={i} path={a.path} mime={a.mime} nombre={a.nombre} />
              ) : (
                <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition hover:bg-white/[0.06]" style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.04)", color: "var(--nuvia-text-primary)" }}>
                  <Download size={11} /> {a.nombre}
                </button>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
