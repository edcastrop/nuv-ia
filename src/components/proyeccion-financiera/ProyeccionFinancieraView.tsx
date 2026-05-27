import { useMemo, useState } from "react";
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
import {
  Calculator,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  PieChart as PieIcon,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Upload,
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


const NUVEX = { azul: "#445DA3", verde: "#84B98F", oscuro: "#242424", ambar: "#E0913A", rojo: "#C0392B" };

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

function fmtFecha(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "short" });
}

// ──────────────────────────────────────────────────────────────────────────
// Inputs
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
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">{label}</span>
      <input
        type={type}
        value={value as string}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
      />
    </label>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E3E7EE] bg-white p-5 shadow-[0_1px_2px_rgba(36,36,36,0.04)]">
      <header className="mb-4">
        <h2 className="text-base font-bold text-[#242424]">{title}</h2>
        {subtitle && <p className="text-xs text-[#242424]/60">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone = "default",
  Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "hero" | "good" | "warn";
  Icon?: React.ComponentType<{ className?: string }>;
}) {
  const styles = {
    default: "bg-white border-[#E3E7EE] text-[#242424]",
    hero: "bg-gradient-to-br from-[#C0392B] to-[#E0913A] text-white border-transparent",
    good: "bg-[#84B98F]/12 border-[#84B98F]/40 text-[#1F7A45]",
    warn: "bg-[#E0913A]/10 border-[#E0913A]/40 text-[#7a4a16]",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 shadow-[0_1px_2px_rgba(36,36,36,0.04)] ${styles}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-80">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold leading-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] opacity-80">{hint}</div>}
    </div>
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


  const upd = <K extends keyof ProyeccionFinancieraInput>(k: K, v: ProyeccionFinancieraInput[K]) =>
    setInput((p) => ({ ...p, [k]: v }));

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
    () => compararEscenarios(resActual.res, selected.res, selected.esc.aporteMensualExtra, selected.esc.abonoExtraordinario),
    [resActual, selected],
  );

  const segurosMes = totalSegurosMensual(input);

  const addEscenario = (preset?: TipoEscenario) => {
    const base: EscenarioState = {
      id: crypto.randomUUID(),
      nombre:
        preset === "conservador" ? "Conservador" :
        preset === "agresivo" ? "Agresivo" :
        preset === "nuvex" ? "Optimizado NUVEX" :
        "Personalizado",
      tipo: preset ?? "personalizado",
      aporteMensualExtra:
        preset === "conservador" ? 100000 :
        preset === "agresivo" ? 500000 :
        preset === "nuvex" ? 300000 : 0,
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
    .map((c) => ({ mes: c.numero, "Saldo actual": Math.round(resActual.res.cuotas[c.numero - 1]?.saldoFinal ?? 0), "Saldo optimizado": Math.round(c.saldoFinal) }));

  let acumAhorro = 0;
  const chartAhorro = selected.res.cuotas.map((c, i) => {
    const refInteres = resActual.res.cuotas[i]?.interes ?? 0;
    const refSeguros = resActual.res.cuotas[i]?.seguros ?? 0;
    acumAhorro += Math.max(0, refInteres - c.interes) + Math.max(0, refSeguros - c.seguros);
    return { mes: c.numero, Ahorro: Math.round(acumAhorro) };
  }).filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 60)) === 0);

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

  return (
    <div className="min-h-screen bg-[#F5F7FB]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#445DA3]">
              <Sparkles className="h-3.5 w-3.5" /> NUVEX · Proyección Financiera
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#242424] lg:text-3xl">
              Modela, compara y demuestra el ahorro real
            </h1>
            <p className="mt-1 text-sm text-[#242424]/60">
              Hipotecario y leasing habitacional · Pesos y UVR · Escenarios ilimitados
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setInput(blankInput)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm font-medium text-[#242424] hover:bg-[#F5F7FB]"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Limpiar
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#445DA3] px-3 py-2 text-sm font-semibold text-white hover:bg-[#37508f]"
            >
              <Download className="h-3.5 w-3.5" /> Exportar tabla
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi tone="hero" label="Costo de no actuar" Icon={TrendingDown} value={formatCOP(kpis.costoNoActuar)} hint="Dinero de más si no optimiza" />
          <Kpi tone="good" label="Ahorro total" Icon={TrendingUp} value={formatCOP(kpis.ahorroTotal)} />
          <Kpi label="Años eliminados" value={`${kpis.aniosEliminados}`} hint={`${kpis.mesesEliminados} meses`} />
          <Kpi label="Intereses evitados" value={formatCOP(kpis.interesesEvitados)} />
          <Kpi label="Seguros evitados" value={formatCOP(kpis.segurosEvitados)} />
          <Kpi tone="warn" label="ROI cliente" value={`${(kpis.roiCliente * 100).toFixed(0)}%`} hint={`Aporte: ${formatCOP(kpis.inversionExtra)}`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          {/* Sidebar — Form */}
          <div className="space-y-4">
            <Section title="Información general">
              <div className="grid gap-3">
                <Field label="Cliente" value={input.clienteNombre} onChange={(v) => upd("clienteNombre", v)} placeholder="Nombre del cliente" />
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">Banco</span>
                  <select
                    value={input.banco}
                    onChange={(e) => upd("banco", e.target.value)}
                    className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
                  >
                    <option value="">Seleccione un banco…</option>
                    {[
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
                    ].map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">Producto</span>
                    <select
                      value={input.tipoProducto}
                      onChange={(e) => upd("tipoProducto", e.target.value as never)}
                      className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm"
                    >
                      <option value="hipotecario">Hipotecario</option>
                      <option value="leasing">Leasing habitacional</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">Moneda</span>
                    <select
                      value={input.moneda}
                      onChange={(e) => upd("moneda", e.target.value as never)}
                      className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm"
                    >
                      <option value="pesos">Pesos</option>
                      <option value="uvr">UVR</option>
                    </select>
                  </label>
                </div>
                <Field label="Fecha de desembolso" type="date" value={input.fechaDesembolso} onChange={(v) => upd("fechaDesembolso", v)} />
              </div>
            </Section>

            <Section title="Datos del crédito">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valor desembolsado" value={input.valorDesembolsado || ""} onChange={updNum("valorDesembolsado")} placeholder="220.000.000" />
                <Field label="Saldo a capital" value={input.saldoCapital || ""} onChange={updNum("saldoCapital")} placeholder="180.000.000" />
                <Field label="Cuota actual" value={input.cuotaActual || ""} onChange={updNum("cuotaActual")} placeholder="2.450.000" />
                <Field label="TEA %" value={input.teaPct || ""} onChange={updDec("teaPct")} placeholder="13,5" />
                <Field label="Cuotas totales" value={input.cuotasTotales || ""} onChange={updInt("cuotasTotales")} placeholder="240" />
                <Field label="Cuotas pagadas" value={input.cuotasPagadas || ""} onChange={updInt("cuotasPagadas")} placeholder="36" />
                <Field label="Cuotas pendientes" value={input.cuotasPendientes || ""} onChange={updInt("cuotasPendientes")} placeholder="204" />
              </div>
            </Section>

            <Section title="Seguros mensuales" subtitle={`Total mensual: ${formatCOP(segurosMes)} · Anual: ${formatCOP(segurosMes * 12)}`}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vida" value={input.seguroVida || ""} onChange={updNum("seguroVida")} />
                <Field label="Incendio" value={input.seguroIncendio || ""} onChange={updNum("seguroIncendio")} />
                <Field label="Terremoto" value={input.seguroTerremoto || ""} onChange={updNum("seguroTerremoto")} />
                <Field label="Otros" value={input.otrosSeguros || ""} onChange={updNum("otrosSeguros")} />
              </div>
              {input.cuotaActual > 0 && segurosMes > 0 && (
                <p className="mt-2 text-[11px] text-[#242424]/60">
                  Seguros representan {((segurosMes / input.cuotaActual) * 100).toFixed(1)}% de la cuota
                </p>
              )}
            </Section>

            {input.moneda === "uvr" && (
              <Section title="Datos UVR">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Valor UVR" value={input.uvrValor || ""} onChange={updDec("uvrValor")} placeholder="380,12" />
                  <Field label="Saldo UVR" value={input.saldoUvr || ""} onChange={updDec("saldoUvr")} placeholder="220.000,00" />
                  <Field label="Variación UVR anual %" value={input.variacionUvrPct || ""} onChange={updDec("variacionUvrPct")} placeholder="6" />
                </div>
              </Section>
            )}

            <Section title="Lector IA de extractos" subtitle="Sube PDF o imagen — la IA prellena los campos automáticamente">
              <ExtractoReader
                modo={input.moneda === "uvr" ? "uvr" : "pesos"}
                onApply={(d: ExtractoApplyPayload) => {
                  setInput((p) => {
                    const next = { ...p };
                    const num = (s?: string) => {
                      if (!s) return 0;
                      const n = parseFloat(String(s).replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
                      return Number.isFinite(n) ? n : 0;
                    };
                    if (d.cliente?.nombre) next.clienteNombre = d.cliente.nombre;
                    if (d.cliente?.banco) next.banco = d.cliente.banco;
                    if (d.cliente?.plazoInicial) next.cuotasTotales = num(d.cliente.plazoInicial);
                    if (d.cliente?.cuotasPagadas) {
                      next.cuotasPagadas = num(d.cliente.cuotasPagadas);
                      if (next.cuotasTotales) next.cuotasPendientes = Math.max(0, next.cuotasTotales - next.cuotasPagadas);
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
            </Section>
          </div>

          {/* Main column */}
          <div className="space-y-4">
            {/* Escenarios */}
            <Section title="Escenarios" subtitle="Compara el crédito actual contra cualquier optimización">
              <div className="mb-3 flex flex-wrap gap-2">
                {escenarios.map((e) => {
                  const isActive = e.id === selectedId;
                  return (
                    <button
                      key={e.id}
                      onClick={() => setSelectedId(e.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-[#445DA3] bg-[#445DA3] text-white"
                          : "border-[#E3E7EE] bg-white text-[#242424] hover:border-[#445DA3]/40"
                      }`}
                    >
                      {e.nombre}
                    </button>
                  );
                })}
                <button
                  onClick={() => addEscenario("personalizado")}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#445DA3]/40 px-3 py-1.5 text-xs font-semibold text-[#445DA3] hover:bg-[#445DA3]/5"
                >
                  <Plus className="h-3 w-3" /> Nuevo escenario
                </button>
              </div>

              {selected.esc.tipo !== "actual" && (
                <div className="grid gap-3 rounded-xl border border-[#E3E7EE] bg-[#F5F7FB] p-3 md:grid-cols-4">
                  <Field
                    label="Aporte mensual extra"
                    value={selected.esc.aporteMensualExtra || ""}
                    onChange={(v) => updateEscenario(selected.id, { aporteMensualExtra: parseCurrency(v) })}
                  />
                  <Field
                    label="Abono extraordinario"
                    value={selected.esc.abonoExtraordinario || ""}
                    onChange={(v) => updateEscenario(selected.id, { abonoExtraordinario: parseCurrency(v) })}
                  />
                  <Field
                    label="Nueva tasa % (opcional)"
                    value={selected.esc.nuevaTasa || ""}
                    onChange={(v) => updateEscenario(selected.id, { nuevaTasa: parseDecimal(v) })}
                  />
                  <div className="flex items-end gap-2">
                    <button
                      onClick={() => removeEscenario(selected.id)}
                      disabled={escenarios.length <= 2}
                      className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-xs font-medium text-[#242424] disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                  <div className="md:col-span-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60">Motor NUVEX · aporte rápido</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {presetExtras.map((v) => (
                        <button
                          key={v}
                          onClick={() => updateEscenario(selected.id, { aporteMensualExtra: v })}
                          className="rounded-full border border-[#84B98F]/40 bg-[#84B98F]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1F7A45] hover:bg-[#84B98F]/20"
                        >
                          +{formatCOP(v)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* Comparador */}
            <Section title="Comparador" subtitle="Crédito actual vs escenario seleccionado">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-[#242424]/60">
                      <th className="py-2">Métrica</th>
                      <th className="py-2">Actual</th>
                      <th className="py-2">{selected.esc.nombre}</th>
                      <th className="py-2 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {[
                      ["Cuota mensual", input.cuotaActual, input.cuotaActual + selected.esc.aporteMensualExtra],
                      ["Meses restantes", resActual.res.mesesRestantes, selected.res.mesesRestantes, "int"],
                      ["Total intereses", resActual.res.totalIntereses, selected.res.totalIntereses],
                      ["Total seguros", resActual.res.totalSeguros, selected.res.totalSeguros],
                      ["Costo total", resActual.res.totalPagado, selected.res.totalPagado],
                    ].map(([label, a, b, mode]) => {
                      const diff = (b as number) - (a as number);
                      const isInt = mode === "int";
                      return (
                        <tr key={label as string}>
                          <td className="py-2 font-medium text-[#242424]">{label}</td>
                          <td className="py-2">{isInt ? a : formatCOP(a as number)}</td>
                          <td className="py-2 font-semibold">{isInt ? b : formatCOP(b as number)}</td>
                          <td className={`py-2 text-right font-semibold ${diff < 0 ? "text-[#1F7A45]" : diff > 0 ? "text-[#C0392B]" : "text-[#242424]/50"}`}>
                            {isInt ? diff : (diff >= 0 ? "+" : "−") + formatCOP(Math.abs(diff))}
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="py-2 font-medium text-[#242424]">Fecha terminación</td>
                      <td className="py-2">{fmtFecha(resActual.res.fechaFinalizacion)}</td>
                      <td className="py-2 font-semibold">{fmtFecha(selected.res.fechaFinalizacion)}</td>
                      <td className="py-2 text-right font-semibold text-[#1F7A45]">{kpis.mesesEliminados} meses antes</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Gráficas */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Capital vs Interés (mes a mes)">
                <div className="h-60">
                  <ResponsiveContainer>
                    <AreaChart data={chartCapitalInteres}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                      <Tooltip formatter={(v: number) => formatCOP(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="Capital" stackId="1" stroke={NUVEX.azul} fill={NUVEX.azul} fillOpacity={0.85} />
                      <Area type="monotone" dataKey="Interés" stackId="1" stroke={NUVEX.rojo} fill={NUVEX.rojo} fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Tiempo restante">
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={tiempoChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="Meses" fill={NUVEX.azul} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Composición de cuota">
                <div className="h-60">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={composicion} dataKey="value" nameKey="name" outerRadius={80} label={({ name, percent }) => `${name} ${(percent! * 100).toFixed(0)}%`}>
                        {composicion.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCOP(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Saldo pendiente">
                <div className="h-60">
                  <ResponsiveContainer>
                    <LineChart data={chartSaldo}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => formatCOP(v)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Saldo actual" stroke={NUVEX.rojo} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="Saldo optimizado" stroke={NUVEX.verde} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Ahorro acumulado">
                <div className="h-60">
                  <ResponsiveContainer>
                    <AreaChart data={chartAhorro}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => formatCOP(v)} />
                      <Area type="monotone" dataKey="Ahorro" stroke={NUVEX.verde} fill={NUVEX.verde} fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Section>

              <Section title="Costo de no actuar">
                <div className="h-60">
                  <ResponsiveContainer>
                    <BarChart data={costoNoActuarChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E3E7EE" />
                      <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} />
                      <Tooltip formatter={(v: number) => formatCOP(v)} />
                      <Bar dataKey="Total" radius={[6, 6, 0, 0]}>
                        <Cell fill={NUVEX.rojo} />
                        <Cell fill={NUVEX.verde} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            </div>

            {/* Informe ejecutivo */}
            <Section title="Informe ejecutivo NUVEX" subtitle="Resumen listo para presentar al cliente">
              <div className="space-y-3 text-sm leading-relaxed text-[#242424]">
                <p>
                  <strong>Cliente:</strong> {input.clienteNombre || "—"} · <strong>Banco:</strong> {input.banco || "—"} ·{" "}
                  <strong>Producto:</strong> {input.tipoProducto === "hipotecario" ? "Hipotecario" : "Leasing habitacional"} ({input.moneda.toUpperCase()})
                </p>
                <p>
                  Con un aporte adicional de <strong>{formatCOP(selected.esc.aporteMensualExtra)}</strong> mensuales
                  {selected.esc.abonoExtraordinario > 0 && <> y un abono extraordinario de <strong>{formatCOP(selected.esc.abonoExtraordinario)}</strong></>},
                  el cliente eliminaría <strong>{kpis.aniosEliminados} años y {kpis.mesesEliminados % 12} meses</strong> de su crédito,
                  evitando <strong>{formatCOP(kpis.interesesEvitados)}</strong> en intereses
                  y <strong>{formatCOP(kpis.segurosEvitados)}</strong> en seguros.
                </p>
                <p>
                  <strong>Costo de no actuar:</strong> mantener el crédito como está implica pagar{" "}
                  <span className="font-bold text-[#C0392B]">{formatCOP(kpis.costoNoActuar)}</span> adicionales en intereses y seguros.
                </p>
                <p className="rounded-xl border-l-4 border-[#445DA3] bg-[#445DA3]/5 p-3 text-[13px]">
                  <strong>Recomendación NUVEX:</strong> aplicar la estrategia optimizada permite cerrar el crédito el{" "}
                  <strong>{fmtFecha(selected.res.fechaFinalizacion)}</strong> en lugar del{" "}
                  <strong>{fmtFecha(resActual.res.fechaFinalizacion)}</strong>, con un ROI estimado del{" "}
                  <strong>{(kpis.roiCliente * 100).toFixed(0)}%</strong> sobre el aporte total.
                </p>
              </div>
            </Section>

            {/* Tabla amortización */}
            <Section title="Tabla de amortización" subtitle={`${selected.res.cuotas.length} cuotas · ${selected.esc.nombre}`}>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-[#E3E7EE]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#F5F7FB] text-left text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2 text-right">Cuota</th>
                      <th className="px-3 py-2 text-right">Capital</th>
                      <th className="px-3 py-2 text-right">Interés</th>
                      <th className="px-3 py-2 text-right">Seguros</th>
                      <th className="px-3 py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3E7EE]">
                    {selected.res.cuotas.map((c) => (
                      <tr key={c.numero} className="hover:bg-[#F5F7FB]">
                        <td className="px-3 py-1.5 font-mono">{c.numero}</td>
                        <td className="px-3 py-1.5">{fmtFecha(c.fecha)}</td>
                        <td className="px-3 py-1.5 text-right">{formatCOP(c.cuotaConExtra)}</td>
                        <td className="px-3 py-1.5 text-right text-[#1F7A45]">{formatCOP(c.capital)}</td>
                        <td className="px-3 py-1.5 text-right text-[#C0392B]">{formatCOP(c.interes)}</td>
                        <td className="px-3 py-1.5 text-right">{formatCOP(c.seguros)}</td>
                        <td className="px-3 py-1.5 text-right font-medium">{formatCOP(c.saldoFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>

        <div className="mt-8 text-center text-[11px] text-[#242424]/40">
          <PieIcon className="mx-auto mb-1 h-4 w-4" />
          NUVEX · Proyección Financiera · Las proyecciones son referenciales y dependen de los datos ingresados.
        </div>
      </div>
    </div>
  );
}
