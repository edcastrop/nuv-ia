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
        className="relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{
          background:
            "radial-gradient(120% 200% at 0% 0%, rgba(68,93,163,0.35) 0%, rgba(20,28,48,0.85) 45%, rgba(14,18,30,0.95) 100%)",
          border: "1px solid rgba(132,185,143,0.18)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px -20px rgba(68,93,163,0.55)",
        }}
      >
        {/* glow orb */}
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            top: -60,
            right: -40,
            width: 220,
            height: 220,
            background:
              "radial-gradient(circle, rgba(132,185,143,0.22) 0%, rgba(132,185,143,0) 70%)",
            filter: "blur(8px)",
          }}
        />
        <div
          className="relative grid place-items-center rounded-xl shrink-0"
          style={{
            width: 44,
            height: 44,
            background:
              "linear-gradient(135deg, rgba(68,93,163,0.55), rgba(132,185,143,0.35))",
            color: "#fff",
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 24px -8px rgba(68,93,163,0.7)",
          }}
        >
          <Brain size={20} />
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              className="font-semibold tracking-tight"
              style={{ color: "#F5F7FB", fontSize: 16 }}
            >
              NUVIA Treasury AI
            </h2>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase"
              style={{
                background: "rgba(132,185,143,0.16)",
                color: "#A8DDAC",
                fontSize: 9,
                letterSpacing: "0.14em",
                border: "1px solid rgba(132,185,143,0.45)",
              }}
            >
              <Sparkles size={10} /> BETA
            </span>
          </div>
          <p
            className="mt-0.5"
            style={{ color: "rgba(220,226,240,0.65)", fontSize: 11.5 }}
          >
            Motor inteligente de tesorería y conciliación bancaria
          </p>
        </div>
        <nav
          className="relative flex flex-wrap gap-1 p-1 rounded-xl"
          style={{
            background: "rgba(8,12,22,0.55)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {SUB.map((s) => {
            const active = s.exact ? loc.pathname === s.to : loc.pathname.startsWith(s.to);
            return (
              <Link
                key={s.to}
                to={s.to}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
                style={
                  active
                    ? {
                        background:
                          "linear-gradient(135deg, #4F69B8 0%, #445DA3 100%)",
                        color: "#fff",
                        boxShadow:
                          "0 0 0 1px rgba(255,255,255,0.1) inset, 0 6px 16px -6px rgba(68,93,163,0.9)",
                      }
                    : {
                        background: "transparent",
                        color: "rgba(200,208,226,0.7)",
                      }
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
