import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import { listTodasComisiones, listCuentasCobro, type Comision, type CuentaCobro } from "@/lib/comisiones";
import { supabase } from "@/integrations/supabase/client";
import { CircleDollarSign, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/comisiones")({
  component: FinanzasComisionesPage,
  head: () => ({ meta: [{ title: "Comisiones · Finanzas NUVIA" }] }),
});

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "rgba(68,93,163,0.18)", color: "#A5B5E0", label: "Borrador" },
  enviada: { bg: "rgba(68,93,163,0.22)", color: "#A5B5E0", label: "Enviada" },
  aprobada: { bg: "rgba(132,185,143,0.20)", color: "#B6D9BD", label: "Aprobada" },
  devuelta_correccion: { bg: "rgba(245,158,11,0.18)", color: "#FACC15", label: "Devuelta" },
  rechazada: { bg: "rgba(239,68,68,0.18)", color: "#FCA5A5", label: "Rechazada" },
  programada_pago: { bg: "rgba(99,102,241,0.18)", color: "#A5B4FC", label: "Programada" },
  pagada: { bg: "rgba(132,185,143,0.28)", color: "#B6D9BD", label: "Pagada" },
};

function FinanzasComisionesPage() {
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [com, cc] = await Promise.all([listTodasComisiones(), listCuentasCobro()]);
      setComisiones(com);
      setCuentas(cc);
      const userIds = Array.from(new Set([...com.map((c) => c.user_id), ...cc.map((c) => c.user_id)]));
      if (userIds.length) {
        const { data } = await supabase.from("profiles").select("id, nombre, email").in("id", userIds);
        const m = new Map<string, string>();
        (data ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, []);

  const totales = useMemo(() => {
    const acc = { generada: 0, pendiente: 0, aprobada: 0, pagada: 0, rechazada: 0 };
    for (const c of comisiones) {
      const k = c.estado as keyof typeof acc;
      acc[k] = (acc[k] ?? 0) + Number(c.valor);
    }
    return acc;
  }, [comisiones]);

  if (loading) {
    return (
      <PageLayout>
        <div className="py-24 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Cargando comisiones…
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <CircleDollarSign size={12} />, label: "Finanzas · Vista consolidada", tone: "blue" }}
        title="Comisiones — Vista Finanzas"
        description="Resumen consolidado por Analista Financiero Comercial. Para gestionar cuentas de cobro, abre el detalle."
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<CircleDollarSign size={16} />} tone="blue" label="Generadas" value={formatCOP(totales.generada)} />
        <KpiCard icon={<Clock size={16} />} tone="warning" label="En trámite" value={formatCOP(totales.pendiente)} />
        <KpiCard icon={<CheckCircle2 size={16} />} tone="green" label="Aprobadas + Pagadas" value={formatCOP(totales.aprobada + totales.pagada)} hint={`Pagadas ${formatCOP(totales.pagada)}`} />
        <KpiCard icon={<XCircle size={16} />} tone={totales.rechazada > 0 ? "danger" : "neutral"} label="Rechazadas" value={formatCOP(totales.rechazada)} />
      </KpiGrid>

      <NCard padding="md">
        <SectionHeader
          icon={<FileText size={14} />}
          title="Cuentas de cobro recientes"
          description={`${cuentas.length} registro${cuentas.length === 1 ? "" : "s"} · mostrando últimos 30`}
        />
        {cuentas.length === 0 ? (
          <EmptyState title="Sin cuentas aún" description="Cuando los AFC emitan cuentas de cobro, aparecerán aquí." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Número", a: "left" },
                    { l: "Analista F. Comercial", a: "left" },
                    { l: "Estado", a: "left" },
                    { l: "Total", a: "right" },
                    { l: "", a: "right" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2.5 font-semibold uppercase"
                      style={{
                        textAlign: h.a as "left" | "right",
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                        borderBottom: "1px solid var(--nuvia-border)",
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cuentas.slice(0, 30).map((cc) => {
                  const b = ESTADO_CC[cc.estado] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-secondary)", label: cc.estado };
                  return (
                    <tr
                      key={cc.id}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-3 py-2.5 font-mono text-[11.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
                        {cc.numero}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>
                        {nombres.get(cc.user_id) ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                          style={{ color: b.color, background: b.bg }}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {formatCOP(Number(cc.total))}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to="/comisiones/$id"
                          params={{ id: cc.id }}
                          className="text-[11px] font-semibold hover:underline"
                          style={{ color: "var(--nuvia-accent-blue)" }}
                        >
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}
