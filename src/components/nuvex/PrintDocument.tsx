import {
  Landmark, CreditCard, CalendarDays, Clock, ShieldCheck, MapPin, Phone, Globe,
  PiggyBank, FileText, CheckCircle2, Scissors, FileSignature, Inbox,
  Building2, ClipboardCheck, Smile, Banknote, WalletCards, Layers3, TrendingDown,
  TrendingUp, PackageCheck, Trophy, Target, Rocket, ArrowRight, Scale, BadgeCheck,
} from "lucide-react";
import { NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import type { PropuestaComercialPdfRow } from "./PropuestasComerciales";
import { calcularMotor } from "../../lib/motorHonorarios";
import logoNuvex from "@/assets/logo-nuvex.png";

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
  interesMensual?: number;
  capitalMensual?: number;
  dineroPagado?: number;
  interesesPagados?: number;
  capitalPagado?: number;
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
  dineroPagadoFecha?: number;
  valorDesembolsado?: number;
  creditState?: CreditStateData;
}

/* ============================================================
   NUVEX — Propuesta Comercial Premium (2 páginas A4)
============================================================ */
const C = {
  black: NUVEX.negro,
  ink: NUVEX.negro,
  inkSoft: "#303030",
  text: "#2C3142",
  textSoft: "#4B5167",
  muted: "#7A8499",
  hairline: "#E6E8EE",
  hairlineSoft: "#F0F2F6",
  paper: "#FFFFFF",
  bgSoft: "#F7F8FA",
  green: NUVEX.verde,
  greenSoft: "#E8F4EA",
  greenDeep: "#3F8C57",
  greenBtn: "#9FCBA8",
  greenBtnDeep: "#7FB28A",
  azul: NUVEX.azul,
  azulSoft: "#E3E8F5",
  red: "#D94F4F",
  redSoft: "#FCE6E5",
  redDeep: "#B43A3A",
};

const FONT = "'Inter','Manrope','SF Pro Display',ui-sans-serif,system-ui,sans-serif";
const SCRIPT = "'Allura','Caveat','Brush Script MT',cursive";

function compactMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return formatCOP(n);
}

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

  const consistenciaOk =
    Math.abs((commercial?.honorariosBase ?? recommended.honorarios) - recommended.honorarios) < 1;
  if (!consistenciaOk) {
    return (
      <div id={containerId} className="nuvex-print-only" style={{
        background: "#fff", color: "#B43A3A", fontFamily: FONT,
        width: "210mm", padding: "40mm 22mm", boxSizing: "border-box",
      }}>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Error de consistencia</div>
        <div style={{ fontSize: 12, lineHeight: 1.5, color: "#1A1F2E" }}>
          Los honorarios no coinciden con el escenario seleccionado.<br />
          Verifica el escenario recomendado en el simulador antes de generar el PDF.
        </div>
      </div>
    );
  }

  const primerNombre = (client.nombre || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const primerNombreUpper = primerNombre.toUpperCase();
  const analista = client.asesor || "Equipo NUVEX";
  const banco = client.banco || "—";
  const productoLabel = client.tipoProducto === "leasing" ? "Leasing Habitacional" : "Crédito Hipotecario";
  const monedaLabel = mode === "uvr" ? "en UVR" : "en Pesos";
  const productoCompleto = client.tipoProducto || `${productoLabel} ${monedaLabel}`;

  const cuotaActual = scenario.cuotaActual;
  const nuevaCuota = scenario.nuevaCuota;
  const incrementoMensual = Math.max(0, nuevaCuota - cuotaActual);
  const incrementoPct = cuotaActual > 0 ? (incrementoMensual / cuotaActual) * 100 : 0;

  const yaPagado = Math.max(0, dineroPagadoFecha);
  const faltaPagarSin = Math.max(0, scenario.totalActual);
  const faltaPagarCon = Math.max(0, scenario.totalOptimizado);
  const costoTotalSin = yaPagado + faltaPagarSin;
  const costoTotalCon = yaPagado + faltaPagarCon;
  const desembolsoRef = valorDesembolsado > 0 ? valorDesembolsado : 0;
  const vecesSin = desembolsoRef > 0 ? costoTotalSin / desembolsoRef : 0;
  const vecesCon = desembolsoRef > 0 ? costoTotalCon / desembolsoRef : 0;

  // Estado del crédito
  const plazoOriginal = creditState?.plazoInicialMeses ?? (scenario.plazoActual + (creditState?.cuotasPagadas ?? 0));
  const cuotasPagadas = creditState?.cuotasPagadas ?? 0;
  const cuotasPendi = creditState?.cuotasPendientes ?? scenario.plazoActual;
  const segurosMensuales = creditState?.seguros ?? 0;
  const interesMensual = creditState?.interesMensual ?? 0;
  const capitalMensual = creditState?.capitalMensual ?? Math.max(0, cuotaActual - segurosMensuales - interesMensual);
  const interesesPagados = creditState?.interesesPagados ?? 0;
  const capitalPagado = creditState?.capitalPagado ?? 0;

  // Propuestas para tabla de escenarios (página 2)
  const allPropuestas = propuestasComerciales?.length
    ? mapComercialesToAltRow(propuestasComerciales, cuotaActual)
    : mapPropuestasToAltRow(mode, pesosPropuestas, uvrPropuestas, cuotaActual, plazoOriginal);
  const recPropuesta = allPropuestas[bestIndex];
  const alternativas = allPropuestas
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => idx !== bestIndex)
    .map(({ p }) => p)
    .sort((a, b) => a.incrementoPct - b.incrementoPct);
  // Garantiza 3 columnas de escenarios
  const esc = [alternativas[0], alternativas[1], alternativas[2]];
  const totalEscenarios = allPropuestas.length;

  const ahorroIntereses = recommended.ahorroIntereses;
  const ahorroSeguros = recommended.ahorroSeguros;
  const semaforo = vecesSin >= 2.4
    ? { label: "Alerta alta", color: C.redDeep, bg: C.redSoft, note: "Costo proyectado elevado frente al desembolso inicial." }
    : vecesSin >= 1.8
      ? { label: "Atención", color: "#B7791F", bg: "#FFF7E6", note: "Existe una oportunidad clara de optimización financiera." }
      : { label: "Controlado", color: C.greenDeep, bg: C.greenSoft, note: "El costo proyectado se mantiene dentro de un rango saludable." };

  return (
    <div
      id={containerId}
      className="nuvex-print-only"
      style={{
        background: C.paper, color: C.ink, fontFamily: FONT,
        width: "210mm", boxSizing: "border-box", letterSpacing: "-0.005em",
      }}
    >
      {/* =================================================================
          PÁGINA 1 · PERFIL + SITUACIÓN + VECES PAGADO
      ================================================================= */}
      <section
        className="nuvex-print-page"
        style={{
          width: "210mm", height: "297mm", maxHeight: "297mm",
          background: C.paper, boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column",
          pageBreakAfter: "always", breakAfter: "page",
        }}
      >
        <TopBar pageLabel="Página 1 de 2" title="PROPUESTA DE OPTIMIZACIÓN FINANCIERA" subtitle="Análisis basado en Ley 546 de 1999 y Decreto 583 de 2025" />

        <div style={{ padding: "18px 24px 0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "end" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: C.greenDeep }}>EXPEDIENTE FINANCIERO NUVEX</div>
              <h1 style={{ margin: "6px 0 0 0", fontSize: 28, lineHeight: 1.05, fontWeight: 900, color: C.ink, letterSpacing: "-0.025em" }}>
                Perfil y situación actual del crédito
              </h1>
            </div>
            <div style={{ textAlign: "right", fontSize: 8.8, color: C.textSoft, lineHeight: 1.55 }}>
              <b style={{ color: C.ink }}>Cliente:</b> {client.nombre || primerNombreUpper}<br />
              <b style={{ color: C.ink }}>Fecha:</b> {fecha}<br />
              <b style={{ color: C.ink }}>Asesor:</b> {analista}<br />
              <b style={{ color: C.ink }}>Crédito:</b> {client.numeroCredito || "—"}
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 24px 0 24px" }}>
          <PanelTitle number="01" title="PERFIL DEL CRÉDITO" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
            <InfoTile icon={<Landmark />} label="Banco" value={banco} />
            <InfoTile icon={<Banknote />} label="Saldo actual" value={formatCOP(creditState?.saldoCapital ?? 0)} />
            <InfoTile icon={<FileText />} label="Tipo de producto" value={productoCompleto} compact />
            <InfoTile icon={<CalendarDays />} label="Plazo original" value={`${plazoOriginal} meses`} />
            <InfoTile icon={<TrendingDown />} label="Cuotas pagadas" value={`${cuotasPagadas}`} />
            <InfoTile icon={<TrendingUp />} label="Cuotas pendientes" value={`${cuotasPendi}`} />
          </div>
        </div>

        <div style={{ padding: "22px 24px 0 24px" }}>
          <PanelTitle number="02" title="SITUACIÓN ACTUAL DEL CRÉDITO" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
            <InfoTile icon={<WalletCards />} label="Valor desembolsado" value={formatCOP(desembolsoRef)} />
            <InfoTile icon={<CreditCard />} label="Cuota actual" value={formatCOP(cuotaActual)} />
            <InfoTile icon={<ShieldCheck />} label="Seguros" value={formatCOP(segurosMensuales)} />
            <InfoTile icon={<PackageCheck />} label="Pagado a la fecha" value={formatCOP(yaPagado)} />
            <InfoTile icon={<Layers3 />} label="Total por pagar" value={formatCOP(faltaPagarSin)} />
            <InfoTile icon={<Trophy />} label="Costo total del crédito" value={formatCOP(costoTotalSin)} featured />
          </div>
        </div>

        <div style={{ padding: "26px 24px 0 24px" }}>
          <PanelTitle number="03" title="INDICADOR EXCLUSIVO NUVEX" />
          <div style={{ marginTop: 10, border: `1px solid ${semaforo.color}55`, borderRadius: 16, background: `linear-gradient(135deg, ${semaforo.bg}, #fff 62%)`, padding: "30px 28px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 22, alignItems: "center" }}>
            <div style={{ width: 86, height: 86, borderRadius: 22, background: semaforo.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Target size={46} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.24em", fontWeight: 900, color: C.ink }}>NÚMERO DE VECES PAGADO</div>
              <div style={{ marginTop: 8, fontSize: 11, color: C.textSoft, lineHeight: 1.55 }}>
                Costo total del crédito ÷ valor desembolsado<br />
                <b style={{ color: C.ink }}>{formatCOP(costoTotalSin)}</b> ÷ <b style={{ color: C.ink }}>{formatCOP(desembolsoRef)}</b>
              </div>
              <div style={{ marginTop: 9, fontSize: 10.5, color: semaforo.color, fontWeight: 800 }}>{semaforo.note}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 64, lineHeight: 0.95, fontWeight: 900, color: semaforo.color, letterSpacing: "-0.04em" }}>{formatNumber(vecesSin, 2)}x</div>
              <div style={{ marginTop: 7, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 999, background: "#fff", color: semaforo.color, fontSize: 8, fontWeight: 900, letterSpacing: "0.14em", border: `1px solid ${semaforo.color}55` }}>
                <BadgeCheck size={12} /> {semaforo.label.toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 auto" }} />
        <FooterStrip />
      </section>

      {/* =================================================================
          PÁGINA 2 · PROPUESTA RECOMENDADA + ANTES/DESPUÉS + CTA
      ================================================================= */}
      <section
        className="nuvex-print-page"
        style={{
          width: "210mm", height: "297mm", maxHeight: "297mm",
          background: C.paper, boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <TopBar pageLabel="Página 2 de 2" title="PROPUESTA RECOMENDADA" subtitle="Escenario óptimo construido con metodología financiera NUVEX" />

        <div style={{ padding: "15px 24px 0 24px" }}>
          <div style={{ borderRadius: 16, background: C.ink, color: "#fff", padding: "14px 20px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -38, top: -46, width: 160, height: 160, borderRadius: "50%", background: "rgba(132,185,143,0.16)" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "start", position: "relative" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 10px", borderRadius: 999, background: "rgba(132,185,143,0.16)", color: C.green, fontSize: 8.5, fontWeight: 900, letterSpacing: "0.16em" }}>
                  <Rocket size={14} /> NUVEX RECOMENDADO
                </div>
                <h2 style={{ margin: "7px 0 0 0", fontSize: 24, lineHeight: 0.98, fontWeight: 900, letterSpacing: "-0.025em", color: "#fff" }}>
                  Optimización diseñada<br />para recuperar {añosEliminadosEntero} años
                </h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 8, letterSpacing: "0.22em", color: "rgba(255,255,255,0.58)", fontWeight: 900 }}>AHORRO TOTAL</div>
                <div style={{ fontSize: 25, color: C.green, fontWeight: 900, letterSpacing: "-0.03em", marginTop: 3 }}>{formatCOP(ahorroTotal)}</div>
                <div style={{ fontSize: 8.5, color: "rgba(255,255,255,0.72)", marginTop: 2 }}>Intereses + seguros</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10, position: "relative" }}>
              <HeroFeature icon={<CreditCard />} label="Nueva cuota estimada" value={formatCOP(nuevaCuota)} />
              <HeroFeature icon={<Clock />} label="Nuevo plazo" value={`${scenario.nuevoPlazo} meses`} />
              <HeroFeature icon={<Scissors />} label="Cuotas eliminadas" value={`${cuotasEliminadas}`} />
              <HeroFeature icon={<PiggyBank />} label="Ahorro intereses" value={formatCOP(ahorroIntereses)} />
              <HeroFeature icon={<ShieldCheck />} label="Ahorro seguros" value={formatCOP(ahorroSeguros)} />
              <HeroFeature icon={<Trophy />} label="Honorarios a éxito" value={formatCOP(honorariosFinales)} />
            </div>
          </div>
        </div>

        <div style={{ padding: "10px 24px 0 24px" }}>
          <PanelTitle number="04" title="ANTES VS DESPUÉS" />
          <BeforeAfterTable rows={[
            { label: "Cuota", before: formatCOP(cuotaActual), after: formatCOP(nuevaCuota), icon: <CreditCard /> },
            { label: "Plazo", before: `${scenario.plazoActual} meses`, after: `${scenario.nuevoPlazo} meses`, icon: <Clock /> },
            { label: "Intereses", before: "Escenario actual", after: formatCOP(ahorroIntereses), icon: <PiggyBank /> },
            { label: "Seguros", before: "Escenario actual", after: formatCOP(ahorroSeguros), icon: <ShieldCheck /> },
            { label: "Costo total", before: formatCOP(costoTotalSin), after: formatCOP(costoTotalCon), icon: <Trophy /> },
            { label: "Veces pagado", before: `${formatNumber(vecesSin, 2)}x`, after: `${formatNumber(vecesCon, 2)}x`, icon: <Target /> },
          ]} />
        </div>

        <div style={{ padding: "9px 24px 0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ border: `1px solid ${C.hairline}`, borderRadius: 14, padding: "14px 16px", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, letterSpacing: "0.2em", color: C.greenDeep, fontWeight: 900 }}>
                <Scale size={20} /> BENEFICIO FINANCIERO
              </div>
              <p style={{ margin: "7px 0 0 0", fontSize: 9.8, color: C.text, lineHeight: 1.42 }}>
                La propuesta reduce el costo financiero proyectado y concentra el beneficio en menos plazo, menos cuotas y menor exposición a intereses y seguros durante la vida del crédito.
              </p>
            </div>
            <div style={{ border: `1px solid ${C.green}66`, borderRadius: 14, padding: "14px 16px", background: C.greenSoft }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 9, letterSpacing: "0.2em", color: C.greenDeep, fontWeight: 900 }}>
                <ShieldCheck size={20} /> BENEFICIO COMERCIAL
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end", marginTop: 8 }}>
                <div>
                  <div style={{ fontSize: 8.5, color: C.textSoft }}>Honorarios a éxito</div>
                  <div style={{ fontSize: 19, color: C.ink, fontWeight: 900, letterSpacing: "-0.025em" }}>{formatCOP(honorariosFinales)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 8, color: C.redDeep, fontWeight: 900, letterSpacing: "0.14em" }}>VIGENCIA</div>
                  <div style={{ fontSize: 16, color: C.greenDeep, fontWeight: 900 }}>48 HORAS</div>
                </div>
              </div>
              {descuento > 0 && <div style={{ marginTop: 4, fontSize: 8.6, color: C.textSoft }}>Descuento aplicado: <b style={{ color: C.greenDeep }}>{formatCOP(descuento)}</b></div>}
            </div>
          </div>
        </div>

        <div style={{ padding: "9px 24px 0 24px" }}>
          <PanelTitle number="05" title="¿QUÉ SUCEDE AHORA?" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 9, marginTop: 7 }}>
            <Step n={1} icon={<FileSignature size={23} color={C.ink} strokeWidth={1.7} />} title="Firma de autorización" desc="Autorizas la gestión." />
            <Step n={2} icon={<Inbox size={23} color={C.ink} strokeWidth={1.7} />} title="Radicación ante el banco" desc="Presentamos tu caso." />
            <Step n={3} icon={<Building2 size={23} color={C.ink} strokeWidth={1.7} />} title="Análisis del banco" desc="Evaluación oficial." />
            <Step n={4} icon={<ClipboardCheck size={23} color={C.ink} strokeWidth={1.7} />} title="Respuesta oficial" desc="Recibes respuesta." />
            <Step n={5} icon={<Smile size={23} color="#fff" strokeWidth={1.7} />} title="Disfrutas tu optimización" desc="Menos cuotas." highlight />
          </div>
        </div>

        <div style={{ flex: "1 1 auto" }} />

        <div style={{ padding: "0 24px 8px 24px" }}>
          <div style={{ background: C.ink, color: "#fff", borderRadius: 14, padding: "10px 18px", display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: C.green }}>METODOLOGÍA FINANCIERA NUVEX</div>
              <div style={{ marginTop: 4, fontSize: 9.8, lineHeight: 1.35, color: "rgba(255,255,255,0.82)" }}>
                Esta propuesta fue construida para optimizar créditos hipotecarios y leasing habitacional mediante la aplicación de la Ley 546 de 1999.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.greenBtn, color: C.ink, borderRadius: 10, padding: "12px 16px", fontSize: 11, fontWeight: 900, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
              AVANZAR <ArrowRight size={17} />
            </div>
          </div>
        </div>

        <FooterStrip />
      </section>
    </div>
  );
}

