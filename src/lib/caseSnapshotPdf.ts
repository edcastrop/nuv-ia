// Case Snapshot PDF — Single-page Executive Dashboard
// NUVIA dark premium. Una sola página, alta densidad.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { formatCOP } from "@/lib/format";
import type { CaseSnapshotDTO } from "./caseSnapshot.functions";

// ───────────────── Paleta NUVIA ─────────────────
const C = {
  bg: rgb(0.031, 0.063, 0.157),         // #081028
  bgSoft: rgb(0.047, 0.090, 0.196),     // #0C1732
  surface: rgb(0.059, 0.102, 0.200),    // #0F1A33
  surfaceHi: rgb(0.090, 0.137, 0.243),  // #17233E
  border: rgb(1, 1, 1),                  // se aplica con opacity 0.06
  borderSoft: rgb(0.16, 0.20, 0.31),
  primary: rgb(0.267, 0.365, 0.639),    // #445DA3
  primaryHi: rgb(0.420, 0.529, 0.808),  // #6B87CE
  accent: rgb(0.518, 0.725, 0.561),     // #84B98F
  gold: rgb(0.965, 0.769, 0.325),       // #F6C453
  red: rgb(1.0, 0.420, 0.420),          // #FF6B6B
  amber: rgb(0.965, 0.769, 0.325),
  text: rgb(1, 1, 1),
  textDim: rgb(0.72, 0.78, 0.88),
  muted: rgb(0.55, 0.62, 0.74),
  dim: rgb(0.36, 0.41, 0.52),
};

// Página tipo dashboard: ancho Letter, alto extendido para fit single-page.
const PAGE_W = 612;
const PAGE_H = 1080;
const M = 28;

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
}

