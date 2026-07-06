import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  PiggyBank,
  Plus,
  Trash2,
  Sparkles,
  TrendingDown,
  Calendar,
  DollarSign,
  Clock,
  Target,
  RotateCcw,
  Zap,
  Percent,
  Wand2,
  User,
  FileDown,
  FileSpreadsheet,
  Shield,
  Gift,
} from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { toast } from "sonner";
import { ProductoBancarioSelect } from "@/components/nuvex/ProductoBancarioSelect";
import { exportAbonosPDF, exportAbonosExcel, type AbonoRow } from "@/lib/abonosExport";

export const Route = createFileRoute("/_authenticated/herramientas/abonos")({
  head: () => ({
    meta: [
      { title: "NUVIA Extra Payments Simulator" },
      {
        name: "description",
        content:
          "Simula abonos extraordinarios a capital en créditos Pesos o UVR. Calcula ahorro real de intereses, cuotas eliminadas y nueva fecha de finalización.",
      },
    ],
  }),
  component: ExtraPayments,
});

/* ============================================================================
   MATH
============================================================================ */
type Modo = "pesos" | "uvr";
type Destino = "plazo" | "cuota" | "distribuido";

type Abono = {
  id: string;
  cuota: number;
  monto: number;
  destino: Destino;
};

type FilaSim = {
  periodo: number;
  saldoInicial: number;
  cuota: number;
  interes: number;
  capital: number;
  abono: number;
  abonoMensual: number;
  saldoFinal: number;
  saldoInicialCOP?: number;
  cuotaCOP?: number;
  abonoCOP?: number;
  abonoMensualCOP?: number;
  saldoFinalCOP?: number;
};

const tasaMensualFromTEA = (tea: number) => Math.pow(1 + tea, 1 / 12) - 1;
const cuotaFija = (v: number, i: number, n: number) =>
  i === 0 ? v / n : (v * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);

function simular(
  valor: number,
  tea: number,
  n: number,
  abonos: Abono[],
): { rows: FilaSim[]; totalInteres: number; cuotasUsadas: number; cuotaFinal: number } {
  const i = tasaMensualFromTEA(tea);
  let cuota = cuotaFija(valor, i, n);
  let saldo = valor;
  let restantes = n;
  const rows: FilaSim[] = [];
  let totalInteres = 0;
  let periodo = 1;

  // Split: abonos lump (plazo/cuota) por periodo + distribuidos como extras mensuales
  const lumpMap = new Map<number, Abono[]>();
  const extrasByPeriod = new Map<number, number>();
  for (const a of abonos) {
    if (a.destino === "distribuido") {
      const meses = Math.max(1, n - a.cuota + 1);
      const extra = a.monto / meses;
      for (let p = a.cuota; p <= n; p++) {
        extrasByPeriod.set(p, (extrasByPeriod.get(p) ?? 0) + extra);
      }
    } else {
      if (!lumpMap.has(a.cuota)) lumpMap.set(a.cuota, []);
      lumpMap.get(a.cuota)!.push(a);
    }
  }

  while (saldo > 0.01 && periodo <= n + 12) {
    const interes = saldo * i;
    let capital = cuota - interes;
    if (capital > saldo) capital = saldo;
    let saldoDespuesCuota = Math.max(0, saldo - capital);
    let abonoTotal = 0;
    let destinoAplicado: Destino | null = null;

    const abonosPeriodo = lumpMap.get(periodo);
    if (abonosPeriodo) {
      for (const a of abonosPeriodo) {
        const monto = Math.min(a.monto, saldoDespuesCuota);
        saldoDespuesCuota -= monto;
        abonoTotal += monto;
        destinoAplicado = a.destino;
      }
    }

    const extraProg = extrasByPeriod.get(periodo) ?? 0;
    const abonoMensual = Math.min(extraProg, saldoDespuesCuota);
    saldoDespuesCuota -= abonoMensual;

    totalInteres += interes;
    rows.push({
      periodo,
      saldoInicial: saldo,
      cuota,
      interes,
      capital,
      abono: abonoTotal,
      abonoMensual,
      saldoFinal: saldoDespuesCuota,
    });

    saldo = saldoDespuesCuota;
    restantes -= 1;

    if (abonoTotal > 0 && destinoAplicado === "cuota" && saldo > 0 && restantes > 0) {
      cuota = cuotaFija(saldo, i, restantes);
    }
    periodo += 1;
  }

  return {
    rows,
    totalInteres,
    cuotasUsadas: rows.length,
    cuotaFinal: cuota,
  };
}

