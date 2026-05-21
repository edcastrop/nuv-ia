import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModeSelector } from "../components/nuvex/ModeSelector";
import { PesosSimulator } from "../components/nuvex/PesosSimulator";
import { UVRSimulator } from "../components/nuvex/UVRSimulator";
import { NuvexFooter, NuvexHeader } from "../components/nuvex/Layout";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Simulador NUVEX de Optimización de Créditos" },
      { name: "description", content: "Plataforma privada NUVEX para calcular propuestas de optimización de créditos hipotecarios y leasing habitacional en pesos y UVR." },
    ],
  }),
});

function Index() {
  const [mode, setMode] = useState<null | "pesos" | "uvr">(null);

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      <div className="nuvex-no-print">
        <NuvexHeader onReset={mode ? () => setMode(null) : undefined} />
        {!mode && <ModeSelector onPick={setMode} />}
        {mode === "pesos" && <PesosSimulator />}
        {mode === "uvr" && <UVRSimulator />}
        <NuvexFooter />
      </div>
    </div>
  );
}
