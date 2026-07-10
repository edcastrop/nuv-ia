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
  resolveCotitularesFromClienteData,
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

describe("resolveCotitularesFromClienteData — esquema nuevo (cotitulares[])", () => {
  test("null / vacío → [] sin conflictos", () => {
    expect(resolveCotitularesFromClienteData(null)).toEqual({ cotitulares: [], conflicts: [] });
    expect(resolveCotitularesFromClienteData({})).toEqual({ cotitulares: [], conflicts: [] });
    expect(resolveCotitularesFromClienteData({ cotitulares: [] })).toEqual({ cotitulares: [], conflicts: [] });
  });
  test("filtra inactivos y registra fuente", () => {
    const { cotitulares, conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [
        { nombre: "Ana Pérez", cedula: "111", activo: true },
        { nombre: "Beto", cedula: "222", activo: false },
        { nombre: "Carlos" },
      ],
    });
    expect(conflicts).toEqual([]);
    expect(cotitulares.map((c) => ({ nombre: c.nombre, cedula: c.cedula, sources: c.sources }))).toEqual([
      { nombre: "Ana Pérez", cedula: "111", sources: ["cotitulares"] },
      { nombre: "Carlos", cedula: null, sources: ["cotitulares"] },
    ]);
  });
});

describe("resolveCotitularesFromClienteData — esquema histórico (informacionJuridica)", () => {
  test("informacionJuridica.cotitular activo → 1 cotitular resuelto", () => {
    const { cotitulares, conflicts } = resolveCotitularesFromClienteData({
      informacionJuridica: {
        cotitular: {
          activo: true,
          nombre: "MANUEL ALBERTO ARIAS ARIZA",
          cedula: "1033699568",
        },
      },
    });
    expect(conflicts).toEqual([]);
    expect(cotitulares).toHaveLength(1);
    expect(cotitulares[0]).toMatchObject({
      cedula: "1033699568",
      nombre: "MANUEL ALBERTO ARIAS ARIZA",
      sources: ["informacionJuridica"],
    });
  });
  test("informacionJuridica.cotitular con activo=false → descartado", () => {
    const { cotitulares } = resolveCotitularesFromClienteData({
      informacionJuridica: { cotitular: { activo: false, nombre: "X", cedula: "999" } },
    });
    expect(cotitulares).toEqual([]);
  });
});

describe("resolveCotitularesFromClienteData — esquema intervinientes[]", () => {
  test("normaliza rol (tildes, mayúsculas, espacios)", () => {
    const { cotitulares } = resolveCotitularesFromClienteData({
      intervinientes: [
        { rol: "Titular", nombreCompleto: "T", cedula: "1" },
        { rol: "  cotitular  ", nombreCompleto: "C1", cedula: "10" },
        { rol: "COTITULAR", nombreCompleto: "C2", cedula: "20" },
        { rol: "Codeudór", nombreCompleto: "X", cedula: "30" }, // no cotitular
      ],
    });
    const cedulas = cotitulares.map((c) => c.cedula);
    expect(cedulas).toEqual(["10", "20"]);
  });
});

describe("resolveCotitularesFromClienteData — combinación de las 3 fuentes (caso 000201)", () => {
  const clienteData000201 = {
    // esquema nuevo NO presente (null) — caso real
    cotitulares: null,
    informacionJuridica: {
      cotitular: {
        activo: true,
        nombre: "MANUEL ALBERTO ARIAS ARIZA",
        cedula: "1033699568",
      },
      titular: { nombre: "JENIFER ANDREA MORENO SAMUDIO", cedula: "1020748272" },
    },
    intervinientes: [
      { rol: "Titular", nombreCompleto: "JENIFER ANDREA MORENO SAMUDIO", cedula: "1020748272" },
      { rol: "Cotitular", nombreCompleto: "MANUEL ALBERTO ARIAS ARIZA", cedula: "1033699568" },
    ],
  };

  test("cotitular declarado en informacionJuridica + intervinientes → dedup en 1 con 2 fuentes", () => {
    const { cotitulares, conflicts } = resolveCotitularesFromClienteData(clienteData000201);
    expect(conflicts).toEqual([]);
    expect(cotitulares).toHaveLength(1);
    expect(cotitulares[0].cedula).toBe("1033699568");
    expect(cotitulares[0].nombre.toUpperCase()).toContain("MANUEL ALBERTO ARIAS ARIZA");
    expect(cotitulares[0].sources.sort()).toEqual(["informacionJuridica", "intervinientes"]);
  });

  test("computeCedulasRequeridas incluye titular + cotitular_1 (una sola posición)", () => {
    const { cotitulares } = resolveCotitularesFromClienteData(clienteData000201);
    expect(computeCedulasRequeridas(cotitulares)).toEqual(["cedula_titular", "cedula_cotitular_1"]);
  });

  test("cedula_cotitular_1 en soportes NO produce inconsistencia y no duplica adjunto", () => {
    const { cotitulares } = resolveCotitularesFromClienteData(clienteData000201);
    const soportes = [mkSoporte("cedula_titular"), mkSoporte("cedula_cotitular_1")];
    expect(detectCotitularInconsistencies(soportes, cotitulares)).toEqual([]);
  });
});