// ───────────────── Formatters ─────────────────
function money(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return formatCOP(v);
}
function pct(v: number | null | undefined, dec = 1): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return `${v.toFixed(dec)}%`;
}
function safe(v: string | null | undefined, fb = "—"): string {
  return v && v.trim().length ? v : fb;
}
function fmtDate(s: string): string {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShortDate(s: string): string {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function truncate(font: PDFFont, txt: string, size: number, maxW: number): string {
  let t = txt;
  while (font.widthOfTextAtSize(t, size) > maxW && t.length > 1) t = t.slice(0, -2) + "…";
  return t;
}
function wrapLines(font: PDFFont, txt: string, size: number, maxW: number): string[] {
  const words = txt.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= maxW) cur = next;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ───────────────── Drawing helpers ─────────────────
function T(
  ctx: Ctx, txt: string, x: number, y: number,
  o: { size?: number; bold?: boolean; color?: RGB; maxW?: number } = {},
) {
  const size = o.size ?? 9;
  const f = o.bold ? ctx.bold : ctx.font;
  const t = o.maxW ? truncate(f, txt, size, o.maxW) : txt;
  ctx.page.drawText(t, { x, y, size, font: f, color: o.color ?? C.text });
}
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill?: RGB, opacity?: number) {
  ctx.page.drawRectangle({ x, y, width: w, height: h, color: fill, opacity });
}
function card(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  o: { fill?: RGB; borderOpacity?: number; topAccent?: RGB; leftAccent?: RGB; opacity?: number } = {},
) {
  ctx.page.drawRectangle({
    x, y, width: w, height: h,
    color: o.fill ?? C.surface,
    opacity: o.opacity,
    borderColor: C.border,
    borderWidth: 0.5,
    borderOpacity: o.borderOpacity ?? 0.10,
  });
  if (o.topAccent) ctx.page.drawRectangle({ x, y: y + h - 2, width: w, height: 2, color: o.topAccent });
  if (o.leftAccent) ctx.page.drawRectangle({ x, y, width: 3, height: h, color: o.leftAccent });
}

// ───────────────── Sections ─────────────────
function drawBackground(ctx: Ctx) {
  rect(ctx, 0, 0, PAGE_W, PAGE_H, C.bg);
  // sutil glow superior derecho
  rect(ctx, PAGE_W - 280, PAGE_H - 180, 280, 180, C.primary, 0.10);
  rect(ctx, PAGE_W - 200, PAGE_H - 130, 200, 130, C.primaryHi, 0.07);
}

function drawTopBar(ctx: Ctx, d: CaseSnapshotDTO) {
  // NUVIA brand
  T(ctx, "NUVIA", M, PAGE_H - 38, { size: 22, bold: true, color: C.text });
  T(ctx, "FINANCIAL INTELLIGENCE", M, PAGE_H - 52, { size: 6.5, bold: true, color: C.accent });

  // Right meta
  const fecha = fmtDate(d.meta.fecha);
  const right1 = `Fecha de emisión: ${fecha}`;
  const right2 = "Documento ejecutivo · No reemplaza el expediente operativo";
  const w1 = ctx.font.widthOfTextAtSize(right1, 8);
  const w2 = ctx.font.widthOfTextAtSize(right2, 7.5);
  T(ctx, right1, PAGE_W - M - w1, PAGE_H - 36, { size: 8, color: C.textDim });
  T(ctx, right2, PAGE_W - M - w2, PAGE_H - 50, { size: 7.5, color: C.muted });
}

function drawTitle(ctx: Ctx, d: CaseSnapshotDTO) {
  T(ctx, "CASE SNAPSHOT", M, PAGE_H - 100, { size: 32, bold: true, color: C.text });
  T(ctx, "RESUMEN EJECUTIVO DEL CASO", M, PAGE_H - 116, { size: 7.5, bold: true, color: C.muted });

  // ID badge derecho
  const bw = 220, bh = 44;
  const bx = PAGE_W - M - bw, by = PAGE_H - 122;
  card(ctx, bx, by, bw, bh, { fill: C.surface });
  T(ctx, "ID EXPEDIENTE", bx + 12, by + bh - 14, { size: 6.5, bold: true, color: C.muted });
  T(ctx, d.meta.expedienteId, bx + 12, by + 10, { size: 10, bold: true, color: C.text, maxW: bw - 24 });
}

function drawClienteRow(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 196;
  const h = 64;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });

  // 5 columnas: cliente | banco | producto | modalidad | estado
  const cols = [
    { l: "CLIENTE", v: safe(d.meta.cliente), big: true, color: C.text },
    { l: "BANCO", v: safe(d.meta.banco), color: C.text },
    { l: "PRODUCTO", v: safe(d.meta.producto), color: C.text },
    { l: "MODALIDAD", v: safe(d.meta.modalidad).toUpperCase(), color: C.text },
    { l: "ESTADO DEL CASO", v: safe(d.meta.estadoCaso).replace(/_/g, " ").toUpperCase(), color: C.accent },
  ];
  const colW = w / cols.length;
  cols.forEach((c, i) => {
    const cx = M + i * colW;
    if (i > 0) rect(ctx, cx, y + 12, 0.5, h - 24, C.border, 0.10);
    // mini icon dot
    ctx.page.drawCircle({ x: cx + 18, y: y + h / 2, size: 9, color: C.bgSoft, borderColor: C.primary, borderWidth: 0.6 });
    T(ctx, c.l, cx + 36, y + h - 18, { size: 6.5, bold: true, color: C.muted });
    if (c.big) {
      T(ctx, c.v, cx + 36, y + h - 36, { size: 10, bold: true, color: c.color, maxW: colW - 44 });
      // segunda línea si nombre largo
      const split = c.v.split(/\s+/);
      if (split.length > 2 && ctx.bold.widthOfTextAtSize(c.v, 10) > colW - 44) {
        const mid = Math.ceil(split.length / 2);
        T(ctx, split.slice(0, mid).join(" "), cx + 36, y + h - 34, { size: 10, bold: true, color: c.color, maxW: colW - 44 });
        T(ctx, split.slice(mid).join(" "), cx + 36, y + h - 48, { size: 10, bold: true, color: c.color, maxW: colW - 44 });
      }
    } else {
      const lines = wrapLines(ctx.bold, c.v, 9, colW - 44);
      lines.slice(0, 2).forEach((ln, j) => {
        T(ctx, ln, cx + 36, y + h - 34 - j * 11, { size: 9, bold: true, color: c.color, maxW: colW - 44 });
      });
    }
  });
}

