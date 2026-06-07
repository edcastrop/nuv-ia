// Precisión histórica del analista (Etapa 9: Resultado Bancario)
// Calcula y persiste las métricas que alimentan:
//   - Perfil de Riesgo del Analista
//   - Licencia de Autonomía NUVEX
//   - Dashboard Gerencial
//
// Fórmula: precisión = 1 - |nuvex - banco| / max(banco, 1), clamp [0..1].

import { supabase } from "@/integrations/supabase/client";

export interface PrecisionInput {
  cuotaPropuesta: number;
  plazoPropuesto: number;
  ahorroPropuesto: number;
  cuotaAprobada: number;
  plazoAprobado: number;
  ahorroAprobado: number;
}

export interface PrecisionResultado {
  precisionCuota: number; // 0..1
  precisionPlazo: number; // 0..1
  precisionAhorro: number; // 0..1
  precisionPromedio: number; // 0..1
}

export function calcularPrecision(i: PrecisionInput): PrecisionResultado {
  const calc = (nuvex: number, banco: number) => {
    if (!Number.isFinite(nuvex) || !Number.isFinite(banco)) return 0;
    if (banco <= 0 && nuvex <= 0) return 1;
    const base = Math.max(Math.abs(banco), 1);
    const p = 1 - Math.abs(nuvex - banco) / base;
    return Math.max(0, Math.min(1, p));
  };
  const precisionCuota = calc(i.cuotaPropuesta, i.cuotaAprobada);
  const precisionPlazo = calc(i.plazoPropuesto, i.plazoAprobado);
  const precisionAhorro = calc(i.ahorroPropuesto, i.ahorroAprobado);
  const precisionPromedio = (precisionCuota + precisionPlazo + precisionAhorro) / 3;
  return { precisionCuota, precisionPlazo, precisionAhorro, precisionPromedio };
}

/**
 * Actualiza el promedio móvil de precisión histórica del analista.
 * Persiste en `analista_metricas`. Si la fila no existe, la crea.
 */
export async function registrarPrecisionAnalista(
  analistaId: string,
  precision: PrecisionResultado,
): Promise<void> {
  const { data: prev } = await supabase
    .from("analista_metricas" as never)
    .select("precision_cuota, precision_plazo, precision_ahorro, total_simulaciones")
    .eq("analista_id", analistaId)
    .maybeSingle();

  const n = Math.max(1, Number((prev as { total_simulaciones?: number } | null)?.total_simulaciones ?? 1));
  const prevCuota = Number((prev as { precision_cuota?: number } | null)?.precision_cuota ?? 0);
  const prevPlazo = Number((prev as { precision_plazo?: number } | null)?.precision_plazo ?? 0);
  const prevAhorro = Number((prev as { precision_ahorro?: number } | null)?.precision_ahorro ?? 0);

  const promedioMovil = (prev: number, nuevo: number) =>
    Math.max(0, Math.min(1, (prev * (n - 1) + nuevo) / n));

  const payload = {
    analista_id: analistaId,
    precision_cuota: promedioMovil(prevCuota, precision.precisionCuota),
    precision_plazo: promedioMovil(prevPlazo, precision.precisionPlazo),
    precision_ahorro: promedioMovil(prevAhorro, precision.precisionAhorro),
  };

  if (prev) {
    await supabase
      .from("analista_metricas" as never)
      .update(payload as never)
      .eq("analista_id", analistaId);
  } else {
    await supabase.from("analista_metricas" as never).insert(payload as never);
  }
}
