import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { z } from "zod";
import { RoleHome } from "@/components/home/RoleHome";

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

  // Solo redirige cuando llegan params explícitos de simulador (links legados
  // desde Expediente Maestro, etc.). NO redirige por draft en sessionStorage,
  // porque eso impediría volver al Home tras lanzar el simulador.
  const wantsSimulator = !!modoSearch || !!maestroId || vista === "simulador";

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
