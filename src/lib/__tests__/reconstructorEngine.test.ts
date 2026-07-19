import { describe, it, expect } from "vitest";
import {
  bisectTem,
  calcularCuotaFinanciera,
  calcularPlazoDesdeCuota,
  calcularSaldoDesdeCuota,
  normalizarCuota,
  pesosDesdeUVR,
  reconstruir,
  teaToTem,
  temToTea,
  uvrDesdePesos,
} from "@/lib/reconstructor/engine";
import type { ReconstructorInput } from "@/lib/reconstructor/types";
import {
  TEM_MAX_EXPANDIDA_DECIMAL,
  TEM_MIN_DECIMAL,
} from "@/lib/reconstructor/tolerancias";

// ─────────────────────────────────────────────────────────────
// Fórmulas independientes (para no reusar la función bajo prueba)
// ─────────────────────────────────────────────────────────────
function frenchCuota(saldo: number, i: number, n: number): number {
  if (i === 0) return saldo / n;
  return (i * saldo) / (1 - Math.pow(1 + i, -n));
}
function frenchSaldo(cuota: number, i: number, n: number): number {
  if (i === 0) return cuota * n;
  return (cuota * (1 - Math.pow(1 + i, -n))) / i;
}
function frenchPlazo(saldo: number, cuota: number, i: number): number {
  if (i === 0) return saldo / cuota;
  return -Math.log(1 - (saldo * i) / cuota) / Math.log(1 + i);
}

