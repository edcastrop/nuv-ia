// ─────────────────────────────────────────────────────────────
// Reconstructor Financiero NUVIA · Auditoría determinista
//
// Sin IA generativa: la clasificación se deriva de reglas explícitas
// sobre las diferencias absolutas/relativas y sobre la disponibilidad
// de datos.
// ─────────────────────────────────────────────────────────────

import {
  INCONSISTENCIA_CRITICA_PCT,
  TOL_CUOTA_PCT,
  TOL_SALDO_PCT,
  TOL_UVR_PCT,
} from "./tolerancias";
import type {
  AuditoriaResult,
  CuotaNormalizada,
  DiagnosticoAuditoria,
  Moneda,
  Observacion,
  Resultado,
  TipoCredito,
  UvrDiagnostico,
} from "./types";

export interface AuditarInput {
  moneda: Moneda;
  tipoCredito: TipoCredito;
  cuotaNorm: CuotaNormalizada;
  tem: Resultado;
  saldoReconstruido: Resultado;
  diferenciaSaldoPct: number | null;
  diferenciaCuotaPct: number | null;
  uvr: UvrDiagnostico | null;
  datosFaltantes: string[];
  plazoReportado: number | null;
  plazoMatematico: number | null;
  abonoExtraordinario: boolean;
}

export function auditar(input: AuditarInput): AuditoriaResult {
  const observaciones: Observacion[] = [];
  const criterios: string[] = [];

  // Datos suficientes
  const puedeReconstruir =
    input.tem.valor !== null && input.saldoReconstruido.valor !== null;
  criterios.push("Datos mínimos para reconstruir tasa y saldo");

  if (!puedeReconstruir || input.datosFaltantes.length >= 3) {
    observaciones.push({
      codigo: "DATOS_INSUFICIENTES",
      severidad: "aviso",
      mensaje: `Faltan datos críticos: ${input.datosFaltantes.join(", ") || "no se pudo reconstruir tasa/saldo"}.`,
    });
    return {
      diagnostico: "INFORMACION_INSUFICIENTE",
      observaciones,
      criteriosEvaluados: criterios,
    };
  }

  let critico = false;
  let moderado = false;

  // Cuota financiera
  if (input.diferenciaCuotaPct !== null) {
    criterios.push("Diferencia cuota financiera reportada vs reconstruida");
    const abs = Math.abs(input.diferenciaCuotaPct);
    if (abs > INCONSISTENCIA_CRITICA_PCT) {
      critico = true;
      observaciones.push({
        codigo: "CUOTA_CRITICA",
        severidad: "critico",
        mensaje: `La cuota financiera reconstruida difiere ${(abs * 100).toFixed(2)} % de la reportada.`,
      });
    } else if (abs > TOL_CUOTA_PCT) {
      moderado = true;
      observaciones.push({
        codigo: "CUOTA_MODERADA",
        severidad: "aviso",
        mensaje: `Diferencia moderada en cuota financiera (${(abs * 100).toFixed(2)} %).`,
      });
    }
  }

  // Saldo
  if (input.diferenciaSaldoPct !== null) {
    criterios.push("Diferencia saldo reportado vs reconstruido");
    const abs = Math.abs(input.diferenciaSaldoPct);
    if (abs > INCONSISTENCIA_CRITICA_PCT) {
      critico = true;
      observaciones.push({
        codigo: "SALDO_CRITICO",
        severidad: "critico",
        mensaje: `Saldo reconstruido difiere ${(abs * 100).toFixed(2)} % del reportado.`,
      });
    } else if (abs > TOL_SALDO_PCT) {
      moderado = true;
      observaciones.push({
        codigo: "SALDO_MODERADO",
        severidad: "aviso",
        mensaje: `Diferencia moderada en saldo (${(abs * 100).toFixed(2)} %).`,
      });
    }
  }

  // UVR
  if (input.uvr) {
    criterios.push("Coherencia UVR (saldoUVR × valorUVR ≈ saldoPesos)");
    if (input.uvr.diferenciaPct !== null) {
      const abs = Math.abs(input.uvr.diferenciaPct);
      if (abs > INCONSISTENCIA_CRITICA_PCT) {
        critico = true;
        observaciones.push({
          codigo: "UVR_CRITICO",
          severidad: "critico",
          mensaje: `Producto UVR × valorUVR difiere ${(abs * 100).toFixed(2)} % del saldo en pesos.`,
        });
      } else if (abs > TOL_UVR_PCT) {
        moderado = true;
        observaciones.push({
          codigo: "UVR_MODERADO",
          severidad: "aviso",
          mensaje: `Diferencia moderada en producto UVR (${(abs * 100).toFixed(2)} %).`,
        });
      }
    }
  }

  // Plazo reportado vs matemático (indicativo)
  if (input.plazoReportado !== null && input.plazoMatematico !== null) {
    criterios.push("Plazo reportado vs matemático");
    const diff = Math.abs(input.plazoReportado - input.plazoMatematico);
    if (diff >= 3) {
      moderado = true;
      observaciones.push({
        codigo: "PLAZO_DIVERGE",
        severidad: "aviso",
        mensaje: `Plazo reportado (${input.plazoReportado}) difiere ${diff.toFixed(1)} cuotas del matemático (${input.plazoMatematico.toFixed(2)}).`,
      });
    }
  }

  if (input.abonoExtraordinario) {
    observaciones.push({
      codigo: "ABONO_EXTRAORDINARIO",
      severidad: "info",
      mensaje:
        "Se declaró un abono extraordinario reciente; la reconstrucción podría verse afectada.",
    });
  }

  if (input.cuotaNorm.alertas.length) {
    for (const a of input.cuotaNorm.alertas) {
      observaciones.push({ codigo: "CUOTA_ALERTA", severidad: "info", mensaje: a });
    }
  }

  let diagnostico: DiagnosticoAuditoria;
  if (critico) diagnostico = "INCONSISTENCIA_CRITICA";
  else if (moderado) diagnostico = "INCONSISTENCIA_MODERADA";
  else if (observaciones.length > 0) diagnostico = "COHERENTE_CON_OBSERVACIONES";
  else diagnostico = "CREDITO_COHERENTE";

  return { diagnostico, observaciones, criteriosEvaluados: criterios };
}
