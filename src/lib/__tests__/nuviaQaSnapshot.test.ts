import { describe, it, expect } from "vitest";
import {
  buildPesosQaSnapshot,
  buildUvrQaSnapshot,
  hashQaSnapshot,
  decideAutoQADispatch,
  decideAutoQAResult,
  type PesosSnapshotInput,
  type UvrSnapshotInput,
} from "@/lib/nuviaQaSnapshot";

const basePesos = (overrides: Partial<PesosSnapshotInput> = {}): PesosSnapshotInput => ({
  banco: "Bancolombia",
  producto: "Hipotecario Pesos",
  cedula: "123",
  numeroCredito: "999",
  cliente: "Ana",
  saldoCapital: 120_000_000,
  cuotaActual: 1_500_000,
  seguros: 45_000,
  tea: 0.1523,
  plazoInicial: 240,
  cuotasPagadas: 40,
  cuotasPendientes: 200,
  archivoPath: "path/A.pdf",
  archivoNombre: "A.pdf",
  ...overrides,
});

const baseUvr = (overrides: Partial<UvrSnapshotInput> = {}): UvrSnapshotInput => ({
  banco: "Davivienda",
  producto: "Hipotecario UVR",
  saldoUVR: 250_000,
  valorUVR: 400,
  cuotaActualPesos: 1_800_000,
  seguros: 60_000,
  teaCobrada: 0.1198,
  variacionUVR: 0.065,
  variacionUVRPropuestas: 0.055,
  plazoInicial: 180,
  cuotasPagadas: 30,
  cuotasPendientes: 150,
  ...overrides,
});

describe("buildPesosQaSnapshot", () => {
  it("genera un snapshot normalizado con moneda=COP y tipoCredito=pesos", () => {
    const s = buildPesosQaSnapshot(basePesos());
    expect(s.moneda).toBe("COP");
    expect(s.tipoCredito).toBe("pesos");
    expect(s.datos).toBeDefined();
    expect((s.datos as Record<string, unknown>).saldoCapital).toBe(120_000_000);
    expect((s.datos as Record<string, unknown>).tasaEA).toBe(0.1523);
  });
});

describe("buildUvrQaSnapshot", () => {
  it("emite modalidad=uvr y moneda=UVR explícitas", () => {
    const s = buildUvrQaSnapshot(baseUvr());
    const d = s.datos as Record<string, unknown>;
    expect(s.moneda).toBe("UVR");
    expect(s.tipoCredito).toBe("uvr");
    expect(d.modalidad).toBe("uvr");
    expect(d.moneda).toBe("UVR");
    expect(d.saldoUVR).toBe(250_000);
    expect(d.valorUVR).toBe(400);
  });
});

