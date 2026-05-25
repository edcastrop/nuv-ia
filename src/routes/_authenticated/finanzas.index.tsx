import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/nuvex/ui";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/")({
  component: FinanzasDashboard,
  head: () => ({ meta: [{ title: "Dashboard financiero · NUVEX" }] }),
});

function FinanzasDashboard() {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 text-[#445DA3]" size={20} />
          <div>
            <h2 className="text-lg font-semibold text-[#0A1226]">Módulo financiero en construcción</h2>
            <p className="mt-1 text-sm text-[#242424]/70">
              Entrega 1 lista: rol <strong>contabilidad</strong>, esquema (nómina, tesorería, auditoría,
              alertas), bucket de comprobantes y navegación del módulo. Las próximas entregas activan:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-[#242424]/80">
              <li>Entrega 2 — Cartera clientes + Recaudos con comprobante.</li>
              <li>Entrega 3 — Comisiones y cuentas de cobro v2 (aprobar / pagar / auditar).</li>
              <li>Entrega 4 — Nómina, Tesorería, Dashboard financiero y Reportes PDF/Excel.</li>
              <li>Entrega 5 — Alertas IA, Auditoría completa y cron diario.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
