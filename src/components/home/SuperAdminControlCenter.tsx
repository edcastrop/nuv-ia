import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VictoryFeed } from "@/components/victory/VictoryFeed";
import { AnimatedBackground } from "@/components/home/widgets";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileSignature,
  FileText,
  Gauge,
  GraduationCap,
  HardDrive,
  KeyRound,
  Layers,
  LineChart,
  MessageSquare,
  Radio,
  Rocket,
  ScrollText,
  Server,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

interface Props {
  onLanzarSimulador: () => void;
}

type HealthStatus = "operational" | "warning" | "critical";
type Service = { name: string; icon: ComponentType<{ size?: number }>; status: HealthStatus; latency: string };
type FeedItem = { id: string; who: string; verb: string; target: string; ts: string; kind: "case" | "qa" | "sign" | "bank" | "fin" | "legal" | "ia" };
type AlertItem = { id: string; title: string; count: number; to: string; severity: "critical" | "warning" | "info"; icon: ComponentType<{ size?: number }> };
type Suggestion = { id: string; text: string; to: string; tone: "warning" | "critical" | "info" };

const SERVICES: Service[] = [
  { name: "Database", icon: Database, status: "operational", latency: "38 ms" },
  { name: "Auth", icon: KeyRound, status: "operational", latency: "22 ms" },
  { name: "Storage", icon: HardDrive, status: "operational", latency: "54 ms" },
  { name: "Notifications", icon: Radio, status: "warning", latency: "312 ms" },
  { name: "IA Engine", icon: Brain, status: "operational", latency: "1.2 s" },
  { name: "PDF Engine", icon: FileText, status: "operational", latency: "480 ms" },
  { name: "WhatsApp Engine", icon: MessageSquare, status: "operational", latency: "210 ms" },
];

const FEED: FeedItem[] = [
  { id: "1", who: "Marsela G.", verb: "creó el expediente", target: "Sergio Arias · Banco Bogotá", ts: "hace 2 min", kind: "case" },
  { id: "2", who: "Carlos G.", verb: "aprobó QA", target: "Nubia Gutiérrez · Score 98", ts: "hace 6 min", kind: "qa" },
  { id: "3", who: "Cliente", verb: "firmó contrato", target: "Javier Bonilla · Poder + Ficha", ts: "hace 12 min", kind: "sign" },
  { id: "4", who: "Banco Davivienda", verb: "respondió requerimiento", target: "Radicado 8891 · Aceptado", ts: "hace 24 min", kind: "bank" },
  { id: "5", who: "Contabilidad", verb: "emitió cuenta de cobro", target: "CxC 00219 · $2.4M", ts: "hace 41 min", kind: "fin" },
  { id: "6", who: "Jurídica", verb: "radicó tutela", target: "T-2026-0091 · Turno asignado", ts: "hace 1 h", kind: "legal" },
  { id: "7", who: "NUVIA QA IA", verb: "devolvió simulación", target: "Kevin D. · Score 62", ts: "hace 1 h", kind: "ia" },
];

const ALERTS: AlertItem[] = [
  { id: "sla", title: "SLA vencidos", count: 4, to: "/pipeline", severity: "critical", icon: Clock },
  { id: "qa", title: "QA críticos", count: 2, to: "/qa-ai", severity: "critical", icon: ShieldAlert },
  { id: "stale", title: "Casos estancados +7d", count: 6, to: "/pipeline", severity: "warning", icon: AlertTriangle },
  { id: "mfa", title: "Usuarios sin MFA", count: 3, to: "/super-admin/usuarios", severity: "warning", icon: KeyRound },
  { id: "cobros", title: "Cobros vencidos", count: 5, to: "/cartera", severity: "warning", icon: FileSignature },
  { id: "int", title: "Fallos integración", count: 1, to: "/super-admin/accesos", severity: "critical", icon: Zap },
  { id: "pdf", title: "Errores PDF (24h)", count: 2, to: "/super-admin/accesos", severity: "warning", icon: FileText },
  { id: "notif", title: "Notificaciones caídas", count: 1, to: "/super-admin/accesos", severity: "warning", icon: Radio },
];

