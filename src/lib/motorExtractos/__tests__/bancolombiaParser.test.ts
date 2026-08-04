import { describe, expect, it } from "vitest";

import { parseBancolombiaText } from "../bancolombiaParser";

describe("parseBancolombiaText", () => {
  it("no confunde el saldo total del extracto UVR con el saldo de capital", () => {
    const rawText = `
      Estado de Crédito Hipotecario en UVR
      www.bancolombia.com
      SEÑOR(A):
      JEIMY PATRICIA RIVEROS GARZON
      Fecha de Pago Fecha en que se generó el extracto Valor a Pagar Saldo a la fecha en que se generó el extracto
      2026/07/30 2026/06/30 $ 2,145,471.75 $ 299,727,872.36
      Información General
      Número de crédito 90000079970 Plan: CUOTA CONSTANTE EN UVR-VIVDA NOVIS Tasa interés pactada 6.50% EA
      Tasa interés cobrada 6.50% EA
      Valor desembolso $ 210,000,000.00
      Plazo total en meses 364
      Nro. cuota a cancelar 078
      Nro. cuotas pendientes para pago total 283
      Valor de la cuota sin seguros y sin comisiones $ 2,013,448.75
      *Valor seguro vida $ 65,715.00
      *Valor seguro incendio $ 39,786.00
      *Valor seguro terremoto $ 26,522.00
      Saldo de capital en UVR: 707,836.4767
      Valor de la unidad UVR a la fecha de pago: 416.6833
      El campo "Saldo a la fecha en que se generó el extracto" corresponde a la suma de capital, interés corriente, interés de mora, seguros y otros conceptos a pagar.
    `;

    const result = parseBancolombiaText(rawText);

    expect(result).not.toBeNull();
    expect(result?.saldoUVR).toBe("707836.4767");
    expect(result?.valorUVR).toBe("416.6833");
    expect(result?.saldoCapital).toBe("294943638.97");
    expect(result?.saldoTotalExtracto).toBe("299727872.36");
  });
});
