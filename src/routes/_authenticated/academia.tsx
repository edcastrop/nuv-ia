import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useUserRole } from "@/hooks/useUserRole";

export const Route = createFileRoute("/_authenticated/academia")({
  component: AcademiaLayout,
  head: () => ({ meta: [{ title: "Academia NUVEX" }] }),
});

function AcademiaLayout() {
  const { roles, loading, isApoderado, isSuperAdmin } = useUserRole();
  if (loading) return null;
  // Apoderado-only no tiene acceso a Academia
  const isApoderadoOnly =
    isApoderado && !isSuperAdmin && roles.every((r) => r === "apoderado");
  if (isApoderadoOnly) return <Navigate to="/apoderado/mis-casos" />;
  return <Outlet />;
}
