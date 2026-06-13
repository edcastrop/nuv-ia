import { CORPORATIVO, NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import logoNuvex from "@/assets/logo-nuvex.png";

interface MetricItem {
  label: string;
  value: string;
}

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
   NUVEX — Propuesta Premium de Cierre (Single-Page)
   Estilo: Apple Financial · Tesla Deck · Stripe Annual Report
============================================================ */
const C = {
  ink: "#0E0E0E",
  ink2: NUVEX.negro, // #242424
  muted: "#6B7280",
  hairline: "#ECECEC",
  paper: "#FFFFFF",
  azul: NUVEX.azul, // #445DA3
  verde: NUVEX.verde, // #84B98F
  verdeDeep: "#3F8C57",
  rojoSoft: "#FBECEC",
  rojoInk: "#A03A2C",
  verdeSoft: "#EAF6EE",
};

const FONT = "'Inter','Manrope','SF Pro Display',ui-sans-serif,system-ui,sans-serif";

function initials(name?: string): string {
  if (!name) return "NU";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "NU";
}

export function PrintDocument(props: Props) {
  const { mode, client, recommended, scenario, commercial } = props;
  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";

  const fecha = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const cuotasEliminadas = Math.max(0, scenario.plazoActual - scenario.nuevoPlazo);
  const añosEliminados = Math.max(0, Math.round((cuotasEliminadas / 12) * 10) / 10);
  const mesesExtra = cuotasEliminadas - Math.floor(añosEliminados) * 12;

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

  const analista = client.asesor || "Equipo NUVEX";
  const primerNombreCliente = (client.nombre || "").trim().split(/\s+/)[0] || "Cliente";

  // posiciones del timeline en % (0 = hoy)
  const spanActual = Math.max(1, scenario.plazoActual);
  const optPct = Math.max(8, Math.min(100, (scenario.nuevoPlazo / spanActual) * 100));

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: FONT,
        width: "210mm",
        padding: "16mm 14mm",
        boxSizing: "border-box",
        letterSpacing: "-0.005em",
      }}
    >
      {/* ============ BLOQUE 1 — HERO ============ */}
      <section style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <img src={logoNuvex} alt="NUVEX" style={{ height: 38, width: "auto" }} crossOrigin="anonymous" />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Pill>{client.banco || "—"}</Pill>
            <Pill>{client.tipoProducto || "Crédito hipotecario"}</Pill>
            <Pill>{fecha}</Pill>
          </div>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 46,
            lineHeight: 0.96,
            fontWeight: 900,
            letterSpacing: "-0.035em",
            color: C.ink,
            textTransform: "uppercase",
          }}
        >
          Recupera parte de tu <span style={{ color: C.verdeDeep }}>vida financiera</span>.
        </h1>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginTop: 4 }}>
          <Avatar text={initials(analista)} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12.5, color: C.ink2, lineHeight: 1.55, maxWidth: 480 }}>
              Hola <strong>{primerNombreCliente}</strong>, analizamos tu crédito y encontramos una
              oportunidad real para reducir el tiempo de tu deuda <strong>sin cambiar de banco</strong>.
              Esta propuesta fue preparada especialmente para ti por:
            </p>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: C.ink }}>{analista}</div>
              <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Analista Financiero Certificado · NUVEX
              </div>
            </div>
          </div>
        </div>

        <Hairline />
      </section>

      {/* ============ BLOQUE 2 — IMPACTO ============ */}
      <section style={{ padding: "34px 0 30px 0", textAlign: "center" }}>
        <Eyebrow>El impacto real de esta decisión</Eyebrow>
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.32em",
              color: C.muted,
              textTransform: "uppercase",
            }}
          >
            Recuperas
          </div>
          <div
            style={{
              fontSize: 132,
              lineHeight: 0.9,
              fontWeight: 900,
              letterSpacing: "-0.055em",
              color: C.ink,
              marginTop: 6,
            }}
          >
            {cuotasEliminadas}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: "0.22em",
              color: C.verdeDeep,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >
            Cuotas · {Math.floor(añosEliminados)} {Math.floor(añosEliminados) === 1 ? "año" : "años"}
            {mesesExtra > 0 ? ` y ${mesesExtra} meses` : ""}
          </div>
          <p
            style={{
              margin: "14px auto 0",
              maxWidth: 460,
              fontSize: 11.5,
              lineHeight: 1.55,
              color: C.muted,
            }}
          >
            Mientras otros siguen pagando intereses, tú podrías terminar tu crédito mucho antes.
          </p>
        </div>
      </section>

      <Hairline />

      {/* ============ BLOQUE 3 — TIMELINE ============ */}
      <section style={{ padding: "26px 0" }}>
        <Eyebrow>Tu nueva línea de tiempo</Eyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 14 }}>
          <TimelineRow
            label="Sin NUVEX"
            start={añoHoy}
            end={añoFinActual}
            color={C.muted}
            barColor="#D9D9D9"
            widthPct={100}
          />
          <TimelineRow
            label="Con NUVEX"
            start={añoHoy}
            end={añoFinOpt}
            color={C.verdeDeep}
            barColor={C.verde}
            widthPct={optPct}
            highlight
          />
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 10.5,
            color: C.muted,
            textAlign: "right",
            letterSpacing: "0.06em",
          }}
        >
          Finalización estimada · <strong style={{ color: C.ink }}>{añoFinOpt}</strong> en lugar de{" "}
          <strong style={{ color: C.ink2 }}>{añoFinActual}</strong>
        </div>
      </section>

      <Hairline />

      {/* ============ BLOQUE 4 — DINERO QUE SALE VS QUE SE QUEDA ============ */}
      <section style={{ padding: "26px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <MoneyCard
          tone="rojo"
          eyebrow="Si no actúas"
          title="Lo que seguirás pagando"
          amount={ahorroTotal}
          note="Intereses y seguros que seguirán saliendo de tu patrimonio."
        />
        <MoneyCard
          tone="verde"
          eyebrow="Si actúas hoy"
          title="Dinero que puedes conservar"
          amount={ahorroTotal}
          note="Recursos que pueden quedarse en tu familia, patrimonio y proyectos."
          emphasize
        />
      </section>

      {/* ============ BLOQUE 5 — INVERSIÓN POR ÉXITO ============ */}
      <section style={{ padding: "10px 0 26px 0" }}>
        <Eyebrow>Inversión por éxito</Eyebrow>
        <div
          style={{
            marginTop: 12,
            borderRadius: 18,
            padding: "22px 24px",
            background: "linear-gradient(180deg,#FAFAFA 0%, #FFFFFF 100%)",
            border: `1px solid ${C.hairline}`,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            alignItems: "center",
            gap: 18,
          }}
        >
          <InvestStat
            label="Honorarios estándar"
            value={formatCOP(honorariosBase)}
            strike={commercial?.hasDiscount}
            faded
          />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.22em", color: C.muted, textTransform: "uppercase" }}>
              Valor autorizado
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: C.ink,
                marginTop: 4,
              }}
            >
              {formatCOP(honorariosFinales)}
            </div>
          </div>
          <InvestStat
            label="Tu ahorro"
            value={descuento > 0 ? formatCOP(descuento) : "—"}
            accent={descuento > 0}
          />
        </div>
      </section>

      {/* ============ BLOQUE 6 — OFERTA 72H ============ */}
      {commercial?.hasDiscount && (
        <section
          style={{
            padding: "18px 22px",
            borderRadius: 16,
            background: "linear-gradient(135deg,#2A0E0E 0%, #4A1414 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.32em",
                textTransform: "uppercase",
                color: "#F8D4D0",
              }}
            >
              Descuento válido por
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em", marginTop: 2 }}>
              72 : 00 : 00
            </div>
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
              Después de este plazo la propuesta vuelve a su tarifa estándar.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["H", "M", "S"].map((u) => (
              <div
                key={u}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {u}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============ BLOQUE 7 — MENSAJE EMOCIONAL ============ */}
      <section style={{ padding: "30px 0 26px 0" }}>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.55,
            color: C.ink,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            maxWidth: 520,
          }}
        >
          <strong>{primerNombreCliente},</strong> cada cuota que eliminas es tiempo que recuperas.
          Tiempo para tu familia. Tiempo para tus proyectos. Tiempo para construir patrimonio.
        </p>
        <p
          style={{
            margin: "14px 0 0 0",
            fontSize: 12.5,
            lineHeight: 1.6,
            color: C.muted,
            maxWidth: 520,
          }}
        >
          La diferencia entre quienes transforman sus finanzas y quienes no lo hacen, muchas veces
          es una sola decisión tomada a tiempo. La decisión siempre será tuya — nosotros ya hicimos
          los cálculos.
        </p>
      </section>

      <Hairline />

      {/* ============ BLOQUE 8 — MENSAJE DEL ANALISTA ============ */}
      <section
        style={{
          padding: "22px 0",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Avatar text={initials(analista)} large />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: "'Caveat','Brush Script MT',cursive",
              fontSize: 28,
              color: C.azul,
              lineHeight: 1,
            }}
          >
            {analista}
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.ink, marginTop: 4 }}>{analista}</div>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Analista Financiero Certificado · NUVEX
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10.5, color: C.muted, lineHeight: 1.6 }}>
          <div>{CORPORATIVO.telefono}</div>
          <div>{CORPORATIVO.web}</div>
        </div>
      </section>

      {/* ============ BLOQUE 9 — FOOTER ============ */}
      <section
        style={{
          marginTop: 8,
          padding: "16px 0 0 0",
          borderTop: `1px solid ${C.hairline}`,
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 12,
          fontSize: 9.5,
          color: C.muted,
          lineHeight: 1.5,
        }}
      >
        <FooterCol title="Bucaramanga" body="Carrera 16 #37-48 · Piso 4" />
        <FooterCol title="Bogotá" body="Calle 93 #18-28 · Oficina 704" />
        <FooterCol title="WhatsApp" body="+57 316 402 3779" />
        <FooterCol title="Sitio web" body="www.nuvex.com.co" />
      </section>
    </div>
  );
}

