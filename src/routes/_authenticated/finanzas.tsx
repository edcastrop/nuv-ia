import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useUserRole } from "@/hooks/useUserRole";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CircleDollarSign,
  FileSpreadsheet,
  Users2,
  Landmark,
  BellRing,
  ShieldCheck,
  FileBarChart2,
  Brain,
} from "lucide-react";


export const Route = createFileRoute("/_authenticated/finanzas")({
  component: FinanzasLayout,
  head: () => ({ meta: [{ title: "Finanzas y Tesorería · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

const SUBMODULOS = [
  { to: "/finanzas", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/finanzas/cartera", label: "Cartera clientes", Icon: Wallet },
  { to: "/finanzas/recaudos", label: "Recaudos", Icon: Receipt },
  { to: "/finanzas/comisiones", label: "Comisiones", Icon: CircleDollarSign },
  { to: "/finanzas/wallets", label: "Wallets", Icon: Wallet },
  { to: "/finanzas/cuentas-cobro", label: "Cuentas de cobro", Icon: FileSpreadsheet },
  { to: "/finanzas/nomina", label: "Nómina", Icon: Users2 },
  { to: "/finanzas/tesoreria", label: "Tesorería", Icon: Landmark },
  { to: "/finanzas/alertas", label: "Alertas IA", Icon: BellRing },
  { to: "/finanzas/reportes", label: "Reportes", Icon: FileBarChart2 },
  { to: "/finanzas/treasury", label: "Treasury AI", Icon: Brain },
  { to: "/finanzas/auditoria", label: "Auditoría", Icon: ShieldCheck },

];

function FinanzasLayout() {
  const { roles, loading } = useUserRole();
  const location = useLocation();
  const autorizado = roles.some((r) => ["super_admin", "admin", "gerencia", "contabilidad"].includes(r));

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!autorizado) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <ShieldCheck className="mx-auto mb-3 text-[#991B1B]" size={36} />
        <h1 className="text-xl font-semibold text-[#0A1226]">Acceso restringido</h1>
        <p className="mt-2 text-sm text-[#242424]/60">
          Este módulo solo está disponible para Super Admin, Admin, Gerencia y Contabilidad.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div
        className="mb-5 rounded-3xl p-5"
        style={{
          background: "var(--nuvia-surface, #0B1226)",
          border: "1px solid var(--nuvia-border, rgba(255,255,255,0.08))",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
          >
            <Landmark size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold" style={{ color: "var(--nuvia-text-primary, #FFFFFF)" }}>
              Finanzas y Tesorería
            </h1>
            <p className="text-[12px]" style={{ color: "var(--nuvia-text-secondary, rgba(255,255,255,0.6))" }}>
              Cartera · Recaudos · Comisiones · Nómina · Tesorería · Auditoría
            </p>
          </div>
        </div>

        <nav
          className="mt-4 flex flex-wrap gap-1.5 rounded-2xl p-1.5"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--nuvia-border, rgba(255,255,255,0.08))",
          }}
        >
          {SUBMODULOS.map((s) => {
            const active = s.exact
              ? location.pathname === s.to
              : location.pathname === s.to || location.pathname.startsWith(s.to + "/");
            return (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition"
                style={
                  active
                    ? { background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`, color: "#fff" }
                    : { color: "var(--nuvia-text-secondary, rgba(255,255,255,0.75))" }
                }
              >
                <s.Icon size={14} />
                {s.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}
