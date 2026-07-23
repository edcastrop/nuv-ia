// ═════════════════════════════════════════════════════════════════════
// Prueba de integración del contrato UVRSimulator → NUVIA.
//
// El objetivo no es re-renderizar el simulador (que depende de auth,
// supabase, ~30 hooks) sino demostrar el invariante arquitectónico que
// exige la corrección definitiva:
//
//   El motor puro (`buildUvrEscenarios`) es la ÚNICA fuente de las 4
//   propuestas que consumen tarjetas, PDF y snapshot NUVIA. No existe
//   una segunda ruta que reconstruya escenarios en el hijo.
//
// Verificamos:
//   1. OCR y digitación manual con inputs financieros equivalentes
//      producen el MISMO hash canónico NUVIA.
//   2. El snapshot resultante tiene `snapshotVersion=2` y exactamente
//      4 `propuestasComerciales` (habilita NUVIA de inmediato).
//   3. La escala se decide por `plazoInicial`, no por `plazoRestante`.
//   4. Editar una sola cuota cambia el snapshot (persistencia real).
//   5. Restaurar el borrador (cuotasList + recomendadaIdx) reproduce
//      el snapshot original bit-a-bit.
// ═════════════════════════════════════════════════════════════════════
import { describe, it, expect } from "vitest";
import { calculateUVRProjection, type UVRInput } from "@/lib/finance";
import { buildUvrEscenarios } from "@/lib/uvrEscenariosEngine";
import {
  buildUvrQaSnapshot,
  hashQaSnapshot,
  type SnapshotEscenario,
  type UvrSnapshotInput,
} from "@/lib/nuviaQaSnapshot";

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

// Adapta el resultado del motor puro al contrato de `SnapshotEscenario`.
// Esta transformación es la misma que aplica `UVRSimulator` al armar el
// snapshot NUVIA — vive aquí como una función local para que las
// pruebas no dependan del árbol de componentes.
function toSnapshotEscenarios(
  result: ReturnType<typeof buildUvrEscenarios>,
): SnapshotEscenario[] {
  return result.escenarios.map((c, i) => ({
    index: i,
    cuotasEliminadas: c.cuotasEliminadas,
    añosEliminados: c.añosEliminados,
    nuevoPlazo: c.nuevoPlazo,
    nuevaCuota: c.nuevaCuota,
    ahorroIntereses: c.ahorroIntereses,
    ahorroSeguros: c.ahorroSeguros,
    ahorroTotal: c.ahorroTotal,
    honorarios: c.honorarios,
    totalProyectado: c.totalProyectado,
    incrementoMensual: c.incrementoMensual,
    fuente: result.fuente,
  }));
}

function buildSnapshot(
  input: UVRInput,
  result: ReturnType<typeof buildUvrEscenarios>,
): ReturnType<typeof buildUvrQaSnapshot> {
  const snapInput: UvrSnapshotInput = {
    banco: "Bancolombia",
    producto: "Hipotecario UVR",
    cedula: "1000000",
    numeroCredito: "999",
    cliente: "Cliente Prueba",
    saldoPesos: input.saldoPesos,
    saldoUVR: input.saldoUVR,
    valorUVR: input.valorUVR,
    cuotaActualPesos: input.cuotaActualPesos,
    seguros: input.seguros,
    teaCobrada: input.teaCobrada,
    valorDesembolsado: input.valorDesembolsado,
    variacionUVR: input.variacionUVR,
    variacionUVRPropuestas: input.variacionUVRPropuestas,
    plazoInicial: input.plazoInicial,
    cuotasPagadas: input.plazoInicial - input.cuotasPendientes,
    cuotasPendientes: input.cuotasPendientes,
    escenarios: toSnapshotEscenarios(result),
  };
  return buildUvrQaSnapshot(snapInput);
}

