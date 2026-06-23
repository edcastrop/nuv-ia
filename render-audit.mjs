import { jsPDF } from "jspdf";
import fs from "node:fs";
import path from "node:path";

// Cargar logo como dataURL
const logoPath = "src/assets/logo-nuvex.png";
const logoB64 = fs.readFileSync(logoPath).toString("base64");
const logoDataUrl = `data:image/png;base64,${logoB64}`;

// Importar funciones (transpile via tsx)
const mod = await import("/dev-server/src/lib/pdf/nuvexPdfKit.ts");
const { drawPoderHeader, drawPoderFooter, LAYOUT } = mod;

const pdf = new jsPDF({ unit: "pt", format: "letter" });
drawPoderHeader(pdf, logoDataUrl, { documento: "Poder Especial", consecutivo: "NUVEX-PE-2026-0421", kind: "poder" });
// algo de contenido
pdf.setFont("helvetica","normal"); pdf.setFontSize(11); pdf.setTextColor(20,20,20);
pdf.text("Contenido de prueba…", 48, 200);
drawPoderFooter(pdf, 1, 1);

const out = "/tmp/audit/poder.pdf";
fs.writeFileSync(out, Buffer.from(pdf.output("arraybuffer")));
console.log("OK", out);
