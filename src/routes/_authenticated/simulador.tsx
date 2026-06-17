import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import {
  ensureOperativeExpedienteForMaestro,
  getMaestro,
  upsertMaestro,
  emptyCliente,
  emptyCotitular,
  emptyCredito,
  emptyFresh,
  emptyAsesor,
  emptyLicenciado,
  emptyApoderado,
} from "@/lib/expedienteMaestro";
import type { Expediente } from "@/lib/expedientes";

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
  // El modo se elige explícitamente por el usuario o viene de la URL / expediente maestro.
  // No se autoselecciona desde drafts en sessionStorage.
  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? null);
  const [maestroExp, setMaestroExp] = useState<Expediente | null>(null);
  const [loadingMaestro, setLoadingMaestro] = useState<boolean>(!!maestroId);
  const [creating, setCreating] = useState<boolean>(false);
  const [maestroErr, setMaestroErr] = useState<string | null>(null);

  // Carga del maestro existente (si llegó por URL desde Expediente Maestro).
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

  // Cuando el usuario elige un modo SIN maestroId previo, creamos un expediente
  // maestro vacío y su expediente operativo, y redirigimos con los params en la URL.
  // Esto habilita el mismo flujo que "Expediente / Nuevo expediente / Simulador":
  // el AutoQA se dispara al subir el extracto porque hay expediente_id.
  const handlePickMode = async (m: "pesos" | "uvr") => {
    if (maestroId) {
      setMode(m);
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const maestro = await upsertMaestro({
        cliente: emptyCliente(),
        cotitular: emptyCotitular(),
        credito: emptyCredito(),
        fresh: emptyFresh(),
        asesor: emptyAsesor(),
        licenciado: emptyLicenciado(),
        apoderado: emptyApoderado(),
      });
      const exp = await ensureOperativeExpedienteForMaestro(maestro);
      setMaestroExp(exp);
      setMode(m);
      navigate({
        to: "/simulador",
        search: { maestroId: maestro.id, modo: m },
        replace: true,
      });
    } catch (e) {
      toast.error(
        `No se pudo iniciar el expediente: ${e instanceof Error ? e.message : "error"}`,
      );
    } finally {
      setCreating(false);
    }
  };

  if (maestroId && loadingMaestro) {
    return (
      <div className="p-12 text-center text-sm text-white/60">
        Cargando datos del expediente maestro…
      </div>
    );
  }
  if (creating) {
    return (
      <div className="p-12 text-center text-sm text-white/60">
        Inicializando expediente para auditoría…
      </div>
    );
  }
  if (maestroErr) {
    return <div className="p-12 text-center text-sm text-[#B42318]">{maestroErr}</div>;
  }

  const initial = maestroExp ?? undefined;
  const handleReset = () => {
    setMode(null);
    setMaestroExp(null);
    navigate({ to: "/simulador", search: {} });
  };

  const simReturn = maestroId ? { maestroId, modo: mode ?? undefined } : undefined;

  return (
    <div>
      {!mode && <ModeSelector onPick={handlePickMode} />}
      {mode === "pesos" && (
        <PesosSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn} />
      )}
      {mode === "uvr" && (
        <UVRSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn} />
      )}
    </div>
  );
}
