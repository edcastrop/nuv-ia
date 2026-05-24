// Registro de plantillas bancarias para el Motor de Extractos NUVEX V1.
// Agregar un parser nuevo = agregar un objeto a BANK_PROFILES. Sin tocar el resto.

export type Moneda = "PESOS" | "UVR" | "";
export type Producto = "CREDITO_HIPOTECARIO" | "LEASING_HABITACIONAL" | "";

export interface BankProfile {
  id: string;
  banco: string;          // nombre canónico que se guarda
  productos: Producto[];  // productos soportados por esta plantilla
  // Pistas léxicas para detectar el banco a partir del texto del extracto
  matchAny: RegExp[];
  // Instrucciones específicas que se inyectan en el prompt del parser
  hints: string;
}

export const BANK_PROFILES: BankProfile[] = [
  {
    id: "bancolombia",
    banco: "Bancolombia",
    productos: ["CREDITO_HIPOTECARIO", "LEASING_HABITACIONAL"],
    matchAny: [/bancolombia/i, /grupo\s+bancolombia/i],
    hints: `BANCOLOMBIA — etiquetas LITERALES (no interpretes sinónimos):
- "Saldo a la fecha en que se generó el extracto" → saldoCapital
- "Valor desembolso" → valorDesembolsado
- "Plazo total en meses" → plazoInicial
- "Nro. cuota a cancelar" → cuotasPagadas (es la cuota que se está pagando ahora)
- "Nro. cuotas pendientes para pago total" → cuotasPendientes
- "Valor a Pagar" → cuotaActual (cuota efectivamente pagada)
- "Tasa interés cobrada" → tasaEA. "Tasa interés pactada" NO usar.
- Seguros = "*Valor seguro vida" + "*Valor seguro incendio" + "*Valor seguro terremoto" (suma).
- NO confundir "Valor asegurado Incendio y Terremoto" (valor del inmueble) con los seguros mensuales.
- Si aparece "Valor subsidio Gobierno" o "FRECH" → es producto CON Beneficio de Cobertura.`,
  },
  {
    id: "davivienda_hipotecario",
    banco: "Davivienda",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/davivienda/i],
    hints: `DAVIVIENDA HIPOTECARIO:
- Busca "Saldo Capital" / "Saldo a Capital".
- Cuota = "Valor Cuota" o "Cuota Total".
- Plazo en meses bajo "Plazo Pactado" / "Plazo Inicial".
- Tasa EA bajo "Tasa Efectiva Anual" o "Tasa E.A.".
- Si moneda UVR, extrae "Saldo UVR" y "Valor UVR del día".`,
  },
  {
    id: "davivienda_leasing",
    banco: "Davivienda",
    productos: ["LEASING_HABITACIONAL"],
    matchAny: [
      /extracto\s+contrato\s+leasing/i,
      /davivienda.*leasing/i,
      /leasing.*davivienda/i,
      /no\.?\s*c[aá]nones\s+pdtes/i,
      /no\.?\s*de\s+canon\s+que\s+se\s+cancela/i,
    ],
    hints: `DAVIVIENDA LEASING HABITACIONAL (parser id: davivienda_leasing_pesos).

IDENTIFICACIÓN: el documento dice "Extracto Contrato Leasing", "Davivienda",
"No. Cánones Pdtes. Pago Total" y "No. de Canon que se Cancela".
→ banco="Davivienda", producto="LEASING_HABITACIONAL", moneda="PESOS".

CAMPOS — etiquetas LITERALES del extracto Davivienda Leasing:
- titular ← texto que sigue a "Apreciado Cliente" (nombres en mayúsculas).
- numeroCredito ← número junto a "Extracto Contrato Leasing" o "No.Contrato del Leasing" (ej "600303970014253-4").
- cuotaActual ← "+ Valor Cuota Mes" (es el canon mensual que paga el cliente, INCLUYE seguros).
- saldoCapital ← página 2, valor junto a "Saldo a: [fecha]". NO usar "Saldo anterior".
- plazoInicial ← "Plazo" (en meses).
- cuotasPendientes ← "No. Cánones Pdtes. Pago Total".
- cuotasPagadas ← CALCULAR: plazoInicial - cuotasPendientes. Score 90.
- tasaEA ← "Tasa Interés Cte. Cobrada" (esta es la que se usa para simulación).
  La "Tasa Interés Cte. Pactada" NO va en tasaEA; déjala fuera o usa scoring bajo si no hay otro campo.

SEGUROS (página 2, sección "Valores en Pesos"):
- "Seguro de Vida" → un valor.
- "Seguro de Incendio y Anexos" → un valor.
- "Seguro Protección de Pagos" → un valor (puede ser 0).
- seguros = suma exacta de los tres (NO calcular por tasa por millón).
  Ejemplo real: 21174 + 43573 + 0 = 64747.

CAPITAL E INTERESES (página 2):
- interesCuota ← "Intereses Corrientes" (ej 773225).
- capitalCuota ← "Abonos a Capital" (ej 226775).
- Validación: capitalCuota + interesCuota + seguros ≈ cuotaActual (tolerancia ±2000 por redondeo).

VALOR DESEMBOLSADO:
- Si el extracto NO muestra "Valor del leasing", "Valor inicial del leasing"
  ni "Valor del contrato" → valorDesembolsado="" con score 0.
  NO inventar. NO usar valor asegurado. NO usar saldo anterior.

CÉDULA:
- Si "Documento No:" muestra "0000000000" o equivalente enmascarado →
  cedula="" con score 0. NO inventar.

FECHA DESEMBOLSO / FECHA EXTRACTO:
- Para fechaDesembolso usar fecha del contrato si está visible; si no, vacío.
- Para fecha del extracto usar "Saldo a: [fecha]" en formato YYYY-MM-DD
  (ej "May. 08/2026" → "2026-05-08"). No guardar solo "2026-05".

BENEFICIO / COBERTURA:
- NO marcar beneficio solo por mencionar "cobertura" en el texto.
- Activar solo si hay valor > 0 en "Interés Cte. Cobertura",
  "Valor Beneficio", "Valor subsidio" o "Cobertura FRECH".
- Si Interés Cte. Cobertura = 0 → producto SIN beneficio; no agregar alerta.

sistemaAmortizacion = "leasing canon fijo" si no es claro otro sistema.`,
  },
  {
    id: "davibank",
    banco: "Davibank",
    productos: ["CREDITO_HIPOTECARIO", "LEASING_HABITACIONAL"],
    matchAny: [/davibank/i, /colpatria/i, /scotiabank.*colpatria/i],
    hints: `DAVIBANK (antes Colpatria):
- Saldo bajo "Saldo Capital" o "Capital Pendiente".
- Cuota bajo "Valor Cuota" o "Canon" (si leasing).
- Tasa EA "Tasa Efectiva Anual".
- Si encuentras "Colpatria" reporta banco="Davibank".`,
  },
  {
    id: "caja_social",
    banco: "Banco Caja Social",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/caja\s+social/i, /bcsc/i],
    hints: `BANCO CAJA SOCIAL:
- Secciones típicas: "Detalle Cuota a Pagar", "Información General del Crédito", "Saldo Capital".
- "Cuota Total" → cuotaActual. "Capital + Intereses + Seguros" se desglosa dentro.
- Plazo bajo "Plazo Original (meses)" o "Plazo Aprobado".
- Si dice "UVR" en cualquier parte de "Información General", moneda=UVR.`,
  },
  {
    id: "banco_bogota_hipotecario",
    banco: "Banco de Bogotá",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/banco\s+de\s+bogot/i, /bogot[aá]\s+s\.?a/i],
    hints: `BANCO DE BOGOTÁ HIPOTECARIO:
- "Valor del crédito" → valorDesembolsado.
- "Plazo inicial" en meses.
- "Cuotas pendientes" y "Cuota" / "Valor cuota".
- "Beneficio" — si aparece, producto = CON Beneficio de Cobertura.`,
  },
  {
    id: "banco_bogota_leasing",
    banco: "Banco de Bogotá",
    productos: ["LEASING_HABITACIONAL"],
    matchAny: [/banco\s+de\s+bogot.*leasing/i, /leasing.*bogot/i],
    hints: `BANCO DE BOGOTÁ LEASING:
- "Valor del leasing" → valorDesembolsado.
- "Canon" → cuotaActual. "Cánones pendientes" → cuotasPendientes.
- Plazo en meses.`,
  },
  {
    id: "fna",
    banco: "FNA",
    productos: ["CREDITO_HIPOTECARIO", "LEASING_HABITACIONAL"],
    matchAny: [/fondo\s+nacional\s+del\s+ahorro/i, /\bfna\b/i],
    hints: `FNA (Fondo Nacional del Ahorro):
- Estructura multipágina. Busca "Saldo deuda" → saldoCapital.
- "Valor cuota" → cuotaActual. "Valor total a pagar" NO es cuota mensual, ignorar.
- "Cotización UVR" → valorUVR si aplica. Si menciona UVR, moneda=UVR.
- Plazo en meses bajo "Plazo del crédito" / "Plazo pactado".`,
  },
  {
    id: "banco_popular",
    banco: "Banco Popular",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/banco\s+popular/i],
    hints: `BANCO POPULAR HIPOTECARIO: estructura estándar. Saldo Capital, Valor Cuota, Plazo, Tasa EA, Seguros desglosados.`,
  },
  {
    id: "banco_occidente",
    banco: "Banco de Occidente",
    productos: ["CREDITO_HIPOTECARIO", "LEASING_HABITACIONAL"],
    matchAny: [/banco\s+de\s+occidente/i, /occidente\s+s\.?a/i],
    hints: `BANCO DE OCCIDENTE: estructura estándar. Si producto=Leasing, "Canon"→cuotaActual.`,
  },
  {
    id: "av_villas",
    banco: "AV Villas",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/av\s*villas/i, /banco\s+av/i],
    hints: `AV VILLAS HIPOTECARIO: "Saldo Capital", "Cuota Mensual", "Tasa Efectiva Anual", desglose de seguros.`,
  },
  {
    id: "credifamilia",
    banco: "Credifamilia",
    productos: ["CREDITO_HIPOTECARIO"],
    matchAny: [/credifamilia/i],
    hints: `CREDIFAMILIA: especializada en vivienda VIS. Casi siempre tiene Cobertura/FRECH. Saldo Capital, Valor Cuota, Plazo en meses.`,
  },
];

