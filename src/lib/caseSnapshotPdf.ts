// Generador del Case Snapshot PDF — Financial Intelligence Executive Snapshot.
// Diseño NUVIA dark premium. Usa pdf-lib (sin deps nuevas).

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { formatCOP } from "@/lib/format";
import type { CaseSnapshotDTO } from "./caseSnapshot.functions";

const C = {
  bg: rgb(0.043, 0.071, 0.149),         // #0B1226
  surface: rgb(0.078, 0.110, 0.188),    // #141C30
  surfaceAlt: rgb(0.055, 0.090, 0.165),
  border: rgb(0.18, 0.22, 0.32),
  primary: rgb(0.267, 0.365, 0.639),    // #445DA3
  primarySoft: rgb(0.267, 0.365, 0.639),
  accent: rgb(0.518, 0.725, 0.561),     // #84B98F
  amber: rgb(0.965, 0.769, 0.325),      // #F6C453
  red: rgb(1.0, 0.42, 0.42),
  text: rgb(0.961, 0.969, 0.984),       // #F5F7FB
  muted: rgb(0.659, 0.694, 0.784),      // #A8B1C8
  dim: rgb(0.45, 0.50, 0.62),
  white: rgb(1, 1, 1),
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNum: number;
}

function fmt(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return formatCOP(v);
}
function fmtN(v: number | null | undefined, suffix = ""): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return `${Math.round(v).toLocaleString("es-CO")}${suffix}`;
}
function fmtPct(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v === 0) return "—";
  return `${v.toFixed(2)}%`;
}
function fmtDate(s: string): string {
  if (!s || s === "—") return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}
function safe(v: string | null | undefined): string {
  return v && v.trim().length ? v : "—";
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum += 1;
  paintBg(ctx);
  drawHeader(ctx);
  drawFooter(ctx);
  ctx.y = PAGE_H - 90;
}

function paintBg(ctx: Ctx) {
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.bg });
}

function drawHeader(ctx: Ctx) {
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: C.surface });
  ctx.page.drawRectangle({ x: 0, y: PAGE_H - 51, width: PAGE_W, height: 1, color: C.border });
  ctx.page.drawText("NUVIA", {
    x: MARGIN, y: PAGE_H - 30, size: 14, font: ctx.bold, color: C.text,
  });
  ctx.page.drawText("FINANCIAL INTELLIGENCE", {
    x: MARGIN + 52, y: PAGE_H - 29, size: 8, font: ctx.font, color: C.muted,
  });
  ctx.page.drawText("EXECUTIVE SNAPSHOT", {
    x: PAGE_W - MARGIN - 110, y: PAGE_H - 30, size: 9, font: ctx.bold, color: C.accent,
  });
}

function drawFooter(ctx: Ctx) {
  ctx.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 28, color: C.surface });
  ctx.page.drawRectangle({ x: 0, y: 28, width: PAGE_W, height: 1, color: C.border });
  ctx.page.drawText(`Emitido ${new Date().toLocaleString("es-CO")}`, {
    x: MARGIN, y: 10, size: 7.5, font: ctx.font, color: C.muted,
  });
  ctx.page.drawText("Documento ejecutivo • No reemplaza el expediente operativo", {
    x: PAGE_W / 2 - 130, y: 10, size: 7.5, font: ctx.font, color: C.dim,
  });
  ctx.page.drawText(`p. ${ctx.pageNum}`, {
    x: PAGE_W - MARGIN - 20, y: 10, size: 7.5, font: ctx.bold, color: C.muted,
  });
}

function ensureSpace(ctx: Ctx, needed: number) {
  if (ctx.y - needed < 50) newPage(ctx);
}

