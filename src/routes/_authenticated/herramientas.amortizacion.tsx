import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import {
  Calculator,
  Sparkles,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  TrendingUp,
  RotateCcw,
  Lock,
  DollarSign,
  Percent,
  Calendar,
  ShieldCheck,
  Target,
} from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { ExtractoReader, type ExtractoApplyPayload } from "@/components/nuvex/ExtractoReader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/herramientas/amortizacion")({
  head: () => ({
    meta: [
      { title: "NUVIA Amortization Engine" },
      {
        name: "description",
        content:
          "Motor de amortización inteligente para analizar la composición exacta de cualquier cuota en créditos en pesos.",
      },
    ],
  }),
  component: AmortizationEngine,
});

// ============================================================================
// TYPES & MATH
// ============================================================================

type Row = {
  periodo: number;
  saldoInicial: number;
  cuota: number;
  interes: number;
  capital: number;
  seguros: number;
  totalCuota: number;
  saldoFinal: number;
};

function tasaMensualFromTEA(tea: number) {
  return Math.pow(1 + tea, 1 / 12) - 1;
}

function cuotaFija(valor: number, i: number, n: number) {
  if (i === 0) return valor / n;
  return (valor * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);
}

function construirTabla(valor: number, tea: number, n: number, seguros: number): Row[] {
  const i = tasaMensualFromTEA(tea);
  const cuota = cuotaFija(valor, i, n);
  const rows: Row[] = [];
  let saldo = valor;
  for (let p = 1; p <= n; p++) {
    const interes = saldo * i;
    let capital = cuota - interes;
    if (p === n) capital = saldo;
    const saldoFinal = Math.max(0, saldo - capital);
    rows.push({
      periodo: p,
      saldoInicial: saldo,
      cuota,
      interes,
      capital,
      seguros,
      totalCuota: cuota + seguros,
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
): Row[] {
  const base = construirTabla(valorUVR, teaUVR, n, 0);
  return base.map((r) => {
    const uvrT = uvr0 * Math.pow(1 + varAnual, (r.periodo - 1) / 12);
    const cuotaCOP = r.cuota * uvrT;
    return {
      periodo: r.periodo,
      saldoInicial: r.saldoInicial * uvrT,
      cuota: cuotaCOP,
      interes: r.interes * uvrT,
      capital: r.capital * uvrT,
      seguros: segurosCOP,
      totalCuota: cuotaCOP + segurosCOP,
      saldoFinal: r.saldoFinal * uvrT,
    };
  });
}

function findBreakEven(rows: Row[]): number | null {
  for (const r of rows) {
    if (r.capital >= r.interes) return r.periodo;
  }
  return null;
}

function generateInsight(rows: Row[], periodo: number): string {
  if (!rows.length) return "";
  const cur = rows[Math.min(periodo, rows.length) - 1];
  const be = findBreakEven(rows);
  const totalInteres = rows.reduce((a, r) => a + r.interes, 0);
  const totalCapital = rows.reduce((a, r) => a + r.capital, 0);
  const pctInteresCuota = (cur.interes / cur.cuota) * 100;
  const pctSaldo = ((rows[0].saldoInicial - cur.saldoFinal) / rows[0].saldoInicial) * 100;

  const parts: string[] = [];
  if (cur.interes > cur.capital) {
    parts.push(
      `En la cuota ${cur.periodo} aún estás pagando más intereses (${pctInteresCuota.toFixed(1)}% de la cuota) que capital.`,
    );
  } else {
    parts.push(
      `A partir de la cuota ${cur.periodo} la amortización de capital (${(100 - pctInteresCuota).toFixed(1)}%) ya supera a los intereses.`,
    );
  }
  if (be) {
    if (cur.periodo < be)
      parts.push(`El punto de equilibrio capital/interés ocurre en la cuota ${be}.`);
    else
      parts.push(`Ya cruzaste el punto de equilibrio (cuota ${be}); tu saldo se reduce cada vez más rápido.`);
  }
  parts.push(
    `Has amortizado el ${pctSaldo.toFixed(1)}% del capital original. Costo financiero total del crédito: ${fmtCOP(totalInteres)} sobre ${fmtCOP(totalCapital)}.`,
  );
  return parts.join(" ");
}

const fmtCOP = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v || 0);

const fmtPct = (v: number, d = 4) => `${(v * 100).toFixed(d)}%`;

// ============================================================================
// COMPONENT
// ============================================================================

function AmortizationEngine() {
  const [modo, setModo] = useState<"pesos" | "uvr">("pesos");
  const [tea, setTea] = useState<string>("");
  const [plazo, setPlazo] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [periodo, setPeriodo] = useState<string>("");
  const [seguros, setSeguros] = useState<string>("");
  // UVR-only fields
  const [uvrInicial, setUvrInicial] = useState<string>("");
  const [varUvr, setVarUvr] = useState<string>("");
  const [calculated, setCalculated] = useState(false);

  const teaNum = parseFloat(tea) / 100 || 0;
  const plazoNum = parseInt(plazo) || 0;
  const valorNum = parseFloat(valor) || 0;
  const periodoNum = parseInt(periodo) || 0;
  const segurosNum = parseFloat(seguros) || 0;
  const uvrInicialNum = parseFloat(uvrInicial) || 0;
  const varUvrNum = parseFloat(varUvr) / 100 || 0;

  const tasaMensual = teaNum > 0 ? tasaMensualFromTEA(teaNum) : 0;

  const rows = useMemo(() => {
    if (!calculated || teaNum <= 0 || plazoNum <= 0 || valorNum <= 0) return [];
    if (modo === "uvr") {
      if (uvrInicialNum <= 0) return [];
      return construirTablaUVR(valorNum, teaNum, plazoNum, uvrInicialNum, varUvrNum, segurosNum);
    }
    return construirTabla(valorNum, teaNum, plazoNum, segurosNum);
  }, [calculated, modo, teaNum, plazoNum, valorNum, segurosNum, uvrInicialNum, varUvrNum]);

  const currentRow = rows[Math.min(Math.max(periodoNum, 1), rows.length) - 1];
  const insight = useMemo(() => (rows.length ? generateInsight(rows, periodoNum) : ""), [rows, periodoNum]);

  function handleCalculate() {
    if (teaNum <= 0) return toast.error("TEA debe ser mayor a 0");
    if (plazoNum <= 0) return toast.error("Plazo debe ser mayor a 0");
    if (valorNum <= 0)
      return toast.error(modo === "uvr" ? "Valor del crédito en UVR debe ser mayor a 0" : "Valor del crédito debe ser mayor a 0");
    if (periodoNum < 1 || periodoNum > plazoNum)
      return toast.error(`Periodo debe estar entre 1 y ${plazoNum}`);
    if (segurosNum < 0) return toast.error("Seguros no puede ser negativo");
    if (modo === "uvr") {
      if (uvrInicialNum <= 0) return toast.error("UVR inicial debe ser mayor a 0");
    }
    setCalculated(true);
    toast.success(`Amortización ${modo === "uvr" ? "UVR" : "PESOS"} calculada`);
  }

  function handleReset() {
    setTea("");
    setPlazo("");
    setValor("");
    setPeriodo("1");
    setSeguros("");
    setCalculated(false);
  }

  function handleExtractoApply(p: ExtractoApplyPayload) {
    const moneda = p.monedaDetectada;
    // Ajuste automático de modo según lo detectado
    if (moneda === "uvr" && modo !== "uvr") {
      setModo("uvr");
    } else if (moneda === "pesos" && modo !== "pesos") {
      setModo("pesos");
    }
    let filled = 0;
    if (p.cliente.plazoInicial) {
      setPlazo(String(p.cliente.plazoInicial));
      filled++;
    }
    if (moneda === "uvr") {
      if (p.uvr?.teaCobrada) {
        setTea(String(p.uvr.teaCobrada));
        filled++;
      }
      const valorU = p.uvr?.saldoUVR || "";
      if (valorU) {
        setValor(String(valorU));
        filled++;
      }
      if (p.uvr?.valorUVR) {
        setUvrInicial(String(p.uvr.valorUVR));
        filled++;
      }
      if (p.uvr?.seguros) {
        setSeguros(String(p.uvr.seguros));
        filled++;
      }
    } else {
      if (p.pesos?.tea) {
        setTea(String(p.pesos.tea));
        filled++;
      }
      const valorBase =
        p.pesos?.valorDesembolsado && parseFloat(p.pesos.valorDesembolsado) > 0
          ? p.pesos.valorDesembolsado
          : p.pesos?.saldoCapital || "";
      if (valorBase) {
        setValor(String(valorBase));
        filled++;
      }
      if (p.pesos?.seguros) {
        setSeguros(String(p.pesos.seguros));
        filled++;
      }
    }
    setCalculated(false);
    if (filled === 0) {
      toast.warning("No se detectaron valores utilizables en el extracto. Ingresa los datos manualmente.");
    } else {
      toast.success(
        `Extracto ${moneda === "uvr" ? "UVR" : "PESOS"} aplicado (${filled} campos). Solo falta indicar el periodo a consultar y presionar Calcular.`,
        { duration: 5000 },
      );
    }
    return true;
  }

  async function handleExportExcel() {
    if (!rows.length) return toast.error("Primero calcula la amortización");
    const XLSX = await import("xlsx");
    const data = [
      ["NUVIA AMORTIZATION ENGINE"],
      [`TEA: ${(teaNum * 100).toFixed(4)}%`, `Tasa Mensual: ${(tasaMensual * 100).toFixed(6)}%`],
      [`Valor crédito: ${valorNum}`, `Plazo: ${plazoNum} meses`, `Seguros mensuales: ${segurosNum}`],
      [],
      ["Periodo", "Saldo inicial", "Cuota financiera", "Interés", "Capital", "Seguros", "Total cuota", "Saldo final"],
      ...rows.map((r) => [
        r.periodo,
        Math.round(r.saldoInicial),
        Math.round(r.cuota),
        Math.round(r.interes),
        Math.round(r.capital),
        Math.round(r.seguros),
        Math.round(r.totalCuota),
        Math.round(r.saldoFinal),
      ]),
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
    const W = doc.internal.pageSize.getWidth();

    // Header band
    doc.setFillColor(8, 16, 40);
    doc.rect(0, 0, W, 90, "F");
    doc.setTextColor(132, 185, 143);
    doc.setFontSize(9);
    doc.text("NUVIA · MATHEMATICAL ENGINE", 40, 32);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("Amortization Engine", 40, 55);
    doc.setFontSize(9);
    doc.setTextColor(200, 210, 230);
    doc.text(`Composición matemática exacta · Modalidad ${modo === "uvr" ? "UVR" : "PESOS"}`, 40, 72);

    // Datos base
    let y = 120;
    doc.setTextColor(15, 26, 51);
    doc.setFontSize(11);
    doc.text("Datos del crédito", 40, y);
    y += 6;
    autoTable(doc, {
      startY: y + 4,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [15, 26, 51], textColor: 255 },
      head: [["Concepto", "Valor"]],
      body: [
        ["TEA", `${(teaNum * 100).toFixed(4)}%`],
        ["Tasa mensual (equivalente)", `${(tasaMensual * 100).toFixed(6)}%`],
        ["Valor crédito", fmtCOP(valorNum)],
        ["Plazo", `${plazoNum} meses`],
        ["Seguros mensuales", fmtCOP(segurosNum)],
      ],
    });

    // Cuota consultada
    // @ts-expect-error autotable augments
    y = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(11);
    doc.text(`Cuota consultada · #${currentRow.periodo}`, 40, y);
    autoTable(doc, {
      startY: y + 6,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [68, 93, 163], textColor: 255 },
      head: [["Concepto", "Valor"]],
      body: [
        ["Saldo inicial", fmtCOP(currentRow.saldoInicial)],
        ["Cuota financiera", fmtCOP(currentRow.cuota)],
        ["Interés del periodo", fmtCOP(currentRow.interes)],
        ["Capital abonado", fmtCOP(currentRow.capital)],
        ["Seguros", fmtCOP(currentRow.seguros)],
        ["Total cuota", fmtCOP(currentRow.totalCuota)],
        ["Saldo final", fmtCOP(currentRow.saldoFinal)],
      ],
    });

    // Insight
    // @ts-expect-error
    y = doc.lastAutoTable.finalY + 16;
    doc.setFontSize(10);
    doc.setTextColor(68, 93, 163);
    doc.text("NUVIA Insight", 40, y);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(insight, W - 80);
    doc.text(lines, 40, y + 14);
    y = y + 14 + lines.length * 12 + 10;

    // Tabla resumida
    const first12 = rows.slice(0, 12);
    const last12 = rows.slice(-12);
    const showLast = rows.length > 24;

    const bodyRows = [
      ...first12.map((r) => [
        r.periodo,
        fmtCOP(r.saldoInicial),
        fmtCOP(r.interes),
        fmtCOP(r.capital),
        fmtCOP(r.totalCuota),
        fmtCOP(r.saldoFinal),
      ]),
      ...(showLast
        ? [["…", "…", "…", "…", "…", "…"], ...last12.map((r) => [
            r.periodo,
            fmtCOP(r.saldoInicial),
            fmtCOP(r.interes),
            fmtCOP(r.capital),
            fmtCOP(r.totalCuota),
            fmtCOP(r.saldoFinal),
          ])]
        : []),
    ];
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [15, 26, 51], textColor: 255 },
      head: [["#", "Saldo inicial", "Interés", "Capital", "Total cuota", "Saldo final"]],
      body: bodyRows,
    });

    doc.save(`NUVIA_Amortizacion_${Date.now()}.pdf`);
    toast.success("PDF descargado");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050816] text-white">
      <BackgroundFX />
      <div className="relative mx-auto w-full max-w-[1400px] px-6 py-8">
        {/* Back */}
        <Link
          to="/herramientas"
          className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a Herramientas
        </Link>

        {/* HERO */}
        <Hero modo={modo} />

        {/* LECTOR DE EXTRACTOS */}
        <div className="mt-8">
          <PremiumCard>
            <CardHeader
              icon={<FileText className="h-4 w-4" />}
              badge="Auto-fill"
              title="Lector de extractos NUVIA"
              subtitle="Arrastra o carga el extracto (PESOS o UVR). NUVIA detecta la modalidad y autocompleta TEA, plazo, valor y seguros. Solo debe quedar pendiente el periodo a consultar."
            />
            <div className="mt-5">
              <ExtractoReader modo={modo} onApply={handleExtractoApply} />
            </div>
          </PremiumCard>
        </div>

        {/* PANEL PRINCIPAL */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {/* LEFT: Inputs */}
          <PremiumCard>
            <CardHeader
              icon={<Calculator className="h-4 w-4" />}
              badge="Input"
              title="Datos del crédito"
              subtitle={
                modo === "uvr"
                  ? "Sistema francés en UVR. Ingresa la TEA UVR, el saldo en UVR y la variación anual esperada."
                  : "Ingresa los parámetros del sistema francés en pesos."
              }
            />

            {/* Modo toggle PESOS / UVR */}
            <div className="mt-5 inline-flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(["pesos", "uvr"] as const).map((m) => {
                const active = modo === m;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setModo(m);
                      setCalculated(false);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition ${
                      active ? "text-white" : "text-white/50 hover:text-white/80"
                    }`}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`,
                            boxShadow: `0 8px 20px -10px ${NUVEX.verde}`,
                          }
                        : undefined
                    }
                  >
                    {m === "pesos" ? "Pesos" : "UVR"}
                  </button>
                );
              })}
            </div>

            <div className="space-y-4 mt-5">
              <NField
                label={modo === "uvr" ? "TEA UVR (Tasa Efectiva Anual)" : "TEA (Tasa Efectiva Anual)"}
                icon={<Percent className="h-3.5 w-3.5" />}
                suffix="%"
                value={tea}
                onChange={setTea}
                placeholder={modo === "uvr" ? "8.5" : "13.5"}
              />
              <NField
                label="Plazo aprobado"
                icon={<Calendar className="h-3.5 w-3.5" />}
                suffix="meses"
                value={plazo}
                onChange={setPlazo}
                placeholder="180"
              />
              <NField
                label={modo === "uvr" ? "Valor crédito en UVR" : "Valor crédito aprobado"}
                icon={<DollarSign className="h-3.5 w-3.5" />}
                prefix={modo === "uvr" ? "" : "$"}
                suffix={modo === "uvr" ? "UVR" : undefined}
                value={valor}
                onChange={setValor}
                placeholder={modo === "uvr" ? "500000" : "200.000.000"}
              />
              {modo === "uvr" && (
                <>
                  <NField
                    label="UVR inicial (COP por UVR)"
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    prefix="$"
                    value={uvrInicial}
                    onChange={setUvrInicial}
                    placeholder="340.50"
                  />
                  <NField
                    label="Variación UVR anual esperada"
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    suffix="% EA"
                    value={varUvr}
                    onChange={setVarUvr}
                    placeholder="5.5"
                  />
                </>
              )}
              <NField
                label="Periodo a consultar"
                icon={<Target className="h-3.5 w-3.5" />}
                suffix={`/ ${plazoNum || "n"}`}
                value={periodo}
                onChange={setPeriodo}
                placeholder="1"
              />
              <NField
                label="Seguros mensuales (COP)"
                icon={<ShieldCheck className="h-3.5 w-3.5" />}
                prefix="$"
                value={seguros}
                onChange={setSeguros}
                placeholder="120.000"
              />


              {calculated && tasaMensual > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-xs"
                >
                  <div className="text-white/50 uppercase tracking-wider text-[10px] font-semibold">Tasa mensual equivalente</div>
                  <div className="text-white font-semibold text-lg tabular-nums mt-0.5">
                    {fmtPct(tasaMensual, 6)}
                  </div>
                </motion.div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCalculate}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})`,
                    boxShadow: `0 12px 30px -12px ${NUVEX.verde}`,
                  }}
                >
                  Calcular
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 hover:bg-white/[0.06] hover:text-white transition inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
            </div>
          </PremiumCard>

          {/* RIGHT: Cuota consultada */}
          <PremiumCard>
            <CardHeader
              icon={<TrendingUp className="h-4 w-4" />}
              badge={calculated ? `Cuota #${currentRow?.periodo ?? "-"}` : "Awaiting input"}
              title="Cuota consultada"
              subtitle="Discriminación exacta de la cuota seleccionada."
            />
            <AnimatePresence mode="wait">
              {calculated && currentRow ? (
                <motion.div
                  key={currentRow.periodo + "-" + valorNum}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 grid grid-cols-2 gap-3"
                >
                  <KPI label="Saldo inicial" value={currentRow.saldoInicial} color={NUVEX.azul} />
                  <KPI label="Cuota financiera" value={currentRow.cuota} color="#9333EA" />
                  <KPI label="Interés del periodo" value={currentRow.interes} color="#EF4444" />
                  <KPI label="Capital abonado" value={currentRow.capital} color={NUVEX.verde} />
                  <KPI label="Seguros" value={currentRow.seguros} color="#F59E0B" />
                  <KPI label="Total cuota" value={currentRow.totalCuota} color="#38BDF8" strong />
                  <div className="col-span-2">
                    <KPI label="Saldo final" value={currentRow.saldoFinal} color={NUVEX.verde} strong />
                  </div>
                </motion.div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
                  <Calculator className="h-8 w-8 mx-auto text-white/25 mb-3" />
                  <div className="text-sm text-white/50">
                    Ingresa los datos y presiona <span className="text-white/80 font-semibold">Calcular</span> para ver la discriminación de la cuota.
                  </div>
                </div>
              )}
            </AnimatePresence>

            {calculated && insight && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-5 rounded-2xl border border-white/10 p-4 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, rgba(68,93,163,0.15), rgba(132,185,143,0.10))",
                }}
              >
                <div className="absolute inset-x-4 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.6), transparent)" }} />
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}>
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#84B98F]">
                      NUVIA Insight
                    </div>
                    <p className="mt-1.5 text-sm text-white/80 leading-relaxed">{insight}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </PremiumCard>
        </div>

        {/* TABLA */}
        {calculated && rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8"
          >
            <PremiumCard>
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <CardHeader
                    icon={<FileSpreadsheet className="h-4 w-4" />}
                    badge="Mathematical output"
                    title="Tabla de amortización completa"
                    subtitle="Visualiza el comportamiento completo del crédito, mes a mes."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2 text-xs font-medium text-white/80 hover:text-white transition inline-flex items-center gap-1.5"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                  </button>
                  <button
                    onClick={handleExportPDF}
                    className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition hover:brightness-110 inline-flex items-center gap-1.5"
                    style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
                  >
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 overflow-hidden">
                <div className="max-h-[520px] overflow-auto nuvia-scroll">
                  <table className="w-full text-xs tabular-nums">
                    <thead className="sticky top-0 z-10 backdrop-blur-xl" style={{ background: "rgba(8,16,40,0.95)" }}>
                      <tr className="text-left text-[10.5px] uppercase tracking-wider text-white/60">
                        <Th>Periodo</Th>
                        <Th>Saldo inicial</Th>
                        <Th>Cuota financiera</Th>
                        <Th>Interés</Th>
                        <Th>Capital</Th>
                        <Th>Seguros</Th>
                        <Th>Total cuota</Th>
                        <Th>Saldo final</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const isCurrent = r.periodo === periodoNum;
                        return (
                          <tr
                            key={r.periodo}
                            className={`transition-colors border-t border-white/[0.04] hover:bg-white/[0.04] ${
                              isCurrent ? "bg-[rgba(132,185,143,0.08)]" : r.periodo % 2 === 0 ? "bg-white/[0.015]" : ""
                            }`}
                          >
                            <Td strong={isCurrent}>
                              {isCurrent && (
                                <span
                                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                                  style={{ background: NUVEX.verde, boxShadow: `0 0 8px ${NUVEX.verde}` }}
                                />
                              )}
                              {r.periodo}
                            </Td>
                            <Td>{fmtCOP(r.saldoInicial)}</Td>
                            <Td>{fmtCOP(r.cuota)}</Td>
                            <Td className="text-red-300/90">{fmtCOP(r.interes)}</Td>
                            <Td className="text-emerald-300/90">{fmtCOP(r.capital)}</Td>
                            <Td className="text-amber-300/80">{fmtCOP(r.seguros)}</Td>
                            <Td strong>{fmtCOP(r.totalCuota)}</Td>
                            <Td>{fmtCOP(r.saldoFinal)}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </PremiumCard>
          </motion.div>
        )}

        <div className="h-16" />
      </div>

      <style>{`
        .nuvia-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .nuvia-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .nuvia-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(68,93,163,0.5), rgba(132,185,143,0.4));
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// SUBCOMPONENTS
// ============================================================================

function Hero({ modo }: { modo: "pesos" | "uvr" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 p-8"
      style={{
        background:
          "linear-gradient(135deg, rgba(15,26,51,0.9), rgba(8,16,40,0.9))",
        boxShadow: "0 30px 60px -30px rgba(0,0,0,0.9)",
      }}
    >
      <div
        className="absolute -top-24 -right-24 h-72 w-72 rounded-full blur-3xl opacity-40"
        style={{ background: `radial-gradient(circle, ${NUVEX.azul}, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle, ${NUVEX.verde}, transparent 70%)` }}
      />
      <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="flex items-start gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15"
            style={{
              background: "linear-gradient(135deg, rgba(68,93,163,0.85), rgba(132,185,143,0.85))",
              boxShadow: `0 16px 40px -16px ${NUVEX.verde}`,
            }}
          >
            <Calculator className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#84B98F] flex items-center gap-1.5">
              <Sparkles size={12} /> NUVIA · Financial intelligence
            </div>
            <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight text-white">
              NUVIA Amortization Engine
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/60 leading-relaxed">
              Analiza la composición matemática exacta de cualquier cuota de tu crédito.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge icon={<Calculator className="h-3 w-3" />} label="Mathematical Engine" tone="blue" />
          <Badge icon={<Lock className="h-3 w-3" />} label={modo === "uvr" ? "Modalidad UVR" : "Modalidad PESOS"} tone="green" />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative mt-6 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] p-3.5 flex items-start gap-3"
      >
        <Info className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-100/85 leading-relaxed">
          <b className="text-amber-200">Alcance del motor:</b> NUVIA Amortization Engine soporta créditos en <b>PESOS</b> (sistema francés de cuota fija) y en <b>UVR</b> (con proyección de variación anual esperada). Selecciona la modalidad arriba o carga el extracto para autodetectar.
        </div>
      </motion.div>
    </motion.div>
  );
}

function Badge({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: "blue" | "green" }) {
  const bg =
    tone === "blue"
      ? "linear-gradient(135deg, rgba(68,93,163,0.25), rgba(68,93,163,0.10))"
      : "linear-gradient(135deg, rgba(132,185,143,0.25), rgba(132,185,143,0.10))";
  const bd = tone === "blue" ? "rgba(68,93,163,0.4)" : "rgba(132,185,143,0.5)";
  const tx = tone === "blue" ? "#A5B4E8" : "#B5DFC0";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-xl"
      style={{ background: bg, borderColor: bd, color: tx }}
    >
      {icon} {label}
    </span>
  );
}

function PremiumCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -2 }}
      className="relative rounded-[22px] border border-white/[0.08] bg-white/[0.025] backdrop-blur-2xl p-6"
      style={{ boxShadow: "0 30px 60px -40px rgba(0,0,0,0.9)" }}
    >
      <span
        className="pointer-events-none absolute inset-x-8 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(132,185,143,0.5), transparent)" }}
      />
      {children}
    </motion.div>
  );
}

function CardHeader({ icon, badge, title, subtitle }: { icon: React.ReactNode; badge: string; title: string; subtitle: string }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#84B98F]">
        {icon} {badge}
      </div>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-1 text-xs text-white/50">{subtitle}</p>
    </div>
  );
}

function NField({
  label,
  icon,
  prefix,
  suffix,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/50 mb-1.5">
        {icon} {label}
      </label>
      <div className="group relative flex items-center rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-[#84B98F]/50 focus-within:bg-white/[0.05] transition">
        {prefix && <span className="pl-3 text-white/40 text-sm">{prefix}</span>}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, "").replace(",", "."))}
          placeholder={placeholder}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none tabular-nums"
        />
        {suffix && <span className="pr-3 text-white/40 text-xs">{suffix}</span>}
      </div>
    </div>
  );
}

function KPI({ label, value, color, strong }: { label: string; value: number; color: string; strong?: boolean }) {
  const display = useCountUp(value);
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 overflow-hidden group"
    >
      <div
        className="absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</div>
        <div
          className={`mt-1.5 tabular-nums ${strong ? "text-2xl" : "text-xl"} font-semibold text-white`}
          style={strong ? { textShadow: `0 0 20px ${color}55` } : undefined}
        >
          {fmtCOP(display)}
        </div>
      </div>
    </motion.div>
  );
}

function useCountUp(target: number, duration = 700) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const from = 0;
    const start = performance.now();
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-3 font-semibold text-white/70 whitespace-nowrap">{children}</th>;
}
function Td({ children, className = "", strong }: { children: React.ReactNode; className?: string; strong?: boolean }) {
  return (
    <td className={`px-3 py-2.5 whitespace-nowrap text-white/85 ${strong ? "font-semibold text-white" : ""} ${className}`}>
      {children}
    </td>
  );
}

function BackgroundFX() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 15% 10%, rgba(68,93,163,0.35), transparent 55%), radial-gradient(circle at 85% 85%, rgba(132,185,143,0.28), transparent 55%), radial-gradient(circle at 50% 50%, rgba(147,51,234,0.15), transparent 60%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(180deg, #050816 0%, #081028 100%)", opacity: 0.6 }} />
    </>
  );
}
