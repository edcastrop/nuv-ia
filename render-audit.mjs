import { jsPDF } from "jspdf";
import fs from "node:fs";

const pdf = new jsPDF({ unit: "pt", format: "letter" });
const pageW = 612, pageH = 792, marginX = 48, footerH = 64;
const y0 = pageH - footerH;

// fondo negro footer
pdf.setFillColor(28,28,28); pdf.rect(0,y0,pageW,footerH,"F");
pdf.setFillColor(255,255,255); pdf.triangle(0,y0,200,y0,0,pageH,"F");

// pag
pdf.setFont("helvetica","bold"); pdf.setFontSize(8); pdf.setTextColor(255,255,255);
pdf.text("Pág. 1 de 1", pageW - marginX, y0 + footerH/2 + 3, { align: "right" });

const iconX = 220, textX = iconX + 12;
pdf.setFont("helvetica","normal"); pdf.setFontSize(8); pdf.setTextColor(225,232,245);

function drawIconPin(x,y){pdf.setDrawColor(225,232,245);pdf.setFillColor(225,232,245);pdf.setLineWidth(0.6);pdf.circle(x+3.5,y+2.5,2.2,"S");pdf.triangle(x+1.5,y+4,x+5.5,y+4,x+3.5,y+7,"F");pdf.circle(x+3.5,y+2.5,0.7,"F");}
function drawIconGlobe(x,y){pdf.setDrawColor(225,232,245);pdf.setLineWidth(0.6);const cx=x+3.5,cy=y+3.5,r=3;pdf.circle(cx,cy,r,"S");pdf.line(cx-r,cy,cx+r,cy);pdf.line(cx,cy-r,cx,cy+r);pdf.ellipse(cx,cy,r*0.55,r,"S");}
function drawIconPhone(x,y){pdf.setDrawColor(225,232,245);pdf.setFillColor(225,232,245);pdf.setLineWidth(0.6);pdf.roundedRect(x+0.5,y+0.5,2.4,3.2,0.6,0.6,"F");pdf.roundedRect(x+4.1,y+3.8,2.4,3.2,0.6,0.6,"F");pdf.setLineWidth(0.8);pdf.line(x+2.5,y+2.5,x+4.5,y+4.5);}
function drawIconEnvelope(x,y){pdf.setDrawColor(225,232,245);pdf.setLineWidth(0.6);pdf.rect(x,y+1,7,5,"S");pdf.line(x,y+1,x+3.5,y+4);pdf.line(x+3.5,y+4,x+7,y+1);}

const y1 = y0 + 18;
drawIconPin(iconX, y1-6);
pdf.text("Carrera 16 # 37-48 piso 4  ·  Bucaramanga", textX, y1);

const y2 = y0 + 32;
drawIconGlobe(iconX, y2-6);
pdf.text("www.nuvex.com.co", textX, y2);
const phoneIconX = textX + pdf.getTextWidth("www.nuvex.com.co") + 14;
drawIconPhone(phoneIconX, y2-6);
pdf.text("+57 316 4023779", phoneIconX + 12, y2);

const y3 = y0 + 46;
drawIconEnvelope(iconX, y3-6);
pdf.text("juridica@nuvex.com.co", textX, y3);

fs.writeFileSync("/tmp/audit/poder.pdf", Buffer.from(pdf.output("arraybuffer")));
console.log("OK");
