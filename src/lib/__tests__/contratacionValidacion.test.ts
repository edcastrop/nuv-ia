import { describe, test, expect } from "bun:test";
import {
  CONTRATACION_ATTACHMENT_MAX,
  CONTRATACION_CORREO_OBLIGATORIO,
  computeCedulasRequeridas,
  detectAttachmentLimitViolation,
  detectCotitularInconsistencies,
  detectSoporteCotitularPositions,
  enforceDestinatariosServer,
  normalizarCotitularesActivos,
  type SoporteRow,
} from "../contratacionValidacion";

const mkSoporte = (subcategoria: string | null, categoria = "identidad"): SoporteRow => ({
  categoria,
  subcategoria,
  archivo_nombre: `${subcategoria || categoria}.pdf`,
  archivo_path: `x/${subcategoria || categoria}.pdf`,
  mime_type: "application/pdf",
});

describe("detectAttachmentLimitViolation", () => {
  test("permite hasta el máximo", () => {
    expect(detectAttachmentLimitViolation(1)).toBeNull();
    expect(detectAttachmentLimitViolation(CONTRATACION_ATTACHMENT_MAX)).toBeNull();
  });
  test("bloquea sobre el máximo con mensaje que incluye ambos números", () => {
    const msg = detectAttachmentLimitViolation(11);
    expect(msg).not.toBeNull();
    expect(msg).toContain("11");
    expect(msg).toContain("10");
  });
});

describe("normalizarCotitularesActivos", () => {
  test("null / no-array → []", () => {
    expect(normalizarCotitularesActivos(null)).toEqual([]);
    expect(normalizarCotitularesActivos(undefined)).toEqual([]);
    expect(normalizarCotitularesActivos({})).toEqual([]);
  });
  test("filtra por activo y nombre válido", () => {
    const out = normalizarCotitularesActivos([
      { nombre: "Ana", activo: true },
      { nombre: "  ", activo: true },
      { nombre: "Beto", activo: false },
      { nombre: "Carlos" },
    ]);
    expect(out.map((c) => c.nombre)).toEqual(["Ana", "Carlos"]);
  });
});

describe("computeCedulasRequeridas", () => {
  test("titular solo cuando no hay cotitulares", () => {
    expect(computeCedulasRequeridas([])).toEqual(["cedula_titular"]);
  });
  test("titular + cotitular_1..N", () => {
    expect(computeCedulasRequeridas([{ nombre: "A" }, { nombre: "B" }])).toEqual([
      "cedula_titular",
      "cedula_cotitular_1",
      "cedula_cotitular_2",
    ]);
  });
});

describe("detectSoporteCotitularPositions", () => {
  test("extrae posiciones ordenadas y únicas", () => {
    const soportes = [
      mkSoporte("cedula_cotitular_2"),
      mkSoporte("cedula_titular"),
      mkSoporte("cedula_cotitular_1"),
      mkSoporte("cedula_cotitular_1"),
    ];
    expect(detectSoporteCotitularPositions(soportes)).toEqual([1, 2]);
  });
  test("ignora otras categorías", () => {
    expect(
      detectSoporteCotitularPositions([mkSoporte("cedula_cotitular_1", "extracto_banco")]),
    ).toEqual([]);
  });
});

describe("detectCotitularInconsistencies (caso 000201)", () => {
  test("cedula_cotitular_1 presente pero cotitulares vacío → bloquea", () => {
    const soportes = [mkSoporte("cedula_titular"), mkSoporte("cedula_cotitular_1")];
    const msgs = detectCotitularInconsistencies(soportes, []);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("Inconsistencia documental");
    expect(msgs[0]).toContain("cotitular 1");
    expect(msgs[0]).toContain("cliente_data");
  });
  test("cedula_cotitular_1 + cotitulares=[{Ana}] → OK", () => {
    const soportes = [mkSoporte("cedula_titular"), mkSoporte("cedula_cotitular_1")];
    expect(detectCotitularInconsistencies(soportes, [{ nombre: "Ana" }])).toEqual([]);
  });
  test("cedula_cotitular_2 sin cotitular 2 registrado → bloquea aunque el 1 esté OK", () => {
    const soportes = [
      mkSoporte("cedula_titular"),
      mkSoporte("cedula_cotitular_1"),
      mkSoporte("cedula_cotitular_2"),
    ];
    const msgs = detectCotitularInconsistencies(soportes, [{ nombre: "Ana" }]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("cotitular 2");
  });
  test("caso 000046 (sin cédulas, sin cotitulares) → sin inconsistencias por este chequeo", () => {
    expect(detectCotitularInconsistencies([], [])).toEqual([]);
  });
});

describe("enforceDestinatariosServer", () => {
  test("fuerza correo obligatorio aunque el cliente no lo mande", () => {
    const { finales } = enforceDestinatariosServer([], []);
    expect(finales).toContain(CONTRATACION_CORREO_OBLIGATORIO);
  });
  test("descarta correos que no están en lista blanca", () => {
    const { finales, rechazados } = enforceDestinatariosServer(
      ["EXTRA@evil.com", "ok@nuvex.com.co"],
      ["ok@nuvex.com.co"],
    );
    expect(finales).toContain(CONTRATACION_CORREO_OBLIGATORIO);
    expect(finales).toContain("ok@nuvex.com.co");
    expect(finales).not.toContain("extra@evil.com");
    expect(rechazados).toContain("extra@evil.com");
  });
  test("normaliza a minúsculas y deduplica", () => {
    const { finales } = enforceDestinatariosServer(
      ["Ok@Nuvex.com.co", "ok@nuvex.com.co"],
      ["ok@nuvex.com.co"],
    );
    const filtered = finales.filter((e) => e === "ok@nuvex.com.co");
    expect(filtered).toHaveLength(1);
  });
});
