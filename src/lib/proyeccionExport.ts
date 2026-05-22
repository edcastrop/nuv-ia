import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { ProyeccionResultado, CoberturaFresh } from "./proyeccion";
import { formatCOP, formatInt } from "./format";
import { formatFechaLarga, formatFecha } from "./proyeccion";
import { sanitizeFileName } from "./pdfExport";

const AZUL: [number, number, number] = [68, 93, 163];
const VERDE: [number, number, number] = [132, 185, 143];
const NEGRO: [number, number, number] = [36, 36, 36];

export interface ExportContext {
  cliente: string;
  banco: string;
  numeroCredito: string;
  producto: string;
  modo: "pesos" | "uvr";
  saldoActual: number;
  cuotaActual: number;
  seguros: number;
  tea: number;
  cuotasPendientes: number;
  plazoInicial: number;
  fresh: CoberturaFresh;
  fechaInicio: Date;
  actual: ProyeccionResultado;
  optimizado: ProyeccionResultado;
  propuestaResumen?: {
    nuevaCuota: number;
    nuevoPlazo: number;
    ahorroTotal: number;
  };
  includeAnexo?: boolean;
}

function header(pdf: jsPDF, ctx: ExportContext, pagina: number, total: number) {
  pdf.setFillColor(...NEGRO);
  pdf.rect(0, 0, 210, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("NUVEX · Proyección Detallada del Crédito", 10, 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(`${ctx.cliente} · ${ctx.banco} · ${ctx.numeroCredito}`, 10, 15);
  pdf.text(`Página ${pagina} / ${total}`, 200, 15, { align: "right" });
  pdf.setDrawColor(...VERDE);
  pdf.setLineWidth(0.4);
  pdf.line(0, 22, 210, 22);
}

function footer(pdf: jsPDF) {
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(10, 287, 200, 287);
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 120, 120);
  pdf.text(
    "NUVEX Finanzas Inteligentes · Documento técnico interno. La cobertura Fresh es informativa y no altera honorarios.",
    105, 292, { align: "center" },
  );
}

function kpiBox(pdf: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) {
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(x, y, w, h, 2, 2, "F");
  pdf.setDrawColor(...color);
  pdf.setLineWidth(0.4);
  pdf.line(x, y, x, y + h);
  pdf.setTextColor(110, 110, 120);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(label.toUpperCase(), x + 4, y + 5);
  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(value, x + 4, y + h - 4);
}

export function exportProyeccionPDF(ctx: ExportContext) {
  const pdf = new jsPDF("p", "mm", "a4");
  const totalPaginas = ctx.includeAnexo ? 4 : 3;

  // ====== PÁGINA 1 — Datos + dashboard + comparativo
  header(pdf, ctx, 1, totalPaginas);
  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Datos del Crédito", 10, 32);

  autoTable(pdf, {
    startY: 36,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5, textColor: NEGRO },
    columnStyles: {
      0: { fontStyle: "bold", textColor: [100, 100, 110], cellWidth: 42 },
      1: { cellWidth: 60 },
      2: { fontStyle: "bold", textColor: [100, 100, 110], cellWidth: 42 },
      3: { cellWidth: 46 },
    },
    body: [
      ["Cliente", ctx.cliente, "Producto", ctx.producto],
      ["Banco", ctx.banco, "N° Crédito", ctx.numeroCredito],
      ["Saldo actual", formatCOP(ctx.saldoActual), "Cuota actual", formatCOP(ctx.cuotaActual)],
      ["Seguros", formatCOP(ctx.seguros), "Tasa cobrada", `${ctx.tea.toFixed(2)}% EA`],
      ["Cuotas pendientes", formatInt(ctx.cuotasPendientes), "Plazo inicial", `${formatInt(ctx.plazoInicial)} meses`],
      ["Fecha inicio proyección", formatFechaLarga(ctx.fechaInicio), "Modo", ctx.modo.toUpperCase()],
    ],
  });

  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Dashboard Ejecutivo", 10, y);
  y += 4;

  // Escenario Actual
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...AZUL);
  pdf.text("ESCENARIO ACTUAL", 10, y + 4);
  kpiBox(pdf, 10, y + 6, 45, 16, "Fecha finalización", formatFecha(ctx.actual.fechaFinalizacion), AZUL);
  kpiBox(pdf, 58, y + 6, 45, 16, "Intereses futuros", formatCOP(ctx.actual.totalIntereses), AZUL);
  kpiBox(pdf, 106, y + 6, 45, 16, "Seguros futuros", formatCOP(ctx.actual.totalSeguros), AZUL);
  kpiBox(pdf, 154, y + 6, 46, 16, "Total pagos futuros", formatCOP(ctx.actual.totalPagado), AZUL);

  pdf.setTextColor(...VERDE);
  pdf.text("ESCENARIO OPTIMIZADO NUVEX", 10, y + 28);
  kpiBox(pdf, 10, y + 30, 45, 16, "Fecha finalización", formatFecha(ctx.optimizado.fechaFinalizacion), VERDE);
  kpiBox(pdf, 58, y + 30, 45, 16, "Intereses futuros", formatCOP(ctx.optimizado.totalIntereses), VERDE);
  kpiBox(pdf, 106, y + 30, 45, 16, "Seguros futuros", formatCOP(ctx.optimizado.totalSeguros), VERDE);
  kpiBox(pdf, 154, y + 30, 46, 16, "Total pagos futuros", formatCOP(ctx.optimizado.totalPagado), VERDE);

  y += 52;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Comparativo Actual vs Optimizado", 10, y);

  const dActual = ctx.actual;
  const dOpt = ctx.optimizado;
  const aniosA = dActual.cuotas.length / 12;
  const aniosO = dOpt.cuotas.length / 12;
  autoTable(pdf, {
    startY: y + 3,
    head: [["Métrica", "Actual", "Optimizado", "Diferencia"]],
    headStyles: { fillColor: NEGRO, textColor: 255, fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    body: [
      ["Cuotas pendientes", formatInt(dActual.cuotas.length), formatInt(dOpt.cuotas.length), formatInt(dActual.cuotas.length - dOpt.cuotas.length)],
      ["Años pendientes", aniosA.toFixed(1), aniosO.toFixed(1), (aniosA - aniosO).toFixed(1)],
      ["Fecha finalización", formatFecha(dActual.fechaFinalizacion), formatFecha(dOpt.fechaFinalizacion), "—"],
      ["Intereses futuros", formatCOP(dActual.totalIntereses), formatCOP(dOpt.totalIntereses), formatCOP(dActual.totalIntereses - dOpt.totalIntereses)],
      ["Seguros futuros", formatCOP(dActual.totalSeguros), formatCOP(dOpt.totalSeguros), formatCOP(dActual.totalSeguros - dOpt.totalSeguros)],
      ["Cobertura Fresh futura", formatCOP(dActual.totalFresh), formatCOP(dOpt.totalFresh), formatCOP(dActual.totalFresh - dOpt.totalFresh)],
      ["Total proyectado a pagar", formatCOP(dActual.totalPagado), formatCOP(dOpt.totalPagado), formatCOP(dActual.totalPagado - dOpt.totalPagado)],
    ],
  });
  footer(pdf);

  // ====== PÁGINA 2 — Impacto + fechas
  pdf.addPage();
  header(pdf, ctx, 2, totalPaginas);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Impacto Financiero", 10, 32);

  const ahorroInt = dActual.totalIntereses - dOpt.totalIntereses;
  const ahorroSeg = dActual.totalSeguros - dOpt.totalSeguros;
  const ahorroTot = dActual.totalPagado - dOpt.totalPagado;
  kpiBox(pdf, 10, 38, 60, 22, "Ahorro en intereses", formatCOP(ahorroInt), VERDE);
  kpiBox(pdf, 75, 38, 60, 22, "Ahorro en seguros", formatCOP(ahorroSeg), VERDE);
  kpiBox(pdf, 140, 38, 60, 22, "Ahorro total proyectado", formatCOP(ahorroTot), VERDE);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Línea de Tiempo de Finalización", 10, 72);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setDrawColor(220, 220, 220);
  pdf.line(20, 90, 190, 90);

  pdf.setFillColor(...AZUL);
  pdf.circle(20, 90, 2.5, "F");
  pdf.setTextColor(...AZUL);
  pdf.text("Hoy", 20, 84, { align: "center" });
  pdf.text(formatFecha(ctx.fechaInicio), 20, 97, { align: "center" });

  const posOpt = 20 + ((190 - 20) * dOpt.cuotas.length) / Math.max(dActual.cuotas.length, 1);
  pdf.setFillColor(...VERDE);
  pdf.circle(posOpt, 90, 3, "F");
  pdf.setTextColor(...VERDE);
  pdf.setFont("helvetica", "bold");
  pdf.text("Optimizada", posOpt, 84, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text(formatFecha(dOpt.fechaFinalizacion), posOpt, 97, { align: "center" });

  pdf.setFillColor(...NEGRO);
  pdf.circle(190, 90, 3, "F");
  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.text("Actual", 190, 84, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.text(formatFecha(dActual.fechaFinalizacion), 190, 97, { align: "center" });

  // Distribución de pagos
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Distribución de Pagos Futuros", 10, 115);

  const tot = (d: typeof dActual) => d.totalCapital + d.totalIntereses + d.totalSeguros + d.totalFresh;
  const pct = (n: number, t: number) => (t > 0 ? (n / t) * 100 : 0);
  const tA = tot(dActual), tO = tot(dOpt);
  autoTable(pdf, {
    startY: 119,
    head: [["Componente", "Actual ($)", "%", "Optimizado ($)", "%"]],
    headStyles: { fillColor: NEGRO, textColor: 255, fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 2 },
    body: [
      ["Capital", formatCOP(dActual.totalCapital), `${pct(dActual.totalCapital, tA).toFixed(1)}%`, formatCOP(dOpt.totalCapital), `${pct(dOpt.totalCapital, tO).toFixed(1)}%`],
      ["Intereses", formatCOP(dActual.totalIntereses), `${pct(dActual.totalIntereses, tA).toFixed(1)}%`, formatCOP(dOpt.totalIntereses), `${pct(dOpt.totalIntereses, tO).toFixed(1)}%`],
      ["Seguros", formatCOP(dActual.totalSeguros), `${pct(dActual.totalSeguros, tA).toFixed(1)}%`, formatCOP(dOpt.totalSeguros), `${pct(dOpt.totalSeguros, tO).toFixed(1)}%`],
      ["Cobertura Fresh", formatCOP(dActual.totalFresh), `${pct(dActual.totalFresh, tA).toFixed(1)}%`, formatCOP(dOpt.totalFresh), `${pct(dOpt.totalFresh, tO).toFixed(1)}%`],
    ],
  });
  footer(pdf);

  // ====== PÁGINA 3 — Explicación técnica
  pdf.addPage();
  header(pdf, ctx, 3, totalPaginas);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Explicación Técnica", 10, 32);

  const bloques = [
    {
      titulo: "Cobertura Fresh",
      texto:
        "La cobertura Fresh (también conocida como cobertura FRECH) es un beneficio del Gobierno Nacional que cubre temporalmente parte de la tasa de interés del crédito hipotecario. " +
        "Se aplica durante un número máximo de cuotas (por defecto 84). Una vez agotadas las cuotas Fresh pendientes, la cuota pagada por el cliente vuelve al valor antes de cobertura. " +
        "Este componente se muestra de forma informativa y NO modifica los cálculos de ahorro, honorarios ni la propuesta NUVEX.",
    },
    {
      titulo: "Intereses",
      texto:
        "La proyección utiliza la tasa de interés efectivamente cobrada por el banco. La tasa mensual se calcula como (1 + TEA)^(1/12) − 1 y se aplica al saldo a capital de cada periodo. " +
        "En créditos UVR, el saldo y la cuota se proyectan considerando la variación mensual de la UVR configurada por el analista.",
    },
    {
      titulo: "Seguros",
      texto:
        "Los seguros mensuales (vida deudor + incendio/terremoto) se mantienen constantes a lo largo del periodo proyectado y se suman a la cuota antes de cobertura. " +
        "El escenario optimizado conserva los mismos seguros mensuales aplicados al nuevo plazo.",
    },
    {
      titulo: "Nota legal",
      texto:
        "Esta proyección es una simulación técnica con base en los datos suministrados por el cliente y los extractos disponibles. " +
        "Las cifras pueden variar según la evolución real de la tasa, la UVR, los seguros y las políticas del banco. Documento de uso interno NUVEX.",
    },
  ];
  let by = 38;
  for (const b of bloques) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...AZUL);
    pdf.text(b.titulo, 10, by);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(60, 60, 70);
    const lines = pdf.splitTextToSize(b.texto, 190);
    pdf.text(lines, 10, by + 5);
    by += 5 + lines.length * 4.5 + 6;
  }
  footer(pdf);

  // ====== Anexo opcional: tablas mes a mes
  if (ctx.includeAnexo) {
    pdf.addPage();
    header(pdf, ctx, 4, totalPaginas);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...NEGRO);
    pdf.text("Anexo · Tabla mes a mes — Actual", 10, 32);
    autoTable(pdf, {
      startY: 36,
      head: [["#", "Fecha", "Saldo ini.", "Capital", "Interés", "Seguros", "Fresh", "Cuota antes", "Cuota pag.", "Saldo fin."]],
      headStyles: { fillColor: AZUL, textColor: 255, fontSize: 7.5 },
      styles: { fontSize: 6.8, cellPadding: 1.2 },
      body: dActual.cuotas.map((c) => [
        c.numero,
        formatFecha(c.fecha),
        formatCOP(c.saldoInicial),
        formatCOP(c.capital),
        formatCOP(c.interes),
        formatCOP(c.seguros),
        formatCOP(c.fresh),
        formatCOP(c.cuotaAntesCobertura),
        formatCOP(c.cuotaPagada),
        formatCOP(c.saldoFinal),
      ]),
    });

    pdf.addPage();
    header(pdf, ctx, 4, totalPaginas);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(...NEGRO);
    pdf.text("Anexo · Tabla mes a mes — Optimizado", 10, 32);
    autoTable(pdf, {
      startY: 36,
      head: [["#", "Fecha", "Saldo ini.", "Capital", "Interés", "Seguros", "Fresh", "Cuota antes", "Cuota pag.", "Saldo fin."]],
      headStyles: { fillColor: VERDE, textColor: 255, fontSize: 7.5 },
      styles: { fontSize: 6.8, cellPadding: 1.2 },
      body: dOpt.cuotas.map((c) => [
        c.numero,
        formatFecha(c.fecha),
        formatCOP(c.saldoInicial),
        formatCOP(c.capital),
        formatCOP(c.interes),
        formatCOP(c.seguros),
        formatCOP(c.fresh),
        formatCOP(c.cuotaAntesCobertura),
        formatCOP(c.cuotaPagada),
        formatCOP(c.saldoFinal),
      ]),
    });
    footer(pdf);
  }

  const name = `Proyeccion_${sanitizeFileName(ctx.cliente)}.pdf`;
  pdf.save(name);
}

