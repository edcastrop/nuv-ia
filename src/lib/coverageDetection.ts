import { parseMontoExtracto } from "./cuotaBase";

type CoverageInput = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));
const amount = (value: unknown) => parseMontoExtracto(text(value));

export function hasRealCoverageSignals(data: CoverageInput, producto?: string | null): boolean {
  const productText = `${producto ?? ""} ${text(data.producto)} ${text(data.tipoCredito)} ${text(data.banco)}`;
  const explicitValue =
    amount(data.valorCobertura) ||
    amount(data.valorSubsidioGobierno) ||
    amount(data.valorBeneficioMensual);
  const explicitRate = amount(data.tasaCobertura);
  if (explicitValue > 0 || explicitRate > 0) return true;

  if (/\bfna\b|fondo\s+nacional\s+del\s+ahorro/i.test(productText)) return false;
  if (/sin\s+beneficio\s+de\s+cobertura|sin\s+cobertura/i.test(productText)) return false;

  const cuotaSinSubsidio = amount(data.cuotaSinSubsidio) || amount(data.valorCuotaSinSubsidioGobierno);
  const cuotaCliente = amount(data.cuotaPagadaCliente) || amount(data.valorCuotaConSubsidio) || amount(data.valorAPagar);
  const diff = cuotaSinSubsidio - cuotaCliente;
  return cuotaSinSubsidio > 0 && cuotaCliente > 0 && diff >= Math.max(2_500, cuotaCliente * 0.005);
}

export function normalizeCoverageProductLabel(producto: string, hasCoverage: boolean): string {
  const clean = producto.trim().replace(/\s+/g, " ");
  if (!clean) return clean;
  if (hasCoverage) {
    return /con\s+beneficio\s+de\s+cobertura/i.test(clean)
      ? clean
      : `${clean} con Beneficio de Cobertura`;
  }
  return clean
    .replace(/\s+con\s+beneficio\s+de\s+cobertura/gi, "")
    .replace(/\s+con\s+cobertura/gi, "")
    .trim();
}