import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Star, AlertTriangle, PhoneCall, Calculator, ChevronDown, ChevronUp } from "lucide-react";
import { formatCOP, formatNumber } from "../../lib/format";
import {
  calculatePesosManualByCuotas,
  calculateUVRManualByCuotas,
  getUVRReductionOptions,
  type PesosInput,
  type UVRInput,
  type UVREscenarioActual,
} from "../../lib/finance";
import { NUVEX } from "./constants";
import { Card, SectionTitle, Alert } from "./ui";
import { AbonoInteligenteCard } from "./AbonoInteligenteCard";
import type { PerfilCliente } from "../../lib/abonoAnalogias";

export interface RecomendadaSeleccionada {
  index: number;
  cuotasEliminadas: number;
  añosEliminados: number;
  nuevoPlazo: number;
  nuevaCuota: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  incrementoMensual: number;
  fuente: "automatica" | "manual";
}

export interface PropuestasComercialesDraft {
  cuotasList: number[];
  recomendadaIdx: number;
}

export interface PropuestaComercialPdfRow extends RecomendadaSeleccionada {
  fuente: "automatica" | "manual";
}

export interface PropuestasComercialesSnapshot extends PropuestasComercialesDraft {
  recommendedIndex: number;
  propuestas: PropuestaComercialPdfRow[];
}

type Common = {
  cuotasPendientes: number;
  baseCredito: number; // para "veces pagado" (desembolsado o, en su defecto, saldo actual)
  /** Dinero ya pagado a la fecha. Solo se suma cuando la base es el valor desembolsado. */
  dineroPagado?: number;
  /** Perfil opcional del cliente para personalizar las analogías. */
  perfilCliente?: PerfilCliente;
  initialState?: PropuestasComercialesDraft;
  onStateChange?: (s: PropuestasComercialesSnapshot) => void;
  onRecomendadaChange: (r: RecomendadaSeleccionada | null) => void;
};

type PesosProps = Common & {
  mode: "pesos";
  input: PesosInput;
};

type UVRProps = Common & {
  mode: "uvr";
  input: UVRInput;
  escenarioActual: UVREscenarioActual;
  plazoInicial: number;
};

type Props = PesosProps | UVRProps;

interface PropuestaCalc {
  valid: boolean;
  motivo?: string;
  cuotasEliminadas: number;
  añosEliminados: number;
  nuevoPlazo: number;
  nuevaCuota: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
  honorarios: number;
  totalProyectado: number;
  incrementoMensual: number;
}

function computePropuesta(props: Props, cuotasEliminadas: number): PropuestaCalc {
  if (props.mode === "pesos") {
    const r = calculatePesosManualByCuotas(props.input, cuotasEliminadas);
    return {
      valid: r.valid,
      motivo: r.motivo,
      cuotasEliminadas: r.cuotasEliminadas || cuotasEliminadas,
      añosEliminados: r.añosEliminados,
      nuevoPlazo: r.nuevoPlazo,
      nuevaCuota: r.nuevaCuotaConSeguro,
      ahorroIntereses: r.ahorroIntereses,
      ahorroSeguros: r.ahorroSeguros,
      ahorroTotal: r.ahorroTotal,
      honorarios: r.honorarios,
      totalProyectado: r.totalProyectado,
      incrementoMensual: r.incrementoMensual,
    };
  }
  const r = calculateUVRManualByCuotas(props.input, props.escenarioActual, cuotasEliminadas);
  return {
    valid: r.valid,
    motivo: r.motivo,
    cuotasEliminadas: r.cuotasEliminadas || cuotasEliminadas,
    añosEliminados: r.añosEliminados,
    nuevoPlazo: r.nuevoPlazo,
    nuevaCuota: r.nuevaCuotaPesos,
    ahorroIntereses: r.ahorroIntereses,
    ahorroSeguros: r.ahorroSeguros,
    ahorroTotal: r.ahorroTotal,
    honorarios: r.honorarios,
    totalProyectado: r.totalProyectado,
    incrementoMensual: r.incrementoMensual,
  };
}

function defaultCuotas(props: Props): number[] {
  if (props.mode === "uvr") return getUVRReductionOptions(props.plazoInicial);
  return [12, 24, 36, 48];
}

