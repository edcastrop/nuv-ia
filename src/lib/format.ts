// Utilidades de parseo y formateo para inputs financieros NUVEX

export function parseCurrency(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  // si tiene puntos como separador de miles y coma decimal o nada
  // Estrategia: si hay coma, asumir coma decimal; eliminar puntos.
  if (cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // si solo hay puntos, podrían ser miles (ej. 221.903.943) o decimal (ej. 11.15)
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    // varios puntos => miles
    return parseFloat(cleaned.replace(/\./g, "")) || 0;
  }
  if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
    // ambiguo tipo 221.903 -> miles
    return parseFloat(cleaned.replace(/\./g, "")) || 0;
  }
  return parseFloat(cleaned) || 0;
}

export function parseDecimal(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

export function parsePercentage(value: string | number | null | undefined): number {
  return parseDecimal(value);
}

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCOP(value: number): string {
  if (!isFinite(value)) return "$ 0";
  return copFormatter.format(Math.round(value)).replace("COP", "$").trim();
}

export function formatNumber(value: number, decimals = 2): string {
  if (!isFinite(value)) return "0";
  return new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercentage(value: number, decimals = 2): string {
  if (!isFinite(value)) return "0%";
  return `${formatNumber(value, decimals)}%`;
}

/**
 * Formatea valores UVR con precisión exacta (4 decimales por defecto).
 * La UVR se publica oficialmente con 4 decimales y NO debe redondearse,
 * pues cualquier aproximación altera la proyección de capital e intereses.
 */
export function formatUVR(value: number, decimals = 4): string {
  if (!isFinite(value)) return "$ 0";
  return `$ ${new Intl.NumberFormat("es-CO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;
}

export function formatInt(value: number): string {
  return numberFormatter.format(Math.round(value));
}