// Detecta perfil a partir de texto crudo del extracto (primeras páginas).
export function detectProfile(rawText: string): BankProfile | null {
  const t = rawText.slice(0, 8000);
  for (const p of BANK_PROFILES) {
    if (p.matchAny.some((rx) => rx.test(t))) return p;
  }
  return null;
}

export function detectProducto(rawText: string): Producto {
  const t = rawText.toLowerCase();
  if (/leasing\s+habitacional|canon\s+leasing|opci[oó]n\s+de\s+compra/.test(t)) {
    return "LEASING_HABITACIONAL";
  }
  if (/cr[eé]dito\s+hipotecario|pr[eé]stamo\s+hipotecario|hipoteca/.test(t)) {
    return "CREDITO_HIPOTECARIO";
  }
  return "";
}

export function detectMoneda(rawText: string): Moneda {
  const t = rawText.toLowerCase();
  if (/\buvr\b|valor\s+uvr|saldo\s+uvr|cotizaci[oó]n\s+uvr/.test(t)) return "UVR";
  if (/pesos|valor\s+cuota|saldo\s+capital/.test(t)) return "PESOS";
  return "";
}

export const CAMPOS_MOTOR = [
  "banco",
  "producto",
  "moneda",
  "titular",
  "cedula",
  "numeroCredito",
  "valorDesembolsado",
  "fechaDesembolso",
  "plazoInicial",
  "cuotasPagadas",
  "cuotasPendientes",
  "saldoCapital",
  "cuotaActual",
  "interesCuota",
  "capitalCuota",
  "seguros",
  "tasaEA",
  "tasaMensual",
  "sistemaAmortizacion",
  "valorUVR",
  "saldoUVR",
] as const;

export type CampoMotor = (typeof CAMPOS_MOTOR)[number];

export const CAMPOS_CRITICOS: CampoMotor[] = [
  "banco",
  "producto",
  "saldoCapital",
  "cuotaActual",
  "plazoInicial",
  "cuotasPagadas",
  "tasaEA",
];

export const CAMPO_LABEL: Record<CampoMotor, string> = {
  banco: "Banco",
  producto: "Producto",
  moneda: "Moneda",
  titular: "Titular",
  cedula: "Cédula",
  numeroCredito: "Número de crédito",
  valorDesembolsado: "Valor desembolso",
  fechaDesembolso: "Fecha desembolso",
  plazoInicial: "Plazo inicial (meses)",
  cuotasPagadas: "Cuotas pagadas",
  cuotasPendientes: "Cuotas pendientes",
  saldoCapital: "Saldo capital",
  cuotaActual: "Valor cuota",
  interesCuota: "Intereses",
  capitalCuota: "Capital",
  seguros: "Seguros",
  tasaEA: "Tasa EA",
  tasaMensual: "Tasa mensual",
  sistemaAmortizacion: "Sistema amortización",
  valorUVR: "Valor UVR",
  saldoUVR: "Saldo UVR",
};
