// Motor de Honorarios NUVEX — pricing engine puro y testeable.
// No depende de UI ni de la base de datos.

export type TipoCreditoMH = "pesos" | "uvr";
export type ClasificacionMH =
  | "estandar"
  | "intermedio"
  | "premium"
  | "corporativo"
  | "uvr_360";

export const HONORARIO_MIN = 2_000_000;
export const HONORARIO_MAX = 14_000_000;

export const ETIQUETA_CLASIFICACION: Record<ClasificacionMH, string> = {
  estandar: "Estándar",
  intermedio: "Intermedio",
  premium: "Premium",
  corporativo: "Corporativo",
  uvr_360: "UVR 360",
};

export const COLOR_CLASIFICACION: Record<ClasificacionMH, string> = {
  estandar: "#84B98F",
  intermedio: "#445DA3",
  premium: "#7C3AED",
  corporativo: "#242424",
  uvr_360: "#D97706",
};

export interface InputMotor {
  ahorroIntereses: number;
  ahorroSeguros: number;
  tipoCredito: TipoCreditoMH;
  plazoOriginalMeses?: number;
}

export interface ResultadoMotor {
  ahorroTotal: number;
  clasificacion: ClasificacionMH;
  porcentajeAplicado: number;
  honorarioTeorico: number;
  honorarioRecomendado: number; // topado entre min/max
  alertaTope: "minimo" | "maximo" | null;
  descuentoMaximoPct: number;
  ofertas: { etiqueta: string; valor: number; descuentoPct: number }[];
}

export function clasificar(input: InputMotor): { clasificacion: ClasificacionMH; porcentaje: number } {
  const ahorro = (input.ahorroIntereses || 0) + (input.ahorroSeguros || 0);
  if (input.tipoCredito === "uvr" && (input.plazoOriginalMeses ?? 0) === 360) {
    return { clasificacion: "uvr_360", porcentaje: 3 };
  }
  if (ahorro <= 100_000_000) return { clasificacion: "estandar", porcentaje: 6 };
  if (ahorro <= 200_000_000) return { clasificacion: "intermedio", porcentaje: 4 };
  if (ahorro <= 400_000_000) return { clasificacion: "premium", porcentaje: 3 };
  return { clasificacion: "corporativo", porcentaje: 2.5 };
}

export function descuentoMaximoPct(honorario: number): number {
  if (honorario < 2_000_000) return 0;
  if (honorario <= 5_000_000) return 10;
  if (honorario <= 10_000_000) return 20;
  return 30;
}

export function calcularMotor(input: InputMotor): ResultadoMotor {
  const ahorroTotal = Math.max(0, (input.ahorroIntereses || 0) + (input.ahorroSeguros || 0));
  const { clasificacion, porcentaje } = clasificar(input);
  const teorico = Math.round(ahorroTotal * (porcentaje / 100));
  let recomendado = teorico;
  let alerta: "minimo" | "maximo" | null = null;
  if (teorico < HONORARIO_MIN) {
    recomendado = HONORARIO_MIN;
    alerta = "minimo";
  } else if (teorico > HONORARIO_MAX) {
    recomendado = HONORARIO_MAX;
    alerta = "maximo";
  }
  const descMax = descuentoMaximoPct(recomendado);
  const ofertas = [
    { etiqueta: "Honorario base", valor: recomendado, descuentoPct: 0 },
    { etiqueta: "Pronta firma 10%", valor: Math.round(recomendado * 0.9), descuentoPct: 10 },
    { etiqueta: "Pronta firma 20%", valor: Math.round(recomendado * 0.8), descuentoPct: 20 },
    { etiqueta: "Pronta firma 30%", valor: Math.round(recomendado * 0.7), descuentoPct: 30 },
  ];
  return {
    ahorroTotal,
    clasificacion,
    porcentajeAplicado: porcentaje,
    honorarioTeorico: teorico,
    honorarioRecomendado: recomendado,
    alertaTope: alerta,
    descuentoMaximoPct: descMax,
    ofertas,
  };
}

export type SemaforoAut = "verde" | "amarillo" | "rojo";

export function semaforoAutorizacion(
  honorarioOfertado: number,
  recomendado: number,
): { color: SemaforoAut; descuentoPct: number; descuentoMaxPct: number; mensaje: string; requiereAprobacion: boolean } {
  const descuentoMaxPct = descuentoMaximoPct(recomendado);
  const descuentoPct = recomendado > 0 ? Math.max(0, ((recomendado - honorarioOfertado) / recomendado) * 100) : 0;

  if (honorarioOfertado < HONORARIO_MIN) {
    return {
      color: "rojo",
      descuentoPct,
      descuentoMaxPct,
      mensaje: `Oferta inferior al mínimo permitido ($${HONORARIO_MIN.toLocaleString("es-CO")}). Requiere aprobación.`,
      requiereAprobacion: true,
    };
  }
  if (descuentoPct > descuentoMaxPct) {
    return {
      color: "rojo",
      descuentoPct,
      descuentoMaxPct,
      mensaje: `Descuento ${descuentoPct.toFixed(1)}% supera el máximo permitido (${descuentoMaxPct}%). Requiere aprobación.`,
      requiereAprobacion: true,
    };
  }
  if (descuentoPct >= descuentoMaxPct * 0.8) {
    return {
      color: "amarillo",
      descuentoPct,
      descuentoMaxPct,
      mensaje: `Descuento ${descuentoPct.toFixed(1)}% cerca del límite (${descuentoMaxPct}%).`,
      requiereAprobacion: false,
    };
  }
  return {
    color: "verde",
    descuentoPct,
    descuentoMaxPct,
    mensaje: `Descuento ${descuentoPct.toFixed(1)}% dentro del rango permitido.`,
    requiereAprobacion: false,
  };
}

export function indiceRentabilidad(vendido: number, recomendado: number): { pct: number; color: SemaforoAut; etiqueta: string } {
  if (recomendado <= 0) return { pct: 0, color: "rojo", etiqueta: "Sin referencia" };
  const pct = (vendido / recomendado) * 100;
  if (pct >= 90) return { pct, color: "verde", etiqueta: "Excelente" };
  if (pct >= 80) return { pct, color: "amarillo", etiqueta: "Aceptable" };
  return { pct, color: "rojo", etiqueta: "Revisar negociación" };
}
