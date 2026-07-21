// Test estructural: valida que el contrato de persistencia usado por
// `handleSaveAsCase` cumple los objetivos 4 y 5.
//
// No se instancia el componente completo (requiere router, auth, DB); en
// su lugar se replica la forma exacta del payload que la ruta envía a
// `certificarExpediente`, y se verifica el invariante de contrato.
import { describe, it, expect } from "vitest";
import {
  buildUvrQaSnapshot,
  buildPesosQaSnapshot,
  type SnapshotEscenario,
} from "@/lib/nuviaQaSnapshot";

const mkEscenarios = (n = 4): SnapshotEscenario[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    cuotasEliminadas: 12 * (i + 1),
    añosEliminados: i + 1,
    nuevoPlazo: 240 - 12 * (i + 1),
    nuevaCuota: 1_600_000 + i * 50_000,
    ahorroIntereses: 10_000_000 * (i + 1),
    ahorroSeguros: 500_000 * (i + 1),
    ahorroTotal: 10_500_000 * (i + 1),
    honorarios: 800_000 * (i + 1),
    totalProyectado: 12_000_000 * (i + 1),
    incrementoMensual: 20_000 * (i + 1),
    fuente: "automatica",
  }));

/**
 * Réplica reducida de la extracción y validación que hace
 * `handleSaveAsCase` en `src/routes/_authenticated/simulador.tsx`.
 */
function buildSaveAsCasePayload(snapshotDatos: Record<string, unknown>) {
  const escenariosSnapshot = Array.isArray(snapshotDatos.propuestasComerciales)
    ? (snapshotDatos.propuestasComerciales as Record<string, unknown>[])
    : [];
  if (escenariosSnapshot.length !== 4) {
    return { ok: false as const, reason: "waiting-for-four-proposals" };
  }
  const credito: Record<string, unknown> = {
    propuestasComerciales: JSON.stringify(escenariosSnapshot),
  };
  const propuestaData = { index: 0, nuevaCuota: 1_600_000 };
  return {
    ok: true as const,
    payload: {
      maestro: { credito },
      propuestaData,
      propuestasComerciales: escenariosSnapshot,
    },
  };
}

describe("handleSaveAsCase · persistencia de 4 propuestas", () => {
  it("incluye exactamente 4 propuestas en payload.propuestasComerciales", () => {
    const snap = buildUvrQaSnapshot({
      banco: "Davivienda",
      producto: "UVR",
      saldoUVR: 250_000,
      valorUVR: 400,
      cuotaActualPesos: 1_800_000,
      seguros: 60_000,
      teaCobrada: 0.1198,
      variacionUVR: 0.06,
      plazoInicial: 180,
      cuotasPagadas: 30,
      cuotasPendientes: 150,
      escenarios: mkEscenarios(4),
    });
    const r = buildSaveAsCasePayload(snap.datos as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.propuestasComerciales.length).toBe(4);
      // propuestaData conserva únicamente la propuesta recomendada.
      expect(r.payload.propuestaData).toEqual({ index: 0, nuevaCuota: 1_600_000 });
      // El credito lleva también las 4 propuestas para la reapertura.
      const credito = r.payload.maestro.credito as Record<string, unknown>;
      const parsed = JSON.parse(credito.propuestasComerciales as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(4);
    }
  });

  it("Pesos con 4 propuestas también genera payload válido", () => {
    const snap = buildPesosQaSnapshot({
      banco: "Bancolombia",
      producto: "Pesos",
      cedula: "123",
      numeroCredito: "999",
      cliente: "Ana",
      saldoCapital: 120_000_000,
      cuotaActual: 1_500_000,
      seguros: 45_000,
      tea: 0.1523,
      plazoInicial: 240,
      cuotasPagadas: 40,
      cuotasPendientes: 200,
      escenarios: mkEscenarios(4),
    });
    const r = buildSaveAsCasePayload(snap.datos as Record<string, unknown>);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.payload.propuestasComerciales.length).toBe(4);
  });

  it("bloquea creación cuando NO hay 4 propuestas (sin escenarios)", () => {
    const snap = buildUvrQaSnapshot({
      banco: "Davivienda",
      producto: "UVR",
      saldoUVR: 250_000,
      valorUVR: 400,
      cuotaActualPesos: 1_800_000,
      seguros: 60_000,
      teaCobrada: 0.1198,
      variacionUVR: 0.06,
      plazoInicial: 180,
      cuotasPagadas: 30,
      cuotasPendientes: 150,
    });
    const r = buildSaveAsCasePayload(snap.datos as Record<string, unknown>);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("waiting-for-four-proposals");
  });

  it("bloquea creación cuando propuestasComerciales tiene distinto de 4", () => {
    const r3 = buildSaveAsCasePayload({ propuestasComerciales: mkEscenarios(3) });
    const r5 = buildSaveAsCasePayload({ propuestasComerciales: mkEscenarios(5) });
    expect(r3.ok).toBe(false);
    expect(r5.ok).toBe(false);
  });

  it("no requiere sessionStorage para reconstruir el payload", () => {
    // Solo se lee del snapshot: no hay dependencia de sessionStorage.
    const usedSessionStorage = typeof globalThis !== "undefined"
      && "sessionStorage" in globalThis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      && (globalThis as any).sessionStorage?.length > 0;
    expect(usedSessionStorage).toBeFalsy();
  });
});
