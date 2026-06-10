import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CitySelect } from "@/components/ui/CitySelect";
import {
  Activity,
  BarChart3,
  Bookmark,
  Building2,
  ChevronDown,
  Download,
  FileBarChart,
  FileText,
  History,
  LayoutDashboard,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Scale,
  Settings,
  Sparkles,
  Table as TableIcon,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { formatCOP, parseCurrency, parseDecimal } from "@/lib/format";
import {
  compararEscenarios,
  escenarioActual,
  proyectarEscenario,
  totalSegurosMensual,
  type EscenarioInput,
  type ProyeccionFinancieraInput,
  type TipoEscenario,
} from "@/lib/proyeccionFinanciera";
import { exportProyeccionFinancieraPDF } from "@/lib/proyeccionFinancieraExport";
import { ExtractoReader, type ExtractoApplyPayload } from "@/components/nuvex/ExtractoReader";
import { useMonedaMismatchAlert } from "@/components/nuvex/MonedaMismatchDialog";
import { GuardarCasoModal } from "./GuardarCasoModal";

// ──────────────────────────────────────────────────────────────────────────
// Brand tokens
// ──────────────────────────────────────────────────────────────────────────
const NUVEX = {
  azul: "#445DA3",
  azulSoft: "#7B8FCB",
  verde: "#84B98F",
  verdeSoft: "#A8D1B0",
  oscuro: "#242424",
  ambar: "#E0913A",
  rojo: "#C0392B",
};

const blankInput: ProyeccionFinancieraInput = {
  clienteNombre: "",
  banco: "",
  tipoProducto: "hipotecario",
  moneda: "pesos",
  fechaDesembolso: new Date().toISOString().slice(0, 10),
  valorDesembolsado: 0,
  saldoCapital: 0,
  cuotaActual: 0,
  teaPct: 0,
  cuotasTotales: 0,
  cuotasPagadas: 0,
  cuotasPendientes: 0,
  seguroVida: 0,
  seguroIncendio: 0,
  seguroTerremoto: 0,
  otrosSeguros: 0,
  uvrValor: 0,
  saldoUvr: 0,
  variacionUvrPct: 6,
  notas: "",
};

type EscenarioState = EscenarioInput & { id: string };

const presetExtras = [100000, 200000, 300000, 500000];

const BANCOS = [
  "Bancolombia",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Bogotá",
  "Banco Caja Social",
  "Banco AV Villas",
  "Banco Popular",
  "Banco Colpatria (Scotiabank)",
  "Banco Falabella",
  "Banco Itaú",
  "Banco GNB Sudameris",
  "Banco Pichincha",
  "Banco Agrario",
  "Banco Serfinanza",
  "Banco W",
  "Banco Coomeva",
  "Bancoomeva",
  "Citibank Colombia",
  "Banco Mundo Mujer",
  "Banco Finandina",
  "Fondo Nacional del Ahorro (FNA)",
  "Confiar Cooperativa Financiera",
  "Coltefinanciera",
  "Crezcamos",
  "Otro",
];

function fmtFecha(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short" });
}

// ──────────────────────────────────────────────────────────────────────────
// UI primitives (dark · premium)
// ──────────────────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="group flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <input
        type={type}
        value={value as string}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-white placeholder-white/25 outline-none transition focus:border-[#445DA3]/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#445DA3]/20"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 pr-9 text-sm font-medium text-white outline-none transition focus:border-[#445DA3]/60 focus:bg-white/[0.05] focus:ring-2 focus:ring-[#445DA3]/20"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1B1B1B] text-white">
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
      </div>
    </label>
  );
}

function Surface({
  id,
  title,
  subtitle,
  action,
  children,
  glow = false,
  padding = "p-6 md:p-7",
}: {
  id?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  glow?: boolean;
  padding?: string;
}) {
  return (
    <section
      id={id}
      className="relative overflow-hidden rounded-3xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(36,36,36,0.55), rgba(16,16,16,0.55))",
        border: "1px solid rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 60px -40px rgba(0,0,0,0.9)",
      }}
    >
      {glow && (
        <>
          <div
            className="pointer-events-none absolute -top-32 -right-32 h-64 w-64 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(68,93,163,0.22), transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute -bottom-32 -left-32 h-64 w-64 rounded-full blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(132,185,143,0.16), transparent 70%)",
            }}
          />
        </>
      )}
      <div className={`relative ${padding}`}>
        {(title || action) && (
          <header className="mb-5 flex items-start justify-between gap-4">
            <div>
              {title && (
                <h2 className="text-[15px] font-semibold tracking-tight text-white">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">
                  {subtitle}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </header>
        )}
        {children}
      </div>
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "positive" | "warn";
}) {
  const toneStyles = {
    neutral: { color: "#FFFFFF", accent: "rgba(123,143,203,0.9)" },
    positive: { color: "#A8D1B0", accent: "rgba(168,209,176,0.9)" },
    warn: { color: "#E0913A", accent: "rgba(224,145,58,0.9)" },
  }[tone];

  return (
    <div
      className="group relative h-full overflow-hidden rounded-2xl p-5 transition-all hover:translate-y-[-1px]"
      style={{
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
        border: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 20px 40px -30px rgba(0,0,0,0.8)",
      }}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
          {label}
        </div>
      </div>
      <div
        className="mt-4 text-[28px] font-semibold leading-none tracking-tight"
        style={{ color: toneStyles.color }}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-[11.5px] text-white/40">{hint}</div>}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${toneStyles.accent}, transparent)`,
          opacity: 0.4,
        }}
      />
    </div>
  );
}

function HeroKpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-7 md:p-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(192,57,43,0.28) 0%, rgba(224,145,58,0.22) 60%, rgba(36,36,36,0.4) 100%)",
        border: "1px solid rgba(224,145,58,0.25)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 80px -30px rgba(192,57,43,0.45)",
      }}
    >
      <div
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl"
        style={{
          background: "radial-gradient(circle, rgba(192,57,43,0.45), transparent 70%)",
        }}
      />
      <div className="relative flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <TrendingDown className="h-4 w-4 text-white" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/80">
            {label}
          </span>
        </div>
        <div className="mt-2 text-[clamp(2rem,4.2vw,3.4rem)] font-bold leading-none tracking-tight text-white">
          {value}
        </div>
        {hint && (
          <div className="mt-3 max-w-md text-[13px] leading-relaxed text-white/70">
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  target?: string;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard, target: "dashboard" },
  { id: "credito", label: "Información Crédito", Icon: Wallet, target: "credito" },
  { id: "escenarios", label: "Escenarios", Icon: Layers, target: "escenarios" },
  { id: "comparador", label: "Comparador", Icon: Scale, target: "comparador" },
  { id: "graficas", label: "Gráficas", Icon: BarChart3, target: "graficas" },
  { id: "amortizacion", label: "Amortización", Icon: TableIcon, target: "amortizacion" },
  { id: "informes", label: "Informes", Icon: FileBarChart, target: "informes" },
  { id: "historial", label: "Historial", Icon: History, soon: true },
  { id: "configuracion", label: "Configuración", Icon: Settings, soon: true },
];

