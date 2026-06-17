import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useResolvedHomeRole } from "@/hooks/useResolvedHomeRole";
import { roleLabel } from "@/lib/roleLabels";
import { supabase } from "@/integrations/supabase/client";
import { HOME_CONFIG, type RoleHomeKpi } from "@/lib/homeConfig";
import { WorkspaceLoader } from "./WorkspaceLoader";
import {
  NuviaIAPromptCard,
  KpiCard,
  QuickActionTile,
  CriticalAlertList,
  ActivityFeed,
  IARecomendacionesCard,
  MotivationalQuote,
  AnimatedBackground,
  type CriticalAlert,
  type ActivityItem,
} from "@/components/home/widgets";
import {
  Rocket,
  ArrowRight,
  BarChart3,
  Activity,
  ChevronDown,
  FileText,
  Settings2,
} from "lucide-react";

interface RoleHomeProps {
  onLanzarSimulador: () => void;
}

type Counts = Partial<Record<NonNullable<RoleHomeKpi["source"]>, number>>;

export function RoleHome({ onLanzarSimulador }: RoleHomeProps) {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const { activeRole, setActiveRole, multiRol, loading } = useResolvedHomeRole();
  const [nombre, setNombre] = useState<string>("");
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles" as never)
          .select("nombre")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancel && data) {
          const nm = (data as { nombre?: string }).nombre;
          if (nm) setNombre(nm);
        }
      } catch {
        /* ignorar */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const tryCount = async (
        q: PromiseLike<{ count: number | null }>,
        key: keyof Counts,
      ) => {
        try {
          const { count } = await q;
          if (!cancel && typeof count === "number") {
            setCounts((prev) => ({ ...prev, [key]: count }));
          }
        } catch {
          /* silencioso */
        }
      };
      await Promise.all([
        tryCount(
          supabase
            .from("expedientes" as never)
            .select("id", { count: "exact", head: true }) as unknown as PromiseLike<{ count: number | null }>,
          "expedientes.total",
        ),
        tryCount(
          supabase
            .from("expedientes" as never)
            .select("id", { count: "exact", head: true })
            .eq("asesor_id", user.id) as unknown as PromiseLike<{ count: number | null }>,
          "expedientes.activos.miAsesor",
        ),
      ]);
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const config = (activeRole && HOME_CONFIG[activeRole]) || HOME_CONFIG.gerencia || HOME_CONFIG.super_admin;

  const saludo = useMemo(() => {
    const hora = new Date().getHours();
    const greet = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
    const base = nombre || user?.email?.split("@")[0] || "Bienvenido";
    return `${greet}, ${base.split(/\s+/)[0]}`;
  }, [nombre, user]);

  const resolveValue = (k: RoleHomeKpi) => {
    if (k.staticValue) return k.staticValue;
    if (!k.source || k.source === "static") return "—";
    const v = counts[k.source];
    return typeof v === "number" ? String(v) : "—";
  };

  const metricaEstrella = useMemo(() => {
    if (!config?.metricaEstrella) return undefined;
    const m = config.metricaEstrella;
    const raw =
      m.staticValue ?? (m.source && m.source !== "static" ? counts[m.source] : undefined);
    return {
      label: m.label,
      value: typeof raw === "number" ? String(raw) : raw ?? "—",
      tone: m.tone,
      numeric: typeof raw === "number" ? raw : undefined,
    };
  }, [config, counts]);

  if (loading) {
    return <WorkspaceLoader label="Cargando tu workspace NUVIA" />;
  }


  const handleAsk = (prompt: string) => {
    try {
      navigator.clipboard?.writeText(prompt);
      toast.success("Prompt copiado. Abre NUVIA IA y pégalo.");
    } catch {
      toast.message("Abre NUVIA IA para preguntar.");
    }
  };

  const alerts: CriticalAlert[] = [];
  const activity: ActivityItem[] = [];

  // Breakdown sintético del metric card (proporcional para reflejar el mockup)
  const total = metricaEstrella?.numeric;
  const breakdown = typeof total === "number" && total > 0
    ? {
        a: Math.round(total * 0.41),
        b: Math.round(total * 0.39),
        c: Math.max(0, total - Math.round(total * 0.41) - Math.round(total * 0.39)),
      }
    : { a: 0, b: 0, c: 0 };

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--nuvia-bg-primary)", color: "var(--nuvia-text-primary)" }}
    >
      <AnimatedBackground />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-8 space-y-5 animate-fade-in">
        {/* ═══ FILA 1 — HERO + MÉTRICA ESTRELLA ═══ */}
        <section className="grid gap-5 lg:grid-cols-12">
          {/* Hero compacto */}
          <div className="lg:col-span-8">
            <HeroPanel
              saludo={saludo}
              rolLabel={config.rolLabel}
              subtitle={config.subtitle}
              roles={roles}
              activeRole={activeRole ?? undefined}
              onChangeRole={multiRol ? setActiveRole : undefined}
              onLanzarSimulador={onLanzarSimulador}
            />
          </div>

          {/* Card métrica estrella */}
          <div className="lg:col-span-4">
            <MetricSpotlightCard
              label={metricaEstrella?.label ?? "Expedientes activos"}
              value={metricaEstrella?.value ?? "—"}
              breakdown={[
                { label: "En análisis", value: breakdown.a },
                { label: "En gestión", value: breakdown.b },
                { label: "Por firmar", value: breakdown.c },
              ]}
              progress={total ? Math.min(100, Math.round((breakdown.b / Math.max(1, total)) * 100)) : 0}
            />
          </div>
        </section>

        {/* ═══ FILA 2 — TRIPLE CARD: NUVIA IA · FRASE · ACTIVIDAD ═══ */}
        <section className="grid gap-5 lg:grid-cols-3">
          <NuviaIAPromptCard
            prompt={config.iaPrompt.prompt}
            hint={config.iaPrompt.hint}
            onAsk={handleAsk}
          />
          <MotivationalQuote />
          <CompactActivityCard items={activity} />
        </section>

        {/* ═══ FILA 3 — ACCESOS RÁPIDOS DENSOS ═══ */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <SectionTitle>Accesos rápidos</SectionTitle>
            <button
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold transition hover:opacity-80"
              style={{ color: "var(--nuvia-accent-blue)" }}
            >
              Personalizar accesos
              <Settings2 size={12} />
            </button>
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8">
            {config.quickActions.slice(0, 8).map((a) => (
              <QuickActionTile key={a.to + a.label} action={a} />
            ))}
          </div>
        </section>

        {/* ═══ FILA 4 — KPIs ═══ */}
        <section>
          <SectionTitle>Indicadores clave</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {config.kpis.map((k) => (
              <KpiCard
                key={k.id}
                icon={k.icon}
                label={k.label}
                value={resolveValue(k)}
                hint={k.hint}
                tone={k.tone}
              />
            ))}
          </div>
        </section>

        {/* ═══ FILA 5 — PENDIENTES + RECOMENDACIONES ═══ */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <SectionTitle>Pendientes críticos</SectionTitle>
            <CriticalAlertList alerts={alerts} emptyLabel="Sin pendientes críticos por ahora." />
          </div>
          <div className="lg:col-span-2">
            <SectionTitle>Recomendaciones NUVIA</SectionTitle>
            <IARecomendacionesCard items={config.recomendaciones} onOpenIA={() => handleAsk(config.iaPrompt.prompt)} />
          </div>
        </div>

        {config.excluye.length > 0 && (
          <div
            className="rounded-xl px-4 py-3 text-[11px]"
            style={{
              background: "rgba(5,8,22,0.4)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-muted)",
            }}
          >
            <span className="font-semibold uppercase tracking-wider">No incluido en esta vista:</span>{" "}
            {config.excluye.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HERO COMPACTO ─────────────────────────────────────────────────────────
function HeroPanel({
  saludo,
  rolLabel,
  subtitle,
  roles,
  activeRole,
  onChangeRole,
  onLanzarSimulador,
}: {
  saludo: string;
  rolLabel: string;
  subtitle: string;
  roles: AppRole[];
  activeRole?: AppRole;
  onChangeRole?: (r: AppRole) => void;
  onLanzarSimulador: () => void;
}) {
  const multi = roles.length > 1;
  return (
    <section
      className="relative h-full overflow-hidden rounded-[var(--nuvia-radius-xl)] p-7"
      style={{
        background:
          "linear-gradient(135deg, rgba(20,28,52,0.6) 0%, rgba(28,42,78,0.45) 60%, rgba(68,93,163,0.32) 100%)",
        border: "1px solid rgba(238,245,255,0.12)",
        backdropFilter: "blur(34px) saturate(155%)",
        WebkitBackdropFilter: "blur(34px) saturate(155%)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.65), inset 0 1px 0 rgba(238,245,255,0.06)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(238,245,255,0.45), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "rgba(132,185,143,0.22)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -bottom-12 h-44 w-44 rounded-full blur-3xl"
        style={{ background: "rgba(68,93,163,0.28)" }}
      />

      <div className="relative flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{
            background: "rgba(132,185,143,0.14)",
            color: "var(--nuvia-accent-green)",
            border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 28%, transparent)",
          }}
        >
          <Activity size={11} />
          {rolLabel}
        </span>
        {multi && onChangeRole && (
          <label
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] cursor-pointer ml-auto"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-secondary)",
            }}
            title="Cambiar vista de Home"
          >
            Vista
            <select
              value={activeRole}
              onChange={(e) => onChangeRole(e.target.value as AppRole)}
              className="bg-transparent border-0 outline-none text-[11px] font-semibold pr-3"
              style={{ color: "var(--nuvia-text-primary)" }}
            >
              {roles.map((r) => (
                <option key={r} value={r} style={{ background: "var(--nuvia-bg-tertiary)" }}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            <ChevronDown size={11} />
          </label>
        )}
      </div>

      <h1 className="relative mt-3 text-3xl md:text-[34px] font-bold tracking-tight">
        {saludo} <span className="inline-block animate-pulse">👋</span>
      </h1>
      <p
        className="relative mt-2 max-w-xl text-[14px] leading-relaxed"
        style={{ color: "var(--nuvia-text-secondary)" }}
      >
        {subtitle}
      </p>

      <div className="relative mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={onLanzarSimulador}
          className="group inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.16em] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, var(--nuvia-accent-blue) 0%, var(--nuvia-accent-green) 100%)",
            color: "#0a0f1f",
            border: "1px solid rgba(238,245,255,0.22)",
            boxShadow: "0 14px 36px -12px rgba(68,93,163,0.7), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          <Rocket size={16} />
          Lanzar simulador
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </button>

        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2.5 rounded-xl px-4 py-3 text-[12.5px] font-semibold transition hover:opacity-90"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          <BarChart3 size={15} />
          Ver dashboard ejecutivo
        </Link>
      </div>
    </section>
  );
}

// ─── METRIC SPOTLIGHT ──────────────────────────────────────────────────────
function MetricSpotlightCard({
  label,
  value,
  breakdown,
  progress,
}: {
  label: string;
  value: ReactNode;
  breakdown: { label: string; value: number }[];
  progress: number;
}) {
  return (
    <section
      className="relative h-full overflow-hidden rounded-[var(--nuvia-radius-xl)] p-6 flex flex-col"
      style={{
        background:
          "linear-gradient(160deg, rgba(8,12,28,0.65) 0%, rgba(18,26,50,0.55) 100%)",
        border: "1px solid rgba(238,245,255,0.14)",
        backdropFilter: "blur(28px) saturate(150%)",
        WebkitBackdropFilter: "blur(28px) saturate(150%)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.65), inset 0 1px 0 rgba(238,245,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "var(--nuvia-text-muted)" }}
        >
          {label}
        </div>
        <div
          className="grid h-10 w-10 place-items-center rounded-xl"
          style={{
            background: "rgba(68,93,163,0.18)",
            border: "1px solid color-mix(in oklab, var(--nuvia-accent-blue) 30%, transparent)",
            color: "var(--nuvia-accent-blue)",
          }}
        >
          <FileText size={16} />
        </div>
      </div>

      <div className="mt-3 text-[56px] font-bold leading-none tabular-nums">
        {value}
      </div>

      <div
        className="mt-4 h-1.5 w-full overflow-hidden rounded-full"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.max(8, progress)}%`,
            background:
              "linear-gradient(90deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {breakdown.map((b) => (
          <div key={b.label}>
            <div
              className="text-[10.5px] font-medium"
              style={{ color: "var(--nuvia-text-muted)" }}
            >
              {b.label}
            </div>
            <div className="mt-0.5 text-[18px] font-bold tabular-nums">{b.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── ACTIVIDAD COMPACTA (col 1/3) ──────────────────────────────────────────
function CompactActivityCard({ items }: { items: ActivityItem[] }) {
  return (
    <section
      className="relative h-full overflow-hidden rounded-[var(--nuvia-radius-lg)] p-5"
      style={{
        background: "rgba(8,12,28,0.55)",
        border: "1px solid var(--nuvia-border)",
        backdropFilter: "blur(28px) saturate(150%)",
        WebkitBackdropFilter: "blur(28px) saturate(150%)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{
            background: "rgba(132,185,143,0.14)",
            border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 24%, transparent)",
            color: "var(--nuvia-accent-green)",
          }}
        >
          <Activity size={14} />
        </div>
        <div
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: "var(--nuvia-text-muted)" }}
        >
          Actividad reciente
        </div>
      </div>

      {items.length === 0 ? (
        <div
          className="mt-5 text-[12.5px] text-center py-4"
          style={{ color: "var(--nuvia-text-muted)" }}
        >
          Sin actividad reciente.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.slice(0, 3).map((it) => (
            <li key={it.id} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--nuvia-accent-blue)" }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] leading-snug">{it.title}</div>
                <div
                  className="mt-0.5 text-[10px] uppercase tracking-wider"
                  style={{ color: "var(--nuvia-text-muted)" }}
                >
                  {it.modulo ? `${it.modulo} · ` : ""}
                  {it.when}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/notificaciones"
        className="mt-4 inline-flex items-center gap-1.5 text-[11.5px] font-semibold transition hover:opacity-80"
        style={{ color: "var(--nuvia-accent-blue)" }}
      >
        Ver toda la actividad
        <ArrowRight size={12} />
      </Link>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.22em]"
      style={{ color: "var(--nuvia-text-muted)" }}
    >
      {children}
    </div>
  );
}
