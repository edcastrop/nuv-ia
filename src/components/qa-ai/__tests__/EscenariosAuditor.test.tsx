/// <reference types="@testing-library/jest-dom" />
// Cobertura de render para `EscenariosAuditor` (bloque interno de
// `ReconstruccionAuditorBlock`). Verifica los cinco orígenes documentados
// del contrato + la derivación estricta de `recommendedIndex` y la
// invariante de "cuatro escenarios o ninguno".

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EscenariosAuditor } from "@/components/qa-ai/ReconstruccionAuditorBlock";
import { SNAPSHOT_VERSION } from "@/lib/nuviaQaSnapshot";

const ESC_V2 = [
  { index: 0, cuotasEliminadas: 12, añosEliminados: 1, nuevoPlazo: 168, nuevaCuota: 1_500_000, ahorroIntereses: 6_000_000, ahorroSeguros: 2_000_000, ahorroTotal: 8_000_000, honorarios: 480_000, totalProyectado: 260_000_000, incrementoMensual: 100_000, fuente: "automatica" as const },
  { index: 1, cuotasEliminadas: 24, añosEliminados: 2, nuevoPlazo: 156, nuevaCuota: 1_600_000, ahorroIntereses: 12_000_000, ahorroSeguros: 3_000_000, ahorroTotal: 15_000_000, honorarios: 900_000, totalProyectado: 245_000_000, incrementoMensual: 180_000, fuente: "automatica" as const },
  { index: 2, cuotasEliminadas: 36, añosEliminados: 3, nuevoPlazo: 144, nuevaCuota: 1_700_000, ahorroIntereses: 18_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 22_000_000, honorarios: 1_320_000, totalProyectado: 230_000_000, incrementoMensual: 260_000, fuente: "automatica" as const },
  { index: 3, cuotasEliminadas: 48, añosEliminados: 4, nuevoPlazo: 132, nuevaCuota: 1_800_000, ahorroIntereses: 24_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 28_000_000, honorarios: 1_680_000, totalProyectado: 215_000_000, incrementoMensual: 340_000, fuente: "automatica" as const },
];

const V1_LEGACY_DATOS = {
  modalidad: "uvr",
  moneda: "UVR",
  saldoUVR: 50_000,
  valorUVR: 350,
  cuotaActualPesos: 2_000_000,
  cuotaActual: 2_000_000,
  teaCobrada: 12,
  tasaEA: 12,
  variacionUVR: 6,
  plazoInicial: 240,
  cuotasPendientes: 180,
  seguros: 120_000,
};

const V1_LEGACY_INPUTS_CONFLICT = {
  reconstruccion: { variacionUvrEa: 5.2 },
};

function makeV2Auditoria(overrides: Partial<{
  escenarios: typeof ESC_V2 | typeof ESC_V2[number][] | null;
  propuesta: Record<string, unknown> | null;
}> = {}) {
  return {
    simulador_snapshot: {
      banco: "Davivienda",
      producto: "Hipotecario UVR",
      moneda: "UVR",
      tipoCredito: "uvr",
      datos: {
        ...V1_LEGACY_DATOS,
        snapshotVersion: SNAPSHOT_VERSION,
        propuestasComerciales: overrides.escenarios !== undefined ? overrides.escenarios : ESC_V2,
      },
      archivoPath: null,
      archivoNombre: null,
      propuesta: overrides.propuesta ?? null,
    },
  };
}

