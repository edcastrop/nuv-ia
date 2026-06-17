import {
  Landmark, CreditCard, CalendarDays, Clock, Wallet, TrendingUp,
  CalendarOff as LCalendarOff, ShieldCheck, Users, MapPin, Phone, Globe,
  ArrowRight, PiggyBank, FileText, CheckCircle2, Hourglass, Banknote,
  Coins, Receipt, Target, Rocket, Scissors, Trophy, TrendingDown, Award,
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

  // Datos para los bloques 1 y 2 del brief
  const saldoActual = creditState?.saldoCapital ?? 0;
  const plazoOriginal = creditState?.plazoInicialMeses ?? (scenario.plazoActual + (creditState?.cuotasPagadas ?? 0));
  const cuotasPagadas = creditState?.cuotasPagadas ?? 0;
  const cuotasPendi = creditState?.cuotasPendientes ?? scenario.plazoActual;
  const segurosMensuales = creditState?.seguros ?? 0;

  // Ratio semáforo: <=2 verde, <=3 amarillo, >3 rojo
  const semaforo: "green" | "yellow" | "red" =
    vecesSin <= 2 ? "green" : vecesSin <= 3 ? "yellow" : "red";
  const semColor = semaforo === "green" ? C.greenDeep : semaforo === "yellow" ? "#C58A1A" : C.redDeep;
  const semSoft = semaforo === "green" ? C.greenSoft : semaforo === "yellow" ? "#FBF1DC" : C.redSoft;
  const semLabel = semaforo === "green" ? "ÓPTIMO" : semaforo === "yellow" ? "ELEVADO" : "CRÍTICO";

  // Ahorro intereses / seguros (proviene de recommended)
  const ahorroIntereses = recommended.ahorroIntereses;
  const ahorroSeguros = recommended.ahorroSeguros;

  // Número del crédito (usa numeroCredito si existe, si no cédula)
  const numeroCredito = (client.numeroCredito || client.cedula || "—").toString();

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
          PÁGINA 1 — PERFIL · SITUACIÓN · VECES PAGADO
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
        <CorporateHeader
          pageLabel="Página 1 de 2"
          title="PROPUESTA DE OPTIMIZACIÓN FINANCIERA"
          subtitle="Análisis basado en Ley 546 de 1999 y Decreto 583 de 2025"
        />

        {/* ───── BARRA DE METADATOS — Cliente · Banco · Crédito · Fecha · Asesor ───── */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <div style={{
            background: C.bgSoft, borderRadius: 12, padding: "10px 14px",
            display: "grid", gridTemplateColumns: "1.1fr 1fr 1fr 1fr 1.1fr",
            gap: 14, alignItems: "center",
          }}>
            <MetaCol icon={<Users size={16} color={C.azul} strokeWidth={2} />} label="CLIENTE" value={nombreCliente} />
            <MetaCol icon={<Landmark size={16} color={C.azul} strokeWidth={2} />} label="BANCO" value={banco} />
            <MetaCol icon={<FileText size={16} color={C.azul} strokeWidth={2} />} label="N° CRÉDITO" value={numeroCredito} />
            <MetaCol icon={<CalendarDays size={16} color={C.azul} strokeWidth={2} />} label="FECHA" value={fecha} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.azul}, ${C.green})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0,
              }}>{initialsOf(analista)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 7, letterSpacing: "0.22em", color: C.muted, fontWeight: 800 }}>ASESOR</div>
                <div style={{ fontSize: 10.5, fontWeight: 800, color: C.ink, lineHeight: 1.15 }}>{analista}</div>
                <div style={{ fontSize: 8, color: C.greenDeep, fontWeight: 700, lineHeight: 1.15 }}>Certificado NUVEX</div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            BLOQUE 1 — PERFIL DEL CRÉDITO
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <BlockTitle index="01" title="PERFIL DEL CRÉDITO" subtitle="Características originales del producto financiero" />
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8,
          }}>
            <IconCard icon={<Landmark size={26} color={C.azul} strokeWidth={1.6} />} label="BANCO" value={banco} />
            <IconCard icon={<Wallet size={26} color={C.azul} strokeWidth={1.6} />} label="SALDO ACTUAL" value={formatCOP(saldoActual)} />
            <IconCard icon={<FileText size={26} color={C.azul} strokeWidth={1.6} />} label="PRODUCTO" value={`${productoLabel} ${monedaLabel}`} />
            <IconCard icon={<CalendarDays size={26} color={C.azul} strokeWidth={1.6} />} label="PLAZO ORIGINAL" value={`${plazoOriginal} meses`} sub={`${(plazoOriginal / 12).toFixed(0)} años`} />
            <IconCard icon={<CheckCircle2 size={26} color={C.greenDeep} strokeWidth={1.6} />} label="CUOTAS PAGADAS" value={`${cuotasPagadas}`} sub="canceladas" />
            <IconCard icon={<Hourglass size={26} color={C.azul} strokeWidth={1.6} />} label="CUOTAS PENDIENTES" value={`${cuotasPendi}`} sub="por pagar" />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            BLOQUE 2 — SITUACIÓN ACTUAL DEL CRÉDITO
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <BlockTitle index="02" title="SITUACIÓN ACTUAL DEL CRÉDITO" subtitle="Radiografía financiera completa de tu obligación" />
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8,
          }}>
            <IconCard icon={<Banknote size={26} color={C.azul} strokeWidth={1.6} />} label="VALOR DESEMBOLSADO" value={formatCOP(valorDesembolsado)} />
            <IconCard icon={<CreditCard size={26} color={C.azul} strokeWidth={1.6} />} label="CUOTA ACTUAL" value={formatCOP(cuotaActual)} sub="mensual" />
            <IconCard icon={<ShieldCheck size={26} color={C.azul} strokeWidth={1.6} />} label="SEGUROS" value={formatCOP(segurosMensuales)} sub="mensual" />
            <IconCard icon={<Coins size={26} color={C.greenDeep} strokeWidth={1.6} />} label="PAGADO A LA FECHA" value={formatCOP(yaPagado)} />
            <IconCard icon={<TrendingUp size={26} color={C.redDeep} strokeWidth={1.6} />} label="TOTAL POR PAGAR" value={formatCOP(faltaPagarSin)} sub="proyectado" tone="warn" />
            <IconCard
              icon={<Receipt size={26} color="#fff" strokeWidth={1.6} />}
              label="COSTO TOTAL DEL CRÉDITO"
              value={formatCOP(costoTotalSin)}
              sub="pagado + proyectado"
              tone="dark"
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            BLOQUE 3 — INDICADOR EXCLUSIVO NUVEX: N° VECES PAGADO
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <BlockTitle index="03" title="INDICADOR EXCLUSIVO NUVEX" subtitle="Cuántas veces vas a pagar el dinero que te prestaron" />
          <div style={{
            marginTop: 8,
            background: `linear-gradient(135deg, ${C.ink} 0%, #1f2a4a 100%)`,
            borderRadius: 16, padding: "18px 22px", color: "#fff",
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 22, alignItems: "center",
            boxShadow: "0 22px 50px -28px rgba(26,31,46,0.55)",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", right: -40, top: -40, width: 220, height: 220,
              borderRadius: "50%", background: `radial-gradient(circle, ${semColor}33 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{
              width: 70, height: 70, borderRadius: "50%",
              background: `linear-gradient(135deg, ${semColor} 0%, ${semColor}AA 100%)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 10px 24px -8px ${semColor}99`,
            }}>
              <Target size={36} color="#fff" strokeWidth={1.8} />
            </div>
            <div style={{ position: "relative" }}>
              <div style={{
                fontSize: 8.5, letterSpacing: "0.28em", fontWeight: 900,
                color: "rgba(255,255,255,0.65)",
              }}>N° DE VECES PAGADO</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, color: "#fff",
                  letterSpacing: "-0.04em", lineHeight: 0.95,
                }}>
                  {formatNumber(vecesSin, 2)}<span style={{ color: semColor }}>×</span>
                </div>
                <div style={{
                  background: semSoft, color: semColor,
                  padding: "4px 12px", borderRadius: 20,
                  fontSize: 9.5, fontWeight: 900, letterSpacing: "0.16em",
                }}>{semLabel}</div>
              </div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.78)", marginTop: 6, maxWidth: 380 }}>
                Por cada peso desembolsado vas a devolver <b style={{ color: semColor }}>{formatNumber(vecesSin, 2)}</b>.
                Costo total ({formatCOP(costoTotalSin)}) ÷ Valor desembolsado ({formatCOP(valorDesembolsado)}).
              </div>
            </div>
            <div style={{
              position: "relative",
              display: "grid", gridTemplateColumns: "1fr", gap: 6, minWidth: 150,
            }}>
              <SemaforoBar active={semaforo === "green"} color={C.greenDeep} label="≤ 2,0×  ÓPTIMO" />
              <SemaforoBar active={semaforo === "yellow"} color="#C58A1A" label="2,0 – 3,0×  ELEVADO" />
              <SemaforoBar active={semaforo === "red"} color={C.redDeep} label="> 3,0×  CRÍTICO" />
            </div>
          </div>
        </div>

        {/* spacer */}
        <div style={{ flex: "1 1 auto", minHeight: 6 }} />

        {/* ───── CIERRE página 1 — Mensaje hacia página 2 ───── */}
        <div style={{ padding: "10px 22px 0 22px" }}>
          <div style={{
            background: `linear-gradient(135deg, ${C.greenSoft} 0%, #fff 100%)`,
            border: `1px solid ${C.green}55`, borderRadius: 12,
            padding: "10px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <ArrowRight size={22} color={C.greenDeep} strokeWidth={2.2} />
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 900, color: C.ink, letterSpacing: "-0.01em" }}>
                  Existe una alternativa para optimizar este crédito
                </div>
                <div style={{ fontSize: 9.5, color: C.text, marginTop: 1 }}>
                  Revisa la <b style={{ color: C.greenDeep }}>Propuesta Recomendada NUVEX</b> en la página siguiente.
                </div>
              </div>
            </div>
            <div style={{
              background: C.greenDeep, color: "#fff",
              fontSize: 9, fontWeight: 900, letterSpacing: "0.18em",
              padding: "6px 12px", borderRadius: 6,
            }}>VER PÁGINA 2</div>
          </div>
        </div>

        <FooterStrip />
      </section>

      {/* ============================================================
          PÁGINA 2 — PROPUESTA RECOMENDADA
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
        <CorporateHeader
          pageLabel="Página 2 de 2"
          title="PROPUESTA RECOMENDADA"
          subtitle={`Optimización financiera para ${primerNombre} · ${productoLabel}`}
        />

        {/* ═══════════════════════════════════════════════
            HERO — 6 métricas premium con icono grande
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <div style={{
            background: `linear-gradient(155deg, ${C.greenSoft} 0%, #fff 65%)`,
            border: `1px solid ${C.green}55`, borderRadius: 16,
            padding: "16px 18px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingBottom: 10, borderBottom: `1px solid ${C.green}33`, marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: "0.24em", fontWeight: 900, color: C.greenDeep }}>
                  PROPUESTA RECOMENDADA POR NUVEX
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: C.ink, letterSpacing: "-0.02em", marginTop: 2 }}>
                  Recupera <span style={{ color: C.greenDeep }}>{añosEliminadosEntero} años</span> de tu vida financiera
                </div>
              </div>
              <div style={{
                background: C.greenDeep, color: "#fff",
                fontSize: 9, fontWeight: 900, letterSpacing: "0.16em",
                padding: "5px 12px", borderRadius: 6,
              }}>★ RECOMENDADA</div>
            </div>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
            }}>
              <HeroMetric icon={<Rocket size={28} color={C.greenDeep} strokeWidth={1.6} />} label="NUEVA CUOTA" value={formatCOP(nuevaCuota)} sub={`+${formatNumber(incrementoPct, 1)}% mensual`} />
              <HeroMetric icon={<Hourglass size={28} color={C.greenDeep} strokeWidth={1.6} />} label="NUEVO PLAZO" value={`${scenario.nuevoPlazo} m`} sub={`${añosOpt.toFixed(1)} años · fin ${añoFinOpt}`} />
              <HeroMetric icon={<Scissors size={28} color={C.greenDeep} strokeWidth={1.6} />} label="CUOTAS ELIMINADAS" value={`${cuotasEliminadas}`} sub={`${añosEliminadosEntero} años recuperados`} />
              <HeroMetric icon={<Coins size={28} color={C.greenDeep} strokeWidth={1.6} />} label="AHORRO INTERESES" value={formatCOP(ahorroIntereses)} sub="durante la vida del crédito" />
              <HeroMetric icon={<ShieldCheck size={28} color={C.greenDeep} strokeWidth={1.6} />} label="AHORRO SEGUROS" value={formatCOP(ahorroSeguros)} sub="primas no devengadas" />
              <HeroMetric
                icon={<Trophy size={28} color="#fff" strokeWidth={1.8} />}
                label="AHORRO TOTAL"
                value={formatCOP(ahorroTotal)}
                sub="beneficio económico"
                highlight
              />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            TABLA COMPARATIVA ANTES vs DESPUÉS
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <BlockTitle index="04" title="ANTES vs DESPUÉS" subtitle="Comparativa directa entre tu crédito actual y la propuesta NUVEX" />
          <AntesDespuesTable
            rows={[
              { icon: <CreditCard size={16} color={C.azul} />, concepto: "Cuota mensual", antes: formatCOP(cuotaActual), despues: formatCOP(nuevaCuota), delta: `+${formatNumber(incrementoPct, 1)}%`, mejora: false },
              { icon: <CalendarDays size={16} color={C.azul} />, concepto: "Plazo restante", antes: `${scenario.plazoActual} m`, despues: `${scenario.nuevoPlazo} m`, delta: `−${cuotasEliminadas} m`, mejora: true },
              { icon: <Coins size={16} color={C.azul} />, concepto: "Ahorro intereses", antes: "—", despues: formatCOP(ahorroIntereses), delta: "ahorro", mejora: true },
              { icon: <ShieldCheck size={16} color={C.azul} />, concepto: "Ahorro seguros", antes: "—", despues: formatCOP(ahorroSeguros), delta: "ahorro", mejora: true },
              { icon: <Receipt size={16} color={C.azul} />, concepto: "Costo total del crédito", antes: formatCOP(costoTotalSin), despues: formatCOP(costoTotalCon), delta: `−${formatCOP(evitasPagar)}`, mejora: true, bold: true },
              { icon: <Target size={16} color={C.azul} />, concepto: "N° de veces pagado", antes: `${formatNumber(vecesSin, 2)}×`, despues: `${formatNumber(vecesCon, 2)}×`, delta: `−${formatNumber(vecesSin - vecesCon, 2)}×`, mejora: true, bold: true },
            ]}
          />
        </div>

        {/* ═══════════════════════════════════════════════
            BENEFICIO COMERCIAL — Honorarios a éxito
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <div style={{
            background: `linear-gradient(135deg, #fff 0%, ${C.bgSoft} 100%)`,
            border: `1px solid ${C.hairline}`, borderRadius: 12, padding: "12px 16px",
            display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 18, alignItems: "center",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.azulSoft} 0%, #fff 100%)`,
              border: `1px solid ${C.azul}33`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Award size={22} color={C.azul} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 900, color: C.muted, letterSpacing: "0.2em" }}>BENEFICIO COMERCIAL</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, marginTop: 2 }}>Honorarios a éxito NUVEX</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>Solo se cobran si el banco aprueba la optimización.</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7.6, fontWeight: 800, color: C.muted, letterSpacing: "0.14em" }}>ESTÁNDAR</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, textDecoration: "line-through" }}>{formatCOP(honorariosBase)}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7.6, fontWeight: 900, color: C.azul, letterSpacing: "0.14em" }}>APROBADOS</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.ink }}>{formatCOP(honorariosFinales)}</div>
            </div>
            <div style={{
              background: `linear-gradient(135deg, ${C.greenSoft} 0%, #fff 100%)`,
              border: `1px solid ${C.green}55`, borderRadius: 10,
              padding: "8px 14px", textAlign: "center", minWidth: 110,
            }}>
              <div style={{ fontSize: 7.6, fontWeight: 900, color: C.greenDeep, letterSpacing: "0.14em" }}>DESCUENTO</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.greenDeep, lineHeight: 1.1 }}>{formatCOP(descuento > 0 ? descuento : 0)}</div>
              <div style={{ fontSize: 7.5, color: C.red, fontWeight: 800, letterSpacing: "0.12em", marginTop: 2 }}>VIGENCIA 48 H</div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            BLOQUE EXPLICATIVO — máximo 5 líneas
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <div style={{
            background: "#fff", border: `1px solid ${C.hairline}`,
            borderLeft: `4px solid ${C.greenDeep}`, borderRadius: 10,
            padding: "10px 14px",
            display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: C.greenSoft, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <TrendingDown size={20} color={C.greenDeep} strokeWidth={1.8} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 900, color: C.ink, letterSpacing: "-0.01em" }}>
                ¿Qué significa esta optimización para ti?
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 10, lineHeight: 1.45, color: C.text }}>
                Reduces el costo total del crédito en <b style={{ color: C.greenDeep }}>{formatCOP(evitasPagar)}</b>,
                eliminas <b>{cuotasEliminadas} cuotas</b> y bajas tu N° de veces pagado de
                {" "}<b>{formatNumber(vecesSin, 2)}×</b> a <b style={{ color: C.greenDeep }}>{formatNumber(vecesCon, 2)}×</b>.
                Recuperas <b>{añosEliminadosEntero} años de vida financiera</b> para tu familia y tus proyectos,
                sin cuotas extraordinarias ni desembolsos adicionales.
              </p>
            </div>
          </div>
        </div>

        {/* spacer */}
        <div style={{ flex: "1 1 auto", minHeight: 6 }} />

        {/* ═══════════════════════════════════════════════
            CTA FINAL — Metodología NUVEX · Ley 546
        ═══════════════════════════════════════════════ */}
        <div style={{ padding: "0 22px 14px 22px", display: "flex", justifyContent: "center" }}>
          <div style={{
            width: "100%",
            background: `linear-gradient(135deg, ${C.black} 0%, #1a1a1a 55%, #1f2a4a 130%)`,
            color: "#fff", borderRadius: 16, padding: "18px 24px",
            position: "relative", overflow: "hidden",
            boxShadow: "0 22px 50px -24px rgba(0,0,0,0.55)",
          }}>
            <div style={{
              position: "absolute", left: "50%", top: -80, width: 320, height: 320,
              transform: "translateX(-50%)", borderRadius: "50%",
              background: `radial-gradient(circle, ${C.green}26 0%, transparent 70%)`,
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto", gap: 22, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 9.5, fontWeight: 900, color: C.green, letterSpacing: "0.26em" }}>
                  METODOLOGÍA FINANCIERA NUVEX
                </div>
                <p style={{ margin: "6px 0 0 0", fontSize: 11, lineHeight: 1.5, color: "rgba(255,255,255,0.9)", maxWidth: 520 }}>
                  Esta propuesta fue construida utilizando la <b style={{ color: "#fff" }}>metodología financiera NUVEX</b>,
                  diseñada para optimizar créditos hipotecarios y leasing habitacional mediante la aplicación de la
                  <b style={{ color: C.green }}> Ley 546 de 1999</b> y el <b style={{ color: C.green }}>Decreto 583 de 2025</b>.
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  display: "inline-block",
                  background: `linear-gradient(135deg, ${C.green} 0%, #6FA77B 100%)`,
                  color: "#0E1F14",
                  padding: "14px 28px", borderRadius: 12,
                  fontSize: 13, fontWeight: 900, letterSpacing: "0.08em",
                  boxShadow: "0 14px 30px -12px rgba(132,185,143,0.65)",
                }}>
                  QUIERO OPTIMIZAR MI CRÉDITO
                </div>
                <div style={{ marginTop: 8, fontSize: 8.5, color: "rgba(255,255,255,0.65)", letterSpacing: "0.18em", fontWeight: 700 }}>
                  PROPUESTA VÁLIDA POR 48 HORAS
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
   HEADER CORPORATIVO reutilizable (página 1 y 2)
   ════════════════════════════════════════════════════════════ */
function CorporateHeader({
  pageLabel, title, subtitle,
}: { pageLabel: string; title: string; subtitle: string }) {
  return (
    <div style={{
      background: C.black, color: "#fff", padding: "12px 22px",
      display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 20,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <img
          src={logoNuvex} alt="NUVEX" crossOrigin="anonymous"
          style={{ height: 34, width: "auto", filter: "brightness(0) invert(1)", objectFit: "contain" }}
        />
        <div style={{
          fontSize: 6.5, letterSpacing: "0.32em", color: "rgba(255,255,255,0.55)",
          fontWeight: 700, marginLeft: 2,
        }}>
          FINANZAS INTELIGENTES
        </div>
      </div>
      <div style={{
        paddingLeft: 18, borderLeft: "1px solid rgba(255,255,255,0.22)",
      }}>
        <div style={{
          fontSize: 17, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em",
        }}>{title}</div>
        <div style={{
          marginTop: 3, fontSize: 9.5, color: "rgba(255,255,255,0.78)", lineHeight: 1.3,
        }}>{subtitle}</div>
      </div>
      <div style={{
        fontSize: 9, color: "rgba(255,255,255,0.7)",
        letterSpacing: "0.18em", fontWeight: 700,
      }}>
        {pageLabel}
      </div>
    </div>
  );
}

/* Título de bloque numerado */
function BlockTitle({ index, title, subtitle }: { index: string; title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        background: C.ink, color: "#fff",
        fontSize: 10, fontWeight: 900, letterSpacing: "0.06em",
        padding: "3px 10px", borderRadius: 4,
      }}>{index}</div>
      <div style={{
        fontSize: 12, fontWeight: 900, color: C.ink, letterSpacing: "0.04em",
      }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 9.5, color: C.muted, letterSpacing: "0.01em" }}>· {subtitle}</div>
      )}
      <div style={{ flex: 1, height: 1, background: C.hairline }} />
    </div>
  );
}

