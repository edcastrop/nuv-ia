import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { CORPORATIVO, NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FB] text-[#242424]/60 text-sm">
        Cargando…
      </div>
    );
  }

  const NavLink = ({ to, label }: { to: string; label: string }) => {
    const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
    return (
      <Link to={to}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
        style={{
          backgroundColor: active ? NUVEX.negro : "transparent",
          color: active ? "#fff" : "#242424",
        }}>
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-[#F7F9FB]">
      <header className="border-b border-[#E3E7EE] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: NUVEX.negro }}>N</div>
              <div className="hidden sm:block">
                <div className="text-sm font-semibold text-[#242424]">NUVEX</div>
                <div className="text-[10px] text-[#242424]/60 -mt-0.5">Finanzas Inteligentes</div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 ml-2">
              <NavLink to="/" label="Simulador" />
              <NavLink to="/casos" label="Casos" />
              <NavLink to="/dashboard" label="Dashboard" />
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <div className="text-xs font-medium text-[#242424]">{user?.user_metadata?.nombre || user?.email}</div>
              <div className="text-[10px] text-[#242424]/55">{user?.email}</div>
            </div>
            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F9FB]">
              Salir
            </button>
          </div>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-[#E3E7EE] bg-white mt-8">
        <div className="mx-auto max-w-7xl px-6 py-5 text-center text-[11px] text-[#242424]/60">
          <span className="font-semibold text-[#242424]">{CORPORATIVO.nombre}</span> · {CORPORATIVO.telefono} · {CORPORATIVO.web}
        </div>
      </footer>
    </div>
  );
}
