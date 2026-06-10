import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";

export const Route = createFileRoute("/_authenticated/herramientas/proyeccion")({
  head: () => ({
    meta: [
      { title: "Proyección financiera · Herramientas NUVEX" },
      { name: "description", content: "Lectura IA del extracto + escenarios ilimitados sin crear caso." },
    ],
  }),
  component: ProyeccionHerramientaPage,
});

function ProyeccionHerramientaPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <Link
          to="/herramientas"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
        </Link>
      </div>
      <ProyeccionFinancieraView />
    </div>
  );
}
