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

      const captureWidth = Math.max(el.scrollWidth, el.offsetWidth);
      const captureHeight = Math.max(el.scrollHeight, el.offsetHeight);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#050918",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        width: captureWidth,
        height: captureHeight,
        windowWidth: captureWidth,
        windowHeight: captureHeight,
      });

      const pdf = new JsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [captureWidth, captureHeight],
      });

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 0, 0, captureWidth, captureHeight);

      const fileName = options.fileName ?? "NUVIA_CaseSnapshot.pdf";
      pdf.save(fileName);
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, options.fileName]);

  return { exportPDF, isExporting };
}
