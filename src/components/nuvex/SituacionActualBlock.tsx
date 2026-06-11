import { useState } from "react";
import { Card } from "./ui";
import { NUVEX } from "./constants";
import { formatCOP } from "@/lib/format";
import { NUVEX_BRAND } from "@/lib/brandConfig";


export interface SituacionMetric {
  label: string;
  value: string;
}

export interface CostoTotalCredito {
  /** Monto desembolsado por el banco al cliente. */
  valorDesembolsado: number;
  /** Suma de cuotas ya pagadas a la fecha. */
  dineroPagado: number;
  /** Total proyectado pendiente por pagar bajo el escenario actual. */
  totalProyectadoPendiente: number;
  /**
   * Base de referencia del crédito para calcular el múltiplo "veces el valor
   * del crédito". Si no se provee, se usa `valorDesembolsado`, y si éste es 0
   * se reconstruye como `dineroPagado + (totalProyectadoPendiente - intereses)`
   * usando la base que el llamador haya podido inferir. Mantener esta base
   * coherente garantiza que el número grande del hero coincida con el rango
   * del semáforo y con el mensaje mostrado.
   */
  baseCredito?: number;
}

interface Props {
  /** Nombre del titular para personalizar el encabezado. */
  clienteNombre?: string;
  /** KPIs principales (4 tarjetas hero). */
  hero: {
    saldoActual: string;
    cuotaActual: string;
    cuotasPendientes: string;
    totalProyectado: string;
  };
  /** Múltiplo del crédito (ej. 2.18). Usado como fallback si no se pasa `costoTotal`. */
  vecesPagado: number;
  /** Datos crudos para el bloque ejecutivo Costo Total del Crédito. */
  costoTotal?: CostoTotalCredito;
  /** Puntos neurálgicos del crédito (Tiempo, intereses, seguros). */
  puntosNeuralgicos?: {
    tiempoMeses: number;
    interesesProyectados: number;
    segurosProyectados: number;
  };
  /** TEA del crédito para semaforización. */
  tea?: number;
  /** Umbral de TEA a partir del cual se considera crítica (default 10% Pesos, 6% UVR). */
  teaUmbral?: number;
  /** Fila secundaria — 4 tarjetas medianas. */
  secundarios: SituacionMetric[];
  /** Detalle completo dentro del acordeón. */
  detalle: SituacionMetric[];
}


type RiesgoNivel = "verde" | "amarillo" | "naranja" | "rojo";

