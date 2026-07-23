import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, AlertTriangle, PhoneCall, Calculator, ChevronDown, ChevronUp, Star } from "lucide-react";
import { formatCOP, formatNumber } from "../../lib/format";
import {
  getUVRReductionOptions,
  type PesosInput,
  type UVRInput,
  type UVREscenarioActual,
} from "../../lib/finance";
// Motor puro común (Pesos + UVR). Elimina la divergencia con el padre
// (`UVRSimulator` consume el mismo motor vía `buildUvrEscenarios`).
import {
  computePropuestaPesos,
  computePropuestaUVR,
  type PropuestaCalc,
} from "../../lib/propuestasEngine";
import { Card, SectionTitle, Alert } from "./ui";
import { AbonoInteligenteCard } from "./AbonoInteligenteCard";
import { PerfilIngresosEnVivo, type IngresosCliente, type PropuestaParaCapacidad } from "./PerfilIngresosEnVivo";
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

// Contrato de solo lectura (auditor): callbacks bloqueados a nivel de tipos.
type InteractiveCommon = {
  readOnly?: false;
  cuotasPendientes: number;
  baseCredito: number;
  dineroPagado?: number;
  perfilCliente?: PerfilCliente;
  ingresos?: IngresosCliente;
  onIngresosChange?: (v: IngresosCliente) => void;
  initialState?: PropuestasComercialesDraft;
  onStateChange?: (s: PropuestasComercialesSnapshot) => void;
  onRecomendadaChange: (r: RecomendadaSeleccionada | null) => void;
};

type AuditorCommon = {
  readOnly: true;
  cuotasPendientes: number;
  baseCredito: number;
  dineroPagado?: never;
  perfilCliente?: never;
  ingresos?: never;
  onIngresosChange?: never;
  initialState?: never;
  onStateChange?: never;
  onRecomendadaChange?: never;
  /** Escenarios materializados (v2 histórico o legacy reconstruido). Deben ser exactamente 4. */
  auditorEscenarios: Array<{
    index: number;
    cuotasEliminadas: number;
    añosEliminados: number;
    nuevoPlazo: number;
    nuevaCuota: number;
    ahorroIntereses?: number;
    ahorroSeguros?: number;
    ahorroTotal: number;
    honorarios: number;
    totalProyectado?: number;
    incrementoMensual?: number;
  }>;
  /**
   * Índice histórico del escenario recomendado. `null` cuando no puede
   * determinarse con certeza — ninguna tarjeta se resalta como recomendada.
   */
  auditorRecomendadaIdx?: number | null;
  auditorBannerLegacy?: string | null;
  auditorUvrVariationConflict?: null | { snapshotValue: number; inputsValue: number; chosen: number };
};

type PesosProps = InteractiveCommon & {
  mode: "pesos";
  input: PesosInput;
};

type UVRProps = InteractiveCommon & {
  mode: "uvr";
  input: UVRInput;
  escenarioActual: UVREscenarioActual;
  plazoInicial: number;
};

type AuditorProps = AuditorCommon & {
  mode: "pesos" | "uvr";
};

type Props = PesosProps | UVRProps | AuditorProps;

// `PropuestaCalc` proviene ahora de `propuestasEngine` (motor común).
// El renderer visual sólo añade `cuotasInput` para alimentar el input.
interface EscenarioLayout extends PropuestaCalc {
  index: number;
  cuotasInput: number;
}

function computePropuesta(props: PesosProps | UVRProps, cuotasEliminadas: number): PropuestaCalc {
  if (props.mode === "pesos") return computePropuestaPesos(props.input, cuotasEliminadas);
  return computePropuestaUVR(props.input, props.escenarioActual, cuotasEliminadas);
}

function defaultCuotas(props: PesosProps | UVRProps): number[] {
  if (props.mode === "uvr") return getUVRReductionOptions(props.plazoInicial);
  return [12, 24, 36, 48];
}

