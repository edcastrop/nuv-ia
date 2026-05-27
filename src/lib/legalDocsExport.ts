// Exportadores de documentos jurídicos NUVEX.
//
// Arquitectura: ya NO renderizamos los documentos como bloques de texto. En su
// lugar usamos PLANTILLAS GRÁFICAS construidas con el `nuvexPdfKit` (header
// azul institucional + footer corporativo + portada hero + cards + secciones).
//
// Hay tres renderers:
//   • renderPoderEspecial  → portada institucional + texto jurídico
//   • renderFichaContractual → ficha ejecutiva en section cards
//   • renderGenericLegalDoc → fallback compatible con docs antiguos (Cuenta
//     de Cobro, Paz y Salvo, Contrato de Servicios) preservando los bloques
//     `LegalDoc`. Mantiene branding pero sin hero.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle,
} from "docx";
import { saveAs } from "file-saver";
import { NUVEX } from "@/components/nuvex/constants";
import type { LegalDoc, DocBlock } from "./legalDocs";
import {
  BRAND, LAYOUT, loadLogoDataURL, applyChrome,
  createNuvexPdf, nextPage,
  drawHero,
  writeText, drawSignatures, roundedRect,
  type BrandMeta,
} from "./pdf/nuvexPdfKit";

// ─────────────────────────────── Routing por tipo ───────────────────────────

type DocKind = "poder" | "ficha" | "generic";

function detectKind(doc: LegalDoc): DocKind {
  if (/poder\s+especial/i.test(doc.title)) return "poder";
  if (/ficha\s+contractual|datos\s+para\s+contrato/i.test(doc.title)) return "ficha";
  return "generic";
}

function inferDocumentoLabel(doc: LegalDoc, kind: DocKind): string {
  if (kind === "poder") return "Documento Jurídico — Poder Especial";
  if (kind === "ficha") return "Documento Administrativo — Ficha Contractual";
  if (/contrato de prestación/i.test(doc.title)) return "Documento Contractual — Prestación de Servicios";
  if (/cuenta de cobro/i.test(doc.title)) return "Documento Administrativo — Cuenta de Cobro";
  if (/paz y salvo/i.test(doc.title)) return "Documento Administrativo — Paz y Salvo";
  return "Documento NUVEX";
}

// ─────────────────────────────── Utilidades de extracción ───────────────────

/** Toma el primer `field` por label (case-insensitive) del array de bloques. */
function findField(blocks: DocBlock[], labelRegex: RegExp): string {
  for (const b of blocks) {
    if (b.type === "field" && labelRegex.test(b.label)) return b.value || "";
  }
  return "";
}

/** Devuelve los bloques que NO son `section`/`field` (es decir, texto jurídico). */
function legalProse(blocks: DocBlock[]): DocBlock[] {
  // El header gráfico ya muestra cliente/banco/producto/crédito en cards.
  // Quitamos el bloque introductorio "DATOS DEL CLIENTE" + sus campos.
  const out: DocBlock[] = [];
  let inSectionDatos = false;
  for (const b of blocks) {
    if (b.type === "section") {
      inSectionDatos = /datos\s+del\s+cliente/i.test(b.text);
      if (inSectionDatos) continue;
    }
    if (inSectionDatos && (b.type === "field" || b.type === "spacer")) continue;
    if (b.type === "field") continue; // los fields se promueven a cards en el hero
    out.push(b);
  }
  return out;
}

/** Agrupa los bloques en secciones {title, fields} para la ficha. */
interface FichaSection {
  title: string;
  fields: Array<{ label: string; value: string }>;
}

function groupBySection(blocks: DocBlock[]): FichaSection[] {
  const out: FichaSection[] = [];
  let current: FichaSection | null = null;
  for (const b of blocks) {
    if (b.type === "section") {
      // El texto suele venir como "1. CLIENTE" — limpiamos el prefijo numérico.
      const title = b.text.replace(/^\s*\d+\s*\.?\s*/, "").trim();
      current = { title, fields: [] };
      out.push(current);
    } else if (b.type === "field" && current) {
      current.fields.push({ label: b.label, value: b.value || "—" });
    }
  }
  return out;
}

// ─────────────────────────────── Renderer: PODER ESPECIAL ───────────────────

