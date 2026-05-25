// PDF de Cuenta de Cobro NUVEX (cliente). Devuelve Blob + base64.
import autoTable from "jspdf-autotable";
import { applyChrome, BRAND, createNuvexPdf, drawHero, LAYOUT, loadLogoDataURL } from "@/lib/pdf/nuvexPdfKit";
import { formatCOP } from "@/lib/format";
import type { Comision, CuentaCobro } from "@/lib/comisiones";

export interface CuentaCobroPdfData {
  cuenta: CuentaCobro;
  licenciado: { nombre: string; email: string | null; documento?: string | null };
  items: (Comision & { cliente: string; banco: string | null })[];
}

export interface CuentaCobroPdfResult {
  blob: Blob;
  base64: string;
  filename: string;
}

export async function buildCuentaCobroPdf(data: CuentaCobroPdfData): Promise<CuentaCobroPdfResult> {
  const pdf = createNuvexPdf();
  const logo = await loadLogoDataURL();
  const meta = {
    documento: "Documento Financiero — Cuenta de Cobro",
    consecutivo: data.cuenta.numero,
  };
  applyChrome(pdf, logo, meta);


  let y = drawHero(pdf, {
    title: "Cuenta de Cobro",
    subtitle: `N° ${data.cuenta.numero}`,
    badge: "NUVEX · Finanzas",
    variant: "compact",
  });

  // Bloque licenciado
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.blueDark);
  pdf.text("LICENCIADO / PRESTADOR", LAYOUT.marginX, y + 4);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(data.licenciado.nombre, LAYOUT.marginX, y + 20);
  if (data.licenciado.email) {
    pdf.setFontSize(9.5);
    pdf.setTextColor(...BRAND.muted);
    pdf.text(data.licenciado.email, LAYOUT.marginX, y + 34);
  }
  if (data.licenciado.documento) {
    pdf.setFontSize(9.5);
    pdf.setTextColor(...BRAND.muted);
    pdf.text("Doc: " + data.licenciado.documento, LAYOUT.marginX, y + 48);
  }

  // Bloque fecha/estado a la derecha
  const rightX = LAYOUT.pageW - LAYOUT.marginX;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.blueDark);
  pdf.text("FECHA EMISIÓN", rightX, y + 4, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(new Date(data.cuenta.created_at).toLocaleDateString("es-CO"), rightX, y + 20, { align: "right" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.blueDark);
  pdf.text("ESTADO", rightX, y + 38, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(data.cuenta.estado.toUpperCase(), rightX, y + 54, { align: "right" });

  y += 78;

  // Tabla de comisiones
  autoTable(pdf, {
    startY: y,
    margin: { left: LAYOUT.marginX, right: LAYOUT.marginX },
    head: [["#", "Cliente", "Banco", "Base", "%", "Comisión"]],
    body: data.items.map((it, idx) => [
      String(idx + 1),
      it.cliente,
      it.banco ?? "—",
      formatCOP(Number(it.base)),
      Number(it.porcentaje).toFixed(2) + "%",
      formatCOP(Number(it.valor)),
    ]),
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [36, 36, 36] },
    headStyles: {
      fillColor: [38, 56, 110],
      textColor: 255,
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: [247, 249, 251] },
    columnStyles: {
      0: { cellWidth: 24, halign: "center" },
      3: { halign: "right" },
      4: { halign: "right", cellWidth: 50 },
      5: { halign: "right", fontStyle: "bold" },
    },
    didDrawPage: () => applyChrome(pdf, logo, meta),
  });


  // Total
  const finalY = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND.blueDark);
  pdf.text("TOTAL A PAGAR", LAYOUT.marginX, finalY);
  pdf.setFontSize(16);
  pdf.setTextColor(...BRAND.ink);
  pdf.text(formatCOP(Number(data.cuenta.total)), rightX, finalY, { align: "right" });

  // Observaciones
  if (data.cuenta.observaciones) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...BRAND.blueDark);
    pdf.text("OBSERVACIONES", LAYOUT.marginX, finalY + 28);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.ink);
    const lines = pdf.splitTextToSize(data.cuenta.observaciones, LAYOUT.pageW - LAYOUT.marginX * 2);
    pdf.text(lines, LAYOUT.marginX, finalY + 44);
  }

  const blob = pdf.output("blob");
  const arrayBuffer = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const base64 = btoa(bin);
  const filename = `Cuenta-Cobro-${data.cuenta.numero}.pdf`;
  return { blob, base64, filename };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
