import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Calendar, Download, FileSpreadsheet, Search, Sparkles, TrendingDown } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import { formatCOP, formatInt, parseCurrency, parseDecimal, parsePercentage } from "@/lib/format";
import {
  proyectar, formatFecha, formatFechaLarga,
  type CoberturaFresh, type ProyeccionInputBase, type ProyeccionResultado,
} from "@/lib/proyeccion";
import { exportProyeccionExcel, exportProyeccionPDF } from "@/lib/proyeccionExport";
import { CoberturaFreshFields } from "./CoberturaFreshFields";
import {
  FRESH_DEFAULT_TOTAL,
  freshFromCobertura,
  withFreshDerivados,
} from "@/lib/cobertura";
import type { Cobertura } from "./intervinientes";

const NEGRO = "#242424";
const AZUL = "#445DA3";
const VERDE = "#84B98F";

function defaultFresh(): CoberturaFresh {
  return withFreshDerivados({
    activo: false,
    cuotasTotales: FRESH_DEFAULT_TOTAL,
  });
}

interface PropuestaSeleccionada {
  nuevaCuota: number;
  nuevoPlazo: number;
  ahorroTotal: number;
}

function propuestaFromExpediente(e: Expediente): PropuestaSeleccionada | null {
  const p = e.propuesta_data as Record<string, unknown> | null;
  if (!p) return null;
  const nuevaCuota = Number(p.nuevaCuota) || 0;
  const nuevoPlazo = Number(p.nuevoPlazo) || 0;
  if (nuevaCuota <= 0 || nuevoPlazo <= 0) return null;
  return {
    nuevaCuota,
    nuevoPlazo,
    ahorroTotal: Number(p.ahorroTotal) || 0,
  };
}

