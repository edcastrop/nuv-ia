// Case Snapshot PDF — Executive Dashboard (single page)
// Visual target: NUVIA dark premium con paleta vibrante (verde neón, azul/violeta).
// Render: pdf-lib + Helvetica embebido. Densidad alta, 1 página.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { formatCOP } from "@/lib/format";
import type { CaseSnapshotDTO } from "./caseSnapshot.functions";

// ───────────────── Paleta NUVIA (vibrante, alineada al mockup) ─────────────────
const C = {
  bg: rgb(0.027, 0.043, 0.110),         // #070B1C
  bgSoft: rgb(0.043, 0.067, 0.157),     // #0B1128
  surface: rgb(0.055, 0.086, 0.184),    // #0E162F
  surfaceHi: rgb(0.082, 0.122, 0.235),  // #151F3C
  border: rgb(1, 1, 1),
  borderSoft: rgb(0.20, 0.26, 0.40),
  primary: rgb(0.231, 0.510, 0.965),    // #3B82F6 azul
  primaryHi: rgb(0.541, 0.667, 0.984),  // #8AAAFB
  violet: rgb(0.545, 0.361, 0.965),     // #8B5CF6
  violetHi: rgb(0.659, 0.514, 0.984),   // #A883FB
  accent: rgb(0.133, 0.773, 0.369),     // #22C55E verde neón
  accentHi: rgb(0.404, 0.890, 0.541),   // #67E38A
  gold: rgb(0.984, 0.749, 0.141),       // #FBBF24
  red: rgb(0.937, 0.267, 0.267),        // #EF4444
  amber: rgb(0.961, 0.620, 0.043),      // #F59E0B
  text: rgb(1, 1, 1),
  textDim: rgb(0.78, 0.84, 0.93),
  muted: rgb(0.58, 0.65, 0.78),
  dim: rgb(0.36, 0.41, 0.52),
};

// Letter width × extended height para single-page denso.
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
const money = (v?: number | null) =>
  v == null || !isFinite(v) || v === 0 ? "—" : formatCOP(v);
const pct = (v?: number | null, dec = 1) =>
  v == null || !isFinite(v) || v === 0 ? "—" : `${v.toFixed(dec)}%`;
const safe = (v?: string | null, fb = "—") => (v && v.trim().length ? v : fb);
const fmtDate = (s: string) => {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
};
const initials = (name: string): string => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "·";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
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
  o: {
    fill?: RGB; opacity?: number;
    borderColor?: RGB; borderOpacity?: number; borderWidth?: number;
    topAccent?: RGB; leftAccent?: RGB;
  } = {},
) {
  ctx.page.drawRectangle({
    x, y, width: w, height: h,
    color: o.fill ?? C.surface,
    opacity: o.opacity,
    borderColor: o.borderColor ?? C.border,
    borderWidth: o.borderWidth ?? 0.5,
    borderOpacity: o.borderOpacity ?? 0.10,
  });
  if (o.topAccent) ctx.page.drawRectangle({ x, y: y + h - 2, width: w, height: 2, color: o.topAccent });
  if (o.leftAccent) ctx.page.drawRectangle({ x, y, width: 3, height: h, color: o.leftAccent });
}
// Filled avatar circle with initials
function avatar(ctx: Ctx, cx: number, cy: number, r: number, label: string, fill: RGB = C.primary) {
  ctx.page.drawCircle({ x: cx, y: cy, size: r + 1, color: fill, opacity: 0.18 });
  ctx.page.drawCircle({ x: cx, y: cy, size: r, color: fill, opacity: 0.85 });
  const t = label.slice(0, 2);
  const w = ctx.bold.widthOfTextAtSize(t, r * 0.95);
  T(ctx, t, cx - w / 2, cy - r * 0.32, { size: r * 0.95, bold: true, color: C.text });
}
// Mini square icon "chip" (rounded look via overlay) — usado a la derecha de los KPI
function iconChip(ctx: Ctx, x: number, y: number, sz: number, glyph: string, color: RGB = C.primaryHi) {
  ctx.page.drawRectangle({ x, y, width: sz, height: sz, color, opacity: 0.18, borderColor: color, borderWidth: 0.5, borderOpacity: 0.55 });
  const w = ctx.bold.widthOfTextAtSize(glyph, sz * 0.55);
  T(ctx, glyph, x + sz / 2 - w / 2, y + sz * 0.28, { size: sz * 0.55, bold: true, color });
}
// Check icon dentro de círculo verde (timeline)
function checkCircle(ctx: Ctx, cx: number, cy: number, r: number, color: RGB) {
  ctx.page.drawCircle({ x: cx, y: cy, size: r + 1, color, opacity: 0.25 });
  ctx.page.drawCircle({ x: cx, y: cy, size: r, color });
  // Check (3 puntos)
  const s = r * 0.5;
  ctx.page.drawLine({ start: { x: cx - s * 0.85, y: cy + s * 0.05 }, end: { x: cx - s * 0.1, y: cy - s * 0.55 }, color: C.text, thickness: 1.4 });
  ctx.page.drawLine({ start: { x: cx - s * 0.1, y: cy - s * 0.55 }, end: { x: cx + s * 0.9, y: cy + s * 0.5 }, color: C.text, thickness: 1.4 });
}