function semaforo(n: number, opts?: { vecesValor?: number }) {
  const safe = isFinite(n) ? n : 0;
  let nivel: RiesgoNivel;
  if (safe < 1.5) nivel = "verde";
  else if (safe < 2.0) nivel = "amarillo";
  else if (safe < 2.5) nivel = "naranja";
  else nivel = "rojo";

  const vecesTxt = (() => {
    const v = opts?.vecesValor;
    if (v === undefined || !isFinite(v)) return null;
    return v.toFixed(2).replace(".", ",");
  })();

  const mensajes: Record<RiesgoNivel, string> = {
    verde: vecesTxt
      ? `Vas a pagar ${vecesTxt} veces el valor de tu crédito. Tu crédito está dentro de un rango financiero saludable.`
      : "Tu crédito está dentro de un rango financiero saludable. Aún existen oportunidades menores de optimización.",
    amarillo: vecesTxt
      ? `Vas a pagar ${vecesTxt} veces el valor de tu crédito. Existe una oportunidad clara de restructuración.`
      : "Estás pagando entre 1,5 y 2 veces el valor de tu crédito. Existe una oportunidad clara de restructuración.",
    naranja: vecesTxt
      ? `Vas a pagar ${vecesTxt} veces el valor de tu crédito. Se recomienda restructurar para reducir intereses.`
      : "Vas a pagar entre 2 y 2,5 veces lo prestado. Se recomienda restructurar el crédito para reducir intereses.",
    rojo: vecesTxt
      ? `Vas a pagar ${vecesTxt} veces el valor de tu crédito. La intervención financiera es urgente.`
      : "Estás pagando más de 2,5 veces el valor de tu crédito. La intervención financiera es urgente.",
  };

  const paletas: Record<
    RiesgoNivel,
    {
      bg: string;
      ring: string;
      text: string;
      chipBg: string;
      chipText: string;
      ribbon: string;
      icon: string;
      label: string;
    }
  > = {
    verde: {
      bg: "linear-gradient(135deg, #0F2419 0%, #14361F 55%, #0F2419 100%)",
      ring: "rgba(115, 230, 156, 0.35)",
      text: "#A7F3C4",
      chipBg: "rgba(115, 230, 156, 0.18)",
      chipText: "#73E69C",
      ribbon: "#1F7A45",
      icon: "🟢",
      label: "SOBREPAGO SALUDABLE",
    },
    amarillo: {
      bg: "linear-gradient(135deg, #2B1F08 0%, #3E2D0C 55%, #2B1F08 100%)",
      ring: "rgba(245, 200, 80, 0.4)",
      text: "#FFE08A",
      chipBg: "rgba(245, 200, 80, 0.18)",
      chipText: "#FFD15C",
      ribbon: "#A77C16",
      icon: "🟡",
      label: "SOBREPAGO MODERADO",
    },
    naranja: {
      bg: "linear-gradient(135deg, #2E1808 0%, #46210C 55%, #2E1808 100%)",
      ring: "rgba(255, 142, 60, 0.45)",
      text: "#FFCBA0",
      chipBg: "rgba(255, 142, 60, 0.2)",
      chipText: "#FFA561",
      ribbon: "#C25812",
      icon: "🟠",
      label: "SOBREPAGO ALTO",
    },
    rojo: {
      bg: "linear-gradient(135deg, #2A0B0B 0%, #401010 55%, #2A0B0B 100%)",
      ring: "rgba(255, 95, 95, 0.45)",
      text: "#FFB3B3",
      chipBg: "rgba(255, 95, 95, 0.2)",
      chipText: "#FF7878",
      ribbon: "#B42318",
      icon: "🔴",
      label: "RIESGO CRÍTICO DE SOBREPAGO",
    },
  };
  return { nivel, ...paletas[nivel], mensaje: mensajes[nivel] };
}

function HeroKpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "neutral" | "primary" | "dark";
}) {
  const pal =
    accent === "primary"
      ? { border: NUVEX.azul, label: NUVEX.azul, value: NUVEX.azul }
      : accent === "dark"
        ? { border: "#0F1115", label: "#6B7480", value: "#0F1115" }
        : { border: "#E3E7EE", label: "#6B7480", value: "#0F1115" };
  return (
    <div
      className="rounded-2xl border bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_rgba(36,36,36,0.06)]"
      style={{ borderColor: pal.border }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: pal.label }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[26px] font-bold leading-tight tracking-tight md:text-[30px]"
        style={{ color: pal.value }}
      >
        {value}
      </div>
    </div>
  );
}

