// Modo "Sirena": subset de notificaciones que ameritan presión agresiva
// (favicon rojo, título parpadeante, sonido repetido).
export const TIPOS_SIRENA = new Set<string>([
  "qa_solicitada",
  "qa_devuelta",
  "qa_escalado",
  "qa_critico",
  "qa_super_escalado",
]);

export function esSirena(tipo: string): boolean {
  return TIPOS_SIRENA.has(tipo);
}

// Genera un favicon 32x32 con badge rojo y número (o punto si no hay count).
export function generarFaviconConBadge(unread: number): string | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Fondo azul NUVIA con ícono simple
  ctx.fillStyle = "#0A1428";
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#5B8CFF";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 16, 17);
  if (unread > 0) {
    // Badge rojo
    ctx.fillStyle = "#FF3B30";
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 10px system-ui, -apple-system, sans-serif";
    ctx.fillText(unread > 9 ? "9+" : String(unread), 24, 9);
  }
  return canvas.toDataURL("image/png");
}

export function aplicarFavicon(dataUrl: string): void {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon'][data-nuvia-dynamic]");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.setAttribute("data-nuvia-dynamic", "1");
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

export function limpiarFaviconDinamico(): void {
  if (typeof document === "undefined") return;
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon'][data-nuvia-dynamic]");
  if (link) link.remove();
}
