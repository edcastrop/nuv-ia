import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";

interface MetricItem { label: string; value: string }

export interface CommercialBenefit {
  honorariosBase: number;
  descuento: number;
  finales: number;
  vigencia?: string;
  hasDiscount: boolean;
}

interface Props {
  mode: "pesos" | "uvr";
  client: ClientData;
  cuotasPendientes: number;
  metrics: MetricItem[];
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  bestIndex: number;
  honorariosPct: number;
  personalizada?: boolean;
  recommended: {
    añosEliminados: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    ahorroTotal: number;
    honorarios: number;
    nuevaCuota: number;
  };
  scenario: {
    cuotaActual: number;
    nuevaCuota: number;
    plazoActual: number;
    nuevoPlazo: number;
    totalActual: number;
    totalOptimizado: number;
    vecesActual: number;
    vecesOptimizado: number;
  };
  commercial?: CommercialBenefit;
}

/* ============================================================
   PALETA — NUVEX Private Banking
============================================================ */
const C = {
  ink: NUVEX.negro,        // #242424
  azul: NUVEX.azul,        // #445DA3
  brand: NUVEX.verde,      // #84B98F
  brandDeep: "#3F8C57",
  graphite: "#52525B",
  muted: "#8A8A92",
  hairline: "#E6E6E6",
  hairlineSoft: "#F0F0EE",
  paper: "#FFFFFF",
  cream: "#FBFAF7",
  ivory: "#F7F6F1",
};

/* ============================================================
   PRINT DOCUMENT — 2 páginas A4
============================================================ */
export function PrintDocument(props: Props) {
  const { mode, client, recommended, scenario, commercial } = props;
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";
  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const añosActual = scenario.plazoActual / 12;
  const añosOpt = scenario.nuevoPlazo / 12;
  const añosEliminados = Math.max(0, añosActual - añosOpt);
  const cuotasEliminadas = Math.max(0, scenario.plazoActual - scenario.nuevoPlazo);
  const honorariosFinales = commercial?.hasDiscount ? commercial.finales : recommended.honorarios;

  // Fechas de finalización proyectadas
  const fechaBase = new Date();
  const fechaFinActual = new Date(fechaBase);
  fechaFinActual.setMonth(fechaFinActual.getMonth() + scenario.plazoActual);
  const fechaFinOpt = new Date(fechaBase);
  fechaFinOpt.setMonth(fechaFinOpt.getMonth() + scenario.nuevoPlazo);
  const añoActualHoy = fechaBase.getFullYear();
  const añoFinActual = fechaFinActual.getFullYear();
  const añoFinOpt = fechaFinOpt.getFullYear();

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        width: "210mm",
        fontFeatureSettings: '"ss01","cv11"',
      }}
    >
      {/* ============== PÁGINA 1 — PORTADA EJECUTIVA ============== */}
      <section
        className="nuvex-print-page"
        style={{
          padding: "20mm 18mm 18mm 18mm",
          position: "relative",
          minHeight: "297mm",
          height: "297mm",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PremiumHeader fecha={fecha} />

        {/* CONTENIDO */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 22 }}>
          {/* Eyebrow */}
          <div style={eyebrow}>
            Propuesta financiera personalizada · {client.nombre || "—"}
          </div>

          {/* HERO — título grande */}
          <h1
            style={{
              fontSize: 40,
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: C.ink,
              margin: "16px 0 0 0",
            }}
          >
            Recupera{" "}
            <span style={{ fontWeight: 700, color: C.azul }}>
              {formatNumber(añosEliminados, 0)} años
            </span>
            <br />
            de tu vida financiera.
          </h1>

          {/* Subtítulo */}
          <p
            style={{
              marginTop: 18,
              fontSize: 12,
              lineHeight: 1.6,
              color: C.graphite,
              maxWidth: "82%",
              fontWeight: 400,
              letterSpacing: "-0.005em",
            }}
          >
            Nuestro análisis financiero muestra una oportunidad real para finalizar tu crédito
            antes de lo previsto, reduciendo significativamente los intereses futuros y el
            tiempo de endeudamiento.
          </p>

          {/* HERO CARD — AHORRO TOTAL */}
          <div
            style={{
              marginTop: 26,
              background: C.ink,
              color: "#fff",
              borderRadius: 10,
              padding: "30px 32px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 18px 40px -20px rgba(36,36,36,0.35)",
            }}
          >
            {/* acento verde */}
            <div
              style={{
                position: "absolute",
                top: 0, left: 0, bottom: 0,
                width: 4,
                background: C.brand,
              }}
            />
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.32em",
                color: C.brand,
                textTransform: "uppercase",
              }}
            >
              Ahorro total proyectado
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 46,
                fontWeight: 600,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                color: "#fff",
              }}
            >
              {formatCOP(recommended.ahorroTotal)}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.7)",
                letterSpacing: "-0.005em",
              }}
            >
              Estimado total al optimizar tu crédito hipotecario.
            </div>
          </div>

          {/* TRES TARJETAS SECUNDARIAS */}
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
            }}
          >
            <SecondaryCard
              kicker="Años eliminados"
              value={formatNumber(añosEliminados, 1)}
              suffix="años"
              accent
            />
            <SecondaryCard
              kicker="Cuotas eliminadas"
              value={formatNumber(cuotasEliminadas, 0)}
              suffix="cuotas"
            />
            <SecondaryCard
              kicker="Nueva cuota"
              value={formatCOP(recommended.nuevaCuota)}
            />
          </div>

          {/* TIMELINE */}
          <Timeline
            añosActual={añosActual}
            añosOpt={añosOpt}
            añosEliminados={añosEliminados}
            añoHoy={añoActualHoy}
            añoFinActual={añoFinActual}
            añoFinOpt={añoFinOpt}
          />

          {/* RESUMEN EJECUTIVO */}
          <ResumenEjecutivo />
        </div>

        <PageFooter pagina={1} />
      </section>

      {/* ============== PÁGINA 2 — PROPUESTA RECOMENDADA ============== */}
      <section
        className="nuvex-print-page"
        style={{
          padding: "20mm 18mm 18mm 18mm",
          pageBreakBefore: "always",
          position: "relative",
          minHeight: "297mm",
          height: "297mm",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PremiumHeader fecha={fecha} />

        <div style={{ marginTop: 22 }}>
          <div style={eyebrow}>Resumen ejecutivo</div>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 300,
              letterSpacing: "-0.028em",
              lineHeight: 1.05,
              margin: "8px 0 0 0",
              color: C.ink,
            }}
          >
            Propuesta recomendada.
          </h2>
          <p
            style={{
              marginTop: 10,
              fontSize: 11,
              lineHeight: 1.55,
              color: C.graphite,
              maxWidth: "78%",
            }}
          >
            Escenario financiero proyectado según el análisis realizado sobre tu crédito actual.
          </p>
        </div>

        {/* HOY VS CON NUVEX */}
        <ComparativoHoyVsNuvex
          scenario={scenario}
          recommended={recommended}
          añosActual={añosActual}
          añosOpt={añosOpt}
        />

        {/* COMPOSICIÓN DEL AHORRO */}
        <ComposicionAhorro
          ahorroIntereses={recommended.ahorroIntereses}
          ahorroSeguros={recommended.ahorroSeguros}
          ahorroTotal={recommended.ahorroTotal}
        />

        {/* HONORARIOS — INVERSIÓN POR ÉXITO */}
        <InversionPorExito
          honorarios={honorariosFinales}
          commercial={commercial}
        />

        {/* MENSAJE FINAL */}
        <ClosingNote />

        <PageFooter pagina={2} />
      </section>
    </div>
  );
}

