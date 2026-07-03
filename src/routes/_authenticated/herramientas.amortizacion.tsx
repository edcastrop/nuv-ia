import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import {
  Calculator,
  Sparkles,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  RotateCcw,
  DollarSign,
  Percent,
  Calendar,
  ShieldCheck,
  Target,
  Zap,
  Scale,
  HelpCircle,
  Clock,
  Layers,
  Landmark,
  Coins,
  ChevronDown,
  Save,
  Search,
  Wand2,
  Trash2,
  Download,
  X,
} from "lucide-react";
import { ExtractoReader, type ExtractoApplyPayload } from "@/components/nuvex/ExtractoReader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/herramientas/amortizacion")({
  head: () => ({
    meta: [
      { title: "NUVIA Amortization Engine" },
      {
        name: "description",
        content:
          "Motor de amortización inteligente para analizar la composición exacta de cualquier cuota en créditos en pesos o UVR.",
      },
    ],
  }),
  component: AmortizationEngine,
});

// ============================================================================
// MATH
// ============================================================================

type Row = {
  periodo: number;
  saldoInicial: number;
  cuota: number;
  interes: number;
  interesBase: number;
  fresh: number;
  capital: number;
  seguros: number;
  totalCuota: number;
  saldoFinal: number;
};

const FRESH_MAX_CUOTAS = 84;

const tasaMensualFromTEA = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1;
const cuotaFija = (v: number, i: number, n: number) =>
  i === 0 ? v / n : (v * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);

function construirTabla(
  valor: number,
  tea: number,
  n: number,
  seguros: number,
  freshCOP: number = 0,
  freshCuotas: number = 0,
): Row[] {
  const i = tasaMensualFromTEA(tea);
  const cuota = cuotaFija(valor, i, n);
  const fCuotas = Math.min(Math.max(0, Math.floor(freshCuotas || 0)), FRESH_MAX_CUOTAS);
  const fCOP = Math.max(0, freshCOP || 0);
  const rows: Row[] = [];
  let saldo = valor;
  for (let p = 1; p <= n; p++) {
    const interesBase = saldo * i;
    let capital = cuota - interesBase;
    if (p === n) capital = saldo;
    const saldoFinal = Math.max(0, saldo - capital);
    const fresh = p <= fCuotas ? fCOP : 0;
    const interesTotal = interesBase + fresh;
    rows.push({
      periodo: p,
      saldoInicial: saldo,
      cuota,
      interes: interesTotal,
      interesBase,
      fresh,
      capital,
      seguros,
      totalCuota: cuota + seguros + fresh,
      saldoFinal,
    });
    saldo = saldoFinal;
  }
  return rows;
}

function construirTablaUVR(
  valorUVR: number,
  teaUVR: number,
  n: number,
  uvr0: number,
  varAnual: number,
  segurosCOP: number,
  freshCOP: number = 0,
  freshCuotas: number = 0,
): Row[] {
  const fCuotas = Math.min(Math.max(0, Math.floor(freshCuotas || 0)), FRESH_MAX_CUOTAS);
  const fCOP = Math.max(0, freshCOP || 0);
  return construirTabla(valorUVR, teaUVR, n, 0).map((r) => {
    const uvrT = uvr0 * Math.pow(1 + varAnual, (r.periodo - 1) / 12);
    const cuotaCOP = r.cuota * uvrT;
    const interesBaseCOP = r.interesBase * uvrT;
    const fresh = r.periodo <= fCuotas ? fCOP : 0;
    return {
      periodo: r.periodo,
      saldoInicial: r.saldoInicial * uvrT,
      cuota: cuotaCOP,
      interes: interesBaseCOP + fresh,
      interesBase: interesBaseCOP,
      fresh,
      capital: r.capital * uvrT,
      seguros: segurosCOP,
      totalCuota: cuotaCOP + segurosCOP + fresh,
      saldoFinal: r.saldoFinal * uvrT,
    };
  });
}


const findBreakEven = (rows: Row[]) => rows.find((r) => r.capital >= r.interes)?.periodo ?? null;

function generateInsight(rows: Row[], periodo: number): string {
  if (!rows.length) return "";
  const cur = rows[Math.min(periodo, rows.length) - 1];
  const be = findBreakEven(rows);
  const pctI = (cur.interes / cur.cuota) * 100;
  const pctSaldo = ((rows[0].saldoInicial - cur.saldoFinal) / rows[0].saldoInicial) * 100;
  const parts: string[] = [];
  parts.push(
    cur.interes > cur.capital
      ? `En la cuota ${cur.periodo} aún estás pagando más intereses (${pctI.toFixed(1)}% de la cuota) que capital.`
      : `A partir de la cuota ${cur.periodo} la amortización de capital (${(100 - pctI).toFixed(1)}%) ya supera a los intereses.`,
  );
  if (be) parts.push(cur.periodo < be ? `El punto de equilibrio capital/interés ocurre en la cuota ${be}.` : `Ya cruzaste el punto de equilibrio (cuota ${be}); tu saldo se reduce cada vez más rápido.`);
  parts.push(`Has amortizado el ${pctSaldo.toFixed(1)}% del capital original.`);
  return parts.join(" ");
}

const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v || 0);

