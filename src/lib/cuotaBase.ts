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
  const cleaned = String(value).replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  if (cleaned.includes(",") && cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }

  const parts = cleaned.split(".");
  if (parts.length > 2) return parseFloat(cleaned.replace(/\./g, "")) || 0;
  if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
    return parseFloat(cleaned.replace(/\./g, "")) || 0;
  }
  return parseFloat(cleaned) || 0;
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
