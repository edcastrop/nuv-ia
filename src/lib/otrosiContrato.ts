// Generador de OTROSÍ AL CONTRATO DE PRESTACIÓN DE SERVICIOS
// Se dispara automáticamente cuando el resultado aprobado por el banco
// difiere de la propuesta presentada al cliente.

import { formatCOP } from "./format";

export interface OtrosiInput {
  numeroExpediente: string;
  clienteNombre: string;
  clienteCedula: string;
  bancoNombre: string;
  fechaPropuesta: string; // ISO
  fechaAprobacion: string; // ISO
  // Condiciones presentadas (NUVEX)
  cuotaPropuesta: number;
  plazoPropuesto: number;
  ahorroPropuesto: number;
  honorariosPactados: number;
  // Condiciones aprobadas (Banco)
  cuotaAprobada: number;
  plazoAprobado: number;
  ahorroAprobado: number;
  honorariosRecalculados: number;
}

export function aplicaOtrosi(i: OtrosiInput): boolean {
  const tol = 0.02; // 2%
  const diff = (a: number, b: number) =>
    Math.abs(a - b) / Math.max(Math.abs(b), 1) > tol;
  return (
    diff(i.cuotaPropuesta, i.cuotaAprobada) ||
    diff(i.plazoPropuesto, i.plazoAprobado) ||
    diff(i.honorariosPactados, i.honorariosRecalculados)
  );
}

/** HTML imprimible del otrosí. */
export function generarOtrosiHTML(i: OtrosiInput): string {
  const row = (label: string, presentado: string, aprobado: string) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${label}</td>
      <td style="padding:8px;border:1px solid #ddd;">${presentado}</td>
      <td style="padding:8px;border:1px solid #ddd;">${aprobado}</td>
    </tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Otrosí — ${i.numeroExpediente}</title>
<style>body{font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:780px;margin:32px auto;padding:0 24px}
h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;margin-top:24px}
p{font-size:13px;line-height:1.6}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
th{padding:8px;border:1px solid #ddd;background:#f5f5f5;text-align:left}</style></head>
<body>
<h1>OTROSÍ AL CONTRATO DE PRESTACIÓN DE SERVICIOS</h1>
<p><strong>Expediente:</strong> ${i.numeroExpediente} · <strong>Cliente:</strong> ${i.clienteNombre} · <strong>C.C.:</strong> ${i.clienteCedula} · <strong>Banco:</strong> ${i.bancoNombre}</p>
<p>Entre las partes se modifica el contrato original suscrito en relación con la propuesta presentada el ${i.fechaPropuesta}. El banco aprobó condiciones diferentes el ${i.fechaAprobacion}, según se detalla a continuación.</p>
<h2>Comparativo de condiciones</h2>
<table><thead><tr><th>Concepto</th><th>Presentado (NUVEX)</th><th>Aprobado (Banco)</th></tr></thead>
<tbody>
${row("Cuota mensual", formatCOP(i.cuotaPropuesta), formatCOP(i.cuotaAprobada))}
${row("Plazo (meses)", String(i.plazoPropuesto), String(i.plazoAprobado))}
${row("Ahorro proyectado", formatCOP(i.ahorroPropuesto), formatCOP(i.ahorroAprobado))}
${row("Honorarios", formatCOP(i.honorariosPactados), formatCOP(i.honorariosRecalculados))}
</tbody></table>
<h2>Honorarios recalculados</h2>
<p>En virtud del principio de honorarios a éxito, el valor a cobrar al cliente se ajusta de <strong>${formatCOP(i.honorariosPactados)}</strong> a <strong>${formatCOP(i.honorariosRecalculados)}</strong>.</p>
<p>Las demás cláusulas del contrato original permanecen vigentes y sin modificación.</p>
<p style="margin-top:48px">_____________________________<br/>Firma del cliente</p>
<p>_____________________________<br/>Firma del representante NUVEX</p>
</body></html>`;
}

/** Abre una nueva pestaña con el otrosí listo para imprimir / guardar como PDF. */
export function abrirOtrosiImprimible(i: OtrosiInput): void {
  const html = generarOtrosiHTML(i);
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.focus(), 100);
}