/* ============================================================
   ESTILOS COMPARTIDOS
============================================================ */
const eyebrow: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 600,
  letterSpacing: "0.34em",
  color: C.muted,
  textTransform: "uppercase",
};

/* ============================================================
   HEADER & FOOTER
============================================================ */
function PremiumHeader({ fecha }: { fecha: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 14,
        borderBottom: `1px solid ${C.hairline}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 6,
            background: C.ink,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          N
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.36em",
              color: C.ink,
              lineHeight: 1,
            }}
          >
            NUVEX
          </div>
          <div
            style={{
              marginTop: 3,
              fontSize: 7.5,
              fontWeight: 500,
              letterSpacing: "0.22em",
              color: C.muted,
              textTransform: "uppercase",
            }}
          >
            Finanzas Inteligentes
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div
          style={{
            fontSize: 7.5,
            fontWeight: 600,
            color: C.muted,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
          }}
        >
          Propuesta financiera
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 9,
            color: C.ink,
            letterSpacing: "0.06em",
          }}
        >
          {fecha}
        </div>
      </div>
    </div>
  );
}

function PageFooter({ pagina }: { pagina: number }) {
  return (
    <div
      data-pdf-footer="true"
      style={{
        position: "absolute",
        bottom: "10mm",
        left: "18mm",
        right: "18mm",
        paddingTop: 10,
        borderTop: `1px solid ${C.hairlineSoft}`,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 7.5,
        color: C.muted,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      <div>{CORPORATIVO.web}</div>
      <div style={{ fontWeight: 700, color: C.ink, letterSpacing: "0.36em" }}>NUVEX</div>
      <div>{CORPORATIVO.telefono} · {pagina} / 2</div>
    </div>
  );
}

/* ============================================================
   PÁGINA 1 — Tarjetas, Timeline, Resumen
============================================================ */
function SecondaryCard({
  kicker,
  value,
  suffix,
  accent,
}: {
  kicker: string;
  value: string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        border: `1px solid ${C.hairline}`,
        borderRadius: 8,
        padding: "16px 16px",
        background: C.paper,
        position: "relative",
      }}
    >
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 600,
          letterSpacing: "0.28em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: accent ? C.azul : C.ink,
          lineHeight: 1.05,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 10, fontWeight: 500, color: C.muted, marginLeft: 5 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Timeline({
  añosActual,
  añosOpt,
  añosEliminados,
  añoHoy,
  añoFinActual,
  añoFinOpt,
}: {
  añosActual: number;
  añosOpt: number;
  añosEliminados: number;
  añoHoy: number;
  añoFinActual: number;
  añoFinOpt: number;
}) {
  const maxA = Math.max(añosActual, 1);
  const pctOpt = Math.max(10, (añosOpt / maxA) * 100);
  return (
    <div
      style={{
        marginTop: 22,
        padding: "18px 20px 16px",
        border: `1px solid ${C.hairline}`,
        borderRadius: 8,
        background: C.cream,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={eyebrow}>Línea de tiempo del crédito</div>
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            color: C.brandDeep,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {formatNumber(añosEliminados, 0)} años recuperados
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <TimelineRow
          label="Situación actual"
          years={añosActual}
          widthPct={100}
          color={C.graphite}
          yearStart={añoHoy}
          yearEnd={añoFinActual}
          muted
        />
        <div style={{ height: 14 }} />
        <TimelineRow
          label="Con NUVEX"
          years={añosOpt}
          widthPct={pctOpt}
          color={C.brand}
          yearStart={añoHoy}
          yearEnd={añoFinOpt}
        />
      </div>
    </div>
  );
}

function TimelineRow({
  label,
  years,
  widthPct,
  color,
  yearStart,
  yearEnd,
  muted,
}: {
  label: string;
  years: number;
  widthPct: number;
  color: string;
  yearStart: number;
  yearEnd: number;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: "0.22em",
            color: muted ? C.muted : C.ink,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: muted ? C.muted : C.ink,
          }}
        >
          {formatNumber(years, 1)} años
        </div>
      </div>
      <div style={{ position: "relative", height: 8, background: "#ECEAE4", borderRadius: 999 }}>
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${widthPct}%`,
            background: color,
            borderRadius: 999,
            opacity: muted ? 0.5 : 1,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 5,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 8,
          color: C.muted,
          letterSpacing: "0.08em",
        }}
      >
        <div>{yearStart}</div>
        <div>{yearEnd}</div>
      </div>
    </div>
  );
}