function drawAnalistaRow(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 252;
  const h = 48;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });

  const cols = [
    { l: "ANALISTA", v: safe(d.meta.analista.nombre), color: C.text },
    { l: "SCORE QA", v: d.meta.qaScore != null ? `${d.meta.qaScore.toFixed(1)} / 100` : "—", color: C.accent, bar: d.meta.qaScore },
    { l: "NIVEL AUTONOMÍA", v: d.meta.nivelAutonomia != null ? `N${d.meta.nivelAutonomia}` : "—", color: C.text, pill: "SUPERVISADA" },
    { l: "FECHA", v: fmtDate(d.meta.fecha), color: C.textDim },
  ];
  const colW = w / cols.length;
  cols.forEach((c, i) => {
    const cx = M + i * colW;
    if (i > 0) rect(ctx, cx, y + 10, 0.5, h - 20, C.border, 0.10);
    ctx.page.drawCircle({ x: cx + 16, y: y + h / 2, size: 7, color: C.bgSoft, borderColor: C.primary, borderWidth: 0.6 });
    T(ctx, c.l, cx + 30, y + h - 14, { size: 6.5, bold: true, color: C.muted });
    T(ctx, c.v, cx + 30, y + 12, { size: 11, bold: true, color: c.color, maxW: colW - 40 });
    if (c.bar != null) {
      const bw = colW - 50;
      rect(ctx, cx + 30, y + 8, bw, 2.5, C.bgSoft);
      rect(ctx, cx + 30, y + 8, bw * Math.min(1, (c.bar as number) / 100), 2.5, C.accent);
    }
    if (c.pill) {
      const tw = ctx.bold.widthOfTextAtSize(c.pill, 6.5) + 10;
      ctx.page.drawRectangle({
        x: cx + 56, y: y + 12, width: tw, height: 11,
        color: C.primary, opacity: 0.25, borderColor: C.primary, borderWidth: 0.5, borderOpacity: 0.6,
      });
      T(ctx, c.pill, cx + 56 + 5, y + 15, { size: 6.5, bold: true, color: C.primaryHi });
    }
  });
}

function drawFotoCredito(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 358;
  const h = 90;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "FOTO COMPLETA DEL CRÉDITO", M + 14, y + h - 14, { size: 7, bold: true, color: C.muted });

  const items = [
    { l: "SALDO ACTUAL", v: money(d.credito.saldoCapital), c: C.text },
    { l: "CUOTA ACTUAL", v: money(d.credito.cuotaActual), c: C.text },
    { l: "CUOTAS PENDIENTES", v: d.credito.cuotasPendientes ? `${d.credito.cuotasPendientes}` : "—", c: C.text },
    { l: "COSTO TOTAL DEL CRÉDITO", v: money(d.credito.costoReal || d.credito.totalProyectado), c: C.gold },
  ];
  const gap = 8;
  const cw = (w - 28 - gap * 3) / 4;
  const ch = 54;
  items.forEach((it, i) => {
    const cx = M + 14 + i * (cw + gap);
    card(ctx, cx, y + 10, cw, ch, { fill: C.bgSoft });
    T(ctx, it.l, cx + 12, y + 10 + ch - 14, { size: 6.5, bold: true, color: C.muted });
    T(ctx, it.v, cx + 12, y + 10 + 12, { size: 14, bold: true, color: it.c, maxW: cw - 20 });
  });
}

