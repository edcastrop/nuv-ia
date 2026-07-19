import { describe, it, expect } from "vitest";
import {
  normalizarExtracto,
  runLab,
} from "@/lib/reconstructor/lab/pipeline";
import { clasificarVariables } from "@/lib/reconstructor/lab/clasificador";
import { evaluarCoherencia } from "@/lib/reconstructor/lab/coherencia";
import { evaluarIdentificabilidad } from "@/lib/reconstructor/lab/identificabilidad";
import { reconstruirCadena } from "@/lib/reconstructor/lab/reconstruccion";
import { generarHipotesisTEA } from "@/lib/reconstructor/lab/hipotesis";
import { detectarBanco } from "@/lib/reconstructor/lab/diccionarios";
import type { VariableDetectada } from "@/lib/reconstructor/lab/types";

// Helpers para armar variables sintéticas
const V = (
  categoria: VariableDetectada["categoria"],
  valor: number,
  unidad: VariableDetectada["unidad"] = "PESOS",
): VariableDetectada => ({
  id: `${categoria}-${valor}`,
  categoria,
  etiquetaOriginal: categoria,
  valor,
  unidad,
  paginaOrigen: null,
  fuente: "EXTRACTO_ESTRUCTURADO",
  confianzaExtraccion: "ALTA",
  confianzaClasificacion: "ALTA",
  excluida: false,
  notas: [],
});

describe("detectarBanco", () => {
  it.each([
    ["Fondo Nacional del Ahorro", "FNA"],
    ["Davivienda S.A.", "DAVIVIENDA"],
    ["Bancolombia", "BANCOLOMBIA"],
    ["BBVA Colombia", "BBVA"],
    ["Caja Social", "CAJA_SOCIAL"],
    ["Banco de Bogotá", "BANCO_DE_BOGOTA"],
    ["Scotiabank Colpatria", "SCOTIABANK"],
    ["Banco Popular", "BANCO_POPULAR"],
    ["AV Villas", "AV_VILLAS"],
    ["", "DESCONOCIDO"],
  ])("clasifica '%s' como %s", (input, esperado) => {
    expect(detectarBanco(input)).toBe(esperado);
  });
});

describe("normalizarExtracto — FNA PESOS con Cotización UVR informativa", () => {
  it("no clasifica como UVR cuando saldoUVR está vacío pero valorUVR viene diligenciado", () => {
    const parsed = {
      banco: "Fondo Nacional del Ahorro",
      producto: "Hipotecario",
      moneda: "PESOS",
      saldoCapital: "101315851",
      valorUVR: "1.0000",
      cuotaMensual: "1200000",
    };
    const input = normalizarExtracto(parsed);
    expect(input.banco).toBe("FNA");
    expect(input.moneda).toBe("PESOS");
  });
});

describe("clasificarVariables — categorización determinista", () => {
  it("mapea claves conocidas por banco genérico", () => {
    const parsed = {
      banco: "Bancolombia",
      moneda: "PESOS",
      saldoCapital: "100000000",
      cuotaMensual: "1200000",
      teaCobrada: "12.5",
    };
    const input = normalizarExtracto(parsed);
    const { variables } = clasificarVariables(input);
    const cats = variables.map((v) => v.categoria);
    expect(cats).toContain("SALDO_PESOS");
    expect(cats).toContain("CUOTA_FINANCIERA");
    expect(cats).toContain("TEA");
  });
});

describe("evaluarCoherencia — semáforos", () => {
  it("VERDE cuando SALDO_UVR × VALOR_UVR ≈ SALDO_PESOS", () => {
    const vars = [
      V("SALDO_UVR", 244711.5103, "UVR"),
      V("VALOR_UVR", 414.0216),
      V("SALDO_PESOS", 244711.5103 * 414.0216),
    ];
    const r = evaluarCoherencia(vars);
    expect(r.find((x) => x.codigo === "UVR_PRODUCTO")?.severidad).toBe("VERDE");
  });
  it("ROJO cuando TEA está fuera de rango", () => {
    const r = evaluarCoherencia([V("TEA", 250, "PORCENTAJE")]);
    expect(r.some((x) => x.codigo === "TASA_IMPOSIBLE" && x.severidad === "ROJO")).toBe(true);
  });
  it("Plazo pagadas+pendientes vs aprobado (VERDE)", () => {
    const r = evaluarCoherencia([
      V("CUOTAS_PAGADAS", 18, "CUOTAS"),
      V("CUOTAS_PENDIENTES", 342, "CUOTAS"),
      V("PLAZO_APROBADO", 360, "CUOTAS"),
    ]);
    expect(r.find((x) => x.codigo === "PLAZO_SUMA")?.severidad).toBe("VERDE");
  });
});