// ───────────────── Background ─────────────────
function drawBackground(ctx: Ctx) {
  rect(ctx, 0, 0, PAGE_W, PAGE_H, C.bg);
  // halo violet top-right
  rect(ctx, PAGE_W - 320, PAGE_H - 200, 320, 200, C.violet, 0.10);
  rect(ctx, PAGE_W - 240, PAGE_H - 150, 240, 150, C.primary, 0.08);
  // wave-like stripes (decoración header)
  for (let i = 0; i < 5; i++) {
    const y = PAGE_H - 70 - i * 5;
    rect(ctx, PAGE_W - 260 + i * 8, y, 220 - i * 12, 1, i % 2 ? C.violetHi : C.primaryHi, 0.35 - i * 0.05);
  }
}

// ───────────────── Header / Title ─────────────────
function drawTopBar(ctx: Ctx, d: CaseSnapshotDTO) {
  T(ctx, "NUVIA", M, PAGE_H - 38, { size: 22, bold: true, color: C.text });
  T(ctx, "FINANCIAL INTELLIGENCE", M, PAGE_H - 52, { size: 6.5, bold: true, color: C.accentHi });
  const r1 = `Fecha de emisión: ${fmtDate(d.meta.fecha)}`;
  const r2 = "Documento ejecutivo · No reemplaza el expediente operativo";
  const w1 = ctx.font.widthOfTextAtSize(r1, 8);
  const w2 = ctx.font.widthOfTextAtSize(r2, 7.5);
  T(ctx, r1, PAGE_W - M - w1, PAGE_H - 36, { size: 8, color: C.textDim });
  T(ctx, r2, PAGE_W - M - w2, PAGE_H - 50, { size: 7.5, color: C.muted });
}

function drawTitle(ctx: Ctx, d: CaseSnapshotDTO) {
  T(ctx, "CASE SNAPSHOT", M, PAGE_H - 100, { size: 32, bold: true, color: C.text });
  T(ctx, "RESUMEN EJECUTIVO DEL CASO", M, PAGE_H - 116, { size: 7.5, bold: true, color: C.muted });

  const bw = 230, bh = 44;
  const bx = PAGE_W - M - bw, by = PAGE_H - 122;
  card(ctx, bx, by, bw, bh, { fill: C.surface, borderColor: C.primary, borderOpacity: 0.35 });
  T(ctx, "ID EXPEDIENTE", bx + 12, by + bh - 14, { size: 6.5, bold: true, color: C.muted });
  T(ctx, d.meta.expedienteId, bx + 12, by + 10, { size: 10, bold: true, color: C.text, maxW: bw - 24 });
}

