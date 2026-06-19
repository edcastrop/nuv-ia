// "Perfil de Ingresos en Vivo" — anclado a la propuesta comercial.
// Pensado para que el analista lo llene durante la llamada con el cliente.
// Calcula promedio simple de 3 meses por fuente, suma todas las fuentes y
// compara contra el % máximo permitido (30% NoVIS / 40% VIS) frente a la
// cuota de la propuesta recomendada. Si no cumple, sugiere la siguiente
// proyección que sí cumpla.

import { useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Wallet, Users } from "lucide-react";
import { formatCOP } from "../../lib/format";

export type TipoCredito = "VIS" | "NoVIS";

export type OcupacionTipo = "empleado" | "independiente" | "pensionado" | "rentista";

export type FuenteIngresoTipo =
  | "salario"
  | "honorarios"
  | "arriendos"
  | "vehiculos_alquilados"
  | "emprendimiento"
  | "giros_exterior"
  | "dividendos"
  | "otro";

export interface FuenteIngreso {
  id: string;
  tipo: FuenteIngresoTipo;
  descripcion?: string;
  mes1: number;
  mes2: number;
  mes3: number;
}

export interface IngresosCliente {
  tipoCredito?: TipoCredito;
  ocupaciones?: OcupacionTipo[];
  fuentes?: FuenteIngreso[];
}

const OCUPACIONES: Array<{ k: OcupacionTipo; label: string; emoji: string }> = [
  { k: "empleado", label: "Empleado", emoji: "💼" },
  { k: "independiente", label: "Independiente", emoji: "🧑‍💻" },
  { k: "pensionado", label: "Pensionado", emoji: "🎖️" },
  { k: "rentista", label: "Rentista", emoji: "🏠" },
];

const FUENTES_CAT: Array<{ k: FuenteIngresoTipo; label: string }> = [
  { k: "salario", label: "Salario" },
  { k: "honorarios", label: "Honorarios" },
  { k: "arriendos", label: "Arriendos" },
  { k: "vehiculos_alquilados", label: "Vehículos alquilados" },
  { k: "emprendimiento", label: "Emprendimiento" },
  { k: "giros_exterior", label: "Giros del exterior" },
  { k: "dividendos", label: "Dividendos" },
  { k: "otro", label: "Otro" },
];