/* ============================================================================
   COMPONENT
============================================================================ */
function ExtraPayments() {
  const [modo, setModo] = useState<Modo>("pesos");

  // ── Cliente / banco / producto
  const [cliente, setCliente] = useState("");
  const [banco, setBanco] = useState("");
  const [producto, setProducto] = useState("");

  // Datos base
  const [valorStr, setValorStr] = useState("");
  const [teaStr, setTeaStr] = useState("");
  const [plazoStr, setPlazoStr] = useState("");
  const [segurosStr, setSegurosStr] = useState("");
  const [uvrInicialStr, setUvrInicialStr] = useState("");
  const [uvrVarEAStr, setUvrVarEAStr] = useState("6.5");

  // Fresh
  const [freshActivo, setFreshActivo] = useState(false);
  const [freshValorStr, setFreshValorStr] = useState("");
  const [freshCuotasStr, setFreshCuotasStr] = useState("");

  const [abonos, setAbonos] = useState<Abono[]>([]);
  const [showTable, setShowTable] = useState(false);

  const valor = parseFloat(valorStr) || 0;
  const tea = (parseFloat(teaStr) || 0) / 100;
  const plazo = parseInt(plazoStr) || 0;
  const seguros = parseFloat(segurosStr) || 0;
  const freshValor = parseFloat(freshValorStr) || 0;
  const freshCuotas = parseInt(freshCuotasStr) || 0;
  const uvrInicial = parseFloat(uvrInicialStr) || 0;
  const uvrVarEA = (parseFloat(uvrVarEAStr) || 0) / 100;
  const uvrVarMensual = Math.pow(1 + uvrVarEA, 1 / 12) - 1;

  const puedeSimular = valor > 0 && tea > 0 && plazo > 0 && (modo === "pesos" || uvrInicial > 0);

  const base = useMemo(() => {
    if (!puedeSimular) return null;
    return simular(valor, tea, plazo, []);
  }, [valor, tea, plazo, puedeSimular]);

  const conAbonos = useMemo(() => {
    if (!puedeSimular) return null;
    return simular(valor, tea, plazo, abonos);
  }, [valor, tea, plazo, abonos, puedeSimular]);

  // Comparador global: ambas estrategias con los MISMOS abonos.
  const simPlazo = useMemo(() => {
    if (!puedeSimular || abonos.length === 0) return null;
    return simular(valor, tea, plazo, abonos.map((a) => ({ ...a, destino: "plazo" as Destino })));
  }, [valor, tea, plazo, abonos, puedeSimular]);
  const simCuota = useMemo(() => {
    if (!puedeSimular || abonos.length === 0) return null;
    return simular(valor, tea, plazo, abonos.map((a) => ({ ...a, destino: "cuota" as Destino })));
  }, [valor, tea, plazo, abonos, puedeSimular]);
  const simDistribuido = useMemo(() => {
    if (!puedeSimular || abonos.length === 0) return null;
    return simular(valor, tea, plazo, abonos.map((a) => ({ ...a, destino: "distribuido" as Destino })));
  }, [valor, tea, plazo, abonos, puedeSimular]);

  const [showComparador, setShowComparador] = useState(true);
  const aplicarDestinoATodos = (destino: Destino) => {
    setAbonos((prev) => prev.map((a) => ({ ...a, destino })));
    toast.success(
      destino === "plazo"
        ? "Todos los abonos se aplicarán para reducir plazo"
        : destino === "cuota"
        ? "Todos los abonos se aplicarán para reducir cuota"
        : "Todos los abonos se distribuirán mensualmente en el plazo restante",
    );
  };


  // Enriquecer filas con seguros + fresh + cuota pagada (incluye abono mensual distribuido)
  const enrich = (rows: FilaSim[]): AbonoRow[] =>
    rows.map((r) => {
      const uvrMes = modo === "uvr" ? uvrInicial * Math.pow(1 + uvrVarMensual, r.periodo - 1) : 1;
      const isUVR = modo === "uvr";
      const cuotaBaseCOP = isUVR ? r.cuota * uvrMes : r.cuota;
      const abonoMensualCOP = isUVR ? r.abonoMensual * uvrMes : r.abonoMensual;
      const freshEn = freshActivo && r.periodo <= freshCuotas ? freshValor : 0;
      const cuotaPagadaCOP = Math.max(0, cuotaBaseCOP + seguros + abonoMensualCOP - freshEn);
      return {
        periodo: r.periodo,
        saldoInicial: r.saldoInicial,
        cuota: r.cuota,
        interes: r.interes,
        capital: r.capital,
        seguros,
        fresh: freshEn,
        cuotaPagada: cuotaPagadaCOP,
        abono: r.abono,
        abonoMensual: r.abonoMensual,
        abonoMensualCOP,
        saldoFinal: r.saldoFinal,
        ...(isUVR
          ? {
              saldoInicialCOP: r.saldoInicial * uvrMes,
              cuotaCOP: r.cuota * uvrMes,
              abonoCOP: r.abono * uvrMes,
              saldoFinalCOP: r.saldoFinal * uvrMes,
            }
          : {}),
      };
    });


  const rowsBaseEnriched = useMemo(() => (base ? enrich(base.rows) : []), [base, seguros, freshActivo, freshValor, freshCuotas, modo, uvrInicial, uvrVarMensual]);
  const rowsConEnriched = useMemo(() => (conAbonos ? enrich(conAbonos.rows) : []), [conAbonos, seguros, freshActivo, freshValor, freshCuotas, modo, uvrInicial, uvrVarMensual]);

  const ahorroInteres = base && conAbonos ? base.totalInteres - conAbonos.totalInteres : 0;
  const cuotasAhorradas = base && conAbonos ? base.cuotasUsadas - conAbonos.cuotasUsadas : 0;
  const ahorroInteresCOP = modo === "uvr" ? ahorroInteres * uvrInicial : ahorroInteres;

  const nuevaFecha = useMemo(() => {
    if (!conAbonos) return "—";
    const d = new Date();
    d.setMonth(d.getMonth() + conAbonos.cuotasUsadas);
    return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  }, [conAbonos]);

  const fechaBase = useMemo(() => {
    if (!base) return "—";
    const d = new Date();
    d.setMonth(d.getMonth() + base.cuotasUsadas);
    return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  }, [base]);

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
  const fmtUVR = (n: number) =>
    new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n || 0);
  const fmt = (n: number) => (modo === "uvr" ? `${fmtUVR(n)} UVR` : fmtCOP(n));

  const addAbono = () =>
    setAbonos((prev) => [
      ...prev,
      { id: crypto.randomUUID(), cuota: 12, monto: 0, destino: "plazo" },
    ]);

  const updateAbono = (id: string, patch: Partial<Abono>) =>
    setAbonos((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const removeAbono = (id: string) => setAbonos((prev) => prev.filter((a) => a.id !== id));

  const aplicarPresetPrima = (mes: "junio" | "diciembre") => {
    if (!plazo) {
      toast.error("Ingresa primero el plazo del crédito");
      return;
    }
    const target = mes === "junio" ? 6 : 12;
    const nuevos: Abono[] = [];
    for (let y = 0; y * 12 + target <= plazo; y++) {
      nuevos.push({
        id: crypto.randomUUID(),
        cuota: y * 12 + target,
        monto: modo === "uvr" ? 500 : 3_000_000,
        destino: "plazo",
      });
    }
    setAbonos((prev) => [...prev, ...nuevos]);
    toast.success(`${nuevos.length} abonos programados (prima ${mes})`);
  };

  const resetAll = () => {
    setCliente("");
    setBanco("");
    setProducto("");
    setValorStr("");
    setTeaStr("");
    setPlazoStr("");
    setSegurosStr("");
    setUvrInicialStr("");
    setFreshActivo(false);
    setFreshValorStr("");
    setFreshCuotasStr("");
    setAbonos([]);
    toast.info("Simulación reiniciada");
  };

  const buildCtx = () => ({
    cliente,
    banco,
    producto,
    modo,
    valor,
    tea: parseFloat(teaStr) || 0,
    plazo,
    seguros,
    fresh: { activo: freshActivo, valorMensual: freshValor, cuotasPendientes: freshCuotas },
    fechaGeneracion: new Date(),
    base: {
      cuotasUsadas: base?.cuotasUsadas ?? 0,
      cuotaFinal: modo === "uvr" ? (base?.cuotaFinal ?? 0) * uvrInicial : base?.cuotaFinal ?? 0,
      totalInteres: modo === "uvr" ? (base?.totalInteres ?? 0) * uvrInicial : base?.totalInteres ?? 0,
      fechaFin: fechaBase,
      rows: rowsBaseEnriched,
    },
    optimizado: {
      cuotasUsadas: conAbonos?.cuotasUsadas ?? 0,
      cuotaFinal: modo === "uvr" ? (conAbonos?.cuotaFinal ?? 0) * uvrInicial : conAbonos?.cuotaFinal ?? 0,
      totalInteres: modo === "uvr" ? (conAbonos?.totalInteres ?? 0) * uvrInicial : conAbonos?.totalInteres ?? 0,
      fechaFin: nuevaFecha,
      rows: rowsConEnriched,
    },
    abonos: abonos.map((a) => ({ cuota: a.cuota, monto: a.monto, destino: a.destino })),
    ahorroInteresCOP,
    cuotasAhorradas,
    comparador:
      simPlazo && simCuota && simDistribuido && base
        ? (() => {
            const toCOP = (n: number) => (modo === "uvr" ? n * uvrInicial : n);
            const fechaFinDe = (cuotas: number) => {
              const d = new Date();
              d.setMonth(d.getMonth() + cuotas);
              return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
            };
            const mkResumen = (sim: NonNullable<typeof simPlazo>, extraMensualProm = 0) => ({
              cuotasUsadas: sim.cuotasUsadas,
              cuotaFinal: toCOP(sim.cuotaFinal),
              totalInteres: toCOP(sim.totalInteres),
              fechaFin: fechaFinDe(sim.cuotasUsadas),
              ahorroInteres: toCOP(base.totalInteres - sim.totalInteres),
              cuotasEliminadas: base.cuotasUsadas - sim.cuotasUsadas,
              extraMensualProm,
            });
            const totalAbono = abonos.reduce((s, a) => s + a.monto, 0);
            // Promedio de aumento mensual si todo se distribuye
            const promMes =
              abonos.reduce(
                (s, a) => s + a.monto / Math.max(1, plazo - a.cuota + 1),
                0,
              );
            const plazoR = mkResumen(simPlazo);
            const cuotaR = mkResumen(simCuota);
            const distribuidoR = mkResumen(simDistribuido, toCOP(promMes));
            const opciones: Array<{ key: "plazo" | "cuota" | "distribuido"; ahorro: number }> = [
              { key: "plazo", ahorro: plazoR.ahorroInteres },
              { key: "cuota", ahorro: cuotaR.ahorroInteres },
              { key: "distribuido", ahorro: distribuidoR.ahorroInteres },
            ];
            const recomendado = opciones.sort((a, b) => b.ahorro - a.ahorro)[0].key;
            return {
              plazo: plazoR,
              cuota: cuotaR,
              distribuido: distribuidoR,
              totalAbono: toCOP(totalAbono),
              recomendado,
            };
          })()
        : undefined,
  });


  const handleExportPDF = () => {
    if (!puedeSimular) {
      toast.error("Completa los datos base para generar el PDF");
      return;
    }
    try {
      exportAbonosPDF(buildCtx());
      toast.success("PDF generado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el PDF");
    }
  };

  const handleExportExcel = () => {
    if (!puedeSimular) {
      toast.error("Completa los datos base para descargar la proyección");
      return;
    }
    try {
      exportAbonosExcel(buildCtx());
      toast.success("Proyección descargada");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el archivo");
    }
  };

  /* --------------------------------- UI --------------------------------- */
  return (
    <div className="relative min-h-screen bg-[#050816] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 55% at 20% 5%, rgba(132,185,143,0.18), transparent 60%), radial-gradient(70% 55% at 85% 90%, rgba(68,93,163,0.22), transparent 60%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1360px] px-6 py-8 space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              to="/herramientas"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition"
            >
              <ArrowLeft className="h-4 w-4" /> Herramientas
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${NUVEX.verde}55, ${NUVEX.azul}55)`,
                    boxShadow: `0 12px 40px -12px ${NUVEX.verde}`,
                  }}
                >
                  <PiggyBank className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  NUVIA Extra Payments Simulator
                </h1>
              </div>
              <p className="mt-1 text-[13px] text-white/55">
                Simula abonos extraordinarios a capital y visualiza el ahorro real en intereses y tiempo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 rounded-xl border border-[#84B98F]/40 bg-[#84B98F]/10 px-3 py-2 text-xs font-semibold text-[#84B98F] hover:bg-[#84B98F]/20 transition"
            >
              <FileSpreadsheet className="h-4 w-4" /> Descargar proyecciones
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white hover:bg-white/[0.12] transition"
              style={{ boxShadow: `0 12px 40px -20px ${NUVEX.azul}` }}
            >
              <FileDown className="h-4 w-4" /> Descargar PDF
            </button>
            <button
              onClick={() => setModo(modo === "pesos" ? "uvr" : "pesos")}
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition"
              style={{
                borderColor: modo === "uvr" ? `${NUVEX.verde}66` : "rgba(255,255,255,0.15)",
                background: modo === "uvr" ? `${NUVEX.verde}18` : "rgba(255,255,255,0.03)",
                color: modo === "uvr" ? NUVEX.verde : "rgba(255,255,255,0.7)",
              }}
            >
              <RotateCcw className="h-3 w-3" />
              {modo === "uvr" ? "Modalidad UVR" : "Solo modalidad pesos"}
            </button>
            <button
              onClick={resetAll}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>

        {/* CLIENT + PRODUCT */}
        <div className="rounded-2xl border border-white/[0.08] bg-[rgba(10,16,34,0.55)] p-5 backdrop-blur-2xl space-y-4">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
            <User className="h-3.5 w-3.5 text-[#84B98F]" /> Identificación del caso
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "rgba(225,232,248,0.65)" }}>
                Nombre del cliente
              </span>
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="nuvia-input"
              />
            </label>
            <div className="md:col-span-2">
              <ProductoBancarioSelect
                banco={banco}
                producto={producto}
                filtrarPorModalidad={modo}
                onChange={({ banco: b, producto: p }) => {
                  setBanco(b);
                  setProducto(p);
                }}
              />
            </div>
          </div>
        </div>

        {/* INPUT + KPIs */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-white/[0.08] bg-[rgba(10,16,34,0.55)] p-5 backdrop-blur-2xl space-y-5">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
              <Wand2 className="h-3.5 w-3.5 text-[#84B98F]" /> Input Console
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={modo === "uvr" ? "Valor crédito (UVR)" : "Valor crédito (COP)"}
                Icon={DollarSign}
                value={valorStr}
                onChange={setValorStr}
                placeholder={modo === "uvr" ? "45000" : "180000000"}
              />
              <Field label="Tasa EA (%)" Icon={Percent} value={teaStr} onChange={setTeaStr} placeholder="12.5" />
              <Field label="Plazo (meses)" Icon={Clock} value={plazoStr} onChange={setPlazoStr} placeholder="180" />
              <Field
                label="Seguros (COP mensual)"
                Icon={Shield}
                value={segurosStr}
                onChange={setSegurosStr}
                placeholder="120000"
              />
              {modo === "uvr" && (
                <>
                  <Field
                    label="UVR inicial (COP)"
                    Icon={DollarSign}
                    value={uvrInicialStr}
                    onChange={setUvrInicialStr}
                    placeholder="367.50"
                  />
                  <Field
                    label="Variación UVR EA (%)"
                    Icon={TrendingDown}
                    value={uvrVarEAStr}
                    onChange={setUvrVarEAStr}
                    placeholder="6.5"
                  />
                </>
              )}
            </div>

            {/* FRESH */}
            <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                  <Gift className="h-3.5 w-3.5" style={{ color: NUVEX.verde }} /> Beneficio Fresh
                </div>
                <div className="inline-flex rounded-lg border border-white/10 bg-black/30 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFreshActivo(true)}
                    className="rounded-md px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: freshActivo ? NUVEX.verde : "transparent",
                      color: freshActivo ? "white" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    SI aplica
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFreshActivo(false);
                      setFreshValorStr("");
                      setFreshCuotasStr("");
                    }}
                    className="rounded-md px-3 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: !freshActivo ? "rgba(255,255,255,0.12)" : "transparent",
                      color: !freshActivo ? "white" : "rgba(255,255,255,0.6)",
                    }}
                  >
                    NO
                  </button>
                </div>
              </div>
              {freshActivo && (
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Valor Fresh mensual (COP)"
                    Icon={DollarSign}
                    value={freshValorStr}
                    onChange={setFreshValorStr}
                    placeholder="450000"
                  />
                  <Field
                    label="Cuotas restantes Fresh"
                    Icon={Clock}
                    value={freshCuotasStr}
                    onChange={setFreshCuotasStr}
                    placeholder="48"
                  />
                </div>
              )}
            </div>

            {/* Presets */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60 mb-2">
                Presets rápidos
              </div>
              <div className="flex flex-wrap gap-2">
                <Preset onClick={() => aplicarPresetPrima("junio")} label="Prima junio (anual)" />
                <Preset onClick={() => aplicarPresetPrima("diciembre")} label="Prima diciembre (anual)" />
                <Preset
                  onClick={() => {
                    if (!plazo) return toast.error("Ingresa primero el plazo");
                    setAbonos((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        cuota: Math.min(24, plazo),
                        monto: modo === "uvr" ? 2000 : 10_000_000,
                        destino: "plazo",
                      },
                    ]);
                  }}
                  label="Abono único (cuota 24)"
                />
                <Preset
                  onClick={() => {
                    if (!plazo) return toast.error("Ingresa primero el plazo");
                    setAbonos((prev) => [
                      ...prev,
                      {
                        id: crypto.randomUUID(),
                        cuota: 1,
                        monto: modo === "uvr" ? 15000 : 50_000_000,
                        destino: "distribuido",
                      },
                    ]);
                  }}
                  label="Distribuir mensual"
                />
              </div>
            </div>


            {/* Tabla de abonos */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                  Abonos programados ({abonos.length})
                </div>
                <button
                  onClick={addAbono}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#84B98F]/40 bg-[#84B98F]/10 px-2.5 py-1 text-[11px] font-semibold text-[#84B98F] hover:bg-[#84B98F]/20 transition"
                >
                  <Plus className="h-3 w-3" /> Agregar
                </button>
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1">
                {abonos.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 py-6 text-center text-[12px] text-white/40">
                    Sin abonos. Agrega uno o usa un preset.
                  </div>
                ) : (
                  abonos.map((a) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[70px_1fr_110px_28px] gap-1.5 items-center rounded-lg border border-white/[0.08] bg-white/[0.02] p-1.5"
                    >
                      <input
                        type="number"
                        value={a.cuota}
                        onChange={(e) => updateAbono(a.id, { cuota: parseInt(e.target.value) || 1 })}
                        className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] text-white text-center focus:border-[#84B98F]/60 focus:outline-none"
                        placeholder="#"
                      />
                      <input
                        type="number"
                        value={a.monto || ""}
                        onChange={(e) => updateAbono(a.id, { monto: parseFloat(e.target.value) || 0 })}
                        className="h-8 rounded-md border border-white/10 bg-black/30 px-2 text-[12px] text-white focus:border-[#84B98F]/60 focus:outline-none"
                        placeholder={modo === "uvr" ? "UVR" : "COP"}
                      />
                      <select
                        value={a.destino}
                        onChange={(e) => updateAbono(a.id, { destino: e.target.value as Destino })}
                        className="h-8 rounded-md border border-white/10 bg-black/40 px-1.5 text-[11px] text-white focus:border-[#84B98F]/60 focus:outline-none"
                      >
                        <option value="plazo">↓ Plazo</option>
                        <option value="cuota">↓ Cuota</option>
                        <option value="distribuido">≡ Mensual</option>

                      </select>
                      <button
                        onClick={() => removeAbono(a.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-white/50 hover:text-red-400 hover:border-red-500/30 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* KPIs + Insight */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <KPI
                Icon={DollarSign}
                label="Ahorro en intereses"
                value={modo === "uvr" ? fmtCOP(ahorroInteresCOP) : fmtCOP(ahorroInteres)}
                sub={modo === "uvr" ? `${fmtUVR(ahorroInteres)} UVR` : "vs escenario base"}
                color={NUVEX.verde}
                hero
              />
              <KPI
                Icon={Clock}
                label="Cuotas eliminadas"
                value={cuotasAhorradas > 0 ? `-${cuotasAhorradas}` : "0"}
                sub={`${(cuotasAhorradas / 12).toFixed(1)} años de vida menos`}
                color="#7B61FF"
                hero
              />
              <KPI
                Icon={Target}
                label="Nueva cuota (aprox.)"
                value={
                  conAbonos
                    ? fmtCOP(
                        (modo === "uvr" ? conAbonos.cuotaFinal * uvrInicial : conAbonos.cuotaFinal) +
                          seguros -
                          (freshActivo && freshCuotas > 0 ? freshValor : 0),
                      )
                    : "—"
                }
                sub={base ? `Base + seguros: ${fmtCOP((modo === "uvr" ? base.cuotaFinal * uvrInicial : base.cuotaFinal) + seguros)}` : ""}
                color={NUVEX.azul}
              />
              <KPI
                Icon={Calendar}
                label="Nueva fecha final"
                value={nuevaFecha}
                sub={`Base: ${fechaBase}`}
                color="#e0a458"
              />
            </div>

            <div
              className="rounded-2xl border border-white/[0.08] p-4 backdrop-blur-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(132,185,143,0.10), rgba(68,93,163,0.06))",
              }}
            >
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-[#84B98F] shrink-0 mt-0.5" />
                <div className="text-[13px] leading-relaxed text-white/80">
                  {puedeSimular && abonos.length > 0 ? (
                    <>
                      Con <b>{abonos.length}</b> abono(s) programado(s), el cliente ahorra{" "}
                      <b style={{ color: NUVEX.verde }}>{fmtCOP(ahorroInteresCOP)}</b> en intereses y elimina{" "}
                      <b style={{ color: "#7B61FF" }}>{cuotasAhorradas}</b> cuotas del crédito.
                    </>
                  ) : puedeSimular ? (
                    <>Agrega uno o más abonos para ver el impacto en intereses y plazo.</>
                  ) : (
                    <>
                      Completa <b>valor</b>, <b>tasa EA</b> y <b>plazo</b>
                      {modo === "uvr" ? " + UVR inicial" : ""} para iniciar la simulación.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMPARADOR DE ESTRATEGIA */}
        {puedeSimular && base && simPlazo && simCuota && simDistribuido && (
          <ComparadorEstrategia
            open={showComparador}
            onToggle={() => setShowComparador((v) => !v)}
            modo={modo}
            uvrInicial={uvrInicial}
            base={base}
            simPlazo={simPlazo}
            simCuota={simCuota}
            simDistribuido={simDistribuido}
            plazoOriginal={plazo}
            abonos={abonos}
            seguros={seguros}
            fresh={{ activo: freshActivo, valor: freshValor }}
            onAplicar={aplicarDestinoATodos}
            actualDestino={
              abonos.length > 0 && abonos.every((a) => a.destino === abonos[0].destino)
                ? abonos[0].destino
                : null
            }
          />
        )}


        {/* CHART */}
        {puedeSimular && base && conAbonos && (
          <div className="rounded-2xl border border-white/[0.08] bg-[rgba(10,16,34,0.55)] p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-[#84B98F]" />
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                Saldo Base vs Con Abonos
              </div>
            </div>
            <SaldoChart baseRows={base.rows} conAbonos={conAbonos.rows} abonos={abonos} />
          </div>
        )}

        {/* TABLE */}
        {puedeSimular && conAbonos && (
          <div className="rounded-2xl border border-white/[0.08] bg-[rgba(10,16,34,0.55)] backdrop-blur-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#84B98F]" />
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                  Proyección completa ({conAbonos.rows.length} cuotas)
                </div>
              </div>
              <button
                onClick={() => setShowTable((v) => !v)}
                className="text-[11px] font-semibold text-[#84B98F] hover:underline"
              >
                {showTable ? "Ocultar" : "Mostrar"} tabla
              </button>
            </div>
            {showTable && (
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[rgba(10,16,34,0.95)] backdrop-blur-xl">
                    <tr className="text-left text-white/60">
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>#</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Saldo inicial</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Cuota</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Interés</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Capital</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Seguros</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: NUVEX.verde }}>Fresh</th>
                      <th className="px-3 py-2 font-semibold text-right" style={{ color: NUVEX.verde }}>Abono</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Cuota pagada</th>
                      <th className="px-3 py-2 font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>Saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsConEnriched.map((r) => {
                      const hasAbono = r.abono > 0;
                      return (
                        <tr
                          key={r.periodo}
                          className="border-t border-white/5"
                          style={{ background: hasAbono ? "rgba(132,185,143,0.08)" : "transparent" }}
                        >
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>{r.periodo}</td>
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                            {fmtCOP(r.saldoInicialCOP ?? r.saldoInicial)}
                          </td>
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>{fmt(r.cuota)}</td>
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.65)" }}>{fmt(r.interes)}</td>
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.85)" }}>{fmt(r.capital)}</td>
                          <td className="px-3 py-1.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                            {r.seguros > 0 ? fmtCOP(r.seguros) : "—"}
                          </td>
                          <td className="px-3 py-1.5" style={{ color: r.fresh > 0 ? NUVEX.verde : "rgba(255,255,255,0.3)" }}>
                            {r.fresh > 0 ? `- ${fmtCOP(r.fresh)}` : "—"}
                          </td>
                          <td
                            className="px-3 py-1.5 text-right font-semibold"
                            style={{ color: hasAbono ? NUVEX.verde : "rgba(255,255,255,0.3)" }}
                          >
                            {hasAbono ? `+ ${fmt(r.abono)}` : "—"}
                          </td>
                          <td className="px-3 py-1.5 font-semibold" style={{ color: "white" }}>
                            {fmtCOP(r.cuotaPagada)}
                          </td>
                          <td className="px-3 py-1.5 font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
                            {fmt(r.saldoFinal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   PIECES
============================================================================ */
function Field({
  label,
  Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/50">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 rounded-lg border border-white/10 bg-black/30 px-3 text-[13px] text-white focus:border-[#84B98F]/60 focus:outline-none transition"
      />
    </label>
  );
}

function Preset({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70 hover:bg-white/[0.08] hover:border-[#84B98F]/30 transition"
    >
      {label}
    </button>
  );
}

function KPI({
  Icon,
  label,
  value,
  sub,
  color,
  hero,
}: {
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
  hero?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.08] p-4 backdrop-blur-2xl"
      style={{
        background: `linear-gradient(135deg, ${color}12, rgba(10,16,34,0.6))`,
        boxShadow: `0 12px 40px -20px ${color}`,
      }}
    >
      <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
        <Icon className="h-3 w-3" style={{ color }} />
        {label}
      </div>
      <div
        className={`mt-1.5 font-semibold ${hero ? "text-[22px]" : "text-[16px]"} tracking-tight`}
        style={{ color: hero ? color : "white" }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-white/45">{sub}</div>}
    </motion.div>
  );
}

function SaldoChart({
  baseRows,
  conAbonos,
  abonos,
}: {
  baseRows: FilaSim[];
  conAbonos: FilaSim[];
  abonos: Abono[];
}) {
  const W = 900;
  const H = 220;
  const P = 30;
  const maxLen = Math.max(baseRows.length, conAbonos.length);
  const maxSaldo = Math.max(
    ...baseRows.map((r) => r.saldoInicial),
    ...conAbonos.map((r) => r.saldoInicial),
    1,
  );

  const x = (i: number) => P + (i / Math.max(1, maxLen - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - (v / maxSaldo) * (H - 2 * P);

  const path = (rows: FilaSim[]) =>
    rows.map((r, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(r.saldoInicial)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]">
      <defs>
        <linearGradient id="baseArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={NUVEX.azul} stopOpacity="0.35" />
          <stop offset="100%" stopColor={NUVEX.azul} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="conArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={NUVEX.verde} stopOpacity="0.4" />
          <stop offset="100%" stopColor={NUVEX.verde} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={P}
          x2={W - P}
          y1={P + f * (H - 2 * P)}
          y2={P + f * (H - 2 * P)}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="2 4"
        />
      ))}

      <path
        d={`${path(baseRows)} L ${x(baseRows.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`}
        fill="url(#baseArea)"
      />
      <path d={path(baseRows)} fill="none" stroke={NUVEX.azul} strokeWidth={1.6} />

      <path
        d={`${path(conAbonos)} L ${x(conAbonos.length - 1)} ${H - P} L ${x(0)} ${H - P} Z`}
        fill="url(#conArea)"
      />
      <path d={path(conAbonos)} fill="none" stroke={NUVEX.verde} strokeWidth={2} />

      {abonos.map((a) => {
        const idx = a.cuota - 1;
        if (idx < 0 || idx >= conAbonos.length) return null;
        return (
          <g key={a.id}>
            <circle
              cx={x(idx)}
              cy={y(conAbonos[idx].saldoInicial)}
              r={4}
              fill={NUVEX.verde}
              stroke="white"
              strokeWidth={1.5}
            />
          </g>
        );
      })}

      <g transform={`translate(${P}, ${P - 12})`}>
        <circle cx={0} cy={0} r={3} fill={NUVEX.azul} />
        <text x={8} y={4} fill="rgba(255,255,255,0.7)" fontSize={10}>
          Saldo base
        </text>
        <circle cx={90} cy={0} r={3} fill={NUVEX.verde} />
        <text x={98} y={4} fill="rgba(255,255,255,0.7)" fontSize={10}>
          Con abonos
        </text>
      </g>
    </svg>
  );
}

/* ============================================================================
   COMPARADOR ESTRATEGIA (3 escenarios: Plazo / Cuota / Distribuido)
============================================================================ */
function ComparadorEstrategia({
  open,
  onToggle,
  modo,
  uvrInicial,
  base,
  simPlazo,
  simCuota,
  simDistribuido,
  plazoOriginal,
  abonos,
  seguros,
  fresh,
  onAplicar,
  actualDestino,
}: {
  open: boolean;
  onToggle: () => void;
  modo: Modo;
  uvrInicial: number;
  base: { totalInteres: number; cuotasUsadas: number; cuotaFinal: number };
  simPlazo: { totalInteres: number; cuotasUsadas: number; cuotaFinal: number };
  simCuota: { totalInteres: number; cuotasUsadas: number; cuotaFinal: number };
  simDistribuido: { totalInteres: number; cuotasUsadas: number; cuotaFinal: number };
  plazoOriginal: number;
  abonos: Abono[];
  seguros: number;
  fresh: { activo: boolean; valor: number };
  onAplicar: (destino: Destino) => void;
  actualDestino: Destino | null;
}) {
  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  const toCOP = (v: number) => (modo === "uvr" ? v * uvrInicial : v);
  const cuotaBaseCOP = toCOP(base.cuotaFinal) + seguros - (fresh.activo ? fresh.valor : 0);

  const plazoAhorro = toCOP(base.totalInteres - simPlazo.totalInteres);
  const cuotaAhorro = toCOP(base.totalInteres - simCuota.totalInteres);
  const distAhorro = toCOP(base.totalInteres - simDistribuido.totalInteres);
  const plazoCuotasElim = base.cuotasUsadas - simPlazo.cuotasUsadas;
  const cuotaCuotasElim = base.cuotasUsadas - simCuota.cuotasUsadas;
  const distCuotasElim = base.cuotasUsadas - simDistribuido.cuotasUsadas;
  const cuotaFinalCuotaCOP = toCOP(simCuota.cuotaFinal) + seguros - (fresh.activo ? fresh.valor : 0);
  const deltaCuota = cuotaFinalCuotaCOP - cuotaBaseCOP;

  // Aumento mensual promedio si TODOS los abonos se distribuyen
  const extraMensualCOP = toCOP(
    abonos.reduce((s, a) => s + a.monto / Math.max(1, plazoOriginal - a.cuota + 1), 0),
  );
  const totalAbonoCOP = toCOP(abonos.reduce((s, a) => s + a.monto, 0));
  const nuevaCuotaDistCOP = cuotaBaseCOP + extraMensualCOP;

  const fechaFin = (cuotas: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + cuotas);
    return d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  };

  // Recomendación por mayor ahorro absoluto (empate → plazo)
  const opciones: Array<{ key: Destino; ahorro: number }> = [
    { key: "plazo", ahorro: plazoAhorro },
    { key: "cuota", ahorro: cuotaAhorro },
    { key: "distribuido", ahorro: distAhorro },
  ];
  const sorted = [...opciones].sort((a, b) => b.ahorro - a.ahorro);
  const recomendado = sorted[0].key;
  const segundo = sorted[1];
  const diferenciaAhorro = sorted[0].ahorro - segundo.ahorro;

  const labelDe = (k: Destino) =>
    k === "plazo" ? "Reducir plazo" : k === "cuota" ? "Reducir cuota" : "Distribuir mensual";

  let argumento: React.ReactNode = null;
  if (recomendado === "plazo") {
    argumento = (
      <>
        <b>Reducir plazo</b> ahorra <b style={{ color: NUVEX.verde }}>{fmtCOP(plazoAhorro)}</b> en intereses
        (<b>{fmtCOP(diferenciaAhorro)}</b> más que {labelDe(segundo.key).toLowerCase()}) sin subir la cuota mensual.
        Ideal si el cliente ya tiene los <b>{fmtCOP(totalAbonoCOP)}</b> disponibles y busca acortar el crédito lo máximo.
      </>
    );
  } else if (recomendado === "cuota") {
    argumento = (
      <>
        <b>Reducir cuota</b> ahorra <b style={{ color: NUVEX.verde }}>{fmtCOP(cuotaAhorro)}</b> y baja la mensualidad
        en <b>{fmtCOP(Math.abs(deltaCuota))}</b>. Ideal cuando el cliente necesita liberar flujo mensual
        (nueva mensualidad: <b>{fmtCOP(cuotaFinalCuotaCOP)}</b>).
      </>
    );
  } else {
    argumento = (
      <>
        <b>Distribuir mensual</b> es la mejor opción cuando el cliente <b>no tiene los {fmtCOP(totalAbonoCOP)} líquidos</b>{" "}
        pero sí puede sumar <b style={{ color: NUVEX.verde }}>{fmtCOP(extraMensualCOP)}</b> extra cada mes a su cuota.
        Ahorra <b>{fmtCOP(distAhorro)}</b> en intereses y elimina <b>{distCuotasElim}</b> cuotas, sin necesidad de un desembolso grande.
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[rgba(10,16,34,0.55)] backdrop-blur-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 p-4 border-b border-white/10 hover:bg-white/[0.02] transition"
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: `linear-gradient(135deg, ${NUVEX.verde}33, ${NUVEX.azul}33)` }}
          >
            <Sparkles className="h-4 w-4 text-[#84B98F]" />
          </div>
          <div className="text-left">
            <div className="text-[13px] font-semibold text-white">
              Comparador NUVIA · 3 estrategias
            </div>
            <div className="text-[11px] text-white/50">
              Los mismos abonos ({fmtCOP(totalAbonoCOP)} total) simulados en 3 escenarios. Recomendación dinámica según ahorro.
            </div>
          </div>
        </div>
        <div className="text-[11px] font-semibold text-[#84B98F]">{open ? "Ocultar" : "Mostrar"}</div>
      </button>

      {open && (
        <div className="relative p-6">
          <div className="pointer-events-none absolute inset-0 -z-0" style={{
            background: "radial-gradient(60% 50% at 20% 10%, rgba(68,93,163,0.12), transparent 60%), radial-gradient(60% 50% at 85% 90%, rgba(132,185,143,0.10), transparent 60%)",
          }} />
          <div className="relative grid gap-4 md:grid-cols-3 items-stretch">
            {/* PLAZO */}
            <StrategyCard
              tag="Estrategia A"
              title="Reducir Plazo"
              subtitle="Abono único"
              accent={NUVEX.azul}
              recommended={recomendado === "plazo"}
              explanation={`Aplica ${fmtCOP(totalAbonoCOP)} al capital y elimina las cuotas finales. La cuota mensual se mantiene igual.`}
              kpis={[
                { label: "Ahorro Intereses", value: fmtCOP(plazoAhorro), highlight: true },
                { label: "Tiempo Eliminado", value: `${plazoCuotasElim} meses` },
                { label: "Nueva Cuota", value: "Sin cambios", muted: true },
                { label: "Fin del Crédito", value: fechaFin(simPlazo.cuotasUsadas) },
              ]}
              cta={{
                label: actualDestino === "plazo" ? "Ya aplicado ✓" : "Aplicar a todos",
                disabled: actualDestino === "plazo",
                onClick: () => onAplicar("plazo"),
              }}
            />

            {/* CUOTA */}
            <StrategyCard
              tag="Estrategia B"
              title="Reducir Cuota"
              subtitle="Alivio mensual"
              accent={NUVEX.verde}
              recommended={recomendado === "cuota"}
              explanation={`Aplica ${fmtCOP(totalAbonoCOP)} y recalcula la cuota. Mantiene el plazo pero baja la mensualidad.`}
              kpis={[
                { label: "Ahorro Intereses", value: fmtCOP(cuotaAhorro), highlight: true },
                { label: "Tiempo Eliminado", value: `${cuotaCuotasElim} meses`, muted: cuotaCuotasElim === 0 },
                {
                  label: "Nueva Cuota",
                  value: fmtCOP(cuotaFinalCuotaCOP),
                  sub: deltaCuota < 0 ? `(${fmtCOP(deltaCuota)})` : "sin cambio",
                  accent: true,
                },
                { label: "Fin del Crédito", value: fechaFin(simCuota.cuotasUsadas) },
              ]}
              cta={{
                label: actualDestino === "cuota" ? "Ya aplicado ✓" : "Aplicar a todos",
                disabled: actualDestino === "cuota",
                onClick: () => onAplicar("cuota"),
              }}
            />

            {/* DISTRIBUIDO */}
            <StrategyCard
              tag="Estrategia C"
              title="Distribuir Mensual"
              subtitle="Sin desembolso grande"
              accent="#e0a458"
              recommended={recomendado === "distribuido"}
              explanation={`Divide ${fmtCOP(totalAbonoCOP)} en el plazo restante: el cliente suma ~${fmtCOP(extraMensualCOP)} extra cada mes a su cuota.`}
              kpis={[
                { label: "Ahorro Intereses", value: fmtCOP(distAhorro), highlight: true },
                { label: "Tiempo Eliminado", value: `${distCuotasElim} meses`, muted: distCuotasElim === 0 },
                {
                  label: "Nueva Cuota",
                  value: fmtCOP(nuevaCuotaDistCOP),
                  sub: `+ ${fmtCOP(extraMensualCOP)} /mes`,
                  accent: true,
                },
                { label: "Fin del Crédito", value: fechaFin(simDistribuido.cuotasUsadas) },
              ]}
              cta={{
                label: actualDestino === "distribuido" ? "Ya aplicado ✓" : "Aplicar a todos",
                disabled: actualDestino === "distribuido",
                onClick: () => onAplicar("distribuido"),
              }}
            />
          </div>

          {/* Recomendación */}
          <div
            className="relative mt-6 rounded-xl border p-4 flex items-start gap-3"
            style={{
              borderColor: `${NUVEX.verde}55`,
              background: "linear-gradient(135deg, rgba(132,185,143,0.10), rgba(10,16,34,0.4))",
            }}
          >
            <Sparkles className="h-5 w-5 text-[#84B98F] shrink-0 mt-0.5" />
            <div className="text-[13px] leading-relaxed text-white/85">
              <b style={{ color: NUVEX.verde }}>Recomendación NUVIA:</b> {argumento}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


function StrategyCard({
  tag,
  title,
  subtitle,
  accent,
  recommended,
  explanation,
  kpis,
  cta,
}: {
  tag: string;
  title: string;
  subtitle: string;
  accent: string;
  recommended: boolean;
  explanation: string;
  kpis: Array<{ label: string; value: string; sub?: string; highlight?: boolean; muted?: boolean; accent?: boolean }>;
  cta: { label: string; disabled?: boolean; onClick: () => void };
}) {
  return (
    <div
      className="flex-1 relative rounded-3xl p-6 flex flex-col backdrop-blur-xl transition-all"
      style={{
        background: "rgba(10,16,34,0.55)",
        border: `${recommended ? "2px" : "1px"} solid ${recommended ? accent : `${accent}55`}`,
        boxShadow: recommended ? `0 0 40px -12px ${accent}` : `0 8px 32px -20px ${accent}`,
      }}
    >
      {recommended && (
        <div
          className="absolute top-0 right-0 px-4 py-1 rounded-bl-2xl text-[10px] font-bold uppercase tracking-wider"
          style={{ background: accent, color: "#050816" }}
        >
          Recomendación NUVIA
        </div>
      )}

      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <span
            className="text-[10.5px] font-bold uppercase tracking-widest"
            style={{ color: accent }}
          >
            {tag}
          </span>
          <h3 className="text-xl font-semibold mt-1 text-white">{title}</h3>
        </div>
        <div
          className="px-3 py-1 rounded-full border text-[10px] font-semibold"
          style={{
            borderColor: `${accent}55`,
            background: `${accent}18`,
            color: accent,
          }}
        >
          {subtitle}
        </div>
      </div>

      <p className="text-[12.5px] leading-relaxed text-white/60 mb-5">{explanation}</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl p-3 border"
            style={{
              background: k.accent ? `${accent}12` : "rgba(255,255,255,0.03)",
              borderColor: k.accent ? `${accent}33` : "rgba(255,255,255,0.06)",
            }}
          >
            <p
              className="text-[9.5px] uppercase font-bold mb-1 tracking-wider"
              style={{ color: k.accent ? accent : "rgba(255,255,255,0.4)" }}
            >
              {k.label}
            </p>
            <p
              className="text-[15px] font-bold leading-tight"
              style={{
                color: k.muted ? "rgba(255,255,255,0.45)" : k.highlight ? accent : "white",
              }}
            >
              {k.value}
            </p>
            {k.sub && (
              <p className="text-[10.5px] mt-0.5" style={{ color: accent }}>
                {k.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={cta.onClick}
        disabled={cta.disabled}
        className="mt-auto w-full py-3 rounded-xl font-semibold text-[12.5px] transition-all disabled:opacity-60 disabled:cursor-default"
        style={{
          background: recommended && !cta.disabled ? accent : "transparent",
          color: recommended && !cta.disabled ? "#050816" : accent,
          border: `1px solid ${accent}`,
        }}
      >
        {cta.label}
      </button>
    </div>
  );
}
