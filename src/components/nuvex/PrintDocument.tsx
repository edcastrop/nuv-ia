import {
  Landmark, CreditCard, CalendarDays, Clock, Wallet, TrendingUp,
  CalendarOff as LCalendarOff, ShieldCheck, Users, MapPin, Phone, Globe,
  ArrowRight, PiggyBank,
} from "lucide-react";
import { NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import type { PropuestaComercialPdfRow } from "./PropuestasComerciales";
import { calcularMotor } from "../../lib/motorHonorarios";
import logoNuvex from "@/assets/logo-nuvex.png";
import heroSunset from "@/assets/nuvex-hero-sunset.jpg";

interface MetricItem { label: string; value: string }

export interface CommercialBenefit {
  honorariosBase: number;
  descuento: number;
  finales: number;
  vigencia?: string;
  hasDiscount: boolean;
}

export interface CreditStateData {
  plazoInicialMeses?: number;
  cuotasPagadas?: number;
  cuotasPendientes?: number;
  cuotaActual?: number;
  seguros?: number;
  cuotaSinSeguros?: number;
  saldoCapital?: number;
  tasaMensualPct?: number;
}

interface Props {
  mode: "pesos" | "uvr";
  client: ClientData;
  cuotasPendientes: number;
  metrics: MetricItem[];
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  propuestasComerciales?: PropuestaComercialPdfRow[];
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
  /** Dinero ya pagado por el cliente a la fecha (cuotaHoy × cuotasPagadas). */
  dineroPagadoFecha?: number;
  /** Valor inicial desembolsado del crédito. */
  valorDesembolsado?: number;
  /** Datos crudos del estado del crédito para la radiografía financiera. */
  creditState?: CreditStateData;
}

/* ============================================================
   NUVEX — Propuesta Comercial Premium (2 páginas A4)
   Diseño: estilo Apple/Stripe/Notion — sensación de cierre
============================================================ */
const C = {
  black: "#242424",
  ink: "#1A1F2E",
  text: "#2C3142",
  muted: "#6B7280",
  hairline: "#E5E9F0",
  paper: "#FFFFFF",
  bgSoft: "#F6F7F9",
  green: NUVEX.verde,        // #84B98F
  greenSoft: "#E8F4EA",
  greenDeep: "#3F8C57",
  azul: NUVEX.azul,          // #445DA3
  azulSoft: "#E3E8F5",
  purple: "#7C5BB7",
  purpleSoft: "#EDE5F7",
  red: "#D94F4F",
  redSoft: "#FCE6E5",
  redDeep: "#B43A3A",
};

const FONT = "'Inter','Manrope','SF Pro Display',ui-sans-serif,system-ui,sans-serif";
const SCRIPT = "'Allura','Caveat','Brush Script MT',cursive";

export function PrintDocument(props: Props) {
  const {
    mode, client, recommended, scenario, commercial,
    pesosPropuestas, uvrPropuestas, propuestasComerciales, bestIndex,
    dineroPagadoFecha = 0, valorDesembolsado = 0,
    creditState,
  } = props;
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";

  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const añosActual = scenario.plazoActual / 12;
  const añosOpt = scenario.nuevoPlazo / 12;
  const añosEliminados = Math.max(0, añosActual - añosOpt);
  const añosEliminadosEntero = Math.max(0, Math.round(añosEliminados));
  const cuotasEliminadas = Math.max(0, scenario.plazoActual - scenario.nuevoPlazo);

  const fechaBase = new Date();
  const fechaFinActual = new Date(fechaBase);
  fechaFinActual.setMonth(fechaFinActual.getMonth() + scenario.plazoActual);
  const fechaFinOpt = new Date(fechaBase);
  fechaFinOpt.setMonth(fechaFinOpt.getMonth() + scenario.nuevoPlazo);
  const añoHoy = fechaBase.getFullYear();
  const añoFinActual = fechaFinActual.getFullYear();
  const añoFinOpt = fechaFinOpt.getFullYear();

  const ahorroTotal = recommended.ahorroTotal;
  const honorariosFinales = commercial?.hasDiscount ? commercial.finales : recommended.honorarios;
  const honorariosBase = commercial?.honorariosBase ?? recommended.honorarios;
  const descuento = commercial?.hasDiscount ? Math.max(0, honorariosBase - honorariosFinales) : 0;

  // ─── VALIDACIÓN DE CONSISTENCIA ───
  // Los honorarios mostrados en el PDF deben provenir exactamente del escenario
  // recomendado del simulador. Si la base comercial no coincide con la del
  // escenario recomendado, bloqueamos la generación del PDF.
  const consistenciaOk =
    Math.abs((commercial?.honorariosBase ?? recommended.honorarios) - recommended.honorarios) < 1;
  if (!consistenciaOk) {
    return (
      <div id={containerId} className="nuvex-print-only" style={{
        background: "#fff", color: "#B43A3A", fontFamily: FONT,
        width: "210mm", padding: "40mm 22mm", boxSizing: "border-box",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>
          Error de consistencia
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#1A1F2E" }}>
          Los honorarios no coinciden con el escenario seleccionado.<br />
          Verifica el escenario recomendado en el simulador antes de generar el PDF.
        </div>
      </div>
    );
  }

  const nombreCliente = (client.nombre || "Cliente").toUpperCase();
  const primerNombre = (client.nombre || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const analista = client.asesor || "Equipo NUVEX";
  const banco = client.banco || "—";
  const productoLabel = client.tipoProducto === "leasing"
    ? "Leasing Habitacional" : "Crédito Hipotecario";
  const monedaLabel = mode === "uvr" ? "en UVR" : "en Pesos";

  const cuotaActual = scenario.cuotaActual;
  const nuevaCuota = scenario.nuevaCuota;
  const incrementoMensual = Math.max(0, nuevaCuota - cuotaActual);
  const incrementoPct = cuotaActual > 0 ? (incrementoMensual / cuotaActual) * 100 : 0;

  // ─── RADIOGRAFÍA FINANCIERA DEL CRÉDITO ───
  const yaPagado = Math.max(0, dineroPagadoFecha);
  const faltaPagarSin = Math.max(0, scenario.totalActual);
  const faltaPagarCon = Math.max(0, scenario.totalOptimizado);
  const costoTotalSin = yaPagado + faltaPagarSin;
  const costoTotalCon = yaPagado + faltaPagarCon;
  const desembolsoRef = valorDesembolsado > 0 ? valorDesembolsado : 0;
  const vecesSin = desembolsoRef > 0 ? costoTotalSin / desembolsoRef : 0;
  const vecesCon = desembolsoRef > 0 ? costoTotalCon / desembolsoRef : 0;
  const evitasPagar = Math.max(0, costoTotalSin - costoTotalCon);
  const radiografiaOk = desembolsoRef > 0 && (yaPagado > 0 || faltaPagarSin > 0);


  // -------- Alternativas (página 2) — todas las propuestas menos la seleccionada
  const alternativas = buildAlternativas({
    mode, pesosPropuestas, uvrPropuestas, propuestasComerciales, bestIndex,
    cuotaActual, añoHoy, añoFinActual, añosActual,
    plazoOriginal: scenario.plazoActual,
  });

  // Todas las propuestas (incluyendo la recomendada) para el resumen comparativo
  const allPropuestas = propuestasComerciales?.length
    ? mapComercialesToAltRow(propuestasComerciales, cuotaActual)
    : mapPropuestasToAltRow(mode, pesosPropuestas, uvrPropuestas, cuotaActual, scenario.plazoActual);

  // Honorarios "a éxito" finales de la propuesta recomendada (con descuento comercial si aplica)
  const recHonorariosFinal = honorariosFinales;
  const recHonorariosTieneDescuento = !!commercial?.hasDiscount;

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: FONT,
        width: "210mm",
        boxSizing: "border-box",
        letterSpacing: "-0.005em",
      }}
    >
      {/* ============================================================
          PÁGINA 1 — PROPUESTA RECOMENDADA
      ============================================================ */}
      <section
        className="nuvex-print-page"
        style={{
          width: "210mm", height: "297mm", maxHeight: "297mm",
          background: C.paper,
          boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column",
          pageBreakAfter: "always", breakAfter: "page",
        }}
      >
        {/* ───── HEADER NEGRO ───── */}
        <div style={{
          background: C.black, color: "#fff", padding: "10px 22px",
          display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 20,
          breakInside: "avoid", pageBreakInside: "avoid",
        }}>
          <img
            src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
            style={{ height: 96, width: "auto", filter: "brightness(0) invert(1)" }}
          />
          <div style={{ fontSize: 11.5, lineHeight: 1.4, color: "rgba(255,255,255,0.92)" }}>
            Transformamos tu crédito,
            <br />
            <span style={{ color: C.green, fontWeight: 700 }}>
              recuperas tu tiempo y tu dinero.
            </span>
          </div>
        </div>

        {/* ───── HERO ───── */}
        <div style={{
          padding: "10px 22px 4px 22px",
          breakInside: "avoid", pageBreakInside: "avoid",
        }}>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
            Hola, <span style={{ color: C.azul, fontWeight: 800 }}>{primerNombre}</span>
          </div>
          <h1 style={{
            margin: 0, fontSize: 26, lineHeight: 1.02, fontWeight: 900,
            color: C.black, letterSpacing: "-0.035em",
          }}>
            TU CRÉDITO PUEDE TERMINAR <span style={{ color: C.green }}>ANTES</span>
          </h1>
          <p style={{
            marginTop: 5, fontSize: 10.5, lineHeight: 1.4, color: C.muted, maxWidth: 640,
          }}>
            Analizamos tu caso y encontramos una oportunidad real para reducir
            años de pago y mejorar el resultado financiero de tu crédito.
          </p>
        </div>

        {/* ───── DATOS DEL CASO ───── */}
        <div style={{ padding: "0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: C.bgSoft, borderRadius: 12,
            padding: "8px 12px", display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1.2fr", gap: 18, alignItems: "center",
          }}>
            <MetaCol icon={<BankIcon />} label="BANCO" value={banco} />
            <MetaCol icon={<CardIcon />} label="PRODUCTO" value={`${productoLabel} ${monedaLabel}`} />
            <MetaCol icon={<CalIcon />} label="FECHA" value={fecha} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.azul}, ${C.green})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0,
              }}>
                {initialsOf(analista)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 7.5, letterSpacing: "0.22em", color: C.muted, fontWeight: 800,
                }}>PREPARADO POR</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>
                  {analista}
                </div>
                <div style={{ fontSize: 8.5, color: C.green, fontWeight: 700, lineHeight: 1.2 }}>
                  Analista NUVEX Certificado
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            LAYOUT 40/60 — ESTADO ACTUAL  |  PROPUESTA
        ═══════════════════════════════════════════════ */}
        <div style={{
          padding: "10px 22px 0 22px",
          display: "grid", gridTemplateColumns: "40fr 60fr", gap: 12,
          alignItems: "stretch",
        }}>
          {/* ═══ COLUMNA IZQUIERDA — ESTADO ACTUAL ═══ */}
          <EstadoActualCard
            banco={banco}
            producto={`${productoLabel} ${monedaLabel}`}
            plazoInicialMeses={creditState?.plazoInicialMeses ?? (scenario.plazoActual + (creditState?.cuotasPagadas ?? 0))}
            cuotasPagadas={creditState?.cuotasPagadas ?? 0}
            cuotasPendientes={creditState?.cuotasPendientes ?? scenario.plazoActual}
            cuotaActual={cuotaActual}
            seguros={creditState?.seguros ?? 0}
            tasaMensualPct={creditState?.tasaMensualPct ?? 0}
            saldoCapital={creditState?.saldoCapital ?? 0}
            cuotaSinSeguros={creditState?.cuotaSinSeguros ?? Math.max(0, cuotaActual - (creditState?.seguros ?? 0))}
            dineroPagado={yaPagado}
            dineroPendiente={faltaPagarSin}
            costoTotal={costoTotalSin}
            vecesPagado={vecesSin}
            valorDesembolsado={valorDesembolsado}
          />

          {/* ═══ COLUMNA DERECHA — PROPUESTA + TIMELINE + BENEFICIO + MENSAJE ═══ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

            {/* Propuesta recomendada — KPIs */}
            <div style={{
              background: `linear-gradient(155deg, ${C.greenSoft} 0%, #fff 100%)`,
              border: `1px solid ${C.green}55`, borderRadius: 12,
              padding: "9px 12px",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 6,
              }}>
                <div style={{
                  fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: C.greenDeep,
                }}>PROPUESTA RECOMENDADA</div>
                <div style={{
                  background: C.greenDeep, color: "#fff",
                  fontSize: 7.5, fontWeight: 900, letterSpacing: "0.14em",
                  padding: "2px 7px", borderRadius: 4,
                }}>★ NUVEX</div>
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7,
              }}>
                <KpiTile label="NUEVA CUOTA" value={formatCOP(nuevaCuota)} accent={C.greenDeep} big />
                <KpiTile label="INCREMENTO" value={`+${formatNumber(incrementoPct, 1)}%`} sub={`+${formatCOP(incrementoMensual)}`} accent={C.azul} />
                <KpiTile label="NUEVO PLAZO" value={`${scenario.nuevoPlazo} meses`} sub={`${formatNumber(añosOpt, 1)} años`} accent={C.ink} />
                <KpiTile label="CUOTAS ELIMINADAS" value={`${cuotasEliminadas}`} sub="menos pagos" accent={C.greenDeep} />
                <KpiTile label="AHORRO EN TIEMPO" value={`${añosEliminadosEntero} años`} accent={C.greenDeep} />
                <KpiTile label="AHORRO EN DINERO" value={formatCOP(ahorroTotal)} accent={C.azul} />
              </div>

              <div style={{
                marginTop: 6, padding: "5px 8px",
                background: "rgba(132,185,143,0.18)", borderRadius: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: C.greenDeep, letterSpacing: "0.12em" }}>
                  NUEVA FECHA DE FINALIZACIÓN
                </div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.greenDeep }}>
                  {añoFinOpt}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{
              background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 10,
              padding: "6px 10px", display: "flex", flexDirection: "column", gap: 4,
            }}>
              <MiniTimeline
                label="SIN NUVEX" labelColor={C.muted}
                startYear={añoHoy} endYear={añoFinActual}
                barColor="#CCD1D9" widthPct={100}
                pill={`${formatNumber(añosActual, 1)} años`}
                pillBg="#F1F2F4" pillFg={C.muted}
              />
              <MiniTimeline
                label="CON NUVEX" labelColor={C.greenDeep}
                startYear={añoHoy} endYear={añoFinOpt}
                barColor={C.greenDeep}
                widthPct={añosActual > 0 ? Math.max(8, Math.min(100, (añosOpt / añosActual) * 100)) : 100}
                pill={`${formatNumber(añosOpt, 1)} años`}
                pillBg={C.greenSoft} pillFg={C.greenDeep}
              />
              <div style={{
                marginTop: 2, paddingTop: 4, borderTop: `1px dashed ${C.hairline}`,
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
              }}>
                <TimelineStat label="AÑOS RECUPERADOS" value={`${añosEliminadosEntero}`} color={C.greenDeep} />
                <TimelineStat label="CUOTAS ELIMINADAS" value={`${cuotasEliminadas}`} color={C.azul} />
                <TimelineStat label="AHORRO TOTAL" value={formatCOP(ahorroTotal)} color={C.greenDeep} />
              </div>
            </div>

            {/* Beneficio económico compacto */}
            <div style={{
              background: "#fff", border: `1px solid ${C.hairline}`,
              borderRadius: 10, padding: "7px 11px",
            }}>
              <div style={{
                fontSize: 8.5, letterSpacing: "0.2em", fontWeight: 900, color: C.muted,
                marginBottom: 4,
              }}>BENEFICIO ECONÓMICO</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 7.5, color: C.muted, fontWeight: 700, letterSpacing: "0.1em" }}>ESTÁNDAR</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textDecoration: "line-through" }}>
                    {formatCOP(honorariosBase)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 7.5, color: C.azul, fontWeight: 800, letterSpacing: "0.1em" }}>APROBADOS</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.ink }}>
                    {formatCOP(honorariosFinales)}
                  </div>
                </div>
                <div style={{
                  background: C.greenSoft, borderRadius: 8, padding: "4px 8px", textAlign: "right",
                }}>
                  <div style={{ fontSize: 7.5, color: C.greenDeep, fontWeight: 800, letterSpacing: "0.1em" }}>AHORRO</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: C.greenDeep }}>
                    {formatCOP(descuento > 0 ? descuento : 0)}
                  </div>
                </div>
              </div>
              <div style={{
                marginTop: 5, fontSize: 8.5, fontWeight: 800, color: C.red,
                letterSpacing: "0.14em", textAlign: "center",
              }}>
                BENEFICIO COMERCIAL VÁLIDO POR 48 HORAS
              </div>
            </div>

            {/* Mensaje personal del Analista — máx 4 líneas */}
            <div style={{
              background: `linear-gradient(135deg, ${C.black} 0%, #1a1a1a 100%)`,
              color: "#fff", borderRadius: 10, padding: "7px 11px",
              display: "flex", flexDirection: "column", gap: 4,
            }}>
              <p style={{
                margin: 0, fontSize: 9.8, lineHeight: 1.3,
                color: "rgba(255,255,255,0.92)",
              }}>
                Este crédito terminará de una u otra forma. La diferencia es decidir si quieres
                <span style={{ color: C.green, fontWeight: 700 }}> recuperar parte de tu tiempo financiero</span>.
                Cada cuota eliminada es tiempo que vuelve a tu vida, a tu familia y a tus proyectos.
              </p>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center",
                paddingTop: 3, borderTop: "1px solid rgba(255,255,255,0.15)",
              }}>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>
                  Ya hicimos los cálculos. La decisión es tuya.
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: SCRIPT, fontSize: 18, color: C.green, lineHeight: 1 }}>
                    {analista}
                  </div>
                  <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.55)", letterSpacing: "0.14em" }}>
                    ANALISTA NUVEX
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───── FOOTER ───── */}
        <FooterStrip />
      </section>

      {/* ============================================================
          PÁGINA 2 — COMPARACIÓN DE ESCENARIOS
      ============================================================ */}
      <section
        className="nuvex-print-page"
        style={{
          width: "210mm", height: "297mm", maxHeight: "297mm",
          background: C.paper,
          boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* Header negro con título + logo */}
        <div style={{
          background: C.black, color: "#fff", padding: "14px 22px",
          display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 20,
          breakInside: "avoid", pageBreakInside: "avoid",
        }}>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em",
            }}>
              COMPARACIÓN DE ESCENARIOS
            </div>
            <div style={{
              marginTop: 3, fontSize: 10, color: "rgba(255,255,255,0.82)", lineHeight: 1.3, maxWidth: 520,
            }}>
              Analizamos diferentes alternativas para que elijas el nivel de optimización
              que mejor se adapta a tus objetivos financieros.
            </div>
          </div>
          <img
            src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
            style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* ───── TABLA COMPARATIVA ÚNICA ───── */}
        <div style={{ padding: "14px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <ComparisonTable
            cuotaActual={cuotaActual}
            añoFinActual={añoFinActual}
            añosActual={añosActual}
            plazoActual={scenario.plazoActual}
            allPropuestas={allPropuestas}
            bestIndex={bestIndex}
            recHonorariosFinal={recHonorariosFinal}
            recTieneDescuento={recHonorariosTieneDescuento}
          />
        </div>

        {/* ───── ¿POR QUÉ RECOMENDAMOS ESTA OPCIÓN? ───── */}
        <div style={{ padding: "12px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.greenSoft} 0%, #fff 100%)`,
            border: `1px solid ${C.green}55`, borderRadius: 12, padding: "10px 14px",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 900, color: C.greenDeep,
              letterSpacing: "0.14em", marginBottom: 7,
            }}>
              ¿POR QUÉ RECOMENDAMOS ESTA OPCIÓN?
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
            }}>
              <ReasonItem text={<>Mayor <b>ahorro financiero</b> en intereses y seguros.</>} />
              <ReasonItem text={<>Mejor <b>equilibrio</b> entre cuota mensual y plazo.</>} />
              <ReasonItem text={<>Mayor <b>recuperación de tiempo financiero</b>.</>} />
            </div>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ flex: "1 1 auto", minHeight: 4 }} />



        {/* ───── CTA FINAL SIMPLIFICADO ───── */}
        <div style={{ padding: "0 22px 16px 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.black} 0%, #1a1a1a 60%, #1f2a4a 130%)`,
            color: "#fff", borderRadius: 14, padding: "16px 22px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 18px 40px -22px rgba(0,0,0,0.45)",
          }}>
            <div style={{
              position: "absolute", right: -20, top: -30, width: 180, height: 180,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${C.green}44 0%, transparent 70%)`,
            }} />
            <div style={{
              display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center",
              position: "relative",
            }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 900, color: C.green, letterSpacing: "0.22em",
                }}>
                  UNA DECISIÓN. DOS CAMINOS.
                </div>
                <div style={{
                  marginTop: 6, fontSize: 14, lineHeight: 1.35,
                  color: "rgba(255,255,255,0.92)", maxWidth: 460,
                }}>
                  Tu crédito terminará de cualquier forma.<br />
                  La diferencia es decidir si deseas
                  <span style={{ color: C.green, fontWeight: 800 }}> recuperar parte de tu tiempo financiero</span>.
                </div>
              </div>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
              }}>
                <div style={{
                  background: C.green, color: "#0E1F14",
                  padding: "12px 20px", borderRadius: 10,
                  fontSize: 12.5, fontWeight: 900, letterSpacing: "0.06em",
                  boxShadow: "0 10px 24px -10px rgba(132,185,143,0.6)",
                }}>
                  QUIERO RECUPERAR MI TIEMPO FINANCIERO
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.16em", fontWeight: 700 }}>
                  PROPUESTA COMERCIAL VÁLIDA POR 48 HORAS
                </div>
              </div>
            </div>
          </div>
        </div>


        <FooterStrip />
      </section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   RESUMEN DE ESCENARIOS — comparativa final
   ════════════════════════════════════════════════════════════ */
function ResumenEscenarios({
  allPropuestas,
  bestIndex,
  recHonorariosFinal,
  recTieneDescuento,
}: {
  allPropuestas: AltRow[];
  bestIndex: number;
  recHonorariosFinal: number;
  recTieneDescuento: boolean;
}) {
  // Orden: recomendada primero, luego las demás numeradas
  const rec = allPropuestas[bestIndex];
  const others = allPropuestas.filter((_, i) => i !== bestIndex);

  const rows = [
    { isRecommended: true, label: "Propuesta Recomendada", data: rec },
    ...others.map((alt, idx) => ({
      isRecommended: false,
      label: `Propuesta ${idx + 1}`,
      data: alt,
    })),
  ].filter((r) => r.data);

  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        background: C.black, color: "#fff", padding: "8px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.18em" }}>
          RESUMEN DE ALTERNATIVAS
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", fontWeight: 700 }}>
          COMPARATIVA RÁPIDA
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.05fr 0.9fr 0.9fr 0.95fr 1fr",
        background: C.bgSoft,
        fontSize: 8.2, fontWeight: 800, color: C.muted, letterSpacing: "0.14em",
      }}>
        <div style={{ padding: "7px 10px" }}>ALTERNATIVA</div>
        <div style={{ padding: "7px 10px", textAlign: "right" }}>NUEVA CUOTA</div>
        <div style={{ padding: "7px 10px", textAlign: "right" }}>TIEMPO RECUP.</div>
        <div style={{ padding: "7px 10px", textAlign: "right" }}>AHORRO ECON.</div>
        <div style={{ padding: "7px 10px", textAlign: "right" }}>HONORARIOS A ÉXITO</div>
      </div>
      {rows.map((r, i) => {
        let honor: number;
        let honorTag: string | null;
        if (r.isRecommended) {
          honor = recHonorariosFinal;
          honorTag = recTieneDescuento ? "Descuento incluido" : null;
        } else {
          honor = r.data.honorariosFinal;
          honorTag = r.data.minimoAplicado ? "Mínimo aplicado" : null;
        }
        return (
          <ResumenRow
            key={i}
            isRecommended={r.isRecommended}
            label={r.label}
            cuota={r.data.nuevaCuota}
            años={Math.round(r.data.añosEliminados)}
            dinero={r.data.ahorroTotal}
            honorarios={honor}
            honorariosTag={honorTag}
          />
        );
      })}
    </div>
  );
}

function ResumenRow({
  isRecommended = false,
  label,
  cuota,
  años,
  dinero,
  honorarios,
  honorariosTag,
}: {
  isRecommended?: boolean;
  label: string;
  cuota: number;
  años: number;
  dinero: number;
  honorarios: number;
  honorariosTag: string | null;
}) {
  if (isRecommended) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.05fr 0.9fr 0.9fr 0.95fr 1fr",
        borderTop: `2px solid ${C.green}`,
        background: `linear-gradient(90deg, ${C.greenSoft} 0%, #fff 100%)`,
        alignItems: "center",
      }}>
        <div style={{ padding: "10px 10px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            background: C.greenDeep, color: "#fff",
            padding: "3px 8px", borderRadius: 4,
            fontSize: 8.2, fontWeight: 900, letterSpacing: "0.12em",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>★</span>
            <span>RECOMENDADA</span>
          </div>
        </div>
        <div style={{ padding: "10px 10px", textAlign: "right", fontSize: 12, fontWeight: 900, color: C.greenDeep }}>
          {formatCOP(cuota)}
        </div>
        <div style={{ padding: "10px 10px", textAlign: "right", fontSize: 12, fontWeight: 900, color: C.greenDeep }}>
          {años} AÑOS
        </div>
        <div style={{ padding: "10px 10px", textAlign: "right", fontSize: 12, fontWeight: 900, color: C.greenDeep }}>
          {formatCOP(dinero)}
        </div>
        <div style={{ padding: "8px 10px", textAlign: "right" }}>
          <div style={{ fontSize: 11.5, fontWeight: 900, color: C.azul, letterSpacing: "-0.01em" }}>
            {formatCOP(honorarios)}
          </div>
          {honorariosTag && (
            <div style={{ fontSize: 7.8, color: C.muted, fontWeight: 700, marginTop: 1 }}>
              {honorariosTag}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.05fr 0.9fr 0.9fr 0.95fr 1fr",
      borderTop: `1px solid ${C.hairline}`,
      alignItems: "center",
    }}>
      <div style={{ padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.muted }} />
        <div style={{ fontSize: 10.5, fontWeight: 800, color: C.ink }}>{label}</div>
      </div>
      <div style={{ padding: "7px 10px", textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.ink }}>
        {formatCOP(cuota)}
      </div>
      <div style={{ padding: "7px 10px", textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.ink }}>
        {años} años
      </div>
      <div style={{ padding: "7px 10px", textAlign: "right", fontSize: 10.5, fontWeight: 700, color: C.ink }}>
        {formatCOP(dinero)}
      </div>
      <div style={{ padding: "6px 10px", textAlign: "right" }}>
        <div style={{ fontSize: 10.8, fontWeight: 800, color: C.azul }}>
          {formatCOP(honorarios)}
        </div>
        {honorariosTag && (
          <div style={{ fontSize: 7.8, color: C.muted, fontWeight: 700, marginTop: 1 }}>
            {honorariosTag}
          </div>
        )}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   ALTERNATIVAS — paletas + builder
════════════════════════════════════════════════════════════ */
type ScenarioMeta = { label: string; accent: string; soft: string; deep: string; ideal: string };

const SCENARIO_CONSERVADOR: ScenarioMeta = {
  label: "Escenario conservador", accent: "#7C5BB7", soft: "#EDE5F7", deep: "#553B86",
  ideal: "Incremento mínimo en cuota y recuperación gradual de tiempo.",
};
const SCENARIO_BALANCEADO: ScenarioMeta = {
  label: "Escenario balanceado", accent: NUVEX.verde, soft: "#E8F4EA", deep: "#3F8C57",
  ideal: "Equilibrio entre aumento de cuota, ahorro financiero y reducción de plazo.",
};
const SCENARIO_AGRESIVO: ScenarioMeta = {
  label: "Escenario agresivo", accent: NUVEX.azul, soft: "#E3E8F5", deep: "#2F4380",
  ideal: "Mayor recuperación de tiempo y ahorro financiero mediante un incremento superior en cuota.",
};

/**
 * Clasifica dinámicamente los escenarios alternativos según su posición
 * (ya vienen ordenados de menor a mayor agresividad).
 */
function dynamicScenarioMeta(index: number, total: number): ScenarioMeta {
  if (total <= 1) return SCENARIO_BALANCEADO;
  if (total === 2) return index === 0 ? SCENARIO_CONSERVADOR : SCENARIO_AGRESIVO;
  if (index === 0) return SCENARIO_CONSERVADOR;
  if (index === 1) return SCENARIO_BALANCEADO;
  return SCENARIO_AGRESIVO;
}

interface AltRow {
  nuevaCuota: number;
  incrementoPct: number;
  añosEliminados: number;
  cuotasEliminadas: number;
  ahorroTotal: number;
  añoFinOpt: number;
  añosOpt: number;
  honorariosFinal: number;
  honorariosBase: number;
  minimoAplicado: boolean;
}

function computeHonorarios(
  ahorroIntereses: number,
  ahorroSeguros: number,
  mode: "pesos" | "uvr",
  plazoOriginal: number,
): { honorariosFinal: number; honorariosBase: number; minimoAplicado: boolean } {
  const r = calcularMotor({
    ahorroIntereses,
    ahorroSeguros,
    tipoCredito: mode,
    plazoOriginalMeses: plazoOriginal,
  });
  return {
    honorariosFinal: r.honorarioRecomendado,
    honorariosBase: r.honorarioTeorico,
    minimoAplicado: r.alertaTope === "minimo",
  };
}

function buildAlternativas(args: {
  mode: "pesos" | "uvr";
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  propuestasComerciales?: PropuestaComercialPdfRow[];
  bestIndex: number;
  cuotaActual: number;
  añoHoy: number;
  añoFinActual: number;
  añosActual: number;
  plazoOriginal: number;
}): AltRow[] {
  const { mode, pesosPropuestas, uvrPropuestas, propuestasComerciales, bestIndex, cuotaActual, plazoOriginal } = args;
  const fechaBase = new Date();

  if (propuestasComerciales?.length) {
    return mapComercialesToAltRow(propuestasComerciales, cuotaActual)
      .filter((_, idx) => idx !== bestIndex)
      .sort((a, b) => a.incrementoPct - b.incrementoPct);
  }

  if (mode === "uvr") {
    const arr = uvrPropuestas || [];
    return arr
      .map((p, idx) => ({ p, idx }))
      .filter(({ idx }) => idx !== bestIndex)
      .map(({ p }) => mapUVR(p))
      .sort((a, b) => a.incrementoPct - b.incrementoPct); // menor aumento → conservador
  }
  const arr = pesosPropuestas || [];
  return arr
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => idx !== bestIndex)
    .map(({ p }) => mapPesos(p))
    .sort((a, b) => a.incrementoPct - b.incrementoPct);

  function mapPesos(p: PesosPropuesta): AltRow {
    const cuota = p.nuevaCuotaConSeguro;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "pesos", plazoOriginal);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
      ...h,
    };
  }
  function mapUVR(p: UVRPropuesta): AltRow {
    const cuota = p.nuevaCuotaConSeguroAprox;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "uvr", plazoOriginal);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
      ...h,
    };
  }
}

