// ─────────────────────────────────────────────────────────────
// Laboratorio NUVIA · Diccionarios deterministas por banco
//
// Mapean claves (o etiquetas) del ExtractoData ya normalizado por el
// parser existente a categorías financieras. Sin IA, sin heurísticas
// fuzzy: si una etiqueta no está listada, se clasifica como OTRO.
// ─────────────────────────────────────────────────────────────

import type { Banco, CategoriaFinanciera } from "./types";

type Mapa = Record<string, CategoriaFinanciera>;

/** Mapa genérico basado en las CLAVES estables que ya produce
 *  extractStatement (ExtractoData es un Record<string,string|...>).
 *  Aplica a todos los bancos porque el parser normaliza los nombres. */
export const MAPA_GENERICO: Mapa = {
  saldoCapital: "SALDO_PESOS",
  saldoCapitalPesos: "SALDO_PESOS",
  saldoUVR: "SALDO_UVR",
  saldoCapitalUVR: "SALDO_UVR",
  valorUVR: "VALOR_UVR",
  cotizacionUVR: "INFORMATIVO", // FNA imprime "Cotización UVR" — informativo, NO valorUVR contractual
  cuotaMensual: "CUOTA_FINANCIERA",
  cuotaFinanciera: "CUOTA_FINANCIERA",
  cuotaSinSeguros: "CUOTA_FINANCIERA",
  cuotaSinSubsidio: "CUOTA_TOTAL",
  cuotaTotal: "CUOTA_TOTAL",
  totalAPagar: "TOTAL_A_PAGAR",
  totalFacturado: "TOTAL_FACTURADO",
  subtotalCuota: "SUBTOTAL_CUOTA",
  abonoCapitalFinanciado: "CAPITAL",
  canon: "CANON",
  capital: "CAPITAL",
  intereses: "INTERES",
  interesesCorrientes: "INTERES",
  interesesMora: "INTERES_MORA",
  seguros: "SEGURO",
  seguroVida: "SEGURO",
  seguroIncendio: "SEGURO",
  seguroTerremoto: "SEGURO",
  frech: "FRECH",
  subsidio: "SUBSIDIO",
  abonoExtraordinario: "ABONO_EXTRAORDINARIO",
  reliquidacion: "RELIQUIDACION",
  valorDesembolsado: "VALOR_DESEMBOLSADO",
  cuotaOriginal: "CUOTA_ORIGINAL",
  capitalInicial: "CAPITAL_INICIAL",
  plazoAprobado: "PLAZO_APROBADO",
  plazoOriginal: "PLAZO_APROBADO",
  plazoRestante: "PLAZO_RESTANTE",
  cuotasPagadas: "CUOTAS_PAGADAS",
  cuotasPendientes: "CUOTAS_PENDIENTES",
  tea: "TEA",
  teaCobrada: "TEA",
  tem: "TEM",
  administracion: "ADMINISTRACION",
  anticipo: "ANTICIPO",
  anticipos: "ANTICIPO",
  opcionAdquisicion: "OPCION_ADQUISICION",
  otrosCargos: "OTROS_CARGOS",
  numeroCredito: "NUMERO_CREDITO",
  fechaCorte: "FECHA",
  fecha: "FECHA",
};

/** Refinamientos por banco. Sólo declara diferencias respecto al mapa
 *  genérico. Usa las mismas claves que el parser expone. */
export const MAPAS_POR_BANCO: Record<Banco, Mapa> = {
  FNA: {
    // FNA imprime "Cotización UVR: 1.0000" incluso en créditos en PESOS
    // — ya se trata como INFORMATIVO en el mapa genérico.
    valorPagar: "TOTAL_A_PAGAR",
    valorFinanciero: "CUOTA_FINANCIERA",
  },
  DAVIVIENDA: {
    saldoAFavor: "OTRO",
  },
  BANCOLOMBIA: {
    valorAPagar: "TOTAL_A_PAGAR",
    cuotaSinSegurosSinComisiones: "CUOTA_FINANCIERA",
  },
  BBVA: {},
  CAJA_SOCIAL: {},
  BANCO_DE_BOGOTA: {},
  SCOTIABANK: {},
  BANCO_POPULAR: {},
  AV_VILLAS: {},
  DESCONOCIDO: {},
};

export function categoriaPara(clave: string, banco: Banco): CategoriaFinanciera {
  const especifico = MAPAS_POR_BANCO[banco]?.[clave];
  if (especifico) return especifico;
  return MAPA_GENERICO[clave] ?? "OTRO";
}

/** Detecta banco a partir del string reportado por el parser. */
export function detectarBanco(bancoTexto: string | undefined | null): Banco {
  const s = (bancoTexto ?? "").toLowerCase();
  if (!s) return "DESCONOCIDO";
  if (s.includes("fna") || s.includes("fondo nacional")) return "FNA";
  if (s.includes("davivienda")) return "DAVIVIENDA";
  if (s.includes("bancolombia")) return "BANCOLOMBIA";
  if (s.includes("bbva")) return "BBVA";
  if (s.includes("caja social")) return "CAJA_SOCIAL";
  if (s.includes("bogot")) return "BANCO_DE_BOGOTA";
  if (s.includes("scotia")) return "SCOTIABANK";
  if (s.includes("popular")) return "BANCO_POPULAR";
  if (s.includes("villas")) return "AV_VILLAS";
  return "DESCONOCIDO";
}
