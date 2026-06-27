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
      const imgRatio = canvas.height / canvas.width;
      const renderW = pageW;
      const renderH = renderW * imgRatio;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      if (renderH <= pageH) {
        pdf.addImage(imgData, "JPEG", 0, 0, renderW, renderH);
      } else {
        // Multi-page slicing
        let remaining = renderH;
        let y = 0;
        while (remaining > 0) {
          pdf.addImage(imgData, "JPEG", 0, y, renderW, renderH);
          remaining -= pageH;
          if (remaining > 0) {
            pdf.addPage();
            y -= pageH;
          }
        }
      }

      const fileName = options.fileName ?? "NUVIA_CaseSnapshot.pdf";
      pdf.save(fileName);
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, options.fileName]);

  return { exportPDF, isExporting };
}