function mapComercialesToAltRow(
  propuestas: PropuestaComercialPdfRow[],
  cuotaActual: number,
): AltRow[] {
  const fechaBase = new Date();
  return propuestas.map((p) => {
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    return {
      nuevaCuota: p.nuevaCuota,
      incrementoPct:
        typeof p.incrementoMensual === "number" && cuotaActual > 0
          ? (p.incrementoMensual / cuotaActual) * 100
          : cuotaActual > 0
            ? ((p.nuevaCuota - cuotaActual) / cuotaActual) * 100
            : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
      honorariosFinal: p.honorarios,
      honorariosBase: p.honorarios,
      minimoAplicado: p.honorarios <= 2_000_000,
    };
  });
}

function mapPropuestasToAltRow(
  mode: "pesos" | "uvr",
  pesosPropuestas: PesosPropuesta[] | undefined,
  uvrPropuestas: UVRPropuesta[] | undefined,
  cuotaActual: number,
  plazoOriginal: number,
): AltRow[] {
  const fechaBase = new Date();
  if (mode === "uvr") {
    return (uvrPropuestas || []).map((p) => {
      const cuota = p.nuevaCuotaConSeguroAprox;
      const fechaFin = new Date(fechaBase);
      fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
      const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "uvr", plazoOriginal);
      return {
        nuevaCuota: cuota,
        incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
        añosEliminados: p.añosEliminados,
        cuotasEliminadas: p.cuotasEliminadas,
        ahorroTotal: p.ahorroTotal,
        añoFinOpt: fechaFin.getFullYear(),
        añosOpt: p.nuevoPlazo / 12,
        ...h,
      };
    });
  }
  return (pesosPropuestas || []).map((p) => {
    const cuota = p.nuevaCuotaConSeguro;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "pesos", plazoOriginal);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
      ...h,
    };
  });
}



