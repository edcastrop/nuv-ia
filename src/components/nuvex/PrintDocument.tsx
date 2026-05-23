import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { PdfBrandHeader } from "./pdf/PdfBrandHeader";
import { PdfWatermark } from "./pdf/PdfWatermark";


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
   PALETA OFICIAL NUVEX — V3 (Azul dominante)
============================================================ */
const C = {
  ink: NUVEX.negro,                 // #242424
  azul: NUVEX.azul,                 // #445DA3
  azulDeep: "#2E4178",
  azulSoft: "#EEF1FA",
  azulSoft2: "#F6F8FD",
  brand: NUVEX.verde,               // #84B98F
  brandDeep: "#3F8C57",
  brandSoft: "#EAF5ED",
  graphite: "#52525B",
  muted: "#8A8A92",
  hairline: "#E6E6E6",
  hairlineSoft: "#F0F0EE",
  paper: "#FFFFFF",
  cream: "#FBFAF7",
};

const GRAD_BLUE = `linear-gradient(135deg, ${C.azul} 0%, ${C.azulDeep} 100%)`;
const GRAD_HERO = `linear-gradient(135deg, ${C.azul} 0%, ${C.azulDeep} 55%, ${C.ink} 100%)`;

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
      }}
    >
      {/* ============== PÁGINA 1 ============== */}
      <PageShell pagina={1} fecha={fecha} cliente={client.nombre || "—"}>
        {/* Eyebrow */}
        <div style={eyebrow}>
          Propuesta financiera personalizada · {client.nombre || "—"}
        </div>

        {/* HERO GIGANTE — "RECUPERA X AÑOS DE TU VIDA FINANCIERA" */}
        <h1
          style={{
            fontSize: 92,
            fontWeight: 900,
            lineHeight: 0.92,
            letterSpacing: "-0.045em",
            margin: "12px 0 0 0",
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: C.azul, display: "block", fontSize: 36, fontWeight: 800, letterSpacing: "-0.02em" }}>Recupera</span>
          <span style={{ color: C.brand, display: "block", fontSize: 120, lineHeight: 0.9 }}>
            {formatNumber(añosEliminados, 0)}
          </span>
          <span style={{ color: C.azul, display: "block", fontSize: 30, fontWeight: 800, marginTop: -6, letterSpacing: "-0.02em" }}>
            años
          </span>
          <span style={{ color: C.ink, display: "block", fontWeight: 400, fontSize: 18, letterSpacing: "-0.01em", textTransform: "none", marginTop: 8 }}>
            de tu vida financiera.
          </span>
        </h1>


        {/* HERO CARD — AHORRO TOTAL (azul degradado) */}
        <div
          style={{
            marginTop: 22,
            background: GRAD_HERO,
            color: "#fff",
            borderRadius: 14,
            padding: "26px 30px",
            position: "relative",
            overflow: "hidden",
            boxShadow: "0 18px 40px -20px rgba(68,93,163,0.45)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.32em",
                  color: C.brand,
                  textTransform: "uppercase",
                }}
              >
                Ahorro total proyectado
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 44,
                  fontWeight: 700,
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
                  color: "rgba(255,255,255,0.78)",
                }}
              >
                Lo que dejarías de pagar al optimizar tu crédito.
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 22 }}>
              <span>💰</span>
              <span>📈</span>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          <KpiCard icon="📅" kicker="Años eliminados" value={formatNumber(añosEliminados, 1)} suffix="años" />
          <KpiCard icon="🏠" kicker="Cuotas eliminadas" value={formatNumber(cuotasEliminadas, 0)} suffix="cuotas" />
          <KpiCard icon="💵" kicker="Nueva cuota" value={formatCOP(recommended.nuevaCuota)} />
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

        {/* BENEFICIOS */}
        <Beneficios />
      </PageShell>

      {/* ============== PÁGINA 2 ============== */}
      <PageShell pagina={2} fecha={fecha} cliente={client.nombre || "—"} breakBefore>
        {/* Título con barra lateral azul */}
        <div style={{ display: "flex", gap: 14, alignItems: "stretch" }}>
          <div style={{ width: 5, background: C.azul, borderRadius: 4 }} />
          <div>
            <div style={eyebrow}>Resumen ejecutivo</div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.028em",
                lineHeight: 1.05,
                margin: "4px 0 0 0",
                color: C.ink,
                textTransform: "uppercase",
              }}
            >
              Propuesta recomendada
            </h2>
            <p
              style={{
                marginTop: 8,
                fontSize: 10.5,
                lineHeight: 1.55,
                color: C.graphite,
                maxWidth: "92%",
              }}
            >
              Escenario financiero construido con base en su capacidad de pago.
            </p>
          </div>
        </div>

        {/* TABLA COMPARATIVA */}
        <ComparativoHoyVsNuvex
          scenario={scenario}
          recommended={recommended}
          añosActual={añosActual}
          añosOpt={añosOpt}
        />

        {/* COMPOSICIÓN — DONUT */}
        <ComposicionDonut
          ahorroIntereses={recommended.ahorroIntereses}
          ahorroSeguros={recommended.ahorroSeguros}
          ahorroTotal={recommended.ahorroTotal}
        />

        {/* HONORARIOS */}
        <InversionPorExito
          honorarios={honorariosFinales}
          commercial={commercial}
        />

        {/* CITA INSTITUCIONAL */}
        <ClosingQuote />
      </PageShell>
    </div>
  );
}

