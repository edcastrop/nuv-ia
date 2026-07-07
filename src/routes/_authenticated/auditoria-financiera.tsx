import { createFileRoute, redirect } from "@tanstack/react-router";

// Ruta legacy: leía de `audit_simulaciones` (tabla obsoleta) y quedaba vacía.
// El Command Center vigente lee de `qa_auditorias`; redirigimos para que
// cualquier enlace viejo caiga en la bandeja real del Director Financiero.
export const Route = createFileRoute("/_authenticated/auditoria-financiera")({
  beforeLoad: () => {
    throw redirect({ to: "/qa-ai" });
  },
  component: () => null,
});