/* ════════════════════════════════════════════════════════════
   SUBCOMPONENTES
════════════════════════════════════════════════════════════ */

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 11, fontWeight: 900, color: C.black,
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      <span>{index}.</span>
      <span>{title}</span>
    </div>
  );
}

function MetaCol({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: "#fff",
        border: `1px solid ${C.hairline}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.azul, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 7.5, letterSpacing: "0.22em", color: C.muted, fontWeight: 800,
        }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function CuotaCard({
  eyebrow, sub, amount, footer, color, bg,
}: { eyebrow: string; sub: string; amount: number; footer: string; color: string; bg: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: "9px 12px",
      border: `1px solid ${C.hairline}`,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        fontSize: 8.5, letterSpacing: "0.2em", fontWeight: 800, color: C.muted,
      }}>{eyebrow}</div>
      <div style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>{sub}</div>
      <div style={{
        marginTop: 4, fontSize: 23, fontWeight: 900, color, letterSpacing: "-0.025em",
        lineHeight: 1,
      }}>
        {formatCOP(amount)}
      </div>
      <div style={{ marginTop: 5, fontSize: 8.5, color: C.muted }}>{footer}</div>
    </div>
  );
}

function ImpactCard({
  icon, eyebrow, amount, sub, note, accent, bg,
}: {
  icon: React.ReactNode; eyebrow: string; amount: string; sub?: string;
  note: React.ReactNode; accent: string; bg: string;
}) {
  return (
    <div style={{
      background: bg, borderRadius: 12, padding: "10px 14px",
      border: `1px solid ${C.hairline}`,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: `1.5px solid ${accent}`,
        }}>{icon}</div>
        <div style={{
          fontSize: 10, letterSpacing: "0.2em", fontWeight: 800, color: accent,
        }}>{eyebrow}</div>
      </div>
      <div style={{
        marginTop: 5, fontSize: 38, fontWeight: 900, color: accent,
        letterSpacing: "-0.03em", lineHeight: 0.98,
      }}>
        {amount}
      </div>
      {sub && (
        <div style={{
          fontSize: 10, fontWeight: 800, color: accent, marginTop: 1, letterSpacing: "0.04em",
        }}>{sub}</div>
      )}
      <div style={{ marginTop: 5, fontSize: 9.5, color: C.text, lineHeight: 1.3 }}>
        {note}
      </div>
    </div>
  );
}

function BenefitItem({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 3 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        background: C.greenSoft, color: C.greenDeep,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div style={{ fontSize: 8.7, color: C.text, lineHeight: 1.18, fontWeight: 600 }}>
        {label}
      </div>
    </div>
  );
}

function RadioMini({
  label, value, tone,
}: { label: string; value: string; tone: "neutral" | "hero" }) {
  const isHero = tone === "hero";
  return (
    <div style={{
      background: isHero ? C.greenSoft : "#F4F6F8",
      border: isHero ? `1px solid ${C.green}55` : `1px solid ${C.hairline}`,
      borderRadius: 10, padding: "6px 10px",
      display: "flex", flexDirection: "column", justifyContent: "center",
    }}>
      <div style={{
        fontSize: 7.8, letterSpacing: "0.2em", fontWeight: 800,
        color: isHero ? C.greenDeep : C.muted, marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: isHero ? 17 : 13.5, fontWeight: 900,
        color: isHero ? C.greenDeep : C.ink,
        letterSpacing: "-0.02em", lineHeight: 1.05,
      }}>{value}</div>
    </div>
  );
}

function CompareCell({
  title, big, small, bg, fg, accent,
}: { title: string; big: string; small: string; bg: string; fg: string; accent: string }) {
  return (
    <div style={{
      background: bg, borderRadius: 10, padding: "5px 10px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    }}>
      <div style={{
        fontSize: 8, letterSpacing: "0.22em", fontWeight: 800, color: accent,
      }}>{title}</div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: fg, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {big}
        </div>
        <div style={{ fontSize: 8.5, color: fg, opacity: 0.75, lineHeight: 1.1, marginTop: 1 }}>
          {small}
        </div>
      </div>
    </div>
  );
}

function PriceRow({ label, value, strike = false }: { label: string; value: string; strike?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: 10.5, color: C.text, fontWeight: 600 }}>{label}</div>
      <div style={{
        fontSize: 16, fontWeight: 800, color: strike ? C.muted : C.ink,
        textDecoration: strike ? "line-through" : "none",
        letterSpacing: "-0.01em",
      }}>{value}</div>
    </div>
  );
}

function ReinforceBullet({ text }: { text: React.ReactNode }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 9.5, color: "#1A1F2E", lineHeight: 1.25,
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: "50%",
        background: "#3F8C57", color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 9, fontWeight: 900, flexShrink: 0,
      }}>✓</span>
      <span>{text}</span>
    </div>
  );
}


function AlternativaCard(props: {
  index: number; label: string; accent: string; soft: string; deep: string;
  cuota: number; cuotaPct: number;
  ahorroAños: number; ahorroCuotas: number; ahorroDinero: number;
  terminaEn: number; terminaActual: number;
  añoHoy: number; añosActuales: number; añosOpt: number;
  quienIdeal: string;
  honorarios: number;
  honorariosBase: number;
  honorariosTag: string | null;
}) {
  const {
    index, label, accent, soft, deep,
    cuota, cuotaPct, ahorroAños, ahorroCuotas, ahorroDinero,
    terminaEn, terminaActual, añoHoy, añosActuales, añosOpt, quienIdeal,
    honorarios, honorariosBase, honorariosTag,
  } = props;
  const barPct = Math.max(15, Math.min(95, (añosOpt / Math.max(añosActuales, 1)) * 100));

  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`,
      borderRadius: 12, padding: "10px 14px",
      breakInside: "avoid", pageBreakInside: "avoid",
      boxShadow: "0 2px 8px -4px rgba(0,0,0,0.06)",
    }}>

      {/* Header card */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          background: accent, color: "#fff",
          padding: "4px 11px", borderRadius: 6,
          fontSize: 10.5, fontWeight: 900, letterSpacing: "0.14em",
        }}>
          PROYECCIÓN {index}
        </div>
        <div style={{
          fontSize: 11, fontWeight: 800, color: deep, fontStyle: "italic",
        }}>
          {`Propuesta ${index}`}
        </div>
      </div>

      {/* 4 cols */}
      <div style={{
        marginTop: 7, display: "grid", gridTemplateColumns: "1.15fr 1fr 1fr 1fr", gap: 10, alignItems: "start",
      }}>
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: C.muted, fontWeight: 800 }}>
            NUEVA CUOTA
          </div>
          <div style={{
            fontSize: 17, fontWeight: 900, color: accent,
            letterSpacing: "-0.02em", lineHeight: 1.05, marginTop: 2,
          }}>
            {formatCOP(cuota)}
          </div>
          <div style={{
            marginTop: 3, display: "inline-block",
            background: soft, color: deep, fontSize: 9, fontWeight: 800,
            padding: "2px 7px", borderRadius: 999,
          }}>
            +{formatNumber(cuotaPct, 1)}%
          </div>
        </div>

        <AltMetric
          icon={<ClockIcon color={accent} size={13} />}
          label="TIEMPO"
          value={`${Math.round(ahorroAños)} AÑOS`}
          sub={`${ahorroCuotas} cuotas`}
          color={accent}
          valueSize={16}
        />

        <AltMetric
          icon={<MoneyMini color={accent} />}
          label="DINERO"
          value={formatCOP(ahorroDinero)}
          sub="Intereses + seguros"
          color={accent}
          valueSize={14}
        />

        <div>
          <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: C.muted, fontWeight: 800 }}>
            TERMINA
          </div>
          <div style={{
            fontSize: 18, fontWeight: 900, color: accent,
            letterSpacing: "-0.02em", marginTop: 2,
          }}>
            {terminaEn}
          </div>
          <div style={{ fontSize: 8.5, color: C.muted, marginTop: 1 }}>
            Hoy: {terminaActual}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ marginTop: 7, display: "flex", flexDirection: "column", gap: 3 }}>
        <MiniTimeline
          label="SIN NUVEX" labelColor={C.muted}
          startYear={añoHoy} endYear={terminaActual}
          barColor="#CCD1D9" widthPct={100}
          pill={`${formatNumber(añosActuales, 1)} años`}
          pillBg="#F1F2F4" pillFg={C.muted}
        />
        <MiniTimeline
          label={`CON PROYECCIÓN ${index}`} labelColor={deep}
          startYear={añoHoy} endYear={terminaEn}
          barColor={accent} widthPct={barPct}
          pill={`${formatNumber(añosOpt, 1)} años`}
          pillBg={soft} pillFg={deep}
        />
      </div>

      {/* Ideal + Honorarios a éxito */}
      <div style={{
        marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto",
        gap: 8, alignItems: "stretch",
      }}>
        <div style={{
          background: soft, borderRadius: 8, padding: "5px 10px",
          display: "flex", alignItems: "center",
        }}>
          <div style={{ fontSize: 8.8, color: C.text, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ fontWeight: 800, color: deep, fontStyle: "italic" }}>Ideal para: </span>
            {quienIdeal}
          </div>
        </div>
        <div style={{
          background: C.azulSoft, border: `1px solid ${C.azul}22`,
          borderRadius: 8, padding: "4px 10px",
          display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center",
          minWidth: 150,
        }}>
          <div style={{ fontSize: 7.8, fontWeight: 800, color: C.azul, letterSpacing: "0.14em" }}>
            HONORARIOS A ÉXITO
          </div>
          {honorariosBase > honorarios && (
            <div style={{
              fontSize: 9, fontWeight: 700, color: C.muted,
              textDecoration: "line-through", marginTop: 1,
            }}>
              Estándar {formatCOP(honorariosBase)}
            </div>
          )}
          <div style={{ fontSize: 12.5, fontWeight: 900, color: C.azul, letterSpacing: "-0.01em", marginTop: 1 }}>
            {honorariosBase > honorarios ? "Con beneficio " : ""}{formatCOP(honorarios)}
          </div>
          {honorariosTag && (
            <div style={{ fontSize: 7.6, fontWeight: 700, color: C.muted, marginTop: 1 }}>
              {honorariosTag}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AltMetric({
  icon, label, value, sub, color, valueSize = 18,
}: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; valueSize?: number;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <div style={{ fontSize: 8.5, letterSpacing: "0.18em", color: C.muted, fontWeight: 800 }}>
          {label}
        </div>
      </div>
      <div style={{
        fontSize: Math.max(10, valueSize - 1), fontWeight: 900, color, letterSpacing: "-0.02em",
        marginTop: 1, lineHeight: 1.04,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>{sub}</div>
    </div>
  );
}

function MiniTimeline({
  label, labelColor, startYear, endYear, barColor, widthPct, pill, pillBg, pillFg,
}: {
  label: string; labelColor: string; startYear: number; endYear: number;
  barColor: string; widthPct: number; pill: string; pillBg: string; pillFg: string;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "112px 34px 1fr 48px 50px",
      alignItems: "center", gap: 5,
    }}>
      <div style={{ fontSize: 8, fontWeight: 800, color: labelColor, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: C.ink, textAlign: "center" }}>
        {startYear}
      </div>
      <div style={{ position: "relative", height: 8 }}>
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 2,
          background: "#EDEFF2", transform: "translateY(-50%)",
        }} />
        <div style={{
          position: "absolute", top: "50%", left: 0, height: 3,
          width: `${widthPct}%`, background: barColor, transform: "translateY(-50%)",
          borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `calc(${widthPct}% - 4px)`,
          width: 8, height: 8, borderRadius: "50%", background: barColor,
          transform: "translateY(-50%)",
        }} />
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: C.ink, textAlign: "center" }}>
        {endYear}
      </div>
      <div style={{
        background: pillBg, color: pillFg, fontSize: 7.5, fontWeight: 800,
        padding: "1px 5px", borderRadius: 999, textAlign: "center",
      }}>
        {pill}
      </div>
    </div>
  );
}

