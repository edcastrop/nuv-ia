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

function removeDiacritics(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(text: string) {
  return removeDiacritics(compactSpaces(text)).toUpperCase();
}

function moneyToNumber(value?: string | null) {
  const raw = String(value ?? "");
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  const normalizeRepeatedSeparator = (separator: "." | ",") => {
    const parts = cleaned.split(separator);
    const last = parts.at(-1) ?? "";
    if (parts.length > 2 && last.length > 0 && last.length <= 2) {
      return `${parts.slice(0, -1).join("")}${separator}${last}`;
    }
    return cleaned;
  };
  const normalized = cleaned.includes(",") && !cleaned.includes(".")
    ? normalizeRepeatedSeparator(",")
    : cleaned.includes(".") && !cleaned.includes(",")
      ? normalizeRepeatedSeparator(".")
      : cleaned;
  return parseMontoExtracto(normalized);
}

const MONEY_TOKEN = String.raw`(?:\$\s*)?([0-9]{1,3}(?:(?:[.,\s][0-9]{3})+)(?:[.,][0-9]{1,2})?|[0-9]{4,}(?:[.,][0-9]{1,2})?|[0-9]+[.,][0-9]{1,2})`;

function extractMoneyValues(text: string) {
  const rx = new RegExp(MONEY_TOKEN, "g");
  return Array.from(text.matchAll(rx))
    .map((match) => moneyToNumber(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function lastMoneyIn(text: string) {
  const values = extractMoneyValues(text);
  return values.at(-1) ?? 0;
}

function firstMoneyIn(text: string) {
  const values = extractMoneyValues(text);
  return values[0] ?? 0;
}

function classifyInsuranceLabel(text: string): "vida" | "incendio" | "voluntario" | null {
  const up = normalizeForMatch(text);
  if (!/\b(SEGURO|SEGUROS|POLIZA|POLIZA)\b/.test(up) && !/\bOTROS\s+SEGUROS\b/.test(up)) return null;
  if (/VALOR\s+ASEGURADO|ASEGURADORA|INFORMACION\s+GENERAL|DATOS\s+GENERALES|TASA|BENEFICIO|TOTAL\s+A\s+PAGAR/.test(up)) return null;
  if (/VIDA/.test(up)) return "vida";
  if (/INCENDIO|TERREMOTO|ANEXO/.test(up)) return "incendio";
  return "voluntario";
}

function extractInsuranceRows(rawText: string) {
  const result = { vida: 0, incendio: 0, voluntario: 0 };
  const add = (kind: keyof typeof result, value: number) => {
    if (value > 0) result[kind] += value;
  };

  const joined = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim()).filter(Boolean).join("\n");
  const conceptSegments = joined.split(/(?=\s*(?:\$\s*)?[+\-=]?\s*(?:CAPITAL|INTERESES|SEGUROS?|OTROS\s+SEGUROS|P[ÓO]LIZA|VALOR\s+TOTAL|TOTAL\s+A\s+PAGAR|VALOR\s+BENEFICIO)\b)/i);
  const usedSegmentKeys = new Set<string>();

  for (const segment of conceptSegments) {
    const kind = classifyInsuranceLabel(segment);
    if (!kind) continue;
    // Banco de Bogotá imprime dos columnas: "DETALLE VALOR A PAGAR" y
    // "DETALLE PAGO ANTERIOR". La cuota actual es SIEMPRE el primer monto
    // del renglón; tomar el último arrastra el pago anterior (ej. 21.708,72
    // en vez de 16.748,52) y descuadra todos los seguros.
    const value = firstMoneyIn(segment);
    if (!(value > 0)) continue;
    const key = `${kind}:${Math.round(value * 100)}:${normalizeForMatch(segment).slice(0, 70)}`;
    if (usedSegmentKeys.has(key)) continue;
    usedSegmentKeys.add(key);
    add(kind, value);
  }

  // Fallback para OCR tabular: etiqueta en una línea y valor en la siguiente.
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i += 1) {
    const kind = classifyInsuranceLabel(lines[i]);
    if (!kind) continue;
    const sameLine = firstMoneyIn(lines[i]);
    const nextLine = sameLine > 0 ? 0 : firstMoneyIn(`${lines[i + 1] ?? ""} ${lines[i + 2] ?? ""}`);
    const value = sameLine || nextLine;
    if (!(value > 0)) continue;
    if (result[kind] <= 0) add(kind, value);
  }

  return result;
}

function firstMoneyAfter(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`${escaped}\\*?\\s+\\$?\\s*([0-9][0-9.,]*)`, "i");
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

function cleanCreditNumber(value: string) {
  return value.replace(/\D/g, "");
}

function extractCreditNumber(rawText: string, text: string) {
  const patterns = [
    /N[ÚU]MERO\s+DE\s+CR[ÉE]DITO\s+([0-9][0-9\s]{5,})/i,
    /NUMERO\s+DE\s+CREDITO\s+([0-9][0-9\s]{5,})/i,
    /\b([0-9]{6,}CH[0-9A-Z]*)\b/i,
  ];
  for (const rx of patterns) {
    const found = (text.match(rx) ?? rawText.match(rx))?.[1] ?? "";
    const cleaned = cleanCreditNumber(found);
    if (cleaned.length >= 6) return cleaned;
  }
  return "";
}

function cleanNameCandidate(line: string) {
  const normalized = compactSpaces(line)
    .replace(/[\[\]().,;:|]/g, " ")
    .replace(/\b(?:NUMERO|N[ÚU]MERO|CREDITO|CR[ÉE]DITO|FECHA|VALOR|TOTAL|PAGAR)\b.*$/i, "")
    .trim();
  const match = normalized.match(/^([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,7})\b/);
  return match?.[1]?.trim() ?? "";
}

function extractCliente(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim()).filter(Boolean);
  const excluded = /BANCO|BOGOT|EXTRACTO|CREDITO|VIVIENDA|PAGINA|AHORA|WWW|DATOS|GENERALES|MONTO|PLAZO|CUOTA|TASA|CONCEPTO|DETALLE|SALDO|ASEGURADO|IMPRESO|COLOMBIA|ENTREGA|OFICINA|FECHA|VALOR|NUMERO|NRO\./i;

  for (const line of lines) {
    if (/N[ÚU]MERO\s+DE\s+CR[ÉE]DITO|NUMERO\s+DE\s+CREDITO/i.test(line)) {
      const candidate = cleanNameCandidate(line);
      if (candidate && !excluded.test(candidate)) return candidate;
    }
  }

  const startIdx = Math.max(0, lines.findIndex((line) => /www\.bancodebogota\.com\/transacciones/i.test(line)) + 1);
  const endIdx = lines.findIndex((line) => /DATOS\s+GENERALES\s+DEL\s+CREDITO/i.test(removeDiacritics(line)));
  const searchLines = lines.slice(startIdx, endIdx > startIdx ? endIdx : Math.min(lines.length, startIdx + 12));
  for (const line of searchLines) {
    const candidate = cleanNameCandidate(line);
    if (candidate && !excluded.test(candidate)) return candidate;
  }

  return firstTextAfter(rawText, /(?:Señor\(a\)|Señor|Apreciado\s+Cliente)\s*\n?\s*([A-ZÁÉÍÓÚÑ ]{6,})/i);
}

function extractDatosGenerales(rawText: string) {
  const normalized = normalizeForMatch(rawText);
  const start = normalized.indexOf("DATOS GENERALES DEL CREDITO");
  const endCandidates = [normalized.indexOf("TASA PACTADA", start >= 0 ? start : 0)]
    .filter((idx) => idx > (start >= 0 ? start : 0));
  const end = endCandidates.length ? Math.min(...endCandidates) : (start >= 0 ? start + 1200 : 1200);
  const block = start >= 0 ? normalized.slice(start, end) : normalized;
  const valueRow = block.match(
    /([0-9]{1,3}(?:[,.][0-9]{3})*(?:[,.][0-9]{2})?)\s*\|?\s+([0-9]{2,3})\s+([0-9]{1,4})\s+([0-9]{1,4})\s+_*\s*((?:PESOS|UVR)[A-Z0-9 .\-]*)/,
  );
  if (!valueRow) {
    return {
      valorDesembolsado: 0,
      plazoInicial: "",
      cuotasPagadas: "",
      cuotasPendientes: "",
      sistemaAmortizacion: "",
      moneda: "PESOS",
    };
  }
  const sistemaAmortizacion = compactSpaces(valueRow[5] ?? "")
    .replace(/\bASEGURADORA\b.*$/i, "")
    .trim();
  return {
    valorDesembolsado: moneyToNumber(valueRow[1]),
    plazoInicial: valueRow[2] ?? "",
    cuotasPagadas: valueRow[3] ?? "",
    cuotasPendientes: valueRow[4] ?? "",
    sistemaAmortizacion,
    moneda: /\bUVR\b/i.test(sistemaAmortizacion) ? "UVR" : "PESOS",
  };
}

function formatRate(value: string) {
  const normalized = value.replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) && n > 0 ? normalized : "";
}

