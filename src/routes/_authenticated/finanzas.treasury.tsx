import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { Brain, LayoutDashboard, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/treasury")({
  component: TreasuryLayout,
  head: () => ({ meta: [{ title: "NUVIA Treasury AI · Conciliación" }] }),
});

const SUB = [
  { to: "/finanzas/treasury", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { to: "/finanzas/treasury/conciliacion", label: "Conciliación IA", Icon: UploadCloud },
  { to: "/finanzas/treasury/auditoria", label: "Auditoría", Icon: ShieldCheck },
];

function TreasuryLayout() {
  const loc = useLocation();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.10))",
          border: "1px solid var(--nuvia-border)",
        }}
      >
        <div
          className="grid place-items-center rounded-xl shrink-0"
          style={{ width: 36, height: 36, background: "rgba(68,93,163,0.25)", color: "#A5B5E0" }}
        >
          <Brain size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold" style={{ color: "var(--nuvia-text-primary)", fontSize: 15 }}>
              NUVIA Treasury AI
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase"
              style={{
                background: "rgba(132,185,143,0.18)",
                color: "#9BCB9F",
                fontSize: 9,
                letterSpacing: "0.12em",
                border: "1px solid rgba(132,185,143,0.40)",
              }}
            >
              <Sparkles size={10} /> BETA
            </span>
          </div>
          <p style={{ color: "var(--nuvia-text-secondary)", fontSize: 11 }}>
            Motor inteligente de tesorería y conciliación bancaria
          </p>
        </div>
        <nav className="flex flex-wrap gap-1.5">
          {SUB.map((s) => {
            const active = s.exact ? loc.pathname === s.to : loc.pathname.startsWith(s.to);
            return (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                style={
                  active
                    ? { background: "#445DA3", color: "#fff" }
                    : { background: "rgba(255,255,255,0.04)", color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)" }
                }
              >
                <s.Icon size={13} />
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
