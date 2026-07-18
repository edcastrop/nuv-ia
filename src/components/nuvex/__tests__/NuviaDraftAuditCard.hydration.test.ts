// Cobertura de la lógica de hidratación de `doneHashRef` en
// `NuviaDraftAuditCard`. La tarjeta clasifica el snapshot original de la
// auditoría (`auditedSnapshot`) para decidir con qué hash comparar el
// snapshot actual del formulario: v2 se compara tal cual; v1 y snapshots
// sin versión se comparan tras `downgradeToV1` para no invalidar
// auditorías históricas.
//
// Estas pruebas ejercitan la MISMA composición de funciones puras
// (`validateAuditSnapshotContract` + `downgradeToV1` + `hashQaSnapshot`)
// que ejecuta el efecto de hidratación, sin necesidad de renderizar la
// tarjeta completa (que depende de simuladores complejos).

import { describe, it, expect } from "vitest";
import {
  hashQaSnapshot,
  downgradeToV1,
  validateAuditSnapshotContract,
  buildUvrQaSnapshot,
  SNAPSHOT_VERSION,
  type SnapshotEscenario,
} from "@/lib/nuviaQaSnapshot";
import { evaluateSnapshotTransition } from "@/components/nuvex/NuviaDraftAuditCard";

const ESC: SnapshotEscenario[] = [
  { index: 0, cuotasEliminadas: 12, añosEliminados: 1, nuevoPlazo: 168, nuevaCuota: 1_500_000, ahorroIntereses: 6_000_000, ahorroSeguros: 2_000_000, ahorroTotal: 8_000_000, honorarios: 480_000, totalProyectado: 260_000_000, incrementoMensual: 100_000, fuente: "automatica" },
  { index: 1, cuotasEliminadas: 24, añosEliminados: 2, nuevoPlazo: 156, nuevaCuota: 1_600_000, ahorroIntereses: 12_000_000, ahorroSeguros: 3_000_000, ahorroTotal: 15_000_000, honorarios: 900_000, totalProyectado: 245_000_000, incrementoMensual: 180_000, fuente: "automatica" },
  { index: 2, cuotasEliminadas: 36, añosEliminados: 3, nuevoPlazo: 144, nuevaCuota: 1_700_000, ahorroIntereses: 18_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 22_000_000, honorarios: 1_320_000, totalProyectado: 230_000_000, incrementoMensual: 260_000, fuente: "automatica" },
  { index: 3, cuotasEliminadas: 48, añosEliminados: 4, nuevoPlazo: 132, nuevaCuota: 1_800_000, ahorroIntereses: 24_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 28_000_000, honorarios: 1_680_000, totalProyectado: 215_000_000, incrementoMensual: 340_000, fuente: "automatica" },
];

// Reproducción exacta del algoritmo de hidratación en la tarjeta.
function computeAuditedHash(snap: ReturnType<typeof buildUvrQaSnapshot>): string {
  const contract = validateAuditSnapshotContract(snap);
  const isV2 = contract.kind === "historico_persistido";
  const compare = isV2 ? snap : downgradeToV1(snap);
  return hashQaSnapshot(compare);
}

const BASE_UVR = {
  banco: "Davivienda",
  producto: "Hipotecario UVR",
  cedula: "1000",
  numeroCredito: "77",
  cliente: "Ada L.",
  saldoUVR: 50_000,
  valorUVR: 350,
  cuotaActualPesos: 2_000_000,
  seguros: 120_000,
  teaCobrada: 12,
  variacionUVR: 6,
  plazoInicial: 240,
  cuotasPendientes: 180,
} as const;

describe("NuviaDraftAuditCard · hidratación de doneHashRef", () => {
  it("auditoría v1 restaurada → hash comparado se calcula tras downgradeToV1", () => {
    // Snapshot original v1: builder v2 con escenarios, retrogradado a v1.
    const originalV2 = buildUvrQaSnapshot({ ...BASE_UVR, escenarios: [...ESC] });
    const originalV1 = downgradeToV1(originalV2)!;
    // Sanity: es v1 y no tiene propuestas persistidas.
    expect(validateAuditSnapshotContract(originalV1).kind).toBe("reconstruido_legacy");

    // El formulario actual reconstruye un snapshot v2 idéntico
    // financieramente. La tarjeta debe considerar la auditoría vigente.
    const currentV2 = buildUvrQaSnapshot({ ...BASE_UVR, escenarios: [...ESC] });
    const currentHashDownV1 = hashQaSnapshot(downgradeToV1(currentV2));

    // Hidratación con snapshot v1 → hash comparado = hash del actual tras
    // downgrade a v1 (misma familia canónica).
    expect(computeAuditedHash(originalV1)).toBe(currentHashDownV1);
  });

  it("auditoría v2 restaurada → hash comparado se calcula con snapshot v2 tal cual", () => {
    const originalV2 = buildUvrQaSnapshot({ ...BASE_UVR, escenarios: [...ESC] });
    expect(validateAuditSnapshotContract(originalV2).kind).toBe("historico_persistido");

    const currentV2 = buildUvrQaSnapshot({ ...BASE_UVR, escenarios: [...ESC] });
    // Sin downgrade: los hashes v2 deben coincidir para snapshots
    // financieramente equivalentes y con los mismos escenarios.
    expect(computeAuditedHash(originalV2)).toBe(hashQaSnapshot(currentV2));
  });

  it("editar un dato financiero (saldo UVR) invalida la auditoría vía transición 'invalidate'", () => {
    const originalV2 = buildUvrQaSnapshot({ ...BASE_UVR, escenarios: [...ESC] });
    const doneHash = hashQaSnapshot(originalV2);

    // El analista edita saldoUVR → el hash del snapshot actual cambia.
    const editedV2 = buildUvrQaSnapshot({ ...BASE_UVR, saldoUVR: 51_000, escenarios: [...ESC] });
    const newHash = hashQaSnapshot(editedV2);
    expect(newHash).not.toBe(doneHash);

    // La máquina de estados debe pasar a `invalidate` desde `done`.
    const t = evaluateSnapshotTransition({
      prevKind: "done",
      doneHash,
      lastEmittedHash: doneHash,
      newHash,
      wasFirst: false,
    });
    expect(t.kind).toBe("invalidate");
  });

  it("snapshot v2 inválido (version=2 sin propuestasComerciales) NUNCA se clasifica como legacy", () => {
    const brokenV2 = {
      banco: "X",
      producto: "Y",
      moneda: "UVR" as const,
      tipoCredito: "uvr" as const,
      datos: {
        modalidad: "uvr",
        moneda: "UVR",
        saldoUVR: 50_000,
        valorUVR: 350,
        cuotaActualPesos: 2_000_000,
        teaCobrada: 12,
        variacionUVR: 6,
        plazoInicial: 240,
        cuotasPendientes: 180,
        snapshotVersion: 2,
        // Ausente: propuestasComerciales
      },
      archivoPath: null,
      archivoNombre: null,
    };
    const contract = validateAuditSnapshotContract(brokenV2);
    expect(contract.kind).toBe("invalido_v2");
    if (contract.kind === "invalido_v2") {
      expect(contract.reason).toBe("v2_sin_propuestas");
    }
    // La tarjeta NO debe retrogradar a v1 en este caso: se mantiene el
    // snapshot tal cual, y su hash v2 no coincidirá con un v1
    // reconstruido de un formulario válido.
    expect(SNAPSHOT_VERSION).toBe(2);
  });
});
