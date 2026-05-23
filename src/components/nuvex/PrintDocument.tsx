import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { getVecesStyle } from "./ScenarioTable";

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

const C = {
  negro: NUVEX.negro,         // #242424
  azul: NUVEX.azul,           // #445DA3
  verde: NUVEX.verde,         // #84B98F
  verdeOscuro: "#1F7A45",
  verdeClaro: "#EAF8EF",
  cream: "#FAF8F3",
  paper: "#FFFFFF",
  line: "#E3E7EE",
  lineDark: "#C9D0DE",
  muted: "#6B7280",
  goldLine: "#C8B273",
};

/* ============================================================
   COMPONENTE PRINCIPAL — Propuesta financiera premium NUVEX
   Inspirado en BBVA Wealth · Bancolombia Preferencial · JP Morgan
   Máx. 2 páginas verticales A4
============================================================ */

export function PrintDocument(props: Props) {
  const { mode, client, recommended, scenario, commercial, personalizada = false } = props;
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";
  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const añosActual = scenario.plazoActual / 12;
  const añosOpt = scenario.nuevoPlazo / 12;
  const añosEliminados = Math.max(0, añosActual - añosOpt);
  const cuotasEliminadas = Math.max(0, scenario.plazoActual - scenario.nuevoPlazo);
  const vsA = getVecesStyle(scenario.vecesActual);
  const vsO = getVecesStyle(scenario.vecesOptimizado);

  // Para la gráfica antes/después
  const maxAños = Math.max(añosActual, añosOpt, 1);
  const pctActual = (añosActual / maxAños) * 100;
  const pctOpt = (añosOpt / maxAños) * 100;

  // Honorarios finales (con descuento si aplica)
  const honorariosFinales = commercial?.hasDiscount ? commercial.finales : recommended.honorarios;
  const esPreferencial = honorariosFinales >= 6_000_000;

  const badgeLabel = personalizada ? "PROPUESTA PERSONALIZADA" : "PROPUESTA RECOMENDADA";

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: C.paper,
        color: C.negro,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        width: "210mm",
        fontFeatureSettings: '"ss01","cv11"',
      }}
    >
      {/* ============================================================
           PÁGINA 1 — PORTADA COMERCIAL
      ============================================================ */}
      <section
        className="nuvex-print-page"
        style={{ padding: "20mm 16mm 16mm 16mm", position: "relative", minHeight: "297mm", height: "297mm", boxSizing: "border-box", overflow: "hidden" }}
      >
        <PremiumHeader fecha={fecha} />

        {/* TÍTULO */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.32em",
              color: C.azul,
              textTransform: "uppercase",
            }}
          >
            {esPreferencial ? "Documento confidencial · Cliente preferencial" : "Documento confidencial"}
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 800,
              lineHeight: 1.05,
              color: C.negro,
              marginTop: 8,
              letterSpacing: "-0.015em",
            }}
          >
            Propuesta de Optimización Financiera
          </h1>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: C.muted,
              fontWeight: 500,
            }}
          >
            Diagnóstico financiero personalizado · Preparado para su consideración
          </div>
          <GoldRule />
        </div>

        {/* DATOS DEL CLIENTE — barra elegante */}
        <ClientStrip client={client} fecha={fecha} />

        {/* HERO — Años eliminados + ahorro total (PROTAGONISTA) */}
        <HeroBlock
          añosEliminados={añosEliminados}
          ahorroTotal={recommended.ahorroTotal}
          cuotasEliminadas={cuotasEliminadas}
        />

        {/* ANTES VS DESPUÉS — gráfica de barras minimal */}
        <BeforeAfterChart
          añosActual={añosActual}
          añosOpt={añosOpt}
          pctActual={pctActual}
          pctOpt={pctOpt}
          añosEliminados={añosEliminados}
        />

        {/* DASHBOARD AHORRO — 3 tarjetas, la de total el doble */}
        <SavingsDashboard
          ahorroIntereses={recommended.ahorroIntereses}
          ahorroSeguros={recommended.ahorroSeguros}
          ahorroTotal={recommended.ahorroTotal}
          mode={mode}
        />

        {/* SITUACIÓN ACTUAL VS OPTIMIZADA + N° veces pagado con semáforo */}
        <SituationVsOptimized scenario={scenario} vsA={vsA} vsO={vsO} />

        <PageFooter pagina={1} />
      </section>

      {/* ============================================================
           PÁGINA 2 — PROPUESTA RECOMENDADA
      ============================================================ */}
      <section
        className="nuvex-print-page"
        style={{
          padding: "20mm 16mm 16mm 16mm",
          pageBreakBefore: "always",
          position: "relative",
          minHeight: "297mm",
          height: "297mm",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <PremiumHeader fecha={fecha} />

        {/* Encabezado */}
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.28em",
              color: C.azul,
              textTransform: "uppercase",
            }}
          >
            {badgeLabel} · Resultado financiero proyectado
          </div>
          <h2
            style={{
              fontSize: 38,
              fontWeight: 900,
              lineHeight: 1,
              color: C.negro,
              marginTop: 8,
              letterSpacing: "-0.025em",
            }}
          >
            ELIMINA{" "}
            <span style={{ color: C.verde }}>
              {formatNumber(recommended.añosEliminados, 0)} AÑOS
            </span>{" "}
            DE TU CRÉDITO
          </h2>
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: C.negro,
              opacity: 0.78,
            }}
          >
            Ahorro estimado de{" "}
            <b style={{ color: C.verdeOscuro }}>{formatCOP(recommended.ahorroTotal)}</b>{" "}
            sobre el costo total del crédito.
          </div>
          <GoldRule />
        </div>

        {/* DASHBOARD PREMIUM — 6 KPIs */}
        <PremiumKpiGrid
          mode={mode}
          recommended={recommended}
          scenario={scenario}
        />

        {/* QUÉ REPRESENTA */}
        <BenefitsBlock
          añosEliminados={recommended.añosEliminados}
        />

        {/* HONORARIOS + DESCUENTO COMERCIAL */}
        <HonorariosBlock
          honorarios={recommended.honorarios}
          commercial={commercial}
        />

        {/* POR QUÉ NUVEX + CIERRE EMOCIONAL */}
        <ClosingBlock
          añosEliminados={recommended.añosEliminados}
          ahorroTotal={recommended.ahorroTotal}
        />

        <PageFooter pagina={2} />
      </section>
    </div>
  );
}

