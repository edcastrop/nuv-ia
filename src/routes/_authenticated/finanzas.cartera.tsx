import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/nuvex/ui";

function StubPage({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-[#0A1226]">{titulo}</h2>
      <p className="mt-1 text-sm text-[#242424]/60">{descripcion}</p>
      <p className="mt-3 text-[12px] text-[#242424]/50">Disponible en próxima entrega.</p>
    </Card>
  );
}

export const Route = createFileRoute("/_authenticated/finanzas/cartera")({
  component: () => <StubPage titulo="Cartera de clientes" descripcion="Listado completo con días de mora, estado y responsable contable." />,
  head: () => ({ meta: [{ title: "Cartera clientes · NUVEX" }] }),
});
