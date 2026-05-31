import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { formatCOP } from "@/lib/format";
import { listTodasComisiones, listCuentasCobro, type Comision, type CuentaCobro } from "@/lib/comisiones";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/finanzas/comisiones")({
  component: FinanzasComisionesPage,
  head: () => ({ meta: [{ title: "Comisiones · Finanzas NUVEX" }] }),
});

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

  if (loading) return <div className="p-8 text-center text-sm text-[#242424]/60">Cargando comisiones…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#0A1226]">Comisiones — Vista Finanzas</h1>
        <p className="text-[12px] text-[#242424]/60">
          Resumen consolidado por Analista Financiero Comercial. Para gestionar cuentas de cobro, abre el detalle.
        </p>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Generadas" value={formatCOP(totales.generada)} color="#445DA3" />
        <Stat label="En trámite" value={formatCOP(totales.pendiente)} color="#8A5A00" />
        <Stat label="Aprobadas" value={formatCOP(totales.aprobada)} color="#1F7A45" />
        <Stat label="Pagadas" value={formatCOP(totales.pagada)} color="#1F7A45" />
        <Stat label="Rechazadas" value={formatCOP(totales.rechazada)} color="#991B1B" />
      </div>

      <Card>
        <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
          Cuentas de cobro recientes
        </div>
        {cuentas.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#242424]/60">Sin cuentas aún.</div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-4 py-2 text-left">Número</th>
                <th className="px-4 py-2 text-left">Analista F. Comercial</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {cuentas.slice(0, 30).map((cc) => (
                <tr key={cc.id} className="hover:bg-[#F7F9FB]">
                  <td className="px-4 py-2 font-mono text-[12px]">{cc.numero}</td>
                  <td className="px-4 py-2">{nombres.get(cc.user_id) ?? "—"}</td>
                  <td className="px-4 py-2">{cc.estado}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCOP(Number(cc.total))}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to="/comisiones/$id" params={{ id: cc.id }} className="text-[12px] text-[#445DA3] hover:underline">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}