const SUGGESTIONS: Suggestion[] = [
  { id: "1", text: "Hay 4 QA represados. Reasigna a Audelina para desatorar la cola.", to: "/qa-ai", tone: "warning" },
  { id: "2", text: "2 usuarios sin MFA con rol crítico. Fuerza activación ahora.", to: "/super-admin/usuarios", tone: "critical" },
  { id: "3", text: "7 casos con SLA crítico. Prioriza en pipeline esta hora.", to: "/pipeline", tone: "warning" },
];

const QUOTES = [
  { q: "Un sistema disciplinado escala más rápido que un sistema brillante.", a: "NUVIA · Legacy" },
  { q: "La confianza operativa se construye con trazabilidad, no con promesas.", a: "NUVIA · Legacy" },
  { q: "Cada expediente cerrado es una familia con menos ruido financiero.", a: "NUVIA · Legacy" },
];

const feedIcon: Record<FeedItem["kind"], { icon: ComponentType<{ size?: number }>; color: string }> = {
  case: { icon: FileText, color: "var(--nuvia-accent-blue)" },
  qa: { icon: ShieldCheck, color: "var(--nuvia-accent-green)" },
  sign: { icon: FileSignature, color: "var(--nuvia-accent-green)" },
  bank: { icon: Layers, color: "var(--nuvia-accent-blue)" },
  fin: { icon: BarChart3, color: "#f0b429" },
  legal: { icon: ScrollText, color: "#c78bff" },
  ia: { icon: Bot, color: "var(--nuvia-accent-blue)" },
};

const statusMeta: Record<HealthStatus, { label: string; color: string; ring: string }> = {
  operational: { label: "Operational", color: "var(--nuvia-accent-green)", ring: "rgba(132,185,143,0.35)" },
  warning: { label: "Warning", color: "#f0b429", ring: "rgba(240,180,41,0.35)" },
  critical: { label: "Critical", color: "#ff6a6a", ring: "rgba(255,106,106,0.45)" },
};

