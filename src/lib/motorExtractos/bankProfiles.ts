// Registro de plantillas bancarias para el Motor de Extractos NUVEX V1.
// Agregar un parser nuevo = agregar un objeto a BANK_PROFILES. Sin tocar el resto.

export type Moneda = "PESOS" | "UVR" | "";
export type Producto = "CREDITO_HIPOTECARIO" | "LEASING_HABITACIONAL" | "";

export interface BankProfile {
  id: string;
  banco: string; // nombre canónico que se guarda
  productos: Producto[]; // productos soportados por esta plantilla
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
    hints: `BANCOLOMBIA — etiquetas LITERALES (no interpretes sinónimos ni valores de anexos):
- "Saldo a la fecha en que se generó el extracto" → saldoCapital
- "Valor desembolso" → valorDesembolsado
- "Plazo total en meses" → plazoInicial
- "Nro. cuota a cancelar" → cuotasPagadas (es la cuota que se está pagando ahora)
- "Nro. cuotas pendientes para pago total" → cuotasPendientes
- "Valor a Pagar" → cuotaActual (total del recibo: cuota con subsidio + seguros).
- "Tasa interés cobrada" → tasaEA, pero si hay subsidio Gobierno/FRECH/Fresh la tasa real para simulación debe incluir el subsidio: calcula tasaEA desde (Intereses Corriente + Valor subsidio Gobierno) / Saldo Capital y conviértela a EA. "Tasa interés pactada", "tasa interés subsidiada" y tablas de "Tasas y tarifas Seguro Vida" NO se usan como tasaEA.
- Seguros = "*Valor seguro vida" + "*Valor seguro incendio" + "*Valor seguro terremoto" (suma).
- NO confundir "Valor asegurado Incendio y Terremoto" (valor del inmueble) con los seguros mensuales.
- Si la suma visual de seguros no cuadra, usa esta validación: seguros = "Valor a Pagar" - "Valor cuota con subsidio".
- capitalCuota e interesCuota se toman de "Movimientos Último Periodo" fila "Pago Cuota": columnas "Capital" e "Intereses Corriente". NO uses valores calculados ni aproximados.
- Validación obligatoria antes de responder: cuotasPagadas + cuotasPendientes - 1 debe ser igual a plazoInicial; capitalCuota + interesCuota + seguros debe coincidir con "Valor a Pagar"; cuotaConSubsidio + seguros debe coincidir con "Valor a Pagar".
- Si una validación no cuadra, re-lee el campo literal del extracto y baja el score del campo dudoso.

BENEFICIO DE COBERTURA / SUBSIDIO GOBIERNO / FRECH (CRÍTICO):
- "Valor cuota sin subsidio Gobierno" → cuotaSinSubsidio.
- "Valor subsidio Gobierno" → valorBeneficioMensual. tipoBeneficio="Subsidio Gobierno".
- "Valor cuota con subsidio" → cuotaConSubsidio.
- Si valorBeneficioMensual > 0 → beneficioActivo="si". Si no aparece o es 0 → beneficioActivo="no", deja los demás campos de beneficio vacíos con score 0.
- NO marques beneficio sólo por texto legal o por la palabra "cobertura" sin valor.
- Si el extracto NO trae tasa de cobertura explícita, deja tasaCobertura="" con score 0 (no inventes).`,
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

IDENTIFICACIÓN: "Extracto Contrato Leasing" + "Davivienda" + "No. Cánones Pdtes. Pago Total".
→ banco="Davivienda", producto="LEASING_HABITACIONAL", moneda="PESOS".

INTERPRETACIÓN DE NÚMEROS (CRÍTICO):
- Formato americano "1,065,000.00" → 1065000. Coma=miles, punto=decimal.
- Formato colombiano "1.065.000,00" → 1065000. Punto=miles, coma=decimal.
- "$773,225.38" → 773225.38 (NO 773225380). "$21,174.00" → 21174.
- NUNCA conviertas "$77,322.538" en 77322538. Reconoce cuál es decimal por el patrón.
- Devuelve montos como dígitos con punto decimal si aplica (ej "773225.38" o "1065000").

CAMPOS — etiquetas LITERALES:
- titular ← texto inmediatamente debajo de "Apreciado Cliente" (nombres en mayúsculas).
- numeroCredito ← número junto a "Extracto Contrato Leasing" o "No.Contrato del Leasing" (ej "600303970014253-4").
- cuotaActual ← SOLO "+ Valor Cuota Mes". NO uses "Total Aplicado". NO uses "Total Valor a pagar" si hay mora.
- saldoCapital ← página 2, "Saldo a: [fecha]" o "Saldo a la Fecha de Corte". NO uses "Saldo anterior".
- plazoInicial ← "Plazo" (meses).
- cuotasPendientes ← "No. Cánones Pdtes. Pago Total".
- cuotasPagadas ← plazoInicial − cuotasPendientes (score 90).
- tasaEA ← SOLO "Tasa Interés Cte. Cobrada" (es la usada para simulación).
  "Tasa Interés Cte. Pactada" es solo referencia, NO la pongas en tasaEA.

SEGUROS (página 2, "Valores en Pesos") — NO uses tasas por millón:
- "Seguro de Vida"  +  "Seguro de Incendio y Anexos"  +  "Seguro Protección de Pagos"
- seguros = suma exacta de los tres. Si alguno no aparece → 0.
- Ejemplo real esperado: 21174 + 43573 + 0 = 64747.

CAPITAL E INTERESES (página 2):
- interesCuota ← "Intereses Corrientes" (ej 773225.38).
- capitalCuota ← "Abonos a Capital" (ej 226774.62).
- "Abonos a Capital" NO es beneficio, NO es cobertura, NO es subsidio.

BENEFICIO / COBERTURA — regla estricta:
- NO marques beneficio solo porque el texto mencione "cobertura".
- Solo si hay valor > 0 en "Interés Cte. Cobertura", "Valor Beneficio",
  "Valor subsidio" o "Cobertura FRECH". Si todos están en 0 → SIN beneficio,
  no agregues alerta tipo "La cobertura condicionada".

CÉDULA:
- Si "Documento No:" muestra "0000000000" o enmascarado → cedula="" con score 0.
- NUNCA tomes el NIT de Davivienda como cédula del cliente.

VALOR DESEMBOLSADO:
- Si no aparece "Valor del leasing" / "Valor inicial del leasing" / "Valor del contrato"
  → valorDesembolsado="" con score 0. NO inventar. NO bloquea simulación.

FECHA DEL EXTRACTO:
- Toma "Saldo a: [fecha]" en formato YYYY-MM-DD (ej "May. 08/2026" → "2026-05-08").

sistemaAmortizacion = "leasing canon fijo" si no hay otra evidencia.`,
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
  // Beneficio / Cobertura / FRECH / Fresh / Subsidio Gobierno
  "beneficioActivo",
  "tipoBeneficio",
  "valorBeneficioMensual",
  "tasaCobertura",
  "cuotaSinSubsidio",
  "cuotaConSubsidio",
] as const;

export type CampoMotor = (typeof CAMPOS_MOTOR)[number];

// REGLA DE ORO: solo estos campos son obligatorios para habilitar la simulación.
// Cédula, valor desembolsado, beneficio, tasa cobertura, fecha expedición y
// dirección son datos jurídicos/complementarios y NO bloquean el simulador.
export const CAMPOS_CRITICOS: CampoMotor[] = [
  "titular",
  "producto",
  "plazoInicial",
  "cuotasPendientes",
  "cuotaActual",
  "seguros",
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
  beneficioActivo: "¿Tiene beneficio? (si/no)",
  tipoBeneficio: "Tipo de beneficio",
  valorBeneficioMensual: "Valor beneficio mensual",
  tasaCobertura: "Tasa de cobertura (%)",
  cuotaSinSubsidio: "Cuota sin subsidio",
  cuotaConSubsidio: "Cuota con subsidio",
};
