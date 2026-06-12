import { useEffect, useState } from "react";
import { getAdjuntoUrl } from "@/lib/colaboracion";
import { Mic } from "lucide-react";

interface Props {
  path: string;
  mime?: string;
  nombre?: string;
  /** True para burbuja propia (fondo azul) */
  esMio?: boolean;
}

export function VoiceNotePlayer({ path, esMio }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getAdjuntoUrl(path)
      .then((u) => { if (alive) setUrl(u); })
      .catch((e) => { if (alive) setErr((e as Error).message); });
    return () => { alive = false; };
  }, [path]);

  return (
    <div
      className="mt-1.5 inline-flex items-center gap-2 rounded-xl px-2 py-1.5 max-w-full"
      style={esMio
        ? { background: "rgba(255,255,255,0.18)" }
        : { background: "rgba(255,255,255,0.05)", border: "1px solid var(--nuvia-border)" }}
    >
      <Mic size={14} style={{ color: esMio ? "var(--nuvia-text-primary)" : "var(--nuvia-accent-green)" }} />
      {url ? (
        <audio
          src={url}
          controls
          preload="metadata"
          className="h-8 max-w-[220px] sm:max-w-[280px]"
        />
      ) : err ? (
        <span className="text-[11px]" style={{ color: esMio ? "rgba(255,255,255,0.8)" : "var(--nuvia-danger)" }}>No se pudo cargar</span>
      ) : (
        <span className="text-[11px]" style={{ color: esMio ? "rgba(255,255,255,0.8)" : "var(--nuvia-text-secondary)" }}>Cargando…</span>
      )}
    </div>
  );
}
