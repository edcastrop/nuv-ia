import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight, ArrowRight, Activity, TrendingUp, ShieldCheck, Sparkles,
  Calculator, FolderKanban, Wallet, GraduationCap, MessageSquare, BarChart3,
  Briefcase, Users, BookUser, LineChart, ClipboardCheck, Bell, CircleDollarSign,
  Landmark, Bot, Zap,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { roleLabel } from "@/lib/roleLabels";
import { supabase } from "@/integrations/supabase/client";

const BLUE = "#445DA3";
const GREEN = "#84B98F";

type QuickAction = {
  to: string;
  label: string;
  desc: string;
  Icon: typeof Activity;
  accent?: "blue" | "green";
};

function actionsForRoles(roles: AppRole[]): QuickAction[] {
  const has = (r: AppRole) => roles.includes(r);
  const isManager = has("admin") || has("super_admin") || has("gerencia");
  const base: QuickAction[] = [];

  if (has("licenciado") || isManager) {
    base.push(
      { to: "/casos", label: "Mis Casos", desc: "Pipeline y expedientes activos", Icon: FolderKanban, accent: "blue" },
      { to: "/herramientas/proyeccion", label: "Proyección financiera", desc: "Simula escenarios crediticios", Icon: LineChart, accent: "green" },
      { to: "/comisiones", label: "Comisiones", desc: "Liquidaciones y wallet", Icon: Wallet, accent: "blue" },
    );
  }
  if (has("operaciones") || has("auxiliar_operativo") || isManager) {
    base.push({ to: "/pipeline", label: "Pipeline operativo", desc: "Etapas y radicación", Icon: Briefcase, accent: "green" });
  }
  if (has("juridica") || has("director_juridico") || isManager) {
    base.push({ to: "/expediente-maestro", label: "Expedientes maestros", desc: "Documentación legal", Icon: ClipboardCheck, accent: "blue" });
  }
  if (has("cartera") || isManager) {
    base.push({ to: "/cartera", label: "Cartera", desc: "Recaudo y gestión", Icon: CircleDollarSign, accent: "green" });
  }
  if (has("contabilidad") || isManager) {
    base.push({ to: "/finanzas", label: "Finanzas", desc: "Tesorería y reportes", Icon: Landmark, accent: "blue" });
  }
  if (has("apoderado")) {
    base.push({ to: "/apoderado/mis-casos", label: "Mis casos asignados", desc: "Documentos y avances", Icon: BookUser, accent: "blue" });
  }
  if (isManager) {
    base.push(
      { to: "/torre-control", label: "Torre de control", desc: "Visión 360° del negocio", Icon: BarChart3, accent: "green" },
      { to: "/gestion-usuarios", label: "Equipo", desc: "Roles, accesos y aprobaciones", Icon: Users, accent: "blue" },
    );
  }

  // Universales
  base.push(
    { to: "/academia", label: "Academia NUVIA", desc: "Aprende y certifícate", Icon: GraduationCap, accent: "green" },
    { to: "/mensajeria", label: "Mensajería", desc: "Conversa con tu equipo", Icon: MessageSquare, accent: "blue" },
    { to: "/nuvex-ia", label: "NUVIA IA", desc: "Tu copiloto financiero", Icon: Bot, accent: "green" },
  );

  return base.slice(0, 9);
}

