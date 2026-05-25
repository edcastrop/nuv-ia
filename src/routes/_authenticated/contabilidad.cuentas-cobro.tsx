import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
import { formatCOP } from "@/lib/format";
import { listCuentasCobro, type CuentaCobro } from "@/lib/comisiones";

export const Route = createFileRoute("/_authenticated/contabilidad/cuentas-cobro")({
  component: ContabilidadPage,
  head: () => ({ meta: [{ title: "Contabilidad · Cuentas de cobro" }] }),
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

function ContabilidadPage() {
  const { roles, loading: rolesLoading } = useUserRole();
  const autorizado = roles.some((r) => ["admin", "gerencia", "super_admin", "cartera"].includes(r));
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

  if (rolesLoading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!autorizado) return <div className="p-12 text-center text-sm text-[#991B1B]">No autorizado.</div>;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-1 text-2xl font-semibold text-[#0A1226]">Contabilidad · Cuentas de cobro</h1>
      <p className="mb-6 text-sm text-[#242424]/60">Aprueba, rechaza o registra el pago de las cuentas enviadas.</p>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Por aprobar" value={formatCOP(totales.porAprobar)} color="#8A5A00" />
        <Stat label="Pendientes de pago" value={formatCOP(totales.aprobadas)} color="#445DA3" />
        <Stat label="Pagadas" value={formatCOP(totales.pagadas)} color="#1F7A45" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const active = filtro === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="rounded-xl border px-3.5 py-1.5 text-[12px] font-medium transition"
              style={{
                background: active ? "linear-gradient(135deg,#445DA3,#84B98F)" : "#fff",
                color: active ? "#fff" : "#0A1226",
                borderColor: active ? "transparent" : "#E3E7EE",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <Card>
        {loading ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>
        ) : filtradas.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">Sin cuentas en este estado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-4 py-2 text-left">Número</th>
                <th className="px-4 py-2 text-left">Licenciado</th>
                <th className="px-4 py-2 text-left">Enviada</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {filtradas.map((cc) => {
                const b = ESTADO_CC[cc.estado];
                return (
                  <tr key={cc.id} className="hover:bg-[#F7F9FB]">
                    <td className="px-4 py-2 font-mono text-[12px] text-[#0A1226]">{cc.numero}</td>
                    <td className="px-4 py-2 text-[#0A1226]">{nombres.get(cc.user_id) ?? "—"}</td>
                    <td className="px-4 py-2 text-[12px] text-[#242424]/70">
                      {cc.fecha_envio ? new Date(cc.fecha_envio).toLocaleDateString("es-CO") : "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCOP(Number(cc.total))}</td>
                    <td className="px-4 py-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: b.bg, color: b.color }}
                      >
                        {b.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to="/comisiones/$id"
                        params={{ id: cc.id }}
                        className="text-[12px] font-medium text-[#445DA3] hover:underline"
                      >
                        Gestionar →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "#F1F3F8", color: "#445DA3", label: "Borrador" },
  enviada: { bg: "#EEF1FA", color: "#445DA3", label: "Enviada" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  devuelta_correccion: { bg: "#FEF3C7", color: "#8A5A00", label: "Devuelta" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
  programada_pago: { bg: "#E0E7FF", color: "#3730A3", label: "Programada" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
};

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
