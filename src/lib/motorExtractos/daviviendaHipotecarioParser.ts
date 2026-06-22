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
  valorUVR: "alta",
  saldoUVR: "alta",
  valorCobertura: "alta",
  tasaCobertura: "alta",
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

function formatDecimalValue(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function lastMoneyFromLine(line: string) {
  const values = Array.from(line.matchAll(/\$\s*([0-9][0-9.,]*)/g)).map((match) =>
    moneyToNumber(match[1]),
  );
  return values.at(-1) ?? 0;
}

function numberFromLine(line: string, rx: RegExp) {
  return moneyToNumber(line.match(rx)?.[1] ?? "");
}

function extractDaviviendaPaymentDetail(text: string) {
  const m = text.match(
    /Valor\s+Cuota\s+Total\s+-\s*Cobertura\s+de\s+Tasa\*?\s+Pago\s+M[ií]nimo\s+Cliente\s+\$\s*([0-9][0-9.,]*)\s+\$\s*([0-9][0-9.,]*)\s+\$\s*([0-9][0-9.,]*)/i,
  );
  return {
    cuotaTotal: moneyToNumber(m?.[1] ?? ""),
    cobertura: moneyToNumber(m?.[2] ?? ""),
    pagoMinimo: moneyToNumber(m?.[3] ?? ""),
  };
}

/**
 * Search lines that match `rx` AND contain a "$ amount". Filters out lines that
 * mention tasa/aseguradora/valor asegurado/costo/prima (those are not the monthly value).
 */
function moneyFromLine(text: string, rx: RegExp) {
  const lines = text
    .split(/\r?\n/)
    .map((item) => compactSpaces(item).trim())
    .filter(
      (item) =>
        rx.test(item) &&
        /\$\s*[0-9]/.test(item) &&
        !/tasa|aseguradora|valor\s+asegurado|costo|prima/i.test(item),
    );
  for (const line of lines) {
    // Capturar el $monto que aparece DESPUÉS del rótulo (no el primer $ de la línea),
    // porque algunos extractos Davivienda agrupan varios conceptos con sus montos en una sola línea.
    const m = rx.exec(line);
    if (!m) continue;
    const tail = line.slice(m.index + m[0].length);
    const value = tail.match(/\$\s*([0-9][0-9.,]*)/)?.[1];
    if (value) return moneyToNumber(value);
  }
  const fallback = lines[0]?.match(/\$\s*([0-9][0-9.,]*)/)?.[1] ?? "";
  return moneyToNumber(fallback);
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

function extractCoverageValue(rawText: string, compactText: string) {
  const detail = extractDaviviendaPaymentDetail(compactText);
  if (detail.cobertura > 0) return detail.cobertura;

  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim());
  const currentCoverageLine = lines.find((line) => /^-?\s*Cobertura\s+de\s+Tasa\*?/i.test(line));
  const currentCoverage = currentCoverageLine ? lastMoneyFromLine(currentCoverageLine) : 0;
  if (currentCoverage > 0) return currentCoverage;

  const interestCoverageLine = lines.find((line) => /^Inter[eé]s\s+Cte\.\s+Cobertura\b/i.test(line));
  return interestCoverageLine ? lastMoneyFromLine(interestCoverageLine) : 0;
}

/**
 * Extrae el saldo a capital del extracto Davivienda Crédito Hipotecario.
 *
 * Davivienda imprime el saldo a capital con DOS layouts distintos según moneda:
 *   1. UVR    → "Saldo a la Fecha de Corte: <fecha> <valorUVR> $ <pesos>"
 *               (dos columnas: UVR + pesos en la misma línea)
 *   2. PESOS  → "Saldo a la Fecha de Corte: <fecha> $ <pesos>"
 *               (una sola columna en pesos)
 *
 * Adicionalmente algunos formatos imprimen también "Saldo a: <fecha> $ <pesos>"
 * como respaldo (bloque resumen). Probamos los tres en orden.
 *
 * IMPORTANTE: en LEASING pesos "Saldo a la Fecha de Corte" corresponde a la
 * Opción de Compra, NO al capital — ese caso se maneja en el parser de leasing.
 */
function extractSaldoCorte(rawText: string, compactText: string) {
  // (1) UVR — UVR + pesos en la misma línea
  const mUVR = compactText.match(
    /Saldo\s+a\s+la\s+Fecha\s+de\s+Corte:\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/\d{4}\s+([0-9]{1,3}(?:,[0-9]{3})*\.\d{4})\s+\$\s*([0-9]{1,3}(?:,[0-9]{3})*\.\d{2})/i,
  );
  if (mUVR) return { saldoUVR: moneyToNumber(mUVR[1]), saldoCapital: moneyToNumber(mUVR[2]) };

  // (2) PESOS — "Saldo a la Fecha de Corte: <fecha> $ <pesos>" (sin columna UVR)
  const mPesosCorte = compactText.match(
    /Saldo\s+a\s+la\s+Fecha\s+de\s+Corte:\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/\d{4}\s+\$\s*([0-9][0-9.,]*)/i,
  );
  if (mPesosCorte) return { saldoUVR: 0, saldoCapital: moneyToNumber(mPesosCorte[1]) };

  // (3) PESOS — bloque alterno "Saldo a: <fecha> $ <pesos>"
  const mPesosAlt = compactText.match(
    /Saldo\s+a:\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/\d{4}\s+\$\s*([0-9][0-9.,]*)/i,
  );
  if (mPesosAlt) return { saldoUVR: 0, saldoCapital: moneyToNumber(mPesosAlt[1]) };

  // Fallback defensivo por si el PDF reordenó tokens: ubicar la línea y tomar
  // el último monto en pesos + (si existe) UVR con 4 decimales.
  const line = rawText
    .split(/\r?\n/)
    .map((item) => compactSpaces(item).trim())
    .find((item) => /^Saldo\s+a(?:\s+la\s+Fecha\s+de\s+Corte)?:/i.test(item));
  return {
    saldoUVR: line ? numberFromLine(line, /([0-9]{1,3}(?:,[0-9]{3})*\.\d{4})\s+\$/) : 0,
    saldoCapital: line ? lastMoneyFromLine(line) : 0,
  };
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

  // 0) Main Davivienda header: "NAME + Valor Prorrogado ...". This is the
  // most stable source when PDF.js reorders the payment stub labels.
  for (const line of lines) {
    if (/\+\s*Valor\s+Prorrogado\b/i.test(line)) {
      const candidate = cleanName(line.split(/\+\s*Valor\s+Prorrogado\b/i)[0] ?? "");
      if (candidate) return candidate;
    }
  }

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
      for (let j = i - 1; j >= Math.max(i - 3, 0); j--) {
        const candidate = cleanName(lines[j]);
        if (candidate) return candidate;
      }
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
}

/**
 * Extrae el valor mensual "+ Seguros $X" del bloque "Nuevo Saldo de su crédito"
 * (o "Nuevo Saldo de su Contrato de Leasing"). Este es el seguro MENSUAL real
 * de la próxima cuota — no confundir con el desglose vida/incendio que aparece
 * en la tabla "Valores Aplicados en el Periodo", que suele ser el ACUMULADO
 * aplicado durante el período y al sumarlo dobla el valor.
 */
export function extractDaviviendaHipotecarioSegurosMensuales(rawText: string): number {
  const compact = compactSpaces(rawText);
  // Busca el bloque "Nuevo Saldo de su crédito|Contrato" y, dentro, "+ Seguros $X".
  const blockMatch = compact.match(
    /Nuevo\s+Saldo\s+de\s+su\s+(?:cr[eé]dito|Contrato)[\s\S]{0,1200}?\+\s*Seguros\s*\$\s*([0-9][0-9.,]*)/i,
  );
  if (blockMatch) return moneyToNumber(blockMatch[1]);

  // En muchos PDF de Davivienda las etiquetas del bloque quedan en una columna
  // y los valores en otra. Ejemplo real:
  //   + Seguros
  //   ...
  //   Valor en Pesos
  //   $ 130,565,383.81
  //   ...
  //   $ 74,259.00   ← misma posición ordinal que "+ Seguros"
  // Si no hacemos esta lectura por columnas, se cae al detalle del periodo y
  // termina sumando seguros acumulados/dobles.
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim()).filter(Boolean);
  const start = lines.findIndex((line) => /^Nuevo\s+Saldo\s+de\s+su\s+(?:cr[eé]dito|Contrato)/i.test(line));
  if (start >= 0) {
    const window = lines.slice(start + 1, start + 60);
    const moneyLine = window.find((line) => /^\+\s*Seguros\b/i.test(line) && /\$\s*[0-9]/.test(line));
    if (moneyLine) return lastMoneyFromLine(moneyLine);

    const valueHeader = window.findIndex((line) => /^Valor\s+en\s+Pesos\b/i.test(line));
    if (valueHeader > 0) {
      const labelLines = window.slice(0, valueHeader).filter((line) =>
        /^(?:[-+]\s*)?(?:Saldo\s+Anterior|Total\s+Aplicado|Intereses\s+Corrientes|Intereses\s+de\s+Mora|Seguros|Valores\s+Prorrogados|Otros\s+Cargos|Saldo\s+a:|Valores\s+del\s+cr[eé]dito)/i.test(line),
      );
      const segurosIndex = labelLines.findIndex((line) => /^\+\s*Seguros\b/i.test(line));
      if (segurosIndex >= 0) {
        const values = window
          .slice(valueHeader + 1)
          .map((line) => line.match(/\$\s*([0-9][0-9.,]*)/)?.[1] ?? "")
          .filter(Boolean)
          .map((value) => moneyToNumber(value));
        const value = values[segurosIndex] ?? 0;
        if (value > 0) return value;
      }
    }
  }

  // Fallback: línea aislada "+ Seguros $X" (algunos layouts pierden el header al re-flow).
  const lineMatch = compact.match(/(?:^|\s)\+\s*Seguros\s*\$\s*([0-9][0-9.,]*)/i);
  return lineMatch ? moneyToNumber(lineMatch[1]) : 0;
}


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

  const sistemaAmortizacion = firstMatch(text, /Sistema\s+de\s+Amortizaci[oó]n\s+(.+?)\s+(?:Tasa|Plazo)/i);
  const isUVR = /\bUVR\b/i.test(`${sistemaAmortizacion} ${text}`);
  const paymentDetail = extractDaviviendaPaymentDetail(text);

  // Cuota mes
  const pagoMinimoCliente =
    moneyToNumber(firstMatch(text, /\+\s*Valor\s+Cuota\s+Mes\s+\$\s*([0-9][0-9.,]*)/i)) ||
    moneyToNumber(firstMatch(text, /Total\s+Valor\s+a\s+pagar\s+\$\s*([0-9][0-9.,]*)/i)) ||
    paymentDetail.pagoMinimo;

  // Plazo / cuotas
  const plazoInicial = firstMatch(text, /\bPlazo\s+([0-9]{2,3})\b/i);
  const cuotasPagadas = firstMatch(text, /No\.\s+(?:de\s+)?Cuotas?\s+que\s+se\s+Cancela\s+([0-9]+)/i);
  const cuotasPendientes = firstMatch(text, /No\.\s+Cuotas?\s+Pdtes\.\s+Pago\s+Total\s+([0-9]+)/i);

  // Tasas
  const teaCobrada =
    firstMatch(text, /Tasa\s+Inter[eé]s\s+Cte\.?\s*Cobrada\s+([0-9]+(?:[.,][0-9]+)?)\s+Efectivo/i).replace(",", ".");
  const teaPactada =
    firstMatch(text, /Tasa\s+Inter[eé]s\s+Cte\.?\s*Pactada\s+([0-9]+(?:[.,][0-9]+)?)\s+Efectivo/i).replace(",", ".");

  // Seguros — prioridad al agregado mensual "+ Seguros $X" del bloque
  // "Nuevo Saldo de su crédito" (valor mensual real). El detalle vida/incendio
  // aparece TAMBIÉN en la tabla "Valores Aplicados en el Periodo" que suele
  // ser el ACUMULADO del periodo (no la cuota mensual) — usarlo doblaría seguros.
  const segurosMensualAgregado = extractDaviviendaHipotecarioSegurosMensuales(rawText);
  const valorSeguroVidaRaw = moneyFromLine(rawText, /Seguro\s+de\s+Vida\b/i);
  const valorSeguroIncendioRaw = moneyFromLine(rawText, /Seguro\s+de\s+Incendio\s+y\s+Anexos/i);
  const valorSeguroProteccionRaw = moneyFromLine(rawText, /Seguro\s+Protecci[oó]n\s+de\s+Pagos/i);
  const segurosDetalle = valorSeguroVidaRaw + valorSeguroIncendioRaw + valorSeguroProteccionRaw;
  // Si el agregado mensual existe y el "detalle" lo duplica (>1.4x), usar agregado.
  const usarAgregado =
    segurosMensualAgregado > 0 &&
    (segurosDetalle === 0 || segurosDetalle > segurosMensualAgregado * 1.4);
  const seguros = usarAgregado ? segurosMensualAgregado : segurosDetalle || segurosMensualAgregado;
  const valorSeguroVida = usarAgregado ? 0 : valorSeguroVidaRaw;
  const valorSeguroIncendio = usarAgregado ? 0 : valorSeguroIncendioRaw;
  const valorSeguroProteccion = usarAgregado ? 0 : valorSeguroProteccionRaw;

  // Intereses corrientes / abonos a capital del periodo
  const interesCuota = moneyFromLine(rawText, /Intereses\s+Corrientes\b/i);
  const capitalCuota = moneyFromLine(rawText, /Abonos?\s+a\s+Capital\b/i);

  const saldoCorte = extractSaldoCorte(rawText, text);
  // Saldo a la fecha de corte. Formatos Davivienda: pesos directo o UVR + pesos.
  const saldoCapital = saldoCorte.saldoCapital || moneyToNumber(
    firstMatch(text, /Saldo\s+a:\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,4}\.?\s*[0-9]{1,2}\/[0-9]{4}\s*\$\s*([0-9][0-9.,]*)/i),
  );

  const valorAsegInmueble = moneyToNumber(
    firstMatch(text, /Valor\s+Asegurado\s+del\s+Inmueble:?\s*\$\s*([0-9][0-9.,]*)/i),
  );

  const valorUVR = isUVR
    ? moneyToNumber(firstMatch(text, /Valor\s+de\s+la\s+UVR\s+a\s+la\s+Fecha\s+de\s+Corte:\s*([0-9]+(?:[.,][0-9]{4})?)/i))
    : 0;

  const valorCobertura = extractCoverageValue(rawText, text);
  const tasaCobertura = firstMatch(text, /Tasa\s+de\s+Cobertura\s+([0-9]+(?:[.,][0-9]+)?)\s+Efectivo/i).replace(",", ".");
  const beneficioActivo = valorCobertura > 0 || moneyToNumber(tasaCobertura) > 0 || hasExplicitBenefit(rawText);
  const cuotaTotal = beneficioActivo && paymentDetail.cuotaTotal > 0
    ? paymentDetail.cuotaTotal
    : pagoMinimoCliente;

  const cuotaSinSeguros = cuotaTotal > 0 && seguros > 0 ? cuotaTotal - seguros : cuotaTotal;

  const producto = `Crédito Hipotecario en ${isUVR ? "UVR" : "pesos"} ${beneficioActivo ? "con" : "sin"} Beneficio de Cobertura`;

  return {
    banco: "Davivienda",
    cliente,
    cedula,
    numeroCredito,
    producto,
    tipoCredito: "CREDITO_HIPOTECARIO",
    moneda: isUVR ? "UVR" : "PESOS",
    sistemaAmortizacion,
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: "", // Davivienda no lo imprime en el extracto mensual
    cuotaMensual: formatMontoExtracto(cuotaTotal),
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
    saldoUVR: formatDecimalValue(saldoCorte.saldoUVR),
    valorCobertura: beneficioActivo ? formatMontoExtracto(valorCobertura) : "",
    tasaCobertura: beneficioActivo ? tasaCobertura : "",
    tieneCobertura: beneficioActivo ? "si" : "no",
    tipoBeneficio: beneficioActivo ? "Cobertura de Tasa" : "",
    cuotaPagadaCliente: formatMontoExtracto(pagoMinimoCliente || cuotaTotal),
    cuotaSinSubsidio: beneficioActivo ? formatMontoExtracto(cuotaTotal) : "",
    valorAPagar: formatMontoExtracto(pagoMinimoCliente || cuotaTotal),
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: formatMontoExtracto(valorSeguroProteccion),
    valorCuotaSinSubsidioGobierno: "",
    valorSubsidioGobierno: beneficioActivo ? formatMontoExtracto(valorCobertura) : "",
    valorCuotaConSubsidio: beneficioActivo ? formatMontoExtracto(pagoMinimoCliente) : "",
    valorAseguradoInmueble: formatMontoExtracto(valorAsegInmueble),
    cuotaActualNumero: cuotasPagadas,
    fechaExtracto: firstMatch(text, /Periodo\s+Liquidado\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/[0-9]{4}\s*-\s*[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}\.\s*[0-9]{1,2}\/[0-9]{4})/i),
    cuotaBaseSimulacion: formatMontoExtracto(cuotaTotal),
    requiereVerificacionBeneficio: "no",
    alertaCuotaBase: "",
    erroresValidacion: "",
    advertenciasNormalizacion: "",
    mapeoBanco: "davivienda_hipotecario",
    confianza: confidence,
  };
}