/* ============================================================
   ESTILOS COMPARTIDOS
============================================================ */
const eyebrow: React.CSSProperties = {
  fontSize: 8.5,
  fontWeight: 700,
  letterSpacing: "0.34em",
  color: C.azul,
  textTransform: "uppercase",
};

/* ============================================================
   PAGE SHELL — franja superior + footer azul
============================================================ */
function PageShell({
  children,
  pagina,
  fecha,
  cliente,
  breakBefore,
}: {
  children: React.ReactNode;
  pagina: number;
  fecha: string;
  cliente: string;
  breakBefore?: boolean;
}) {
  return (
    <section
      className="nuvex-print-page"
      style={{
        position: "relative",
        minHeight: "297mm",
        height: "297mm",
        boxSizing: "border-box",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        pageBreakBefore: breakBefore ? "always" : "auto",
        background: C.paper,
      }}
    >
      {/* MARCA DE AGUA AL 5% */}
      <PdfWatermark />

      {/* HEADER PREMIUM (logo 2.5× + ciudades + fecha + cliente) */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <PdfBrandHeader
          variant="commercial"
          fecha={fecha}
          cliente={cliente}
          documento="Propuesta financiera"
        />
      </div>

      {/* CONTENIDO */}
      <div
        style={{
          flex: 1,
          padding: "14mm 18mm 0 18mm",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 1,
        }}
      >
        {children}
      </div>

      {/* FOOTER AZUL */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <PageFooter pagina={pagina} />
      </div>
    </section>
  );
}


function PageFooter({ pagina }: { pagina: number }) {
  return (
    <div
      data-pdf-footer="true"
      style={{
        background: GRAD_BLUE,
        color: "#fff",
        padding: "12px 18mm",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 8.5,
        letterSpacing: "0.04em",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontWeight: 800, letterSpacing: "0.36em", fontSize: 10 }}>NUVEX</div>
        <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 7.5 }}>
          📍 {CORPORATIVO.direccion}
        </div>
      </div>
      <div style={{ textAlign: "center", color: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontSize: 7.5 }}>🏢 {CORPORATIVO.ciudades}</div>
        <div style={{ fontSize: 7.5, marginTop: 2 }}>🌐 {CORPORATIVO.web}</div>
      </div>
      <div style={{ textAlign: "right", color: "rgba(255,255,255,0.85)" }}>
        <div style={{ fontSize: 7.5 }}>📞 {CORPORATIVO.telefono}</div>
        <div style={{ fontSize: 7.5, marginTop: 2 }}>Página {pagina} / 2</div>
      </div>
    </div>
  );
}

/* ============================================================
   KPI CARDS
============================================================ */
function KpiCard({
  icon, kicker, value, suffix,
}: { icon: string; kicker: string; value: string; suffix?: string }) {
  return (
    <div
      style={{
        border: `1px solid ${C.azulSoft}`,
        borderRadius: 10,
        padding: "14px 16px",
        background: C.paper,
        boxShadow: "0 1px 2px rgba(68,93,163,0.04)",
      }}
    >
      <div style={{ fontSize: 18, lineHeight: 1 }}>{icon}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: "0.26em",
          color: C.graphite,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: C.azul,
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

/* ============================================================
   TIMELINE
============================================================ */
function Timeline({
  añosActual, añosOpt, añosEliminados, añoHoy, añoFinActual, añoFinOpt,
}: {
  añosActual: number; añosOpt: number; añosEliminados: number;
  añoHoy: number; añoFinActual: number; añoFinOpt: number;
}) {
  const maxA = Math.max(añosActual, 1);
  const pctOpt = Math.max(10, (añosOpt / maxA) * 100);
  return (
    <div
      style={{
        marginTop: 18,
        padding: "16px 20px",
        border: `1px solid ${C.azulSoft}`,
        borderRadius: 10,
        background: C.azulSoft2,
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

      <div style={{ marginTop: 12 }}>
        <TimelineRow
          label="Situación actual"
          years={añosActual}
          widthPct={100}
          color="#C9CCD4"
          yearStart={añoHoy}
          yearEnd={añoFinActual}
          muted
        />
        <div style={{ height: 12 }} />
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
  label, years, widthPct, color, yearStart, yearEnd, muted,
}: {
  label: string; years: number; widthPct: number; color: string;
  yearStart: number; yearEnd: number; muted?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 5,
        }}
      >
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: muted ? C.muted : C.azul,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: muted ? C.muted : C.ink }}>
          {formatNumber(years, 1)} años
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: 10,
          background: "#ECEEF3",
          borderRadius: 999,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: `${widthPct}%`,
            background: color,
            borderRadius: 999,
            boxShadow: muted ? "none" : `0 2px 6px ${C.brand}55`,
          }}
        />
      </div>
      <div
        style={{
          marginTop: 5,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 8.5,
          color: C.muted,
        }}
      >
        <div>📍 {yearStart}</div>
        <div>🏁 {yearEnd}</div>
      </div>
    </div>
  );
}