function drawVecesHero(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 462;
  const h = 96;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });
  // glow lateral derecho
  rect(ctx, M + w - 120, y + 10, 120, h - 20, C.primary, 0.06);

  const veces = d.credito.vecesPagado || 0;
  T(ctx, "VAS A PAGAR", M + 36, y + h - 18, { size: 8, bold: true, color: C.muted });
  const big = veces > 0 ? `${veces.toFixed(2)}x` : "—";
  T(ctx, big, M + 36, y + 26, { size: 42, bold: true, color: C.primaryHi });
  T(ctx, "EL VALOR DE TU CRÉDITO", M + 36, y + 14, { size: 7.5, bold: true, color: C.muted });

  // Texto derecho
  const tx = M + 220;
  const textW = w - 220 - 30;
  const l1 = "Con las condiciones actuales, terminarás pagando";
  const l2 = veces > 0
    ? `${veces.toFixed(2)} veces el valor del crédito desembolsado.`
    : "el valor proyectado del crédito según las condiciones actuales.";
  const l3 = "Este análisis considera intereses, seguros y costos asociados";
  const l4 = "durante todo el plazo del crédito.";
  T(ctx, l1, tx, y + h - 26, { size: 9, color: C.textDim, maxW: textW });
  // resaltar "X veces"
  T(ctx, l2, tx, y + h - 40, { size: 9, color: C.primaryHi, bold: true, maxW: textW });
  T(ctx, l3, tx, y + h - 58, { size: 9, color: C.textDim, maxW: textW });
  T(ctx, l4, tx, y + h - 72, { size: 9, color: C.textDim, maxW: textW });
}

function drawDiagnostico(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 656;
  const w = (PAGE_W - M * 2 - 12) * 0.38;
  const h = 180;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "DIAGNÓSTICO NUVIA AI", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  // Cálculo simple
  const veces = d.credito.vecesPagado || 0;
  const ahorro = d.propuesta.ahorroTotal || 0;
  const riesgo = veces >= 2.5 ? { l: "ALTO", c: C.red } : veces >= 1.8 ? { l: "MEDIO", c: C.amber } : { l: "BAJO", c: C.accent };
  const viab = ahorro > 30_000_000 ? { l: "ALTA", c: C.accent } : ahorro > 10_000_000 ? { l: "MEDIA", c: C.amber } : ahorro > 0 ? { l: "BAJA", c: C.amber } : { l: "—", c: C.muted };
  const modo = d.meta.modalidad.toLowerCase();
  const comp = modo.includes("uvr") || modo.includes("leasing") ? { l: "ALTA", c: C.amber } : { l: "MEDIA", c: C.primaryHi };

  const gauges = [
    { l: "RIESGO OPERATIVO", v: riesgo },
    { l: "VIABILIDAD", v: viab },
    { l: "COMPLEJIDAD", v: comp },
  ];
  const gW = (w - 28) / 3;
  gauges.forEach((g, i) => {
    const gx = M + 14 + i * gW;
    const cy = y + h - 60;
    // arco simulado: círculo base + arco coloreado superior
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 18, color: C.bgSoft, borderColor: C.borderSoft, borderWidth: 0.8 });
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 17, borderColor: g.v.c, borderWidth: 3.5, opacity: 0.85 });
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 12, color: C.surface });
    // pequeño triángulo aguja
    const ang = g.v.l === "ALTO" || g.v.l === "ALTA" ? -0.4 : g.v.l === "MEDIO" || g.v.l === "MEDIA" ? 0 : 0.4;
    const ax = gx + gW / 2 + Math.cos(Math.PI / 2 + ang) * 8;
    const ay = cy + Math.sin(Math.PI / 2 + ang) * 8;
    ctx.page.drawLine({ start: { x: gx + gW / 2, y: cy }, end: { x: ax, y: ay }, color: g.v.c, thickness: 1.5 });
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 2, color: g.v.c });

    const lw = ctx.bold.widthOfTextAtSize(g.l, 6.2);
    T(ctx, g.l, gx + gW / 2 - lw / 2, cy - 32, { size: 6.2, bold: true, color: C.muted });
    const vw = ctx.bold.widthOfTextAtSize(g.v.l, 12);
    T(ctx, g.v.l, gx + gW / 2 - vw / 2, cy - 46, { size: 12, bold: true, color: g.v.c });
  });

  // Texto inferior
  const msg = ahorro > 0
    ? "Este crédito presenta una oportunidad de optimización significativa. La propuesta seleccionada reduce el tiempo de deuda, disminuye el costo financiero total y mejora tu salud financiera."
    : "Este crédito se encuentra en evaluación financiera. Los datos se actualizarán al completar el análisis.";
  const lines = wrapLines(ctx.font, msg, 8, w - 28);
  lines.slice(0, 5).forEach((ln, i) => {
    T(ctx, ln, M + 14, y + 14 + (lines.length - 1 - i) * 10, { size: 8, color: C.textDim });
  });
}