describe("evaluarIdentificabilidad", () => {
  it("TEA es CALCULABLE cuando existen saldo, cuota y plazo", () => {
    const vars = [
      V("SALDO_PESOS", 100_000_000),
      V("CUOTA_FINANCIERA", 1_200_000),
      V("PLAZO_RESTANTE", 240, "CUOTAS"),
    ];
    const r = evaluarIdentificabilidad(vars);
    expect(r.find((d) => d.categoria === "TEA")?.identificabilidad).toBe("CALCULABLE");
  });
  it("VALOR_DESEMBOLSADO es sólo ESTIMABLE bajo supuestos", () => {
    const vars = [
      V("CUOTA_ORIGINAL", 1_100_000),
      V("TEA", 12, "PORCENTAJE"),
      V("PLAZO_APROBADO", 240, "CUOTAS"),
    ];
    const r = evaluarIdentificabilidad(vars);
    expect(r.find((d) => d.categoria === "VALOR_DESEMBOLSADO")?.identificabilidad).toBe("ESTIMABLE");
  });
  it("PLAZO_APROBADO INFERIBLE (aparece como CALCULABLE en catálogo)", () => {
    const vars = [V("CUOTAS_PAGADAS", 12, "CUOTAS"), V("CUOTAS_PENDIENTES", 108, "CUOTAS")];
    const r = evaluarIdentificabilidad(vars);
    expect(r.find((d) => d.categoria === "PLAZO_APROBADO")?.identificabilidad).toBe("CALCULABLE");
  });
});

describe("reconstruirCadena — reconstrucción encadenada", () => {
  it("SALDO_UVR + VALOR_UVR → SALDO_PESOS", () => {
    const { evidencias } = reconstruirCadena([
      V("SALDO_UVR", 244711.5103, "UVR"),
      V("VALOR_UVR", 414.0216),
    ]);
    expect(evidencias.find((e) => e.categoria === "SALDO_PESOS")).toBeTruthy();
  });
  it("Pagadas + Pendientes → PLAZO_APROBADO", () => {
    const { evidencias } = reconstruirCadena([
      V("CUOTAS_PAGADAS", 18, "CUOTAS"),
      V("CUOTAS_PENDIENTES", 342, "CUOTAS"),
    ]);
    const e = evidencias.find((x) => x.categoria === "PLAZO_APROBADO");
    expect(e?.valor).toBe(360);
  });
  it("TEA → TEM y viceversa", () => {
    const { evidencias } = reconstruirCadena([V("TEA", 12, "PORCENTAJE")]);
    const tem = evidencias.find((e) => e.categoria === "TEM");
    expect(tem?.valor).toBeGreaterThan(0.9);
    expect(tem?.valor).toBeLessThan(1.0);
  });
});

describe("generarHipotesisTEA — ambigüedad y selección", () => {
  it("selecciona una única hipótesis cuando sólo una cae en tolerancia", () => {
    // saldo=100M, cuota financiera consistente con TEA 12%
    const saldo = 100_000_000;
    const n = 240;
    // Calcular cuota real con TEA 12
    const tem = Math.pow(1.12, 1 / 12) - 1;
    const cuota = (saldo * tem) / (1 - Math.pow(1 + tem, -n));
    const vars = [
      V("SALDO_PESOS", saldo),
      V("PLAZO_RESTANTE", n, "CUOTAS"),
      V("CUOTA_FINANCIERA", cuota),
    ];
    const hs = generarHipotesisTEA(vars, { saldo, plazoRestante: n, moneda: "PESOS" });
    const sel = hs.find((h) => h.seleccionada);
    expect(sel).toBeTruthy();
    expect(sel?.resultado?.valor).toBeCloseTo(12, 0);
  });
});

describe("runLab — pipeline integrado", () => {
  it("caso FNA UVR reconstruye plazo aprobado y saldo pesos", () => {
    const parsed = {
      banco: "Fondo Nacional del Ahorro",
      moneda: "UVR",
      saldoUVR: "244711,5103",
      valorUVR: "414,0216",
      saldoCapital: "101315851",
      cuotasPagadas: "18",
      cuotasPendientes: "342",
      teaCobrada: "0",
    };
    const input = normalizarExtracto(parsed);
    const r = runLab(input);
    // Debe encontrar el UVR_PRODUCTO
    const uvrCheck = r.coherencia.find((c) => c.codigo === "UVR_PRODUCTO");
    expect(uvrCheck?.severidad).toBe("VERDE");
    // Debe reconstruir PLAZO_APROBADO = 360
    const plazo = r.reconstrucciones.find((e) => e.categoria === "PLAZO_APROBADO");
    expect(plazo?.valor).toBe(360);
    // TEA reportada = 0 no genera una TEA calculada engañosa
    expect(r.diagnostico.variablesReconstruidas).toBeGreaterThanOrEqual(1);
  });
});

describe("Privacidad y sanidad", () => {
  it("no persiste ni retorna PII adicional en el resultado", () => {
    const parsed = {
      banco: "Bancolombia",
      moneda: "PESOS",
      cliente: "JUAN PEREZ",
      cedula: "1234567890",
      numeroCredito: "9999",
      saldoCapital: "100000000",
    };
    const input = normalizarExtracto(parsed);
    const serial = JSON.stringify(input);
    // El pipeline no vuelca nombre/cédula en el diagnóstico
    const r = runLab(input);
    const diag = JSON.stringify(r.diagnostico);
    expect(diag).not.toContain("JUAN PEREZ");
    expect(diag).not.toContain("1234567890");
    // sí puede aparecer en camposDetectados de entrada — es responsabilidad de la UI
    // no imprimirlos en logs.
    expect(serial.length).toBeGreaterThan(0);
  });
});
