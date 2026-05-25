import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import { PdfWatermark } from "./pdf/PdfWatermark";
import logoNuvex from "@/assets/logo-nuvex.png";
import heroSunset from "@/assets/nuvex-hero-sunset.jpg";
import quoteRoom from "@/assets/nuvex-quote-livingroom.jpg";

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
   PALETA — V4 (diseño referencia institucional)
============================================================ */
const C = {
  ink: NUVEX.negro,
  azul: "#1F3A8A",         // Azul profundo del hero
  azulMid: "#2E4DA8",
  azulSoft: "#EAF0FB",
  azulSoft2: "#F4F7FD",
  azulLink: "#2E5BD8",
  verde: "#5CA875",
  verdeSoft: "#E6F2EA",
  verdeDeep: "#3F8C57",
  muted: "#6B7280",
  graphite: "#3F4654",
  hairline: "#E5E9EF",
  paper: "#FFFFFF",
};

/* ============================================================
   PRINT DOCUMENT — 2 páginas A4 (rediseño 2026)
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
  const añoHoy = fechaBase.getFullYear();
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
      <PageShell pagina={1} fecha={fecha} documento="PROPUESTA FINANCIERA PERSONALIZADA">
        {/* HERO BLOQUE AZUL con imagen a la derecha */}
        <div
          style={{
            position: "relative",
            background: `linear-gradient(135deg, ${C.azul} 0%, ${C.azulMid} 100%)`,
            borderRadius: 4,
            overflow: "hidden",
            color: "#fff",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            minHeight: 360,
          }}
        >
          {/* Lado izquierdo: textos */}
          <div style={{ padding: "30px 32px", position: "relative", zIndex: 2 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.22em",
              color: C.verde, textTransform: "uppercase",
            }}>
              Propuesta preparada para
            </div>
            <div style={{
              marginTop: 6, fontSize: 13, fontWeight: 700,
              color: "#fff", letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}>
              {client.nombre || "—"}
            </div>

            <h1 style={{
              margin: "26px 0 0 0",
              fontSize: 48, fontWeight: 900,
              lineHeight: 0.95, letterSpacing: "-0.03em",
              textTransform: "uppercase",
            }}>
              <div style={{ color: "#fff" }}>Recupera</div>
              <div style={{ color: C.verde }}>
                {formatNumber(añosEliminados, 0)} años
              </div>
              <div style={{ color: "#fff" }}>de tu vida</div>
              <div style={{ color: "#fff" }}>financiera</div>
            </h1>

            <p style={{
              marginTop: 18, fontSize: 9.5, lineHeight: 1.55,
              color: "rgba(255,255,255,0.88)", maxWidth: 280,
            }}>
              Nuestro análisis financiero muestra una oportunidad real para
              finalizar tu crédito antes de lo previsto, reduciendo significativamente
              intereses futuros y el tiempo de endeudamiento.
            </p>
          </div>

          {/* Lado derecho: imagen */}
          <div style={{ position: "relative", overflow: "hidden" }}>
            <img
              src={heroSunset}
              alt=""
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%",
                objectFit: "cover",
              }}
              crossOrigin="anonymous"
            />
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(90deg, ${C.azul} 0%, rgba(31,58,138,0.6) 25%, rgba(31,58,138,0) 60%)`,
            }} />
          </div>

          {/* TARJETA BLANCA flotante — AHORRO TOTAL + KPIs */}
          <div style={{
            position: "absolute",
            top: 28, right: 22, width: "52%",
            background: "#fff",
            borderRadius: 14,
            padding: "22px 24px",
            boxShadow: "0 18px 40px -16px rgba(0,0,0,0.35)",
            zIndex: 3,
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                fontSize: 8.5, fontWeight: 700, letterSpacing: "0.28em",
                color: C.azul, textTransform: "uppercase",
              }}>
                Ahorro total proyectado
              </div>
              <div style={{
                marginTop: 8, fontSize: 38, fontWeight: 800,
                color: C.azul, letterSpacing: "-0.035em", lineHeight: 1,
              }}>
                {formatCOP(recommended.ahorroTotal)}
              </div>
              <div style={{
                marginTop: 6, fontSize: 9, color: C.muted, fontStyle: "italic",
              }}>
                Lo que dejas de pagar al optimizar tu crédito.
              </div>
            </div>

            <div style={{
              marginTop: 18, display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
            }}>
              <KpiCard
                tint={C.verdeSoft} icon="📅"
                value={formatNumber(añosEliminados, 1)}
                label="Años eliminados"
                color={C.verdeDeep}
              />
              <KpiCard
                tint={C.azulSoft} icon="📅"
                value={formatNumber(cuotasEliminadas, 0)}
                label="Cuotas eliminadas"
                color={C.azul}
              />
              <KpiCard
                tint={C.verdeSoft} icon="$"
                value={formatCOP(recommended.nuevaCuota)}
                label="Nueva cuota proyectada"
                color={C.verdeDeep}
                small
              />
            </div>
          </div>
        </div>

        {/* TIMELINE: TU TIEMPO HOY VS. CON NUVEX */}
        <Timeline
          añosActual={añosActual}
          añosOpt={añosOpt}
          añosEliminados={añosEliminados}
          añoHoy={añoHoy}
          añoFinActual={añoFinActual}
          añoFinOpt={añoFinOpt}
        />

        {/* BENEFICIOS — franja azul suave */}
        <Beneficios />
      </PageShell>

      {/* ============== PÁGINA 2 ============== */}
      <PageShell
        pagina={2}
        fecha={fecha}
        documento="PROPUESTA FINANCIERA PERSONALIZADA"
        breakBefore
      >
        {/* Título */}
        <div>
          <h2 style={{
            margin: 0, fontSize: 28, fontWeight: 800,
            letterSpacing: "-0.025em", textTransform: "uppercase",
            color: C.ink,
          }}>
            Propuesta <span style={{ color: C.azulLink }}>recomendada</span>
          </h2>
          <p style={{
            marginTop: 6, fontSize: 10, color: C.muted,
          }}>
            Escenario financiero proyectado según el análisis realizado.
          </p>
        </div>

        {/* GRID: tabla comparativa (izq) + donut (der) */}
        <div style={{
          marginTop: 16, display: "grid",
          gridTemplateColumns: "1.15fr 1fr", gap: 16,
          alignItems: "start",
        }}>
          <ComparativoTable
            scenario={scenario}
            recommended={recommended}
            añosActual={añosActual}
            añosOpt={añosOpt}
          />
          <ComposicionAhorro
            ahorroIntereses={recommended.ahorroIntereses}
            ahorroSeguros={recommended.ahorroSeguros}
            ahorroTotal={recommended.ahorroTotal}
          />
        </div>

        {/* GRID: inversión por éxito (izq) + cita (der) */}
        <div style={{
          marginTop: 16, display: "grid",
          gridTemplateColumns: "0.85fr 1.3fr", gap: 16,
          alignItems: "stretch",
        }}>
          <InversionPorExito
            honorarios={honorariosFinales}
            commercial={commercial}
          />
          <ClosingQuote />
        </div>
      </PageShell>
    </div>
  );
}

/* ============================================================
   PAGE SHELL — header blanco + footer azul
============================================================ */
function PageShell({
  children, pagina, fecha, documento, breakBefore,
}: {
  children: React.ReactNode;
  pagina: number;
  fecha: string;
  documento: string;
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
      <PdfWatermark />

      {/* HEADER BLANCO INSTITUCIONAL */}
      <div style={{
        position: "relative", zIndex: 1,
        padding: "12mm 14mm 8mm 14mm",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src={logoNuvex} alt="NUVEX"
            style={{ height: 36, width: "auto", display: "block" }}
            crossOrigin="anonymous"
          />
          <div>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: "0.22em",
              color: C.ink,
            }}>
              NUVEX
            </div>
            <div style={{
              fontSize: 7, fontWeight: 700, letterSpacing: "0.22em",
              color: C.muted, marginTop: 1,
            }}>
              FINANZAS INTELIGENTES
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.18em",
            color: C.ink,
          }}>
            {documento}
          </div>
          <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
            {fecha}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{
        flex: 1,
        padding: "4mm 14mm 8mm 14mm",
        display: "flex", flexDirection: "column",
        position: "relative", zIndex: 1,
      }}>
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
  if (pagina === 1) {
    return (
      <div data-pdf-footer="true" style={{
        background: C.azul, color: "#fff",
        padding: "10px 14mm",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        fontSize: 9, letterSpacing: "0.06em",
      }}>
        <div>
          <span style={{ fontWeight: 800, letterSpacing: "0.18em" }}>NUVEX</span>{" "}
          <span style={{ color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
            FINANZAS INTELIGENTES
          </span>{" "}
          <span style={{ color: "rgba(255,255,255,0.55)" }}>·</span>{" "}
          <span style={{ color: "rgba(255,255,255,0.9)" }}>{CORPORATIVO.web.toUpperCase()}</span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.85)" }}>{pagina} / 2</div>
      </div>
    );
  }
  return (
    <div data-pdf-footer="true" style={{
      background: C.azul, color: "#fff",
      padding: "10px 14mm",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontSize: 9,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src={logoNuvex} alt=""
          style={{
            height: 22, width: "auto",
            filter: "brightness(0) invert(1)",
          }}
          crossOrigin="anonymous"
        />
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em" }}>NUVEX</div>
          <div style={{ fontSize: 6.5, color: "rgba(255,255,255,0.7)", letterSpacing: "0.2em" }}>
            FINANZAS INTELIGENTES
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 24, fontSize: 8.5, color: "rgba(255,255,255,0.92)" }}>
        <span>🌐 {CORPORATIVO.web}</span>
        <span>📞 {CORPORATIVO.telefono}</span>
        <span>✉ contacto@nuvex.com.co</span>
      </div>
      <div style={{ color: "rgba(255,255,255,0.85)" }}>{pagina} / 2</div>
    </div>
  );
}

/* ============================================================
   KPI CARD — versión compacta dentro de la tarjeta hero
============================================================ */
function KpiCard({
  tint, icon, value, label, color, small,
}: { tint: string; icon: string; value: string; label: string; color: string; small?: boolean }) {
  return (
    <div style={{ textAlign: "center", padding: "4px 2px" }}>
      <div style={{
        width: 32, height: 32, borderRadius: 999,
        background: tint, color, margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700,
      }}>
        {icon}
      </div>
      <div style={{
        marginTop: 6, fontSize: small ? 12 : 18, fontWeight: 800,
        color, letterSpacing: "-0.02em", lineHeight: 1.05,
      }}>
        {value}
      </div>
      <div style={{
        marginTop: 4, fontSize: 6.5, fontWeight: 700, letterSpacing: "0.18em",
        color: C.muted, textTransform: "uppercase", lineHeight: 1.25,
      }}>
        {label}
      </div>
    </div>
  );
}

/* ============================================================
   TIMELINE — TU TIEMPO HOY VS. CON NUVEX
============================================================ */
function Timeline({
  añosActual, añosOpt, añosEliminados, añoHoy, añoFinActual, añoFinOpt,
}: {
  añosActual: number; añosOpt: number; añosEliminados: number;
  añoHoy: number; añoFinActual: number; añoFinOpt: number;
}) {
  const maxA = Math.max(añosActual, 1);
  const pctOpt = Math.max(15, (añosOpt / maxA) * 100);

  return (
    <div style={{
      marginTop: 18, padding: "16px 18px",
      borderRadius: 6,
    }}>
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 110px", gap: 18, alignItems: "center" }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
            color: C.azul, textTransform: "uppercase",
          }}>
            Tu tiempo hoy
          </div>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: "0.12em",
            color: C.azul, textTransform: "uppercase",
          }}>
            vs. <span style={{ color: C.verde }}>con NUVEX</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <TimelineRow
            label="SITUACIÓN ACTUAL"
            yearStart={añoHoy} yearEnd={añoFinActual}
            years={añosActual} widthPct={100} color={C.azul} pillBg={C.azulSoft} pillColor={C.azul}
          />
          <TimelineRow
            label="CON NUVEX"
            yearStart={añoHoy} yearEnd={añoFinOpt}
            years={añosOpt} widthPct={pctOpt} color={C.verde} pillBg={C.verdeSoft} pillColor={C.verdeDeep}
          />
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 22, fontWeight: 900, color: C.verde,
            letterSpacing: "-0.02em", lineHeight: 1,
          }}>
            {formatNumber(añosEliminados, 0)} AÑOS
          </div>
          <div style={{
            fontSize: 11, fontWeight: 800, color: C.verde,
            letterSpacing: "0.06em", marginTop: 2,
          }}>
            RECUPERADOS
          </div>
          <div style={{
            marginTop: 4, fontSize: 7.5, color: C.muted, lineHeight: 1.35,
          }}>
            Más tiempo para lo<br />que realmente importa.
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  label, yearStart, yearEnd, years, widthPct, color, pillBg, pillColor,
}: {
  label: string; yearStart: number; yearEnd: number;
  years: number; widthPct: number; color: string;
  pillBg: string; pillColor: string;
}) {
  return (
    <div>
      <div style={{
        fontSize: 7.5, fontWeight: 800, letterSpacing: "0.22em",
        color, textTransform: "uppercase", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color, width: 32 }}>
          {yearStart}
        </div>
        <div style={{ flex: 1, position: "relative", height: 4 }}>
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%",
            height: 2, background: "#E1E6EF", transform: "translateY(-50%)",
          }} />
          <div style={{
            position: "absolute", left: 0, top: "50%",
            width: `${widthPct}%`, height: 3, background: color,
            transform: "translateY(-50%)", borderRadius: 2,
          }} />
          {/* Dot start */}
          <div style={{
            position: "absolute", left: -3, top: "50%",
            width: 9, height: 9, borderRadius: 999, background: color,
            transform: "translateY(-50%)",
          }} />
          {/* Dot end */}
          <div style={{
            position: "absolute", left: `calc(${widthPct}% - 5px)`, top: "50%",
            width: 10, height: 10, borderRadius: 999, background: color,
            transform: "translateY(-50%)",
            boxShadow: `0 0 0 3px ${color}33`,
          }} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color, width: 36, textAlign: "right" }}>
          {yearEnd}
        </div>
        <div style={{
          fontSize: 9, fontWeight: 700, color: pillColor,
          background: pillBg, padding: "3px 10px", borderRadius: 999,
          minWidth: 60, textAlign: "center",
        }}>
          {formatNumber(years, 1)} años
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   BENEFICIOS — franja azul claro con 4 ítems
============================================================ */
function Beneficios() {
  const items = [
    { icon: "🛡", l1: "Menos tiempo", l2: "de deuda" },
    { icon: "$", l1: "Menos", l2: "intereses futuros" },
    { icon: "☂", l1: "Menos seguros", l2: "futuros" },
    { icon: "👥", l1: "Más patrimonio", l2: "para tu familia" },
  ];
  return (
    <div style={{
      marginTop: 14,
      background: C.azulSoft2,
      borderRadius: 8,
      padding: "14px 18px",
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr",
      gap: 12,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          justifyContent: "center",
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 999,
            background: "#fff", border: `1px solid ${C.azulSoft}`,
            color: C.azul, fontSize: 13, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {it.icon}
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 9.5, color: C.graphite }}>{it.l1}</div>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: C.ink }}>{it.l2}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   PÁGINA 2 — TABLA COMPARATIVA
============================================================ */
function ComparativoTable({
  scenario, recommended, añosActual, añosOpt,
}: {
  scenario: Props["scenario"];
  recommended: Props["recommended"];
  añosActual: number;
  añosOpt: number;
}) {
  const rows = [
    { icon: "$", label: "Cuota mensual",
      hoy: formatCOP(scenario.cuotaActual), nuvex: formatCOP(recommended.nuevaCuota) },
    { icon: "📅", label: "Tiempo restante",
      hoy: `${formatNumber(añosActual, 1)} años`, nuvex: `${formatNumber(añosOpt, 1)} años` },
    { icon: "📊", label: "Total proyectado", sub: "a pagar",
      hoy: formatCOP(scenario.totalActual), nuvex: formatCOP(scenario.totalOptimizado) },
    { icon: "📈", label: "Nº de veces pagado", sub: "el crédito",
      hoy: `${formatNumber(scenario.vecesActual, 2)} veces`,
      nuvex: `${formatNumber(scenario.vecesOptimizado, 2)} veces` },
  ];

  return (
    <div style={{
      border: `1px solid ${C.hairline}`,
      borderRadius: 6,
      overflow: "hidden",
      background: "#fff",
    }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr" }}>
        <div style={{ background: "#fff" }} />
        <div style={{
          background: C.azul, color: "#fff",
          padding: "10px 12px", textAlign: "center",
          fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
        }}>HOY</div>
        <div style={{
          background: C.verde, color: "#fff",
          padding: "10px 12px", textAlign: "center",
          fontSize: 11, fontWeight: 800, letterSpacing: "0.16em",
        }}>CON NUVEX</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr",
          borderTop: `1px solid ${C.hairline}`,
          alignItems: "center",
          minHeight: 50,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999,
              background: C.azulSoft, color: C.azul,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700,
            }}>{r.icon}</div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontSize: 10, color: C.graphite, fontWeight: 600 }}>{r.label}</div>
              {r.sub && <div style={{ fontSize: 9, color: C.muted }}>{r.sub}</div>}
            </div>
          </div>
          <div style={{
            textAlign: "center", fontSize: 12, fontWeight: 700, color: C.ink,
          }}>{r.hoy}</div>
          <div style={{
            textAlign: "center", fontSize: 12, fontWeight: 700, color: C.verdeDeep,
          }}>{r.nuvex}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   COMPOSICIÓN DEL AHORRO — DONUT con leyenda
============================================================ */
function ComposicionAhorro({
  ahorroIntereses, ahorroSeguros, ahorroTotal,
}: { ahorroIntereses: number; ahorroSeguros: number; ahorroTotal: number }) {
  const total = Math.max(1, ahorroIntereses + ahorroSeguros);
  const pctInt = (ahorroIntereses / total) * 100;
  const pctSeg = 100 - pctInt;

  const size = 110;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dashInt = (pctInt / 100) * circ;
  const dashSeg = (pctSeg / 100) * circ;

  return (
    <div style={{
      border: `1px solid ${C.hairline}`,
      borderRadius: 6,
      overflow: "hidden",
      background: "#fff",
    }}>
      <div style={{
        textAlign: "center", padding: "10px",
        fontSize: 10, fontWeight: 800, letterSpacing: "0.22em",
        color: C.azul, textTransform: "uppercase",
      }}>
        Composición del ahorro
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "auto 1fr",
        gap: 14, alignItems: "center",
        padding: "4px 16px 14px 16px",
      }}>
        <div style={{ position: "relative", width: size, height: size }}>
          <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F2F4F8" strokeWidth={stroke} />
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={C.azul} strokeWidth={stroke}
              strokeDasharray={`${dashInt} ${circ - dashInt}`} />
            <circle cx={cx} cy={cy} r={r} fill="none"
              stroke={C.verde} strokeWidth={stroke}
              strokeDasharray={`${dashSeg} ${circ - dashSeg}`}
              strokeDashoffset={-dashInt} />
          </svg>
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, color: C.ink, letterSpacing: "0.16em",
          }}>TOTAL</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <LegendRow color={C.azul} label="Ahorro en intereses" value={ahorroIntereses} pct={pctInt} />
          <LegendRow color={C.verde} label="Ahorro en seguros" value={ahorroSeguros} pct={pctSeg} />
        </div>
      </div>

      <div style={{
        background: C.azul, color: "#fff",
        padding: "14px 16px", textAlign: "center",
      }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: "0.22em",
        }}>AHORRO TOTAL</div>
        <div style={{
          marginTop: 4, fontSize: 26, fontWeight: 800, letterSpacing: "-0.025em",
        }}>{formatCOP(ahorroTotal)}</div>
      </div>
    </div>
  );
}

function LegendRow({ color, label, value, pct }:
  { color: string; label: string; value: number; pct: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, color: C.graphite, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 1 }}>
          {formatCOP(value)}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>
        {formatNumber(pct, 0)}%
      </div>
    </div>
  );
}

/* ============================================================
   INVERSIÓN POR ÉXITO
============================================================ */
function InversionPorExito({
  honorarios, commercial,
}: { honorarios: number; commercial?: CommercialBenefit }) {
  return (
    <div style={{
      background: C.azulSoft2,
      borderRadius: 6,
      padding: "18px 18px",
      border: `1px solid ${C.azulSoft}`,
      textAlign: "center",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 999,
        background: "#fff", border: `1px solid ${C.azulSoft}`,
        margin: "0 auto",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.azul, fontSize: 18,
      }}>🛡</div>
      <div style={{
        marginTop: 8, fontSize: 10, fontWeight: 800, letterSpacing: "0.22em",
        color: C.azul, textTransform: "uppercase",
      }}>
        Inversión por éxito
      </div>
      {commercial?.hasDiscount && (
        <div style={{
          marginTop: 6, fontSize: 9, color: C.muted,
          textDecoration: "line-through",
        }}>
          {formatCOP(commercial.honorariosBase)}
        </div>
      )}
      <div style={{
        marginTop: 6, fontSize: 26, fontWeight: 800,
        color: C.azul, letterSpacing: "-0.025em",
      }}>
        {formatCOP(honorarios)}
      </div>
      <div style={{
        marginTop: 10, fontSize: 8.5, color: C.muted, lineHeight: 1.45,
      }}>
        Los honorarios únicamente se generan si el proceso<br />
        es aprobado y ejecutado exitosamente por el banco.
      </div>
    </div>
  );
}

/* ============================================================
   CITA INSTITUCIONAL — con imagen
============================================================ */
function ClosingQuote() {
  return (
    <div style={{
      borderRadius: 6,
      border: `1px solid ${C.hairline}`,
      overflow: "hidden",
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      background: "#fff",
      minHeight: 200,
    }}>
      <div style={{ padding: "16px 18px", position: "relative" }}>
        <div style={{
          position: "absolute", top: 4, left: 10,
          fontSize: 38, color: C.azul, opacity: 0.25,
          lineHeight: 1, fontFamily: "Georgia, serif",
        }}>❝</div>
        <div style={{ paddingLeft: 18 }}>
          <p style={{
            margin: 0, fontSize: 10.5, color: C.graphite, lineHeight: 1.55,
          }}>
            Cada año que eliminas de tu crédito representa tiempo,
            tranquilidad y patrimonio que vuelve a tu familia.
          </p>
          <p style={{
            margin: "10px 0 0 0", fontSize: 10.5, color: C.graphite, lineHeight: 1.55,
          }}>
            Esta propuesta refleja una oportunidad financiera real
            basada en cálculos técnicos y experiencia especializada
            en optimización de créditos hipotecarios.
          </p>
          <p style={{
            margin: "12px 0 0 0", fontSize: 11, color: C.azul, fontWeight: 800,
          }}>
            Gracias por confiar en NUVEX Finanzas Inteligentes.
          </p>
        </div>
      </div>
      <div style={{ position: "relative", minHeight: 200 }}>
        <img
          src={quoteRoom} alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "cover",
          }}
          crossOrigin="anonymous"
        />
      </div>
    </div>
  );
}
