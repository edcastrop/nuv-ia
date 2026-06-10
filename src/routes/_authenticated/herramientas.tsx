import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
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
  const { roles, loading } = useUserRole();
  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-[#242424]/60">Cargando…</div>;
  }
  const allowed = roles.some((r) => ALLOWED.includes(r));
  if (!allowed) return <Navigate to="/" />;
  return <Outlet />;
}
