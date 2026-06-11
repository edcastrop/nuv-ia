import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { RoleHome } from "@/components/home/RoleHome";
import { getMaestro, maestroToExpediente } from "@/lib/expedienteMaestro";
import type { Expediente } from "@/lib/expedientes";

const homeSearchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
  vista: z.enum(["simulador"]).optional(),
});

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [{ title: "Inicio · NUVIA" }],
  }),
});

function Home() {
  const { maestroId, modo: modoSearch, vista } = Route.useSearch();
  const [showSimulator, setShowSimulator] = useState<boolean>(!!modoSearch || !!maestroId || vista === "simulador");
  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? null);
  const [maestroExp, setMaestroExp] = useState<Expediente | null>(null);
  const [loadingMaestro, setLoadingMaestro] = useState<boolean>(!!maestroId);
  const [maestroErr, setMaestroErr] = useState<string | null>(null);

  useEffect(() => {
    if (!maestroId) {
      setMaestroExp(null);
      setLoadingMaestro(false);
      return;
    }
    setLoadingMaestro(true);
    setMaestroErr(null);
    getMaestro(maestroId)
      .then((m) => {
        const exp = maestroToExpediente(m) as unknown as Expediente;
        setMaestroExp(exp);
        setMode((current) => current ?? exp.modo);
        setShowSimulator(true);
      })
      .catch((e) => setMaestroErr((e as Error).message))
      .finally(() => setLoadingMaestro(false));
  }, [maestroId]);

  if (!showSimulator) {
    return <RoleHome onLanzarSimulador={() => setShowSimulator(true)} />;
  }

  if (maestroId && loadingMaestro) {
    return <div className="p-12 text-center text-sm text-white/60">Cargando datos del expediente maestro…</div>;
  }
  if (maestroErr) {
    return <div className="p-12 text-center text-sm text-[#B42318]">{maestroErr}</div>;
  }

  const initial = maestroExp ?? undefined;

  const handleReset = () => {
    setMode(null);
    setShowSimulator(false);
  };

  return (
    <div>
      {!mode && <ModeSelector onPick={setMode} />}
      {mode === "pesos" && <PesosSimulator initialExpediente={initial} onReset={handleReset} />}
      {mode === "uvr" && <UVRSimulator initialExpediente={initial} onReset={handleReset} />}
    </div>
  );
}
