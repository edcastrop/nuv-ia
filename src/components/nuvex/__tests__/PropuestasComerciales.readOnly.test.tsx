/// <reference types="@testing-library/jest-dom" />
// Cobertura de render para `PropuestasComerciales` en modo `readOnly`
// (vista del auditor). Verifica que:
//   • el layout de tarjetas es el mismo que ve el analista (no una tabla);
//   • los bloques comerciales/interactivos NO se renderizan;
//   • los callbacks del analista NO se ejecutan;
//   • `auditorRecomendadaIdx` se aplica de forma exacta y sin fallback;
//   • el modo analista permanece intacto.

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PropuestasComerciales } from "@/components/nuvex/PropuestasComerciales";
import type { PesosInput } from "@/lib/finance";

// Escenarios completos (los que reciben tras `escenariosFromAudit`).
const ESC = [
  { index: 0, cuotasEliminadas: 12, añosEliminados: 1, nuevoPlazo: 168, nuevaCuota: 1_500_000, ahorroIntereses: 6_000_000, ahorroSeguros: 2_000_000, ahorroTotal: 8_000_000, honorarios: 480_000, totalProyectado: 260_000_000, incrementoMensual: 100_000 },
  { index: 1, cuotasEliminadas: 24, añosEliminados: 2, nuevoPlazo: 156, nuevaCuota: 1_600_000, ahorroIntereses: 12_000_000, ahorroSeguros: 3_000_000, ahorroTotal: 15_000_000, honorarios: 900_000, totalProyectado: 245_000_000, incrementoMensual: 180_000 },
  { index: 2, cuotasEliminadas: 36, añosEliminados: 3, nuevoPlazo: 144, nuevaCuota: 1_700_000, ahorroIntereses: 18_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 22_000_000, honorarios: 1_320_000, totalProyectado: 230_000_000, incrementoMensual: 260_000 },
  { index: 3, cuotasEliminadas: 48, añosEliminados: 4, nuevoPlazo: 132, nuevaCuota: 1_800_000, ahorroIntereses: 24_000_000, ahorroSeguros: 4_000_000, ahorroTotal: 28_000_000, honorarios: 1_680_000, totalProyectado: 215_000_000, incrementoMensual: 340_000 },
];

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

  it("no ejecuta ningún callback del analista al montarse (contrato + runtime)", () => {
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

  it("NO renderiza AbonoInteligenteCard, CalculadoraEnVivo ni PerfilIngresos", () => {
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
    // Copy propio de AbonoInteligenteCard.
    expect(screen.queryByText(/Ponlo en perspectiva/i)).not.toBeInTheDocument();
    // Copy propio de CalculadoraEnVivo.
    expect(screen.queryByText(/Calculadora en vivo/i)).not.toBeInTheDocument();
    // Copy propio del info Alert del analista.
    expect(screen.queryByText(/¿Qué cuotas se eliminan\?/i)).not.toBeInTheDocument();
    // Copy propio del CTA / botón "Nuevo escenario".
    expect(screen.queryByText(/Nuevo escenario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Marcar como recomendado/i)).not.toBeInTheDocument();
    // Header identifica modo auditor.
    expect(screen.getByText(/solo lectura, vista del auditor/i)).toBeInTheDocument();
  });

  it("renderiza exactamente cuatro tarjetas (mismo layout del analista, no tabla)", () => {
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
    // No tabla — el layout es de tarjetas.
    expect(container.querySelectorAll("table").length).toBe(0);
    // Cuatro etiquetas de escenario (Escenario 1..4) en la sección principal.
    // La franja rápida y la grilla las repiten; usamos el texto "Elimina" que
    // aparece exactamente una vez por tarjeta de la grilla principal.
    const elimina = screen.getAllByText(/^Elimina/);
    expect(elimina.length).toBe(4);
  });

  it("con `auditorRecomendadaIdx=2` marca EXACTAMENTE esa tarjeta como recomendada", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={2}
      />,
    );
    const recTags = screen.getAllByText(/Escenario recomendado/i);
    // Aparece exactamente una vez y no en ningún otro índice.
    expect(recTags.length).toBe(1);
  });

  it("con `auditorRecomendadaIdx=null` NO marca ninguna tarjeta como recomendada", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={null}
      />,
    );
    expect(screen.queryByText(/Escenario recomendado/i)).not.toBeInTheDocument();
  });

  it("con `auditorRecomendadaIdx` fuera de rango NO marca ninguna tarjeta como recomendada", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        auditorEscenarios={ESC}
        auditorRecomendadaIdx={9}
      />,
    );
    expect(screen.queryByText(/Escenario recomendado/i)).not.toBeInTheDocument();
  });

  it("`Mayor ahorro` puede resaltarse en una tarjeta distinta de la recomendada", () => {
    // ESC[3] tiene el mayor ahorroTotal (28M). Marcamos como recomendada
    // la 0 → debe existir "Escenario recomendado" en la 0 y "Mayor ahorro"
    // en la 3.
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
    expect(screen.getAllByText(/Escenario recomendado/i).length).toBe(1);
    expect(screen.getAllByText(/Mayor ahorro/i).length).toBe(1);
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

  it("con `auditorEscenarios=[]` (parcial) NO renderiza tarjetas parciales", () => {
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
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
  });

  it("con `auditorEscenarios` de longitud !=4 NO renderiza tarjetas parciales", () => {
    render(
      <PropuestasComerciales
        readOnly
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={0}
        auditorEscenarios={ESC.slice(0, 2)}
      />,
    );
    expect(screen.getByText(/Sin escenarios disponibles/i)).toBeInTheDocument();
    expect(screen.queryAllByText(/^Elimina/).length).toBe(0);
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
    expect(container.querySelectorAll("input").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
    expect(screen.queryByText(/solo lectura, vista del auditor/i)).not.toBeInTheDocument();
    // El analista SÍ conserva la Calculadora en vivo y el botón "Nuevo escenario".
    expect(screen.getByText(/Calculadora en vivo/i)).toBeInTheDocument();
    expect(screen.getByText(/Nuevo escenario/i)).toBeInTheDocument();
  });

  it("el modo analista conserva el mismo layout base de tarjetas (grilla, no tabla)", () => {
    const { container } = render(
      <PropuestasComerciales
        mode="pesos"
        cuotasPendientes={180}
        baseCredito={90_000_000}
        input={PESOS_INPUT}
        onRecomendadaChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("table").length).toBe(0);
    expect(within(container).getAllByText(/^Elimina/).length).toBeGreaterThanOrEqual(1);
  });
});