/* ============================================================
   HEADER & FOOTER PREMIUM
============================================================ */

function PremiumHeader({ fecha }: { fecha: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 6,
              background: C.negro,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: "0.05em",
            }}
          >
            N
          </div>
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: C.negro,
                letterSpacing: "0.06em",
              }}
            >
              NUVEX
            </div>
            <div
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: C.azul,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                marginTop: 1,
              }}
            >
              Finanzas Inteligentes
            </div>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: C.muted,
            }}
          >
            Propuesta financiera personalizada
          </div>
          <div
            style={{
              fontSize: 9,
              color: C.negro,
              opacity: 0.7,
              marginTop: 2,
            }}
          >
            {fecha}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          height: 1,
          background: C.negro,
        }}
      />
      <div
        style={{
          marginTop: 2,
          height: 1,
          background: C.goldLine,
          width: "30%",
        }}
      />
    </div>
  );
}

function GoldRule() {
  return (
    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ height: 2, width: 40, background: C.goldLine }} />
      <div style={{ height: 1, flex: 1, background: C.line }} />
    </div>
  );
}

function PageFooter({ pagina }: { pagina: number }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "10mm",
        left: "16mm",
        right: "16mm",
      }}
    >
      <div style={{ height: 1, background: C.line, marginBottom: 6 }} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 8,
          color: C.muted,
        }}
      >
        <div style={{ fontWeight: 700, letterSpacing: "0.12em" }}>
          {CORPORATIVO.nombre.toUpperCase()}
        </div>
        <div>{CORPORATIVO.web} · {CORPORATIVO.telefono}</div>
        <div style={{ fontWeight: 700 }}>{pagina} / 2</div>
      </div>
    </div>
  );
}

/* ============================================================
   PÁGINA 1 — Bloques
============================================================ */

