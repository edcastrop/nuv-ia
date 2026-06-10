// Genera el "Paquete documental" imprimible para llevar al banco.
// Carátula (con datos del caso + lista de documentos) + concatenación de los
// PDFs/imágenes financieros que se cargaron en el módulo de capacidad de pago
// + cualquier PDF de poder/cédulas que se pase al método.

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface DocAdjunto {
  nombre: string;
  /** data:application/pdf;base64,... o data:image/...;base64,... */
  dataUrl?: string;
  /** Tipo lógico (para la carátula) */
  tipo?: string;
}

export interface PaqueteOptions {
  cliente: string;
  banco: string;
  cedula?: string;
  numeroCredito?: string;
  asesor?: string;
  fechaRadicacion?: string;
  documentos: DocAdjunto[];
}

function bytesFromDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return null;
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime, bytes };
}

export async function generarPaqueteDocumentalPdf(opts: PaqueteOptions): Promise<Blob> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const fontBold = await out.embedFont(StandardFonts.HelveticaBold);

  // ---------- Carátula ----------
  const cover = out.addPage([612, 792]); // Letter
  const { width, height } = cover.getSize();
  const azul = rgb(0.1, 0.29, 0.64); // NUVEX azul aproximado
  const negro = rgb(0.14, 0.14, 0.14);
  const gris = rgb(0.4, 0.4, 0.45);

  let y = height - 60;
  cover.drawText("PAQUETE DOCUMENTAL", { x: 50, y, size: 22, font: fontBold, color: azul });
  y -= 24;
  cover.drawText(`Radicación bancaria — ${opts.banco}`, { x: 50, y, size: 12, font, color: gris });
  y -= 30;
  cover.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1, color: azul });
  y -= 28;

  const row = (k: string, v: string | undefined) => {
    if (!v) return;
    cover.drawText(k, { x: 50, y, size: 10, font: fontBold, color: negro });
    cover.drawText(v, { x: 180, y, size: 10, font, color: negro });
    y -= 18;
  };
  row("Cliente:", opts.cliente);
  row("Cédula:", opts.cedula);
  row("N° de crédito:", opts.numeroCredito);
  row("Banco:", opts.banco);
  row("Asesor NUVEX:", opts.asesor);
  row("Fecha radicación:", opts.fechaRadicacion);
  row("Fecha del paquete:", new Date().toLocaleString("es-CO"));

  y -= 16;
  cover.drawText("Documentos incluidos:", { x: 50, y, size: 12, font: fontBold, color: azul });
  y -= 18;

  opts.documentos.forEach((d, i) => {
    if (y < 60) {
      // si se llena la carátula, no hacemos paginación elaborada — corta.
      return;
    }
    const line = `${i + 1}. ${d.nombre}${d.tipo ? `  (${d.tipo})` : ""}`;
    cover.drawText(line.slice(0, 90), { x: 60, y, size: 10, font, color: negro });
    y -= 14;
  });

  y -= 24;
  if (y > 80) {
    cover.drawText("NUVEX Finanzas Inteligentes", { x: 50, y, size: 9, font, color: gris });
    y -= 12;
    cover.drawText("Documento generado automáticamente para entrega bancaria.", {
      x: 50, y, size: 9, font, color: gris,
    });
  }

  // ---------- Adjuntos ----------
  for (const doc of opts.documentos) {
    if (!doc.dataUrl) continue;
    const parsed = bytesFromDataUrl(doc.dataUrl);
    if (!parsed) continue;
    try {
      if (parsed.mime === "application/pdf") {
        const src = await PDFDocument.load(parsed.bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
      } else if (parsed.mime.startsWith("image/")) {
        const img = parsed.mime === "image/png"
          ? await out.embedPng(parsed.bytes)
          : await out.embedJpg(parsed.bytes);
        const page = out.addPage([612, 792]);
        const maxW = 512;
        const maxH = 700;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (612 - w) / 2;
        const yy = (792 - h) / 2;
        page.drawText(doc.nombre.slice(0, 70), {
          x: 50, y: 760, size: 10, font: fontBold, color: azul,
        });
        page.drawImage(img, { x, y: yy, width: w, height: h });
      }
    } catch (err) {
      console.warn("[paqueteDocumental] no se pudo adjuntar", doc.nombre, err);
    }
  }

  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function descargarBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
