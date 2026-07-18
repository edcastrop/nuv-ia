/// <reference types="@testing-library/jest-dom" />
// Cobertura de render para `EscenariosAuditor` (bloque interno de
// `ReconstruccionAuditorBlock`). El componente clasifica el snapshot con
// `escenariosFromAudit` y renderiza `PropuestasComerciales` en modo
// solo-lectura; estas pruebas verifican los cinco orígenes documentados:
//   • historico_persistido → sin banner legacy
//   • reconstruido_legacy → banner presente
//   • uvrVariationConflict → aviso con ambos valores
//   • escenarios=null (invalido_v2) → mensaje explícito y sin fallback legacy
//   • version_desconocida → mensaje explícito
//
// No se ejercita el motor financiero: la reconstrucción real ya está
// cubierta en `nuviaQaSnapshot.test.ts`.

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

// Snapshot UVR legacy (v1) COMPLETO — permite reconstruir escenarios con
// el motor canónico. Faltas en cualquiera de estos campos harían fallar
// `reconstructLegacyUvrScenarios` y llevarían a origen=null.
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

describe("EscenariosAuditor · orígenes del contrato", () => {
  it("historico_persistido (v2 con 4 escenarios) → NO renderiza banner legacy y muestra tabla", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: {
          ...V1_LEGACY_DATOS,
          snapshotVersion: SNAPSHOT_VERSION,
          propuestasComerciales: ESC_V2,
        },
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={{}} modo="uvr" />);
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Escenarios no disponibles/i)).not.toBeInTheDocument();
    // Cuatro filas persistidas.
    expect(document.querySelectorAll("tbody tr").length).toBe(4);
  });

  it("reconstruido_legacy (v1 UVR completo) → renderiza el banner de retrocompatibilidad", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: V1_LEGACY_DATOS, // sin snapshotVersion → v1
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
    // Precedencia: snapshot prima sobre inputs.
    expect(conflicto.textContent).toMatch(/aplicado=6%/);
  });

  it("escenarios=null (invalido_v2: version=2 sin propuestasComerciales) → mensaje explícito y NO fallback legacy", () => {
    const auditoria = {
      simulador_snapshot: {
        banco: "Davivienda",
        producto: "Hipotecario UVR",
        moneda: "UVR",
        tipoCredito: "uvr",
        datos: {
          ...V1_LEGACY_DATOS,
          snapshotVersion: 2, // v2 pero sin propuestasComerciales → invalido_v2
        },
        archivoPath: null,
        archivoNombre: null,
      },
    };
    render(<EscenariosAuditor auditoria={auditoria} inputs={{}} modo="uvr" />);
    // Debe verse el mensaje de "no disponibles".
    expect(screen.getByText(/Escenarios no disponibles/i)).toBeInTheDocument();
    // Y NO debe intentar reconstruir legacy (no aparece el banner).
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
    // La tabla de escenarios no se materializa.
    expect(document.querySelectorAll("tbody tr").length).toBe(0);
    // Razón explícita del contrato.
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
  });
});
