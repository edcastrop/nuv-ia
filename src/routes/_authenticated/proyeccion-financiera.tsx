import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ProyeccionFinancieraView } from "@/components/proyeccion-financiera/ProyeccionFinancieraView";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/proyeccion-financiera")({
  head: () => ({
    meta: [
      { title: "Proyección Financiera · NUVEX" },
      {
        name: "description",
        content:
          "Módulo NUVEX para modelar créditos hipotecarios y leasing habitacional en Pesos o UVR, comparar escenarios ilimitados y calcular el costo de no actuar.",
      },
    ],
  }),
  component: ProyeccionFinancieraPage,
});

const ALLOWED = ["super_admin", "admin", "gerencia", "licenciado", "director_financiero_qa"];

function ProyeccionFinancieraPage() {
  // El gate de _authenticated.tsx ya validó sesión + MFA.
  // Evitamos render intermedio ("Cargando…") porque causa parpadeo al navegar.
  const { roles, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const allowed = roles.some((r) => ALLOWED.includes(r));
    if (!allowed) navigate({ to: "/" });
  }, [loading, roles, navigate]);

  return <ProyeccionFinancieraView />;
}

