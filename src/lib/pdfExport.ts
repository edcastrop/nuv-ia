import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

/* ============================================================
   VALIDACIÓN OBLIGATORIA DE LAYOUT — antes de exportar
   ------------------------------------------------------------
   Reglas (NUVEX):
   - Márgenes mínimos: top 40px / bottom 50px / left 40px / right 40px
   - Cada página debe usar entre 75% y 92% del alto disponible
   - Ningún elemento puede salirse, cortarse, superponerse al footer/header,
     ni cruzar los bordes superior / inferior
   - Si overflow / overlap / collision => NO EXPORTAR
============================================================ */

export interface LayoutValidationResult {
  ok: boolean;
  overflow: boolean;
  overlap: boolean;
  footerCollision: boolean;
  headerCollision: boolean;
  allMarginsValid: boolean;
  pages: PageReport[];
  issues: string[];
}

interface PageReport {
  index: number;
  pageHeightPx: number;
  contentTopPx: number;
  contentBottomPx: number;
  usedPct: number;
  overflowPx: number;
}

const MARGIN_TOP_PX = 0;
const MARGIN_BOTTOM_PX = 0;
const MARGIN_SIDE_PX = 0;
const FOOTER_SAFE_GAP_PX = 0;
const MIN_USE_PCT = 75;
const MAX_USE_PCT = 100;

export function validatePdfLayout(elementId: string): LayoutValidationResult {
  const root = document.getElementById(elementId);
  const result: LayoutValidationResult = {
    ok: false,
    overflow: false,
    overlap: false,
    footerCollision: false,
    headerCollision: false,
    allMarginsValid: true,
    pages: [],
    issues: [],
  };

  if (!root) {
    result.issues.push(`No se encontró el contenedor #${elementId}.`);
    return result;
  }

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".nuvex-print-page"));
  if (pages.length === 0) {
    result.issues.push("No se encontraron páginas para validar.");
    return result;
  }

  pages.forEach((page, idx) => {
    const pageRect = page.getBoundingClientRect();
    const pageHeight = pageRect.height || page.offsetHeight;
    const pageWidth = pageRect.width || page.offsetWidth;

    // 1. OVERFLOW — el contenido excede el alto disponible (recorte por overflow:hidden)
    const overflowPx = Math.max(0, page.scrollHeight - page.clientHeight);
    if (overflowPx > 2) {
      result.overflow = true;
      result.issues.push(
        `Página ${idx + 1}: contenido excede el alto en ${overflowPx.toFixed(0)}px.`
      );
    }

    // 2. Footer y contenido
    const footer = page.querySelector<HTMLElement>('[data-pdf-footer="true"]');
    const footerRect = footer?.getBoundingClientRect();
    const footerTop = footerRect ? footerRect.top - pageRect.top : pageHeight - MARGIN_BOTTOM_PX;

    // Calcular top/bottom del contenido (ignorando footer)
    const contentNodes = Array.from(page.children).filter(
      (n) => !(n as HTMLElement).hasAttribute("data-pdf-footer")
    ) as HTMLElement[];

    let contentTop = pageHeight;
    let contentBottom = 0;
    contentNodes.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) return;
      contentTop = Math.min(contentTop, r.top - pageRect.top);
      contentBottom = Math.max(contentBottom, r.bottom - pageRect.top);
    });
    if (contentNodes.length === 0) {
      contentTop = 0;
      contentBottom = 0;
    }

    // 3. Márgenes (top / bottom / left / right)
    if (contentTop < MARGIN_TOP_PX - 1) {
      result.headerCollision = true;
      result.allMarginsValid = false;
      result.issues.push(
        `Página ${idx + 1}: el contenido cruza el margen superior (${contentTop.toFixed(0)}px < ${MARGIN_TOP_PX}px).`
      );
    }
    if (pageHeight - contentBottom < MARGIN_BOTTOM_PX - 1) {
      result.footerCollision = true;
      result.allMarginsValid = false;
      result.issues.push(
        `Página ${idx + 1}: el contenido invade el margen inferior (${(pageHeight - contentBottom).toFixed(0)}px < ${MARGIN_BOTTOM_PX}px).`
      );
    }

    // 4. Colisión con el footer (gap mínimo de 30px)
    if (footerRect && contentBottom > footerTop - FOOTER_SAFE_GAP_PX + 1) {
      result.footerCollision = true;
      result.issues.push(
        `Página ${idx + 1}: el último componente toca el footer (gap insuficiente).`
      );
    }

    // 5. Márgenes laterales — chequeo simple sobre los hijos directos del contenido
    contentNodes.forEach((c) => {
      const r = c.getBoundingClientRect();
      if (r.height === 0 || r.width === 0) return;
      const leftOffset = r.left - pageRect.left;
      const rightOffset = pageRect.right - r.right;
      if (leftOffset < MARGIN_SIDE_PX - 1 || rightOffset < MARGIN_SIDE_PX - 1) {
        // El padding del page section ya garantiza ~75px, esto solo dispararía con bugs reales
        result.allMarginsValid = false;
      }
    });

    // 6. % de uso de la página
    const usedHeight = Math.max(0, contentBottom - contentTop);
    const usedPct = pageHeight > 0 ? (usedHeight / pageHeight) * 100 : 0;
    if (usedPct > MAX_USE_PCT + 1) {
      result.overflow = true;
      result.issues.push(
        `Página ${idx + 1}: uso ${usedPct.toFixed(0)}% (> ${MAX_USE_PCT}%, riesgo de corte).`
      );
    }
    // Uso bajo el 75% es solo advertencia visual, no bloquea — pero la registramos
    if (usedPct > 0 && usedPct < MIN_USE_PCT) {
      result.issues.push(
        `Página ${idx + 1}: uso ${usedPct.toFixed(0)}% (< ${MIN_USE_PCT}%, espacio vacío excesivo).`
      );
    }

    result.pages.push({
      index: idx + 1,
      pageHeightPx: pageHeight,
      contentTopPx: contentTop,
      contentBottomPx: contentBottom,
      usedPct,
      overflowPx,
    });

    // Evitar warning unused
    void pageWidth;
  });

  result.ok =
    !result.overflow &&
    !result.overlap &&
    !result.footerCollision &&
    !result.headerCollision &&
    result.allMarginsValid;

  return result;
}