/* ============== Subcomponents ============== */

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.ink2,
        background: "#F5F5F5",
        borderRadius: 999,
        padding: "5px 11px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        color: C.muted,
      }}
    >
      {children}
    </div>
  );
}

function Hairline() {
  return <div style={{ height: 1, background: C.hairline, width: "100%" }} />;
}

function Avatar({ text, large = false }: { text: string; large?: boolean }) {
  const size = large ? 56 : 44;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.azul} 0%, ${C.verde} 100%)`,
        color: "#fff",
        fontWeight: 800,
        fontSize: large ? 18 : 15,
        letterSpacing: "0.04em",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 6px 18px -8px rgba(68,93,163,0.5)",
      }}
    >
      {text}
    </div>
  );
}

function TimelineRow({
  label,
  start,
  end,
  color,
  barColor,
  widthPct,
  highlight = false,
}: {
  label: string;
  start: number;
  end: number;
  color: string;
  barColor: string;
  widthPct: number;
  highlight?: boolean;
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
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>
          {start} <span style={{ opacity: 0.4 }}>————————</span> {end}
        </div>
      </div>
      <div
        style={{
          position: "relative",
          height: highlight ? 12 : 8,
          background: "#F2F2F2",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${widthPct}%`,
            background: highlight
              ? `linear-gradient(90deg, ${C.azul} 0%, ${C.verde} 100%)`
              : barColor,
            borderRadius: 999,
          }}
        />
      </div>
    </div>
  );
}

