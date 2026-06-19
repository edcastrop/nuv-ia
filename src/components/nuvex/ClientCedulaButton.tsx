import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  Sparkles,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  IdCard,
} from "lucide-react";
import { extractCedula, type CedulaData } from "@/lib/cedula.functions";
import { normalizeColombiaLocation } from "@/lib/colombiaLocations";
import { supabase } from "@/integrations/supabase/client";
import { NUVEX } from "./constants";

type Stage = "idle" | "reading" | "review" | "applied" | "error";

export interface ClientCedulaPayload {
  nombre?: string;
  cedula?: string;
  lugarExpedicion?: string;
  lugarExpedicionDepartamento?: string;
  lugarExpedicionCiudad?: string;
  lugarExpedicionMunicipio?: string;
  fechaExpedicion?: string;
}

interface Props {
  onApply: (data: ClientCedulaPayload) => void;
  /** Si está presente, las imágenes originales se suben al bucket
   *  `soportes-banco` y se registran en `expediente_soportes` (categoria
   *  `identidad`) para que viajen con el expediente a Contratación. */
  expedienteId?: string | null;
}

function fileToDataUrl(file: File | Blob): Promise<string> {
  if (file.type.startsWith("image/")) {
    return createImageBitmap(file)
      .then((bitmap) => {
        const maxSide = 1800;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        return canvas.toDataURL("image/jpeg", 0.86);
      })
      .catch(() => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      }));
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as {
    default: string;
  };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function renderPdfToImages(file: File): Promise<{ mime: string; dataUrl: string }[]> {
  const pdfjs = await loadPdfJs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const max = Math.min(pdf.numPages, 2);
  const images: { mime: string; dataUrl: string }[] = [];
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    images.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
  }
  return images;
}

/**
 * Lector de cédula simplificado para el simulador comercial.
 * Aplica los datos directamente al cliente (sin pasar por intervinientes).
 */
export function ClientCedulaButton({ onApply, expedienteId }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CedulaData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastFilesRef = useRef<File[]>([]);

  const call = useServerFn(extractCedula);

  const reset = () => {
    setStage("idle");
    setErrorMsg(null);
    setParsed(null);
    lastFilesRef.current = [];
    if (fileRef.current) fileRef.current.value = "";
  };

  const filesToImages = async (files: FileList | File[]) => {
    const selected = Array.from(files).slice(0, 4);
    const images: { mime: string; dataUrl: string }[] = [];
    for (const f of selected) {
      const lower = f.name.toLowerCase();
      if (f.type === "application/pdf" || lower.endsWith(".pdf")) {
        images.push(...(await renderPdfToImages(f)));
      } else if (f.type.startsWith("image/")) {
        images.push({ mime: "image/jpeg", dataUrl: await fileToDataUrl(f) });
      } else {
        throw new Error("Formato no soportado. Sube imágenes (JPG/PNG/WEBP) o un PDF de la cédula.");
      }
    }
    return images.slice(0, 4);
  };

  const processFiles = async (files: FileList | File[]) => {
    setStage("reading");
    setErrorMsg(null);
    try {
      const images = await filesToImages(files);
      const resp = await call({ data: { images } });
      if (resp.error || !resp.data) {
        setErrorMsg(resp.error || "No se pudieron extraer datos.");
        setStage("error");
        return;
      }
      if (!resp.data.numeroCedula && !resp.data.nombreCompleto) {
        setErrorMsg("No se reconoció una cédula. Sube una imagen más clara o un PDF legible.");
        setStage("error");
        return;
      }
      setParsed(resp.data);
      setStage("review");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Error procesando el archivo.");
      setStage("error");
    }
  };

  const apply = () => {
    if (!parsed) return;
    const location = normalizeColombiaLocation(parsed.lugarExpedicion);
    onApply({
      nombre: parsed.nombreCompleto || "",
      cedula: parsed.numeroCedula || "",
      lugarExpedicion: location.label || parsed.lugarExpedicion || "",
      lugarExpedicionDepartamento: location.departamento,
      lugarExpedicionCiudad: location.municipio,
      lugarExpedicionMunicipio: location.municipio,
      fechaExpedicion: parsed.fechaExpedicion || "",
    });
    setStage("applied");
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 700);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm"
        style={{ background: NUVEX.azul }}
      >
        <Sparkles size={12} />
        Leer cédula con IA
      </button>
    );
  }

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "#E3E7EE", background: "linear-gradient(180deg,#F8FAFF 0%,#FFFFFF 100%)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: NUVEX.azul }}
          >
            <IdCard size={14} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>
              Lector inteligente de cédula
            </div>
            <div className="text-[11px] text-[#242424]/65">
              Sube frente y reverso juntos · autocompleta datos contractuales
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          className="text-[#242424]/50 hover:text-[#242424]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {(stage === "idle" || stage === "error") && (
          <>
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const files = e.dataTransfer.files;
                if (files?.length) processFiles(files);
              }}
              onClick={() => fileRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors"
              style={{
                borderColor: dragActive ? NUVEX.azul : "#CBD5E1",
                background: dragActive ? "#EEF2FF" : "#FFFFFF",
              }}
            >
              <Upload size={20} className="mx-auto" style={{ color: NUVEX.azul }} />
              <div className="mt-2 text-xs font-semibold text-[#242424]">
                Arrastra la cédula o haz clic para subir
              </div>
                <div className="text-[11px] text-[#242424]/60">Selecciona frente y reverso juntos · JPG, PNG, WEBP o PDF</div>
              <input
                ref={fileRef}
                type="file"
                  multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) processFiles(files);
                }}
              />
            </div>
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3 text-xs text-[#991B1B]">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </>
        )}

        {stage === "reading" && (
          <div className="flex items-center gap-3 rounded-lg border border-[#E3E7EE] bg-white p-4">
            <Loader2 className="animate-spin" size={18} style={{ color: NUVEX.azul }} />
            <div className="text-xs text-[#242424]/80">Analizando documento con IA…</div>
          </div>
        )}

        {stage === "review" && parsed && (
          <div className="space-y-3 rounded-xl border border-[#E3E7EE] bg-white p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: NUVEX.azul }}>
              <ShieldCheck size={14} /> Datos detectados
            </div>
            <div className="grid gap-2 text-xs md:grid-cols-2">
              <Field label="Nombre completo" value={parsed.nombreCompleto} />
              <Field label="Número de cédula" value={parsed.numeroCedula} />
              <Field label="Lugar de expedición" value={normalizeColombiaLocation(parsed.lugarExpedicion).label || parsed.lugarExpedicion} />
              <Field label="Fecha de expedición" value={parsed.fechaExpedicion} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[11px] font-medium"
              >
                Subir otra
              </button>
              <button
                type="button"
                onClick={apply}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
                style={{ background: NUVEX.azul }}
              >
                Aplicar al cliente
              </button>
            </div>
          </div>
        )}

        {stage === "applied" && (
          <div className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs text-[#166534]">
            <CheckCircle2 size={14} /> Datos aplicados correctamente.
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[#242424]/60">{label}</div>
      <div className="mt-0.5 truncate text-xs font-medium text-[#242424]">{value || "—"}</div>
    </div>
  );
}