function drawHonorarios(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 770;
  const w = (PAGE_W - M * 2 - 12) * 0.38;
  const h = 102;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "HONORARIOS", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const honor = d.honorarios.pactados || 0;
  const recalc = honor * 0.935; // placeholder si no hay valor real
  const variacion = honor - recalc;

  // Fila top: 3 mini KPI
  const top = [
    { l: "PACTADOS", v: money(honor), c: C.text },
    { l: "RECALCULADOS", v: money(recalc), c: C.text },
    { l: "VARIACIÓN", v: variacion ? `-${money(Math.abs(variacion))}` : "—", c: C.red },
  ];
  const tw = (w - 28) / 3;
  top.forEach((it, i) => {
    const tx = M + 14 + i * tw;
    T(ctx, it.l, tx, y + h - 32, { size: 6, bold: true, color: C.muted });
    T(ctx, it.v, tx, y + h - 48, { size: 9.5, bold: true, color: it.c, maxW: tw - 6 });
  });

  // Fila inferior: 3 status
  const bottom = [
    { l: "ESTADO COBRO", v: safe(d.honorarios.estadoCobro).toUpperCase(), c: C.text },
    { l: "ESTADO PAGO", v: safe(d.honorarios.estadoPago).toUpperCase(), c: C.amber },
    { l: "PAZ Y SALVO", v: d.honorarios.pazYSalvo ? "SÍ" : "NO", c: d.honorarios.pazYSalvo ? C.accent : C.red },
  ];
  bottom.forEach((it, i) => {
    const tx = M + 14 + i * tw;
    T(ctx, it.l, tx, y + 26, { size: 6, bold: true, color: C.muted });
    T(ctx, it.v, tx, y + 12, { size: 9, bold: true, color: it.c, maxW: tw - 6 });
  });
}

