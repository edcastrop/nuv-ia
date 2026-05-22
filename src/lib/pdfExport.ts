import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function exportElementToPdf(elementId: string, filename: string) {
  // Esperar a que el DOM termine de renderizar
  await new Promise((r) => setTimeout(r, 300));

  const element = document.getElementById(elementId);
  if (!element) {
    alert("No se encontró el contenido PDF (" + elementId + ").");
    return;
  }

  // El contenedor está posicionado fuera de pantalla (left: -10000px).
  // html2canvas-pro tiene problemas capturando elementos muy alejados del viewport,
  // así que lo movemos temporalmente a una posición visible pero oculta visualmente.
  const originalStyle = element.getAttribute("style") || "";
  element.style.position = "fixed";
  element.style.left = "0";
  element.style.top = "0";
  element.style.zIndex = "-1";
  element.style.opacity = "0";
  element.style.pointerEvents = "none";

  // Esperar al reflow
  await new Promise((r) => setTimeout(r, 200));

  try {
    if (element.offsetHeight === 0 || element.scrollWidth === 0) {
      alert("El contenido PDF está vacío o no se ha renderizado.");
      return;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (err) {
    console.error("[pdfExport] Falló la exportación:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert("No se pudo exportar el PDF: " + msg);
  } finally {
    // Restaurar estilos originales
    element.setAttribute("style", originalStyle);
  }
}

export function sanitizeFileName(name: string): string {
  return (name || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "cliente";
}
