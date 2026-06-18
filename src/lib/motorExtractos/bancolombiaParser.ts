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
  valorDesembolsado: "alta",
};

function decimalAfter(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`${escaped}\\s*[:]?\\s*\\$?\\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?|[0-9]+(?:[.,][0-9]+)?)`, "i"));
  if (!m) return 0;
  return moneyToNumber(m[1]);
}

function extractValorUVR(text: string) {
  // Bancolombia rotula esto como "Valor UVR del día" / "Valor UVR" / "Valor de la UVR"
  // Es UN solo número con 4 decimales (ej "372.1234" o "372,1234").
  const patterns = [
    /Valor\s+(?:de\s+la\s+)?UVR\s+del\s+d[ií]a\s*[:]?\s*\$?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Valor\s+(?:de\s+la\s+)?UVR\s+(?:a\s+la\s+fecha|vigente|del\s+per[ií]odo|actual)\s*[:]?\s*\$?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Valor\s+UVR\s*[:]?\s*\$?\s*([0-9]+(?:[.,][0-9]+)?)/i,
    /Valor\s+de\s+la\s+UVR\s*[:]?\s*\$?\s*([0-9]+(?:[.,][0-9]+)?)/i,
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) {
      const n = moneyToNumber(m[1]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function extractSaldoUVR(text: string) {
  // Etiqueta típica: "Saldo UVR" / "Saldo en UVR" / "Saldo de capital en UVR".
  const patterns = [
    /Saldo\s+(?:de\s+capital\s+)?en\s+UVR\s*[:]?\s*\$?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)/i,
    /Saldo\s+UVR\s*[:]?\s*\$?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)/i,
    /Saldo\s+capital\s+UVR\s*[:]?\s*\$?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]+)?)/i,
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) {
      const n = moneyToNumber(m[1]);
      if (n > 0) return n;
    }
  }
  return 0;
}