function FooterStrip() {
  return (
    <div
      data-pdf-footer="true"
      style={{
        marginTop: "auto",
        background: C.black, color: "#fff",
        padding: "4px 22px",
        display: "grid",
        gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
        gap: 6, alignItems: "center",
        breakInside: "avoid", pageBreakInside: "avoid",
      }}
    >
      <img
        src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
        style={{ height: 18, width: "auto", filter: "brightness(0) invert(1)" }}
      />
      <FooterItem icon={<PinIcon />} title="Bucaramanga" lines={["Cra. 16 # 37-48 Piso 4", "Centro"]} />
      <FooterItem icon={<PinIcon />} title="Bogotá" lines={["Calle 93 # 18-28", "Of. 704"]} />
      <FooterItem icon={<PhoneIcon />} title="" lines={["+57 316 402 3779"]} />
      <FooterItem icon={<GlobeIcon />} title="" lines={["www.nuvex.com.co"]} />
    </div>
  );
}

function FooterItem({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 17, height: 17, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ fontSize: 7.2, lineHeight: 1.2 }}>
        {title && <div style={{ fontWeight: 800, color: "#fff" }}>{title}</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}


/* ════════════════════════════════════════════════════════════
   NUEVA ARQUITECTURA — ESTADO ACTUAL · KPI · TIMELINE · TABLA
════════════════════════════════════════════════════════════ */