export function SuperAdminControlCenter({ onLanzarSimulador }: Props) {
  const [counts, setCounts] = useState<{ users?: number; expedientes?: number }>({});
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setQuoteIdx((i) => (i + 1) % QUOTES.length), 9000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [u, e] = await Promise.all([
          supabase.from("profiles" as never).select("id", { count: "exact", head: true }),
          supabase.from("expedientes" as never).select("id", { count: "exact", head: true }),
        ]);
        if (cancel) return;
        setCounts({
          users: typeof u.count === "number" ? u.count : undefined,
          expedientes: typeof e.count === "number" ? e.count : undefined,
        });
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const heroKpis = useMemo(
    () => [
      { label: "Usuarios online", value: counts.users != null ? Math.max(1, Math.round(counts.users * 0.24)) : "—", tone: "blue" as const },
      { label: "Casos activos", value: counts.expedientes ?? "—", tone: "blue" as const },
      { label: "Simulaciones hoy", value: 47, tone: "green" as const },
      { label: "QA pendientes", value: 4, tone: "warning" as const },
      { label: "Errores críticos", value: 1, tone: "critical" as const },
      { label: "Uptime 30d", value: "99.98%", tone: "green" as const },
    ],
    [counts],
  );

  const opsKpis = [
    { label: "Casos activos", value: counts.expedientes ?? "—", icon: FileText, tone: "blue" as const },
    { label: "QA abiertos", value: 6, icon: ShieldCheck, tone: "warning" as const },
    { label: "Contratos firmados (mes)", value: 38, icon: FileSignature, tone: "green" as const },
    { label: "Honorarios pendientes", value: "$18.4 M", icon: BarChart3, tone: "blue" as const },
    { label: "Tasa de cierre", value: "62%", icon: LineChart, tone: "green" as const },
    { label: "Tiempo prom. respuesta", value: "1h 42m", icon: Clock, tone: "blue" as const },
    { label: "Usuarios activos", value: counts.users ?? "—", icon: Users, tone: "blue" as const },
    { label: "Integridad sistema", value: "100%", icon: Gauge, tone: "green" as const },
  ];

  const heatmap = useMemo(
    () => Array.from({ length: 24 }, (_, h) => {
      const seed = Math.sin(h * 1.7) * 0.5 + 0.5;
      const boost = h >= 8 && h <= 20 ? 0.55 : 0.15;
      return Math.min(1, seed * 0.6 + boost);
    }),
    [],
  );

  const rolesBreakdown = [
    { r: "AFC", n: 12, tone: "var(--nuvia-accent-blue)" },
    { r: "QA", n: 3, tone: "var(--nuvia-accent-green)" },
    { r: "Ops", n: 4, tone: "#f0b429" },
    { r: "Admin", n: 2, tone: "#c78bff" },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "var(--nuvia-bg-primary)", color: "var(--nuvia-text-primary)" }}
    >
      <AnimatedBackground />
      <GridBackdrop />

      <div className="relative z-10 mx-auto max-w-[1440px] px-6 py-8 space-y-6 animate-fade-in">
        {/* ═══ 1 · HERO ═══ */}
        <Hero onLanzarSimulador={onLanzarSimulador} kpis={heroKpis} />

        {/* ═══ 2 · SYSTEM HEALTH ═══ */}
        <Panel
          title="NUVIA Core Health"
          eyebrow="Infraestructura viva"
          right={<LiveDot label="Realtime" />}
        >
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {SERVICES.map((s) => (
              <ServiceCard key={s.name} service={s} />
            ))}
          </div>
        </Panel>

        {/* ═══ 3 · ALERTS + 4 · LIVE OPS ═══ */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Panel
              title="Centro de alertas"
              eyebrow="Requiere acción"
              right={<Badge tone="critical">{ALERTS.filter((a) => a.severity === "critical").length} críticas</Badge>}
            >
              <div className="grid gap-2.5 sm:grid-cols-2">
                {ALERTS.map((a) => (
                  <AlertCard key={a.id} alert={a} />
                ))}
              </div>
            </Panel>
          </div>
          <div className="lg:col-span-7">
            <Panel
              title="Live operations feed"
              eyebrow="Actividad en curso"
              right={<LiveDot label="Streaming" />}
            >
              <ol className="relative space-y-3">
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-[15px] top-1 bottom-1 w-px"
                  style={{ background: "linear-gradient(180deg, rgba(238,245,255,0.18), transparent)" }}
                />
                {FEED.map((f) => (
                  <FeedRow key={f.id} item={f} />
                ))}
              </ol>
            </Panel>
          </div>
        </div>

        {/* ═══ 5 · KPI GRID ═══ */}
        <Panel title="Indicadores operativos" eyebrow="Consolidado global">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {opsKpis.map((k) => (
              <OpsKpi key={k.label} {...k} />
            ))}
          </div>
        </Panel>

        {/* ═══ 6 · QUICK ACCESS + USERS PANEL ═══ */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Panel title="Quick access" eyebrow="Módulos por zona">
              <div className="grid gap-5 md:grid-cols-3">
                <ZoneGroup
                  title="Operación"
                  icon={Settings2}
                  tint="var(--nuvia-accent-blue)"
                  items={[
                    { label: "Usuarios", to: "/super-admin/usuarios", icon: Users },
                    { label: "Permisos", to: "/super-admin/permisos", icon: ShieldCheck },
                    { label: "Onboarding", to: "/super-admin/onboarding", icon: GraduationCap },
                  ]}
                />
                <ZoneGroup
                  title="Inteligencia"
                  icon={Brain}
                  tint="var(--nuvia-accent-green)"
                  items={[
                    { label: "NUVIA IA", to: "/nuvex-ia", icon: Bot },
                    { label: "Copiloto", to: "/nuvex-ia", icon: Sparkles },
                    { label: "Knowledge Base", to: "/super-admin/nuvex-ia-kb", icon: Layers },
                  ]}
                />
                <ZoneGroup
                  title="Seguridad"
                  icon={ShieldCheck}
                  tint="#c78bff"
                  items={[
                    { label: "Auditoría", to: "/super-admin/accesos", icon: ScrollText },
                    { label: "Logs", to: "/super-admin/accesos", icon: Activity },
                    { label: "MFA & Accesos", to: "/super-admin/usuarios", icon: KeyRound },
                  ]}
                />
              </div>
            </Panel>
          </div>

          <div className="lg:col-span-4">
            <Panel title="Users activity" eyebrow="Conectados ahora" right={<LiveDot label="Live" />}>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--nuvia-text-muted)" }}>
                    Total conectados
                  </div>
                  <div className="mt-1 text-[42px] font-bold leading-none tabular-nums">
                    {counts.users != null ? Math.max(1, Math.round(counts.users * 0.24)) : "—"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--nuvia-text-muted)" }}>
                    Sesiones
                  </div>
                  <div className="mt-1 text-[18px] font-semibold tabular-nums">27</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {rolesBreakdown.map((r) => (
                  <span
                    key={r.r}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                    style={{
                      background: `color-mix(in oklab, ${r.tone} 14%, transparent)`,
                      color: r.tone,
                      border: `1px solid color-mix(in oklab, ${r.tone} 32%, transparent)`,
                    }}
                  >
                    {r.r}
                    <span className="tabular-nums opacity-80">{r.n}</span>
                  </span>
                ))}
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
                  <span>Heatmap 24h</span>
                  <span>Último acceso: hace 40s</span>
                </div>
                <div className="flex items-end gap-[3px] h-14">
                  {heatmap.map((v, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm transition-all"
                      style={{
                        height: `${Math.max(8, v * 100)}%`,
                        background: `linear-gradient(180deg, color-mix(in oklab, var(--nuvia-accent-blue) ${20 + v * 60}%, transparent), color-mix(in oklab, var(--nuvia-accent-green) ${10 + v * 40}%, transparent))`,
                        boxShadow: v > 0.75 ? "0 0 8px rgba(132,185,143,0.35)" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>

        {/* ═══ 7 · VICTORY FEED ═══ */}
        <Panel
          title="Feed de victorias"
          eyebrow="Cierres firmados en vivo"
          right={<Badge tone="green">Ticker</Badge>}
        >
          <VictoryFeed limit={8} />
        </Panel>

        {/* ═══ 8 · NUVIA IA INSIGHTS + LEGADO ═══ */}
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <Panel
              title="NUVIA IA · Insights"
              eyebrow="Sugerencias priorizadas"
              right={<Badge tone="blue">Auto-tuning</Badge>}
            >
              <div className="space-y-2.5">
                {SUGGESTIONS.map((s) => (
                  <SuggestionRow key={s.id} s={s} />
                ))}
              </div>
            </Panel>
          </div>
          <div className="lg:col-span-4">
            <Panel title="Legado empresarial" eyebrow="NUVIA · Doctrina">
              <blockquote
                key={quoteIdx}
                className="animate-fade-in text-[13px] leading-relaxed italic"
                style={{ color: "var(--nuvia-text-secondary)" }}
              >
                “{QUOTES[quoteIdx].q}”
                <footer
                  className="mt-2 not-italic text-[10.5px] font-semibold uppercase tracking-[0.2em]"
                  style={{ color: "var(--nuvia-text-muted)" }}
                >
                  — {QUOTES[quoteIdx].a}
                </footer>
              </blockquote>
              <div className="mt-4 flex gap-1.5">
                {QUOTES.map((_, i) => (
                  <span
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all"
                    style={{
                      background:
                        i === quoteIdx
                          ? "linear-gradient(90deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))"
                          : "rgba(255,255,255,0.08)",
                    }}
                  />
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────── UI PRIMITIVES ─────────────────────────────
function GridBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.28]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(238,245,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(238,245,255,0.055) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse at 50% 20%, rgba(0,0,0,0.9), transparent 70%)",
      }}
    />
  );
}

function Panel({
  title,
  eyebrow,
  right,
  children,
}: {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-xl)] p-5"
      style={{
        background: "linear-gradient(160deg, rgba(8,12,28,0.62) 0%, rgba(18,26,50,0.5) 100%)",
        border: "1px solid rgba(238,245,255,0.11)",
        backdropFilter: "blur(28px) saturate(150%)",
        boxShadow: "0 24px 60px -28px rgba(0,0,0,0.65), inset 0 1px 0 rgba(238,245,255,0.06)",
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(238,245,255,0.4), transparent)" }}
      />
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          {eyebrow && (
            <div className="text-[9.5px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--nuvia-text-muted)" }}>
              {eyebrow}
            </div>
          )}
          <h2 className="mt-0.5 text-[15px] font-bold tracking-tight">{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

function LiveDot({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{
        background: "rgba(132,185,143,0.12)",
        color: "var(--nuvia-accent-green)",
        border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 30%, transparent)",
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "var(--nuvia-accent-green)" }} />
        <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--nuvia-accent-green)" }} />
      </span>
      {label}
    </span>
  );
}

function Badge({ tone, children }: { tone: "green" | "blue" | "critical" | "warning"; children: React.ReactNode }) {
  const map = {
    green: { bg: "rgba(132,185,143,0.14)", fg: "var(--nuvia-accent-green)", br: "rgba(132,185,143,0.35)" },
    blue: { bg: "rgba(68,93,163,0.16)", fg: "var(--nuvia-accent-blue)", br: "rgba(68,93,163,0.42)" },
    critical: { bg: "rgba(255,106,106,0.14)", fg: "#ff8f8f", br: "rgba(255,106,106,0.4)" },
    warning: { bg: "rgba(240,180,41,0.12)", fg: "#f0c559", br: "rgba(240,180,41,0.4)" },
  }[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ background: map.bg, color: map.fg, border: `1px solid ${map.br}` }}
    >
      {children}
    </span>
  );
}

