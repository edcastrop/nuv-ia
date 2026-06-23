// NUVEX PDF Kit — primitivas gráficas reutilizables sobre jsPDF.
// Todos los documentos NUVEX deben construirse con estas piezas para garantizar
// branding consistente (header azul institucional, footer corporativo, cards,
// secciones, portada hero) y aspecto de "documento corporativo premium" — no
// de Word exportado a PDF.

import { jsPDF } from "jspdf";
import logoNuvex from "@/assets/logo-nuvex.png";

// ─────────────────────────────── Tokens de marca ────────────────────────────

export const BRAND = {
  blue: [68, 93, 163] as [number, number, number],          // #445DA3
  blueDark: [38, 56, 110] as [number, number, number],      // #26386E
  blueDeep: [22, 33, 70] as [number, number, number],       // #162146
  blueSoft: [232, 237, 248] as [number, number, number],    // #E8EDF8
  ink: [36, 36, 36] as [number, number, number],            // #242424
  muted: [92, 103, 112] as [number, number, number],        // #5C6770
  border: [227, 231, 238] as [number, number, number],      // #E3E7EE
  surface: [247, 249, 251] as [number, number, number],     // #F7F9FB
  white: [255, 255, 255] as [number, number, number],
  green: [132, 185, 143] as [number, number, number],       // #84B98F
} as const;

export const LAYOUT = {
  marginX: 48,
  headerH: 96,
  footerH: 64,
  contentTop: 116,      // primer y disponible bajo el header
  contentBottom: 712,   // y máximo antes del footer (pageH 792 − 80)
  pageW: 612,
  pageH: 792,
} as const;

// ─────────────────────────────── Logo (cached) ──────────────────────────────

