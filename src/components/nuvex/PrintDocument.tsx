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
   PALETA — Editorial / Private Banking
============================================================ */
const C = {
  ink: "#0E0E10",          // negro profundo, casi tinta
  graphite: "#3A3A3F",
  muted: "#8A8A92",
  hairline: "#E5E5E5",
  paper: "#FFFFFF",
  cream: "#FBFAF7",
  brand: NUVEX.verde,       // verde NUVEX
  brandDark: "#1F7A45",
  azul: NUVEX.azul,
};

/* ============================================================
   COMPONENTE PRINCIPAL
   Rediseño editorial — 2 páginas A4
   Inspiración: Apple · Tesla · Morgan Stanley Wealth
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
      {/* ============== PÁGINA 1 — HERO EDITORIAL ============== */}
      <section
        className="nuvex-print-page"
        style={{
          padding: "22mm 20mm 18mm 20mm",
          position: "relative",
          minHeight: "297mm",
          height: "297mm",
          boxSizing: "border-box",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MinimalHeader fecha={fecha} />

        {/* HERO — ~70% de la página */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", marginTop: 16 }}>
          {/* Eyebrow */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.32em",
              color: C.muted,
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            Propuesta preparada para {client.nombre || "—"}
          </div>

          {/* Título gigante */}
          <h1
            style={{
              fontSize: 52,
              fontWeight: 300,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: C.ink,
              margin: 0,
            }}
          >
            Tu crédito podría
            <br />
            terminar{" "}
            <span style={{ fontWeight: 700, color: C.brandDark }}>
              {formatNumber(añosEliminados, 0)} años
            </span>
            <br />
            antes de lo previsto.
          </h1>

          {/* Tres métricas en línea — estilo Apple keynote */}
          <div
            style={{
              marginTop: 56,
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 0,
              borderTop: `1px solid ${C.hairline}`,
              borderBottom: `1px solid ${C.hairline}`,
            }}
          >
            <MetricCell
              kicker="Años eliminados"
              value={formatNumber(añosEliminados, 1)}
              suffix="años"
              accent
            />
            <MetricCell
              kicker="Cuotas eliminadas"
              value={formatNumber(cuotasEliminadas, 0)}
              suffix="cuotas"
              divider
            />
            <MetricCell
              kicker="Ahorro total"
              value={formatCOP(recommended.ahorroTotal)}
              divider
            />
          </div>

          {/* Timeline antes/después */}
          <Timeline
            añosActual={añosActual}
            añosOpt={añosOpt}
          />
        </div>

        <PageFooter pagina={1} />
      </section>

      {/* ============== PÁGINA 2 — RESUMEN ============== */}
      <section
        className="nuvex-print-page"
        style={{
          padding: "22mm 20mm 18mm 20mm",
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
        <MinimalHeader fecha={fecha} />

        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.32em",
              color: C.muted,
              textTransform: "uppercase",
            }}
          >
            Resumen
          </div>
          <h2
            style={{
              fontSize: 34,
              fontWeight: 300,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              margin: "6px 0 0 0",
              color: C.ink,
            }}
          >
            La propuesta recomendada.
          </h2>
        </div>

        {/* COMPARATIVO HOY VS CON NUVEX */}
        <ComparativoHoyVsNuvex
          scenario={scenario}
          recommended={recommended}
          añosActual={añosActual}
          añosOpt={añosOpt}
        />

        {/* TRES TARJETAS DE AHORRO */}
        <SavingsTrio
          ahorroIntereses={recommended.ahorroIntereses}
          ahorroSeguros={recommended.ahorroSeguros}
          ahorroTotal={recommended.ahorroTotal}
        />

        {/* HONORARIOS — una sola tarjeta */}
        <HonorariosCard
          honorarios={honorariosFinales}
          commercial={commercial}
        />

        {/* MENSAJE FINAL — emocional y elegante */}
        <ClosingNote
          client={client}
          añosEliminados={añosEliminados}
        />

        <PageFooter pagina={2} />
      </section>
    </div>
  );
}

/* ============================================================
   HEADER & FOOTER MINIMAL
============================================================ */
function MinimalHeader({ fecha }: { fecha: string }) {
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
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.38em",
          color: C.ink,
        }}
      >
        NUVEX
      </div>
      <div
        style={{
          fontSize: 8.5,
          color: C.muted,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        {fecha}
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
        left: "20mm",
        right: "20mm",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 8,
        color: C.muted,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}
    >
      <div>{CORPORATIVO.nombre} · {CORPORATIVO.web}</div>
      <div>{pagina} / 2</div>
    </div>
  );
}