/* Tarjeta con icono grande para los bloques 1 y 2 */
function IconCard({
  icon, label, value, sub, tone = "default",
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  tone?: "default" | "warn" | "dark";
}) {
  const isDark = tone === "dark";
  const isWarn = tone === "warn";
  const bg = isDark
    ? `linear-gradient(135deg, ${C.ink} 0%, #1f2a4a 100%)`
    : isWarn
    ? `linear-gradient(135deg, ${C.redSoft} 0%, #fff 100%)`
    : "#fff";
  const border = isDark ? C.ink : isWarn ? `${C.red}55` : C.hairline;
  const labelColor = isDark ? "rgba(255,255,255,0.65)" : isWarn ? C.redDeep : C.muted;
  const valueColor = isDark ? "#fff" : isWarn ? C.redDeep : C.ink;
  const subColor = isDark ? "rgba(255,255,255,0.55)" : C.muted;
  const iconBg = isDark
    ? "rgba(255,255,255,0.10)"
    : isWarn ? `${C.red}1A` : C.bgSoft;

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 12,
      padding: "12px 14px", display: "grid",
      gridTemplateColumns: "44px 1fr", gap: 12, alignItems: "center",
      boxShadow: isDark
        ? "0 14px 28px -18px rgba(26,31,46,0.5)"
        : "0 1px 0 rgba(0,0,0,0.02)",
      minHeight: 72,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 7.6, letterSpacing: "0.2em", fontWeight: 900, color: labelColor,
        }}>{label}</div>
        <div style={{
          fontSize: 14, fontWeight: 900, color: valueColor,
          letterSpacing: "-0.02em", lineHeight: 1.1, marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{value}</div>
        {sub && (
          <div style={{ fontSize: 8.5, color: subColor, fontWeight: 600, marginTop: 1 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

/* Barra del semáforo de N° veces pagado */
function SemaforoBar({ active, color, label }: { active: boolean; color: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 10px", borderRadius: 8,
      background: active ? `${color}22` : "rgba(255,255,255,0.05)",
      border: active ? `1px solid ${color}66` : "1px solid rgba(255,255,255,0.10)",
      opacity: active ? 1 : 0.55,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        boxShadow: active ? `0 0 0 3px ${color}33` : "none",
      }} />
      <div style={{
        fontSize: 8, letterSpacing: "0.12em", fontWeight: 800,
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
      }}>{label}</div>
    </div>
  );
}

/* Métrica del HERO (Página 2) */
function HeroMetric({
  icon, label, value, sub, highlight = false,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight
        ? `linear-gradient(135deg, ${C.greenDeep} 0%, ${C.ink} 100%)`
        : "#fff",
      border: highlight ? `1px solid ${C.green}` : `1px solid ${C.green}33`,
      borderRadius: 12, padding: "12px 14px",
      display: "grid", gridTemplateColumns: "46px 1fr", gap: 12, alignItems: "center",
      minHeight: 76,
      boxShadow: highlight
        ? `0 18px 36px -20px ${C.greenDeep}99`
        : "0 1px 0 rgba(0,0,0,0.02)",
    }}>
      <div style={{
        width: 46, height: 46, borderRadius: 12,
        background: highlight ? "rgba(255,255,255,0.16)" : C.greenSoft,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 7.6, letterSpacing: "0.22em", fontWeight: 900,
          color: highlight ? "rgba(255,255,255,0.8)" : C.muted,
        }}>{label}</div>
        <div style={{
          fontSize: 15, fontWeight: 900,
          color: highlight ? "#fff" : C.ink,
          letterSpacing: "-0.025em", lineHeight: 1.1, marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{value}</div>
        {sub && (
          <div style={{
            fontSize: 8.5, fontWeight: 600,
            color: highlight ? "rgba(255,255,255,0.75)" : C.muted,
            marginTop: 1,
          }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

/* Tabla ANTES vs DESPUÉS premium */
function AntesDespuesTable({
  rows,
}: {
  rows: Array<{
    icon: React.ReactNode; concepto: string; antes: string; despues: string;
    delta: string; mejora: boolean; bold?: boolean;
  }>;
}) {
  return (
    <div style={{
      marginTop: 8,
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 12,
      overflow: "hidden",
    }}>
      <div style={{
        display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.9fr",
        background: C.ink, color: "#fff",
        fontSize: 8.5, fontWeight: 900, letterSpacing: "0.16em",
      }}>
        <div style={{ padding: "8px 14px" }}>CONCEPTO</div>
        <div style={{ padding: "8px 14px", textAlign: "right", color: "rgba(255,255,255,0.65)" }}>ANTES</div>
        <div style={{ padding: "8px 14px", textAlign: "right", color: C.green }}>DESPUÉS · NUVEX</div>
        <div style={{ padding: "8px 14px", textAlign: "right", color: "rgba(255,255,255,0.65)" }}>Δ</div>
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 0.9fr",
          alignItems: "center",
          borderTop: i === 0 ? "none" : `1px solid ${C.hairline}`,
          background: i % 2 === 0 ? "#fff" : C.bgSoft,
        }}>
          <div style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, background: C.azulSoft,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>{r.icon}</div>
            <div style={{
              fontSize: 10, fontWeight: r.bold ? 900 : 700, color: C.ink,
              letterSpacing: "-0.005em",
            }}>{r.concepto}</div>
          </div>
          <div style={{
            padding: "8px 14px", textAlign: "right",
            fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: "-0.01em",
          }}>{r.antes}</div>
          <div style={{
            padding: "8px 14px", textAlign: "right",
            fontSize: r.bold ? 12 : 11, fontWeight: 900, color: C.greenDeep, letterSpacing: "-0.015em",
          }}>{r.despues}</div>
          <div style={{ padding: "8px 14px", textAlign: "right" }}>
            <span style={{
              display: "inline-block",
              fontSize: 9, fontWeight: 900, letterSpacing: "0.04em",
              padding: "3px 8px", borderRadius: 5,
              background: r.mejora ? C.greenSoft : C.redSoft,
              color: r.mejora ? C.greenDeep : C.redDeep,
            }}>{r.delta}</span>
          </div>
        </div>
      ))}
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
   PROPUESTA RECOMENDADA — Panel derecho de página 1
════════════════════════════════════════════════════════════ */
function PropuestaRecomendadaPanel(props: {
  nuevaCuota: number;
  añosRecuperados: number;
  ahorroTotal: number;
  nuevoPlazoMeses: number;
  nuevoPlazoAños: number;
  incrementoPct: number;
  incrementoMensual: number;
  cuotasEliminadas: number;
  añoHoy: number;
  añoFinActual: number;
  añoFinOpt: number;
  añosActual: number;
  añosOpt: number;
}) {
  const {
    nuevaCuota, añosRecuperados, ahorroTotal,
    incrementoPct, incrementoMensual, cuotasEliminadas,
  } = props;

  return (
    <div style={{
      background: `linear-gradient(155deg, ${C.greenSoft} 0%, #fff 70%)`,
      border: `1px solid ${C.green}55`, borderRadius: 14,
      padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: 8, borderBottom: `1px solid ${C.green}33`,
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: "0.22em", fontWeight: 900, color: C.greenDeep,
        }}>2. PROPUESTA RECOMENDADA POR NUVEX</div>
        <div style={{
          background: C.greenDeep, color: "#fff",
          fontSize: 8, fontWeight: 900, letterSpacing: "0.14em",
          padding: "2px 8px", borderRadius: 3,
        }}>★ RECOMENDADA</div>
      </div>

      {/* MATRIZ 2×2 — mismo peso visual */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
        gap: 10, flex: "1 1 auto",
      }}>
        <MatrixTile
          label="NUEVA CUOTA"
          value={formatCOP(nuevaCuota)}
          accent={C.greenDeep}
          footer={`+${formatNumber(incrementoPct, 1)}% · +${formatCOP(incrementoMensual)}`}
        />
        <MatrixTile
          label="AHORRO TOTAL"
          value={formatCOP(ahorroTotal)}
          accent={C.greenDeep}
          footer="Menos intereses y seguros"
        />
        <MatrixTile
          label="AÑOS RECUPERADOS"
          value={`${añosRecuperados}`}
          suffix="años"
          accent={C.greenDeep}
          footer="De tu vida financiera"
        />
        <MatrixTile
          label="CUOTAS ELIMINADAS"
          value={`${cuotasEliminadas}`}
          suffix="cuotas"
          accent={C.ink}
          footer="Menos pagos mensuales"
        />
      </div>
    </div>
  );
}

function MatrixTile({
  label, value, suffix, accent, footer,
}: {
  label: string; value: string; suffix?: string; accent: string; footer: string;
}) {
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 10,
      padding: "10px 12px", display: "flex", flexDirection: "column",
      justifyContent: "space-between", minHeight: 78,
    }}>
      <div style={{
        fontSize: 7.8, color: C.muted, fontWeight: 800, letterSpacing: "0.18em",
      }}>
        {label}
      </div>
      <div style={{
        display: "flex", alignItems: "baseline", gap: 5, marginTop: 2,
      }}>
        <div style={{
          fontSize: 22, fontWeight: 900, color: accent,
          letterSpacing: "-0.03em", lineHeight: 1,
        }}>
          {value}
        </div>
        {suffix && (
          <div style={{ fontSize: 9.5, color: C.text, fontWeight: 700 }}>
            {suffix}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 8.2, color: C.muted, fontWeight: 600, marginTop: 4, lineHeight: 1.3,
      }}>
        {footer}
      </div>
    </div>
  );
}

function TimelineBand(props: {
  añoHoy: number; añoFinActual: number; añoFinOpt: number;
  añosActual: number; añosOpt: number; añosRecuperados: number;
}) {
  const { añoHoy, añoFinActual, añoFinOpt, añosActual, añosOpt, añosRecuperados } = props;
  const sinPct = 100;
  const conPct = Math.max(20, Math.min(100, (añosOpt / Math.max(añosActual, 1)) * 100));
  return (
    <div style={{
      background: "#fff", border: `1px solid ${C.hairline}`, borderRadius: 12,
      padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: C.muted }}>
          LÍNEA DE TIEMPO · ANTES Y DESPUÉS
        </div>
        <div style={{
          fontSize: 9, fontWeight: 900, color: C.greenDeep, letterSpacing: "0.16em",
        }}>
          {añosRecuperados} AÑOS RECUPERADOS
        </div>
      </div>
      <TimelineRow
        label="SIN NUVEX"
        startYear={añoHoy}
        endYear={añoFinActual}
        barColor="#CFD3DB"
        widthPct={sinPct}
        pill={`${formatNumber(añosActual, 1)} años`}
        pillBg="#F1F2F4"
        pillFg={C.muted}
      />
      <TimelineRow
        label={<>CON NUVEX</>}
        startYear={añoHoy}
        endYear={añoFinOpt}
        barColor={C.greenDeep}
        widthPct={conPct}
        pill={`${formatNumber(añosOpt, 1)} años`}
        pillBg={C.greenSoft}
        pillFg={C.greenDeep}
      />
    </div>
  );
}

function TimelineRow({
  label, startYear, endYear, barColor, widthPct, pill, pillBg, pillFg,
}: {
  label: React.ReactNode; startYear: number; endYear: number;
  barColor: string; widthPct: number; pill: string; pillBg: string; pillFg: string;
}) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "70px 32px 1fr 36px 60px",
      alignItems: "center", gap: 5,
    }}>
      <div style={{ fontSize: 7.5, fontWeight: 800, color: C.text, letterSpacing: "0.06em", lineHeight: 1.1 }}>
        {label}
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: C.ink, textAlign: "center" }}>
        {startYear}
      </div>
      <div style={{ position: "relative", height: 8 }}>
        <div style={{
          position: "absolute", top: "50%", left: 0, right: 0, height: 3,
          background: "#EDEFF2", transform: "translateY(-50%)", borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", top: "50%", left: 0, height: 3,
          width: `${widthPct}%`, background: barColor, transform: "translateY(-50%)",
          borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `calc(${widthPct}% - 5px)`,
          width: 10, height: 10, borderRadius: "50%", background: barColor,
          transform: "translateY(-50%)",
          boxShadow: `0 0 0 2px #fff`,
        }} />
      </div>
      <div style={{ fontSize: 8.5, fontWeight: 700, color: C.ink, textAlign: "center" }}>
        {endYear}
      </div>
      <div style={{
        background: pillBg, color: pillFg, fontSize: 7.8, fontWeight: 800,
        padding: "2px 6px", borderRadius: 999, textAlign: "center",
      }}>
        {pill}
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
        background: C.ink, color: "#fff", borderRadius: 8,
        padding: "5px 10px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.22em", fontWeight: 900, color: "#fff",
        }}>1. ESTADO ACTUAL DEL CRÉDITO</div>
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

