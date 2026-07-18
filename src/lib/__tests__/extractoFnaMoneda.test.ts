import { describe, it, expect } from "vitest";
import { classifyFnaMoneda } from "@/lib/extracto.functions";

describe("classifyFnaMoneda", () => {
  it("1. saldoUVR=0 y valorUVR=0 → PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
    expect(r.producto).toBe("Crédito Hipotecario FNA en pesos");
  });

  it("2. sin evidencia numérica (proxy de texto UVR previo) → PESOS", () => {
    // rawMoneda/rawProducto ya no participan en la firma. Sin números > 0
    // la clasificación debe caer a PESOS aunque el LLM hubiera dicho "UVR".
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
  });

  it("3. saldoUVR > 0 → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345.67, valorUVR: 0 });
    expect(r.moneda).toBe("UVR");
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });

  it("4. valorUVR > 0 → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 340.12 });
    expect(r.moneda).toBe("UVR");
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });

  it("5. saldoUVR = NaN → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: Number.NaN, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
  });

  it("6. valorUVR = NaN → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: Number.NaN });
    expect(r.moneda).toBe("PESOS");
  });

  it("7. saldoUVR = Infinity → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: Number.POSITIVE_INFINITY, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
  });

  it("7b. saldoUVR = -Infinity → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: Number.NEGATIVE_INFINITY, valorUVR: 0 });
    expect(r.moneda).toBe("PESOS");
  });

  it("8. valorUVR = Infinity → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: Number.POSITIVE_INFINITY });
    expect(r.moneda).toBe("PESOS");
  });

  it("8b. valorUVR = -Infinity → no cuenta", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: Number.NEGATIVE_INFINITY });
    expect(r.moneda).toBe("PESOS");
  });

  it("9. valores negativos → no cuentan", () => {
    const r1 = classifyFnaMoneda({ saldoUVR: -100, valorUVR: -1 });
    expect(r1.moneda).toBe("PESOS");
    const r2 = classifyFnaMoneda({ saldoUVR: -0.0001, valorUVR: 0 });
    expect(r2.moneda).toBe("PESOS");
  });

  it("10a. saldoUVR inválido (NaN) + valorUVR válido positivo → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: Number.NaN, valorUVR: 340 });
    expect(r.moneda).toBe("UVR");
  });

  it("10b. saldoUVR válido positivo + valorUVR inválido (Infinity) → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345, valorUVR: Number.POSITIVE_INFINITY });
    expect(r.moneda).toBe("UVR");
  });

  it("10c. valorUVR negativo + saldoUVR positivo → UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 12345, valorUVR: -5 });
    expect(r.moneda).toBe("UVR");
  });

  it("11. producto exacto para PESOS", () => {
    const r = classifyFnaMoneda({ saldoUVR: 0, valorUVR: 0 });
    expect(r.producto).toBe("Crédito Hipotecario FNA en pesos");
  });

  it("12. producto exacto para UVR", () => {
    const r = classifyFnaMoneda({ saldoUVR: 1, valorUVR: 0 });
    expect(r.producto).toBe("Crédito Hipotecario FNA en UVR");
  });
});
