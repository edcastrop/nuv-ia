// Exportadores de documentos jurídicos: PDF (jsPDF) y DOCX (docx).
// Consumen el árbol de bloques generado por `legalDocs.ts`.
//
// Branding NUVEX obligatorio en PDF: header con logo + footer institucional
// con franja azul, código documental y paginado en todas las páginas.

import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import logoNuvex from "@/assets/logo-nuvex.png";
import { NUVEX } from "@/components/nuvex/constants";
import type { LegalDoc, DocBlock } from "./legalDocs";

// ─────────────────────────────── Logo (cached) ───────────────────────────

let logoDataUrlPromise: Promise<string> | null = null;
async function loadLogoDataURL(): Promise<string> {
  if (logoDataUrlPromise) return logoDataUrlPromise;
  logoDataUrlPromise = (async () => {
    try {
      const res = await fetch(logoNuvex as unknown as string);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  })();
  return logoDataUrlPromise;
}

// ─────────────────────────────── PDF ───────────────────────────────

const BRAND_BLUE: [number, number, number] = [68, 93, 163]; // #445DA3
const INK: [number, number, number] = [36, 36, 36]; // #242424
const MUTED: [number, number, number] = [92, 103, 112]; // #5C6770

interface BrandMeta {
  documento: string; // ej. "Documento Jurídico — Poder Especial"
  consecutivo?: string;
}

function inferDocumentoLabel(doc: LegalDoc): string {
  if (/poder/i.test(doc.title)) return "Documento Jurídico — Poder Especial";
  if (/ficha contractual|datos para contrato/i.test(doc.title)) return "Documento Administrativo — Ficha Contractual";
  if (/contrato de prestación/i.test(doc.title)) return "Documento Contractual — Contrato de Prestación de Servicios";
  return "Documento NUVEX";
}

function drawHeader(pdf: jsPDF, logoDataUrl: string, meta: BrandMeta) {
  const pageW = pdf.internal.pageSize.getWidth();
  const marginX = 50;
  const headerH = 78;

  // Franja blanca con línea inferior azul gruesa
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageW, headerH, "F");

  // Logo
  if (logoDataUrl) {
    try {
      // PNG ~ proporción 1:1 cuadrada o similar; alto 46pt, ancho auto
      pdf.addImage(logoDataUrl, "PNG", marginX, 18, 0, 46);
    } catch { /* ignore */ }
  }

  // Texto institucional
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND_BLUE);
  pdf.text("NUVEX FINANZAS INTELIGENTES", marginX + 130, 36);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...MUTED);
  pdf.text(meta.documento.toUpperCase(), marginX + 130, 50, { charSpace: 0.6 });

  // Bloque derecho: código + fecha
  const rightX = pageW - marginX;
  if (meta.consecutivo) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND_BLUE);
    pdf.text(meta.consecutivo, rightX, 32, { align: "right" });
  }
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(...MUTED);
  const fecha = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  pdf.text(`Generado: ${fecha}`, rightX, 48, { align: "right" });

  // Línea azul inferior
  pdf.setDrawColor(...BRAND_BLUE);
  pdf.setLineWidth(2);
  pdf.line(marginX, headerH - 4, pageW - marginX, headerH - 4);
}

function drawFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 50;
  const footerY = pageH - 60;

  // Línea superior azul
  pdf.setDrawColor(...BRAND_BLUE);
  pdf.setLineWidth(1.2);
  pdf.line(marginX, footerY, pageW - marginX, footerY);

  // Bloque institucional centrado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND_BLUE);
  pdf.text("NUVEX FINANZAS INTELIGENTES", pageW / 2, footerY + 14, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...MUTED);
  pdf.text(
    "Carrera 16 # 37-48 Piso 4, Centro de Bucaramanga  ·  Bogotá | Bucaramanga",
    pageW / 2,
    footerY + 26,
    { align: "center" },
  );
  pdf.text(
    "juridica@nuvex.com.co  ·  www.nuvex.com.co",
    pageW / 2,
    footerY + 37,
    { align: "center" },
  );

  // Paginado
  pdf.setFontSize(7);
  pdf.setTextColor(...MUTED);
  pdf.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, footerY + 37, { align: "right" });
}

interface RenderOpts {
  meta: BrandMeta;
  logoDataUrl: string;
}

