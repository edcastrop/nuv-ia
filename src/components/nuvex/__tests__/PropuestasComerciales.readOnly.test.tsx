/// <reference types="@testing-library/jest-dom" />
// Cobertura de render para `PropuestasComerciales` en modo `readOnly` (vista
// del auditor). Verifica que el subcomponente `PropuestasComercialesReadOnly`
// nunca renderiza controles interactivos ni ejecuta los callbacks del
// analista, y que renderiza correctamente el banner de retrocompatibilidad
// y el aviso de conflicto UVR.
//
// Estas pruebas NO ejercitan la lógica financiera (cubierta en
// `nuviaQaSnapshot.test.ts`); su objetivo es proteger las invariantes
// visuales del contrato de solo lectura.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PropuestasComerciales } from "@/components/nuvex/PropuestasComerciales";
import type { PesosInput } from "@/lib/finance";

const ESC = [
  { index: 0, cuotasEliminadas: 12, añosEliminados: 1, nuevoPlazo: 168, nuevaCuota: 1_500_000, ahorroTotal: 8_000_000, honorarios: 480_000 },
  { index: 1, cuotasEliminadas: 24, añosEliminados: 2, nuevoPlazo: 156, nuevaCuota: 1_600_000, ahorroTotal: 15_000_000, honorarios: 900_000 },
  { index: 2, cuotasEliminadas: 36, añosEliminados: 3, nuevoPlazo: 144, nuevaCuota: 1_700_000, ahorroTotal: 22_000_000, honorarios: 1_320_000 },
  { index: 3, cuotasEliminadas: 48, añosEliminados: 4, nuevoPlazo: 132, nuevaCuota: 1_800_000, ahorroTotal: 28_000_000, honorarios: 1_680_000 },
];

// Input mínimo para el modo interactivo Pesos (no se ejercita numéricamente).
const PESOS_INPUT: PesosInput = {
  saldoCapital: 90_000_000,
  cuotaActual: 1_800_000,
  seguros: 100_000,
  tea: 14,
  cuotasPendientes: 180,
  porcentajeHonorarios: 0.06,
};

describe("PropuestasComerciales · readOnly (vista auditor)", () => {
  it("no renderiza ningún <input> ni <select> ni <button>", () => {
    const { container } = render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={0}
      />,
    );
    expect(container.querySelectorAll("input").length).toBe(0);
    expect(container.querySelectorAll("select").length).toBe(0);
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  it("no ejecuta ningún callback del analista al montarse (contrato de tipos + runtime)", () => {
    // Los callbacks están bloqueados por tipos con `never`; runtime debe
    // respetarlo aunque se fuercen por cast.
    const onRecomendadaChange = vi.fn();
    const onStateChange = vi.fn();
    const onIngresosChange = vi.fn();
    const props = {
      readOnly: true,
      mode: "pesos",
      cuotasPendientes: 180,
      baseCredito: 90_000_000,
      auditorEscenarios: ESC,
      auditorRecomendadaIdx: 0,
      onRecomendadaChange,
      onStateChange,
      onIngresosChange,
    } as unknown as React.ComponentProps<typeof PropuestasComerciales>;
    render(<PropuestasComerciales {...props} />);
    expect(onRecomendadaChange).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
    expect(onIngresosChange).not.toHaveBeenCalled();
  });

  it("no muestra el bloque de abono ni la calculadora interactiva", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={0}
      />,
    );
    // Marcadores interactivos exclusivos del modo analista.
    expect(screen.queryByText(/abono/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/calculadora/i)).not.toBeInTheDocument();
    // Copy propio del modo auditor.
    expect(screen.getByText(/solo lectura, vista del auditor/i)).toBeInTheDocument();
  });

  it("renderiza el banner legacy cuando `auditorBannerLegacy` está presente", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="uvr"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorBannerLegacy="El snapshot original no incluye escenarios (v1)."
      />,
    );
    expect(screen.getByText(/Escenarios reconstruidos por retrocompatibilidad/i)).toBeInTheDocument();
    expect(screen.getByText(/snapshot original no incluye escenarios/i)).toBeInTheDocument();
  });

  it("NO renderiza el banner legacy cuando `auditorBannerLegacy` es null", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="uvr"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorBannerLegacy={null}
      />,
    );
    expect(screen.queryByText(/Escenarios reconstruidos por retrocompatibilidad/i)).not.toBeInTheDocument();
  });

  it("renderiza `uvrVariationConflict` con ambos valores y el valor aplicado", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="uvr"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorUvrVariationConflict={{ snapshotValue: 6, inputsValue: 5.2, chosen: 6 }}
      />,
    );
    const msg = screen.getByText(/Conflicto de Variación UVR EA/i);
    expect(msg).toBeInTheDocument();
    expect(msg.textContent).toMatch(/snapshot=6%/);
    expect(msg.textContent).toMatch(/inputs=5\.2%/);
    expect(msg.textContent).toMatch(/aplicado=6%/);
  });

  it("con `auditorEscenarios=[]` renderiza el mensaje 'Sin escenarios disponibles'", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={0}
        baseCredito={0}
        auditorEscenarios={[]}
      />,
    );
    expect(screen.getByText(/Sin escenarios disponibles/i)).toBeInTheDocument();
  });

  it("renderiza los 4 escenarios y marca como recomendado el índice indicado", () => {
    const { container } = render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={2}
      />,
    );
    // Cuatro filas de datos.
    expect(container.querySelectorAll("tbody tr").length).toBe(4);
    // Fila recomendada tiene fondo verde translúcido (tokens NUVIA).
    const rows = container.querySelectorAll("tbody tr");
    const recRow = rows[2] as HTMLElement;
    expect(recRow.getAttribute("style") || "").toMatch(/132,\s*185,\s*143/);
  });
});

describe("PropuestasComerciales · readOnly=false (analista) sigue interactivo", () => {
  it("renderiza controles interactivos (al menos un <input> y un <button>)", () => {
    const { container } = render(
      <PropuestasComerciales
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        input={PESOS_INPUT}
        onRecomendadaChange={vi.fn()}
      />,
    );
    // El componente interactivo debe exponer botones/inputs para editar
    // los escenarios; no cae al layout de solo lectura.
    expect(container.querySelectorAll("input").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
    // Copy exclusivo del modo auditor NO debe aparecer.
    expect(screen.queryByText(/solo lectura, vista del auditor/i)).not.toBeInTheDocument();
  });
});
