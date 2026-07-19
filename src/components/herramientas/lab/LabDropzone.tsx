// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Dropzone
//
// Reutiliza el server fn existente `extractStatement` (sin modificarlo)
// para procesar PDFs. Renderiza páginas con pdfjs-dist client-side y
// las envía como imágenes al parser. NO persiste PDF, contraseñas ni
// resultado OCR. Todo transitorio en memoria del componente.
// ─────────────────────────────────────────────────────────────

import { useCallback, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Lock, UploadCloud } from "lucide-react";
import { extractStatement, type ExtractoData } from "@/lib/extracto.functions";

async function loadPdfJs() {
  const { ensurePdfJsPolyfills } = await import("@/lib/pdfjsPolyfill");
  ensurePdfJsPolyfills();
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as {
    default: string;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function renderPdf(file: File, password?: string) {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), password });
    const pdf = await loadingTask.promise;
    const max = Math.min(pdf.numPages, 6);
    const images: { mime: string; dataUrl: string }[] = [];
    for (let i = 1; i <= max; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
      images.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
    }
    return { images, needsPassword: false as const };
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number };
    if (e?.name === "PasswordException") {
      return { images: [], needsPassword: true as const, wrongPassword: e.code === 2 };
    }
    throw err;
  }
}

export interface LabDropzoneProps {
  onData: (data: ExtractoData) => void;
  onError: (msg: string) => void;
  onReset: () => void;
}

export function LabDropzone({ onData, onError, onReset }: LabDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "rendering" | "extracting">("idle");
  const call = useServerFn(extractStatement);
  const inputRef = useRef<HTMLInputElement>(null);

  const process = useCallback(
    async (theFile: File, pwd?: string) => {
      setStatus("rendering");
      try {
        const r = await renderPdf(theFile, pwd);
        if (r.needsPassword) {
          setNeedsPassword(true);
          setWrongPassword(Boolean((r as { wrongPassword?: boolean }).wrongPassword));
          setStatus("idle");
          return;
        }
        setNeedsPassword(false);
        setStatus("extracting");
        const resp = await call({ data: { images: r.images } });
        if (resp?.error || !resp?.data) {
          onError(resp?.error ?? "No se pudo leer el extracto.");
          setStatus("idle");
          return;
        }
        onData(resp.data);
        setStatus("idle");
      } catch (err) {
        onError(err instanceof Error ? err.message : "Error inesperado al leer el PDF.");
        setStatus("idle");
      }
    },
    [call, onData, onError],
  );

  const onPick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    setPassword("");
    setNeedsPassword(false);
    setWrongPassword(false);
    void process(f);
  };

  const onUnlock = () => {
    if (!file || !password) return;
    void process(file, password);
  };

  const onClear = () => {
    setFile(null);
    setPassword("");
    setNeedsPassword(false);
    setWrongPassword(false);
    setStatus("idle");
    if (inputRef.current) inputRef.current.value = "";
    onReset();
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center transition hover:border-white/30">
        <UploadCloud className="h-6 w-6 text-white/60" />
        <span className="text-[13px] text-white/80">
          {file ? file.name : "Selecciona el PDF del extracto (hipotecario o leasing)"}
        </span>
        <span className="text-[11px] text-white/50">
          Sin persistencia · Sin almacenamiento · Todo el análisis ocurre en tu navegador
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>

      {needsPassword && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <Lock className="h-4 w-4 text-amber-300" />
          <input
            type="password"
            placeholder="Contraseña del PDF"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-[13px] text-white outline-none placeholder:text-white/40"
          />
          <button
            onClick={onUnlock}
            className="rounded-lg bg-white/10 px-3 py-1 text-[12px] font-semibold text-white hover:bg-white/20"
          >
            Abrir
          </button>
          {wrongPassword && (
            <span className="text-[11px] text-red-300">Contraseña incorrecta</span>
          )}
        </div>
      )}

      {status !== "idle" && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          {status === "rendering" ? "Leyendo páginas del PDF…" : "Analizando extracto con NUVIA…"}
        </div>
      )}

      {file && !needsPassword && status === "idle" && (
        <div className="mt-3 flex items-center justify-between text-[12px] text-white/60">
          <span className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> {file.name}
          </span>
          <button
            onClick={onClear}
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:text-white"
          >
            Limpiar sesión
          </button>
        </div>
      )}
    </div>
  );
}
