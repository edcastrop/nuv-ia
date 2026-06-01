import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { CORPORATIVO } from "@/components/nuvex/constants";
import {
  LayoutGrid, FolderKanban, BarChart3, LogOut, GraduationCap, LineChart,
  UserSquare2, Users, Shield, Wallet, Bell, CircleDollarSign, Landmark,
  ClipboardCheck, Briefcase, ChevronLeft, ChevronRight, UserCircle, MessageSquare, BookUser, Sparkles, ShieldCheck, Kanban, RadioTower,
} from "lucide-react";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/nuvex/Logo";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notificaciones/NotificationBell";
import { NuvexGptButton } from "@/components/nuvex-gpt/NuvexGptPanel";
import { AcademiaBanner } from "@/components/onboarding/AcademiaBanner";
import { OnboardingChecklistBanner } from "@/components/onboarding/OnboardingChecklistBanner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";

type NavItem = { to: string; label: string; Icon: typeof LayoutGrid; exact?: boolean; badge?: number };
type NavSection = { label: string; items: NavItem[] };

function AuthenticatedLayout() {
  const { session, user, loading } = useAuth();
  const { isSuperAdmin, roles, isDirectorQA, isApoderado } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [colabUnread, setColabUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [profileMeta, setProfileMeta] = useState<{ nombre: string | null; avatar_url: string | null }>({ nombre: null, avatar_url: null });
  const [gateState, setGateState] = useState<"checking" | "ok" | "blocked">("checking");
  const [gateChecked, setGateChecked] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nuvex.sidebar.collapsed") === "1";
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // CRITICAL GATE: bloquea render hasta validar estado_acceso=aprobado/activo.
  // SUPER_ADMIN tiene bypass operativo para no quedar atrapado por estado/onboarding/academia.
  useEffect(() => {
    if (!session?.user) return;
    let cancel = false;
    (async () => {
      const [{ data }, { data: roleRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("estado_acceso, onboarding_estado, mfa_verificado_at")
          .eq("id", session.user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id),
      ]);
      if (cancel) return;
      const roleNames = ((roleRows ?? []) as Array<{ role?: string }>).map((r) => r.role);
      const superAdminBypass = roleNames.includes("super_admin");
      const isApoderadoOnly = roleNames.includes("apoderado") && !roleNames.some((r) => r && r !== "apoderado");
      const estado = (data as { estado_acceso?: string } | null)?.estado_acceso ?? "pendiente";
      const onb = (data as { onboarding_estado?: string } | null)?.onboarding_estado ?? "pendiente";
      const mfaAt = (data as { mfa_verificado_at?: string | null } | null)?.mfa_verificado_at ?? null;
      const path = location.pathname;
      const aprobado = estado === "aprobado" || estado === "activo" || estado === "reactivado";

      // GATE MFA GLOBAL: aplica a TODOS los roles sin excepción (incluido super_admin).
      // Cubre acceso directo por URL, refresco de sesión y login vía Google OAuth.
      // Ventana: 24 horas desde la última verificación exitosa.
      const mfaOk = !!(mfaAt && (Date.now() - new Date(mfaAt).getTime()) < 24 * 3600 * 1000);
      if (!mfaOk && path !== "/mfa-verificar") {
        setGateState("blocked");
        setGateChecked(true);
        navigate({ to: "/mfa-verificar" });
        return;
      }

      if (superAdminBypass) {
        setGateState("ok");
        setGateChecked(true);
        if (path === "/pendiente-aprobacion" || path.startsWith("/onboarding")) {
          navigate({ to: "/" });
        }
        return;
      }

      if (!aprobado) {
        if (path !== "/pendiente-aprobacion") {
          setGateState("blocked");
          setGateChecked(true);
          supabase.from("onboarding_auditoria" as never).insert({
            user_id: session.user.id,
            evento: "acceso_bloqueado",
            actor_id: session.user.id,
            detalle: { path, estado_acceso: estado },
          } as never).then(() => {});
          navigate({ to: "/pendiente-aprobacion" });
        } else {
          setGateState("ok");
          setGateChecked(true);
        }
        return;
      }
      if (!isApoderadoOnly && onb !== "completado" && !path.startsWith("/onboarding") && !path.startsWith("/mi-perfil")) {
        setGateState("blocked");
        setGateChecked(true);
        navigate({ to: "/onboarding" });
        return;
      }
      if (isApoderadoOnly && (path === "/" || path.startsWith("/onboarding") || path === "/pendiente-aprobacion")) {
        setGateState("ok");
        setGateChecked(true);
        navigate({ to: "/apoderado/mis-casos" });
        return;
      }
      setGateState("ok");
      setGateChecked(true);
    })();
    return () => { cancel = true; };
    // Sólo revalidar cuando cambia la sesión, NO en cada navegación (evita parpadeo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nuvex.sidebar.collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const load = async () => {
      const [{ count: ca }, { count: nu }] = await Promise.all([
        supabase
          .from("caso_alertas" as never)
          .select("id", { count: "exact", head: true })
          .eq("leida", false),
        supabase
          .from("notificaciones_usuario" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("leida", false),
      ]);
      if (active) setUnread((ca ?? 0) + (nu ?? 0));
    };
    load();
    const ch1 = supabase
      .channel("alerts_unread_" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "caso_alertas" }, load)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificaciones_usuario", filter: `user_id=eq.${uid}` },
        load,
      )
      .subscribe();
    const iv = setInterval(load, 15000);
    return () => { active = false; clearInterval(iv); supabase.removeChannel(ch1); };
  }, [session, location.pathname, gateState]);

  // Carga nombre y avatar desde profiles (fuente única) para topbar/menú.
  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const loadProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nombre, avatar_url")
        .eq("id", uid)
        .maybeSingle();
      if (!active || !data) return;
      const d = data as { nombre: string | null; avatar_url: string | null };
      setProfileMeta({ nombre: d.nombre, avatar_url: d.avatar_url });
    };
    loadProfile();
    const ch = supabase
      .channel("profile_self_" + uid)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, loadProfile)
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [session?.user?.id, gateState]);

  // Contadores colab (DM y notificaciones internas) para los badges del menú.
  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const load = async () => {
      const [{ count: nc }, { data: miembros }] = await Promise.all([
        supabase
          .from("colab_notificaciones" as never)
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid)
          .eq("leida", false),
        supabase
          .from("colab_miembros" as never)
          .select("canal_id, ultima_lectura, colab_canales!inner(id,tipo,archivado)")
          .eq("user_id", uid),
      ]);
      if (!active) return;
      setColabUnread(nc ?? 0);
      const dmRows = ((miembros ?? []) as any[]).filter((m) => m.colab_canales?.tipo === "dm" && !m.colab_canales?.archivado);
      if (dmRows.length === 0) { setDmUnread(0); return; }
      const ids = dmRows.map((r) => r.canal_id);
      const readMap = new Map<string, string | null>(dmRows.map((r) => [r.canal_id, r.ultima_lectura]));
      const { data: msgs } = await supabase
        .from("colab_mensajes" as never)
        .select("canal_id, user_id, created_at")
        .in("canal_id", ids)
        .order("created_at", { ascending: false })
        .limit(ids.length * 30);
      if (!active) return;
      let total = 0;
      ((msgs ?? []) as any[]).forEach((m) => {
        if (m.user_id === uid) return;
        const last = readMap.get(m.canal_id);
        if (!last || new Date(m.created_at) > new Date(last)) total++;
      });
      setDmUnread(total);
    };
    load();
    const ch = supabase
      .channel("colab_unread_" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "colab_notificaciones", filter: `user_id=eq.${uid}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "colab_mensajes" }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "colab_miembros", filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => { active = false; clearInterval(iv); supabase.removeChannel(ch); };
  }, [session?.user?.id, gateState]);


  if (loading || !session || gateState !== "ok") {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm" style={{ background: "#050814" }}>
        Verificando acceso…
      </div>
    );
  }

  const displayName: string = profileMeta.nombre || user?.user_metadata?.nombre || (user?.email?.split("@")[0] ?? "Usuario");
  const avatarUrl: string | null = profileMeta.avatar_url;
  
  

  const has = (r: string) => roles.includes(r as never);
  const hasAny = (...rs: string[]) => rs.some(has);

  const sections: NavSection[] = isApoderado && !isSuperAdmin
    ? [{
        label: "Apoderado",
        items: [
          { to: "/apoderado/mis-casos", label: "Mis casos", Icon: Briefcase },
          { to: "/nuvex-ia", label: "NUVEX IA", Icon: Sparkles },
          { to: "/notificaciones", label: "Alertas", Icon: Bell, badge: unread },
          { to: "/mi-perfil", label: "Mi Perfil", Icon: UserCircle },
        ],
      }]
    : [
        {
          label: "Operación",
          items: [
            { to: "/", label: "Simulador", Icon: LayoutGrid, exact: true },
            { to: "/nuvex-ia", label: "NUVEX IA", Icon: Sparkles },
            { to: "/casos", label: "Casos", Icon: FolderKanban },
            { to: "/pipeline", label: "Pipeline", Icon: Kanban },
            { to: "/expediente-maestro", label: "Expediente", Icon: UserSquare2 },
            { to: "/proyeccion", label: "Proyección", Icon: LineChart },
            ...(hasAny("super_admin","admin","gerencia","licenciado","director_financiero_qa") ? [{ to: "/proyeccion-financiera", label: "Proyección Financiera", Icon: LineChart }] : []),
            { to: "/notificaciones", label: "Alertas", Icon: Bell, badge: unread },
            { to: "/colaboracion", label: "Colaboración", Icon: MessageSquare, badge: colabUnread },
            { to: "/colaboracion/dm", label: "Mensajería", Icon: Briefcase, badge: dmUnread },
            { to: "/directorio", label: "Directorio", Icon: BookUser },
          ],
        },
        {
          label: "Análisis",
          items: [
            { to: "/dashboard", label: "Dashboard", Icon: BarChart3 },
            ...(hasAny("super_admin","admin","gerencia") ? [{ to: "/torre-control", label: "Torre de Control", Icon: RadioTower }] : []),
            ...(hasAny("super_admin","admin","gerencia") ? [{ to: "/incidentes", label: "Incidentes", Icon: ShieldCheck }] : []),
            ...(hasAny("super_admin","gerencia") ? [{ to: "/gestion-usuarios", label: "Gestión usuarios", Icon: Users }] : []),
            ...(hasAny("super_admin","gerencia") ? [{ to: "/productividad", label: "Productividad", Icon: BarChart3 }] : []),
            ...(hasAny("super_admin","admin","director_financiero_qa","gerencia") ? [{ to: "/qa", label: "QA", Icon: ClipboardCheck }] : []),
          ],
        },
        {
          label: "Finanzas",
          items: [
            ...(hasAny("super_admin","admin","gerencia","cartera","juridica","licenciado","asesor") ? [{ to: "/cartera", label: "Cartera", Icon: Wallet }] : []),
            { to: "/comisiones", label: "Comisiones", Icon: CircleDollarSign },
            ...(hasAny("super_admin","admin","gerencia","cartera") ? [{ to: "/contabilidad/cuentas-cobro", label: "Contabilidad", Icon: CircleDollarSign }] : []),
            ...(hasAny("super_admin","admin","gerencia","juridica","director_juridico","operaciones") ? [{ to: "/contratacion/validacion", label: "Validación contratación", Icon: ShieldCheck }] : []),
            ...(hasAny("super_admin","admin","gerencia","contabilidad") ? [{ to: "/finanzas", label: "Finanzas", Icon: Landmark }] : []),
          ],
        },
        {
          label: "Gestión",
          items: [
            ...(isSuperAdmin ? [{ to: "/apoderados-nuvex", label: "Apoderados", Icon: Users }] : []),
            { to: "/academia", label: "Academia", Icon: GraduationCap },
            ...(isSuperAdmin ? [{ to: "/super-admin/academia", label: "Admin Academia", Icon: GraduationCap }] : []),
            ...(isSuperAdmin ? [{ to: "/super-admin/accesos", label: "Accesos", Icon: Shield }] : []),
            ...(isSuperAdmin ? [{ to: "/super-admin/onboarding", label: "Onboarding", Icon: UserCircle }] : []),
            ...(isSuperAdmin ? [{ to: "/super-admin/nuvex-ia-kb", label: "NUVEX IA · KB", Icon: Shield }] : []),
            ...(isSuperAdmin ? [{ to: "/super-admin", label: "Super Admin", Icon: Shield }] : []),
          ],
        },

        {
          label: "Cuenta",
          items: [
            { to: "/mi-perfil", label: "Mi Perfil", Icon: UserCircle },
          ],
        },
      ];

  const visibleSections = sections.map((s) => ({ ...s, items: s.items.filter(Boolean) })).filter((s) => s.items.length > 0);

  const isActive = (to: string, exact?: boolean) =>
    exact ? location.pathname === to : location.pathname === to || location.pathname.startsWith(to + "/");

  const SidebarItem = ({ it }: { it: NavItem }) => {
    const active = isActive(it.to, it.exact);
    return (
      <Link
        to={it.to}
        title={collapsed ? it.label : undefined}
        className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200"
        style={
          active
            ? {
                background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                color: "#fff",
                boxShadow: `0 8px 20px -10px ${AZUL}, 0 0 0 1px rgba(255,255,255,0.08) inset`,
              }
            : { color: "rgba(255,255,255,0.72)" }
        }
        onMouseEnter={(e) => {
          if (active) return;
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.color = "#fff";
        }}
        onMouseLeave={(e) => {
          if (active) return;
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.72)";
        }}
      >
        <it.Icon size={17} className="shrink-0" />
        {!collapsed && <span className="truncate">{it.label}</span>}
        {!collapsed && it.badge && it.badge > 0 ? (
          <span
            className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "#E11D48", color: "#fff" }}
          >
            {it.badge > 99 ? "99+" : it.badge}
          </span>
        ) : null}
        {collapsed && it.badge && it.badge > 0 ? (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full" style={{ background: "#E11D48" }} />
        ) : null}
      </Link>
    );
  };

  const sidebarWidth = collapsed ? 76 : 248;

  const SidebarContent = (
    <aside
      className="flex h-full flex-col"
      style={{
        width: sidebarWidth,
        background: "linear-gradient(180deg, #050814, #0A1226 60%, #07162D)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        transition: "width 200ms ease",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-10 h-48 w-[280px] rounded-full opacity-[0.10] blur-[100px]" style={{ background: AZUL }} />
        <div className="absolute bottom-10 -right-10 h-48 w-[260px] rounded-full opacity-[0.08] blur-[100px]" style={{ background: VERDE }} />
      </div>

      <div className="relative flex items-center justify-between px-4 py-5" style={{ minHeight: 76 }}>
        <Link to="/" className="flex items-center">
          <Logo variant="white" height={collapsed ? 24 : 32} className={collapsed ? "max-w-[40px] object-contain" : ""} />
        </Link>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/5"
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 pb-4 space-y-5 scrollbar-thin">
        {visibleSections.map((s) => (
          <div key={s.label}>
            {!collapsed && (
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                {s.label}
              </div>
            )}
            {collapsed && <div className="mx-3 mb-2 h-px bg-white/5" />}
            <div className="space-y-1">
              {s.items.map((it) => <SidebarItem key={it.to} it={it} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="relative border-t border-white/5 p-3">
        <button
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-medium text-white/70 transition hover:bg-white/5 hover:text-white"
          title={collapsed ? "Salir" : undefined}
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex" style={{ background: "#F7F9FB" }}>
      {/* Sidebar desktop */}
      <div className="hidden lg:block sticky top-0 h-screen relative">
        {SidebarContent}
      </div>

      {/* Sidebar móvil (drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative h-full">{SidebarContent}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header delgado */}
        <header
          className="sticky top-0 z-40"
          style={{
            background: "linear-gradient(90deg, #050814, #0A1226)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center justify-between gap-4 px-5" style={{ height: 64 }}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/5"
                aria-label="Abrir menú"
              >
                <LayoutGrid size={16} />
              </button>
              <div className="hidden md:block text-[12px] font-medium uppercase tracking-[0.18em] text-white/40">
                {CORPORATIVO.nombre}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link
                to="/mi-perfil"
                title="Mi Perfil"
                className="hidden sm:flex items-center gap-3 rounded-xl pl-1.5 pr-3 py-1 transition hover:bg-white/[0.07]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <UserAvatar userId={user?.id} url={avatarUrl} name={displayName} email={user?.email} size="sm" ring />
                <div className="leading-tight text-right">
                  <div className="text-[12px] font-semibold text-white truncate max-w-[160px]">{displayName}</div>
                  <div className="text-[10px] text-white/50 truncate max-w-[160px]">{user?.email}</div>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          {!isApoderado && (
            <>
              <div className="px-4 pt-4"><OnboardingChecklistBanner /></div>
              <AcademiaBanner />
            </>
          )}
          <Outlet />
        </main>

        {!isApoderado && <NuvexGptButton />}

        <footer className="border-t border-[#E3E7EE] bg-white">
          <div className="mx-auto max-w-7xl px-6 py-5 text-center text-[11px] text-[#242424]/60">
            <span className="font-semibold text-[#242424]">{CORPORATIVO.nombre}</span> · {CORPORATIVO.telefono} · {CORPORATIVO.web}
          </div>
        </footer>
      </div>
    </div>
  );
}