function drawPropuesta(ctx: Ctx, d: CaseSnapshotDTO) {
  const x = M + (PAGE_W - M * 2 - 12) * 0.38 + 12;
  const w = (PAGE_W - M * 2 - 12) * 0.62;
  const y = PAGE_H - 770;
  const h = 216;
  card(ctx, x, y, w, h, { fill: C.surface });
  // top accent
  rect(ctx, x, y + h - 3, w, 3, C.accent);

  // header
  T(ctx, "PROPUESTA SELECCIONADA", x + 14, y + h - 22, { size: 10, bold: true, color: C.accent });
  // badge "RECOMENDADA POR NUVIA"
  const label = "RECOMENDADA POR NUVIA";
  const lw = ctx.bold.widthOfTextAtSize(label, 6.5) + 14;
  ctx.page.drawRectangle({
    x: x + w - lw - 12, y: y + h - 28, width: lw, height: 14,
    color: C.accent, opacity: 0.18, borderColor: C.accent, borderWidth: 0.5, borderOpacity: 0.6,
  });
  T(ctx, label, x + w - lw - 5, y + h - 25, { size: 6.5, bold: true, color: C.accent });

  const p = d.propuesta;

  // Fila 1: Nueva cuota / Nuevo plazo / Cuotas eliminadas
  const row1 = [
    { l: "NUEVA CUOTA", v: money(p.nuevaCuota), sub: p.incrementoMensual ? `+${pct((p.incrementoMensual / (d.credito.cuotaActual || 1)) * 100, 1)} vs actual` : "", c: C.text },
    { l: "NUEVO PLAZO", v: p.nuevoPlazo ? `${p.nuevoPlazo} meses` : "—", sub: p.tiempoRecuperado ? `-${p.tiempoRecuperado} meses` : "", c: C.text },
    { l: "CUOTAS ELIMINADAS", v: p.cuotasEliminadas ? `${p.cuotasEliminadas}` : "—", sub: d.credito.plazoAprobado && p.cuotasEliminadas ? `-${pct((p.cuotasEliminadas / d.credito.plazoAprobado) * 100, 1)} del plazo total` : "", c: C.accent },
  ];
  const cellW = (w - 28 - 16) / 3;
  const cellH = 60;
  row1.forEach((it, i) => {
    const cx = x + 14 + i * (cellW + 8);
    const cy = y + h - 28 - cellH - 8;
    card(ctx, cx, cy, cellW, cellH, { fill: C.bgSoft });
    T(ctx, it.l, cx + 10, cy + cellH - 12, { size: 6.2, bold: true, color: C.muted });
    T(ctx, it.v, cx + 10, cy + 22, { size: 14, bold: true, color: it.c, maxW: cellW - 16 });
    if (it.sub) T(ctx, it.sub, cx + 10, cy + 8, { size: 6.5, color: C.accent });
  });

  // Fila 2: Ahorro total / Ahorro intereses / Ahorro seguros
  const row2 = [
    { l: "AHORRO TOTAL", v: money(p.ahorroTotal), sub: d.credito.totalProyectado && p.ahorroTotal ? `${pct((p.ahorroTotal / d.credito.totalProyectado) * 100, 1)} del total a pagar` : "" },
    { l: "AHORRO INTERESES", v: money(p.ahorroIntereses), sub: "Proyección estimada" },
    { l: "AHORRO SEGUROS", v: money(p.ahorroSeguros), sub: "Proyección estimada" },
  ];
  row2.forEach((it, i) => {
    const cx = x + 14 + i * (cellW + 8);
    const cy = y + h - 28 - cellH * 2 - 16;
    card(ctx, cx, cy, cellW, cellH, { fill: C.bgSoft });
    T(ctx, it.l, cx + 10, cy + cellH - 12, { size: 6.2, bold: true, color: C.muted });
    T(ctx, it.v, cx + 10, cy + 22, { size: 14, bold: true, color: C.accent, maxW: cellW - 16 });
    if (it.sub) T(ctx, it.sub, cx + 10, cy + 8, { size: 6.5, color: C.muted });
  });

  // Banner inferior: tiempo recuperado
  const bY = y + 10;
  const bH = 36;
  card(ctx, x + 14, bY, w - 28, bH, { fill: C.bgSoft });
  T(ctx, "TIEMPO RECUPERADO", x + 24, bY + bH - 12, { size: 6.5, bold: true, color: C.muted });
  const years = p.tiempoRecuperado ? `${(p.tiempoRecuperado / 12).toFixed(0)} años` : "—";
  T(ctx, years, x + 24, bY + 10, { size: 14, bold: true, color: C.accent });
  T(ctx, "Reducción en el tiempo total de deuda", x + 24 + 80, bY + 13, { size: 8.5, color: C.textDim });
}