/* Tile premium para la banda IMPACTO DE LA OPTIMIZACIÓN (página 1, fondo oscuro) */
function ImpactTile({
  label, value, sub, highlight = false,
}: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight
        ? "rgba(132,185,143,0.16)"
        : "rgba(255,255,255,0.06)",
      border: highlight
        ? `1px solid ${C.green}66`
        : "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10, padding: "10px 12px",
      display: "flex", flexDirection: "column", gap: 3,
    }}>
      <div style={{
        fontSize: 7.6, letterSpacing: "0.2em", fontWeight: 800,
        color: highlight ? C.green : "rgba(255,255,255,0.6)",
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 16, fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em",
        color: highlight ? "#E8F4EA" : "#fff",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 7.8, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* KPI Card premium para el RESUMEN DEL IMPACTO (página 2, fondo claro) */
function SummaryKpi({
  label, value, sub, tone,
}: { label: string; value: string; sub?: string; tone: "green" | "blue" | "ink" }) {
  const accent = tone === "green" ? C.greenDeep : tone === "blue" ? C.azul : C.ink;
  const soft = tone === "green" ? C.greenSoft : tone === "blue" ? C.azulSoft : "#F1F2F4";
  return (
    <div style={{
      background: `linear-gradient(155deg, ${soft} 0%, #fff 100%)`,
      border: `1px solid ${accent}33`,
      borderRadius: 12, padding: "12px 14px",
      display: "flex", flexDirection: "column", gap: 4,
      minHeight: 72,
    }}>
      <div style={{
        fontSize: 8, letterSpacing: "0.2em", fontWeight: 900, color: C.muted,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 900, color: accent,
        letterSpacing: "-0.025em", lineHeight: 1.05,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 8.5, color: C.muted, fontWeight: 600 }}>
          {sub}
        </div>
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
          padding: "7px 12px", fontSize: 9, fontWeight: 900,
          letterSpacing: "0.18em",
        }}>CONCEPTO</div>
        {cols.map((c) => (
          <div key={c.key} style={{
            padding: "7px 8px", textAlign: "center",
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
            padding: "5px 12px", fontSize: 9.5, fontWeight: 700, color: C.text,
          }}>
            {r.label}
          </div>
          {cols.map((c) => {
            const isRec = c.isRec;
            const isCurrent = c.isCurrent;
            return (
              <div key={c.key} style={{
                padding: "5px 8px", textAlign: "center",
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