function sectionTitle(ctx: Ctx, title: string, subtitle?: string) {
  ensureSpace(ctx, 40);
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y - 2, width: 3, height: 14, color: C.accent,
  });
  ctx.page.drawText(title.toUpperCase(), {
    x: MARGIN + 10, y: ctx.y, size: 11, font: ctx.bold, color: C.text,
  });
  if (subtitle) {
    ctx.page.drawText(subtitle, {
      x: MARGIN + 10 + ctx.bold.widthOfTextAtSize(title.toUpperCase(), 11) + 10,
      y: ctx.y, size: 8, font: ctx.font, color: C.muted,
    });
  }
  ctx.y -= 14;
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y, width: PAGE_W - MARGIN * 2, height: 1, color: C.border,
  });
  ctx.y -= 10;
}

function card(ctx: Ctx, height: number): { x: number; y: number; w: number; h: number } {
  ensureSpace(ctx, height + 6);
  const x = MARGIN;
  const w = PAGE_W - MARGIN * 2;
  const y = ctx.y - height;
  ctx.page.drawRectangle({
    x, y, width: w, height,
    color: C.surface,
    borderColor: C.border,
    borderWidth: 0.5,
  });
  ctx.y = y - 8;
  return { x, y, w, h: height };
}

function kv(ctx: Ctx, x: number, y: number, label: string, value: string, valueColor: RGB = C.text, w = 250) {
  ctx.page.drawText(label.toUpperCase(), {
    x, y: y + 12, size: 6.5, font: ctx.bold, color: C.muted,
  });
  // Truncar a w
  let val = value;
  while (ctx.bold.widthOfTextAtSize(val, 9) > w && val.length > 1) {
    val = val.slice(0, -2) + "…";
  }
  ctx.page.drawText(val, {
    x, y, size: 9, font: ctx.bold, color: valueColor,
  });
}

function gridKV(
  ctx: Ctx,
  items: Array<{ label: string; value: string; color?: RGB }>,
  cols = 3,
) {
  const rowH = 26;
  const rows = Math.ceil(items.length / cols);
  const c = card(ctx, rows * rowH + 8);
  const colW = (c.w - 24) / cols;
  items.forEach((it, i) => {
    const r = Math.floor(i / cols);
    const col = i % cols;
    kv(
      ctx,
      c.x + 12 + col * colW,
      c.y + c.h - 22 - r * rowH,
      it.label,
      it.value,
      it.color ?? C.text,
      colW - 8,
    );
  });
}

function drawBadge(
  ctx: Ctx, x: number, y: number, label: string, color: RGB, bg: RGB,
) {
  const w = ctx.bold.widthOfTextAtSize(label, 7) + 14;
  ctx.page.drawRectangle({
    x, y, width: w, height: 16, color: bg, borderColor: color, borderWidth: 0.5,
  });
  ctx.page.drawText(label, { x: x + 7, y: y + 5, size: 7, font: ctx.bold, color });
}

function drawTimeline(ctx: Ctx, items: CaseSnapshotDTO["timeline"]) {
  if (!items.length) return;
  const c = card(ctx, 60);
  const usableW = c.w - 40;
  const step = items.length > 1 ? usableW / (items.length - 1) : 0;
  const baseY = c.y + 32;
  // Línea base
  ctx.page.drawRectangle({
    x: c.x + 20, y: baseY - 0.5, width: usableW, height: 1, color: C.border,
  });
  items.forEach((it, i) => {
    const cx = c.x + 20 + step * i;
    const color = it.estado === "hecho" ? C.accent
                : it.estado === "curso" ? C.amber
                : C.dim;
    // Dot
    ctx.page.drawCircle({ x: cx, y: baseY, size: 5, color });
    ctx.page.drawCircle({ x: cx, y: baseY, size: 3, color: C.surface });
    if (it.estado !== "pendiente") {
      ctx.page.drawCircle({ x: cx, y: baseY, size: 2.2, color });
    }
    // Label (vertical-ish: short)
    const lbl = it.etiqueta;
    const lw = ctx.font.widthOfTextAtSize(lbl, 6.5);
    ctx.page.drawText(lbl, {
      x: cx - lw / 2, y: baseY - 14, size: 6.5, font: ctx.font, color: C.muted,
    });
  });
}

