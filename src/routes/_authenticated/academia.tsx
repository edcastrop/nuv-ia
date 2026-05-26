import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/academia")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Academia NUVEX" }] }),
});
