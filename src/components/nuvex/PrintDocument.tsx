import {
  Landmark, CreditCard, CalendarDays, Clock, ShieldCheck, MapPin, Phone, Globe,
  PiggyBank, FileText, CheckCircle2, Scissors, FileSignature, Inbox,
  Building2, ClipboardCheck, Smile,
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
  black: "#0E0E10",
  ink: "#0F1B3A",
  inkSoft: "#1A2547",
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

  const cuotaActual = scenario.cuotaActual;
  const nuevaCuota = scenario.nuevaCuota;
  const incrementoMensual = Math.max(0, nuevaCuota - cuotaActual);
  const incrementoPct = cuotaActual > 0 ? (incrementoMensual / cuotaActual) * 100 : 0;

  const yaPagado = Math.max(0, dineroPagadoFecha);
  const faltaPagarSin = Math.max(0, scenario.totalActual);
  const faltaPagarCon = Math.max(0, scenario.totalOptimizado);
  const costoTotalSin = yaPagado + faltaPagarSin;
  const desembolsoRef = valorDesembolsado > 0 ? valorDesembolsado : 0;
  const vecesSin = desembolsoRef > 0 ? costoTotalSin / desembolsoRef : 0;

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
  const ahorroCompact = compactMoney(ahorroTotal);

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
          PÁGINA 1
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
        <TopBar pageLabel="Página 1 de 2" />

        {/* HERO */}
        <div style={{ padding: "22px 22px 0 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, letterSpacing: "0.02em" }}>
            Hola, <span style={{ color: C.greenDeep, fontWeight: 900 }}>{primerNombreUpper}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: 28, alignItems: "start", marginTop: 8 }}>
            <div>
              <h1 style={{
                margin: 0, fontSize: 32, lineHeight: 1.02, fontWeight: 900,
                color: C.ink, letterSpacing: "-0.035em",
              }}>
                RECUPERA <span style={{ color: C.greenDeep }}>{añosEliminadosEntero} AÑOS</span><br />
                DE TU VIDA FINANCIERA
              </h1>
              <p style={{ margin: "12px 0 0 0", fontSize: 10.5, lineHeight: 1.55, color: C.text }}>
                Tu crédito puede terminar en <b style={{ color: C.ink }}>{añoFinOpt}</b><br />
                en lugar de <b style={{ color: C.ink }}>{añoFinActual}</b>.
              </p>
              <p style={{ margin: "8px 0 0 0", fontSize: 10.5, lineHeight: 1.55, color: C.text }}>
                Una decisión hoy puede cambiar<br />tu futuro financiero.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <HeroKpi icon={<CalendarDays size={26} color={C.greenDeep} strokeWidth={1.8} />} value={`${cuotasEliminadas}`} label="CUOTAS ELIMINADAS" />
              <HeroKpi icon={<Clock size={26} color={C.greenDeep} strokeWidth={1.8} />} value={`${añosEliminadosEntero}`} label="AÑOS RECUPERADOS" />
              <HeroKpi icon={<PiggyBank size={26} color={C.greenDeep} strokeWidth={1.8} />} value={ahorroCompact} label={"AHORRADOS\nEN INTERESES\nY SEGUROS"} />
            </div>
          </div>
        </div>

        {/* META ROW */}
        <div style={{ padding: "18px 22px 0 22px" }}>
          <div style={{
            display: "grid", gridTemplateColumns: "1.1fr 1.2fr 1fr 1.2fr", gap: 18,
            paddingTop: 14, borderTop: `1px solid ${C.hairline}`,
          }}>
            <MetaCol icon={<Landmark size={18} color={C.muted} strokeWidth={1.6} />} label="BANCO" value={banco} />
            <MetaCol icon={<CreditCard size={18} color={C.muted} strokeWidth={1.6} />} label="PRODUCTO" value={`${productoLabel} ${monedaLabel}`} />
            <MetaCol icon={<CalendarDays size={18} color={C.muted} strokeWidth={1.6} />} label="FECHA" value={fecha} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, ${C.azul}, ${C.greenDeep})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 11, fontWeight: 900, flexShrink: 0,
              }}>{initialsOf(analista)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 7.4, letterSpacing: "0.22em", color: C.muted, fontWeight: 800 }}>PREPARADO POR</div>
                <div style={{ fontSize: 11, fontWeight: 900, color: C.ink, lineHeight: 1.15, marginTop: 1 }}>{analista}</div>
                <div style={{ fontSize: 8.5, color: C.muted, fontWeight: 600 }}>Analista Financiero</div>
                <div style={{ fontSize: 8.5, color: C.greenDeep, fontWeight: 800 }}>Certificado NUVEX</div>
              </div>
            </div>
          </div>
        </div>

        {/* GRID PRINCIPAL — Estado Actual + Propuesta Recomendada */}
        <div style={{ padding: "16px 22px 0 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* === IZQUIERDA: ESTADO ACTUAL === */}
          <div style={{
            border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "12px 14px",
            background: "#fff",
          }}>
            <SectionTitle index="1." title="ESTADO ACTUAL DEL CRÉDITO" />
            <StateGroup title="PRODUCTO">
              <StateRow label="Banco" value={banco} />
              <StateRow label="Producto" value={`${productoLabel} ${monedaLabel}`} />
              <StateRow label="Plazo inicial" value={`${plazoOriginal} meses`} />
            </StateGroup>
            <StateGroup title="CUOTAS">
              <StateRow label="Canceladas" value={`${cuotasPagadas}`} />
              <StateRow label="Pendientes" value={`${cuotasPendi}`} />
            </StateGroup>
            <StateGroup title="CUOTA MENSUAL">
              <StateRow label="Cuota actual" value={formatCOP(cuotaActual)} />
              <StateRow label="Seguros" value={formatCOP(segurosMensuales)} />
              <StateRow label="Interés mensual" value={formatCOP(interesMensual)} />
              <StateRow label="Capital mensual" value={formatCOP(capitalMensual)} />
            </StateGroup>
            <StateGroup title="PAGADO A LA FECHA">
              <StateRow label="Dinero pagado" value={formatCOP(yaPagado)} />
              <StateRow label="Intereses pagados" value={formatCOP(interesesPagados)} />
              <StateRow label="Capital pagado" value={formatCOP(capitalPagado)} />
            </StateGroup>
            <StateGroup title="PROYECCIÓN SIN NUVEX">
              <StateRow label="Dinero pendiente" value={formatCOP(faltaPagarSin)} />
              <StateRow label="Costo total proyectado" value={formatCOP(costoTotalSin)} valueColor={C.redDeep} bold />
            </StateGroup>
            <div style={{
              marginTop: 10, background: C.redSoft, border: `1px solid ${C.red}55`,
              borderRadius: 8, padding: "8px 12px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ fontSize: 8.5, letterSpacing: "0.2em", fontWeight: 900, color: C.redDeep }}>
                N° VECES PAGADO
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: C.redDeep, letterSpacing: "-0.03em" }}>
                {formatNumber(vecesSin, 2)}x
              </div>
            </div>
          </div>

          {/* === DERECHA: PROPUESTA RECOMENDADA === */}
          <div style={{
            border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "12px 14px",
            background: "#fff", display: "flex", flexDirection: "column",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <SectionTitle index="2." title="PROPUESTA RECOMENDADA POR NUVEX" />
              <div style={{
                background: C.greenSoft, color: C.greenDeep, border: `1px solid ${C.green}66`,
                fontSize: 7.5, fontWeight: 900, letterSpacing: "0.16em",
                padding: "3px 8px", borderRadius: 4, whiteSpace: "nowrap",
              }}>★ RECOMENDADA</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <MiniMetric
                icon={<CreditCard size={22} color={C.greenDeep} strokeWidth={1.7} />}
                label="NUEVA CUOTA"
                value={formatCOP(nuevaCuota)}
                sub={`+${formatNumber(incrementoPct, 1)}%\n+ ${formatCOP(incrementoMensual)}`}
              />
              <MiniMetric
                icon={<PiggyBank size={22} color={C.greenDeep} strokeWidth={1.7} />}
                label="AHORRO TOTAL"
                value={formatCOP(ahorroTotal)}
                sub={"Menos intereses y seguros\ndurante la vida del crédito"}
              />
              <MiniMetric
                icon={<Clock size={22} color={C.greenDeep} strokeWidth={1.7} />}
                label="AÑOS RECUPERADOS"
                value={`${añosEliminadosEntero}`}
                valueSuffix=" años"
                sub={"De tu vida financiera"}
              />
              <MiniMetric
                icon={<CheckCircle2 size={22} color={C.greenDeep} strokeWidth={1.7} />}
                label="CUOTAS ELIMINADAS"
                value={`${cuotasEliminadas}`}
                valueSuffix=" cuotas"
                sub={"Menos pagos mensuales"}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 8.5, letterSpacing: "0.2em", fontWeight: 900, color: C.muted, marginBottom: 6 }}>
                LÍNEA DE TIEMPO · ANTES Y DESPUÉS
              </div>
              <TimelineRow label="SIN NUVEX" startYear={añoHoy} endYear={añoFinActual} years={añosActual} color="#9CA3AF" full />
              <TimelineRow label="CON NUVEX" startYear={añoHoy} endYear={añoFinOpt} years={añosOpt} color={C.greenDeep} ratio={añosOpt / Math.max(1, añosActual)} />
            </div>
          </div>
        </div>

        {/* RESULTADO DE TU OPTIMIZACIÓN (navy band) */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <div style={{
            background: C.ink, borderRadius: 10, padding: "14px 18px",
            color: "#fff",
          }}>
            <div style={{ textAlign: "center", fontSize: 10, letterSpacing: "0.22em", fontWeight: 900, color: "#fff" }}>
              RESULTADO DE TU OPTIMIZACIÓN
            </div>
            <div style={{
              marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, alignItems: "center",
            }}>
              <DarkKpi icon={<CalendarDays size={22} color="#fff" strokeWidth={1.7} />} value={`${cuotasEliminadas}`} label="CUOTAS\nELIMINADAS" />
              <DarkKpi icon={<Clock size={22} color="#fff" strokeWidth={1.7} />} value={`${añosEliminadosEntero}`} label="AÑOS\nRECUPERADOS" />
              <DarkKpi icon={<PiggyBank size={22} color="#fff" strokeWidth={1.7} />} value={formatCOP(ahorroTotal)} label="AHORRADOS EN INTERESES\nY SEGUROS" wide />
            </div>
          </div>
        </div>

        {/* BENEFICIO COMERCIAL APROBADO */}
        <div style={{ padding: "12px 22px 0 22px" }}>
          <div style={{
            border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "12px 16px",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 18, alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", fontWeight: 900, color: C.ink }}>
                3. BENEFICIO COMERCIAL APROBADO
              </div>
              <div style={{ marginTop: 6, fontSize: 9.5, color: C.muted }}>
                Honorarios a Éxito NUVEX
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: "-0.025em", marginTop: 2 }}>
                {formatCOP(honorariosFinales)}
              </div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
                Solo se pagan si el banco aprueba la optimización.
              </div>
            </div>
            <div style={{
              border: `1px solid ${C.green}66`, background: "#fff",
              borderRadius: 10, padding: "10px 14px", textAlign: "center", minWidth: 170,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <ShieldCheck size={22} color={C.greenDeep} strokeWidth={1.7} />
              <div style={{ fontSize: 8.5, letterSpacing: "0.18em", fontWeight: 900, color: C.greenDeep }}>
                VÁLIDO POR
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: C.greenDeep, letterSpacing: "-0.02em" }}>
                48 HORAS
              </div>
              <div style={{ fontSize: 8, color: C.muted, lineHeight: 1.3 }}>
                Propuesta exclusiva<br />para este caso.
              </div>
            </div>
          </div>
        </div>

        {/* QUOTE + SIGNATURE */}
        <div style={{ padding: "10px 22px 0 22px" }}>
          <div style={{
            padding: "10px 14px",
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, alignItems: "center",
          }}>
            <div style={{
              fontFamily: "Georgia, serif", fontSize: 44, lineHeight: 0.8,
              color: C.greenDeep, fontWeight: 900, alignSelf: "flex-start",
            }}>“</div>
            <div style={{ fontSize: 9.5, lineHeight: 1.55, color: C.text }}>
              Este crédito terminará de una u otra forma.<br />
              La diferencia es decidir si quieres <b style={{ color: C.greenDeep }}>recuperar parte de tu tiempo financiero</b>.<br />
              Cada cuota eliminada es tiempo que vuelve a tu vida,<br />
              a tu familia y a tus proyectos.
            </div>
            <div style={{ textAlign: "center", minWidth: 130 }}>
              <div style={{ fontFamily: SCRIPT, fontSize: 24, color: C.ink, lineHeight: 1 }}>
                {analista}
              </div>
              <div style={{ marginTop: 4, borderTop: `1px solid ${C.hairline}`, paddingTop: 3, fontSize: 7.5, letterSpacing: "0.22em", fontWeight: 800, color: C.muted }}>
                ANALISTA NUVEX
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "1 1 auto" }} />
        <FooterStrip />
      </section>

      {/* =================================================================
          PÁGINA 2
      ================================================================= */}
      <section
        className="nuvex-print-page"
        style={{
          width: "210mm", height: "297mm", maxHeight: "297mm",
          background: C.paper, boxSizing: "border-box", overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}
      >
        <TopBar pageLabel="Página 2 de 2" />

        {/* COMPARACIÓN DE ESCENARIOS */}
        <div style={{ padding: "22px 22px 0 22px" }}>
          <h2 style={{
            margin: 0, fontSize: 20, fontWeight: 900, color: C.ink, letterSpacing: "-0.02em",
          }}>COMPARACIÓN DE ESCENARIOS</h2>
          <p style={{ margin: "6px 0 0 0", fontSize: 10, color: C.textSoft, lineHeight: 1.5 }}>
            Analizamos diferentes alternativas para que elijas<br />
            el nivel de optimización que mejor se adapta a tus objetivos financieros.
          </p>
        </div>

        {/* TABLA */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <ScenariosTable
            cuotaActual={cuotaActual}
            plazoActual={scenario.plazoActual}
            añoFinActual={añoFinActual}
            recPropuesta={recPropuesta}
            esc={esc}
            recNueva={nuevaCuota}
            recIncPct={incrementoPct}
            recPlazo={scenario.nuevoPlazo}
            recAñoFin={añoFinOpt}
            recAñosElim={añosEliminadosEntero}
            recCuotasElim={cuotasEliminadas}
            recAhorroTotal={ahorroTotal}
            recHonorarios={honorariosFinales}
          />
          <div style={{ marginTop: 6, fontSize: 8.5, color: C.muted, textAlign: "center" }}>
            Total de escenarios analizados: {totalEscenarios} · La columna destacada es la propuesta recomendada por nuestro motor financiero.
          </div>
        </div>

        {/* RESUMEN DEL IMPACTO */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 900, color: C.greenDeep, marginBottom: 8 }}>
            RESUMEN DEL IMPACTO
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
            <ImpactCard icon={<Clock size={22} color={C.greenDeep} strokeWidth={1.7} />} label="AÑOS RECUPERADOS" value={`${añosEliminadosEntero}`} sub="años" />
            <ImpactCard icon={<CheckCircle2 size={22} color={C.greenDeep} strokeWidth={1.7} />} label="CUOTAS ELIMINADAS" value={`${cuotasEliminadas}`} sub="menos pagos" />
            <ImpactCard icon={<PiggyBank size={22} color={C.greenDeep} strokeWidth={1.7} />} label="AHORRO TOTAL" value={formatCOP(ahorroTotal)} />
            <ImpactCard icon={<CalendarDays size={22} color={C.greenDeep} strokeWidth={1.7} />} label="NUEVA FECHA FIN" value={`${añoFinOpt}`} sub={`antes de ${añoFinActual}`} />
          </div>
        </div>

        {/* BENEFICIO ECONÓMICO */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 900, color: C.ink, marginBottom: 8 }}>
            BENEFICIO ECONÓMICO
          </div>
          <div style={{
            border: `1px solid ${C.hairline}`, borderRadius: 10, padding: "12px 16px",
            display: "grid", gridTemplateColumns: "1.4fr auto auto auto auto", gap: 16, alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.ink }}>Honorarios a Éxito NUVEX</div>
              <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                Solo se cobran cuando el banco<br />aprueba la optimización.
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7.5, fontWeight: 800, color: C.muted, letterSpacing: "0.18em" }}>ESTÁNDAR</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.muted, textDecoration: "line-through", marginTop: 2 }}>
                {formatCOP(honorariosBase)}
              </div>
            </div>
            <div style={{ fontSize: 16, color: C.muted }}>→</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 7.5, fontWeight: 800, color: C.greenDeep, letterSpacing: "0.18em" }}>APROBADOS</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: C.ink, marginTop: 2 }}>
                {formatCOP(honorariosFinales)}
              </div>
            </div>
            <div style={{
              background: C.greenSoft, border: `1px solid ${C.green}66`,
              borderRadius: 8, padding: "8px 14px", textAlign: "center", minWidth: 120,
            }}>
              <div style={{ fontSize: 7.5, fontWeight: 900, color: C.greenDeep, letterSpacing: "0.16em" }}>DESCUENTO</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: C.greenDeep, marginTop: 2 }}>
                {formatCOP(descuento)}
              </div>
              <div style={{ fontSize: 7.5, color: C.redDeep, fontWeight: 800, letterSpacing: "0.14em", marginTop: 2 }}>
                VIGENCIA 48 HORAS
              </div>
            </div>
          </div>
        </div>

        {/* UNA DECISIÓN QUE IMPACTA TU FUTURO */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 900, color: C.ink, marginBottom: 6 }}>
            UNA DECISIÓN QUE IMPACTA TU FUTURO
          </div>
          <p style={{ margin: 0, fontSize: 10, lineHeight: 1.55, color: C.text }}>
            Este crédito terminará de cualquier forma. La diferencia es decidir si deseas <b>recuperar
            años de vida financiera</b> y reducir el costo total proyectado de la obligación.<br />
            Cada cuota eliminada representa tiempo que vuelve a tu familia,<br />
            tus proyectos y tu tranquilidad financiera.
          </p>
        </div>

        {/* QUE SUCEDE AHORA */}
        <div style={{ padding: "14px 22px 0 22px" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 900, color: C.greenDeep, marginBottom: 10 }}>
            ¿QUÉ SUCEDE AHORA?
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            <Step n={1} icon={<FileSignature size={22} color={C.ink} strokeWidth={1.7} />} title="Firma de autorización" desc="Nos autorizas para gestionar tu caso." />
            <Step n={2} icon={<Inbox size={22} color={C.ink} strokeWidth={1.7} />} title="Radicación ante el banco" desc="Presentamos la solicitud de optimización." />
            <Step n={3} icon={<Building2 size={22} color={C.ink} strokeWidth={1.7} />} title="Análisis del banco" desc="El banco evalúa la viabilidad." />
            <Step n={4} icon={<ClipboardCheck size={22} color={C.ink} strokeWidth={1.7} />} title="Respuesta oficial" desc="Recibes la respuesta del banco." />
            <Step n={5} icon={<Smile size={22} color="#fff" strokeWidth={1.7} />} title="Disfrutas tu optimización" desc={"Menos cuotas,\nmás tiempo y\nmás tranquilidad."} highlight />
          </div>
        </div>

        <div style={{ flex: "1 1 auto" }} />

        {/* CTA */}
        <div style={{ padding: "0 22px 12px 22px" }}>
          <div style={{
            background: C.ink, borderRadius: 10, padding: "16px 18px", textAlign: "center", color: "#fff",
          }}>
            <div style={{ fontSize: 10.5, letterSpacing: "0.22em", fontWeight: 900, color: "#fff" }}>
              UNA DECISIÓN · DOS CAMINOS
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,0.8)" }}>
              Ya hicimos los cálculos. La decisión es tuya.
            </div>
            <button style={{
              marginTop: 12, background: C.greenBtn, color: C.ink,
              border: "none", borderRadius: 8, padding: "14px 28px",
              fontSize: 13, fontWeight: 900, letterSpacing: "0.1em", width: "82%",
              cursor: "pointer",
            }}>
              QUIERO RECUPERAR MI TIEMPO FINANCIERO
            </button>
            <div style={{ marginTop: 10, fontSize: 8.5, letterSpacing: "0.22em", fontWeight: 800, color: "rgba(255,255,255,0.65)" }}>
              PROPUESTA COMERCIAL VÁLIDA POR 48 HORAS
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

function TopBar({ pageLabel }: { pageLabel: string }) {
  return (
    <div style={{
      background: C.black, color: "#fff", padding: "10px 22px",
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
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.92)", textAlign: "left", paddingLeft: 18 }}>
        Transformamos tu crédito,<br />
        <span style={{ color: C.green, fontWeight: 700 }}>recuperas tu tiempo y tu dinero.</span>
      </div>
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: "0.18em", fontWeight: 700 }}>
        {pageLabel}
      </div>
    </div>
  );
}

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
        height: 56, display: "flex", alignItems: "center", justifyContent: "center",
        background: highlight ? `linear-gradient(135deg, ${C.greenDeep}, ${C.greenBtnDeep})` : "#fff",
        border: `1px solid ${highlight ? C.greenDeep : C.hairline}`,
        borderRadius: 10, marginBottom: 8,
      }}>{icon}</div>
      <div style={{ fontSize: 9.5, fontWeight: 900, color: C.ink, lineHeight: 1.2 }}>{title}</div>
      <div style={{ fontSize: 8, color: C.muted, marginTop: 4, lineHeight: 1.35, whiteSpace: "pre-line" }}>{desc}</div>
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