describe("hashQaSnapshot — identidad canónica", () => {
  it("dos snapshots equivalentes producen el mismo hash", () => {
    const a = buildPesosQaSnapshot(basePesos());
    const b = buildPesosQaSnapshot(basePesos());
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("archivoPath / archivoNombre no cambian el hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ archivoPath: "x.pdf", archivoNombre: "x" }));
    const b = buildPesosQaSnapshot(basePesos({ archivoPath: "y.pdf", archivoNombre: "y" }));
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("un cambio financiero real modifica el hash", () => {
    const a = buildPesosQaSnapshot(basePesos());
    const b = buildPesosQaSnapshot(basePesos({ saldoCapital: 121_000_000 }));
    expect(hashQaSnapshot(a)).not.toBe(hashQaSnapshot(b));
  });

  it("cambios en TEA modifican el hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ tea: 0.15 }));
    const b = buildPesosQaSnapshot(basePesos({ tea: 0.1501 }));
    expect(hashQaSnapshot(a)).not.toBe(hashQaSnapshot(b));
  });

  it("UVR y Pesos con mismos números producen hashes distintos (modalidad separa)", () => {
    const p = buildPesosQaSnapshot(basePesos());
    const u = buildUvrQaSnapshot(baseUvr());
    expect(hashQaSnapshot(p)).not.toBe(hashQaSnapshot(u));
  });

  it("string numérico y number equivalente producen el mismo hash", () => {
    const a = buildPesosQaSnapshot(basePesos({ plazoInicial: 240 }));
    const b = buildPesosQaSnapshot(basePesos({ plazoInicial: "240" }));
    expect(hashQaSnapshot(a)).toBe(hashQaSnapshot(b));
  });

  it("snapshot nulo produce hash vacío", () => {
    expect(hashQaSnapshot(null)).toBe("");
  });
});

describe("decideAutoQADispatch — control de re-programación", () => {
  const base = {
    hasIntent: true,
    currentHash: "A",
    inflightHash: null as string | null,
    successHash: null as string | null,
    failedHash: null as string | null,
  };

  it("sin intención → skip", () => {
    expect(decideAutoQADispatch({ ...base, hasIntent: false }).kind).toBe("skip");
  });

  it("sin hash → skip", () => {
    expect(decideAutoQADispatch({ ...base, currentHash: "" }).kind).toBe("skip");
  });

  it("hash actual ya exitoso → clear-intent (no re-ejecuta)", () => {
    const r = decideAutoQADispatch({ ...base, successHash: "A" });
    expect(r.kind).toBe("clear-intent");
  });

  it("hash actual falló → skip (espera retry manual, no reintento infinito)", () => {
    const r = decideAutoQADispatch({ ...base, failedHash: "A" });
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") expect(r.reason).toBe("failed-waiting-retry");
  });

  it("hash A en vuelo y snapshot cambia a B → skip hasta liberar inflight", () => {
    const r = decideAutoQADispatch({ ...base, currentHash: "B", inflightHash: "A" });
    expect(r.kind).toBe("skip");
  });

  it("hash actual en vuelo → skip (evita doble dispatch)", () => {
    const r = decideAutoQADispatch({ ...base, inflightHash: "A" });
    expect(r.kind).toBe("skip");
  });

  it("hash nuevo, sin inflight, sin fallos → dispatch", () => {
    const r = decideAutoQADispatch(base);
    expect(r.kind).toBe("dispatch");
    if (r.kind === "dispatch") expect(r.hash).toBe("A");
  });

  it("A → B → C: sólo C se despacha cuando A libera inflight", () => {
    // Fase 1: efecto ve intent+A, inflight null → dispatch A
    const d1 = decideAutoQADispatch({ ...base, currentHash: "A" });
    expect(d1.kind).toBe("dispatch");
    // Fase 2: snapshot cambia a B; A sigue inflight → skip
    const d2 = decideAutoQADispatch({ ...base, currentHash: "B", inflightHash: "A" });
    expect(d2.kind).toBe("skip");
    // Fase 3: snapshot ahora C; A sigue inflight → skip
    const d3 = decideAutoQADispatch({ ...base, currentHash: "C", inflightHash: "A" });
    expect(d3.kind).toBe("skip");
    // Fase 4: A libera (resultado obsoleto descarta y limpia inflight);
    // efecto vuelve a correr con snapshot actual C → dispatch C
    const d4 = decideAutoQADispatch({ ...base, currentHash: "C", inflightHash: null });
    expect(d4.kind).toBe("dispatch");
    if (d4.kind === "dispatch") expect(d4.hash).toBe("C");
  });
});

describe("decideAutoQAResult — reconciliación de resultado", () => {
  it("inflight coincide con resultado → apply", () => {
    expect(decideAutoQAResult({ resultHash: "A", inflightHash: "A" }).kind).toBe("apply");
  });

  it("inflight cambió a otro hash (edición durante await) → obsolete", () => {
    expect(decideAutoQAResult({ resultHash: "A", inflightHash: "B" }).kind).toBe("obsolete");
  });

  it("inflight limpio (superado y liberado) → obsolete", () => {
    expect(decideAutoQAResult({ resultHash: "A", inflightHash: null }).kind).toBe("obsolete");
  });
});

// ─── v2 contract, downgrade y reconstrucción legacy ─────────────────
import {
  SNAPSHOT_VERSION,
  downgradeToV1,
  validateAuditSnapshotContract,
  reconstructLegacyUvrScenarios,
  type SnapshotEscenario,
} from "@/lib/nuviaQaSnapshot";

const mkEscenarios = (n = 4): SnapshotEscenario[] =>
  Array.from({ length: n }, (_, i) => ({
    index: i,
    cuotasEliminadas: 12 * (i + 1),
    añosEliminados: i + 1,
    nuevoPlazo: 240 - 12 * (i + 1),
    nuevaCuota: 1_600_000 + i * 50_000,
    ahorroIntereses: 10_000_000 * (i + 1),
    ahorroSeguros: 500_000 * (i + 1),
    ahorroTotal: 10_500_000 * (i + 1),
    honorarios: 800_000 * (i + 1),
    totalProyectado: 12_000_000 * (i + 1),
    incrementoMensual: 20_000 * (i + 1),
    fuente: "automatica",
  }));

describe("Snapshot v2 · contrato, hash y downgrade", () => {
  it("buildUvrQaSnapshot marca snapshotVersion=2 y persiste escenarios", () => {
    const snap = buildUvrQaSnapshot({ ...baseUvr(), escenarios: mkEscenarios() });
    expect(snap.datos.snapshotVersion).toBe(SNAPSHOT_VERSION);
    expect(Array.isArray(snap.datos.propuestasComerciales)).toBe(true);
    expect((snap.datos.propuestasComerciales as unknown[]).length).toBe(4);
  });

  it("validateAuditSnapshotContract clasifica v2 → historico_persistido", () => {
    const snap = buildUvrQaSnapshot({ ...baseUvr(), escenarios: mkEscenarios() });
    const c = validateAuditSnapshotContract(snap);
    expect(c.kind).toBe("historico_persistido");
    if (c.kind === "historico_persistido") expect(c.escenarios.length).toBe(4);
  });

  it("clasifica v1 legacy (sin propuestas) → reconstruido_legacy", () => {
    const snap = buildUvrQaSnapshot(baseUvr());
    // simular v1: quitar version y propuestas
    delete (snap.datos as any).snapshotVersion;
    delete (snap.datos as any).propuestasComerciales;
    const c = validateAuditSnapshotContract(snap);
    expect(c.kind).toBe("reconstruido_legacy");
  });

  it("clasifica v2 sin propuestas → invalido_v2", () => {
    const snap = buildUvrQaSnapshot({ ...baseUvr(), escenarios: [] });
    (snap.datos as any).snapshotVersion = 2;
    (snap.datos as any).propuestasComerciales = null;
    const c = validateAuditSnapshotContract(snap);
    expect(c.kind).toBe("invalido_v2");
  });

  it("downgradeToV1 elimina snapshotVersion y propuestas → hash estable v1", () => {
    const withEsc = buildUvrQaSnapshot({ ...baseUvr(), escenarios: mkEscenarios() });
    const noEsc = buildUvrQaSnapshot(baseUvr());
    // Sin degradar, los hashes difieren (v2 vs v1 legacy).
    expect(hashQaSnapshot(withEsc)).not.toBe(hashQaSnapshot(noEsc));
    // Degradados, ambos colapsan al mismo hash v1.
    expect(hashQaSnapshot(downgradeToV1(withEsc))).toBe(hashQaSnapshot(downgradeToV1(noEsc)));
  });

  it("una edición financiera real cambia el hash incluso tras downgrade v1", () => {
    const a = downgradeToV1(buildUvrQaSnapshot({ ...baseUvr(), escenarios: mkEscenarios() }));
    const b = downgradeToV1(buildUvrQaSnapshot({ ...baseUvr({ saldoUVR: 260_000 }), escenarios: mkEscenarios() }));
    expect(hashQaSnapshot(a)).not.toBe(hashQaSnapshot(b));
  });
});

describe("reconstructLegacyUvrScenarios · precedencia snapshot sobre inputs", () => {
  it("devuelve 4 escenarios cuando hay datos suficientes", () => {
    const r = reconstructLegacyUvrScenarios({
      saldoUVR: 250_000,
      valorUVR: 400,
      cuotaActualPesos: 1_800_000,
      teaCobrada: 11.98,
      variacionUVR: 6,
      plazoInicial: 180,
      cuotasPendientes: 150,
      seguros: 60_000,
    }, null);
    expect(r).not.toBeNull();
    expect(r!.escenarios.length).toBe(4);
  });

  it("prima la variación UVR del snapshot cuando difiere de inputs", () => {
    const r = reconstructLegacyUvrScenarios({
      saldoUVR: 250_000,
      valorUVR: 400,
      cuotaActualPesos: 1_800_000,
      teaCobrada: 11.98,
      variacionUVR: 6,
      plazoInicial: 180,
      cuotasPendientes: 150,
      seguros: 60_000,
    }, { snapshotValue: 6, inputsValue: 5.2 });
    expect(r!.uvrVariationConflict).toEqual({ snapshotValue: 6, inputsValue: 5.2, chosen: 6 });
  });

  it("devuelve null cuando faltan variables críticas", () => {
    const r = reconstructLegacyUvrScenarios({
      saldoUVR: 0, valorUVR: 0, cuotaActualPesos: 0, teaCobrada: 0,
      variacionUVR: 0, plazoInicial: 0, cuotasPendientes: 0, seguros: 0,
    }, null);
    expect(r).toBeNull();
  });
});
