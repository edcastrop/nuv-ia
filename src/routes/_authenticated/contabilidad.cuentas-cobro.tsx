import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
} from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import { listCuentasCobro, type CuentaCobro } from "@/lib/comisiones";
import { Receipt, Clock, CheckCircle2, Wallet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contabilidad/cuentas-cobro")({
  component: ContabilidadPage,
  head: () => ({ meta: [{ title: "Contabilidad · Cuentas de cobro · NUVIA" }] }),
});

const FILTROS: { key: CuentaCobro["estado"] | "todas"; label: string }[] = [
  { key: "enviada", label: "Por aprobar" },
  { key: "aprobada", label: "Aprobadas (pendientes pago)" },
  { key: "programada_pago", label: "Programadas" },
  { key: "devuelta_correccion", label: "Devueltas" },
  { key: "pagada", label: "Pagadas" },
  { key: "rechazada", label: "Rechazadas" },
  { key: "todas", label: "Todas" },
];

const ESTADO_CC: Record<string, { bg: string; color: string; border: string; label: string }> = {
  borrador: { bg: "rgba(165,181,224,0.10)", color: "#A5B5E0", border: "rgba(165,181,224,0.35)", label: "Borrador" },
  enviada: { bg: "rgba(68,93,163,0.16)", color: "#A5B5E0", border: "rgba(68,93,163,0.45)", label: "Enviada" },
  aprobada: { bg: "rgba(132,185,143,0.16)", color: "#9BCB9F", border: "rgba(132,185,143,0.45)", label: "Aprobada" },
  devuelta_correccion: { bg: "rgba(246,196,83,0.16)", color: "#F6C453", border: "rgba(246,196,83,0.45)", label: "Devuelta" },
  rechazada: { bg: "rgba(255,107,107,0.16)", color: "#FF8585", border: "rgba(255,107,107,0.45)", label: "Rechazada" },
  programada_pago: { bg: "rgba(165,181,224,0.16)", color: "#A5B5E0", border: "rgba(165,181,224,0.45)", label: "Programada" },
  pagada: { bg: "rgba(132,185,143,0.18)", color: "#9BCB9F", border: "rgba(132,185,143,0.45)", label: "Pagada" },
};

function ContabilidadPage() {
  const { roles, loading: rolesLoading } = useUserRole();
  const autorizado = roles.some((r) => ["admin", "gerencia", "super_admin", "cartera", "contabilidad"].includes(r));
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("enviada");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rolesLoading || !autorizado) return;
    (async () => {
      setLoading(true);
      const list = await listCuentasCobro();
      setCuentas(list);
      const ids = Array.from(new Set(list.map((c) => c.user_id)));
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const m = new Map<string, string>();
        (data ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, [rolesLoading, autorizado]);

  const filtradas = useMemo(
    () => (filtro === "todas" ? cuentas : cuentas.filter((c) => c.estado === filtro)),
    [cuentas, filtro],
  );

  const totales = useMemo(
    () => ({
      porAprobar: cuentas.filter((c) => c.estado === "enviada").reduce((s, c) => s + Number(c.total), 0),
      aprobadas: cuentas.filter((c) => c.estado === "aprobada").reduce((s, c) => s + Number(c.total), 0),
      pagadas: cuentas.filter((c) => c.estado === "pagada").reduce((s, c) => s + Number(c.total), 0),
    }),
    [cuentas],
  );

  if (rolesLoading) {
    return (
      <PageLayout>
        <div className="py-16 text-center text-[13px]" style={{ color: "var(--nuvia-text-muted)" }}>
          Cargando…
        </div>
      </PageLayout>
    );
  }
  if (!autorizado) {
    return (
      <PageLayout>
        <div className="py-16 text-center text-[13px]" style={{ color: "var(--nuvia-danger)" }}>
          No autorizado.
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Receipt size={12} />, label: "Contabilidad", tone: "blue" }}
        title="Cuentas de cobro"
        description="Aprueba, rechaza o registra el pago de las cuentas enviadas."
      />

      <KpiGrid cols={3}>
        <KpiCard icon={<Clock size={14} />} tone="warning" label="Por aprobar" value={formatCOP(totales.porAprobar)} />
        <KpiCard icon={<Wallet size={14} />} tone="blue" label="Pendientes de pago" value={formatCOP(totales.aprobadas)} />
        <KpiCard icon={<CheckCircle2 size={14} />} tone="green" label="Pagadas" value={formatCOP(totales.pagadas)} />
      </KpiGrid>

      <NCard padding="md">
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTROS.map((f) => {
            const active = filtro === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                style={{
                  border: `1px solid ${active ? "var(--nuvia-accent-blue)" : "var(--nuvia-border)"}`,
                  background: active ? "rgba(68,93,163,0.18)" : "rgba(255,255,255,0.02)",
                  color: active ? "#A5B5E0" : "var(--nuvia-text-secondary)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>Sin cuentas en este estado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  {["Número", "Analista F. Comercial", "Enviada", "Total", "Estado", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`py-2 px-3 text-[10px] font-semibold uppercase tracking-wider ${h === "Total" ? "text-right" : "text-left"}`}
                      style={{ color: "var(--nuvia-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((cc) => {
                  const b = ESTADO_CC[cc.estado];
                  return (
                    <tr key={cc.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                      <td className="py-2 px-3 font-mono text-[11.5px]" style={{ color: "var(--nuvia-text-primary)" }}>{cc.numero}</td>
                      <td className="py-2 px-3" style={{ color: "var(--nuvia-text-primary)" }}>{nombres.get(cc.user_id) ?? "—"}</td>
                      <td className="py-2 px-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {cc.fecha_envio ? new Date(cc.fecha_envio).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {formatCOP(Number(cc.total))}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: b.bg, color: b.color, border: `1px solid ${b.border}` }}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Link
                          to="/comisiones/$id"
                          params={{ id: cc.id }}
                          className="text-[11.5px] font-semibold hover:underline"
                          style={{ color: "#A5B5E0" }}
                        >
                          Gestionar →
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
