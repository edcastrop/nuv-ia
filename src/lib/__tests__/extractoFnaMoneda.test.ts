import { describe, it, expect } from "vitest";
import { classifyFnaMoneda } from "@/lib/extracto.functions";

// Contrato actual (FNA):
// - `saldoUVR > 0` (finito) es la ÚNICA evidencia de crédito UVR.
// - `valorUVR` es la Cotización UVR informativa del día: NO clasifica por
//   sí sola, aunque venga con valor positivo.

describe("classifyFnaMoneda", () => {
  it("1. saldoUVR=0 y valorUVR=0 → PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
    expect(r.producto).toBe("Crédito Hipotecario FNA en pesos");
  });

  it("2. REGRESIÓN FNA PDF real: saldoUVR=0 y valorUVR=1.0000 (Cotización UVR) → PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 1.0 });
    expect(r.moneda).toBe("PESOS");
    expect(r.producto).toBe("Crédito Hipotecario FNA en pesos");
  });

  it("3. saldoUVR=0 y valorUVR=340.12 (cotización UVR normal) → PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 340.12 });
    expect(r.moneda).toBe("PESOS");
  });

  it("4. saldoUVR>0 y valorUVR=0 → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345.67, valorUVR: 0 });
    expect(r.moneda).toBe("UVR");
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });

  it("5. saldoUVR>0 y valorUVR>0 → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345.67, valorUVR: 340.12 });
    expect(r.moneda).toBe("UVR");
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });

  it("6. saldoUVR=NaN con valorUVR>0 → PESOS (valorUVR no clasifica)", () => {
    const r = classifyFnaMoneda({ saldoUVR: Number.NaN, valorUVR: 340 });
    expect(r.moneda).toBe("PESOS");
  });

  it("7a. saldoUVR=+Infinity con valorUVR>0 → PESOS", () => {
    const r = classifyFnaMoneda({
      saldoUVR: Number.POSITIVE_INFINITY,
      valorUVR: 340,
    });
    expect(r.moneda).toBe("PESOS");
  });

  it("7b. saldoUVR=-Infinity con valorUVR>0 → PESOS", () => {
    const r = classifyFnaMoneda({
      saldoUVR: Number.NEGATIVE_INFINITY,
      valorUVR: 340,
    });
    expect(r.moneda).toBe("PESOS");
  });

  it("8. saldoUVR negativo con valorUVR>0 → PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: -100, valorUVR: 340 });
    expect(r.moneda).toBe("PESOS");
  });

  it("9a. saldoUVR válido positivo con valorUVR=NaN → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345, valorUVR: Number.NaN });
    expect(r.moneda).toBe("UVR");
  });

  it("9b. saldoUVR válido positivo con valorUVR=Infinity → UVR", () => {
    const r = classifyFnaMoneda({
      saldoUVR: 12345,
      valorUVR: Number.POSITIVE_INFINITY,
    });
    expect(r.moneda).toBe("UVR");
  });

  it("9c. saldoUVR válido positivo con valorUVR negativo → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345, valorUVR: -5 });
    expect(r.moneda).toBe("UVR");
  });

  it("10. producto exacto para PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 0 });
    expect(r.producto).toBe("Crédito Hipotecario FNA en pesos");
  });

  it("11. producto exacto para UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 1, valorUVR: 0 });
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });

  it("12. saldoUVR muy pequeño positivo (0.0001) → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0.0001, valorUVR: 0 });
    expect(r.moneda).toBe("UVR");
  });
});
