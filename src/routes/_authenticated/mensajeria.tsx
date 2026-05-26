import { createFileRoute } from "@tanstack/react-router";
import { MensajeriaView } from "@/components/colaboracion/MensajeriaView";

export const Route = createFileRoute("/_authenticated/mensajeria")({
  component: () => <MensajeriaView />,
  head: () => ({ meta: [{ title: "Mensajería · NUVEX" }] }),
});
