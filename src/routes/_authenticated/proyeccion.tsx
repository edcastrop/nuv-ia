import { createFileRoute } from "@tanstack/react-router";
import { ProyeccionDetallada } from "@/components/nuvex/ProyeccionDetallada";

export const Route = createFileRoute("/_authenticated/proyeccion")({
  head: () => ({
    meta: [
      { title: "Proyección Detallada del Crédito · NUVEX" },
      { name: "description", content: "Módulo técnico NUVEX para proyectar el crédito completo bajo escenario actual y optimizado." },
    ],
  }),
  component: ProyeccionDetallada,
});