export function ProyeccionDetallada() {
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const expediente = useMemo(() => expedientes.find((e) => e.id === selectedId) ?? null, [expedientes, selectedId]);

  const [fresh, setFresh] = useState<CoberturaFresh>(defaultFresh());
  const [fechaInicio, setFechaInicio] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [generado, setGenerado] = useState(false);
  const [activeTab, setActiveTab] = useState<"actual" | "optimizado">("actual");

  useEffect(() => {
    let cancel = false;
    listExpedientes()
      .then((rows) => { if (!cancel) setExpedientes(rows); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  // Cargar Fresh persistida al seleccionar
  useEffect(() => {
    if (!expediente) return;
    const c = expediente.credito_data as Record<string, unknown>;
    const persisted = c?.coberturaFresh as Partial<CoberturaFresh> | undefined;

    // Datos del simulador para derivar el Valor Fresh mensual
    const cob = c?.cobertura as { activo?: boolean; valorCobertura?: string; tasaCobertura?: string } | undefined;
    const valorCobertura = parseCurrency(cob?.valorCobertura ?? "");
    const tasaCobPct = parseDecimal(cob?.tasaCobertura ?? "");
    const saldoBase =
      parseCurrency((c?.saldoPesos as string) ?? (c?.saldoCapital as string) ?? "");
    // Fórmula: subsidio mensual ≈ saldo * tasa_mensual_cobertura
    const tasaMensualCob = tasaCobPct > 0 ? Math.pow(1 + tasaCobPct / 100, 1 / 12) - 1 : 0;
    const valorMensualDerivado =
      saldoBase > 0 && tasaMensualCob > 0 ? Math.round(saldoBase * tasaMensualCob) : 0;
    const tieneCobSim = !!cob && (cob.activo || valorCobertura > 0 || tasaCobPct > 0);

    if (persisted && typeof persisted === "object" && Object.keys(persisted).length > 0) {
      const valorPersistido = Number(persisted.valorMensual) || 0;
      setFresh({
        activo: persisted.activo === undefined ? tieneCobSim : !!persisted.activo,
        // Si el persistido viene en 0 pero el simulador permite derivarlo, úsalo.
        valorMensual: valorPersistido > 0 ? valorPersistido : valorMensualDerivado,
        tasa: Number(persisted.tasa) || tasaCobPct,
        cuotasTotales: Number(persisted.cuotasTotales) || FRESH_DEFAULT_TOTAL,
        cuotasPagadas: Number(persisted.cuotasPagadas) || 0,
        cuotasPendientes: Number(persisted.cuotasPendientes) ?? FRESH_DEFAULT_TOTAL,
      });
    } else if (tieneCobSim) {
      setFresh({
        activo: true,
        valorMensual: valorMensualDerivado,
        tasa: tasaCobPct,
        cuotasTotales: FRESH_DEFAULT_TOTAL,
        cuotasPagadas: 0,
        cuotasPendientes: FRESH_DEFAULT_TOTAL,
      });
    } else {
      setFresh(defaultFresh());
    }
    setGenerado(false);
  }, [expediente]);

  const filtered = useMemo(() => {
    const s = busqueda.trim().toLowerCase();
    if (!s) return expedientes;
    return expedientes.filter((e) =>
      [e.cliente_nombre, e.cedula, e.numero_credito, e.banco].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [expedientes, busqueda]);

  // Construir inputs base desde el expediente seleccionado
  const inputs = useMemo(() => {
    if (!expediente) return null;
    const cred = expediente.credito_data as Record<string, string>;
    const cliente = expediente.cliente_data as unknown as { plazoInicial?: string; cuotasPagadas?: string };
    const plazoInicial = Math.max(0, Math.round(parseDecimal(cliente?.plazoInicial ?? "")));
    const cuotasPagadas = Math.max(0, Math.round(parseDecimal(cliente?.cuotasPagadas ?? "")));
    const cuotasPendientesBase = Math.max(0, plazoInicial - cuotasPagadas);
    const propuesta = propuestaFromExpediente(expediente);

    const modo: "pesos" | "uvr" = expediente.modo;
    const seguros = parseCurrency(cred.seguros ?? "");
    const tea = parsePercentage((modo === "uvr" ? cred.teaCobrada : cred.tea) ?? "");

    if (modo === "pesos") {
      const saldo = parseCurrency(cred.saldoCapital ?? "");
      const cuotaActual = parseCurrency(cred.cuotaActual ?? "");
      return {
        modo, plazoInicial, cuotasPagadas, cuotasPendientesBase,
        saldoActual: saldo, cuotaActual, seguros, tea, propuesta,
        uvr: null as null | { saldoUVR: number; valorUVR: number; variacion: number },
      };
    }
    const saldoPesos = parseCurrency(cred.saldoPesos ?? cred.saldoCapital ?? "");
    const saldoUVR = parseDecimal(cred.saldoUVR ?? "");
    const valorUVR = parseDecimal(cred.valorUVR ?? "");
    const variacion = parsePercentage(cred.variacionUVR ?? "");
    const cuotaActual = parseCurrency(cred.cuotaActualPesos ?? cred.cuotaActual ?? "");
    return {
      modo, plazoInicial, cuotasPagadas, cuotasPendientesBase,
      saldoActual: saldoPesos, cuotaActual, seguros, tea, propuesta,
      uvr: { saldoUVR, valorUVR, variacion },
    };
  }, [expediente]);

  const fechaInicioDate = useMemo(() => {
    const d = new Date(fechaInicio);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [fechaInicio]);

  const proyecciones = useMemo(() => {
    if (!inputs || !generado) return null;
    const base: Omit<ProyeccionInputBase, "cuotaActualPesos" | "cuotasPendientes"> = {
      modo: inputs.modo,
      saldoInicialPesos: inputs.saldoActual,
      seguros: inputs.seguros,
      teaPct: inputs.tea,
      fechaInicio: fechaInicioDate,
      fresh,
      saldoUVR: inputs.uvr?.saldoUVR,
      valorUVR: inputs.uvr?.valorUVR,
      variacionUVRPct: inputs.uvr?.variacion,
    };
    const actual: ProyeccionResultado = proyectar({
      ...base,
      cuotaActualPesos: inputs.cuotaActual,
      cuotasPendientes: inputs.cuotasPendientesBase,
    });
    const cuotaOpt = inputs.propuesta?.nuevaCuota ?? inputs.cuotaActual;
    const plazoOpt = inputs.propuesta?.nuevoPlazo ?? inputs.cuotasPendientesBase;
    const optimizado: ProyeccionResultado = proyectar({
      ...base,
      cuotaActualPesos: cuotaOpt,
      cuotasPendientes: plazoOpt,
    });
    return { actual, optimizado };
  }, [inputs, generado, fechaInicioDate, fresh]);

  // Persistir Fresh y fechas en credito_data
  useEffect(() => {
    if (!expediente || !proyecciones) return;
    const patch = {
      coberturaFresh: fresh as unknown as Record<string, unknown>,
      fechaFinalizacionActual: proyecciones.actual.fechaFinalizacion?.toISOString() ?? null,
      fechaFinalizacionOptimizada: proyecciones.optimizado.fechaFinalizacion?.toISOString() ?? null,
    };
    const merged = { ...(expediente.credito_data as Record<string, unknown>), ...patch };
    supabase.from("expedientes").update({ credito_data: merged as never }).eq("id", expediente.id).then(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyecciones]);

  const handleGenerar = () => {
    if (!inputs) return;
    setGenerado(true);
  };

  const handlePDF = () => {
    if (!expediente || !inputs || !proyecciones) return;
    exportProyeccionPDF({
      cliente: expediente.cliente_nombre,
      banco: expediente.banco ?? "—",
      numeroCredito: expediente.numero_credito ?? "—",
      producto: expediente.producto ?? "—",
      modo: inputs.modo,
      saldoActual: inputs.saldoActual,
      cuotaActual: inputs.cuotaActual,
      seguros: inputs.seguros,
      tea: inputs.tea,
      cuotasPendientes: inputs.cuotasPendientesBase,
      plazoInicial: inputs.plazoInicial,
      fresh,
      fechaInicio: fechaInicioDate,
      actual: proyecciones.actual,
      optimizado: proyecciones.optimizado,
      propuestaResumen: inputs.propuesta ?? undefined,
      includeAnexo: true,
    });
  };
  const handleExcel = () => {
    if (!expediente || !inputs || !proyecciones) return;
    exportProyeccionExcel({
      cliente: expediente.cliente_nombre,
      banco: expediente.banco ?? "—",
      numeroCredito: expediente.numero_credito ?? "—",
      producto: expediente.producto ?? "—",
      modo: inputs.modo,
      saldoActual: inputs.saldoActual,
      cuotaActual: inputs.cuotaActual,
      seguros: inputs.seguros,
      tea: inputs.tea,
      cuotasPendientes: inputs.cuotasPendientesBase,
      plazoInicial: inputs.plazoInicial,
      fresh,
      fechaInicio: fechaInicioDate,
      actual: proyecciones.actual,
      optimizado: proyecciones.optimizado,
      propuestaResumen: inputs.propuesta ?? undefined,
    });
  };

  return (
    <div className="min-h-screen" style={{ background: "#050814" }}>
      <div className="mx-auto max-w-[1400px] px-6 py-8">
        {/* Hero */}
        <div className="mb-6 flex items-start justify-between gap-6 rounded-3xl p-6"
          style={{
            background: "linear-gradient(135deg, rgba(10,18,38,0.95), rgba(7,22,45,0.95))",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: VERDE }} />
              <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: VERDE }}>
                Módulo técnico NUVEX
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-white">Proyección Detallada del Crédito</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-white/60">
              Analiza el comportamiento completo del crédito hasta su terminación bajo el escenario actual
              y el escenario optimizado por NUVEX. Incluye descomposición de cuota, gráficos comparativos y
              exportación a PDF y Excel.
            </p>
          </div>
          <Link to="/casos" className="rounded-xl border px-4 py-2.5 text-[12px] font-medium text-white/80 transition hover:text-white"
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}>
            Ir a Casos
          </Link>
        </div>

        {/* Selector */}
        <div className="mb-6 rounded-2xl p-5"
          style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <Search className="h-4 w-4 text-white/40" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, cédula, número de crédito o banco…"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
            />
            <span className="text-[11px] text-white/40">{filtered.length} casos</span>
          </div>
          <div className="mt-4 grid gap-2 max-h-[260px] overflow-y-auto pr-1">
            {loading && <div className="text-sm text-white/50">Cargando expedientes…</div>}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-white/50">No hay expedientes que coincidan.</div>
            )}
            {filtered.map((e) => {
              const isSel = e.id === selectedId;
              return (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition"
                  style={{
                    background: isSel ? "linear-gradient(135deg, rgba(68,93,163,0.20), rgba(132,185,143,0.16))" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isSel ? "rgba(132,185,143,0.45)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{e.cliente_nombre}</div>
                    <div className="text-[11px] text-white/55">
                      {e.banco ?? "—"} · {e.numero_credito ?? "Sin Nº"} · {e.producto ?? "—"} · {e.modo.toUpperCase()}
                    </div>
                  </div>
                  <span className="rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}>
                    {e.estado}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {expediente && inputs && (
          <>
            {/* Datos base */}
            <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl p-5"
                style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-[14px] font-semibold text-white mb-4">Datos del crédito</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <KV label="Cliente" value={expediente.cliente_nombre} />
                  <KV label="Banco" value={expediente.banco ?? "—"} />
                  <KV label="N° crédito" value={expediente.numero_credito ?? "—"} />
                  <KV label="Producto" value={expediente.producto ?? "—"} />
                  <KV label="Modo" value={inputs.modo.toUpperCase()} />
                  <KV label="Saldo actual" value={formatCOP(inputs.saldoActual)} />
                  <KV label="Cuota actual" value={formatCOP(inputs.cuotaActual)} />
                  <KV label="Seguros" value={formatCOP(inputs.seguros)} />
                  <KV label="Tasa cobrada" value={`${inputs.tea.toFixed(2)}% EA`} />
                  <KV label="Cuotas pendientes" value={formatInt(inputs.cuotasPendientesBase)} />
                  <KV label="Plazo inicial" value={`${formatInt(inputs.plazoInicial)} meses`} />
                  {inputs.uvr && <KV label="Valor UVR / Variación" value={`${formatCOP(inputs.uvr.valorUVR)} · ${inputs.uvr.variacion.toFixed(2)}% EA`} />}
                </div>
              </div>

              <div className="rounded-2xl p-5"
                style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <h3 className="text-[14px] font-semibold text-white mb-4">Propuesta optimizada</h3>
                {inputs.propuesta ? (
                  <div className="grid gap-3">
                    <KV label="Nueva cuota" value={formatCOP(inputs.propuesta.nuevaCuota)} />
                    <KV label="Nuevo plazo" value={`${formatInt(inputs.propuesta.nuevoPlazo)} meses`} />
                    <KV label="Ahorro total" value={formatCOP(inputs.propuesta.ahorroTotal)} />
                  </div>
                ) : (
                  <div className="rounded-xl p-3 text-[12.5px] text-white/65"
                    style={{ background: "rgba(244,162,97,0.10)", border: "1px solid rgba(244,162,97,0.30)" }}>
                    Este expediente aún no tiene una propuesta seleccionada. La proyección optimizada se calculará
                    usando los mismos parámetros actuales hasta que generes una propuesta desde el simulador.
                  </div>
                )}
                <div className="mt-4">
                  <label className="block text-[11px] font-medium uppercase tracking-wider text-white/55 mb-1.5">
                    Fecha inicio de proyección
                  </label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
              </div>
            </div>

            {/* Cobertura Fresh */}
            <div className="mb-6">
              <CoberturaFreshFields data={fresh} onChange={setFresh} />
            </div>

            {/* Botón generar */}
            <div className="mb-6 flex justify-end">
              <button
                onClick={handleGenerar}
                className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-[1.02]"
                style={{
                  background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                  boxShadow: `0 12px 30px -12px ${AZUL}`,
                }}
              >
                <BarChart3 className="h-4 w-4" />
                Generar Proyección Detallada
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {proyecciones && (
              <ProyeccionResultados
                actual={proyecciones.actual}
                optimizado={proyecciones.optimizado}
                fechaInicio={fechaInicioDate}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onPDF={handlePDF}
                onExcel={handleExcel}
              />
            )}
          </>
        )}

        {!expediente && !loading && (
          <div className="rounded-2xl p-10 text-center text-sm text-white/55"
            style={{ background: "rgba(10,18,38,0.5)", border: "1px dashed rgba(255,255,255,0.10)" }}>
            Selecciona un caso para construir la proyección detallada.
          </div>
        )}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-3 py-2"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-white/45">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-white">{value}</div>
    </div>
  );
}

function KPI({ label, value, color, sub }: { label: string; value: string; color: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-4"
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        border: `1px solid ${color}55`,
        boxShadow: `inset 4px 0 0 ${color}`,
      }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
      <div className="mt-1 text-[18px] font-bold text-white">{value}</div>
      {sub && <div className="text-[10.5px] text-white/45 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProyeccionResultados({
  actual, optimizado, fechaInicio, activeTab, setActiveTab, onPDF, onExcel,
}: {
  actual: ProyeccionResultado; optimizado: ProyeccionResultado; fechaInicio: Date;
  activeTab: "actual" | "optimizado"; setActiveTab: (t: "actual" | "optimizado") => void;
  onPDF: () => void; onExcel: () => void;
}) {
  // Datos para gráfico evolución de saldo
  const saldoData = useMemo(() => {
    const n = Math.max(actual.cuotas.length, optimizado.cuotas.length);
    const arr: Array<{ mes: number; actual: number | null; optimizado: number | null }> = [];
    for (let i = 0; i < n; i++) {
      arr.push({
        mes: i + 1,
        actual: i < actual.cuotas.length ? Math.round(actual.cuotas[i].saldoFinal) : null,
        optimizado: i < optimizado.cuotas.length ? Math.round(optimizado.cuotas[i].saldoFinal) : null,
      });
    }
    return arr;
  }, [actual, optimizado]);

  const pieData = (r: ProyeccionResultado) => [
    { name: "Capital", value: Math.round(r.totalCapital), color: AZUL },
    { name: "Intereses", value: Math.round(r.totalIntereses), color: "#F4A261" },
    { name: "Seguros", value: Math.round(r.totalSeguros), color: NEGRO },
    { name: "Fresh", value: Math.round(r.totalFresh), color: VERDE },
  ];

  const cuotas = activeTab === "actual" ? actual.cuotas : optimizado.cuotas;
  const headerColor = activeTab === "actual" ? AZUL : VERDE;

  return (
    <div className="space-y-6">
      {/* Resumen ejecutivo */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(10,18,38,0.6)", border: `1px solid ${AZUL}44` }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: AZUL }} />
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Escenario Actual</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KPI label="Fecha finalización" value={formatFecha(actual.fechaFinalizacion)} color={AZUL} />
            <KPI label="Total pagos futuros" value={formatCOP(actual.totalPagado)} color={AZUL} />
            <KPI label="Intereses futuros" value={formatCOP(actual.totalIntereses)} color={AZUL} />
            <KPI label="Seguros futuros" value={formatCOP(actual.totalSeguros)} color={AZUL} />
          </div>
        </div>
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(10,18,38,0.6)", border: `1px solid ${VERDE}55` }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: VERDE }} />
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-white">Escenario Optimizado NUVEX</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KPI label="Fecha finalización" value={formatFecha(optimizado.fechaFinalizacion)} color={VERDE} />
            <KPI label="Total pagos futuros" value={formatCOP(optimizado.totalPagado)} color={VERDE} />
            <KPI label="Intereses futuros" value={formatCOP(optimizado.totalIntereses)} color={VERDE} />
            <KPI label="Seguros futuros" value={formatCOP(optimizado.totalSeguros)} color={VERDE} />
          </div>
        </div>
      </div>

      {/* Comparativo */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-white flex items-center gap-2">
            <TrendingDown className="h-4 w-4" style={{ color: VERDE }} /> Comparativo Actual vs Optimizado
          </h3>
          <div className="flex gap-2">
            <button onClick={onExcel}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-white/80 transition hover:text-white"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </button>
            <button onClick={onPDF}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}>
              <Download className="h-4 w-4" /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] text-white/85">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-wider text-white/45">
                <th className="py-2 pr-3 font-semibold">Métrica</th>
                <th className="py-2 px-3 font-semibold">Actual</th>
                <th className="py-2 px-3 font-semibold">Optimizado</th>
                <th className="py-2 pl-3 font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Cuotas pendientes", formatInt(actual.cuotas.length), formatInt(optimizado.cuotas.length), formatInt(actual.cuotas.length - optimizado.cuotas.length)],
                ["Años pendientes", (actual.cuotas.length / 12).toFixed(1), (optimizado.cuotas.length / 12).toFixed(1), ((actual.cuotas.length - optimizado.cuotas.length) / 12).toFixed(1)],
                ["Fecha finalización", formatFecha(actual.fechaFinalizacion), formatFecha(optimizado.fechaFinalizacion), "—"],
                ["Intereses futuros", formatCOP(actual.totalIntereses), formatCOP(optimizado.totalIntereses), formatCOP(actual.totalIntereses - optimizado.totalIntereses)],
                ["Seguros futuros", formatCOP(actual.totalSeguros), formatCOP(optimizado.totalSeguros), formatCOP(actual.totalSeguros - optimizado.totalSeguros)],
                ["Cobertura Fresh futura", formatCOP(actual.totalFresh), formatCOP(optimizado.totalFresh), formatCOP(actual.totalFresh - optimizado.totalFresh)],
                ["Total proyectado", formatCOP(actual.totalPagado), formatCOP(optimizado.totalPagado), formatCOP(actual.totalPagado - optimizado.totalPagado)],
              ].map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <td className="py-2.5 pr-3 font-medium text-white/70">{r[0]}</td>
                  <td className="py-2.5 px-3">{r[1]}</td>
                  <td className="py-2.5 px-3" style={{ color: VERDE, fontWeight: 600 }}>{r[2]}</td>
                  <td className="py-2.5 pl-3 text-white/85">{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl p-5 lg:col-span-2"
          style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-[14px] font-semibold text-white mb-3">Evolución del saldo</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={saldoData}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AZUL} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={AZUL} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VERDE} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={VERDE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <XAxis dataKey="mes" stroke="rgba(255,255,255,0.45)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.45)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1_000_000)}M`} />
                <Tooltip
                  contentStyle={{ background: "#0A1226", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v: number) => formatCOP(v)}
                />
                <Area type="monotone" dataKey="actual" name="Actual" stroke={AZUL} fill="url(#gA)" strokeWidth={2} />
                <Area type="monotone" dataKey="optimizado" name="Optimizado" stroke={VERDE} fill="url(#gO)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl p-5"
          style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-[14px] font-semibold text-white mb-3">Distribución {activeTab === "actual" ? "Actual" : "Optimizada"}</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData(activeTab === "actual" ? actual : optimizado)} dataKey="value" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData(activeTab === "actual" ? actual : optimizado).map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, color: "#fff" }} />
                <Tooltip formatter={(v: number) => formatCOP(v)}
                  contentStyle={{ background: "#0A1226", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Línea de tiempo */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 className="text-[14px] font-semibold text-white mb-5 flex items-center gap-2">
          <Calendar className="h-4 w-4" style={{ color: VERDE }} /> Línea de tiempo de finalización
        </h3>
        <div className="relative h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
          {(() => {
            const total = Math.max(actual.cuotas.length, 1);
            const opt = (optimizado.cuotas.length / total) * 100;
            return (
              <>
                <div className="absolute h-1.5 rounded-full"
                  style={{ width: `${Math.min(100, opt)}%`, background: `linear-gradient(90deg, ${AZUL}, ${VERDE})` }} />
                <Marker pct={0} label="Hoy" date={formatFecha(fechaInicio)} color={AZUL} />
                <Marker pct={Math.min(100, opt)} label="Optimizada" date={formatFecha(optimizado.fechaFinalizacion)} color={VERDE} top />
                <Marker pct={100} label="Actual" date={formatFecha(actual.fechaFinalizacion)} color={NEGRO} />
              </>
            );
          })()}
        </div>
      </div>

      {/* Tabla mes a mes */}
      <div className="rounded-2xl p-5"
        style={{ background: "rgba(10,18,38,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-white">Tabla mes a mes</h3>
          <div className="flex gap-1.5 rounded-lg p-1"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["actual", "optimizado"] as const).map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition"
                style={{
                  background: activeTab === t ? `linear-gradient(135deg, ${AZUL}, ${VERDE})` : "transparent",
                  color: activeTab === t ? "#fff" : "rgba(255,255,255,0.6)",
                }}>
                {t === "actual" ? "Actual" : "Optimizado"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-auto max-h-[500px] rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-[11.5px] text-white/85">
            <thead className="sticky top-0" style={{ background: "#0A1226", borderBottom: `2px solid ${headerColor}` }}>
              <tr className="text-left">
                {["#", "Fecha", "Saldo ini.", "Capital", "Interés", "Seguros", "Fresh", "Cuota antes", "Cuota pagada", "Saldo fin."].map((h) => (
                  <th key={h} className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/55">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cuotas.map((c, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <td className="px-2.5 py-1.5 font-mono text-white/55">{c.numero}</td>
                  <td className="px-2.5 py-1.5">{formatFechaLarga(c.fecha)}</td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.saldoInicial)}</td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.capital)}</td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.interes)}</td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.seguros)}</td>
                  <td className="px-2.5 py-1.5" style={{ color: c.fresh > 0 ? VERDE : "rgba(255,255,255,0.3)" }}>
                    {formatCOP(c.fresh)}
                  </td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.cuotaAntesCobertura)}</td>
                  <td className="px-2.5 py-1.5 font-semibold" style={{ color: headerColor }}>
                    {formatCOP(c.cuotaPagada)}
                  </td>
                  <td className="px-2.5 py-1.5">{formatCOP(c.saldoFinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Marker({ pct, label, date, color, top }: { pct: number; label: string; date: string; color: string; top?: boolean }) {
  return (
    <div className="absolute" style={{ left: `${pct}%`, transform: "translateX(-50%)", top: top ? -34 : 12 }}>
      <div className="flex flex-col items-center">
        {!top && <div className="h-2 w-2 rounded-full" style={{ background: color, marginTop: -16 }} />}
        <div className="text-[10.5px] font-semibold" style={{ color }}>{label}</div>
        <div className="text-[10px] text-white/55">{date}</div>
        {top && <div className="mt-1 h-2 w-2 rounded-full" style={{ background: color }} />}
      </div>
    </div>
  );
}
