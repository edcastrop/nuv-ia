import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { MensajeriaView } from "@/components/colaboracion/MensajeriaView";

export const Route = createFileRoute("/_authenticated/colaboracion/dm/$conversationId")({
  component: DMDetalle,
  head: () => ({ meta: [{ title: "Conversación · NUVEX" }] }),
});

function DMDetalle() {
  const { conversationId } = useParams({ from: "/_authenticated/colaboracion/dm/$conversationId" });
  const navigate = useNavigate();
  return (
    <MensajeriaView
      initialCanalId={conversationId}
      onCanalChange={(id) => {
        if (id !== conversationId) {
          navigate({ to: "/colaboracion/dm/$conversationId", params: { conversationId: id }, replace: true });
        }
      }}
    />
  );
}
