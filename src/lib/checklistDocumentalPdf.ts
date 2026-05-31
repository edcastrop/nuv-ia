// Generador del PDF "Checklist Documental" — listado consolidado de documentos
// requeridos al cliente para radicación bancaria. Diseño sobrio replicando el
// del Poder Especial: hero compacto + panel de metadatos + divisor + título de
// sección + tabla limpia + observaciones.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  applyChrome,
  createNuvexPdf,
  drawHero,
  loadLogoDataURL,
  writeText,
  nextPage,
  LAYOUT,
  BRAND,
} from "@/lib/pdf/nuvexPdfKit";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import {
  type DocRequerido,
  type EstadoDoc,
  ESTADOS_LABEL,
} from "@/lib/checklistDocumental";

interface DocConEstado extends DocRequerido {
  estado: EstadoDoc;
}

// ── Helpers locales (replicados del Poder Especial) ────────────────────────
function drawMetaPanel(
  pdf: jsPDF,
  y: number,
  left: Array<{ label: string; value: string }>,
  right: Array<{ label: string; value: string }>,
): number {
  const { pageW, marginX } = LAYOUT;
  const rightX = pageW - marginX;
  const rowH = 30;
  const rows = Math.max(left.length, right.length);

  for (let i = 0; i < rows; i++) {
    const ly = y + i * rowH;
    if (left[i]) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...BRAND.blueDark);
      pdf.text(left[i].label.toUpperCase(), marginX, ly, { charSpace: 0.5 });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...BRAND.ink);
      pdf.text(left[i].value || "—", marginX, ly + 14);
    }
    if (right[i]) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(...BRAND.blueDark);
      pdf.text(right[i].label.toUpperCase(), rightX, ly, { align: "right", charSpace: 0.5 });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10.5);
      pdf.setTextColor(...BRAND.ink);
      pdf.text(right[i].value || "—", rightX, ly + 14, { align: "right" });
    }
  }
  return y + rows * rowH + 8;
}

function drawDivider(pdf: jsPDF, y: number): number {
  const { pageW, marginX } = LAYOUT;
  pdf.setDrawColor(...BRAND.border);
  pdf.setLineWidth(0.5);
  pdf.line(marginX, y, pageW - marginX, y);
  return y + 14;
}

function drawSectionTitle(pdf: jsPDF, y: number, text: string): number {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.blueDark);
  pdf.text(text.toUpperCase(), LAYOUT.marginX, y, { charSpace: 0.6 });
  return y + 14;
}

export async function generarChecklistDocumentalPdf(
  exp: ExpedienteMaestro,
  docs: DocConEstado[],
): Promise<Blob> {
  const pdf = createNuvexPdf();
  const logo = await loadLogoDataURL();

  const cliente = exp.cliente?.nombre || "—";
  const cedula = exp.cliente?.cedula || "—";
  const banco = exp.credito?.banco || "—";
  const numCred = exp.credito?.numeroCredito || "—";
  const fecha = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const total = docs.length;
  const pendientes = docs.filter(
    (d) => d.obligatorio && !["recibido", "en_revision", "aprobado", "no_aplica"].includes(d.estado),
  ).length;
  const recibidos = docs.filter((d) =>
    ["recibido", "en_revision", "aprobado"].includes(d.estado),
  ).length;

  // Hero compacto
  let y = drawHero(pdf, {
    badge: "NUVEX · Documento Operativo",
    title: "Checklist Documental",
    subtitle: "Documentos requeridos para radicación bancaria",
    variant: "compact",
  });

  // Panel de metadatos: cliente | resumen
  y = drawMetaPanel(
    pdf,
    y,
    [
      { label: "Titular", value: cliente },
      { label: "Cédula", value: cedula },
      { label: "Banco destino", value: banco },
      { label: "Número de crédito", value: numCred },
    ],
    [
      { label: "Fecha de emisión", value: fecha },
      { label: "Total documentos", value: String(total) },
      { label: "Recibidos / aprobados", value: String(recibidos) },
      { label: "Pendientes obligatorios", value: String(pendientes) },
    ],
  );

  y = drawDivider(pdf, y);
  y = drawSectionTitle(pdf, y, "Listado de documentos");

  // Tabla limpia (estilo Ficha Contractual)
  autoTable(pdf, {
    startY: y,
    margin: { left: LAYOUT.marginX, right: LAYOUT.marginX },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 6, bottom: 6, left: 0, right: 4 },
      textColor: [36, 36, 36],
      lineColor: [227, 231, 238],
      lineWidth: { bottom: 0.4 } as unknown as number,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [92, 103, 112],
      fontStyle: "bold",
      fontSize: 8,
      cellPadding: { top: 4, bottom: 6, left: 0, right: 4 },
    },
    columnStyles: {
      0: { cellWidth: 22, textColor: [92, 103, 112], fontSize: 9 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 70, textColor: [92, 103, 112], fontSize: 9 },
      3: { cellWidth: 90, fontStyle: "bold", fontSize: 9.5 },
    },
    head: [["#", "DOCUMENTO", "TIPO", "ESTADO"]],
    body: docs.map((d, i) => [
      String(i + 1),
      d.nombre,
      d.obligatorio ? "Obligatorio" : "Opcional",
      ESTADOS_LABEL[d.estado] ?? d.estado,
    ]),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3) {
        const d = docs[data.row.index];
        const color: [number, number, number] =
          d.estado === "aprobado" || d.estado === "recibido"
            ? [31, 111, 74]
            : d.estado === "rechazado" || d.estado === "vencido"
            ? [180, 35, 24]
            : d.estado === "solicitado" || d.estado === "en_revision"
            ? [30, 78, 140]
            : d.estado === "no_aplica"
            ? [107, 114, 128]
            : [138, 90, 0];
        data.cell.styles.textColor = color;
      }
    },
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;

  // Observaciones (si las hay)
  const conObs = docs.filter((d) => d.observacion);
  const onBreak = () => nextPage(pdf);
  if (conObs.length) {
    if (y + 40 > LAYOUT.contentBottom) y = onBreak();
    y = drawDivider(pdf, y);
    y = drawSectionTitle(pdf, y, "Observaciones");
    for (const d of conObs) {
      y = writeText(
        pdf, y,
        `• ${d.nombre}: ${d.observacion}`,
        { size: 10, color: BRAND.muted, lineGap: 4 },
        onBreak,
      );
    }
  }

  // Nota institucional
  if (y + 60 > LAYOUT.contentBottom) y = onBreak();
  y += 6;
  y = drawDivider(pdf, y);
  y = writeText(
    pdf, y,
    "Este listado refleja el estado de la documentación al momento de su emisión. " +
    "Una vez recibida y validada por NUVEX, cada documento pasará a estado 'Aprobado' " +
    "para proceder con la radicación formal ante la entidad bancaria.",
    { size: 9.5, align: "justify", color: BRAND.muted, lineGap: 4 },
    onBreak,
  );

  applyChrome(pdf, logo, {
    documento: "Documento Operativo — Checklist Documental",
    consecutivo: `NUVEX-CHK-${new Date().getFullYear()}-${(exp.id || "").slice(0, 6).toUpperCase()}`,
  });

  return pdf.output("blob");
}
