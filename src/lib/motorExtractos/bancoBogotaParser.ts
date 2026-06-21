import { formatMontoExtracto, parseMontoExtracto } from "@/lib/cuotaBase";
import type { ExtractoRecord } from "./bancolombiaParser";

const confidence = {
  banco: "alta",
  cliente: "media",
  cedula: "baja",
  numeroCredito: "alta",
  producto: "alta",
  moneda: "alta",
  saldoCapital: "alta",
  cuotaMensual: "alta",
  seguros: "alta",
  plazoInicial: "alta",
  cuotasPagadas: "alta",
  tea: "alta",
  teaCobrada: "alta",
  teaPactada: "alta",
  valorUVR: "baja",
  saldoUVR: "baja",
  valorCobertura: "alta",
  tasaCobertura: "alta",
  valorDesembolsado: "alta",
};

function compactSpaces(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function moneyToNumber(value?: string | null) {
  return parseMontoExtracto(value ?? "");
}

function firstMoneyAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`${escaped}\\s+\\$?\\s*([0-9][0-9.,]*)`, "i");
    const value = moneyToNumber(text.match(rx)?.[1] ?? "");
    if (value > 0) return value;
  }
  return 0;
}

function firstNumberAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const value = parseInt(text.match(new RegExp(`${escaped}\\s+([0-9]{1,4})`, "i"))?.[1] ?? "", 10);
    if (Number.isFinite(value) && value > 0) return String(value);
  }
  return "";
}

function firstPercentAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const raw = text.match(new RegExp(`${escaped}\\s+([0-9]+(?:[,.][0-9]+)?)`, "i"))?.[1] ?? "";
    if (raw) return raw.replace(",", ".");
  }
  return "";
}

function firstTextAfter(text: string, rx: RegExp) {
  return text.match(rx)?.[1]?.trim() ?? "";
}