let logoDataUrlPromise: Promise<string> | null = null;
export async function loadLogoDataURL(): Promise<string> {
  if (logoDataUrlPromise) return logoDataUrlPromise;
  logoDataUrlPromise = (async () => {
    try {
      const res = await fetch(logoNuvex as unknown as string);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  })();
  return logoDataUrlPromise;
}

/** Carga el logo, recorta su transparencia y lo tinta al color deseado (canvas, client-side only). */
export async function loadTintedLogoDataURL(targetColor: string): Promise<string> {
  const original = await loadLogoDataURL();
  if (!original || typeof document === "undefined") return original;

  const hex = targetColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const source = document.createElement("canvas");
      source.width = img.width;
      source.height = img.height;
      const sourceCtx = source.getContext("2d")!;
      sourceCtx.drawImage(img, 0, 0);

      // El PNG original es cuadrado y trae mucho aire transparente. Si lo
      // insertamos como 220×220 el logo visible queda pequeño. Recortamos el
      // bbox alpha para que el tamaño en el PDF corresponda al logo REAL.
      const data = sourceCtx.getImageData(0, 0, source.width, source.height).data;
      let minX = source.width;
      let minY = source.height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < source.height; y += 1) {
        for (let x = 0; x < source.width; x += 1) {
          if (data[(y * source.width + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }

      const pad = 10;
      const cropX = Math.max(0, minX - pad);
      const cropY = Math.max(0, minY - pad);
      const cropW = Math.min(source.width - cropX, maxX - minX + 1 + pad * 2);
      const cropH = Math.min(source.height - cropY, maxY - minY + 1 + pad * 2);

      const canvas = document.createElement("canvas");
      canvas.width = cropW || img.width;
      canvas.height = cropH || img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(source, cropX, cropY, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(original);
    img.src = original;
  });
}

// ─────────────────────────────── Tipos ──────────────────────────────────────

export interface BrandMeta {
  /** Etiqueta del documento (ej. "Documento Jurídico — Poder Especial"). */
  documento: string;
  /** Consecutivo institucional (ej. "NUVEX-PE-2026-0421"). */
  consecutivo?: string;
  /** Tipo de diseño de chrome: poder = diagonal institucional, default = azul institucional. */
  kind?: "poder" | "default";
}

export interface CardItem {
  label: string;
  value: string;
  /** Acento opcional (azul claro / verde) para destacar la card. */
  accent?: "primary" | "soft" | "neutral";
}

// ─────────────────────────────── Helpers básicos ────────────────────────────

function fmtFechaLarga(): string {
  return new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

/** Dibuja un rectángulo con esquinas redondeadas (relleno opcional). */
export function roundedRect(
  pdf: jsPDF,
  x: number, y: number, w: number, h: number, r: number,
  fill?: [number, number, number] | null,
  stroke?: [number, number, number] | null,
  lineWidth = 0.6,
) {
  if (fill) pdf.setFillColor(...fill);
  if (stroke) { pdf.setDrawColor(...stroke); pdf.setLineWidth(lineWidth); }
  const style = fill && stroke ? "FD" : fill ? "F" : stroke ? "S" : "S";
  // jsPDF roundedRect existe
  pdf.roundedRect(x, y, w, h, r, r, style);
}

// ─────────────────────────────── Header / Footer ────────────────────────────

/**
 * Header corporativo NUVEX: banda azul a ancho completo con logo en card
 * blanca a la izquierda y metadatos del documento a la derecha.
 */
export function drawBrandHeader(pdf: jsPDF, logoDataUrl: string, meta: BrandMeta) {
  const { pageW, marginX, headerH } = LAYOUT;

  // Banda azul a ancho completo (con borde inferior verde sutil)
  pdf.setFillColor(...BRAND.blue);
  pdf.rect(0, 0, pageW, headerH, "F");

  // Acento inferior verde NUVEX
  pdf.setFillColor(...BRAND.green);
  pdf.rect(0, headerH - 3, pageW, 3, "F");

  // Card blanca con logo
  const logoCardW = 168;
  const logoCardH = 64;
  const logoCardX = marginX;
  const logoCardY = (headerH - logoCardH) / 2 - 1;
  roundedRect(pdf, logoCardX, logoCardY, logoCardW, logoCardH, 8, BRAND.white, null);
  if (logoDataUrl) {
    try {
      // Logo: alto 44pt, centrado en la card
      pdf.addImage(logoDataUrl, "PNG", logoCardX + 14, logoCardY + 10, 0, 44);
    } catch { /* ignore */ }
  }

  // Metadatos a la derecha (blanco sobre azul)
  const rightX = pageW - marginX;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND.white);
  pdf.text(meta.documento.toUpperCase(), rightX, 32, { align: "right", charSpace: 0.4 });

  if (meta.consecutivo) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(meta.consecutivo, rightX, 50, { align: "right" });
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Generado: ${fmtFechaLarga()}`, rightX, 66, { align: "right" });
}

/**
 * Footer corporativo NUVEX: banda azul oscuro fina con datos institucionales.
 */
export function drawBrandFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const { pageW, pageH, marginX, footerH } = LAYOUT;
  const y0 = pageH - footerH;

  // Acento superior verde
  pdf.setFillColor(...BRAND.green);
  pdf.rect(0, y0 - 3, pageW, 3, "F");

  // Banda azul oscuro
  pdf.setFillColor(...BRAND.blueDeep);
  pdf.rect(0, y0, pageW, footerH, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text("NUVEX FINANZAS INTELIGENTES", marginX, y0 + 18);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(210, 220, 240);
  pdf.text("Bogotá  ·  Bucaramanga  ·  Carrera 16 # 37-48 Piso 4", marginX, y0 + 32);
  pdf.text("juridica@nuvex.com.co  ·  www.nuvex.com.co  ·  +57 316 402 3779", marginX, y0 + 46);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Página ${pageNum} de ${totalPages}`, pageW - marginX, y0 + 32, { align: "right" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(210, 220, 240);
  pdf.text("Documento generado automáticamente", pageW - marginX, y0 + 46, { align: "right" });
}

export function drawPoderHeader(pdf: jsPDF, logoDataUrl: string, meta: BrandMeta) {
  const { pageW, marginX } = LAYOUT;
  const H = 170; // header ampliado para logo grande

  // Fondo negro a ancho completo
  pdf.setFillColor(28, 28, 28);
  pdf.rect(0, 0, pageW, H, "F");

  // Bloque blanco rectangular a la derecha — 100% recto, sin diagonales.
  const whiteBlockX = 392;
  pdf.setFillColor(255, 255, 255);
  pdf.rect(whiteBlockX, 0, pageW - whiteBlockX, H, "F");

  // Acento verde NUVEX inferior
  pdf.setFillColor(...BRAND.green);
  pdf.rect(0, H - 4, pageW, 4, "F");

  // Logo NUVEX azul claro (#A8C5FF), recortado y realmente grande.
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, "PNG", marginX - 22, 23, 300, 145);
    } catch { /* ignore */ }
  }

  // Consecutivo a la derecha sobre el blanco
  if (meta.consecutivo) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(30, 58, 120);
    pdf.text(meta.consecutivo, pageW - marginX, H / 2 + 4, { align: "right" });
  }
}

