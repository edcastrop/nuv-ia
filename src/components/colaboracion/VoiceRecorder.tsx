import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";

interface Props {
  /** Called when the user confirms sending. Receives the recorded audio as a File. */
  onSend: (file: File) => Promise<void> | void;
  disabled?: boolean;
}

function pickMime(): string {
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of cands) {
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* noop */ }
  }
  return "";
}

function extFromMime(m: string) {
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  return "webm";
}

export function VoiceRecorder({ onSend, disabled }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "preview" | "sending">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [mime, setMime] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
  };

  useEffect(() => () => {
    cleanupStream();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const start = async () => {
    if (disabled) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      alert("Tu navegador no soporta grabación de audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const m = pickMime();
      setMime(m);
      const rec = m ? new MediaRecorder(stream, { mimeType: m }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const useMime = m || rec.mimeType || "audio/webm";
        const b = new Blob(chunksRef.current, { type: useMime });
        setBlob(b);
        setMime(useMime);
        setPreviewUrl(URL.createObjectURL(b));
        setState("preview");
        cleanupStream();
      };
      recRef.current = rec;
      rec.start();
      setSeconds(0);
      tickRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setState("recording");
    } catch (e) {
      alert("No se pudo acceder al micrófono. Revisa los permisos del navegador o la app.");
      console.error(e);
      cleanupStream();
    }
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
  };

  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setBlob(null);
    setSeconds(0);
    setState("idle");
  };

  const send = async () => {
    if (!blob) return;
    setState("sending");
    try {
      const ext = extFromMime(mime);
      const file = new File([blob], `nota-voz-${Date.now()}.${ext}`, { type: mime || "audio/webm" });
      await onSend(file);
      discard();
    } catch (e) {
      console.error(e);
      alert((e as Error).message || "No se pudo enviar la nota de voz.");
      setState("preview");
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        className="rounded-lg border p-2 transition hover:[background:var(--nuvia-bg-card)] shrink-0 disabled:opacity-50"
        style={{ borderColor: "var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}
        title="Grabar nota de voz"
        aria-label="Grabar nota de voz"
      >
        <Mic size={16} />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5" style={{ borderColor: "rgba(255,107,107,0.35)", background: "rgba(255,107,107,0.12)" }}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping" style={{ background: "var(--nuvia-danger)" }} />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: "var(--nuvia-danger)" }} />
        </span>
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--nuvia-danger)" }}>{mmss}</span>
        <button
          type="button"
          onClick={() => { stop(); }}
          className="rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }}
          title="Detener"
        >
          <Square size={12} />
        </button>
        <button
          type="button"
          onClick={() => { try { recRef.current?.stop(); } catch { /* noop */ } cleanupStream(); discard(); }}
          className="rounded-md px-2 py-1 text-[11px] font-semibold"
          style={{ color: "var(--nuvia-danger)" }}
          title="Cancelar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    );
  }

  // preview / sending
  return (
    <div className="flex items-center gap-2 rounded-lg border px-2 py-1.5" style={{ borderColor: "var(--nuvia-border)", background: "var(--nuvia-bg-tertiary)" }}>
      {previewUrl && (
        <audio src={previewUrl} controls preload="metadata" className="h-8 max-w-[180px] sm:max-w-[240px]" />
      )}
      <button
        type="button"
        onClick={discard}
        disabled={state === "sending"}
        className="rounded-md px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
        style={{ color: "var(--nuvia-danger)" }}
        title="Descartar"
      >
        <Trash2 size={12} />
      </button>
      <button
        type="button"
        onClick={send}
        disabled={state === "sending"}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
        style={{ background: "var(--nuvia-gradient-primary)", color: "var(--nuvia-text-primary)" }}
        title="Enviar nota de voz"
      >
        {state === "sending" ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
      </button>
    </div>
  );
}
