import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { formatCOP, formatInt } from "./format";
import { sanitizeFileName } from "./pdfExport";

const AZUL: [number, number, number] = [68, 93, 163];
const VERDE: [number, number, number] = [132, 185, 143];
const NEGRO: [number, number, number] = [36, 36, 36];
const GRIS_BG: [number, number, number] = [248, 250, 252];

// Helvetica (font por defecto de jsPDF) no incluye flechas Unicode ↓ →.
// Usamos glifos ASCII seguros.
const ARROW_DOWN = "v";
const ARROW_RIGHT = "->";

export interface AbonoRow {
  periodo: number;
  saldoInicial: number;
  cuota: number;
  interes: number;
  capital: number;
  seguros: number;
  fresh: number;
  cuotaPagada: number;
  abono: number;
  abonoMensual?: number;
  abonoMensualCOP?: number;
  saldoFinal: number;
  cuotaCOP?: number;
  saldoInicialCOP?: number;
  saldoFinalCOP?: number;
  abonoCOP?: number;
}

export interface EstrategiaResumen {
  cuotasUsadas: number;
  cuotaFinal: number; // en COP (cuota base amortización)
  totalInteres: number; // en COP
  fechaFin: string;
  ahorroInteres: number; // vs base
  cuotasEliminadas: number;
  extraMensualProm?: number; // solo distribuido: extra promedio agregado al mes
}

export type EstrategiaKey = "plazo" | "cuota" | "distribuido";

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
  abonos: Array<{ cuota: number; monto: number; destino: EstrategiaKey }>;
  ahorroInteresCOP: number;
  cuotasAhorradas: number;

  // Comparativo — siempre presente cuando hay abonos (3 estrategias)
  comparador?: {
    plazo: EstrategiaResumen;
    cuota: EstrategiaResumen;
    distribuido: EstrategiaResumen;
    totalAbono: number;
    recomendado: EstrategiaKey;
  };
}


function drawHeader(pdf: jsPDF, ctx: AbonosExportCtx) {
  pdf.setFillColor(...NEGRO);
  pdf.rect(0, 0, 210, 22, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("NUVIA | Extra Payments Simulator", 10, 9);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    `${ctx.cliente || "Sin cliente"}  ·  ${ctx.banco || "—"}  ·  ${ctx.producto || "—"}`,
    10,
    15,
  );
  pdf.setDrawColor(...VERDE);
  pdf.setLineWidth(0.4);
  pdf.line(0, 22, 210, 22);
}

function drawFooter(pdf: jsPDF) {
  pdf.setDrawColor(220, 220, 220);
  pdf.setLineWidth(0.2);
  pdf.line(10, 287, 200, 287);
  pdf.setFontSize(7.5);
  pdf.setTextColor(120, 120, 120);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    "NUVIA Finanzas Inteligentes  ·  Simulación de abonos extraordinarios a capital. Cifras informativas.",
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
  pdf.setFillColor(...GRIS_BG);
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

/**
 * Envuelve texto respetando ancho máximo y devuelve altura consumida.
 */
function drawParagraph(
  pdf: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize = 9,
  color: [number, number, number] = NEGRO,
) {
  pdf.setTextColor(...color);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fontSize);
  const lines = pdf.splitTextToSize(text, maxWidth) as string[];
  pdf.text(lines, x, y);
  return lines.length * fontSize * 0.45;
}

