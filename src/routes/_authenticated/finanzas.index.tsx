import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  InsightCard,
  NCard,
  SectionHeader,
} from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { Banknote, Wallet, Receipt, AlertTriangle, TrendingUp, TrendingDown, PiggyBank } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/")({
  component: FinanzasDashboard,
  head: () => ({ meta: [{ title: "Dashboard financiero · NUVIA" }] }),
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
        comisionesGen: comGen, comisionesPag: comPag, ccPend, ccPag,
        ingMes: ing, egrMes: egr, alertas: (al.data ?? []).length,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <PageLayout>
        <div className="py-20 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando dashboard financiero…</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Banknote size={12} />, label: "Dirección Financiera", tone: "blue" }}
        title="Dashboard Financiero"
        description="Visión consolidada: cartera, comisiones, tesorería y alertas."
      />

      <SectionHeader title="Cartera" icon={<Wallet size={14} />} />
      <KpiGrid cols={4}>
        <KpiCard label="Honorarios totales" value={money(m.honorarios)} tone="neutral" />
        <KpiCard label="Recaudado" value={money(m.recaudado)} tone="green" />
        <KpiCard label="Cartera pendiente" value={money(m.cartera)} tone="blue" />
        <KpiCard label="Vencida" value={money(m.vencida)} tone={m.vencida > 0 ? "danger" : "neutral"} />
      </KpiGrid>

      <SectionHeader title="Comisiones y cuentas de cobro" icon={<Receipt size={14} />} />
      <KpiGrid cols={4}>
        <KpiCard label="Comisiones por pagar" value={money(m.comisionesGen)} tone="blue" />
        <KpiCard label="Comisiones pagadas" value={money(m.comisionesPag)} tone="green" />
        <KpiCard label="CC en trámite" value={money(m.ccPend)} tone="neutral" />
        <KpiCard label="CC pagadas" value={money(m.ccPag)} tone="green" />
      </KpiGrid>

      <SectionHeader title="Tesorería del mes" icon={<PiggyBank size={14} />} />
      <KpiGrid cols={4}>
        <KpiCard label="Ingresos mes" value={money(m.ingMes)} tone="green" icon={<TrendingUp size={16} />} />
        <KpiCard label="Egresos mes" value={money(m.egrMes)} tone="danger" icon={<TrendingDown size={16} />} />
        <KpiCard label="Neto mes" value={money(m.ingMes - m.egrMes)} tone={m.ingMes - m.egrMes >= 0 ? "blue" : "danger"} />
        <KpiCard label="Alertas activas" value={String(m.alertas)} tone={m.alertas > 0 ? "warning" : "neutral"} icon={<AlertTriangle size={16} />} />
      </KpiGrid>

      <InsightCard scope="finanzas" />

      <NCard padding="md">
        <SectionHeader title="Accesos rápidos" description="Operaciones financieras frecuentes." />
        <div className="flex flex-wrap gap-2">
          <Quick to="/finanzas/recaudos">Registrar recaudo</Quick>
          <Quick to="/finanzas/cuentas-cobro">Cuentas de cobro</Quick>
          <Quick to="/finanzas/comisiones">Comisiones</Quick>
          <Quick to="/finanzas/nomina">Nómina</Quick>
          <Quick to="/finanzas/tesoreria">Tesorería</Quick>
          <Quick to="/finanzas/alertas">Alertas IA</Quick>
          <Quick to="/finanzas/auditoria">Auditoría</Quick>
        </div>
      </NCard>
    </PageLayout>
  );
}

function Quick({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg px-3 py-2 text-[12px] font-medium transition"
      style={{
        border: "1px solid var(--nuvia-border)",
        background: "rgba(255,255,255,0.03)",
        color: "var(--nuvia-text-primary)",
      }}
    >
      {children}
    </Link>
  );
}
