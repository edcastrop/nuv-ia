import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import {
  type Canal, type Mensaje, type DMResumen,
  listMisDMs, listDirectorio, getOrCreateDM, listMensajes, suscribirMensajes,
  enviarMensaje, subirAdjunto, getAdjuntoUrl, marcarCanalLeido, getOtroMiembroLectura,
} from "@/lib/colaboracion";
import {
  Send, Paperclip, Download, Search, Check, CheckCheck, Image as ImageIcon, FileText,
  Plus, AlertCircle, ArrowLeft, MessageSquare, Sparkles, User as UserIcon,
  Briefcase, History, Activity, Zap, Clock, TrendingUp,
} from "lucide-react";
import { EmojiPickerPopover } from "@/components/colaboracion/EmojiPicker";
import { PresenceDot } from "@/components/presencia/PresenceDot";
import { VoiceRecorder } from "@/components/colaboracion/VoiceRecorder";
import { VoiceNotePlayer } from "@/components/colaboracion/VoiceNotePlayer";

interface Props {
  initialCanalId?: string;
  onCanalChange?: (id: string) => void;
}

interface QuickCtx {
  casosActivos: number;
  qaAbiertos: number;
  ultimaActividad: string | null;
  ultimoCaso: string | null;
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
  const [quickCtx, setQuickCtx] = useState<QuickCtx | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);

  const setCanal = (c: Canal | null) => {
    setCanalState(c);
    if (c) onCanalChange?.(c.id);
  };

  const recargarDMs = () => listMisDMs().then(setDms);

  useEffect(() => { recargarDMs(); listDirectorio().then(setDir); }, []);

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

  useEffect(() => {
    const scroller = messagesScrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);

  // Quick context lookup — casos activos + QA abiertos con el otro usuario
  const d = useMemo(() => dms.find((x) => x.canal.id === canal?.id) ?? null, [dms, canal?.id]);
  useEffect(() => {
    if (!d) { setQuickCtx(null); return; }
    let cancel = false;
    (async () => {
      const uid = d.otro.user_id;
      const [exps, qas] = await Promise.all([
        supabase.from("expedientes" as never)
          .select("id,cliente_nombre,updated_at,estado")
          .or(`analista_id.eq.${uid},asesor_id.eq.${uid}`)
          .neq("estado", "cerrado")
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase.from("qa_auditorias" as never)
          .select("id")
          .eq("analista_id", uid)
          .in("estado", ["pendiente", "en_revision", "abierta"])
          .limit(50),
      ]);
      if (cancel) return;
      const rows = (exps.data ?? []) as Array<{ id: string; cliente_nombre: string | null; updated_at: string }>;
      setQuickCtx({
        casosActivos: rows.length,
        qaAbiertos: (qas.data ?? []).length,
        ultimaActividad: rows[0]?.updated_at ?? null,
        ultimoCaso: rows[0]?.cliente_nombre ?? null,
      });
    })();
    return () => { cancel = true; };
  }, [d?.otro.user_id]);

  const dmsFiltrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return dms;
    return dms.filter((x) => x.otro.nombre.toLowerCase().includes(s) || x.otro.roles.some((r) => r.toLowerCase().includes(s)));
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

  const totalNoLeidos = dms.reduce((s, x) => s + x.no_leidos, 0);
  const hasCanal = !!canal;

  // Group messages by date for separators
  const grouped = useMemo(() => groupByDate(msgs), [msgs]);

  return (
    <div className="relative h-[calc(100dvh-4rem)] flex flex-col overflow-hidden" style={{ background: "#050816" }}>
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />
      <div className="pointer-events-none absolute -top-24 -left-24 h-[440px] w-[440px] rounded-full blur-[140px]" style={{ background: "radial-gradient(circle, rgba(68,93,163,0.32), transparent 70%)" }} />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[520px] w-[520px] rounded-full blur-[160px]" style={{ background: "radial-gradient(circle, rgba(52,199,89,0.14), transparent 70%)" }} />

      <div className="relative z-10 px-4 md:px-6 pt-5 pb-4 flex-1 flex flex-col min-h-0">
        {/* HERO / HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: "linear-gradient(135deg, rgba(68,93,163,0.22), rgba(30,58,138,0.18))",
                border: "1px solid rgba(120,150,220,0.35)",
                color: "#c9d6ff",
                boxShadow: "0 0 24px rgba(68,93,163,0.28), inset 0 0 12px rgba(120,150,220,0.10)",
                backdropFilter: "blur(14px)",
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5b8dff] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5b8dff]" />
              </span>
              NUVIA · DIRECT MESSAGES
            </div>
            <div className="hidden md:flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-white/95">Centro privado de comunicación operativa</span>
              <span className="text-[11px] text-white/45">Mensajes internos · casos · QA · IA context</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {totalNoLeidos > 0 && (
              <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(255,107,107,0.14)", border: "1px solid rgba(255,107,107,0.45)", color: "#ff9b9b" }}>
                {totalNoLeidos} sin leer
              </span>
            )}
            <button
              onClick={() => setShowNuevo(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white transition hover:scale-[1.02]"
              style={{
                background: "linear-gradient(135deg, #4c74e0, #3457c8)",
                boxShadow: "0 0 22px rgba(76,116,224,0.45), inset 0 1px 0 rgba(255,255,255,0.14)",
              }}
            >
              <Plus size={13} /> Nuevo mensaje
            </button>
          </div>
        </div>

        {accesoError && (
          <div className="mb-3 rounded-xl border-l-4 px-4 py-3 text-sm text-white/90 flex items-start gap-2"
            style={{ background: "rgba(255,107,107,0.08)", borderLeftColor: "#ff6b6b", border: "1px solid rgba(255,107,107,0.28)" }}>
            <AlertCircle size={16} className="mt-0.5 text-[#ff9b9b]" />
            <div>{accesoError}</div>
          </div>
        )}

        {/* MAIN GRID */}
        <div
          className="flex flex-col md:grid gap-3 md:gap-4 flex-1 min-h-0"
          style={{
            gridTemplateColumns: hasCanal ? "320px minmax(0,1fr) 300px" : "320px minmax(0,1fr)",
          }}
        >
          {/* PANEL IZQUIERDO */}
          <GlassPanel className={`p-0 overflow-hidden flex-col ${hasCanal ? "hidden md:flex" : "flex flex-1"}`}>
            <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare size={12} className="text-white/50" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">Conversaciones</span>
                </div>
                <span className="text-[10px] text-white/40">{dms.length}</span>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar conversación…"
                  className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[12px] text-white placeholder-white/40 outline-none transition focus:ring-1"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {dmsFiltrados.length === 0 && (
                <div className="p-6 text-center text-[12px] text-white/50">
                  Aún no tienes conversaciones. Pulsa <span className="text-white/80 font-semibold">Nuevo mensaje</span>.
                </div>
              )}
              {dmsFiltrados.map((x) => {
                const activo = canal?.id === x.canal.id;
                return (
                  <button
                    key={x.canal.id}
                    onClick={() => setCanal(x.canal)}
                    className="group w-full flex items-start gap-3 px-3 py-2.5 text-left transition relative"
                    style={{
                      background: activo
                        ? "linear-gradient(90deg, rgba(76,116,224,0.20), rgba(76,116,224,0.02))"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!activo) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { if (!activo) e.currentTarget.style.background = "transparent"; }}
                  >
                    {activo && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: "linear-gradient(180deg, #5b8dff, #3457c8)", boxShadow: "0 0 12px rgba(91,141,255,0.6)" }} />}
                    <div className="relative shrink-0">
                      <UserAvatar userId={x.otro.user_id} name={x.otro.nombre} size="md" />
                      <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2" style={{ background: "#050816", padding: 1 }}>
                        <PresenceDot userId={x.otro.user_id} lastSeenAt={x.otro.last_seen_at} visible={x.otro.presencia_visible} />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12.5px] font-semibold text-white/95 leading-tight break-words" title={x.otro.nombre}>{x.otro.nombre}</div>
                        {x.ultimo_mensaje && <div className="text-[10px] shrink-0 text-white/45 font-medium">{formatRel(x.ultimo_mensaje.created_at)}</div>}
                      </div>
                      <div className="text-[10.5px] truncate text-white/50 uppercase tracking-wider font-medium">{x.otro.roles[0] || "Colaborador"}</div>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="text-[11.5px] truncate text-white/65 flex-1 min-w-0">
                          {x.ultimo_mensaje?.user_id === user?.id && <span className="text-white/45">Tú: </span>}
                          {x.ultimo_mensaje?.texto || (x.ultimo_mensaje ? "📎 adjunto" : <span className="italic text-white/40">Sin mensajes</span>)}
                        </div>
                        {x.no_leidos > 0 && (
                          <span className="rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1.5 text-[10px] font-bold text-white shrink-0"
                            style={{ background: "linear-gradient(135deg, #4c74e0, #3457c8)", boxShadow: "0 0 10px rgba(76,116,224,0.6)" }}>
                            {x.no_leidos}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </GlassPanel>

          {/* CHAT PANEL */}
          <GlassPanel className={`p-0 overflow-hidden flex-col ${hasCanal ? "flex flex-1" : "hidden md:flex"}`}>
            {!canal ? (
              <EmptyState onOpen={() => setShowNuevo(true)} />
            ) : (
              <>
                <ChatHeader d={d} canal={canal} onBack={() => setCanalState(null)} quickCtx={quickCtx} />

                <div ref={messagesScrollRef} className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-1"
                  style={{ background: "linear-gradient(180deg, rgba(76,116,224,0.02) 0%, transparent 40%, rgba(52,199,89,0.02) 100%)" }}>
                  {grouped.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-white/50">
                      <div className="rounded-full p-4" style={{ background: "rgba(76,116,224,0.10)", border: "1px solid rgba(76,116,224,0.24)" }}>
                        <Sparkles size={20} className="text-[#8faaff]" />
                      </div>
                      <div className="text-[13px] font-medium">Sin mensajes todavía</div>
                      <div className="text-[11px] max-w-[280px]">Este es el inicio de tu conversación privada. Los mensajes son encriptados y visibles solo para ustedes.</div>
                    </div>
                  )}
                  {grouped.map((grp) => (
                    <div key={grp.label}>
                      <DateSeparator label={grp.label} />
                      {grp.msgs.map((m) => (
                        <MensajeBurbuja key={m.id} m={m} esMio={m.user_id === user?.id} otroLectura={otroLectura} />
                      ))}
                    </div>
                  ))}
                  <div ref={endRef} />
                </div>

                {adjs.length > 0 && (
                  <div className="border-t px-4 py-2 flex gap-2 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    {adjs.map((a, i) => (
                      <div key={i} className="text-[11px] rounded-lg px-2 py-1 flex items-center gap-1.5 text-white/85"
                        style={{ background: "rgba(76,116,224,0.14)", border: "1px solid rgba(76,116,224,0.32)" }}>
                        {iconAdj(a.mime)} {a.nombre}
                        <button onClick={() => setAdjs((p) => p.filter((_, j) => j !== i))} className="ml-1 text-[#ff9b9b] hover:text-[#ff6b6b]">×</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* INPUT BAR */}
                <div className="border-t px-3 md:px-4 py-3 flex items-end gap-2"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: "linear-gradient(180deg, rgba(10,15,32,0.6), rgba(5,8,22,0.9))",
                    backdropFilter: "blur(18px)",
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                  }}>
                  <button onClick={() => fileRef.current?.click()}
                    className="rounded-lg p-2 transition text-white/60 hover:text-white shrink-0"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
                    title="Adjuntar">
                    <Paperclip size={15} />
                  </button>
                  <input ref={fileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden"
                    onChange={(e) => { onFile(e.target.files?.[0]); if (fileRef.current) fileRef.current.value = ""; }} />
                  <VoiceRecorder onSend={onVoiceSend} disabled={enviando} />
                  <EmojiPickerPopover onPick={(e) => setTexto((t) => t + e)} />
                  <div className="flex-1 min-w-0 relative">
                    <textarea
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar(); } }}
                      rows={1}
                      placeholder="Escribe un mensaje interno…"
                      className="w-full resize-none rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/40 outline-none transition"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.10)",
                        maxHeight: 140,
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(91,141,255,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(76,116,224,0.14)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                  <button onClick={onEnviar} disabled={enviando || (!texto.trim() && adjs.length === 0)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 shrink-0 transition hover:scale-[1.03] disabled:hover:scale-100"
                    style={{
                      background: "linear-gradient(135deg, #4c74e0, #3457c8)",
                      boxShadow: "0 0 20px rgba(76,116,224,0.45), inset 0 1px 0 rgba(255,255,255,0.14)",
                    }}
                    aria-label="Enviar">
                    <Send size={14} /> <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </>
            )}
          </GlassPanel>

          {/* QUICK CONTEXT — RIGHT PANEL */}
          {hasCanal && d && (
            <GlassPanel className="hidden lg:flex p-0 overflow-hidden flex-col">
              <QuickContextPanel d={d} ctx={quickCtx} />
            </GlassPanel>
          )}
        </div>
      </div>

      {/* MODAL NUEVO */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: "rgba(3,6,20,0.72)", backdropFilter: "blur(8px)" }} onClick={() => setShowNuevo(false)}>
          <div className="w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto"
            style={{
              background: "linear-gradient(180deg, rgba(15,22,45,0.98), rgba(8,12,28,0.98))",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 40px rgba(76,116,224,0.20)",
            }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-[#8faaff]">NUVIA · Direct</div>
                <h3 className="text-base font-semibold text-white">Nuevo mensaje directo</h3>
              </div>
              <button onClick={() => setShowNuevo(false)} className="text-2xl leading-none px-2 text-white/60 hover:text-white">×</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {dir.filter((p) => p.user_id !== user?.id).map((p) => (
                <button key={p.user_id} onClick={() => abrirConUsuario(p.user_id)}
                  className="flex items-center gap-3 rounded-xl p-3 text-left transition hover:scale-[1.01]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <UserAvatar userId={p.user_id} name={p.nombre} size="md" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-white leading-tight break-words" title={p.nombre}>{p.nombre}</div>
                    <div className="text-[11px] truncate text-white/50">{p.roles.join(", ") || "—"}</div>
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

/* -------------------- Subcomponents -------------------- */

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{
      background: "linear-gradient(180deg, rgba(15,22,45,0.75), rgba(10,15,32,0.85))",
      border: "1px solid rgba(255,255,255,0.06)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 20px 60px rgba(0,0,0,0.35)",
      backdropFilter: "blur(18px)",
    }}>
      {children}
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-2xl p-5" style={{ background: "radial-gradient(circle, rgba(76,116,224,0.20), transparent 70%)", border: "1px solid rgba(76,116,224,0.30)" }}>
        <MessageSquare size={32} className="text-[#8faaff]" />
      </div>
      <div>
        <div className="text-white font-semibold text-[15px] mb-1">Selecciona una conversación</div>
        <div className="text-white/50 text-[12px] max-w-[320px]">Elige un colaborador de la lista o inicia una nueva conversación privada. Todos los mensajes son internos y operativos.</div>
      </div>
      <button onClick={onOpen}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white transition hover:scale-[1.02]"
        style={{ background: "linear-gradient(135deg, #4c74e0, #3457c8)", boxShadow: "0 0 20px rgba(76,116,224,0.45)" }}>
        <Plus size={13} /> Iniciar conversación
      </button>
    </div>
  );
}

function ChatHeader({ d, canal, onBack, quickCtx }: { d: DMResumen | null; canal: Canal; onBack: () => void; quickCtx: QuickCtx | null }) {
  const BackBtn = (
    <button onClick={onBack} className="md:hidden rounded-lg p-1.5 -ml-1 transition text-white/70 hover:text-white hover:bg-white/5 shrink-0" aria-label="Volver">
      <ArrowLeft size={18} />
    </button>
  );
  if (!d) {
    return (
      <div className="border-b px-4 py-3 flex items-center gap-2 text-sm font-semibold text-white"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
        {BackBtn}{canal.nombre}
      </div>
    );
  }
  return (
    <div className="border-b px-4 md:px-5 py-3"
      style={{ borderColor: "rgba(255,255,255,0.06)", background: "linear-gradient(180deg, rgba(76,116,224,0.06), transparent)" }}>
      <div className="flex flex-wrap items-start gap-3">
        {BackBtn}
        <div className="relative shrink-0">
          <UserAvatar userId={d.otro.user_id} name={d.otro.nombre} size="md" />
          <span className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2" style={{ background: "#050816", padding: 1 }}>
            <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} />
          </span>
        </div>
        <div className="min-w-[220px] flex-1 pr-2">
          <div className="text-[14px] font-semibold text-white leading-tight break-words" title={d.otro.nombre}>{d.otro.nombre}</div>
          <div className="text-[11px] text-white/55 truncate flex items-center gap-1.5 mt-0.5">
            <span className="uppercase tracking-wider">{d.otro.roles[0] || "Colaborador"}</span>
            <span className="text-white/25">·</span>
            <PresenceDot userId={d.otro.user_id} lastSeenAt={d.otro.last_seen_at} visible={d.otro.presencia_visible} showText />
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          <HeaderBtn icon={<UserIcon size={13} />} label="Perfil" />
          <HeaderBtn icon={<Briefcase size={13} />} label="Casos" />
          <HeaderBtn icon={<History size={13} />} label="Historial" />
          <HeaderBtn icon={<Sparkles size={13} />} label="IA Context" tone="blue" />
        </div>
      </div>
      {/* KPIs compactos */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <MiniKpi icon={<Briefcase size={11} />} label="Casos activos" value={quickCtx?.casosActivos ?? "—"} />
        <MiniKpi icon={<Activity size={11} />} label="Pendientes" value={quickCtx?.casosActivos ?? "—"} />
        <MiniKpi icon={<Zap size={11} />} label="QA abiertos" value={quickCtx?.qaAbiertos ?? "—"} tone={quickCtx && quickCtx.qaAbiertos > 0 ? "amber" : "default"} />
      </div>
    </div>
  );
}

function HeaderBtn({ icon, label, tone = "default" }: { icon: React.ReactNode; label: string; tone?: "default" | "blue" }) {
  return (
    <button className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition"
      style={tone === "blue"
        ? { background: "linear-gradient(135deg, rgba(76,116,224,0.22), rgba(52,87,200,0.14))", border: "1px solid rgba(120,150,220,0.35)", color: "#c9d6ff", boxShadow: "0 0 14px rgba(76,116,224,0.24)" }
        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)" }}>
      {icon} <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

function MiniKpi({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: number | string; tone?: "default" | "amber" }) {
  const color = tone === "amber" ? "#ffc86b" : "#8faaff";
  return (
    <div className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span style={{ color }}>{icon}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      <span className="text-[12px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }} />
      <span className="text-[10px] uppercase tracking-widest font-bold text-white/40 px-2">{label}</span>
      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }} />
    </div>
  );
}

function MensajeBurbuja({ m, esMio, otroLectura }: { m: Mensaje; esMio: boolean; otroLectura: string | null }) {
  if (m.borrado) {
    return <div className={`text-[11px] italic text-white/40 my-1 ${esMio ? "text-right" : ""}`}>— mensaje eliminado —</div>;
  }
  const leido = esMio && otroLectura && new Date(m.created_at) <= new Date(otroLectura);
  return (
    <div className={`flex ${esMio ? "justify-end" : "justify-start"} mb-1.5 group`}>
      <div
        className="max-w-[85%] md:max-w-[72%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed"
        style={esMio
          ? {
              background: "linear-gradient(135deg, #4c74e0, #3457c8)",
              color: "#fff",
              boxShadow: "0 4px 18px rgba(76,116,224,0.30), inset 0 1px 0 rgba(255,255,255,0.14)",
              borderBottomRightRadius: 4,
            }
          : {
              background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              color: "rgba(255,255,255,0.94)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              borderBottomLeftRadius: 4,
            }}
      >
        {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {m.adjuntos.map((a, i) => (
              a.mime?.startsWith("audio/") ? (
                <VoiceNotePlayer key={i} path={a.path} mime={a.mime} nombre={a.nombre} esMio={esMio} />
              ) : (
                <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition hover:opacity-90"
                  style={esMio
                    ? { background: "rgba(255,255,255,0.18)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.90)" }}>
                  {iconAdj(a.mime)} <span className="truncate max-w-[180px]">{a.nombre}</span> <Download size={10} />
                </button>
              )
            ))}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-1 text-[10px] ${esMio ? "justify-end" : ""}`}
          style={{ color: esMio ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.42)" }}>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {esMio && (leido ? <CheckCheck size={12} style={{ color: "#7dffb0" }} /> : <Check size={12} />)}
        </div>
      </div>
    </div>
  );
}

function QuickContextPanel({ d, ctx }: { d: DMResumen; ctx: QuickCtx | null }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={12} className="text-[#8faaff]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/55">Quick Context</span>
        </div>
        <div className="text-[13px] font-semibold text-white leading-tight break-words" title={d.otro.nombre}>{d.otro.nombre}</div>
        <div className="text-[10.5px] text-white/45 uppercase tracking-wider">{d.otro.roles[0] || "Colaborador"}</div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <CtxCard icon={<Briefcase size={13} />} label="Casos compartidos" value={ctx?.casosActivos ?? "—"} tone="blue" />
        <CtxCard icon={<Zap size={13} />} label="QA abiertos" value={ctx?.qaAbiertos ?? "—"} tone={ctx && ctx.qaAbiertos > 0 ? "amber" : "blue"} />
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-white/50" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/50">Última actividad</span>
          </div>
          <div className="text-[12px] text-white/90 font-medium">
            {ctx?.ultimaActividad ? formatRel(ctx.ultimaActividad) : "—"}
          </div>
          {ctx?.ultimoCaso && (
            <div className="text-[11px] text-white/55 truncate mt-1">{ctx.ultimoCaso}</div>
          )}
        </div>
        <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={12} className="text-[#7dffb0]" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/50">Score productividad</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold text-white leading-none">92</span>
            <span className="text-[11px] text-[#7dffb0] font-semibold">/100</span>
          </div>
          <div className="text-[10px] text-white/45 mt-1">Tiempo prom. respuesta: <span className="text-white/75 font-semibold">4m 21s</span></div>
        </div>
        <div className="rounded-xl p-3" style={{ background: "linear-gradient(135deg, rgba(76,116,224,0.10), rgba(52,199,89,0.06))", border: "1px solid rgba(76,116,224,0.24)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={12} className="text-[#8faaff]" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#c9d6ff]">Sugerencia IA</span>
          </div>
          <div className="text-[11.5px] text-white/80 leading-relaxed">
            {ctx && ctx.qaAbiertos > 0
              ? `Tiene ${ctx.qaAbiertos} auditoría${ctx.qaAbiertos > 1 ? "s" : ""} QA pendiente${ctx.qaAbiertos > 1 ? "s" : ""}. Considera revisar antes de asignar más casos.`
              : "Colaborador con carga saludable. Puedes asignar nuevos casos con seguridad."}
          </div>
        </div>
      </div>
    </div>
  );
}

function CtxCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: "blue" | "amber" }) {
  const color = tone === "amber" ? "#ffc86b" : "#8faaff";
  return (
    <div className="rounded-xl p-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="rounded-lg p-2" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-white/50">{label}</div>
        <div className="text-[18px] font-bold text-white leading-tight">{value}</div>
      </div>
    </div>
  );
}

/* -------------------- helpers -------------------- */

function iconAdj(mime?: string) {
  if (mime?.startsWith("image/")) return <ImageIcon size={11} />;
  if (mime === "application/pdf") return <FileText size={11} />;
  return <Paperclip size={11} />;
}

function formatRel(iso: string) {
  const d = new Date(iso); const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  if (hrs < 48) return "ayer";
  const diffDays = diffMs / 86400000;
  if (diffDays < 7) return d.toLocaleDateString("es-CO", { weekday: "short" });
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit" });
}

function groupByDate(msgs: Mensaje[]): Array<{ label: string; msgs: Mensaje[] }> {
  const out: Array<{ label: string; msgs: Mensaje[] }> = [];
  const now = new Date();
  for (const m of msgs) {
    const d = new Date(m.created_at);
    const daysAgo = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    let label: string;
    if (daysAgo === 0) label = "Hoy";
    else if (daysAgo === 1) label = "Ayer";
    else if (daysAgo < 7) label = d.toLocaleDateString("es-CO", { weekday: "long" });
    else label = d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
    const last = out[out.length - 1];
    if (last && last.label === label) last.msgs.push(m);
    else out.push({ label, msgs: [m] });
  }
  return out;
}