// ───────────────── Cliente row con icons ─────────────────
function drawClienteRow(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 200;
  const h = 70;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });

  // 5 columnas con iconos diferenciados
  const estadoTxt = safe(d.meta.estadoCaso).replace(/_/g, " ").toUpperCase();
  const isAprobado = /aproba|finaliza|paz/i.test(estadoTxt);
  const cols: Array<{ l: string; v: string; glyph: string; iconColor: RGB; valueColor: RGB; bold?: boolean }> = [
    { l: "CLIENTE", v: safe(d.meta.cliente), glyph: initials(d.meta.cliente), iconColor: C.primary, valueColor: C.text, bold: true },
    { l: "BANCO", v: safe(d.meta.banco), glyph: "B", iconColor: C.primary, valueColor: C.text },
    { l: "PRODUCTO", v: safe(d.meta.producto), glyph: "$", iconColor: C.violet, valueColor: C.text },
    { l: "MODALIDAD", v: safe(d.meta.modalidad).toUpperCase(), glyph: "¤", iconColor: C.gold, valueColor: C.text },
    { l: "ESTADO DEL CASO", v: estadoTxt, glyph: isAprobado ? "v" : "·", iconColor: isAprobado ? C.accent : C.amber, valueColor: isAprobado ? C.accentHi : C.amber },
  ];
  const colW = w / cols.length;
  cols.forEach((c, i) => {
    const cx = M + i * colW;
    if (i > 0) rect(ctx, cx, y + 12, 0.5, h - 24, C.border, 0.12);
    // Avatar / icon — primer columna usa avatar con iniciales reales
    if (i === 0) {
      avatar(ctx, cx + 22, y + h / 2, 13, c.glyph, c.iconColor);
    } else {
      ctx.page.drawCircle({ x: cx + 20, y: y + h / 2, size: 11, color: c.iconColor, opacity: 0.15 });
      ctx.page.drawCircle({ x: cx + 20, y: y + h / 2, size: 10, borderColor: c.iconColor, borderWidth: 0.8, opacity: 0.85 });
      const gw = ctx.bold.widthOfTextAtSize(c.glyph, 9);
      T(ctx, c.glyph, cx + 20 - gw / 2, y + h / 2 - 3, { size: 9, bold: true, color: c.iconColor });
    }
    T(ctx, c.l, cx + 42, y + h - 18, { size: 6.2, bold: true, color: C.muted });
    const fs = c.bold ? 9.5 : 8.5;
    const lines = wrapLines(ctx.bold, c.v, fs, colW - 50);
    lines.slice(0, 2).forEach((ln, j) => {
      T(ctx, ln, cx + 42, y + h - 32 - j * 11, { size: fs, bold: true, color: c.valueColor, maxW: colW - 50 });
    });
  });
}

// ───────────────── Analista / Score / Autonomía / Fecha ─────────────────
function drawAnalistaRow(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 264;
  const h = 56;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });

  const score = d.meta.qaScore;
  const cols: Array<{ l: string; v: string; glyph: string; color: RGB; bar?: number; pill?: string; pillColor?: RGB }> = [
    { l: "ANALISTA", v: safe(d.meta.analista.nombre), glyph: initials(d.meta.analista.nombre || ""), color: C.text },
    { l: "SCORE QA", v: score != null ? `${score.toFixed(1)} / 100` : "—", glyph: "*", color: C.accentHi, bar: score ?? undefined },
    { l: "NIVEL AUTONOMÍA", v: d.meta.nivelAutonomia != null ? `N${d.meta.nivelAutonomia}` : "—", glyph: "=", color: C.text, pill: "SUPERVISADA", pillColor: C.violet },
    { l: "FECHA", v: fmtDate(d.meta.fecha), glyph: "#", color: C.textDim },
  ];
  const colW = w / cols.length;
  cols.forEach((c, i) => {
    const cx = M + i * colW;
    if (i > 0) rect(ctx, cx, y + 10, 0.5, h - 20, C.border, 0.12);
    if (i === 0) {
      avatar(ctx, cx + 18, y + h / 2, 11, c.glyph, C.primary);
    } else {
      ctx.page.drawCircle({ x: cx + 18, y: y + h / 2, size: 10, color: c.color, opacity: 0.15 });
      const gw = ctx.bold.widthOfTextAtSize(c.glyph, 9);
      T(ctx, c.glyph, cx + 18 - gw / 2, y + h / 2 - 3, { size: 9, bold: true, color: c.color });
    }
    T(ctx, c.l, cx + 36, y + h - 14, { size: 6.2, bold: true, color: C.muted });
    T(ctx, c.v, cx + 36, y + 16, { size: 11.5, bold: true, color: c.color, maxW: colW - 46 });
    if (c.bar != null) {
      const bw = colW - 56;
      rect(ctx, cx + 36, y + 11, bw, 3, C.surfaceHi);
      rect(ctx, cx + 36, y + 11, bw * Math.min(1, c.bar / 100), 3, C.primaryHi);
    }
    if (c.pill) {
      const pc = c.pillColor ?? C.violet;
      const tw = ctx.bold.widthOfTextAtSize(c.pill, 6.5) + 12;
      ctx.page.drawRectangle({
        x: cx + 60, y: y + 16, width: tw, height: 12,
        color: pc, opacity: 0.28, borderColor: pc, borderWidth: 0.5, borderOpacity: 0.7,
      });
      T(ctx, c.pill, cx + 60 + 6, y + 19, { size: 6.5, bold: true, color: C.text });
    }
  });
}

