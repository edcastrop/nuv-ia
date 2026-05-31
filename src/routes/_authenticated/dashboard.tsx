import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  getDashboardMetrics,
  ESTADOS,
  type DashboardMetrics,
  type Expediente,
  type EstadoExpediente,
} from "@/lib/expedientes";
import { formatCOP, formatNumber } from "@/lib/format";
import { useUserRole } from "@/hooks/useUserRole";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
  
} from "recharts";
import {
  Folder,
  ShieldCheck,
  Target,
  TrendingUp,
  Wallet,
  FileText,
  CheckCircle2,
  CircleDollarSign,
  Trophy,
  MapPin,
  Phone,
  Globe,
  PiggyBank,
  Receipt,
  Banknote,
  Activity,
} from "lucide-react";
import { KpisPipeline14 } from "@/components/pipeline/KpisPipeline14";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Dashboard Ejecutivo · NUVEX" }] }),
});

const AZUL = "#445DA3";
const VERDE = "#84B98F";
const BG = "#0A0F1C";
const CARD = "#111827";
const CARD2 = "#172033";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT2 = "#94A3B8";

type RangeKey = "hoy" | "mes" | "30d" | "anio";

function DashboardPage() {
  const { isManager, loading: roleLoading } = useUserRole();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("mes");

  useEffect(() => {
    if (roleLoading) return;
    setLoading(true);
    getDashboardMetrics({ global: isManager })
      .then((r) => {
        setMetrics(r.metrics);
        setRows(r.rows);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [isManager, roleLoading]);

  const funnel = useMemo(
    () =>
      metrics
        ? ESTADOS.map((e) => ({ estado: e, count: metrics.porEstado[e] || 0 }))
        : [],
    [metrics],
  );

  const ticketPromedio = useMemo(() => {
    if (!metrics || metrics.total === 0) return 0;
    return metrics.honorariosBase / metrics.total;
  }, [metrics]);

  const totalAprobados = metrics
    ? (metrics.porEstado.APROBADO || 0) +
      (metrics.porEstado.FACTURADO || 0) +
      (metrics.porEstado.PAGADO || 0)
    : 0;
  const totalFacturados = metrics
    ? (metrics.porEstado.FACTURADO || 0) + (metrics.porEstado.PAGADO || 0)
    : 0;

  return (
    <div
      className="min-h-screen -mt-px"
      style={{ background: BG, color: "#fff", fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Fondo decorativo */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full opacity-[0.18] blur-[140px]"
          style={{ background: AZUL }}
        />
        <div
          className="absolute top-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.14] blur-[140px]"
          style={{ background: VERDE }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-10 space-y-8 animate-fade-in">
        {loading || roleLoading ? (
          <div className="py-24 text-center text-sm" style={{ color: TEXT2 }}>
            Cargando indicadores…
          </div>
        ) : err || !metrics ? (
          <div className="py-24 text-center text-sm text-red-400">{err}</div>
        ) : (
          <>
            {/* HERO */}
            <section className="space-y-4">
              <span
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: "rgba(132,185,143,0.12)",
                  color: VERDE,
                  border: `1px solid ${VERDE}40`,
                }}
              >
                <Activity size={12} />
                {isManager ? "Gerencia General" : "Analista Financiero Comercial"}
              </span>
              <div className="flex items-end justify-between gap-6 flex-wrap">
                <div>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                    Dashboard Ejecutivo
                  </h1>
                  <p className="mt-2 text-base max-w-2xl" style={{ color: TEXT2 }}>
                    {isManager
                      ? "Control financiero y operativo de toda la red de Analistas Financieros Comerciales NUVEX."
                      : "Indicadores personales de tu producción NUVEX."}
                  </p>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs" style={{ color: TEXT2 }}>
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ background: VERDE }} />
                  Datos en tiempo real
                </div>
              </div>
            </section>

            {/* KPIs */}
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={<Folder size={20} />}
                color={AZUL}
                label="Expedientes Totales"
                value={String(metrics.total)}
                hint={`${totalAprobados} aprobados`}
              />
              <Kpi
                icon={<ShieldCheck size={20} />}
                color={VERDE}
                label="Tasa de Aprobación"
                value={`${formatNumber(metrics.tasaAprobacion, 1)}%`}
                hint="Sobre radicados"
                hero
              />
              <Kpi
                icon={<Target size={20} />}
                color={AZUL}
                label="Acertividad Promedio"
                value={`${formatNumber(metrics.acertividadPromedio, 1)}%`}
                hint="Proyección vs aprobado"
              />
              <Kpi
                icon={<TrendingUp size={20} />}
                color={VERDE}
                label="Tasa de Cierre"
                value={`${formatNumber(metrics.tasaCierre, 1)}%`}
                hint="Pagados / totales"
              />
            </section>

            {isManager && <KpisPipeline14 />}

            {/* FUNNEL + PIPELINE */}
            <section className="grid gap-6 lg:grid-cols-3">
              <PremiumCard className="lg:col-span-2">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
                  <div>
                    <h2 className="text-xl font-semibold">Funnel de Producción</h2>
                    <p className="text-sm mt-1" style={{ color: TEXT2 }}>
                      Distribución de expedientes por estado.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: CARD2, border: `1px solid ${BORDER}` }}>
                    {(["hoy", "mes", "30d", "anio"] as RangeKey[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-all"
                        style={{
                          background:
                            range === r
                              ? `linear-gradient(135deg, ${AZUL}, ${VERDE})`
                              : "transparent",
                          color: range === r ? "#fff" : TEXT2,
                        }}
                      >
                        {r === "hoy" ? "Hoy" : r === "mes" ? "Este Mes" : r === "30d" ? "30 días" : "Este Año"}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <BarChart data={funnel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="nuvexBar" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={AZUL} stopOpacity={1} />
                          <stop offset="100%" stopColor={VERDE} stopOpacity={0.85} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis
                        dataKey="estado"
                        tick={{ fontSize: 11, fill: TEXT2 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: TEXT2 }}
                        axisLine={{ stroke: BORDER }}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(132,185,143,0.08)" }}
                        contentStyle={{
                          background: CARD2,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 12,
                          color: "#fff",
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="url(#nuvexBar)" animationDuration={900}>
                        {funnel.map((_, i) => (
                          <Cell key={i} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t" style={{ borderColor: BORDER }}>
                  <MiniStat label="Total expedientes" value={String(metrics.total)} color="#fff" />
                  <MiniStat label="Aprobados" value={String(totalAprobados)} color={VERDE} />
                  <MiniStat label="Facturados" value={String(totalFacturados)} color={AZUL} />
                </div>
              </PremiumCard>

              <PremiumCard>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold">Pipeline Comercial</h2>
                  <p className="text-sm mt-1" style={{ color: TEXT2 }}>
                    Resumen financiero de honorarios.
                  </p>
                </div>
                <div className="space-y-3">
                  <PipelineRow
                    icon={<FileText size={16} />}
                    label="Firmado"
                    value={formatCOP(metrics.porEstado.FIRMADO ? metrics.honorariosBase : 0)}
                    color="#F0B429"
                  />
                  <PipelineRow
                    icon={<Receipt size={16} />}
                    label="Facturado"
                    value={formatCOP(metrics.honorariosFacturados)}
                    color="#9333EA"
                  />
                  <PipelineRow
                    icon={<CheckCircle2 size={16} />}
                    label="Pagado"
                    value={formatCOP(metrics.honorariosPagados)}
                    color={VERDE}
                  />
                  <PipelineRow
                    icon={<CircleDollarSign size={16} />}
                    label="Pipeline"
                    value={formatCOP(metrics.pipeline)}
                    color={AZUL}
                    highlight
                  />
                </div>
              </PremiumCard>
            </section>

            {/* RENDIMIENTO COMERCIAL */}
            <section>
              <div className="mb-5 flex items-end justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Rendimiento Comercial</h2>
                  <p className="text-sm mt-1" style={{ color: TEXT2 }}>
                    Indicadores financieros consolidados de la operación.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Kpi
                  icon={<Wallet size={20} />}
                  color={AZUL}
                  label="Honorarios Generados"
                  value={formatCOP(metrics.honorariosBase)}
                />
                <Kpi
                  icon={<Receipt size={20} />}
                  color="#9333EA"
                  label="Honorarios Facturados"
                  value={formatCOP(metrics.honorariosFacturados)}
                />
                <Kpi
                  icon={<Banknote size={20} />}
                  color={VERDE}
                  label="Honorarios Pagados"
                  value={formatCOP(metrics.honorariosPagados)}
                />
                <Kpi
                  icon={<PiggyBank size={20} />}
                  color={AZUL}
                  label="Ticket Promedio"
                  value={formatCOP(ticketPromedio)}
                />
              </div>
            </section>

            {/* RANKING */}
            {isManager && metrics.porAsesor && metrics.porAsesor.length > 0 && (
              <section>
                <PremiumCard>
                  <div className="mb-5 flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}
                    >
                      <Trophy size={18} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Ranking de Analistas Financieros Comerciales</h2>
                      <p className="text-sm" style={{ color: TEXT2 }}>
                        Top 5 por producción de honorarios.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.15em] border-b" style={{ color: TEXT2, borderColor: BORDER }}>
                          <th className="py-3 pr-3">#</th>
                          <th className="py-3 pr-3">Nombre</th>
                          <th className="py-3 pr-3 text-right">Casos</th>
                          <th className="py-3 pr-3 text-right">Aprobados</th>
                          <th className="py-3 pr-3 text-right">Honorarios</th>
                          <th className="py-3 pr-3 text-right">Acertividad</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.porAsesor.slice(0, 5).map((a, i) => (
                          <tr
                            key={a.asesor_id}
                            className="border-b transition-colors hover:bg-white/[0.03]"
                            style={{ borderColor: BORDER }}
                          >
                            <td className="py-4 pr-3">
                              <span
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
                                style={{
                                  background: i === 0 ? `linear-gradient(135deg, ${AZUL}, ${VERDE})` : CARD2,
                                  color: i === 0 ? "#fff" : TEXT2,
                                  border: i === 0 ? "none" : `1px solid ${BORDER}`,
                                }}
                              >
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-4 pr-3 font-medium">{a.nombre}</td>
                            <td className="py-4 pr-3 text-right" style={{ color: TEXT2 }}>{a.total}</td>
                            <td className="py-4 pr-3 text-right" style={{ color: VERDE }}>{a.aprobados}</td>
                            <td className="py-4 pr-3 text-right font-semibold">{formatCOP(a.honorariosFinal)}</td>
                            <td className="py-4 pr-3 text-right" style={{ color: TEXT2 }}>
                              {a.acertividadPromedio > 0 ? `${formatNumber(a.acertividadPromedio, 1)}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </PremiumCard>
              </section>
            )}

            {/* Últimos expedientes */}
            <section>
              <PremiumCard>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold">
                    {isManager ? "Últimos expedientes (global)" : "Mis últimos expedientes"}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-[0.15em] border-b" style={{ color: TEXT2, borderColor: BORDER }}>
                        <th className="py-3 pr-3">Cliente</th>
                        <th className="py-3 pr-3">Banco</th>
                        <th className="py-3 pr-3">Estado</th>
                        <th className="py-3 pr-3 text-right">Honorarios</th>
                        <th className="py-3 pr-3 text-right">Acertividad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 10).map((r) => (
                        <tr
                          key={r.id}
                          className="border-b transition-colors hover:bg-white/[0.03]"
                          style={{ borderColor: BORDER }}
                        >
                          <td className="py-3 pr-3 font-medium">{r.cliente_nombre}</td>
                          <td className="py-3 pr-3" style={{ color: TEXT2 }}>{r.banco || "—"}</td>
                          <td className="py-3 pr-3">
                            <EstadoPill estado={r.estado} />
                          </td>
                          <td className="py-3 pr-3 text-right font-semibold">{formatCOP(Number(r.honorarios_final))}</td>
                          <td className="py-3 pr-3 text-right" style={{ color: TEXT2 }}>
                            {r.acertividad_global != null ? `${formatNumber(Number(r.acertividad_global), 1)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </PremiumCard>
            </section>

            {/* FOOTER INSTITUCIONAL */}
            <footer className="mt-16">
              <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${AZUL}, ${VERDE}, transparent)` }} />
              <div className="grid gap-8 md:grid-cols-3 pt-10 pb-6">
                <FooterCol
                  title="Bucaramanga"
                  icon={<MapPin size={14} />}
                  lines={["Carrera 16 # 37-48 Piso 4", "Centro Bucaramanga"]}
                />
                <FooterCol
                  title="Bogotá"
                  icon={<MapPin size={14} />}
                  lines={["Calle 93 # 18-28 Oficina 704"]}
                />
                <FooterCol
                  title="Contacto"
                  icon={<Phone size={14} />}
                  lines={["+57 316 402 3779", "www.nuvex.com.co"]}
                  extraIcon={<Globe size={14} />}
                />
              </div>
              <div className="text-center text-[11px] pb-6" style={{ color: TEXT2 }}>
                © {new Date().getFullYear()} NUVEX Finanzas Inteligentes · El ahorro no es un lujo, es un derecho.
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

/* ============== Helpers ============== */

function PremiumCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[20px] p-6 backdrop-blur-xl transition-all ${className ?? ""}`}
      style={{
        background: `linear-gradient(180deg, ${CARD} 0%, ${CARD2} 100%)`,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}

function Kpi({
  icon,
  color,
  label,
  value,
  hint,
  hero,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  hint?: string;
  hero?: boolean;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-[20px] p-5 transition-all duration-300 hover:-translate-y-1"
      style={{
        background: `linear-gradient(180deg, ${CARD} 0%, ${CARD2} 100%)`,
        border: `1px solid ${BORDER}`,
        boxShadow: `0 10px 40px -15px rgba(0,0,0,0.5)`,
      }}
    >
      <div
        className="absolute -top-12 -right-12 h-32 w-32 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 blur-2xl"
        style={{ background: color }}
      />
      <div className="relative flex items-start justify-between mb-4">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: `${color}1A`,
            color,
            border: `1px solid ${color}33`,
          }}
        >
          {icon}
        </div>
      </div>
      <div className="relative">
        <div className={`font-bold tracking-tight ${hero ? "text-4xl" : "text-3xl"}`} style={{ color: "#fff" }}>
          {value}
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] mt-2" style={{ color: TEXT2 }}>
          {label}
        </div>
        {hint && (
          <div className="mt-3 pt-3 border-t text-[11px]" style={{ borderColor: BORDER, color: color }}>
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: TEXT2 }}>{label}</div>
      <div className="text-xl font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function PipelineRow({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between p-3 rounded-xl transition-all hover:translate-x-0.5"
      style={{
        background: highlight ? `${color}12` : CARD2,
        border: `1px solid ${highlight ? `${color}40` : BORDER}`,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}1A`, color }}
        >
          {icon}
        </div>
        <span className="text-sm" style={{ color: highlight ? "#fff" : TEXT2 }}>{label}</span>
      </div>
      <span className="font-bold text-sm" style={{ color: highlight ? color : "#fff" }}>{value}</span>
    </div>
  );
}

function EstadoPill({ estado }: { estado: EstadoExpediente }) {
  const map: Record<EstadoExpediente, string> = {
    SIMULADO: AZUL,
    FIRMADO: "#F0B429",
    ENVIADO_CONTRATACION: "#6366F1",
    RADICADO: "#3B6FA0",
    APROBADO: VERDE,
    CONDICIONES_APLICADAS: "#16A34A",
    FACTURADO: "#9333EA",
    PAGADO: VERDE,
  };
  const c = map[estado];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
      style={{ background: `${c}1A`, color: c, border: `1px solid ${c}33` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {estado}
    </span>
  );
}

function FooterCol({
  title,
  icon,
  lines,
  extraIcon,
}: {
  title: string;
  icon: React.ReactNode;
  lines: string[];
  extraIcon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: VERDE }}>
        {icon}
        {title}
      </div>
      <div className="space-y-1 text-sm" style={{ color: TEXT2 }}>
        {lines.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            {i === 1 && extraIcon ? <span style={{ color: AZUL }}>{extraIcon}</span> : null}
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
