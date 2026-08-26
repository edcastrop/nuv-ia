// Utilidades cliente para PDFs protegidos con contraseña.
// Reutiliza la misma mecánica del lector de extractos (pdf.js): detectar si un
// PDF exige clave y, con la clave, rasterizar las páginas a imágenes JPEG que
// la IA sí puede leer (el PDF cifrado original es ilegible para el proveedor).

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

export type PdfProbeResult = {
  ok: boolean;
  needsPassword: boolean;
  wrongPassword: boolean;
  numPages: number;
};

/** Intenta abrir el PDF (opcionalmente con clave) sin renderizar nada. */
export async function probePdf(data: ArrayBuffer, password?: string): Promise<PdfProbeResult> {
  const pdfjs = await loadPdfJs();
  try {
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password }).promise;
    return { ok: true, needsPassword: false, wrongPassword: false, numPages: pdf.numPages };
  } catch (err: unknown) {
    const e = err as { name?: string; code?: number };
    if (e?.name === "PasswordException") {
      return { ok: false, needsPassword: true, wrongPassword: e.code === 2, numPages: 0 };
    }
    return { ok: false, needsPassword: false, wrongPassword: false, numPages: 0 };
  }
}

/** Rasteriza el PDF (con clave si aplica) a imágenes JPEG en data URL. */
export async function renderPdfToJpegDataUrls(
  data: ArrayBuffer,
  password?: string,
  maxPages = 12,
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), password }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const out: string[] = [];
  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.8 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as never).promise;
    out.push(canvas.toDataURL("image/jpeg", 0.82));
  }
  return out;
}