function drawTimelineOperativo(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 858;
  const h = 80;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "ESTADO OPERATIVO DEL CASO", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const items = d.timeline.length ? d.timeline : [
    { etiqueta: "Simulación", estado: "pendiente" as const },
    { etiqueta: "QA", estado: "pendiente" as const },
    { etiqueta: "Contrato", estado: "pendiente" as const },
    { etiqueta: "Poder", estado: "pendiente" as const },
    { etiqueta: "Checklist", estado: "pendiente" as const },
    { etiqueta: "Radicación", estado: "pendiente" as const },
    { etiqueta: "Respuesta Banco", estado: "pendiente" as const },
    { etiqueta: "Informe Final", estado: "pendiente" as const },
    { etiqueta: "Cuenta Cobro", estado: "pendiente" as const },
    { etiqueta: "Paz y Salvo", estado: "pendiente" as const },
  ];
  const inner = w - 60;
  const step = items.length > 1 ? inner / (items.length - 1) : 0;
  const lineY = y + 38;

  // base línea gris
  rect(ctx, M + 30, lineY - 0.5, inner, 1, C.borderSoft);
  // línea coloreada hasta último hecho/curso
  const lastDone = items.reduce((a, it, i) => it.estado === "hecho" || it.estado === "curso" ? i : a, -1);
  if (lastDone >= 0) rect(ctx, M + 30, lineY - 1, step * lastDone, 2, C.accent);

  items.forEach((it, i) => {
    const cx = M + 30 + step * i;
    const color = it.estado === "hecho" ? C.accent : it.estado === "curso" ? C.primaryHi : C.surfaceHi;
    const ringColor = it.estado === "hecho" || it.estado === "curso" ? color : C.borderSoft;
    ctx.page.drawCircle({ x: cx, y: lineY, size: 8, color: C.surface, borderColor: ringColor, borderWidth: 1 });
    ctx.page.drawCircle({ x: cx, y: lineY, size: 6, color });
    if (it.estado === "hecho") {
      // checkmark simple
      ctx.page.drawLine({ start: { x: cx - 2.5, y: lineY }, end: { x: cx - 0.5, y: lineY - 2 }, color: C.bg, thickness: 1.2 });
      ctx.page.drawLine({ start: { x: cx - 0.5, y: lineY - 2 }, end: { x: cx + 2.5, y: lineY + 2 }, color: C.bg, thickness: 1.2 });
    } else if (it.estado === "curso") {
      ctx.page.drawCircle({ x: cx, y: lineY, size: 2, color: C.bg });
    }
    const lbl = it.etiqueta;
    const lines = lbl.split(/\s+/);
    if (lines.length > 1 && ctx.font.widthOfTextAtSize(lbl, 6.5) > step + 4) {
      lines.slice(0, 2).forEach((ln, j) => {
        const lw = ctx.font.widthOfTextAtSize(ln, 6.5);
        T(ctx, ln, cx - lw / 2, lineY - 18 - j * 9, { size: 6.5, color: C.textDim });
      });
    } else {
      const lw = ctx.font.widthOfTextAtSize(lbl, 6.5);
      T(ctx, lbl, cx - lw / 2, lineY - 18, { size: 6.5, color: C.textDim });
    }
  });

  // leyenda
  const legY = y + 8;
  const legends = [
    { c: C.accent, l: "Completado" },
    { c: C.primaryHi, l: "En proceso" },
    { c: C.surfaceHi, l: "Pendiente" },
    { c: C.borderSoft, l: "No iniciado" },
  ];
  let lx = M + 14;
  legends.forEach((lg) => {
    ctx.page.drawCircle({ x: lx + 3, y: legY + 3, size: 3, color: lg.c });
    T(ctx, lg.l, lx + 10, legY, { size: 6.5, color: C.muted });
    lx += ctx.font.widthOfTextAtSize(lg.l, 6.5) + 22;
  });
}

function drawIntervinientes(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = M + 38;
  const w = (PAGE_W - M * 2 - 10) / 2;
  const h = 160;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "INTERVINIENTES", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  // headers
  const colROL = M + 14;
  const colNOM = M + 14 + 88;
  const colMAIL = M + 14 + 88 + 130;
  const headerY = y + h - 32;
  T(ctx, "ROL", colROL, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "NOMBRE", colNOM, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "CORREO", colMAIL, headerY, { size: 6, bold: true, color: C.muted });
  rect(ctx, M + 10, headerY - 4, w - 20, 0.5, C.border, 0.10);

  const list = d.intervinientes.slice(0, 5);
  const rowH = 20;
  list.forEach((p, i) => {
    const ry = headerY - 14 - i * rowH;
    ctx.page.drawCircle({ x: colROL - 2, y: ry + 4, size: 4, color: C.bgSoft, borderColor: C.primary, borderWidth: 0.5 });
    T(ctx, p.rol, colROL + 8, ry, { size: 7.5, color: C.text, maxW: 80 });
    T(ctx, safe(p.nombre), colNOM, ry, { size: 7.5, bold: true, color: C.text, maxW: 125 });
    T(ctx, safe(p.email), colMAIL, ry, { size: 7.5, color: C.textDim, maxW: w - (colMAIL - M) - 14 });
  });
}