function propsSeed(props: PesosProps | UVRProps): string {
  return `${props.mode}::${props.mode === "uvr" ? props.plazoInicial : "p"}::${props.cuotasPendientes}`;
}

function toPdfRow(c: PropuestaCalc, index: number, fuente: "automatica" | "manual"): PropuestaComercialPdfRow {
  return {
    index,
    cuotasEliminadas: c.cuotasEliminadas, añosEliminados: c.añosEliminados,
    nuevoPlazo: c.nuevoPlazo, nuevaCuota: c.nuevaCuota,
    ahorroIntereses: c.ahorroIntereses, ahorroSeguros: c.ahorroSeguros,
    ahorroTotal: c.ahorroTotal, honorarios: c.honorarios,
    totalProyectado: c.totalProyectado, incrementoMensual: c.incrementoMensual,
    fuente,
  };
}

export function PropuestasComerciales(props: Props) {
  // Switch de nivel superior: cada rama es un componente independiente con
  // su propio orden estable de hooks. No hay hooks condicionales.
  if (props.readOnly) return <PropuestasComercialesReadOnly {...props} />;
  return <PropuestasComercialesInteractive {...(props as PesosProps | UVRProps)} />;
}

// ═════════════════════════════════════════════════════════════════════
// Modo auditor (solo lectura)
// ═════════════════════════════════════════════════════════════════════
function PropuestasComercialesReadOnly(props: AuditorProps) {
  const { auditorEscenarios, auditorBannerLegacy, auditorUvrVariationConflict } = props;
  const rawIdx = props.auditorRecomendadaIdx;

  // Invariante de renderizado: sólo se muestran tarjetas si hay exactamente
  // 4 escenarios. Un conjunto parcial nunca se pinta.
  const escenariosValidos = auditorEscenarios.length === 4;

  const recommendedIndex: number | null = useMemo(() => {
    if (!escenariosValidos) return null;
    if (rawIdx === undefined || rawIdx === null) return null;
    if (!Number.isInteger(rawIdx)) return null;
    if (rawIdx < 0 || rawIdx >= auditorEscenarios.length) return null;
    return rawIdx;
  }, [rawIdx, escenariosValidos, auditorEscenarios.length]);

  const escenariosLayout: EscenarioLayout[] = useMemo(
    () => auditorEscenarios.map((e) => ({
      index: e.index,
      valid: true,
      cuotasEliminadas: e.cuotasEliminadas,
      añosEliminados: e.añosEliminados,
      nuevoPlazo: e.nuevoPlazo,
      nuevaCuota: e.nuevaCuota,
      ahorroIntereses: e.ahorroIntereses ?? 0,
      ahorroSeguros: e.ahorroSeguros ?? 0,
      ahorroTotal: e.ahorroTotal,
      honorarios: e.honorarios,
      totalProyectado: e.totalProyectado ?? 0,
      incrementoMensual: e.incrementoMensual ?? 0,
      cuotasInput: e.cuotasEliminadas,
    })),
    [auditorEscenarios],
  );

  // cuotasPendientes: derivable como nuevoPlazo + cuotasEliminadas del
  // primer escenario válido (invariante financiera del motor).
  const cuotasPendientes = escenariosValidos
    ? escenariosLayout[0].nuevoPlazo + escenariosLayout[0].cuotasEliminadas
    : 0;

  return (
    <Card>
      <SectionTitle sub="Escenarios financieros del expediente (solo lectura, vista del auditor).">
        Propuestas comerciales
      </SectionTitle>
      {auditorBannerLegacy && (
        <div className="mb-3">
          <Alert tone="warn">
            <span className="font-semibold">Escenarios reconstruidos por retrocompatibilidad.</span>{" "}
            {auditorBannerLegacy}
          </Alert>
        </div>
      )}
      {auditorUvrVariationConflict && (
        <div className="mb-3">
          <Alert tone="warn">
            Conflicto de Variación UVR EA: snapshot={auditorUvrVariationConflict.snapshotValue}% ·
            inputs={auditorUvrVariationConflict.inputsValue}% · aplicado={auditorUvrVariationConflict.chosen}%.
          </Alert>
        </div>
      )}
      {!escenariosValidos ? (
        <div
          className="rounded-xl border border-dashed p-6 text-center text-sm backdrop-blur-md"
          style={{
            borderColor: "rgba(255,255,255,0.15)",
            background: "rgba(20,28,54,0.4)",
            color: "rgba(230,236,255,0.6)",
          }}
        >
          Sin escenarios disponibles.
        </div>
      ) : (
        <PropuestasCardsLayout
          escenarios={escenariosLayout}
          recommendedIndex={recommendedIndex}
          cuotasPendientes={cuotasPendientes}
          baseCredito={0}
          dineroPagado={0}
          readOnly
        />
      )}
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Modo analista (interactivo). Preserva íntegramente todos los hooks,
// callbacks y comportamiento original.
// ═════════════════════════════════════════════════════════════════════
function PropuestasComercialesInteractive(props: PesosProps | UVRProps) {
  const [revision, setRevision] = useState(0);
  const [cuotasList, setCuotasList] = useState<number[]>(() =>
    props.initialState?.cuotasList?.length ? props.initialState.cuotasList : defaultCuotas(props),
  );
  const [recomendadaIdx, setRecomendadaIdx] = useState<number>(
    props.initialState?.recomendadaIdx ?? -1,
  );

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
    setCuotasList((list) => {
      const next = list.filter((_, i) => i !== idx);
      setRevision((r) => r + 1);
      return next;
    });
    setRecomendadaIdx((current) => {
      if (current === idx) return -1;
      if (current > idx) return current - 1;
      return current;
    });
  };

  const addPropuesta = () => {
    const max = Math.max(...cuotasList, 0);
    const sugerida = Math.min(props.cuotasPendientes - 1, Math.max(12, max + 12));
    setCuotasList((list) => [...list, sugerida]);
  };

  const buscarCuotasPorAbono = (abonoMensualDeseado: number): { cuotasEliminadas: number; calc: PropuestaCalc } | null => {
    if (!Number.isFinite(abonoMensualDeseado) || abonoMensualDeseado <= 0) return null;
    const maxCuotas = Math.max(0, props.cuotasPendientes - 1);
    let best: { cuotasEliminadas: number; calc: PropuestaCalc; diff: number } | null = null;
    for (let n = 1; n <= maxCuotas; n++) {
      const c = computePropuesta(props, n);
      if (!c.valid) continue;
      const diff = Math.abs(c.incrementoMensual - abonoMensualDeseado);
      if (!best || diff < best.diff) best = { cuotasEliminadas: n, calc: c, diff };
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

  const escenariosLayout: EscenarioLayout[] = calcs.map((c, i) => ({
    ...c,
    index: i,
    cuotasInput: cuotasList[i] ?? 0,
  }));

  const recommendedIndex: number | null = effectiveIdx >= 0 ? effectiveIdx : null;

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
          style={{ background: "linear-gradient(135deg, #445DA3 0%, #5B7DC8 60%, #84B98F 100%)" }}
        >
          <Plus size={14} /> Nuevo escenario
        </button>
      </div>

      <div className="mb-4">
        <Alert tone="info">
          <span className="font-semibold">¿Qué cuotas se eliminan?</span> El abono adicional a capital reduce el saldo pendiente, pero la cuota mensual se mantiene igual. Esto hace que el crédito termine antes — las cuotas que «desaparecen» son las <strong>últimas del cronograma</strong> (las más lejanas en el tiempo), no las que siguen a la cuota actual. Son precisamente las cuotas más costosas, porque acumulan más intereses e inflación UVR.
        </Alert>
      </div>

      <CalculadoraEnVivo
        cuotasPendientes={props.cuotasPendientes}
        buscarCuotasPorAbono={buscarCuotasPorAbono}
        onAgregarEscenario={agregarEscenarioCuotas}
      />

      {props.onIngresosChange && (
        <PerfilIngresosEnVivo
          value={props.ingresos ?? {}}
          onChange={props.onIngresosChange}
          cuotaRecomendada={calcs[effectiveIdx]?.nuevaCuota ?? 0}
          propuestas={calcs.map<PropuestaParaCapacidad>((c, i) => ({
            index: i, cuotasEliminadas: c.cuotasEliminadas,
            nuevaCuota: c.nuevaCuota, valid: c.valid,
          }))}
          onSugerirEscenario={(idx) => setRecomendadaIdx(idx)}
        />
      )}

      <PropuestasCardsLayout
        escenarios={escenariosLayout}
        recommendedIndex={recommendedIndex}
        cuotasPendientes={props.cuotasPendientes}
        baseCredito={props.baseCredito}
        dineroPagado={props.dineroPagado}
        perfilCliente={props.perfilCliente}
        readOnly={false}
        onCuotasChange={setCuotas}
        onRemove={removePropuesta}
        onMarkRecommended={(i) => setRecomendadaIdx(i)}
        revision={revision}
      />

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

// ═════════════════════════════════════════════════════════════════════
// Renderer visual compartido — tarjetas de escenarios.
// Recibe `readOnly` explícito; los handlers son una barrera secundaria.
// ═════════════════════════════════════════════════════════════════════
interface CardsLayoutProps {
  escenarios: EscenarioLayout[];
  recommendedIndex: number | null;
  cuotasPendientes: number;
  baseCredito: number;
  dineroPagado?: number;
  perfilCliente?: PerfilCliente;
  readOnly: boolean;
  onCuotasChange?: (idx: number, val: number) => void;
  onRemove?: (idx: number) => void;
  onMarkRecommended?: (idx: number) => void;
  revision?: number;
}

function PropuestasCardsLayout({
  escenarios,
  recommendedIndex,
  cuotasPendientes,
  baseCredito,
  dineroPagado,
  perfilCliente,
  readOnly,
  onCuotasChange,
  onRemove,
  onMarkRecommended,
  revision = 0,
}: CardsLayoutProps) {
  // Etiqueta "Mayor ahorro" — es independiente de la recomendación.
  const maxAhorroIdx = useMemo(() => {
    let best = -1;
    let bestVal = -Infinity;
    escenarios.forEach((c, i) => {
      if (c.valid && c.ahorroTotal > bestVal) {
        bestVal = c.ahorroTotal;
        best = i;
      }
    });
    return best;
  }, [escenarios]);

  const canEditRecommended = !readOnly && typeof onMarkRecommended === "function";
  const canRemove = !readOnly && typeof onRemove === "function";
  const canEditCuotas = !readOnly && typeof onCuotasChange === "function";

  return (
    <>
      {/* Franja de comparación rápida — glass dark NUVIA */}
      {escenarios.length > 0 && (
        <div
          className="rounded-2xl border p-2 backdrop-blur-xl"
          style={{
            background: "linear-gradient(135deg, rgba(20,28,54,0.65), rgba(13,18,36,0.6))",
            borderColor: "var(--nuvia-border, rgba(122,160,255,0.18))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 16px 40px -22px rgba(0,0,0,0.55)",
          }}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {escenarios.map((c, idx) => {
              const isRec = recommendedIndex === idx;
              const baseStyle = {
                background: isRec
                  ? "linear-gradient(135deg, rgba(132,185,143,0.22), rgba(68,93,163,0.20))"
                  : "rgba(20,28,54,0.55)",
                borderColor: isRec ? "rgba(132,185,143,0.55)" : "rgba(255,255,255,0.10)",
                boxShadow: isRec
                  ? "0 12px 28px -16px rgba(132,185,143,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04), 0 2px 8px rgba(0,0,0,0.25)",
              };
              const commonClass =
                "group relative flex min-w-0 flex-col items-center gap-1 overflow-hidden rounded-xl border px-3 py-3 text-center backdrop-blur-md transition";
              const inner = (
                <>
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
                      <FranjaRow label="Cuotas a eliminar" value={`${c.cuotasEliminadas}`} highlight={isRec} />
                      <FranjaRow label="Incremento mensual" value={`+${formatCOP(c.incrementoMensual)}`} highlight={isRec} />
                      <FranjaRow label="Nueva cuota" value={formatCOP(c.nuevaCuota)} highlight={isRec} />
                      <FranjaRow label="Nuevo plazo" value={`${c.nuevoPlazo} m · ${(c.nuevoPlazo / 12).toFixed(1)} a`} highlight={isRec} />
                      <FranjaRow label="Plazo actual → nuevo" value={`${cuotasPendientes} → ${c.nuevoPlazo} m`} highlight={isRec} />
                      <FranjaRow label="Honorarios" value={formatCOP(c.honorarios)} highlight={isRec} />
                      <div className="mt-1 border-t pt-1.5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                        <div
                          className="text-[8px] font-semibold uppercase tracking-[0.14em]"
                          style={{ color: isRec ? "#A7E0B8" : "rgba(230,236,255,0.55)" }}
                        >
                          Ahorro total
                        </div>
                        <div
                          className="bg-clip-text text-[14px] font-extrabold leading-tight text-transparent break-words"
                          style={{ backgroundImage: "linear-gradient(135deg, #84B98F 0%, #A7E0B8 100%)" }}
                        >
                          {formatCOP(c.ahorroTotal)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[13px] font-extrabold leading-none" style={{ color: "#FF7878" }}>
                      No viable
                    </div>
                  )}
                </>
              );
              return canEditRecommended ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => c.valid && onMarkRecommended!(idx)}
                  className={commonClass + " hover:-translate-y-0.5"}
                  style={{ ...baseStyle, cursor: c.valid ? "pointer" : "default" }}
                >
                  {inner}
                </button>
              ) : (
                <div key={idx} className={commonClass} style={baseStyle}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {escenarios.map((c, idx) => {
          const isRecomendada = recommendedIndex === idx;
          const isMaxAhorro = idx === maxAhorroIdx;
          const veces = baseCredito > 0 && c.valid
            ? ((dineroPagado ?? 0) + c.totalProyectado) / baseCredito
            : 0;

          return (
            <div
              key={`${revision}-${idx}-${c.cuotasInput}`}
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
              <span aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl"
                style={{
                  background: isRecomendada
                    ? "radial-gradient(circle, rgba(132,185,143,0.40), transparent 70%)"
                    : "radial-gradient(circle, rgba(122,160,255,0.18), transparent 70%)",
                }} />
              <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(122,160,255,0.16), transparent 70%)" }} />

              {isRecomendada && (
                <div aria-hidden className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: "linear-gradient(90deg, #445DA3 0%, #7AA0FF 50%, #84B98F 100%)" }} />
              )}

              {/* Header escenario: badges independientes */}
              <div className="relative flex items-start justify-between gap-2 px-5 pt-5">
                <div className="flex flex-col gap-2">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "rgba(230,236,255,0.55)" }}
                  >
                    Escenario {idx + 1}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isRecomendada && (
                      <span
                        className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
                        style={{
                          background: "linear-gradient(135deg, rgba(132,185,143,0.28), rgba(68,93,163,0.28))",
                          color: "#A7E0B8",
                          borderColor: "rgba(132,185,143,0.5)",
                        }}
                      >
                        <Star size={10} /> Escenario recomendado
                      </span>
                    )}
                    {isMaxAhorro && (
                      <span
                        className="inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"
                        style={{
                          background: "rgba(246,196,83,0.15)",
                          color: "#F6C453",
                          borderColor: "rgba(246,196,83,0.45)",
                        }}
                      >
                        💰 Mayor ahorro
                      </span>
                    )}
                  </div>
                </div>
                {canRemove && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemove!(idx);
                    }}
                    className="transition"
                    style={{ color: "rgba(230,236,255,0.4)" }}
                    title="Eliminar escenario"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="relative px-5 pt-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#9DB6FF" }}>
                  Elimina{" "}
                  <span className="text-[15px]" style={{ color: "#FFFFFF" }}>
                    {c.valid ? c.cuotasEliminadas : c.cuotasInput}
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
                  {canEditCuotas && (
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
                        max={Math.max(0, cuotasPendientes - 1)}
                        value={c.cuotasInput}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          onCuotasChange!(idx, Number.isFinite(v) ? v : 0);
                        }}
                        className="nuvia-input mt-1 w-full text-base font-bold outline-none"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="relative px-5 pt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#A7E0B8" }}>
                      Ahorro total
                    </div>
                    <div
                      className="mt-1 bg-clip-text text-[26px] font-extrabold leading-none text-transparent break-words sm:text-[34px]"
                      style={{
                        backgroundImage: "linear-gradient(135deg, #84B98F 0%, #A7E0B8 55%, #C8F0D2 100%)",
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {formatCOP(c.ahorroTotal)}
                    </div>
                  </div>

                  <div className="relative grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 px-5 pt-5 min-[380px]:grid-cols-2">
                    <HeroMetric label="Incremento mensual" value={`+${formatCOP(c.incrementoMensual)}`} color="#9DB6FF" />
                    <HeroMetric label="Nueva cuota" value={formatCOP(c.nuevaCuota)} color="#FFFFFF" />
                    <HeroMetric
                      label="Nuevo plazo"
                      value={`${c.nuevoPlazo} meses · ${(c.nuevoPlazo / 12).toFixed(1)} años`}
                      color="#FFFFFF"
                    />
                    {canEditCuotas ? (
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
                          max={Math.max(0, cuotasPendientes - 1)}
                          value={c.cuotasInput}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            onCuotasChange!(idx, Number.isFinite(v) ? v : 0);
                          }}
                          className="nuvia-input nuvia-input-sm mt-1 w-20 text-base font-bold outline-none"
                        />
                      </div>
                    ) : (
                      <HeroMetric label="Cuotas eliminadas" value={String(c.cuotasEliminadas)} color="#FFFFFF" />
                    )}
                  </div>

                  <div
                    className="relative mx-5 mt-4 overflow-hidden rounded-xl border px-3 py-2.5 backdrop-blur-md"
                    style={{
                      borderColor: "rgba(132,185,143,0.4)",
                      background: "linear-gradient(135deg, rgba(132,185,143,0.18), rgba(20,28,54,0.55))",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                    }}
                  >
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#A7E0B8" }}>
                      Tiempo: actual vs nuevo
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-semibold line-through" style={{ color: "rgba(230,236,255,0.5)" }}>
                        {cuotasPendientes} m · {(cuotasPendientes / 12).toFixed(1)} a
                      </span>
                      <span className="text-[14px] font-extrabold" style={{ color: "#A7E0B8" }}>
                        {c.nuevoPlazo} m · {(c.nuevoPlazo / 12).toFixed(1)} a
                      </span>
                    </div>
                    <div className="mt-0.5 text-right text-[10px] font-semibold" style={{ color: "#A7E0B8" }}>
                      −{c.cuotasEliminadas} cuotas (−{(c.cuotasEliminadas / 12).toFixed(1)} años)
                    </div>
                  </div>

                  {/* Traductor de ahorro — sólo modo analista y sólo en el recomendado */}
                  {!readOnly && isRecomendada && (
                    <AbonoInteligenteCard
                      abonoMensual={c.incrementoMensual}
                      ahorroTotal={c.ahorroTotal}
                      anosEliminados={c.añosEliminados}
                      cuotasEliminadas={c.cuotasEliminadas}
                      perfil={perfilCliente}
                    />
                  )}

                  <div
                    className="relative mt-5 flex flex-col gap-3 border-t px-5 py-3 text-[11px] min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between"
                    style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(230,236,255,0.6)" }}
                  >
                    <div className="flex flex-col">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">Honorarios</span>
                      <span className="font-semibold" style={{ color: "#FFFFFF" }}>{formatCOP(c.honorarios)}</span>
                    </div>
                    <div className="flex flex-col min-[380px]:items-end">
                      <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70">Veces pagado</span>
                      <span className="font-semibold" style={{ color: "#FFFFFF" }}>
                        {baseCredito > 0 ? `${formatNumber(veces, 2)}x` : "—"}
                      </span>
                    </div>
                  </div>

                  {/* CTA de recomendación — sólo modo analista */}
                  {canEditRecommended && (
                    <div className="relative px-5 pb-5">
                      <button
                        type="button"
                        onClick={() => onMarkRecommended!(idx)}
                        disabled={isRecomendada}
                        className="w-full rounded-xl px-3 py-2.5 text-[12px] font-semibold tracking-wide transition hover:scale-[1.01]"
                        style={
                          isRecomendada
                            ? {
                                background: "linear-gradient(135deg, rgba(132,185,143,0.32), rgba(68,93,163,0.28))",
                                color: "#A7E0B8",
                                border: "1px solid rgba(132,185,143,0.55)",
                                cursor: "default",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                              }
                            : {
                                background: "linear-gradient(135deg, rgba(132,185,143,0.18) 0%, rgba(68,93,163,0.22) 100%)",
                                color: "#E8EDFB",
                                border: "1px solid rgba(132,185,143,0.35)",
                                boxShadow: "0 10px 24px -16px rgba(0,0,0,0.55)",
                              }
                        }
                      >
                        {isRecomendada ? "✓ Escenario recomendado" : "Marcar como recomendado"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function HeroMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(230,236,255,0.55)" }}>
        {label}
      </div>
      <div className="mt-1 text-[17px] font-bold leading-tight tracking-tight" style={{ color, letterSpacing: "-0.01em" }}>
        {value}
      </div>
    </div>
  );
}

function FranjaRow({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: highlight ? "#A7E0B8" : "rgba(230,236,255,0.5)" }}>
        {label}
      </span>
      <span className="text-[11px] font-bold tabular-nums"
        style={{ color: highlight ? "#A7E0B8" : "#FFFFFF" }}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calculadora en vivo — sólo modo analista.
// ---------------------------------------------------------------------------
function CalculadoraEnVivo({
  cuotasPendientes,
  buscarCuotasPorAbono,
  onAgregarEscenario,
}: {
  cuotasPendientes: number;
  buscarCuotasPorAbono: (abono: number) => { cuotasEliminadas: number; calc: PropuestaCalc } | null;
  onAgregarEscenario: (cuotas: number) => void;
}) {
  const [abierta, setAbierta] = useState(true);
  const [abonoStr, setAbonoStr] = useState<string>("");

  const abono = useMemo(() => {
    const n = parseInt(abonoStr.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }, [abonoStr]);

  const resultado = useMemo(
    () => (abono > 0 ? buscarCuotasPorAbono(abono) : null),
    [abono, buscarCuotasPorAbono],
  );

  const sugerencias = [100_000, 150_000, 200_000, 300_000, 500_000];

  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl border backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, rgba(20,28,54,0.85) 0%, rgba(28,55,42,0.55) 60%, rgba(20,40,80,0.7) 100%)",
        borderColor: "rgba(132,185,143,0.45)",
        boxShadow: "0 18px 44px -22px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              background: "linear-gradient(135deg, rgba(132,185,143,0.35), rgba(68,93,163,0.35))",
              border: "1px solid rgba(132,185,143,0.55)",
              color: "#A7E0B8",
            }}>
            <PhoneCall size={14} />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "#A7E0B8" }}>
              <Calculator size={12} /> Calculadora en vivo
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{
                  background: "rgba(132,185,143,0.18)",
                  color: "#A7E0B8",
                  border: "1px solid rgba(132,185,143,0.4)",
                }}>
                En llamada
              </span>
            </div>
            <div className="text-[11.5px]" style={{ color: "rgba(230,236,255,0.7)" }}>
              ¿Cuánto quiere abonar el cliente cada mes? Te muestro al instante cuántas cuotas se eliminan.
            </div>
          </div>
        </div>
        <span style={{ color: "rgba(230,236,255,0.65)" }}>
          {abierta ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {abierta && (
        <div className="px-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "rgba(230,236,255,0.6)" }}>
                Abono mensual adicional deseado (COP)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[14px] font-bold" style={{ color: "rgba(230,236,255,0.7)" }}>$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej. 200.000"
                  value={abono > 0 ? formatNumber(abono, 0) : abonoStr}
                  onChange={(e) => setAbonoStr(e.target.value)}
                  className="nuvia-input flex-1 text-base font-bold outline-none"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugerencias.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAbonoStr(String(v))}
                    className="rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition hover:scale-[1.03]"
                    style={{
                      background: abono === v ? "rgba(132,185,143,0.25)" : "rgba(255,255,255,0.05)",
                      borderColor: abono === v ? "rgba(132,185,143,0.6)" : "rgba(255,255,255,0.12)",
                      color: abono === v ? "#A7E0B8" : "rgba(230,236,255,0.75)",
                    }}
                  >
                    +${formatNumber(v, 0)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {abono > 0 && !resultado && (
            <div className="mt-3 text-[12px]" style={{ color: "#FF9D9D" }}>
              Con ese abono no se logra eliminar cuotas viables. Prueba con un valor mayor.
            </div>
          )}

          {resultado && (
            <div
              className="mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-4"
              style={{
                borderColor: "rgba(132,185,143,0.4)",
                background: "linear-gradient(135deg, rgba(132,185,143,0.16), rgba(20,28,54,0.6))",
              }}
            >
              <ResultCell label="Cuotas eliminadas" value={`−${resultado.cuotasEliminadas}`} accent />
              <ResultCell label="Tiempo eliminado" value={`${(resultado.cuotasEliminadas / 12).toFixed(1)} años`} />
              <ResultCell label="Nuevo plazo" value={`${resultado.calc.nuevoPlazo} m`} />
              <ResultCell label="Ahorro total" value={formatCOP(resultado.calc.ahorroTotal)} accent />
              <div className="flex flex-col items-stretch gap-2 sm:col-span-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[11px]" style={{ color: "rgba(230,236,255,0.7)" }}>
                  Incremento real más cercano:{" "}
                  <strong style={{ color: "#FFFFFF" }}>+{formatCOP(resultado.calc.incrementoMensual)}</strong> · Nueva cuota{" "}
                  <strong style={{ color: "#FFFFFF" }}>{formatCOP(resultado.calc.nuevaCuota)}</strong>
                  {Math.abs(resultado.calc.incrementoMensual - abono) > 5000 && (
                    <span style={{ color: "rgba(230,236,255,0.55)" }}>
                      {" "}(el valor exacto no cae justo en una cuota completa; ajustamos al más cercano)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onAgregarEscenario(resultado.cuotasEliminadas)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(132,185,143,0.55)] transition hover:scale-[1.02]"
                  style={{ background: "linear-gradient(135deg, #84B98F 0%, #5B7DC8 100%)" }}
                >
                  <Plus size={14} /> Usar como nuevo escenario
                </button>
              </div>
            </div>
          )}

          <div className="mt-2 text-[10.5px]" style={{ color: "rgba(230,236,255,0.5)" }}>
            Plazo pendiente: {cuotasPendientes} meses · Los resultados usan el mismo motor de cálculo que las propuestas comerciales.
          </div>
        </div>
      )}
    </div>
  );
}

function ResultCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(230,236,255,0.6)" }}>
        {label}
      </div>
      <div className="mt-0.5 text-[18px] font-extrabold leading-tight tracking-tight"
        style={{ color: accent ? "#A7E0B8" : "#FFFFFF" }}>
        {value}
      </div>
    </div>
  );
}
