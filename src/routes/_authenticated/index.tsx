import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
  head: () => ({
    meta: [{ title: "Simulador NUVEX" }],
  }),
});

function Home() {
  const [mode, setMode] = useState<null | "pesos" | "uvr">(null);
  return (
    <div>
      {!mode && <ModeSelector onPick={setMode} />}
      {mode === "pesos" && <PesosSimulator onReset={() => setMode(null)} />}
      {mode === "uvr" && <UVRSimulator onReset={() => setMode(null)} />}
    </div>
  );
}