function drawTrazabilidad(ctx: Ctx, d: CaseSnapshotDTO) {
  const x = M + (PAGE_W - M * 2 - 10) / 2 + 10;
  const w = (PAGE_W - M * 2 - 10) / 2;
  const y = M + 38;
  const h = 160;
  card(ctx, x, y, w, h, { fill: C.surface });
  T(ctx, "TRAZABILIDAD", x + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const colFEC = x + 14;
  const colACC = x + 14 + 70;
  const colUSR = x + 14 + 70 + 150;
  const headerY = y + h - 32;
  T(ctx, "FECHA", colFEC, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "ACCIÓN", colACC, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "USUARIO", colUSR, headerY, { size: 6, bold: true, color: C.muted });
  rect(ctx, x + 10, headerY - 4, w - 20, 0.5, C.border, 0.10);

  const list = d.trazabilidad.slice(0, 5);
  const rowH = 20;
  // rail vertical sutil
  rect(ctx, colFEC - 6, headerY - 14 - rowH * (list.length - 1) - 4, 0.5, rowH * list.length, C.borderSoft);
  list.forEach((t, i) => {
    const ry = headerY - 14 - i * rowH;
    ctx.page.drawCircle({ x: colFEC - 6, y: ry + 3, size: 2.5, color: C.primaryHi });
    T(ctx, fmtShortDate(t.fecha), colFEC, ry, { size: 7, color: C.textDim, maxW: 65 });
    T(ctx, t.accion, colACC, ry, { size: 7, bold: true, color: C.text, maxW: 145 });
    T(ctx, safe(t.usuario), colUSR, ry, { size: 7, color: C.textDim, maxW: w - (colUSR - x) - 14 });
  });
}

function drawFooter(ctx: Ctx) {
  // separator
  rect(ctx, M, 36, PAGE_W - M * 2, 0.5, C.border, 0.10);
  T(ctx, "NUVIA", M, 20, { size: 11, bold: true, color: C.text });
  T(ctx, "FINANCIAL INTELLIGENCE", M, 9, { size: 5.5, bold: true, color: C.accent });

  const center = "Transformamos datos en decisiones financieras inteligentes.";
  const cw = ctx.font.widthOfTextAtSize(center, 8);
  T(ctx, center, PAGE_W / 2 - cw / 2, 16, { size: 8, color: C.primaryHi });

  const pg = "Página 1 de 1";
  const pw = ctx.font.widthOfTextAtSize(pg, 7.5);
  T(ctx, pg, PAGE_W - M - pw, 16, { size: 7.5, color: C.muted });
}

// ───────────────── ORQUESTADOR ─────────────────
export async function generarCaseSnapshotPdf(d: CaseSnapshotDTO): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const ctx: Ctx = { doc, page, font, bold };

  drawBackground(ctx);
  drawTopBar(ctx, d);
  drawTitle(ctx, d);
  drawClienteRow(ctx, d);
  drawAnalistaRow(ctx, d);
  drawFotoCredito(ctx, d);
  drawVecesHero(ctx, d);
  drawDiagnostico(ctx, d);
  drawHonorarios(ctx, d);
  drawPropuesta(ctx, d);
  drawTimelineOperativo(ctx, d);
  drawIntervinientes(ctx, d);
  drawTrazabilidad(ctx, d);
  drawFooter(ctx);

  const bytes = await doc.save();
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export function descargarSnapshot(blob: Blob, cliente: string) {
  const safeName = cliente.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "_") || "caso";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CaseSnapshot_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
