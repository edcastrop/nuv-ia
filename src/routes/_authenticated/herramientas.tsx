import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUserRole } from "@/hooks/useUserRole";

const ALLOWED = ["super_admin", "admin", "gerencia", "licenciado", "asesor", "director_financiero_qa"];

export const Route = createFileRoute("/_authenticated/herramientas")({
  head: () => ({
    meta: [
      { title: "Herramientas · NUVEX" },
      { name: "description", content: "Calculadoras y motores NUVEX disponibles sin necesidad de crear caso." },
    ],
  }),
  component: HerramientasLayout,
});

function HerramientasLayout() {
  // El gate de _authenticated.tsx ya validó sesión + MFA + estado_acceso.
  // IMPORTANTE: esta pantalla NO debe expulsar al usuario cuando la consulta
  // de roles llega tarde o vacía momentáneamente; eso ocultaba herramientas a
  // analistas válidos después de unos segundos.
  const { roles, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (roles.length === 0) return;
    const allowed = roles.some((r) => ALLOWED.includes(r));
    if (!allowed) navigate({ to: "/inicio" });
  }, [loading, roles, navigate]);

  return <Outlet />;
}