/* ============================================================
   BENEFICIOS (4 tarjetas azules)
============================================================ */
function Beneficios() {
  const items = [
    { icon: "🛡", text: "Menos tiempo de deuda" },
    { icon: "💰", text: "Menos intereses futuros" },
    { icon: "☂", text: "Menos seguros futuros" },
    { icon: "👨‍👩‍👧", text: "Más patrimonio para tu familia" },
  ];
  return (
    <div
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          style={{
            background: C.azulSoft,
            border: `1px solid ${C.azulSoft}`,
            borderRadius: 10,
            padding: "12px 12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, color: C.azul }}>{it.icon}</div>
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              fontWeight: 600,
              color: C.ink,
              lineHeight: 1.3,
            }}
          >
            {it.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   PÁGINA 2 — Tabla comparativa
============================================================ */
function ComparativoHoyVsNuvex({
  scenario, recommended, añosActual, añosOpt,
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
      highlight: true,
    },
    {
      label: "Tiempo restante",
      hoy: `${formatNumber(añosActual, 1)} años`,
      nuvex: `${formatNumber(añosOpt, 1)} años`,
      highlight: true,
    },
    {
      label: "Total proyectado a pagar",
      hoy: formatCOP(scenario.totalActual),
      nuvex: formatCOP(scenario.totalOptimizado),
      highlight: true,
    },
    {
      label: "Veces pagado el crédito",
      hoy: `${formatNumber(scenario.vecesActual, 2)} ×`,
      nuvex: `${formatNumber(scenario.vecesOptimizado, 2)} ×`,
      highlight: false,
    },
  ];

  return (
    <div
      style={{
        marginTop: 18,
        borderRadius: 10,
        overflow: "hidden",
        border: `1px solid ${C.azulSoft}`,
      }}
    >
      {/* Cabecera azul */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr 1fr",
          padding: "10px 16px",
          background: GRAD_BLUE,
          color: "#fff",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
        }}
      >
        <div>Indicador</div>
        <div style={{ textAlign: "right" }}>Hoy</div>
        <div style={{ textAlign: "right" }}>Con NUVEX</div>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr",
            padding: "11px 16px",
            borderBottom: i < rows.length - 1 ? `1px solid ${C.hairlineSoft}` : "none",
            alignItems: "baseline",
            background: C.paper,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 500, color: C.graphite }}>
            {r.label}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: C.muted,
              textAlign: "right",
            }}
          >
            {r.hoy}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: r.highlight ? 700 : 600,
              color: r.highlight ? C.brandDeep : C.ink,
              textAlign: "right",
              background: C.brandSoft,
              borderRadius: 6,
              padding: "4px 10px",
              marginLeft: "auto",
              minWidth: "60%",
            }}
          >
            {r.nuvex}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   COMPOSICIÓN DEL AHORRO — DONUT
