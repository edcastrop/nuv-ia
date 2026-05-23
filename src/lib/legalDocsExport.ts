// Exportadores de documentos jurídicos: PDF (jsPDF) y DOCX (docx).
// Consumen el árbol de bloques generado por `legalDocs.ts`.

import { jsPDF } from "jspdf";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import type { LegalDoc, DocBlock } from "./legalDocs";

// ─────────────────────────────── PDF ───────────────────────────────

export function exportLegalDocPDF(doc: LegalDoc) {
  if (doc.validationIssues && doc.validationIssues.length > 0) {
    // Documento administrativo: NO bloquear. Solo advertir en consola.
    console.warn(
      `[NUVEX PDF] "${doc.title}" — pendiente de validación financiera:\n` +
        doc.validationIssues.map((m) => ` • ${m}`).join("\n"),
    );
  }
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 72; // 1"
  const marginY = 72;
  const contentW = pageW - marginX * 2;
  let y = marginY;

  // Header NUVEX institucional + consecutivo (solo página 1)
  pdf.setFont("times", "bold");
  pdf.setFontSize(13);
  pdf.text("NUVEX FINANZAS INTELIGENTES", marginX, y - 30);
  pdf.setFont("times", "normal");
  pdf.setFontSize(9);
  pdf.text("Bogotá | Bucaramanga · www.nuvex.com.co", marginX, y - 18);
  if (doc.consecutivo) {
    pdf.setFont("times", "bold");
    pdf.setFontSize(9);
    pdf.text(doc.consecutivo, pageW - marginX, y - 30, { align: "right" });
  }
  pdf.setFont("times", "normal");
  pdf.setFontSize(8);
  pdf.text(
    `Generado: ${new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}`,
    pageW - marginX,
    y - 18,
    { align: "right" },
  );
  pdf.setLineWidth(0.8);
  pdf.line(marginX, y - 10, pageW - marginX, y - 10);

  const checkBreak = (needed: number) => {
    if (y + needed > pageH - marginY) {
      pdf.addPage();
      y = marginY;
    }
  };

  const writeText = (text: string, opts: { size: number; bold?: boolean; align?: "left" | "center"; lineGap?: number }) => {
    pdf.setFont("times", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    const lineH = opts.size * 1.35;
    const lines = pdf.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      checkBreak(lineH);
      if (opts.align === "center") {
        pdf.text(line, pageW / 2, y, { align: "center" });
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
        writeText(b.text, { size: 16, bold: true, align: "center", lineGap: 8 });
        break;
      case "subtitle":
        writeText(b.text, { size: 12, bold: true, align: "center", lineGap: 6 });
        break;
      case "heading":
        writeText(b.text, { size: 11, bold: true, lineGap: 2 });
        break;
      case "paragraph":
        writeText(b.text, { size: 11, lineGap: 4 });
        break;
      case "section":
        y += 6;
        writeText(b.text, { size: 12, bold: true, lineGap: 4 });
        // línea bajo el encabezado
        pdf.setLineWidth(0.5);
        pdf.line(marginX, y - 2, pageW - marginX, y - 2);
        y += 4;
        break;
      case "field": {
        const labelW = 170;
        const valueW = contentW - labelW - 10;
        pdf.setFont("times", "bold");
        pdf.setFontSize(11);
        const labelLines = pdf.splitTextToSize(b.label, labelW) as string[];
        pdf.setFont("times", "normal");
        const valueLines = pdf.splitTextToSize(b.value || "—", valueW) as string[];
        const lines = Math.max(labelLines.length, valueLines.length);
        const lineH = 11 * 1.35;
        checkBreak(lines * lineH + 4);
        const startY = y;
        pdf.setFont("times", "bold");
        labelLines.forEach((l, i) => pdf.text(l, marginX, startY + i * lineH));
        pdf.setFont("times", "normal");
        valueLines.forEach((l, i) => pdf.text(l, marginX + labelW + 10, startY + i * lineH));
        y = startY + lines * lineH + 2;
        break;
      }
      case "spacer":
        y += b.size ?? 8;
        break;

      case "signature": {
        const colW = contentW / b.columns.length;
        checkBreak(80);
        // Líneas de firma
        pdf.setLineWidth(0.5);
        b.columns.forEach((_, i) => {
          const x1 = marginX + colW * i + 20;
          const x2 = marginX + colW * (i + 1) - 20;
          pdf.line(x1, y, x2, y);
        });
        y += 14;
        // Etiquetas
        pdf.setFont("times", "bold");
        pdf.setFontSize(10);
        b.columns.forEach((col, i) => {
          pdf.text(col.label, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 14;
        pdf.setFont("times", "normal");
        pdf.setFontSize(10);
        b.columns.forEach((col, i) => {
          if (col.name) pdf.text(col.name, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 12;
        b.columns.forEach((col, i) => {
          if (col.cc) pdf.text(col.cc, marginX + colW * i + colW / 2, y, { align: "center" });
        });
        y += 16;
        break;
      }
    }
  }

  pdf.save(`${doc.filename}.pdf`);
}

/** Igual que exportLegalDocPDF pero devuelve el Blob en memoria (no descarga). */
export function legalDocToPDFBlob(doc: LegalDoc): Blob {
  // Reutilizamos exportLegalDocPDF redirigiendo la salida.
  // jsPDF no permite "interceptar" save; replicamos el render sucintamente vía output.
  const pdf = renderLegalDocToJsPDF(doc);
  return pdf.output("blob");
}

function renderLegalDocToJsPDF(doc: LegalDoc): jsPDF {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 72, marginY = 72;
  const contentW = pageW - marginX * 2;
  let y = marginY;

  const checkBreak = (n: number) => { if (y + n > pageH - marginY) { pdf.addPage(); y = marginY; } };
  const writeText = (text: string, opts: { size: number; bold?: boolean; align?: "left" | "center"; lineGap?: number }) => {
    pdf.setFont("times", opts.bold ? "bold" : "normal");
    pdf.setFontSize(opts.size);
    const lineH = opts.size * 1.35;
    const lines = pdf.splitTextToSize(text, contentW) as string[];
    for (const line of lines) {
      checkBreak(lineH);
      if (opts.align === "center") pdf.text(line, pageW / 2, y, { align: "center" });
      else pdf.text(line, marginX, y);
      y += lineH;
    }
    if (opts.lineGap) y += opts.lineGap;
  };

  for (const b of doc.blocks) {
    switch (b.type) {
      case "title": writeText(b.text, { size: 16, bold: true, align: "center", lineGap: 8 }); break;
      case "subtitle": writeText(b.text, { size: 12, bold: true, align: "center", lineGap: 6 }); break;
      case "heading": writeText(b.text, { size: 11, bold: true, lineGap: 2 }); break;
      case "paragraph": writeText(b.text, { size: 11, lineGap: 4 }); break;
      case "section":
        y += 6;
        writeText(b.text, { size: 12, bold: true, lineGap: 4 });
        pdf.setLineWidth(0.5);
        pdf.line(marginX, y - 2, pageW - marginX, y - 2);
        y += 4;
        break;
      case "field": {
        const labelW = 170, valueW = contentW - labelW - 10;
        pdf.setFont("times", "bold"); pdf.setFontSize(11);
        const labelLines = pdf.splitTextToSize(b.label, labelW) as string[];
        pdf.setFont("times", "normal");
        const valueLines = pdf.splitTextToSize(b.value || "—", valueW) as string[];
        const lines = Math.max(labelLines.length, valueLines.length);
        const lineH = 11 * 1.35;
        checkBreak(lines * lineH + 4);
        const startY = y;
        pdf.setFont("times", "bold");
        labelLines.forEach((l, i) => pdf.text(l, marginX, startY + i * lineH));
        pdf.setFont("times", "normal");
        valueLines.forEach((l, i) => pdf.text(l, marginX + labelW + 10, startY + i * lineH));
        y = startY + lines * lineH + 2;
        break;
      }
      case "spacer": y += b.size ?? 8; break;
      case "signature": {
        const colW = contentW / b.columns.length;
        checkBreak(80);
        pdf.setLineWidth(0.5);
        b.columns.forEach((_, i) => {
          const x1 = marginX + colW * i + 20;
          const x2 = marginX + colW * (i + 1) - 20;
          pdf.line(x1, y, x2, y);
        });
        y += 14;
        pdf.setFont("times", "bold"); pdf.setFontSize(10);
        b.columns.forEach((col, i) => pdf.text(col.label, marginX + colW * i + colW / 2, y, { align: "center" }));
        y += 14;
        pdf.setFont("times", "normal"); pdf.setFontSize(10);
        b.columns.forEach((col, i) => { if (col.name) pdf.text(col.name, marginX + colW * i + colW / 2, y, { align: "center" }); });
        y += 12;
        b.columns.forEach((col, i) => { if (col.cc) pdf.text(col.cc, marginX + colW * i + colW / 2, y, { align: "center" }); });
        y += 16;
        break;
      }
    }
  }
  return pdf;
}

// ─────────────────────────────── DOCX ───────────────────────────────

function blockToDocx(b: DocBlock): Paragraph | Table {
  switch (b.type) {
    case "title":
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: b.text, bold: true, size: 32 })],
      });
    case "subtitle":
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
        children: [new TextRun({ text: b.text, bold: true, size: 24 })],
      });
    case "heading":
      return new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: b.text, bold: true, size: 22 })],
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
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "242424", space: 1 } },
        children: [new TextRun({ text: b.text, bold: true, size: 24 })],
      });
    case "field":
      return new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: `${b.label}: `, bold: true, size: 22 }),
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
                      children: [new TextRun({ text: col.label, bold: true, size: 20 })],
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
  return new Document({
    styles: { default: { document: { run: { font: "Times New Roman", size: 22 } } } },
    sections: [{
      properties: { page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      } },
      children: doc.blocks.map(blockToDocx),
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

