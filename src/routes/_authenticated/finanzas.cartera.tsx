import { createFileRoute } from "@tanstack/react-router";
import { CarteraDashboardView } from "@/components/cartera/CarteraDashboardView";

export const Route = createFileRoute("/_authenticated/finanzas/cartera")({
  component: () => (
    <CarteraDashboardView
      titulo="Cartera clientes — Finanzas"
      subtitulo="Honorarios por cobrar, días de mora, estado y responsable contable."
    />
  ),
  head: () => ({ meta: [{ title: "Cartera clientes · NUVEX" }] }),
});
