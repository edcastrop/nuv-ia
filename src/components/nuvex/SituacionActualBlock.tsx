import { useState } from "react";
import { Card, SectionTitle } from "./ui";
import { NUVEX } from "./constants";
import { formatCOP } from "@/lib/format";

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
}

interface Props {
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
  /** Fila secundaria — 4 tarjetas medianas. */
  secundarios: SituacionMetric[];
  /** Detalle completo dentro del acordeón. */
  detalle: SituacionMetric[];
}

type RiesgoNivel = "verde" | "amarillo" | "naranja" | "rojo";

function semaforo(n: number) {
  const safe = isFinite(n) ? n : 0;
  let nivel: RiesgoNivel;
  if (safe < 1.5) nivel = "verde";
  else if (safe < 2.0) nivel = "amarillo";
  else if (safe < 2.5) nivel = "naranja";
  else nivel = "rojo";

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
      mensaje: string;
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
      mensaje:
        "Tu crédito está dentro de un rango financiero saludable. Aún existen oportunidades menores de optimización.",
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
      mensaje:
        "Estás pagando entre 1,5 y 2 veces el valor de tu crédito. Existe una oportunidad clara de restructuración.",
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
      mensaje:
        "Vas a pagar entre 2 y 2,5 veces lo prestado. Se recomienda restructurar el crédito para reducir intereses.",
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
      mensaje:
        "Estás pagando más de 2,5 veces el valor de tu crédito. La intervención financiera es urgente.",
    },
  };
  return { nivel, ...paletas[nivel] };
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
  const { valorDesembolsado, dineroPagado, totalProyectadoPendiente } = costo;
  const costoTotalCredito = dineroPagado + totalProyectadoPendiente;
  const veces =
    valorDesembolsado > 0
      ? costoTotalCredito / valorDesembolsado
      : isFinite(vecesPagadoFallback)
        ? vecesPagadoFallback
        : 0;
  const interesesYCostos = Math.max(0, costoTotalCredito - valorDesembolsado);
  const s = semaforo(veces);
  const vecesTxt = isFinite(veces) ? veces.toFixed(2).replace(".", ",") : "0,00";

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
            Vas a pagar
          </div>
          <div
            className="mt-2 flex items-baseline gap-3 leading-none"
            style={{ color: s.text }}
          >
            <span
              className="font-extrabold tracking-tight"
              style={{
                fontSize: "clamp(72px, 11vw, 128px)",
                textShadow: `0 0 40px ${s.ring}`,
              }}
            >
              {vecesTxt}
            </span>
            <span
              className="font-bold"
              style={{ fontSize: "clamp(22px, 2.4vw, 32px)", opacity: 0.9 }}
            >
              veces
            </span>
          </div>
          <div
            className="mt-2 text-[12px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            el valor de tu crédito
          </div>

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

          <p
            className="mt-4 max-w-md text-[13.5px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.78)" }}
          >
            {s.mensaje}
          </p>
        </div>

        {/* Bloque derecho — Cifras ejecutivas */}
        <div className="grid grid-cols-2 gap-3">
          <ExecTile label="Valor desembolsado" value={formatCOP(valorDesembolsado)} />
          <ExecTile label="Dinero pagado a la fecha" value={formatCOP(dineroPagado)} />
          <ExecTile
            label="Total proyectado pendiente"
            value={formatCOP(totalProyectadoPendiente)}
          />
          <ExecTile
            label="Intereses y costos proyectados"
            value={formatCOP(interesesYCostos)}
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
  hero,
  vecesPagado,
  costoTotal,
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

  return (
    <Card className="!p-6 md:!p-8">
      <SectionTitle sub="Diagnóstico financiero ejecutivo del crédito actual">
        Situación actual del crédito
      </SectionTitle>

      {/* Fila hero — 4 KPI principales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <HeroKpi label="Saldo actual" value={hero.saldoActual} accent="dark" />
        <HeroKpi label="Cuota actual con seguros" value={hero.cuotaActual} />
        <HeroKpi label="Cuotas pendientes" value={hero.cuotasPendientes} />
        <HeroKpi label="Total proyectado por pagar" value={hero.totalProyectado} accent="primary" />
      </div>

      {/* Bloque ejecutivo premium — Costo total del crédito */}
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
    </Card>
  );
}