function ClientStrip({ client, fecha }: { client: ClientData; fecha: string }) {
  const items: { l: string; v: string }[] = [
    { l: "Cliente", v: client.nombre || "—" },
    { l: "Banco", v: client.banco || "—" },
    { l: "Producto", v: client.tipoProducto || "—" },
    { l: "N° Crédito", v: client.numeroCredito || "—" },
    { l: "Asesor", v: client.asesor || "—" },
    { l: "Fecha", v: fecha },
  ];
  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${C.line}`,
        borderLeft: `3px solid ${C.azul}`,
        background: C.cream,
        padding: "12px 16px",
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 10,
      }}
    >
      {items.map((it, i) => (
        <div key={i}>
          <div
            style={{
              fontSize: 7.5,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: C.azul,
            }}
          >
            {it.l}
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: C.negro,
              marginTop: 3,
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {it.v}
          </div>
        </div>
      ))}
    </div>
  );
}

function HeroBlock({
  añosEliminados,
  ahorroTotal,
  cuotasEliminadas,
}: {
  añosEliminados: number;
  ahorroTotal: number;
  cuotasEliminadas: number;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          position: "relative",
          background: `linear-gradient(135deg, ${C.negro} 0%, #1a1a1a 100%)`,
          color: "#fff",
          padding: "28px 30px 30px 30px",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        {/* línea dorada lateral */}
        <div
          style={{
            position: "absolute",
            left: 0, top: 0, bottom: 0,
            width: 4,
            background: C.goldLine,
          }}
        />
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: C.goldLine,
          }}
        >
          Resultado de tu diagnóstico
        </div>

        {/* Bloque superior: años eliminados */}
        <div style={{ marginTop: 10 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "#fff",
              opacity: 0.78,
              letterSpacing: "0.06em",
            }}
          >
            Podrías eliminar
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 900,
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              marginTop: 2,
              color: "#fff",
            }}
          >
            {formatNumber(añosEliminados, 1)}
            <span style={{ fontSize: 24, fontWeight: 700, marginLeft: 8, color: C.verde }}>
              años
            </span>
          </div>
        </div>

        {/* Separador */}
        <div
          style={{
            marginTop: 18,
            height: 1,
            background: "rgba(255,255,255,0.14)",
          }}
        />

        {/* AHORRO TOTAL — PROTAGONISTA del PDF */}
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: C.goldLine,
            }}
          >
            Ahorro total proyectado
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 900,
              color: C.verde,
              lineHeight: 1,
              marginTop: 6,
              letterSpacing: "-0.035em",
              textShadow: "0 2px 18px rgba(132,185,143,0.35)",
            }}
          >
            {formatCOP(ahorroTotal)}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: "#fff",
              opacity: 0.72,
              marginTop: 6,
            }}
          >
            sobre el costo total proyectado de tu crédito
          </div>
        </div>
      </div>

      {/* SELLO PREMIUM — X CUOTAS MENOS */}
      {cuotasEliminadas > 0 && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              background: C.verde,
              color: "#fff",
              padding: "10px 22px",
              borderRadius: 999,
              border: `2px solid ${C.verdeOscuro}`,
              boxShadow: "0 6px 18px rgba(132,185,143,0.35)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 900 }}>✦</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 900,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {formatNumber(cuotasEliminadas, 0)} cuotas menos
            </span>
            <span style={{ fontSize: 14, fontWeight: 900 }}>✦</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BeforeAfterChart({
  añosActual,
  añosOpt,
  pctActual,
  pctOpt,
  añosEliminados,
}: {
  añosActual: number;
  añosOpt: number;
  pctActual: number;
  pctOpt: number;
  añosEliminados: number;
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle eyebrow="Comparativo" title="Tiempo de su crédito" />

      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center" }}>
        <div>
          {/* ANTES */}
          <BarRow
            label="ANTES"
            sub="Escenario actual"
            value={`${formatNumber(añosActual, 1)} años`}
            pct={pctActual}
            color={C.negro}
            track="#EFEFEF"
          />
          <div style={{ height: 10 }} />
          {/* DESPUÉS */}
          <BarRow
            label="DESPUÉS"
            sub="Con NUVEX"
            value={`${formatNumber(añosOpt, 1)} años`}
            pct={pctOpt}
            color={C.verde}
            track="#EFEFEF"
          />
        </div>

        <div
          style={{
            background: C.verdeClaro,
            border: `1.5px solid ${C.verde}`,
            borderRadius: 4,
            padding: "14px 18px",
            textAlign: "center",
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontSize: 7.5,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: C.verdeOscuro,
              lineHeight: 1.3,
            }}
          >
            Libertad financiera
            <br />anticipada
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: C.verdeOscuro,
              lineHeight: 1,
              marginTop: 8,
              letterSpacing: "-0.025em",
            }}
          >
            {formatNumber(añosEliminados, 1)}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: C.verdeOscuro,
              marginTop: 3,
              letterSpacing: "0.04em",
            }}
          >
            años antes
          </div>
        </div>
      </div>
    </div>
  );
}