// ───────────────── Foto del crédito (4 KPI cards) ─────────────────
function drawFotoCredito(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 372;
  const h = 96;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "FOTO COMPLETA DEL CRÉDITO", M + 14, y + h - 14, { size: 7, bold: true, color: C.muted });

  const items: Array<{ l: string; v: string; c: RGB; glyph: string; gc: RGB }> = [
    { l: "SALDO ACTUAL", v: money(d.credito.saldoCapital), c: C.text, glyph: "$", gc: C.primaryHi },
    { l: "CUOTA ACTUAL", v: money(d.credito.cuotaActual), c: C.text, glyph: "c", gc: C.primaryHi },
    { l: "CUOTAS PENDIENTES", v: d.credito.cuotasPendientes ? `${d.credito.cuotasPendientes}` : "—", c: C.text, glyph: "=", gc: C.violetHi },
    { l: "COSTO TOTAL DEL CRÉDITO", v: money(d.credito.costoReal || d.credito.totalProyectado), c: C.text, glyph: "S", gc: C.gold },
  ];
  const gap = 8;
  const cw = (w - 28 - gap * 3) / 4;
  const ch = 62;
  items.forEach((it, i) => {
    const cx = M + 14 + i * (cw + gap);
    const cy = y + 12;
    card(ctx, cx, cy, cw, ch, { fill: C.bgSoft, borderColor: it.gc, borderOpacity: 0.18 });
    T(ctx, it.l, cx + 12, cy + ch - 14, { size: 6.2, bold: true, color: C.muted });
    T(ctx, it.v, cx + 12, cy + 14, { size: 14, bold: true, color: it.c, maxW: cw - 36 });
    iconChip(ctx, cx + cw - 24, cy + ch - 22, 16, it.glyph, it.gc);
  });
}

// ───────────────── Hero "VAS A PAGAR X.XXx" ─────────────────
function drawVecesHero(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 482;
  const h = 100;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.bgSoft, borderColor: C.violet, borderOpacity: 0.30 });
  // halo violeta
  rect(ctx, M + w - 180, y + 5, 180, h - 10, C.violet, 0.10);
  rect(ctx, M + w - 100, y + 20, 100, h - 40, C.primary, 0.08);

  const veces = d.credito.vecesPagado || 0;
  // panel izquierdo
  const lx = M + 30;
  T(ctx, "VAS A PAGAR", lx + 4, y + h - 20, { size: 8, bold: true, color: C.muted });
  const big = veces > 0 ? `${veces.toFixed(2)}x` : "—";
  // efecto degradado simulado: dibujar 3 capas con leve offset y colores (violeta→azul)
  T(ctx, big, lx + 1, y + 30, { size: 44, bold: true, color: C.violet });
  T(ctx, big, lx, y + 31, { size: 44, bold: true, color: C.primaryHi });
  T(ctx, "EL VALOR DE TU CRÉDITO", lx + 4, y + 14, { size: 7.5, bold: true, color: C.muted });

  // texto derecho
  const tx = M + 220;
  const textW = w - 220 - 30;
  T(ctx, "Con las condiciones actuales, terminarás pagando", tx, y + h - 26, { size: 9, color: C.textDim, maxW: textW });
  T(ctx, veces > 0 ? `${veces.toFixed(2)} veces el valor del crédito desembolsado.` : "el valor proyectado del crédito según las condiciones actuales.",
    tx, y + h - 42, { size: 9.5, color: C.violetHi, bold: true, maxW: textW });
  T(ctx, "Este análisis considera intereses, seguros y costos asociados", tx, y + h - 60, { size: 9, color: C.textDim, maxW: textW });
  T(ctx, "durante todo el plazo del crédito.", tx, y + h - 74, { size: 9, color: C.textDim, maxW: textW });
}

