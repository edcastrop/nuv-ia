import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  type Canal, type Mensaje, listMensajes, enviarMensaje, suscribirMensajes,
  subirAdjunto, getAdjuntoUrl, borrarMensaje, unirseCanal,
} from "@/lib/colaboracion";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { Paperclip, Send, Trash2, Download, UserPlus, Hash, Users as UsersIcon } from "lucide-react";

const AZUL = "#445DA3";

export function CanalChat({ canal }: { canal: Canal }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [adjs, setAdjs] = useState<Mensaje["adjuntos"]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    listMensajes(canal.id).then((m) => { if (active) setMsgs(m); });
    const unsub = suscribirMensajes(canal.id, (nuevo) => {
      setMsgs((prev) => prev.some((x) => x.id === nuevo.id) ? prev : [...prev, nuevo]);
    });
    return () => { active = false; unsub(); };
  }, [canal.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

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

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="border-b border-[#E3E7EE] px-5 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#242424]">
            {canal.tipo === "area" || canal.tipo === "custom" ? <Hash size={16} className="text-[#445DA3]" /> : <UsersIcon size={16} className="text-[#445DA3]" />}
            {canal.nombre}
          </div>
          {canal.descripcion && <div className="text-[12px] text-[#242424]/55 mt-0.5">{canal.descripcion}</div>}
        </div>
        {!canal.privado && (
          <button onClick={() => unirseCanal(canal.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] font-medium hover:bg-[#F7F9FB]">
            <UserPlus size={13} /> Unirme
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {msgs.length === 0 && (
          <div className="text-center text-sm text-[#242424]/50 py-10">Sin mensajes aún. Empieza la conversación.</div>
        )}
        {msgs.map((m) => <MensajeItem key={m.id} m={m} esMio={m.user_id === user?.id} />)}
        <div ref={endRef} />
      </div>

      {adjs.length > 0 && (
        <div className="border-t border-[#E3E7EE] px-5 py-2 flex gap-2 flex-wrap bg-[#F7F9FB]">
          {adjs.map((a, i) => (
            <div key={i} className="text-[11px] bg-white border border-[#E3E7EE] rounded px-2 py-1 flex items-center gap-1">
              📎 {a.nombre}
              <button onClick={() => setAdjs((p) => p.filter((_, j) => j !== i))} className="text-[#B42318] ml-1">×</button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-[#E3E7EE] px-4 py-3 flex items-end gap-2">
        <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-[#E3E7EE] p-2 hover:bg-[#F7F9FB]">
          <Paperclip size={16} className="text-[#242424]/70" />
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnviar(); } }}
          rows={1}
          placeholder={`Mensaje en ${canal.nombre}…`}
          className="flex-1 rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm resize-none outline-none focus:border-[#445DA3]"
        />
        <button onClick={onEnviar} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: AZUL }}>
          <Send size={14} /> Enviar
        </button>
      </div>
    </div>
  );
}

function MensajeItem({ m, esMio }: { m: Mensaje; esMio: boolean }) {
  if (m.borrado) {
    return <div className="text-[11px] italic text-[#242424]/40 pl-12">— mensaje eliminado —</div>;
  }
  return (
    <div className="flex gap-3 group">
      <UserAvatar userId={m.user_id} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-[#242424]/55">
          <span className="font-semibold text-[#242424]">{esMio ? "Tú" : "Usuario"}</span>
          <span>{new Date(m.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</span>
          {esMio && (
            <button onClick={() => { if (confirm("¿Eliminar mensaje?")) borrarMensaje(m.id); }} className="opacity-0 group-hover:opacity-100 text-[#B42318]">
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {m.texto && <div className="text-sm text-[#242424] whitespace-pre-wrap break-words">{m.texto}</div>}
        {m.adjuntos?.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {m.adjuntos.map((a, i) => (
              <button key={i} onClick={async () => { const url = await getAdjuntoUrl(a.path); window.open(url, "_blank"); }} className="inline-flex items-center gap-1 rounded-md border border-[#E3E7EE] bg-[#F7F9FB] px-2 py-1 text-[11px] hover:bg-white">
                <Download size={11} /> {a.nombre}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