function Sidebar({ active, onJump }: { active: string; onJump: (id: string) => void }) {
  return (
    <aside
      className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col lg:flex"
      style={{
        background:
          "linear-gradient(180deg, #242424 0%, #1B1B1B 50%, #101010 100%)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 pt-7 pb-8">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #445DA3, #84B98F)",
            boxShadow: "0 10px 30px -10px rgba(132,185,143,0.55)",
          }}
        >
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-white">NUVEX</div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Wealth Studio
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3">
        <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white/30">
          Proyección
        </div>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={item.soon}
                  onClick={() => item.target && onJump(item.target)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${
                    item.soon
                      ? "cursor-not-allowed text-white/25"
                      : isActive
                        ? "text-white"
                        : "text-white/55 hover:bg-white/[0.04] hover:text-white"
                  }`}
                  style={
                    isActive && !item.soon
                      ? {
                          background:
                            "linear-gradient(90deg, rgba(68,93,163,0.18), rgba(132,185,143,0.08))",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                        }
                      : undefined
                  }
                >
                  {isActive && !item.soon && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                      style={{
                        background: "linear-gradient(180deg, #445DA3, #84B98F)",
                      }}
                    />
                  )}
                  <item.Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.soon && (
                    <span className="ml-auto rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-white/30">
                      Pronto
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer status */}
      <div className="mx-3 mb-4 rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center gap-2">
          <div className="relative flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#84B98F]/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#84B98F]" />
          </div>
          <span className="text-[11px] font-medium text-white/60">Motor NUVEX activo</span>
        </div>
        <p className="mt-1 text-[10.5px] leading-snug text-white/35">
          Cálculos en vivo · Privado
        </p>
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Main view
// ──────────────────────────────────────────────────────────────────────────
export function ProyeccionFinancieraView() {
  const [input, setInput] = useState<ProyeccionFinancieraInput>(blankInput);
  const [lectorOpen, setLectorOpen] = useState(false);
  const [escenarios, setEscenarios] = useState<EscenarioState[]>([
    { id: crypto.randomUUID(), ...escenarioActual() },
    {
      id: crypto.randomUUID(),
      nombre: "Optimizado NUVEX",
      tipo: "nuvex",
      aporteMensualExtra: 300000,
      abonoExtraordinario: 0,
    },
  ]);
  const [selectedId, setSelectedId] = useState<string>(escenarios[1].id);
  const [activeNav, setActiveNav] = useState<string>("dashboard");
  const [guardarOpen, setGuardarOpen] = useState(false);
  const [guardarAutoSave, setGuardarAutoSave] = useState(false);
  const monedaAlerta = useMonedaMismatchAlert();

  const upd = <K extends keyof ProyeccionFinancieraInput>(
    k: K,
    v: ProyeccionFinancieraInput[K],
  ) => setInput((p) => ({ ...p, [k]: v }));

  const updNum = (k: keyof ProyeccionFinancieraInput) => (raw: string) =>
    upd(k, parseCurrency(raw) as never);
  const updDec = (k: keyof ProyeccionFinancieraInput) => (raw: string) =>
    upd(k, parseDecimal(raw) as never);
  const updInt = (k: keyof ProyeccionFinancieraInput) => (raw: string) =>
    upd(k, (parseInt(raw.replace(/\D/g, ""), 10) || 0) as never);

  const resultados = useMemo(
    () => escenarios.map((e) => ({ id: e.id, esc: e, res: proyectarEscenario(input, e) })),
    [input, escenarios],
  );

  const resActual = resultados.find((r) => r.esc.tipo === "actual") ?? resultados[0];
  const selected = resultados.find((r) => r.id === selectedId) ?? resultados[1] ?? resActual;
  const kpis = useMemo(
    () =>
      compararEscenarios(
        resActual.res,
        selected.res,
        selected.esc.aporteMensualExtra,
        selected.esc.abonoExtraordinario,
      ),
    [resActual, selected],
  );

  const segurosMes = totalSegurosMensual(input);
  const hasCaseRequiredData = Boolean(
    input.clienteNombre?.trim() && input.cedula?.trim() && input.banco?.trim(),
  );
  const openGuardarCaso = () => {
    setGuardarAutoSave(hasCaseRequiredData);
    setGuardarOpen(true);
  };

  const addEscenario = (preset?: TipoEscenario) => {
    const base: EscenarioState = {
      id: crypto.randomUUID(),
      nombre:
        preset === "conservador"
          ? "Conservador"
          : preset === "agresivo"
            ? "Agresivo"
            : preset === "nuvex"
              ? "Optimizado NUVEX"
              : "Personalizado",
      tipo: preset ?? "personalizado",
      aporteMensualExtra:
        preset === "conservador"
          ? 100000
          : preset === "agresivo"
            ? 500000
            : preset === "nuvex"
              ? 300000
              : 0,
      abonoExtraordinario: 0,
    };
    setEscenarios((p) => [...p, base]);
    setSelectedId(base.id);
  };

  const updateEscenario = (id: string, patch: Partial<EscenarioInput>) =>
    setEscenarios((p) => p.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const removeEscenario = (id: string) => {
    if (escenarios.length <= 2) return;
    setEscenarios((p) => p.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(escenarios[0].id);
  };

  // Charts data
  const chartCapitalInteres = selected.res.cuotas
    .filter((_, i) => i % Math.max(1, Math.floor(selected.res.cuotas.length / 60)) === 0)
    .map((c) => ({ mes: c.numero, Capital: Math.round(c.capital), Interés: Math.round(c.interes) }));

  const chartSaldo = selected.res.cuotas
    .filter((_, i) => i % Math.max(1, Math.floor(selected.res.cuotas.length / 80)) === 0)
    .map((c) => ({
      mes: c.numero,
      "Saldo actual": Math.round(resActual.res.cuotas[c.numero - 1]?.saldoFinal ?? 0),
      "Saldo optimizado": Math.round(c.saldoFinal),
    }));

  let acumAhorro = 0;
  const chartAhorro = selected.res.cuotas
    .map((c, i) => {
      const refInteres = resActual.res.cuotas[i]?.interes ?? 0;
      const refSeguros = resActual.res.cuotas[i]?.seguros ?? 0;
      acumAhorro += Math.max(0, refInteres - c.interes) + Math.max(0, refSeguros - c.seguros);
      return { mes: c.numero, Ahorro: Math.round(acumAhorro) };
    })
    .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0);

  const composicion = (() => {
    const c = selected.res.cuotas[0];
    if (!c) return [];
    return [
      { name: "Capital", value: Math.round(c.capital), color: NUVEX.azul },
      { name: "Intereses", value: Math.round(c.interes), color: NUVEX.rojo },
      { name: "Seguros", value: Math.round(c.seguros), color: NUVEX.ambar },
    ];
  })();

  const tiempoChart = [
    { tipo: "Actual", Meses: resActual.res.mesesRestantes },
    { tipo: "Optimizado", Meses: selected.res.mesesRestantes },
  ];

  const costoNoActuarChart = [
    { tipo: "Si continúa igual", Total: Math.round(resActual.res.totalPagado) },
    { tipo: "Con NUVEX", Total: Math.round(selected.res.totalPagado) },
  ];

  const exportCsv = () => {
    const headers = ["#", "Fecha", "Cuota", "Capital", "Interés", "Seguros", "Saldo"];
    const rows = selected.res.cuotas.map((c) => [
      c.numero,
      c.fecha.toISOString().slice(0, 10),
      Math.round(c.cuotaConExtra),
      Math.round(c.capital),
      Math.round(c.interes),
      Math.round(c.seguros),
      Math.round(c.saldoFinal),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proyeccion-${input.clienteNombre || "cliente"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    exportProyeccionFinancieraPDF({
      input,
      escenario: selected.esc,
      actual: resActual.res,
      optimizado: selected.res,
      kpis,
    });
  };

  const jumpTo = (id: string) => {
    setActiveNav(id);
    const el = document.getElementById(`sec-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Recharts shared theme
  const axisTick = { fontSize: 10, fill: "rgba(255,255,255,0.45)" };
  const gridColor = "rgba(255,255,255,0.05)";
  const tooltipStyle = {
    background: "rgba(15,15,15,0.98)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 12,
    color: "#ffffff",
    fontSize: 12,
    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7)",
    padding: "10px 12px",
  } as const;
  const tooltipItemStyle = { color: "#ffffff", fontSize: 12 } as const;
  const tooltipLabelStyle = { color: "#ffffff", fontWeight: 600, marginBottom: 4 } as const;

  return (
    <div
      className="min-h-screen text-white"
      style={{
        fontFamily:
          "'Inter','SF Pro Display','Plus Jakarta Sans',system-ui,sans-serif",
        background:
          "radial-gradient(1200px 600px at 80% -10%, rgba(68,93,163,0.18), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(132,185,143,0.10), transparent 60%), #0B0B0C",
      }}
    >
      <div className="flex">
        <Sidebar active={activeNav} onJump={jumpTo} />

        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1480px] px-5 py-7 lg:px-10 lg:py-9">
            {/* ─── HEADER EJECUTIVO ─── */}
            <header id="sec-dashboard" className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-white/45">
                  <Activity className="h-3.5 w-3.5 text-[#84B98F]" />
                  NUVEX · Wealth Intelligence
                </div>
                <h1 className="mt-2 text-[34px] font-semibold leading-none tracking-tight text-white lg:text-[44px]">
                  Proyección Financiera
                </h1>
                <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-white/55">
                  Modela, compara y demuestra el ahorro real.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {["Hipotecario", "Leasing Habitacional", "Escenarios ilimitados"].map(
                    (chip) => (
                      <span
                        key={chip}
                        className="rounded-full px-3 py-1 text-[11px] font-medium text-white/65"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {chip}
                      </span>
                    ),
                  )}
                  {/* Moneda toggle prominente */}
                  <div
                    className="inline-flex items-center gap-0.5 rounded-full p-0.5"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                    role="tablist"
                    aria-label="Moneda del crédito"
                  >
                    {(["pesos", "uvr"] as const).map((m) => {
                      const active = input.moneda === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => upd("moneda", m as never)}
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                            active ? "text-white" : "text-white/55 hover:text-white"
                          }`}
                          style={
                            active
                              ? {
                                  background:
                                    "linear-gradient(135deg, #445DA3, #84B98F)",
                                  boxShadow:
                                    "0 8px 20px -10px rgba(132,185,143,0.6)",
                                }
                              : undefined
                          }
                        >
                          {m === "pesos" ? "Pesos" : "UVR"}
                        </button>
                      );
                    })}
                  </div>
                  {input.moneda === "uvr" && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                      style={{
                        background: "rgba(224,145,58,0.12)",
                        color: "#E0913A",
                        border: "1px solid rgba(224,145,58,0.3)",
                      }}
                      title="Tasa anual usada para escalar saldo y cuota mes a mes"
                    >
                      Modo UVR · variación {(input.variacionUvrPct ?? 0) || 6}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setInput(blankInput)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Limpiar
                </button>
                <button
                  onClick={openGuardarCaso}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-[12.5px] font-medium text-white/85 transition hover:bg-white/[0.09] hover:text-white"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar y crear caso
                </button>
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" /> Exportar Excel
                </button>
                <button
                  onClick={exportPdf}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:scale-[1.02]"
                  style={{
                    background: "linear-gradient(135deg, #445DA3, #84B98F)",
                    boxShadow: "0 14px 30px -12px rgba(68,93,163,0.65)",
                  }}
                >
                  <FileText className="h-3.5 w-3.5" /> Exportar PDF
                </button>
              </div>
            </header>

            {/* ─── KPI ZONE (Costo de no actuar = protagonista) ─── */}
            <section className="mb-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <HeroKpi
                label="Costo de no actuar"
                value={formatCOP(kpis.costoNoActuar)}
                hint="Dinero adicional que el cliente pagará si mantiene su crédito en las condiciones actuales. Este es el disparador real de la decisión."
              />
              <div className="grid grid-cols-2 gap-3">
                <Kpi
                  tone="positive"
                  Icon={TrendingUp}
                  label="Ahorro total"
                  value={formatCOP(kpis.ahorroTotal)}
                />
                <Kpi
                  Icon={Activity}
                  label="Años eliminados"
                  value={`${kpis.aniosEliminados}`}
                  hint={`${kpis.mesesEliminados} meses`}
                />
                <Kpi Icon={Wallet} label="Intereses evitados" value={formatCOP(kpis.interesesEvitados)} />
                <Kpi Icon={Bookmark} label="Seguros evitados" value={formatCOP(kpis.segurosEvitados)} />
              </div>
            </section>

            <div className="mb-8">
              <Kpi
                tone="warn"
                Icon={TrendingUp}
                label="ROI Cliente"
                value={`${(kpis.roiCliente * 100).toFixed(0)}%`}
                hint={`Aporte total: ${formatCOP(kpis.inversionExtra)} · Retorno proyectado sobre el aporte adicional`}
              />
            </div>

            {/* ─── GRID PRINCIPAL ─── */}
            <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
              {/* ─── COLUMNA IZQUIERDA: Información Crédito + Lector IA ─── */}
              <div className="space-y-5">
                <Surface
                  id="sec-credito"
                  title="Información del cliente"
                  subtitle="Datos generales del perfil"
                  glow
                >
                  <div className="grid gap-4">
                    <Field
                      label="Cliente"
                      value={input.clienteNombre}
                      onChange={(v) => upd("clienteNombre", v)}
                      placeholder="Nombre del cliente"
                    />
                    <div className="relative">
                      <SelectField
                        label="Banco"
                        value={input.banco}
                        onChange={(v) => upd("banco", v)}
                        options={[
                          { value: "", label: "Seleccione un banco…" },
                          ...BANCOS.map((b) => ({ value: b, label: b })),
                        ]}
                      />
                      <Building2 className="pointer-events-none absolute right-9 top-[34px] h-4 w-4 text-white/30" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="Producto"
                        value={input.tipoProducto}
                        onChange={(v) => upd("tipoProducto", v as never)}
                        options={[
                          { value: "hipotecario", label: "Hipotecario" },
                          { value: "leasing", label: "Leasing habitacional" },
                        ]}
                      />
                      <SelectField
                        label="Moneda"
                        value={input.moneda}
                        onChange={(v) => upd("moneda", v as never)}
                        options={[
                          { value: "pesos", label: "Pesos" },
                          { value: "uvr", label: "UVR" },
                        ]}
                      />
                    </div>
                    <Field
                      label="Fecha de desembolso"
                      type="date"
                      value={input.fechaDesembolso}
                      onChange={(v) => upd("fechaDesembolso", v)}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Cédula"
                        value={input.cedula || ""}
                        onChange={(v) => upd("cedula", v)}
                        placeholder="1.234.567.890"
                      />
                      <Field
                        label="Número de crédito"
                        value={input.numeroCredito || ""}
                        onChange={(v) => upd("numeroCredito", v)}
                        placeholder="Ref. banco"
                      />
                      <Field
                        label="Celular"
                        value={input.celular || ""}
                        onChange={(v) => upd("celular", v)}
                        placeholder="300 000 0000"
                      />
                      <Field
                        label="Correo"
                        type="email"
                        value={input.correo || ""}
                        onChange={(v) => upd("correo", v)}
                        placeholder="cliente@correo.com"
                      />
                      <label className="group flex flex-col gap-1.5">
                        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">Ciudad</span>
                        <CitySelect value={input.ciudad || ""} onChange={(v) => upd("ciudad", v)} placeholder="Selecciona municipio…" />
                      </label>
                    </div>
                  </div>
                </Surface>

                <Surface title="Datos del crédito" subtitle="Saldo, tasa, plazo y cuota">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Valor desembolsado" value={input.valorDesembolsado || ""} onChange={updNum("valorDesembolsado")} placeholder="220.000.000" />
                    <Field label="Saldo a capital" value={input.saldoCapital || ""} onChange={updNum("saldoCapital")} placeholder="180.000.000" />
                    <Field label="Cuota actual" value={input.cuotaActual || ""} onChange={updNum("cuotaActual")} placeholder="2.450.000" />
                    <Field label="TEA %" value={input.teaPct || ""} onChange={updDec("teaPct")} placeholder="13,5" />
                    <Field label="Cuotas totales" value={input.cuotasTotales || ""} onChange={updInt("cuotasTotales")} placeholder="240" />
                    <Field label="Cuotas pagadas" value={input.cuotasPagadas || ""} onChange={updInt("cuotasPagadas")} placeholder="36" />
                    <Field label="Cuotas pendientes" value={input.cuotasPendientes || ""} onChange={updInt("cuotasPendientes")} placeholder="204" />
                  </div>
                </Surface>

                <Surface
                  title="Seguros mensuales"
                  subtitle={`Total ${formatCOP(segurosMes)} · Anual ${formatCOP(segurosMes * 12)}`}
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vida" value={input.seguroVida || ""} onChange={updNum("seguroVida")} />
                    <Field label="Incendio" value={input.seguroIncendio || ""} onChange={updNum("seguroIncendio")} />
                    <Field label="Terremoto" value={input.seguroTerremoto || ""} onChange={updNum("seguroTerremoto")} />
                    <Field label="Otros" value={input.otrosSeguros || ""} onChange={updNum("otrosSeguros")} />
                  </div>
                  {input.cuotaActual > 0 && segurosMes > 0 && (
                    <p className="mt-3 text-[11px] text-white/40">
                      Seguros representan{" "}
                      <span className="font-semibold text-[#84B98F]">
                        {((segurosMes / input.cuotaActual) * 100).toFixed(1)}%
                      </span>{" "}
                      de la cuota
                    </p>
                  )}
                </Surface>

                {input.moneda === "uvr" && (
                  <Surface title="Datos UVR">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Valor UVR" value={input.uvrValor || ""} onChange={updDec("uvrValor")} placeholder="380,12" />
                      <Field label="Saldo UVR" value={input.saldoUvr || ""} onChange={updDec("saldoUvr")} placeholder="220.000,00" />
                      <Field label="Variación UVR anual %" value={input.variacionUvrPct || ""} onChange={updDec("variacionUvrPct")} placeholder="6" />
                    </div>
                  </Surface>
                )}

                {/* Lector IA — colapsable, dark, glow */}
                <section
                  className="relative overflow-hidden rounded-3xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(10,18,38,0.85), rgba(7,22,45,0.85))",
                    border: "1px solid rgba(132,185,143,0.18)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 60px -30px rgba(68,93,163,0.5)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl"
                    style={{ background: "radial-gradient(circle, rgba(68,93,163,0.35), transparent 70%)" }}
                  />
                  <div
                    className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full blur-3xl"
                    style={{ background: "radial-gradient(circle, rgba(132,185,143,0.30), transparent 70%)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setLectorOpen((o) => !o)}
                    className="relative flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.03]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          background: "linear-gradient(135deg, #445DA3, #84B98F)",
                          boxShadow: "0 10px 24px -10px rgba(132,185,143,0.65)",
                        }}
                      >
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-white">
                          Lectura automática de extracto
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              background: "rgba(132,185,143,0.15)",
                              color: "#A8D1B0",
                              border: "1px solid rgba(132,185,143,0.30)",
                            }}
                          >
                            IA
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-white/55">
                          Banco · Saldo · Tasa · Cuota · Seguros · UVR · Plazo
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-white/60 transition-transform ${lectorOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {lectorOpen && (
                    <div className="relative border-t border-white/[0.06] p-5">
                      <ExtractoReader
                        modo={input.moneda === "uvr" ? "uvr" : "pesos"}
                        onApply={async (d: ExtractoApplyPayload) => {
                          // Alerta: extracto no coincide con la moneda del simulador.
                          // IMPORTANTE: d.pesos / d.uvr se llenan según el modo del lector
                          // (que es el modo del simulador), por lo que NO sirven para
                          // detectar la moneda real del extracto. Usamos `monedaDetectada`,
                          // que el lector calcula a partir de los datos OCR.
                          const simMoneda: "uvr" | "pesos" = input.moneda === "uvr" ? "uvr" : "pesos";
                          const detectada = d.monedaDetectada;
                          const mismatch = !!detectada && detectada !== simMoneda;
                          if (mismatch && detectada) {
                            const tipoExtracto = detectada === "uvr" ? "UVR" : "Pesos";
                            const tipoSim = simMoneda === "uvr" ? "UVR" : "Pesos";
                            const continuar = await monedaAlerta.confirm({
                              detectada,
                              simulador: simMoneda,
                            });
                            if (!continuar) {
                              toast.error(
                                `Carga cancelada: el extracto está en ${tipoExtracto} y el simulador en ${tipoSim}.`,
                                { duration: 6000 },
                              );
                              return;
                            }
                            toast.warning(
                              `Simulador cambiado a ${tipoExtracto} para coincidir con el extracto.`,
                            );
                          }
                          setInput((p) => {
                            const next = { ...p };
                            const num = (s?: string) => {
                              if (!s) return 0;
                              const n = parseFloat(
                                String(s)
                                  .replace(/[^\d.,-]/g, "")
                                  .replace(/\.(?=\d{3}(\D|$))/g, "")
                                  .replace(",", "."),
                              );
                              return Number.isFinite(n) ? n : 0;
                            };
                            if (d.cliente?.nombre) next.clienteNombre = d.cliente.nombre;
                            if (d.cliente?.banco) next.banco = d.cliente.banco;
                            if (d.cliente?.cedula) next.cedula = d.cliente.cedula;
                            if (d.cliente?.numeroCredito) next.numeroCredito = d.cliente.numeroCredito;
                            if (d.cliente?.plazoInicial) next.cuotasTotales = num(d.cliente.plazoInicial);
                            if (d.cliente?.cuotasPagadas) {
                              next.cuotasPagadas = num(d.cliente.cuotasPagadas);
                              if (next.cuotasTotales)
                                next.cuotasPendientes = Math.max(0, next.cuotasTotales - next.cuotasPagadas);
                            }
                            if (d.pesos) {
                              next.moneda = "pesos";
                              if (d.pesos.saldoCapital) next.saldoCapital = num(d.pesos.saldoCapital);
                              if (d.pesos.cuotaActual) next.cuotaActual = num(d.pesos.cuotaActual);
                              if (d.pesos.seguros) next.seguroVida = num(d.pesos.seguros);
                              if (d.pesos.tea) next.teaPct = num(d.pesos.tea);
                              if (d.pesos.valorDesembolsado) next.valorDesembolsado = num(d.pesos.valorDesembolsado);
                            }
                            if (d.uvr) {
                              next.moneda = "uvr";
                              if (d.uvr.saldoPesos) next.saldoCapital = num(d.uvr.saldoPesos);
                              if (d.uvr.cuotaActualPesos) next.cuotaActual = num(d.uvr.cuotaActualPesos);
                              if (d.uvr.seguros) next.seguroVida = num(d.uvr.seguros);
                              if (d.uvr.teaCobrada) next.teaPct = num(d.uvr.teaCobrada);
                              if (d.uvr.valorDesembolsado) next.valorDesembolsado = num(d.uvr.valorDesembolsado);
                              if (d.uvr.valorUVR) next.uvrValor = num(d.uvr.valorUVR);
                              if (d.uvr.saldoUVR) next.saldoUvr = num(d.uvr.saldoUVR);
                            }
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}
                </section>
              </div>

              {/* ─── COLUMNA DERECHA: Escenarios, Comparador, Gráficas, Informe, Amortización ─── */}
              <div className="space-y-6">
                {/* Escenarios */}
                <Surface
                  id="sec-escenarios"
                  title="Estrategias financieras"
                  subtitle="Cada escenario es una hipótesis. Selecciona la que quieres comparar contra el crédito actual."
                >
                  <div className="mb-5 flex flex-wrap items-center gap-1.5">
                    {escenarios.map((e) => {
                      const isActive = e.id === selectedId;
                      const isActual = e.tipo === "actual";
                      return (
                        <button
                          key={e.id}
                          onClick={() => setSelectedId(e.id)}
                          className={`group relative inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12.5px] font-medium transition ${
                            isActive ? "text-white" : "text-white/55 hover:text-white"
                          }`}
                          style={{
                            background: isActive
                              ? "linear-gradient(135deg, rgba(68,93,163,0.30), rgba(132,185,143,0.18))"
                              : "rgba(255,255,255,0.025)",
                            border: `1px solid ${
                              isActive ? "rgba(132,185,143,0.35)" : "rgba(255,255,255,0.05)"
                            }`,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{
                              background: isActual ? "#C0392B" : "#84B98F",
                            }}
                          />
                          {e.nombre}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => addEscenario("personalizado")}
                      className="inline-flex items-center gap-1 rounded-xl border border-dashed border-white/15 px-3.5 py-2 text-[12.5px] font-medium text-white/55 transition hover:border-[#84B98F]/40 hover:text-[#A8D1B0]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Nuevo escenario
                    </button>
                  </div>

                  {selected.esc.tipo !== "actual" && (
                    <div
                      className="grid gap-4 rounded-2xl p-5 md:grid-cols-4"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
                        border: "1px solid rgba(255,255,255,0.04)",
                      }}
                    >
                      <Field
                        label="Aporte mensual extra"
                        value={selected.esc.aporteMensualExtra || ""}
                        onChange={(v) =>
                          updateEscenario(selected.id, { aporteMensualExtra: parseCurrency(v) })
                        }
                      />
                      <Field
                        label="Abono extraordinario"
                        value={selected.esc.abonoExtraordinario || ""}
                        onChange={(v) =>
                          updateEscenario(selected.id, { abonoExtraordinario: parseCurrency(v) })
                        }
                      />
                      <Field
                        label="Nueva tasa % (opcional)"
                        value={selected.esc.nuevaTasa || ""}
                        onChange={(v) => updateEscenario(selected.id, { nuevaTasa: parseDecimal(v) })}
                      />
                      <div className="flex items-end">
                        <button
                          onClick={() => removeEscenario(selected.id)}
                          disabled={escenarios.length <= 2}
                          className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[12px] font-medium text-white/65 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          Eliminar escenario
                        </button>
                      </div>
                      <div className="md:col-span-4">
                        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                          Motor NUVEX · aporte rápido
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {presetExtras.map((v) => (
                            <button
                              key={v}
                              onClick={() => updateEscenario(selected.id, { aporteMensualExtra: v })}
                              className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold text-[#A8D1B0] transition hover:scale-[1.03]"
                              style={{
                                background: "rgba(132,185,143,0.10)",
                                border: "1px solid rgba(132,185,143,0.25)",
                              }}
                            >
                              +{formatCOP(v)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </Surface>

                {/* Comparador */}
                <Surface
                  id="sec-comparador"
                  title="Comparador institucional"
                  subtitle="Crédito actual frente al escenario seleccionado"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="text-left text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                          <th className="pb-3">Métrica</th>
                          <th className="pb-3">Actual</th>
                          <th className="pb-3">{selected.esc.nombre}</th>
                          <th className="pb-3 text-right">Diferencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ["Cuota mensual", input.cuotaActual, input.cuotaActual + selected.esc.aporteMensualExtra],
                          ["Meses restantes", resActual.res.mesesRestantes, selected.res.mesesRestantes, "int"],
                          ["Total intereses", resActual.res.totalIntereses, selected.res.totalIntereses],
                          ["Total seguros", resActual.res.totalSeguros, selected.res.totalSeguros],
                          ["Costo total", resActual.res.totalPagado, selected.res.totalPagado],
                        ].map(([label, a, b, mode], idx) => {
                          const diff = (b as number) - (a as number);
                          const isInt = mode === "int";
                          return (
                            <tr
                              key={label as string}
                              className="border-t border-white/[0.04]"
                              style={idx % 2 === 1 ? { background: "rgba(255,255,255,0.012)" } : undefined}
                            >
                              <td className="py-3 font-medium text-white/85">{label}</td>
                              <td className="py-3 text-white/65">{isInt ? a : formatCOP(a as number)}</td>
                              <td className="py-3 font-semibold text-white">
                                {isInt ? b : formatCOP(b as number)}
                              </td>
                              <td
                                className={`py-3 text-right font-semibold ${
                                  diff < 0
                                    ? "text-[#A8D1B0]"
                                    : diff > 0
                                      ? "text-[#E89B8E]"
                                      : "text-white/30"
                                }`}
                              >
                                {isInt
                                  ? diff
                                  : (diff >= 0 ? "+" : "−") + formatCOP(Math.abs(diff))}
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t border-white/[0.04]">
                          <td className="py-3 font-medium text-white/85">Fecha terminación</td>
                          <td className="py-3 text-white/65">{fmtFecha(resActual.res.fechaFinalizacion)}</td>
                          <td className="py-3 font-semibold text-white">
                            {fmtFecha(selected.res.fechaFinalizacion)}
                          </td>
                          <td className="py-3 text-right font-semibold text-[#A8D1B0]">
                            {kpis.mesesEliminados} meses antes
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Surface>
              </div>
            </div>

            {/* ─── ZONA FULL-WIDTH: gráficas, informe y amortización ─── */}
            <div className="mt-6 space-y-6">
              {/* Gráficas */}
              <div id="sec-graficas" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  <Surface title="Capital vs Interés" subtitle="Composición mes a mes">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <AreaChart data={chartCapitalInteres} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={NUVEX.azul} stopOpacity={0.6} />
                              <stop offset="100%" stopColor={NUVEX.azul} stopOpacity={0.05} />
                            </linearGradient>
                            <linearGradient id="gradInt" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={NUVEX.rojo} stopOpacity={0.5} />
                              <stop offset="100%" stopColor={NUVEX.rojo} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`}
                          />
                          <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                          <Area type="monotone" dataKey="Capital" stackId="1" stroke={NUVEX.azul} strokeWidth={2} fill="url(#gradCap)" />
                          <Area type="monotone" dataKey="Interés" stackId="1" stroke={NUVEX.rojo} strokeWidth={2} fill="url(#gradInt)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>

                  <Surface title="Tiempo restante" subtitle="Meses para finalizar el crédito">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <BarChart data={tiempoChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="tipo" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis tick={axisTick} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                          <Bar dataKey="Meses" radius={[10, 10, 0, 0]} barSize={70}>
                            <Cell fill={NUVEX.rojo} fillOpacity={0.85} />
                            <Cell fill={NUVEX.verde} fillOpacity={0.95} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>

                  <Surface title="Composición de cuota" subtitle="Primer mes proyectado">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={composicion}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={110}
                            innerRadius={70}
                            stroke="rgba(0,0,0,0)"
                            label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}
                          >
                            {composicion.map((c, i) => (
                              <Cell key={i} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>

                  <Surface title="Saldo pendiente" subtitle="Actual vs optimizado">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <LineChart data={chartSaldo} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                          />
                          <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                          <Line type="monotone" dataKey="Saldo actual" stroke={NUVEX.rojo} strokeWidth={2.5} dot={false} />
                          <Line type="monotone" dataKey="Saldo optimizado" stroke={NUVEX.verde} strokeWidth={2.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>

                  <Surface title="Ahorro acumulado" subtitle="Valor neto evitado en el tiempo">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <AreaChart data={chartAhorro} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="gradAhorro" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={NUVEX.verde} stopOpacity={0.55} />
                              <stop offset="100%" stopColor={NUVEX.verde} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="mes" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                          />
                          <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                          <Area type="monotone" dataKey="Ahorro" stroke={NUVEX.verde} strokeWidth={2.5} fill="url(#gradAhorro)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>

                  <Surface title="Costo de no actuar" subtitle="Comparativa de costo total">
                    <div className="h-[320px]">
                      <ResponsiveContainer>
                        <BarChart data={costoNoActuarChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} vertical={false} />
                          <XAxis dataKey="tipo" tick={axisTick} axisLine={false} tickLine={false} />
                          <YAxis
                            tick={axisTick}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
                          />
                          <Tooltip formatter={(v: number) => formatCOP(v)} contentStyle={tooltipStyle} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} wrapperStyle={{ outline: "none" }} />
                          <Bar dataKey="Total" radius={[10, 10, 0, 0]} barSize={70}>
                            <Cell fill={NUVEX.rojo} fillOpacity={0.9} />
                            <Cell fill={NUVEX.verde} fillOpacity={0.95} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Surface>
                </div>

                {/* Informe ejecutivo · banca privada */}
                <section
                  id="sec-informes"
                  className="relative overflow-hidden rounded-3xl"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(36,36,36,0.7), rgba(16,16,16,0.7))",
                    border: "1px solid rgba(132,185,143,0.18)",
                    boxShadow:
                      "0 1px 0 rgba(255,255,255,0.05) inset, 0 40px 80px -30px rgba(0,0,0,0.85)",
                  }}
                >
                  <div
                    className="pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full blur-3xl"
                    style={{ background: "radial-gradient(circle, rgba(132,185,143,0.20), transparent 70%)" }}
                  />
                  <div className="relative p-7 md:p-9">
                    <div className="mb-6 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#A8D1B0]">
                          NUVEX · Informe Ejecutivo
                        </div>
                        <h2 className="mt-2 text-[22px] font-semibold tracking-tight text-white">
                          Resumen para el cliente
                        </h2>
                        <p className="mt-1 text-[12.5px] text-white/45">
                          Documento listo para presentar en mesa de banca privada
                        </p>
                      </div>
                      <div
                        className="hidden h-12 w-12 items-center justify-center rounded-2xl md:flex"
                        style={{
                          background: "linear-gradient(135deg, #445DA3, #84B98F)",
                          boxShadow: "0 12px 28px -10px rgba(132,185,143,0.6)",
                        }}
                      >
                        <FileText className="h-5 w-5 text-white" />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        { k: "Cliente", v: input.clienteNombre || "—" },
                        { k: "Banco", v: input.banco || "—" },
                        {
                          k: "Producto",
                          v: `${input.tipoProducto === "hipotecario" ? "Hipotecario" : "Leasing Habitacional"} · ${input.moneda.toUpperCase()}`,
                        },
                        { k: "Estrategia", v: selected.esc.nombre },
                      ].map((r) => (
                        <div
                          key={r.k}
                          className="rounded-2xl p-4"
                          style={{
                            background: "rgba(255,255,255,0.025)",
                            border: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
                            {r.k}
                          </div>
                          <div className="mt-1.5 text-[14px] font-semibold text-white">{r.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="my-6 h-px w-full bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                    <div className="grid gap-3 md:grid-cols-4">
                      {[
                        { k: "Años eliminados", v: `${kpis.aniosEliminados}`, hint: `${kpis.mesesEliminados} meses` },
                        { k: "Intereses evitados", v: formatCOP(kpis.interesesEvitados) },
                        { k: "Seguros evitados", v: formatCOP(kpis.segurosEvitados) },
                        { k: "Costo de no actuar", v: formatCOP(kpis.costoNoActuar), warn: true },
                      ].map((r) => (
                        <div
                          key={r.k}
                          className="rounded-2xl p-4"
                          style={{
                            background: r.warn
                              ? "linear-gradient(135deg, rgba(192,57,43,0.18), rgba(224,145,58,0.08))"
                              : "rgba(255,255,255,0.025)",
                            border: r.warn
                              ? "1px solid rgba(192,57,43,0.25)"
                              : "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/50">
                            {r.k}
                          </div>
                          <div className={`mt-1.5 text-[18px] font-semibold ${r.warn ? "text-white" : "text-white"}`}>
                            {r.v}
                          </div>
                          {r.hint && <div className="mt-0.5 text-[11px] text-white/40">{r.hint}</div>}
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-6 rounded-2xl p-5"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.10))",
                        border: "1px solid rgba(132,185,143,0.22)",
                      }}
                    >
                      <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A8D1B0]">
                        Recomendación NUVEX
                      </div>
                      <p className="mt-2 text-[14px] leading-relaxed text-white/85">
                        Con un aporte adicional de{" "}
                        <strong className="text-white">{formatCOP(selected.esc.aporteMensualExtra)}</strong>{" "}
                        mensuales
                        {selected.esc.abonoExtraordinario > 0 && (
                          <>
                            {" "}y un abono extraordinario de{" "}
                            <strong className="text-white">
                              {formatCOP(selected.esc.abonoExtraordinario)}
                            </strong>
                          </>
                        )}
                        , el cliente cerraría su crédito el{" "}
                        <strong className="text-white">{fmtFecha(selected.res.fechaFinalizacion)}</strong>{" "}
                        en lugar del{" "}
                        <strong className="text-white">{fmtFecha(resActual.res.fechaFinalizacion)}</strong>,
                        con un ROI proyectado del{" "}
                        <strong className="text-[#A8D1B0]">
                          {(kpis.roiCliente * 100).toFixed(0)}%
                        </strong>{" "}
                        sobre el aporte total.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Amortización */}
                <Surface
                  id="sec-amortizacion"
                  title="Tabla de amortización"
                  subtitle={`${selected.res.cuotas.length} cuotas · ${selected.esc.nombre}`}
                >
                  <div
                    className="max-h-[480px] overflow-auto rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.012)",
                      border: "1px solid rgba(255,255,255,0.04)",
                    }}
                  >
                    <table className="w-full text-[12px]">
                      <thead
                        className="sticky top-0 z-10 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-white/45"
                        style={{
                          background:
                            "linear-gradient(180deg, rgba(20,20,20,0.95), rgba(20,20,20,0.85))",
                          backdropFilter: "blur(10px)",
                        }}
                      >
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3 text-right">Cuota</th>
                          <th className="px-4 py-3 text-right">Capital</th>
                          <th className="px-4 py-3 text-right">Interés</th>
                          <th className="px-4 py-3 text-right">Seguros</th>
                          <th className="px-4 py-3 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.res.cuotas.map((c, i) => (
                          <tr
                            key={c.numero}
                            className="border-t border-white/[0.03] transition hover:bg-white/[0.025]"
                            style={i % 2 === 1 ? { background: "rgba(255,255,255,0.008)" } : undefined}
                          >
                            <td className="px-4 py-2.5 font-mono text-white/55">{c.numero}</td>
                            <td className="px-4 py-2.5 text-white/70">{fmtFecha(c.fecha)}</td>
                            <td className="px-4 py-2.5 text-right text-white">
                              {formatCOP(c.cuotaConExtra)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-[#A8D1B0]">{formatCOP(c.capital)}</td>
                            <td className="px-4 py-2.5 text-right text-[#E89B8E]">{formatCOP(c.interes)}</td>
                            <td className="px-4 py-2.5 text-right text-white/55">{formatCOP(c.seguros)}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-white">
                              {formatCOP(c.saldoFinal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Surface>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-6 py-8 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                Paso final
              </div>
              <h3 className="text-lg font-semibold text-white">
                Convierte esta simulación en expediente
              </h3>
              <p className="max-w-xl text-[13px] text-white/60">
                Crea el caso con un clic. Inmediatamente después podrás enviarlo a auditoría QA sin salir de esta pantalla.
              </p>
              <button
                onClick={openGuardarCaso}
                className="mt-2 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #445DA3, #84B98F)",
                  boxShadow: "0 14px 30px -12px rgba(68,93,163,0.65)",
                }}
              >
                <Save className="h-4 w-4" />
                Crear expediente y enviar a auditoría
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-white/30">
              <Sparkles className="h-3.5 w-3.5" />
              NUVEX Wealth Studio · Proyecciones referenciales basadas en los datos ingresados
            </div>
          </div>
        </main>
      </div>
      <GuardarCasoModal
        open={guardarOpen}
        onClose={() => {
          setGuardarOpen(false);
          setGuardarAutoSave(false);
        }}
        autoSave={guardarAutoSave}
        input={input}
        resultados={{ actual: resActual.res, optimizado: selected.res }}
        escenarios={escenarios}
        kpis={kpis}
      />
      {monedaAlerta.dialog}
    </div>
  );
}
