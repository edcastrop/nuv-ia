import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, Star, AlertTriangle } from "lucide-react";
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

export interface RecomendadaSeleccionada {
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

type Common = {
  cuotasPendientes: number;
  baseCredito: number; // para "veces pagado" (desembolsado o, en su defecto, saldo actual)
  /** Dinero ya pagado a la fecha. Solo se suma cuando la base es el valor desembolsado. */
  dineroPagado?: number;
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

export function PropuestasComerciales(props: Props) {
  const [cuotasList, setCuotasList] = useState<number[]>(() => defaultCuotas(props));
  const [recomendadaIdx, setRecomendadaIdx] = useState<number>(-1);

  // Si cambia el "mode" o el plazo inicial UVR, rehacemos la lista por defecto.
  const seedRef = useRef<string>("");
  useEffect(() => {
    const seed =
      props.mode +
      "::" +
      (props.mode === "uvr" ? props.plazoInicial : "p") +
      "::" +
      props.cuotasPendientes;
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
    props.onRecomendadaChange({
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
      fuente: recomendadaIdx >= 0 ? "manual" : "automatica",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveIdx, calcs, recomendadaIdx]);

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

      {/* Franja de comparación rápida — glass tiles */}
      {cuotasList.length > 0 && (
        <div
          className="rounded-2xl border border-white/55 p-2 backdrop-blur-xl"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(238,245,255,0.35))",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.7), 0 10px 28px -20px rgba(36,52,92,0.18)",
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
                        ? "linear-gradient(135deg, rgba(132,185,143,0.22), rgba(68,93,163,0.16))"
                        : "rgba(255,255,255,0.65)",
                      borderColor: isRec ? "rgba(132,185,143,0.55)" : "rgba(255,255,255,0.7)",
                      boxShadow: isRec
                        ? "0 12px 28px -16px rgba(132,185,143,0.45), inset 0 1px 0 rgba(255,255,255,0.65)"
                        : "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(36,52,92,0.04)",
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
                      style={{ color: isRec ? "#1F5A3A" : "#5C6B85" }}
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
                        <div className="mt-1 border-t pt-1.5" style={{ borderColor: "rgba(255,255,255,0.6)" }}>
                          <div
                            className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                            style={{ color: isRec ? "#1F5A3A" : "#5C6B85" }}
                          >
                            Ahorro total
                          </div>
                          <div
                            className="bg-clip-text text-[14px] font-extrabold leading-tight text-transparent break-words"
                            style={{
                              backgroundImage:
                                "linear-gradient(135deg, #1F7A45 0%, #2EA866 100%)",
                            }}
                          >
                            {formatCOP(c.ahorroTotal)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="text-[13px] font-extrabold leading-none"
                        style={{ color: "#C0392B" }}
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


      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
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
              className="relative flex min-w-0 flex-col rounded-2xl border bg-white transition"
              style={{
                borderColor: isRecomendada ? "#5CA875" : "#ECEFF3",
                boxShadow: isRecomendada
                  ? "0 12px 32px -14px rgba(92,168,117,0.35)"
                  : "0 1px 2px rgba(36,36,36,0.03)",
              }}
            >
              {/* Header escenario */}
              <div className="flex items-start justify-between gap-2 px-5 pt-5">
                <div className="flex flex-col gap-2">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "#8893A0" }}
                  >
                    Escenario {idx + 1}
                  </div>
                  {badgeLabel && (
                    <div
                      className="inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: isRecomendada ? "#E8F5EC" : "#FFF8E1",
                        color: isRecomendada ? "#1F7A45" : "#8A6D00",
                      }}
                    >
                      <span>{badgeIcon}</span>
                      {isRecomendada ? "⭐ " : ""}{badgeLabel}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePropuesta(idx)}
                  className="text-[#242424]/30 transition hover:text-[#C0392B]"
                  title="Eliminar escenario"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Cuotas eliminadas - Prioridad 2 */}
              <div className="px-5 pt-4">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: NUVEX.azul }}
                >
                  Elimina{" "}
                  <span className="text-[15px]" style={{ color: NUVEX.negro }}>
                    {c.valid ? c.cuotasEliminadas : cuotas}
                  </span>{" "}
                  cuotas
                </div>
              </div>

