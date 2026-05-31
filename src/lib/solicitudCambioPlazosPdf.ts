// Generador del PDF "Solicitud Cambio de Plazos" para Etapa 7 — Radicación bancaria.
// Membrete NUVEX, datos del cliente y crédito, plazo actual vs solicitado, justificación,
// espacios de firma del apoderado y del titular.

import {
  applyChrome,
  createNuvexPdf,
  drawHero,
  drawSectionCard,
  drawSignatures,
  loadLogoDataURL,
  writeText,
  nextPage,
  LAYOUT,
} from "@/lib/pdf/nuvexPdfKit";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";

export interface SolicitudCambioPlazosInput {
  plazoSolicitadoMeses?: string;
  nuevoValorCuota?: string;
  justificacion?: string;
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

  const plazoNuevo = input.plazoSolicitadoMeses?.trim() || "_______";
  const cuotaNueva = input.nuevoValorCuota?.trim() || "_______";
  const justif = input.justificacion?.trim() ||
    "El titular solicita el ajuste de plazo con el fin de adecuar la cuota mensual a su capacidad de pago actual, manteniendo el cumplimiento de la obligación crediticia.";

  let y = drawHero(pdf, {
    badge: "Documento Bancario",
    title: "SOLICITUD DE CAMBIO DE PLAZOS",
    subtitle: `Para ${banco}`,
    variant: "compact",
  });

  // Datos titular
  y = drawSectionCard(pdf, y, {
    index: 1,
    title: "Datos del titular",
    accent: "blue",
    fields: [
      { label: "Nombre completo", value: cliente },
      { label: "Cédula de ciudadanía", value: cedula },
    ],
  });

  // Datos obligación
  y = drawSectionCard(pdf, y, {
    index: 2,
    title: "Datos del crédito",
    accent: "blue",
    fields: [
      { label: "Entidad bancaria", value: banco },
      { label: "Número de obligación", value: numCred },
      { label: "Tipo de producto", value: tipo },
      { label: "Saldo capital", value: saldo },
      { label: "Cuota actual", value: cuotaAct },
      { label: "Plazo original", value: plazoOrig },
      { label: "Cuotas pagadas", value: cuotasPag },
      { label: "Cuotas pendientes", value: cuotasPend },
    ],
  });

  // Nueva petición
  y = drawSectionCard(pdf, y, {
    index: 3,
    title: "Modificación solicitada",
    accent: "green",
    fields: [
      { label: "Nuevo plazo solicitado (meses)", value: plazoNuevo },
      { label: "Nuevo valor de cuota estimado", value: cuotaNueva },
    ],
  });

  // Justificación (texto largo)
  if (y > 600) y = nextPage(pdf);
  y = writeText(
    pdf, y,
    "Justificación de la solicitud:",
    { bold: true, size: 11, color: [68, 93, 163] },
    () => nextPage(pdf),
  );
  y = writeText(pdf, y, justif, { size: 10.5, align: "justify", lineGap: 12 }, () => nextPage(pdf));

  // Texto institucional
  y = writeText(
    pdf, y,
    `En cumplimiento de los principios de transparencia y debida representación, NUVEX Finanzas Inteligentes —` +
    ` actuando por intermedio del apoderado debidamente facultado mediante poder especial No. ${numPoder} ` +
    `— solicita formalmente a ${banco} la modificación del plazo de la obligación arriba referenciada.`,
    { size: 10, align: "justify", color: [92, 103, 112], lineGap: 18 },
    () => nextPage(pdf),
  );

  // Firmas
  if (y > LAYOUT.contentBottom - 100) y = nextPage(pdf);
  y = Math.max(y, LAYOUT.contentBottom - 110);
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