describe("EscenariosAuditor · orígenes del contrato", () => {
  it("historico_persistido (v2 con 4 escenarios) → NO renderiza banner legacy y muestra 4 tarjetas", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria()} inputs={{}} modo="uvr" />);
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Escenarios no disponibles/i)).not.toBeInTheDocument();
    // Cuatro tarjetas → cuatro rótulos "Elimina …" en la grilla principal.
    expect(screen.getAllByText(/^Elimina/).length).toBe(4);
  });

  it("reconstruido_legacy (v1 UVR completo) → renderiza el banner de retrocompatibilidad", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: V1_LEGACY_DATOS,
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={{}} modo="uvr" />);
    expect(screen.getByText(/Escenarios reconstruidos por retrocompatibilidad/i)).toBeInTheDocument();
    expect(screen.getByText(/no incluye escenarios \(v1\)/i)).toBeInTheDocument();
  });

  it("reconstruido_legacy con conflicto UVR (snapshot 6 vs inputs 5.2) → renderiza ambos valores y el aplicado", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: V1_LEGACY_DATOS,
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={V1_LEGACY_INPUTS_CONFLICT} modo="uvr" />);
    const conflicto = screen.getByText(/Conflicto de Variación UVR EA/i);
    expect(conflicto).toBeInTheDocument();
    expect(conflicto.textContent).toMatch(/snapshot=6%/);
    expect(conflicto.textContent).toMatch(/inputs=5\.2%/);
    expect(conflicto.textContent).toMatch(/aplicado=6%/);
  });

  it("origen=null (invalido_v2: v2 sin propuestasComerciales) → mensaje explícito, sin fallback legacy y sin tarjetas", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: {
          ...V1_LEGACY_DATOS,
          snapshotVersion: 2,
        },
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={{}} modo="uvr" />);
    expect(screen.getByText(/Escenarios no disponibles/i)).toBeInTheDocument();
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
    expect(screen.getByText(/re-auditar/i)).toBeInTheDocument();
  });

  it("origen=null por versión desconocida → mensaje explícito sin fallback legacy", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: { ...V1_LEGACY_DATOS, snapshotVersion: 99 },
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={{}} modo="uvr" />);
    expect(screen.getByText(/Versión de snapshot desconocida/i)).toBeInTheDocument();
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
  });
});

describe("EscenariosAuditor · derivación de recommendedIndex", () => {
  it("propuesta.index válido (2) → resalta EXACTAMENTE esa tarjeta", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ propuesta: { index: 2, cuotasEliminadas: 36 } })} inputs={{}} modo="uvr" />);
    expect(screen.getAllByText(/Escenario recomendado/i).length).toBe(1);
  });

  it("propuesta.index fuera de rango (7) → NO resalta ninguna tarjeta como recomendada", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ propuesta: { index: 7 } })} inputs={{}} modo="uvr" />);
    expect(screen.queryByText(/Escenario recomendado/i)).not.toBeInTheDocument();
  });

  it("sin propuesta → NO resalta ninguna tarjeta como recomendada (sin fallback a 0)", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ propuesta: null })} inputs={{}} modo="uvr" />);
    expect(screen.queryByText(/Escenario recomendado/i)).not.toBeInTheDocument();
  });

  it("coincidencia inequívoca por cuotasEliminadas → resalta la tarjeta correcta", () => {
    // No index; sólo cuotasEliminadas=48 coincide con ESC_V2[3].
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ propuesta: { cuotasEliminadas: 48 } })} inputs={{}} modo="uvr" />);
    expect(screen.getAllByText(/Escenario recomendado/i).length).toBe(1);
  });

  it("coincidencia ambigua por cuotasEliminadas → NO resalta ninguna", () => {
    // Duplicamos cuotasEliminadas para provocar ambigüedad.
    const dup = ESC_V2.map((e) => ({ ...e, cuotasEliminadas: 24 }));
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ escenarios: dup, propuesta: { cuotasEliminadas: 24 } })} inputs={{}} modo="uvr" />);
    expect(screen.queryByText(/Escenario recomendado/i)).not.toBeInTheDocument();
  });

  it("`Mayor ahorro` (ESC_V2[3]) puede diferir del recomendado (ESC_V2[0])", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ propuesta: { index: 0 } })} inputs={{}} modo="uvr" />);
    expect(screen.getAllByText(/Escenario recomendado/i).length).toBe(1);
    expect(screen.getAllByText(/Mayor ahorro/i).length).toBe(1);
  });
});

describe("EscenariosAuditor · invariante de cuatro escenarios", () => {
  it("v2 con menos de 4 escenarios → invalido_v2 (contrato), sin tarjetas parciales", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ escenarios: ESC_V2.slice(0, 3) })} inputs={{}} modo="uvr" />);
    expect(screen.getByText(/Escenarios no disponibles/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
  });

  it("v2 con más de 4 escenarios → invalido_v2, sin tarjetas parciales", () => {
    render(<EscenariosAuditor auditoria={makeV2Auditoria({ escenarios: [...ESC_V2, ESC_V2[0]] })} inputs={{}} modo="uvr" />);
    expect(screen.getByText(/Escenarios no disponibles/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
  });
});
