import { useCallback, useState, type RefObject } from "react";

interface UsePDFExportOptions {
  fileName?: string;
}

export function usePDFExport(
  containerRef: RefObject<HTMLElement | null>,
  options: UsePDFExportOptions = {},
) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, jspdfMod] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const JsPDF = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0A0E1A",
        logging: false,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      });

      const pdf = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      // Calcular si cabe en una página o necesita escalar
      const canvasRatio = canvas.height / canvas.width;
      const renderW = pageW;
      const renderH = renderW * canvasRatio;

      if (renderH <= pageH) {
        // Cabe en una página — centrar verticalmente si sobra espacio
        pdf.addImage(imgData, "JPEG", 0, 0, renderW, renderH);
      } else {
        // Contenido más largo que A4: escalar TODO para que quepa en 1 página
        // (el diseño es una sola hoja ejecutiva, no debe partirse)
        const scaledH = pageH;
        const scaledW = scaledH / canvasRatio;
        const offsetX = (pageW - scaledW) / 2;
        pdf.addImage(imgData, "JPEG", offsetX, 0, scaledW, scaledH);
      }

      const fileName = options.fileName ?? "NUVIA_CaseSnapshot.pdf";
      pdf.save(fileName);
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, options.fileName]);

  return { exportPDF, isExporting };
}
