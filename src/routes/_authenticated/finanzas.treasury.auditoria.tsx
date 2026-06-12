import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { NCard } from "@/components/nuvia/NCard";
import { listAuditoria } from "@/lib/treasury.functions";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/auditoria")({
  component: AuditoriaPage,
  head: () => ({ meta: [{ title: "Auditoría Treasury · NUVIA Treasury AI" }] }),
});

function AuditoriaPage() {
  const fn = useServerFn(listAuditoria);
  const { data } = useQuery({ queryKey: ["tAud"], queryFn: () => fn() });
  const rows = data ?? [];

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Treasury AI · Auditoría", tone: "neutral" }}
        title="Trazabilidad completa"
        description="Toda acción sobre extractos, movimientos y reglas queda registrada."
      />

      <NCard variant="elevated" padding="sm">
        <div className="overflow-x-auto">
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Fecha</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Entidad</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Acción</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Detalle</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }} className="tabular-nums">
                    {new Date(r.created_at).toLocaleString("es-CO")}
                  </td>
                  <td style={{ padding: "8px", color: "#A5B5E0" }}>{r.entidad}</td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }}>{r.accion}</td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)", maxWidth: 360 }}>
                    <code style={{ fontSize: 10 }}>{JSON.stringify(r.valor_nuevo ?? r.valor_anterior ?? {})}</code>
                  </td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>
                    {r.user_id ? r.user_id.slice(0, 8) : "—"}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "var(--nuvia-text-secondary)" }}>
                    Sin eventos de auditoría aún.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </NCard>
    </PageLayout>
  );
}