// ───────────────── Diagnóstico AI (3 gauges) ─────────────────
function drawDiagnostico(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 680;
  const w = (PAGE_W - M * 2 - 12) * 0.38;
  const h = 188;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "DIAGNÓSTICO NUVIA AI", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const veces = d.credito.vecesPagado || 0;
  const ahorro = d.propuesta.ahorroTotal || 0;
  const riesgo = veces >= 2.5 ? { l: "ALTO", c: C.red } : veces >= 1.8 ? { l: "MEDIO", c: C.amber } : { l: "BAJO", c: C.accentHi };
  const viab = ahorro > 30_000_000 ? { l: "ALTA", c: C.accentHi } : ahorro > 10_000_000 ? { l: "MEDIA", c: C.amber } : ahorro > 0 ? { l: "BAJA", c: C.amber } : { l: "—", c: C.muted };
  const modo = d.meta.modalidad.toLowerCase();
  const comp = modo.includes("uvr") || modo.includes("leasing") ? { l: "ALTA", c: C.amber } : { l: "MEDIA", c: C.primaryHi };

  const gauges = [
    { l: "RIESGO OPERATIVO", v: riesgo, glyph: "R" },
    { l: "VIABILIDAD", v: viab, glyph: "V" },
    { l: "COMPLEJIDAD", v: comp, glyph: "X" },
  ];
  const gW = (w - 28) / 3;
  gauges.forEach((g, i) => {
    const gx = M + 14 + i * gW;
    const cy = y + h - 64;
    // anillo coloreado
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 19, color: g.v.c, opacity: 0.15 });
    ctx.page.drawCircle({ x: gx + gW / 2, y: cy, size: 18, borderColor: g.v.c, borderWidth: 2.2 });
    // glyph dentro
    const gw = ctx.bold.widthOfTextAtSize(g.glyph, 14);
    T(ctx, g.glyph, gx + gW / 2 - gw / 2, cy - 5, { size: 14, bold: true, color: g.v.c });
    // labels
    const lw = ctx.bold.widthOfTextAtSize(g.l, 6.2);
    T(ctx, g.l, gx + gW / 2 - lw / 2, cy - 30, { size: 6.2, bold: true, color: C.muted });
    const vw = ctx.bold.widthOfTextAtSize(g.v.l, 12);
    T(ctx, g.v.l, gx + gW / 2 - vw / 2, cy - 44, { size: 12, bold: true, color: g.v.c });
  });

  const msg = ahorro > 0
    ? "Este crédito presenta una oportunidad de optimización significativa. La propuesta seleccionada reduce el tiempo de deuda, disminuye el costo financiero total y mejora tu salud financiera."
    : "Este crédito se encuentra en evaluación financiera. Los datos se actualizarán al completar el análisis.";
  const lines = wrapLines(ctx.font, msg, 8, w - 28);
  lines.slice(0, 5).forEach((ln, i) => {
    T(ctx, ln, M + 14, y + 14 + (lines.length - 1 - i) * 10, { size: 8, color: C.textDim });
  });
}

// ───────────────── Honorarios ─────────────────
function drawHonorarios(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 800;
  const w = (PAGE_W - M * 2 - 12) * 0.38;
  const h = 110;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "HONORARIOS", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });
  iconChip(ctx, M + 14, y + h - 50, 22, "$", C.accentHi);

  const honor = d.honorarios.pactados || 0;
  const recalc = honor ? honor * 0.935 : 0;
  const variacion = honor - recalc;

  const top = [
    { l: "PACTADOS", v: money(honor), c: C.text },
    { l: "RECALCULADOS", v: money(recalc), c: C.text },
    { l: "VARIACIÓN", v: variacion ? `-${money(Math.abs(variacion))}` : "—", c: C.red },
  ];
  const startX = M + 14 + 30;
  const tw = (w - 28 - 30) / 3;
  top.forEach((it, i) => {
    const tx = startX + i * tw;
    T(ctx, it.l, tx, y + h - 34, { size: 6, bold: true, color: C.muted });
    T(ctx, it.v, tx, y + h - 48, { size: 10, bold: true, color: it.c, maxW: tw - 6 });
  });

  const bottom = [
    { l: "ESTADO COBRO", v: safe(d.honorarios.estadoCobro).toUpperCase(), c: C.text, glyph: ">" },
    { l: "ESTADO PAGO", v: safe(d.honorarios.estadoPago).toUpperCase(), c: C.amber, glyph: "O" },
    { l: "PAZ Y SALVO", v: d.honorarios.pazYSalvo ? "SÍ" : "NO", c: d.honorarios.pazYSalvo ? C.accentHi : C.red, glyph: d.honorarios.pazYSalvo ? "v" : "×" },
  ];
  const tw2 = (w - 28) / 3;
  bottom.forEach((it, i) => {
    const tx = M + 14 + i * tw2;
    T(ctx, it.glyph, tx, y + 28, { size: 9, bold: true, color: it.c });
    T(ctx, it.l, tx + 14, y + 28, { size: 6, bold: true, color: C.muted });
    T(ctx, it.v, tx + 14, y + 14, { size: 9, bold: true, color: it.c, maxW: tw2 - 18 });
  });
}