export function drawPoderFooter(pdf: jsPDF, pageNum: number, totalPages: number) {
  const { pageW, pageH, marginX, footerH } = LAYOUT;
  const y0 = pageH - footerH;

  // Fondo negro
  pdf.setFillColor(28, 28, 28);
  pdf.rect(0, y0, pageW, footerH, "F");

  // Bloque blanco rectangular izquierda — 100% recto, sin diagonales.
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, y0, 160, footerH, "F");

  // Acento verde NUVEX superior
  pdf.setFillColor(...BRAND.green);
  pdf.rect(0, y0 - 3, pageW, 3, "F");

  // Paginación derecha
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.text(
    `Pág. ${pageNum} de ${totalPages}`,
    pageW - marginX,
    y0 + footerH / 2 + 3,
    { align: "right" }
  );

  // Datos corporativos con íconos vectoriales minimalistas
  const iconX = 220;
  const textX = iconX + 12;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(225, 232, 245);

  // Línea 1 — pin (ubicación)
  const y1 = y0 + 18;
  drawIconPin(pdf, iconX, y1 - 6);
  pdf.text("Carrera 16 # 37-48 piso 4  ·  Bucaramanga", textX, y1);

  // Línea 2 — globo (web) + teléfono
  const y2 = y0 + 32;
  drawIconGlobe(pdf, iconX, y2 - 6);
  pdf.text("www.nuvex.com.co", textX, y2);
  const phoneIconX = textX + pdf.getTextWidth("www.nuvex.com.co") + 14;
  drawIconPhone(pdf, phoneIconX, y2 - 6);
  pdf.text("+57 316 4023779", phoneIconX + 12, y2);

  // Línea 3 — sobre (email)
  const y3 = y0 + 46;
  drawIconEnvelope(pdf, iconX, y3 - 6);
  pdf.text("juridica@nuvex.com.co", textX, y3);
}

// ── Íconos vectoriales minimalistas para el footer (≈7×7 pt) ────────────────
function drawIconPin(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(225, 232, 245);
  pdf.setFillColor(225, 232, 245);
  pdf.setLineWidth(0.6);
  // pin minimalista sin triángulos: círculo + tallo.
  pdf.circle(x + 3.5, y + 2.5, 2.2, "S");
  pdf.line(x + 3.5, y + 4.8, x + 3.5, y + 7);
  pdf.circle(x + 3.5, y + 2.5, 0.7, "F");
}

function drawIconGlobe(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(225, 232, 245);
  pdf.setLineWidth(0.6);
  const cx = x + 3.5, cy = y + 3.5, r = 3;
  pdf.circle(cx, cy, r, "S");
  // ecuador
  pdf.line(cx - r, cy, cx + r, cy);
  // meridiano vertical (elipse aplanada simulada con 2 arcos)
  pdf.line(cx, cy - r, cx, cy + r);
  // meridiano oblicuo (curva aproximada)
  pdf.ellipse(cx, cy, r * 0.55, r, "S");
}

function drawIconPhone(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(225, 232, 245);
  pdf.setFillColor(225, 232, 245);
  pdf.setLineWidth(0.6);
  // auricular estilizado: dos rectángulos redondeados unidos en diagonal
  pdf.roundedRect(x + 0.5, y + 0.5, 2.4, 3.2, 0.6, 0.6, "F");
  pdf.roundedRect(x + 4.1, y + 3.8, 2.4, 3.2, 0.6, 0.6, "F");
  pdf.setLineWidth(0.8);
  pdf.line(x + 2.5, y + 2.5, x + 4.5, y + 4.5);
}

