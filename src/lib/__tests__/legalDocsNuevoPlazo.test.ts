import { describe, expect, test } from "vitest";
import type { Expediente } from "../expedientes";
import type { ExpedienteMaestro } from "../expedienteMaestro";
import { buildDatosContrato } from "../legalDocs";

function fichaNuevoPlazo(opts: {
  banco: string;
  plazoOriginal: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  cuotasEliminadas: number;
  nuevoPlazoSimulado: number;
}): string | undefined {
  const maestro = {
    cliente: {},
    cotitular: { activo: false },
    credito: {
      banco: opts.banco,
      plazoOriginal: String(opts.plazoOriginal),
      cuotasPagadas: String(opts.cuotasPagadas),
      cuotasPendientes: String(opts.cuotasPendientes),
    },
    fresh: {},
  } as ExpedienteMaestro;
  const sim = {
    propuesta_data: {
      cuotasEliminadas: opts.cuotasEliminadas,
      nuevoPlazo: opts.nuevoPlazoSimulado,
      nuevaCuota: 0,
    },
    cliente_data: {},
  } as unknown as Expediente;

  const ficha = buildDatosContrato(maestro, sim);
  const field = ficha.blocks.find(
    (block) => block.type === "field" && block.label === "Nuevo plazo (meses)",
  );
  return field?.type === "field" ? field.value : undefined;
}

describe("Ficha contractual — regla bancaria de nuevo plazo", () => {
  test("NUV_2026_MG_000061: Banco de Bogotá usa plazo original menos eliminadas", () => {
    expect(
      fichaNuevoPlazo({
        banco: "Banco de Bogotá",
        plazoOriginal: 240,
        cuotasPagadas: 14,
        cuotasPendientes: 190,
        cuotasEliminadas: 96,
        nuevoPlazoSimulado: 130,
      }),
    ).toBe("144");
  });

  test("NUV_2026_MG_000063: Banco de Bogotá no vuelve a descontar las cuotas pagadas", () => {
    expect(
      fichaNuevoPlazo({
        banco: "Banco de Bogotá",
        plazoOriginal: 240,
        cuotasPagadas: 79,
        cuotasPendientes: 149,
        cuotasEliminadas: 48,
        nuevoPlazoSimulado: 113,
      }),
    ).toBe("192");
  });

  test("Davivienda conserva la regla de cuotas pendientes menos eliminadas", () => {
    expect(
      fichaNuevoPlazo({
        banco: "Davivienda",
        plazoOriginal: 240,
        cuotasPagadas: 14,
        cuotasPendientes: 190,
        cuotasEliminadas: 96,
        nuevoPlazoSimulado: 94,
      }),
    ).toBe("94");
  });
});