export function NuviaHome({ onLanzarSimulador }: { onLanzarSimulador: () => void }) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const [nombre, setNombre] = useState<string>("");
  const [stats, setStats] = useState<{ casos: number; pendientes: number; notif: number }>({ casos: 0, pendientes: 0, notif: 0 });

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const [{ data: prof }, { count: casos }, { count: notif }] = await Promise.all([
        supabase.from("profiles" as never).select("nombre").eq("id", user.id).maybeSingle(),
        supabase.from("expedientes" as never).select("id", { count: "exact", head: true }).eq("asesor_id", user.id),
        supabase.from("notificaciones" as never).select("id", { count: "exact", head: true }).eq("user_id", user.id).is("leida_at", null),
      ]);
      if (cancel) return;
      const p = prof as { nombre?: string } | null;
      setNombre(p?.nombre?.split(" ")[0] ?? "");
      setStats({ casos: casos ?? 0, pendientes: 0, notif: notif ?? 0 });
    })();
    return () => { cancel = true; };
  }, [user]);

  const actions = actionsForRoles(roles);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();
  const rolePrincipal = roles[0] ? roleLabel(roles[0]) : "Miembro NUVIA";

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "#0A0B10" }}>
      {/* Fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 500px at 12% -10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(800px 500px at 100% 10%, rgba(132,185,143,0.18), transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 py-10 lg:py-14 space-y-10">
        {/* HERO */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6"
        >
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur px-3 py-1 text-[10px] tracking-[0.22em] uppercase text-white/60 mb-5">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
              Workspace activo · {rolePrincipal}
            </div>
            <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.05]">
              {greeting}{nombre ? <>, <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${BLUE}, ${GREEN})` }}>{nombre}</span></> : ""}.
            </h1>
            <p className="mt-3 text-base text-white/55 max-w-xl font-light">
              Tu sistema operativo de inteligencia financiera está listo. Decisiones, casos y señales en tiempo real.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={onLanzarSimulador}
              className="group inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(68,93,163,0.7)] hover:shadow-[0_18px_50px_-12px_rgba(132,185,143,0.5)] transition-shadow"
              style={{ background: `linear-gradient(135deg, ${BLUE} 0%, ${GREEN} 100%)` }}
            >
              <Calculator className="w-4 h-4" />
              Lanzar Simulador
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <Link
              to="/nuvex-ia"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-5 py-3 text-sm font-medium text-white/85 backdrop-blur transition"
            >
              <Sparkles className="w-4 h-4" style={{ color: GREEN }} />
              Preguntar a NUVIA IA
            </Link>
          </div>
        </motion.section>

        {/* KPIs */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Casos activos" value={String(stats.casos)} delta="+12%" Icon={FolderKanban} accent="blue" />
          <Kpi label="Decisiones IA / 24h" value="1,284" delta="+8.4%" Icon={Activity} accent="green" />
          <Kpi label="Tasa de aprobación" value="87%" delta="+3.1%" Icon={TrendingUp} accent="blue" />
          <Kpi label="Notificaciones" value={String(stats.notif)} delta="en tiempo real" Icon={Bell} accent="green" />
        </section>

        {/* BENTO: actions + side */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight">Accesos rápidos</h2>
              <span className="text-[11px] uppercase tracking-[0.2em] text-white/40">Personalizados para tu rol</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {actions.map((a, i) => (
                <ActionCard key={a.to} action={a} index={i} />
              ))}
            </div>
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-4"
          >
            {/* Estado del sistema */}
            <Panel>
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="grid place-items-center w-8 h-8 rounded-lg"
                  style={{ background: "rgba(132,185,143,0.12)", border: "1px solid rgba(132,185,143,0.25)" }}
                >
                  <ShieldCheck className="w-4 h-4" style={{ color: GREEN }} />
                </div>
                <div>
                  <div className="text-sm font-medium">Estado del sistema</div>
                  <div className="text-[11px] text-white/45">Todos los servicios operativos</div>
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { k: "API Core", v: "Operativo", ok: true },
                  { k: "Motor IA", v: "Operativo", ok: true },
                  { k: "Cartera & Pagos", v: "Operativo", ok: true },
                  { k: "Notificaciones", v: "Operativo", ok: true },
                ].map((s) => (
                  <div key={s.k} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-white/65">{s.k}</span>
                    <span className="inline-flex items-center gap-1.5 text-white/85">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN }} />
                      {s.v}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Inteligencia */}
            <Panel
              style={{
                background:
                  "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.10))",
                border: "1px solid rgba(132,185,143,0.18)",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4" style={{ color: GREEN }} />
                <span className="text-[11px] uppercase tracking-[0.2em] text-white/60">Inteligencia diaria</span>
              </div>
              <p className="text-sm text-white/85 leading-relaxed">
                Tu equipo tuvo un <b className="text-white">87% de aprobación</b> esta semana. Los expedientes con
                proyección UVR cerraron 2.3× más rápido.
              </p>
              <Link to="/nuvex-ia" className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: GREEN }}>
                Ver análisis completo <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </Panel>
          </motion.aside>
        </section>

        {/* Footer mini */}
        <footer className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-white/35">
          <span>© {new Date().getFullYear()} NUVIA Systems · Sistema operativo de inteligencia financiera</span>
          <span className="tracking-[0.22em] uppercase">SOC 2 · ISO 27001 · Cifrado E2E</span>
        </footer>
      </div>
    </div>
  );
}

function Kpi({
  label, value, delta, Icon, accent,
}: { label: string; value: string; delta: string; Icon: typeof Activity; accent: "blue" | "green" }) {
  const color = accent === "blue" ? BLUE : GREEN;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-white/[0.08] p-5 relative overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-20 blur-3xl" style={{ background: color }} />
      <div className="flex items-start justify-between">
        <div
          className="grid place-items-center w-9 h-9 rounded-lg"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/45">{delta}</span>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
      <div className="mt-1 text-[12.5px] text-white/55">{label}</div>
    </motion.div>
  );
}

function ActionCard({ action, index }: { action: QuickAction; index: number }) {
  const color = action.accent === "green" ? GREEN : BLUE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.05 + index * 0.03 }}
    >
      <Link
        to={action.to}
        className="group block rounded-2xl border border-white/[0.08] hover:border-white/20 p-5 transition-all hover:-translate-y-0.5 relative overflow-hidden"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          className="absolute inset-x-0 -top-px h-px opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
        />
        <div className="flex items-start justify-between">
          <div
            className="grid place-items-center w-10 h-10 rounded-xl"
            style={{ background: `${color}1f`, border: `1px solid ${color}33` }}
          >
            <action.Icon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-white/80 transition-colors" />
        </div>
        <div className="mt-4 text-[15px] font-semibold tracking-tight">{action.label}</div>
        <div className="mt-1 text-[12.5px] text-white/55 leading-relaxed">{action.desc}</div>
      </Link>
    </motion.div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-5"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.015) 100%)",
        backdropFilter: "blur(14px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