============================================================ */
function ComposicionDonut({
  ahorroIntereses, ahorroSeguros, ahorroTotal,
}: { ahorroIntereses: number; ahorroSeguros: number; ahorroTotal: number }) {
  const total = Math.max(1, ahorroIntereses + ahorroSeguros);
  const pctInt = (ahorroIntereses / total) * 100;
  const pctSeg = 100 - pctInt;

  // SVG donut
  const size = 150;
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dashInt = (pctInt / 100) * circ;
  const dashSeg = (pctSeg / 100) * circ;

  return (
    <div style={{ marginTop: 18 }}>
      <div style={eyebrow}>Composición del ahorro</div>
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 24,
          alignItems: "center",
          border: `1px solid ${C.azulSoft}`,
          borderRadius: 10,
          padding: "16px 20px",
          background: C.paper,
        }}
      >
        {/* DONUT */}
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2F4F8" strokeWidth={stroke} />
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={C.azul} strokeWidth={stroke}
              strokeDasharray={`${dashInt} ${circ - dashInt}`}
              strokeLinecap="butt"
            />
            <circle
              cx={cx} cy={cy} r={r} fill="none"
              stroke={C.brand} strokeWidth={stroke}
              strokeDasharray={`${dashSeg} ${circ - dashSeg}`}
              strokeDashoffset={-dashInt}
              strokeLinecap="butt"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 6.5,
                fontWeight: 700,
                letterSpacing: "0.24em",
                color: C.muted,
                textTransform: "uppercase",
              }}
            >
              Total ahorrado
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 13,
                fontWeight: 700,
                color: C.ink,
                letterSpacing: "-0.02em",
              }}
            >
              {formatCOP(ahorroTotal)}
            </div>
          </div>
        </div>

        {/* LEYENDA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <DonutLegend
            color={C.azul}
            icon="🔵"
            label="Ahorro en intereses"
            value={ahorroIntereses}
            pct={pctInt}
          />
          <DonutLegend
            color={C.brand}
            icon="🟢"
            label="Ahorro en seguros"
            value={ahorroSeguros}
            pct={pctSeg}
          />
        </div>
      </div>
    </div>
  );
}

function DonutLegend({
  color, icon, label, value, pct,
}: { color: string; icon: string; label: string; value: number; pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div
        style={{
          width: 10, height: 10, borderRadius: 3,
          background: color, flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.22em",
            color: C.muted,
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div style={{ marginTop: 3, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, letterSpacing: "-0.02em" }}>
            {formatCOP(value)}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color }}>
            {formatNumber(pct, 0)}%
          </div>
        </div>
      </div>
      <span style={{ display: "none" }}>{icon}</span>
    </div>
  );
}

/* ============================================================
   HONORARIOS — INVERSIÓN POR ÉXITO
============================================================ */
function InversionPorExito({
  honorarios, commercial,
}: { honorarios: number; commercial?: CommercialBenefit }) {
  return (
    <div
      style={{
        marginTop: 18,
        borderRadius: 12,
        padding: "20px 24px",
        background: GRAD_BLUE,
        color: "#fff",
        boxShadow: "0 14px 30px -18px rgba(68,93,163,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flex: 1 }}>
        <div style={{ fontSize: 26, lineHeight: 1 }}>🛡</div>
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.32em",
              color: C.brand,
              textTransform: "uppercase",
            }}
          >
            Inversión por éxito
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10.5,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.5,
              maxWidth: 360,
            }}
          >
            Los honorarios únicamente se generan si el resultado es aprobado y ejecutado
            por el banco.
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        {commercial?.hasDiscount && (
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.55)",
              textDecoration: "line-through",
              marginBottom: 2,
            }}
          >
            {formatCOP(commercial.honorariosBase)}
          </div>
        )}
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "#fff",
            letterSpacing: "-0.025em",
          }}
        >
          {formatCOP(honorarios)}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CITA INSTITUCIONAL — CIERRE
============================================================ */
function ClosingQuote() {
  return (
    <div
      style={{
        marginTop: "auto",
        marginBottom: 4,
        padding: "20px 0 8px 0",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 6, left: 0,
          fontSize: 44,
          color: C.azul,
          opacity: 0.18,
          lineHeight: 1,
          fontFamily: "Georgia, serif",
        }}
      >
        ❝
      </div>
      <div style={{ paddingLeft: 30, paddingRight: 20 }}>
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: C.graphite,
            lineHeight: 1.65,
            fontStyle: "italic",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          Cada año que eliminas de tu crédito representa tiempo, tranquilidad y patrimonio
          que vuelve a tu familia.
        </p>
        <p
          style={{
            margin: "8px 0 0 0",
            fontSize: 11,
            color: C.graphite,
            lineHeight: 1.65,
            fontStyle: "italic",
            fontFamily: "Georgia, 'Times New Roman', serif",
          }}
        >
          Esta propuesta refleja una oportunidad financiera real basada en cálculos
          técnicos y experiencia especializada en optimización de créditos hipotecarios.
        </p>
        <p
          style={{
            margin: "10px 0 0 0",
            fontSize: 11,
            color: C.ink,
            lineHeight: 1.6,
            fontStyle: "italic",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 600,
          }}
        >
          Gracias por confiar en NUVEX Finanzas Inteligentes.
        </p>
      </div>
    </div>
  );
}
