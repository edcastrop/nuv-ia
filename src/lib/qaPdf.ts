import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AmortRow = { k: number; cuota: number; interes: number; capital: number; saldo: number; correccionUvr?: number; saldoUvr?: number; valorUvr?: number };
type Penalizacion = { tipo: string; valor: number };
type Inconsistencia = {
  tipo: string; severidad: string; campo: string | null;
  valor_extracto: number | null; valor_calculado: number | null; diferencia: number | null;
  mensaje: string; sugerencia: string | null;
};

const dictamenLabel: Record<string, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};

const penLabel: Record<string, string> = {
  inconsistencias_info: "Inconsistencias informativas",
  inconsistencias_warning: "Inconsistencias de advertencia",
  inconsistencias_critica: "Inconsistencias críticas",
  diff_cuota: "Diferencia en cuota",
  diff_simulacion: "Diferencia con simulación del analista",
  campos_faltantes: "Campos faltantes en captura",
};

const fmt = (n: number | null | undefined, d = 0) =>
  n == null || Number.isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

export type DictamenPdfData = {
  auditoriaId: string;
  modalidad: string;
  motorVersion: string;
  ejecutadoAt: string;
  qaScore: number;
  categoria: string;
  dictamen: string;
  outputs: Record<string, unknown>;
  inputs: {
    reconstruccion?: Record<string, unknown>;
    extracto?: Record<string, unknown>;
    simulacion?: Record<string, unknown>;
  };
  penalizaciones: Penalizacion[];
  inconsistencias: Inconsistencia[];
};

