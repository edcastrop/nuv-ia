import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatCOP } from "./format";
import type {
  ProyeccionFinancieraInput,
  EscenarioInput,
  ResultadoEscenario,
  KpisComparacion,
} from "./proyeccionFinanciera";

const AZUL: [number, number, number] = [68, 93, 163];
const VERDE: [number, number, number] = [132, 185, 143];
const ROJO: [number, number, number] = [192, 57, 43];
const AMBAR: [number, number, number] = [224, 145, 58];
const NEGRO: [number, number, number] = [36, 36, 36];
const GRIS_CLARO: [number, number, number] = [245, 247, 251];
const GRIS_MEDIO: [number, number, number] = [110, 110, 120];

function sanitize(s: string): string {
  return (s || "cliente").replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
}

function fmtFecha(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
}

function fmtMes(d: Date): string {
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short" });
}

function header(pdf: jsPDF, ctx: ExportCtx, page: number) {
  // Banda superior
  pdf.setFillColor(...NEGRO);
  pdf.rect(0, 0, 210, 24, "F");
  pdf.setFillColor(...AZUL);
  pdf.rect(0, 22, 210, 2, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("NUVEX", 10, 11);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.setTextColor(200, 210, 235);
  pdf.text("Finanzas Inteligentes · Proyección Financiera", 10, 17);

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(`${ctx.input.clienteNombre || "Cliente NUVEX"}`, 200, 11, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(200, 210, 235);
  pdf.text(`Página ${page}`, 200, 17, { align: "right" });
}


function footer(pdf: jsPDF) {
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(10, 285, 200, 285);
  pdf.setFontSize(7.5);
  pdf.setTextColor(...GRIS_MEDIO);
  pdf.text(
    "NUVEX Finanzas Inteligentes · Documento confidencial preparado exclusivamente para el cliente.",
    105, 290, { align: "center" },
  );
  pdf.text(
    `Generado: ${new Date().toLocaleString("es-CO")}`,
    105, 294, { align: "center" },
  );
}

function kpi(
  pdf: jsPDF,
  x: number, y: number, w: number, h: number,
  label: string, value: string,
  accent: [number, number, number],
  hint?: string,
) {
  pdf.setFillColor(...GRIS_CLARO);
  pdf.roundedRect(x, y, w, h, 2.5, 2.5, "F");
  pdf.setFillColor(...accent);
  pdf.rect(x, y, 1.8, h, "F");
  pdf.setTextColor(...GRIS_MEDIO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text(label.toUpperCase(), x + 5, y + 5.5);
  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(value, x + 5, y + 13);
  if (hint) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(...GRIS_MEDIO);
    pdf.text(hint, x + 5, y + h - 2.5);
  }
}

export interface ExportCtx {
  input: ProyeccionFinancieraInput;
  escenario: EscenarioInput;
  actual: ResultadoEscenario;
  optimizado: ResultadoEscenario;
  kpis: KpisComparacion;
}

export function exportProyeccionFinancieraPDF(ctx: ExportCtx) {
  const pdf = new jsPDF("p", "mm", "a4");
  const { input, escenario, actual, optimizado, kpis } = ctx;

  // ============ PÁGINA 1 — Portada + datos cliente + KPIs
  header(pdf, ctx, 1);


  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Proyección Financiera", 10, 40);
  pdf.setFontSize(12);
  pdf.setTextColor(...AZUL);
  pdf.text(`Estrategia: ${escenario.nombre}`, 10, 48);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...GRIS_MEDIO);
  pdf.text(
    `Documento preparado para ${input.clienteNombre || "el cliente"} con base en los datos suministrados.`,
    10, 55,
  );

  // Datos del cliente / crédito
  pdf.setFillColor(...NEGRO);
  pdf.rect(10, 62, 190, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("DATOS DEL CLIENTE Y CRÉDITO", 13, 67);

  autoTable(pdf, {
    startY: 71,
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: NEGRO },
    columnStyles: {
      0: { fontStyle: "bold", textColor: GRIS_MEDIO, cellWidth: 38 },
      1: { cellWidth: 60 },
      2: { fontStyle: "bold", textColor: GRIS_MEDIO, cellWidth: 38 },
      3: { cellWidth: 54 },
    },
    body: [
      ["Cliente", input.clienteNombre || "—", "Banco", input.banco || "—"],
      ["Producto", input.tipoProducto === "hipotecario" ? "Hipotecario" : "Leasing habitacional", "Moneda", input.moneda.toUpperCase()],
      ["Valor desembolsado", formatCOP(input.valorDesembolsado), "Saldo a capital", formatCOP(input.saldoCapital)],
      ["Cuota actual", formatCOP(input.cuotaActual), "Tasa (EA)", `${input.teaPct.toFixed(2)}%`],
      ["Plazo inicial", `${input.cuotasTotales} cuotas`, "Cuotas pagadas", `${input.cuotasPagadas}`],
      ["Cuotas pendientes", `${input.cuotasPendientes || actual.mesesRestantes}`, "Fecha inicio proyección", input.fechaDesembolso || "—"],
    ],
  });

  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // KPI HERO destacado
  pdf.setFillColor(...ROJO);
  pdf.roundedRect(10, y, 190, 24, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.text("COSTO DE NO ACTUAR", 14, y + 7);
  pdf.setFontSize(18);
  pdf.text(formatCOP(kpis.costoNoActuar), 14, y + 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  pdf.text("Dinero adicional que se pagaría manteniendo el crédito sin optimizar", 110, y + 13);

  y += 30;

  // Grid de KPIs
  kpi(pdf, 10, y, 60, 22, "Ahorro total", formatCOP(kpis.ahorroTotal), VERDE, "Intereses + seguros evitados");
  kpi(pdf, 75, y, 60, 22, "Tiempo ahorrado", `${kpis.aniosEliminados} años · ${kpis.mesesEliminados % 12} m`, AZUL, `${kpis.mesesEliminados} meses menos`);
  kpi(pdf, 140, y, 60, 22, "ROI cliente", `${(kpis.roiCliente * 100).toFixed(0)}%`, AMBAR, `Aporte: ${formatCOP(kpis.inversionExtra)}`);

  y += 27;
  kpi(pdf, 10, y, 92, 20, "Intereses evitados", formatCOP(kpis.interesesEvitados), VERDE);
  kpi(pdf, 108, y, 92, 20, "Seguros evitados", formatCOP(kpis.segurosEvitados), VERDE);

  footer(pdf);

  // ============ PÁGINA 2 — Comparativo + estrategia
  pdf.addPage();
  header(pdf, ctx, 2);


  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Comparativo Actual vs Optimizado", 10, 36);

  autoTable(pdf, {
    startY: 41,
    head: [["Métrica", "Escenario Actual", escenario.nombre, "Diferencia"]],
    headStyles: { fillColor: NEGRO, textColor: 255, fontSize: 9.5, halign: "left" },
    styles: { fontSize: 9.5, cellPadding: 2.5 },
    alternateRowStyles: { fillColor: GRIS_CLARO },
    body: [
      [
        "Cuota mensual",
        formatCOP(input.cuotaActual),
        formatCOP(input.cuotaActual + escenario.aporteMensualExtra),
        `+${formatCOP(escenario.aporteMensualExtra)}`,
      ],
      [
        "Meses restantes",
        `${actual.mesesRestantes}`,
        `${optimizado.mesesRestantes}`,
        `−${kpis.mesesEliminados} meses`,
      ],
      [
        "Fecha terminación",
        fmtFecha(actual.fechaFinalizacion),
        fmtFecha(optimizado.fechaFinalizacion),
        `${kpis.aniosEliminados} años antes`,
      ],
      [
        "Total intereses",
        formatCOP(actual.totalIntereses),
        formatCOP(optimizado.totalIntereses),
        `−${formatCOP(kpis.interesesEvitados)}`,
      ],
      [
        "Total seguros",
        formatCOP(actual.totalSeguros),
        formatCOP(optimizado.totalSeguros),
        `−${formatCOP(kpis.segurosEvitados)}`,
      ],
      [
        "Costo total proyectado",
        formatCOP(actual.totalPagado),
        formatCOP(optimizado.totalPagado),
        `−${formatCOP(kpis.ahorroTotal)}`,
      ],
    ],
  });

  let y2 = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Estrategia recomendada
  pdf.setFillColor(...AZUL);
  pdf.roundedRect(10, y2, 190, 8, 1.5, 1.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  pdf.text("ESTRATEGIA RECOMENDADA NUVEX", 13, y2 + 5.5);
  y2 += 12;

  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const recomendacion =
    `Con un aporte mensual adicional de ${formatCOP(escenario.aporteMensualExtra)}` +
    (escenario.abonoExtraordinario > 0
      ? ` y un abono extraordinario de ${formatCOP(escenario.abonoExtraordinario)}`
      : "") +
    `, el cliente eliminaría ${kpis.aniosEliminados} años y ${kpis.mesesEliminados % 12} meses de su crédito, ` +
    `evitando ${formatCOP(kpis.interesesEvitados)} en intereses y ${formatCOP(kpis.segurosEvitados)} en seguros. ` +
    `Esto representa un retorno del ${(kpis.roiCliente * 100).toFixed(0)}% sobre el aporte total realizado.`;
  const lines = pdf.splitTextToSize(recomendacion, 184);
  pdf.text(lines, 13, y2 + 4);
  y2 += lines.length * 5 + 8;

  // Beneficios
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...AZUL);
  pdf.text("Beneficios concretos", 10, y2);
  y2 += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...NEGRO);
  const beneficios = [
    `• Libertad financiera ${kpis.aniosEliminados} años antes (terminación: ${fmtFecha(optimizado.fechaFinalizacion)}).`,
    `• Ahorro neto de ${formatCOP(kpis.ahorroTotal)} en pagos futuros.`,
    `• Reducción del costo total del crédito en ${((kpis.ahorroTotal / Math.max(actual.totalPagado, 1)) * 100).toFixed(1)}%.`,
    `• ROI del aporte: ${(kpis.roiCliente * 100).toFixed(0)}% — por cada peso aportado, ahorra ${kpis.roiCliente.toFixed(2)} pesos.`,
  ];
  beneficios.forEach((b, i) => pdf.text(b, 13, y2 + i * 5.5));

  footer(pdf);

  // ============ PÁGINA 3 — Resumen anual comparativo
  pdf.addPage();
  header(pdf, ctx, 3);

  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Resumen Anual Comparativo", 10, 36);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...GRIS_MEDIO);
  pdf.text("Crédito actual vs. estrategia optimizada — agrupado por año.", 10, 41);

  type AnioRow = { capital: number; interes: number; seguros: number; cuotas: number; saldoFin: number };
  const groupBy = (res: ResultadoEscenario): Map<number, AnioRow> => {
    const m = new Map<number, AnioRow>();
    res.cuotas.forEach((c) => {
      const a = c.fecha.getFullYear();
      const prev = m.get(a) ?? { capital: 0, interes: 0, seguros: 0, cuotas: 0, saldoFin: 0 };
      prev.capital += c.capital;
      prev.interes += c.interes;
      prev.seguros += c.seguros;
      prev.cuotas += 1;
      prev.saldoFin = c.saldoFinal;
      m.set(a, prev);
    });
    return m;
  };

  const anosActual = groupBy(actual);
  const anosOpt = groupBy(optimizado);
  const todosLosAnios = Array.from(new Set([...anosActual.keys(), ...anosOpt.keys()])).sort();

  autoTable(pdf, {
    startY: 46,
    head: [
      [
        { content: "Año", rowSpan: 2 },
        { content: "Crédito Actual", colSpan: 3, styles: { halign: "center", fillColor: ROJO } },
        { content: escenario.nombre, colSpan: 3, styles: { halign: "center", fillColor: VERDE } },
      ],
      ["Cuotas", "Total año", "Saldo", "Cuotas", "Total año", "Saldo"],
    ],
    headStyles: { fillColor: NEGRO, textColor: 255, fontSize: 8.5, halign: "center" },
    styles: { fontSize: 8, cellPadding: 1.8, halign: "right" },
    columnStyles: { 0: { halign: "center", fontStyle: "bold" } },
    alternateRowStyles: { fillColor: GRIS_CLARO },
    body: todosLosAnios.map((anio) => {
      const a = anosActual.get(anio);
      const o = anosOpt.get(anio);
      return [
        `${anio}`,
        a ? `${a.cuotas}` : "—",
        a ? formatCOP(a.capital + a.interes + a.seguros) : "—",
        a ? formatCOP(a.saldoFin) : "—",
        o ? `${o.cuotas}` : "—",
        o ? formatCOP(o.capital + o.interes + o.seguros) : "—",
        o ? formatCOP(o.saldoFin) : "—",
      ];
    }),
    foot: [[
      "Total",
      `${actual.cuotas.length}`,
      formatCOP(actual.totalPagado),
      "—",
      `${optimizado.cuotas.length}`,
      formatCOP(optimizado.totalPagado),
      "—",
    ]],
    footStyles: { fillColor: NEGRO, textColor: 255, fontSize: 8.5, fontStyle: "bold", halign: "right" },
    didDrawPage: () => footer(pdf),
  });

  // ============ ANEXO A — Tabla mes a mes · Crédito Actual
  const renderAmortizacion = (
    titulo: string,
    subtitulo: string,
    res: ResultadoEscenario,
    accent: [number, number, number],
  ) => {
    pdf.addPage();
    const startPage = pdf.getNumberOfPages();
    header(pdf, ctx, startPage);

    pdf.setTextColor(...NEGRO);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text(titulo, 10, 36);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...GRIS_MEDIO);
    pdf.text(subtitulo, 10, 41);

    autoTable(pdf, {
      startY: 46,
      margin: { top: 30, bottom: 18, left: 10, right: 10 },
      head: [["#", "Fecha", "Cuota", "Capital", "Interés", "Seguros", "Saldo final"]],
      headStyles: { fillColor: accent, textColor: 255, fontSize: 8.5, halign: "right" },
      columnStyles: {
        0: { halign: "center", cellWidth: 14, fontStyle: "bold" },
        1: { halign: "center", cellWidth: 26 },
      },
      styles: { fontSize: 7.8, cellPadding: 1.4, halign: "right" },
      alternateRowStyles: { fillColor: GRIS_CLARO },
      body: res.cuotas.map((c) => [
        `${c.numero}`,
        fmtMes(c.fecha),
        formatCOP(c.cuotaConExtra),
        formatCOP(c.capital),
        formatCOP(c.interes),
        formatCOP(c.seguros),
        formatCOP(c.saldoFinal),
      ]),
      foot: [[
        { content: "TOTAL", colSpan: 2, styles: { halign: "center", fontStyle: "bold" } },
        formatCOP(res.totalPagado),
        formatCOP(res.totalCapital),
        formatCOP(res.totalIntereses),
        formatCOP(res.totalSeguros),
        "—",
      ]],
      footStyles: { fillColor: NEGRO, textColor: 255, fontSize: 8.5, fontStyle: "bold", halign: "right" },
      didDrawPage: (data) => {
        // Repintar header en cada página nueva del anexo
        if (data.pageNumber > 1) {
          header(pdf, ctx, pdf.getNumberOfPages());
        }
        footer(pdf);
      },
    });
  };

  renderAmortizacion(
    "Anexo A · Amortización mes a mes — Crédito Actual",
    `${actual.cuotas.length} cuotas pendientes · termina ${fmtFecha(actual.fechaFinalizacion)}`,
    actual,
    ROJO,
  );

  renderAmortizacion(
    `Anexo B · Amortización mes a mes — ${escenario.nombre}`,
    `${optimizado.cuotas.length} cuotas · termina ${fmtFecha(optimizado.fechaFinalizacion)} · ahorro ${formatCOP(kpis.ahorroTotal)}`,
    optimizado,
    VERDE,
  );

  pdf.save(`NUVEX_Proyeccion_${sanitize(input.clienteNombre)}.pdf`);
}

