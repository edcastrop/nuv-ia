import { parseCurrency } from "./format";

export type CreditMoneyField =
  | "valorDesembolsado"
  | "saldoCapital"
  | "cuotaActual"
  | "seguros"
  | "cuotaBaseSimulacion"
  | "cuotaConSubsidio"
  | "cuotaConInteresSinSeguros"
  | "cuotaSinSubsidio"
  | "valorBeneficioMensual"
  | "interesCuota"
  | "capitalCuota";

type MoneyInput = Partial<Record<CreditMoneyField, string | number | null | undefined>>;

const MONTHLY_FIELDS: CreditMoneyField[] = [
  "cuotaActual",
  "cuotaBaseSimulacion",
  "cuotaConSubsidio",
  "cuotaConInteresSinSeguros",
  "cuotaSinSubsidio",
  "interesCuota",
  "capitalCuota",
];

const STORAGE_INT_FIELDS = new Set<CreditMoneyField>([
  "valorDesembolsado",
  "saldoCapital",
  "cuotaActual",
  "seguros",
  "cuotaBaseSimulacion",
  "cuotaConSubsidio",
  "cuotaConInteresSinSeguros",
  "cuotaSinSubsidio",
  "valorBeneficioMensual",
]);

const moneyToStorage = (field: CreditMoneyField, value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "";
  return STORAGE_INT_FIELDS.has(field)
    ? String(Math.round(value))
    : String(Math.round(value * 100) / 100);
};

export function normalizeCreditMoneyInput(input: MoneyInput) {
  const values: Partial<Record<CreditMoneyField, string>> = {};
  const numbers: Partial<Record<CreditMoneyField, number>> = {};
  const correctedFields: CreditMoneyField[] = [];

  const read = (field: CreditMoneyField) => {
    const n = parseCurrency(input[field]);
    if (n > 0) numbers[field] = n;
    return n;
  };
  const write = (field: CreditMoneyField, value: number, corrected = false) => {
    numbers[field] = value;
    values[field] = moneyToStorage(field, value);
    if (corrected) correctedFields.push(field);
  };

  const valorDesembolsado = read("valorDesembolsado");
  let saldoCapital = read("saldoCapital");

  if (
    valorDesembolsado > 0 &&
    saldoCapital > valorDesembolsado * 2 &&
    saldoCapital / 100 > 0 &&
    saldoCapital / 100 <= valorDesembolsado * 1.35
  ) {
    saldoCapital = saldoCapital / 100;
    write("saldoCapital", saldoCapital, true);
  } else if (saldoCapital > 0) {
    write("saldoCapital", saldoCapital);
  }
  if (valorDesembolsado > 0) write("valorDesembolsado", valorDesembolsado);

  const baseCredito = Math.max(saldoCapital, valorDesembolsado, 1);
  const cuotaMaximaRazonable = Math.max(8_000_000, baseCredito * 0.04);

  for (const field of MONTHLY_FIELDS) {
    const raw = read(field);
    if (raw <= 0) continue;
    const normalized =
      raw > cuotaMaximaRazonable && raw / 100 <= cuotaMaximaRazonable ? raw / 100 : raw;
    write(field, normalized, normalized !== raw);
  }

  const cuotaReferencia = Math.max(
    numbers.cuotaActual ?? 0,
    numbers.cuotaBaseSimulacion ?? 0,
    numbers.cuotaConInteresSinSeguros ?? 0,
    1,
  );
  const accesorioMaximo = Math.max(500_000, cuotaReferencia * 0.2);

  for (const field of ["seguros", "valorBeneficioMensual"] as CreditMoneyField[]) {
    const raw = read(field);
    if (raw <= 0) continue;
    const normalized = raw > accesorioMaximo && raw / 100 <= accesorioMaximo ? raw / 100 : raw;
    write(field, normalized, normalized !== raw);
  }

  return { values, numbers, correctedFields };
}