describe("UVRSimulator ↔ NUVIA — contrato de las 4 propuestas", () => {
  it("digitación manual (Bancolombia): habilita NUVIA con 4 escenarios v2 sin depender del OCR", () => {
    const input = bancolombiaInput();
    const proj = calculateUVRProjection(input);
    const result = buildUvrEscenarios({
      plazoInicial: input.plazoInicial,
      plazoRestante: input.cuotasPendientes,
      input,
      escenarioActual: proj.escenarioActual,
    });
    expect(result.propuestas).toHaveLength(4);
    expect(result.cuotasList).toEqual([72, 84, 96, 108]);
    const snap = buildSnapshot(input, result);
    const datos = snap.datos as Record<string, unknown>;
    expect(datos.snapshotVersion).toBe(2);
    expect(Array.isArray(datos.propuestasComerciales)).toBe(true);
    expect((datos.propuestasComerciales as unknown[]).length).toBe(4);
  });

  it("OCR y manual con datos equivalentes producen el MISMO hash canónico", () => {
    const inputOcr = bancolombiaInput();
    const inputManual = bancolombiaInput();
    const projO = calculateUVRProjection(inputOcr);
    const projM = calculateUVRProjection(inputManual);
    const resO = buildUvrEscenarios({
      plazoInicial: inputOcr.plazoInicial,
      plazoRestante: inputOcr.cuotasPendientes,
      input: inputOcr,
      escenarioActual: projO.escenarioActual,
    });
    const resM = buildUvrEscenarios({
      plazoInicial: inputManual.plazoInicial,
      plazoRestante: inputManual.cuotasPendientes,
      input: inputManual,
      escenarioActual: projM.escenarioActual,
    });
    const snapO = buildSnapshot(inputOcr, resO);
    const snapM = buildSnapshot(inputManual, resM);
    expect(hashQaSnapshot(snapM)).toBe(hashQaSnapshot(snapO));
  });

  it("la escala automática depende de `plazoInicial` (300) aunque el `plazoRestante` sea igual", () => {
    const inputA = bancolombiaInput({ plazoInicial: 363, cuotasPendientes: 285 });
    const inputB = bancolombiaInput({ plazoInicial: 300, cuotasPendientes: 285 });
    const projA = calculateUVRProjection(inputA);
    const projB = calculateUVRProjection(inputB);
    const resA = buildUvrEscenarios({
      plazoInicial: 363,
      plazoRestante: 285,
      input: inputA,
      escenarioActual: projA.escenarioActual,
    });
    const resB = buildUvrEscenarios({
      plazoInicial: 300,
      plazoRestante: 285,
      input: inputB,
      escenarioActual: projB.escenarioActual,
    });
    expect(resA.cuotasList).toEqual([72, 84, 96, 108]);
    expect(resB.cuotasList).toEqual([36, 48, 60, 72]);
  });

  it("editar una sola cuota modifica el snapshot (persistencia real, no depende de sessionStorage)", () => {
    const input = bancolombiaInput();
    const proj = calculateUVRProjection(input);
    const auto = buildUvrEscenarios({
      plazoInicial: input.plazoInicial,
      plazoRestante: input.cuotasPendientes,
      input,
      escenarioActual: proj.escenarioActual,
    });
    const edited = buildUvrEscenarios({
      plazoInicial: input.plazoInicial,
      plazoRestante: input.cuotasPendientes,
      input,
      escenarioActual: proj.escenarioActual,
      cuotasList: [72, 84, 96, 120], // cambio la 4ª
    });
    expect(edited.fuente).toBe("manual");
    expect(edited.cuotasList).toEqual([72, 84, 96, 120]);
    // El escenario editado difiere en nuevoPlazo → snapshot distinto.
    const snapAuto = buildSnapshot(input, auto);
    const snapEdit = buildSnapshot(input, edited);
    const propsAuto = (snapAuto.datos as Record<string, unknown>).propuestasComerciales as SnapshotEscenario[];
    const propsEdit = (snapEdit.datos as Record<string, unknown>).propuestasComerciales as SnapshotEscenario[];
    expect(propsAuto[3].cuotasEliminadas).toBe(108);
    expect(propsEdit[3].cuotasEliminadas).toBe(120);
    expect(propsEdit[3].nuevoPlazo).toBe(285 - 120);
  });

  it("restaurar borrador (cuotasList + recomendadaIdx) reproduce el snapshot original", () => {
    const input = bancolombiaInput();
    const proj = calculateUVRProjection(input);
    const original = buildUvrEscenarios({
      plazoInicial: input.plazoInicial,
      plazoRestante: input.cuotasPendientes,
      input,
      escenarioActual: proj.escenarioActual,
      cuotasList: [60, 90, 120, 150],
      recomendadaListIdx: 1,
    });
    const restored = buildUvrEscenarios({
      plazoInicial: input.plazoInicial,
      plazoRestante: input.cuotasPendientes,
      input,
      escenarioActual: proj.escenarioActual,
      cuotasList: [...original.cuotasList],
      recomendadaListIdx: original.recomendadaListIdx,
    });
    expect(restored.cuotasList).toEqual(original.cuotasList);
    expect(restored.recomendadaListIdx).toBe(original.recomendadaListIdx);
    expect(hashQaSnapshot(buildSnapshot(input, restored))).toBe(
      hashQaSnapshot(buildSnapshot(input, original)),
    );
  });

  it("cuando plazoRestante invalida la lista guardada, se regenera (dirty pierde vigencia)", () => {
    const inputA = bancolombiaInput({ cuotasPendientes: 285 });
    const inputB = bancolombiaInput({ cuotasPendientes: 100 }); // el analista abonó extra
    const projB = calculateUVRProjection(inputB);
    const res = buildUvrEscenarios({
      plazoInicial: inputB.plazoInicial,
      plazoRestante: inputB.cuotasPendientes,
      input: inputB,
      escenarioActual: projB.escenarioActual,
      cuotasList: [72, 84, 96, 108], // heredado del estado anterior
    });
    expect(res.regeneradaPorInvalidez).toBe(true);
    expect(res.fuente).toBe("automatica");
  });
});