function ResumenEjecutivo() {
  const items = [
    "Menos tiempo de deuda",
    "Menos intereses futuros",
    "Menos seguros futuros",
    "Más patrimonio para tu familia",
  ];
  return (
    <div
      style={{
        marginTop: 18,
        padding: "16px 20px",
        border: `1px solid ${C.hairline}`,
        borderRadius: 8,
        background: C.paper,
      }}
    >
      <div style={eyebrow}>Lo que esta propuesta significa</div>
      <div
        style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          rowGap: 8,
          columnGap: 18,
        }}
      >
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: C.brand,
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 11, color: C.ink, fontWeight: 500 }}>{t}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   PÁGINA 2 — Comparativo, Composición, Honorarios, Cierre
============================================================ */
function ComparativoHoyVsNuvex({
  scenario,
  recommended,
  añosActual,
  añosOpt,
}: {
  scenario: Props["scenario"];
  recommended: Props["recommended"];
  añosActual: number;
  añosOpt: number;
}) {
  const rows = [
    {
      label: "Cuota mensual",
      hoy: formatCOP(scenario.cuotaActual),
      nuvex: formatCOP(recommended.nuevaCuota),
    },
    {
      label: "Tiempo restante",
      hoy: `${formatNumber(añosActual, 1)} años`,
      nuvex: `${formatNumber(añosOpt, 1)} años`,
    },
    {
      label: "Total proyectado a pagar",
      hoy: formatCOP(scenario.totalActual),
      nuvex: formatCOP(scenario.totalOptimizado),
    },
    {
      label: "Veces pagado el crédito",
      hoy: `${formatNumber(scenario.vecesActual, 2)} ×`,
      nuvex: `${formatNumber(scenario.vecesOptimizado, 2)} ×`,
    },
  ];

  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          padding: "10px 16px",
          background: C.ivory,
          borderRadius: "8px 8px 0 0",
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: "0.28em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        <div>Indicador</div>
        <div style={{ textAlign: "right" }}>Hoy</div>
        <div style={{ textAlign: "right", color: C.brandDeep }}>Con NUVEX</div>
      </div>
      <div style={{ border: `1px solid ${C.hairline}`, borderTop: "none", borderRadius: "0 0 8px 8px" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              padding: "12px 16px",
              borderBottom: i < rows.length - 1 ? `1px solid ${C.hairlineSoft}` : "none",
              alignItems: "baseline",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 500, color: C.graphite }}>
              {r.label}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                color: C.muted,
                textAlign: "right",
                letterSpacing: "-0.01em",
              }}
            >
              {r.hoy}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.ink,
                textAlign: "right",
                letterSpacing: "-0.015em",
              }}
            >
              {r.nuvex}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComposicionAhorro({
  ahorroIntereses,
  ahorroSeguros,
  ahorroTotal,
}: {
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={eyebrow}>Composición del ahorro</div>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 2fr",
          gap: 12,
        }}
      >
        {/* Izquierda: dos minis apiladas */}
        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 12 }}>
          <MiniSaving label="Ahorro en intereses" value={ahorroIntereses} />
          <MiniSaving label="Ahorro en seguros" value={ahorroSeguros} />
        </div>

        {/* Derecha: PROTAGONISTA (2x) */}
        <div
          style={{
            background: C.ink,
            color: "#fff",
            padding: "22px 24px",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 14px 30px -18px rgba(36,36,36,0.4)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0, right: 0, bottom: 0,
              width: 4,
              background: C.brand,
            }}
          />
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: "0.32em",
              color: C.brand,
              textTransform: "uppercase",
            }}
          >
            Ahorro total
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "#fff",
            }}
          >
            {formatCOP(ahorroTotal)}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: "-0.005em",
              lineHeight: 1.5,
            }}
          >
            Lo que dejas de pagar al optimizar tu crédito hipotecario.
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniSaving({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        border: `1px solid ${C.hairline}`,
        borderRadius: 8,
        padding: "14px 16px",
        background: C.cream,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 600,
          letterSpacing: "0.28em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 16,
          fontWeight: 600,
          color: C.ink,
          letterSpacing: "-0.02em",
        }}
      >
        {formatCOP(value)}
      </div>
    </div>
  );
}

