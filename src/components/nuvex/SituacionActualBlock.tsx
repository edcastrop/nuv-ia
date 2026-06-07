import { useState } from "react";
import { Card, SectionTitle } from "./ui";
import { NUVEX } from "./constants";

export interface SituacionMetric {
  label: string;
  value: string;
}

interface Props {
  /** KPIs principales (4 tarjetas hero). */
  hero: {
    saldoActual: string;
    cuotaActual: string;
    cuotasPendientes: string;
    totalProyectado: string;
  };
  /** Múltiplo del crédito (ej. 2.18). */
  vecesPagado: number;
  /** Fila secundaria — 4 tarjetas medianas. */
  secundarios: SituacionMetric[];
  /** Detalle completo dentro del acordeón. */
  detalle: SituacionMetric[];
}

function semaforo(n: number) {
  if (!isFinite(n) || n <= 0) {
    return {
      bg: "#F4FBF6",
      border: "#CDE9D5",
      color: "#1F7A45",
      chipBg: "#E7F8EC",
      chipColor: "#1F7A45",
      label: "SOBREPAGO SALUDABLE",
      icon: "🟢",
      mensaje:
        "Si mantienes las condiciones actuales, terminarás pagando aproximadamente {n} veces el valor financiado.",
    };
  }
  if (n <= 1.5) {
    return {
      bg: "#F4FBF6",
      border: "#5CA875",
      color: "#1F7A45",
      chipBg: "#E7F8EC",
      chipColor: "#1F7A45",
      label: "SOBREPAGO SALUDABLE",
      icon: "🟢",
      mensaje:
        "Si mantienes las condiciones actuales, terminarás pagando aproximadamente {n} veces el valor financiado.",
    };
  }
  if (n <= 2.0) {
    return {
      bg: "#FFFBEB",
      border: "#F2C94C",
      color: "#854D0E",
      chipBg: "#FEF3C7",
      chipColor: "#854D0E",
      label: "SOBREPAGO MODERADO",
      icon: "🟡",
      mensaje:
        "Si mantienes las condiciones actuales, terminarás pagando aproximadamente {n} veces el valor financiado.",
    };
  }
  return {
    bg: "#FEF2F2",
    border: "#E55353",
    color: "#B42318",
    chipBg: "#FEE4E2",
    chipColor: "#B42318",
    label: "RIESGO DE SOBREPAGO ALTO",
    icon: "🔴",
    mensaje:
      "Si mantienes las condiciones actuales, terminarás pagando aproximadamente {n} veces el valor financiado.",
  };
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

export function SituacionActualBlock({ hero, vecesPagado, secundarios, detalle }: Props) {
  const [open, setOpen] = useState(false);
  const s = semaforo(vecesPagado);
  const vecesTxt = isFinite(vecesPagado) ? vecesPagado.toFixed(2).replace(".", ",") : "0,00";

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

      {/* Veces pagado — hero semáforo */}
      <div
        className="mt-6 overflow-hidden rounded-2xl border"
        style={{ background: s.bg, borderColor: s.border }}
      >
        <div className="flex flex-col items-center gap-3 px-6 py-7 text-center md:py-9">
          <div
            className="text-[11px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: s.color, opacity: 0.85 }}
          >
            Vas a pagar
          </div>
          <div
            className="text-[56px] font-extrabold leading-none tracking-tight md:text-[76px]"
            style={{ color: s.color }}
          >
            {vecesTxt} <span className="text-[28px] md:text-[34px] font-bold">veces</span>
          </div>
          <div
            className="text-[12px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: s.color, opacity: 0.85 }}
          >
            el valor de tu crédito
          </div>
          <div
            className="mt-1 inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ background: s.chipBg, color: s.chipColor }}
          >
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </div>
          <p
            className="mt-2 max-w-2xl text-[13px] leading-relaxed"
            style={{ color: s.color, opacity: 0.9 }}
          >
            {s.mensaje.replace("{n}", vecesTxt)}
          </p>
        </div>
      </div>

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
