// ═════════════════════════════════════════════════════════════════════
// Pruebas del motor puro común y del adaptador UVR.
//
// Cubre:
//  • `propuestasEngine`: compute*, pickBestIdx, toPropuestaRow.
//  • `uvrEscenariosEngine`: escala automática por plazoInicial,
//    validez por plazoRestante, conservación de cuotasList editada,
//    regeneración cuando el override es inválido, override manual del
//    índice recomendado, fixtures Bancolombia 363/285 y 300/285.
// ═════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import { calculateUVRProjection, type UVRInput } from "@/lib/finance";
import {
  computePropuestaPesos,
  computePropuestaUVR,
  pickBestIdx,
  toPropuestaRow,
} from "@/lib/propuestasEngine";
import {
  buildUvrEscenarios,
  getUVRReductionOptions,
  isCuotasListValid,
} from "@/lib/uvrEscenariosEngine";

// ─── Fixtures ────────────────────────────────────────────────────────
function bancolombiaInput(overrides: Partial<UVRInput> = {}): UVRInput {
  return {
    valorDesembolsado: 150_000_000,
    saldoPesos: 120_000_000,
    saldoUVR: 300_000,
    valorUVR: 400,
    cuotaActualPesos: 900_000,
    cuotaSinSeguros: 800_000,
    seguros: 100_000,
    teaCobrada: 8.5,
    variacionUVR: 6,
    variacionUVRPropuestas: 5,
    cuotasPendientes: 285,
    plazoInicial: 363,
    porcentajeHonorarios: 6,
    ...overrides,
  };
}

function projFor(input: UVRInput) {
  return calculateUVRProjection(input);
}

// ─── isCuotasListValid ───────────────────────────────────────────────
describe("isCuotasListValid", () => {
  it("acepta 4 enteros positivos, únicos, ascendentes y < plazoRestante", () => {
    expect(isCuotasListValid([72, 84, 96, 108], 285)).toBe(true);
  });
  it("rechaza longitud distinta de 4", () => {
    expect(isCuotasListValid([72, 84, 96], 285)).toBe(false);
    expect(isCuotasListValid([72, 84, 96, 108, 120], 285)).toBe(false);
    expect(isCuotasListValid(undefined, 285)).toBe(false);
    expect(isCuotasListValid([], 285)).toBe(false);
  });
  it("rechaza duplicados o no ascendentes", () => {
    expect(isCuotasListValid([72, 72, 96, 108], 285)).toBe(false);
    expect(isCuotasListValid([108, 96, 84, 72], 285)).toBe(false);
  });
  it("rechaza no enteros / negativos / cero", () => {
    expect(isCuotasListValid([72.5, 84, 96, 108], 285)).toBe(false);
    expect(isCuotasListValid([0, 84, 96, 108], 285)).toBe(false);
    expect(isCuotasListValid([-1, 84, 96, 108], 285)).toBe(false);
    expect(isCuotasListValid([Number.NaN, 84, 96, 108], 285)).toBe(false);
    expect(isCuotasListValid([Number.POSITIVE_INFINITY, 84, 96, 108], 285)).toBe(false);
  });
  it("rechaza cuotas >= plazoRestante", () => {
    expect(isCuotasListValid([72, 84, 96, 285], 285)).toBe(false);
    expect(isCuotasListValid([72, 84, 96, 300], 285)).toBe(false);
  });
  it("rechaza plazoRestante <= 1", () => {
    expect(isCuotasListValid([1, 2, 3, 4], 1)).toBe(false);
    expect(isCuotasListValid([1, 2, 3, 4], 0)).toBe(false);
  });
});

