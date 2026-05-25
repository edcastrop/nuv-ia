import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, MetricCard } from "@/components/nuvex/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/finanzas/")({
  component: FinanzasDashboard,
  head: () => ({ meta: [{ title: "Dashboard financiero · NUVEX" }] }),
});

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function FinanzasDashboard() {
  const [m, setM] = useState({
    honorarios: 0, recaudado: 0, cartera: 0, vencida: 0,
    comisionesGen: 0, comisionesPag: 0,
    ccPend: 0, ccPag: 0,
    ingMes: 0, egrMes: 0,
    alertas: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const hoy = new Date();
      const mes1 = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
      const hoyStr = hoy.toISOString().slice(0, 10);

      const [cart, com, cc, tes, al] = await Promise.all([
        supabase.from("cartera" as never).select("honorarios_totales, pagado, fecha_vencimiento, estado_cartera"),
        supabase.from("comisiones" as never).select("valor, estado"),
        supabase.from("cuentas_cobro" as never).select("total, estado"),
        supabase.from("tesoreria_movimientos" as never).select("tipo, valor, fecha").gte("fecha", mes1).lte("fecha", hoyStr),
        supabase.from("finanzas_alertas" as never).select("id").eq("leida", false),
      ]);

      const cartRows = (cart.data ?? []) as unknown as Array<{ honorarios_totales: number; pagado: number; fecha_vencimiento: string; estado_cartera: string }>;
      let hon = 0, pag = 0, ven = 0;
      for (const c of cartRows) {
        hon += Number(c.honorarios_totales);
        pag += Number(c.pagado);
        const saldo = Number(c.honorarios_totales) - Number(c.pagado);
        if (saldo > 0 && new Date(c.fecha_vencimiento) < hoy) ven += saldo;
      }

      const comRows = (com.data ?? []) as unknown as Array<{ valor: number; estado: string }>;
      const comGen = comRows.filter((r) => r.estado !== "pagada").reduce((a, b) => a + Number(b.valor), 0);
      const comPag = comRows.filter((r) => r.estado === "pagada").reduce((a, b) => a + Number(b.valor), 0);

      const ccRows = (cc.data ?? []) as unknown as Array<{ total: number; estado: string }>;
      const ccPend = ccRows.filter((r) => ["borrador", "enviada", "aprobada"].includes(r.estado)).reduce((a, b) => a + Number(b.total), 0);
      const ccPag = ccRows.filter((r) => r.estado === "pagada").reduce((a, b) => a + Number(b.total), 0);

      const tesRows = (tes.data ?? []) as unknown as Array<{ tipo: string; valor: number }>;
      const ing = tesRows.filter((r) => r.tipo === "ingreso").reduce((a, b) => a + Number(b.valor), 0);
      const egr = tesRows.filter((r) => r.tipo === "egreso").reduce((a, b) => a + Number(b.valor), 0);

      setM({
        honorarios: hon, recaudado: pag, cartera: hon - pag, vencida: ven,
        comisionesGen: comGen, comisionesPag: comPag,
        ccPend, ccPag,
        ingMes: ing, egrMes: egr,
        alertas: (al.data ?? []).length,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Card><p className="text-sm text-[#242424]/60">Cargando dashboard…</p></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold text-[#0A1226]">Dashboard financiero NUVEX</h1>
        <p className="text-[12px] text-[#242424]/60">Visión consolidada: cartera, comisiones, tesorería y alertas.</p>
      </Card>

      <section>
        <h2 className="text-[12px] uppercase tracking-wider text-[#242424]/60 mb-2">Cartera</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Honorarios totales" value={money(m.honorarios)} accent="dark" />
          <MetricCard label="Recaudado" value={money(m.recaudado)} accent="green" />
          <MetricCard label="Cartera pendiente" value={money(m.cartera)} accent="blue" />
          <MetricCard label="Vencida" value={money(m.vencida)} accent="default" />
        </div>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-wider text-[#242424]/60 mb-2">Comisiones &amp; cuentas de cobro</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Comisiones por pagar" value={money(m.comisionesGen)} accent="blue" />
          <MetricCard label="Comisiones pagadas" value={money(m.comisionesPag)} accent="green" />
          <MetricCard label="CC en trámite" value={money(m.ccPend)} accent="default" />
          <MetricCard label="CC pagadas" value={money(m.ccPag)} accent="dark" />
        </div>
      </section>

      <section>
        <h2 className="text-[12px] uppercase tracking-wider text-[#242424]/60 mb-2">Tesorería del mes</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Ingresos mes" value={money(m.ingMes)} accent="green" />
          <MetricCard label="Egresos mes" value={money(m.egrMes)} accent="default" />
          <MetricCard label="Neto mes" value={money(m.ingMes - m.egrMes)} accent="blue" />
          <MetricCard label="Alertas activas" value={String(m.alertas)} accent="dark" />
        </div>
      </section>

      <Card>
        <h2 className="text-sm font-semibold text-[#0A1226] mb-2">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2 text-[12.5px]">
          <Quick to="/finanzas/recaudos">Registrar recaudo</Quick>
          <Quick to="/finanzas/cuentas-cobro">Cuentas de cobro</Quick>
          <Quick to="/finanzas/comisiones">Comisiones</Quick>
          <Quick to="/finanzas/nomina">Nómina</Quick>
          <Quick to="/finanzas/tesoreria">Tesorería</Quick>
          <Quick to="/finanzas/alertas">Alertas IA</Quick>
          <Quick to="/finanzas/auditoria">Auditoría</Quick>
        </div>
      </Card>
    </div>
  );
}

function Quick({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 hover:border-[#445DA3] hover:bg-[#F5F7FF] text-[#242424]">
      {children}
    </Link>
  );
}
