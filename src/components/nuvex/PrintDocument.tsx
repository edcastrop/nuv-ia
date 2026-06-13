import {
  Landmark, CreditCard, CalendarDays, Clock, Wallet, TrendingUp,
  CalendarOff as LCalendarOff, ShieldCheck, Users, MapPin, Phone, Globe,
  ArrowRight, PiggyBank,
} from "lucide-react";
import { NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
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
    pesosPropuestas, uvrPropuestas, bestIndex,
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

  // Fecha límite del beneficio (72 horas a partir de hoy)
  const fechaLimite = new Date(fechaBase);
  fechaLimite.setHours(fechaLimite.getHours() + 72);
  const fechaLimiteStr = fechaLimite.toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const ahorroTotal = recommended.ahorroTotal;
  const honorariosFinales = commercial?.hasDiscount ? commercial.finales : recommended.honorarios;
  const honorariosBase = commercial?.honorariosBase ?? recommended.honorarios;
  const descuento = commercial?.hasDiscount ? Math.max(0, honorariosBase - honorariosFinales) : 0;

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

  // -------- Alternativas (página 2) — todas las propuestas menos la seleccionada
  const alternativas = buildAlternativas({
    mode, pesosPropuestas, uvrPropuestas, bestIndex,
    cuotaActual, añoHoy, añoFinActual, añosActual,
  });

  // Todas las propuestas (incluyendo la recomendada) para el resumen comparativo
  const allPropuestas = mapPropuestasToAltRow(mode, pesosPropuestas, uvrPropuestas, cuotaActual);

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
          background: C.black, color: "#fff", padding: "12px 22px",
          display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: 20,
          breakInside: "avoid", pageBreakInside: "avoid",
        }}>
          <img
            src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
            style={{ height: 34, width: "auto", filter: "brightness(0) invert(1)" }}
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
          padding: "16px 22px 9px 22px",
          display: "grid", gridTemplateColumns: "1.62fr 0.38fr", gap: 18, alignItems: "center",
          breakInside: "avoid", pageBreakInside: "avoid",
        }}>
          <div>
            <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
              Hola, <span style={{ color: C.azul, fontWeight: 800 }}>{primerNombre}</span>
            </div>
            <h1 style={{
              margin: 0, fontSize: 36, lineHeight: 1.01, fontWeight: 900,
              color: C.black, letterSpacing: "-0.035em",
            }}>
              Recupera parte de<br />
              tu <span style={{ color: C.green }}>vida financiera</span>
            </h1>
            <p style={{
              marginTop: 7, fontSize: 10.5, lineHeight: 1.4, color: C.muted, maxWidth: 420,
            }}>
              Encontramos una oportunidad real de optimizar tu crédito
              sin cambiar de banco.
            </p>
          </div>
          <div style={{
            position: "relative", borderRadius: 12, overflow: "hidden",
            height: 90, boxShadow: "0 12px 28px -18px rgba(0,0,0,0.35)",
          }}>
            <img
              src={heroSunset} alt="" crossOrigin="anonymous"
              style={{
                position: "absolute", inset: 0,
                width: "100%", height: "100%", objectFit: "cover",
              }}
            />
          </div>
        </div>

        {/* ───── DATOS DEL CASO ───── */}
        <div style={{ padding: "0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: C.bgSoft, borderRadius: 12,
            padding: "10px 14px", display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1.2fr", gap: 18, alignItems: "center",
          }}>
            <MetaCol icon={<BankIcon />} label="BANCO" value={banco} />
            <MetaCol icon={<CardIcon />} label="PRODUCTO" value={`${productoLabel} ${monedaLabel}`} />
            <MetaCol icon={<CalIcon />} label="FECHA" value={fecha} />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.azul}, ${C.green})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 13, fontWeight: 800, flexShrink: 0,
              }}>
                {initialsOf(analista)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 7.5, letterSpacing: "0.22em", color: C.muted,
                  fontWeight: 800,
                }}>PREPARADO POR</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, lineHeight: 1.2 }}>
                  {analista}
                </div>
                <div style={{ fontSize: 9, color: C.muted, lineHeight: 1.2 }}>
                  Analista Financiero
                </div>
                <div style={{ fontSize: 9, color: C.green, fontWeight: 700, lineHeight: 1.2 }}>
                  Certificado NUVEX
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ───── 1. CUOTA HOY VS OPTIMIZADA ───── */}
        <div style={{ padding: "11px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <SectionTitle index="1" title="Tu cuota, hoy y con nuestra optimización" />
          <div style={{
            marginTop: 7,
            display: "grid", gridTemplateColumns: "1fr 36px 1fr 110px", gap: 12, alignItems: "stretch",
          }}>
            <CuotaCard
              eyebrow="VALOR ACTUAL DE TU CUOTA"
              sub="Hoy pagas"
              amount={cuotaActual}
              footer="Cuota mensual actual"
              color={C.ink}
              bg="#F4F6F8"
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#fff", border: `1px solid ${C.hairline}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 10px -6px rgba(0,0,0,0.15)",
              }}>
                <Arrow color={C.muted} />
              </div>
            </div>
            <CuotaCard
              eyebrow="NUEVO VALOR DE TU CUOTA"
              sub="Con la optimización"
              amount={nuevaCuota}
              footer="Nueva cuota mensual propuesta"
              color={C.greenDeep}
              bg={C.greenSoft}
            />
            <div style={{
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 4,
              padding: "0 4px",
            }}>
              <TrendUpInline color={C.green} />
              <div style={{
                fontSize: 24, fontWeight: 900, color: C.greenDeep,
                letterSpacing: "-0.02em", lineHeight: 1,
              }}>
                +{formatNumber(incrementoPct, 1)}%
              </div>
              <div style={{ fontSize: 9, color: C.muted, textAlign: "center", lineHeight: 1.25 }}>
                Aumento mensual<br />recomendado
              </div>
            </div>
          </div>
        </div>

        {/* ───── 2. IMPACTO FINANCIERO TOTAL ───── */}
        <div style={{ padding: "11px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <SectionTitle index="2" title="Impacto financiero total" />
          <div style={{
            marginTop: 7,
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
          }}>
            <ImpactCard
              icon={<ClockBig color={C.greenDeep} />}
              eyebrow="AHORRO EN TIEMPO"
              amount={`${añosEliminadosEntero} AÑOS`}
              sub={`${cuotasEliminadas} CUOTAS`}
              note={
                <>Pasas de terminar en <b>{añoFinActual}</b><br />a terminar en <b>{añoFinOpt}</b></>
              }
              accent={C.greenDeep}
              bg={C.greenSoft}
            />
            <ImpactCard
              icon={<MoneyBig color={C.azul} />}
              eyebrow="AHORRO EN DINERO"
              amount={formatCOP(ahorroTotal)}
              note={<>Menos intereses y seguros<br />durante toda la vida del crédito</>}
              accent={C.azul}
              bg={C.azulSoft}
            />
          </div>

          {/* Esto significa para ti y tu familia */}
          <div style={{
            marginTop: 8, background: "#fff",
            border: `1px solid ${C.hairline}`, borderRadius: 12,
            padding: "8px 14px",
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.22em", fontWeight: 800,
              color: C.muted, textAlign: "center", marginBottom: 5,
            }}>
              ESTO SIGNIFICA PARA TI Y TU FAMILIA
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12,
            }}>
              <BenefitItem icon={<CalendarOff />} label={<>Menos tiempo<br />endeudado</>} />
              <BenefitItem icon={<BagMoney />} label={<>Más dinero en<br />tu bolsillo</>} />
              <BenefitItem icon={<ShieldOk />} label={<>Más tranquilidad<br />financiera</>} />
              <BenefitItem icon={<FamilyIcon />} label={<>Más oportunidades<br />para tu familia</>} />
            </div>
          </div>
        </div>

        {/* ───── 3. INVERSIÓN POR ÉXITO + 72H ───── */}
        <div style={{ padding: "10px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <SectionTitle index="3" title="Beneficio económico autorizado" />
          <div style={{
            marginTop: 7,
            display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12,
          }}>
            {/* Beneficio económico card */}
            <div style={{
              background: "#fff", border: `1px solid ${C.hairline}`,
              borderRadius: 12, padding: "9px 14px",
            }}>
              <PriceRow label="Tarifa estándar" value={formatCOP(honorariosBase)} strike />
              <div style={{ height: 1, background: C.hairline, margin: "7px 0" }} />
              <PriceRow label="Tarifa aprobada para este caso" value={formatCOP(honorariosFinales)} />
              <div style={{
                marginTop: 7, background: C.greenSoft,
                borderRadius: 10, padding: "7px 12px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: C.greenDeep,
                  letterSpacing: "0.12em",
                }}>AHORRO OBTENIDO</div>
                <div style={{
                  fontSize: 22, fontWeight: 900, color: C.greenDeep,
                  letterSpacing: "-0.02em",
                }}>
                  {formatCOP(descuento > 0 ? descuento : 0)}
                </div>
              </div>
            </div>

            {/* Urgencia con fecha exacta */}
            <div style={{
              background: C.red, color: "#fff", borderRadius: 12,
              padding: "9px 12px", display: "flex", flexDirection: "column",
              justifyContent: "center", textAlign: "center",
            }}>
              <div style={{
                fontSize: 9, letterSpacing: "0.22em", fontWeight: 700, opacity: 0.95,
              }}>BENEFICIO VÁLIDO HASTA</div>
              <div style={{
                fontSize: 15, fontWeight: 900, marginTop: 4, letterSpacing: "-0.005em",
                textTransform: "uppercase",
              }}>
                {fechaLimiteStr}
              </div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 6, marginTop: 6,
                borderTop: "1px solid rgba(255,255,255,0.25)", paddingTop: 6,
              }}>
                <ClockIcon color="#fff" size={16} />
                <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>
                  72 HORAS
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ───── CIERRE EMOCIONAL PREMIUM (full width) ───── */}
        <div style={{ padding: "10px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.black} 0%, #1a1a1a 100%)`,
            color: "#fff", borderRadius: 14, padding: "13px 20px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -10, left: 18,
              fontSize: 58, color: C.green, lineHeight: 1, fontWeight: 900, opacity: 0.28,
            }}>“</div>
            <div style={{
              fontSize: 12, color: C.green, fontWeight: 800, letterSpacing: "0.04em",
              marginBottom: 4, position: "relative",
            }}>
              Una reflexión final
            </div>
            <p style={{
              margin: 0, fontSize: 11, lineHeight: 1.34,
              color: "rgba(255,255,255,0.94)", position: "relative", maxWidth: "92%",
            }}>
              Dentro de algunos años este crédito terminará de una u otra forma.
              La diferencia es decidir si deseas continuar el camino actual
              o <span style={{ color: C.green, fontWeight: 700 }}>recuperar parte de tu tiempo financiero</span>.
              <br /><br />
              Cada cuota eliminada representa tiempo que vuelve a tu vida,
              a tu familia y a tus proyectos.
            </p>
            <div style={{
              marginTop: 8, paddingTop: 7,
              borderTop: "1px solid rgba(255,255,255,0.15)",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.85)" }}>
                La decisión siempre será tuya. Nosotros ya hicimos los cálculos.
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: SCRIPT, fontSize: 26, color: C.green, lineHeight: 1,
                }}>{analista}</div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.6)", marginTop: 2, letterSpacing: "0.12em" }}>
                  ANALISTA NUVEX
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ───── FOOTER ───── */}
        <FooterStrip />
      </section>

      {/* ============================================================
          PÁGINA 2 — OTRAS PROYECCIONES + RESUMEN + CIERRE
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
              ALTERNATIVAS ANALIZADAS
            </div>
            <div style={{
              marginTop: 3, fontSize: 10, color: "rgba(255,255,255,0.82)", lineHeight: 1.3, maxWidth: 480,
            }}>
              Estas alternativas fueron evaluadas por nuestro sistema para ayudarte
              a comparar distintos niveles de optimización financiera.
            </div>
          </div>
          <img
            src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
            style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }}
          />
        </div>

        {/* 3 proyecciones — clasificación dinámica por incremento de cuota */}
        <div style={{
          padding: "12px 22px 0 22px",
          display: "flex", flexDirection: "column", gap: 9,
        }}>
          {alternativas.slice(0, 3).map((alt, i) => {
            const total = Math.min(3, alternativas.length);
            const dyn = dynamicScenarioMeta(i, total);
            return (
              <AlternativaCard
                key={i}
                index={i + 1}
                label={dyn.label}
                accent={dyn.accent}
                soft={dyn.soft}
                deep={dyn.deep}
                cuota={alt.nuevaCuota}
                cuotaPct={alt.incrementoPct}
                ahorroAños={alt.añosEliminados}
                ahorroCuotas={alt.cuotasEliminadas}
                ahorroDinero={alt.ahorroTotal}
                terminaEn={alt.añoFinOpt}
                terminaActual={añoFinActual}
                añoHoy={añoHoy}
                añosActuales={añosActual}
                añosOpt={alt.añosOpt}
                quienIdeal={dyn.ideal}
              />
            );
          })}
        </div>

        {/* ───── RESUMEN DE ESCENARIOS ───── */}
        <div style={{ padding: "12px 22px 0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <ResumenEscenarios
            allPropuestas={allPropuestas}
            bestIndex={bestIndex}
          />
        </div>

        {/* Spacer flexible (evita página 3 y reparte el alto) */}
        <div style={{ flex: "1 1 auto", minHeight: 4 }} />

        {/* ───── HERO DE CIERRE (full width) ───── */}
        <div style={{ padding: "0 22px", breakInside: "avoid", pageBreakInside: "avoid" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.black} 0%, #1a1a1a 60%, #1f2a4a 130%)`,
            color: "#fff", borderRadius: 14, padding: "18px 22px",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center",
            boxShadow: "0 18px 40px -22px rgba(0,0,0,0.45)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", right: -20, top: -30, width: 180, height: 180,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${C.green}44 0%, transparent 70%)`,
            }} />
            <div style={{ position: "relative" }}>
              <div style={{
                fontSize: 11, fontWeight: 900, color: C.green, letterSpacing: "0.18em",
              }}>
                UNA DECISIÓN, DOS CAMINOS
              </div>
              <div style={{
                marginTop: 5, fontSize: 19, fontWeight: 900, lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}>
                Tu crédito terminará de una u otra forma.
              </div>
              <div style={{
                marginTop: 4, fontSize: 12, lineHeight: 1.4, color: "rgba(255,255,255,0.88)",
                maxWidth: 480,
              }}>
                La diferencia es decidir si deseas recuperar parte de
                <span style={{ color: C.green, fontWeight: 800 }}> tu tiempo financiero</span>.
              </div>
            </div>
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
              position: "relative",
            }}>
              <div style={{
                background: C.green, color: "#0E1F14",
                padding: "12px 20px", borderRadius: 10,
                fontSize: 12.5, fontWeight: 900, letterSpacing: "0.06em",
                boxShadow: "0 10px 24px -10px rgba(132,185,143,0.6)",
              }}>
                CONTACTAR A {analista.toUpperCase()}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", letterSpacing: "0.16em", fontWeight: 700 }}>
                ASESORÍA SIN COSTO · 72 HORAS
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
}: {
  allPropuestas: AltRow[];
  bestIndex: number;
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
          RESUMEN DE ESCENARIOS
        </div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em", fontWeight: 700 }}>
          COMPARATIVA RÁPIDA
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 1fr 1fr 1fr",
        background: C.bgSoft,
        fontSize: 8.5, fontWeight: 800, color: C.muted, letterSpacing: "0.16em",
      }}>
        <div style={{ padding: "7px 12px" }}>ALTERNATIVA</div>
        <div style={{ padding: "7px 12px", textAlign: "right" }}>NUEVA CUOTA</div>
        <div style={{ padding: "7px 12px", textAlign: "right" }}>TIEMPO RECUPERADO</div>
        <div style={{ padding: "7px 12px", textAlign: "right" }}>AHORRO ECONÓMICO</div>
      </div>
      {rows.map((r, i) => (
        <ResumenRow
          key={i}
          isRecommended={r.isRecommended}
          label={r.label}
          cuota={r.data.nuevaCuota}
          años={Math.round(r.data.añosEliminados)}
          dinero={r.data.ahorroTotal}
        />
      ))}
    </div>
  );
}

function ResumenRow({
  isRecommended = false,
  label,
  cuota,
  años,
  dinero,
}: {
  isRecommended?: boolean;
  label: string;
  cuota: number;
  años: number;
  dinero: number;
}) {
  if (isRecommended) {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "1.15fr 1fr 1fr 1fr",
        borderTop: `2px solid ${C.green}`,
        background: `linear-gradient(90deg, ${C.greenSoft} 0%, #fff 100%)`,
        alignItems: "center",
      }}>
        <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            background: C.greenDeep, color: "#fff",
            padding: "3px 8px", borderRadius: 4,
            fontSize: 8.5, fontWeight: 900, letterSpacing: "0.14em",
            display: "flex", alignItems: "center", gap: 4,
          }}>
            <span>★</span>
            <span>RECOMENDADA POR NUVEX</span>
          </div>
        </div>
        <div style={{ padding: "10px 12px", textAlign: "right", fontSize: 12.5, fontWeight: 900, color: C.greenDeep }}>
          {formatCOP(cuota)}
        </div>
        <div style={{ padding: "10px 12px", textAlign: "right", fontSize: 12.5, fontWeight: 900, color: C.greenDeep }}>
          {años} AÑOS
        </div>
        <div style={{ padding: "10px 12px", textAlign: "right", fontSize: 12.5, fontWeight: 900, color: C.greenDeep }}>
          {formatCOP(dinero)}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1.15fr 1fr 1fr 1fr",
      borderTop: `1px solid ${C.hairline}`,
      alignItems: "center",
    }}>
      <div style={{ padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.muted }} />
        <div style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{label}</div>
      </div>
      <div style={{ padding: "7px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.ink }}>
        {formatCOP(cuota)}
      </div>
      <div style={{ padding: "7px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.ink }}>
        {años} años
      </div>
      <div style={{ padding: "7px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: C.ink }}>
        {formatCOP(dinero)}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ALTERNATIVAS — paletas + builder
════════════════════════════════════════════════════════════ */
const ALT_PALETTES = [
  { label: "Escenario balanceado",  accent: NUVEX.verde, soft: "#E8F4EA", deep: "#3F8C57",
    ideal: "Para quienes buscan un equilibrio entre incrementar su cuota y recuperar tiempo de deuda con un impacto financiero significativo." },
  { label: "Escenario agresivo",    accent: NUVEX.azul, soft: "#E3E8F5", deep: "#2F4380",
    ideal: "Para quienes desean reducir el tiempo de su crédito al máximo y generar el mayor ahorro posible en intereses y seguros." },
  { label: "Escenario conservador", accent: "#7C5BB7", soft: "#EDE5F7", deep: "#553B86",
    ideal: "Para quienes prefieren un incremento moderado en su cuota y una recuperación de tiempo más gradual." },
];

interface AltRow {
  nuevaCuota: number;
  incrementoPct: number;
  añosEliminados: number;
  cuotasEliminadas: number;
  ahorroTotal: number;
  añoFinOpt: number;
  añosOpt: number;
}

function buildAlternativas(args: {
  mode: "pesos" | "uvr";
  pesosPropuestas?: PesosPropuesta[];
  uvrPropuestas?: UVRPropuesta[];
  bestIndex: number;
  cuotaActual: number;
  añoHoy: number;
  añoFinActual: number;
  añosActual: number;
}): AltRow[] {
  const { mode, pesosPropuestas, uvrPropuestas, bestIndex, cuotaActual, añoHoy } = args;
  const fechaBase = new Date();

  if (mode === "uvr") {
    const arr = uvrPropuestas || [];
    return arr
      .map((p, idx) => ({ p, idx }))
      .filter(({ idx }) => idx !== bestIndex)
      .map(({ p }) => mapUVR(p))
      .sort((a, b) => a.añosEliminados - b.añosEliminados); // de menor a mayor agresividad
  }
  const arr = pesosPropuestas || [];
  return arr
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => idx !== bestIndex)
    .map(({ p }) => mapPesos(p))
    .sort((a, b) => a.añosEliminados - b.añosEliminados);

  function mapPesos(p: PesosPropuesta): AltRow {
    const cuota = p.nuevaCuotaConSeguro;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
    };
  }
  function mapUVR(p: UVRPropuesta): AltRow {
    const cuota = p.nuevaCuotaConSeguroAprox;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
    };
  }
}

function mapPropuestasToAltRow(
  mode: "pesos" | "uvr",
  pesosPropuestas: PesosPropuesta[] | undefined,
  uvrPropuestas: UVRPropuesta[] | undefined,
  cuotaActual: number,
): AltRow[] {
  const fechaBase = new Date();
  if (mode === "uvr") {
    return (uvrPropuestas || []).map((p) => {
      const cuota = p.nuevaCuotaConSeguroAprox;
      const fechaFin = new Date(fechaBase);
      fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
      return {
        nuevaCuota: cuota,
        incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
        añosEliminados: p.añosEliminados,
        cuotasEliminadas: p.cuotasEliminadas,
        ahorroTotal: p.ahorroTotal,
        añoFinOpt: fechaFin.getFullYear(),
        añosOpt: p.nuevoPlazo / 12,
      };
    });
  }
  return (pesosPropuestas || []).map((p) => {
    const cuota = p.nuevaCuotaConSeguro;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    return {
      nuevaCuota: cuota,
      incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0,
      añosEliminados: p.añosEliminados,
      cuotasEliminadas: p.cuotasEliminadas,
      ahorroTotal: p.ahorroTotal,
      añoFinOpt: fechaFin.getFullYear(),
      añosOpt: p.nuevoPlazo / 12,
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

function AlternativaCard(props: {
  index: number; label: string; accent: string; soft: string; deep: string;
  cuota: number; cuotaPct: number;
  ahorroAños: number; ahorroCuotas: number; ahorroDinero: number;
  terminaEn: number; terminaActual: number;
  añoHoy: number; añosActuales: number; añosOpt: number;
  quienIdeal: string;
}) {
  const {
    index, label, accent, soft, deep,
    cuota, cuotaPct, ahorroAños, ahorroCuotas, ahorroDinero,
    terminaEn, terminaActual, añoHoy, añosActuales, añosOpt, quienIdeal,
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
          {label}
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

      {/* Ideal */}
      <div style={{
        marginTop: 6, background: soft, borderRadius: 8,
        padding: "5px 10px",
      }}>
        <div style={{ fontSize: 8.8, color: C.text, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          <span style={{ fontWeight: 800, color: deep, fontStyle: "italic" }}>Ideal para: </span>
          {quienIdeal}
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
        padding: "8px 18px",
        display: "grid",
        gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
        gap: 10, alignItems: "center",
        breakInside: "avoid", pageBreakInside: "avoid",
      }}
    >
      <img
        src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
        style={{ height: 20, width: "auto", filter: "brightness(0) invert(1)" }}
      />
      <FooterItem icon={<PinIcon />} title="Bucaramanga" lines={["Carrera 16 # 37-48 Piso 4", "Centro"]} />
      <FooterItem icon={<PinIcon />} title="Bogotá" lines={["Calle 93 # 18 - 28", "Oficina 704"]} />
      <FooterItem icon={<PhoneIcon />} title="" lines={["+57 316 402 3779"]} />
      <FooterItem icon={<GlobeIcon />} title="" lines={["www.nuvex.com.co"]} />
    </div>
  );
}

function FooterItem({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{
        width: 19, height: 19, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ fontSize: 7.8, lineHeight: 1.25 }}>
        {title && <div style={{ fontWeight: 800, color: "#fff" }}>{title}</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function QRPlaceholder() {
  // Simple geometric QR-style placeholder so el bloque luzca completo
  return (
    <div style={{
      width: 60, height: 60, background: "#fff",
      border: `1px solid ${C.hairline}`, borderRadius: 8,
      display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: 4, gap: 1,
    }}>
      {Array.from({ length: 49 }).map((_, i) => {
        const on = [0,1,2,5,6,7,8,9,13,14,16,18,19,21,23,25,28,31,33,35,37,39,42,44,45,46,47,48].includes(i);
        return (
          <div key={i} style={{ background: on ? C.black : "transparent" }} />
        );
      })}
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
   ICONOS
════════════════════════════════════════════════════════════ */

function Arrow({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TrendUpInline({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 17l8-8 4 4 8-6M16 7h4v4" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ClockIcon({ color = "#fff", size = 16 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ClockBig({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M12 7v5l3.5 2.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function MoneyBig({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M9 9c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2M12 6.5v11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function MoneyMini({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
      <path d="M9 9c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 2-3 2-3 .9-3 2 1.3 2 3 2 3-.9 3-2M12 6.5v11" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CalIconBig() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="#fff" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BankIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 10l9-6 9 6M5 10v8M19 10v8M3 20h18M9 10v8M15 10v8"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function CalendarOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 10h17M8 3v4M16 3v4M9 16l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BagMoney() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h8l2 4c0 5-2.5 9-6 9s-6-4-6-9l2-4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 11v4M10 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ShieldOk() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8.3-8 9-4.5-.7-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FamilyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 19c1-3 3-4.4 5-4.4S12 16 13 19M11 19c1-3 3-4.4 5-4.4S20 16 21 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke={C.green} strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.5" stroke={C.green} strokeWidth="1.6" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h3l2 5-2 1c1 2.5 3 4.5 5.5 5.5l1-2 5 2v3a2 2 0 01-2 2C9.5 20 4 14.5 4 6a2 2 0 011-2z"
        stroke={C.green} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={C.green} strokeWidth="1.6" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={C.green} strokeWidth="1.6" />
    </svg>
  );
}
