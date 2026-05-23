// Centro único de cálculos del Beneficio de Cobertura (Fresh / FRECH / VIS / Mi Casa Ya / Subsidio).
// Todas las pantallas (simuladores, proyección, PDF, paz y salvo, cuenta de cobro)
// deben leer derivados desde aquí. NO modifica fórmulas financieras base.

import type { CoberturaFresh } from "./proyeccion";
import type { Cobertura } from "@/components/nuvex/intervinientes";
import { parseCurrency, parseDecimal } from "./format";

export const FRESH_DEFAULT_TOTAL = 84;

export type FreshTipoBeneficio =
  | "FRECH"
  | "FRESH"
  | "VIS"
  | "MI_CASA_YA"
  | "SUBSIDIO_TASA"
  | "OTRO";

export const FRESH_TIPOS: { value: FreshTipoBeneficio; label: string }[] = [
  { value: "FRECH", label: "FRECH" },
  { value: "FRESH", label: "Tasa Fresh" },
  { value: "VIS", label: "Cobertura VIS" },
  { value: "MI_CASA_YA", label: "Mi Casa Ya" },
  { value: "SUBSIDIO_TASA", label: "Subsidio a la tasa" },
  { value: "OTRO", label: "Otro / sin clasificar" },
];

export function normalizeTipoBeneficio(raw?: string | null): FreshTipoBeneficio {
  if (!raw) return "OTRO";
  const s = String(raw).toLowerCase();
  if (s.includes("frech")) return "FRECH";
  if (s.includes("fresh")) return "FRESH";
  if (s.includes("mi casa")) return "MI_CASA_YA";
  if (s.includes("vis")) return "VIS";
  if (s.includes("subsidio") || s.includes("cobertura")) return "SUBSIDIO_TASA";
  return "OTRO";
}

export interface FreshDerivados {
  cuotasPagadas: number;
  cuotasPendientes: number;
  beneficioRecibido: number;
  beneficioRestante: number;
}

/**
 * Calcula los derivados Fresh aplicando el tope duro de 84 cuotas.
 *
 * Reglas:
 *   - cuotas pagadas Fresh = MIN(cuotas pagadas del crédito, total Fresh)
 *   - cuotas pendientes Fresh = MAX(total Fresh - cuotas pagadas Fresh, 0)
 *   - beneficio recibido = valor mensual × cuotas pagadas Fresh
 *   - beneficio restante = valor mensual × cuotas pendientes Fresh
 */
export function computeFreshDerivados(
  fresh: Partial<CoberturaFresh>,
  cuotasPagadasCreditoOverride?: number,
): FreshDerivados {
  const total = Math.max(0, Math.round(Number(fresh.cuotasTotales ?? FRESH_DEFAULT_TOTAL)));
  const cuotasPagadasInput = Number(
    cuotasPagadasCreditoOverride !== undefined
      ? cuotasPagadasCreditoOverride
      : (fresh.cuotasPagadas ?? 0),
  );
  const cuotasPagadas = Math.min(Math.max(0, Math.round(cuotasPagadasInput)), total);
  const cuotasPendientes = Math.max(0, total - cuotasPagadas);
  const valorMensual = Math.max(0, Number(fresh.valorMensual ?? 0));
  return {
    cuotasPagadas,
    cuotasPendientes,
    beneficioRecibido: valorMensual * cuotasPagadas,
    beneficioRestante: valorMensual * cuotasPendientes,
  };
}

/** Aplica `computeFreshDerivados` y devuelve un `CoberturaFresh` consistente. */
export function withFreshDerivados(
  fresh: Partial<CoberturaFresh>,
  cuotasPagadasCredito?: number,
): CoberturaFresh {
  const total = Math.max(0, Math.round(Number(fresh.cuotasTotales ?? FRESH_DEFAULT_TOTAL)));
  const d = computeFreshDerivados(fresh, cuotasPagadasCredito);
  return {
    activo: !!fresh.activo,
    tipoBeneficio: normalizeTipoBeneficio(fresh.tipoBeneficio),
    valorMensual: Math.max(0, Number(fresh.valorMensual ?? 0)),
    tasa: Math.max(0, Number(fresh.tasa ?? 0)),
    cuotasTotales: total,
    cuotasPagadas: d.cuotasPagadas,
    cuotasPendientes: d.cuotasPendientes,
    beneficioRecibido: d.beneficioRecibido,
    beneficioRestante: d.beneficioRestante,
    detectadoOCR: !!fresh.detectadoOCR,
    fuente: fresh.fuente ?? "manual",
    ultimaSincronizacion: fresh.ultimaSincronizacion ?? null,
  };
}

/**
 * Construye un `CoberturaFresh` a partir del módulo `Cobertura` (intervinientes)
 * que llena el OCR. Usado por simuladores y proyección para mantener una
 * sola fuente de verdad.
 */
export function freshFromCobertura(
  cobertura: Cobertura | undefined | null,
  opts: {
    cuotasPagadasCredito?: number;
    saldoCapital?: number;
    fuente?: CoberturaFresh["fuente"];
    detectadoOCR?: boolean;
  } = {},
): CoberturaFresh {
  if (!cobertura || (!cobertura.activo && !cobertura.valorCobertura && !cobertura.tasaCobertura)) {
    return withFreshDerivados(
      { activo: false, cuotasTotales: FRESH_DEFAULT_TOTAL },
      opts.cuotasPagadasCredito,
    );
  }

  const valorCobertura = parseCurrency(cobertura.valorCobertura ?? "");
  const tasaCobPct = parseDecimal(cobertura.tasaCobertura ?? "");

  // Si el OCR no trae el valor mensual, lo derivamos como saldo × tasa_cobertura_mensual.
  let valorMensual = valorCobertura;
  if (valorMensual <= 0 && opts.saldoCapital && opts.saldoCapital > 0 && tasaCobPct > 0) {
    const tasaMensualCob = Math.pow(1 + tasaCobPct / 100, 1 / 12) - 1;
    valorMensual = Math.round(opts.saldoCapital * tasaMensualCob);
  }

  return withFreshDerivados(
    {
      activo: true,
      tipoBeneficio: normalizeTipoBeneficio(cobertura.tipoBeneficio),
      valorMensual,
      tasa: tasaCobPct,
      cuotasTotales: FRESH_DEFAULT_TOTAL,
      detectadoOCR: opts.detectadoOCR ?? true,
      fuente: opts.fuente ?? "ocr",
      ultimaSincronizacion: new Date().toISOString(),
    },
    opts.cuotasPagadasCredito,
  );
}

/** Verifica completitud para guardar (Regla 8). */
export function freshIncompleto(fresh: CoberturaFresh): { ok: boolean; faltantes: string[] } {
  if (!fresh.activo) return { ok: true, faltantes: [] };
  const faltantes: string[] = [];
  if (!(fresh.valorMensual > 0)) faltantes.push("Valor Fresh mensual");
  if (!(fresh.cuotasTotales > 0)) faltantes.push("Cuotas Fresh totales");
  if (fresh.cuotasPagadas < 0 || fresh.cuotasPendientes < 0)
    faltantes.push("Cuotas Fresh pagadas / pendientes");
  return { ok: faltantes.length === 0, faltantes };
}
