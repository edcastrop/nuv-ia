import { describe, it, expect } from "vitest";
import { resolveMonedaDetectada } from "@/lib/extractoReaderMoneda";

const base = {
  parsedEsUVR: false,
  tieneDatosUvr: false,
  uvrEnTexto: false,
  sistemaDicePesos: false,
};

describe("resolveMonedaDetectada", () => {
  it("1. FNA con uvrEnTexto y sin datos UVR → pesos", () => {
    expect(
      resolveMonedaDetectada({ ...base, banco: "FNA", uvrEnTexto: true }),
    ).toBe("pesos");
  });

  it("2. FNA con parsedEsUVR y sin datos UVR → pesos", () => {
    expect(
      resolveMonedaDetectada({ ...base, banco: "FNA", parsedEsUVR: true }),
    ).toBe("pesos");
  });

  it("3. Fondo Nacional del Ahorro con uvrEnTexto y sin datos UVR → pesos", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Fondo Nacional del Ahorro",
        uvrEnTexto: true,
      }),
    ).toBe("pesos");
  });

  it("4. fondo nacional del ahorro (minúsculas) sin datos UVR → pesos", () => {
    expect(
      resolveMonedaDetectada({ ...base, banco: "fondo nacional del ahorro" }),
    ).toBe("pesos");
  });

  it("5. FNA con tieneDatosUvr=true → uvr", () => {
    expect(
      resolveMonedaDetectada({ ...base, banco: "FNA", tieneDatosUvr: true }),
    ).toBe("uvr");
  });

  it("6. Fondo Nacional del Ahorro con tieneDatosUvr=true → uvr", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Fondo Nacional del Ahorro",
        tieneDatosUvr: true,
      }),
    ).toBe("uvr");
  });

  it("7. FNA con parsedEsUVR y uvrEnTexto pero sin datos UVR → pesos", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "FNA",
        parsedEsUVR: true,
        uvrEnTexto: true,
        sistemaDicePesos: false,
      }),
    ).toBe("pesos");
  });

  it("8. Banco distinto con uvrEnTexto y sin sistemaDicePesos → uvr", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Bancolombia",
        uvrEnTexto: true,
      }),
    ).toBe("uvr");
  });

  it("9. Banco distinto con parsedEsUVR → uvr", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Davivienda",
        parsedEsUVR: true,
      }),
    ).toBe("uvr");
  });

  it("10. Banco distinto con sistemaDicePesos gana aunque uvrEnTexto=true → pesos", () => {
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "BBVA",
        uvrEnTexto: true,
        sistemaDicePesos: true,
      }),
    ).toBe("pesos");
  });

  it("11. Banco vacío usa la rama general, no la excepción FNA", () => {
    // Sin señales UVR: pesos
    expect(resolveMonedaDetectada({ ...base, banco: "" })).toBe("pesos");
    // Con uvrEnTexto la rama general lo lleva a uvr (no se comporta como FNA)
    expect(
      resolveMonedaDetectada({ ...base, banco: "", uvrEnTexto: true }),
    ).toBe("uvr");
  });

  it("12. Nombres parecidos pero que NO son FNA no caen en la excepción", () => {
    // "Banco Nacional" no matchea FNA → rama general
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Banco Nacional",
        uvrEnTexto: true,
      }),
    ).toBe("uvr");
    // "Fondo de Ahorro Nacional" tampoco (falta la frase completa) → rama general
    expect(
      resolveMonedaDetectada({
        ...base,
        banco: "Fondo de Ahorro Nacional",
        parsedEsUVR: true,
      }),
    ).toBe("uvr");
  });
});
