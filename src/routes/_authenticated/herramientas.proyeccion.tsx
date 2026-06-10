import { createFileRoute } from "@tanstack/react-router";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";

export const Route = createFileRoute("/_authenticated/herramientas/proyeccion")({
  head: () => ({
    meta: [
      { title: "Proyección financiera · Herramientas NUVEX" },
      { name: "description", content: "Lectura IA del extracto + escenarios ilimitados sin crear caso." },
    ],
  }),
  component: () => <ProyeccionFinancieraView />,
});
