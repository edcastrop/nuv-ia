import { formatMontoExtracto, parseMontoExtracto } from "@/lib/cuotaBase";

export type ExtractoRecord = Record<string, string | Record<string, string>>;

const confidence = {
  banco: "alta",
  cliente: "alta",
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
  valorUVR: "alta",
  saldoUVR: "alta",
  valorCobertura: "alta",
  tasaCobertura: "alta",
  valorDesembolsado: "baja",
};

function compactSpaces(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function moneyToNumber(value?: string | null) {
  return parseMontoExtracto(value ?? "");
}

function firstMatch(text: string, rx: RegExp) {
  return text.match(rx)?.[1]?.trim() ?? "";
}

function findLine(text: string, rx: RegExp) {
  return text
    .split(/\r?\n/)
    .map((line) => compactSpaces(line).trim())
    .find((line) => rx.test(line)) ?? "";
}

function moneyFromLine(text: string, rx: RegExp) {
  const line = text
    .split(/\r?\n/)
    .map((item) => compactSpaces(item).trim())
    .find(
      (item) =>
        rx.test(item) &&
        /\$\s*[0-9]/.test(item) &&
        !/costo|prima|aseguradora|valor\s+asegurado|tasa/i.test(item),
    ) ?? "";
  const value = line.match(/\$\s*([0-9][0-9.,]*)/)?.[1] ?? "";
  return moneyToNumber(value);
}

function formatDecimalValue(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function rateAfter(text: string, label: string) {
  const rx = new RegExp(`${label}\\s+([0-9]+(?:[,.][0-9]+)?)\\s+Efectivo`, "i");
  return firstMatch(text, rx).replace(",", ".");
}

function detectSubmodalidad(sistema: string) {
  if (/\bbaja\b/i.test(sistema)) return "Baja";
  if (/\bmedia\b/i.test(sistema)) return "Media";
  if (/\balta\b/i.test(sistema)) return "Alta";
  return "";
}

function hasExplicitBenefit(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim());
  const benefitLabels = [
    /inter[eé]s\s+cte\.?\s+cobertura/i,
    /valor\s+beneficio/i,
    /valor\s+subsidio/i,
    /cobertura\s+frech/i,
  ];
  return lines.some((line) => {
    if (!benefitLabels.some((rx) => rx.test(line))) return false;
    const amounts = Array.from(line.matchAll(/\$?\s*([0-9][0-9.,]*)/g))
      .map((match) => moneyToNumber(match[1]))
      .filter((value) => value > 0);
    return amounts.some((value) => value > 0);
  });
}

export function parseDaviviendaLeasingText(rawText: string): ExtractoRecord | null {
  const text = compactSpaces(rawText);
  if (!/davivienda/i.test(text) || !/extracto\s+contrato\s+leasing|contrato\s+del\s+leasing/i.test(text)) {
    return null;
  }

  const sistema = firstMatch(text, /Sistema\s+de\s+Amortizaci[oó]n\s+(.+?)\s+Tasa\s+Inter[eé]s\s+Mora/i) ||
    firstMatch(text, /Sistema\s+de\s+Amortizaci[oó]n\s+(.+?)\s+Plazo/i);
  const isUVR = /\buvr\b/i.test(`${sistema} ${text}`);
  const submodalidad = detectSubmodalidad(sistema);
  const beneficioActivo = hasExplicitBenefit(rawText);

  const clienteLine = findLine(rawText, /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ ]{7,}/);
  // Stop the name at any token that is not an uppercase word (digits, $, +, lowercase, punctuation)
  const clienteMatch = clienteLine.match(/^((?:[A-ZÁÉÍÓÚÑ]{2,}\s+){1,6}[A-ZÁÉÍÓÚÑ]{2,})/);
  const cliente = (clienteMatch?.[1] ?? clienteLine.split(/\s{2,}|\s+\+|\s+\$|\s+[a-z0-9]/)[0] ?? "").trim();
  const numeroCredito = firstMatch(text, /Extracto\s+Contrato\s+Leasing\s+([0-9-]+)/i) ||
    firstMatch(text, /No\.\s*Contrato\s+del\s+Leasing:\s*([0-9-]+)/i);
  const cedulaRaw = firstMatch(text, /Documento\s+No:\s*([0-9]+)/i);
  const cedula = /^0+$/.test(cedulaRaw) ? "" : cedulaRaw;

  const cuotaMensual = moneyToNumber(firstMatch(text, /\+\s*Valor\s+Cuota\s+Mes\s+\$\s*([0-9][0-9.,]*)/i));
  const plazoInicial = firstMatch(text, /\bPlazo\s+([0-9]{2,3})\s+Tasa/i);
  const cuotasPagadas = firstMatch(text, /No\.\s+de\s+Canon\s+que\s+se\s+Cancela\s+([0-9]+)/i);
  const cuotasPendientes = firstMatch(text, /No\.\s+C[aá]nones\s+Pdtes\.\s+Pago\s+Total\s+([0-9]+)/i);

  const valorSeguroVida = moneyFromLine(rawText, /Seguro\s+de\s+Vida/i);
  const valorSeguroIncendio = moneyFromLine(rawText, /Seguro\s+de\s+Incendio\s+y\s+Anexos/i);
  const valorSeguroProteccion = moneyFromLine(rawText, /Seguro\s+Protecci[oó]n\s+de\s+Pagos/i);
  const segurosDetalle = valorSeguroVida + valorSeguroIncendio + valorSeguroProteccion;
  const segurosResumen = moneyToNumber(
    firstMatch(text, /\+\s*Seguros:\s+[0-9][0-9.,]*\s+\$\s*([0-9][0-9.,]*)/i),
  );
  const seguros = segurosDetalle > 0 ? segurosDetalle : segurosResumen;

  const saldoMatch = text.match(/Saldo\s+a\s+la\s+Fecha\s+de\s+Corte:\s*[^\n]*?([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{4})\s+\$\s*([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/i);
  const saldoUVR = isUVR ? moneyToNumber(saldoMatch?.[1] ?? "") : 0;
  const saldoCapital = moneyToNumber(saldoMatch?.[2] ?? "");
  const valorUVR = isUVR
    ? moneyToNumber(firstMatch(text, /Valor\s+de\s+la\s+UVR\s+a\s+la\s+Fecha\s+de\s+Corte:\s*([0-9]+\.[0-9]{4})/i))
    : 0;

  const interesCuota = moneyFromLine(rawText, /Intereses\s+Corrientes/i);
  const capitalCuota = moneyFromLine(rawText, /Abonos\s+a\s+Capital/i);
  const cuotaSinSeguros = cuotaMensual > 0 && seguros > 0 ? cuotaMensual - seguros : 0;
  const teaCobrada = rateAfter(text, "Tasa\\s+Inter[eé]s\\s+Cte\\.\\s+Cobrada");
  const teaPactada = rateAfter(text, "Tasa\\s+Inter[eé]s\\s+Cte\\.\\s+Pactada");
  const fechaExtracto = firstMatch(text, /Saldo\s+a\s+la\s+Fecha\s+de\s+Corte:\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{2}\/[0-9]{4})/i);
  const producto = `Contrato leasing en ${isUVR ? `UVR${submodalidad ? ` ${submodalidad}` : ""}` : "Pesos"} ${beneficioActivo ? "con" : "sin"} beneficio de cobertura`;

  const errores: string[] = [];
  if (segurosDetalle > 0 && segurosResumen > 0 && Math.abs(segurosDetalle - segurosResumen) > 2) {
    errores.push("La suma de seguros no coincide con el resumen '+ Seguros' del extracto Davivienda.");
  }
  if (isUVR && (!saldoUVR || !valorUVR)) {
    errores.push("Falta saldo UVR o valor UVR en el extracto Davivienda UVR.");
  }

  return {
    banco: "Davivienda",
    cliente,
    cedula,
    numeroCredito,
    producto,
    tipoCredito: "LEASING_HABITACIONAL",
    moneda: isUVR ? "UVR" : "PESOS",
    sistemaAmortizacion: sistema,
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: "",
    cuotaMensual: formatMontoExtracto(cuotaMensual),
    seguros: formatMontoExtracto(seguros),
    cuotaSinSeguros: formatMontoExtracto(cuotaSinSeguros),
    cuotaConInteresSinSeguros: formatMontoExtracto(cuotaSinSeguros),
    plazoInicial,
    cuotasPagadas,
    cuotasPendientes,
    tea: teaCobrada,
    teaCobrada,
    teaPactada,
    tasaMensual: "",
    interesCuota: formatMontoExtracto(interesCuota),
    capitalCuota: formatMontoExtracto(capitalCuota),
    valorUVR: formatDecimalValue(valorUVR),
    saldoUVR: formatDecimalValue(saldoUVR),
    valorCobertura: "",
    tasaCobertura: "",
    tieneCobertura: beneficioActivo ? "si" : "no",
    tipoBeneficio: beneficioActivo ? "Cobertura FRECH" : "",
    cuotaPagadaCliente: formatMontoExtracto(cuotaMensual),
    cuotaSinSubsidio: "",
    valorAPagar: "",
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: formatMontoExtracto(valorSeguroProteccion),
    valorCuotaSinSubsidioGobierno: "",
    valorSubsidioGobierno: "",
    valorCuotaConSubsidio: "",
    valorAseguradoInmueble: "",
    cuotaActualNumero: cuotasPagadas,
    fechaExtracto,
    cuotaBaseSimulacion: formatMontoExtracto(cuotaMensual),
    requiereVerificacionBeneficio: "no",
    alertaCuotaBase: "",
    erroresValidacion: errores.join("\n"),
    advertenciasNormalizacion: "",
    mapeoBanco: "davivienda_leasing",
    confianza: confidence,
  };
}