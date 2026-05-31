// Generador de "Solicitud Cambio de Plazos" en formato Microsoft Word (.docx).
// Diseño sobrio replicando el del Checklist Documental: cabecera con banda
// azul, panel de metadatos en dos columnas, secciones con divisor, párrafo
// de justificación y bloque de firmas.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
} from "docx";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";

const BRAND_BLUE = "445DA3";
const BRAND_BLUE_DARK = "2E4178";
const INK = "242424";
const MUTED = "5C6770";
const BORDER = "E3E7EE";

const TABLE_W = 9360;

export interface SolicitudCambioPlazosInput {
  plazoSolicitadoMeses?: string;
  nuevoValorCuota?: string;
  justificacion?: string;
}

function noBorders() {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return { top: none, bottom: none, left: none, right: none };
}

function metaLabel(text: string) {
  return new Paragraph({
    spacing: { after: 20 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 14,
        color: BRAND_BLUE_DARK,
        characterSpacing: 10,
      }),
    ],
  });
}

function metaValue(text: string) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: text || "—", size: 21, color: INK })],
  });
}

function metaCell(label: string, value: string, width: number) {
  return new TableCell({
    borders: noBorders(),
    width: { size: width, type: WidthType.DXA },
    margins: { top: 40, bottom: 40, left: 0, right: 60 },
    children: [metaLabel(label), metaValue(value)],
  });
}

function metaPanel(rows: Array<[string, string, string, string]>) {
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: rows.map(
      (r) =>
        new TableRow({
          children: [metaCell(r[0], r[1], 4680), metaCell(r[2], r[3], 4680)],
        }),
    ),
  });
}

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_BLUE, space: 4 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18,
        color: BRAND_BLUE_DARK,
        characterSpacing: 12,
      }),
    ],
  });
}

function signatureBlock(label: string, name: string, cc: string) {
  return new TableCell({
    borders: noBorders(),
    width: { size: 4680, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 0, right: 120 },
    children: [
      new Paragraph({
        spacing: { before: 800, after: 60 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 6, color: INK, space: 4 },
        },
        children: [new TextRun({ text: name, bold: true, size: 22, color: INK })],
      }),
      new Paragraph({
        spacing: { after: 20 },
        children: [new TextRun({ text: cc, size: 18, color: MUTED })],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: label.toUpperCase(),
            size: 14,
            color: BRAND_BLUE_DARK,
            bold: true,
            characterSpacing: 10,
          }),
        ],
      }),
    ],
  });
}

export async function generarSolicitudCambioPlazosDocx(
  exp: ExpedienteMaestro,
  input: SolicitudCambioPlazosInput = {},
): Promise<Blob> {
  const cliente = exp.cliente?.nombre || "—";
  const cedula = exp.cliente?.cedula || "—";
  const banco = exp.credito?.banco || "—";
  const numCred = exp.credito?.numeroCredito || "—";
  const tipo = exp.credito?.tipoProducto || "—";
  const plazoOrig = exp.credito?.plazoOriginal || "—";
  const cuotasPag = exp.credito?.cuotasPagadas || "—";
  const cuotasPend = exp.credito?.cuotasPendientes || "—";
  const cuotaAct = exp.credito?.cuotaActual || "—";
  const saldo = exp.credito?.saldoCapital || "—";
  const apoderado = exp.apoderado?.nombre || "—";
  const apoderadoCc = exp.apoderado?.cedula || "—";
  const numPoder = exp.apoderado?.numeroPoder || "—";
  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const plazoNuevo = input.plazoSolicitadoMeses?.trim() || "_______";
  const cuotaNueva = input.nuevoValorCuota?.trim() || "_______";
  const justif =
    input.justificacion?.trim() ||
    "El titular solicita el ajuste de plazo con el fin de adecuar la cuota mensual a su capacidad de pago actual, manteniendo el cumplimiento de la obligación crediticia.";

  const headerBadge = new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: "NUVEX · DOCUMENTO BANCARIO",
        bold: true,
        size: 14,
        color: BRAND_BLUE,
        characterSpacing: 30,
      }),
    ],
  });
  const headerTitle = new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: "Solicitud de Cambio de Plazos",
        bold: true,
        size: 40,
        color: INK,
      }),
    ],
  });
  const headerSubtitle = new Paragraph({
    spacing: { after: 240 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND_BLUE, space: 8 },
    },
    children: [
      new TextRun({
        text: `Dirigida a ${banco}`,
        size: 22,
        color: MUTED,
        italics: true,
      }),
    ],
  });

  const datosPanel = metaPanel([
    ["Titular", cliente, "Fecha de emisión", fecha],
    ["Cédula", cedula, "Producto", tipo],
    ["Banco", banco, "Saldo capital", saldo],
    ["Número de crédito", numCred, "Cuota actual", cuotaAct],
  ]);

  const estadoPanel = metaPanel([
    ["Plazo original", plazoOrig, "Cuotas pendientes", cuotasPend],
    ["Cuotas pagadas", cuotasPag, "Cuota mensual vigente", cuotaAct],
  ]);

  const modificacionPanel = metaPanel([
    [
      "Nuevo plazo solicitado (meses)",
      plazoNuevo,
      "Nuevo valor de cuota estimado",
      cuotaNueva,
    ],
  ]);

  const justifPara = new Paragraph({
    alignment: AlignmentType.JUSTIFY,
    spacing: { after: 160, line: 320 },
    children: [new TextRun({ text: justif, size: 22, color: INK })],
  });

  const formalPara = new Paragraph({
    alignment: AlignmentType.JUSTIFY,
    spacing: { after: 240, line: 320 },
    children: [
      new TextRun({
        text:
          "En cumplimiento de los principios de transparencia y debida representación, NUVEX Finanzas Inteligentes " +
          `—actuando por intermedio del apoderado debidamente facultado mediante poder especial No. ${numPoder}— ` +
          `solicita formalmente a ${banco} la modificación del plazo de la obligación arriba referenciada.`,
        size: 22,
        color: MUTED,
        italics: true,
      }),
    ],
  });

  const firmasTable = new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      new TableRow({
        children: [
          signatureBlock("Titular", cliente, `C.C. ${cedula}`),
          signatureBlock(
            "Apoderado NUVEX",
            apoderado,
            `C.C. ${apoderadoCc} · Poder ${numPoder}`,
          ),
        ],
      }),
    ],
  });

  const footer = new Paragraph({
    spacing: { before: 320 },
    alignment: AlignmentType.RIGHT,
    border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 8 },
    },
    children: [
      new TextRun({
        text: `NUVEX-SCP-${new Date().getFullYear()}-${(exp.id || "").slice(0, 6).toUpperCase()}`,
        size: 16,
        color: MUTED,
        characterSpacing: 8,
      }),
    ],
  });

  const doc = new Document({
    creator: "NUVEX Finanzas Inteligentes",
    title: `Solicitud Cambio de Plazos — ${cliente}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          headerBadge,
          headerTitle,
          headerSubtitle,
          datosPanel,
          sectionTitle("Estado actual de la obligación"),
          estadoPanel,
          sectionTitle("Modificación solicitada"),
          modificacionPanel,
          sectionTitle("Justificación"),
          justifPara,
          formalPara,
          firmasTable,
          footer,
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