export function exportProyeccionExcel(ctx: ExportContext) {
  const cols = ["Cuota", "Fecha", "Saldo inicial", "Capital", "Interés", "Seguros", "Cobertura Fresh", "Cuota antes cobertura", "Cuota pagada", "Saldo final"];
  const toRows = (r: ProyeccionResultado) =>
    r.cuotas.map((c) => ({
      Cuota: c.numero,
      Fecha: c.fecha.toISOString().slice(0, 10),
      "Saldo inicial": Math.round(c.saldoInicial),
      Capital: Math.round(c.capital),
      "Interés": Math.round(c.interes),
      Seguros: Math.round(c.seguros),
      "Cobertura Fresh": Math.round(c.fresh),
      "Cuota antes cobertura": Math.round(c.cuotaAntesCobertura),
      "Cuota pagada": Math.round(c.cuotaPagada),
      "Saldo final": Math.round(c.saldoFinal),
    }));
  const wb = XLSX.utils.book_new();
  const wsA = XLSX.utils.json_to_sheet(toRows(ctx.actual), { header: cols });
  XLSX.utils.book_append_sheet(wb, wsA, "Proyección Actual");
  const wsO = XLSX.utils.json_to_sheet(toRows(ctx.optimizado), { header: cols });
  XLSX.utils.book_append_sheet(wb, wsO, "Proyección Optimizada");
  XLSX.writeFile(wb, `Proyeccion_${sanitizeFileName(ctx.cliente)}.xlsx`);
}