function drawIconEnvelope(pdf: jsPDF, x: number, y: number) {
  pdf.setDrawColor(225, 232, 245);
  pdf.setLineWidth(0.6);
  pdf.rect(x, y + 1, 7, 5, "S");
  // solapa V
  pdf.line(x, y + 1, x + 3.5, y + 4);
  pdf.line(x + 3.5, y + 4, x + 7, y + 1);
}


/**
 * Aplica header+footer a TODAS las páginas existentes del PDF (con paginado real).
 * Llamar al final, antes de exportar.
 */
export function applyChrome(pdf: jsPDF, logoDataUrl: string, meta: BrandMeta) {
  const total = pdf.getNumberOfPages();
  const esPoder = meta.kind === "poder";
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    if (esPoder) {
      drawPoderHeader(pdf, logoDataUrl, meta);
      drawPoderFooter(pdf, i, total);
    } else {
      drawBrandHeader(pdf, logoDataUrl, meta);
      drawBrandFooter(pdf, i, total);
    }
  }
}

// ─────────────────────────────── Hero / Portada ─────────────────────────────

export interface HeroOpts {
  badge?: string;          // "DOCUMENTO JURÍDICO"
  title: string;           // "PODER ESPECIAL"
  subtitle?: string;       // "Representación ante entidad financiera"
  /** Render con altura compacta (para ficha) o full (portada poder). */
  variant?: "cover" | "compact";
}

/**
 * Hero institucional bajo el header. Devuelve la nueva `y` (cursor) para
 * continuar dibujando contenido bajo el hero.
 */
export function drawHero(pdf: jsPDF, opts: HeroOpts): number {
  const { pageW, marginX, contentTop } = LAYOUT;
  const variant = opts.variant ?? "cover";
  const h = variant === "cover" ? 188 : 96;
  const y0 = contentTop;

  // Fondo degradado simulado: dos rectángulos
  pdf.setFillColor(...BRAND.blue);
  pdf.rect(0, y0, pageW, h, "F");
  // capa de profundidad
  pdf.setFillColor(...BRAND.blueDark);
  pdf.rect(0, y0 + h - 4, pageW, 4, "F");

  // Ornamento: círculo sutil a la derecha
  pdf.setFillColor(255, 255, 255);
  pdf.setGState(pdf.GState({ opacity: 0.06 }));
  pdf.circle(pageW - 60, y0 + h / 2, h * 0.7, "F");
  pdf.setGState(pdf.GState({ opacity: 1 }));

  // Badge
  if (opts.badge) {
    const badgeText = opts.badge.toUpperCase();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const badgeW = pdf.getTextWidth(badgeText) + 20;
    roundedRect(pdf, marginX, y0 + 24, badgeW, 18, 9, [255, 255, 255], null);
    pdf.setTextColor(...BRAND.blueDark);
    pdf.text(badgeText, marginX + 10, y0 + 36);
  }

  // Título
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(variant === "cover" ? 30 : 22);
  pdf.setTextColor(255, 255, 255);
  pdf.text(opts.title, marginX, y0 + (variant === "cover" ? 90 : 56));

  // Subtítulo
  if (opts.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.setTextColor(220, 230, 250);
    pdf.text(opts.subtitle, marginX, y0 + (variant === "cover" ? 116 : 78));
  }

  // Línea decorativa
  pdf.setDrawColor(...BRAND.green);
  pdf.setLineWidth(2);
  pdf.line(marginX, y0 + (variant === "cover" ? 132 : 86), marginX + 60, y0 + (variant === "cover" ? 132 : 86));

  return y0 + h + 18;
}

// ─────────────────────────────── Cards (grid) ───────────────────────────────

/**
 * Dibuja una card individual con label arriba (uppercase, azul) y value abajo
 * (ink, semibold). Soporta wrap del valor en hasta 3 líneas.
 */