/* ============================================================
   SUBCOMPONENTES
============================================================ */

function TopBar({ pageLabel, title, subtitle }: { pageLabel: string; title: string; subtitle: string }) {
  return (
    <div style={{
      background: C.black, color: "#fff", padding: "10px 24px",
      display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 18,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <img
          src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
          style={{ height: 24, width: "auto", filter: "brightness(0) invert(1)", objectFit: "contain" }}
        />
        <div style={{ fontSize: 5.5, letterSpacing: "0.32em", color: "rgba(255,255,255,0.6)", fontWeight: 700, marginTop: 3, marginLeft: 2 }}>
          FINANZAS INTELIGENTES
        </div>
      </div>
      <div style={{ textAlign: "left", paddingLeft: 18 }}>
        <div style={{ fontSize: 10.2, color: "rgba(255,255,255,0.94)", fontWeight: 900, letterSpacing: "0.12em" }}>{title}</div>
        <div style={{ marginTop: 3, fontSize: 8.6, color: C.green, fontWeight: 700 }}>{subtitle}</div>
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: "0.18em", fontWeight: 700 }}>
        {pageLabel}
      </div>
    </div>
  );
}

function PanelTitle({ number, title }: { number: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 24, height: 24, borderRadius: 7, background: C.greenSoft, color: C.greenDeep, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900 }}>
        {number}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 900, color: C.ink, letterSpacing: "0.18em" }}>{title}</div>
    </div>
  );
}

