// Case Snapshot PDF — Executive Visual Report
// Estilo NUVIA dark premium / fintech / luxury minimalism.
// No recalcula datos: consume el DTO tal cual.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { formatCOP } from "@/lib/format";
import type { CaseSnapshotDTO } from "./caseSnapshot.functions";

// ───────────────── Paleta NUVIA ─────────────────
const C = {
  bg: rgb(0.027, 0.043, 0.094),          // #07091A
  bgSoft: rgb(0.043, 0.071, 0.149),      // #0B1226
  surface: rgb(0.063, 0.094, 0.176),     // #10182D
  surfaceHi: rgb(0.090, 0.129, 0.224),   // #172139
  border: rgb(0.17, 0.22, 0.34),
  borderSoft: rgb(0.12, 0.16, 0.26),
  primary: rgb(0.310, 0.435, 0.733),     // #4F6FBB
  primaryHi: rgb(0.467, 0.580, 0.851),   // #7794D9
  accent: rgb(0.518, 0.749, 0.580),      // #84BF94
  accentSoft: rgb(0.40, 0.62, 0.48),
  gold: rgb(0.937, 0.776, 0.388),        // #EFC663
  red: rgb(0.961, 0.451, 0.451),         // #F57373
  amber: rgb(0.965, 0.769, 0.325),
  text: rgb(0.965, 0.973, 0.988),        // #F6F8FC
  textDim: rgb(0.752, 0.792, 0.875),     // #C0CAE0
  muted: rgb(0.553, 0.604, 0.722),       // #8D9AB8
  dim: rgb(0.36, 0.41, 0.52),
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 44;

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNum: number;
  totalPages?: number;
}