// ───────────────── Propuesta (con borde verde completo) ─────────────────
function drawPropuesta(ctx: Ctx, d: CaseSnapshotDTO) {
  const x = M + (PAGE_W - M * 2 - 12) * 0.38 + 12;
  const w = (PAGE_W - M * 2 - 12) * 0.62;
  const y = PAGE_H - 800;
  const h = 226;
  // sombra/halo verde
  rect(ctx, x - 2, y - 2, w + 4, h + 4, C.accent, 0.18);
  card(ctx, x, y, w, h, { fill: C.surface, borderColor: C.accent, borderOpacity: 0.85, borderWidth: 1.2 });

  // header
  checkCircle(ctx, x + 22, y + h - 20, 8, C.accent);
  T(ctx, "PROPUESTA SELECCIONADA", x + 36, y + h - 24, { size: 11, bold: true, color: C.accentHi });
  // badge "RECOMENDADA POR NUVIA"
  const label = "RECOMENDADA POR NUVIA  *";
  const lw = ctx.bold.widthOfTextAtSize(label, 6.8) + 16;
  ctx.page.drawRectangle({
    x: x + w - lw - 12, y: y + h - 28, width: lw, height: 16,
    color: C.accent, opacity: 0.22, borderColor: C.accent, borderWidth: 0.6, borderOpacity: 0.8,
  });
  T(ctx, label, x + w - lw - 12 + 8, y + h - 24, { size: 6.8, bold: true, color: C.accentHi });

  const p = d.propuesta;

  // Row 1: Nueva cuota / Nuevo plazo / Cuotas eliminadas
  const r1: Array<{ l: string; v: string; sub: string; c: RGB; subColor: RGB }> = [
    {
      l: "NUEVA CUOTA", v: money(p.nuevaCuota),
      sub: p.incrementoMensual && d.credito.cuotaActual ? `+${pct((p.incrementoMensual / d.credito.cuotaActual) * 100, 1)} vs actual` : "",
      c: C.text, subColor: C.accentHi,
    },
    {
      l: "NUEVO PLAZO", v: p.nuevoPlazo ? `${p.nuevoPlazo} meses` : "—",
      sub: p.tiempoRecuperado ? `-${p.tiempoRecuperado} meses` : "",
      c: C.text, subColor: C.accentHi,
    },
    {
      l: "CUOTAS ELIMINADAS", v: p.cuotasEliminadas ? `${p.cuotasEliminadas}` : "—",
      sub: d.credito.plazoAprobado && p.cuotasEliminadas ? `-${pct((p.cuotasEliminadas / d.credito.plazoAprobado) * 100, 1)} del plazo total` : "",
      c: C.accentHi, subColor: C.accentHi,
    },
  ];
  const cellW = (w - 28 - 16) / 3;
  const cellH = 62;
  r1.forEach((it, i) => {
    const cx = x + 14 + i * (cellW + 8);
    const cy = y + h - 28 - cellH - 8;
    card(ctx, cx, cy, cellW, cellH, { fill: C.bgSoft });
    T(ctx, it.l, cx + 10, cy + cellH - 12, { size: 6.2, bold: true, color: C.muted });
    T(ctx, it.v, cx + 10, cy + 24, { size: 14, bold: true, color: it.c, maxW: cellW - 16 });
    if (it.sub) T(ctx, it.sub, cx + 10, cy + 8, { size: 6.8, bold: true, color: it.subColor });
  });

  // Row 2: Ahorros
  const r2 = [
    { l: "AHORRO TOTAL", v: money(p.ahorroTotal), sub: d.credito.totalProyectado && p.ahorroTotal ? `${pct((p.ahorroTotal / d.credito.totalProyectado) * 100, 1)} del total a pagar` : "" },
    { l: "AHORRO INTERESES", v: money(p.ahorroIntereses), sub: "Proyección estimada" },
    { l: "AHORRO SEGUROS", v: money(p.ahorroSeguros), sub: "Proyección estimada" },
  ];
  r2.forEach((it, i) => {
    const cx = x + 14 + i * (cellW + 8);
    const cy = y + h - 28 - cellH * 2 - 16;
    card(ctx, cx, cy, cellW, cellH, { fill: C.bgSoft });
    T(ctx, it.l, cx + 10, cy + cellH - 12, { size: 6.2, bold: true, color: C.muted });
    T(ctx, it.v, cx + 10, cy + 24, { size: 14, bold: true, color: C.accentHi, maxW: cellW - 16 });
    if (it.sub) T(ctx, it.sub, cx + 10, cy + 8, { size: 6.5, color: C.muted });
  });

  // Banner inferior
  const bY = y + 10;
  const bH = 38;
  card(ctx, x + 14, bY, w - 28, bH, { fill: C.bgSoft, borderColor: C.accent, borderOpacity: 0.30 });
  T(ctx, "#", x + 22, bY + bH - 24, { size: 14, bold: true, color: C.accentHi });
  T(ctx, "TIEMPO RECUPERADO", x + 40, bY + bH - 12, { size: 6.5, bold: true, color: C.muted });
  const years = p.tiempoRecuperado ? `${(p.tiempoRecuperado / 12).toFixed(0)} años` : "—";
  T(ctx, years, x + 40, bY + 10, { size: 14, bold: true, color: C.accentHi });
  T(ctx, "Reducción en el tiempo total de deuda", x + 40 + 100, bY + 14, { size: 8.5, color: C.textDim });
}

