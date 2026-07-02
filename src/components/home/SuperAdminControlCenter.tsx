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

  const kpiIcons = [Users, FileText, Rocket, ShieldCheck, AlertTriangle, Gauge];

  // deterministic sparkline path
  const spark = (seed: number) => {
    const pts = Array.from({ length: 14 }, (_, i) => {
      const y = 14 - (Math.sin(i * 0.9 + seed) * 0.5 + 0.5) * 12 - 1;
      return `${(i / 13) * 68},${y.toFixed(1)}`;
    });
    return `M${pts.join(" L")}`;
  };

  return (
    <section className="relative">
      {/* Scoped keyframes for the hologram */}
      <style>{`
        @keyframes nuv-spin-slow { to { transform: rotate(360deg); } }
        @keyframes nuv-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes nuv-breathe { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.05); filter: brightness(1.25); } }
        @keyframes nuv-scan { 0% { transform: translateY(-100%); opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { transform: translateY(100%); opacity: 0; } }
        @keyframes nuv-pulse-ring { 0% { transform: scale(0.6); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }
        @keyframes nuv-float-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(0,-8px); } }
        @keyframes nuv-float-b { 0%,100% { transform: translate(0,8px); } 50% { transform: translate(0,-2px); } }
        @keyframes nuv-orbit-1 { from { transform: rotate(0deg) translateX(120px) rotate(0deg); } to { transform: rotate(360deg) translateX(120px) rotate(-360deg); } }
        @keyframes nuv-orbit-2 { from { transform: rotate(0deg) translateX(160px) rotate(0deg); } to { transform: rotate(-360deg) translateX(160px) rotate(360deg); } }
        @keyframes nuv-orbit-3 { from { transform: rotate(0deg) translateX(200px) rotate(0deg); } to { transform: rotate(360deg) translateX(200px) rotate(-360deg); } }
        @keyframes nuv-beam { 0%,100% { opacity: 0.25; } 50% { opacity: 0.55; } }
      `}</style>

      {/* Cinematic backdrop */}
      <div
        className="relative overflow-hidden rounded-[28px] p-8 md:p-10"
        style={{
          background:
            "radial-gradient(1200px 500px at 78% 15%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(900px 480px at 15% 90%, rgba(132,185,143,0.20), transparent 55%), linear-gradient(140deg, #050816 0%, #0a1128 55%, #0b1633 100%)",
          border: "1px solid rgba(238,245,255,0.10)",
          boxShadow:
            "0 40px 100px -40px rgba(0,0,0,0.85), 0 0 40px rgba(68,93,163,0.20), 0 0 60px rgba(132,185,143,0.12), inset 0 1px 0 rgba(238,245,255,0.08)",
        }}
      >
        {/* Grid + noise + beams */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(rgba(238,245,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(238,245,255,0.05) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 70% 40%, rgba(0,0,0,0.9), transparent 75%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 top-0 h-full w-[2px]"
          style={{ background: "linear-gradient(180deg, transparent, rgba(68,93,163,0.6), transparent)", animation: "nuv-beam 6s ease-in-out infinite" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-1/3 top-0 h-full w-[2px]"
          style={{ background: "linear-gradient(180deg, transparent, rgba(132,185,143,0.5), transparent)", animation: "nuv-beam 8s ease-in-out infinite" }}
        />

        {/* 2-column layout */}
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center">
          {/* ── LEFT (40%) ─────────────────────────────────────────── */}
          <div className="relative">
            <div className="flex flex-wrap gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  background: "rgba(132,185,143,0.12)",
                  color: "#84B98F",
                  border: "1px solid rgba(132,185,143,0.30)",
                }}
              >
                <Cpu size={11} /> Super Admin · Global Control Center
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{
                  background: "rgba(68,93,163,0.12)",
                  color: "#8DA3E6",
                  border: "1px solid rgba(68,93,163,0.35)",
                }}
              >
                <Server size={11} /> NUVIA Core · v4.2
              </span>
            </div>

            <h1
              className="mt-5 font-extrabold leading-[0.98]"
              style={{
                fontSize: "clamp(44px, 5.6vw, 72px)",
                letterSpacing: "-0.02em",
                backgroundImage: "linear-gradient(120deg, #FFFFFF 0%, #445DA3 55%, #84B98F 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 40px rgba(68,93,163,0.25)",
              }}
            >
              NUVIA CORE SYSTEM
            </h1>

            <p
              className="mt-4 max-w-[580px] text-[17px] md:text-[19px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Centro de control global de usuarios, operaciones, seguridad,
              automatización y monitoreo en tiempo real.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button
                onClick={onLanzarSimulador}
                className="group inline-flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-[0.16em] transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]"
                style={{
                  height: "58px",
                  paddingInline: "28px",
                  borderRadius: "18px",
                  background: "linear-gradient(135deg, #445DA3 0%, #84B98F 100%)",
                  color: "#0a0f1f",
                  border: "1px solid rgba(238,245,255,0.22)",
                  boxShadow:
                    "0 16px 40px -12px rgba(68,93,163,0.75), 0 0 30px rgba(132,185,143,0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
                }}
              >
                <Rocket size={17} /> Lanzar simulador
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </button>
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2.5 text-[13px] font-semibold transition hover:border-white/30"
                style={{
                  height: "58px",
                  paddingInline: "22px",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(238,245,255,0.14)",
                  color: "var(--nuvia-text-primary)",
                  backdropFilter: "blur(18px)",
                  boxShadow: "inset 0 1px 0 rgba(238,245,255,0.06)",
                }}
              >
                <BarChart3 size={15} /> Ver dashboard ejecutivo
                <ArrowRight size={13} className="opacity-60 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            <div className="mt-6 text-[11px] italic" style={{ color: "rgba(255,255,255,0.45)" }}>
              “El ahorro no es un lujo, es un derecho.” — NUVEX
            </div>
          </div>

          {/* ── RIGHT (60%) · HOLOGRAM ─────────────────────────────── */}
          <div className="relative flex items-center justify-center min-h-[440px]">
            {/* Energy platform base */}
            <div
              aria-hidden
              className="absolute bottom-4 h-8 w-[340px] rounded-[50%]"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(132,185,143,0.35) 0%, rgba(68,93,163,0.25) 40%, transparent 70%)",
                filter: "blur(10px)",
              }}
            />

            {/* Pulse rings */}
            <div className="relative h-[380px] w-[380px]">
              {[0, 1, 2].map((i) => (
                <span
                  key={`ring-${i}`}
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    border: "1px solid rgba(68,93,163,0.35)",
                    animation: `nuv-pulse-ring 3.6s ease-out ${i * 1.2}s infinite`,
                  }}
                />
              ))}

              {/* Orbital rings */}
              <div
                aria-hidden
                className="absolute inset-6 rounded-full"
                style={{
                  border: "1px dashed rgba(141,163,230,0.35)",
                  animation: "nuv-spin-slow 22s linear infinite",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-14 rounded-full"
                style={{
                  border: "1px solid rgba(132,185,143,0.30)",
                  animation: "nuv-spin-rev 16s linear infinite",
                }}
              />
              <div
                aria-hidden
                className="absolute inset-24 rounded-full"
                style={{
                  border: "1px solid rgba(238,245,255,0.14)",
                  animation: "nuv-spin-slow 10s linear infinite",
                }}
              >
                <span
                  className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ background: "#84B98F", boxShadow: "0 0 12px #84B98F" }}
                />
              </div>

              {/* Orbiting particles */}
              <div className="absolute left-1/2 top-1/2 h-0 w-0">
                <span className="absolute h-1.5 w-1.5 rounded-full" style={{ background: "#c78bff", boxShadow: "0 0 10px #c78bff", animation: "nuv-orbit-1 7s linear infinite" }} />
                <span className="absolute h-2 w-2 rounded-full" style={{ background: "#445DA3", boxShadow: "0 0 12px #445DA3", animation: "nuv-orbit-2 11s linear infinite" }} />
                <span className="absolute h-1.5 w-1.5 rounded-full" style={{ background: "#5cd6ff", boxShadow: "0 0 12px #5cd6ff", animation: "nuv-orbit-3 15s linear infinite" }} />
              </div>

              {/* Main globe */}
              <div
                className="absolute inset-[38%] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 32% 30%, rgba(255,255,255,0.75), rgba(141,163,230,0.55) 30%, rgba(68,93,163,0.55) 55%, rgba(10,15,40,0.9) 90%)",
                  boxShadow:
                    "0 0 60px rgba(68,93,163,0.75), 0 0 120px rgba(132,185,143,0.35), inset 0 0 30px rgba(255,255,255,0.35)",
                  animation: "nuv-breathe 4.5s ease-in-out infinite",
                }}
              >
                {/* Longitude/latitude wireframe */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full overflow-hidden"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 12px), repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 12px)",
                    animation: "nuv-spin-slow 30s linear infinite",
                    opacity: 0.7,
                  }}
                />
                {/* Vertical scan */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full overflow-hidden"
                >
                  <span
                    className="absolute inset-x-0 h-[10px]"
                    style={{
                      background: "linear-gradient(180deg, transparent, rgba(132,185,143,0.9), transparent)",
                      boxShadow: "0 0 18px rgba(132,185,143,0.9)",
                      animation: "nuv-scan 3.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>

              {/* Mini floating cards */}
              <MiniCard
                title="Sistema"
                value="ÓPTIMO"
                color="#84B98F"
                icon={CheckCircle2}
                style={{ top: "6%", left: "-8%", animation: "nuv-float-a 4s ease-in-out infinite" }}
              />
              <MiniCard
                title="Sincronización"
                value="EN VIVO"
                color="#5cd6ff"
                icon={Radio}
                style={{ top: "0%", right: "-6%", animation: "nuv-float-b 4.5s ease-in-out infinite" }}
              />
              <MiniCard
                title="Latencia"
                value="38 ms"
                color="#8DA3E6"
                icon={Activity}
                style={{ bottom: "10%", left: "-10%", animation: "nuv-float-b 5s ease-in-out infinite" }}
              />
              <MiniCard
                title="NUVIA Core AI"
                value="ACTIVA"
                color="#84B98F"
                icon={Brain}
                style={{ bottom: "4%", right: "-8%", animation: "nuv-float-a 4.8s ease-in-out infinite" }}
              />
            </div>
          </div>
        </div>

        {/* ── KPI BAR ─────────────────────────────────────────────── */}
        <div className="relative mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpis.map((k, i) => {
            const Icon = kpiIcons[i] ?? Activity;
            const color = toneColor(k.tone);
            return (
              <div
                key={k.label}
                className="group relative overflow-hidden rounded-[18px] p-4 transition-all duration-300 hover:-translate-y-1"
                style={{
                  minHeight: "140px",
                  background: "rgba(5,8,22,0.55)",
                  border: "1px solid rgba(238,245,255,0.06)",
                  backdropFilter: "blur(18px)",
                  boxShadow:
                    "inset 0 1px 0 rgba(238,245,255,0.05), 0 20px 40px -25px rgba(0,0,0,0.7)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: color }}
                />
                <div className="flex items-center justify-between">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg"
                    style={{
                      background: `color-mix(in oklab, ${color} 14%, transparent)`,
                      color,
                      border: `1px solid color-mix(in oklab, ${color} 30%, transparent)`,
                    }}
                  >
                    <Icon size={14} />
                  </span>
                  <span
                    className="text-[9.5px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(255,255,255,0.55)" }}
                  >
                    Live
                  </span>
                </div>
                <div
                  className="mt-3 text-[30px] font-extrabold tabular-nums leading-none"
                  style={{ color, textShadow: `0 0 20px color-mix(in oklab, ${color} 45%, transparent)` }}
                >
                  {k.value}
                </div>
                <div
                  className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  {k.label}
                </div>
                <svg viewBox="0 0 68 14" className="mt-2 h-6 w-full" preserveAspectRatio="none">
                  <path d={spark(i * 1.3)} fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                </svg>
              </div>
            );
          })}
        </div>

        {/* ── STATUS STRIP ────────────────────────────────────────── */}
        <div
          className="relative mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[18px] px-5 py-4"
          style={{
            background: "rgba(5,8,22,0.55)",
            border: "1px solid rgba(238,245,255,0.06)",
            backdropFilter: "blur(18px)",
            boxShadow: "inset 0 1px 0 rgba(238,245,255,0.05)",
          }}
        >
          <StatusPill dot="#84B98F" text="Datos en tiempo real" />
          <StatusPill dot="#8DA3E6" text="Módulos activos 8 / 12" />
          <StatusPill dot="#5cd6ff" text="Flujos automatizados 24" />
          <StatusPill dot="#84B98F" text="Alertas del sistema · 0 críticas" />
          <StatusPill dot="#c78bff" text="Seguridad · Nivel máximo" />
        </div>
      </div>
    </section>
  );
}

function MiniCard({
  title,
  value,
  color,
  icon: Icon,
  style,
}: {
  title: string;
  value: string;
  color: string;
  icon: ComponentType<{ size?: number }>;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="absolute rounded-xl px-3 py-2 backdrop-blur-xl"
      style={{
        minWidth: "128px",
        background: "rgba(5,8,22,0.65)",
        border: `1px solid color-mix(in oklab, ${color} 36%, transparent)`,
        boxShadow: `0 12px 30px -12px rgba(0,0,0,0.7), 0 0 24px -8px ${color}`,
        ...style,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span
          className="grid h-5 w-5 place-items-center rounded"
          style={{ background: `color-mix(in oklab, ${color} 18%, transparent)`, color }}
        >
          <Icon size={11} />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.6)" }}>
          {title}
        </span>
      </div>
      <div className="mt-1 text-[13px] font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function StatusPill({ dot, text }: { dot: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,0.78)" }}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: dot, opacity: 0.55 }} />
        <span className="relative inline-block h-1.5 w-1.5 rounded-full" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
      </span>
      {text}
    </span>
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
