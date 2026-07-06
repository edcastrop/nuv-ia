import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCOP, formatInt } from "./format";
import { sanitizeFileName } from "./pdfExport";

const AZUL: [number, number, number] = [68, 93, 163];
const VERDE: [number, number, number] = [132, 185, 143];
const NEGRO: [number, number, number] = [36, 36, 36];

export interface AbonoRow {
  periodo: number;
  saldoInicial: number;
  cuota: number; // cuota base (capital+interés)
  interes: number;
  capital: number;
  seguros: number;
  fresh: number;
  cuotaPagada: number; // cuota + seguros - fresh
  abono: number;
  saldoFinal: number;
  // opcional COP para UVR
  cuotaCOP?: number;
  saldoInicialCOP?: number;
  saldoFinalCOP?: number;
  abonoCOP?: number;
}

export interface AbonosExportCtx {
  cliente: string;
  banco: string;
  producto: string;
  modo: "pesos" | "uvr";
  valor: number;
  tea: number;
  plazo: number;
  seguros: number;
  fresh: { activo: boolean; valorMensual: number; cuotasPendientes: number };
  fechaGeneracion: Date;

  base: {
    cuotasUsadas: number;
    cuotaFinal: number;
    totalInteres: number;
    fechaFin: string;
    rows: AbonoRow[];
  };
  optimizado: {
    cuotasUsadas: number;
    cuotaFinal: number;
    totalInteres: number;
    fechaFin: string;
    rows: AbonoRow[];
  };
  abonos: Array<{ cuota: number; monto: number; destino: "plazo" | "cuota" }>;
  ahorroInteresCOP: number;
  cuotasAhorradas: number;
}

function header(pdf: jsPDF, ctx: AbonosExportCtx, pagina: number, total: number) {
  pdf.setFillColor(...NEGRO);
  pdf.rect(0, 0, 210, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("NUVIA · Extra Payments Simulator", 10, 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    `${ctx.cliente || "Sin cliente"} · ${ctx.banco || "—"} · ${ctx.producto || "—"}`,
    10,
    15,
  );
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
    "NUVIA Finanzas Inteligentes · Simulación de abonos extraordinarios a capital. Cifras informativas.",
    105,
    292,
    { align: "center" },
  );
}

function kpiBox(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: [number, number, number],
) {
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
  pdf.setFontSize(10);
  pdf.text(value, x + 4, y + h - 4);
}