export function exportAbonosPDF(ctx: AbonosExportCtx) {
  const pdf = new jsPDF("p", "mm", "a4");

  // callback para autoTable: dibuja header/footer al inicio de cada página nueva
  const withHeader = () => ({
    didDrawPage: () => {
      drawHeader(pdf, ctx);
      drawFooter(pdf);
    },
    margin: { top: 28, bottom: 15, left: 10, right: 10 },
  });

  /* ==================== PÁGINA 1 — Datos + KPIs ==================== */
  drawHeader(pdf, ctx);
  drawFooter(pdf);

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
          ? `${formatCOP(ctx.fresh.valorMensual)}  ·  ${formatInt(ctx.fresh.cuotasPendientes)} cuotas`
          : "No aplica",
        "Fecha generación",
        ctx.fechaGeneracion.toLocaleDateString("es-CO", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      ],
    ],
    ...withHeader(),
  });

  let y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
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
  kpiBox(pdf, 106, y + 30, 45, 16, "Intereses tot.", formatCOP(ctx.optimizado.totalInteres), VERDE);
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
    pdf.setTextColor(...NEGRO);
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
      ...withHeader(),
    });
  }

  /* ==================== PÁGINA 2 — Comparativo de Estrategias (3 escenarios) ==================== */
  if (ctx.comparador && ctx.abonos.length > 0) {
    pdf.addPage();
    drawHeader(pdf, ctx);
    drawFooter(pdf);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(...NEGRO);
    pdf.text("Comparativo de Estrategias NUVIA", 10, 32);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(110, 110, 120);
    pdf.text(
      `Los mismos abonos (total ${formatCOP(ctx.comparador.totalAbono)}) aplicados con 3 objetivos financieros distintos.`,
      10,
      38,
    );

    const rec = ctx.comparador.recomendado;
    const cardW = 62;
    const cardH = 90;
    const yCard = 44;
    const gap = 2;

    type CardData = {
      key: EstrategiaKey;
      tag: string;
      title: string;
      subtitle: string;
      accent: [number, number, number];
      resumen: EstrategiaResumen;
    };
    const cards: CardData[] = [
      { key: "plazo", tag: "ESTRATEGIA A", title: "Reducir plazo", subtitle: "Mantiene la cuota, acorta el credito.", accent: AZUL, resumen: ctx.comparador.plazo },
      { key: "cuota", tag: "ESTRATEGIA B", title: "Reducir cuota", subtitle: "Mantiene el plazo, baja la mensualidad.", accent: VERDE, resumen: ctx.comparador.cuota },
      { key: "distribuido", tag: "ESTRATEGIA C", title: "Distribuir mensual", subtitle: "Sin desembolso: sube la cuota, acorta el plazo.", accent: [224, 164, 88], resumen: ctx.comparador.distribuido },
    ];

    cards.forEach((c, idx) => {
      const x = 10 + idx * (cardW + gap);
      pdf.setFillColor(...GRIS_BG);
      pdf.roundedRect(x, yCard, cardW, cardH, 3, 3, "F");
      if (rec === c.key) {
        pdf.setDrawColor(...VERDE);
        pdf.setLineWidth(0.9);
        pdf.roundedRect(x, yCard, cardW, cardH, 3, 3, "S");
        pdf.setFillColor(...VERDE);
        pdf.roundedRect(x, yCard - 3, cardW, 6, 1, 1, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text("RECOMENDADO NUVIA", x + cardW / 2, yCard + 1, { align: "center" });
      }
      pdf.setTextColor(...c.accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.text(c.tag, x + 4, yCard + 8);
      pdf.setTextColor(...NEGRO);
      pdf.setFontSize(11);
      pdf.text(c.title, x + 4, yCard + 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(110, 110, 120);
      const subLines = pdf.splitTextToSize(c.subtitle, cardW - 8) as string[];
      pdf.text(subLines, x + 4, yCard + 19);

      const rows: Array<[string, string]> = [
        ["Ahorro en intereses", formatCOP(c.resumen.ahorroInteres)],
        ["Cuotas eliminadas", `${c.resumen.cuotasEliminadas}`],
        [
          c.key === "distribuido" ? "Aumento mensual" : "Nueva cuota base",
          c.key === "distribuido"
            ? `+ ${formatCOP(c.resumen.extraMensualProm ?? 0)}`
            : formatCOP(c.resumen.cuotaFinal),
        ],
        ["Fin del credito", c.resumen.fechaFin],
      ];
      rows.forEach((r, i) => {
        const yy = yCard + 32 + i * 13;
        pdf.setFontSize(6.8);
        pdf.setTextColor(120, 120, 130);
        pdf.setFont("helvetica", "normal");
        pdf.text(r[0].toUpperCase(), x + 4, yy);
        pdf.setTextColor(...NEGRO);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(r[1], x + 4, yy + 5);
      });
    });

    // ------- Recomendación argumentada -------
    const yRec = yCard + cardH + 8;
    pdf.setFillColor(240, 248, 240);
    pdf.setDrawColor(...VERDE);
    pdf.setLineWidth(0.4);
    pdf.roundedRect(10, yRec, 190, 74, 3, 3, "FD");

    pdf.setFillColor(...VERDE);
    pdf.roundedRect(10, yRec, 4, 74, 0, 0, "F");

    pdf.setTextColor(...VERDE);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("RECOMENDACION NUVIA", 18, yRec + 6);

    const titRec =
      rec === "plazo"
        ? "Aplicar los abonos a REDUCIR PLAZO"
        : rec === "cuota"
        ? "Aplicar los abonos a REDUCIR CUOTA"
        : "DISTRIBUIR el abono en el plazo restante";
    pdf.setTextColor(...NEGRO);
    pdf.setFontSize(13);
    pdf.text(titRec, 18, yRec + 13);

    const opciones = [
      { key: "plazo" as EstrategiaKey, r: ctx.comparador.plazo },
      { key: "cuota" as EstrategiaKey, r: ctx.comparador.cuota },
      { key: "distribuido" as EstrategiaKey, r: ctx.comparador.distribuido },
    ].sort((a, b) => b.r.ahorroInteres - a.r.ahorroInteres);
    const gan = opciones[0].r;
    const seg = opciones[1].r;
    const diferencia = Math.max(0, gan.ahorroInteres - seg.ahorroInteres);

    let argumento = "";
    if (rec === "plazo") {
      argumento =
        `Reducir plazo maximiza el ahorro: ${formatCOP(gan.ahorroInteres)} en intereses y ${gan.cuotasEliminadas} cuotas eliminadas ` +
        `(${(gan.cuotasEliminadas / 12).toFixed(1)} anos menos), finalizando en ${gan.fechaFin}. Frente a la 2da mejor opcion ` +
        `gana ${formatCOP(diferencia)} adicionales sin subir la cuota mensual. Ideal si el cliente ya tiene los ` +
        `${formatCOP(ctx.comparador.totalAbono)} disponibles y quiere liberarse del credito lo antes posible.`;
    } else if (rec === "cuota") {
      const cuotaBaseCOP = ctx.base.cuotaFinal;
      const alivio = cuotaBaseCOP - gan.cuotaFinal;
      argumento =
        `Reducir cuota ofrece el mejor balance: baja la mensualidad de ${formatCOP(cuotaBaseCOP)} a ${formatCOP(gan.cuotaFinal)} ` +
        `(alivio mensual de ${formatCOP(alivio)}) y aun asi genera ${formatCOP(gan.ahorroInteres)} de ahorro en intereses. ` +
        `Ideal cuando se prioriza liberar flujo de caja mensual sin renunciar al ahorro financiero.`;
    } else {
      argumento =
        `Distribuir mensual es la mejor opcion cuando el cliente NO tiene los ${formatCOP(ctx.comparador.totalAbono)} liquidos ` +
        `pero si puede sumar aproximadamente ${formatCOP(ctx.comparador.distribuido.extraMensualProm ?? 0)} extra cada mes a su cuota. ` +
        `Ahorra ${formatCOP(gan.ahorroInteres)} en intereses y elimina ${gan.cuotasEliminadas} cuotas, sin necesidad de un desembolso grande.`;
    }
    drawParagraph(pdf, argumento, 18, yRec + 20, 178, 9, NEGRO);

    // Nota complementaria: resumen de las otras 2 opciones
    pdf.setTextColor(110, 110, 120);
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    const nombreDe = (k: EstrategiaKey) =>
      k === "plazo" ? "Reducir plazo" : k === "cuota" ? "Reducir cuota" : "Distribuir mensual";
    const notas = opciones
      .slice(1)
      .map((o) => `${nombreDe(o.key)}: ${formatCOP(o.r.ahorroInteres)} de ahorro / ${o.r.cuotasEliminadas} cuotas eliminadas`)
      .join("   ·   ");
    drawParagraph(pdf, `Alternativas — ${notas}`, 18, yRec + 62, 178, 8, [110, 110, 120]);
  }


  /* ==================== PÁGINA — Proyección Base ==================== */
  pdf.addPage();
  drawHeader(pdf, ctx);
  drawFooter(pdf);
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
    ...withHeader(),
  });

  /* ==================== PÁGINA — Proyección con Abonos ==================== */
  pdf.addPage();
  drawHeader(pdf, ctx);
  drawFooter(pdf);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(...NEGRO);
  pdf.text("Proyección con Abonos NUVIA", 10, 32);

  const hayReduccionCuota = ctx.abonos.some((a) => a.destino === "cuota");
  const cuotaInicial = ctx.optimizado.rows[0]?.cuota ?? 0;
  const cuotaFinalBase =
    ctx.optimizado.rows[ctx.optimizado.rows.length - 1]?.cuota ?? cuotaInicial;
  const uvrRatio = (r: AbonoRow) =>
    r.saldoInicialCOP && r.saldoInicial ? r.saldoInicialCOP / r.saldoInicial : 1;

  let startTabla = 36;
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
      ctx.modo === "uvr"
        ? cuotaInicial * (ctx.optimizado.rows[0] ? uvrRatio(ctx.optimizado.rows[0]) : 1)
        : cuotaInicial;
    const cuotaFinCOP =
      ctx.modo === "uvr"
        ? cuotaFinalBase *
          (ctx.optimizado.rows[ctx.optimizado.rows.length - 1]
            ? uvrRatio(ctx.optimizado.rows[ctx.optimizado.rows.length - 1])
            : 1)
        : cuotaFinalBase;
    pdf.text(
      `Cuota base inicial: ${formatCOP(cuotaIniCOP)}   ${ARROW_RIGHT}   Cuota base final: ${formatCOP(cuotaFinCOP)}   (delta: ${formatCOP(cuotaFinCOP - cuotaIniCOP)})`,
      13,
      46,
    );
    startTabla = 52;
  }

  autoTable(pdf, {
    startY: startTabla,
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
        cambio ? `${formatCOP(cuotaBaseCOP)} ${ARROW_DOWN}` : formatCOP(cuotaBaseCOP),
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
        if (txt.includes(ARROW_DOWN)) {
          data.cell.styles.textColor = VERDE;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
    ...withHeader(),
  });

  /* ==================== Numeración final "Página X / Y" ==================== */
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`Página ${i} / ${total}`, 200, 15, { align: "right" });
  }

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

  if (ctx.comparador) {
    const wsComp = XLSX.utils.json_to_sheet([
      {
        Estrategia: "Reducir plazo",
        "Ahorro intereses": ctx.comparador.plazo.ahorroInteres,
        "Cuotas eliminadas": ctx.comparador.plazo.cuotasEliminadas,
        "Cuota final": ctx.comparador.plazo.cuotaFinal,
        "Aumento mensual": 0,
        "Fin del crédito": ctx.comparador.plazo.fechaFin,
        Recomendado: ctx.comparador.recomendado === "plazo" ? "Sí" : "No",
      },
      {
        Estrategia: "Reducir cuota",
        "Ahorro intereses": ctx.comparador.cuota.ahorroInteres,
        "Cuotas eliminadas": ctx.comparador.cuota.cuotasEliminadas,
        "Cuota final": ctx.comparador.cuota.cuotaFinal,
        "Aumento mensual": 0,
        "Fin del crédito": ctx.comparador.cuota.fechaFin,
        Recomendado: ctx.comparador.recomendado === "cuota" ? "Sí" : "No",
      },
      {
        Estrategia: "Distribuir mensual",
        "Ahorro intereses": ctx.comparador.distribuido.ahorroInteres,
        "Cuotas eliminadas": ctx.comparador.distribuido.cuotasEliminadas,
        "Cuota final": ctx.comparador.distribuido.cuotaFinal,
        "Aumento mensual": ctx.comparador.distribuido.extraMensualProm ?? 0,
        "Fin del crédito": ctx.comparador.distribuido.fechaFin,
        Recomendado: ctx.comparador.recomendado === "distribuido" ? "Sí" : "No",
      },
    ]);
    XLSX.utils.book_append_sheet(wb, wsComp, "Comparativo");
  }


  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toRows(ctx.base.rows), { header: cols }), "Base");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(toRows(ctx.optimizado.rows), { header: cols }),
    "Con Abonos",
  );
  XLSX.writeFile(wb, `Abonos_${sanitizeFileName(ctx.cliente || "simulacion")}.xlsx`);
}
