// Generador del "Checklist Documental" en formato Microsoft Word (.docx).
// Reemplaza la versión en PDF: el cliente recibe un documento editable y
// estándar para revisar y devolver los soportes.

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
  ShadingType,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
} from "docx";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import {
  type DocRequerido,
  type EstadoDoc,
  ESTADOS_LABEL,
} from "@/lib/checklistDocumental";

interface DocConEstado extends DocRequerido {
  estado: EstadoDoc;
}

const BRAND_BLUE = "445DA3";
const BRAND_BLUE_DARK = "2E4178";
const INK = "242424";
const MUTED = "5C6770";
const BORDER = "E3E7EE";
const SOFT = "F5F8FC";

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
};

// Anchos de columna (DXA — 1440 = 1 pulgada). US Letter con márgenes 1" → 9360.
const TABLE_W = 9360;
const COL_W = [600, 4760, 1500, 2500];

function metaLabel(text: string) {
  return new Paragraph({
    spacing: { after: 20 },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 14, // 7pt
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
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    },
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
    spacing: { before: 240, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND_BLUE, space: 4 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 18, // 9pt
        color: BRAND_BLUE_DARK,
        characterSpacing: 12,
      }),
    ],
  });
}

function estadoColor(estado: EstadoDoc): string {
  switch (estado) {
    case "aprobado":
    case "recibido":
      return "1F6F4A";
    case "rechazado":
    case "vencido":
      return "B42318";
    case "solicitado":
    case "en_revision":
      return "1E4E8C";
    case "no_aplica":
      return "6B7280";
    default:
      return "8A5A00";
  }
}

function headerCell(text: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: SOFT, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: text.toUpperCase(),
            bold: true,
            size: 16,
            color: MUTED,
            characterSpacing: 10,
          }),
        ],
      }),
    ],
  });
}

function bodyCell(
  text: string,
  width: number,
  opts: { color?: string; bold?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.align ?? AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            size: opts.size ?? 20,
            bold: opts.bold,
            color: opts.color ?? INK,
          }),
        ],
      }),
    ],
  });
}

export async function generarChecklistDocumentalDocx(
  exp: ExpedienteMaestro,
  docs: DocConEstado[],
): Promise<Blob> {
  const cliente = exp.cliente?.nombre || "—";
  const cedula = exp.cliente?.cedula || "—";
  const banco = exp.credito?.banco || "—";
  const numCred = exp.credito?.numeroCredito || "—";
  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const total = docs.length;
  const recibidos = docs.filter((d) =>
    ["recibido", "en_revision", "aprobado"].includes(d.estado),
  ).length;
  const pendientes = docs.filter(
    (d) =>
      d.obligatorio &&
      !["recibido", "en_revision", "aprobado", "no_aplica"].includes(d.estado),
  ).length;

  const conObs = docs.filter((d) => d.observacion);

  // Cabecera del documento
  const headerBadge = new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: "NUVEX · DOCUMENTO OPERATIVO",
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
        text: "Checklist Documental",
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
        text: "Documentos requeridos para radicación bancaria",
        size: 22,
        color: MUTED,
        italics: true,
      }),
    ],
  });

  // Panel de metadatos
  const panel = metaPanel([
    ["Titular", cliente, "Fecha de emisión", fecha],
    ["Cédula", cedula, "Total documentos", String(total)],
    ["Banco destino", banco, "Recibidos / aprobados", String(recibidos)],
    ["Número de crédito", numCred, "Pendientes obligatorios", String(pendientes)],
  ]);

  // Tabla de documentos
  const headRow = new TableRow({
    tableHeader: true,
    children: [
      headerCell("#", COL_W[0], AlignmentType.CENTER),
      headerCell("Documento", COL_W[1]),
      headerCell("Tipo", COL_W[2]),
      headerCell("Estado", COL_W[3]),
    ],
  });

  const bodyRows = docs.map(
    (d, i) =>
      new TableRow({
        children: [
          bodyCell(String(i + 1), COL_W[0], {
            color: MUTED,
            size: 18,
            align: AlignmentType.CENTER,
          }),
          bodyCell(d.nombre, COL_W[1]),
          bodyCell(d.obligatorio ? "Obligatorio" : "Opcional", COL_W[2], {
            color: MUTED,
            size: 18,
          }),
          bodyCell(ESTADOS_LABEL[d.estado] ?? d.estado, COL_W[3], {
            color: estadoColor(d.estado),
            bold: true,
            size: 19,
          }),
        ],
      }),
  );

  const docsTable = new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: COL_W,
    rows: [headRow, ...bodyRows],
  });

  const children: Array<Paragraph | Table> = [
    headerBadge,
    headerTitle,
    headerSubtitle,
    panel,
    sectionTitle("Listado de documentos"),
    docsTable,
  ];

  // Observaciones (si las hay)
  if (conObs.length) {
    children.push(sectionTitle("Observaciones"));
    for (const d of conObs) {
      children.push(
        new Paragraph({
          numbering: { reference: "bullets", level: 0 },
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${d.nombre}: `, bold: true, size: 20, color: INK }),
            new TextRun({ text: d.observacion ?? "", size: 20, color: MUTED }),
          ],
        }),
      );
    }
  }

  // Nota institucional
  children.push(
    new Paragraph({
      spacing: { before: 320, after: 40 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 8 },
      },
      children: [
        new TextRun({
          text:
            "Este listado refleja el estado de la documentación al momento de su emisión. " +
            "Una vez recibida y validada por NUVEX, cada documento pasará a estado “Aprobado” " +
            "para proceder con la radicación formal ante la entidad bancaria.",
          size: 18,
          color: MUTED,
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 120 },
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `NUVEX-CHK-${new Date().getFullYear()}-${(exp.id || "").slice(0, 6).toUpperCase()}`,
          size: 16,
          color: MUTED,
          characterSpacing: 8,
        }),
      ],
    }),
  );

  const doc = new Document({
    creator: "NUVEX Finanzas Inteligentes",
    title: `Checklist Documental — ${cliente}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  return buffer;
}
