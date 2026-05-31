// Generador del PDF "Solicitud Cambio de Plazos" — Etapa 7 Radicación.
// Diseño sobrio replicando el del Poder Especial: hero compacto + panel de
// metadatos en dos columnas + divisor + título de sección + texto justificado
// + firmas.

import { jsPDF } from "jspdf";
import {
  applyChrome,
  createNuvexPdf,
  drawHero,
  drawSignatures,
  loadLogoDataURL,
  writeText,
  nextPage,
  LAYOUT,
  BRAND,
} from "@/lib/pdf/nuvexPdfKit";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";

export interface SolicitudCambioPlazosInput {
  plazoSolicitadoMeses?: string;
  nuevoValorCuota?: string;
  justificacion?: string;
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

export async function generarSolicitudCambioPlazosPdf(
  exp: ExpedienteMaestro,
  input: SolicitudCambioPlazosInput = {},
): Promise<Blob> {
  const pdf = createNuvexPdf();
  const logo = await loadLogoDataURL();

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
  const fecha = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  const plazoNuevo = input.plazoSolicitadoMeses?.trim() || "_______";
  const cuotaNueva = input.nuevoValorCuota?.trim() || "_______";
  const justif = input.justificacion?.trim() ||
    "El titular solicita el ajuste de plazo con el fin de adecuar la cuota mensual a su capacidad de pago actual, manteniendo el cumplimiento de la obligación crediticia.";

  // Hero compacto
  let y = drawHero(pdf, {
    badge: "NUVEX · Documento Bancario",
    title: "Solicitud de Cambio de Plazos",
    subtitle: `Dirigida a ${banco}`,
    variant: "compact",
  });

  // Panel de metadatos: titular | obligación
  y = drawMetaPanel(
    pdf,
    y,
    [
      { label: "Titular", value: cliente },
      { label: "Cédula", value: cedula },
      { label: "Banco", value: banco },
      { label: "Número de crédito", value: numCred },
    ],
    [
      { label: "Fecha de emisión", value: fecha },
      { label: "Producto", value: tipo },
      { label: "Saldo capital", value: saldo },
      { label: "Cuota actual", value: cuotaAct },
    ],
  );

  y = drawDivider(pdf, y);
  y = drawSectionTitle(pdf, y, "Estado actual de la obligación");

  y = drawMetaPanel(
    pdf,
    y,
    [
      { label: "Plazo original", value: plazoOrig },
      { label: "Cuotas pagadas", value: cuotasPag },
    ],
    [
      { label: "Cuotas pendientes", value: cuotasPend },
      { label: "Cuota mensual vigente", value: cuotaAct },
    ],
  );

  y = drawDivider(pdf, y);
  y = drawSectionTitle(pdf, y, "Modificación solicitada");

  y = drawMetaPanel(
    pdf,
    y,
    [{ label: "Nuevo plazo solicitado (meses)", value: plazoNuevo }],
    [{ label: "Nuevo valor de cuota estimado", value: cuotaNueva }],
  );

  y = drawDivider(pdf, y);
  y = drawSectionTitle(pdf, y, "Justificación");

  const onBreak = () => nextPage(pdf);
  y = writeText(pdf, y, justif, { size: 10.5, align: "justify", lineGap: 6 }, onBreak);

  y += 8;
  y = writeText(
    pdf, y,
    `En cumplimiento de los principios de transparencia y debida representación, NUVEX Finanzas Inteligentes ` +
    `—actuando por intermedio del apoderado debidamente facultado mediante poder especial No. ${numPoder}— ` +
    `solicita formalmente a ${banco} la modificación del plazo de la obligación arriba referenciada.`,
    { size: 10.5, align: "justify", color: BRAND.muted, lineGap: 6 },
    onBreak,
  );

  // Firmas
  if (y + 90 > LAYOUT.contentBottom) y = nextPage(pdf);
  y = Math.max(y + 24, LAYOUT.contentBottom - 110);
  y = drawSignatures(pdf, y, [
    { label: "Titular", name: cliente, cc: `C.C. ${cedula}` },
    { label: "Apoderado NUVEX", name: apoderado, cc: `C.C. ${apoderadoCc} · Poder ${numPoder}` },
  ]);

  applyChrome(pdf, logo, {
    documento: "Documento Bancario — Solicitud Cambio de Plazos",
    consecutivo: `NUVEX-SCP-${new Date().getFullYear()}-${(exp.id || "").slice(0, 6).toUpperCase()}`,
  });

  return pdf.output("blob");
}
