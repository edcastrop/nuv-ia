import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  type Canal, type Mensaje, listMensajes, enviarMensaje, suscribirMensajes,
  subirAdjunto, getAdjuntoUrl, borrarMensaje, unirseCanal,
  marcarCanalLeido, marcarNotifsCanalLeidas, listDirectorioFull,
  listMiembrosCanal, type DirectorioPersona,
} from "@/lib/colaboracion";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { Paperclip, Send, Trash2, Download, UserPlus, Hash, Users as UsersIcon, AtSign } from "lucide-react";
import { EmojiPickerPopover } from "@/components/colaboracion/EmojiPicker";
import { VoiceRecorder } from "@/components/colaboracion/VoiceRecorder";
import { VoiceNotePlayer } from "@/components/colaboracion/VoiceNotePlayer";
import { detectMentionTrigger, normalizeForSearch, parseMentions, type MentionResolved } from "@/lib/mentions";

export function CanalChat({ canal }: { canal: Canal }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [adjs, setAdjs] = useState<Mensaje["adjuntos"]>([]);
  const [personasPorId, setPersonasPorId] = useState<Record<string, { nombre: string; foto_url: string | null }>>({});
  const [miembros, setMiembros] = useState<DirectorioPersona[]>([]);
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<MentionResolved[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    listMensajes(canal.id).then((m) => { if (active) setMsgs(m); });
    const unsub = suscribirMensajes(canal.id, (nuevo) => {
      setMsgs((prev) => prev.some((x) => x.id === nuevo.id) ? prev : [...prev, nuevo]);
      marcarNotifsCanalLeidas(canal.id).catch(() => {});
    });
    marcarCanalLeido(canal.id).catch(() => {});
    marcarNotifsCanalLeidas(canal.id).catch(() => {});
    listMiembrosCanal(canal.id).then((p) => { if (active) setMiembros(p); }).catch(() => {});
    return () => { active = false; unsub(); };
  }, [canal.id]);

  useEffect(() => {
    const ids = Array.from(new Set(msgs.flatMap((m) => [m.user_id, ...(m.menciones ?? [])]).filter(Boolean)));
    if (!ids.length) return;
    let active = true;
    listDirectorioFull()
      .then((personas) => {
        if (!active) return;
        const map: Record<string, { nombre: string; foto_url: string | null }> = {};
        personas.forEach((p) => {
          if (ids.includes(p.user_id)) map[p.user_id] = { nombre: p.nombre, foto_url: p.foto_url };
        });
        setPersonasPorId(map);
      })
      .catch(() => { if (active) setPersonasPorId({}); });
    return () => { active = false; };
  }, [msgs]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const sugerencias = useMemo(() => {
    if (!mentionState) return [];
    const q = normalizeForSearch(mentionState.query);
    const base = miembros.filter((m) => m.user_id !== user?.id && m.activo !== false);
    const filtered = q
      ? base.filter((m) => normalizeForSearch(m.nombre).includes(q) || (m.roles ?? []).some((r) => normalizeForSearch(r).includes(q)))
      : base;
    return filtered.slice(0, 6);
  }, [mentionState, miembros, user?.id]);

  useEffect(() => { setMentionIdx(0); }, [mentionState?.query]);

  const updateTrigger = (val: string, caret: number) => {
    setMentionState(detectMentionTrigger(val, caret));
  };

  const insertarMencion = (persona: DirectorioPersona) => {
    if (!mentionState) return;
    const before = texto.slice(0, mentionState.start);
    const afterStart = mentionState.start + 1 + mentionState.query.length;
    const after = texto.slice(afterStart);
    const token = `@[${persona.nombre}](${persona.user_id}) `;
    const nuevo = before + token + after;
    setTexto(nuevo);
    setMentionState(null);
    setTimeout(() => {
      const ta = taRef.current;
      if (!ta) return;
      const pos = (before + token).length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const onEnviar = async () => {
    if (!texto.trim() && adjs.length === 0) return;
    setEnviando(true);
    try {
      const menciones = extractMentionIds(texto);
      await enviarMensaje(canal.id, texto.trim(), adjs, menciones);
      setTexto(""); setAdjs([]); setMentionState(null);
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

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && sugerencias.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx((i) => (i + 1) % sugerencias.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIdx((i) => (i - 1 + sugerencias.length) % sugerencias.length); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertarMencion(sugerencias[mentionIdx]);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setMentionState(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar(); }
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
          <button onClick={() => unirseCanal(canal.id)} className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 md:px-3 py-1.5 text-[11px] md:text-[12px] font-medium transition hover:[background:var(--nuvia-bg-card)] shrink-0" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-primary)" }}>
            <UserPlus size={13} /> <span className="hidden sm:inline">Unirme</span>
          </button>
        )}
      </div>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 md:px-5 py-3 md:py-4 space-y-3" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.03))" }}>
        {msgs.length === 0 && (
          <div className="text-center text-sm py-10" style={{ color: "var(--nuvia-text-secondary)" }}>Sin mensajes aún. Empieza la conversación.</div>
        )}
        {msgs.map((m) => (
          <MensajeItem
            key={m.id}
            m={m}
            esMio={m.user_id === user?.id}
            meMencionan={!!user?.id && (m.menciones ?? []).includes(user.id)}
            persona={personasPorId[m.user_id]}
          />
        ))}
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

      <div className="relative border-t px-2 md:px-4 py-2 md:py-3 flex items-end gap-1.5 md:gap-2" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-secondary)", paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {mentionState && sugerencias.length > 0 && (
          <div
            className="absolute left-2 md:left-4 right-2 md:right-4 bottom-full mb-2 rounded-xl border shadow-2xl overflow-hidden z-50"
            style={{ background: "var(--nuvia-bg-card)", borderColor: "var(--nuvia-border)", maxWidth: 360 }}
          >
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>
              <AtSign size={11} /> Mencionar · {sugerencias.length}
            </div>
            <div className="max-h-64 overflow-y-auto">
              {sugerencias.map((p, i) => (
                <button
                  key={p.user_id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); insertarMencion(p); }}
                  onMouseEnter={() => setMentionIdx(i)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition"
                  style={{ background: i === mentionIdx ? "rgba(59,130,246,0.14)" : "transparent" }}
                >
                  <UserAvatar userId={p.user_id} url={p.foto_url} name={p.nombre} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate" style={{ color: "var(--nuvia-text-primary)" }}>{p.nombre}</div>
                    {p.roles?.[0] && <div className="text-[11px] truncate" style={{ color: "var(--nuvia-text-secondary)" }}>{p.roles[0]}</div>}
                  </div>
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 text-[10px] flex items-center justify-between" style={{ color: "var(--nuvia-text-secondary)", borderTop: "1px solid var(--nuvia-border)" }}>
              <span>↑↓ navegar · ↵ seleccionar</span>
              <span>Esc cerrar</span>
            </div>
          </div>
        )}

        <button onClick={() => fileRef.current?.click()} className="rounded-lg border p-2 transition hover:[background:var(--nuvia-bg-card)] shrink-0" style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }} title="Adjuntar archivo / imagen / PDF">
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
          ref={taRef}
          value={texto}
          onChange={(e) => {
            const val = e.target.value;
            setTexto(val);
            updateTrigger(val, e.target.selectionStart ?? val.length);
          }}
          onKeyUp={(e) => updateTrigger(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => updateTrigger(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onBlur={() => setTimeout(() => setMentionState(null), 120)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={`Mensaje en ${canal.nombre}…  Usa @ para mencionar`}
          className="nuvia-input nuvia-input-sm flex-1 min-w-0 resize-none"
        />
        <button onClick={onEnviar} disabled={enviando} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 md:px-4 py-2 text-sm font-semibold disabled:opacity-50 shrink-0" style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }} aria-label="Enviar">
          <Send size={14} /> <span className="hidden sm:inline">Enviar</span>
        </button>
      </div>
    </div>
  );
}

function TextoConMenciones({ texto, meMencionan }: { texto: string; meMencionan: boolean }) {
  const segs = parseMentions(texto);
  return (
    <div className="text-sm whitespace-pre-wrap break-words" style={{ color: "var(--nuvia-text-primary)" }}>
      {segs.map((s, i) => s.kind === "text" ? (
        <span key={i}>{s.value}</span>
      ) : (
        <span
          key={i}
          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[12.5px] font-medium mx-0.5 align-baseline"
          style={{
            background: meMencionan ? "rgba(59,130,246,0.22)" : "rgba(59,130,246,0.14)",
            color: "var(--nuvia-accent-blue)",
            border: "1px solid rgba(59,130,246,0.35)",
          }}
        >
          @{s.value}
        </span>
      ))}
    </div>
  );
}

function MensajeItem({ m, esMio, meMencionan, persona }: { m: Mensaje; esMio: boolean; meMencionan: boolean; persona?: { nombre: string; foto_url: string | null } }) {
  if (m.borrado) {
    return <div className="text-[11px] italic pl-12" style={{ color: "var(--nuvia-text-secondary)" }}>— mensaje eliminado —</div>;
  }
  return (
    <div
      className="flex gap-3 group rounded-lg"
      style={meMencionan ? { background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.28)", padding: "8px 10px" } : undefined}
    >
      <UserAvatar userId={m.user_id} url={persona?.foto_url ?? null} name={persona?.nombre ?? null} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{esMio ? "Tú" : (persona?.nombre ?? "Colaborador")}</span>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {meMencionan && (
            <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(59,130,246,0.18)", color: "var(--nuvia-accent-blue)" }}>
              <AtSign size={10} /> Te mencionaron
            </span>
          )}
          {esMio && (
            <button onClick={() => { if (confirm("¿Eliminar mensaje?")) borrarMensaje(m.id); }} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--nuvia-danger)" }}>
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {m.texto && <TextoConMenciones texto={m.texto} meMencionan={meMencionan} />}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {m.adjuntos.map((a, i) => (
              a.mime?.startsWith("audio/") ? (
                <VoiceNotePlayer key={i} path={a.path} mime={a.mime} nombre={a.nombre} />
              ) : (
                <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition hover:[background:var(--nuvia-bg-card)]" style={{ borderColor: "var(--nuvia-border)", background: "rgba(255,255,255,0.04)", color: "var(--nuvia-text-primary)" }}>
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
