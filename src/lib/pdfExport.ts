import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

export async function exportElementToPdf(elementId: string, filename: string) {
  // Esperar a que React termine de pintar el contenido
  await new Promise((r) => setTimeout(r, 300));

  const element = document.getElementById(elementId);
  if (!element) {
    alert("No se encontró el contenido PDF (" + elementId + ").");
    return;
  }

  try {
    // html2canvas-pro clona el documento antes de renderizar.
    // Usamos onclone para posicionar el contenedor en (0,0) DENTRO del clon,
    // de modo que el original puede seguir oculto fuera de pantalla
    // (sin opacity:0 ni visibility:hidden, que producen páginas en blanco).
    const canvas = await html2canvas(element, {
      scale: 2,
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
      return;
    }

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Tolerancia: si el sobrante es menor a 8mm, NO crear página adicional
    // (evita la página en blanco al final por décimas de mm de overflow).
    const TOLERANCE_MM = 8;
    while (heightLeft > TOLERANCE_MM) {
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
