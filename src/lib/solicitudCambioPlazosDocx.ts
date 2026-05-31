// Generador de "Solicitud Cambio de Plazos" en formato Microsoft Word (.docx).
// Carta formal sencilla, redactada en primera persona del apoderado, conforme
// al texto institucional acordado con NUVEX.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} from "docx";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";

const INK = "242424";

export interface ApoderadoLite {
  nombre: string;
  cedula: string;
}

export interface SolicitudCambioPlazosInput {
  /** Cuotas que se desean eliminar del plazo original. */
  cuotasAEliminar?: string;
  /** Apoderado seleccionado (proveniente de apoderados_nuvex). */
  apoderado?: ApoderadoLite | null;
}

function p(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number; size?: number } = {}) {
  return new Paragraph({
    alignment: opts.align ?? AlignmentType.JUSTIFIED,
    spacing: { after: opts.spacingAfter ?? 160, line: 320 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 22,
        color: INK,
      }),
    ],
  });
}

function blank(spacingAfter = 120) {
  return new Paragraph({ spacing: { after: spacingAfter }, children: [new TextRun("")] });
}

function toInt(s: string | undefined | null): number | null {
  if (!s) return null;
  const n = parseInt(String(s).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export async function generarSolicitudCambioPlazosDocx(
  exp: ExpedienteMaestro,
  input: SolicitudCambioPlazosInput = {},
): Promise<Blob> {
  const cliente = (exp.cliente?.nombre || "").trim() || "_____________________";
  const cedulaCliente = (exp.cliente?.cedula || "").trim() || "____________";
  const banco = (exp.credito?.banco || "").trim() || "____________";
  const numCred = (exp.credito?.numeroCredito || "").trim() || "____________";
  const plazoOrigStr = (exp.credito?.plazoOriginal || "").trim() || "____";
  const plazoOrigNum = toInt(exp.credito?.plazoOriginal);

  const cot = exp.cotitular;
  const tieneCotitular = !!cot?.activo && !!(cot?.nombre || "").trim();
  const cotitularNombre = (cot?.nombre || "").trim();
  const cotitularCedula = (cot?.cedula || "").trim() || "____________";

  const apoderadoNombre = (input.apoderado?.nombre || exp.apoderado?.nombre || "").trim() || "_____________________";
  const apoderadoCedula = (input.apoderado?.cedula || exp.apoderado?.cedula || "").trim() || "____________";

  const cuotasElimNum = toInt(input.cuotasAEliminar);
  let nuevoPlazoStr = "____";
  if (plazoOrigNum != null && cuotasElimNum != null) {
    nuevoPlazoStr = String(Math.max(0, plazoOrigNum - cuotasElimNum));
  }

  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const ciudad = exp.cliente?.ciudad || "Bogotá D.C.";

  const children: Paragraph[] = [
    // Fecha y ciudad
    p(`${ciudad}, ${fecha}`, { align: AlignmentType.RIGHT, spacingAfter: 240 }),

    // Destinatario
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 60 },
      children: [new TextRun({ text: "Señores", bold: true, size: 24, color: INK })],
    }),
    p(banco.toUpperCase(), { bold: true, align: AlignmentType.LEFT, spacingAfter: 60 }),
    p("Ciudad", { align: AlignmentType.LEFT, spacingAfter: 240 }),

    // Asunto
    p(`Asunto: Solicitud de modificación de plazo — Crédito No. ${numCred}`, {
      bold: true,
      align: AlignmentType.LEFT,
      spacingAfter: 240,
    }),

    // Saludo
    p("Respetados señores,", { align: AlignmentType.LEFT, spacingAfter: 200 }),

    // Cuerpo principal
    p(
      `Yo, ${apoderadoNombre}, identificado con cédula de ciudadanía No. ${apoderadoCedula}, ` +
        `actuando en calidad de apoderado de ${cliente}, identificado(a) con cédula de ciudadanía ` +
        `No. ${cedulaCliente}, actuando como titular` +
        (tieneCotitular
          ? `, y de ${cotitularNombre}, identificado(a) con cédula de ciudadanía No. ${cotitularCedula}, actuando como cotitular`
          : "") +
        `, me permito solicitar la modificación del plazo del crédito No. ${numCred} de ${banco}, ` +
        `conforme a la Ley 546 de 1999, en los siguientes términos:`,
    ),

    p(
      `Actualmente, el plazo del Crédito Hipotecario es de ${plazoOrigStr} meses, y se desea modificar ` +
        `a un nuevo plazo de ${nuevoPlazoStr} meses.`,
    ),

    p(
      "Agradecemos su pronta gestión y quedamos atentos a su respuesta dentro del plazo establecido.",
      { spacingAfter: 320 },
    ),

    // Cierre
    p("Atentamente,", { align: AlignmentType.LEFT, spacingAfter: 800 }),

    // Firma
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "_______________________________", size: 22, color: INK }),
      ],
    }),
    p(apoderadoNombre, { bold: true, align: AlignmentType.LEFT, spacingAfter: 20 }),
    p(`C.C. No. ${apoderadoCedula}`, { align: AlignmentType.LEFT, spacingAfter: 20 }),
    p(`Apoderado de ${cliente}`, { align: AlignmentType.LEFT, spacingAfter: 800 }),

    // Firma del cliente (titular)
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: "_______________________________", size: 22, color: INK }),
      ],
    }),
    p(cliente, { bold: true, align: AlignmentType.LEFT, spacingAfter: 20 }),
    p(`C.C. No. ${cedulaCliente}`, { align: AlignmentType.LEFT, spacingAfter: 20 }),
    p("Titular del crédito", { align: AlignmentType.LEFT }),
  ];

  // Firma del cotitular (si aplica)
  if (tieneCotitular) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 800, after: 40 },
        children: [
          new TextRun({ text: "_______________________________", size: 22, color: INK }),
        ],
      }),
      p(cotitularNombre, { bold: true, align: AlignmentType.LEFT, spacingAfter: 20 }),
      p(`C.C. No. ${cotitularCedula}`, { align: AlignmentType.LEFT, spacingAfter: 20 }),
      p("Cotitular del crédito", { align: AlignmentType.LEFT }),
    );
  }


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
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
