import { createFileRoute } from "@tanstack/react-router";
import { CarteraDashboardView } from "@/components/cartera/CarteraDashboardView";

export const Route = createFileRoute("/_authenticated/finanzas/cartera")({
  component: () => (
    <CarteraDashboardView
      titulo="Cartera y recaudo"
      subtitulo="Control financiero de honorarios, días de mora y responsables contables."
    />
  ),
  head: () => ({ meta: [{ title: "Cartera y recaudo · NUVIA" }] }),
});