function renderPoderEspecial(pdf: jsPDF, doc: LegalDoc): void {
  // Hero institucional como portada
  let y = drawHero(pdf, {
    badge: "Documento Jurídico",
    title: "PODER ESPECIAL",
    subtitle: "Representación ante entidad financiera",
    variant: "cover",
  });

  // Tarjetas de identificación del expediente
  const cards: CardItem[] = [
    { label: "Cliente",          value: findField(doc.blocks, /^nombre$/i) || "—", accent: "primary" },
    { label: "Cédula",           value: findField(doc.blocks, /^cédula|^cedula/i) || "—" },
    { label: "Banco",            value: findField(doc.blocks, /^banco$/i) || "—", accent: "primary" },
    { label: "Producto",         value: findField(doc.blocks, /^producto$/i) || "—" },
    { label: "Número de crédito", value: findField(doc.blocks, /número\s+crédito|numero\s+credito|n[uú]mero\s+de\s+cr[eé]dito/i) || "—", accent: "soft" },
    { label: "Fecha emisión",     value: new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }), accent: "soft" },
  ];
  y = drawCardGrid(pdf, y, cards, 2, 70, 10);

  // Separador "Texto jurídico"
  y += 6;
  pdf.setDrawColor(...BRAND.border);
  pdf.setLineWidth(0.6);
  pdf.line(LAYOUT.marginX, y, LAYOUT.pageW - LAYOUT.marginX, y);
  y += 16;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.blue);
  pdf.text("TEXTO JURÍDICO", LAYOUT.marginX, y, { charSpace: 0.6 });
  y += 14;

  // Render del texto jurídico restante
  const onBreak = () => nextPage(pdf);
  const prose = legalProse(doc.blocks);
  for (const b of prose) {
    if (y > LAYOUT.contentBottom - 60) y = onBreak();
    switch (b.type) {
      case "title":
        // El hero ya muestra el título; ignoramos.
        break;
      case "subtitle":
        y = writeText(pdf, y, b.text, { size: 10.5, bold: true, color: BRAND.muted, lineGap: 6, align: "left" }, onBreak);
        break;
      case "heading":
        y = writeText(pdf, y, b.text, { size: 10.5, bold: true, color: BRAND.blueDark, lineGap: 4 }, onBreak);
        break;
      case "paragraph":
        y = writeText(pdf, y, b.text, { size: 10.5, align: "justify", lineGap: 6 }, onBreak);
        break;
      case "spacer":
        y += b.size ?? 8;
        break;
      case "signature":
        if (y + 80 > LAYOUT.contentBottom) y = onBreak();
        y = drawSignatures(pdf, y + 16, b.columns);
        break;
    }
  }
}

// ─────────────────────────────── Renderer: FICHA CONTRACTUAL ────────────────

function renderFichaContractual(pdf: jsPDF, doc: LegalDoc): void {
  // Hero compacto
  let y = drawHero(pdf, {
    badge: "Ficha Ejecutiva",
    title: "FICHA CONTRACTUAL NUVEX",
    subtitle: "Información base para el contrato de prestación de servicios",
    variant: "compact",
  });

  // Banner pequeño con cliente + banco + fecha (resumen contextual)
  const cliente = findField(doc.blocks, /nombre\s+completo/i);
  const banco = findField(doc.blocks, /^banco$/i);
  const fecha = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const summary: CardItem[] = [
    { label: "Cliente", value: cliente || "—", accent: "primary" },
    { label: "Entidad", value: banco || "—", accent: "primary" },
    { label: "Fecha de emisión", value: fecha, accent: "soft" },
  ];
  y = drawCardGrid(pdf, y, summary, 3, 62, 10);
  y += 4;

  // Una section card por cada bloque `section` agrupado
  const sections = groupBySection(doc.blocks);
  const onBreak = () => nextPage(pdf);
  sections.forEach((s, idx) => {
    if (s.fields.length === 0) return;
    const opts: SectionCardOpts = {
      index: idx + 1,
      title: s.title,
      fields: s.fields,
      accent: /honorarios|forma de pago/i.test(s.title) ? "green" : /asesor/i.test(s.title) ? "ink" : "blue",
    };
    // Estimar alto para decidir corte
    const rows = Math.ceil(s.fields.length / 2);
    const estH = 30 + 16 + rows * 32 + 18;
    if (y + estH > LAYOUT.contentBottom) y = onBreak();
    y = drawSectionCard(pdf, y, opts);
  });

  // Marca de validación
  if (doc.validationIssues && doc.validationIssues.length > 0) {
    if (y + 60 > LAYOUT.contentBottom) y = onBreak();
    roundedRect(pdf, LAYOUT.marginX, y, LAYOUT.pageW - LAYOUT.marginX * 2, 48, 8, [255, 247, 235], [255, 207, 153], 0.6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(180, 95, 6);
    pdf.text("PENDIENTE DE VALIDACIÓN FINANCIERA", LAYOUT.marginX + 14, y + 18, { charSpace: 0.5 });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...BRAND.muted);
    const msg = doc.validationIssues[0] || "Revisar consistencia financiera antes de contratar.";
    const lines = (pdf.splitTextToSize(msg, LAYOUT.pageW - LAYOUT.marginX * 2 - 28) as string[]).slice(0, 2);
    lines.forEach((l, i) => pdf.text(l, LAYOUT.marginX + 14, y + 32 + i * 10));
    y += 58;
  }
}

// ─────────────────────────────── Renderer: GENÉRICO (fallback) ──────────────