function row(ctx: Ctx, cells: string[], widths: number[], header = false) {
  const h = 18;
  ensureSpace(ctx, h + 4);
  const y = ctx.y - h;
  if (header) {
    ctx.page.drawRectangle({
      x: MARGIN, y, width: PAGE_W - MARGIN * 2, height: h, color: C.surfaceAlt,
    });
  }
  let x = MARGIN + 8;
  cells.forEach((cell, i) => {
    let txt = cell;
    const maxW = widths[i] - 8;
    const f = header ? ctx.bold : ctx.font;
    const sz = header ? 7.5 : 8.5;
    while (f.widthOfTextAtSize(txt, sz) > maxW && txt.length > 1) {
      txt = txt.slice(0, -2) + "…";
    }
    ctx.page.drawText(txt, {
      x, y: y + 5, size: sz, font: f,
      color: header ? C.muted : C.text,
    });
    x += widths[i];
  });
  ctx.y = y - 1;
  ctx.page.drawRectangle({
    x: MARGIN, y: ctx.y, width: PAGE_W - MARGIN * 2, height: 0.5, color: C.border,
  });
}

// ---------- Portada ----------
function drawCover(ctx: Ctx, d: CaseSnapshotDTO) {
  paintBg(ctx);
  // Glow superior
  ctx.page.drawRectangle({
    x: 0, y: PAGE_H - 220, width: PAGE_W, height: 220, color: C.surface, opacity: 0.5,
  });
  // Marca
  ctx.page.drawText("NUVIA", {
    x: MARGIN, y: PAGE_H - 80, size: 28, font: ctx.bold, color: C.text,
  });
  ctx.page.drawText("FINANCIAL INTELLIGENCE", {
    x: MARGIN, y: PAGE_H - 100, size: 9, font: ctx.font, color: C.accent,
  });

  // Línea accent
  ctx.page.drawRectangle({
    x: MARGIN, y: PAGE_H - 130, width: 60, height: 2, color: C.accent,
  });

  // Título
  ctx.page.drawText("CASE SNAPSHOT", {
    x: MARGIN, y: PAGE_H - 180, size: 32, font: ctx.bold, color: C.text,
  });
  ctx.page.drawText("Executive Summary del Caso", {
    x: MARGIN, y: PAGE_H - 205, size: 11, font: ctx.font, color: C.muted,
  });

  // Card central — datos principales
  const cardY = 260;
  const cardH = 280;
  ctx.page.drawRectangle({
    x: MARGIN, y: cardY, width: PAGE_W - MARGIN * 2, height: cardH,
    color: C.surface, borderColor: C.border, borderWidth: 0.5,
  });
  ctx.page.drawRectangle({
    x: MARGIN, y: cardY + cardH - 3, width: PAGE_W - MARGIN * 2, height: 3, color: C.accent,
  });

  const items = [
    { l: "CLIENTE", v: d.meta.cliente },
    { l: "BANCO", v: d.meta.banco },
    { l: "PRODUCTO", v: d.meta.producto },
    { l: "MODALIDAD", v: d.meta.modalidad.toUpperCase() },
    { l: "ESTADO DEL CASO", v: d.meta.estadoCaso.replace(/_/g, " ").toUpperCase() },
    { l: "FECHA", v: fmtDate(d.meta.fecha) },
    { l: "ANALISTA", v: d.meta.analista.nombre },
    { l: "SCORE QA", v: d.meta.qaScore != null ? `${d.meta.qaScore.toFixed(1)} / 100` : "—" },
    { l: "NIVEL AUTONOMÍA", v: d.meta.nivelAutonomia ? `N${d.meta.nivelAutonomia}` : "—" },
  ];
  const colW = (PAGE_W - MARGIN * 2 - 40) / 2;
  items.forEach((it, i) => {
    const r = Math.floor(i / 2);
    const col = i % 2;
    const x = MARGIN + 20 + col * colW;
    const y = cardY + cardH - 40 - r * 42;
    ctx.page.drawText(it.l, { x, y: y + 14, size: 7, font: ctx.bold, color: C.muted });
    let v = safe(it.v);
    while (ctx.bold.widthOfTextAtSize(v, 12) > colW - 10 && v.length > 1) {
      v = v.slice(0, -2) + "…";
    }
    ctx.page.drawText(v, { x, y, size: 12, font: ctx.bold, color: C.text });
  });

  // Footer cover
  ctx.page.drawText("Documento generado para uso interno. No reemplaza el expediente, contratos ni informes oficiales.", {
    x: MARGIN, y: 60, size: 7.5, font: ctx.font, color: C.dim,
  });
  ctx.page.drawText(`ID expediente: ${d.meta.expedienteId}`, {
    x: MARGIN, y: 45, size: 7, font: ctx.font, color: C.dim,
  });
  drawFooter(ctx);
}

