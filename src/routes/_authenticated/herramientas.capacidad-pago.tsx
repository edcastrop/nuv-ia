import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { CapacidadPagoTool } from "@/components/herramientas/CapacidadPagoTool";

export const Route = createFileRoute("/_authenticated/herramientas/capacidad-pago")({
  head: () => ({
    meta: [
      { title: "Capacidad de pago · Herramientas NUVEX" },
      { name: "description", content: "Calcula el % de endeudamiento del cliente con IA, sin crear expediente." },
    ],
  }),
  component: CapacidadPagoPage,
});

function CapacidadPagoPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link to="/herramientas" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4">
          <ArrowLeft className="h-4 w-4" /> Volver a Herramientas
        </Link>
        <CapacidadPagoTool />
      </div>
    </div>
  );
}
