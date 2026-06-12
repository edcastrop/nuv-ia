import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageLayout, ExecutiveHero } from "@/components/nuvia";
import { KpiGrid, KpiCard } from "@/components/nuvia/KpiGrid";
import { NCard } from "@/components/nuvia/NCard";
import { NSelect } from "@/components/nuvia/NSelect";
import { carteraAging } from "@/lib/treasury.functions";
import { Wallet, AlertTriangle, FileWarning, HandCoins, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury/cartera")({
  component: CarteraIAPage,
  head: () => ({ meta: [{ title: "Cartera IA · NUVIA Treasury AI" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const BUCKETS: Array<{ key: "alDia" | "b1_30" | "b31_60" | "b61_90" | "b90plus"; label: string; tone: "green" | "blue" | "warning" | "danger" }> = [
  { key: "alDia", label: "Al día", tone: "green" },
  { key: "b1_30", label: "1–30 días", tone: "blue" },
  { key: "b31_60", label: "31–60 días", tone: "warning" },
  { key: "b61_90", label: "61–90 días", tone: "warning" },
  { key: "b90plus", label: "90+ días", tone: "danger" },
];

const FLAG_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  pago_parcial: { label: "Pago parcial", bg: "rgba(132,185,143,0.16)", fg: "#9BCB9F" },
  aprobado_sin_pago: { label: "Aprobado sin pago", bg: "rgba(246,196,83,0.16)", fg: "#F6C453" },
  cc_sin_recaudo: { label: "CC enviada sin recaudo", bg: "rgba(165,181,224,0.16)", fg: "#A5B5E0" },
  promesa_vencida: { label: "Promesa vencida", bg: "rgba(255,107,107,0.16)", fg: "#FF8585" },
};

function CarteraIAPage() {
  const fn = useServerFn(carteraAging);
  const { data, isLoading } = useQuery({ queryKey: ["tCarteraAging"], queryFn: () => fn() });
  const [bucket, setBucket] = useState<string>("__all__");
  const [flag, setFlag] = useState<string>("__all__");

  const items = useMemo(() => {
    const xs = data?.items ?? [];
    return xs.filter(
      (i) =>
        (bucket === "__all__" || i.bucket === bucket) &&
        (flag === "__all__" || i.flags.includes(flag)),
    );
  }, [data, bucket, flag]);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Wallet size={12} />, label: "Treasury AI · Cartera", tone: "blue" }}
        title="Cartera IA — Aging y alertas"
        description="Análisis automático de saldos por edad de mora, con detección de promesas vencidas y cuentas enviadas sin recaudo."
      />

      <KpiGrid cols={4}>
        <KpiCard label="Cartera por cobrar" value={money(data?.total ?? 0)} icon={<Wallet size={14} />} tone="blue" />
        <KpiCard label="Pago parcial" value={String(data?.alertas.pago_parcial ?? 0)} icon={<HandCoins size={14} />} tone="green" hint="casos" />
        <KpiCard label="Aprobado sin pago" value={String(data?.alertas.aprobado_sin_pago ?? 0)} icon={<AlertTriangle size={14} />} tone="warning" hint="casos" />
        <KpiCard label="CC sin recaudo" value={String(data?.alertas.cc_sin_recaudo ?? 0)} icon={<FileWarning size={14} />} tone="warning" hint="casos" />
      </KpiGrid>

      <NCard variant="elevated">
        <h3 className="font-semibold mb-3" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
          Aging por edad de mora
        </h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(0,1fr))" }}>
          {BUCKETS.map((b) => {
            const valor = data?.buckets[b.key] ?? 0;
            const count = data?.counts[b.key] ?? 0;
            const max = Math.max(...Object.values(data?.buckets ?? { x: 1 }), 1);
            const pct = (valor / max) * 100;
            const color =
              b.tone === "green" ? "#9BCB9F" : b.tone === "blue" ? "#A5B5E0" : b.tone === "warning" ? "#F6C453" : "#FF8585";
            return (
              <button
                key={b.key}
                onClick={() => setBucket(bucket === b.key ? "__all__" : b.key)}
                className="text-left rounded-lg p-3 transition"
                style={{
                  background: bucket === b.key ? "rgba(165,181,224,0.10)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${bucket === b.key ? "rgba(165,181,224,0.45)" : "var(--nuvia-border)"}`,
                }}
              >
                <div className="uppercase font-semibold" style={{ color: "var(--nuvia-text-secondary)", fontSize: 9, letterSpacing: "0.12em" }}>
                  {b.label}
                </div>
                <div className="font-bold tabular-nums mt-1" style={{ color: "var(--nuvia-text-primary)", fontSize: 16 }}>
                  {money(valor)}
                </div>
                <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>{count} casos</div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color }} />
                </div>
              </button>
            );
          })}
        </div>
      </NCard>

      <NCard variant="elevated" padding="sm">
        <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
          <h3 className="font-semibold flex-1" style={{ color: "var(--nuvia-text-primary)", fontSize: 14 }}>
            Detalle ({items.length})
          </h3>
          <NSelect
            value={bucket}
            onValueChange={setBucket}
            placeholder="Todos los buckets"
            options={[{ value: "", label: "Todos los buckets" }, ...BUCKETS.map((b) => ({ value: b.key, label: b.label }))]}
          />
          <NSelect
            value={flag}
            onValueChange={setFlag}
            placeholder="Todas las alertas"
            options={[
              { value: "", label: "Todas las alertas" },
              { value: "pago_parcial", label: "Pago parcial" },
              { value: "aprobado_sin_pago", label: "Aprobado sin pago" },
              { value: "cc_sin_recaudo", label: "CC sin recaudo" },
              { value: "promesa_vencida", label: "Promesa vencida" },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Cliente</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Banco</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Estado</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Vencimiento</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)", textAlign: "right" }}>Saldo</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Mora</th>
                <th style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }}>
                    <div style={{ color: "var(--nuvia-text-primary)" }}>{r.cliente}</div>
                    {r.cedula && <div style={{ color: "var(--nuvia-text-secondary)", fontSize: 10 }}>{r.cedula}</div>}
                  </td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-secondary)" }}>{r.banco ?? "—"}</td>
                  <td style={{ padding: "8px", color: "#A5B5E0" }}>{r.estado_cartera}</td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-primary)" }} className="tabular-nums">
                    {r.fecha_vencimiento}
                  </td>
                  <td style={{ padding: "8px", color: "var(--nuvia-text-primary)", textAlign: "right" }} className="tabular-nums">
                    {money(r.saldo)}
                  </td>
                  <td style={{ padding: "8px" }} className="tabular-nums">
                    <span
                      style={{
                        color: r.dias <= 0 ? "#9BCB9F" : r.dias <= 30 ? "#F6C453" : "#FF8585",
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={10} style={{ display: "inline", marginRight: 4 }} />
                      {r.dias <= 0 ? `${Math.abs(r.dias)}d` : `+${r.dias}d`}
                    </span>
                  </td>
                  <td style={{ padding: "8px" }}>
                    <div className="flex flex-wrap gap-1">
                      {r.flags.map((f) => {
                        const m = FLAG_LABEL[f];
                        if (!m) return null;
                        return (
                          <span
                            key={f}
                            className="inline-flex rounded-full px-2 py-0.5 font-semibold uppercase"
                            style={{ background: m.bg, color: m.fg, fontSize: 9, letterSpacing: "0.08em" }}
                          >
                            {m.label}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !items.length && (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "var(--nuvia-text-secondary)" }}>
                    Sin cartera pendiente con los filtros actuales.
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