describe("resolveCotitularesFromClienteData — deduplicación", () => {
  test("misma cédula en tres fuentes → 1 cotitular con 3 sources", () => {
    const { cotitulares, conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana Perez", cedula: "111", activo: true }],
      informacionJuridica: { cotitular: { activo: true, nombre: "ANA PEREZ", cedula: "111" } },
      intervinientes: [{ rol: "Cotitular", nombreCompleto: "Ana  Pérez", cedula: "111" }],
    });
    expect(conflicts).toEqual([]);
    expect(cotitulares).toHaveLength(1);
    expect(cotitulares[0].sources.sort()).toEqual(["cotitulares", "informacionJuridica", "intervinientes"]);
  });

  test("orden determinístico por cédula ASC", () => {
    const { cotitulares } = resolveCotitularesFromClienteData({
      cotitulares: [
        { nombre: "Z", cedula: "999", activo: true },
        { nombre: "A", cedula: "100", activo: true },
        { nombre: "M", cedula: "500", activo: true },
      ],
    });
    expect(cotitulares.map((c) => c.cedula)).toEqual(["100", "500", "999"]);
  });

  test("sin cédula → dedup por nombre normalizado (tildes/espacios/mayúsculas)", () => {
    const { cotitulares } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana  Pérez" }],
      intervinientes: [{ rol: "Cotitular", nombreCompleto: "ANA PEREZ" }],
    });
    expect(cotitulares).toHaveLength(1);
    expect(cotitulares[0].sources.sort()).toEqual(["cotitulares", "intervinientes"]);
  });
});

describe("resolveCotitularesFromClienteData — contradicciones", () => {
  test("misma cédula con nombres materialmente distintos → conflicto", () => {
    const { conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana Perez", cedula: "111", activo: true }],
      intervinientes: [{ rol: "Cotitular", nombreCompleto: "Beto Ramirez", cedula: "111" }],
    });
    expect(conflicts.some((c) => c.code === "cedula_nombres_distintos")).toBe(true);
    // No filtra información sensible: cédula enmascarada, nombre no aparece completo
    const msg = conflicts.find((c) => c.code === "cedula_nombres_distintos")!.message;
    expect(msg).not.toContain("111");
    expect(msg).toContain("***111");
  });

  test("mismo nombre con cédulas distintas → conflicto", () => {
    const { conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana Perez", cedula: "111", activo: true }],
      intervinientes: [{ rol: "Cotitular", nombreCompleto: "Ana Perez", cedula: "222" }],
    });
    expect(conflicts.some((c) => c.code === "nombre_cedulas_distintas")).toBe(true);
  });

  test("cotitular activo en una fuente e inactivo en otra → conflicto", () => {
    const { conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana", cedula: "111", activo: false }],
      informacionJuridica: { cotitular: { activo: true, nombre: "Ana", cedula: "111" } },
    });
    expect(conflicts.some((c) => c.code === "activo_vs_inactivo")).toBe(true);
  });

  test("no elige silenciosamente una fuente ganadora: la contradicción se REPORTA", () => {
    const { conflicts } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana Perez", cedula: "111", activo: true }],
      intervinientes: [{ rol: "Cotitular", nombreCompleto: "Beto Ramirez", cedula: "111" }],
    });
    expect(conflicts.length).toBeGreaterThan(0);
  });
});

describe("detectCotitularInconsistencies — soportes huérfanos", () => {
  test("cedula_cotitular_2 sin cotitular 2 resuelto → bloquea aunque el 1 esté OK", () => {
    const soportes = [
      mkSoporte("cedula_titular"),
      mkSoporte("cedula_cotitular_1"),
      mkSoporte("cedula_cotitular_2"),
    ];
    const { cotitulares } = resolveCotitularesFromClienteData({
      cotitulares: [{ nombre: "Ana", cedula: "111", activo: true }],
    });
    const msgs = detectCotitularInconsistencies(soportes, cotitulares);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain("cotitular 2");
  });

  test("caso 000046 (sin cédulas, sin cotitulares) → sin inconsistencias por este chequeo", () => {
    expect(detectCotitularInconsistencies([], [])).toEqual([]);
  });

  test("normalizarCotitularesActivos mantiene retro-compat con esquema nuevo", () => {
    const out = normalizarCotitularesActivos([
      { nombre: "Ana", cedula: "111", activo: true },
      { nombre: "Beto", cedula: "222", activo: false },
    ]);
    expect(out.map((c) => c.nombre)).toEqual(["Ana"]);
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
