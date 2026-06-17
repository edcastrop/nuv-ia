import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { CORPORATIVO } from "@/components/nuvex/constants";
import {
  LayoutGrid,
  FolderKanban,
  BarChart3,
  LogOut,
  GraduationCap,
  LineChart,
  UserSquare2,
  Users,
  Shield,
  Wallet,
  Bell,
  CircleDollarSign,
  Landmark,
  ClipboardCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  MessageSquare,
  BookUser,
  Sparkles,
  ShieldCheck,
  Kanban,
  RadioTower,
  Award,
  RefreshCw,
  Wrench,
  DollarSign,
  Rocket,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { useUserRole } from "@/hooks/useUserRole";
import { Logo } from "@/components/nuvex/Logo";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/notificaciones/NotificationBell";
import { NuvexGptButton } from "@/components/nuvex-gpt/NuvexGptPanel";
import { AcademiaBanner } from "@/components/onboarding/AcademiaBanner";
import { OnboardingChecklistBanner } from "@/components/onboarding/OnboardingChecklistBanner";
import { iniciarPresenciaPropia, detenerPresenciaPropia } from "@/lib/presencia";
import { NotificacionesAlerts } from "@/components/notificaciones/NotificacionesAlerts";
import { useNivelAutonomia } from "@/hooks/useNivelAutonomia";
import { etiquetaNivel } from "@/lib/autonomia";
import { EtapaTransicionDialog } from "@/components/expediente/EtapaTransicionDialog";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const AZUL = "var(--nuvia-accent-blue)";
const VERDE = "var(--nuvia-accent-green)";
const GRADIENT = "var(--nuvia-gradient-primary)";

const GATE_CACHE_PREFIX = "nuvex.accessGate.";
const GATE_CACHE_TTL_MS = 30 * 60 * 1000;

type AccessGateCache = { ok: true; at: number };

function getAccessGateCache(userId: string): AccessGateCache | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `${GATE_CACHE_PREFIX}${userId}`;
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccessGateCache;
    if (!parsed.ok || Date.now() - parsed.at > GATE_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setAccessGateCache(userId: string) {
  if (typeof window === "undefined") return;
  const key = `${GATE_CACHE_PREFIX}${userId}`;
  const value = JSON.stringify({ ok: true, at: Date.now() });
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
}

function clearAccessGateCache(userId: string) {
  if (typeof window === "undefined") return;
  const key = `${GATE_CACHE_PREFIX}${userId}`;
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

type NavItem = {
  to: string;
  label: string;
  Icon: typeof LayoutGrid;
  exact?: boolean;
  badge?: number;
};
type NavSection = { label: string; items: NavItem[] };
type ColabNotifRow = { colab_canales?: { tipo?: string } | null };
type ColabMemberRow = {
  canal_id: string;
  ultima_lectura: string | null;
  colab_canales?: { tipo?: string; archivado?: boolean } | null;
};
type ColabMessageRow = { canal_id: string; user_id: string; created_at: string };

function AuthenticatedLayout() {
  const { session, user, loading } = useAuth();
  const { isSuperAdmin, roles, isDirectorQA, isApoderado } = useUserRole();
  const { metricas: metricasAutonomia, loading: loadingAutonomia } = useNivelAutonomia();
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [colabUnread, setColabUnread] = useState(0);
  const [dmUnread, setDmUnread] = useState(0);
  const [profileMeta, setProfileMeta] = useState<{
    nombre: string | null;
    avatar_url: string | null;
  }>({ nombre: null, avatar_url: null });
  const [gateState, setGateState] = useState<"checking" | "ok" | "blocked">(() => {
    const cached = session?.user?.id ? getAccessGateCache(session.user.id) : null;
    return cached ? "ok" : "checking";
  });
  const [gateChecked, setGateChecked] = useState(() => !!(session?.user?.id && getAccessGateCache(session.user.id)));
  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem("nuvex.sidebar.collapsed") === "1");
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const handleReload = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await Promise.all([queryClient.invalidateQueries(), router.invalidate()]);
    } catch {
      // No propagar un fallo transitorio de red al árbol React.
    } finally {
      setTimeout(() => setReloading(false), 400);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  // CRITICAL GATE: bloquea render hasta validar estado_acceso=aprobado/activo.
  // SUPER_ADMIN tiene bypass operativo para no quedar atrapado por estado/onboarding/academia.
  useEffect(() => {
    if (!session?.user) {
      setGateState("checking");
      setGateChecked(false);
      return;
    }
    let cancel = false;
    const uid = session.user.id;
    const cachedAccess = getAccessGateCache(uid);
    if (cachedAccess) {
      setGateState("ok");
      setGateChecked(true);
    } else {
      setGateState("checking");
      setGateChecked(false);
    }
    const fallback =
      typeof window !== "undefined"
        ? window.setTimeout(() => {
            if (cancel) return;
            setGateState("ok");
            setGateChecked(true);
          }, 4500)
        : undefined;
    (async () => {
      try {
        const [profileResult, rolesResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("estado_acceso, onboarding_estado, mfa_verificado_at")
            .eq("id", uid)
            .maybeSingle(),
          supabase.from("user_roles").select("role").eq("user_id", uid),
        ]);
        if (cancel) return;
        if (profileResult.error || rolesResult.error) {
          setGateState("ok");
          setGateChecked(true);
          return;
        }
        const data = profileResult.data;
        const roleNames = ((rolesResult.data ?? []) as Array<{ role?: string }>).map((r) => r.role);
        const superAdminBypass = roleNames.includes("super_admin");
        const isApoderadoOnly =
          roleNames.includes("apoderado") && !roleNames.some((r) => r && r !== "apoderado");
        const estado = (data as { estado_acceso?: string } | null)?.estado_acceso ?? "pendiente";
        const onb =
          (data as { onboarding_estado?: string } | null)?.onboarding_estado ?? "pendiente";
        const mfaAt =
          (data as { mfa_verificado_at?: string | null } | null)?.mfa_verificado_at ?? null;
        const path = location.pathname;
        const aprobado = estado === "aprobado" || estado === "activo" || estado === "reactivado";

        // GATE MFA GLOBAL: aplica a TODOS los roles sin excepción (incluido super_admin).
        // Cubre acceso directo por URL, refresco de sesión y login vía Google OAuth.
        // Ventana: 24 horas desde la última verificación exitosa.
        const mfaOk = !!(mfaAt && Date.now() - new Date(mfaAt).getTime() < 24 * 3600 * 1000);
        if (!mfaOk && path !== "/mfa-verificar") {
          clearAccessGateCache(uid);
          setGateState("blocked");
          setGateChecked(true);
          navigate({ to: "/mfa-verificar" });
          return;
        }

        if (superAdminBypass) {
          setAccessGateCache(uid);
          setGateState("ok");
          setGateChecked(true);
          if (path === "/pendiente-aprobacion" || path.startsWith("/onboarding")) {
            navigate({ to: "/inicio" });
          }
          return;
        }

        if (!aprobado) {
          clearAccessGateCache(uid);
          if (path !== "/pendiente-aprobacion") {
            setGateState("blocked");
            setGateChecked(true);
            void (async () => {
              try {
                await supabase.from("onboarding_auditoria" as never).insert({
                  user_id: session.user.id,
                  evento: "acceso_bloqueado",
                  actor_id: session.user.id,
                  detalle: { path, estado_acceso: estado },
                } as never);
              } catch {
                // Auditoría auxiliar: no debe romper el acceso si falla la red.
              }
            })();
            navigate({ to: "/pendiente-aprobacion" });
          } else {
            setGateState("ok");
            setGateChecked(true);
          }
          return;
        }
        if (
          !isApoderadoOnly &&
          onb !== "completado" &&
          !path.startsWith("/onboarding") &&
          !path.startsWith("/mi-perfil")
        ) {
          clearAccessGateCache(uid);
          setGateState("blocked");
          setGateChecked(true);
          navigate({ to: "/onboarding" });
          return;
        }
        if (
          isApoderadoOnly &&
          (path === "/inicio" ||
            path === "/" ||
            path.startsWith("/onboarding") ||
            path === "/pendiente-aprobacion")
        ) {
          setAccessGateCache(uid);
          setGateState("ok");
          setGateChecked(true);
          navigate({ to: "/apoderado/mis-casos" });
          return;
        }
        setAccessGateCache(uid);
        setGateState("ok");
        setGateChecked(true);
      } catch {
        if (cancel) return;
        setGateState("ok");
        setGateChecked(true);
      }
    })();
    return () => {
      cancel = true;
      if (fallback) window.clearTimeout(fallback);
    };
    // Sólo revalidar cuando cambia la sesión, NO en cada navegación (evita parpadeo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nuvex.sidebar.collapsed", collapsed ? "1" : "0");
    }
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const load = async () => {
      try {
        const [{ count: ca }, { count: nu }] = await Promise.all([
          supabase
            .from("caso_alertas" as never)
            .select("id", { count: "exact", head: true })
            .eq("leida", false),
          supabase
            .from("notificaciones_usuario" as never)
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid)
            .eq("leida", false)
            .neq("tipo", "mensaje_interno"),
        ]);
        if (active) setUnread((ca ?? 0) + (nu ?? 0));
      } catch {
        // Mantiene la pantalla estable si el backend/Internet falla momentáneamente.
      }
    };

    load();
    const ch1 = supabase
      .channel("alerts_unread_" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "caso_alertas" }, load)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificaciones_usuario",
          filter: `user_id=eq.${uid}`,
        },
        load,
      )
      .subscribe();
    const iv = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(iv);
      supabase.removeChannel(ch1);
    };
  }, [session, location.pathname, gateState]);

  // Carga nombre y avatar desde profiles (fuente única) para topbar/menú.
  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const loadProfile = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("nombre, avatar_url")
          .eq("id", uid)
          .maybeSingle();
        if (!active || !data) return;
        const d = data as { nombre: string | null; avatar_url: string | null };
        setProfileMeta({ nombre: d.nombre, avatar_url: d.avatar_url });
      } catch {
        // No bloquear navegación por avatar/perfil temporalmente no disponible.
      }
    };
    loadProfile();
    const ch = supabase
      .channel("profile_self_" + uid)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
        loadProfile,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [session?.user?.id, gateState]);

  // Contadores colab (DM y notificaciones internas) para los badges del menú.
  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    let active = true;
    const uid = session.user.id;
    const load = async () => {
      try {
        const [{ data: notifsCanal }, { data: miembros }] = await Promise.all([
          supabase
            .from("colab_notificaciones" as never)
            .select("id, colab_canales!inner(tipo)")
            .eq("user_id", uid)
            .eq("leida", false),
          supabase
            .from("colab_miembros" as never)
            .select("canal_id, ultima_lectura, colab_canales!inner(id,tipo,archivado)")
            .eq("user_id", uid),
        ]);
        if (!active) return;
        // Excluir DMs del badge "Colaboración" — los DMs viven en su propio badge "Mensajería".
        const colabNoDm = ((notifsCanal ?? []) as ColabNotifRow[]).filter(
          (n) => n.colab_canales?.tipo !== "dm",
        ).length;
        setColabUnread(colabNoDm);

        const dmRows = ((miembros ?? []) as ColabMemberRow[]).filter(
          (m) => m.colab_canales?.tipo === "dm" && !m.colab_canales?.archivado,
        );
        if (dmRows.length === 0) {
          setDmUnread(0);
          return;
        }
        const ids = dmRows.map((r) => r.canal_id);
        const readMap = new Map<string, string | null>(
          dmRows.map((r) => [r.canal_id, r.ultima_lectura]),
        );
        const { data: msgs } = await supabase
          .from("colab_mensajes" as never)
          .select("canal_id, user_id, created_at")
          .in("canal_id", ids)
          .order("created_at", { ascending: false })
          .limit(ids.length * 30);
        if (!active) return;
        let total = 0;
        ((msgs ?? []) as ColabMessageRow[]).forEach((m) => {
          if (m.user_id === uid) return;
          const last = readMap.get(m.canal_id);
          if (!last || new Date(m.created_at) > new Date(last)) total++;
        });
        setDmUnread(total);
      } catch {
        // Los badges colaborativos no deben romper la sesión si hay caída de red.
      }
    };
    load();
    const ch = supabase
      .channel("colab_unread_" + uid)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "colab_notificaciones",
          filter: `user_id=eq.${uid}`,
        },
        load,
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "colab_mensajes" }, load)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "colab_miembros", filter: `user_id=eq.${uid}` },
        load,
      )
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
  }, [session?.user?.id, gateState]);

  // Presencia global (en línea / última vez). Respeta el toggle de privacidad.
  useEffect(() => {
    if (!session?.user || gateState !== "ok") return;
    const uid = session.user.id;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("presencia_visible")
          .eq("id", uid)
          .maybeSingle();
        if (cancel) return;
        const visible = (data as { presencia_visible?: boolean } | null)?.presencia_visible !== false;
        await iniciarPresenciaPropia(uid, visible);
      } catch {
        // Presencia es auxiliar; nunca debe dejar la app en blanco.
      }
    })();
    return () => {
      cancel = true;
      detenerPresenciaPropia();
    };
  }, [session?.user?.id, gateState]);

  if (!mounted || loading || !session) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white/60 text-sm"
        style={{ background: "var(--nuvia-bg-primary)" }}
      >
        Verificando acceso…
      </div>
    );
  }

  const showGateOverlay = gateState !== "ok";

  const displayName: string =
    profileMeta.nombre || user?.user_metadata?.nombre || (user?.email?.split("@")[0] ?? "Usuario");
  const avatarUrl: string | null = profileMeta.avatar_url;

  const has = (r: string) => roles.includes(r as never);
  const hasAny = (...rs: string[]) => rs.some(has);

  const sections: NavSection[] =
    isApoderado && !isSuperAdmin
      ? [
          {
            label: "Apoderado",
            items: [
              { to: "/apoderado/mis-casos", label: "Mis casos", Icon: Briefcase },
              { to: "/nuvex-ia", label: "NUVIA IA", Icon: Sparkles },
              { to: "/colaboracion/dm", label: "Mensajería", Icon: MessageSquare, badge: dmUnread },
              { to: "/directorio", label: "Directorio", Icon: BookUser },
              { to: "/notificaciones", label: "Alertas", Icon: Bell, badge: unread },
              { to: "/mi-perfil", label: "Mi Perfil", Icon: UserCircle },
            ],
          },
        ]
      : [
          {
            label: "Operación",
            items: [
              { to: "/inicio", label: "Inicio", Icon: LayoutGrid, exact: true },
              { to: "/simulador", label: "Simulador", Icon: Rocket },
              { to: "/nuvex-ia", label: "NUVIA IA", Icon: Sparkles },
              { to: "/casos", label: "Casos", Icon: FolderKanban },
              ...(has("director_financiero_qa") &&
              !hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "juridica",
                "operaciones",
                "cartera",
                "contabilidad",
                "director_juridico",
                "auxiliar_operativo",
              )
                ? []
                : [{ to: "/pipeline", label: "Pipeline", Icon: Kanban }]),
              { to: "/expediente-maestro", label: "Expediente", Icon: UserSquare2 },
              { to: "/proyeccion", label: "Proyección", Icon: LineChart },
              // Proyección Financiera ahora vive dentro de /herramientas
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "director_financiero_qa",
              )
                ? [{ to: "/herramientas", label: "Herramientas", Icon: Wrench }]
                : []),
              { to: "/notificaciones", label: "Alertas", Icon: Bell, badge: unread },
              {
                to: "/colaboracion",
                label: "Colaboración",
                Icon: MessageSquare,
                badge: colabUnread,
              },
              { to: "/colaboracion/dm", label: "Mensajería", Icon: MessageSquare, badge: dmUnread },
              { to: "/directorio", label: "Directorio", Icon: BookUser },
            ],
          },
          {
            label: "Análisis",
            items: [
              ...(has("director_financiero_qa") &&
              !hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "juridica",
                "operaciones",
                "cartera",
                "contabilidad",
                "director_juridico",
                "auxiliar_operativo",
              )
                ? []
                : [{ to: "/dashboard", label: "Dashboard", Icon: BarChart3 }]),
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "director_financiero_qa",
                "director_juridico",
              )
                ? [{ to: "/torre-control", label: "Torre de Control", Icon: RadioTower }]
                : []),
              ...(hasAny("super_admin", "admin", "gerencia")
                ? [{ to: "/incidentes", label: "Incidentes", Icon: ShieldCheck }]
                : []),
              ...(hasAny("super_admin", "gerencia")
                ? [{ to: "/gestion-usuarios", label: "Gestión usuarios", Icon: Users }]
                : []),
              ...(hasAny("super_admin", "gerencia")
                ? [{ to: "/productividad", label: "Productividad", Icon: BarChart3 }]
                : []),
              ...(hasAny("super_admin", "admin", "director_financiero_qa", "gerencia")
                ? [{ to: "/qa", label: "QA", Icon: ClipboardCheck }]
                : []),
            ],
          },
          {
            label: "Finanzas",
            items: [
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "director_financiero_qa",
              )
                ? [{ to: "/honorarios-motor", label: "Motor de Honorarios", Icon: DollarSign }]
                : []),
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "cartera",
                "juridica",
                "licenciado",
                "asesor",
              )
                ? [{ to: "/cartera", label: "Cartera", Icon: Wallet }]
                : []),
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "juridica",
                "director_juridico",
                "contabilidad",
              )
                ? [{ to: "/wallet", label: "Mi Wallet", Icon: Wallet }]
                : []),
              ...(has("director_financiero_qa") &&
              !hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "licenciado",
                "asesor",
                "juridica",
                "operaciones",
                "cartera",
                "contabilidad",
                "director_juridico",
                "auxiliar_operativo",
              )
                ? []
                : [{ to: "/comisiones", label: "Comisiones", Icon: CircleDollarSign }]),
              ...(hasAny("super_admin", "admin", "gerencia", "cartera", "contabilidad")
                ? [
                    {
                      to: "/contabilidad/cuentas-cobro",
                      label: "Contabilidad",
                      Icon: CircleDollarSign,
                    },
                  ]
                : []),
              ...(hasAny(
                "super_admin",
                "admin",
                "gerencia",
                "juridica",
                "director_juridico",
                "operaciones",
              )
                ? [
                    {
                      to: "/contratacion/validacion",
                      label: "Validación contratación",
                      Icon: ShieldCheck,
                    },
                  ]
                : []),
              ...(hasAny("super_admin", "admin", "gerencia", "contabilidad")
                ? [{ to: "/finanzas", label: "Finanzas", Icon: Landmark }]
                : []),
            ],
          },
          {
            label: "Gestión",
            items: [
              ...(isSuperAdmin
                ? [{ to: "/apoderados-nuvex", label: "Apoderados", Icon: Users }]
                : []),
              { to: "/academia", label: "Academia", Icon: GraduationCap },
              ...(isSuperAdmin
                ? [{ to: "/super-admin/academia", label: "Admin Academia", Icon: GraduationCap }]
                : []),
              ...(isSuperAdmin
                ? [{ to: "/super-admin/accesos", label: "Accesos", Icon: Shield }]
                : []),
              ...(isSuperAdmin
                ? [{ to: "/super-admin/onboarding", label: "Onboarding", Icon: UserCircle }]
                : []),
              ...(isSuperAdmin
                ? [{ to: "/super-admin/nuvex-ia-kb", label: "NUVIA IA · KB", Icon: Shield }]
                : []),
              ...(isSuperAdmin ? [{ to: "/super-admin", label: "Super Admin", Icon: Shield }] : []),
            ],
          },

          {
            label: "Cuenta",
            items: [{ to: "/mi-perfil", label: "Mi Perfil", Icon: UserCircle }],
          },
        ];

  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter(Boolean) }))
    .filter((s) => s.items.length > 0);

  const isActive = (to: string, exact?: boolean) =>
    exact
      ? location.pathname === to
      : location.pathname === to || location.pathname.startsWith(to + "/");

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
                background: GRADIENT,
                color: "#fff",
                boxShadow:
                  "0 8px 20px -10px var(--nuvia-accent-blue), 0 0 0 1px rgba(255,255,255,0.08) inset",
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
            style={{ background: "var(--nuvia-danger)", color: "#fff" }}
          >
            {it.badge > 99 ? "99+" : it.badge}
          </span>
        ) : null}
        {collapsed && it.badge && it.badge > 0 ? (
          <span
            className="absolute top-1 right-1 h-2 w-2 rounded-full"
            style={{ background: "var(--nuvia-danger)" }}
          />
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
        background:
          "linear-gradient(180deg, var(--nuvia-bg-primary), var(--nuvia-bg-secondary) 60%, var(--nuvia-bg-tertiary))",
        borderRight: "1px solid var(--nuvia-border)",
        transition: "width 200ms ease",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-10 h-48 w-[280px] rounded-full opacity-[0.10] blur-[100px]"
          style={{ background: AZUL }}
        />
        <div
          className="absolute bottom-10 -right-10 h-48 w-[260px] rounded-full opacity-[0.08] blur-[100px]"
          style={{ background: VERDE }}
        />
      </div>

      <div
        className="relative flex items-center justify-between px-4 py-5"
        style={{ minHeight: 76 }}
      >
        <Link to="/inicio" className="flex items-center">
          <Logo
            variant="white"
            height={collapsed ? 24 : 32}
            className={collapsed ? "max-w-[40px] object-contain" : ""}
          />
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
              {s.items.map((it) => (
                <SidebarItem key={it.to} it={it} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="relative border-t border-white/5 p-3">
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/login" });
          }}
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
    <div className="dark min-h-screen flex" style={{ background: "var(--nuvia-bg-primary)" }}>
      {showGateOverlay && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4 pt-3"
          aria-live="polite"
        >
          <div
            className="rounded-full border px-4 py-2 text-xs font-medium shadow-2xl backdrop-blur-xl"
            style={{
              background: "rgba(13,18,36,0.86)",
              borderColor: "var(--nuvia-border-strong)",
              color: "var(--nuvia-text-secondary)",
            }}
          >
            Verificando acceso…
          </div>
        </div>
      )}
      {/* Sidebar desktop */}
      <div className="hidden lg:block sticky top-0 h-screen relative">{SidebarContent}</div>

      {/* Sidebar móvil (drawer) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full">{SidebarContent}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header delgado */}
        <header
          className="sticky top-0 z-40"
          style={{
            background:
              "linear-gradient(90deg, var(--nuvia-bg-primary), var(--nuvia-bg-secondary))",
            borderBottom: "1px solid var(--nuvia-border)",
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
              <div className="hidden md:flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.22em] text-white/50">
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full"
                  style={{ background: GRADIENT }}
                />
                NUVIA · Inteligencia Financiera
              </div>
            </div>

            <div className="flex items-center gap-3">
              {!loadingAutonomia && (
                <Link
                  to="/mi-perfil"
                  title={`Nivel ${metricasAutonomia.nivelAutonomia} — ${etiquetaNivel(metricasAutonomia.nivelAutonomia)} · Score ${metricasAutonomia.scorePromedio.toFixed(1)}`}
                  className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition hover:opacity-90"
                  style={{
                    background:
                      metricasAutonomia.nivelAutonomia === 3
                        ? "rgba(132,185,143,0.18)"
                        : metricasAutonomia.nivelAutonomia === 2
                          ? "rgba(246,196,83,0.18)"
                          : "rgba(255,107,107,0.18)",
                    color:
                      metricasAutonomia.nivelAutonomia === 3
                        ? "var(--nuvia-success)"
                        : metricasAutonomia.nivelAutonomia === 2
                          ? "var(--nuvia-warning)"
                          : "var(--nuvia-danger)",
                    border: "1px solid var(--nuvia-border)",
                  }}
                >
                  <Award size={12} />N{metricasAutonomia.nivelAutonomia}
                </Link>
              )}

              <button
                onClick={handleReload}
                disabled={reloading}
                aria-label="Recargar"
                title="Recargar datos"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/5 disabled:opacity-60"
              >
                <RefreshCw size={16} className={reloading ? "animate-spin" : ""} />
              </button>
              <NotificationBell />
              <Link
                to="/mi-perfil"
                title="Mi Perfil"
                className="hidden sm:flex items-center gap-3 rounded-xl pl-1.5 pr-3 py-1 transition hover:bg-white/[0.07]"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--nuvia-border)",
                }}
              >
                <UserAvatar
                  userId={user?.id}
                  url={avatarUrl}
                  name={displayName}
                  email={user?.email}
                  size="sm"
                  ring
                />
                <div className="leading-tight text-right">
                  <div className="text-[12px] font-semibold text-white truncate max-w-[160px]">
                    {displayName}
                  </div>
                  <div className="text-[10px] text-white/50 truncate max-w-[160px]">
                    {user?.email}
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-[#F4F6FB] text-[#0A1226]">
          {!isApoderado && (
            <>
              <div className="px-4 pt-4">
                <OnboardingChecklistBanner />
              </div>
              <AcademiaBanner />
            </>
          )}
          <Outlet />
        </main>

        {!isApoderado && <NuvexGptButton />}
        <NotificacionesAlerts />
        <EtapaTransicionDialog />

        <footer
          style={{
            background: "var(--nuvia-bg-primary)",
            borderTop: "1px solid var(--nuvia-border)",
          }}
        >
          <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-white/40">
            <span>
              <span className="font-semibold text-white/70">NUVIA Systems</span> · Sistema operativo
              de inteligencia financiera
            </span>
            <span className="tracking-[0.22em] uppercase">
              SOC 2 · ISO 27001 · {CORPORATIVO.web}
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