function InversionPorExito({
  honorarios,
  commercial,
}: {
  honorarios: number;
  commercial?: CommercialBenefit;
}) {
  return (
    <div
      style={{
        marginTop: 18,
        border: `1px solid ${C.hairline}`,
        borderRadius: 8,
        padding: "18px 22px",
        background: C.paper,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 8.5,
              fontWeight: 600,
              letterSpacing: "0.32em",
              color: C.azul,
              textTransform: "uppercase",
            }}
          >
            Inversión por éxito
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10.5,
              color: C.graphite,
              letterSpacing: "-0.005em",
              lineHeight: 1.5,
              maxWidth: 380,
            }}
          >
            Los honorarios únicamente se generan si el proceso es aprobado y ejecutado
            exitosamente por el banco.
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {commercial?.hasDiscount && (
            <div
              style={{
                fontSize: 10,
                color: C.muted,
                textDecoration: "line-through",
                marginBottom: 2,
              }}
            >
              {formatCOP(commercial.honorariosBase)}
            </div>
          )}
          <div
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: C.ink,
              letterSpacing: "-0.025em",
            }}
          >
            {formatCOP(honorarios)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClosingNote() {
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 22,
        borderTop: `1px solid ${C.hairline}`,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 400,
          color: C.ink,
          lineHeight: 1.65,
          letterSpacing: "-0.005em",
          maxWidth: "92%",
        }}
      >
        Cada año que eliminas de tu crédito representa tiempo, tranquilidad y patrimonio
        que vuelve a tu familia.
      </p>
      <p
        style={{
          margin: "10px 0 0 0",
          fontSize: 11,
          fontWeight: 400,
          color: C.graphite,
          lineHeight: 1.65,
          letterSpacing: "-0.005em",
          maxWidth: "92%",
        }}
      >
        Esta propuesta refleja una oportunidad financiera real basada en cálculos técnicos
        y experiencia especializada en optimización de créditos hipotecarios.
      </p>
      <p
        style={{
          margin: "10px 0 0 0",
          fontSize: 11,
          fontWeight: 500,
          fontStyle: "italic",
          color: C.ink,
          lineHeight: 1.6,
          letterSpacing: "-0.005em",
        }}
      >
        Gracias por confiar en NUVEX Finanzas Inteligentes.
      </p>
    </div>
  );
}