// ─── getUVRReductionOptions ──────────────────────────────────────────
describe("getUVRReductionOptions (contrato comercial)", () => {
  it("plazo >= 360 → [72,84,96,108]", () => {
    expect(getUVRReductionOptions(360)).toEqual([72, 84, 96, 108]);
    expect(getUVRReductionOptions(363)).toEqual([72, 84, 96, 108]);
    expect(getUVRReductionOptions(480)).toEqual([72, 84, 96, 108]);
  });
  it("plazo 240..359 → [36,48,60,72]", () => {
    expect(getUVRReductionOptions(240)).toEqual([36, 48, 60, 72]);
    expect(getUVRReductionOptions(300)).toEqual([36, 48, 60, 72]);
    expect(getUVRReductionOptions(359)).toEqual([36, 48, 60, 72]);
  });
  it("plazo < 240 → [12,24,36,48]", () => {
    expect(getUVRReductionOptions(180)).toEqual([12, 24, 36, 48]);
    expect(getUVRReductionOptions(120)).toEqual([12, 24, 36, 48]);
  });
});

// ─── Motor puro común (Pesos + UVR) ──────────────────────────────────
describe("propuestasEngine — cálculo puro", () => {
  it("computePropuestaUVR: campos coherentes en escenario válido", () => {
    const input = bancolombiaInput();
    const proj = projFor(input);
    const c = computePropuestaUVR(input, proj.escenarioActual, 72);
    expect(c.valid).toBe(true);
    expect(c.cuotasEliminadas).toBe(72);
    expect(c.nuevoPlazo).toBe(285 - 72);
    expect(c.nuevaCuota).toBeGreaterThan(input.cuotaActualPesos);
    expect(c.incrementoMensual).toBeGreaterThan(0);
    expect(c.ahorroIntereses).toBeGreaterThan(0);
    expect(c.ahorroSeguros).toBeCloseTo(input.seguros * 72, 6);
    expect(c.ahorroTotal).toBeCloseTo(c.ahorroIntereses + c.ahorroSeguros, 4);
    expect(c.honorarios).toBeGreaterThan(0);
    expect(c.totalProyectado).toBeGreaterThan(0);
    expect(c.añosEliminados).toBeCloseTo(72 / 12, 6);
  });

  it("computePropuestaUVR: marca invalid cuando cuotasEliminadas >= plazoRestante", () => {
    const input = bancolombiaInput();
    const proj = projFor(input);
    const c = computePropuestaUVR(input, proj.escenarioActual, 285);
    expect(c.valid).toBe(false);
    expect(c.motivo).toMatch(/fuera de rango|no genera ahorro/i);
  });

  it("pickBestIdx: escoge el escenario de mayor ahorro entre los válidos", () => {
    const input = bancolombiaInput();
    const proj = projFor(input);
    const calcs = [72, 84, 96, 108].map((n) =>
      computePropuestaUVR(input, proj.escenarioActual, n),
    );
    const idx = pickBestIdx(calcs);
    expect(idx).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < calcs.length; i++) {
      if (i !== idx && calcs[i].valid) {
        expect(calcs[idx].ahorroTotal).toBeGreaterThanOrEqual(calcs[i].ahorroTotal);
      }
    }
  });

  it("pickBestIdx: devuelve -1 si no hay válidos", () => {
    expect(pickBestIdx([])).toBe(-1);
    expect(
      pickBestIdx([
        { valid: false, motivo: "x", cuotasEliminadas: 0, añosEliminados: 0, nuevoPlazo: 0, nuevaCuota: 0, ahorroIntereses: 0, ahorroSeguros: 0, ahorroTotal: 0, honorarios: 0, totalProyectado: 0, incrementoMensual: 0 },
      ]),
    ).toBe(-1);
  });

  it("toPropuestaRow: preserva todos los campos + index/fuente", () => {
    const input = bancolombiaInput();
    const proj = projFor(input);
    const c = computePropuestaUVR(input, proj.escenarioActual, 84);
    const row = toPropuestaRow(c, 1, "manual");
    expect(row.index).toBe(1);
    expect(row.fuente).toBe("manual");
    expect(row.nuevaCuota).toBe(c.nuevaCuota);
    expect(row.honorarios).toBe(c.honorarios);
  });

  it("computePropuestaPesos: contrato mínimo estable", () => {
    const c = computePropuestaPesos(
      {
        valorDesembolsado: 100_000_000,
        saldoCapital: 80_000_000,
        cuotaActual: 1_200_000,
        cuotaSinSeguros: 1_050_000,
        seguros: 150_000,
        tea: 15,
        cuotasPendientes: 120,
        plazoInicial: 180,
        porcentajeHonorarios: 6,
      } as unknown as import("@/lib/finance").PesosInput,
      24,
    );
    expect(c.valid).toBe(true);
    expect(c.cuotasEliminadas).toBe(24);
    expect(c.nuevoPlazo).toBe(120 - 24);
    expect(Number.isFinite(c.ahorroTotal)).toBe(true);
  });
});

