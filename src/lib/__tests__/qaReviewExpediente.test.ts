import { describe, it, expect } from "vitest";
import { escenariosFromAudit } from "@/lib/qaReviewExpediente";
import {
  buildPesosQaSnapshot,
  buildUvrQaSnapshot,
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

const uvrInput = {
  banco: "Davivienda",
  producto: "Hipotecario UVR",
  saldoUVR: 250_000,
  valorUVR: 400,
  cuotaActualPesos: 1_800_000,
  seguros: 60_000,
  teaCobrada: 0.1198,
  variacionUVR: 0.06,
  plazoInicial: 180,
  cuotasPagadas: 30,
  cuotasPendientes: 150,
};

const pesosInput = {
  banco: "Bancolombia",
  producto: "Hipotecario Pesos",
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
};

describe("escenariosFromAudit · contrato v2 vs legacy", () => {
  it("snapshot UVR v2 con 4 escenarios → origen historico_persistido", () => {
    const snap = buildUvrQaSnapshot({ ...uvrInput, escenarios: mkEscenarios(4) });
    const r = escenariosFromAudit(
      { simulador_snapshot: snap, modalidad: "uvr" },
      { modalidad: "uvr" },
    );
    expect(r.origen).toBe("historico_persistido");
    expect(r.escenarios.length).toBe(4);
  });

  it("snapshot Pesos v2 con 4 escenarios → origen historico_persistido", () => {
    const snap = buildPesosQaSnapshot({ ...pesosInput, escenarios: mkEscenarios(4) });
    const r = escenariosFromAudit(
      { simulador_snapshot: snap, modalidad: "pesos" },
      { modalidad: "pesos" },
    );
    expect(r.origen).toBe("historico_persistido");
    expect(r.escenarios.length).toBe(4);
  });

  it("snapshot UVR legacy (sin escenarios) → puede reconstruir con motor UVR", () => {
    const snap = buildUvrQaSnapshot(uvrInput);
    const r = escenariosFromAudit(
      { simulador_snapshot: snap, modalidad: "uvr" },
      { modalidad: "uvr" },
    );
    // reconstruido_legacy si el motor puede; de lo contrario null. Nunca "inventa".
    expect(["reconstruido_legacy", null]).toContain(r.origen);
  });

  it("snapshot Pesos legacy NO invoca el reconstructor UVR", () => {
    const snap = buildPesosQaSnapshot(pesosInput);
    const r = escenariosFromAudit(
      { simulador_snapshot: snap, modalidad: "pesos" },
      { modalidad: "pesos" },
    );
    expect(r.origen).toBe(null);
    expect(r.escenarios.length).toBe(0);
    expect(String(r.reason ?? "")).toMatch(/Pesos/i);
  });

  it("snapshot Pesos legacy sin escenarios → razón específica, sin escenarios inventados", () => {
    const snap = buildPesosQaSnapshot(pesosInput);
    const r = escenariosFromAudit(
      { simulador_snapshot: snap, modalidad: "pesos" },
      { modalidad: "pesos" },
    );
    expect(r.escenarios).toEqual([]);
    expect(r.reason).toBeTruthy();
  });
});