function compactSpaces(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function normalizeInt(value: string) {
  const n = parseInt(value.replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? String(n) : "";
}

function moneyToNumber(value?: string | null) {
  return parseMontoExtracto(value ?? "");
}

function amountAfter(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, "\\*?");
  return moneyToNumber(text.match(new RegExp(`${escaped}\\s+\\$\\s*([0-9][0-9.,]*)`, "i"))?.[1] ?? "");
}

function percentAfter(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (text.match(new RegExp(`${escaped}\\s+([0-9]+(?:[,.][0-9]+)?)\\s*%`, "i"))?.[1] ?? "").replace(",", ".");
}

function firstMatch(text: string, rx: RegExp) {
  return text.match(rx)?.[1]?.trim() ?? "";
}

function extractCliente(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((line) => compactSpaces(line).trim()).filter(Boolean);
  const idx = lines.findIndex((line) => /SEÑOR\(A\)|SENOR\(A\)/i.test(line));
  const nameRx = /^[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,7}$/;
  if (idx >= 0) {
    const candidate = lines.slice(idx + 1, idx + 5).find((line) => nameRx.test(line));
    if (candidate) return candidate;
  }
  return lines.find((line) => nameRx.test(line)) ?? "";
}

function extractMovimiento(text: string, column: "capital" | "interes") {
  const rows = text.split(/\r?\n/).map((line) => compactSpaces(line).trim());
  let total = 0;
  for (const row of rows) {
    if (!/Pago\s+Cuota/i.test(row) || /Beneficio\s+por\s+Cuota/i.test(row)) continue;
    const tail = row.replace(/^.*?Pago\s+Cuota\s+\w+\s+/i, "");
    const nums = Array.from(tail.matchAll(/[0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2}|0\.00/g)).map((m) => moneyToNumber(m[0]));
    if (nums.length < 2) continue;
    total += column === "capital" ? nums[0] : nums[1];
  }
  return total;
}

function hasBancolombiaCoverage(text: string) {
  const subsidio = amountAfter(text, "Valor subsidio Gobierno");
  const cuotaSin = amountAfter(text, "Valor cuota sin subsidio Gobierno");
  const cuotaCon = amountAfter(text, "Valor cuota con subsidio");
  const tasaSubsidiada = moneyToNumber(percentAfter(text, "Tasa interés subsidiada"));
  return subsidio > 0 || tasaSubsidiada > 0 || (cuotaSin > 0 && cuotaCon > 0 && cuotaSin > cuotaCon);
}

export function parseBancolombiaText(rawText: string): ExtractoRecord | null {
  const text = compactSpaces(rawText);
  if (!/bancolombia/i.test(text) || !/Estado\s+de\s+Cr[eé]dito\s+Hipotecario/i.test(text)) {
    return null;
  }

  const cliente = extractCliente(rawText);
  const numeroCredito = firstMatch(text, /N[uú]mero\s+de\s+cr[eé]dito\s+([0-9]+)/i);
  const plan = firstMatch(text, /Plan:\s+(.+?)\s+Tasa\s+inter[eé]s\s+pactada/i);
  const moneda = /\ben\s+UVR\b|\bUVR\b/i.test(`${firstMatch(text, /Estado\s+de\s+Cr[eé]dito\s+Hipotecario\s+en\s+(\w+)/i)} ${plan}`)
    ? "UVR"
    : "PESOS";
  const valorAPagar = moneyToNumber(
    firstMatch(
      text,
      /Fecha\s+de\s+Pago\s+Fecha\s+en\s+que\s+se\s+gener[oó]\s+el\s+extracto\s+Valor\s+a\s+Pagar\s+Saldo\s+a\s+la\s+fecha\s+en\s+que\s+se\s+gener[oó]\s+el\s+extracto\s+[0-9/]+\s+[0-9/]+\s+\$\s*([0-9][0-9.,]*)/i,
    ),
  );
  const saldoCapital = moneyToNumber(
    firstMatch(text, /Valor\s+a\s+Pagar\s+Saldo\s+a\s+la\s+fecha\s+en\s+que\s+se\s+gener[oó]\s+el\s+extracto\s+[0-9/]+\s+[0-9/]+\s+\$\s*[0-9][0-9.,]*\s+\$\s*([0-9][0-9.,]*)/i),
  );
  const fechaExtracto = firstMatch(text, /Valor\s+a\s+Pagar\s+Saldo\s+a\s+la\s+fecha\s+en\s+que\s+se\s+gener[oó]\s+el\s+extracto\s+[0-9/]+\s+([0-9]{4}\/[0-9]{2}\/[0-9]{2})/i).replace(/\//g, "-");

  const cuotaSinSeguros = amountAfter(text, "Valor de la cuota sin seguros y sin comisiones");
  const valorSeguroVida = amountAfter(text, "*Valor seguro vida");
  const valorSeguroIncendio = amountAfter(text, "*Valor seguro incendio");
  const valorSeguroTerremoto = amountAfter(text, "*Valor seguro terremoto");
  const seguros = valorSeguroVida + valorSeguroIncendio + valorSeguroTerremoto;
  const valorCuotaSinSubsidioGobierno = amountAfter(text, "Valor cuota sin subsidio Gobierno");
  const valorSubsidioGobierno = amountAfter(text, "Valor subsidio Gobierno");
  const valorCuotaConSubsidio = amountAfter(text, "Valor cuota con subsidio");
  const tieneCobertura = hasBancolombiaCoverage(text);
  const cuotaMensual = tieneCobertura && valorCuotaSinSubsidioGobierno > 0
    ? valorCuotaSinSubsidioGobierno + seguros
    : (cuotaSinSeguros > 0 && seguros > 0 ? cuotaSinSeguros + seguros : valorAPagar);

  const errores: string[] = [];
  if (valorAPagar > 0 && cuotaMensual > 0 && Math.abs(valorAPagar - cuotaMensual) > 2 && !tieneCobertura) {
    errores.push("Valor a Pagar no coincide con cuota sin seguros + seguros en el extracto Bancolombia.");
  }
  if (tieneCobertura && valorSubsidioGobierno <= 0 && valorCuotaSinSubsidioGobierno <= 0) {
    errores.push("Beneficio detectado sin valores operativos suficientes; revisar manualmente.");
  }

  return {
    banco: "Bancolombia",
    cliente,
    cedula: "",
    numeroCredito,
    producto: `Crédito hipotecario en ${moneda === "UVR" ? "UVR" : "Pesos"} ${tieneCobertura ? "con" : "sin"} beneficio de cobertura`,
    tipoCredito: "CREDITO_HIPOTECARIO",
    moneda,
    saldoCapital: formatMontoExtracto(saldoCapital),
    valorDesembolsado: formatMontoExtracto(amountAfter(text, "Valor desembolso")),
    cuotaMensual: formatMontoExtracto(cuotaMensual),
    seguros: formatMontoExtracto(seguros),
    cuotaSinSeguros: formatMontoExtracto(cuotaSinSeguros),
    cuotaConInteresSinSeguros: formatMontoExtracto(cuotaSinSeguros),
    plazoInicial: normalizeInt(firstMatch(text, /Plazo\s+total\s+en\s+meses\s+([0-9]{1,3})/i)),
    cuotasPagadas: normalizeInt(firstMatch(text, /Nro\.\s+cuota\s+a\s+cancelar\s+([0-9]+)/i)),
    cuotasPendientes: normalizeInt(firstMatch(text, /Nro\.\s+cuotas\s+pendientes\s+para\s+pago\s+total\s+([0-9]+)/i)),
    tea: percentAfter(text, "Tasa interés cobrada"),
    teaCobrada: percentAfter(text, "Tasa interés cobrada"),
    teaPactada: percentAfter(text, "Tasa interés pactada"),
    tasaMensual: "",
    interesCuota: formatMontoExtracto(extractMovimiento(rawText, "interes")),
    capitalCuota: formatMontoExtracto(extractMovimiento(rawText, "capital")),
    valorUVR: "",
    saldoUVR: "",
    valorCobertura: tieneCobertura ? formatMontoExtracto(valorSubsidioGobierno) : "",
    tasaCobertura: "",
    tieneCobertura: tieneCobertura ? "si" : "no",
    tipoBeneficio: tieneCobertura ? "Subsidio Gobierno" : "",
    cuotaPagadaCliente: formatMontoExtracto(valorAPagar),
    cuotaSinSubsidio: tieneCobertura ? formatMontoExtracto(valorCuotaSinSubsidioGobierno) : "",
    valorAPagar: formatMontoExtracto(valorAPagar),
    valorSeguroVida: formatMontoExtracto(valorSeguroVida),
    valorSeguroIncendio: formatMontoExtracto(valorSeguroIncendio),
    valorSeguroTerremoto: formatMontoExtracto(valorSeguroTerremoto),
    valorCuotaSinSubsidioGobierno: formatMontoExtracto(valorCuotaSinSubsidioGobierno),
    valorSubsidioGobierno: formatMontoExtracto(valorSubsidioGobierno),
    valorCuotaConSubsidio: formatMontoExtracto(valorCuotaConSubsidio),
    valorAseguradoInmueble: formatMontoExtracto(amountAfter(text, "Valor asegurado Incendio y Terremoto")),
    cuotaActualNumero: normalizeInt(firstMatch(text, /Nro\.\s+cuota\s+a\s+cancelar\s+([0-9]+)/i)),
    fechaExtracto,
    cuotaBaseSimulacion: formatMontoExtracto(cuotaMensual),
    requiereVerificacionBeneficio: errores.length ? "si" : "no",
    alertaCuotaBase: errores[0] ?? "",
    erroresValidacion: errores.join("\n"),
    advertenciasNormalizacion: "",
    mapeoBanco: "bancolombia",
    confianza: confidence,
  };
}