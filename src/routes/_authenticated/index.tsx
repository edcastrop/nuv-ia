import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { getMaestro, maestroToExpediente } from "@/lib/expedienteMaestro";
import type { Expediente } from "@/lib/expedientes";

const homeSearchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
});

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [{ title: "Simulador NUVEX" }],
  }),
});

function Home() {
  const { maestroId, modo: modoSearch } = Route.useSearch();
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
        // Si no se pasó modo explícito en la URL, usar el detectado en el maestro
        setMode((current) => current ?? exp.modo);
      })
      .catch((e) => setMaestroErr((e as Error).message))
      .finally(() => setLoadingMaestro(false));
  }, [maestroId]);

  if (maestroId && loadingMaestro) {
    return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando datos del expediente maestro…</div>;
  }
  if (maestroErr) {
    return <div className="p-12 text-center text-sm text-[#B42318]">{maestroErr}</div>;
  }

  const initial = maestroExp ?? undefined;

  return (
    <div>
      {!mode && <ModeSelector onPick={setMode} />}
      {mode === "pesos" && <PesosSimulator initialExpediente={initial} onReset={() => setMode(null)} />}
      {mode === "uvr" && <UVRSimulator initialExpediente={initial} onReset={() => setMode(null)} />}
    </div>
  );
}