// -------- Fecha por cuota (desembolso + n meses) ------
function fechaCuota(base: string, periodo: number): string {
  if (!base) return "—";
  const [y, m] = base.split("-").map(Number);
  if (!y || !m) return "—";
  const d = new Date(y, m - 1 + periodo, 1);
  const label = d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// -------- Convertidor de tasa (Tasa Fresh) ------
export type TasaTipo = "EA" | "MV" | "NMV" | "NAMV" | "NASV";
export const TASA_LABELS: Record<TasaTipo, string> = {
  EA: "Efectiva Anual",
  MV: "Mes Vencido",
  NMV: "Nominal Mensual Vencido",
  NAMV: "Nominal Anual Mes Vencido",
  NASV: "Nominal Anual Semestre Vencido",
};
export function tasaToEA(tasa: number, tipo: TasaTipo): number {
  const r = tasa / 100;
  switch (tipo) {
    case "EA": return r;
    case "MV": return Math.pow(1 + r, 12) - 1;
    case "NMV": return Math.pow(1 + r, 12) - 1;
    case "NAMV": return Math.pow(1 + r / 12, 12) - 1;
    case "NASV": return Math.pow(1 + r / 2, 2) - 1;
  }
}
export function eaToTasa(ea: number, tipo: TasaTipo): number {
  switch (tipo) {
    case "EA": return ea;
    case "MV": return Math.pow(1 + ea, 1 / 12) - 1;
    case "NMV": return Math.pow(1 + ea, 1 / 12) - 1;
    case "NAMV": return (Math.pow(1 + ea, 1 / 12) - 1) * 12;
    case "NASV": return (Math.pow(1 + ea, 1 / 2) - 1) * 2;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

function AmortizationEngine() {
  const [modo, setModo] = useState<"pesos" | "uvr">("pesos");
  const [tea, setTea] = useState("");
  const [plazo, setPlazo] = useState("");
  const [valor, setValor] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [seguros, setSeguros] = useState("");
  const [freshValor, setFreshValor] = useState("");
  const [freshCuotasStr, setFreshCuotasStr] = useState("");
  const [uvrInicial, setUvrInicial] = useState("");
  const [varUvr, setVarUvr] = useState("");
  const [fechaDesembolso, setFechaDesembolso] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [calculated, setCalculated] = useState(false);
  const [lastCalc, setLastCalc] = useState<Date | null>(null);
  const [showReader, setShowReader] = useState(false);
  const [showConverter, setShowConverter] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);

  // Tasa Fresh converter state
  const [freshTasa, setFreshTasa] = useState("");
  const [freshTipo, setFreshTipo] = useState<TasaTipo>("EA");

  // Escenarios guardados (localStorage)
  type Scenario = {
    id: string;
    nombre: string;
    ts: number;
    modo: "pesos" | "uvr";
    tea: string;
    plazo: string;
    valor: string;
    seguros: string;
    freshValor: string;
    freshCuotas: string;
    uvrInicial: string;
    varUvr: string;
    fechaDesembolso: string;
  };
  const SCEN_KEY = "nuvia_amort_scenarios";
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCEN_KEY);
      if (raw) setScenarios(JSON.parse(raw));
    } catch {}
  }, []);
  function persistScenarios(next: Scenario[]) {
    setScenarios(next);
    try { localStorage.setItem(SCEN_KEY, JSON.stringify(next)); } catch {}
  }

  // Importar caso modal
  const [importOpen, setImportOpen] = useState(false);
  const [importCodigo, setImportCodigo] = useState("");
  const [importLoading, setImportLoading] = useState(false);

  const teaNum = parseFloat(tea) / 100 || 0;
  const plazoNum = parseInt(plazo) || 0;
  const valorNum = parseFloat(valor) || 0;
  const periodoNum = parseInt(periodo) || 0;
  const segurosNum = parseFloat(seguros) || 0;
  const freshValorNum = parseFloat(freshValor) || 0;
  const freshCuotasNum = Math.min(parseInt(freshCuotasStr) || 0, FRESH_MAX_CUOTAS);
  const uvrInicialNum = parseFloat(uvrInicial) || 0;
  const varUvrNum = parseFloat(varUvr) / 100 || 0;
  const tasaMensual = teaNum > 0 ? tasaMensualFromTEA(teaNum) : 0;

  const rows = useMemo(() => {
    if (!calculated || teaNum <= 0 || plazoNum <= 0 || valorNum <= 0) return [];
    if (modo === "uvr") {
      if (uvrInicialNum <= 0) return [];
      return construirTablaUVR(valorNum, teaNum, plazoNum, uvrInicialNum, varUvrNum, segurosNum, freshValorNum, freshCuotasNum);
    }
    return construirTabla(valorNum, teaNum, plazoNum, segurosNum, freshValorNum, freshCuotasNum);
  }, [calculated, modo, teaNum, plazoNum, valorNum, segurosNum, uvrInicialNum, varUvrNum, freshValorNum, freshCuotasNum]);

  const currentRow = rows[Math.min(Math.max(periodoNum, 1), rows.length) - 1];
  const insight = useMemo(() => (rows.length ? generateInsight(rows, periodoNum) : ""), [rows, periodoNum]);
  const pctInteres = currentRow ? (currentRow.interes / currentRow.cuota) * 100 : 0;
  const pctCapital = currentRow ? (currentRow.capital / currentRow.cuota) * 100 : 0;

  // Punto de equilibrio
  const breakEven = useMemo(() => (rows.length ? findBreakEven(rows) : null), [rows]);
  const breakEvenFecha = breakEven ? fechaCuota(fechaDesembolso, breakEven) : "—";
  const breakEvenPct = breakEven && plazoNum > 0 ? (breakEven / plazoNum) * 100 : 0;

  // Tasa Fresh conversions
  const freshValid = parseFloat(freshTasa) > 0;
  const freshEA = freshValid ? tasaToEA(parseFloat(freshTasa), freshTipo) : 0;
  const conversions = useMemo(() => {
    const list: { tipo: TasaTipo; label: string; valor: number }[] = [];
    (["EA", "MV", "NMV", "NAMV", "NASV"] as TasaTipo[]).forEach((t) => {
      list.push({ tipo: t, label: TASA_LABELS[t], valor: eaToTasa(freshEA, t) * 100 });
    });
    return list;
  }, [freshEA]);

  function handleCalculate() {
    if (teaNum <= 0) return toast.error("TEA debe ser mayor a 0");
    if (plazoNum <= 0) return toast.error("Plazo debe ser mayor a 0");
    if (valorNum <= 0) return toast.error("Valor del crédito debe ser mayor a 0");
    if (periodoNum < 1 || periodoNum > plazoNum) return toast.error(`Periodo debe estar entre 1 y ${plazoNum}`);
    if (modo === "uvr" && uvrInicialNum <= 0) return toast.error("UVR inicial debe ser mayor a 0");
    setCalculated(true);
    setLastCalc(new Date());
    toast.success(`Amortización ${modo === "uvr" ? "UVR" : "PESOS"} calculada`);
  }

  function handleReset() {
    setTea(""); setPlazo(""); setValor(""); setPeriodo(""); setSeguros("");
    setFreshValor(""); setFreshCuotasStr("");
    setUvrInicial(""); setVarUvr("");
    setCalculated(false); setLastCalc(null);
  }

  function handleUseFreshAsTEA() {
    if (!freshValid) return toast.error("Ingresa una tasa válida");
    setTea((freshEA * 100).toFixed(4));
    toast.success(`TEA actualizada: ${(freshEA * 100).toFixed(4)}%`);
  }

  function handleSaveScenario() {
    if (!calculated) return toast.error("Calcula primero para guardar el escenario");
    const nombre = prompt("Nombre del escenario:", `${modo.toUpperCase()} · ${plazoNum}m · ${fmtCOP(valorNum)}`);
    if (!nombre) return;
    const s: Scenario = {
      id: crypto.randomUUID(),
      nombre, ts: Date.now(),
      modo, tea, plazo, valor, seguros,
      freshValor, freshCuotas: freshCuotasStr,
      uvrInicial, varUvr, fechaDesembolso,
    };
    const next = [s, ...scenarios].slice(0, 10);
    persistScenarios(next);
    toast.success("Escenario guardado");
  }
  function handleLoadScenario(s: Scenario) {
    setModo(s.modo); setTea(s.tea); setPlazo(s.plazo); setValor(s.valor);
    setSeguros(s.seguros);
    setFreshValor(s.freshValor || ""); setFreshCuotasStr(s.freshCuotas || "");
    setUvrInicial(s.uvrInicial); setVarUvr(s.varUvr);
    setFechaDesembolso(s.fechaDesembolso || fechaDesembolso);
    setCalculated(false);
    toast.success(`Escenario "${s.nombre}" cargado — presiona Calcular`);
  }
  function handleDeleteScenario(id: string) {
    persistScenarios(scenarios.filter((x) => x.id !== id));
  }

  async function handleImportCaso() {
    const cod = importCodigo.trim();
    if (!cod) return toast.error("Ingresa el código NUV_...");
    setImportLoading(true);
    try {
      const { data, error } = await supabase
        .from("expedientes")
        .select("codigo, cliente_nombre, modo, cliente_data, credito_data")
        .ilike("codigo", `%${cod}%`)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) { toast.error("Expediente no encontrado"); return; }
      const cd: any = data.cliente_data || {};
      const cr: any = data.credito_data || {};
      const moneda: string = (data.modo === "uvr" || cr.uvr) ? "uvr" : "pesos";
      if (moneda === "uvr") setModo("uvr"); else setModo("pesos");
      let filled = 0;
      if (cd.plazoInicial) { setPlazo(String(cd.plazoInicial)); filled++; }
      else if (cr.plazoInicial) { setPlazo(String(cr.plazoInicial)); filled++; }
      if (moneda === "uvr") {
        if (cr.uvr?.teaCobrada) { setTea(String(cr.uvr.teaCobrada)); filled++; }
        if (cr.uvr?.saldoUVR) { setValor(String(cr.uvr.saldoUVR)); filled++; }
        if (cr.uvr?.valorUVR) { setUvrInicial(String(cr.uvr.valorUVR)); filled++; }
        if (cr.uvr?.seguros) { setSeguros(String(cr.uvr.seguros)); filled++; }
      } else {
        if (cr.pesos?.tea || cr.tea) { setTea(String(cr.pesos?.tea ?? cr.tea)); filled++; }
        const vb = cr.pesos?.valorDesembolsado ?? cr.pesos?.saldoCapital ?? cr.valorDesembolsado ?? cr.saldoCapital ?? "";
        if (vb) { setValor(String(vb)); filled++; }
        if (cr.pesos?.seguros ?? cr.seguros) { setSeguros(String(cr.pesos?.seguros ?? cr.seguros)); filled++; }
      }
      setCalculated(false);
      setImportOpen(false);
      setImportCodigo("");
      toast.success(`${data.codigo} — ${data.cliente_nombre ?? "sin nombre"} (${filled} campos)`);
    } catch (e: any) {
      toast.error(e?.message || "Error al importar");
    } finally {
      setImportLoading(false);
    }
  }

  function handleExtractoApply(p: ExtractoApplyPayload) {
    const moneda = p.monedaDetectada;
    if (moneda === "uvr" && modo !== "uvr") setModo("uvr");
    else if (moneda === "pesos" && modo !== "pesos") setModo("pesos");
    let filled = 0;
    if (p.cliente.plazoInicial) { setPlazo(String(p.cliente.plazoInicial)); filled++; }
    if (moneda === "uvr") {
      if (p.uvr?.teaCobrada) { setTea(String(p.uvr.teaCobrada)); filled++; }
      if (p.uvr?.saldoUVR) { setValor(String(p.uvr.saldoUVR)); filled++; }
      if (p.uvr?.valorUVR) { setUvrInicial(String(p.uvr.valorUVR)); filled++; }
      if (p.uvr?.seguros) { setSeguros(String(p.uvr.seguros)); filled++; }
    } else {
      if (p.pesos?.tea) { setTea(String(p.pesos.tea)); filled++; }
      const vb = p.pesos?.valorDesembolsado && parseFloat(p.pesos.valorDesembolsado) > 0 ? p.pesos.valorDesembolsado : p.pesos?.saldoCapital || "";
      if (vb) { setValor(String(vb)); filled++; }
      if (p.pesos?.seguros) { setSeguros(String(p.pesos.seguros)); filled++; }
    }
    setCalculated(false);
    if (filled === 0) toast.warning("No se detectaron valores utilizables.");
    else toast.success(`Extracto ${moneda === "uvr" ? "UVR" : "PESOS"} aplicado (${filled} campos).`);
    return true;
  }

  async function handleExportExcel() {
    if (!rows.length) return toast.error("Primero calcula la amortización");
    const XLSX = await import("xlsx");
    const data = [
      ["NUVIA AMORTIZATION ENGINE"],
      [`Fecha desembolso: ${fechaDesembolso}`, `TEA: ${(teaNum * 100).toFixed(4)}%`, `Tasa Mensual: ${(tasaMensual * 100).toFixed(6)}%`],
      [`Valor: ${valorNum}`, `Plazo: ${plazoNum}m`, `Seguros: ${segurosNum}`],
      [`Punto de equilibrio: cuota ${breakEven ?? "—"} (${breakEvenFecha})`],
      [],
      ["Periodo", "Fecha", "Saldo inicial", "Cuota financiera", "Interés base", "Fresh", "Capital", "Seguros", "Total cuota", "Saldo final"],
      ...rows.map((r) => [r.periodo, fechaCuota(fechaDesembolso, r.periodo), Math.round(r.saldoInicial), Math.round(r.cuota), Math.round(r.interesBase), Math.round(r.fresh), Math.round(r.capital), Math.round(r.seguros), Math.round(r.totalCuota), Math.round(r.saldoFinal)]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Amortización");
    XLSX.writeFile(wb, `NUVIA_Amortizacion_${Date.now()}.xlsx`);
    toast.success("Excel descargado");
  }

  async function handleExportPDF() {
    if (!rows.length) return toast.error("Primero calcula la amortización");
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFontSize(16); doc.text("NUVIA Amortization Engine", 40, 40);
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(`Desembolso: ${fechaDesembolso}  ·  TEA: ${(teaNum * 100).toFixed(4)}%  ·  Plazo: ${plazoNum}m  ·  Break-even cuota ${breakEven ?? "—"} (${breakEvenFecha})`, 40, 56);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 72,
      head: [["#", "Fecha", "Saldo inicial", "Cuota", "Interés base", "Fresh", "Capital", "Seguros", "Total", "Saldo final"]],
      body: rows.map((r) => [r.periodo, fechaCuota(fechaDesembolso, r.periodo), fmtCOP(r.saldoInicial), fmtCOP(r.cuota), fmtCOP(r.interesBase), r.fresh > 0 ? fmtCOP(r.fresh) : "—", fmtCOP(r.capital), fmtCOP(r.seguros), fmtCOP(r.totalCuota), fmtCOP(r.saldoFinal)]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [15, 26, 51] },
    });
    doc.save(`NUVIA_Amortizacion_${Date.now()}.pdf`);
    toast.success("PDF descargado");
  }

  const lastCalcLabel = lastCalc
    ? `Hoy ${lastCalc.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true })}`
    : "—";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070F] text-white font-[Inter,system-ui,sans-serif] antialiased">
      <BackgroundFX />

      <div className="relative mx-auto w-full max-w-[1500px] px-6 py-6">
        {/* Back link */}
        <Link
          to="/herramientas"
          className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-white/50 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Volver a Herramientas
        </Link>

        {/* ============ HEADER BAR ============ */}
        <HeaderBar modo={modo} setModo={setModo} onCalcInvalidate={() => setCalculated(false)} />

        {/* ============ EXTRACTO READER (collapsible) ============ */}
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
          <button
            onClick={() => setShowReader((s) => !s)}
            className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#445DA3]/40 to-[#84B98F]/40 border border-white/10">
                <FileText className="h-4 w-4 text-white/90" />
              </div>
              <div className="text-left">
                <div className="text-[13px] font-semibold text-white">Lector de extractos NUVIA</div>
                <div className="text-[11px] text-white/50">Arrastra o carga el extracto — autocompleta TEA, plazo, valor y seguros.</div>
              </div>
            </div>
            <ChevronDown className={`h-4 w-4 text-white/60 transition-transform ${showReader ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showReader && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 pt-1">
                  <ExtractoReader modo={modo} onApply={handleExtractoApply} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ============ MAIN GRID ============ */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ==== LEFT: INPUT CONSOLE ==== */}
          <div className="space-y-4">
            <Panel>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#84B98F]">Input Console</div>
                <div className="text-[11px] text-white/50 mt-1">Parámetros de tu crédito</div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setImportOpen(true)}
                  className="flex-1 rounded-xl border border-[#7BB0FF]/30 bg-[#7BB0FF]/[0.08] hover:bg-[#7BB0FF]/[0.14] px-3 py-2 text-[11px] font-semibold text-[#C9DDFF] transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Search className="h-3.5 w-3.5" /> Importar caso
                </button>
                <button
                  onClick={() => setShowScenarios((s) => !s)}
                  className="flex-1 rounded-xl border border-[#B58BFF]/30 bg-[#B58BFF]/[0.08] hover:bg-[#B58BFF]/[0.14] px-3 py-2 text-[11px] font-semibold text-[#D6C0FF] transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" /> Escenarios ({scenarios.length})
                </button>
              </div>

              {/* Escenarios drawer */}
              <AnimatePresence>
                {showScenarios && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                      <button
                        onClick={handleSaveScenario}
                        className="w-full rounded-lg border border-[#6BCF89]/30 bg-[#6BCF89]/[0.10] hover:bg-[#6BCF89]/[0.18] px-2.5 py-2 text-[11px] font-semibold text-[#B5DFC0] inline-flex items-center justify-center gap-1.5"
                      >
                        <Save className="h-3 w-3" /> Guardar actual
                      </button>
                      {scenarios.length === 0 ? (
                        <div className="text-[10.5px] text-white/40 text-center py-2">Sin escenarios guardados.</div>
                      ) : (
                        <div className="space-y-1.5 max-h-[180px] overflow-auto nuvia-scroll">
                          {scenarios.map((s) => (
                            <div key={s.id} className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                              <button onClick={() => handleLoadScenario(s)} className="flex-1 text-left min-w-0">
                                <div className="text-[11px] font-semibold text-white truncate">{s.nombre}</div>
                                <div className="text-[9.5px] text-white/40 uppercase tracking-wider">{s.modo} · {s.plazo}m · {new Date(s.ts).toLocaleDateString("es-CO")}</div>
                              </button>
                              <button onClick={() => handleDeleteScenario(s.id)} className="shrink-0 text-white/40 hover:text-red-400 p-1" title="Eliminar">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Convertidor de tasa (Tasa Fresh) */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setShowConverter((s) => !s)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-3.5 w-3.5 text-[#84B98F]" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Convertidor de tasa (EA · MV · NMV · NAMV · NASV)</span>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-white/50 transition-transform ${showConverter ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {showConverter && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-3.5 pb-3 pt-1 space-y-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {(["EA", "MV", "NMV", "NAMV", "NASV"] as TasaTipo[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setFreshTipo(t)}
                              className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                freshTipo === t
                                  ? "bg-[#4B6FE0]/25 border-[#4B6FE0]/60 text-white"
                                  : "bg-white/[0.02] border-white/[0.08] text-white/50 hover:text-white/80"
                              }`}
                            >{t}</button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 focus-within:border-[#4B6FE0]/60">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={freshTasa}
                            onChange={(e) => setFreshTasa(e.target.value.replace(/[^0-9.,]/g, ""))}
                            placeholder={`Tasa ${freshTipo} (ej: 12,50)`}
                            className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-white placeholder:text-white/25 outline-none tabular-nums"
                          />
                          <span className="text-[10px] text-white/40">%</span>
                        </div>
                        {freshValid && (
                          <>
                            <div className="grid grid-cols-2 gap-1.5">
                              {conversions.map((c) => (
                                <div key={c.tipo} className={`rounded-md px-2 py-1.5 border ${c.tipo === freshTipo ? "border-[#4B6FE0]/40 bg-[#4B6FE0]/10" : "border-white/[0.06] bg-white/[0.02]"}`}>
                                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/45">{c.tipo}</div>
                                  <div className="text-[12px] font-semibold text-white tabular-nums">{c.valor.toFixed(4)}%</div>
                                </div>
                              ))}
                            </div>
                            <button
                              onClick={handleUseFreshAsTEA}
                              className="w-full rounded-lg border border-[#6BCF89]/30 bg-[#6BCF89]/[0.10] hover:bg-[#6BCF89]/[0.18] px-2.5 py-2 text-[11px] font-semibold text-[#B5DFC0] inline-flex items-center justify-center gap-1.5"
                            >
                              <Download className="h-3 w-3" /> Usar como TEA ({(freshEA * 100).toFixed(4)}%)
                            </button>
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-4 space-y-2.5">
                <InputTile icon={<Percent className="h-3.5 w-3.5" />} label={modo === "uvr" ? "TEA UVR" : "TEA (Tasa Efectiva Anual)"} value={tea} onChange={setTea} suffix="%" placeholder={modo === "uvr" ? "8,50" : "11,00"} />
                <InputTile icon={<Calendar className="h-3.5 w-3.5" />} label="Plazo aprobado" value={plazo} onChange={setPlazo} suffix="meses" placeholder="240" />
                <InputTile icon={<DollarSign className="h-3.5 w-3.5" />} label={modo === "uvr" ? "Valor crédito (UVR)" : "Valor crédito aprobado"} value={valor} onChange={setValor} prefix={modo === "uvr" ? "" : "$"} suffix={modo === "uvr" ? "UVR" : undefined} placeholder={modo === "uvr" ? "500.000" : "737.000.000"} />
                {/* Fecha desembolso */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 hover:border-white/[0.12] focus-within:border-[#4B6FE0]/60">
                  <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/45">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-white/60">
                      <Calendar className="h-3.5 w-3.5" />
                    </div>
                    <span>Fecha de desembolso</span>
                  </div>
                  <input
                    type="month"
                    value={fechaDesembolso}
                    onChange={(e) => setFechaDesembolso(e.target.value)}
                    className="mt-1 w-full bg-transparent text-[15px] font-semibold text-white outline-none tabular-nums [color-scheme:dark]"
                  />
                </div>
                {modo === "uvr" && (
                  <>
                    <InputTile icon={<Coins className="h-3.5 w-3.5" />} label="UVR inicial (COP/UVR)" value={uvrInicial} onChange={setUvrInicial} prefix="$" placeholder="340,50" />
                    <InputTile icon={<TrendingUp className="h-3.5 w-3.5" />} label="Variación UVR anual" value={varUvr} onChange={setVarUvr} suffix="% EA" placeholder="5,50" />
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { label: "Conservador", val: "3.00" },
                        { label: "Base", val: "5.00" },
                        { label: "DANE hist.", val: "6.20" },
                      ].map((p) => (
                        <button
                          key={p.label}
                          onClick={() => setVarUvr(p.val)}
                          className="rounded-md px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white hover:border-[#84B98F]/40 transition-all"
                        >
                          {p.label} {p.val}%
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <InputTile icon={<Target className="h-3.5 w-3.5" />} label="Periodo a consultar" value={periodo} onChange={setPeriodo} suffix={`/ ${plazoNum || "n"}`} placeholder="3" />
                <InputTile icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Seguros mensuales (COP)" value={seguros} onChange={setSeguros} prefix="$" placeholder="212.047" />

                {/* Tasa Fresh (subsidio / componente adicional del interés) */}
                <div className="rounded-xl border border-[#B58BFF]/25 bg-[#B58BFF]/[0.05] px-3.5 py-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#D6C0FF]">
                      <Wand2 className="h-3.5 w-3.5" /> Tasa Fresh
                    </div>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white/40">máx. {FRESH_MAX_CUOTAS} cuotas</span>
                  </div>
                  <div className="text-[10.5px] text-white/50 leading-snug">Valor mensual en pesos que se suma al interés durante las primeras N cuotas.</div>
                  <InputTile
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    label="Valor Fresh mensual (COP)"
                    value={freshValor}
                    onChange={setFreshValor}
                    prefix="$"
                    placeholder="150.000"
                  />
                  <InputTile
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label={`Cuotas Fresh (1 – ${FRESH_MAX_CUOTAS})`}
                    value={freshCuotasStr}
                    onChange={(v) => {
                      const n = parseInt(v.replace(/[^0-9]/g, "")) || 0;
                      setFreshCuotasStr(String(Math.min(n, FRESH_MAX_CUOTAS) || ""));
                    }}
                    suffix="cuotas"
                    placeholder="60"
                  />
                  {freshValorNum > 0 && freshCuotasNum > 0 && (
                    <div className="rounded-lg border border-[#B58BFF]/25 bg-[#B58BFF]/[0.08] px-2.5 py-1.5 text-[10.5px] text-[#D6C0FF] tabular-nums">
                      Aporte total Fresh: <span className="font-bold text-white">{fmtCOP(freshValorNum * freshCuotasNum)}</span> en {freshCuotasNum} cuotas
                    </div>
                  )}
                </div>
              </div>

              {/* Tasa mensual equivalente */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/50">Tasa mensual equivalente</div>
                  <HelpCircle className="h-3.5 w-3.5 text-white/30" />
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-[#84B98F]" style={{ textShadow: "0 0 22px rgba(132,185,143,0.35)" }}>
                  {tasaMensual > 0 ? `${(tasaMensual * 100).toFixed(6)} %` : "— %"}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 space-y-2.5">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCalculate}
                  className="w-full relative rounded-2xl px-4 py-3.5 text-[13px] font-bold tracking-wide text-white overflow-hidden group"
                  style={{
                    background: "linear-gradient(135deg, #4B6FE0 0%, #6BCF89 100%)",
                    boxShadow: "0 12px 30px -10px rgba(107,207,137,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
                  }}
                >
                  <span className="relative flex items-center justify-center gap-2 uppercase tracking-[0.14em]">
                    <Zap className="h-4 w-4" /> Calcular cuota
                  </span>
                </motion.button>
                <button
                  onClick={handleReset}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12px] font-semibold text-white/70 hover:text-white hover:bg-white/[0.05] hover:border-white/[0.14] transition-all inline-flex items-center justify-center gap-2 uppercase tracking-[0.14em]"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Limpiar datos
                </button>
              </div>
            </Panel>

            {/* Alcance */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <HelpCircle className="h-4 w-4 text-[#7BB0FF]" />
              </div>
              <div className="text-[11.5px] text-white/60 leading-relaxed">
                {modo === "pesos"
                  ? "Esta herramienta solo aplica para créditos en pesos con sistema francés de cuota fija. No aplica para créditos en UVR o indexados."
                  : "Modalidad UVR: proyecta la cuota a COP según la variación anual esperada del UVR."}
              </div>
            </div>
          </div>

          {/* ==== RIGHT: OUTPUT AREA ==== */}
          <div className="space-y-5">
            {/* Section header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7BB0FF]">Cuota consultada</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <div className="text-4xl font-bold text-[#84B98F]" style={{ textShadow: "0 0 30px rgba(132,185,143,0.45)" }}>
                    #{calculated && currentRow ? currentRow.periodo : "—"}
                  </div>
                  <div className="text-[12px] text-white/50">Discriminación exacta de la cuota seleccionada</div>
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/60">
                <Clock className="h-3 w-3" /> Último cálculo: {lastCalcLabel}
              </div>
            </div>

            {/* Total + KPIs grid */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {/* Purple TOTAL CUOTA card */}
              <TotalCard current={currentRow} calculated={calculated} />

              {/* KPI grid 2x3 */}
              <div className="grid grid-cols-2 gap-3">
                <MiniKPI label="Saldo inicial" value={currentRow?.saldoInicial ?? 0} icon={<Layers className="h-4 w-4" />} accent="#7BB0FF" show={calculated} />
                <MiniKPI label="Interés del periodo" value={currentRow?.interes ?? 0} icon={<DollarSign className="h-4 w-4" />} accent="#6BCF89" show={calculated} />
                <MiniKPI label="Capital abonado" value={currentRow?.capital ?? 0} icon={<TrendingUp className="h-4 w-4" />} accent="#6BCF89" show={calculated} />
                <MiniKPI label="Seguros" value={currentRow?.seguros ?? 0} icon={<ShieldCheck className="h-4 w-4" />} accent="#B58BFF" show={calculated} />
                <MiniKPI label="Saldo final" value={currentRow?.saldoFinal ?? 0} icon={<Landmark className="h-4 w-4" />} accent="#7BB0FF" show={calculated} />
                <MiniKPI label="Cuota financiera" value={currentRow?.cuota ?? 0} icon={<Calculator className="h-4 w-4" />} accent="#B58BFF" show={calculated} />
              </div>
            </div>

            {/* Break-even KPI */}
            <div
              className="relative rounded-2xl border border-[#84B98F]/25 p-5 overflow-hidden backdrop-blur-xl"
              style={{
                background: "linear-gradient(135deg, rgba(132,185,143,0.10), rgba(75,111,224,0.06))",
                boxShadow: "0 20px 60px -30px rgba(132,185,143,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-40" style={{ background: "radial-gradient(circle, #84B98F, transparent 70%)" }} />
              <div className="relative flex items-center gap-5 flex-wrap">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#84B98F]/40 bg-[#84B98F]/[0.14]">
                  <Target className="h-5 w-5 text-[#B5DFC0]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#84B98F]">Punto de equilibrio Capital vs Interés</div>
                  {calculated && breakEven ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-3 flex-wrap">
                        <div className="text-[32px] font-bold text-white leading-none tabular-nums" style={{ textShadow: "0 0 24px rgba(132,185,143,0.5)" }}>Cuota #{breakEven}</div>
                        <div className="text-[13px] text-[#B5DFC0] font-semibold">{breakEvenFecha}</div>
                        <div className="text-[11.5px] text-white/50">({breakEvenPct.toFixed(1)}% del plazo)</div>
                      </div>
                      <div className="mt-1.5 text-[11.5px] text-white/60">A partir de esta cuota amortizas más capital que intereses — el saldo se reduce más rápido.</div>
                    </>
                  ) : (
                    <div className="mt-2 text-[12px] text-white/40">Calcula para descubrir cuándo empiezas a ganarle al banco.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Distribution + Insight row */}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
              {/* Distribution */}
              <Panel padded>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 flex items-center gap-1.5">
                  <span className="inline-block h-1 w-1 rounded-full bg-[#84B98F]" /> Distribución de esta cuota
                </div>
                {calculated && currentRow ? (
                  <div className="mt-4 flex items-center gap-5">
                    <Donut pctA={pctInteres} pctB={pctCapital} colorA="#B58BFF" colorB="#6BCF89" />
                    <div className="space-y-3 text-[12px]">
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-[#B58BFF]">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#B58BFF]" /> {pctInteres.toFixed(1)}% Intereses
                        </div>
                        <div className="tabular-nums text-white/80 pl-4">{fmtCOP(currentRow.interes)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-semibold text-[#6BCF89]">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#6BCF89]" /> {pctCapital.toFixed(1)}% Capital
                        </div>
                        <div className="tabular-nums text-white/80 pl-4">{fmtCOP(currentRow.capital)}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-[12px] text-white/40">Calcula para ver la distribución.</div>
                )}
              </Panel>

              {/* Insight */}
              <div
                className="relative rounded-2xl border border-[#6BCF89]/25 p-5 overflow-hidden backdrop-blur-xl"
                style={{
                  background: "linear-gradient(135deg, rgba(107,207,137,0.08), rgba(75,111,224,0.06))",
                  boxShadow: "0 20px 60px -30px rgba(107,207,137,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full blur-3xl opacity-50" style={{ background: "radial-gradient(circle, #6BCF89, transparent 70%)" }} />
                <div className="relative">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#84B98F]">
                    <Sparkles className="h-3.5 w-3.5" /> NUVIA Insight
                    <span className="rounded-md bg-[#6BCF89]/20 border border-[#6BCF89]/30 px-1.5 py-0.5 text-[9px] text-[#B5DFC0]">IA</span>
                  </div>
                  {calculated && insight ? (
                    <p className="mt-2.5 text-[13px] text-white/85 leading-relaxed">{insight}</p>
                  ) : (
                    <p className="mt-2.5 text-[13px] text-white/40">El motor generará un análisis contextual una vez calcules la amortización.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <Panel padded>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold text-white">Tabla de amortización completa</div>
                  <div className="text-[11.5px] text-white/50 mt-0.5">Visualiza el comportamiento total de tu crédito</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="rounded-xl border border-[#6BCF89]/30 bg-[#6BCF89]/[0.08] hover:bg-[#6BCF89]/[0.14] px-3.5 py-2 text-[12px] font-semibold text-[#B5DFC0] transition-all inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/[0.08] hover:bg-[#EF4444]/[0.14] px-3.5 py-2 text-[12px] font-semibold text-[#FCA5A5] transition-all inline-flex items-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" /> Exportar PDF
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] overflow-hidden">
                <div className="max-h-[440px] overflow-auto nuvia-scroll">
                  <table className="w-full text-[12.5px] tabular-nums">
                    <thead className="sticky top-0 z-10" style={{ background: "rgba(11,16,32,0.98)", boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
                      <tr className="text-left text-[10.5px] uppercase tracking-[0.14em] text-white/50">
                        <th className="px-4 py-3 font-semibold">Periodo</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Saldo inicial</th>
                        <th className="px-4 py-3 font-semibold">Cuota financiera</th>
                        <th className="px-4 py-3 font-semibold">Interés base</th>
                        <th className="px-4 py-3 font-semibold text-[#D6C0FF]">Fresh</th>
                        <th className="px-4 py-3 font-semibold">Capital</th>
                        <th className="px-4 py-3 font-semibold">Seguros</th>
                        <th className="px-4 py-3 font-semibold">Total cuota</th>
                        <th className="px-4 py-3 font-semibold">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-white/40 text-[12px]">
                            Ingresa los datos y presiona <span className="text-white/80 font-semibold">Calcular cuota</span> para ver la tabla completa.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => {
                          const isCurrent = r.periodo === periodoNum;
                          const isBreakEven = breakEven === r.periodo;
                          return (
                            <tr
                              key={r.periodo}
                              className={`transition-colors border-t border-white/[0.04] ${
                                isCurrent
                                  ? ""
                                  : r.periodo % 2 === 0
                                    ? "bg-white/[0.012] hover:bg-white/[0.035]"
                                    : "hover:bg-white/[0.03]"
                              }`}
                              style={
                                isCurrent
                                  ? {
                                      background: "linear-gradient(90deg, rgba(107,90,224,0.28), rgba(107,90,224,0.14))",
                                      boxShadow: "inset 3px 0 0 #B58BFF",
                                    }
                                  : isBreakEven
                                    ? { background: "linear-gradient(90deg, rgba(132,185,143,0.14), transparent)", boxShadow: "inset 3px 0 0 #84B98F" }
                                    : undefined
                              }
                            >
                              <td className="px-4 py-3 text-white/90 font-medium">
                                {isCurrent && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: "#B58BFF", boxShadow: "0 0 8px #B58BFF" }} />
                                )}
                                {isBreakEven && !isCurrent && (
                                  <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle" style={{ background: "#84B98F", boxShadow: "0 0 8px #84B98F" }} />
                                )}
                                {r.periodo}
                              </td>
                              <td className="px-4 py-3 text-white/70 text-[11.5px]">{fechaCuota(fechaDesembolso, r.periodo)}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.saldoInicial)}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.cuota)}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.interesBase)}</td>
                              <td className={`px-4 py-3 tabular-nums ${r.fresh > 0 ? "text-[#D6C0FF] font-semibold" : "text-white/30"}`}>{r.fresh > 0 ? fmtCOP(r.fresh) : "—"}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.capital)}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.seguros)}</td>
                              <td className="px-4 py-3 text-white font-semibold">{fmtCOP(r.totalCuota)}</td>
                              <td className="px-4 py-3 text-white/85">{fmtCOP(r.saldoFinal)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="h-16" />
      </div>

      <style>{`
        .nuvia-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .nuvia-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .nuvia-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(75,111,224,0.4), rgba(107,207,137,0.35));
          border-radius: 999px;
        }
      `}</style>

      {/* ============ IMPORT CASO MODAL ============ */}
      <AnimatePresence>
        {importOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setImportOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0B1020] p-6"
              style={{ boxShadow: "0 30px 80px -20px rgba(75,111,224,0.4)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#7BB0FF]">Importar caso</div>
                  <div className="text-[15px] font-semibold text-white mt-1">Buscar expediente NUVIA</div>
                </div>
                <button onClick={() => setImportOpen(false)} className="text-white/50 hover:text-white p-1">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 focus-within:border-[#4B6FE0]/60">
                <Search className="h-4 w-4 text-white/40 shrink-0" />
                <input
                  autoFocus
                  value={importCodigo}
                  onChange={(e) => setImportCodigo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleImportCaso(); }}
                  placeholder="NUV_2026_..."
                  className="flex-1 bg-transparent text-[14px] font-semibold text-white placeholder:text-white/25 outline-none"
                />
              </div>
              <div className="mt-2 text-[10.5px] text-white/40">Buscamos por coincidencia parcial. Trae el primer resultado.</div>
              <div className="mt-5 flex gap-2 justify-end">
                <button onClick={() => setImportOpen(false)} className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[12px] font-semibold text-white/70 hover:text-white">
                  Cancelar
                </button>
                <button
                  onClick={handleImportCaso}
                  disabled={importLoading}
                  className="rounded-lg px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #4B6FE0, #6BCF89)" }}
                >
                  {importLoading ? "Buscando..." : "Importar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function HeaderBar({ modo, setModo, onCalcInvalidate }: { modo: "pesos" | "uvr"; setModo: (m: "pesos" | "uvr") => void; onCalcInvalidate: () => void }) {
  return (
    <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl overflow-hidden">
      <div className="relative flex flex-col md:flex-row md:items-center gap-4 px-5 py-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/15"
            style={{
              background: "linear-gradient(135deg, #4B6FE0 0%, #6BCF89 100%)",
              boxShadow: "0 12px 30px -10px rgba(107,207,137,0.6), inset 0 1px 0 rgba(255,255,255,0.3)",
            }}
          >
            <span className="text-[19px] font-black text-white leading-none" style={{ fontFamily: "'Space Grotesk', Inter, sans-serif" }}>N</span>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-black tracking-[0.02em] text-white">NUVIA</div>
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[#84B98F]">Amortization Engine</div>
          </div>
        </div>

        {/* Divider vertical */}
        <div className="hidden md:block h-10 w-px bg-white/10" />

        {/* Title / subtitle */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] md:text-[14px] font-bold uppercase tracking-[0.14em] text-white">
            Motor de amortización inteligente
          </div>
          <div className="text-[11.5px] text-white/50 mt-0.5">
            Sistema francés · Cuota fija {modo === "uvr" ? "en UVR" : "en pesos"}
          </div>
        </div>

        {/* Badges + toggle */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Modo pill (functional) */}
          <button
            onClick={() => { setModo(modo === "pesos" ? "uvr" : "pesos"); onCalcInvalidate(); }}
            title="Cambiar modalidad"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(135deg, rgba(107,207,137,0.16), rgba(107,207,137,0.06))",
              borderColor: "rgba(107,207,137,0.4)",
              color: "#B5DFC0",
            }}
          >
            <Scale className="h-3 w-3" /> {modo === "pesos" ? "Solo modalidad pesos" : "Modalidad UVR"}
          </button>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              background: "linear-gradient(135deg, rgba(75,111,224,0.16), rgba(75,111,224,0.06))",
              borderColor: "rgba(75,111,224,0.4)",
              color: "#A5B4E8",
            }}
          >
            <Calculator className="h-3 w-3" /> French system
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{
              background: "linear-gradient(135deg, rgba(181,139,255,0.18), rgba(181,139,255,0.06))",
              borderColor: "rgba(181,139,255,0.4)",
              color: "#D6C0FF",
            }}
          >
            <Zap className="h-3 w-3" /> Financial engine
          </span>
          <button className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.02] text-white/50 hover:text-white hover:bg-white/[0.06] transition-all">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div
        className="h-[2px] w-full"
        style={{ background: "linear-gradient(90deg, transparent 0%, #4B6FE0 20%, #6BCF89 55%, #B58BFF 85%, transparent 100%)" }}
      />
    </div>
  );
}

function Panel({ children, padded = false }: { children: React.ReactNode; padded?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl ${padded ? "p-5" : "p-5"}`}
      style={{ boxShadow: "0 20px 50px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      {children}
    </div>
  );
}

function InputTile({
  icon,
  label,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 transition-all hover:border-white/[0.12] focus-within:border-[#4B6FE0]/60 focus-within:bg-white/[0.04] focus-within:shadow-[0_0_0_3px_rgba(75,111,224,0.14)]">
      <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/45">
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.06] text-white/60">
          {icon}
        </div>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 flex items-center">
        {prefix && <span className="text-white/40 text-[15px] mr-1">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ""))}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent text-[17px] font-semibold text-white placeholder:text-white/20 outline-none tabular-nums"
        />
        {suffix && <span className="ml-2 text-[11px] text-white/40 shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

function TotalCard({ current, calculated }: { current: Row | undefined; calculated: boolean }) {
  const total = useCountUp(current?.totalCuota ?? 0);
  const cuota = current?.cuota ?? 0;
  const seguros = current?.seguros ?? 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-2xl border border-[#8B6BFF]/30 overflow-hidden backdrop-blur-xl p-6"
      style={{
        background: "linear-gradient(140deg, rgba(107,90,224,0.28) 0%, rgba(75,111,224,0.22) 45%, rgba(30,20,60,0.35) 100%)",
        boxShadow: "0 30px 80px -30px rgba(139,107,255,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-60" style={{ background: "radial-gradient(circle, #8B6BFF, transparent 70%)" }} />
      <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full blur-3xl opacity-30" style={{ background: "radial-gradient(circle, #4B6FE0, transparent 70%)" }} />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#D6C0FF]">Total cuota (con seguros)</div>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-white/[0.08]">
            <Layers className="h-4 w-4 text-[#D6C0FF]" />
          </div>
        </div>

        <div
          className="mt-3 text-[44px] md:text-[52px] font-bold text-white leading-none tabular-nums"
          style={{ textShadow: "0 0 40px rgba(181,139,255,0.6)" }}
        >
          {calculated && current ? fmtCOP(total) : "$ —"}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 items-center text-center gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">Cuota financiera</div>
            <div className="mt-1 text-[13px] font-semibold text-white tabular-nums">{calculated ? fmtCOP(cuota) : "—"}</div>
          </div>
          <div className="text-[#B58BFF] text-lg font-bold">+</div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/50">Seguros</div>
            <div className="mt-1 text-[13px] font-semibold text-[#6BCF89] tabular-nums">{calculated ? fmtCOP(seguros) : "—"}</div>
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/40">= </span>
          <span className="text-[13px] font-bold text-[#7BB0FF] tabular-nums">{calculated && current ? fmtCOP(current.totalCuota) : "—"}</span>
        </div>
      </div>
    </motion.div>
  );
}

function MiniKPI({ label, value, icon, accent, show }: { label: string; value: number; icon: React.ReactNode; accent: string; show: boolean }) {
  const display = useCountUp(value);
  return (
    <motion.div
      whileHover={{ y: -2, borderColor: `${accent}55` }}
      className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-xl p-4 overflow-hidden transition-all"
      style={{ boxShadow: "0 10px 30px -20px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.03)" }}
    >
      <div
        className="absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-35"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/50 leading-tight max-w-[70%]">{label}</div>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
          style={{ background: `${accent}18`, borderColor: `${accent}33`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="relative mt-2 text-[19px] font-bold text-white tabular-nums truncate">
        {show ? fmtCOP(display) : "$ —"}
      </div>
    </motion.div>
  );
}

function Donut({ pctA, pctB, colorA, colorB }: { pctA: number; pctB: number; colorA: string; colorB: string }) {
  const size = 110;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const a = (pctA / 100) * c;
  const b = (pctB / 100) * c;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorA} strokeWidth={stroke} strokeDasharray={`${a} ${c - a}`} strokeLinecap="butt" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorB} strokeWidth={stroke} strokeDasharray={`${b} ${c - b}`} strokeDashoffset={-a} strokeLinecap="butt" />
    </svg>
  );
}

function useCountUp(target: number, duration = 600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function BackgroundFX() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 12% 8%, rgba(75,111,224,0.22), transparent 45%), radial-gradient(circle at 88% 82%, rgba(107,207,137,0.18), transparent 50%), radial-gradient(circle at 60% 40%, rgba(139,107,255,0.12), transparent 55%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, #05070F 0%, #0B1020 100%)", opacity: 0.85 }} />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.018] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  );
}
