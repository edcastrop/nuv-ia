import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout, ExecutiveHero, KpiGrid, KpiCard, NCard } from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import { listCuentasCobro, type CuentaCobro } from "@/lib/comisiones";
import { FileSpreadsheet, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/cuentas-cobro")({
  component: FinanzasCuentasCobroPage,
  head: () => ({ meta: [{ title: "Cuentas de cobro · Finanzas NUVIA" }] }),
});

const FILTROS: { key: CuentaCobro["estado"] | "todas"; label: string }[] = [
  { key: "enviada", label: "Por aprobar" },
  { key: "aprobada", label: "Pendientes de pago" },
  { key: "pagada", label: "Pagadas" },
  { key: "rechazada", label: "Rechazadas" },
  { key: "borrador", label: "Borrador (AFC)" },
  { key: "todas", label: "Todas" },
];

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador:            { bg: "rgba(148,163,184,0.16)", color: "#CBD5E1", label: "Borrador" },
  enviada:             { bg: "rgba(68,93,163,0.18)",   color: "#A5B5E0", label: "Enviada" },
  aprobada:            { bg: "rgba(132,185,143,0.16)", color: "#9BCB9F", label: "Aprobada" },
  devuelta_correccion: { bg: "rgba(246,196,83,0.16)",  color: "#F6C453", label: "Devuelta" },
  rechazada:           { bg: "rgba(255,107,107,0.16)", color: "#FF8585", label: "Rechazada" },
  programada_pago:     { bg: "rgba(99,102,241,0.18)",  color: "#A5B4FC", label: "Programada" },
  pagada:              { bg: "rgba(132,185,143,0.22)", color: "#9BCB9F", label: "Pagada" },
};

function FinanzasCuentasCobroPage() {
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["key"]>("enviada");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await listCuentasCobro();
      setCuentas(list);
      const ids = Array.from(new Set(list.map((c) => c.user_id)));
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id, nombre, email").in("id", ids);
        const m = new Map<string, string>();
        (data ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, []);

  const filtradas = useMemo(
    () => (filtro === "todas" ? cuentas : cuentas.filter((c) => c.estado === filtro)),
    [cuentas, filtro],
  );

  const totales = useMemo(
    () => ({
      porAprobar: cuentas.filter((c) => c.estado === "enviada").reduce((s, c) => s + Number(c.total), 0),
      aprobadas:  cuentas.filter((c) => c.estado === "aprobada").reduce((s, c) => s + Number(c.total), 0),
      pagadas:    cuentas.filter((c) => c.estado === "pagada").reduce((s, c) => s + Number(c.total), 0),
    }),
    [cuentas],
  );

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <FileSpreadsheet size={12} />, label: "Finanzas", tone: "blue" }}
        title="Cuentas de cobro"
        description="Aprueba, rechaza (con motivo) o registra el pago con comprobante. Cada acción queda auditada."
      />

      <KpiGrid cols={3}>
        <KpiCard label="Por aprobar"        value={formatCOP(totales.porAprobar)} tone="warning" icon={<Clock size={14} />} />
        <KpiCard label="Pendientes de pago" value={formatCOP(totales.aprobadas)}  tone="blue"    icon={<FileSpreadsheet size={14} />} />
        <KpiCard label="Pagadas"            value={formatCOP(totales.pagadas)}    tone="green"   icon={<CheckCircle2 size={14} />} />
      </KpiGrid>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="rounded-xl px-3.5 py-1.5 text-[12px] font-medium transition"
              style={
                active
                  ? { background: "linear-gradient(135deg,#445DA3,#84B98F)", color: "#fff", border: "1px solid transparent" }
                  : {
                      background: "rgba(255,255,255,0.04)",
                      color: "var(--nuvia-text-secondary)",
                      border: "1px solid var(--nuvia-border)",
                    }
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <NCard padding="none">
        {loading ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: "var(--nuvia-text-muted)" }}>Sin cuentas en este estado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Número</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Analista F. Comercial</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Enviada</th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Total</th>
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide" style={{ color: "var(--nuvia-text-muted)" }}>Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((cc) => {
                  const b = ESTADO_CC[cc.estado] ?? ESTADO_CC.borrador;
                  return (
                    <tr key={cc.id} className="hover:bg-white/[0.03]" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                      <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "var(--nuvia-text-primary)" }}>{cc.numero}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>{nombres.get(cc.user_id) ?? "—"}</td>
                      <td className="px-4 py-2.5 text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {cc.fecha_envio ? new Date(cc.fecha_envio).toLocaleDateString("es-CO") : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{formatCOP(Number(cc.total))}</td>
                      <td className="px-4 py-2.5">
                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: b.bg, color: b.color }}>
                          {b.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link to="/comisiones/$id" params={{ id: cc.id }} className="text-[12px] font-medium hover:underline" style={{ color: "var(--nuvia-accent-blue)" }}>
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
