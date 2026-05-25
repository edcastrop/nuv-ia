import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { CORPORATIVO } from "@/components/nuvex/constants";
import { LayoutGrid, FolderKanban, BarChart3, LogOut, GraduationCap, LineChart, UserSquare2, Users, Shield, Wallet, Bell, CircleDollarSign, Landmark } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/nuvex/Logo";
import { supabase } from "@/integrations/supabase/client";


export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

function AuthenticatedLayout() {
  const { session, user, loading } = useAuth();
  const { isSuperAdmin, roles } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);


  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const load = async () => {
      const { count } = await supabase
        .from("caso_alertas" as never)
        .select("id", { count: "exact", head: true })
        .eq("leida", false);
      if (active) setUnread(count ?? 0);
    };
    load();
    const ch = supabase
      .channel("caso_alertas_unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "caso_alertas" }, load)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [session, location.pathname]);


  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm" style={{ background: "#050814" }}>
        Cargando…
      </div>
    );
  }

  const displayName: string = user?.user_metadata?.nombre || (user?.email?.split("@")[0] ?? "Usuario");
  const initials = displayName
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "NV";

  const navItems: { to: string; label: string; Icon: typeof LayoutGrid; exact?: boolean; badge?: number }[] = [
    { to: "/", label: "Simulador", Icon: LayoutGrid, exact: true },
    { to: "/casos", label: "Casos", Icon: FolderKanban },
    { to: "/notificaciones", label: "Alertas", Icon: Bell, badge: unread },
    { to: "/expediente-maestro", label: "Expediente", Icon: UserSquare2 },
    { to: "/proyeccion", label: "Proyección", Icon: LineChart },
    { to: "/dashboard", label: "Dashboard", Icon: BarChart3 },
    { to: "/academia", label: "Academia", Icon: GraduationCap },
    { to: "/apoderados-nuvex", label: "Apoderados", Icon: Users },
    ...(roles.some((r) => ["super_admin","admin","gerencia","cartera","juridica","licenciado","asesor"].includes(r)) ? [{ to: "/cartera", label: "Cartera", Icon: Wallet }] : []),
    { to: "/comisiones", label: "Comisiones", Icon: CircleDollarSign },
    ...(roles.some((r) => ["super_admin","admin","gerencia","cartera"].includes(r)) ? [{ to: "/contabilidad/cuentas-cobro", label: "Contabilidad", Icon: CircleDollarSign }] : []),
    ...(isSuperAdmin ? [{ to: "/super-admin", label: "Super Admin", Icon: Shield }] : []),
  ];



  const NavBtn = ({ to, label, Icon, exact, badge }: { to: string; label: string; Icon: typeof LayoutGrid; exact?: boolean; badge?: number }) => {
    const active = exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/") || location.pathname === to;
    return (
      <Link
        to={to}
        className="group relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-all duration-300 ease-out"
        style={
          active
            ? {
                background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                color: "#fff",
                boxShadow: `0 8px 24px -10px ${AZUL}, 0 0 0 1px rgba(255,255,255,0.08) inset`,
              }
            : {
                color: "rgba(255,255,255,0.72)",
                border: "1px solid transparent",
              }
        }
        onMouseEnter={(e) => {
          if (active) return;
          const el = e.currentTarget;
          el.style.background = "rgba(255,255,255,0.04)";
          el.style.border = `1px solid ${AZUL}55`;
          el.style.color = "#fff";
          el.style.boxShadow = `0 0 0 1px ${AZUL}22, 0 6px 18px -8px ${AZUL}66`;
        }}
        onMouseLeave={(e) => {
          if (active) return;
          const el = e.currentTarget;
          el.style.background = "transparent";
          el.style.border = "1px solid transparent";
          el.style.color = "rgba(255,255,255,0.72)";
          el.style.boxShadow = "none";
        }}
      >
        <Icon size={15} />
        <span>{label}</span>
        {badge && badge > 0 ? (
          <span
            className="ml-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "#E11D48", color: "#fff" }}
          >
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#F7F9FB" }}>
      <header
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          background: "linear-gradient(90deg, #050814, #0A1226, #07162D)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: scrolled ? "0 12px 40px -20px rgba(0,0,0,0.7)" : "none",
        }}
      >
        {/* Inner glow ambient */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/4 h-48 w-[420px] rounded-full opacity-[0.12] blur-[100px]" style={{ background: AZUL }} />
          <div className="absolute -top-24 right-1/4 h-48 w-[420px] rounded-full opacity-[0.10] blur-[100px]" style={{ background: VERDE }} />
        </div>

        <div className="relative mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6" style={{ height: 92 }}>
          {/* IZQUIERDA — Logo */}
          <Link to="/" className="group flex items-center transition-transform duration-300 hover:-translate-y-0.5">
            <Logo variant="white" height={40} />
          </Link>

          {/* CENTRO — Navegación */}
          <nav className="hidden lg:flex items-center gap-1.5 rounded-2xl px-2 py-1.5"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(12px)",
            }}
          >
            {navItems.map((it) => <NavBtn key={it.to} {...it} />)}
          </nav>

          {/* DERECHA — Usuario + Salir */}
          <div className="flex items-center gap-3">
            <div
              className="hidden md:flex items-center gap-3 rounded-2xl pl-2 pr-4 py-2 transition-all duration-300 hover:-translate-y-0.5"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 6px 18px -10px rgba(0,0,0,0.6)",
              }}
            >
              <div
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{
                  background: "#0A1226",
                  boxShadow: `0 0 0 2px transparent`,
                  backgroundImage: `linear-gradient(#0A1226, #0A1226), linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                  backgroundOrigin: "border-box",
                  backgroundClip: "padding-box, border-box",
                  border: "2px solid transparent",
                }}
              >
                {initials}
              </div>
              <div className="leading-tight text-right">
                <div className="text-[12.5px] font-semibold text-white truncate max-w-[180px]">
                  {displayName}
                </div>
                <div className="text-[10.5px] text-white/55 truncate max-w-[180px]">{user?.email}</div>
              </div>
            </div>

            <button
              onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
              className="group inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-wider text-white/80 transition-all duration-300 ease-out hover:text-white hover:-translate-y-0.5"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.10)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = `1px solid ${VERDE}66`;
                e.currentTarget.style.boxShadow = `0 6px 18px -10px ${VERDE}99`;
                e.currentTarget.style.background = "rgba(132,185,143,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Línea inferior luminosa */}
        <div className="relative h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${AZUL}66, ${VERDE}66, transparent)` }}>
          <div className="absolute inset-x-0 -bottom-1 h-1 blur-md opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${AZUL}, ${VERDE}, transparent)` }} />
        </div>

        {/* Nav móvil */}
        <nav className="lg:hidden flex items-center gap-1.5 overflow-x-auto px-4 py-2"
          style={{ background: "rgba(5,8,20,0.6)", borderTop: "1px solid rgba(255,255,255,0.04)" }}
        >
          {navItems.map((it) => <NavBtn key={it.to} {...it} />)}
        </nav>
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
