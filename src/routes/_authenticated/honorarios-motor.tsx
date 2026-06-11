import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MotorHonorariosView } from "@/components/honorarios/MotorHonorariosView";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/honorarios-motor")({
  head: () => ({
    meta: [
      { title: "Motor de Honorarios · NUVEX" },
      { name: "description", content: "Pricing engine NUVEX: calcula, controla, audita y aprueba honorarios automáticamente." },
    ],
  }),
  component: MotorHonorariosPage,
});

const ALLOWED = ["super_admin", "admin", "gerencia", "licenciado", "asesor", "director_financiero_qa"];

function MotorHonorariosPage() {
  const { roles, loading } = useUserRole();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!roles.some((r) => ALLOWED.includes(r))) navigate({ to: "/" });
  }, [loading, roles, navigate]);
  return <MotorHonorariosView />;
}
