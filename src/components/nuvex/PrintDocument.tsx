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
   NUVEX — Propuesta Financiera Personalizada (1 página A4)
   Diseño basado en boceto cliente · jun 2026
============================================================ */
const C = {
  navy: "#0B1E4A",        // header/footer/dark blocks
  navyDeep: "#081539",
  ink: "#1A1F2E",
  text: "#2C3142",
  muted: "#6B7280",
  hairline: "#E5E9F0",
  paper: "#FFFFFF",
  cream: "#F6F4EE",
  greenNuvex: "#5BB76A",
  greenSoft: "#E8F4EA",
  greenDeep: "#3F8C57",
  red: "#D94F4F",
  redSoft: "#FCE6E5",
  redDeep: "#B43A3A",
  azul: NUVEX.azul,
};

const FONT = "'Inter','Manrope','SF Pro Display',ui-sans-serif,system-ui,sans-serif";
const SCRIPT = "'Allura','Caveat','Brush Script MT',cursive";

export function PrintDocument(props: Props) {
  const { mode, client, recommended, scenario, commercial } = props;
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";

  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });

  const añosActual = scenario.plazoActual / 12;
  const añosOpt = scenario.nuevoPlazo / 12;
  const añosEliminados = Math.max(0, añosActual - añosOpt);
  const añosEliminadosEntero = Math.max(0, Math.round(añosEliminados));

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

  const nombreCliente = (client.nombre || "Cliente").toUpperCase();
  const primerNombre = (client.nombre || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const analista = client.asesor || "Equipo NUVEX";
  const banco = client.banco || "—";
  const producto = client.tipoProducto || "Crédito Hipotecario";

  // Porcentaje visual de la barra CON NUVEX respecto a SIN NUVEX
  const optBarPct = Math.max(20, Math.min(95, (añosOpt / Math.max(añosActual, 1)) * 100));

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
      {/* ════════════ HEADER DARK NAVY ════════════ */}
      <div
        style={{
          background: C.navy,
          padding: "14px 22px 56px 22px",
          color: "#fff",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          {/* Logo + tag */}
          <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
            <img
              src={logoNuvex}
              alt="NUVEX"
              style={{ height: 36, width: "auto", filter: "brightness(0) invert(1)" }}
              crossOrigin="anonymous"
            />
            <div
              style={{
                width: 1, height: 28, background: "rgba(255,255,255,0.18)",
              }}
            />
            <div style={{ fontSize: 10.5, lineHeight: 1.3, color: "rgba(255,255,255,0.85)" }}>
              Optimizamos tu crédito,
              <br />
              <span style={{ color: C.greenNuvex, fontWeight: 700 }}>recuperas tu tiempo y tu dinero.</span>
            </div>
          </div>

          {/* Tag derecha */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldIcon />
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 9, letterSpacing: "0.22em", color: C.greenNuvex, fontWeight: 700 }}>
                PROPUESTA FINANCIERA
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", marginTop: 1 }}>
                PERSONALIZADA
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ CARD CLIENTE (flotante) ════════════ */}
      <div style={{ padding: "0 16px", marginTop: -42, position: "relative", zIndex: 2 }}>
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 18px 40px -22px rgba(11,30,74,0.35)",
            padding: "16px 22px",
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr 0.95fr",
            gap: 18,
            alignItems: "center",
          }}
        >
          <ClientCol
            kicker="CLIENTE"
            avatarColor={C.greenNuvex}
            title={nombreCliente}
            titleSize={13.5}
          />
          <ClientCol
            kicker="PREPARADO POR"
            avatarColor={C.azul}
            title={analista}
            titleSize={12.5}
            sub={
              <>
                <div style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>Analista Financiero Senior</div>
                <div style={{ fontSize: 10, color: C.azul, fontWeight: 700, marginTop: 1 }}>
                  NUVEX Finanzas Inteligentes
                </div>
              </>
            }
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 9.5 }}>
            <MetaRow icon={<CalIcon />} label="FECHA" value={fecha} />
            <MetaRow icon={<BankIcon />} label="BANCO" value={banco} />
            <MetaRow icon={<CardIcon />} label="PRODUCTO" value={producto} />
          </div>
        </div>
      </div>

      {/* ════════════ HERO ════════════ */}
      <section
        style={{
          margin: "14px 16px 0 16px",
          borderRadius: 12,
          overflow: "hidden",
          position: "relative",
          minHeight: 285,
          background: "#F2F2EE",
        }}
      >
        <img
          src={heroSunset}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.95,
          }}
        />
        {/* Gradiente para legibilidad lado izquierdo */}
        <div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.78) 38%, rgba(255,255,255,0.0) 62%)",
          }}
        />
        <div style={{ position: "relative", padding: "22px 24px", display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 16 }}>
          {/* Texto */}
          <div>
            <h1 style={{
              margin: 0, fontSize: 50, lineHeight: 0.95, fontWeight: 900, color: C.ink,
              letterSpacing: "-0.035em", textTransform: "uppercase",
            }}>
              <div>Recupera</div>
              <div style={{ color: C.greenNuvex }}>{añosEliminadosEntero} {añosEliminadosEntero === 1 ? "año" : "años"}</div>
              <div>de tu vida</div>
              <div>financiera</div>
            </h1>
            <p style={{
              marginTop: 14, fontSize: 10.5, lineHeight: 1.55, color: C.text, maxWidth: 290,
            }}>
              Con la optimización de tu crédito puedes reducir significativamente el tiempo de deuda
              y ahorrar dinero para lo que realmente importa.
            </p>
          </div>

          {/* Tarjetas comparativas (CON / SIN NUVEX) */}
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <CompareCard
                icon={<CheckCircle color={C.greenNuvex} />}
                label="CON NUVEX"
                year={añoFinOpt}
                yearColor={C.greenDeep}
                pill={`${formatNumber(añosOpt, 1)} años`}
                pillBg={C.greenSoft}
                pillFg={C.greenDeep}
              />
              <CompareCard
                icon={<XCircle color={C.red} />}
                label="SIN NUVEX"
                year={añoFinActual}
                yearColor={C.redDeep}
                pill={`${formatNumber(añosActual, 1)} años`}
                pillBg={C.redSoft}
                pillFg={C.redDeep}
              />
            </div>
            {/* Banda inferior recuperados */}
            <div
              style={{
                marginTop: 10,
                background: C.navy, color: "#fff",
                borderRadius: 10,
                padding: "10px 14px",
                display: "flex", alignItems: "center", gap: 10,
              }}
            >
              <div
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  border: `2px solid ${C.greenNuvex}`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <ClockIcon color={C.greenNuvex} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 900, color: C.greenNuvex, letterSpacing: "0.04em" }}>
                  {añosEliminadosEntero} {añosEliminadosEntero === 1 ? "AÑO RECUPERADO" : "AÑOS RECUPERADOS"}
                </div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.78)" }}>
                  Más tiempo para lo que realmente importa.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ LÍNEA DE TIEMPO ════════════ */}
      <section style={{ margin: "16px 16px 0 16px" }}>
        <div style={{
          fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", color: C.ink, textTransform: "uppercase",
          marginBottom: 8,
        }}>
          Línea de tiempo comparativa
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 14, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <TimelineRow
              icon={<XCircle color={C.red} small />}
              label="SIN NUVEX"
              labelColor={C.text}
              startYear={añoHoy}
              endYear={añoFinActual}
              pill={`${formatNumber(añosActual, 1)} años`}
              pillBg={C.redSoft}
              pillFg={C.redDeep}
              barColor={C.red}
              widthPct={100}
            />
            <TimelineRow
              icon={<CheckCircle color={C.greenNuvex} small />}
              label="CON NUVEX"
              labelColor={C.text}
              startYear={añoHoy}
              endYear={añoFinOpt}
              pill={`${formatNumber(añosOpt, 1)} años`}
              pillBg={C.greenSoft}
              pillFg={C.greenDeep}
              barColor={C.greenNuvex}
              widthPct={optBarPct}
            />
          </div>
          {/* Card lateral diferencia */}
          <div style={{
            background: "#F6F7F9", border: `1px solid ${C.hairline}`, borderRadius: 10,
            padding: "12px 10px", textAlign: "center",
          }}>
            <HourglassIcon />
            <div style={{ fontSize: 22, fontWeight: 900, color: C.ink, marginTop: 4, letterSpacing: "-0.02em" }}>
              {añosEliminadosEntero} {añosEliminadosEntero === 1 ? "AÑO" : "AÑOS"}
            </div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: -2 }}>de diferencia</div>
          </div>
        </div>
      </section>

      {/* ════════════ DINERO + BULLETS ════════════ */}
      <section style={{
        margin: "16px 16px 0 16px",
        display: "grid", gridTemplateColumns: "1fr 1fr 0.78fr", gap: 12,
      }}>
        <MoneyCard
          tone="red"
          eyebrow="LO QUE ESTÁS DEJANDO DE AHORRAR"
          sub="SIN NUVEX"
          amount={ahorroTotal}
          note="seguirán saliendo de tu bolsillo en intereses y seguros."
          icon={<TrendDownIcon />}
        />
        <MoneyCard
          tone="green"
          eyebrow="LO QUE PUEDES AHORRAR"
          sub="CON NUVEX"
          amount={ahorroTotal}
          note="se quedan para tu patrimonio y el de tu familia."
          icon={<TrendUpIcon />}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", paddingLeft: 4 }}>
          {[
            "Menos intereses",
            "Menos tiempo de deuda",
            "Más patrimonio",
            "Más tranquilidad financiera",
          ].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CheckCircle color={C.greenNuvex} small />
              <span style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════ INVERSIÓN POR ÉXITO + 72H ════════════ */}
      <section style={{
        margin: "14px 16px 0 16px",
        display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12,
      }}>
        {/* Inversión por éxito (navy) */}
        <div style={{
          background: C.navy, color: "#fff", borderRadius: 12, padding: "16px 18px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <DiamondIcon />
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.18em" }}>INVERSIÓN POR ÉXITO</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", alignItems: "center", gap: 6 }}>
            <InvestCol
              label="HONORARIOS NORMALES"
              value={formatCOP(honorariosBase)}
              strike
              faded
            />
            <Arrow color="rgba(255,255,255,0.55)" />
            <InvestCol
              label={<>PRECIO PREFERENCIAL<br />AUTORIZADO</>}
              value={formatCOP(honorariosFinales)}
              accent={C.greenNuvex}
            />
            <Arrow color="rgba(255,255,255,0.55)" />
            <div style={{
              background: C.greenNuvex, color: "#fff", borderRadius: 10, padding: "10px 8px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 9, letterSpacing: "0.18em", fontWeight: 700, opacity: 0.95 }}>AHORRAS</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2, letterSpacing: "-0.02em" }}>
                {formatCOP(descuento > 0 ? descuento : 0)}
              </div>
            </div>
          </div>
        </div>

        {/* 72 horas */}
        <div style={{
          background: C.red, color: "#fff", borderRadius: 12, padding: "14px 16px",
          display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center",
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: "0.22em", fontWeight: 700, opacity: 0.95 }}>
            OFERTA VÁLIDA SOLO POR
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 4 }}>
            <ClockIcon color="#fff" size={22} />
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>72 HORAS</div>
          </div>
          <div style={{ fontSize: 9, marginTop: 2, opacity: 0.92, lineHeight: 1.4 }}>
            Después de este plazo la propuesta vuelve a tarifa estándar.
          </div>
        </div>
      </section>

      {/* ════════════ CIERRE TRIPARTITO ════════════ */}
      <section style={{
        margin: "12px 16px 0 16px",
        display: "grid", gridTemplateColumns: "1fr 1.05fr 0.9fr", gap: 12,
      }}>
        {/* Quote dark */}
        <div style={{
          background: C.navy, color: "#fff", borderRadius: 12, padding: "16px 16px",
        }}>
          <div style={{ fontSize: 26, color: C.greenNuvex, lineHeight: 0.8, fontWeight: 900 }}>“</div>
          <p style={{ margin: "2px 0 0 0", fontSize: 10.5, lineHeight: 1.5, color: "rgba(255,255,255,0.92)" }}>
            La diferencia entre quienes transforman sus finanzas y quienes no lo hacen, suele ser
            una sola decisión tomada a tiempo.
          </p>
          <div style={{
            marginTop: 10, fontSize: 11, fontWeight: 900, color: C.greenNuvex,
            letterSpacing: "0.06em", lineHeight: 1.3,
          }}>
            TÚ ESTÁS A UNA DECISIÓN<br />DE CAMBIAR TU FUTURO.
          </div>
        </div>

        {/* Mensaje personal */}
        <div style={{ padding: "4px 4px 4px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{primerNombre},</div>
          <p style={{ margin: "6px 0 0 0", fontSize: 10.5, lineHeight: 1.5, color: C.text }}>
            Cada año que eliminas de tu crédito es un año que recuperas para tus proyectos, tu
            familia y tu patrimonio.
          </p>
          <p style={{ margin: "6px 0 0 0", fontSize: 10.5, lineHeight: 1.5, color: C.text }}>
            Hoy tienes una oportunidad real de optimizar tu crédito respaldada por análisis
            financiero especializado.
          </p>
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: C.ink, lineHeight: 1.45 }}>
            La decisión es tuya.<br />Nosotros ya hicimos los cálculos.
          </div>
        </div>

        {/* Firma */}
        <div style={{ textAlign: "right", paddingRight: 4 }}>
          <div style={{ fontSize: 10, color: C.muted, fontStyle: "italic" }}>Atentamente,</div>
          <div style={{
            fontFamily: SCRIPT, fontSize: 30, color: C.azul, lineHeight: 1,
            marginTop: 6, letterSpacing: "0.01em",
          }}>
            {analista}
          </div>
          <div style={{ height: 1, background: C.hairline, margin: "8px 0 6px auto", width: "82%" }} />
          <div style={{ fontSize: 11, fontWeight: 800, color: C.ink }}>{analista}</div>
          <div style={{ fontSize: 9.5, color: C.muted, marginTop: 1 }}>Analista Financiero Senior</div>
          <div style={{ fontSize: 9.5, color: C.azul, fontWeight: 700 }}>NUVEX Finanzas Inteligentes</div>
        </div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <div style={{
        marginTop: 14,
        background: C.navy, color: "#fff",
        padding: "14px 22px",
        display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr", gap: 14,
        alignItems: "center",
      }}>
        <div>
          <img
            src={logoNuvex}
            alt="NUVEX"
            style={{ height: 28, width: "auto", filter: "brightness(0) invert(1)" }}
            crossOrigin="anonymous"
          />
        </div>
        <FooterItem icon={<PinIcon />} title="Bucaramanga" lines={["Carrera 16 # 37-48 Piso 4", "Centro"]} />
        <FooterItem icon={<PinIcon />} title="Bogotá" lines={["Calle 93 # 18 - 28 Oficina 704"]} />
        <FooterItem icon={<PhoneIcon />} title="" lines={["+57 316 402 3779"]} />
        <FooterItem icon={<GlobeIcon />} title="" lines={["www.nuvex.com.co"]} />
      </div>
    </div>
  );
}