export function exportarDictamenPDF(d: DictamenPdfData) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  // Encabezado
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("NUVIA Financial QA AI", 48, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  y += 16; doc.text("Dictamen de auditoría matemática", 48, y);
  y += 14;
  doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`ID auditoría: ${d.auditoriaId}`, 48, y);
  doc.text(`Motor: v${d.motorVersion}`, W - 48, y, { align: "right" });
  y += 12;
  doc.text(`Modalidad: ${d.modalidad}`, 48, y);
  doc.text(`Ejecutada: ${new Date(d.ejecutadoAt).toLocaleString("es-CO")}`, W - 48, y, { align: "right" });
  y += 18;

  // Dictamen + Score
  doc.setDrawColor(220); doc.line(48, y, W - 48, y); y += 18;
  doc.setTextColor(0); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text(`Dictamen: ${dictamenLabel[d.dictamen] ?? d.dictamen}`, 48, y);
  doc.setFontSize(11);
  doc.text(`QA Score: ${d.qaScore.toFixed(1)} / 100  ·  Categoría: ${d.categoria}`, 48, y + 16);
  y += 36;

  // Penalizaciones
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Penalizaciones aplicadas", 48, y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [["Concepto", "Puntos restados"]],
    body: d.penalizaciones.length
      ? d.penalizaciones.map((p) => [penLabel[p.tipo] ?? p.tipo, `-${p.valor.toFixed(1)}`])
      : [["Sin penalizaciones", "0.0"]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: 48, right: 48 },
  });
  // @ts-expect-error autotable adds lastAutoTable
  y = doc.lastAutoTable.finalY + 18;

  // Alertas críticas
  const criticas = d.inconsistencias.filter((i) => i.severidad === "critica");
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Alertas críticas (${criticas.length})`, 48, y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [["Tipo", "Mensaje", "Sugerencia"]],
    body: criticas.length
      ? criticas.map((i) => [i.tipo, i.mensaje, i.sugerencia ?? "—"])
      : [["—", "Sin alertas críticas", "—"]],
    styles: { fontSize: 9, cellWidth: "wrap" },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 240 }, 2: { cellWidth: 180 } },
    headStyles: { fillColor: [127, 29, 29], textColor: 255 },
    margin: { left: 48, right: 48 },
  });
  // @ts-expect-error autotable
  y = doc.lastAutoTable.finalY + 18;

  // Comparación Extracto vs Calculado
  const ext = (d.inputs.extracto ?? {}) as Record<string, unknown>;
  const rec = (d.inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const o = d.outputs;
  const isUvr = d.modalidad === "uvr";
  const hasFrech = Number(rec.coberturaFrechPp ?? 0) > 0 || Number(rec.coberturaFrechValorMensual ?? 0) > 0;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Extracto bancario vs Reconstrucción NUVIA", 48, y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [["Campo", "Extracto", "Calculado NUVIA", "Δ"]],
    body: [
      ["Saldo capital",
        `$${fmt(ext.saldoCapital as number, 0)}`,
        `$${fmt(rec.saldoCapital as number, 0)}`,
        fmt(Number(rec.saldoCapital ?? 0) - Number(ext.saldoCapital ?? 0), 0)],
      ["Tasa EA",
        `${fmt(Number(ext.tasaEa ?? 0), 4)}%`,
        `${fmt(Number(rec.tasaEa ?? 0), 4)}%`,
        fmt(Number(rec.tasaEa ?? 0) - Number(ext.tasaEa ?? 0), 4)],
      ["Cuota mensual",
        `$${fmt(ext.cuota as number, 0)}`,
        `$${fmt(o.cuotaTotalConSeguros as number, 0)}`,
        fmt(Number(o.cuotaTotalConSeguros ?? 0) - Number(ext.cuota ?? 0), 0)],
      ["Seguros",
        `$${fmt(ext.seguros as number, 0)}`,
        `$${fmt(rec.seguros as number, 0)}`,
        fmt(Number(rec.seguros ?? 0) - Number(ext.seguros ?? 0), 0)],
      ...(hasFrech ? [["Cobertura FRECH (pp)",
        fmt(Number(ext.coberturaFrechPp ?? 0), 4),
        fmt(Number(rec.coberturaFrechPp ?? 0), 4),
        fmt(Number(rec.coberturaFrechPp ?? 0) - Number(ext.coberturaFrechPp ?? 0), 4)] as string[]] : []),
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: 48, right: 48 },
  });
  // @ts-expect-error autotable
  y = doc.lastAutoTable.finalY + 18;

  // Simulación analista vs motor NUVIA
  const sim = (d.inputs.simulacion ?? {}) as Record<string, unknown>;
  if (Object.keys(sim).length) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Simulación del analista vs Motor NUVIA", 48, y); y += 4;
    autoTable(doc, {
      startY: y + 4,
      head: [["Campo", "Analista", "NUVIA (calculado)"]],
      body: [
        ["Cuotas eliminadas", fmt(sim.cuotasEliminadas as number, 0), "(recalculado por motor)"],
        ["Ahorro proyectado", `$${fmt(sim.ahorroProyectado as number, 0)}`, "(recalculado por motor)"],
        ["Nuevo plazo (meses)", fmt(sim.nuevoPlazo as number, 0), "—"],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      margin: { left: 48, right: 48 },
    });
    // @ts-expect-error autotable
    y = doc.lastAutoTable.finalY + 18;
  }

  // Fórmulas aplicadas
  if (y > 600) { doc.addPage(); y = 48; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Fórmulas aplicadas por el motor", 48, y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [["Concepto", "Fórmula"]],
    body: [
      ...(isUvr ? [
        ["Tasa mensual cobrada", "i = (1 + TE_Cobrada)^(1/12) - 1"],
        ["Variación mensual UVR", "v = (1 + Variacion_UVR_EA)^(1/12) - 1"],
        ["Cuota financiera UVR", "C_uvr = PMT(TE_Cobrada_mes, cuotas_pendientes, saldo_uvr)"],
        ["Interés UVR", "I_uvr,k = Saldo_uvr,k-1 * i"],
        ["Capital UVR", "K_uvr,k = C_uvr - I_uvr,k"],
        ["Saldo COP", "Saldo_COP,k = (Saldo_uvr,k-1 - K_uvr,k) * Valor_UVR_k"],
        ["Corrección UVR", "Correccion_k = Saldo_uvr,k-1 * (Valor_UVR_k - Valor_UVR_k-1)"],
      ] : [
        ["Tasa mensual vencida", "i_mv = (1 + EA)^(1/12) - 1"],
        ["Cuota teórica (francés)", "C = S * i_mv / (1 - (1 + i_mv)^-n)"],
        ...(hasFrech ? [
          ["Cuota con FRECH", "i_sub = (1+(EA-cob))^(1/12)-1 ; C_sub = S*i_sub/(1-(1+i_sub)^-n)"],
          ["Beneficio mensual FRECH", "Beneficio = C - C_sub"],
          ["Cuota total mensual", "Cuota_total = C_sub + Seguros"],
        ] : [
          ["Cuota total mensual", "Cuota_total = C + Seguros"],
        ]),
        ["Interés cuota k", "I_k = Saldo_{k-1} * i_periodica"],
        ["Capital cuota k", "K_k = C - I_k"],
      ]),
      ["QA Score", "Score = 100 - Sum(penalizaciones)"],
    ] as string[][],
    styles: { fontSize: 9, font: "courier" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, font: "helvetica" },
    columnStyles: { 0: { cellWidth: 180, font: "helvetica" }, 1: { cellWidth: 330 } },
    margin: { left: 48, right: 48 },
  });
  // @ts-expect-error autotable
  y = doc.lastAutoTable.finalY + 18;

  // Plan de amortización completo (usa todasCuotas si está disponible).
  if (y > 580) { doc.addPage(); y = 48; }
  const todas = (o.todasCuotas as AmortRow[] | undefined) ?? [];
  const primeras = (o.primerasCuotas as AmortRow[]) ?? [];
  const ultimas = (o.ultimasCuotas as AmortRow[]) ?? [];
  const ks = new Set(primeras.map((f) => f.k));
  const filas = todas.length > 0
    ? todas
    : [...primeras, ...ultimas.filter((f) => !ks.has(f.k))];
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`Plan amortizado completo (${filas.length} cuotas)`, 48, y); y += 4;
  autoTable(doc, {
    startY: y + 4,
    head: [isUvr ? ["#", "Cuota", "Interés", "Capital", "Corrección", "Saldo COP", "Saldo UVR"] : ["#", "Cuota", "Interés", "Capital", "Saldo"]],
    body: filas.map((f) => isUvr
      ? [String(f.k), `$${fmt(f.cuota, 0)}`, `$${fmt(f.interes, 0)}`, `$${fmt(f.capital, 0)}`, `$${fmt(f.correccionUvr, 0)}`, `$${fmt(f.saldo, 0)}`, fmt(f.saldoUvr, 4)]
      : [String(f.k), `$${fmt(f.cuota, 0)}`, `$${fmt(f.interes, 0)}`, `$${fmt(f.capital, 0)}`, `$${fmt(f.saldo, 0)}`]),
    styles: { fontSize: 8, halign: "right" },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "right" },
    margin: { left: 48, right: 48 },
  });

  // Footer trazabilidad
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(140);
    const H = doc.internal.pageSize.getHeight();
    doc.text(
      `NUVIA QA AI · Motor v${d.motorVersion} · Auditoría ${d.auditoriaId} · Generado ${new Date().toLocaleString("es-CO")} · Página ${p}/${pageCount}`,
      W / 2, H - 24, { align: "center" },
    );
  }

  doc.save(`NUVIA_QA_${d.auditoriaId.slice(0, 8)}_${d.dictamen}.pdf`);
}
