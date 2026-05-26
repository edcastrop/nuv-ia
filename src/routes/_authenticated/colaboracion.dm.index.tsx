import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MensajeriaView } from "@/components/colaboracion/MensajeriaView";

export const Route = createFileRoute("/_authenticated/colaboracion/dm/")({
  component: DMIndex,
  head: () => ({ meta: [{ title: "Mensajería Directa · NUVEX" }] }),
});

function DMIndex() {
  const navigate = useNavigate();
  return (
    <MensajeriaView
      onCanalChange={(id) =>
        navigate({ to: "/colaboracion/dm/$conversationId", params: { conversationId: id }, replace: true })
      }
    />
  );
}