function renderBrandedLegalDoc(doc: LegalDoc, opts: RenderOpts): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 70; // ~2.5 cm
  const topMargin = 100; // espacio bajo el header
  const bottomMargin = 80; // espacio sobre el footer
  const contentW = pageW - marginX * 2;
  let y = topMargin;

  const drawChrome = () => {
    drawHeader(pdf, opts.logoDataUrl, opts.meta);
    // footer se pinta al final con totalPages correcto
  };
  drawChrome();

  const checkBreak = (needed: number) => {
    if (y + needed > pageH - bottomMargin) {
      pdf.addPage();
      drawChrome();
      y = topMargin;
    }
  };

  const writeText = (
    text: string,
    opts: { size: number; bold?: boolean; align?: "left" | "center" | "justify"; lineGap?: number; color?: [number, number, number] },
  ) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    pdf.setTextColor(...(opts.color ?? INK));
    const lineH = opts.size * 1.35;
    const lines = pdf.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      checkBreak(lineH);
      if (opts.align === "center") {
        pdf.text(line, pageW / 2, y, { align: "center" });
      } else if (opts.align === "justify") {
        pdf.text(line, marginX, y, { maxWidth: contentW, align: "justify" });
      } else {
        pdf.text(line, marginX, y);
      }
      y += lineH;
    }
    if (opts.lineGap) y += opts.lineGap;
  };

  for (const b of doc.blocks) {
    switch (b.type) {
      case "title":
        writeText(b.text, { size: 16, bold: true, align: "center", lineGap: 6, color: BRAND_BLUE });
        // Subrayado fino bajo el título
        pdf.setDrawColor(...BRAND_BLUE);
        pdf.setLineWidth(0.6);
        pdf.line(pageW / 2 - 60, y - 2, pageW / 2 + 60, y - 2);
        y += 6;
        break;
      case "subtitle":
        writeText(b.text, { size: 11, bold: true, align: "center", lineGap: 8, color: MUTED });
        break;
      case "heading":
        writeText(b.text, { size: 11, bold: true, lineGap: 2, color: BRAND_BLUE });
        break;
      case "paragraph":
        writeText(b.text, { size: 10.5, align: "justify", lineGap: 4 });
        break;
      case "section": {
        y += 8;
        checkBreak(28);
        // Banda gris claro con texto en azul
        pdf.setFillColor(247, 249, 251);
        pdf.rect(marginX, y - 12, contentW, 20, "F");
        pdf.setDrawColor(...BRAND_BLUE);
        pdf.setLineWidth(0.4);
        pdf.line(marginX, y + 8, marginX + 4, y + 8); // marca lateral
        pdf.setFillColor(...BRAND_BLUE);
        pdf.rect(marginX, y - 12, 3, 20, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(...BRAND_BLUE);
        pdf.text(b.text, marginX + 10, y + 2);
        y += 18;
        break;
      }
      case "field": {
        const labelW = 180;
        const valueW = contentW - labelW - 12;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...INK);
        const labelLines = pdf.splitTextToSize(b.label, labelW) as string[];
        pdf.setFont("helvetica", "normal");
        const valueLines = pdf.splitTextToSize(b.value || "—", valueW) as string[];
        const lines = Math.max(labelLines.length, valueLines.length);
        const lineH = 10 * 1.4;
        checkBreak(lines * lineH + 4);
        const startY = y;
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...MUTED);
        labelLines.forEach((l, i) => pdf.text(l, marginX, startY + i * lineH));
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...INK);
        valueLines.forEach((l, i) => pdf.text(l, marginX + labelW + 12, startY + i * lineH));
        y = startY + lines * lineH + 3;
        break;
      }
      case "spacer":
        y += b.size ?? 8;
        break;

      case "signature": {
        const colW = contentW / b.columns.length;
        checkBreak(90);
        pdf.setDrawColor(...INK);
        pdf.setLineWidth(0.6);
        b.columns.forEach((_, i) => {
          const x1 = marginX + colW * i + 20;
          const x2 = marginX + colW * (i + 1) - 20;
          pdf.line(x1, y, x2, y);
        });
        y += 14;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.5);
        pdf.setTextColor(...BRAND_BLUE);
        b.columns.forEach((col, i) => {
          pdf.text(col.label, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 14;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(...INK);
        b.columns.forEach((col, i) => {
          if (col.name) pdf.text(col.name, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 12;
        pdf.setFontSize(9);
        pdf.setTextColor(...MUTED);
        b.columns.forEach((col, i) => {
          if (col.cc) pdf.text(col.cc, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 16;
        break;
      }
    }
  }

  // Footer en todas las páginas con paginado real
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(pdf, i, totalPages);
  }

  return pdf;
}

export async function exportLegalDocPDF(doc: LegalDoc) {
  if (doc.validationIssues && doc.validationIssues.length > 0) {
    // Documento administrativo: NO bloquear. Solo advertir en consola.
    console.warn(
      `[NUVEX PDF] "${doc.title}" — advertencia pendiente de validación financiera:\n` +
        doc.validationIssues.map((m) => ` • ${m}`).join("\n"),
    );
  }
  const logoDataUrl = await loadLogoDataURL();
  const pdf = renderBrandedLegalDoc(doc, {
    logoDataUrl,
    meta: { documento: inferDocumentoLabel(doc), consecutivo: doc.consecutivo },
  });
  pdf.save(`${doc.filename}.pdf`);
}

/** Igual que exportLegalDocPDF pero devuelve el Blob en memoria (no descarga). */
export async function legalDocToPDFBlob(doc: LegalDoc): Promise<Blob> {
  const logoDataUrl = await loadLogoDataURL();
  const pdf = renderBrandedLegalDoc(doc, {
    logoDataUrl,
    meta: { documento: inferDocumentoLabel(doc), consecutivo: doc.consecutivo },
  });
  return pdf.output("blob");
}

// ─────────────────────────────── DOCX ───────────────────────────────

function blockToDocx(b: DocBlock): Paragraph | Table {
  const BLUE = "445DA3";
  switch (b.type) {
    case "title":
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: b.text, bold: true, size: 32, color: BLUE })],
      });
    case "subtitle":
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text: b.text, bold: true, size: 22, color: "5C6770" })],
      });
    case "heading":
      return new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: b.text, bold: true, size: 22, color: BLUE })],
      });
    case "paragraph":
      return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 120, line: 320 },
        children: [new TextRun({ text: b.text, size: 22 })],
      });
    case "section":
      return new Paragraph({
        spacing: { before: 200, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE, space: 1 } },
        children: [new TextRun({ text: b.text, bold: true, size: 22, color: BLUE })],
      });
    case "field":
      return new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${b.label}: `, bold: true, size: 20, color: "5C6770" }),
          new TextRun({ text: b.value || "—", size: 22 }),
        ],
      });
    case "spacer":
      return new Paragraph({ spacing: { after: (b.size ?? 8) * 20 }, children: [new TextRun("")] });

    case "signature": {
      const colCount = b.columns.length;
      const tableW = 9360;
      const colW = Math.floor(tableW / colCount);
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
      const cellBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };
      const topBorder = { top: { style: BorderStyle.SINGLE, size: 8, color: "242424" }, bottom: noBorder, left: noBorder, right: noBorder };
      return new Table({
        width: { size: tableW, type: WidthType.DXA },
        columnWidths: b.columns.map(() => colW),
        rows: [
          new TableRow({
            children: b.columns.map(
              (col) =>
                new TableCell({
                  width: { size: colW, type: WidthType.DXA },
                  borders: topBorder,
                  margins: { top: 120, bottom: 60, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 40 },
                      children: [new TextRun({ text: col.label, bold: true, size: 20, color: BLUE })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 20 },
                      children: [new TextRun({ text: col.name ?? "", size: 20 })],
                    }),
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [new TextRun({ text: col.cc ?? "", size: 18 })],
                    }),
                  ],
                }),
            ),
          }),
          new TableRow({
            children: b.columns.map(
              () =>
                new TableCell({
                  width: { size: colW, type: WidthType.DXA },
                  borders: cellBorders,
                  children: [new Paragraph({ children: [new TextRun("")] })],
                }),
            ),
          }),
        ],
      });
    }
  }
}

function buildLegalDocDocx(doc: LegalDoc): Document {
  // Header institucional + footer del documento.
  const headerParagraphs: Paragraph[] = [];
  if (doc.consecutivo) {
    headerParagraphs.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 20 },
        children: [new TextRun({ text: doc.consecutivo, bold: true, size: 18, color: "445DA3" })],
      }),
    );
  }
  headerParagraphs.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 60 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: "445DA3", space: 4 } },
      children: [new TextRun({ text: "NUVEX FINANZAS INTELIGENTES", bold: true, size: 22, color: "445DA3" })],
    }),
  );

  return new Document({
    styles: { default: { document: { run: { font: "Inter", size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: { default: { options: { children: headerParagraphs } } as never },
      children: [
        ...doc.blocks.map(blockToDocx),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          border: { top: { style: BorderStyle.SINGLE, size: 12, color: "445DA3", space: 4 } },
          children: [
            new TextRun({ text: "NUVEX Finanzas Inteligentes", bold: true, size: 18, color: "445DA3" }),
            new TextRun({ text: "  ·  Carrera 16 # 37-48 Piso 4, Bucaramanga  ·  Bogotá | Bucaramanga", size: 16, color: "5C6770" }),
            new TextRun({ text: "  ·  juridica@nuvex.com.co  ·  www.nuvex.com.co", size: 16, color: "5C6770" }),
          ],
        }),
      ],
    }],
  });
}

export async function exportLegalDocDOCX(doc: LegalDoc) {
  const blob = await Packer.toBlob(buildLegalDocDocx(doc));
  saveAs(blob, `${doc.filename}.docx`);
}

export async function legalDocToDOCXBlob(doc: LegalDoc): Promise<Blob> {
  return await Packer.toBlob(buildLegalDocDocx(doc));
}

// Suppress unused import warnings (NUVEX may be referenced via brand palette).
void NUVEX;
