import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import { RoleHome } from "@/components/home/RoleHome";
import { ensureOperativeExpedienteForMaestro, getMaestro } from "@/lib/expedienteMaestro";
import type { Expediente } from "@/lib/expedientes";
import { hasSimulatorDraft } from "@/components/nuvex/useSimulatorDraft";

const homeSearchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
  vista: z.enum(["simulador"]).optional(),
});

export const Route = createFileRoute("/_authenticated/inicio")({
  component: Home,
  validateSearch: homeSearchSchema,
  head: () => ({
    meta: [{ title: "Inicio · NUVIA" }],
  }),
});

function Home() {
  const { maestroId, modo: modoSearch, vista } = Route.useSearch();
  const navigate = useNavigate();
  const draftMode = hasSimulatorDraft("pesos", maestroId)
    ? "pesos"
    : hasSimulatorDraft("uvr", maestroId)
      ? "uvr"
      : null;
  // Compatibilidad: si llegan params de simulador a /inicio, redirige a /simulador
  const wantsSimulator = !!modoSearch || !!maestroId || vista === "simulador" || !!draftMode;

  useEffect(() => {
    if (wantsSimulator) {
      navigate({
        to: "/simulador",
        search: {
          ...(maestroId ? { maestroId } : {}),
          ...(modoSearch ? { modo: modoSearch } : {}),
        },
        replace: true,
      });
    }
  }, [wantsSimulator, maestroId, modoSearch, navigate]);

  if (wantsSimulator) {
    return (
      <div className="p-12 text-center text-sm text-white/60">Abriendo simulador…</div>
    );
  }

  return <RoleHome onLanzarSimulador={() => navigate({ to: "/simulador" })} />;
}

// Mantiene los componentes importados para que el bundler no los descarte
// (se usan en /simulador). No-op a nivel runtime.
void ModeSelector;
void PesosSimulator;
void UVRSimulator;
void ensureOperativeExpedienteForMaestro;
void getMaestro;
const _typeKeep: Expediente | null = null;
void _typeKeep;