/* ============================================================
   PÁGINA 1 — Métricas y Timeline
============================================================ */
function MetricCell({
  kicker,
  value,
  suffix,
  accent,
  divider,
}: {
  kicker: string;
  value: string;
  suffix?: string;
  accent?: boolean;
  divider?: boolean;
}) {
  return (
    <div
      style={{
        padding: "26px 18px",
        borderLeft: divider ? `1px solid ${C.hairline}` : "none",
      }}
    >
      <div
        style={{
          fontSize: 8,
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
          marginTop: 12,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: accent ? C.brandDark : C.ink,
          lineHeight: 1,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, marginLeft: 6 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Timeline({ añosActual, añosOpt }: { añosActual: number; añosOpt: number }) {
  const maxA = Math.max(añosActual, 1);
  const pctOpt = Math.max(8, (añosOpt / maxA) * 100);
  return (
    <div style={{ marginTop: 48 }}>
      {/* Situación actual */}
      <TimelineRow
        label="Situación actual"
        years={añosActual}
        widthPct={100}
        color={C.graphite}
        muted
      />
      <div style={{ height: 22 }} />
      {/* Optimizada */}
      <TimelineRow
        label="Con NUVEX"
        years={añosOpt}
        widthPct={pctOpt}
        color={C.brand}
      />
    </div>
  );
}

function TimelineRow({
  label,
  years,
  widthPct,
  color,
  muted,
}: {
  label: string;
  years: number;
  widthPct: number;
  color: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.24em",
            color: muted ? C.muted : C.ink,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: muted ? C.muted : C.ink,
            letterSpacing: "-0.01em",
          }}
        >
          {formatNumber(years, 1)} años
        </div>
      </div>
      <div style={{ position: "relative", height: 10, background: "#F3F3F1", borderRadius: 999 }}>
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${widthPct}%`,
            background: color,
            borderRadius: 999,
            opacity: muted ? 0.55 : 1,
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   PÁGINA 2 — Comparativo, Ahorros, Honorarios, Cierre
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
      label: "Plazo restante",
      hoy: `${formatNumber(añosActual, 1)} años`,
      nuvex: `${formatNumber(añosOpt, 1)} años`,
    },
    {
      label: "Total pagado",
      hoy: formatCOP(scenario.totalActual),
      nuvex: formatCOP(scenario.totalOptimizado),
    },
  ];

  return (
    <div style={{ marginTop: 28 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          padding: "10px 0",
          borderBottom: `1px solid ${C.hairline}`,
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: "0.26em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        <div />
        <div style={{ textAlign: "right" }}>Hoy</div>
        <div style={{ textAlign: "right", color: C.brandDark }}>Con NUVEX</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            padding: "16px 0",
            borderBottom: `1px solid ${C.hairline}`,
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: C.graphite,
              letterSpacing: "-0.005em",
            }}
          >
            {r.label}
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 400,
              color: C.muted,
              textAlign: "right",
              letterSpacing: "-0.015em",
            }}
          >
            {r.hoy}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: C.ink,
              textAlign: "right",
              letterSpacing: "-0.02em",
            }}
          >
            {r.nuvex}
          </div>
        </div>
      ))}
    </div>
  );
}

function SavingsTrio({
  ahorroIntereses,
  ahorroSeguros,
  ahorroTotal,
}: {
  ahorroIntereses: number;
  ahorroSeguros: number;
  ahorroTotal: number;
}) {
  return (
    <div
      style={{
        marginTop: 26,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
    >
      {/* Columna izquierda: dos tarjetas apiladas */}
      <div style={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 14 }}>
        <MiniSaving label="Ahorro en intereses" value={ahorroIntereses} />
        <MiniSaving label="Ahorro en seguros" value={ahorroSeguros} />
      </div>

      {/* Columna derecha: PROTAGONISTA */}
      <div
        style={{
          background: C.ink,
          color: "#fff",
          padding: "26px 24px",
          borderRadius: 6,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
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
            marginTop: 14,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
            color: "#fff",
          }}
        >
          {formatCOP(ahorroTotal)}
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "-0.005em",
            lineHeight: 1.5,
          }}
        >
          Lo que dejas de pagar al optimizar el crédito.
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
        borderRadius: 6,
        padding: "18px 18px",
        background: C.cream,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontSize: 8,
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
          marginTop: 8,
          fontSize: 18,
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

function HonorariosCard({
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
        borderRadius: 6,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: "0.28em",
            color: C.muted,
            textTransform: "uppercase",
          }}
        >
          Honorarios NUVEX
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 10.5,
            color: C.graphite,
            letterSpacing: "-0.005em",
            lineHeight: 1.45,
            maxWidth: 360,
          }}
        >
          Pago único al cierre. Solo se cobra si la propuesta se ejecuta con éxito.
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
            fontSize: 22,
            fontWeight: 600,
            color: C.ink,
            letterSpacing: "-0.02em",
          }}
        >
          {formatCOP(honorarios)}
        </div>
      </div>
    </div>
  );
}

function ClosingNote({
  client,
  añosEliminados,
}: {
  client: ClientData;
  añosEliminados: number;
}) {
  const nombre = (client.nombre || "").split(" ")[0] || "";
  return (
    <div
      style={{
        marginTop: "auto",
        paddingTop: 28,
        borderTop: `1px solid ${C.hairline}`,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 300,
          fontStyle: "italic",
          color: C.ink,
          lineHeight: 1.55,
          letterSpacing: "-0.005em",
          maxWidth: "85%",
        }}
      >
        {nombre ? `${nombre}, ` : ""}cada cuota que dejas de pagar
        son <b style={{ fontStyle: "normal", fontWeight: 600 }}>{formatNumber(añosEliminados, 0)} años</b> que
        recuperas para tu vida. Esta propuesta no es una promesa: es un plan respaldado por cálculos
        precisos y un compromiso de cierre exitoso.
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.28em",
          color: C.muted,
          textTransform: "uppercase",
        }}
      >
        — Equipo NUVEX
      </div>
    </div>
  );
}