function BarRow({
  label, sub, value, pct, color, track,
}: {
  label: string; sub: string; value: string; pct: number; color: string; track: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <div>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", color: color }}>
            {label}
          </span>
          <span style={{ fontSize: 9, color: C.muted, marginLeft: 8 }}>{sub}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: color }}>{value}</span>
      </div>
      <div style={{ height: 12, background: track, borderRadius: 2, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(2, Math.min(100, pct))}%`,
            height: "100%",
            background: color,
          }}
        />
      </div>
    </div>
  );
}

function SavingsDashboard({
  ahorroIntereses, ahorroSeguros, ahorroTotal, mode,
}: {
  ahorroIntereses: number; ahorroSeguros: number; ahorroTotal: number; mode: "pesos" | "uvr";
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <SectionTitle eyebrow="Dashboard ejecutivo" title="Composición del ahorro proyectado" />

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 2fr",
          gap: 10,
        }}
      >
        <KpiCard
          label={mode === "uvr" ? "Ahorro intereses + CM" : "Ahorro en intereses"}
          value={formatCOP(ahorroIntereses)}
        />
        <KpiCard label="Ahorro en seguros" value={formatCOP(ahorroSeguros)} />
        <KpiCard
          label="Ahorro total proyectado"
          value={formatCOP(ahorroTotal)}
          premium
        />
      </div>
    </div>
  );
}

function KpiCard({
  label, value, premium,
}: { label: string; value: string; premium?: boolean }) {
  if (premium) {
    return (
      <div
        style={{
          background: `linear-gradient(135deg, ${C.verde} 0%, #6FA978 100%)`,
          color: "#fff",
          borderRadius: 4,
          padding: "16px 20px",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 14px rgba(132,185,143,0.25)",
        }}
      >
        <div
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 3, background: C.goldLine,
          }}
        />
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            opacity: 0.95,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            marginTop: 8,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderTop: `2px solid ${C.azul}`,
        borderRadius: 4,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: C.azul,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: C.negro,
          marginTop: 8,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SituationVsOptimized({
  scenario, vsA, vsO,
}: {
  scenario: Props["scenario"];
  vsA: { bg: string; color: string };
  vsO: { bg: string; color: string };
}) {
  const rows: { c: string; a: string; o: string; highlight?: boolean }[] = [
    { c: "Cuota mensual", a: formatCOP(scenario.cuotaActual), o: formatCOP(scenario.nuevaCuota) },
    {
      c: "Años por pagar",
      a: `${formatNumber(scenario.plazoActual / 12, 1)} años`,
      o: `${formatNumber(scenario.nuevoPlazo / 12, 1)} años`,
    },
    {
      c: "Plazo restante",
      a: `${scenario.plazoActual} meses`,
      o: `${scenario.nuevoPlazo} meses`,
    },
    {
      c: "Total proyectado a pagar",
      a: formatCOP(scenario.totalActual),
      o: formatCOP(scenario.totalOptimizado),
      highlight: true,
    },
  ];
  return (
    <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14 }}>
      {/* Tabla minimal */}
      <div>
        <SectionTitle eyebrow="Diagnóstico" title="Situación actual vs optimizada" />
        <div
          style={{
            marginTop: 10,
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr",
              background: C.negro,
              color: "#fff",
              fontSize: 8.5,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            <div style={{ padding: "8px 12px" }}>Concepto</div>
            <div style={{ padding: "8px 12px", textAlign: "center" }}>Actual</div>
            <div
              style={{
                padding: "8px 12px",
                textAlign: "center",
                background: C.verde,
                color: "#fff",
              }}
            >
              Optimizado
            </div>
          </div>
          {rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr",
                borderTop: `1px solid ${C.line}`,
                background: i % 2 === 0 ? C.paper : C.cream,
              }}
            >
              <div
                style={{
                  padding: "9px 12px",
                  fontSize: 10,
                  fontWeight: 600,
                  color: C.negro,
                }}
              >
                {r.c}
              </div>
              <div
                style={{
                  padding: "9px 12px",
                  fontSize: r.highlight ? 11 : 10.5,
                  fontWeight: r.highlight ? 800 : 600,
                  color: C.negro,
                  textAlign: "center",
                }}
              >
                {r.a}
              </div>
              <div
                style={{
                  padding: "9px 12px",
                  fontSize: r.highlight ? 11 : 10.5,
                  fontWeight: r.highlight ? 800 : 700,
                  color: C.verdeOscuro,
                  background: r.highlight ? C.verdeClaro : "transparent",
                  textAlign: "center",
                }}
              >
                {r.o}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Semáforo veces pagado */}
      <div>
        <SectionTitle eyebrow="Indicador clave" title="N° de veces pagado" />
        <div
          style={{
            marginTop: 10,
            border: `1px solid ${C.line}`,
            borderRadius: 4,
            padding: "14px 14px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <VecesPill
              label="Condición actual"
              value={scenario.vecesActual}
              style={vsA}
            />
            <VecesPill
              label="Condición optimizada"
              value={scenario.vecesOptimizado}
              style={vsO}
            />
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 9,
              color: C.muted,
              lineHeight: 1.5,
            }}
          >
            Este indicador muestra cuántas veces terminaría pagando el saldo actual
            del crédito. Mientras más alto, mayor el costo financiero acumulado.
          </div>
        </div>
      </div>
    </div>
  );
}

