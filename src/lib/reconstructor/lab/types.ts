// ─────────────────────────────────────────────────────────────
// Laboratorio Financiero NUVIA · Tipos públicos (Fase 2)
//
// Este módulo NO reemplaza a src/lib/reconstructor/types.ts (Fase 1).
// Define el contrato del Laboratorio: variables detectadas a partir de
// un extracto, clasificación determinista, hipótesis, evidencias y
// diagnóstico ejecutivo. Cero PII en tipos.
// ─────────────────────────────────────────────────────────────

export type Banco =
  | "FNA"
  | "DAVIVIENDA"
  | "BANCOLOMBIA"
  | "BBVA"
  | "CAJA_SOCIAL"
  | "BANCO_DE_BOGOTA"
  | "SCOTIABANK"
  | "BANCO_POPULAR"
  | "AV_VILLAS"
  | "DESCONOCIDO";

export type MonedaLab = "PESOS" | "UVR" | "DESCONOCIDA";

export type UnidadValor = "PESOS" | "UVR" | "PORCENTAJE" | "CUOTAS" | "FECHA" | "TEXTO";

export type FuenteVariable =
  | "EXTRACTO_OCR"
  | "EXTRACTO_ESTRUCTURADO"
  | "CORREGIDA_ANALISTA"
  | "CALCULADA"
  | "INFERIDA"
  | "ESTIMADA";

export type EstadoVariable =
  | "REPORTADA"
  | "CALCULADA"
  | "INFERIDA"
  | "ESTIMADA"
  | "AMBIGUA"
  | "INCONSISTENTE"
  | "NO_DETERMINABLE";

/** Categorías financieras deterministas (no depende del LLM). */
export type CategoriaFinanciera =
  | "SALDO_PESOS"
  | "SALDO_UVR"
  | "VALOR_UVR"
  | "CUOTA_FINANCIERA"
  | "CUOTA_TOTAL"
  | "CANON"
  | "CAPITAL"
  | "INTERES"
  | "INTERES_MORA"
  | "SEGURO"
  | "FRECH"
  | "SUBSIDIO"
  | "ABONO_EXTRAORDINARIO"
  | "RELIQUIDACION"
  | "VALOR_DESEMBOLSADO"
  | "CUOTA_ORIGINAL"
  | "CAPITAL_INICIAL"
  | "PLAZO_APROBADO"
  | "PLAZO_RESTANTE"
  | "CUOTAS_PAGADAS"
  | "CUOTAS_PENDIENTES"
  | "TEA"
  | "TEM"
  | "OTROS_CARGOS"
  | "ADMINISTRACION"
  | "ANTICIPO"
  | "OPCION_ADQUISICION"
  | "TOTAL_FACTURADO"
  | "TOTAL_A_PAGAR"
  | "SUBTOTAL_CUOTA"
  | "NUMERO_CREDITO"
  | "FECHA"
  | "INFORMATIVO"
  | "OTRO";

/** Confianza cualitativa determinista. */
export type Confianza = "ALTA" | "MEDIA" | "BAJA" | "NULA";

/** Entrada normalizada al Laboratorio. Se produce internamente
 *  a partir del ExtractoData del parser existente, sin modificarlo. */
export interface ExtractoLabInput {
  banco: Banco;
  producto: string;
  moneda: MonedaLab;
  fechaCorte: string | null;
  camposDetectados: CampoDetectado[];
  /** Texto opcional, sólo si se dispuso; nunca se persiste. */
  textoExtraido?: string;
}

export interface CampoDetectado {
  /** Etiqueta original tal como apareció en el extracto o el parser. */
  etiquetaOriginal: string;
  /** Valor original en texto (sin normalizar). */
  valorOriginal: string;
  /** Valor numérico normalizado si aplica. */
  valorNormalizado: number | null;
  unidad: UnidadValor;
  paginaOrigen: number | null;
  /** Confianza declarada por el parser. */
  confianzaExtraccion: Confianza;
  fuente: FuenteVariable;
}

export interface VariableDetectada {
  id: string;
  categoria: CategoriaFinanciera;
  etiquetaOriginal: string;
  valor: number | null;
  unidad: UnidadValor;
  paginaOrigen: number | null;
  fuente: FuenteVariable;
  confianzaExtraccion: Confianza;
  confianzaClasificacion: Confianza;
  /** Marcada true cuando el analista la excluyó del análisis. */
  excluida: boolean;
  notas: string[];
}

export interface Candidato {
  categoria: CategoriaFinanciera;
  valores: number[];
  motivo: string;
}

export type SeveridadValidacion = "VERDE" | "AMARILLO" | "ROJO";

export interface ValidacionCoherencia {
  codigo: string;
  titulo: string;
  severidad: SeveridadValidacion;
  variables: CategoriaFinanciera[];
  esperado: number | null;
  observado: number | null;
  diferenciaAbs: number | null;
  diferenciaPct: number | null;
  explicacion: string;
  recomendacion: string;
}

export type Identificabilidad =
  | "CALCULABLE"
  | "INFERIBLE"
  | "ESTIMABLE"
  | "NO_DETERMINABLE";

export interface DiagnosticoIdentificabilidad {
  categoria: CategoriaFinanciera;
  identificabilidad: Identificabilidad;
  requiere: CategoriaFinanciera[];
  faltan: CategoriaFinanciera[];
  razon: string;
}

export interface EvidenciaVariable {
  categoria: CategoriaFinanciera;
  estado: EstadoVariable;
  valor: number | null;
  unidad: UnidadValor;
  confianzaMatematica: Confianza;
  formula: string;
  datosUsados: CategoriaFinanciera[];
  variablesInferidas: CategoriaFinanciera[];
  supuestos: string[];
  residuoAbs: number | null;
  residuoPct: number | null;
  advertencias: string[];
}

export interface HipotesisReconstruccion {
  id: string;
  descripcion: string;
  composicionCuota: string[];
  resultado: EvidenciaVariable | null;
  error: number | null;
  seleccionada: boolean;
  descartada: boolean;
  razonDescarte?: string;
}

export interface DiagnosticoEjecutivo {
  variablesEncontradas: number;
  variablesFaltantes: number;
  variablesReconstruidas: number;
  variablesEstimadas: number;
  variablesImposibles: number;
  inconsistencias: number;
  ambiguedades: number;
  confiabilidadGlobal: Confianza;
  confiabilidadGlobalScore: number; // 0..1, derivado deterministamente
  conclusiones: string[];
  recomendaciones: string[];
  pendientes: string[];
}

export interface LabResult {
  input: ExtractoLabInput;
  variables: VariableDetectada[];
  faltantes: CategoriaFinanciera[];
  identificabilidad: DiagnosticoIdentificabilidad[];
  reconstrucciones: EvidenciaVariable[];
  hipotesis: HipotesisReconstruccion[];
  coherencia: ValidacionCoherencia[];
  diagnostico: DiagnosticoEjecutivo;
  ambiguedades: Array<{ categoria: CategoriaFinanciera; candidatos: number[]; motivo: string }>;
}