function NeuralgicoCard({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-white p-5 transition-shadow hover:shadow-[0_10px_30px_rgba(36,36,36,0.08)]"
      style={{ borderColor: accent }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div
          className="text-[10.5px] font-bold uppercase tracking-[0.16em]"
          style={{ color: accent }}
        >
          {label}
        </div>
        <span className="text-lg leading-none" aria-hidden>
          {icon}
        </span>
      </div>
      <div
        className="mt-2 pl-2 text-[22px] md:text-[24px] font-extrabold leading-tight tracking-tight"
        style={{ color: "#0F1115" }}
      >
        {value}
      </div>
      {hint && (
        <div className="mt-1 pl-2 text-[11.5px] font-medium text-[#6B7480]">{hint}</div>
      )}
    </div>
  );
}

function TeaAlertCard({ tea, umbral = 10 }: { tea: number; umbral?: number }) {
  const esRiesgo = tea >= umbral;
  const accent = esRiesgo ? "#B42318" : "#1F7A45";
  const bg = esRiesgo
    ? "linear-gradient(135deg, #2A0B0B 0%, #401010 55%, #2A0B0B 100%)"
    : "linear-gradient(135deg, #0F2419 0%, #14361F 55%, #0F2419 100%)";
  const ring = esRiesgo ? "rgba(255, 95, 95, 0.45)" : "rgba(115, 230, 156, 0.35)";
  const text = esRiesgo ? "#FFB3B3" : "#A7F3C4";
  const chipBg = esRiesgo ? "rgba(255, 95, 95, 0.2)" : "rgba(115, 230, 156, 0.18)";
  const chipText = esRiesgo ? "#FF7878" : "#73E69C";
  const icon = esRiesgo ? "🔴" : "🟢";
  const label = esRiesgo ? "TASA ALTA" : "TASA DENTRO DE RANGO";
  const mensaje = esRiesgo
    ? `La TEA (${tea.toFixed(2).replace(".", ",")}%) supera el umbral crítico del ${umbral}%. Se recomienda revisar opciones de refinanciación.`
    : `La TEA (${tea.toFixed(2).replace(".", ",")}%) se encuentra por debajo del umbral del ${umbral}%.`;

  return (
    <div
      className="relative mt-4 overflow-hidden rounded-2xl"
      style={{
        background: bg,
        border: `1px solid ${ring}`,
        boxShadow: "0 16px 40px -16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: ring, opacity: 0.35 }}
      />
      <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6 md:py-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{icon}</span>
          <div>
            <div
              className="text-[10.5px] font-bold uppercase tracking-[0.22em]"
              style={{ color: "rgba(255,255,255,0.65)" }}
            >
              Tasa Efectiva Anual (TEA)
            </div>
            <div
              className="mt-1 text-[28px] md:text-[32px] font-extrabold leading-tight tracking-tight"
              style={{ color: text, textShadow: `0 0 30px ${ring}` }}
            >
              {tea.toFixed(2).replace(".", ",")}%
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start md:items-end gap-1.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{
              background: chipBg,
              color: chipText,
              border: `1px solid ${ring}`,
            }}
          >
            {icon} {label}
          </span>
          <p
            className="max-w-xs text-[12.5px] leading-relaxed md:text-right"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {mensaje}
          </p>
        </div>
      </div>
    </div>
  );
}

function SecondaryKpi({ label, value }: SituacionMetric) {


  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#6B7480]">
        {label}
      </div>
      <div className="mt-1.5 text-base font-semibold text-[#0F1115]">{value}</div>
    </div>
  );
}

/** Tile dentro del bloque ejecutivo oscuro. */
function ExecTile({
  label,
  value,
  emphasis,
  textColor,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  textColor?: string;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: emphasis ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${emphasis ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div
        className="text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        {label}
      </div>
      <div
        className="mt-1.5 leading-tight"
        style={{
          color: textColor ?? (emphasis ? "#FFFFFF" : "rgba(255,255,255,0.92)"),
          fontSize: emphasis ? 20 : 17,
          fontWeight: emphasis ? 800 : 700,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CostoTotalEjecutivo({
  costo,
  vecesPagadoFallback,
}: {
  costo: CostoTotalCredito;
  vecesPagadoFallback: number;
}) {
  const { valorDesembolsado, dineroPagado, totalProyectadoPendiente, baseCredito } = costo;
  const costoTotalCredito = dineroPagado + totalProyectadoPendiente;
  // Base de cálculo: SOLO el valor desembolsado real (declarado por el banco).
  // Si no está disponible, NO inventamos un múltiplo; lo mostramos como
  // "no disponible" para no engañar al cliente.
  const base =
    baseCredito && baseCredito > 0
      ? baseCredito
      : valorDesembolsado > 0
        ? valorDesembolsado
        : 0;
  const baseDisponible = base > 0;
  const veces = baseDisponible ? costoTotalCredito / base : 0;
  const interesesYCostos = baseDisponible ? Math.max(0, costoTotalCredito - base) : 0;
  const s = semaforo(baseDisponible ? veces : 0, baseDisponible ? { vecesValor: veces } : undefined);
  const vecesTxt = baseDisponible && isFinite(veces) ? veces.toFixed(2).replace(".", ",") : "—";

  return (
    <div
      className="relative mt-6 overflow-hidden rounded-3xl"
      style={{
        background: s.bg,
        border: `1px solid ${s.ring}`,
        boxShadow:
          "0 24px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset",
      }}
    >
      {/* Halo decorativo */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: s.ring, opacity: 0.35 }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: s.ring, opacity: 0.2 }}
      />

      {/* Cinta superior */}
      <div
        className="flex items-center justify-between gap-3 px-6 py-3"
        style={{
          background: "rgba(0,0,0,0.25)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: s.chipText, boxShadow: `0 0 12px ${s.chipText}` }}
          />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.22em]"
            style={{ color: "rgba(255,255,255,0.75)" }}
          >
            Diagnóstico ejecutivo · Costo total del crédito
          </span>
        </div>
        <span
          className="hidden md:inline text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          Escenario actual sin intervención
        </span>
      </div>

      <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.05fr_1fr] md:px-8 md:py-9">
        {/* Hero — Número de veces pagado */}
        <div className="flex flex-col items-start justify-center">
          <div
            className="text-[10.5px] font-semibold uppercase tracking-[0.24em]"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {baseDisponible ? "Vas a pagar" : "Múltiplo del crédito"}
          </div>
          <div
            className="mt-2 flex items-baseline gap-3 leading-none"
            style={{ color: s.text }}
          >
            <span
              className="font-extrabold tracking-tight"
              style={{
                fontSize: baseDisponible ? "clamp(72px, 11vw, 128px)" : "clamp(40px, 6vw, 64px)",
                textShadow: `0 0 40px ${s.ring}`,
              }}
            >
              {vecesTxt}
            </span>
            {baseDisponible && (
              <span
                className="font-bold"
                style={{ fontSize: "clamp(22px, 2.4vw, 32px)", opacity: 0.9 }}
              >
                veces
              </span>
            )}
          </div>
          <div
            className="mt-2 text-[12px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            {baseDisponible ? "el valor de tu crédito" : "no disponible"}
          </div>

          {baseDisponible && (
            <div
              className="mt-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{
                background: s.chipBg,
                color: s.chipText,
                border: `1px solid ${s.ring}`,
              }}
            >
              <span aria-hidden>{s.icon}</span>
              {s.label}
            </div>
          )}

          <p
            className="mt-4 max-w-md text-[13.5px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {baseDisponible
              ? s.mensaje
              : "Para calcular cuántas veces vas a pagar tu crédito necesitamos el valor desembolsado original por el banco. Cárgalo en los datos del crédito para activar el diagnóstico ejecutivo completo."}
          </p>
        </div>

        {/* Bloque derecho — Cifras ejecutivas */}
        <div className="grid grid-cols-2 gap-3">
          <ExecTile
            label={valorDesembolsado > 0 ? "Valor desembolsado" : "Valor desembolsado (no disponible)"}
            value={valorDesembolsado > 0 ? formatCOP(valorDesembolsado) : "—"}
          />
          <ExecTile label="Dinero pagado a la fecha" value={formatCOP(dineroPagado)} />
          <ExecTile
            label="Total proyectado pendiente"
            value={formatCOP(totalProyectadoPendiente)}
          />
          <ExecTile
            label="Intereses y costos proyectados"
            value={baseDisponible ? formatCOP(interesesYCostos) : "—"}
            textColor={s.text}
          />
          <div className="col-span-2">
            <ExecTile
              label="Costo total del crédito"
              value={formatCOP(costoTotalCredito)}
              emphasis
              textColor={s.text}
            />
          </div>
        </div>
      </div>

      {/* Cinta inferior — barra de riesgo */}
      <div
        className="flex items-center justify-between gap-4 px-6 py-3 md:px-8"
        style={{
          background: "rgba(0,0,0,0.28)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-1.5">
          {(["verde", "amarillo", "naranja", "rojo"] as RiesgoNivel[]).map((n) => {
            const active = n === s.nivel;
            const color =
              n === "verde"
                ? "#73E69C"
                : n === "amarillo"
                  ? "#FFD15C"
                  : n === "naranja"
                    ? "#FFA561"
                    : "#FF7878";
            return (
              <span
                key={n}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: active ? 36 : 14,
                  background: active ? color : "rgba(255,255,255,0.18)",
                  boxShadow: active ? `0 0 10px ${color}` : "none",
                }}
              />
            );
          })}
        </div>
        <div
          className="text-[10.5px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          🟢 &lt;1,5x · 🟡 1,5–2x · 🟠 2–2,5x · 🔴 &gt;2,5x
        </div>
      </div>
    </div>
  );
}

export function SituacionActualBlock({
  clienteNombre,
  hero,
  vecesPagado,
  costoTotal,
  puntosNeuralgicos,
  tea,
  teaUmbral,
  secundarios,
  detalle,
}: Props) {
  const [open, setOpen] = useState(false);

  // Fallback: si no se pasa costoTotal, reconstruimos uno mínimo desde el detalle
  // para no romper consumidores antiguos.
  const costoEfectivo: CostoTotalCredito =
    costoTotal ?? {
      valorDesembolsado: 0,
      dineroPagado: 0,
      totalProyectadoPendiente: 0,
    };

  const nombre = (clienteNombre ?? "").trim();
  const tituloSituacion = nombre
    ? `Situación actual del crédito de: ${nombre}`
    : "Situación actual del crédito";

  const tiempoMeses = puntosNeuralgicos?.tiempoMeses ?? 0;
  const tiempoAnios = tiempoMeses / 12;

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Encabezado institucional NUVEX */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 md:px-8"
        style={{
          background: `linear-gradient(135deg, ${NUVEX.azul} 0%, #2F4585 55%, #1B2A55 100%)`,
        }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <img
            src={NUVEX_BRAND.logo.principal}
            alt="NUVEX"
            className="h-10 w-auto shrink-0 rounded bg-white/95 px-2 py-1"
            style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
          />
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-white/70">
              {NUVEX_BRAND.nombreComercial}
            </div>
            <h2 className="truncate text-[18px] md:text-[20px] font-extrabold leading-tight text-white">
              {tituloSituacion}
            </h2>
          </div>
        </div>
        <div className="hidden md:block text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
            Informe ejecutivo
          </div>
          <div className="text-[12px] font-semibold text-white/90">
            Diagnóstico financiero del crédito actual
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* Fila hero — 4 KPI principales */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HeroKpi label="Saldo actual" value={hero.saldoActual} accent="dark" />
          <HeroKpi label="Cuota actual con seguros" value={hero.cuotaActual} />
          <HeroKpi label="Cuotas pendientes" value={hero.cuotasPendientes} />
          <HeroKpi label="Total proyectado por pagar" value={hero.totalProyectado} accent="primary" />
        </div>

        {/* Alerta TEA semaforizada */}
        {typeof tea === "number" && tea > 0 && (
          <TeaAlertCard tea={tea} umbral={teaUmbral ?? 10} />
        )}

        {/* Puntos neurálgicos — Tiempo · Intereses · Seguros */}
        {puntosNeuralgicos && (
          <div className="mt-6">
            <div className="mb-3 flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: NUVEX.azul }}
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#445DA3]">
                Puntos neurálgicos del crédito
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <NeuralgicoCard
                icon="⏱️"
                label="Tiempo restante"
                value={`${tiempoMeses} meses`}
                hint={`≈ ${tiempoAnios.toFixed(1).replace(".", ",")} años hasta finalizar`}
                accent="#445DA3"
              />
              <NeuralgicoCard
                icon="📈"
                label="Intereses proyectados"
                value={formatCOP(puntosNeuralgicos.interesesProyectados)}
                hint="Lo que pagarías de más al banco"
                accent="#B42318"
              />
              <NeuralgicoCard
                icon="🛡️"
                label="Seguros proyectados"
                value={formatCOP(puntosNeuralgicos.segurosProyectados)}
                hint="Seguros que pagarías hasta el final"
                accent="#A77C16"
              />
            </div>
          </div>
        )}

        {/* Bloque ejecutivo premium — Costo total del crédito (semaforización) */}
        <CostoTotalEjecutivo costo={costoEfectivo} vecesPagadoFallback={vecesPagado} />


      {/* Segunda fila — secundarios */}
      {secundarios.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {secundarios.map((m) => (
            <SecondaryKpi key={m.label} label={m.label} value={m.value} />
          ))}
        </div>
      )}

      {/* Acordeón — detalle completo */}
      {detalle.length > 0 && (
        <div className="mt-6 rounded-xl border border-[#E3E7EE]">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-[#242424] hover:bg-[#F7F9FB]"
            aria-expanded={open}
          >
            <span>Ver detalle completo del crédito</span>
            <span
              className="text-xs text-[#6B7480] transition-transform"
              style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              ▾
            </span>
          </button>
          {open && (
            <div className="grid grid-cols-2 gap-3 border-t border-[#E3E7EE] p-4 md:grid-cols-4">
              {detalle.map((m) => (
                <div key={m.label} className="rounded-lg bg-[#F7F9FB] px-3 py-2.5">
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#6B7480]">
                    {m.label}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-[#0F1115]">{m.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </Card>

  );
}