function EstadoActualCard(props: {
  banco: string; producto: string;
  plazoInicialMeses: number; cuotasPagadas: number; cuotasPendientes: number;
  cuotaActual: number; seguros: number; cuotaSinSeguros: number;
  tasaMensualPct: number; saldoCapital: number;
  dineroPagado: number; dineroPendiente: number;
  costoTotal: number; vecesPagado: number;
  valorDesembolsado: number;
}) {
  const {
    banco, producto, plazoInicialMeses, cuotasPagadas, cuotasPendientes,
    cuotaActual, seguros, cuotaSinSeguros, tasaMensualPct, saldoCapital,
    dineroPagado, dineroPendiente, costoTotal, vecesPagado, valorDesembolsado,
  } = props;

  const tasaMensual = tasaMensualPct / 100;
  const interesMensual = Math.max(0, saldoCapital * tasaMensual);
  const capitalMensual = Math.max(0, cuotaSinSeguros - interesMensual);
  const capitalPagado = valorDesembolsado > 0 && saldoCapital > 0
    ? Math.max(0, valorDesembolsado - saldoCapital) : 0;
  const segurosPagados = seguros * cuotasPagadas;
  const interesesPagados = Math.max(0, dineroPagado - capitalPagado - segurosPagados);

  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 12,
      padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        paddingBottom: 5, borderBottom: `1px solid ${C.hairline}`,
      }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: C.ink,
        }}>ESTADO ACTUAL DEL CRÉDITO</div>
        <div style={{
          background: C.ink, color: "#fff", fontSize: 7, fontWeight: 800,
          letterSpacing: "0.14em", padding: "2px 6px", borderRadius: 3,
        }}>DASHBOARD</div>
      </div>

      <StateGroup title="Producto">
        <StateRow label="Banco" value={banco} />
        <StateRow label="Producto" value={producto} />
        <StateRow label="Plazo inicial" value={`${plazoInicialMeses} meses`} />
      </StateGroup>

      <StateGroup title="Cuotas">
        <StateRow label="Canceladas" value={`${cuotasPagadas}`} />
        <StateRow label="Pendientes" value={`${cuotasPendientes}`} />
      </StateGroup>

      <StateGroup title="Cuota mensual">
        <StateRow label="Cuota actual" value={formatCOP(cuotaActual)} bold />
        <StateRow label="Seguros" value={formatCOP(seguros)} />
        <StateRow label="Interés mensual" value={formatCOP(interesMensual)} />
        <StateRow label="Capital mensual" value={formatCOP(capitalMensual)} />
      </StateGroup>

      <StateGroup title="Pagado a la fecha">
        <StateRow label="Dinero pagado" value={formatCOP(dineroPagado)} bold />
        <StateRow label="Intereses pagados" value={formatCOP(interesesPagados)} />
        <StateRow label="Capital pagado" value={formatCOP(capitalPagado)} />
      </StateGroup>

      <StateGroup title="Proyección sin NUVEX">
        <StateRow label="Dinero pendiente" value={formatCOP(dineroPendiente)} />
        <StateRow label="Costo total proyectado" value={formatCOP(costoTotal)} bold danger />
      </StateGroup>

      <div style={{
        marginTop: 2, background: "#FCE6E5", border: `1px solid ${C.red}55`,
        borderRadius: 8, padding: "6px 10px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 8.5, letterSpacing: "0.18em", fontWeight: 900, color: C.redDeep }}>
          N° VECES PAGADO
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: C.redDeep, letterSpacing: "-0.02em" }}>
          {formatNumber(vecesPagado, 2)}×
        </div>
      </div>
    </div>
  );
}

function StateGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 7.5, letterSpacing: "0.2em", fontWeight: 800, color: C.muted,
        marginBottom: 2, textTransform: "uppercase",
      }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {children}
      </div>
    </div>
  );
}

function StateRow({
  label, value, bold = false, danger = false,
}: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      fontSize: 9.5, lineHeight: 1.3,
    }}>
      <span style={{ color: C.text, fontWeight: 500 }}>{label}</span>
      <span style={{
        color: danger ? C.redDeep : C.ink,
        fontWeight: bold ? 900 : 700,
        letterSpacing: "-0.01em",
      }}>{value}</span>
    </div>
  );
}

function KpiTile({
  label, value, sub, accent, big = false,
}: { label: string; value: string; sub?: string; accent: string; big?: boolean }) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`,
      borderRadius: 8, padding: "5px 8px",
      display: "flex", flexDirection: "column", justifyContent: "center",
      minHeight: big ? 50 : 44,
    }}>
      <div style={{
        fontSize: 7.2, letterSpacing: "0.16em", fontWeight: 800, color: C.muted,
        marginBottom: 2,
      }}>{label}</div>
      <div style={{
        fontSize: big ? 14 : 12, fontWeight: 900, color: accent,
        letterSpacing: "-0.02em", lineHeight: 1.05,
      }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 7.5, color: C.muted, marginTop: 1, fontWeight: 600 }}>{sub}</div>
      )}
    </div>
  );
}

function TimelineStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 7, letterSpacing: "0.16em", fontWeight: 800, color: C.muted }}>
        {label}
      </div>
      <div style={{
        fontSize: 11, fontWeight: 900, color, letterSpacing: "-0.01em", marginTop: 1,
      }}>{value}</div>
    </div>
  );
}

function ReasonItem({ text }: { text: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 6,
      fontSize: 9.5, color: C.ink, lineHeight: 1.3,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: "50%",
        background: C.greenDeep, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 900, flexShrink: 0, marginTop: 1,
      }}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function ComparisonTable(props: {
  cuotaActual: number;
  añoFinActual: number;
  añosActual: number;
  plazoActual: number;
  allPropuestas: AltRow[];
  bestIndex: number;
  recHonorariosFinal: number;
  recTieneDescuento: boolean;
}) {
  const {
    cuotaActual, añoFinActual, añosActual, plazoActual,
    allPropuestas, bestIndex, recHonorariosFinal, recTieneDescuento,
  } = props;

  const rec = allPropuestas[bestIndex];
  const others = allPropuestas
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => idx !== bestIndex)
    .map(({ p }) => p)
    .slice(0, 3);

  // Columnas: Actual | Escenarios alternativos | Recomendado (último, destacado)
  const cols = [
    { key: "actual", label: "ACTUAL", isRec: false, isCurrent: true },
    ...others.map((_, i) => ({
      key: `e${i + 1}`, label: `ESCENARIO ${i + 1}`, isRec: false, isCurrent: false,
    })),
    { key: "rec", label: "RECOMENDADO", isRec: true, isCurrent: false },
  ];

  const colData: Record<string, AltRow | null> = { actual: null, rec };
  others.forEach((p, i) => { colData[`e${i + 1}`] = p; });

  const fmtCuota = (c: { isCurrent: boolean; isRec: boolean; key: string }) => {
    if (c.isCurrent) return formatCOP(cuotaActual);
    const d = colData[c.key];
    return d ? formatCOP(d.nuevaCuota) : "—";
  };
  const fmtIncremento = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return "—";
    const d = colData[c.key];
    return d ? `+${formatNumber(d.incrementoPct, 1)}%` : "—";
  };
  const fmtPlazo = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return `${plazoActual} m`;
    const d = colData[c.key];
    return d ? `${Math.round(d.añosOpt * 12)} m` : "—";
  };
  const fmtFecha = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return `${añoFinActual}`;
    const d = colData[c.key];
    return d ? `${d.añoFinOpt}` : "—";
  };
  const fmtAños = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return "—";
    const d = colData[c.key];
    return d ? `${Math.round(d.añosEliminados)}` : "—";
  };
  const fmtCuotas = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return "—";
    const d = colData[c.key];
    return d ? `${d.cuotasEliminadas}` : "—";
  };
  const fmtAhorro = (c: { isCurrent: boolean; key: string }) => {
    if (c.isCurrent) return "—";
    const d = colData[c.key];
    return d ? formatCOP(d.ahorroTotal) : "—";
  };
  const fmtHonor = (c: { isCurrent: boolean; isRec: boolean; key: string }) => {
    if (c.isCurrent) return "—";
    if (c.isRec) return formatCOP(recHonorariosFinal);
    const d = colData[c.key];
    return d ? formatCOP(d.honorariosFinal) : "—";
  };
  const fmtBeneficio = (c: { isRec: boolean }) => c.isRec
    ? (recTieneDescuento ? "Descuento aplicado" : "Aprobado")
    : "—";

  const rows: { label: string; fn: (c: typeof cols[number]) => string; emphasize?: boolean }[] = [
    { label: "Nueva cuota", fn: fmtCuota, emphasize: true },
    { label: "Incremento mensual", fn: fmtIncremento },
    { label: "Nuevo plazo", fn: fmtPlazo },
    { label: "Fecha final", fn: fmtFecha },
    { label: "Años recuperados", fn: fmtAños },
    { label: "Cuotas eliminadas", fn: fmtCuotas },
    { label: "Ahorro total", fn: fmtAhorro, emphasize: true },
    { label: "Honorarios a éxito", fn: fmtHonor },
    { label: "Beneficio comercial", fn: fmtBeneficio },
  ];

  const totalCols = cols.length;
  const gridTemplate = `1.3fr ${cols.map((c) => c.isRec ? "1.15fr" : "1fr").join(" ")}`;

  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 12,
      overflow: "hidden", boxShadow: "0 4px 14px -8px rgba(0,0,0,0.08)",
    }}>
      {/* Header */}
      <div style={{
        display: "grid", gridTemplateColumns: gridTemplate,
        background: C.black, color: "#fff",
      }}>
        <div style={{
          padding: "10px 12px", fontSize: 9, fontWeight: 900,
          letterSpacing: "0.18em",
        }}>CONCEPTO</div>
        {cols.map((c) => (
          <div key={c.key} style={{
            padding: "10px 8px", textAlign: "center",
            fontSize: 9, fontWeight: 900, letterSpacing: "0.12em",
            background: c.isRec ? C.greenDeep : "transparent",
            color: c.isRec ? "#fff" : "rgba(255,255,255,0.78)",
            position: "relative",
          }}>
            {c.isRec && (
              <div style={{
                fontSize: 7, letterSpacing: "0.18em", color: "#fff",
                opacity: 0.85, marginBottom: 2,
              }}>★ NUVEX</div>
            )}
            {c.label}
          </div>
        ))}
      </div>

      {/* Body */}
      {rows.map((r, ri) => (
        <div key={ri} style={{
          display: "grid", gridTemplateColumns: gridTemplate,
          borderTop: `1px solid ${C.hairline}`,
          background: ri % 2 === 0 ? "#fff" : C.bgSoft,
        }}>
          <div style={{
            padding: "7px 12px", fontSize: 9.5, fontWeight: 700, color: C.text,
          }}>
            {r.label}
          </div>
          {cols.map((c) => {
            const isRec = c.isRec;
            const isCurrent = c.isCurrent;
            return (
              <div key={c.key} style={{
                padding: "7px 8px", textAlign: "center",
                fontSize: r.emphasize ? 10.5 : 9.5,
                fontWeight: isRec || r.emphasize ? 900 : 700,
                color: isCurrent
                  ? C.muted
                  : isRec ? C.greenDeep : C.ink,
                background: isRec ? "rgba(132,185,143,0.12)" : "transparent",
                borderLeft: isRec ? `2px solid ${C.greenDeep}` : "none",
                letterSpacing: "-0.01em",
              }}>
                {r.fn(c)}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer hint */}
      <div style={{
        padding: "6px 12px", background: C.bgSoft,
        borderTop: `1px solid ${C.hairline}`, textAlign: "center",
        fontSize: 8, color: C.muted, fontStyle: "italic",
      }}>
        Total de escenarios analizados: {totalCols - 1} · La columna destacada es la
        propuesta recomendada por nuestro motor financiero.
      </div>
    </div>
  );
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "NX";
}

/* ════════════════════════════════════════════════════════════
   ICONOS — unificados con lucide-react (mismo grosor, mismo estilo)
════════════════════════════════════════════════════════════ */

const ICON_STROKE = 1.8;

function Arrow({ color }: { color: string }) {
  return <ArrowRight size={14} color={color} strokeWidth={2.4} />;
}
function TrendUpInline({ color }: { color: string }) {
  return <TrendingUp size={22} color={color} strokeWidth={2.2} />;
}
function ClockIcon({ color = "#fff", size = 16 }: { color?: string; size?: number }) {
  return <Clock size={size} color={color} strokeWidth={ICON_STROKE} />;
}
function ClockBig({ color }: { color: string }) {
  return <Clock size={20} color={color} strokeWidth={ICON_STROKE} />;
}
function MoneyBig({ color }: { color: string }) {
  return <Wallet size={20} color={color} strokeWidth={ICON_STROKE} />;
}
function MoneyMini({ color }: { color: string }) {
  return <Wallet size={14} color={color} strokeWidth={ICON_STROKE} />;
}
function CalIcon() {
  return <CalendarDays size={14} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function BankIcon() {
  return <Landmark size={14} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function CardIcon() {
  return <CreditCard size={14} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function CalendarOff() {
  return <LCalendarOff size={16} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function BagMoney() {
  return <PiggyBank size={16} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function ShieldOk() {
  return <ShieldCheck size={16} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function FamilyIcon() {
  return <Users size={16} color="currentColor" strokeWidth={ICON_STROKE} />;
}
function PinIcon() {
  return <MapPin size={11} color={C.green} strokeWidth={ICON_STROKE} />;
}
function PhoneIcon() {
  return <Phone size={11} color={C.green} strokeWidth={ICON_STROKE} />;
}
function GlobeIcon() {
  return <Globe size={11} color={C.green} strokeWidth={ICON_STROKE} />;
}
