// ─────────────────────────────────────────────────────────────
// Reconstructor Financiero NUVIA · Tolerancias centralizadas
//
// Todas las constantes numéricas usadas por el motor viven aquí para que
// el ajuste sea auditable en un único lugar. NO se importan valores
// mágicos dispersos por engine.ts / audit.ts.
// ─────────────────────────────────────────────────────────────

/** Tasa efectiva mensual (decimal) mínima aceptable en la bisección. */
export const TEM_MIN_DECIMAL = 0.00001; // 0.001 % mensual (≈ 0.012 % EA)

/** Tasa efectiva mensual (decimal) máxima razonable. */
export const TEM_MAX_DECIMAL = 0.05; // 5 % mensual (≈ 79.6 % EA)

/**
 * Cota superior expandida para cuotas atípicas. Se usa SOLO si el
 * intervalo base no contiene raíz; nunca como default. Por encima de este
 * umbral se rechaza la reconstrucción como NO_DETERMINABLE.
 */
export const TEM_MAX_EXPANDIDA_DECIMAL = 0.10; // 10 % mensual (≈ 213 % EA)

/** Número máximo de iteraciones de la bisección. */
export const BISECT_MAX_ITER = 120;

/**
 * Residuo absoluto (en pesos o UVR según la unidad de la ecuación) para
 * considerar convergencia. Se combina con `BISECT_RESIDUO_REL`.
 */
export const BISECT_RESIDUO_ABS = 1;

/** Residuo relativo (fracción de la cuota) para convergencia. */
export const BISECT_RESIDUO_REL = 1e-8;

/** Tolerancia relativa para comparar saldos reportados vs reconstruidos. */
export const TOL_SALDO_PCT = 0.01; // 1 %

/** Tolerancia relativa para comparar cuota financiera reportada vs reconstruida. */
export const TOL_CUOTA_PCT = 0.005; // 0.5 %

/** Tolerancia UVR: saldoUVR × valorUVR vs saldo en pesos. */
export const TOL_UVR_PCT = 0.01;

/** Umbral para escalar a INCONSISTENCIA_CRITICA. */
export const INCONSISTENCIA_CRITICA_PCT = 0.05; // 5 %

/** Peso mínimo (cuota financiera) para considerar la ecuación resoluble. */
export const CUOTA_MINIMA_ABS = 1;