function MoneyCard({
  tone,
  eyebrow,
  title,
  amount,
  note,
  emphasize = false,
}: {
  tone: "rojo" | "verde";
  eyebrow: string;
  title: string;
  amount: number;
  note: string;
  emphasize?: boolean;
}) {
  const isRed = tone === "rojo";
  const bg = isRed ? C.rojoSoft : C.verdeSoft;
  const ink = isRed ? C.rojoInk : C.verdeDeep;
  return (
    <div
      style={{
        borderRadius: 18,
        padding: "22px 22px",
        background: bg,
        border: `1px solid ${isRed ? "#F2D6D2" : "#D4EAD9"}`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: ink,
          fontWeight: 800,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{title}</div>
      <div
        style={{
          fontSize: emphasize ? 38 : 32,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: ink,
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {formatCOP(amount)}
      </div>
      <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5, marginTop: 4 }}>{note}</div>
    </div>
  );
}

function InvestStat({
  label,
  value,
  faded = false,
  strike = false,
  accent = false,
}: {
  label: string;
  value: string;
  faded?: boolean;
  strike?: boolean;
  accent?: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9.5, letterSpacing: "0.22em", color: C.muted, textTransform: "uppercase" }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: accent ? C.verdeDeep : faded ? C.muted : C.ink,
          textDecoration: strike ? "line-through" : "none",
          marginTop: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FooterCol({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 8.5,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: C.ink2,
          fontWeight: 800,
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div>{body}</div>
    </div>
  );
}

// Silenciar warnings de unused imports/vars
void formatNumber;
void CORPORATIVO;
