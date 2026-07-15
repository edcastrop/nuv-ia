import { describe, expect, it } from "vitest";
import {
  UVR_COHERENCE_TOLERANCE_PCT,
  parseUVRNumber,
  parseUVRNumberCandidates,
  resolveUVRByCoherence,
  validateUVRCoherence,
} from "@/lib/uvrNumber";
import { parseMontoExtracto } from "@/lib/cuotaBase";

describe("parseUVRNumber — formatos inequívocos", () => {
  it("acepta '385,4321' como 385.4321 (decimal UVR)", () => {
    expect(parseUVRNumber("385,4321")).toBeCloseTo(385.4321, 10);
  });
  it("acepta '123.456,7890' como 123456.7890", () => {
    expect(parseUVRNumber("123.456,7890")).toBeCloseTo(123456.789, 10);
  });
  it("acepta '1.234.567' como 1234567 (miles obligatorios)", () => {
    expect(parseUVRNumber("1.234.567")).toBe(1234567);
  });
  it("acepta '385.4321' como 385.4321 (punto decimal, no 3 dígitos)", () => {
    expect(parseUVRNumber("385.4321")).toBeCloseTo(385.4321, 10);
  });
  it("acepta '1234' entero", () => {
    expect(parseUVRNumber("1234")).toBe(1234);
  });
  it("acepta números finitos positivos directos", () => {
    expect(parseUVRNumber(385.4321)).toBeCloseTo(385.4321, 10);
    expect(parseUVRNumber(0)).toBe(0);
  });
  it("limpia $, NBSP y espacios", () => {
    expect(parseUVRNumber("$ 1.234.567")).toBe(1234567);
    expect(parseUVRNumber("\u00a0385,4321\u00a0")).toBeCloseTo(385.4321, 10);
  });
});

describe("parseUVRNumber — ambigüedades NO se adivinan", () => {
  it("'123.456' es ambiguo → undefined", () => {
    expect(parseUVRNumber("123.456")).toBeUndefined();
    const cands = parseUVRNumberCandidates("123.456");
    expect(cands).toHaveLength(2);
    expect(cands).toContain(123.456);
    expect(cands).toContain(123456);
  });
  it("'123,456' es ambiguo → undefined", () => {
    expect(parseUVRNumber("123,456")).toBeUndefined();
    const cands = parseUVRNumberCandidates("123,456");
    expect(cands).toHaveLength(2);
  });
});

describe("parseUVRNumber — entradas inválidas", () => {
  const rechazos = [
    "-100",
    "1..2",
    "1,,2",
    "1.,2",
    ".",
    ",",
    "12.34.56", // segundo grupo con 2 dígitos
    "1.2.3.4", // grupos internos con 1 dígito
    "12345.67.890", // primer grupo 5 dígitos y luego mezcla
    "abc",
    "12a34",
    "",
    "   ",
  ];
  for (const r of rechazos) {
    it(`rechaza ${JSON.stringify(r)}`, () => {
      expect(parseUVRNumber(r)).toBeUndefined();
    });
  }
  it("rechaza NaN, Infinity, negativos y no-strings", () => {
    expect(parseUVRNumber(NaN)).toBeUndefined();
    expect(parseUVRNumber(Infinity)).toBeUndefined();
    expect(parseUVRNumber(-Infinity)).toBeUndefined();
    expect(parseUVRNumber(-1)).toBeUndefined();
    expect(parseUVRNumber(null)).toBeUndefined();
    expect(parseUVRNumber(undefined)).toBeUndefined();
    expect(parseUVRNumber({} as unknown)).toBeUndefined();
  });
});

describe("validateUVRCoherence", () => {
  it("marca ejecutable=false si falta cualquier valor", () => {
    expect(validateUVRCoherence(undefined, 385.4321, 38543210).ejecutable).toBe(false);
    expect(validateUVRCoherence(100000, undefined, 38543210).ejecutable).toBe(false);
    expect(validateUVRCoherence(100000, 385.4321, undefined).ejecutable).toBe(false);
    expect(validateUVRCoherence(0, 385.4321, 38543210).ejecutable).toBe(false);
    expect(validateUVRCoherence(100000, 0, 38543210).ejecutable).toBe(false);
    expect(validateUVRCoherence(100000, 385.4321, 0).ejecutable).toBe(false);
  });
  it("100000 × 385.4321 = 38543210 → coherente (≤1%)", () => {
    const r = validateUVRCoherence(100000, 385.4321, 38543210);
    expect(r.ejecutable).toBe(true);
    expect(r.isCoherent).toBe(true);
  });
  it("diferencia >1% → NO coherente", () => {
    const producto = 100000 * 385.4321; // 38543210
    const saldoPesos = producto * 1.02; // 2% de diferencia
    const r = validateUVRCoherence(100000, 385.4321, saldoPesos);
    expect(r.ejecutable).toBe(true);
    expect(r.isCoherent).toBe(false);
    expect(r.diffPct).toBeGreaterThan(UVR_COHERENCE_TOLERANCE_PCT);
  });
});

describe("resolveUVRByCoherence", () => {
  it("resuelve cuando exactamente una combinación es coherente", () => {
    // saldoUVR ambiguo "123.456" → [123.456, 123456]
    // valorUVR "312,7500" → [312.75]
    // saldoPesos 123456 × 312.75 ≈ 38 500 668
    const r = resolveUVRByCoherence({
      saldoUVRCandidates: [123.456, 123456],
      valorUVRCandidates: [312.75],
      saldoPesos: 123456 * 312.75,
    });
    expect(r.resolved).toBe(true);
    expect(r.saldoUVR).toBe(123456);
    expect(r.valorUVR).toBe(312.75);
  });
  it("no resuelve si ninguna combinación es coherente", () => {
    const r = resolveUVRByCoherence({
      saldoUVRCandidates: [123.456, 123456],
      valorUVRCandidates: [312.75],
      saldoPesos: 99_999_999_999,
    });
    expect(r.resolved).toBe(false);
    expect(r.multipleCoherent).toBe(false);
  });
  it("no resuelve si múltiples combinaciones son coherentes", () => {
    // saldoPesos escogido para que ambas variantes caigan en tolerancia
    // simulando cifras redundantes.
    const r = resolveUVRByCoherence({
      saldoUVRCandidates: [1000, 1000], // ambos iguales pero simulan candidatos
      valorUVRCandidates: [100, 100.5],
      saldoPesos: 100250, // ~1000×100 y ~1000×100.25 → margen
    });
    // en este caso ambos productos difieren <1% del saldoPesos → múltiples
    expect(r.resolved).toBe(false);
  });
});

// ─── Regresión: parseMontoExtracto NO fue modificado y sigue tratando la
// coma como separador de miles cuando corresponde (comportamiento pesos).
describe("parseMontoExtracto (pesos) — regresión sin cambios", () => {
  it("'1.234.567' → 1234567", () => {
    expect(parseMontoExtracto("1.234.567")).toBe(1234567);
  });
  it("'$ 12.345.678,90' → 12345678.90", () => {
    expect(parseMontoExtracto("$ 12.345.678,90")).toBeCloseTo(12345678.9, 6);
  });
  it("'90.326.011,99' → 90326011.99", () => {
    expect(parseMontoExtracto("90.326.011,99")).toBeCloseTo(90326011.99, 6);
  });
  it("cadena vacía → 0", () => {
    expect(parseMontoExtracto("")).toBe(0);
    expect(parseMontoExtracto(null)).toBe(0);
    expect(parseMontoExtracto(undefined)).toBe(0);
  });
});