              {!c.valid ? (
                <div className="px-5 pb-5 pt-3">
                  <Alert tone="error">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {c.motivo ?? "No es viable con estos datos."}
                    </span>
                  </Alert>
                  <div className="mt-3">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/65">
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
                      className="mt-1 w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-base font-bold text-[#242424] outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* AHORRO TOTAL - Prioridad 1 (héroe) */}
                  <div className="px-5 pt-4">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ color: "#1F7A45" }}
                    >
                      Ahorro total
                    </div>
                    <div
                      className="mt-1 break-words text-[26px] font-extrabold leading-none sm:text-[34px]"
                      style={{
                        color: "#1F7A45",
                      }}
                    >
                      {formatCOP(c.ahorroTotal)}
                    </div>
                  </div>

                  {/* Métricas principales */}
                  <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 px-5 pt-5 min-[380px]:grid-cols-2">
                    <HeroMetric
                      label="Incremento mensual"
                      value={`+${formatCOP(c.incrementoMensual)}`}
                      color={NUVEX.azul}
                    />
                    <HeroMetric
                      label="Nueva cuota"
                      value={formatCOP(c.nuevaCuota)}
                      color={NUVEX.negro}
                    />
                    <HeroMetric
                      label="Nuevo plazo"
                      value={`${c.nuevoPlazo} meses · ${(c.nuevoPlazo / 12).toFixed(1)} años`}
                      color={NUVEX.negro}
                    />
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8893A0]">
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
                        className="mt-1 w-20 rounded-md border border-[#E3E7EE] bg-white px-2 py-1 text-base font-bold text-[#242424] outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15"
                      />
                    </div>
                  </div>

                  {/* Comparativo tiempo actual vs nuevo */}
                  <div
                    className="mx-5 mt-4 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: "#E6F2EA", backgroundColor: "#F4FBF6" }}
                  >
                    <div
                      className="text-[9px] font-semibold uppercase tracking-[0.16em]"
                      style={{ color: "#1F7A45" }}
                    >
                      Tiempo: actual vs nuevo
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold text-[#6B7480] line-through">
                        {props.cuotasPendientes} m · {(props.cuotasPendientes / 12).toFixed(1)} a
                      </span>
                      <span className="text-[14px] font-extrabold" style={{ color: "#1F7A45" }}>
                        {c.nuevoPlazo} m · {(c.nuevoPlazo / 12).toFixed(1)} a
                      </span>
                    </div>
                    <div className="mt-0.5 text-right text-[10px] font-semibold" style={{ color: "#1F7A45" }}>
                      −{c.cuotasEliminadas} cuotas (−{(c.cuotasEliminadas / 12).toFixed(1)} años)
                    </div>
                  </div>


                  {/* Sección secundaria: honorarios y veces pagado */}
                  <div
                    className="mt-5 flex flex-col gap-3 border-t px-5 py-3 text-[11px] min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between"
                    style={{ borderColor: "#F0F2F5", color: "#6B7480" }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        Honorarios
                      </span>
                      <span className="font-semibold text-[#242424]">{formatCOP(c.honorarios)}</span>
                    </div>
                    <div className="flex flex-col min-[380px]:items-end">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
                        Veces pagado
                      </span>
                      <span className="font-semibold text-[#242424]">{formatNumber(veces, 2)}x</span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-5 pb-5">
                    <button
                      type="button"
                      onClick={() => setRecomendadaIdx(idx)}
                      disabled={isRecomendada}
                      className="w-full rounded-lg px-3 py-2.5 text-[11px] font-semibold tracking-wide transition"
                      style={
                        isRecomendada
                          ? { backgroundColor: "#E6F2EA", color: "#1F7A45", cursor: "default" }
                          : { backgroundColor: NUVEX.negro, color: "#fff" }
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
        <div className="rounded-lg border border-dashed border-[#E3E7EE] p-6 text-center text-sm text-[#242424]/60">
          No hay escenarios. Usa “Nuevo escenario” para agregar uno.
        </div>
      )}
    </Card>
  );
}

function HeroMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8893A0]">
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
        style={{ color: highlight ? "#1F7A45" : "#8893A0" }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-bold tabular-nums"
        style={{ color: highlight ? "#1F7A45" : "#242424" }}
      >
        {value}
      </span>
    </div>
  );
}
