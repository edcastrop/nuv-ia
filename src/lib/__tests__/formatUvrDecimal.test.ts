import { describe, it, expect } from "vitest";
import { parseDecimal } from "@/lib/format";

// Regresión: extracto Bancolombia UVR (crédito 90000180359).
// "1342298.376" y "416.491" se interpretaban como separador de miles
// (1.342.298.376 / 416.491), disparando el falso error
// "Saldo en pesos, Saldo UVR y Valor UVR no coinciden".
describe("parseDecimal · valores UVR con 3 decimales", () => {
  it("no trata el punto como miles cuando la parte entera tiene más de 3 dígitos", () => {
    expect(parseDecimal("1342298.376")).toBeCloseTo(1342298.376, 4);
    expect(parseDecimal("416.491")).toBeCloseTo(416.491, 4);
    expect(parseDecimal("1342298,376")).toBeCloseTo(1342298.376, 4);
  });

  it("conserva el comportamiento de miles cuando el formato es válido", () => {
    expect(parseDecimal("1.342.298")).toBe(1342298);
    expect(parseDecimal("342.298")).toBe(342298);
    expect(parseDecimal("1,342,298")).toBe(1342298);
  });

  it("coherencia UVR queda dentro del 1 %", () => {
    const saldoUVR = parseDecimal("1342298.376");
    const valorUVR = parseDecimal("416.491");
    const saldoPesos = 559410368.27;
    expect(Math.abs(saldoUVR * valorUVR - saldoPesos) / saldoPesos).toBeLessThan(0.01);
  });
});