export function parseBancoBogotaText(rawText: string): ExtractoRecord | null {
  const text = compactSpaces(rawText);
  if (!/banco\s+de\s+bogot/i.test(text) || !/extracto\s+cr[eé]dito\s+de\s+vivienda/i.test(text)) {
    return null;
  }

  const numeroCredito = firstTextAfter(text, /N[úu]mero\s+de\s+cr[eé]dito\s+([0-9]+)/i)
    || firstTextAfter(text, /\b([0-9]{6,}CH[0-9A-Z]*)\b/i);
  const cliente = firstTextAfter(rawText, /(?:Señor\(a\)|Señor|Apreciado\s+Cliente)\s*\n?\s*([A-ZÁÉÍÓÚÑ ]{6,})/i);
  const valorDesembolsado = firstMoneyAfter(text, ["MONTO APROBADO", "VALOR APROBADO"]);
  const plazoInicial = firstNumberAfter(text, ["PLAZO INICAL", "PLAZO INICIAL"]);
  const cuotasPagadas = firstNumberAfter(text, ["CUOTA A PAGAR", "CUOTA ACTUAL"]);
  const cuotasPendientes = firstNumberAfter(text, ["CUOTAS PENDIENTES"]);
  const saldoCapital = firstMoneyAfter(text, ["SALDO TOTAL A LA FECHA DE CORTE"]);
  const tasaEA = firstPercentAfter(text, ["TASA COBRADA E.A.", "TASA COBRADA EA"]);
  const teaPactada = firstPercentAfter(text, ["TASA PACTADA E.A.", "TASA PACTADA EA"]);
  const tasaCobertura = firstPercentAfter(text, ["TASA INTERÉS CON BENEFICIO E.A.", "TASA INTERES CON BENEFICIO E.A."]);

  const capitalCuota = firstMoneyAfter(text, ["+ CAPITAL", "CAPITAL"]);
  const interesCuota = firstMoneyAfter(text, ["+ INTERESES CORRIENTES", "INTERESES CORRIENTES"]);
  const valorSeguroVida = firstMoneyAfter(text, ["+ SEGURO DE VIDA", "SEGURO DE VIDA"]);
  const valorSeguroIncendio = firstMoneyAfter(text, ["+ SEGURO INCENDIO Y TERREMOTO", "SEGURO INCENDIO Y TERREMOTO"]);
  const valorSeguroTerremoto = 0;
  const seguros = valorSeguroVida + valorSeguroIncendio + valorSeguroTerremoto;
  const cuotaSinSubsidio = firstMoneyAfter(text, ["= VALOR TOTAL", "VALOR TOTAL"]);
  const valorBeneficio = firstMoneyAfter(text, ["- VALOR BENEFICIO", "VALOR BENEFICIO"]);
  const totalAPagar = firstMoneyAfter(text, ["= TOTAL A PAGAR", "VALOR TOTAL A PAGAR", "TOTAL A PAGAR"]);
  const baseCalculada = totalAPagar > 0 && valorBeneficio > 0 ? totalAPagar + valorBeneficio : cuotaSinSubsidio;
  const cuotaBase = baseCalculada || (capitalCuota + interesCuota + seguros) || totalAPagar;
  const cuotaFinancieraNeta = totalAPagar > 0 && seguros > 0 ? totalAPagar - seguros : cuotaBase - valorBeneficio - seguros;
  const tieneCobertura = valorBeneficio > 0 || moneyToNumber(tasaCobertura) > 0;
  const errores: string[] = [];

  if (tieneCobertura && totalAPagar > 0 && valorBeneficio > 0 && cuotaBase > 0) {
    const esperado = totalAPagar + valorBeneficio;
    if (Math.abs(esperado - cuotaBase) > Math.max(2500, cuotaBase * 0.005)) {
      errores.push("Banco de Bogotá: TOTAL A PAGAR + VALOR BENEFICIO no coincide con la cuota base.");
    }
  }

  return {
    banco: "Banco de Bogotá",
    cliente,
    cedula: "",
    numeroCredito,
    producto: `Crédito hipotecario en Pesos ${tieneCobertura ? "con" : "sin"} beneficio de cobertura`,
    tipoCredito: "CREDITO_HIPOTECARIO",
    moneda: "PESOS",
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: formatMontoExtracto(valorDesembolsado),
    cuotaMensual: formatMontoExtracto(cuotaBase),
    seguros: formatMontoExtracto(seguros),
    cuotaSinSeguros: formatMontoExtracto(cuotaFinancieraNeta),
    cuotaConInteresSinSeguros: formatMontoExtracto(cuotaFinancieraNeta),
    plazoInicial,
    cuotasPagadas,
    cuotasPendientes,
    tea: tasaEA,
    teaCobrada: tasaEA,
    teaPactada,
    tasaMensual: "",
    interesCuota: formatMontoExtracto(interesCuota),
    capitalCuota: formatMontoExtracto(capitalCuota),
    valorUVR: "",
    saldoUVR: "",
    valorCobertura: tieneCobertura ? formatMontoExtracto(valorBeneficio) : "",
    tasaCobertura: tieneCobertura ? tasaCobertura : "",
    tieneCobertura: tieneCobertura ? "si" : "no",
    tipoBeneficio: tieneCobertura ? "FRECH" : "",
    cuotaPagadaCliente: formatMontoExtracto(totalAPagar),
    cuotaSinSubsidio: tieneCobertura ? formatMontoExtracto(cuotaBase) : "",
    valorAPagar: formatMontoExtracto(totalAPagar),
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: "",
    valorCuotaSinSubsidioGobierno: "",
    valorSubsidioGobierno: formatMontoExtracto(valorBeneficio),
    valorCuotaConSubsidio: formatMontoExtracto(totalAPagar),
    valorAseguradoInmueble: "",
    cuotaActualNumero: cuotasPagadas,
    fechaExtracto: "",
    cuotaBaseSimulacion: formatMontoExtracto(cuotaBase),
    requiereVerificacionBeneficio: errores.length ? "si" : "no",
    alertaCuotaBase: errores[0] ?? "",
    erroresValidacion: errores.join("\n"),
    advertenciasNormalizacion: "",
    mapeoBanco: "banco_bogota_hipotecario",
    confianza: confidence,
  };
}