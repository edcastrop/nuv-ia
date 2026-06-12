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
  // Aquí evitamos render intermedio ("Cargando…") porque causa parpadeo al navegar.
  // Si los roles aún no llegan, renderizamos el Outlet (que tiene su propio fondo)
  // y, si finalmente no está autorizado, redirigimos vía efecto. Esto evita
  // el flicker de pantalla blanca/negra entre dos estados de loading.
  const { roles, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    const allowed = roles.some((r) => ALLOWED.includes(r));
    if (!allowed) navigate({ to: "/inicio" });
  }, [loading, roles, navigate]);

  return <Outlet />;
}
