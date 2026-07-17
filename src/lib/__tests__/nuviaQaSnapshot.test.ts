import { describe, it, expect } from "vitest";
import {
  buildPesosQaSnapshot,
  buildUvrQaSnapshot,
  hashQaSnapshot,
  type PesosSnapshotInput,
  type UvrSnapshotInput,
} from "@/lib/nuviaQaSnapshot";

const basePesos = (overrides: Partial<PesosSnapshotInput> = {}): PesosSnapshotInput => ({
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
  archivoPath: "path/A.pdf",
  archivoNombre: "A.pdf",
  ...overrides,
});

const baseUvr = (overrides: Partial<UvrSnapshotInput> = {}): UvrSnapshotInput => ({
  banco: "Davivienda",
  producto: "Hipotecario UVR",
  saldoUVR: 250_000,
  valorUVR: 400,
  cuotaActualPesos: 1_800_000,
  seguros: 60_000,
  teaCobrada: 0.1198,
  variacionUVR: 0.065,
  variacionUVRPropuestas: 0.055,
  plazoInicial: 180,
  cuotasPagadas: 30,
  cuotasPendientes: 150,
  ...overrides,
});

describe("buildPesosQaSnapshot", () => {
  it("genera un snapshot normalizado con moneda=COP y tipoCredito=pesos", () => {
    const s = buildPesosQaSnapshot(basePesos());
    expect(s.moneda).toBe("COP");
    expect(s.tipoCredito).toBe("pesos");
    expect(s.datos).toBeDefined();
    expect((s.datos as Record<string, unknown>).saldoCapital).toBe(120_000_000);
    expect((s.datos as Record<string, unknown>).tasaEA).toBe(0.1523);
  });
});

describe("buildUvrQaSnapshot", () => {
  it("emite modalidad=uvr y moneda=UVR explícitas", () => {
    const s = buildUvrQaSnapshot(baseUvr());
    const d = s.datos as Record<string, unknown>;
    expect(s.moneda).toBe("UVR");
    expect(s.tipoCredito).toBe("uvr");
    expect(d.modalidad).toBe("uvr");
    expect(d.moneda).toBe("UVR");
    expect(d.saldoUVR).toBe(250_000);
    expect(d.valorUVR).toBe(400);
  });
});

describe("hashQaSnapshot — identidad canónica", () => {
  it("dos snapshots equivalentes producen el mismo hash", () => {
    const a = buildPesosQaSnapshot(basePesos());
    const b = buildPesosQaSnapshot(basePesos());
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("archivoPath / archivoNombre no cambian el hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ archivoPath: "x.pdf", archivoNombre: "x" }));
    const b = buildPesosQaSnapshot(basePesos({ archivoPath: "y.pdf", archivoNombre: "y" }));
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("un cambio financiero real modifica el hash", () => {
    const a = buildPesosQaSnapshot(basePesos());
    const b = buildPesosQaSnapshot(basePesos({ saldoCapital: 121_000_000 }));
    expect(hashQaSnapshot(a)).not.toBe(hashQaSnapshot(b));
  });

  it("cambios en TEA modifican el hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ tea: 0.15 }));
    const b = buildPesosQaSnapshot(basePesos({ tea: 0.1501 }));
    expect(hashQaSnapshot(a)).not.toBe(hashQaSnapshot(b));
  });

  it("UVR y Pesos con mismos números producen hashes distintos (modalidad separa)", () => {
    const p = buildPesosQaSnapshot(basePesos());
    const u = buildUvrQaSnapshot(baseUvr());
    expect(hashQaSnapshot(p)).not.toBe(hashQaSnapshot(u));
  });

  it("string numérico y number equivalente producen el mismo hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ plazoInicial: 240 }));
    const b = buildPesosQaSnapshot(basePesos({ plazoInicial: "240" }));
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("snapshot nulo produce hash vacío", () => {
    expect(hashQaSnapshot(null)).toBe("");
  });
});
