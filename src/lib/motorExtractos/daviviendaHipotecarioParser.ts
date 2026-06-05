import { formatMontoExtracto, parseMontoExtracto } from "@/lib/cuotaBase";

export type ExtractoRecord = Record<string, string | Record<string, string>>;

const confidence = {
  banco: "alta",
  cliente: "alta",
  cedula: "alta",
  numeroCredito: "alta",
  producto: "alta",
  tipoCredito: "alta",
  moneda: "alta",
  saldoCapital: "alta",
  cuotaMensual: "alta",
  seguros: "alta",
  plazoInicial: "alta",
  cuotasPagadas: "alta",
  cuotasPendientes: "alta",
  tea: "alta",
  teaCobrada: "alta",
  teaPactada: "alta",
  tieneCobertura: "alta",
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

/**
 * Search lines that match `rx` AND contain a "$ amount". Filters out lines that
 * mention tasa/aseguradora/valor asegurado/costo/prima (those are not the monthly value).
 */
function moneyFromLine(text: string, rx: RegExp) {
  const line = text
    .split(/\r?\n/)
    .map((item) => compactSpaces(item).trim())
    .find(
      (item) =>
        rx.test(item) &&
        /\$\s*[0-9]/.test(item) &&
        !/tasa|aseguradora|valor\s+asegurado|costo|prima/i.test(item),
    ) ?? "";
  const value = line.match(/\$\s*([0-9][0-9.,]*)/)?.[1] ?? "";
  return moneyToNumber(value);
}

/**
 * Detects explicit subsidy/coverage values > 0. Ignores legal/informative
 * boilerplate that only mentions the word "cobertura".
 */
function hasExplicitBenefit(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim());
  const benefitLabels = [
    /inter[eé]s\s+cte\.?\s+cobertura/i,
    /valor\s+beneficio/i,
    /valor\s+subsidio/i,
    /subsidio\s+gobierno/i,
    /cobertura\s+frech/i,
    /tasa\s+fresh/i,
  ];
  return lines.some((line) => {
    if (!benefitLabels.some((rx) => rx.test(line))) return false;
    const amounts = Array.from(line.matchAll(/\$\s*([0-9][0-9.,]*)/g))
      .map((match) => moneyToNumber(match[1]))
      .filter((value) => value > 0);
    return amounts.length > 0;
  });
}

const STOP_WORDS = /^(DOCUMENTO|CEDULA|CÉDULA|NIT|FECHA|PERIODO|EXTRACTO|CREDITO|CRÉDITO|VALOR|TOTAL|SALDO|PLAZO|TASA|CUOTA|NO\.?|DIRECCION|DIRECCIÓN|CIUDAD|TELEFONO|TELÉFONO|CARRERA|CALLE|AV|AVENIDA|PRORROGADO|SUBSIDIO|SEGURO|BANCO)$/i;

