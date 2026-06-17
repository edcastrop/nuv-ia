import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { ensureOperativeExpedienteForMaestro, getMaestro } from "@/lib/expedienteMaestro";
import type { Expediente } from "@/lib/expedientes";
import { hasSimulatorDraft } from "@/components/nuvex/useSimulatorDraft";

const simSearchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
});

export const Route = createFileRoute("/_authenticated/simulador")({
  component: SimuladorPage,
  validateSearch: simSearchSchema,
  head: () => ({
    meta: [{ title: "Simulador · NUVIA" }],
  }),
});

function SimuladorPage() {
  const { maestroId, modo: modoSearch } = Route.useSearch();
  const navigate = useNavigate();
  const draftMode = hasSimulatorDraft("pesos", maestroId)
    ? "pesos"
    : hasSimulatorDraft("uvr", maestroId)
      ? "uvr"
      : null;
  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? draftMode);
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
      .then(async (m) => {
        const exp = await ensureOperativeExpedienteForMaestro(m);
        setMaestroExp(exp);
        setMode((current) => current ?? exp.modo);
      })
      .catch((e) => setMaestroErr((e as Error).message))
      .finally(() => setLoadingMaestro(false));
  }, [maestroId]);

  if (maestroId && loadingMaestro) {
    return (
      <div className="p-12 text-center text-sm text-white/60">
        Cargando datos del expediente maestro…
      </div>
    );
  }
  if (maestroErr) {
    return <div className="p-12 text-center text-sm text-[#B42318]">{maestroErr}</div>;
  }

  const initial = maestroExp ?? undefined;
  const handleReset = () => {
    setMode(null);
    navigate({ to: "/simulador", search: {} });
  };

  return (
    <div>
      {!mode && <ModeSelector onPick={setMode} />}
      {mode === "pesos" && <PesosSimulator initialExpediente={initial} onReset={handleReset} />}
      {mode === "uvr" && <UVRSimulator initialExpediente={initial} onReset={handleReset} />}
    </div>
  );
}
