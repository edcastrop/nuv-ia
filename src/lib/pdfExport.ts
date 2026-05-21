import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function exportElementToPdf(elementId: string, filename: string) {
  // Esperar a que el DOM termine de renderizar
  await new Promise((r) => setTimeout(r, 500));

  const element = document.getElementById(elementId);
  if (!element) {
    alert("No se encontró el contenido PDF (" + elementId + ").");
    return;
  }
  if (element.offsetHeight === 0) {
    alert("El contenido PDF está vacío o no se ha renderizado.");
    return;
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    windowWidth: element.scrollWidth,
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
}

export function sanitizeFileName(name: string): string {
  return (name || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "cliente";
}