function InfoTile({ icon, label, value, compact = false, featured = false }: {
  icon: React.ReactNode; label: string; value: string; compact?: boolean; featured?: boolean;
}) {
  return (
    <div style={{
      minHeight: 82, border: `1px solid ${featured ? C.green : C.hairline}`, borderRadius: 12,
      background: featured ? C.greenSoft : "#fff", padding: "12px 13px",
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "center",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: featured ? C.greenDeep : C.bgSoft, color: featured ? "#fff" : C.greenDeep, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 7.6, letterSpacing: "0.18em", fontWeight: 900, color: featured ? C.greenDeep : C.muted, textTransform: "uppercase" }}>{label}</div>
        <div style={{ marginTop: 4, fontSize: compact ? 10.2 : 13.2, lineHeight: 1.15, fontWeight: 900, color: featured ? C.ink : C.ink, letterSpacing: "-0.012em", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function HeroFeature({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "8px 12px", minHeight: 58 }}>
      <div style={{ color: C.green, display: "flex", alignItems: "center", marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 7, letterSpacing: "0.18em", color: "rgba(255,255,255,0.62)", fontWeight: 900, textTransform: "uppercase" }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 13.6, lineHeight: 1.03, color: "#fff", fontWeight: 900, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function BeforeAfterTable({ rows }: { rows: Array<{ label: string; before: string; after: string; icon: React.ReactNode }> }) {
  return (
    <div style={{ marginTop: 8, border: `1px solid ${C.hairline}`, borderRadius: 14, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", background: C.ink, color: "#fff" }}>
        <div style={compareHeadStyle}>CONCEPTO</div>
        <div style={compareHeadStyle}>ANTES</div>
        <div style={{ ...compareHeadStyle, color: C.green }}>DESPUÉS</div>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr", borderTop: i === 0 ? "none" : `1px solid ${C.hairlineSoft}` }}>
          <div style={{ ...compareCellStyle, display: "flex", alignItems: "center", gap: 9, color: C.ink, fontWeight: 900 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, background: C.bgSoft, color: C.greenDeep, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.icon}</span>
            {r.label}
          </div>
          <div style={{ ...compareCellStyle, color: C.muted, fontWeight: 800 }}>{r.before}</div>
          <div style={{ ...compareCellStyle, color: C.greenDeep, fontWeight: 900, background: "rgba(132,185,143,0.08)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <CheckCircle2 size={14} /> {r.after}
          </div>
        </div>
      ))}
    </div>
  );
}

const compareHeadStyle: React.CSSProperties = {
  padding: "8px 14px", fontSize: 8.2, letterSpacing: "0.18em", fontWeight: 900, textAlign: "center",
};

const compareCellStyle: React.CSSProperties = {
  padding: "6px 13px", fontSize: 9.4, minHeight: 30, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
};

function HeroKpi({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 4px" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: C.ink, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 7.5, letterSpacing: "0.18em", fontWeight: 900, color: C.ink, whiteSpace: "pre-line", lineHeight: 1.25 }}>{label}</div>
    </div>
  );
}

function MetaCol({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 7.4, letterSpacing: "0.22em", color: C.muted, fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.ink, lineHeight: 1.2, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 900, color: C.ink, letterSpacing: "0.04em" }}>
      <span style={{ color: C.greenDeep, marginRight: 4 }}>{index}</span>{title}
    </div>
  );
}

function StateGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 7.6, letterSpacing: "0.22em", fontWeight: 900, color: C.muted, marginBottom: 3 }}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function StateRow({ label, value, valueColor, bold }: { label: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: "2px 0", borderBottom: `1px dashed ${C.hairlineSoft}`,
    }}>
      <div style={{ fontSize: 9, color: C.textSoft }}>{label}</div>
      <div style={{ fontSize: 9.5, fontWeight: bold ? 900 : 800, color: valueColor ?? C.ink, letterSpacing: "-0.01em" }}>{value}</div>
    </div>
  );
}

function MiniMetric({ icon, label, value, valueSuffix, sub }: {
  icon: React.ReactNode; label: string; value: string; valueSuffix?: string; sub?: string;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.green}33`, borderRadius: 8,
      padding: "10px 12px",
    }}>
      <div style={{ marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 7.4, letterSpacing: "0.18em", fontWeight: 900, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 14.5, fontWeight: 900, color: C.greenDeep, letterSpacing: "-0.02em", marginTop: 2, lineHeight: 1.05 }}>
        {value}{valueSuffix && <span style={{ fontSize: 10, color: C.ink, marginLeft: 2, fontWeight: 800 }}>{valueSuffix}</span>}
      </div>
      {sub && <div style={{ fontSize: 8, color: C.muted, marginTop: 4, whiteSpace: "pre-line", lineHeight: 1.3 }}>{sub}</div>}
    </div>
  );
}

function TimelineRow({ label, startYear, endYear, years, color, ratio = 1, full = false }: {
  label: string; startYear: number; endYear: number; years: number; color: string; ratio?: number; full?: boolean;
}) {
  const pct = full ? 100 : Math.max(15, Math.min(100, ratio * 100));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "60px 1fr auto", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{ fontSize: 7.4, fontWeight: 900, color: C.muted, letterSpacing: "0.15em" }}>{label}</div>
      <div style={{ position: "relative", height: 10 }}>
        <div style={{ position: "absolute", inset: 0, background: C.hairlineSoft, borderRadius: 999 }} />
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: color, borderRadius: 999,
        }} />
        <div style={{
          position: "absolute", left: -2, top: -2, width: 14, height: 14, borderRadius: "50%",
          background: color, border: "2px solid #fff",
        }} />
        {!full && (
          <div style={{
            position: "absolute", left: `calc(${pct}% - 7px)`, top: -2,
            width: 14, height: 14, borderRadius: "50%",
            background: color, border: "2px solid #fff",
          }} />
        )}
        <div style={{
          position: "absolute", left: 2, top: -10, fontSize: 7, color: C.muted, fontWeight: 700,
        }}>{startYear}</div>
        <div style={{
          position: "absolute", right: full ? 2 : `calc(${100 - pct}% + 2px)`, top: -10,
          fontSize: 7, color: C.muted, fontWeight: 700,
        }}>{endYear}</div>
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 900, color: color, letterSpacing: "-0.01em" }}>
        {years.toFixed(1)} años
      </div>
    </div>
  );
}

function DarkKpi({ icon, value, label, wide = false }: { icon: React.ReactNode; value: string; label: string; wide?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: "rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: wide ? 18 : 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", lineHeight: 1 }}>{value}</div>
        <div style={{ marginTop: 4, fontSize: 7.4, letterSpacing: "0.2em", fontWeight: 900, color: "rgba(255,255,255,0.78)", whiteSpace: "pre-line", lineHeight: 1.2 }}>{label}</div>
      </div>
    </div>
  );
}

function ImpactCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div style={{ border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 7.6, letterSpacing: "0.2em", fontWeight: 900, color: C.muted }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.ink, letterSpacing: "-0.02em", marginTop: 4, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 8.5, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Step({ n, icon, title, desc, highlight = false }: {
  n: number; icon: React.ReactNode; title: string; desc: string; highlight?: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 22, height: 22, borderRadius: "50%",
        background: highlight ? C.greenDeep : C.ink, color: "#fff",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 900, marginBottom: 8,
      }}>{n}</div>
      <div style={{
        height: 50, display: "flex", alignItems: "center", justifyContent: "center",
        background: highlight ? `linear-gradient(135deg, ${C.greenDeep}, ${C.greenBtnDeep})` : "#fff",
        border: `1px solid ${highlight ? C.greenDeep : C.hairline}`,
        borderRadius: 10, marginBottom: 7,
      }}>{icon}</div>
      <div style={{ fontSize: 8.8, fontWeight: 900, color: C.ink, lineHeight: 1.15 }}>{title}</div>
      <div style={{ fontSize: 7.5, color: C.muted, marginTop: 3, lineHeight: 1.2, whiteSpace: "pre-line" }}>{desc}</div>
    </div>
  );
}

function FooterStrip() {
  return (
    <div
      data-pdf-footer="true"
      style={{
        marginTop: "auto", background: C.black, color: "#fff",
        padding: "8px 22px",
        display: "grid", gridTemplateColumns: "auto 1fr 1fr 1fr 1fr",
        gap: 12, alignItems: "center",
        breakInside: "avoid", pageBreakInside: "avoid",
      }}
    >
      <img
        src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
        style={{ height: 16, width: "auto", filter: "brightness(0) invert(1)" }}
      />
      <FooterItem icon={<MapPin size={11} color={C.green} strokeWidth={1.8} />} title="Bucaramanga" lines={["Cra. 16 # 37-48 Piso 4", "Centro"]} />
      <FooterItem icon={<MapPin size={11} color={C.green} strokeWidth={1.8} />} title="Bogotá" lines={["Calle 93 # 18-28", "Of. 704"]} />
      <FooterItem icon={<Phone size={11} color={C.green} strokeWidth={1.8} />} title="" lines={["+57 316 402 3779"]} />
      <FooterItem icon={<Globe size={11} color={C.green} strokeWidth={1.8} />} title="" lines={["www.nuvex.com.co"]} />
    </div>
  );
}

function FooterItem({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: string[] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ fontSize: 7.4, lineHeight: 1.2 }}>
        {title && <div style={{ fontWeight: 800, color: "#fff" }}>{title}</div>}
        {lines.map((l, i) => (
          <div key={i} style={{ color: "rgba(255,255,255,0.85)" }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   TABLA DE ESCENARIOS (página 2)
============================================================ */
function ScenariosTable(props: {
  cuotaActual: number;
  plazoActual: number;
  añoFinActual: number;
  recPropuesta?: AltRow;
  esc: Array<AltRow | undefined>;
  recNueva: number;
  recIncPct: number;
  recPlazo: number;
  recAñoFin: number;
  recAñosElim: number;
  recCuotasElim: number;
  recAhorroTotal: number;
  recHonorarios: number;
}) {
  const { cuotaActual, plazoActual, añoFinActual, esc, recNueva, recIncPct, recPlazo, recAñoFin, recAñosElim, recCuotasElim, recAhorroTotal, recHonorarios } = props;

  const labels = ["Conservador", "Equilibrado", "Acelerado"];

  const cellHeader = (txt: React.ReactNode, recommended = false): React.CSSProperties => ({
    padding: "10px 8px", textAlign: "center" as const,
    fontSize: 9, fontWeight: 900, letterSpacing: "0.06em",
    color: recommended ? C.greenDeep : C.ink,
    borderBottom: `2px solid ${recommended ? C.greenDeep : C.hairline}`,
    background: recommended ? C.greenSoft : "#fff",
  });
  const cellTd = (recommended = false): React.CSSProperties => ({
    padding: "9px 8px", textAlign: "center" as const,
    fontSize: 9.5, color: recommended ? C.greenDeep : C.text,
    borderBottom: `1px solid ${C.hairlineSoft}`,
    background: recommended ? "rgba(132,185,143,0.07)" : "transparent",
    fontWeight: recommended ? 900 : 600,
  });

  const fmtVal = (v: AltRow | undefined, key: (r: AltRow) => string) => v ? key(v) : "—";

  return (
    <table style={{
      width: "100%", borderCollapse: "collapse",
      border: `1px solid ${C.hairline}`, borderRadius: 8, overflow: "hidden",
    }}>
      <thead>
        <tr>
          <th style={{ ...cellHeader(null), textAlign: "left", paddingLeft: 14, background: C.bgSoft, color: C.ink }}>CONCEPTO</th>
          <th style={cellHeader("ACTUAL")}>ACTUAL</th>
          {esc.map((_, i) => (
            <th key={i} style={cellHeader(null)}>
              <div style={{ color: C.muted, fontSize: 7.6, letterSpacing: "0.18em" }}>ESCENARIO {i + 1}</div>
              <div style={{ marginTop: 2, fontSize: 10, color: C.ink }}>{labels[i]}</div>
            </th>
          ))}
          <th style={cellHeader(null, true)}>
            <div style={{ fontSize: 9, color: C.greenDeep }}>★ NUVEX</div>
            <div style={{ marginTop: 2, fontSize: 9.5 }}>RECOMENDADO</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <Row label="Nueva cuota" cells={[formatCOP(cuotaActual), ...esc.map(e => fmtVal(e, r => formatCOP(r.nuevaCuota)))]} rec={formatCOP(recNueva)} />
        <Row label="Incremento mensual" cells={["—", ...esc.map(e => e ? `+${formatNumber(e.incrementoPct, 1)}%` : "—")]} rec={`+${formatNumber(recIncPct, 1)}%`} />
        <Row label="Nuevo plazo" cells={[`${plazoActual} m`, ...esc.map(e => e ? `${Math.round(e.añosOpt * 12)} m` : "—")]} rec={`${recPlazo} m`} />
        <Row label="Fecha final" cells={[`${añoFinActual}`, ...esc.map(e => e ? `${e.añoFinOpt}` : "—")]} rec={`${recAñoFin}`} />
        <Row label="Años recuperados" cells={["—", ...esc.map(e => e ? `${Math.round(e.añosEliminados)}` : "—")]} rec={`${recAñosElim}`} />
        <Row label="Cuotas eliminadas" cells={["—", ...esc.map(e => e ? `${e.cuotasEliminadas}` : "—")]} rec={`${recCuotasElim}`} />
        <Row label="Ahorro total" cells={["—", ...esc.map(e => e ? formatCOP(e.ahorroTotal) : "—")]} rec={formatCOP(recAhorroTotal)} />
        <Row label="Honorarios a éxito" cells={["—", ...esc.map(e => e ? formatCOP(e.honorariosFinal) : "—")]} rec={formatCOP(recHonorarios)} />
        <Row label="Beneficio comercial" cells={["—", ...esc.map(() => "—")]} rec="Aprobado" recBadge />
      </tbody>
    </table>
  );

  function Row({ label, cells, rec, recBadge }: { label: string; cells: string[]; rec: string; recBadge?: boolean }) {
    return (
      <tr>
        <td style={{
          padding: "9px 14px", fontSize: 9.5, color: C.ink, fontWeight: 700,
          borderBottom: `1px solid ${C.hairlineSoft}`, textAlign: "left",
        }}>{label}</td>
        {cells.map((c, i) => (
          <td key={i} style={cellTd(false)}>{c}</td>
        ))}
        <td style={cellTd(true)}>
          {recBadge ? (
            <span style={{
              background: C.greenDeep, color: "#fff",
              padding: "3px 10px", borderRadius: 5,
              fontSize: 8.5, fontWeight: 900, letterSpacing: "0.1em",
            }}>{rec}</span>
          ) : rec}
        </td>
      </tr>
    );
  }
}

/* ============================================================
   HELPERS DE DATOS (lógica intacta)
============================================================ */
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
    ahorroIntereses, ahorroSeguros,
    tipoCredito: mode, plazoOriginalMeses: plazoOriginal,
  });
  return {
    honorariosFinal: r.honorarioRecomendado,
    honorariosBase: r.honorarioTeorico,
    minimoAplicado: r.alertaTope === "minimo",
  };
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

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "NX";
}