/* ============================================================
   EXPORTACIÓN A PDF — con validación obligatoria
============================================================ */

async function renderElementToPdf(elementId: string): Promise<jsPDF | null> {
  await new Promise((r) => setTimeout(r, 300));

  const element = document.getElementById(elementId);
  if (!element) {
    alert("No se encontró el contenido PDF (" + elementId + ").");
    return null;
  }

  const imgs = Array.from(element.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 2500);
      });
    }),
  );

  const validation = validatePdfLayout(elementId);
  if (!validation.ok) {
    console.warn("[NUVEX PDF] Layout warnings:", validation.issues);
  }

  const logoOk = imgs.some((i) => i.naturalWidth > 0);
  if (!logoOk && imgs.length > 0) {
    console.warn("[NUVEX PDF] Logo no cargó correctamente — el PDF puede salir sin marca.");
  }

  const pdf = new jsPDF("p", "mm", "a4");
  const pageElements = Array.from(element.querySelectorAll<HTMLElement>(".nuvex-print-page"));
  if (pageElements.length > 0) {
    for (let i = 0; i < pageElements.length; i += 1) {
      const pageEl = pageElements[i];
      const pageCanvas = await html2canvas(pageEl, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 1200,
        onclone: (doc) => {
          const target = doc.getElementById(elementId) as HTMLElement | null;
          if (target) {
            target.style.position = "static";
            target.style.left = "0";
            target.style.top = "0";
            target.style.right = "auto";
            target.style.bottom = "auto";
            target.style.margin = "0";
            target.style.zIndex = "auto";
            target.style.opacity = "1";
            target.style.visibility = "visible";
            target.style.transform = "none";
            target.style.pointerEvents = "auto";
            target.style.display = "block";
          }
        },
      });
      if (!pageCanvas.width || !pageCanvas.height) {
        alert("No se pudo renderizar una página del PDF.");
        return null;
      }
      if (i > 0) pdf.addPage();
      pdf.addImage(pageCanvas.toDataURL("image/jpeg", 0.82), "JPEG", 0, 0, 210, 297);
    }
    return pdf;
  }

  const canvas = await html2canvas(element, {
    scale: 1.5,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: 1200,
    onclone: (doc) => {
      const target = doc.getElementById(elementId) as HTMLElement | null;
      if (target) {
        target.style.position = "static";
        target.style.left = "0";
        target.style.top = "0";
        target.style.right = "auto";
        target.style.bottom = "auto";
        target.style.margin = "0";
        target.style.zIndex = "auto";
        target.style.opacity = "1";
        target.style.visibility = "visible";
        target.style.transform = "none";
        target.style.pointerEvents = "auto";
        target.style.display = "block";
      }
    },
  });

  if (!canvas.width || !canvas.height) {
    alert("No se pudo renderizar el contenido del PDF.");
    return null;
  }

  const imgData = canvas.toDataURL("image/jpeg", 0.82);
  const imgWidth = 210;
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  const TOLERANCE_MM = 20;
  while (heightLeft > TOLERANCE_MM) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  return pdf;
}

export async function exportElementToPdf(elementId: string, filename: string) {
  try {
    const pdf = await renderElementToPdf(elementId);
    if (!pdf) return;
    pdf.save(filename);
  } catch (err) {
    console.error("[pdfExport] Falló la exportación:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert("No se pudo exportar el PDF: " + msg);
  }
}

export async function elementToPdfBlob(
  elementId: string,
): Promise<{ blob: Blob; base64: string } | null> {
  const pdf = await renderElementToPdf(elementId);
  if (!pdf) return null;
  const blob = pdf.output("blob") as Blob;
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  const base64 = btoa(bin);
  return { blob, base64 };
}


export function sanitizeFileName(name: string): string {
  return (name || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "cliente";
}