// ─────────────────────────────────────────────────────────────
// TEA ↔ TEM
// ─────────────────────────────────────────────────────────────
describe("conversión TEA ↔ TEM", () => {
  it("teaToTem invertible con temToTea", () => {
    const tem = teaToTem(12); // 12 % EA
    expect(tem).toBeGreaterThan(0);
    expect(temToTea(tem)).toBeCloseTo(12, 6);
  });
  it("TEA = 0 → TEM = 0", () => {
    expect(teaToTem(0)).toBe(0);
    expect(temToTea(0)).toBe(0);
  });
  it("teaToTem rechaza tea ≤ -100 %", () => {
    expect(Number.isNaN(teaToTem(-100))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Cuota / saldo / plazo
// ─────────────────────────────────────────────────────────────
describe("cuota francés", () => {
  it("coincide con fórmula independiente (i>0)", () => {
    const i = 0.01;
    const n = 240;
    const s = 100_000_000;
    expect(calcularCuotaFinanciera(s, i, n)).toBeCloseTo(frenchCuota(s, i, n), 4);
  });
  it("tasa cero: cuota = saldo / n", () => {
    expect(calcularCuotaFinanciera(1_200_000, 0, 12)).toBeCloseTo(100_000, 6);
  });
});

describe("saldo desde cuota", () => {
  it("coincide con fórmula independiente", () => {
    const i = 0.008;
    const n = 180;
    const s = 50_000_000;
    const c = frenchCuota(s, i, n);
    expect(calcularSaldoDesdeCuota(c, i, n)).toBeCloseTo(s, 2);
  });
  it("tasa cero: VP = cuota × n", () => {
    expect(calcularSaldoDesdeCuota(1000, 0, 24)).toBe(24_000);
  });
});

describe("plazo desde cuota", () => {
  it("cuota que no amortiza → motivo definido", () => {
    const r = calcularPlazoDesdeCuota(100_000_000, 100, 0.01);
    expect(Number.isNaN(r.plazo)).toBe(true);
    expect(r.motivo).toBeDefined();
  });
  it("coincide con fórmula independiente", () => {
    const s = 50_000_000;
    const i = 0.008;
    const n = 180;
    const c = frenchCuota(s, i, n);
    const r = calcularPlazoDesdeCuota(s, c, i);
    expect(r.plazo).toBeCloseTo(frenchPlazo(s, c, i), 4);
    expect(r.plazo).toBeCloseTo(n, 4);
  });
});

// ─────────────────────────────────────────────────────────────
// Bisección TEM
// ─────────────────────────────────────────────────────────────
describe("bisectTem", () => {
  it("recupera TEM conocida (i=1 %) sin usar la fórmula inversa", () => {
    const i = 0.01;
    const n = 240;
    const s = 100_000_000;
    const c = frenchCuota(s, i, n);
    const r = bisectTem(s, c, n);
    expect(r.ok).toBe(true);
    expect(r.tem).toBeCloseTo(i, 6);
    expect(r.iteraciones).toBeGreaterThan(0);
    expect(r.residuo).toBeLessThanOrEqual(1);
  });
  it("detecta tasa cero cuando cuota ≈ saldo/n", () => {
    const r = bisectTem(1_200_000, 100_000, 12);
    expect(r.ok).toBe(true);
    expect(r.tem).toBe(0);
  });
  it("rechaza cuota < saldo/n", () => {
    const r = bisectTem(1_200_000, 50_000, 12);
    expect(r.ok).toBe(false);
    expect(Number.isNaN(r.tem)).toBe(true);
  });
  it("rechaza cuota irrazonable (TEM > 10 % mensual)", () => {
    const r = bisectTem(1_000_000, 500_000, 6);
    expect(r.ok).toBe(false);
    expect(Number.isNaN(r.tem)).toBe(true);
  });
  it("nunca devuelve NaN cuando ok=true", () => {
    const s = 30_000_000;
    const n = 120;
    const c = frenchCuota(s, 0.006, n);
    const r = bisectTem(s, c, n);
    expect(r.ok).toBe(true);
    expect(Number.isFinite(r.tem)).toBe(true);
  });
  it("respeta límites centralizados", () => {
    expect(TEM_MIN_DECIMAL).toBeGreaterThan(0);
    expect(TEM_MAX_EXPANDIDA_DECIMAL).toBeLessThan(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Conversiones UVR ↔ Pesos
// ─────────────────────────────────────────────────────────────
describe("conversiones UVR", () => {
  it("pesos = UVR × valorUVR", () => {
    expect(pesosDesdeUVR(1000, 385.4321)).toBeCloseTo(385_432.1, 3);
  });
  it("UVR = pesos / valorUVR", () => {
    expect(uvrDesdePesos(385_432.1, 385.4321)).toBeCloseTo(1000, 3);
  });
  it("valores no positivos devuelven NaN", () => {
    expect(Number.isNaN(pesosDesdeUVR(0, 385))).toBe(true);
    expect(Number.isNaN(uvrDesdePesos(1000, 0))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// Normalización de cuota
// ─────────────────────────────────────────────────────────────
describe("normalizarCuota", () => {
  it("sin FRECH: resta seguros, otros, mora, intereses de mora, administración", () => {
    const r = normalizarCuota({
      moneda: "PESOS",
      cuotaTotal: 2_000_000,
      seguros: 50_000,
      otrosCargos: 10_000,
      mora: 5_000,
      interesesMora: 2_000,
      administracion: 3_000,
    });
    expect(r.cuotaFinancieraCalculada).toBe(2_000_000 - 50_000 - 10_000 - 5_000 - 2_000 - 3_000);
  });
  it("con FRECH: suma FRECH al reconstruir la cuota financiera", () => {
    const r = normalizarCuota({
      moneda: "PESOS",
      cuotaTotal: 1_800_000,
      seguros: 50_000,
      frech: 200_000,
    });
    expect(r.cuotaFinancieraCalculada).toBe(1_800_000 - 50_000 + 200_000);
  });
  it("no resta opción de adquisición (leasing)", () => {
    const r = normalizarCuota({
      moneda: "PESOS",
      cuotaTotal: 1_500_000,
      seguros: 40_000,
      opcionAdquisicion: 5_000_000,
    });
    expect(r.cuotaFinancieraCalculada).toBe(1_500_000 - 40_000);
    expect(r.desglose.opcionAdquisicionExcluida).toBe(5_000_000);
  });
  it("cargos desconocidos emiten alerta", () => {
    const r = normalizarCuota({
      moneda: "PESOS",
      cuotaTotal: 1_000_000,
      cargosDesconocidos: 12_000,
    });
    expect(r.alertas.some((a) => a.toLowerCase().includes("desconocidos"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// reconstruir · pipeline
// ─────────────────────────────────────────────────────────────
describe("reconstruir · PESOS · caso coherente", () => {
  const i = 0.009;
  const n = 180;
  const s = 60_000_000;
  const cFin = frenchCuota(s, i, n);
  const input: ReconstructorInput = {
    moneda: "PESOS",
    tipoCredito: "HIPOTECARIO",
    saldoCapitalPesos: s,
    cuotaTotal: cFin + 40_000,
    seguros: 40_000,
    cuotasPendientes: n,
    plazoReportado: n,
  };
  const r = reconstruir(input);

  it("recupera TEM y TEA con clasificación EXACTA", () => {
    expect(r.tem.clasificacion).toBe("EXACTO");
    expect(r.tem.valor!).toBeCloseTo(i, 5);
    expect(r.tea.valor!).toBeCloseTo(temToTea(i), 4);
  });
  it("saldo reconstruido coincide con reportado", () => {
    expect(r.saldoReconstruido.valor!).toBeCloseTo(s, 0);
    expect(Math.abs(r.diferenciaSaldoPct!)).toBeLessThan(0.001);
  });
  it("plazo triple: matemático, redondeado y NUVEX", () => {
    expect(r.plazo.matematico.valor!).toBeCloseTo(n, 3);
    expect(r.plazo.matematicoRedondeado.valor).toBe(n);
    expect(r.plazo.operacionalNuvex.valor).toBe(n);
  });
  it("auditoría CREDITO_COHERENTE", () => {
    expect(r.auditoria.diagnostico).toBe("CREDITO_COHERENTE");
  });
  it("clasificación global EXACTO / confianza ALTA", () => {
    expect(r.clasificacionGlobal).toBe("EXACTO");
    expect(r.confianzaGlobal).toBe("ALTA");
  });
  it("no produce NaN ni Infinity", () => {
    const flat = JSON.stringify(r);
    expect(flat.includes("NaN")).toBe(false);
    expect(flat.includes("Infinity")).toBe(false);
  });
});

describe("reconstruir · PESOS · información insuficiente", () => {
  it("sin cuota ni tasa reporta INFORMACION_INSUFICIENTE", () => {
    const r = reconstruir({ moneda: "PESOS", saldoCapitalPesos: 50_000_000 });
    expect(r.auditoria.diagnostico).toBe("INFORMACION_INSUFICIENTE");
    expect(r.datosFaltantes.length).toBeGreaterThan(0);
    expect(r.confianzaGlobal).toBe("NULA");
  });
});

describe("reconstruir · rangos", () => {
  it("emite rango de seguros con central y clasificación ESTIMADO/MEDIA", () => {
    const r = reconstruir({
      moneda: "PESOS",
      cuotaTotal: 1_500_000,
      seguros_min: 30_000,
      seguros_max: 60_000,
      cuotasPendientes: 120,
    });
    const rango = r.rangos.find((x) => x.variable === "seguros");
    expect(rango).toBeDefined();
    expect(rango!.minimo).toBe(30_000);
    expect(rango!.maximo).toBe(60_000);
    expect(rango!.central).toBe(45_000);
    expect(rango!.clasificacion).toBe("ESTIMADO");
    expect(rango!.confianza).toBe("MEDIA");
    expect(rango!.supuestos.length).toBeGreaterThan(0);
  });
  it("rangos de FRECH y otros cargos también se emiten", () => {
    const r = reconstruir({
      moneda: "PESOS",
      cuotaTotal: 2_000_000,
      frech_min: 100_000,
      frech_max: 200_000,
      otrosCargos_min: 5_000,
      otrosCargos_max: 15_000,
      cuotasPendientes: 100,
    });
    expect(r.rangos.some((x) => x.variable === "frech")).toBe(true);
    expect(r.rangos.some((x) => x.variable === "otrosCargos")).toBe(true);
    expect(r.rangos.some((x) => x.variable === "cuotaFinanciera")).toBe(true);
    expect(r.clasificacionGlobal).toBe("RANGO");
  });
});

describe("reconstruir · UVR · coherencia", () => {
  it("marca coherente cuando saldoUVR × valorUVR ≈ saldoPesos", () => {
    const r = reconstruir({
      moneda: "UVR",
      saldoCapitalUVR: 100_000,
      valorUVR: 385.4321,
      saldoCapitalPesos: 100_000 * 385.4321,
    });
    expect(r.uvr).not.toBeNull();
    expect(r.uvr!.coherente).toBe(true);
  });
  it("marca INCONSISTENCIA_CRITICA cuando el producto UVR difiere > 5 %", () => {
    const r = reconstruir({
      moneda: "UVR",
      saldoCapitalUVR: 100_000,
      valorUVR: 385.4321,
      saldoCapitalPesos: 100_000 * 385.4321 * 1.1, // +10 %
    });
    expect(r.uvr!.coherente).toBe(false);
    expect(r.auditoria.diagnostico).toBe("INCONSISTENCIA_CRITICA");
  });
});

describe("reconstruir · inconsistencia crítica de cuota", () => {
  it("cuando la cuota reportada difiere > 5 % de la reconstruida", () => {
    const i = 0.009;
    const n = 180;
    const s = 60_000_000;
    const cFin = frenchCuota(s, i, n);
    const r = reconstruir({
      moneda: "PESOS",
      saldoCapitalPesos: s,
      cuotaTotal: cFin + 40_000,
      cuotaFinancieraReportada: cFin * 1.2,
      seguros: 40_000,
      cuotasPendientes: n,
    });
    expect(r.auditoria.diagnostico).toBe("INCONSISTENCIA_CRITICA");
    expect(r.confianzaGlobal).toBe("BAJA");
  });
});

describe("reconstruir · abono extraordinario reciente", () => {
  it("agrega observación informativa", () => {
    const r = reconstruir({
      moneda: "PESOS",
      saldoCapitalPesos: 50_000_000,
      cuotaTotal: 700_000,
      seguros: 30_000,
      cuotasPendientes: 120,
      abonoExtraordinarioReciente: true,
    });
    expect(r.auditoria.observaciones.some((o) => o.codigo === "ABONO_EXTRAORDINARIO")).toBe(true);
  });
});