// ───────────────── Timeline operativo ─────────────────
function drawTimelineOperativo(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = PAGE_H - 880;
  const h = 72;
  const w = PAGE_W - M * 2;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "ESTADO OPERATIVO DEL CASO", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const items = d.timeline.length ? d.timeline : ["Simulación","QA","Contrato","Poder","Checklist","Radicación","Respuesta Banco","Informe Final","Cuenta Cobro","Paz y Salvo"]
    .map((etiqueta) => ({ etiqueta, estado: "pendiente" as const }));

  const inner = w - 60;
  const step = items.length > 1 ? inner / (items.length - 1) : 0;
  const lineY = y + 38;

  // base línea
  rect(ctx, M + 30, lineY - 0.5, inner, 1.2, C.borderSoft);
  // línea progreso verde
  const lastDone = items.reduce((a, it, i) => it.estado === "hecho" || it.estado === "curso" ? i : a, -1);
  if (lastDone >= 0) {
    rect(ctx, M + 30, lineY - 1.3, step * lastDone, 2.6, C.accent);
  }

  items.forEach((it, i) => {
    const cx = M + 30 + step * i;
    if (it.estado === "hecho") {
      checkCircle(ctx, cx, lineY, 9, C.accent);
    } else if (it.estado === "curso") {
      ctx.page.drawCircle({ x: cx, y: lineY, size: 11, color: C.primary, opacity: 0.30 });
      ctx.page.drawCircle({ x: cx, y: lineY, size: 9, color: C.primary });
      ctx.page.drawCircle({ x: cx, y: lineY, size: 3, color: C.text });
    } else {
      ctx.page.drawCircle({ x: cx, y: lineY, size: 9, color: C.surfaceHi, borderColor: C.borderSoft, borderWidth: 1 });
    }
    const lbl = it.etiqueta;
    const tokens = lbl.split(/\s+/);
    if (tokens.length > 1 && ctx.font.widthOfTextAtSize(lbl, 6.5) > step + 4) {
      tokens.slice(0, 2).forEach((ln, j) => {
        const lw = ctx.font.widthOfTextAtSize(ln, 6.5);
        T(ctx, ln, cx - lw / 2, lineY - 20 - j * 9, { size: 6.5, color: C.textDim, bold: it.estado !== "pendiente" });
      });
    } else {
      const lw = ctx.font.widthOfTextAtSize(lbl, 6.5);
      T(ctx, lbl, cx - lw / 2, lineY - 20, { size: 6.5, color: C.textDim, bold: it.estado !== "pendiente" });
    }
  });

  // leyenda
  const legY = y + 8;
  const legends = [
    { c: C.accent, l: "Completado" },
    { c: C.primary, l: "En proceso" },
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

// ───────────────── Intervinientes / Trazabilidad ─────────────────
function drawIntervinientes(ctx: Ctx, d: CaseSnapshotDTO) {
  const y = M + 38;
  const w = (PAGE_W - M * 2 - 10) / 2;
  const h = 122;
  card(ctx, M, y, w, h, { fill: C.surface });
  T(ctx, "INTERVINIENTES", M + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const colROL = M + 14 + 18;
  const colNOM = M + 14 + 18 + 88;
  const colMAIL = M + 14 + 18 + 88 + 130;
  const headerY = y + h - 32;
  T(ctx, "ROL", colROL, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "NOMBRE", colNOM, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "CORREO", colMAIL, headerY, { size: 6, bold: true, color: C.muted });
  rect(ctx, M + 10, headerY - 4, w - 20, 0.5, C.border, 0.10);

  const list = d.intervinientes.slice(0, 4);
  const rowH = 18;
  list.forEach((p, i) => {
    const ry = headerY - 16 - i * rowH;
    avatar(ctx, M + 14 + 8, ry + 4, 7, initials(p.nombre || p.rol), C.primary);
    T(ctx, p.rol, colROL, ry, { size: 7.5, color: C.textDim, maxW: 80 });
    T(ctx, safe(p.nombre), colNOM, ry, { size: 7.5, bold: true, color: C.text, maxW: 125 });
    T(ctx, safe(p.email), colMAIL, ry, { size: 7.5, color: C.textDim, maxW: w - (colMAIL - M) - 14 });
  });
}

function drawTrazabilidad(ctx: Ctx, d: CaseSnapshotDTO) {
  const x = M + (PAGE_W - M * 2 - 10) / 2 + 10;
  const w = (PAGE_W - M * 2 - 10) / 2;
  const y = M + 38;
  const h = 122;
  card(ctx, x, y, w, h, { fill: C.surface });
  T(ctx, "TRAZABILIDAD", x + 14, y + h - 14, { size: 7.5, bold: true, color: C.muted });

  const colFEC = x + 14 + 10;
  const colACC = colFEC + 70;
  const colUSR = colACC + 150;
  const headerY = y + h - 32;
  T(ctx, "FECHA", colFEC, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "ACCIÓN", colACC, headerY, { size: 6, bold: true, color: C.muted });
  T(ctx, "USUARIO", colUSR, headerY, { size: 6, bold: true, color: C.muted });
  rect(ctx, x + 10, headerY - 4, w - 20, 0.5, C.border, 0.10);

  const list = d.trazabilidad.slice(0, 4);
  const rowH = 18;
  // rail vertical
  if (list.length) {
    rect(ctx, colFEC - 8, headerY - 16 - rowH * (list.length - 1) - 2, 1, rowH * list.length, C.primary, 0.35);
  }
  list.forEach((t, i) => {
    const ry = headerY - 16 - i * rowH;
    ctx.page.drawCircle({ x: colFEC - 8, y: ry + 3, size: 3.2, color: C.primary });
    ctx.page.drawCircle({ x: colFEC - 8, y: ry + 3, size: 1.5, color: C.text });
    T(ctx, fmtDate(t.fecha), colFEC, ry, { size: 7, color: C.textDim, maxW: 65 });
    T(ctx, t.accion, colACC, ry, { size: 7, bold: true, color: C.text, maxW: 145 });
    T(ctx, safe(t.usuario), colUSR, ry, { size: 7, color: C.textDim, maxW: w - (colUSR - x) - 14 });
  });
}

// ───────────────── Footer ─────────────────
function drawFooter(ctx: Ctx) {
  rect(ctx, M, 36, PAGE_W - M * 2, 0.5, C.border, 0.10);
  T(ctx, "NUVIA", M, 20, { size: 11, bold: true, color: C.text });
  T(ctx, "FINANCIAL INTELLIGENCE", M, 9, { size: 5.5, bold: true, color: C.accentHi });

  const center = "Transformamos datos en decisiones financieras inteligentes.";
  const cw = ctx.font.widthOfTextAtSize(center, 8);
  T(ctx, center, PAGE_W / 2 - cw / 2, 16, { size: 8, color: C.primaryHi });

  const pg = "Página 1 de 1";
  const pw = ctx.font.widthOfTextAtSize(pg, 7.5);
  T(ctx, pg, PAGE_W - M - pw, 16, { size: 7.5, color: C.muted });
}

// ───────────────── Orquestador ─────────────────
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
