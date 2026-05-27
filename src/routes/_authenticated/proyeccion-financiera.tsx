import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/proyeccion-financiera")({
  head: () => ({
    meta: [
      { title: "Proyección Financiera · NUVEX" },
      {
        name: "description",
        content:
          "Módulo NUVEX para modelar créditos hipotecarios y leasing habitacional, comparar escenarios ilimitados y calcular el costo de no actuar.",
      },
    ],
  }),
  component: ProyeccionFinancieraPage,
});

function ProyeccionFinancieraPage() {
  const { roles, loading } = useUserRole();
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#242424]/60">
        Cargando módulo…
      </div>
    );
  }
  const allowed = roles.some((r) =>
    ["super_admin", "admin", "gerencia", "licenciado", "director_financiero_qa"].includes(r),
  );
  if (!allowed) return <Navigate to="/" />;
  return <ProyeccionFinancieraView />;
}
