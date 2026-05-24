export interface CuotaBaseInput {
  cuotaConInteresSinSeguros?: string | number | null;
  beneficioAplicado?: string | number | null;
  totalSeguros?: string | number | null;
}

export interface CuotaBaseResultado {
  cuotaBaseSimulacion: number;
  requiereVerificacion: boolean;
  alerta?: string;
}

export const ALERTA_CUOTA_CON_INTERES_SIN_SEGUROS =
  "No se pudo identificar la cuota con interés sin seguros. Verifique manualmente.";

export function parseMontoExtracto(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let cleaned = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;

  const negative = cleaned.startsWith("-");
  if (negative) cleaned = cleaned.slice(1);

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized = cleaned;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (lastComma !== -1) {
    const parts = cleaned.split(",");
    const last = parts.at(-1) ?? "";
    const thousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    normalized = thousands || last.length > 2 ? cleaned.replace(/,/g, "") : cleaned.replace(",", ".");
  } else if (lastDot !== -1) {
    const parts = cleaned.split(".");
    const last = parts.at(-1) ?? "";
    const thousands = parts.length > 1 && parts.slice(1).every((p) => p.length === 3);
    normalized = thousands ? cleaned.replace(/\./g, "") : cleaned;
  }

  const parsed = parseFloat(`${negative ? "-" : ""}${normalized}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMontoExtracto(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  return Number.isInteger(value)
    ? String(Math.round(value))
    : value.toFixed(2).replace(/\.?0+$/, "");
}

export function calcularCuotaBaseSimulacion(input: CuotaBaseInput): CuotaBaseResultado {
  const cuotaConInteresSinSeguros = parseMontoExtracto(input.cuotaConInteresSinSeguros);
  if (cuotaConInteresSinSeguros <= 0) {
    return {
      cuotaBaseSimulacion: 0,
      requiereVerificacion: true,
      alerta: ALERTA_CUOTA_CON_INTERES_SIN_SEGUROS,
    };
  }

  const beneficioAplicado = Math.max(0, parseMontoExtracto(input.beneficioAplicado));
  const totalSeguros = Math.max(0, parseMontoExtracto(input.totalSeguros));

  return {
    cuotaBaseSimulacion: cuotaConInteresSinSeguros + beneficioAplicado + totalSeguros,
    requiereVerificacion: false,
  };
}