// ─── Adaptador UVR — comportamiento nuclear ──────────────────────────
describe("buildUvrEscenarios — reglas de escala/validez", () => {
  it("FIXTURE Bancolombia: plazoInicial=363, plazoRestante=285 → [72,84,96,108] → [213,201,189,177]", () => {
    const input = bancolombiaInput({ plazoInicial: 363, cuotasPendientes: 285 });
    const proj = projFor(input);
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
    });
    expect(r.cuotasAutomaticas).toEqual([72, 84, 96, 108]);
    expect(r.cuotasList).toEqual([72, 84, 96, 108]);
    expect(r.fuente).toBe("automatica");
    expect(r.regeneradaPorInvalidez).toBe(false);
    expect(r.propuestas).toHaveLength(4);
    expect(r.propuestas.map((p) => p.nuevoPlazo)).toEqual([213, 201, 189, 177]);
    // Recomendada: el de mayor ahorro (108 cuotas = mayor reducción).
    expect(r.recomendadaListIdx).toBeGreaterThanOrEqual(0);
    expect(r.recomendadaRowIdx).toBeGreaterThanOrEqual(0);
    // Todas las propuestas viables tienen honorarios y ahorro > 0.
    for (const p of r.propuestas) {
      expect(p.valid).toBe(true);
      expect(p.honorarios).toBeGreaterThan(0);
      expect(p.ahorroTotal).toBeGreaterThan(0);
      expect(p.ahorroSeguros).toBeCloseTo(input.seguros * p.cuotasEliminadas, 6);
    }
  });

  it("FIXTURE plazo medio: plazoInicial=300, plazoRestante=285 → [36,48,60,72] → [249,237,225,213]", () => {
    const input = bancolombiaInput({ plazoInicial: 300, cuotasPendientes: 285 });
    const proj = projFor(input);
    const r = buildUvrEscenarios({
      plazoInicial: 300,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
    });
    // La ESCALA depende del plazo inicial, no del plazo restante.
    expect(r.cuotasAutomaticas).toEqual([36, 48, 60, 72]);
    expect(r.cuotasList).toEqual([36, 48, 60, 72]);
    expect(r.propuestas.map((p) => p.nuevoPlazo)).toEqual([249, 237, 225, 213]);
    expect(r.fuente).toBe("automatica");
    expect(r.propuestas).toHaveLength(4);
  });

  it("plazo corto: plazoInicial=120 → [12,24,36,48]", () => {
    const input = bancolombiaInput({
      plazoInicial: 120,
      cuotasPendientes: 100,
      saldoUVR: 100_000,
      saldoPesos: 40_000_000,
      cuotaActualPesos: 800_000,
      seguros: 80_000,
    });
    const proj = projFor(input);
    const r = buildUvrEscenarios({
      plazoInicial: 120,
      plazoRestante: 100,
      input,
      escenarioActual: proj.escenarioActual,
    });
    expect(r.cuotasAutomaticas).toEqual([12, 24, 36, 48]);
    expect(r.cuotasList).toEqual([12, 24, 36, 48]);
  });
});

