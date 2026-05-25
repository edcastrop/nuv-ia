import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/nuvex/ui";

export const Route = createFileRoute("/_authenticated/finanzas/auditoria")({
  component: () => (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-[#0A1226]">Auditoría financiera</h2>
      <p className="mt-1 text-sm text-[#242424]/60">Trazabilidad completa de todas las acciones financieras.</p>
      <p className="mt-3 text-[12px] text-[#242424]/50">Disponible en Entrega 5.</p>
    </Card>
  ),
  head: () => ({ meta: [{ title: "Auditoría · Finanzas NUVEX" }] }),
});