function propsSeed(props: Props): string {
  return `${props.mode}::${props.mode === "uvr" ? props.plazoInicial : "p"}::${props.cuotasPendientes}`;
}

function toPdfRow(c: PropuestaCalc, index: number, fuente: "automatica" | "manual"): PropuestaComercialPdfRow {
  return {
    index,
    cuotasEliminadas: c.cuotasEliminadas,
    añosEliminados: c.añosEliminados,
    nuevoPlazo: c.nuevoPlazo,
    nuevaCuota: c.nuevaCuota,
    ahorroIntereses: c.ahorroIntereses,
    ahorroSeguros: c.ahorroSeguros,
    ahorroTotal: c.ahorroTotal,
    honorarios: c.honorarios,
    totalProyectado: c.totalProyectado,
    incrementoMensual: c.incrementoMensual,
    fuente,
  };
}

export function PropuestasComerciales(props: Props) {
  const [cuotasList, setCuotasList] = useState<number[]>(() =>
    props.initialState?.cuotasList?.length ? props.initialState.cuotasList : defaultCuotas(props),
  );
  const [recomendadaIdx, setRecomendadaIdx] = useState<number>(
    props.initialState?.recomendadaIdx ?? -1,
  );

  // Si cambia el "mode" o el plazo inicial UVR, rehacemos la lista por defecto.
  const seedRef = useRef<string>(propsSeed(props));
  useEffect(() => {
    const seed = propsSeed(props);
    if (seedRef.current !== seed) {
      seedRef.current = seed;
      setCuotasList(defaultCuotas(props));
      setRecomendadaIdx(-1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.mode, props.cuotasPendientes, (props as UVRProps).plazoInicial]);

  const calcs = useMemo(
    () => cuotasList.map((c) => computePropuesta(props, c)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuotasList, JSON.stringify(props.input), props.mode],
  );

  // Si la recomendada deja de ser válida, selecciona la mejor disponible.
  const bestIdx = useMemo(() => {
    let best = -1;
    let bestAhorro = -Infinity;
    calcs.forEach((c, i) => {
      if (c.valid && c.ahorroTotal > bestAhorro) {
        bestAhorro = c.ahorroTotal;
        best = i;
      }
    });
    return best;
  }, [calcs]);

  const effectiveIdx =
    recomendadaIdx >= 0 && calcs[recomendadaIdx]?.valid ? recomendadaIdx : bestIdx;

  useEffect(() => {
    if (effectiveIdx < 0) {
      props.onRecomendadaChange(null);
      return;
    }
    const c = calcs[effectiveIdx];
    if (!c?.valid) {
      props.onRecomendadaChange(null);
      return;
    }
    const fuente = recomendadaIdx >= 0 ? "manual" : "automatica";
    const validRows = calcs
      .map((calc, idx) => (calc.valid ? toPdfRow(calc, idx, fuente) : null))
      .filter((row): row is PropuestaComercialPdfRow => row !== null);
    const recommendedIndex = Math.max(0, validRows.findIndex((row) => row.index === effectiveIdx));
    props.onStateChange?.({ cuotasList, recomendadaIdx, recommendedIndex, propuestas: validRows });
    props.onRecomendadaChange(toPdfRow(c, effectiveIdx, fuente));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIdx, calcs, recomendadaIdx, cuotasList]);

  const setCuotas = (idx: number, val: number) => {
    setCuotasList((list) => list.map((c, i) => (i === idx ? val : c)));
  };

  const removePropuesta = (idx: number) => {
    setCuotasList((list) => list.filter((_, i) => i !== idx));
    if (recomendadaIdx === idx) setRecomendadaIdx(-1);
    else if (recomendadaIdx > idx) setRecomendadaIdx((i) => i - 1);
  };

  const addPropuesta = () => {
    // Sugerimos una nueva diferente: la mayor existente +12 (cap por cuotasPendientes-1).
    const max = Math.max(...cuotasList, 0);
    const sugerida = Math.min(props.cuotasPendientes - 1, Math.max(12, max + 12));
    setCuotasList((list) => [...list, sugerida]);
  };

  // Busca el número de cuotas a eliminar cuyo incremento mensual se acerque más
  // al abono mensual deseado por el cliente durante la llamada.
  const buscarCuotasPorAbono = (abonoMensualDeseado: number): { cuotasEliminadas: number; calc: PropuestaCalc } | null => {
    if (!Number.isFinite(abonoMensualDeseado) || abonoMensualDeseado <= 0) return null;
    const maxCuotas = Math.max(0, props.cuotasPendientes - 1);
    let best: { cuotasEliminadas: number; calc: PropuestaCalc; diff: number } | null = null;
    for (let n = 1; n <= maxCuotas; n++) {
      const c = computePropuesta(props, n);
      if (!c.valid) continue;
      const diff = Math.abs(c.incrementoMensual - abonoMensualDeseado);
      if (!best || diff < best.diff) best = { cuotasEliminadas: n, calc: c, diff };
      // Optimización: si ya superamos significativamente el abono, podemos cortar.
      if (c.incrementoMensual > abonoMensualDeseado * 1.6 && best && best.calc.incrementoMensual >= abonoMensualDeseado) break;
    }
    return best ? { cuotasEliminadas: best.cuotasEliminadas, calc: best.calc } : null;
  };

  const agregarEscenarioCuotas = (n: number) => {
    if (!Number.isFinite(n) || n <= 0) return;
    setCuotasList((list) => {
      const exists = list.indexOf(n);
      if (exists >= 0) {
        setRecomendadaIdx(exists);
        return list;
      }
      const next = [...list, n];
      setRecomendadaIdx(next.length - 1);
      return next;
    });
  };

  // Mejor ahorro absoluto entre escenarios válidos (para badge "Mayor ahorro")
  const maxAhorroIdx = useMemo(() => {
    let best = -1;
    let bestVal = -Infinity;
    calcs.forEach((c, i) => {
      if (c.valid && c.ahorroTotal > bestVal) {
        bestVal = c.ahorroTotal;
        best = i;
      }
    });
    return best;
  }, [calcs]);

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle sub="Cada escenario se recalcula al editar las cuotas a eliminar. Marca el que enviarás al cliente.">
          Propuestas comerciales
        </SectionTitle>
        <button
          type="button"
          onClick={addPropuesta}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_-10px_rgba(68,93,163,0.55)] transition hover:scale-[1.02] sm:w-auto"
          style={{
            background: "linear-gradient(135deg, #445DA3 0%, #5B7DC8 60%, #84B98F 100%)",
          }}
        >
          <Plus size={14} /> Nuevo escenario
        </button>
      </div>

      {/* Nota explicativa: cuáles cuotas se eliminan */}
      <div className="mb-4">
        <Alert tone="info">
          <span className="font-semibold">¿Qué cuotas se eliminan?</span> El abono adicional a capital reduce el saldo pendiente, pero la cuota mensual se mantiene igual. Esto hace que el crédito termine antes — las cuotas que «desaparecen» son las <strong>últimas del cronograma</strong> (las más lejanas en el tiempo), no las que siguen a la cuota actual. Son precisamente las cuotas más costosas, porque acumulan más intereses e inflación UVR.
        </Alert>
      </div>

      {/* Franja de comparación rápida — glass dark NUVIA */}
      {cuotasList.length > 0 && (
        <div
          className="rounded-2xl border p-2 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(20,28,54,0.65), rgba(13,18,36,0.6))",
            borderColor: "var(--nuvia-border, rgba(122,160,255,0.18))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -22px rgba(0,0,0,0.55)",
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {cuotasList.map((_, idx) => {
                const c = calcs[idx];
                const isRec = idx === effectiveIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => c.valid && setRecomendadaIdx(idx)}
                    className="group relative flex min-w-0 flex-col items-center gap-1 overflow-hidden rounded-xl border px-3 py-3 text-center backdrop-blur-md transition hover:-translate-y-0.5"
                    style={{
                      background: isRec
                        ? "linear-gradient(135deg, rgba(132,185,143,0.22), rgba(68,93,163,0.20))"
                        : "rgba(20,28,54,0.55)",
                      borderColor: isRec ? "rgba(132,185,143,0.55)" : "rgba(255,255,255,0.10)",
                      boxShadow: isRec
                        ? "0 12px 28px -16px rgba(132,185,143,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                        : "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.25)",
                      cursor: c.valid ? "pointer" : "default",
                    }}
                  >
                    {isRec && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute -top-10 -right-10 h-24 w-24 rounded-full blur-2xl"
                        style={{ background: "radial-gradient(circle, rgba(132,185,143,0.45), transparent 70%)" }}
                      />
                    )}
                    <div
                      className="relative text-[9px] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: isRec ? "#A7E0B8" : "rgba(230,236,255,0.55)" }}
                    >
                      Escenario {idx + 1}
                    </div>
                    {c.valid ? (
                      <div className="relative flex w-full flex-col gap-1.5 px-1 text-left">
                        <FranjaRow
                          label="Cuotas a eliminar"
                          value={`${c.cuotasEliminadas}`}
                          highlight={isRec}
                        />
                        <FranjaRow
                          label="Incremento mensual"
                          value={`+${formatCOP(c.incrementoMensual)}`}
                          highlight={isRec}
                        />
                        <FranjaRow
                          label="Nueva cuota"
                          value={formatCOP(c.nuevaCuota)}
                          highlight={isRec}
                        />
                        <FranjaRow
                          label="Nuevo plazo"
                          value={`${c.nuevoPlazo} m · ${(c.nuevoPlazo / 12).toFixed(1)} a`}
                          highlight={isRec}
                        />
                        <FranjaRow
                          label="Plazo actual → nuevo"
                          value={`${props.cuotasPendientes} → ${c.nuevoPlazo} m`}
                          highlight={isRec}
                        />
                        <FranjaRow
                          label="Honorarios"
                          value={formatCOP(c.honorarios)}
                          highlight={isRec}
                        />
                        <div className="mt-1 border-t pt-1.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                          <div
                            className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: isRec ? "#A7E0B8" : "rgba(230,236,255,0.55)" }}
                          >
                            Ahorro total
                          </div>
                          <div
                            className="bg-clip-text text-[14px] font-extrabold leading-tight text-transparent break-words"
                            style={{
                              backgroundImage:
                                "linear-gradient(135deg, #84B98F 0%, #A7E0B8 100%)",
                            }}
                          >
                            {formatCOP(c.ahorroTotal)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-[13px] font-extrabold leading-none"
                        style={{ color: "#FF7878" }}
                      >
                        No viable
                      </div>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}



      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cuotasList.map((cuotas, idx) => {
          const c = calcs[idx];
          const isRecomendada = idx === effectiveIdx;
          const isMaxAhorro = idx === maxAhorroIdx;
          const veces =
            props.baseCredito > 0 && c.valid
              ? ((props.dineroPagado ?? 0) + c.totalProyectado) / props.baseCredito
              : 0;

          let badgeLabel = "";
          let badgeIcon = "";
          if (isRecomendada && isMaxAhorro) {
            badgeLabel = "Mayor ahorro";
            badgeIcon = "💰";
          } else if (isRecomendada) {
            badgeLabel = "Mejor equilibrio";
            badgeIcon = "🏆";
          } else if (isMaxAhorro) {
            badgeLabel = "Mayor ahorro";
            badgeIcon = "💰";
          }

          return (
            <div
              key={idx}
              className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border backdrop-blur-xl transition hover:-translate-y-0.5"
              style={{
                background: isRecomendada
                  ? "linear-gradient(155deg, rgba(20,28,54,0.85) 0%, rgba(28,55,42,0.78) 60%, rgba(20,40,80,0.78) 100%)"
                  : "linear-gradient(155deg, rgba(20,28,54,0.78), rgba(13,18,36,0.7))",
                borderColor: isRecomendada ? "rgba(132,185,143,0.6)" : "rgba(255,255,255,0.10)",
                boxShadow: isRecomendada
                  ? "0 22px 48px -20px rgba(0,0,0,0.65), 0 10px 28px -16px rgba(132,185,143,0.35), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 14px 36px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Glow halos */}
              <span
                aria-hidden
                className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl"
                style={{
                  background: isRecomendada
                    ? "radial-gradient(circle, rgba(132,185,143,0.40), transparent 70%)"
                    : "radial-gradient(circle, rgba(122,160,255,0.18), transparent 70%)",
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl"
                style={{
                  background: "radial-gradient(circle, rgba(122,160,255,0.16), transparent 70%)",
                }}
              />

              {/* Top accent line for recommended */}
              {isRecomendada && (
                <div
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{
                    background:
                      "linear-gradient(90deg, #445DA3 0%, #7AA0FF 50%, #84B98F 100%)",
                  }}
                />
              )}

              {/* Header escenario */}
              <div className="relative flex items-start justify-between gap-2 px-5 pt-5">
                <div className="flex flex-col gap-2">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(230,236,255,0.55)" }}
                  >
                    Escenario {idx + 1}
                  </div>
                  {badgeLabel && (
                    <div
                      className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
                      style={
                        isRecomendada
                          ? {
                              background:
                                "linear-gradient(135deg, rgba(132,185,143,0.28), rgba(68,93,163,0.28))",
                              color: "#A7E0B8",
                              borderColor: "rgba(132,185,143,0.5)",
                            }
                          : {
                              background: "rgba(246,196,83,0.15)",
                              color: "#F6C453",
                              borderColor: "rgba(246,196,83,0.45)",
                            }
                      }
                    >
                      <span>{badgeIcon}</span>
                      {isRecomendada ? "⭐ " : ""}{badgeLabel}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePropuesta(idx)}
                  className="transition"
                  style={{ color: "rgba(230,236,255,0.4)" }}
                  title="Eliminar escenario"
                >
                  <Trash2 size={14} />
                </button>
              </div>


              {/* Cuotas eliminadas - Prioridad 2 */}
              <div className="relative px-5 pt-4">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: "#9DB6FF" }}
                >
                  Elimina{" "}
                  <span className="text-[15px]" style={{ color: "#FFFFFF" }}>
                    {c.valid ? c.cuotasEliminadas : cuotas}
                  </span>{" "}
                  cuotas
                </div>
              </div>

              {!c.valid ? (
                <div className="relative px-5 pb-5 pt-3">
                  <Alert tone="error">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {c.motivo ?? "No es viable con estos datos."}
                    </span>
                  </Alert>
                  <div className="mt-3">
                    <label
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "rgba(230,236,255,0.6)" }}
                    >
                      Cuotas a eliminar
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(0, props.cuotasPendientes - 1)}
                      value={cuotas}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setCuotas(idx, Number.isFinite(v) ? v : 0);
                      }}
                      className="nuvia-input mt-1 w-full text-base font-bold outline-none"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* AHORRO TOTAL - héroe con gradiente */}
                  <div className="relative px-5 pt-4">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "#A7E0B8" }}
                    >
                      Ahorro total
                    </div>
                    <div
                      className="mt-1 bg-clip-text text-[26px] font-extrabold leading-none text-transparent break-words sm:text-[34px]"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, #84B98F 0%, #A7E0B8 55%, #C8F0D2 100%)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {formatCOP(c.ahorroTotal)}
                    </div>
                  </div>

                  {/* Métricas principales */}
                  <div className="relative grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 px-5 pt-5 min-[380px]:grid-cols-2">
                    <HeroMetric
                      label="Incremento mensual"
                      value={`+${formatCOP(c.incrementoMensual)}`}
                      color="#9DB6FF"
                    />
                    <HeroMetric
                      label="Nueva cuota"
                      value={formatCOP(c.nuevaCuota)}
                      color="#FFFFFF"
                    />
                    <HeroMetric
                      label="Nuevo plazo"
                      value={`${c.nuevoPlazo} meses · ${(c.nuevoPlazo / 12).toFixed(1)} años`}
                      color="#FFFFFF"
                    />
                    <div>
                      <div
                        className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                        style={{ color: "rgba(230,236,255,0.55)" }}
                      >
                        Cuotas a eliminar
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(0, props.cuotasPendientes - 1)}
                        value={cuotas}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          setCuotas(idx, Number.isFinite(v) ? v : 0);
                        }}
                        className="nuvia-input nuvia-input-sm mt-1 w-20 text-base font-bold outline-none"
                      />
                    </div>
                  </div>

                  {/* Comparativo tiempo actual vs nuevo - glass dark */}
                  <div
                    className="relative mx-5 mt-4 overflow-hidden rounded-xl border px-3 py-2.5 backdrop-blur-md"
                    style={{
                      borderColor: "rgba(132,185,143,0.4)",
                      background:
                        "linear-gradient(135deg, rgba(132,185,143,0.18), rgba(20,28,54,0.55))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div
                      className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: "#A7E0B8" }}
                    >
                      Tiempo: actual vs nuevo
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span
                        className="text-[12px] font-semibold line-through"
                        style={{ color: "rgba(230,236,255,0.5)" }}
                      >
                        {props.cuotasPendientes} m · {(props.cuotasPendientes / 12).toFixed(1)} a
                      </span>
                      <span className="text-[14px] font-extrabold" style={{ color: "#A7E0B8" }}>
                        {c.nuevoPlazo} m · {(c.nuevoPlazo / 12).toFixed(1)} a
                      </span>
                    </div>
                    <div className="mt-0.5 text-right text-[10px] font-semibold" style={{ color: "#A7E0B8" }}>
                      −{c.cuotasEliminadas} cuotas (−{(c.cuotasEliminadas / 12).toFixed(1)} años)
                    </div>
                  </div>

                  {/* Traductor de Ahorro NUVIA — solo en el escenario recomendado */}
                  {isRecomendada && (
                    <AbonoInteligenteCard
                      abonoMensual={c.incrementoMensual}
                      ahorroTotal={c.ahorroTotal}
                      anosEliminados={c.añosEliminados}
                      cuotasEliminadas={c.cuotasEliminadas}
                      perfil={props.perfilCliente}
                    />
                  )}

                  {/* Sección secundaria: honorarios y veces pagado */}
                  <div
                    className="relative mt-5 flex flex-col gap-3 border-t px-5 py-3 text-[11px] min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between"
                    style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(230,236,255,0.6)" }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        Honorarios
                      </span>
                      <span className="font-semibold" style={{ color: "#FFFFFF" }}>{formatCOP(c.honorarios)}</span>
                    </div>
                    <div className="flex flex-col min-[380px]:items-end">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        Veces pagado
                      </span>
                      <span className="font-semibold" style={{ color: "#FFFFFF" }}>{formatNumber(veces, 2)}x</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="relative px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => setRecomendadaIdx(idx)}
                      disabled={isRecomendada}
                      className="w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold tracking-wide transition hover:scale-[1.01]"
                      style={
                        isRecomendada
                          ? {
                              background:
                                "linear-gradient(135deg, rgba(132,185,143,0.32), rgba(68,93,163,0.28))",
                              color: "#A7E0B8",
                              border: "1px solid rgba(132,185,143,0.55)",
                              cursor: "default",
                              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                            }
                          : {
                              background:
                                "linear-gradient(135deg, rgba(132,185,143,0.18) 0%, rgba(68,93,163,0.22) 100%)",
                              color: "#E8EDFB",
                              border: "1px solid rgba(132,185,143,0.35)",
                              boxShadow: "0 10px 24px -16px rgba(0,0,0,0.55)",
                            }
                      }
                    >
                      {isRecomendada ? "✓ Escenario recomendado" : "Marcar como recomendado"}
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {cuotasList.length === 0 && (
        <div
          className="rounded-xl border border-dashed p-6 text-center text-sm backdrop-blur-md"
          style={{
            borderColor: "rgba(255,255,255,0.15)",
            background: "rgba(20,28,54,0.4)",
            color: "rgba(230,236,255,0.6)",
          }}
        >
          No hay escenarios. Usa "Nuevo escenario" para agregar uno.
        </div>
      )}
    </Card>
  );
}

function HeroMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div
        className="text-[9px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: "rgba(230,236,255,0.55)" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[17px] font-bold leading-tight tracking-tight"
        style={{ color, letterSpacing: "-0.01em" }}
      >
        {value}
      </div>
    </div>
  );
}

function FranjaRow({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className="text-[8.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: highlight ? "#A7E0B8" : "rgba(230,236,255,0.5)" }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: highlight ? "#A7E0B8" : "#FFFFFF" }}
      >
        {value}
      </span>
    </div>
  );
}