export async function generarCaseSnapshotPdf(d: CaseSnapshotDTO): Promise<Blob> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([PAGE_W, PAGE_H]),
    font, bold, y: PAGE_H, pageNum: 1,
  };

  drawCover(ctx, d);

  // ---- Página 2+ ----
  newPage(ctx);

  // 2. Perfil del cliente
  sectionTitle(ctx, "Perfil del cliente", "Datos personales y financieros");
  gridKV(ctx, [
    { label: "Nombre", value: safe(d.cliente.nombre) },
    { label: "Cédula", value: safe(d.cliente.cedula) },
    { label: "Ciudad", value: safe(d.cliente.ciudad) },
    { label: "Teléfono", value: safe(d.cliente.telefono) },
    { label: "Correo", value: safe(d.cliente.correo) },
    { label: "Estado civil", value: safe(d.cliente.estadoCivil) },
    { label: "Perfil laboral", value: safe(d.cliente.perfilLaboral) },
    { label: "Score interno", value: safe(d.cliente.scoreInterno) },
    { label: "Endeudamiento", value: fmtPct(d.cliente.endeudamiento) },
  ], 3);
  ctx.y -= 4;
  gridKV(ctx, [
    { label: "Ingresos", value: fmt(d.cliente.ingresos), color: C.accent },
    { label: "Otros ingresos", value: fmt(d.cliente.otrosIngresos), color: C.accent },
    { label: "Egresos", value: fmt(d.cliente.egresos), color: C.red },
    { label: "Capacidad de pago", value: fmt(d.cliente.capacidadPago), color: C.amber },
  ], 4);

  // 3. Perfil crédito
  sectionTitle(ctx, "Perfil del crédito", "Condiciones contractuales y proyección");
  gridKV(ctx, [
    { label: "Banco", value: safe(d.credito.banco) },
    { label: "N° crédito", value: safe(d.credito.numeroCredito) },
    { label: "Producto", value: safe(d.credito.producto) },
    { label: "Modalidad", value: safe(d.credito.modalidad).toUpperCase() },
    { label: "Saldo capital", value: fmt(d.credito.saldoCapital), color: C.amber },
    { label: "Desembolsado", value: fmt(d.credito.valorDesembolsado) },
    { label: "Plazo aprobado", value: d.credito.plazoAprobado ? `${d.credito.plazoAprobado} m` : "—" },
    { label: "Cuotas pagadas", value: fmtN(d.credito.cuotasPagadas) },
    { label: "Cuotas pendientes", value: fmtN(d.credito.cuotasPendientes) },
    { label: "Cuota actual", value: fmt(d.credito.cuotaActual) },
    { label: "Seguros", value: fmt(d.credito.seguros), color: C.red },
    { label: "Interés mensual", value: fmt(d.credito.interesMensual), color: C.red },
    { label: "Capital mensual", value: fmt(d.credito.capitalMensual), color: C.accent },
    { label: "FRESH mensual", value: fmt(d.credito.freshMensual) },
    { label: "TEA", value: fmtPct(d.credito.tea) },
    { label: "TEM", value: fmtPct(d.credito.tem) },
    { label: "Veces pagado", value: d.credito.vecesPagado ? `${d.credito.vecesPagado.toFixed(2)}x` : "—" },
    { label: "Total proyectado", value: fmt(d.credito.totalProyectado) },
    { label: "Costo real crédito", value: fmt(d.credito.costoReal), color: C.red },
  ], 3);

  // 4. Propuesta
  sectionTitle(ctx, "Propuesta seleccionada");
  ensureSpace(ctx, 30);
  if (d.propuesta.recomendada) {
    drawBadge(ctx, MARGIN, ctx.y - 4, "RECOMENDADA POR NUVIA", C.accent, C.surface);
    ctx.y -= 22;
  }
  gridKV(ctx, [
    { label: "Escenario", value: safe(d.propuesta.escenario) },
    { label: "Cuotas eliminadas", value: fmtN(d.propuesta.cuotasEliminadas) },
    { label: "Nuevo plazo", value: d.propuesta.nuevoPlazo ? `${d.propuesta.nuevoPlazo} m` : "—" },
    { label: "Nueva cuota", value: fmt(d.propuesta.nuevaCuota) },
    { label: "Incremento mensual", value: fmt(d.propuesta.incrementoMensual) },
    { label: "Tiempo recuperado", value: d.propuesta.tiempoRecuperado ? `${d.propuesta.tiempoRecuperado} m` : "—" },
    { label: "Ahorro intereses", value: fmt(d.propuesta.ahorroIntereses), color: C.accent },
    { label: "Ahorro seguros", value: fmt(d.propuesta.ahorroSeguros), color: C.accent },
    { label: "AHORRO TOTAL", value: fmt(d.propuesta.ahorroTotal), color: C.accent },
  ], 3);

  // 5. Honorarios
  sectionTitle(ctx, "Honorarios");
  gridKV(ctx, [
    { label: "Honorarios pactados", value: fmt(d.honorarios.pactados), color: C.accent },
    { label: "Porcentaje", value: fmtPct(d.honorarios.porcentaje) },
    { label: "Estado cobro", value: safe(d.honorarios.estadoCobro).toUpperCase() },
    { label: "Estado pago", value: safe(d.honorarios.estadoPago).toUpperCase() },
    { label: "Cuenta cobro", value: d.honorarios.cuentaCobroEmitida ? "EMITIDA" : "PENDIENTE",
      color: d.honorarios.cuentaCobroEmitida ? C.accent : C.amber },
    { label: "Paz y salvo", value: d.honorarios.pazYSalvo ? "SÍ" : "NO",
      color: d.honorarios.pazYSalvo ? C.accent : C.muted },
  ], 3);

  // 6. Timeline
  sectionTitle(ctx, "Estado operativo", "Línea de tiempo del caso");
  drawTimeline(ctx, d.timeline);

  // 7. Intervinientes
  sectionTitle(ctx, "Intervinientes");
  if (d.intervinientes.length === 0) {
    const c = card(ctx, 30);
    ctx.page.drawText("Sin intervinientes registrados.", {
      x: c.x + 12, y: c.y + 10, size: 9, font: ctx.font, color: C.muted,
    });
  } else {
    row(ctx, ["ROL", "NOMBRE", "CORREO"], [140, 200, 192], true);
    d.intervinientes.forEach((p) => {
      row(ctx, [p.rol, safe(p.nombre), safe(p.email)], [140, 200, 192]);
    });
  }

  // 8. Trazabilidad
  sectionTitle(ctx, "Trazabilidad", "Últimas acciones registradas");
  if (d.trazabilidad.length === 0) {
    const c = card(ctx, 30);
    ctx.page.drawText("Sin movimientos recientes.", {
      x: c.x + 12, y: c.y + 10, size: 9, font: ctx.font, color: C.muted,
    });
  } else {
    row(ctx, ["FECHA", "ACCIÓN", "USUARIO"], [120, 250, 162], true);
    d.trazabilidad.forEach((t) => {
      row(ctx, [fmtDate(t.fecha), safe(t.accion), safe(t.usuario)], [120, 250, 162]);
    });
  }

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
