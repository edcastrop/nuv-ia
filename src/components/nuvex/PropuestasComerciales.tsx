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
  baseCredito: number; // para "veces pagado"
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

  const letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <SectionTitle sub="Edita el número de cuotas a eliminar en cada propuesta o agrega nuevas. Marca la propuesta que enviarás al cliente.">
          Propuestas comerciales
        </SectionTitle>
        <button
          type="button"
          onClick={addPropuesta}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
          style={{ backgroundColor: NUVEX.azul }}
        >
          <Plus size={14} /> Nueva propuesta
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cuotasList.map((cuotas, idx) => {
          const c = calcs[idx];
          const isRecomendada = idx === effectiveIdx;
          const veces =
            props.baseCredito > 0 && c.valid ? c.totalProyectado / props.baseCredito : 0;
          return (
            <div
              key={idx}
              className="relative flex flex-col gap-3 rounded-2xl border p-4 transition"
              style={{
                borderColor: isRecomendada ? NUVEX.verde : "#E3E7EE",
                backgroundColor: isRecomendada ? "#F4FBF6" : "#FFFFFF",
                boxShadow: isRecomendada
                  ? "0 8px 24px -10px rgba(132,185,143,0.45)"
                  : "0 1px 3px rgba(36,36,36,0.04)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: isRecomendada ? "#1F7A45" : NUVEX.azul }}
                  >
                    Propuesta {letters[idx] ?? idx + 1}
                  </div>
                  {isRecomendada && (
                    <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-[#5CA875] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      <Star size={9} /> Recomendada
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removePropuesta(idx)}
                  className="text-[#242424]/40 hover:text-[#C0392B]"
                  title="Eliminar propuesta"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
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

              {!c.valid ? (
                <Alert tone="error">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {c.motivo ?? "No es viable con estos datos."}
                  </span>
                </Alert>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric label="Nueva cuota" value={formatCOP(c.nuevaCuota)} tone="primary" />
                    <Metric
                      label="Ahorro total"
                      value={formatCOP(c.ahorroTotal)}
                      tone="success"
                    />
                    <Metric label="Honorarios" value={formatCOP(c.honorarios)} />
                    <Metric label="Nuevo plazo" value={`${c.nuevoPlazo} meses`} />
                    <Metric
                      label="Abono mensual"
                      value={formatCOP(c.incrementoMensual)}
                    />
                    <Metric
                      label="Veces pagado"
                      value={`${formatNumber(veces, 2)}x`}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setRecomendadaIdx(idx)}
                    disabled={isRecomendada}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-[11px] font-semibold transition"
                    style={
                      isRecomendada
                        ? { backgroundColor: "#E6F2EA", color: "#1F7A45", cursor: "default" }
                        : { backgroundColor: NUVEX.negro, color: "#fff" }
                    }
                  >
                    {isRecomendada ? "✓ Marcada como recomendada" : "Marcar como recomendada"}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {cuotasList.length === 0 && (
        <div className="rounded-lg border border-dashed border-[#E3E7EE] p-6 text-center text-sm text-[#242424]/60">
          No hay propuestas. Usa “Nueva propuesta” para agregar una.
        </div>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success";
}) {
  const bg = tone === "success" ? "#E6F2EA" : tone === "primary" ? "#EEF1FA" : "#F7F9FB";
  const color = tone === "success" ? "#1F7A45" : tone === "primary" ? NUVEX.azul : NUVEX.negro;
  return (
    <div className="rounded-lg p-2" style={{ backgroundColor: bg }}>
      <div className="text-[9px] font-semibold uppercase tracking-wider" style={{ color, opacity: 0.75 }}>
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
