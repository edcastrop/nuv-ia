// ─────────────────────────────────────────────────────────────
// Reconstructor Financiero NUVIA · Tipos públicos
// ─────────────────────────────────────────────────────────────

export type Moneda = "PESOS" | "UVR";
export type TipoCredito = "HIPOTECARIO" | "LEASING";

/**
 * Clasificación de cada resultado individual (cuota, plazo, tasa, saldo…).
 * - EXACTO: hay una única solución matemática compatible con los datos.
 * - ESTIMADO: se calculó con una o más suposiciones (rangos, defaults).
 * - RANGO: el resultado es un intervalo, nunca un número exacto.
 * - NO_DETERMINABLE: faltan datos o la ecuación no tiene solución válida.
 */
export type Clasificacion = "EXACTO" | "ESTIMADO" | "RANGO" | "NO_DETERMINABLE";

/**
 * Confianza cualitativa del resultado. Se deriva de forma determinista a
 * partir de la clasificación y de los datos usados/faltantes; nunca es un
 * porcentaje arbitrario.
 */
export type Confianza = "ALTA" | "MEDIA" | "BAJA" | "NULA";

export type DiagnosticoAuditoria =
  | "CREDITO_COHERENTE"
  | "COHERENTE_CON_OBSERVACIONES"
  | "INCONSISTENCIA_MODERADA"
  | "INCONSISTENCIA_CRITICA"
  | "INFORMACION_INSUFICIENTE";

/** Fuente de origen de cada dato de entrada. */
export type FuenteDato = "REPORTADO" | "SUPUESTO" | "RECONSTRUIDO" | "AUSENTE";

/**
 * Rango numérico. `variable` identifica qué campo de entrada generó la
 * incertidumbre (por ejemplo "seguros" o "frech").
 */
export interface RangoValor {
  minimo: number;
  maximo: number;
  central: number;
  variable: string;
  supuestos: string[];
}

/**
 * Resultado individual (cuota, plazo, tasa, saldo, etc.).
 * - `valor` sólo tiene sentido cuando `clasificacion !== "RANGO"` y
 *   `clasificacion !== "NO_DETERMINABLE"`.
 * - `rango` sólo tiene sentido cuando `clasificacion === "RANGO"`.
 */
export interface Resultado<T = number> {
  clasificacion: Clasificacion;
  confianza: Confianza;
  valor: T | null;
  rango: RangoValor | null;
  motivos: string[];
  datosUsados: string[];
  datosFaltantes: string[];
  formula: string;
  alertas: string[];
}

export interface CuotaNormalizada {
  cuotaFinancieraCalculada: number | null;
  cuotaFinancieraReportada: number | null;
  diferenciaAbs: number | null;
  diferenciaPct: number | null;
  desglose: {
    cuotaTotal: number | null;
    seguros: number;
    frech: number;
    otrosCargos: number;
    mora: number;
    interesesMora: number;
    administracion: number;
    cargosDesconocidos: number;
    opcionAdquisicionExcluida: number;
  };
  alertas: string[];
  fuenteSeguros: FuenteDato;
  fuenteFrech: FuenteDato;
  fuenteOtros: FuenteDato;
}

export interface PlazoTriple {
  matematico: Resultado; // valor exacto (puede ser fraccional)
  matematicoRedondeado: Resultado; // Math.round
  operacionalNuvex: Resultado; // roundPlazoNuvex — solo visualización
}

export interface UvrDiagnostico {
  valorReportado: number | null;
  saldoUvrReportado: number | null;
  saldoPesosReportado: number | null;
  productoReconstruido: number | null;
  diferenciaAbs: number | null;
  diferenciaPct: number | null;
  coherente: boolean;
  motivo: string;
}

export interface Observacion {
  codigo: string;
  mensaje: string;
  severidad: "info" | "aviso" | "critico";
}

export interface AuditoriaResult {
  diagnostico: DiagnosticoAuditoria;
  observaciones: Observacion[];
  criteriosEvaluados: string[];
}

/** Rango operativo mostrado en la UI (seguros/frech/otros/cuota financiera). */
export interface RangoResultado extends RangoValor {
  clasificacion: "ESTIMADO";
  confianza: "MEDIA";
}

/** Entrada del motor. Todos los campos son opcionales salvo `moneda`. */
export interface ReconstructorInput {
  moneda: Moneda;
  tipoCredito?: TipoCredito;

  // Saldos y unidades
  saldoCapitalPesos?: number;
  saldoCapitalUVR?: number;
  valorUVR?: number;

  // Cuota (tal como se factura, en pesos)
  cuotaTotal?: number;
  cuotaFinancieraReportada?: number;

  // Desglose de cuota — cada uno puede venir como valor exacto o rango.
  seguros?: number;
  seguros_min?: number;
  seguros_max?: number;

  frech?: number; // subsidio (positivo)
  frech_min?: number;
  frech_max?: number;

  otrosCargos?: number;
  otrosCargos_min?: number;
  otrosCargos_max?: number;

  mora?: number;
  interesesMora?: number;
  administracion?: number;
  opcionAdquisicion?: number;
  cargosDesconocidos?: number;

  // Tasa
  tea?: number; // % (ej. 12.5 → 0.125 decimal)
  tem?: number; // % mensual (opcional, alternativa a TEA)

  // Plazo
  plazoOriginal?: number;
  cuotasPagadas?: number;
  cuotasPendientes?: number;
  plazoReportado?: number;

  // Contexto adicional
  variacionUVRAnual?: number; // % EA; SOLO para proyecciones informativas
  abonoExtraordinarioReciente?: boolean;
}

export interface ReconstructorOutput {
  moneda: Moneda;
  tipoCredito: TipoCredito;

  cuotaNormalizada: CuotaNormalizada;

  tea: Resultado;
  tem: Resultado;

  plazo: PlazoTriple;

  saldoReconstruido: Resultado;
  saldoReportado: number | null;
  diferenciaSaldoAbs: number | null;
  diferenciaSaldoPct: number | null;

  uvr: UvrDiagnostico | null;

  rangos: RangoResultado[];

  auditoria: AuditoriaResult;

  clasificacionGlobal: Clasificacion;
  confianzaGlobal: Confianza;

  datosFaltantes: string[];
  datosUsados: string[];
}