function VecesPill({
  label, value, style,
}: { label: string; value: number; style: { bg: string; color: string } }) {
  return (
    <div
      style={{
        background: style.bg,
        border: `1.5px solid ${style.color}`,
        borderRadius: 4,
        padding: "10px 10px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: style.color,
          opacity: 0.95,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: style.color,
          marginTop: 4,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {formatNumber(value, 2)}
        <span style={{ fontSize: 14, marginLeft: 2 }}>x</span>
      </div>
    </div>
  );
}

/* ============================================================
   PÁGINA 2 — Bloques
============================================================ */

function PremiumKpiGrid({
  mode, recommended, scenario,
}: {
  mode: "pesos" | "uvr";
  recommended: Props["recommended"];
  scenario: Props["scenario"];
}) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
        }}
      >
        <MiniKpi label="Nueva cuota" value={formatCOP(recommended.nuevaCuota)} />
        <MiniKpi
          label="Años eliminados"
          value={`${formatNumber(recommended.añosEliminados, 0)}`}
          suffix="años"
        />
        <MiniKpi
          label="Nuevo plazo"
          value={`${scenario.nuevoPlazo}`}
          suffix="meses"
        />
      </div>

      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 2fr",
          gap: 10,
        }}
      >
        <MiniKpi
          label={mode === "uvr" ? "Ahorro intereses + CM" : "Ahorro en intereses"}
          value={formatCOP(recommended.ahorroIntereses)}
          accent="azul"
        />
        <MiniKpi
          label="Ahorro en seguros"
          value={formatCOP(recommended.ahorroSeguros)}
          accent="azul"
        />
        <PremiumTotalCard value={formatCOP(recommended.ahorroTotal)} />
      </div>
    </div>
  );
}