// ───────────────────────────────── HERO ──────────────────────────────────────
function Hero({
  onLanzarSimulador,
  kpis,
}: {
  onLanzarSimulador: () => void;
  kpis: { label: string; value: React.ReactNode; tone: "blue" | "green" | "warning" | "critical" }[];
}) {
  const toneColor = (t: string) =>
    t === "green"
      ? "var(--nuvia-accent-green)"
      : t === "warning"
      ? "#f0c559"
      : t === "critical"
      ? "#ff8f8f"
      : "var(--nuvia-accent-blue)";
  return (
    <section
      className="relative overflow-hidden rounded-[var(--nuvia-radius-xl)] p-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(20,28,52,0.65) 0%, rgba(28,42,78,0.5) 55%, rgba(68,93,163,0.32) 100%)",
        border: "1px solid rgba(238,245,255,0.13)",
        backdropFilter: "blur(34px) saturate(160%)",
        boxShadow: "0 30px 80px -30px rgba(0,0,0,0.75), inset 0 1px 0 rgba(238,245,255,0.07)",
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "rgba(132,185,143,0.22)" }} />
      <div aria-hidden className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full blur-3xl" style={{ background: "rgba(68,93,163,0.32)" }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(238,245,255,0.5), transparent)" }} />

      <div className="relative flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{
            background: "rgba(132,185,143,0.14)",
            color: "var(--nuvia-accent-green)",
            border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 30%, transparent)",
          }}
        >
          <Cpu size={11} /> Super Admin · Global Control Center
        </span>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ background: "rgba(255,255,255,0.05)", color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)" }}
        >
          <Server size={11} /> NUVIA Core · v4.2
        </span>
      </div>

      <h1 className="relative mt-4 text-[42px] md:text-[52px] font-bold tracking-tight leading-[1.02]">
        NUVIA{" "}
        <span
          style={{
            backgroundImage: "linear-gradient(120deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          CORE SYSTEM
        </span>
      </h1>
      <p className="relative mt-3 max-w-2xl text-[14.5px] leading-relaxed" style={{ color: "var(--nuvia-text-secondary)" }}>
        Centro de control global de usuarios, operaciones, seguridad, automatización y monitoreo en tiempo real.
      </p>

      {/* KPI inline */}
      <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl px-3.5 py-3"
            style={{
              background: "rgba(5,8,22,0.42)",
              border: "1px solid rgba(238,245,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(238,245,255,0.05)",
            }}
          >
            <div className="text-[22px] font-bold tabular-nums leading-none" style={{ color: toneColor(k.tone) }}>
              {k.value}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--nuvia-text-muted)" }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onLanzarSimulador}
          className="group inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.16em] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, var(--nuvia-accent-blue) 0%, var(--nuvia-accent-green) 100%)",
            color: "#0a0f1f",
            border: "1px solid rgba(238,245,255,0.22)",
            boxShadow: "0 14px 36px -12px rgba(68,93,163,0.75), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}
        >
          <Rocket size={16} /> Lanzar simulador
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </button>
        <Link
          to="/dashboard"
          className="group inline-flex items-center gap-2.5 rounded-xl px-4 py-3 text-[12.5px] font-semibold transition hover:border-white/30"
          style={{
            background: "rgba(255,255,255,0.045)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-primary)",
            boxShadow: "inset 0 1px 0 rgba(238,245,255,0.05)",
          }}
        >
          <BarChart3 size={15} /> Ver dashboard ejecutivo
          <ArrowRight size={13} className="opacity-60 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}

// ───────────────────────────────── SERVICE / HEALTH ──────────────────────────
function ServiceCard({ service }: { service: Service }) {
  const meta = statusMeta[service.status];
  const Icon = service.icon;
  return (
    <div
      className="relative rounded-xl px-3.5 py-3"
      style={{
        background: "rgba(5,8,22,0.5)",
        border: `1px solid ${meta.ring}`,
        boxShadow: `inset 0 1px 0 rgba(238,245,255,0.05), 0 0 22px -14px ${meta.color}`,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg"
          style={{
            background: "rgba(238,245,255,0.05)",
            border: "1px solid rgba(238,245,255,0.08)",
            color: "var(--nuvia-text-primary)",
          }}
        >
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold">{service.name}</div>
          <div className="text-[10px] tabular-nums" style={{ color: "var(--nuvia-text-muted)" }}>
            {service.latency}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inset-0 rounded-full animate-ping" style={{ background: meta.color, opacity: 0.6 }} />
          <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: meta.color }}>
          {meta.label}
        </span>
      </div>
    </div>
  );
}

// ───────────────────────────────── FEED ROW ──────────────────────────────────
function FeedRow({ item }: { item: FeedItem }) {
  const { icon: Icon, color } = feedIcon[item.kind];
  return (
    <li className="relative pl-9">
      <span
        className="absolute left-0 top-0.5 grid h-8 w-8 place-items-center rounded-lg"
        style={{
          background: `color-mix(in oklab, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${color} 34%, transparent)`,
          color,
          boxShadow: `0 0 18px -8px ${color}`,
        }}
      >
        <Icon size={14} />
      </span>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[12.5px] leading-snug">
          <span className="font-semibold">{item.who}</span>{" "}
          <span style={{ color: "var(--nuvia-text-secondary)" }}>{item.verb}</span>{" "}
          <span className="font-medium">{item.target}</span>
        </div>
        <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: "var(--nuvia-text-muted)" }}>
          {item.ts}
        </span>
      </div>
    </li>
  );
}