export function drawCard(
  pdf: jsPDF,
  x: number, y: number, w: number, h: number,
  item: CardItem,
) {
  const accent = item.accent ?? "neutral";
  const bg = accent === "primary"
    ? BRAND.blueSoft
    : accent === "soft"
      ? BRAND.surface
      : BRAND.white;
  roundedRect(pdf, x, y, w, h, 8, bg, BRAND.border, 0.5);

  // Barra lateral de acento
  if (accent !== "neutral") {
    const accentColor = accent === "primary" ? BRAND.blue : BRAND.green;
    pdf.setFillColor(...accentColor);
    pdf.rect(x, y, 3, h, "F");
  }

  // Label
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...BRAND.blue);
  pdf.text(item.label.toUpperCase(), x + 14, y + 18, { charSpace: 0.4 });

  // Value
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...BRAND.ink);
  const lines = (pdf.splitTextToSize(item.value || "—", w - 28) as string[]).slice(0, 3);
  lines.forEach((line, i) => {
    pdf.text(line, x + 14, y + 36 + i * 14);
  });
}

/**
 * Grid de cards. `cols` = número de columnas. Cada card ocupa el alto fijo.
 * Devuelve la nueva `y` tras el grid.
 */
export function drawCardGrid(
  pdf: jsPDF,
  y: number,
  items: CardItem[],
  cols = 2,
  cardH = 72,
  gap = 10,
): number {
  const { pageW, marginX } = LAYOUT;
  const totalW = pageW - marginX * 2;
  const cardW = (totalW - gap * (cols - 1)) / cols;

  items.forEach((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = marginX + col * (cardW + gap);
    const cy = y + row * (cardH + gap);
    drawCard(pdf, cx, cy, cardW, cardH, it);
  });

  const rows = Math.ceil(items.length / cols);
  return y + rows * (cardH + gap) - gap + 14;
}

// ─────────────────────────────── Section card (ficha) ───────────────────────

export interface SectionCardOpts {
  /** Número de orden (1, 2, …). Si se omite, no se muestra. */
  index?: number;
  /** Título principal en mayúscula institucional. */
  title: string;
  /** Pares label/value que se renderizan en grid 2-col dentro de la card. */
  fields: Array<{ label: string; value: string }>;
  /** Acento del header de la card. */
  accent?: "blue" | "green" | "ink";
}

/**
 * Calcula la altura aproximada que ocupará la section card.
 */
export function measureSectionCard(opts: SectionCardOpts): number {
  const rows = Math.ceil(opts.fields.length / 2);
  const headerH = 30;
  const bodyH = 16 + rows * 32 + 6;
  return headerH + bodyH;
}

/**
 * Dibuja una section card: header coloreado con título + cuerpo blanco con
 * grid 2-col de label/value. Devuelve la nueva `y`.
 */
export function drawSectionCard(pdf: jsPDF, y: number, opts: SectionCardOpts): number {
  const { pageW, marginX } = LAYOUT;
  const w = pageW - marginX * 2;
  const headerH = 30;
  const rows = Math.ceil(opts.fields.length / 2);
  const bodyH = 16 + rows * 32 + 6;
  const totalH = headerH + bodyH;

  const accent = opts.accent ?? "blue";
  const accentColor = accent === "green" ? BRAND.green : accent === "ink" ? BRAND.blueDeep : BRAND.blue;

  // Sombra suave (rectángulo gris detrás)
  pdf.setFillColor(235, 238, 244);
  pdf.roundedRect(marginX + 1, y + 2, w, totalH, 10, 10, "F");

  // Cuerpo blanco con borde
  roundedRect(pdf, marginX, y, w, totalH, 10, BRAND.white, BRAND.border, 0.6);

  // Header coloreado superior con recorte (overpaint)
  pdf.setFillColor(...accentColor);
  pdf.roundedRect(marginX, y, w, headerH + 4, 10, 10, "F");
  // tapamos los redondeos inferiores del header con un rect plano
  pdf.setFillColor(...accentColor);
  pdf.rect(marginX, y + headerH - 6, w, 6, "F");

  // Título + índice
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(255, 255, 255);
  const label = opts.index !== undefined
    ? `${String(opts.index).padStart(2, "0")}  ·  ${opts.title.toUpperCase()}`
    : opts.title.toUpperCase();
  pdf.text(label, marginX + 16, y + 20, { charSpace: 0.5 });

  // Body fields 2-col
  const colW = (w - 32) / 2;
  const padL = marginX + 16;
  let cursorY = y + headerH + 14;
  opts.fields.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const fx = padL + col * (colW + 0);
    const fy = cursorY + row * 32;

    // Label
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(...BRAND.muted);
    pdf.text(f.label.toUpperCase(), fx, fy, { charSpace: 0.4 });

    // Value
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(...BRAND.ink);
    const lines = (pdf.splitTextToSize(f.value || "—", colW - 8) as string[]).slice(0, 2);
    lines.forEach((line, j) => pdf.text(line, fx, fy + 12 + j * 11));
  });

  return y + totalH + 12;
}

