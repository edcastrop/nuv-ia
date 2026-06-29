import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Upload,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  IdCard,
  Trash2,
  Plus,
} from "lucide-react";
import { extractCedula, type CedulaData } from "@/lib/cedula.functions";
import { normalizeColombiaLocation } from "@/lib/colombiaLocations";
import { cityDepartment } from "@/lib/colombiaCities";
import { NUVEX } from "@/components/nuvex/constants";
import type { ClienteMaestro, CotitularMaestro } from "@/lib/expedienteMaestro";

type Stage = "idle" | "reading" | "review" | "applied" | "error";

interface Props {
  /** Etiqueta del destinatario, ej. "cotitular" o "colocatario". */
  label: string;
  /** Aplica el patch a los datos actuales. */
  onApply: (patch: Partial<ClienteMaestro> | Partial<CotitularMaestro>) => void;
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
      .catch(
        () =>
          new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(file);
          }),
      );
  }
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

async function renderPdfToImages(file: File): Promise<{ mime: string; dataUrl: string }[]> {
  const { ensurePdfJsPolyfills } = await import("@/lib/pdfjsPolyfill");
  ensurePdfJsPolyfills();
  const pdfjs = await import("pdfjs-dist");
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const max = Math.min(pdf.numPages, 2);
  const out: { mime: string; dataUrl: string }[] = [];
  for (let i = 1; i <= max; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    out.push({ mime: "image/jpeg", dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
  }
  return out;
}

export function CedulaReaderMaestro({ label, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsed, setParsed] = useState<CedulaData | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const call = useServerFn(extractCedula);

  const reset = () => {
    setStage("idle");
    setErrorMsg(null);
    setParsed(null);
    setQueue([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addToQueue = (files: FileList | File[]) => {
    setErrorMsg(null);
    setQueue((prev) => [...prev, ...Array.from(files)].slice(0, 4));
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFromQueue = (idx: number) =>
    setQueue((prev) => prev.filter((_, i) => i !== idx));

  const process = async () => {
    if (!queue.length) return;
    setStage("reading");
    setErrorMsg(null);
    try {
      const images: { mime: string; dataUrl: string }[] = [];
      for (const f of queue.slice(0, 4)) {
        const lower = f.name.toLowerCase();
        if (f.type === "application/pdf" || lower.endsWith(".pdf")) {
          images.push(...(await renderPdfToImages(f)));
        } else if (f.type.startsWith("image/")) {
          images.push({ mime: "image/jpeg", dataUrl: await fileToDataUrl(f) });
        } else {
          throw new Error("Formato no soportado. Sube imágenes (JPG/PNG/WEBP) o PDF.");
        }
      }
      const resp = await call({ data: { images: images.slice(0, 4) } });
      if (resp.error || !resp.data) {
        setErrorMsg(resp.error || "No se pudieron extraer datos.");
        setStage("error");
        return;
      }
      if (!resp.data.numeroCedula && !resp.data.nombreCompleto) {
        setErrorMsg("No se reconoció una cédula. Sube una imagen más clara.");
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
    const loc = normalizeColombiaLocation(parsed.lugarExpedicion);
    const expedidaEn = loc.label || parsed.lugarExpedicion || "";
    const ciudadDep = cityDepartment(expedidaEn);
    const patch: Partial<CotitularMaestro> = {
      nombre: parsed.nombreCompleto || "",
      cedula: parsed.numeroCedula || "",
      expedidaEn,
      fechaExpedicion: parsed.fechaExpedicion || "",
      fechaNacimiento: parsed.fechaNacimiento || "",
      tipoDocumento: parsed.tipoDocumento || "CC",
    };
    if (ciudadDep) patch.departamento = ciudadDep;
    onApply(patch);
    setStage("applied");
    setTimeout(() => {
      setOpen(false);
      reset();
    }, 800);
  };

  return (
    <div
      className="mb-4 rounded-xl border p-4"
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
              Sube la cédula del {label} y autocompleta los datos
            </div>
            <div className="mt-0.5 text-[11px] text-[#242424]/65">
              Cédula amarilla o digital · JPG, PNG, WEBP o PDF · frente y reverso
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
          {(stage === "idle" || stage === "error") && (
            <>
              <div
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files?.length) addToQueue(e.dataTransfer.files);
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
                  {queue.length === 0
                    ? "Arrastra la cédula aquí o haz clic para subir"
                    : "Agrega otra imagen (frente o reverso)"}
                </div>
                <div className="text-[11px] text-[#242424]/60">
                  JPG, PNG, WEBP o PDF (máx. 4)
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) addToQueue(e.target.files);
                  }}
                />
              </div>

              {queue.length > 0 && (
                <div className="space-y-2 rounded-xl border border-[#E3E7EE] bg-white p-3">
                  <div className="text-[11px] font-semibold text-[#242424]/70">
                    Archivos listos ({queue.length}/4)
                  </div>
                  <ul className="space-y-1">
                    {queue.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] px-2 py-1.5 text-xs"
                      >
                        <span className="truncate">
                          <span className="font-medium text-[#242424]">
                            {i === 0 ? "Frente" : i === 1 ? "Reverso" : `Imagen ${i + 1}`}:
                          </span>{" "}
                          <span className="text-[#242424]/70">{f.name}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromQueue(i)}
                          className="text-[#991B1B] hover:text-[#7F1D1D]"
                          aria-label="Quitar archivo"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={queue.length >= 4}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                    >
                      <Plus size={12} /> Agregar otra
                    </button>
                    <button
                      type="button"
                      onClick={process}
                      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
                      style={{ background: NUVEX.azul }}
                    >
                      <Sparkles size={12} /> Procesar con IA ({queue.length})
                    </button>
                  </div>
                </div>
              )}

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
              <div className="text-[11px] font-semibold" style={{ color: NUVEX.azul }}>
                Datos detectados — revisa y confirma
              </div>
              <div className="grid gap-2 text-xs md:grid-cols-2">
                <Field label="Nombre completo" value={parsed.nombreCompleto} />
                <Field label="Número de cédula" value={parsed.numeroCedula} />
                <Field
                  label="Lugar de expedición"
                  value={normalizeColombiaLocation(parsed.lugarExpedicion).label || parsed.lugarExpedicion}
                />
                <Field label="Fecha de expedición" value={parsed.fechaExpedicion} />
                {parsed.fechaNacimiento && <Field label="Fecha de nacimiento" value={parsed.fechaNacimiento} />}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-[11px] font-medium"
                >
                  Reintentar
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white"
                  style={{ background: NUVEX.azul }}
                >
                  <CheckCircle2 size={12} /> Aplicar al {label}
                </button>
              </div>
            </div>
          )}

          {stage === "applied" && (
            <div className="flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-3 text-xs text-[#166534]">
              <CheckCircle2 size={14} /> Datos aplicados correctamente al {label}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-2">
      <div className="text-[10px] uppercase tracking-wider text-[#242424]/55">{label}</div>
      <div className="text-[12px] font-semibold text-[#242424]">{value || "—"}</div>
    </div>
  );
}