export function exportAbonosPDF(ctx: AbonosExportCtx) {
  const pdf = new jsPDF("p", "mm", "a4");
  const totalPaginas = 3;

  // ============ PAGE 1 — Datos + KPIs
  header(pdf, ctx, 1, totalPaginas);
  pdf.setTextColor(...NEGRO);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Datos de la Simulación", 10, 32);

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
      ["Cliente", ctx.cliente || "—", "Banco", ctx.banco || "—"],
      ["Tipo de crédito", ctx.producto || "—", "Modalidad", ctx.modo.toUpperCase()],
      [
        ctx.modo === "uvr" ? "Valor crédito (UVR)" : "Valor crédito",
        ctx.modo === "uvr" ? formatInt(ctx.valor) + " UVR" : formatCOP(ctx.valor),
        "Tasa EA",
        `${ctx.tea.toFixed(2)}%`,
      ],
      [
        "Plazo original",
        `${formatInt(ctx.plazo)} meses`,
        "Seguros mensuales",
        formatCOP(ctx.seguros),
      ],
      [
        "Beneficio Fresh",
        ctx.fresh.activo
          ? `${formatCOP(ctx.fresh.valorMensual)} · ${formatInt(ctx.fresh.cuotasPendientes)} cuotas`
          : "No aplica",
        "Fecha generación",
        ctx.fechaGeneracion.toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      ],
    ],
  });

  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text("Impacto de los Abonos", 10, y);
  y += 4;

  pdf.setTextColor(...AZUL);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text("ESCENARIO BASE (sin abonos)", 10, y + 4);
  kpiBox(pdf, 10, y + 6, 45, 16, "Cuotas", formatInt(ctx.base.cuotasUsadas), AZUL);
  kpiBox(pdf, 58, y + 6, 45, 16, "Cuota base", formatCOP(ctx.base.cuotaFinal), AZUL);
  kpiBox(pdf, 106, y + 6, 45, 16, "Intereses tot.", formatCOP(ctx.base.totalInteres), AZUL);
  kpiBox(pdf, 154, y + 6, 46, 16, "Fecha final", ctx.base.fechaFin, AZUL);

  pdf.setTextColor(...VERDE);
  pdf.text("ESCENARIO CON ABONOS NUVIA", 10, y + 28);
  kpiBox(pdf, 10, y + 30, 45, 16, "Cuotas", formatInt(ctx.optimizado.cuotasUsadas), VERDE);
  kpiBox(pdf, 58, y + 30, 45, 16, "Cuota final", formatCOP(ctx.optimizado.cuotaFinal), VERDE);
  kpiBox(
    pdf,
    106,
    y + 30,
    45,
    16,
    "Intereses tot.",
    formatCOP(ctx.optimizado.totalInteres),
    VERDE,
  );
  kpiBox(pdf, 154, y + 30, 46, 16, "Fecha final", ctx.optimizado.fechaFin, VERDE);

  y += 52;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Ahorro Estimado", 10, y);
  kpiBox(pdf, 10, y + 3, 60, 20, "Ahorro en intereses", formatCOP(ctx.ahorroInteresCOP), VERDE);
  kpiBox(
    pdf,
    75,
    y + 3,
    60,
    20,
    "Cuotas eliminadas",
    ctx.cuotasAhorradas > 0 ? `-${ctx.cuotasAhorradas}` : "0",
    VERDE,
  );
  kpiBox(
    pdf,
    140,
    y + 3,
    60,
    20,
    "Años de vida menos",
    (ctx.cuotasAhorradas / 12).toFixed(1),
    VERDE,
  );

  y += 30;

  if (ctx.abonos.length > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.text("Abonos Programados", 10, y);
    autoTable(pdf, {
      startY: y + 3,
      head: [["#", "Cuota", "Monto", "Destino"]],
      headStyles: { fillColor: NEGRO, textColor: 255, fontSize: 9 },
      styles: { fontSize: 8.5, cellPadding: 2 },
      body: ctx.abonos.map((a, i) => [
        String(i + 1),
        formatInt(a.cuota),
        ctx.modo === "uvr" ? `${formatInt(a.monto)} UVR` : formatCOP(a.monto),
        a.destino === "plazo" ? "Reducir plazo" : "Reducir cuota",
      ]),
    });
  }
  footer(pdf);

  // ============ PAGE 2 — Tabla base
  pdf.addPage();
  header(pdf, ctx, 2, totalPaginas);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Proyección Base (sin abonos)", 10, 32);
  autoTable(pdf, {
    startY: 36,
    head: [["#", "Saldo ini.", "Capital", "Interés", "Seguros", "Fresh", "Cuota pag.", "Saldo fin."]],
    headStyles: { fillColor: AZUL, textColor: 255, fontSize: 7.8 },
    styles: { fontSize: 7, cellPadding: 1.2 },
    body: ctx.base.rows.map((r) => [
      r.periodo,
      formatCOP(r.saldoInicialCOP ?? r.saldoInicial),
      formatCOP(r.capital * (r.saldoInicialCOP && r.saldoInicial ? r.saldoInicialCOP / r.saldoInicial : 1)),
      formatCOP(r.interes * (r.saldoInicialCOP && r.saldoInicial ? r.saldoInicialCOP / r.saldoInicial : 1)),
      formatCOP(r.seguros),
      formatCOP(r.fresh),
      formatCOP(r.cuotaPagada),
      formatCOP(r.saldoFinalCOP ?? r.saldoFinal),
    ]),
  });
  footer(pdf);

  // ============ PAGE 3 — Tabla con abonos
  pdf.addPage();
  header(pdf, ctx, 3, totalPaginas);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Proyección con Abonos NUVIA", 10, 32);

  // Detectar si hay reducción de cuota (destino=cuota)
  const hayReduccionCuota = ctx.abonos.some((a) => a.destino === "cuota");
  const cuotaInicial = ctx.optimizado.rows[0]?.cuota ?? 0;
  const cuotaFinalBase =
    ctx.optimizado.rows[ctx.optimizado.rows.length - 1]?.cuota ?? cuotaInicial;
  const uvrRatio = (r: AbonoRow) =>
    r.saldoInicialCOP && r.saldoInicial ? r.saldoInicialCOP / r.saldoInicial : 1;

  if (hayReduccionCuota) {
    pdf.setFillColor(240, 248, 240);
    pdf.setDrawColor(...VERDE);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(10, 36, 190, 12, 2, 2, "FD");
    pdf.setTextColor(...NEGRO);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("Estrategia: Reducir cuota", 13, 41);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    const cuotaIniCOP =
      ctx.modo === "uvr" ? cuotaInicial * (ctx.optimizado.rows[0] ? uvrRatio(ctx.optimizado.rows[0]) : 1) : cuotaInicial;
    const cuotaFinCOP =
      ctx.modo === "uvr"
        ? cuotaFinalBase * (ctx.optimizado.rows[ctx.optimizado.rows.length - 1] ? uvrRatio(ctx.optimizado.rows[ctx.optimizado.rows.length - 1]) : 1)
        : cuotaFinalBase;
    pdf.text(
      `Cuota base inicial: ${formatCOP(cuotaIniCOP)}   →   Cuota base final: ${formatCOP(cuotaFinCOP)}   (delta: ${formatCOP(cuotaFinCOP - cuotaIniCOP)})`,
      13,
      46,
    );
  }

  autoTable(pdf, {
    startY: hayReduccionCuota ? 52 : 36,
    head: [["#", "Saldo ini.", "Cuota base", "Capital", "Interés", "Seguros", "Fresh", "Abono", "Cuota pag.", "Saldo fin."]],
    headStyles: { fillColor: VERDE, textColor: 255, fontSize: 7.5 },
    styles: { fontSize: 6.8, cellPadding: 1.1 },
    body: ctx.optimizado.rows.map((r, idx) => {
      const ratio = uvrRatio(r);
      const cuotaBaseCOP = ctx.modo === "uvr" ? r.cuota * ratio : r.cuota;
      const prev = ctx.optimizado.rows[idx - 1];
      const prevCuota = prev ? (ctx.modo === "uvr" ? prev.cuota * uvrRatio(prev) : prev.cuota) : cuotaBaseCOP;
      const cambio = Math.abs(cuotaBaseCOP - prevCuota) > 1;
      return [
        r.periodo,
        formatCOP(r.saldoInicialCOP ?? r.saldoInicial),
        cambio ? `${formatCOP(cuotaBaseCOP)} ↓` : formatCOP(cuotaBaseCOP),
        formatCOP(r.capital * ratio),
        formatCOP(r.interes * ratio),
        formatCOP(r.seguros),
        formatCOP(r.fresh),
        r.abono > 0 ? `+ ${formatCOP(r.abonoCOP ?? r.abono)}` : "—",
        formatCOP(r.cuotaPagada),
        formatCOP(r.saldoFinalCOP ?? r.saldoFinal),
      ];
    }),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const txt = String(data.cell.raw ?? "");
        if (txt.includes("↓")) {
          data.cell.styles.textColor = VERDE;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  footer(pdf);

  const name = `Abonos_${sanitizeFileName(ctx.cliente || "simulacion")}.pdf`;
  pdf.save(name);
}

export function exportAbonosExcel(ctx: AbonosExportCtx) {
  const cols = ["Cuota", "Saldo inicial", "Capital", "Interés", "Seguros", "Fresh", "Abono", "Cuota pagada", "Saldo final"];
  const toRows = (rows: AbonoRow[]) =>
    rows.map((r) => ({
      Cuota: r.periodo,
      "Saldo inicial": Math.round(r.saldoInicialCOP ?? r.saldoInicial),
      Capital: Math.round(r.capital),
      "Interés": Math.round(r.interes),
      Seguros: Math.round(r.seguros),
      Fresh: Math.round(r.fresh),
      Abono: Math.round(r.abonoCOP ?? r.abono),
      "Cuota pagada": Math.round(r.cuotaPagada),
      "Saldo final": Math.round(r.saldoFinalCOP ?? r.saldoFinal),
    }));
  const wb = XLSX.utils.book_new();
  const wsInfo = XLSX.utils.json_to_sheet([
    { Campo: "Cliente", Valor: ctx.cliente },
    { Campo: "Banco", Valor: ctx.banco },
    { Campo: "Tipo de crédito", Valor: ctx.producto },
    { Campo: "Modalidad", Valor: ctx.modo.toUpperCase() },
    { Campo: "Valor crédito", Valor: ctx.valor },
    { Campo: "Tasa EA (%)", Valor: ctx.tea },
    { Campo: "Plazo (meses)", Valor: ctx.plazo },
    { Campo: "Seguros mensuales", Valor: ctx.seguros },
    { Campo: "Fresh activo", Valor: ctx.fresh.activo ? "Sí" : "No" },
    { Campo: "Fresh valor mensual", Valor: ctx.fresh.valorMensual },
    { Campo: "Fresh cuotas pendientes", Valor: ctx.fresh.cuotasPendientes },
    { Campo: "Ahorro intereses", Valor: ctx.ahorroInteresCOP },
    { Campo: "Cuotas eliminadas", Valor: ctx.cuotasAhorradas },
  ]);
  XLSX.utils.book_append_sheet(wb, wsInfo, "Datos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(ctx.base.rows), { header: cols }), "Base");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(toRows(ctx.optimizado.rows), { header: cols }),
    "Con Abonos",
  );
  XLSX.writeFile(wb, `Abonos_${sanitizeFileName(ctx.cliente || "simulacion")}.xlsx`);
}