function renderGenericLegalDoc(pdf: jsPDF, doc: LegalDoc): void {
  // Header compacto con título del doc
  let y = drawHero(pdf, {
    badge: inferDocumentoLabel(doc, "generic"),
    title: doc.title.toUpperCase(),
    variant: "compact",
  });

  const onBreak = () => nextPage(pdf);

  for (const b of doc.blocks) {
    if (y > LAYOUT.contentBottom - 60) y = onBreak();
    switch (b.type) {
      case "title":
        // ya está en hero
        break;
      case "subtitle":
        y = writeText(pdf, y, b.text, { size: 10.5, bold: true, color: BRAND.muted, lineGap: 8, align: "left" }, onBreak);
        break;
      case "heading":
        y = writeText(pdf, y, b.text, { size: 11, bold: true, color: BRAND.blue, lineGap: 4 }, onBreak);
        break;
      case "paragraph":
        y = writeText(pdf, y, b.text, { size: 10.5, align: "justify", lineGap: 4 }, onBreak);
        break;
      case "section": {
        y += 8;
        if (y + 28 > LAYOUT.contentBottom) y = onBreak();
        roundedRect(pdf, LAYOUT.marginX, y, LAYOUT.pageW - LAYOUT.marginX * 2, 22, 4, BRAND.blueSoft, BRAND.border, 0.4);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...BRAND.blueDark);
        pdf.text(b.text, LAYOUT.marginX + 10, y + 15);
        y += 32;
        break;
      }
      case "field": {
        const labelW = 180;
        const contentW = LAYOUT.pageW - LAYOUT.marginX * 2;
        const valueW = contentW - labelW - 12;
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9.5);
        pdf.setTextColor(...BRAND.muted);
        const labelLines = pdf.splitTextToSize(b.label, labelW) as string[];
        pdf.setFont("helvetica", "normal");
        const valueLines = pdf.splitTextToSize(b.value || "—", valueW) as string[];
        const rows = Math.max(labelLines.length, valueLines.length);
        const lineH = 10 * 1.4;
        if (y + rows * lineH > LAYOUT.contentBottom) y = onBreak();
        const startY = y;
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...BRAND.muted);
        labelLines.forEach((l, i) => pdf.text(l, LAYOUT.marginX, startY + i * lineH));
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(...BRAND.ink);
        valueLines.forEach((l, i) => pdf.text(l, LAYOUT.marginX + labelW + 12, startY + i * lineH));
        y = startY + rows * lineH + 4;
        break;
      }
      case "spacer":
        y += b.size ?? 8;
        break;
      case "signature":
        if (y + 80 > LAYOUT.contentBottom) y = onBreak();
        y = drawSignatures(pdf, y + 16, b.columns);
        break;
    }
  }
}

// ─────────────────────────────── Composición final ──────────────────────────

async function composeBrandedPdf(doc: LegalDoc): Promise<jsPDF> {
  const pdf = createNuvexPdf();
  const kind = detectKind(doc);
  if (kind === "poder") renderPoderEspecial(pdf, doc);
  else if (kind === "ficha") renderFichaContractual(pdf, doc);
  else renderGenericLegalDoc(pdf, doc);

  const logoDataUrl = await loadLogoDataURL();
  const meta: BrandMeta = {
    documento: inferDocumentoLabel(doc, kind),
    consecutivo: doc.consecutivo,
  };
  applyChrome(pdf, logoDataUrl, meta);
  return pdf;
}

export async function exportLegalDocPDF(doc: LegalDoc) {
  if (doc.validationIssues && doc.validationIssues.length > 0) {
    console.warn(
      `[NUVEX PDF] "${doc.title}" — advertencia pendiente de validación financiera:\n` +
        doc.validationIssues.map((m) => ` • ${m}`).join("\n"),
    );
  }
  const pdf = await composeBrandedPdf(doc);
  pdf.save(`${doc.filename}.pdf`);
}

/** Igual que exportLegalDocPDF pero devuelve el Blob en memoria (no descarga). */
export async function legalDocToPDFBlob(doc: LegalDoc): Promise<Blob> {
  const pdf = await composeBrandedPdf(doc);
  return pdf.output("blob");
}

// ─────────────────────────────── DOCX ───────────────────────────────────────
// La exportación a Word permanece como respaldo (mismo branding tipográfico).

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
  const top: Paragraph[] = [];
  if (doc.consecutivo) {
    top.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: 20 },
      children: [new TextRun({ text: doc.consecutivo, bold: true, size: 18, color: "445DA3" })],
    }));
  }
  top.push(new Paragraph({
    spacing: { after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: "445DA3", space: 4 } },
    children: [new TextRun({ text: "NUVEX FINANZAS INTELIGENTES", bold: true, size: 22, color: "445DA3" })],
  }));

  const footer = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 12, color: "445DA3", space: 4 } },
    children: [
      new TextRun({ text: "NUVEX Finanzas Inteligentes", bold: true, size: 18, color: "445DA3" }),
      new TextRun({ text: "  ·  Carrera 16 # 37-48 Piso 4, Bucaramanga  ·  Bogotá | Bucaramanga", size: 16, color: "5C6770" }),
      new TextRun({ text: "  ·  juridica@nuvex.com.co  ·  www.nuvex.com.co", size: 16, color: "5C6770" }),
    ],
  });

  return new Document({
    styles: { default: { document: { run: { font: "Inter", size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [...top, ...doc.blocks.map(blockToDocx), footer],
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

// suprime warning de import sin uso
void NUVEX;