function MiniKpi({
  label, value, suffix, accent = "negro",
}: { label: string; value: string; suffix?: string; accent?: "negro" | "azul" }) {
  const borderColor = accent === "azul" ? C.azul : C.negro;
  return (
    <div
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderTop: `2px solid ${borderColor}`,
        borderRadius: 4,
        padding: "12px 14px",
      }}
    >
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: borderColor,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: C.negro,
          marginTop: 6,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
        }}
      >
        {value}
        {suffix && (
          <span style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginLeft: 4 }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function PremiumTotalCard({ value }: { value: string }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${C.negro} 0%, #1a1a1a 100%)`,
        color: "#fff",
        borderRadius: 4,
        padding: "14px 18px",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 3, background: C.goldLine,
        }}
      />
      <div>
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.24em",
            textTransform: "uppercase",
            color: C.goldLine,
          }}
        >
          Ahorro total estimado
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#fff",
            opacity: 0.7,
            marginTop: 2,
          }}
        >
          Sobre el costo financiero proyectado
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: C.verde,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BenefitsBlock({ añosEliminados }: { añosEliminados: number }) {
  const benefits = [
    `Elimina ${formatNumber(añosEliminados, 0)} años de su crédito`,
    "Disminuye intereses futuros",
    "Evita seguros futuros innecesarios",
    "Finaliza antes su obligación financiera",
    "Mejora su patrimonio familiar",
    "Recupera capacidad financiera",
  ];
  return (
    <div style={{ marginTop: 18 }}>
      <SectionTitle eyebrow="Impacto patrimonial" title="¿Qué representa esta optimización?" />
      <div
        style={{
          marginTop: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        {benefits.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              border: `1px solid ${C.line}`,
              borderRadius: 4,
              padding: "9px 12px",
              background: C.paper,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: C.verde,
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ fontSize: 10.5, color: C.negro, fontWeight: 500 }}>{b}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HonorariosBlock({
  honorarios, commercial,
}: { honorarios: number; commercial?: CommercialBenefit }) {
  const hasDiscount = !!(commercial && commercial.hasDiscount && commercial.descuento > 0);
  const base = hasDiscount ? commercial!.honorariosBase : honorarios;
  const finales = hasDiscount ? commercial!.finales : honorarios;
  const descuento = hasDiscount ? commercial!.descuento : 0;

  return (
    <div style={{ marginTop: 18 }}>
      <SectionTitle eyebrow="Inversión" title="Honorarios NUVEX a éxito" />

      <div
        style={{
          marginTop: 10,
          border: `1px solid ${C.line}`,
          borderRadius: 4,
          background: C.cream,
          padding: "16px 18px",
        }}
      >
        {hasDiscount ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr auto 1.3fr",
              alignItems: "center",
              gap: 10,
            }}
          >
            <FlowItem label="Honorarios originales" value={formatCOP(base)} strike />
            <FlowArrow />
            <FlowItem label="Descuento especial" value={`− ${formatCOP(descuento)}`} accent={C.azul} />
            <FlowArrow />
            <FlowItem label="Honorarios finales" value={formatCOP(finales)} highlight />
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: C.azul,
                }}
              >
                Honorarios totales a éxito
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: C.negro,
                  opacity: 0.75,
                  marginTop: 4,
                  lineHeight: 1.5,
                }}
              >
                Solo se generan si el proceso es aprobado favorablemente por el banco.
                No hay cobros anticipados ni costos ocultos.
              </div>
            </div>
            <div
              style={{
                background: C.negro,
                color: "#fff",
                padding: "14px 22px",
                borderLeft: `3px solid ${C.goldLine}`,
                textAlign: "right",
                minWidth: 200,
              }}
            >
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.2em", color: C.goldLine }}>
                INVERSIÓN
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  marginTop: 4,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {formatCOP(finales)}
              </div>
            </div>
          </div>
        )}

        {hasDiscount && (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: C.negro,
                fontWeight: 600,
                fontStyle: "italic",
              }}
            >
              Beneficio especial autorizado por pronta firma.
            </div>
            {commercial?.vigencia && (
              <div
                style={{
                  display: "inline-block",
                  background: C.negro,
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "5px 12px",
                  borderRadius: 999,
                  letterSpacing: "0.08em",
                }}
              >
                Válido hasta: {commercial.vigencia}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px solid ${C.line}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 10,
          }}
        >
          {[
            "Contrato a éxito",
            "Solo cobramos si obtenemos resultado favorable",
            "Sin riesgo financiero para el cliente",
          ].map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 9.5,
                color: C.negro,
                fontWeight: 600,
                background: C.verdeClaro,
                border: `1px solid ${C.verde}`,
                borderRadius: 4,
                padding: "8px 10px",
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: C.verde,
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              <span style={{ lineHeight: 1.3 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FlowItem({
  label, value, strike, accent, highlight,
}: { label: string; value: string; strike?: boolean; accent?: string; highlight?: boolean }) {
  if (highlight) {
    return (
      <div
        style={{
          background: C.negro,
          color: "#fff",
          padding: "12px 14px",
          borderLeft: `3px solid ${C.goldLine}`,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", color: C.goldLine }}>
          {label.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: C.verde,
            marginTop: 4,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </div>
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 7.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: C.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: accent ?? C.negro,
          marginTop: 4,
          textDecoration: strike ? "line-through" : "none",
          opacity: strike ? 0.6 : 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div style={{ color: C.muted, fontSize: 16, fontWeight: 700, textAlign: "center" }}>
      →
    </div>
  );
}

function ClosingBlock({
  añosEliminados: _añosEliminados, ahorroTotal: _ahorroTotal,
}: { añosEliminados: number; ahorroTotal: number }) {
  const razones = [
    "Especialistas en Ley 546 de 1999",
    "Ex directivos del sector financiero",
    "Contrato a éxito · cero riesgo",
    "Más de 10 años de experiencia",
    "Solo cobramos con resultado favorable",
  ];
  return (
    <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1.15fr", gap: 14 }}>
      {/* ¿POR QUÉ NUVEX? + PRUEBA SOCIAL */}
      <div
        style={{
          border: `1px solid ${C.line}`,
          borderTop: `2px solid ${C.azul}`,
          background: C.paper,
          padding: "14px 16px",
          borderRadius: 4,
        }}
      >
        <div
          style={{
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: C.azul,
          }}
        >
          ¿Por qué NUVEX?
        </div>
        <ul
          style={{
            marginTop: 8,
            fontSize: 10,
            color: C.negro,
            lineHeight: 1.7,
            listStyle: "none",
            padding: 0,
          }}
        >
          {razones.map((r, i) => (
            <li key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ color: C.verde, fontWeight: 900 }}>✓</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>

        {/* Prueba social discreta */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px dashed ${C.line}`,
            fontSize: 9,
            color: C.muted,
            lineHeight: 1.5,
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          Más de <b style={{ color: C.negro, fontStyle: "normal" }}>1.000 familias</b> han
          optimizado su crédito con NUVEX.
        </div>
      </div>

      {/* MENSAJE PERSONAL — sin título, tipo carta */}
      <div
        style={{
          background: `linear-gradient(135deg, ${C.cream} 0%, #fff 100%)`,
          border: `1px solid ${C.goldLine}`,
          padding: "20px 22px",
          borderRadius: 4,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: 3, background: C.goldLine,
          }}
        />
        <p
          style={{
            fontSize: 10.5,
            color: C.negro,
            lineHeight: 1.85,
            margin: 0,
          }}
        >
          Nuestro análisis evidencia una oportunidad real para reducir
          significativamente el tiempo de tu crédito y disminuir el costo
          financiero proyectado.
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: C.negro,
            lineHeight: 1.85,
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          Cada año eliminado representa más tranquilidad, mayor liquidez y más
          patrimonio para tu familia.
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: C.negro,
            lineHeight: 1.85,
            marginTop: 10,
            marginBottom: 0,
          }}
        >
          Con esta estrategia financiera no solo finalizas antes tu obligación,
          también recuperas años valiosos que hoy estarían destinados al pago de
          intereses y seguros futuros.
        </p>
        <p
          style={{
            fontSize: 10.5,
            color: C.negro,
            lineHeight: 1.85,
            marginTop: 12,
            marginBottom: 0,
            fontWeight: 600,
          }}
        >
          Gracias por confiar en <b>NUVEX Finanzas Inteligentes</b>.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   Section title
============================================================ */
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: C.azul,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: C.negro,
          marginTop: 2,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
    </div>
  );
}