// ───────────────────────────────── ALERT CARD ────────────────────────────────
function AlertCard({ alert }: { alert: AlertItem }) {
  const tone =
    alert.severity === "critical"
      ? { color: "#ff8f8f", ring: "rgba(255,106,106,0.4)" }
      : alert.severity === "warning"
      ? { color: "#f0c559", ring: "rgba(240,180,41,0.4)" }
      : { color: "var(--nuvia-accent-blue)", ring: "rgba(68,93,163,0.4)" };
  const Icon = alert.icon;
  return (
    <Link
      to={alert.to}
      className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:-translate-y-0.5"
      style={{
        background: "rgba(5,8,22,0.5)",
        border: `1px solid ${tone.ring}`,
        boxShadow: `inset 0 1px 0 rgba(238,245,255,0.05), 0 0 18px -12px ${tone.color}`,
      }}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg"
        style={{
          background: `color-mix(in oklab, ${tone.color} 14%, transparent)`,
          border: `1px solid ${tone.ring}`,
          color: tone.color,
        }}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-semibold">{alert.title}</div>
        <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--nuvia-text-muted)" }}>
          Requiere acción
        </div>
      </div>
      <span
        className="grid h-7 min-w-7 place-items-center rounded-md px-2 text-[12px] font-bold tabular-nums"
        style={{
          background: `color-mix(in oklab, ${tone.color} 18%, transparent)`,
          color: tone.color,
          border: `1px solid ${tone.ring}`,
        }}
      >
        {alert.count}
      </span>
    </Link>
  );
}

