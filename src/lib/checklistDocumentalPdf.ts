// Generador del PDF "Checklist Documental" — listado consolidado de documentos
// requeridos al cliente para radicación bancaria, con estado actual de cada uno.
// Se adjunta automáticamente al correo del checklist en Etapa 7.

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

export async function generarChecklistDocumentalPdf(
  exp: ExpedienteMaestro,
  docs: DocConEstado[],
): Promise<Blob> {
  const pdf = createNuvexPdf();
  const logo = await loadLogoDataURL();

  const cliente = exp.cliente?.nombre || "—";
  const cedula = exp.cliente?.cedula || "—";
  const banco = exp.credito?.banco || "—";
  const total = docs.length;
  const pendientes = docs.filter(
    (d) => d.obligatorio && !["recibido", "en_revision", "aprobado", "no_aplica"].includes(d.estado),
  ).length;

  let y = drawHero(pdf, {
    badge: "Checklist Documental",
    title: "DOCUMENTOS REQUERIDOS PARA RADICACIÓN",
    subtitle: `${cliente} · ${banco}`,
    variant: "compact",
  });

  y = writeText(
    pdf, y,
    `Cliente: ${cliente}    ·    C.C. ${cedula}    ·    Banco destino: ${banco}`,
    { size: 10, color: [92, 103, 112], lineGap: 14 },
    () => nextPage(pdf),
  );
  y = writeText(
    pdf, y,
    `Total documentos: ${total}    ·    Pendientes obligatorios: ${pendientes}    ·    Fecha: ${new Date().toLocaleDateString("es-CO")}`,
    { size: 10, color: [92, 103, 112], lineGap: 18 },
    () => nextPage(pdf),
  );

  // Tabla simple
  const contentLeft = LAYOUT.marginX;
  const contentRight = LAYOUT.pageW - LAYOUT.marginX;
  const colX = {
    n: contentLeft,
    doc: contentLeft + 22,
    tipo: contentLeft + 290,
    estado: contentLeft + 360,
  };
  const rowH = 18;

  function drawHeader(yy: number): number {
    pdf.setFillColor(245, 248, 252);
    pdf.rect(contentLeft, yy - 12, contentRight - contentLeft, rowH, "F");
    pdf.setTextColor(68, 93, 163);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("#", colX.n, yy);
    pdf.text("DOCUMENTO", colX.doc, yy);
    pdf.text("TIPO", colX.tipo, yy);
    pdf.text("ESTADO", colX.estado, yy);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(36, 36, 36);
    return yy + rowH;
  }

  y = drawHeader(y);

  docs.forEach((d, i) => {
    if (y > LAYOUT.contentBottom - 30) {
      y = nextPage(pdf);
      y = drawHeader(y);
    }
    // zebra
    if (i % 2 === 0) {
      pdf.setFillColor(250, 251, 253);
      pdf.rect(LAYOUT.contentLeft, y - 12, LAYOUT.contentRight - LAYOUT.contentLeft, rowH, "F");
    }
    pdf.setFontSize(9.5);
    pdf.setTextColor(36, 36, 36);
    pdf.text(String(i + 1), colX.n, y);

    // doc name (clamp)
    const nombre = pdf.splitTextToSize(d.nombre, colX.tipo - colX.doc - 6)[0] || d.nombre;
    pdf.text(nombre, colX.doc, y);

    pdf.setTextColor(92, 103, 112);
    pdf.text(d.obligatorio ? "Obligatorio" : "Opcional", colX.tipo, y);

    // estado colorizado
    const estadoColor: [number, number, number] =
      d.estado === "aprobado" || d.estado === "recibido"
        ? [31, 111, 74]
        : d.estado === "rechazado" || d.estado === "vencido"
        ? [180, 35, 24]
        : d.estado === "solicitado" || d.estado === "en_revision"
        ? [30, 78, 140]
        : d.estado === "no_aplica"
        ? [107, 114, 128]
        : [138, 90, 0];
    pdf.setTextColor(...estadoColor);
    pdf.setFont("helvetica", "bold");
    pdf.text(ESTADOS_LABEL[d.estado] ?? d.estado, colX.estado, y);
    pdf.setFont("helvetica", "normal");

    y += rowH;
  });

  // Observaciones agregadas
  const conObs = docs.filter((d) => d.observacion);
  if (conObs.length) {
    if (y > LAYOUT.contentBottom - 80) y = nextPage(pdf);
    y += 12;
    y = writeText(
      pdf, y,
      "Observaciones:",
      { bold: true, size: 11, color: [68, 93, 163] },
      () => nextPage(pdf),
    );
    for (const d of conObs) {
      y = writeText(
        pdf, y,
        `• ${d.nombre}: ${d.observacion}`,
        { size: 9.5, color: [92, 103, 112], lineGap: 12 },
        () => nextPage(pdf),
      );
    }
  }

  // Nota institucional
  if (y > LAYOUT.contentBottom - 60) y = nextPage(pdf);
  y += 14;
  pdf.setDrawColor(BRAND.azul);
  pdf.setLineWidth(0.5);
  pdf.line(LAYOUT.contentLeft, y - 8, LAYOUT.contentRight, y - 8);
  y = writeText(
    pdf, y,
    "Este listado refleja el estado de la documentación en el momento de su emisión. " +
    "Una vez recibida y validada por NUVEX, cada documento pasará a estado 'Aprobado' " +
    "para proceder con la radicación formal ante la entidad bancaria.",
    { size: 9.5, align: "justify", color: [92, 103, 112], lineGap: 14 },
    () => nextPage(pdf),
  );

  applyChrome(pdf, logo, {
    documento: "Checklist Documental — Radicación Bancaria",
    consecutivo: `NUVEX-CHK-${new Date().getFullYear()}-${(exp.id || "").slice(0, 6).toUpperCase()}`,
  });

  return pdf.output("blob");
}