// ─────────────────────────────── Texto / párrafos ───────────────────────────

export interface TextOpts {
  size?: number;
  bold?: boolean;
  align?: "left" | "center" | "justify";
  color?: [number, number, number];
  lineGap?: number;
}

/**
 * Escribe texto justificado con corte automático de página. Devuelve la nueva
 * `y`. El handler de corte se inyecta para que el caller controle headers.
 */
export function writeText(
  pdf: jsPDF,
  y: number,
  text: string,
  opts: TextOpts,
  onPageBreak: () => number,
): number {
  const { pageW, marginX, contentBottom } = LAYOUT;
  const contentW = pageW - marginX * 2;
  pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
  pdf.setFontSize(opts.size ?? 10.5);
  pdf.setTextColor(...(opts.color ?? BRAND.ink));
  const lineH = (opts.size ?? 10.5) * 1.45;
  const lines = pdf.splitTextToSize(text, contentW) as string[];
  let cursorY = y;
  for (const line of lines) {
    if (cursorY + lineH > contentBottom) cursorY = onPageBreak();
    if (opts.align === "center") {
      pdf.text(line, pageW / 2, cursorY, { align: "center" });
    } else if (opts.align === "justify") {
      pdf.text(line, marginX, cursorY, { maxWidth: contentW, align: "justify" });
    } else {
      pdf.text(line, marginX, cursorY);
    }
    cursorY += lineH;
  }
  return cursorY + (opts.lineGap ?? 0);
}

// ─────────────────────────────── Firmas ─────────────────────────────────────

export interface SignatureCol { label: string; name?: string; cc?: string }

export function drawSignatures(pdf: jsPDF, y: number, columns: SignatureCol[]): number {
  const { pageW, marginX } = LAYOUT;
  const contentW = pageW - marginX * 2;
  const colW = contentW / columns.length;

  pdf.setDrawColor(...BRAND.ink);
  pdf.setLineWidth(0.6);
  columns.forEach((_, i) => {
    const x1 = marginX + colW * i + 24;
    const x2 = marginX + colW * (i + 1) - 24;
    pdf.line(x1, y, x2, y);
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9.5);
  pdf.setTextColor(...BRAND.blue);
  columns.forEach((col, i) => {
    pdf.text(col.label, marginX + colW * i + colW / 2, y + 14, { align: "center" });
  });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(...BRAND.ink);
  columns.forEach((col, i) => {
    if (col.name) pdf.text(col.name, marginX + colW * i + colW / 2, y + 28, { align: "center" });
  });

  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.muted);
  columns.forEach((col, i) => {
    if (col.cc) pdf.text(col.cc, marginX + colW * i + colW / 2, y + 42, { align: "center" });
  });

  return y + 58;
}

// ─────────────────────────────── Construcción de PDF base ───────────────────

export function createNuvexPdf(): jsPDF {
  return new jsPDF({ unit: "pt", format: "letter" });
}

/**
 * Helper para abrir una nueva página y dejar el cursor en `contentTop`.
 * El header/footer se aplican al final con `applyChrome`.
 */
export function nextPage(pdf: jsPDF): number {
  pdf.addPage();
  return LAYOUT.contentTop;
}