// ───────────────────────────────── OPS KPI ───────────────────────────────────
function OpsKpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: ComponentType<{ size?: number }>;
  tone: "blue" | "green" | "warning";
}) {
  const color =
    tone === "green"
      ? "var(--nuvia-accent-green)"
      : tone === "warning"
      ? "#f0c559"
      : "var(--nuvia-accent-blue)";
  return (
    <div
      className="relative rounded-xl px-4 py-3.5"
      style={{
        background: "rgba(5,8,22,0.48)",
        border: "1px solid rgba(238,245,255,0.09)",
        boxShadow: "inset 0 1px 0 rgba(238,245,255,0.05)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
          {label}
        </div>
        <span
          className="grid h-7 w-7 place-items-center rounded-md"
          style={{
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
            color,
          }}
        >
          <Icon size={12} />
        </span>
      </div>
      <div className="mt-1.5 text-[26px] font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

// ───────────────────────────────── ZONE GROUP ────────────────────────────────
function ZoneGroup({
  title,
  icon: Icon,
  tint,
  items,
}: {
  title: string;
  icon: ComponentType<{ size?: number }>;
  tint: string;
  items: { label: string; to: string; icon: ComponentType<{ size?: number }> }[];
}) {
  return (
    <div>
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-md"
          style={{
            background: `color-mix(in oklab, ${tint} 14%, transparent)`,
            border: `1px solid color-mix(in oklab, ${tint} 30%, transparent)`,
            color: tint,
          }}
        >
          <Icon size={12} />
        </span>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--nuvia-text-muted)" }}>
          {title}
        </span>
        <span aria-hidden className="ml-1 flex-1 h-px" style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${tint} 30%, transparent), transparent)` }} />
      </div>
      <div className="space-y-2">
        {items.map((it) => {
          const IconIt = it.icon;
          return (
            <Link
              key={it.label}
              to={it.to}
              className="group flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition hover:-translate-y-0.5"
              style={{
                background: "rgba(5,8,22,0.5)",
                border: "1px solid rgba(238,245,255,0.08)",
                boxShadow: "inset 0 1px 0 rgba(238,245,255,0.04)",
              }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-md"
                style={{
                  background: `color-mix(in oklab, ${tint} 12%, transparent)`,
                  color: tint,
                  border: `1px solid color-mix(in oklab, ${tint} 25%, transparent)`,
                }}
              >
                <IconIt size={12} />
              </span>
              <span className="flex-1 text-[12.5px] font-semibold">{it.label}</span>
              <ArrowRight size={13} className="opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────── SUGGESTION ROW ────────────────────────────
function SuggestionRow({ s }: { s: Suggestion }) {
  const color =
    s.tone === "critical" ? "#ff8f8f" : s.tone === "warning" ? "#f0c559" : "var(--nuvia-accent-blue)";
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3.5 py-3"
      style={{
        background: "rgba(5,8,22,0.5)",
        border: `1px solid color-mix(in oklab, ${color} 28%, transparent)`,
        boxShadow: `inset 0 1px 0 rgba(238,245,255,0.05), 0 0 18px -14px ${color}`,
      }}
    >
      <span
        className="grid h-9 w-9 place-items-center rounded-lg"
        style={{
          background: `color-mix(in oklab, ${color} 14%, transparent)`,
          border: `1px solid color-mix(in oklab, ${color} 34%, transparent)`,
          color,
        }}
      >
        <Sparkles size={15} />
      </span>
      <div className="flex-1 text-[12.5px] leading-snug">{s.text}</div>
      <Link
        to={s.to}
        onClick={() => toast.message("Abriendo módulo priorizado…")}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition hover:opacity-90"
        style={{
          background: `linear-gradient(135deg, color-mix(in oklab, ${color} 22%, transparent), transparent)`,
          border: `1px solid color-mix(in oklab, ${color} 34%, transparent)`,
          color,
        }}
      >
        Ver ahora <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// Suppress unused-import warning: CheckCircle2 reserved for future health expansion
void CheckCircle2;