function nuevaFuente(tipo: FuenteIngresoTipo = "salario"): FuenteIngreso {
  return {
    id: `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    mes1: 0,
    mes2: 0,
    mes3: 0,
  };
}

function promedio(f: FuenteIngreso): number {
  return ((Number(f.mes1) || 0) + (Number(f.mes2) || 0) + (Number(f.mes3) || 0)) / 3;
}

function parseCop(s: string): number {
  const clean = s.replace(/[^\d]/g, "");
  return clean ? Number(clean) : 0;
}

export interface PropuestaParaCapacidad {
  index: number;
  cuotasEliminadas: number;
  nuevaCuota: number;
  valid: boolean;
}

export function PerfilIngresosEnVivo({
  value,
  onChange,
  cuotaRecomendada,
  propuestas,
  onSugerirEscenario,
}: {
  value: IngresosCliente;
  onChange: (v: IngresosCliente) => void;
  /** Cuota de la propuesta actualmente recomendada (la que se enviará al cliente). */
  cuotaRecomendada: number;
  /** Todas las propuestas para encontrar una alternativa si la recomendada no cumple. */
  propuestas: PropuestaParaCapacidad[];
  /** Permite al analista marcar como recomendada otra propuesta sugerida. */
  onSugerirEscenario?: (index: number) => void;
}) {
  const [abierto, setAbierto] = useState<boolean>(false);

  const tipoCredito: TipoCredito = value.tipoCredito ?? "NoVIS";
  const ocupaciones = value.ocupaciones ?? [];
  const fuentes = value.fuentes ?? [];

  const porcentajeMax = tipoCredito === "VIS" ? 0.4 : 0.3;
  const labelPct = tipoCredito === "VIS" ? "40%" : "30%";

  const ingresoTotal = useMemo(
    () => fuentes.reduce((acc, f) => acc + promedio(f), 0),
    [fuentes],
  );
  const capacidadMaxima = ingresoTotal * porcentajeMax;
  const tieneDatos = ingresoTotal > 0;

  const cumple = tieneDatos && cuotaRecomendada > 0 && cuotaRecomendada <= capacidadMaxima;
  const justo = tieneDatos && cuotaRecomendada > 0 && cuotaRecomendada > capacidadMaxima * 0.92 && cuotaRecomendada <= capacidadMaxima;
  const excede = tieneDatos && cuotaRecomendada > 0 && cuotaRecomendada > capacidadMaxima;
  const delta = capacidadMaxima - cuotaRecomendada;

  // Sugiere la propuesta de MENOR esfuerzo que SÍ cumpla (menor cuota válida que ≤ capacidad).
  const sugerencia = useMemo(() => {
    if (!excede || !tieneDatos) return null;
    const candidatas = propuestas
      .filter((p) => p.valid && p.nuevaCuota > 0 && p.nuevaCuota <= capacidadMaxima)
      .sort((a, b) => b.nuevaCuota - a.nuevaCuota); // la más alta dentro del límite = mayor abono permitido
    return candidatas[0] ?? null;
  }, [excede, tieneDatos, propuestas, capacidadMaxima]);

  const toggleOcupacion = (k: OcupacionTipo) => {
    const set = new Set(ocupaciones);
    if (set.has(k)) set.delete(k);
    else set.add(k);
    onChange({ ...value, ocupaciones: Array.from(set) });
  };

  const setTipoCredito = (t: TipoCredito) => onChange({ ...value, tipoCredito: t });

  const addFuente = () => onChange({ ...value, fuentes: [...fuentes, nuevaFuente()] });
  const removeFuente = (id: string) =>
    onChange({ ...value, fuentes: fuentes.filter((f) => f.id !== id) });
  const updateFuente = (id: string, patch: Partial<FuenteIngreso>) =>
    onChange({ ...value, fuentes: fuentes.map((f) => (f.id === id ? { ...f, ...patch } : f)) });

  // Color semáforo
  const semaforoColor = !tieneDatos
    ? "rgba(230,236,255,0.55)"
    : excede
      ? "#FF7878"
      : justo
        ? "#F6C453"
        : "#A7E0B8";
  const semaforoEmoji = !tieneDatos ? "⚪" : excede ? "🔴" : justo ? "🟡" : "🟢";
  const semaforoTexto = !tieneDatos
    ? "Captura ingresos para validar"
    : excede
      ? "Excede capacidad"
      : justo
        ? "Cumple justo"
        : "Cumple con holgura";

  return (
    <div
      className="mb-4 rounded-2xl border backdrop-blur-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, rgba(30,40,75,0.65), rgba(15,22,46,0.7))",
        borderColor: tieneDatos
          ? excede
            ? "rgba(255,120,120,0.55)"
            : "rgba(132,185,143,0.45)"
          : "rgba(122,160,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 30px -18px rgba(0,0,0,0.55)",
      }}
    >
      {/* Header — siempre visible, muestra semáforo aunque esté cerrado */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(246,196,83,0.22), rgba(68,93,163,0.25))",
              border: "1px solid rgba(246,196,83,0.35)",
            }}
          >
            <Wallet size={16} style={{ color: "#F6C453" }} />
          </span>
          <div className="min-w-0">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "#F6C453" }}
            >
              Perfil de ingresos en vivo · {labelPct}
            </div>
            <div className="text-sm font-semibold truncate" style={{ color: "#E6ECFF" }}>
              {tieneDatos ? (
                <>
                  Ingreso prom. {formatCOP(ingresoTotal)} · Capacidad {formatCOP(capacidadMaxima)}
                </>
              ) : (
                <>Captura ocupación e ingresos del cliente durante la llamada</>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: "rgba(20,28,54,0.65)",
              color: semaforoColor,
              border: `1px solid ${semaforoColor}55`,
            }}
          >
            {semaforoEmoji} {semaforoTexto}
          </span>
          {abierto ? <ChevronUp size={16} style={{ color: "#A8B6D6" }} /> : <ChevronDown size={16} style={{ color: "#A8B6D6" }} />}
        </div>
      </button>

      {abierto && (
        <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {/* Tipo de crédito VIS/NoVIS */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: "rgba(230,236,255,0.65)" }}>
              Tipo de crédito:
            </span>
            {(["NoVIS", "VIS"] as TipoCredito[]).map((t) => {
              const active = tipoCredito === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipoCredito(t)}
                  className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition"
                  style={{
                    background: active
                      ? "linear-gradient(135deg, rgba(246,196,83,0.22), rgba(132,185,143,0.18))"
                      : "rgba(20,28,54,0.55)",
                    color: active ? "#FFE7A0" : "rgba(230,236,255,0.7)",
                    borderColor: active ? "rgba(246,196,83,0.55)" : "rgba(255,255,255,0.14)",
                  }}
                >
                  {t} · {t === "VIS" ? "40%" : "30%"}
                </button>
              );
            })}
            <span className="ml-auto text-[10px]" style={{ color: "rgba(230,236,255,0.5)" }}>
              VIS = Vivienda de Interés Social
            </span>
          </div>

          {/* Ocupación */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Users size={12} style={{ color: "#F6C453" }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#F6C453" }}>
                Ocupación (selecciona todas las que apliquen)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {OCUPACIONES.map((o) => {
                const active = ocupaciones.includes(o.k);
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => toggleOcupacion(o.k)}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
                    style={{
                      background: active
                        ? "linear-gradient(135deg, rgba(132,185,143,0.22), rgba(68,93,163,0.18))"
                        : "rgba(20,28,54,0.55)",
                      color: active ? "#A7E0B8" : "rgba(230,236,255,0.7)",
                      borderColor: active ? "rgba(132,185,143,0.55)" : "rgba(255,255,255,0.14)",
                    }}
                  >
                    <span>{o.emoji}</span> {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fuentes de ingreso */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#F6C453" }}>
                Fuentes de ingreso (últimos 3 meses)
              </span>
              <button
                type="button"
                onClick={addFuente}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white transition hover:scale-[1.02]"
                style={{
                  background: "linear-gradient(135deg, #445DA3 0%, #84B98F 100%)",
                }}
              >
                <Plus size={12} /> Agregar fuente
              </button>
            </div>

            {fuentes.length === 0 ? (
              <div
                className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px]"
                style={{ borderColor: "rgba(255,255,255,0.14)", color: "rgba(230,236,255,0.55)" }}
              >
                Sin fuentes capturadas. Pregunta al cliente sus ingresos y agrégalos arriba.
              </div>
            ) : (
              <div className="space-y-2">
                {fuentes.map((f) => {
                  const prom = promedio(f);
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl border p-2.5"
                      style={{
                        background: "rgba(15,22,46,0.55)",
                        borderColor: "rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={f.tipo}
                          onChange={(e) => updateFuente(f.id, { tipo: e.target.value as FuenteIngresoTipo })}
                          className="rounded-md border bg-transparent px-2 py-1 text-[11px] font-semibold"
                          style={{
                            color: "#E6ECFF",
                            background: "rgba(20,28,54,0.85)",
                            borderColor: "rgba(255,255,255,0.14)",
                          }}
                        >
                          {FUENTES_CAT.map((c) => (
                            <option key={c.k} value={c.k} style={{ background: "#141C36", color: "#E6ECFF" }}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          placeholder="Detalle (opcional)"
                          value={f.descripcion ?? ""}
                          onChange={(e) => updateFuente(f.id, { descripcion: e.target.value })}
                          className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-[11px]"
                          style={{
                            color: "#E6ECFF",
                            background: "rgba(20,28,54,0.55)",
                            borderColor: "rgba(255,255,255,0.10)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => removeFuente(f.id)}
                          className="ml-auto inline-flex items-center justify-center rounded-md p-1 transition hover:bg-white/5"
                          aria-label="Eliminar fuente"
                          style={{ color: "#FF9C9C" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {(["mes1", "mes2", "mes3"] as const).map((m, i) => (
                          <label key={m} className="flex flex-col gap-1">
                            <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(230,236,255,0.5)" }}>
                              Mes {i + 1}
                            </span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={f[m] ? formatCOP(f[m]) : ""}
                              onChange={(e) => updateFuente(f.id, { [m]: parseCop(e.target.value) } as Partial<FuenteIngreso>)}
                              placeholder="$0"
                              className="rounded-md border bg-transparent px-2 py-1 text-[12px] font-semibold"
                              style={{
                                color: "#E6ECFF",
                                background: "rgba(20,28,54,0.55)",
                                borderColor: "rgba(255,255,255,0.10)",
                              }}
                            />
                          </label>
                        ))}
                        <div className="flex flex-col gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "#84B98F" }}>
                            Promedio
                          </span>
                          <div
                            className="rounded-md border px-2 py-1 text-[12px] font-extrabold"
                            style={{
                              color: "#A7E0B8",
                              background: "rgba(132,185,143,0.10)",
                              borderColor: "rgba(132,185,143,0.30)",
                            }}
                          >
                            {formatCOP(prom)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resultado en vivo */}
          <div
            className="rounded-xl border p-3"
            style={{
              background: "rgba(20,28,54,0.65)",
              borderColor: tieneDatos
                ? excede
                  ? "rgba(255,120,120,0.45)"
                  : "rgba(132,185,143,0.40)"
                : "rgba(255,255,255,0.10)",
            }}
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <Stat label="Ingreso promedio total" value={formatCOP(ingresoTotal)} />
              <Stat label={`Capacidad permitida (${labelPct})`} value={formatCOP(capacidadMaxima)} />
              <Stat label="Cuota de la propuesta" value={cuotaRecomendada > 0 ? formatCOP(cuotaRecomendada) : "—"} />
            </div>

            {tieneDatos && cuotaRecomendada > 0 && (
              <div className="mt-3">
                {/* Barra visual */}
                <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="absolute inset-y-0 left-0 transition-all"
                    style={{
                      width: `${Math.min(100, (cuotaRecomendada / Math.max(1, capacidadMaxima)) * 100)}%`,
                      background: excede
                        ? "linear-gradient(90deg, #FF7878, #FFB266)"
                        : justo
                          ? "linear-gradient(90deg, #F6C453, #FFE7A0)"
                          : "linear-gradient(90deg, #84B98F, #A7E0B8)",
                    }}
                  />
                </div>
                <div className="mt-2 text-[11px] font-semibold" style={{ color: semaforoColor }}>
                  {cumple && !justo && <>Le sobran {formatCOP(delta)} de capacidad después de esta cuota.</>}
                  {justo && <>Pasa justo: solo le quedan {formatCOP(delta)} de margen.</>}
                  {excede && <>Excede en {formatCOP(-delta)}. Esta propuesta no cumple el {labelPct}.</>}
                </div>

                {/* Sugerencia automática */}
                {excede && sugerencia && (
                  <div
                    className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2.5"
                    style={{
                      background: "linear-gradient(135deg, rgba(246,196,83,0.14), rgba(68,93,163,0.14))",
                      borderColor: "rgba(246,196,83,0.40)",
                    }}
                  >
                    <div className="text-[11px]" style={{ color: "#FFE7A0" }}>
                      💡 NUVIA sugiere el <strong>Escenario {sugerencia.index + 1}</strong> ({sugerencia.cuotasEliminadas} cuotas eliminadas, cuota {formatCOP(sugerencia.nuevaCuota)}) — el cliente sí cumpliría con {formatCOP(capacidadMaxima - sugerencia.nuevaCuota)} de holgura.
                    </div>
                    {onSugerirEscenario && (
                      <button
                        type="button"
                        onClick={() => onSugerirEscenario(sugerencia.index)}
                        className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-white transition hover:scale-[1.02]"
                        style={{ background: "linear-gradient(135deg, #F6C453, #84B98F)" }}
                      >
                        Usar este escenario
                      </button>
                    )}
                  </div>
                )}
                {excede && !sugerencia && (
                  <div
                    className="mt-3 rounded-lg border p-2.5 text-[11px]"
                    style={{
                      background: "rgba(255,120,120,0.08)",
                      borderColor: "rgba(255,120,120,0.35)",
                      color: "#FFB3B3",
                    }}
                  >
                    Ninguna proyección actual cumple el {labelPct} para este cliente. Considera bajar el abono o solicitar codeudor.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(230,236,255,0.55)" }}>
        {label}
      </div>
      <div className="text-[15px] font-extrabold" style={{ color: "#E6ECFF" }}>
        {value}
      </div>
    </div>
  );
}