function extractRates(rawText: string) {
  const normalized = normalizeForMatch(rawText);
  const start = normalized.indexOf("TASA PACTADA");
  if (start < 0) return { teaPactada: "", tasaEA: "", tasaCobertura: "" };
  const endCandidates = [normalized.indexOf("\n1.", start), normalized.indexOf("\nCONCEPTO", start)].filter((idx) => idx > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : start + 700;
  const lines = normalized.slice(start, end).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const valueLine = lines.find((line) => {
    const nums = line.match(/[0-9]+(?:[,.][0-9]+)?/g) ?? [];
    return nums.length >= 3 && !/TASA|BENEFICIO|MORA|VALOR|UNIDAD|RECAUDO|POLIZA|IVA/i.test(line);
  });
  const nums = valueLine?.match(/[0-9]+(?:[,.][0-9]+)?/g) ?? [];

  if (nums.length >= 5 && !/[,.]/.test(nums[0] ?? "") && !/[,.]/.test(nums[1] ?? "") && !/[,.]/.test(nums[2] ?? "") && !/[,.]/.test(nums[3] ?? "")) {
    return {
      teaPactada: formatRate(`${nums[0]}.${nums[1]}`),
      tasaEA: formatRate(`${nums[2]}.${nums[3]}`),
      tasaCobertura: formatRate(nums[4] ?? ""),
    };
  }

  return {
    teaPactada: formatRate(nums[0] ?? ""),
    tasaEA: formatRate(nums[1] ?? ""),
    tasaCobertura: formatRate(nums[2] ?? ""),
  };
}

function validateBancoBogotaFields(values: {
  cliente: string;
  plazoInicial: string;
  cuotasPagadas: string;
  tasaEA: string;
  cuotasPendientes: string;
  saldoCapital: number;
  saldoUVR: number;
  moneda: string;
  cuotaBase: number;
  totalAPagar: number;
  valorBeneficio: number;
}) {
  const errores: string[] = [];
  const plazo = parseInt(values.plazoInicial, 10);
  const pagadas = parseInt(values.cuotasPagadas, 10);
  const pendientes = parseInt(values.cuotasPendientes, 10);

  if (!values.cliente) errores.push("Banco de Bogotá: no se pudo leer el nombre del cliente.");
  if (!(plazo > 0)) errores.push("Banco de Bogotá: no se pudo leer el plazo inicial.");
  if (!(pagadas > 0)) errores.push("Banco de Bogotá: no se pudo leer la cuota a pagar / cuotas pagadas.");
  if (!values.tasaEA) errores.push("Banco de Bogotá: no se pudo leer la tasa cobrada E.A.");
  if (!(values.saldoCapital > 0)) errores.push("Banco de Bogotá: no se pudo leer el saldo total a la fecha de corte.");
  if (!(values.cuotaBase > 0)) errores.push("Banco de Bogotá: no se pudo reconstruir la cuota base sin subsidio.");
  if (plazo > 0 && pagadas > 0 && pendientes > 0 && Math.abs(plazo - pagadas - pendientes + 1) > 2 && Math.abs(plazo - pagadas - pendientes) > 2) {
    errores.push("Banco de Bogotá: plazo, cuota a pagar y cuotas pendientes no cuadran entre sí.");
  }
  if (values.valorBeneficio > 0 && values.totalAPagar > 0 && values.cuotaBase > 0) {
    const esperado = values.totalAPagar + values.valorBeneficio;
    if (Math.abs(esperado - values.cuotaBase) > Math.max(2500, values.cuotaBase * 0.005)) {
      errores.push("Banco de Bogotá: TOTAL A PAGAR + VALOR BENEFICIO no coincide con la cuota base.");
    }
  }
  if (values.moneda === "UVR" && !(values.saldoUVR > 0)) {
    errores.push("Banco de Bogotá UVR: no se pudo leer saldo UVR.");
  }
  return errores;
}

export function parseBancoBogotaText(rawText: string): ExtractoRecord | null {
  const text = compactSpaces(rawText);
  const normalizedHeader = normalizeForMatch(text);
  const looksBancoBogota =
    /BANCO\s*DE\s+BOGOT/.test(normalizedHeader) ||
    /BANCO\s*DE\s*BOGOT/.test(normalizedHeader.replace(/\s+/g, "")) ||
    /BANCODEBOGOTA\.COM/.test(normalizedHeader.replace(/\s+/g, ""));
  if (!looksBancoBogota || !/EXTRACTO\s+CREDITO\s+DE\s+VIVIENDA/.test(normalizedHeader)) {
    return null;
  }

  const numeroCredito = extractCreditNumber(rawText, text);
  const cliente = extractCliente(rawText);
  const datosGenerales = extractDatosGenerales(rawText);
  const tasas = extractRates(rawText);
  const valorDesembolsado = datosGenerales.valorDesembolsado || firstMoneyAfter(text, ["MONTO APROBADO", "VALOR APROBADO"]);
  const plazoInicial = datosGenerales.plazoInicial || firstNumberAfter(text, ["PLAZO INICAL", "PLAZO INICIAL"]);
  const cuotasPagadas = datosGenerales.cuotasPagadas || firstNumberAfter(text, ["CUOTA A PAGAR", "CUOTA ACTUAL"]);
  const cuotasPendientes = datosGenerales.cuotasPendientes || firstNumberAfter(text, ["CUOTAS PENDIENTES"]);
  // Banco de Bogotá: el saldo que refleja la realidad financiera tras aplicar la
  // cuota es "SALDO DE CAPITAL DESPUÉS DE EFECTUAR ESTE PAGO" (el "SALDO TOTAL A
  // LA FECHA DE CORTE" es el saldo previo al pago). Usamos el primero como base
  // de simulación y dejamos el segundo como fallback.
  const saldoDespuesPago = firstMoneyAfter(text, [
    "SALDO DE CAPITAL DESPUES DE EFECTUAR ESTE PAGO",
    "SALDO DE CAPITAL DESPUÉS DE EFECTUAR ESTE PAGO",
    "SALDO CAPITAL DESPUES DE EFECTUAR ESTE PAGO",
    "SALDO CAPITAL DESPUÉS DE EFECTUAR ESTE PAGO",
  ]);
  const saldoFechaCorte = firstMoneyAfter(text, [
    "SALDO TOTAL A LA FECHA DE CORTE",
    "SALDO A LA FECHA DE CORTE",
  ]);
  const saldoCapital = saldoDespuesPago > 0 ? saldoDespuesPago : saldoFechaCorte;
  const tasaEA = tasas.tasaEA || firstPercentAfter(text, ["TASA COBRADA E.A.", "TASA COBRADA EA"]);
  const teaPactada = tasas.teaPactada || firstPercentAfter(text, ["TASA PACTADA E.A.", "TASA PACTADA EA"]);
  const tasaCobertura = tasas.tasaCobertura || firstPercentAfter(text, ["TASA INTERÉS CON BENEFICIO E.A.", "TASA INTERES CON BENEFICIO E.A."]);

  const capitalCuota = firstMoneyAfter(text, ["+ CAPITAL", "CAPITAL"]);
  const interesCuota = firstMoneyAfter(text, ["+ INTERESES CORRIENTES", "INTERESES CORRIENTES"]);
  const segurosLeidos = extractInsuranceRows(rawText);
  const valorSeguroVida = segurosLeidos.vida || firstMoneyAfter(text, ["+ SEGURO DE VIDA", "SEGURO DE VIDA"]);
  const valorSeguroIncendio = segurosLeidos.incendio || firstMoneyAfter(text, [
    "+ SEGURO INCENDIO Y TERREMOTO",
    "SEGURO INCENDIO Y TERREMOTO",
    "+ SEGURO DE INCENDIO Y TERREMOTO",
    "SEGURO DE INCENDIO Y TERREMOTO",
  ]);
  // Banco de Bogotá OCR suele unir miles/decimales con espacios o partir la tabla.
  // Por eso se extrae por segmentos de concepto y se toma el último monto real del
  // renglón (columna "Detalle valor a pagar"), no el primer número que aparezca.
  const valorSegurosVoluntarios = segurosLeidos.voluntario || firstMoneyAfter(text, [
    "+ SEGURO(S) VOLUNTARIO(S)",
    "SEGURO(S) VOLUNTARIO(S)",
    "+ SEGUROS VOLUNTARIOS",
    "SEGUROS VOLUNTARIOS",
    "+ SEGURO VOLUNTARIO",
    "SEGURO VOLUNTARIO",
    "+ OTROS SEGUROS",
    "OTROS SEGUROS",
  ]);
  const valorSeguroTerremoto = 0;
  const seguros = valorSeguroVida + valorSeguroIncendio + valorSegurosVoluntarios + valorSeguroTerremoto;
  const cuotaSinSubsidio = firstMoneyAfter(text, ["= VALOR TOTAL", "VALOR TOTAL"]);
  const valorBeneficio = firstMoneyAfter(text, ["- VALOR BENEFICIO", "VALOR BENEFICIO"]);
  const totalAPagar = firstMoneyAfter(text, ["= TOTAL A PAGAR", "= TOTAL APAGAR", "VALOR TOTAL A PAGAR", "TOTAL A PAGAR", "TOTAL APAGAR"]);
  const baseCalculada = totalAPagar > 0 && valorBeneficio > 0 ? totalAPagar + valorBeneficio : cuotaSinSubsidio;
  const cuotaBase = baseCalculada || (capitalCuota + interesCuota + seguros) || totalAPagar;
  const cuotaFinancieraNeta = totalAPagar > 0 && seguros > 0 ? totalAPagar - seguros : cuotaBase - valorBeneficio - seguros;
  const tieneCobertura = valorBeneficio > 0 || moneyToNumber(tasaCobertura) > 0;
  const saldoUVR = 0;
  const moneda = datosGenerales.moneda;
  const errores = validateBancoBogotaFields({
    cliente,
    plazoInicial,
    cuotasPagadas,
    tasaEA,
    cuotasPendientes,
    saldoCapital,
    saldoUVR,
    moneda,
    cuotaBase,
    totalAPagar,
    valorBeneficio,
  });

  return {
    banco: "Banco de Bogotá",
    cliente,
    cedula: "",
    numeroCredito,
    producto: `Crédito hipotecario en Pesos ${tieneCobertura ? "con" : "sin"} beneficio de cobertura`,
    tipoCredito: "CREDITO_HIPOTECARIO",
    moneda,
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: formatMontoExtracto(valorDesembolsado),
    cuotaMensual: formatMontoExtracto(cuotaBase),
    seguros: formatMontoExtracto(seguros),
    cuotaSinSeguros: formatMontoExtracto(cuotaFinancieraNeta),
    cuotaConInteresSinSeguros: formatMontoExtracto(cuotaFinancieraNeta),
    plazoInicial,
    cuotasPagadas,
    cuotasPendientes,
    // Cuando hay FRECH, la "Tasa Cobrada E.A." ya está descontado el beneficio
    // y NO reproduce la cuota base (sin subsidio) que paga el saldo. La cuota base
    // se generó con la "Tasa Pactada E.A." (rate contractual). Para que la matemática
    // financiera reproduzca la cuota real, usamos la pactada cuando hay cobertura.
    tea: tieneCobertura && teaPactada ? teaPactada : tasaEA,
    teaCobrada: tasaEA,
    teaPactada,
    tasaMensual: "",
    interesCuota: formatMontoExtracto(interesCuota),
    capitalCuota: formatMontoExtracto(capitalCuota),
    valorUVR: "",
    saldoUVR: "",
    valorCobertura: tieneCobertura ? formatMontoExtracto(valorBeneficio) : "",
    tasaCobertura: tieneCobertura ? tasaCobertura : "",
    sistemaAmortizacion: datosGenerales.sistemaAmortizacion,
    tieneCobertura: tieneCobertura ? "si" : "no",
    tipoBeneficio: tieneCobertura ? "FRECH" : "",
    cuotaPagadaCliente: formatMontoExtracto(totalAPagar),
    cuotaSinSubsidio: tieneCobertura ? formatMontoExtracto(cuotaBase) : "",
    valorAPagar: formatMontoExtracto(totalAPagar),
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: "",
    valorSegurosVoluntarios: formatMontoExtracto(valorSegurosVoluntarios),
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