// ───────────────── Formatters ─────────────────
function money(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return formatCOP(v);
}
function moneyShort(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)} MM MM`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)} MM`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)} K`;
  return formatCOP(v);
}
function pct(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return `${v.toFixed(2)}%`;
}
function intN(v: number | null | undefined, suffix = ""): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return `${Math.round(v).toLocaleString("es-CO")}${suffix}`;
}
function fmtDate(s: string): string {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(s: string): string {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function safe(v: string | null | undefined, fb = "—"): string {
  return v && v.trim().length ? v : fb;
}

// ───────────────── Drawing helpers ─────────────────
function paintBg(ctx: Ctx) {
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.bg });
  // sutil glow superior
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 160, width: PAGE_W, height: 160, color: C.bgSoft, opacity: 0.55 });
}

function drawHeader(ctx: Ctx, d: CaseSnapshotDTO) {
  // hairline superior
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 38, width: PAGE_W, height: 38, color: C.surface });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 38, width: PAGE_W, height: 0.5, color: C.accent, opacity: 0.6 });

  ctx.page.drawText("NUVIA", { x: MARGIN, y: PAGE_H - 25, size: 11, font: ctx.bold, color: C.text });
  ctx.page.drawText("· EXECUTIVE INTELLIGENCE", { x: MARGIN + 38, y: PAGE_H - 25, size: 7.5, font: ctx.font, color: C.muted });

  const right = `${safe(d.meta.cliente).toUpperCase()}  ·  ${safe(d.meta.banco).toUpperCase()}`;
  let txt = right;
  while (ctx.bold.widthOfTextAtSize(txt, 7.5) > 280 && txt.length > 3) txt = txt.slice(0, -2) + "…";
  const w = ctx.bold.widthOfTextAtSize(txt, 7.5);
  ctx.page.drawText(txt, { x: PAGE_W - MARGIN - w, y: PAGE_H - 25, size: 7.5, font: ctx.bold, color: C.textDim });
}

function drawFooter(ctx: Ctx) {
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 26, color: C.surface });
  ctx.page.drawRectangle({ x: 0, y: 26, width: PAGE_W, height: 0.5, color: C.borderSoft });
  ctx.page.drawText("Executive Financial Intelligence Report", {
    x: MARGIN, y: 10, size: 7, font: ctx.font, color: C.muted,
  });
  const center = "Confidencial · Uso interno NUVIA";
  const cw = ctx.font.widthOfTextAtSize(center, 7);
  ctx.page.drawText(center, { x: PAGE_W / 2 - cw / 2, y: 10, size: 7, font: ctx.font, color: C.dim });
  const pageStr = ctx.totalPages ? `${ctx.pageNum} / ${ctx.totalPages}` : `${ctx.pageNum}`;
  const pw = ctx.bold.widthOfTextAtSize(pageStr, 7);
  ctx.page.drawText(pageStr, { x: PAGE_W - MARGIN - pw, y: 10, size: 7, font: ctx.bold, color: C.textDim });
}

function newPage(ctx: Ctx, d: CaseSnapshotDTO) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  paintBg(ctx);
  drawHeader(ctx, d);
  drawFooter(ctx);
  ctx.y = PAGE_H - 64;
}

function ensure(ctx: Ctx, needed: number, d: CaseSnapshotDTO) {
  if (ctx.y - needed < 44) newPage(ctx, d);
}

function truncate(font: PDFFont, txt: string, size: number, maxW: number): string {
  let t = txt;
  while (font.widthOfTextAtSize(t, size) > maxW && t.length > 1) t = t.slice(0, -2) + "…";
  return t;
}

function drawText(
  ctx: Ctx, txt: string, x: number, y: number, opts: { size?: number; bold?: boolean; color?: RGB; maxW?: number } = {},
) {
  const size = opts.size ?? 9;
  const f = opts.bold ? ctx.bold : ctx.font;
  const t = opts.maxW ? truncate(f, txt, size, opts.maxW) : txt;
  ctx.page.drawText(t, { x, y, size, font: f, color: opts.color ?? C.text });
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

function sectionTitle(ctx: Ctx, eyebrow: string, title: string, d: CaseSnapshotDTO) {
  ensure(ctx, 50, d);
  // accent bar
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 4, width: 22, height: 2, color: C.accent });
  ctx.page.drawText(eyebrow.toUpperCase(), {
    x: MARGIN + 28, y: ctx.y - 8, size: 7, font: ctx.bold, color: C.accent,
  });
  ctx.y -= 18;
  drawText(ctx, title, MARGIN, ctx.y - 6, { size: 16, bold: true, color: C.text });
  ctx.y -= 22;
}

function card(
  ctx: Ctx, x: number, y: number, w: number, h: number,
  opts: { fill?: RGB; border?: RGB; opacity?: number } = {},
) {
  ctx.page.drawRectangle({
    x, y, width: w, height: h,
    color: opts.fill ?? C.surface,
    opacity: opts.opacity,
    borderColor: opts.border ?? C.borderSoft,
    borderWidth: 0.5,
  });
}

// ───────────────── PORTADA ─────────────────
function drawCover(ctx: Ctx, d: CaseSnapshotDTO) {
  paintBg(ctx);

  // banda izquierda accent
  ctx.page.drawRectangle({ x: 0, y: 0, width: 4, height: PAGE_H, color: C.accent });

  // glow superior
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 320, width: PAGE_W, height: 320, color: C.bgSoft });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 322, width: PAGE_W, height: 1, color: C.border });

  // brand
  drawText(ctx, "NUVIA", MARGIN, PAGE_H - 70, { size: 22, bold: true, color: C.text });
  drawText(ctx, "FINANCIAL INTELLIGENCE", MARGIN + 78, PAGE_H - 65, { size: 8, color: C.accent, bold: true });

  // eyebrow
  drawText(ctx, "EXECUTIVE VISUAL REPORT", MARGIN, PAGE_H - 130, { size: 8, bold: true, color: C.muted });

  // title
  drawText(ctx, "Case Snapshot", MARGIN, PAGE_H - 175, { size: 38, bold: true, color: C.text });
  drawText(ctx, "Inteligencia financiera ejecutiva del caso", MARGIN, PAGE_H - 198, { size: 11, color: C.textDim });

  // accent line
  ctx.page.drawRectangle({ x: MARGIN, y: PAGE_H - 215, width: 48, height: 2, color: C.accent });

  // Hero info card (cliente / banco)
  const heroY = PAGE_H - 380;
  card(ctx, MARGIN, heroY, PAGE_W - MARGIN * 2, 140, { fill: C.surface });
  ctx.page.drawRectangle({ x: MARGIN, y: heroY + 137, width: PAGE_W - MARGIN * 2, height: 3, color: C.accent });

  drawText(ctx, "CLIENTE", MARGIN + 22, heroY + 110, { size: 7, bold: true, color: C.muted });
  drawText(ctx, safe(d.meta.cliente), MARGIN + 22, heroY + 90, { size: 18, bold: true, color: C.text, maxW: 280 });
  drawText(ctx, `CC ${safe(d.meta.cedula)}`, MARGIN + 22, heroY + 74, { size: 8.5, color: C.muted });

  drawText(ctx, "BANCO", MARGIN + 22, heroY + 50, { size: 7, bold: true, color: C.muted });
  drawText(ctx, safe(d.meta.banco), MARGIN + 22, heroY + 32, { size: 13, bold: true, color: C.text, maxW: 280 });

  // Lado derecho: producto + estado
  const rx = PAGE_W - MARGIN - 220;
  drawText(ctx, "PRODUCTO", rx, heroY + 110, { size: 7, bold: true, color: C.muted });
  drawText(ctx, safe(d.meta.producto), rx, heroY + 92, { size: 11, bold: true, color: C.text, maxW: 200 });
  drawText(ctx, safe(d.meta.modalidad).toUpperCase(), rx, heroY + 76, { size: 8, color: C.accent, bold: true });

  drawText(ctx, "ESTADO DEL CASO", rx, heroY + 50, { size: 7, bold: true, color: C.muted });
  const estado = safe(d.meta.estadoCaso).replace(/_/g, " ").toUpperCase();
  drawText(ctx, estado, rx, heroY + 32, { size: 11, bold: true, color: C.gold, maxW: 200 });

  // Métricas inferiores: Analista / Score QA / Fecha
  const mY = heroY - 90;
  const colW = (PAGE_W - MARGIN * 2 - 24) / 3;
  const mini = [
    { l: "ANALISTA", v: safe(d.meta.analista.nombre), color: C.text },
    { l: "SCORE QA", v: d.meta.qaScore != null ? `${d.meta.qaScore.toFixed(1)} / 100` : "—", color: C.accent },
    { l: "FECHA", v: fmtDate(d.meta.fecha), color: C.textDim },
  ];
  mini.forEach((m, i) => {
    const x = MARGIN + i * (colW + 12);
    card(ctx, x, mY, colW, 64, { fill: C.surface });
    drawText(ctx, m.l, x + 14, mY + 44, { size: 7, bold: true, color: C.muted });
    drawText(ctx, m.v, x + 14, mY + 22, { size: 12, bold: true, color: m.color, maxW: colW - 28 });
  });

  // footer cover
  drawText(ctx, "Confidencial · Documento ejecutivo · No reemplaza el expediente operativo",
    MARGIN, 56, { size: 7.5, color: C.dim });
  drawText(ctx, `ID: ${d.meta.expedienteId}`, MARGIN, 42, { size: 7, color: C.dim });

  // micro paginación
  drawText(ctx, "01", PAGE_W - MARGIN - 14, 42, { size: 9, bold: true, color: C.accent });
}

// ───────────────── KPI CARDS (Foto del crédito) ─────────────────
function drawCreditKpis(ctx: Ctx, d: CaseSnapshotDTO) {
  const w = (PAGE_W - MARGIN * 2 - 24) / 4;
  const h = 78;
  const kpis = [
    { l: "Saldo actual", v: moneyShort(d.credito.saldoCapital), accent: C.gold },
    { l: "Cuota actual", v: moneyShort(d.credito.cuotaActual), accent: C.primaryHi },
    { l: "Cuotas pendientes", v: d.credito.cuotasPendientes ? `${d.credito.cuotasPendientes}` : "—", accent: C.amber },
    { l: "Costo total crédito", v: moneyShort(d.credito.costoReal || d.credito.totalProyectado), accent: C.red },
  ];
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (w + 8);
    card(ctx, x, ctx.y - h, w, h, { fill: C.surface });
    // accent strip
    ctx.page.drawRectangle({ x, y: ctx.y - 4, width: w, height: 2, color: k.accent });
    drawText(ctx, k.l.toUpperCase(), x + 12, ctx.y - 22, { size: 6.8, bold: true, color: C.muted });
    drawText(ctx, k.v, x + 12, ctx.y - 50, { size: 16, bold: true, color: C.text, maxW: w - 20 });
  });
  ctx.y -= h + 14;
}

function drawHeroVeces(ctx: Ctx, d: CaseSnapshotDTO) {
  const veces = d.credito.vecesPagado;
  if (!veces || !isFinite(veces) || veces <= 0) return;
  const h = 90;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  // Fondo glow
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surfaceHi });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - h, width: 3, height: h, color: C.red });
  drawText(ctx, "DIAGNÓSTICO DE COSTO REAL", MARGIN + 18, ctx.y - 22, { size: 7, bold: true, color: C.red });
  // Número grande
  const num = `${veces.toFixed(2)}×`;
  drawText(ctx, num, MARGIN + 18, ctx.y - 60, { size: 30, bold: true, color: C.red });
  // Texto al lado
  const tx = MARGIN + 18 + ctx.bold.widthOfTextAtSize(num, 30) + 20;
  drawText(ctx, "VAS A PAGAR ESE NÚMERO DE VECES", tx, ctx.y - 38, { size: 9, bold: true, color: C.text });
  drawText(ctx, "el valor original del crédito desembolsado", tx, ctx.y - 54, { size: 9, color: C.textDim });
  drawText(ctx, `Desembolso ${money(d.credito.valorDesembolsado)} · Total proyectado ${money(d.credito.totalProyectado || d.credito.costoReal)}`,
    tx, ctx.y - 72, { size: 7.5, color: C.muted, maxW: w - (tx - MARGIN) - 18 });
  ctx.y -= h + 14;
}

// Métricas secundarias del crédito (slim row)
function drawCreditSubMetrics(ctx: Ctx, d: CaseSnapshotDTO) {
  const items = [
    { l: "TEA", v: pct(d.credito.tea) },
    { l: "Plazo aprob.", v: d.credito.plazoAprobado ? `${d.credito.plazoAprobado} m` : "—" },
    { l: "Cuotas pagadas", v: intN(d.credito.cuotasPagadas) },
    { l: "Seguros / mes", v: moneyShort(d.credito.seguros) },
    { l: "Interés / mes", v: moneyShort(d.credito.interesMensual) },
    { l: "Capital / mes", v: moneyShort(d.credito.capitalMensual) },
  ];
  const h = 42;
  const w = PAGE_W - MARGIN * 2;
  ensure(ctx, h + 6, d);
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.bgSoft });
  const colW = (w - 16) / items.length;
  items.forEach((it, i) => {
    const x = MARGIN + 8 + i * colW;
    drawText(ctx, it.l.toUpperCase(), x, ctx.y - 16, { size: 6.5, bold: true, color: C.muted });
    drawText(ctx, it.v, x, ctx.y - 32, { size: 10, bold: true, color: C.text, maxW: colW - 8 });
  });
  ctx.y -= h + 18;
}

// ───────────────── DIAGNÓSTICO NUVIA ─────────────────
function computeDiagnostico(d: CaseSnapshotDTO) {
  const veces = d.credito.vecesPagado || 0;
  const endeudamiento = d.cliente.endeudamiento || 0;
  const ahorro = d.propuesta.ahorroTotal || 0;
  // Riesgo
  let riesgo: { label: string; tone: RGB } = { label: "BAJO", tone: C.accent };
  if (veces >= 2.5 || endeudamiento >= 50) riesgo = { label: "ALTO", tone: C.red };
  else if (veces >= 1.8 || endeudamiento >= 35) riesgo = { label: "MEDIO", tone: C.amber };
  // Viabilidad
  let viab: { label: string; tone: RGB } = { label: "ALTA", tone: C.accent };
  if (ahorro <= 0) viab = { label: "BAJA", tone: C.red };
  else if (ahorro < 10_000_000) viab = { label: "MEDIA", tone: C.amber };
  // Complejidad
  const modo = d.meta.modalidad.toLowerCase();
  let comp: { label: string; tone: RGB } = { label: "ESTÁNDAR", tone: C.primaryHi };
  if (modo.includes("uvr") || modo.includes("leasing")) comp = { label: "ALTA", tone: C.amber };
  // Resumen
  const partes: string[] = [];
  if (veces > 1) partes.push(`El cliente terminaría pagando ${veces.toFixed(2)}× el valor desembolsado.`);
  if (ahorro > 0) partes.push(`La propuesta seleccionada genera un ahorro de ${money(ahorro)} y libera ${d.propuesta.tiempoRecuperado || 0} meses.`);
  if (d.cliente.endeudamiento > 0) partes.push(`Nivel de endeudamiento actual: ${d.cliente.endeudamiento.toFixed(1)}%.`);
  if (d.meta.qaScore != null) partes.push(`Score QA: ${d.meta.qaScore.toFixed(1)} / 100.`);
  if (!partes.length) partes.push("Diagnóstico preliminar: caso en evaluación financiera.");
  return { riesgo, viab, comp, resumen: partes.join(" ") };
}

function drawDiagnostico(ctx: Ctx, d: CaseSnapshotDTO) {
  const dx = computeDiagnostico(d);
  // 3 chips
  const chipW = (PAGE_W - MARGIN * 2 - 24) / 3;
  const chipH = 66;
  ensure(ctx, chipH + 90, d);
  const chips = [
    { l: "RIESGO", v: dx.riesgo.label, c: dx.riesgo.tone },
    { l: "VIABILIDAD", v: dx.viab.label, c: dx.viab.tone },
    { l: "COMPLEJIDAD", v: dx.comp.label, c: dx.comp.tone },
  ];
  chips.forEach((ch, i) => {
    const x = MARGIN + i * (chipW + 12);
    card(ctx, x, ctx.y - chipH, chipW, chipH, { fill: C.surface });
    ctx.page.drawCircle({ x: x + 14, y: ctx.y - 18, size: 4, color: ch.c });
    drawText(ctx, ch.l, x + 24, ctx.y - 21, { size: 7, bold: true, color: C.muted });
    drawText(ctx, ch.v, x + 14, ctx.y - 48, { size: 18, bold: true, color: ch.c });
  });
  ctx.y -= chipH + 14;

  // Resumen ejecutivo
  const lines = wrapLines(ctx.font, dx.resumen, 9.5, PAGE_W - MARGIN * 2 - 36);
  const h = 28 + lines.length * 13;
  card(ctx, MARGIN, ctx.y - h, PAGE_W - MARGIN * 2, h, { fill: C.bgSoft });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - h, width: 2, height: h, color: C.accent });
  drawText(ctx, "RESUMEN EJECUTIVO NUVIA AI", MARGIN + 16, ctx.y - 16, { size: 7.5, bold: true, color: C.accent });
  lines.forEach((ln, i) => {
    drawText(ctx, ln, MARGIN + 16, ctx.y - 32 - i * 13, { size: 9.5, color: C.textDim });
  });
  ctx.y -= h + 14;
}

// ───────────────── PROPUESTA (Hero) ─────────────────
function drawPropuesta(ctx: Ctx, d: CaseSnapshotDTO) {
  const p = d.propuesta;
  ensure(ctx, 230, d);
  const w = PAGE_W - MARGIN * 2;

  // Header del bloque
  const hH = 64;
  card(ctx, MARGIN, ctx.y - hH, w, hH, { fill: C.surfaceHi });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 3, width: w, height: 3, color: C.accent });
  if (p.recomendada) {
    // badge
    const label = "RECOMENDADA POR NUVIA";
    const bw = ctx.bold.widthOfTextAtSize(label, 7) + 18;
    ctx.page.drawRectangle({ x: PAGE_W - MARGIN - bw - 12, y: ctx.y - 28, width: bw, height: 16, color: C.accent, opacity: 0.18, borderColor: C.accent, borderWidth: 0.5 });
    drawText(ctx, label, PAGE_W - MARGIN - bw - 3, ctx.y - 24, { size: 7, bold: true, color: C.accent });
  }
  drawText(ctx, "ESCENARIO SELECCIONADO", MARGIN + 18, ctx.y - 22, { size: 7, bold: true, color: C.muted });
  drawText(ctx, safe(p.escenario, "Propuesta NUVIA"), MARGIN + 18, ctx.y - 48, { size: 16, bold: true, color: C.text, maxW: w - 220 });
  ctx.y -= hH + 8;

  // Hero ahorro total
  const ahH = 78;
  card(ctx, MARGIN, ctx.y - ahH, w, ahH, { fill: C.surface });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - ahH, width: 4, height: ahH, color: C.accent });
  drawText(ctx, "AHORRO TOTAL ESTIMADO", MARGIN + 22, ctx.y - 22, { size: 7.5, bold: true, color: C.accent });
  drawText(ctx, money(p.ahorroTotal), MARGIN + 22, ctx.y - 58, { size: 26, bold: true, color: C.accent });
  // mini desglose lado derecho
  const rx = PAGE_W - MARGIN - 220;
  drawText(ctx, "INTERESES", rx, ctx.y - 22, { size: 6.5, bold: true, color: C.muted });
  drawText(ctx, money(p.ahorroIntereses), rx, ctx.y - 38, { size: 11, bold: true, color: C.text });
  drawText(ctx, "SEGUROS", rx + 110, ctx.y - 22, { size: 6.5, bold: true, color: C.muted });
  drawText(ctx, money(p.ahorroSeguros), rx + 110, ctx.y - 38, { size: 11, bold: true, color: C.text });
  drawText(ctx, "TIEMPO RECUPERADO", rx, ctx.y - 56, { size: 6.5, bold: true, color: C.muted });
  drawText(ctx, p.tiempoRecuperado ? `${p.tiempoRecuperado} meses` : "—", rx, ctx.y - 70, { size: 11, bold: true, color: C.gold });
  ctx.y -= ahH + 10;

  // 4 KPIs de propuesta
  const items = [
    { l: "NUEVA CUOTA", v: money(p.nuevaCuota), c: C.primaryHi },
    { l: "NUEVO PLAZO", v: p.nuevoPlazo ? `${p.nuevoPlazo} m` : "—", c: C.primaryHi },
    { l: "CUOTAS ELIMINADAS", v: p.cuotasEliminadas ? `${p.cuotasEliminadas}` : "—", c: C.accent },
    { l: "INCREMENTO MENSUAL", v: money(p.incrementoMensual), c: C.amber },
  ];
  const cw = (w - 24) / 4;
  const ch = 64;
  items.forEach((it, i) => {
    const x = MARGIN + i * (cw + 8);
    card(ctx, x, ctx.y - ch, cw, ch, { fill: C.surface });
    drawText(ctx, it.l, x + 12, ctx.y - 18, { size: 6.5, bold: true, color: C.muted });
    drawText(ctx, it.v, x + 12, ctx.y - 44, { size: 13, bold: true, color: it.c, maxW: cw - 20 });
  });
  ctx.y -= ch + 14;
}

// ───────────────── PERFIL FINANCIERO (Grid 4x2) ─────────────────
function computePerfil(d: CaseSnapshotDTO) {
  const ing = (d.cliente.ingresos || 0) + (d.cliente.otrosIngresos || 0);
  const cuota = d.credito.cuotaActual || 0;
  const capUsada = ing > 0 ? (cuota / ing) * 100 : 0;
  const capMax = 40; // Decreto 583/2025
  const capLibre = Math.max(capMax - capUsada, 0);
  const endGlobal = d.cliente.endeudamiento || 0;
  let score = d.meta.qaScore;
  if (score == null) {
    let s = 100;
    if (capUsada > 40) s -= (capUsada - 40) * 1.2;
    if ((d.credito.vecesPagado || 0) > 1.5) s -= (d.credito.vecesPagado - 1.5) * 12;
    if (endGlobal > 35) s -= (endGlobal - 35) * 0.6;
    score = Math.max(0, Math.min(100, Math.round(s)));
  }
  const toneFor = (v: number, good: number, bad: number) =>
    v <= good ? C.accent : v <= bad ? C.amber : C.red;
  return {
    cards: [
      { l: "Ingresos del hogar", v: moneyShort(ing), c: C.primaryHi },
      { l: "Capacidad usada", v: ing > 0 ? `${capUsada.toFixed(1)}%` : "—", c: ing > 0 ? toneFor(capUsada, 30, 40) : C.muted },
      { l: "Capacidad máxima legal", v: `${capMax}%`, c: C.accent },
      { l: "Capacidad libre", v: ing > 0 ? `${capLibre.toFixed(1)}%` : "—", c: capLibre > 5 ? C.accent : C.amber },
      { l: "LTV (saldo / valor)", v: "—", c: C.gold },
      { l: "Patrimonio estimado", v: "—", c: C.text },
      { l: "Endeudamiento global", v: endGlobal > 0 ? `${endGlobal.toFixed(1)}%` : "—", c: endGlobal > 0 ? toneFor(endGlobal, 30, 45) : C.muted },
      { l: "Score financiero NUVIA", v: `${score}/100`, c: score >= 70 ? C.accent : score >= 50 ? C.amber : C.red },
    ],
  };
}

function drawPerfilFinanciero(ctx: Ctx, d: CaseSnapshotDTO) {
  const perfil = computePerfil(d);
  const cols = 4;
  const rows = 2;
  const gap = 8;
  const w = (PAGE_W - MARGIN * 2 - gap * (cols - 1)) / cols;
  const h = 70;
  const totalH = rows * h + (rows - 1) * gap;
  ensure(ctx, totalH + 6, d);
  perfil.cards.forEach((k, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (w + gap);
    const y = ctx.y - (row + 1) * h - row * gap;
    card(ctx, x, y, w, h, { fill: C.surface });
    ctx.page.drawRectangle({ x, y: y + h - 2, width: w, height: 2, color: k.c });
    const idx = String(i + 1).padStart(2, "0");
    drawText(ctx, idx, x + 12, y + h - 16, { size: 6.5, bold: true, color: C.dim });
    drawText(ctx, k.l.toUpperCase(), x + 12, y + h - 28, { size: 6.5, bold: true, color: C.muted, maxW: w - 24 });
    drawText(ctx, k.v, x + 12, y + 16, { size: 15, bold: true, color: k.c, maxW: w - 20 });
  });
  ctx.y -= totalH + 14;
}

// ───────────────── HISTORIA FINANCIERA (split + ring) ─────────────────
function drawHistoriaFinanciera(ctx: Ctx, d: CaseSnapshotDTO) {
  const cuotasPag = d.credito.cuotasPagadas || 0;
  const cuota = d.credito.cuotaActual || 0;
  const interesMes = d.credito.interesMensual || 0;
  const segurosMes = d.credito.seguros || 0;
  const capitalMes = d.credito.capitalMensual || 0;
  const dineroPagado = cuotasPag * cuota;
  const interesesPagados = cuotasPag * interesMes;
  const segurosPagados = cuotasPag * segurosMes;
  const capitalAmortReal = Math.max(
    (d.credito.valorDesembolsado || 0) - (d.credito.saldoCapital || 0),
    cuotasPag * capitalMes,
  );
  const eficiencia = dineroPagado > 0 ? (capitalAmortReal / dineroPagado) * 100 : 0;
  const ringColor = eficiencia >= 30 ? C.accent : eficiencia >= 15 ? C.amber : C.red;

  const h = 178;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 3, width: w, height: 3, color: C.primaryHi });

  drawText(ctx, "TU HISTORIAL FINANCIERO CON EL BANCO", MARGIN + 18, ctx.y - 22, { size: 7.5, bold: true, color: C.primaryHi });

  const leftX = MARGIN + 18;
  const items = [
    { l: "Tiempo pagando", v: cuotasPag > 0 ? `${cuotasPag} meses` : "—" },
    { l: "Dinero pagado total", v: moneyShort(dineroPagado) },
    { l: "Intereses pagados", v: moneyShort(interesesPagados) },
    { l: "Seguros pagados", v: moneyShort(segurosPagados) },
    { l: "Capital real amortizado", v: moneyShort(capitalAmortReal) },
  ];
  items.forEach((it, i) => {
    const y = ctx.y - 46 - i * 20;
    drawText(ctx, it.l.toUpperCase(), leftX, y, { size: 6.5, bold: true, color: C.muted });
    drawText(ctx, it.v, leftX + 150, y, { size: 10, bold: true, color: C.text });
  });

  // Progress ring
  const cx = PAGE_W - MARGIN - 80;
  const cy = ctx.y - 92;
  const R = 44;
  ctx.page.drawCircle({ x: cx, y: cy, size: R, color: C.bgSoft, borderColor: C.borderSoft, borderWidth: 1 });
  ctx.page.drawCircle({
    x: cx, y: cy, size: R - 1,
    borderColor: ringColor, borderWidth: 6,
    opacity: Math.min(1, Math.max(0.25, eficiencia / 100)),
  });
  ctx.page.drawCircle({ x: cx, y: cy, size: R - 8, color: C.surface });
  const pctTxt = `${eficiencia.toFixed(1)}%`;
  const ptw = ctx.bold.widthOfTextAtSize(pctTxt, 17);
  drawText(ctx, pctTxt, cx - ptw / 2, cy - 3, { size: 17, bold: true, color: ringColor });
  const sub = "EFICIENCIA";
  const sw = ctx.bold.widthOfTextAtSize(sub, 6.5);
  drawText(ctx, sub, cx - sw / 2, cy - 18, { size: 6.5, bold: true, color: C.muted });

  // Insight IA
  const insight = dineroPagado > 0
    ? `Has pagado ${moneyShort(dineroPagado)} y solo el ${eficiencia.toFixed(1)}% ha reducido tu deuda real.`
    : "Aún no hay historial de pagos suficiente para diagnóstico.";
  const lines = wrapLines(ctx.font, insight, 8.5, w - 240);
  drawText(ctx, "NUVIA AI INSIGHT", leftX, ctx.y - h + 32, { size: 6.5, bold: true, color: C.accent });
  lines.forEach((ln, i) => {
    drawText(ctx, ln, leftX, ctx.y - h + 18 - i * 11, { size: 8.5, color: C.textDim, maxW: w - 240 });
  });

  ctx.y -= h + 14;
}

// ───────────────── TERMÓMETRO DE CAPACIDAD ─────────────────
function drawTermometro(ctx: Ctx, d: CaseSnapshotDTO) {
  const ing = (d.cliente.ingresos || 0) + (d.cliente.otrosIngresos || 0);
  if (ing <= 0) return;
  const cuota = d.credito.cuotaActual || 0;
  const nuevaCuota = d.propuesta.nuevaCuota || cuota;
  const capMax = ing * 0.4;
  const capRest = Math.max(capMax - cuota, 0);
  const max = Math.max(ing, cuota, nuevaCuota, capMax) * 1.05;

  const bars = [
    { l: "Ingreso mensual", v: ing, c: C.primaryHi },
    { l: "Cuota actual", v: cuota, c: C.red },
    { l: "Nueva cuota propuesta", v: nuevaCuota, c: C.accent },
    { l: "Capacidad restante", v: capRest, c: C.gold },
  ];

  const rowH = 26;
  const h = 28 + bars.length * rowH + 8;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  drawText(ctx, "TERMÓMETRO DE CAPACIDAD", MARGIN + 18, ctx.y - 18, { size: 7.5, bold: true, color: C.accent });

  const barX = MARGIN + 170;
  const barMaxW = w - 170 - 110;
  bars.forEach((b, i) => {
    const y = ctx.y - 40 - i * rowH;
    drawText(ctx, b.l.toUpperCase(), MARGIN + 18, y - 4, { size: 7, bold: true, color: C.muted });
    ctx.page.drawRectangle({ x: barX, y: y - 8, width: barMaxW, height: 8, color: C.bgSoft, borderColor: C.borderSoft, borderWidth: 0.5 });
    const fillW = max > 0 ? (b.v / max) * barMaxW : 0;
    if (fillW > 0) ctx.page.drawRectangle({ x: barX, y: y - 8, width: fillW, height: 8, color: b.c });
    drawText(ctx, moneyShort(b.v), barX + barMaxW + 8, y - 6, { size: 8.5, bold: true, color: C.text });
  });
  ctx.y -= h + 14;
}

// ───────────────── BADGES + IA BOX (sobre propuesta) ─────────────────
function drawPropuestaInsight(ctx: Ctx, d: CaseSnapshotDTO) {
  const ahorro = d.propuesta.ahorroTotal || 0;
  const ing = (d.cliente.ingresos || 0) + (d.cliente.otrosIngresos || 0);
  const nueva = d.propuesta.nuevaCuota || 0;
  const capRatio = ing > 0 ? (nueva / ing) * 100 : 0;
  const badges: Array<{ l: string; c: RGB }> = [];
  if (ahorro > 0) badges.push({ l: "OPTIMIZACIÓN VIABLE", c: C.accent });
  if (ing > 0 && capRatio <= 35) badges.push({ l: "CAPACIDAD SALUDABLE", c: C.accent });
  if ((d.credito.vecesPagado || 0) < 2) badges.push({ l: "BAJO RIESGO", c: C.primaryHi });
  if (!badges.length) return;
  ensure(ctx, 70, d);
  let x = MARGIN;
  badges.forEach((b) => {
    const tw = ctx.bold.widthOfTextAtSize(b.l, 7) + 16;
    ctx.page.drawRectangle({ x, y: ctx.y - 18, width: tw, height: 16, color: b.c, opacity: 0.16, borderColor: b.c, borderWidth: 0.5 });
    drawText(ctx, b.l, x + 8, ctx.y - 14, { size: 7, bold: true, color: b.c });
    x += tw + 6;
  });
  ctx.y -= 26;
  const msg = "NUVIA recomienda este escenario por equilibrio entre ahorro y flujo de caja sostenible.";
  const lines = wrapLines(ctx.font, msg, 9, PAGE_W - MARGIN * 2 - 36);
  const h = 22 + lines.length * 12;
  card(ctx, MARGIN, ctx.y - h, PAGE_W - MARGIN * 2, h, { fill: C.bgSoft });
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - h, width: 2, height: h, color: C.accent });
  drawText(ctx, "RECOMENDACIÓN NUVIA AI", MARGIN + 14, ctx.y - 14, { size: 6.8, bold: true, color: C.accent });
  lines.forEach((ln, i) => drawText(ctx, ln, MARGIN + 14, ctx.y - 28 - i * 12, { size: 9, color: C.textDim }));
  ctx.y -= h + 12;
}

// ───────────────── SOPORTE LEGAL Y NORMATIVO ─────────────────
function drawSoporteLegal(ctx: Ctx, d: CaseSnapshotDTO) {
  const items = [
    { ref: "LEY 546 · ART 17 #8", t: "Prepago parcial sin penalidad", desc: "Derecho a abonos a capital sin sanciones ni cobros adicionales." },
    { ref: "LEY 546 · ART 17 #8", t: "Reducción de plazo", desc: "El deudor puede solicitar reducción de plazo manteniendo la cuota." },
    { ref: "LEY 546 · ART 2 #5", t: "Protección de capacidad de pago", desc: "El sistema debe preservar la estabilidad financiera del deudor." },
    { ref: "DECRETO 583 / 2025", t: "Capacidad hasta 40%", desc: "Endeudamiento hipotecario máximo del 40% del ingreso del hogar." },
  ];
  const cols = 2;
  const gap = 10;
  const w = (PAGE_W - MARGIN * 2 - gap) / cols;
  const h = 78;
  const rows = Math.ceil(items.length / cols);
  ensure(ctx, rows * h + (rows - 1) * gap + 6, d);
  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = MARGIN + col * (w + gap);
    const y = ctx.y - (row + 1) * h - row * gap;
    card(ctx, x, y, w, h, { fill: C.surface });
    ctx.page.drawRectangle({ x, y, width: 2, height: h, color: C.gold });
    drawText(ctx, it.ref, x + 14, y + h - 16, { size: 6.5, bold: true, color: C.gold });
    drawText(ctx, it.t, x + 14, y + h - 34, { size: 11, bold: true, color: C.text, maxW: w - 24 });
    const lines = wrapLines(ctx.font, it.desc, 8, w - 28);
    lines.slice(0, 2).forEach((ln, j) => drawText(ctx, ln, x + 14, y + 22 - j * 10, { size: 8, color: C.textDim }));
  });
  ctx.y -= rows * h + (rows - 1) * gap + 14;
}

// ───────────────── IMPACTO FUTURO (timeline) ─────────────────
function drawImpactoFuturo(ctx: Ctx, d: CaseSnapshotDTO) {
  const pendientes = d.credito.cuotasPendientes || 0;
  const eliminadas = d.propuesta.cuotasEliminadas || 0;
  if (!pendientes && !eliminadas) return;
  const hoy = new Date();
  const finOriginal = new Date(hoy); finOriginal.setMonth(finOriginal.getMonth() + pendientes);
  const finOptimizado = new Date(hoy); finOptimizado.setMonth(finOptimizado.getMonth() + Math.max(pendientes - eliminadas, 0));
  const aniosRec = eliminadas / 12;

  const h = 120;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  drawText(ctx, "IMPACTO FUTURO · INVESTMENT TIMELINE", MARGIN + 18, ctx.y - 18, { size: 7.5, bold: true, color: C.accent });

  const trackY = ctx.y - 58;
  const startX = MARGIN + 40;
  const endX = PAGE_W - MARGIN - 40;
  const totalW = endX - startX;
  ctx.page.drawRectangle({ x: startX, y: trackY - 1, width: totalW, height: 2, color: C.borderSoft });
  const optW = pendientes > 0 ? totalW * (Math.max(pendientes - eliminadas, 0) / pendientes) : totalW;
  ctx.page.drawRectangle({ x: startX, y: trackY - 1, width: optW, height: 2, color: C.accent });

  const points = [
    { x: startX, label: "HOY", date: fmtDate(hoy.toISOString()), color: C.text },
    { x: startX + optW, label: "CON NUVIA", date: fmtDate(finOptimizado.toISOString()), color: C.accent },
    { x: endX, label: "SIN NUVIA", date: fmtDate(finOriginal.toISOString()), color: C.red },
  ];
  points.forEach((p) => {
    ctx.page.drawCircle({ x: p.x, y: trackY, size: 5, color: C.surface });
    ctx.page.drawCircle({ x: p.x, y: trackY, size: 4, color: p.color });
    const lw = ctx.bold.widthOfTextAtSize(p.label, 7);
    drawText(ctx, p.label, p.x - lw / 2, trackY + 10, { size: 7, bold: true, color: p.color });
    const dw = ctx.font.widthOfTextAtSize(p.date, 7);
    drawText(ctx, p.date, p.x - dw / 2, trackY - 14, { size: 7, color: C.muted });
  });

  const metrics = [
    { l: "AÑOS RECUPERADOS", v: aniosRec > 0 ? `${aniosRec.toFixed(1)} años` : "—" },
    { l: "CUOTAS ELIMINADAS", v: eliminadas ? `${eliminadas}` : "—" },
    { l: "AHORRO TOTAL", v: moneyShort(d.propuesta.ahorroTotal) },
  ];
  const colW = (w - 36) / 3;
  metrics.forEach((m, i) => {
    const mx = MARGIN + 18 + i * colW;
    drawText(ctx, m.l, mx, ctx.y - h + 30, { size: 6.5, bold: true, color: C.muted });
    drawText(ctx, m.v, mx, ctx.y - h + 14, { size: 11, bold: true, color: C.accent });
  });
  ctx.y -= h + 14;
}

// ───────────────── HONORARIOS ─────────────────
function drawHonorarios(ctx: Ctx, d: CaseSnapshotDTO) {
  const honor = d.honorarios.pactados || 0;
  const ahorro = d.propuesta.ahorroTotal || 0;
  const roi = honor > 0 ? ahorro / honor : 0;
  const h = 70;
  ensure(ctx, h + 70, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  const colW = w / 4;
  const items = [
    { l: "HONORARIO APROBADO", v: money(honor), c: C.accent },
    { l: "PORCENTAJE", v: pct(d.honorarios.porcentaje), c: C.text },
    { l: "ESTADO COBRO", v: safe(d.honorarios.estadoCobro).toUpperCase(), c: C.textDim },
    { l: "PAZ Y SALVO", v: d.honorarios.pazYSalvo ? "SÍ" : "PENDIENTE", c: d.honorarios.pazYSalvo ? C.accent : C.amber },
  ];
  items.forEach((it, i) => {
    const x = MARGIN + i * colW;
    if (i > 0) ctx.page.drawRectangle({ x, y: ctx.y - h + 14, width: 0.5, height: h - 28, color: C.borderSoft });
    drawText(ctx, it.l, x + 16, ctx.y - 22, { size: 6.8, bold: true, color: C.muted });
    drawText(ctx, it.v, x + 16, ctx.y - 48, { size: 13, bold: true, color: it.c, maxW: colW - 22 });
  });
  ctx.y -= h + 10;

  if (roi > 0) {
    const rh = 56;
    card(ctx, MARGIN, ctx.y - rh, w, rh, { fill: C.bgSoft });
    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - rh, width: 3, height: rh, color: C.accent });
    drawText(ctx, "ROI DEL SERVICIO NUVIA", MARGIN + 16, ctx.y - 16, { size: 7, bold: true, color: C.accent });
    const big = `${roi.toFixed(1)}×`;
    drawText(ctx, big, MARGIN + 16, ctx.y - 44, { size: 22, bold: true, color: C.accent });
    const tx = MARGIN + 16 + ctx.bold.widthOfTextAtSize(big, 22) + 16;
    drawText(ctx, `Por cada $1 invertido en honorarios, el cliente recupera $${roi.toFixed(2)}.`,
      tx, ctx.y - 30, { size: 10, bold: true, color: C.text, maxW: w - (tx - MARGIN) - 20 });
    drawText(ctx, `Ahorro total ${money(ahorro)} · Honorario ${money(honor)}`,
      tx, ctx.y - 44, { size: 8, color: C.textDim, maxW: w - (tx - MARGIN) - 20 });
    ctx.y -= rh + 14;
  } else {
    ctx.y -= 4;
  }
}

// ───────────────── TIMELINE OPERATIVO ─────────────────
function drawTimeline(ctx: Ctx, d: CaseSnapshotDTO) {
  const items = d.timeline;
  if (!items.length) return;
  const h = 92;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  const usable = w - 60;
  const step = items.length > 1 ? usable / (items.length - 1) : 0;
  const baseY = ctx.y - 46;
  // línea base
  ctx.page.drawRectangle({ x: MARGIN + 30, y: baseY - 0.5, width: usable, height: 1, color: C.borderSoft });
  // línea hecho (verde) hasta el último "hecho"
  const lastDone = items.reduce((acc, it, i) => it.estado === "hecho" || it.estado === "curso" ? i : acc, -1);
  if (lastDone >= 0) {
    ctx.page.drawRectangle({ x: MARGIN + 30, y: baseY - 0.5, width: step * lastDone, height: 1.5, color: C.accent });
  }
  items.forEach((it, i) => {
    const cx = MARGIN + 30 + step * i;
    const color = it.estado === "hecho" ? C.accent : it.estado === "curso" ? C.amber : C.dim;
    ctx.page.drawCircle({ x: cx, y: baseY, size: 5, color: C.surface });
    ctx.page.drawCircle({ x: cx, y: baseY, size: 4, color });
    if (it.estado === "hecho") ctx.page.drawCircle({ x: cx, y: baseY, size: 1.6, color: C.surface });
    // label
    const lbl = it.etiqueta;
    const lw = ctx.font.widthOfTextAtSize(lbl, 6.8);
    drawText(ctx, lbl, cx - lw / 2, baseY - 16, { size: 6.8, color: C.textDim });
  });
  // Title
  drawText(ctx, "RECORRIDO OPERATIVO DEL CASO", MARGIN + 18, ctx.y - 18, { size: 7, bold: true, color: C.muted });
  ctx.y -= h + 14;
}

// ───────────────── INTERVINIENTES ─────────────────
function drawIntervinientes(ctx: Ctx, d: CaseSnapshotDTO) {
  const list = d.intervinientes;
  if (!list.length) return;
  const rowH = 28;
  const h = 14 + list.length * rowH + 8;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  drawText(ctx, "EQUIPO DEL CASO", MARGIN + 16, ctx.y - 16, { size: 7, bold: true, color: C.muted });
  list.forEach((p, i) => {
    const y = ctx.y - 30 - i * rowH;
    // avatar dot con iniciales
    const inits = safe(p.nombre).split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "—";
    ctx.page.drawCircle({ x: MARGIN + 28, y: y - 5, size: 10, color: C.surfaceHi, borderColor: C.accent, borderWidth: 0.5 });
    const iw = ctx.bold.widthOfTextAtSize(inits, 8);
    drawText(ctx, inits, MARGIN + 28 - iw / 2, y - 8, { size: 8, bold: true, color: C.accent });
    drawText(ctx, safe(p.nombre), MARGIN + 48, y - 4, { size: 10, bold: true, color: C.text, maxW: 260 });
    drawText(ctx, safe(p.email), MARGIN + 48, y - 16, { size: 7.5, color: C.muted, maxW: 260 });
    // rol pill
    const rol = p.rol.toUpperCase();
    const rw = ctx.bold.widthOfTextAtSize(rol, 7) + 14;
    ctx.page.drawRectangle({ x: PAGE_W - MARGIN - rw - 12, y: y - 12, width: rw, height: 14, color: C.bgSoft, borderColor: C.borderSoft, borderWidth: 0.5 });
    drawText(ctx, rol, PAGE_W - MARGIN - rw - 5, y - 9, { size: 7, bold: true, color: C.textDim });
  });
  ctx.y -= h + 14;
}

// ───────────────── TRAZABILIDAD (timeline vertical) ─────────────────
function humanizeAccion(raw: string): string {
  if (!raw || raw === "—") return "Movimiento del caso";
  const t = raw.toLowerCase().replace(/_/g, " ");
  const map: Record<string, string> = {
    "lead creado": "Caso creado",
    "simulado": "Simulación financiera completada",
    "qa aprobado": "QA aprobado por dirección financiera",
    "contrato firmado": "Contrato comercial firmado",
    "poder firmado": "Poder especial firmado",
    "checklist completo": "Checklist documental completo",
    "radicado": "Caso radicado en el banco",
    "respuesta banco": "Respuesta del banco recibida",
    "informe final": "Informe final generado",
    "cuenta cobro": "Cuenta de cobro emitida",
    "paz y salvo": "Paz y salvo entregado",
    "cerrado": "Caso cerrado",
  };
  for (const k of Object.keys(map)) if (t.includes(k)) return map[k];
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
}

function drawTrazabilidad(ctx: Ctx, d: CaseSnapshotDTO) {
  const list = d.trazabilidad;
  if (!list.length) return;
  const items = list.slice(0, 8);
  const rowH = 38;
  const h = 18 + items.length * rowH + 6;
  ensure(ctx, h + 8, d);
  const w = PAGE_W - MARGIN * 2;
  card(ctx, MARGIN, ctx.y - h, w, h, { fill: C.surface });
  drawText(ctx, "TRAZABILIDAD HUMANA", MARGIN + 16, ctx.y - 16, { size: 7, bold: true, color: C.muted });

  const railX = MARGIN + 30;
  ctx.page.drawRectangle({ x: railX, y: ctx.y - h + 12, width: 0.5, height: h - 28, color: C.borderSoft });

  items.forEach((t, i) => {
    const y = ctx.y - 32 - i * rowH;
    ctx.page.drawCircle({ x: railX, y: y - 4, size: 4, color: C.accent });
    ctx.page.drawCircle({ x: railX, y: y - 4, size: 2, color: C.surface });
    drawText(ctx, humanizeAccion(t.accion), railX + 12, y, { size: 9.5, bold: true, color: C.text, maxW: w - 80 });
    drawText(ctx, `${fmtDateTime(t.fecha)}  ·  ${safe(t.usuario)}`, railX + 12, y - 14, { size: 7.5, color: C.muted, maxW: w - 80 });
  });
  ctx.y -= h + 14;
}

// ───────────────── ORQUESTADOR ─────────────────
export async function generarCaseSnapshotPdf(d: CaseSnapshotDTO): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc, page: doc.addPage([PAGE_W, PAGE_H]),
    font, bold, y: PAGE_H, pageNum: 1,
  };

  // PORTADA
  drawCover(ctx, d);

  // P2 — FOTO DEL CRÉDITO
  newPage(ctx, d);
  sectionTitle(ctx, "01 · Snapshot del crédito", "Foto completa del crédito vigente", d);
  drawCreditKpis(ctx, d);
  drawHeroVeces(ctx, d);
  drawCreditSubMetrics(ctx, d);

  // DIAGNÓSTICO
  sectionTitle(ctx, "02 · Diagnóstico NUVIA AI", "Lectura inteligente del caso", d);
  drawDiagnostico(ctx, d);

  // PROPUESTA
  newPage(ctx, d);
  sectionTitle(ctx, "03 · Propuesta seleccionada", "Reconstrucción financiera recomendada", d);
  drawPropuesta(ctx, d);

  // HONORARIOS
  sectionTitle(ctx, "04 · Honorarios", "Modelo comercial del caso", d);
  drawHonorarios(ctx, d);

  // OPERATIVO
  sectionTitle(ctx, "05 · Estado operativo", "Recorrido de gestión del caso", d);
  drawTimeline(ctx, d);

  // EQUIPO + TRAZABILIDAD
  newPage(ctx, d);
  sectionTitle(ctx, "06 · Equipo del caso", "Intervinientes responsables", d);
  drawIntervinientes(ctx, d);

  sectionTitle(ctx, "07 · Trazabilidad", "Eventos relevantes del expediente", d);
  drawTrazabilidad(ctx, d);

  // Calcular total páginas y re-pintar footers
  ctx.totalPages = ctx.pageNum;
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    // sobreescribir paginación visible en footer
    const pageStr = `${i + 1} / ${pages.length}`;
    const pw = bold.widthOfTextAtSize(pageStr, 7);
    // tapar la zona derecha del footer con un rectángulo del color surface
    p.drawRectangle({ x: PAGE_W - MARGIN - 50, y: 4, width: 50, height: 18, color: C.surface });
    p.drawText(pageStr, { x: PAGE_W - MARGIN - pw, y: 10, size: 7, font: bold, color: C.textDim });
  });

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