/* ════════════ SUBCOMPONENTES ════════════ */

function ClientCol({
  kicker, avatarColor, title, titleSize = 13, sub,
}: { kicker: string; avatarColor: string; title: string; titleSize?: number; sub?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        border: `2px solid ${avatarColor}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <PersonIcon color={avatarColor} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 8.5, letterSpacing: "0.22em", color: C.muted, fontWeight: 800 }}>{kicker}</div>
        <div style={{
          fontSize: titleSize, fontWeight: 900, color: C.ink, lineHeight: 1.15, marginTop: 2,
          letterSpacing: "-0.005em",
        }}>
          {title}
        </div>
        {sub}
      </div>
    </div>
  );
}

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 18, display: "flex", justifyContent: "center", color: C.muted }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 7.5, letterSpacing: "0.22em", color: C.muted, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: C.ink, lineHeight: 1.2 }}>{value}</div>
      </div>
    </div>
  );
}

function CompareCard({
  icon, label, year, yearColor, pill, pillBg, pillFg,
}: {
  icon: React.ReactNode; label: string; year: number; yearColor: string;
  pill: string; pillBg: string; pillFg: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, padding: "12px 10px",
      boxShadow: "0 10px 24px -16px rgba(11,30,74,0.35)",
      textAlign: "center", position: "relative",
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginTop: -22 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%", background: "#fff",
          border: "1px solid #ECECEC", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 14px -10px rgba(11,30,74,0.25)",
        }}>{icon}</div>
      </div>
      <div style={{ fontSize: 9.5, letterSpacing: "0.18em", fontWeight: 800, color: C.muted, marginTop: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, color: yearColor, lineHeight: 1, marginTop: 4, letterSpacing: "-0.02em" }}>
        {year}
      </div>
      <div style={{ marginTop: 6, display: "inline-block",
        background: pillBg, color: pillFg, fontSize: 9.5, fontWeight: 800,
        borderRadius: 999, padding: "3px 10px",
      }}>{pill}</div>
      <div style={{ fontSize: 8, letterSpacing: "0.22em", color: C.muted, fontWeight: 700, marginTop: 6 }}>
        TERMINAS EN
      </div>
    </div>
  );
}

function TimelineRow({
  icon, label, labelColor, startYear, endYear, pill, pillBg, pillFg, barColor, widthPct,
}: {
  icon: React.ReactNode; label: string; labelColor: string;
  startYear: number; endYear: number;
  pill: string; pillBg: string; pillFg: string;
  barColor: string; widthPct: number;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 50px 1fr 70px", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <div style={{ fontSize: 11, fontWeight: 800, color: labelColor, letterSpacing: "0.06em" }}>{label}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{startYear}</div>
        <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>Hoy</div>
      </div>
      <div style={{ position: "relative", height: 22 }}>
        {/* baseline */}
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 2,
          background: "repeating-linear-gradient(90deg, #D9DEE7 0 4px, transparent 4px 8px)",
          transform: "translateY(-50%)",
        }} />
        {/* progress */}
        <div style={{
          position: "absolute", top: "50%", left: 0, height: 3,
          width: `${widthPct}%`, background: barColor, transform: "translateY(-50%)",
          borderRadius: 2,
        }} />
        {/* end dot */}
        <div style={{
          position: "absolute", top: "50%", left: `calc(${widthPct}% - 6px)`, transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%", background: barColor,
          boxShadow: `0 0 0 3px ${barColor}26`,
        }} />
        {/* pill encima */}
        <div style={{
          position: "absolute", top: -4, left: `${Math.max(8, widthPct / 2 - 12)}%`,
          background: pillBg, color: pillFg, fontSize: 9, fontWeight: 800,
          borderRadius: 999, padding: "2px 8px",
        }}>{pill}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, lineHeight: 1 }}>{endYear}</div>
        <div style={{ fontSize: 8, color: C.muted, marginTop: 1 }}>Fin del crédito</div>
      </div>
    </div>
  );
}

function MoneyCard({
  tone, eyebrow, sub, amount, note, icon,
}: {
  tone: "red" | "green"; eyebrow: string; sub: string; amount: number; note: string; icon: React.ReactNode;
}) {
  const isRed = tone === "red";
  const bg = isRed ? "#FDECEC" : "#EAF6EE";
  const border = isRed ? "#F6D2D0" : "#CFE8D6";
  const accent = isRed ? C.redDeep : C.greenDeep;
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: "12px 14px", position: "relative", overflow: "hidden",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.18em", fontWeight: 800, color: accent, textAlign: "center" }}>
        {eyebrow}
      </div>
      <div style={{ fontSize: 11, letterSpacing: "0.18em", fontWeight: 800, color: accent, textAlign: "center", marginTop: 2 }}>
        {sub}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
        <div style={{ flexShrink: 0, opacity: 0.85 }}>{icon}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: accent, letterSpacing: "-0.02em", lineHeight: 1 }}>
          {formatCOP(amount)}
        </div>
      </div>
      <div style={{ fontSize: 9.5, color: C.text, lineHeight: 1.4, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function InvestCol({
  label, value, strike = false, faded = false, accent,
}: { label: React.ReactNode; value: string; strike?: boolean; faded?: boolean; accent?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        fontSize: 8.5, letterSpacing: "0.2em", fontWeight: 800,
        color: faded ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.78)", lineHeight: 1.25,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 19, fontWeight: 900, marginTop: 4, letterSpacing: "-0.02em",
        color: accent ?? (faded ? "rgba(255,255,255,0.45)" : "#fff"),
        textDecoration: strike ? "line-through" : "none",
      }}>
        {value}
      </div>
    </div>
  );
}

function Arrow({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FooterItem({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ fontSize: 9.5, lineHeight: 1.4 }}>
        {title && <div style={{ fontWeight: 800, color: "#fff" }}>{title}</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ════════════ ICONOS (inline SVG) ════════════ */

function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke={color} strokeWidth="1.8" />
      <path d="M5 19c1.5-3.2 4-4.6 7-4.6S17.5 15.8 19 19" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%",
      border: `2px solid ${C.greenNuvex}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l8 3v6c0 5-3.5 8.3-8 9-4.5-.7-8-4-8-9V6l8-3z" stroke={C.greenNuvex} strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
function CheckCircle({ color, small = false }: { color: string; small?: boolean }) {
  const s = small ? 18 : 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
      <path d="M7.5 12.3l3 3 6-6.2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function XCircle({ color, small = false }: { color: string; small?: boolean }) {
  const s = small ? 18 : 22;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.8" />
      <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" />
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
function HourglassIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto" }}>
      <path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 10s-8 5-8 8M16 3c0 5-8 5-8 10s8 5 8 8"
        stroke={C.ink} strokeWidth="1.6" strokeLinecap="round" />
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
function TrendDownIcon() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", background: "#F8DAD8",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 7l8 8 4-4 8 6M16 17h4v-4" stroke={C.redDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
function TrendUpIcon() {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%", background: "#D6EBDA",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M4 17l8-8 4 4 8-6M16 7h4v4" stroke={C.greenDeep} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
function DiamondIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l4 5-4 13-4-13 4-5zM4 8h16" stroke={C.greenNuvex} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function PinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" stroke={C.greenNuvex} strokeWidth="1.6" />
      <circle cx="12" cy="10" r="2.5" stroke={C.greenNuvex} strokeWidth="1.6" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M5 4h3l2 5-2 1c1 2.5 3 4.5 5.5 5.5l1-2 5 2v3a2 2 0 01-2 2C9.5 20 4 14.5 4 6a2 2 0 011-2z"
        stroke={C.greenNuvex} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={C.greenNuvex} strokeWidth="1.6" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke={C.greenNuvex} strokeWidth="1.6" />
    </svg>
  );
}