function cleanName(raw: string): string {
  const tokens = raw
    .replace(/[+\-$]/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  const out: string[] = [];
  for (const t of tokens) {
    if (!t) continue;
    if (STOP_WORDS.test(t)) break;
    if (!/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ'.-]{1,}$/.test(t)) break;
    out.push(t);
    if (out.length >= 6) break;
  }
  return out.length >= 2 ? out.join(" ") : "";
}

function extractClienteName(rawText: string): string {
  const lines = rawText.split(/\r?\n/).map((l) => compactSpaces(l).trim());

  // 1) Inline: "Cliente: NAME ..." on the same line
  for (const line of lines) {
    const m = line.match(/Cliente:\s*(.+)/i);
    if (m) {
      const candidate = cleanName(m[1]);
      if (candidate) return candidate;
    }
  }

  // 2) Label on its own line, name on a nearby following line
  for (let i = 0; i < lines.length; i++) {
    if (/^Cliente:?\s*$/i.test(lines[i])) {
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const candidate = cleanName(lines[j]);
        if (candidate) return candidate;
      }
    }
  }

  // 3) Fallback: "Sr(a)." / "Señor(a)" labels
  for (const line of lines) {
    const m = line.match(/(?:Se[nñ]or(?:\(a\))?|Sr\.?\(a\)?\.?)\s*:?\s*(.+)/i);
    if (m) {
      const candidate = cleanName(m[1]);
      if (candidate) return candidate;
    }
  }

  return "";

/**
 * Deterministic parser for Davivienda HIPOTECARIO statements
 * ("Extracto Crédito Hipotecario"). Returns null when the text does not match.
 */
export function parseDaviviendaHipotecarioText(rawText: string): ExtractoRecord | null {
  const text = compactSpaces(rawText);
  if (!/davivienda/i.test(text)) return null;
  // Must be the hipotecario header. Reject leasing extracts.
  if (!/extracto\s+cr[eé]dito\s+hipotecario/i.test(text)) return null;
  if (/extracto\s+contrato\s+leasing/i.test(text)) return null;

  const numeroCredito =
    firstMatch(text, /Extracto\s+Cr[eé]dito\s+Hipotecario\s+([0-9-]+)/i) ||
    firstMatch(text, /No\s+del\s+cr[eé]dito:\s*([0-9-]+)/i);

  const cliente = extractClienteName(rawText);
  const cedulaRaw = firstMatch(text, /Documento\s+No:\s*([0-9]+)/i);
  const cedula = /^0+$/.test(cedulaRaw) ? "" : cedulaRaw;

  // Cuota mes
  const cuotaMensual =
    moneyToNumber(firstMatch(text, /\+\s*Valor\s+Cuota\s+Mes\s+\$\s*([0-9][0-9.,]*)/i)) ||
    moneyToNumber(firstMatch(text, /Total\s+Valor\s+a\s+pagar\s+\$\s*([0-9][0-9.,]*)/i));

  // Plazo / cuotas
  const plazoInicial = firstMatch(text, /\bPlazo\s+([0-9]{2,3})\b/i);
  const cuotasPagadas = firstMatch(text, /No\.\s+Cuotas?\s+que\s+se\s+cancela\s+([0-9]+)/i);
  const cuotasPendientes = firstMatch(text, /No\.\s+Cuotas?\s+Pdtes\.\s+Pago\s+Total\s+([0-9]+)/i);

  // Tasas
  const teaCobrada =
    firstMatch(text, /Tasa\s+Inter[eé]s\s+Cte\.?\s*Cobrada\s+([0-9]+(?:[.,][0-9]+)?)\s+Efectivo/i).replace(",", ".");
  const teaPactada =
    firstMatch(text, /Tasa\s+Inter[eé]s\s+Cte\.?\s*Pactada\s+([0-9]+(?:[.,][0-9]+)?)\s+Efectivo/i).replace(",", ".");

  // Seguros
  const valorSeguroVida = moneyFromLine(rawText, /^Seguro\s+de\s+Vida\b/i);
  const valorSeguroIncendio = moneyFromLine(rawText, /^Seguro\s+de\s+Incendio\s+y\s+Anexos/i);
  const valorSeguroProteccion = moneyFromLine(rawText, /^Seguro\s+Protecci[oó]n\s+de\s+Pagos/i);
  const seguros = valorSeguroVida + valorSeguroIncendio + valorSeguroProteccion;

  // Intereses corrientes / abonos a capital del periodo
  const interesCuota = moneyFromLine(rawText, /^Intereses\s+Corrientes\b/i);
  const capitalCuota = moneyFromLine(rawText, /^Abonos?\s+a\s+Capital\b/i);

  // Saldo a la fecha de corte
  // Formato: "Saldo a: Mes. dd/aaaa  $ 221,903,943.99"
  const saldoCapital = moneyToNumber(
    firstMatch(text, /Saldo\s+a:\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,4}\.?\s*[0-9]{1,2}\/[0-9]{4}\s*\$\s*([0-9][0-9.,]*)/i),
  );

  const valorAsegInmueble = moneyToNumber(
    firstMatch(text, /Valor\s+Asegurado\s+del\s+Inmueble:?\s*\$\s*([0-9][0-9.,]*)/i),
  );

  const beneficioActivo = hasExplicitBenefit(rawText);

  const cuotaSinSeguros = cuotaMensual > 0 && seguros > 0 ? cuotaMensual - seguros : cuotaMensual;

  const producto = `Crédito Hipotecario en pesos ${beneficioActivo ? "con" : "sin"} Beneficio de Cobertura`;

  return {
    banco: "Davivienda",
    cliente,
    cedula,
    numeroCredito,
    producto,
    tipoCredito: "CREDITO_HIPOTECARIO",
    moneda: "PESOS",
    sistemaAmortizacion: firstMatch(text, /Sistema\s+de\s+Amortizaci[oó]n\s+(.+?)\s+(?:Tasa|Plazo)/i),
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: "", // Davivienda no lo imprime en el extracto mensual
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
    valorUVR: "",
    saldoUVR: "",
    valorCobertura: "",
    tasaCobertura: "",
    tieneCobertura: beneficioActivo ? "si" : "no",
    tipoBeneficio: beneficioActivo ? "Cobertura FRECH" : "",
    cuotaPagadaCliente: formatMontoExtracto(cuotaMensual),
    cuotaSinSubsidio: "",
    valorAPagar: formatMontoExtracto(cuotaMensual),
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: formatMontoExtracto(valorSeguroProteccion),
    valorCuotaSinSubsidioGobierno: "",
    valorSubsidioGobierno: "",
    valorCuotaConSubsidio: "",
    valorAseguradoInmueble: formatMontoExtracto(valorAsegInmueble),
    cuotaActualNumero: cuotasPagadas,
    fechaExtracto: firstMatch(text, /Periodo\s+Liquidado\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/[0-9]{4}\s*-\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/[0-9]{4})/i),
    cuotaBaseSimulacion: formatMontoExtracto(cuotaMensual),
    requiereVerificacionBeneficio: "no",
    alertaCuotaBase: "",
    erroresValidacion: "",
    advertenciasNormalizacion: "",
    mapeoBanco: "davivienda_hipotecario",
    confianza: confidence,
  };
}