describe("buildUvrEscenarios — conservación y regeneración", () => {
  const input = bancolombiaInput();
  const proj = projFor(input);

  it("conserva cuotasList editada válida (fuente=manual)", () => {
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
      cuotasList: [60, 90, 120, 150],
    });
    expect(r.fuente).toBe("manual");
    expect(r.cuotasList).toEqual([60, 90, 120, 150]);
    expect(r.propuestas.map((p) => p.cuotasEliminadas)).toEqual([60, 90, 120, 150]);
    expect(r.regeneradaPorInvalidez).toBe(false);
  });

  it("cambio de saldo/TEA con cuotasList válida: conserva la lista", () => {
    const listaEditada = [60, 90, 120, 150];
    const inputMod = { ...input, saldoUVR: input.saldoUVR * 1.05, saldoPesos: input.saldoPesos * 1.05 };
    const projMod = projFor(inputMod);
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input: inputMod,
      escenarioActual: projMod.escenarioActual,
      cuotasList: listaEditada,
    });
    expect(r.fuente).toBe("manual");
    expect(r.cuotasList).toEqual(listaEditada);
  });

  it("regenera cuando cuotasList editada deja de ser válida (plazoRestante bajó)", () => {
    const inputCorto = { ...input, cuotasPendientes: 100 };
    const projCorto = projFor(inputCorto);
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 100,
      input: inputCorto,
      escenarioActual: projCorto.escenarioActual,
      cuotasList: [72, 84, 96, 108],
    });
    expect(r.fuente).toBe("automatica");
    expect(r.cuotasList).toEqual([72, 84, 96, 108]);
    expect(r.regeneradaPorInvalidez).toBe(true);
    // Aún con la escala automática, `108 >= plazoRestante(100)` → esa
    // propuesta queda invalid (motor puro se encarga).
    expect(r.propuestas.length).toBeLessThan(4);
  });

  it("regenera cuando la lista provista tiene longitud incorrecta", () => {
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
      cuotasList: [72, 84, 96],
    });
    expect(r.fuente).toBe("automatica");
    expect(r.regeneradaPorInvalidez).toBe(true);
    expect(r.cuotasList).toEqual([72, 84, 96, 108]);
  });
});

describe("buildUvrEscenarios — override de recomendada", () => {
  const input = bancolombiaInput();
  const proj = projFor(input);

  it("respeta el índice manual válido dentro de cuotasList", () => {
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
      recomendadaListIdx: 0, // fuerza el primer escenario
    });
    expect(r.recomendadaListIdx).toBe(0);
    expect(r.recomendadaRowIdx).toBe(0);
  });

  it("ignora índice fuera de rango y cae en best por ahorro", () => {
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
      recomendadaListIdx: 99,
    });
    // best por ahorro (mayor cuotasEliminadas = 108 → índice 3)
    expect(r.recomendadaListIdx).toBe(3);
  });

  it("ignora índice negativo", () => {
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
      recomendadaListIdx: -5,
    });
    expect(r.recomendadaListIdx).toBeGreaterThanOrEqual(0);
  });
});

describe("buildUvrEscenarios — entradas patológicas", () => {
  it("no explota con NaN en input y devuelve escenarios no válidos", () => {
    const input = bancolombiaInput({ saldoUVR: Number.NaN });
    const proj = projFor(bancolombiaInput());
    const r = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input,
      escenarioActual: proj.escenarioActual,
    });
    expect(r.cuotasList).toEqual([72, 84, 96, 108]);
    // El motor puede producir propuestas no válidas; no debe lanzar.
    expect(Array.isArray(r.propuestas)).toBe(true);
  });

  it("Infinity en input no rompe la estructura", () => {
    const input = bancolombiaInput({ cuotaActualPesos: Number.POSITIVE_INFINITY });
    const proj = projFor(bancolombiaInput());
    expect(() =>
      buildUvrEscenarios({
        plazoInicial: 363,
        plazoRestante: 285,
        input,
        escenarioActual: proj.escenarioActual,
      }),
    ).not.toThrow();
  });
});
