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
  Plus,
  Trash2,
} from "lucide-react";
import { extractCedula, type CedulaData } from "@/lib/cedula.functions";
import { normalizeColombiaLocation } from "@/lib/colombiaLocations";
import { NUVEX } from "./constants";
import type { Interviniente, RolInterviniente } from "./intervinientes";
import { defaultInterviniente, rolCotitular } from "./intervinientes";


type Stage = "idle" | "reading" | "review" | "applied" | "error";

interface Props {
  intervinientes: Interviniente[];
  producto?: string | null;
  /** Aplica los datos al interviniente en `targetIdx` (o agrega uno nuevo si idx === -1). */
  onApply: (next: Interviniente[], targetIdx: number) => void;
  /** Opcional: si el target es el titular (idx 0), sincroniza también el nombre y cédula en ClientFields. */
  onTitularSync?: (nombre: string, cedula: string) => void;
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

export function CedulaReader({ intervinientes, producto, onApply, onTitularSync }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CedulaData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [targetIdx, setTargetIdx] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const call = useServerFn(extractCedula);
  const rolC = rolCotitular(producto);

  const reset = () => {
    setStage("idle");
    setErrorMsg(null);
    setParsed(null);
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
    const list = intervinientes.length ? intervinientes : [defaultInterviniente("Titular" as RolInterviniente)];
    let next: Interviniente[];
    let appliedIdx = targetIdx;

    const location = normalizeColombiaLocation(parsed.lugarExpedicion);
    const patch: Partial<Interviniente> = {
      nombreCompleto: parsed.nombreCompleto || "",
      cedula: parsed.numeroCedula || "",
      lugarExpedicionCedula: location.label || parsed.lugarExpedicion || "",
    };

    if (targetIdx === -1) {
      // Agregar como nuevo cotitular/colocatario
      const newOne: Interviniente = { ...defaultInterviniente(rolC), ...patch };
      next = [...list, newOne];
      appliedIdx = next.length - 1;
    } else {
      next = list.map((it, i) => (i === targetIdx ? { ...it, ...patch } : it));
    }

    onApply(next, appliedIdx);
    if (appliedIdx === 0 && onTitularSync) {
      onTitularSync(patch.nombreCompleto || "", patch.cedula || "");
    }
    setStage("applied");
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 800);
  };

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "#E3E7EE", background: "linear-gradient(180deg,#F8FAFF 0%,#FFFFFF 100%)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white"
            style={{ background: NUVEX.azul }}
          >
            <IdCard size={18} />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NUVEX.azul }}>
              Lector inteligente de cédula
            </div>
            <div className="text-sm font-semibold text-[#242424]">
              Sube la cédula y autocompleta los datos
            </div>
            <div className="mt-0.5 text-[11px] text-[#242424]/65">
              Funciona con cédula amarilla, cédula digital, JPG, PNG o PDF. Arrastra el archivo o haz clic para seleccionar.
            </div>
          </div>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
            style={{ background: NUVEX.azul }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={12} /> Leer cédula
            </span>
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          {/* Selector de destino */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[11px] font-medium text-[#242424]/70">Aplicar a:</label>
            <select
              value={targetIdx}
              onChange={(e) => setTargetIdx(parseInt(e.target.value, 10))}
              className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-medium"
            >
              {intervinientes.map((it, i) => (
                <option key={i} value={i}>
                  {i === 0 ? it.rol : `${it.rol} ${i}`}
                  {it.nombreCompleto ? ` — ${it.nombreCompleto}` : ""}
                </option>
              ))}
              <option value={-1}>+ Agregar nuevo {rolC.toLowerCase()}</option>
            </select>
          </div>

          {(stage === "idle" || stage === "error") && (
            <>
              <div
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragActive(false);
                  const files = e.dataTransfer.files;
                  if (files?.length) processFiles(files);
                }}
                onClick={() => fileRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors"
                style={{
                  borderColor: dragActive ? NUVEX.azul : "#CBD5E1",
                  background: dragActive ? "#EEF2FF" : "#FFFFFF",
                }}
              >
                <Upload size={22} className="mx-auto" style={{ color: NUVEX.azul }} />
                <div className="mt-2 text-xs font-semibold text-[#242424]">
                  Arrastra la cédula aquí o haz clic para subir
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
            <div className="space-y-3 rounded-xl border border-[#E3E7EE] bg-white p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: NUVEX.azul }}>
                <ShieldCheck size={14} /> Datos detectados — revisa y confirma
              </div>
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <Field label="Nombre completo" value={parsed.nombreCompleto} conf={parsed.confianza?.nombreCompleto} />
                <Field label="Número de cédula" value={parsed.numeroCedula} conf={parsed.confianza?.numeroCedula} />
                <Field label="Lugar de expedición" value={normalizeColombiaLocation(parsed.lugarExpedicion).label || parsed.lugarExpedicion} conf={parsed.confianza?.lugarExpedicion} />
                <Field label="Fecha de expedición" value={parsed.fechaExpedicion} conf={parsed.confianza?.fechaExpedicion} />
                {parsed.fechaNacimiento && <Field label="Fecha de nacimiento" value={parsed.fechaNacimiento} />}
                {parsed.tipoDocumento && <Field label="Tipo" value={parsed.tipoDocumento} />}
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
                  Aplicar al formulario
                </button>
              </div>
            </div>
          )}

          {stage === "applied" && (
            <div className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs text-[#166534]">
              <CheckCircle2 size={14} /> Datos aplicados correctamente.
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => { setOpen(false); reset(); }}
              className="inline-flex items-center gap-1 text-[11px] text-[#242424]/60 hover:text-[#242424]"
            >
              <X size={12} /> cerrar lector
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, conf }: { label: string; value: string; conf?: "alta" | "media" | "baja" }) {
  const tone = !value
    ? { bg: "rgba(244,162,97,0.10)", border: "rgba(244,162,97,0.35)", label: "Sin dato", color: "#B45309" }
    : conf === "baja"
      ? { bg: "rgba(244,162,97,0.10)", border: "rgba(244,162,97,0.35)", label: "Revisar", color: "#B45309" }
      : conf === "media"
        ? { bg: "rgba(68,93,163,0.08)", border: "rgba(68,93,163,0.30)", label: "Media", color: "#445DA3" }
        : { bg: "rgba(132,185,143,0.10)", border: "rgba(132,185,143,0.35)", label: "Alta", color: "#15803D" };

  return (
    <div className="rounded-lg border p-2" style={{ borderColor: tone.border, background: tone.bg }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-[#242424]/60">{label}</span>
        <span className="text-[10px] font-semibold" style={{ color: tone.color }}>{tone.label}</span>
      </div>
      <div className="mt-0.5 truncate text-xs font-medium text-[#242424]">{value || "—"}</div>
    </div>
  );
}
