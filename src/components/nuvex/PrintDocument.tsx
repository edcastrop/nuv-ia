import type { CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileSignature,
  FolderUp,
  Globe,
  Landmark,
  MapPin,
  Pencil,
  Phone,
  PiggyBank,
  Shield,
  Smile,
  SquareCheckBig,
  Star,
  WalletCards,
} from "lucide-react";
import { NUVEX } from "./constants";
import type { ClientData } from "./ClientFields";
import { formatCOP, formatNumber } from "../../lib/format";
import type { PesosPropuesta, UVRPropuesta } from "../../lib/finance";
import type { PropuestaComercialPdfRow } from "./PropuestasComerciales";
import { calcularMotor } from "../../lib/motorHonorarios";
import logoNuvex from "@/assets/logo-nuvex-cropped.png";

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
  /** `undefined` → no detectado por OCR (renderizar "Pendiente lectura extracto"). */
  interesMensual?: number;
  /** `undefined` → no detectado por OCR (renderizar "Pendiente lectura extracto"). */
  capitalMensual?: number;
  /** `undefined` o 0 → no se muestra la fila. */
  beneficioFrechMensual?: number;
  dineroPagado?: number;
  interesesPagados?: number;
  capitalPagado?: number;
  tieneCobertura?: boolean;
  tipoBeneficio?: string;
  valorBeneficioMensual?: number;
  cuotaConCobertura?: number;
  cuotasPendientesConCobertura?: number;
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

const C = {
  black: "#030A12",
  navy: "#071A3D",
  navy2: "#0B214A",
  ink: NUVEX.negro,
  text: "#1D2638",
  muted: "#667087",
  line: "#E1E6EE",
  softLine: "#EEF2F6",
  panel: "#F8FAFC",
  blue: NUVEX.azul,
  green: NUVEX.verde,
  greenDeep: "#23814B",
  greenDark: "#17683B",
  greenSoft: "#EAF6EE",
  red: "#E05252",
  redSoft: "#FDE9E9",
};

const FONT = "'Inter','Manrope','SF Pro Display',Arial,sans-serif";
const SIGNATURE = "'Allura','Caveat','Brush Script MT',cursive";

function compactMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return formatCOP(n);
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

export function PrintDocument(props: Props) {
  const {
    mode,
    client,
    recommended,
    scenario,
    commercial,
    pesosPropuestas,
    uvrPropuestas,
    propuestasComerciales,
    bestIndex,
    dineroPagadoFecha = 0,
    valorDesembolsado = 0,
    creditState,
  } = props;

  const containerId = mode === "uvr" ? "pdf-content-uvr" : "pdf-content-pesos";
  const fechaBase = new Date();
  const fecha = shortDate(fechaBase);
  const primerNombre = (client.nombre || "Cliente").trim().split(/\s+/)[0] || "Cliente";
  const banco = client.banco || "—";
  const analista = client.asesor || "Eduard Castro";
  const productoLabel = client.tipoProducto === "leasing" ? "Leasing Habitacional" : "Crédito Hipotecario";
  const monedaLabel = mode === "uvr" ? "en UVR" : "en Pesos";
  const productoCompleto = client.tipoProducto && client.tipoProducto !== "hipotecario" && client.tipoProducto !== "leasing"
    ? client.tipoProducto
    : `${productoLabel} ${monedaLabel}`;

  const plazoOriginal = creditState?.plazoInicialMeses ?? (scenario.plazoActual + (creditState?.cuotasPagadas ?? 0));
  const cuotasPagadas = creditState?.cuotasPagadas ?? Math.max(0, plazoOriginal - scenario.plazoActual);
  const cuotasPendientes = creditState?.cuotasPendientes ?? scenario.plazoActual;
  const cuotaActual = scenario.cuotaActual;
  const nuevaCuota = scenario.nuevaCuota;
  const segurosMensuales = creditState?.seguros ?? 0;
  // Si OCR no leyó el dato, dejamos undefined para que el PDF renderice
  // "Pendiente lectura extracto" en vez de mostrar $0.
  const interesMensual = creditState?.interesMensual;
  const capitalMensual = creditState?.capitalMensual;
  const beneficioFrechMensual = creditState?.beneficioFrechMensual;
  const yaPagado = Math.max(0, dineroPagadoFecha);
  const interesesPagados = creditState?.interesesPagados ?? 0;
  const capitalPagado = creditState?.capitalPagado ?? 0;
  const tieneCobertura = creditState?.tieneCobertura ?? false;
  const tipoBeneficio = creditState?.tipoBeneficio ?? "";
  const valorBeneficioMensual = creditState?.valorBeneficioMensual ?? 0;
  const cuotaConCobertura = creditState?.cuotaConCobertura ?? 0;
  const cuotasPendientesConCobertura = creditState?.cuotasPendientesConCobertura ?? 0;
  const faltaPagarSin = Math.max(0, scenario.totalActual);
  const costoTotalSin = yaPagado + faltaPagarSin;
  const desembolsoRef = valorDesembolsado > 0 ? valorDesembolsado : 0;
  const vecesSin = desembolsoRef > 0 ? costoTotalSin / desembolsoRef : scenario.vecesActual;

  const fechaFinActual = new Date(fechaBase);
  fechaFinActual.setMonth(fechaFinActual.getMonth() + scenario.plazoActual);
  const fechaFinOpt = new Date(fechaBase);
  fechaFinOpt.setMonth(fechaFinOpt.getMonth() + scenario.nuevoPlazo);
  const añoHoy = fechaBase.getFullYear();
  const añoFinActual = fechaFinActual.getFullYear();
  const añoFinOpt = fechaFinOpt.getFullYear();
  const añosActual = scenario.plazoActual / 12;
  const añosOpt = scenario.nuevoPlazo / 12;
  const añosEliminados = Math.max(0, recommended.añosEliminados);
  const añosEliminadosEntero = Math.max(0, Math.round(añosEliminados));
  const cuotasEliminadas = Math.max(0, scenario.plazoActual - scenario.nuevoPlazo);
  const incrementoMensual = Math.max(0, nuevaCuota - cuotaActual);
  const incrementoPct = cuotaActual > 0 ? (incrementoMensual / cuotaActual) * 100 : 0;
  const honorariosFinales = commercial?.hasDiscount ? commercial.finales : recommended.honorarios;
  const honorariosBase = commercial?.honorariosBase ?? recommended.honorarios;
  const descuento = commercial?.hasDiscount ? Math.max(0, honorariosBase - honorariosFinales) : 0;

  const consistenciaOk = Math.abs((commercial?.honorariosBase ?? recommended.honorarios) - recommended.honorarios) < 1;
  if (!consistenciaOk) {
    return (
      <div id={containerId} className="nuvex-print-only" style={{ width: "210mm", background: "#fff", color: C.red, fontFamily: FONT, padding: 48 }}>
        <b>Error de consistencia</b><br />Los honorarios no coinciden con el escenario seleccionado.
      </div>
    );
  }

  const allPropuestas = propuestasComerciales?.length
    ? mapComercialesToAltRow(propuestasComerciales, cuotaActual)
    : mapPropuestasToAltRow(mode, pesosPropuestas, uvrPropuestas, cuotaActual, plazoOriginal);
  const alternativas = allPropuestas
    .map((p, idx) => ({ p, idx }))
    .filter(({ idx }) => idx !== bestIndex)
    .map(({ p }) => p)
    .sort((a, b) => a.incrementoPct - b.incrementoPct);
  const esc = [alternativas[0], alternativas[1], alternativas[2]];
  const totalEscenarios = allPropuestas.length;

  return (
    <div id={containerId} className="nuvex-print-only" style={{ background: "#fff", color: C.ink, fontFamily: FONT, width: "210mm", boxSizing: "border-box", letterSpacing: 0 }}>
      <section className="nuvex-print-page" style={pageStyle(true)}>
        <TopBar page="Página 1 de 2" />
        <main style={{ padding: "18px 30px 12px", flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 26, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>Hola, <span style={{ color: C.blue }}>{primerNombre.toUpperCase()}</span></div>
              <h1 style={{ margin: 0, color: "#080D1E", fontSize: 36, lineHeight: 1.02, fontWeight: 950, letterSpacing: 0 }}>
                RECUPERA <span style={{ color: C.greenDeep }}>{añosEliminadosEntero} AÑOS</span><br />DE TU VIDA FINANCIERA
              </h1>
              <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.38, color: C.text, fontWeight: 600 }}>
                Tu crédito puede terminar en <b style={{ color: C.greenDeep }}>{añoFinOpt}</b><br />en lugar de <b style={{ color: C.greenDeep }}>{añoFinActual}</b>.<br />Una decisión hoy puede cambiar<br />tu futuro financiero.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, borderLeft: `1px solid ${C.line}`, minHeight: 138, alignItems: "center" }}>
              <HeroKpi icon={<CalendarDays size={36} color={C.blue} />} value={`${cuotasEliminadas}`} label={<>CUOTAS<br />ELIMINADAS</>} />
              <HeroKpi icon={<Clock3 size={36} color={C.greenDeep} />} value={`${añosEliminadosEntero}`} label={<>AÑOS<br />RECUPERADOS</>} />
              <HeroKpi icon={<PiggyBank size={36} color={C.blue} />} value={compactMoney(recommended.ahorroTotal)} label={<>AHORRO<br />EN INTERESES<br />Y SEGUROS</>} />
            </div>
          </div>

          <div style={{ marginTop: 18, border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, padding: "13px 14px", display: "grid", gridTemplateColumns: "1.2fr 1.15fr 1fr 1.2fr", gap: 12 }}>
            <MetaItem icon={<Landmark />} label="BANCO" value={banco} />
            <MetaItem icon={<CreditCard />} label="PRODUCTO" value={productoCompleto} />
            <MetaItem icon={<CalendarDays />} label="FECHA" value={fecha} />
            <MetaPerson initials={initialsOf(analista)} name={analista} />
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "0.82fr 1.1fr", gap: 20 }}>
            <CurrentStateCard
              banco={banco}
              producto={productoCompleto}
              plazoOriginal={plazoOriginal}
              cuotasPagadas={cuotasPagadas}
              cuotasPendientes={cuotasPendientes}
              cuotaActual={cuotaActual}
              seguros={segurosMensuales}
              interesMensual={interesMensual}
              capitalMensual={capitalMensual}
              beneficioFrechMensual={beneficioFrechMensual}
              dineroPagado={yaPagado}
              interesesPagados={interesesPagados}
              capitalPagado={capitalPagado}
              totalPendiente={faltaPagarSin}
              costoTotal={costoTotalSin}
              veces={vecesSin}
            />
            <RecommendedCard
              nuevaCuota={nuevaCuota}
              incrementoPct={incrementoPct}
              incrementoMensual={incrementoMensual}
              ahorroTotal={recommended.ahorroTotal}
              añosEliminados={añosEliminadosEntero}
              cuotasEliminadas={cuotasEliminadas}
              añoHoy={añoHoy}
              añoFinActual={añoFinActual}
              añoFinOpt={añoFinOpt}
              añosActual={añosActual}
              añosOpt={añosOpt}
            />
          </div>

          <div style={{ marginTop: 14, background: `linear-gradient(135deg, ${C.navy}, #041229)`, color: "#fff", borderRadius: 10, padding: "18px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
            <DarkBenefit icon={<Shield size={52} color={C.green} strokeWidth={1.6} />} label="HONORARIOS A ÉXITO NUVEX" value={formatCOP(honorariosFinales)} sub="Solo se pagan si el banco aprueba la optimización." />
            <DarkBenefit icon={<Shield size={52} color={C.green} strokeWidth={1.6} />} label="VÁLIDO POR" value="48 HORAS" sub="Propuesta exclusiva para este caso." right />
          </div>

          <div style={{ marginTop: 12, background: C.navy, borderRadius: 10, color: "#fff", padding: "12px 24px", display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center", flex: "0 0 auto" }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.34, fontWeight: 600 }}>
              <span style={{ color: C.green, fontSize: 34, lineHeight: 0, verticalAlign: "middle" }}>“</span> Este crédito terminará de una u otra forma.<br />
              La diferencia es decidir si quieres <b style={{ color: C.green }}>recuperar parte de tu tiempo financiero.</b><br />
              Cada cuota eliminada es tiempo que vuelve a tu vida,<br />a tu familia y a tus proyectos.
            </div>
            <div style={{ textAlign: "center", minWidth: 200 }}>
              <div style={{ color: C.green, fontFamily: SIGNATURE, fontSize: 38, lineHeight: 0.9 }}>{analista}</div>
              <div style={{ marginTop: 6, fontSize: 10.5, letterSpacing: "0.32em", fontWeight: 900 }}>ANALISTA NUVEX</div>
            </div>
          </div>
        </main>
        <FooterStrip />
      </section>

      <section className="nuvex-print-page" style={pageStyle(false)}>
        <TopBar page="Página 2 de 2" />
        <main style={{ padding: "10px 32px 12px", flex: "1 1 auto", display: "flex", flexDirection: "column" }}>
          <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1, fontWeight: 950, color: "#071023", letterSpacing: 0 }}>COMPARACIÓN DE ESCENARIOS</h2>
          <p style={{ margin: "4px 0 9px", color: C.text, fontSize: 11.4, lineHeight: 1.28, fontWeight: 600 }}>
            Analizamos diferentes alternativas para que elijas<br />el nivel de optimización que mejor se adapta a tus objetivos financieros.
          </p>
          <ScenariosTable
            cuotaActual={cuotaActual}
            plazoActual={scenario.plazoActual}
            añoFinActual={añoFinActual}
            esc={esc}
            recNueva={nuevaCuota}
            recIncPct={incrementoPct}
            recPlazo={scenario.nuevoPlazo}
            recAñoFin={añoFinOpt}
            recAñosElim={añosEliminadosEntero}
            recCuotasElim={cuotasEliminadas}
            recAhorroTotal={recommended.ahorroTotal}
            recHonorarios={honorariosFinales}
            totalEscenarios={totalEscenarios}
          />

          <SectionLabel title="RESUMEN DEL IMPACTO" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 7 }}>
            <Impact icon={<Clock3 />} label="AÑOS RECUPERADOS" value={`${añosEliminadosEntero}`} sub="años" />
            <Impact icon={<CheckCircle2 />} label="CUOTAS ELIMINADAS" value={`${cuotasEliminadas}`} sub="menos pagos" />
            <Impact icon={<PiggyBank />} label="AHORRO TOTAL" value={formatCOP(recommended.ahorroTotal)} />
            <Impact icon={<CalendarDays />} label="NUEVA FECHA FIN" value={`${añoFinOpt}`} sub={`antes de ${añoFinActual}`} blue />
          </div>

          <div style={{ marginTop: 13, border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, padding: "16px 16px", display: "grid", gridTemplateColumns: "1.25fr 0.72fr 0.16fr 0.9fr 0.9fr", gap: 12, alignItems: "center" }}>
            <div>
              <div style={{ color: C.greenDeep, fontWeight: 950, fontSize: 14, letterSpacing: "0.06em" }}>BENEFICIO ECONÓMICO</div>
              <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 900, color: C.ink }}>Honorarios a Éxito NUVEX</div>
              <div style={{ marginTop: 3, fontSize: 10.4, color: C.text, lineHeight: 1.25, fontWeight: 600 }}>Solo se cobran cuando el banco<br />aprueba la optimización.</div>
            </div>
            <PriceBox label="ESTÁNDAR" value={formatCOP(honorariosBase)} crossed />
            <ArrowRight size={26} color={C.muted} />
            <PriceBox label="APROBADOS" value={formatCOP(honorariosFinales)} />
            <div style={{ border: `1px solid ${C.green}66`, background: "linear-gradient(180deg,#EFF9F1,#E8F5EB)", borderRadius: 9, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.greenDark, fontWeight: 950, letterSpacing: "0.12em" }}>DESCUENTO</div>
              <div style={{ color: C.greenDeep, fontSize: 19, fontWeight: 950 }}>{formatCOP(descuento)}</div>
              <div style={{ color: C.red, fontSize: 9.2, fontWeight: 950, letterSpacing: "0.08em" }}>VIGENCIA 48 HORAS</div>
            </div>
          </div>

          <SectionLabel title="¿QUÉ SUCEDE AHORA?" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 7 }}>
            <Step n={1} icon={<Pencil />} title="Firma de autorización" desc="Nos autorizas para gestionar tu caso." />
            <Step n={2} icon={<FolderUp />} title="Radicación ante el banco" desc="Presentamos la solicitud de optimización." />
            <Step n={3} icon={<Building2 />} title="Análisis del banco" desc="El banco evalúa la viabilidad." />
            <Step n={4} icon={<SquareCheckBig />} title="Respuesta oficial" desc="Recibes la respuesta del banco." green />
            <Step n={5} icon={<Smile />} title="Disfrutas tu optimización" desc="Menos cuotas, más tiempo y más tranquilidad." />
          </div>

          <div style={{ marginTop: 13, minHeight: 112, background: C.navy, borderRadius: 9, padding: "18px 24px", display: "grid", gridTemplateColumns: "1fr 1.55fr", gap: 22, alignItems: "center", color: "#fff" }}>
            <div>
              <div style={{ color: C.green, fontSize: 11, fontWeight: 950, letterSpacing: "0.22em" }}>UNA DECISIÓN · DOS CAMINOS</div>
              <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700 }}>Ya hicimos los cálculos. <span style={{ color: C.green }}>La decisión es tuya.</span></div>
            </div>
            <div>
              <div style={{ background: `linear-gradient(180deg, #A7D3AE, ${C.green})`, color: "#061122", borderRadius: 5, padding: "13px 16px", textAlign: "center", fontSize: 13, fontWeight: 950 }}>QUIERO RECUPERAR MI TIEMPO FINANCIERO</div>
              <div style={{ marginTop: 8, textAlign: "center", fontSize: 8, letterSpacing: "0.28em", fontWeight: 900, color: "rgba(255,255,255,0.7)" }}>PROPUESTA COMERCIAL VÁLIDA POR 48 HORAS</div>
            </div>
          </div>
        </main>
        <FooterStrip />
      </section>
    </div>
  );
}

function pageStyle(first: boolean): CSSProperties {
  return {
    width: "210mm",
    height: "297mm",
    maxHeight: "297mm",
    background: "#fff",
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    pageBreakAfter: first ? "always" : "auto",
    breakAfter: first ? "page" : "auto",
  };
}

function TopBar({ page }: { page: string }) {
  return (
    <div style={{ height: 70, background: "linear-gradient(90deg,#02070D,#07121C)", color: "#fff", display: "grid", gridTemplateColumns: "150px 1px 1fr auto", alignItems: "center", gap: 18, padding: "0 30px", flexShrink: 0 }}>
      <div style={{ width: 136, height: 44, display: "flex", alignItems: "center" }}>
        <img src={logoNuvex} alt="NUVEX" crossOrigin="anonymous" style={{ width: 128, height: "auto", objectFit: "contain", display: "block" }} />
      </div>
      <div style={{ height: 38, background: "rgba(255,255,255,0.22)" }} />
      <div style={{ fontSize: 13.5, lineHeight: 1.35, fontWeight: 800, color: "rgba(255,255,255,0.86)" }}>
        Transformamos tu crédito,<br /><span style={{ color: C.green }}>recuperas tu tiempo y tu dinero.</span>
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 900, color: "rgba(255,255,255,0.78)" }}>{page}</div>
    </div>
  );
}

function HeroKpi({ icon, value, label }: { icon: ReactNode; value: string; label: ReactNode }) {
  return (
    <div style={{ textAlign: "center", borderLeft: `1px solid ${C.line}`, minHeight: 96, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 5 }}>{icon}</div>
      <div style={{ color: C.greenDeep, fontSize: 28, lineHeight: 0.95, fontWeight: 950, letterSpacing: 0 }}>{value}</div>
      <div style={{ marginTop: 6, color: "#071023", fontSize: 8.4, lineHeight: 1.15, fontWeight: 950 }}>{label}</div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "center", minWidth: 0 }}>
      <div style={roundIconStyle(C.blue)}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={tinyLabelStyle}>{label}</div>
        <div style={{ color: C.ink, fontSize: 10.7, lineHeight: 1.16, fontWeight: 900, wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function MetaPerson({ initials, name }: { initials: string; name: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "38px 1fr", gap: 9, alignItems: "center" }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{initials}</div>
      <div>
        <div style={tinyLabelStyle}>PREPARADO POR</div>
        <div style={{ color: C.ink, fontSize: 10.6, fontWeight: 950, lineHeight: 1.12 }}>{name}</div>
        <div style={{ color: C.text, fontSize: 8.8, fontWeight: 600 }}>Analista Financiero</div>
        <div style={{ color: C.greenDeep, fontSize: 8.8, fontWeight: 900 }}>Certificado NUVEX</div>
      </div>
    </div>
  );
}

function CurrentStateCard(props: {
  banco: string; producto: string; plazoOriginal: number; cuotasPagadas: number; cuotasPendientes: number;
  cuotaActual: number; seguros: number;
  interesMensual: number | undefined; capitalMensual: number | undefined;
  beneficioFrechMensual: number | undefined;
  dineroPagado: number;
  interesesPagados: number; capitalPagado: number; totalPendiente: number; costoTotal: number; veces: number;
}) {
  // Si OCR no leyó el dato (undefined), ocultamos la fila para no contaminar el PDF
  // con placeholders ni con $0 falsos. Si el extracto informa 0 explícitamente, sí mostramos $0.
  const tieneInteres = typeof props.interesMensual === "number";
  const tieneCapital = typeof props.capitalMensual === "number";
  const tieneFrech = typeof props.beneficioFrechMensual === "number" && props.beneficioFrechMensual > 0;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <BlockHeader dark n="1." title="ESTADO ACTUAL DEL CRÉDITO" />
      <div style={{ padding: "13px 13px 10px" }}>
        <Group title="PRODUCTO">
          <Row label="Banco" value={props.banco} /><Row label="Producto" value={props.producto} /><Row label="Plazo inicial" value={`${props.plazoOriginal} meses`} />
        </Group>
        <Group title="CUOTAS"><Row label="Canceladas" value={`${props.cuotasPagadas}`} /><Row label="Pendientes" value={`${props.cuotasPendientes}`} /></Group>
        <Group title="CUOTA MENSUAL">
          <Row label="Cuota actual" value={formatCOP(props.cuotaActual)} />
          <Row label="Seguros" value={formatCOP(props.seguros)} />
          {tieneInteres && (
            <Row label="Interés mensual" value={formatCOP(props.interesMensual as number)} />
          )}
          {tieneCapital && (
            <Row label="Capital mensual" value={formatCOP(props.capitalMensual as number)} />
          )}
          {tieneFrech && (
            <Row label="Beneficio Fresh mensual" value={formatCOP(props.beneficioFrechMensual as number)} />
          )}
        </Group>

        <Group title="PAGADO A LA FECHA"><Row label="Dinero pagado" value={formatCOP(props.dineroPagado)} /><Row label="Intereses pagados" value={formatCOP(props.interesesPagados)} /><Row label="Capital pagado" value={formatCOP(props.capitalPagado)} /></Group>
        <Group title="PROYECCIÓN SIN NUVEX"><Row label="Dinero pendiente" value={formatCOP(props.totalPendiente)} /><Row label="Costo total proyectado" value={formatCOP(props.costoTotal)} red /></Group>
        <div style={{ marginTop: 9, background: "linear-gradient(180deg,#FFF0F0,#FDE4E4)", border: `1px solid #F7CCCC`, borderRadius: 8, padding: "10px 11px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: C.red, fontSize: 9, fontWeight: 950, letterSpacing: "0.12em" }}>N° VECES PAGADO</div>
          <div style={{ color: C.red, fontSize: 24, fontWeight: 950, lineHeight: 1 }}>{formatNumber(props.veces, 2)}x</div>
        </div>
      </div>
    </div>
  );
}

function RecommendedCard(props: {
  nuevaCuota: number; incrementoPct: number; incrementoMensual: number; ahorroTotal: number; añosEliminados: number;
  cuotasEliminadas: number; añoHoy: number; añoFinActual: number; añoFinOpt: number; añosActual: number; añosOpt: number;
}) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: "#fff" }}>
      <BlockHeader green n="2." title="PROPUESTA RECOMENDADA POR NUVEX" badge />
      <div style={{ padding: "13px 12px 11px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          <MiniMetric icon={<Banknote />} label="NUEVA CUOTA" value={formatCOP(props.nuevaCuota)} sub={`+${formatNumber(props.incrementoPct, 1)}%   |   + ${formatCOP(props.incrementoMensual)}`} />
          <MiniMetric icon={<PiggyBank />} label="AHORRO TOTAL" value={formatCOP(props.ahorroTotal)} sub="Menos intereses y seguros durante la vida del crédito" />
          <MiniMetric icon={<Clock3 />} label="AÑOS RECUPERADOS" value={`${props.añosEliminados}`} suffix="años" sub="De tu vida financiera" />
          <MiniMetric icon={<CheckCircle2 />} label="CUOTAS ELIMINADAS" value={`${props.cuotasEliminadas}`} suffix="cuotas" sub="Menos pagos mensuales" />
        </div>
        <div style={{ marginTop: 9, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ ...tinyLabelStyle, fontSize: 8.6 }}>LÍNEA DE TIEMPO · ANTES Y DESPUÉS</div>
            <div style={{ color: C.greenDeep, fontSize: 8.4, fontWeight: 950 }}>{props.añosEliminados} AÑOS RECUPERADOS</div>
          </div>
          <Timeline label="SIN NUVEX" from={props.añoHoy} to={props.añoFinActual} years={props.añosActual} color="#AAB2C2" full />
          <Timeline label="CON NUVEX" from={props.añoHoy} to={props.añoFinOpt} years={props.añosOpt} color={C.greenDeep} ratio={props.añosOpt / Math.max(props.añosActual, 1)} />
        </div>
      </div>
    </div>
  );
}

function BlockHeader({ n, title, dark, green, badge }: { n: string; title: string; dark?: boolean; green?: boolean; badge?: boolean }) {
  return (
    <div style={{ height: 31, background: green ? `linear-gradient(90deg,${C.greenDark},${C.greenDeep})` : dark ? C.navy : C.ink, color: "#fff", padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.4, fontWeight: 950, letterSpacing: "0.04em" }}>
      <span>{n} &nbsp;{title}</span>
      {badge && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: C.greenDeep, padding: "5px 9px", borderRadius: "0 0 0 8px", fontSize: 8.5 }}><Star size={10} fill="#fff" /> RECOMENDADA</span>}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div style={{ marginTop: 9 }}><div style={{ color: C.muted, fontSize: 9, fontWeight: 950, letterSpacing: "0.18em", marginBottom: 3 }}>{title}</div>{children}</div>;
}

function Row({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 8.5, lineHeight: 1.28, fontWeight: 750, color: C.text }}><span>{label}</span><b style={{ color: red ? C.red : C.ink, textAlign: "right", fontWeight: 950 }}>{value}</b></div>;
}

function MiniMetric({ icon, label, value, suffix, sub }: { icon: ReactNode; label: string; value: string; suffix?: string; sub: string }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, minHeight: 124, padding: "13px 14px", background: "#fff" }}>
      <div style={{ color: label.includes("AHORRO") ? C.greenDeep : C.blue }}>{icon}</div>
      <div style={{ marginTop: 5, ...tinyLabelStyle }}>{label}</div>
      <div style={{ marginTop: 8, color: C.greenDeep, fontSize: value.length > 13 ? 20 : 24, lineHeight: 1, fontWeight: 950, letterSpacing: 0 }}>{value} {suffix && <span style={{ color: C.ink, fontSize: 12, fontWeight: 900 }}>{suffix}</span>}</div>
      <div style={{ marginTop: 7, fontSize: 9.3, color: C.text, lineHeight: 1.25, fontWeight: 650 }}>{sub}</div>
    </div>
  );
}

function Timeline({ label, from, to, years, color, ratio = 1, full = false }: { label: string; from: number; to: number; years: number; color: string; ratio?: number; full?: boolean }) {
  const pct = full ? 96 : Math.max(28, Math.min(96, ratio * 96));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 52px", gap: 8, alignItems: "center", marginTop: 7 }}>
      <div style={{ fontSize: 8, fontWeight: 950, color: C.ink }}>{label}</div>
      <div style={{ position: "relative", height: 13 }}>
        <div style={{ position: "absolute", inset: "5px 0", background: C.softLine, borderRadius: 99 }} />
        <div style={{ position: "absolute", left: 0, top: 5, height: 3, width: `${pct}%`, background: color, borderRadius: 99 }} />
        <div style={{ position: "absolute", left: 0, top: 1, width: 11, height: 11, borderRadius: "50%", background: color }} />
        <div style={{ position: "absolute", left: `calc(${pct}% - 9px)`, top: 1, width: 11, height: 11, borderRadius: "50%", background: color }} />
        <div style={{ position: "absolute", left: 0, top: -8, fontSize: 7, fontWeight: 900, color: C.ink }}>{from}</div>
        <div style={{ position: "absolute", left: `calc(${pct}% - 8px)`, top: -8, fontSize: 7, fontWeight: 900, color: C.ink }}>{to}</div>
      </div>
      <div style={{ color, background: color === C.greenDeep ? C.greenSoft : C.panel, borderRadius: 5, padding: "3px 5px", fontSize: 8, fontWeight: 950, textAlign: "center" }}>{formatNumber(years, 1)} años</div>
    </div>
  );
}

function DarkBenefit({ icon, label, value, sub, right }: { icon: ReactNode; label: string; value: string; sub: string; right?: boolean }) {
  return <div style={{ display: "grid", gridTemplateColumns: "58px 1fr", gap: 14, alignItems: "center", borderLeft: right ? "1px solid rgba(255,255,255,0.22)" : undefined, paddingLeft: right ? 38 : 0 }}>{icon}<div><div style={{ color: C.green, fontSize: 10.5, fontWeight: 950, letterSpacing: "0.12em" }}>{label}</div><div style={{ marginTop: 3, color: "#fff", fontSize: 22, lineHeight: 1, fontWeight: 950 }}>{value}</div><div style={{ marginTop: 4, color: "rgba(255,255,255,0.82)", fontSize: 10, lineHeight: 1.25, fontWeight: 650 }}>{sub}</div></div></div>;
}

function ScenariosTable(props: {
  cuotaActual: number; plazoActual: number; añoFinActual: number; esc: Array<AltRow | undefined>; recNueva: number; recIncPct: number; recPlazo: number; recAñoFin: number; recAñosElim: number; recCuotasElim: number; recAhorroTotal: number; recHonorarios: number; totalEscenarios: number;
}) {
  const labels = ["Conservador", "Equilibrado", "Acelerado"];
  const fmtVal = (v: AltRow | undefined, key: (r: AltRow) => string) => v ? key(v) : "—";
  const rows: Array<[string, string, string, string, string, string]> = [
    ["Nueva cuota", formatCOP(props.cuotaActual), ...props.esc.map(e => fmtVal(e, r => formatCOP(r.nuevaCuota))), formatCOP(props.recNueva)] as [string, string, string, string, string, string],
    ["Incremento mensual", "—", ...props.esc.map(e => e ? `+${formatCOP(Math.max(0, e.nuevaCuota - props.cuotaActual))}` : "—"), `+${formatCOP(Math.max(0, props.recNueva - props.cuotaActual))}`] as [string, string, string, string, string, string],
    ["Nuevo plazo", `${props.plazoActual} m`, ...props.esc.map(e => e ? `${Math.round(e.añosOpt * 12)} m` : "—"), `${props.recPlazo} m`] as [string, string, string, string, string, string],
    ["Fecha final", `${props.añoFinActual}`, ...props.esc.map(e => e ? `${e.añoFinOpt}` : "—"), `${props.recAñoFin}`] as [string, string, string, string, string, string],
    ["Años recuperados", "—", ...props.esc.map(e => e ? `${Math.round(e.añosEliminados)}` : "—"), `${props.recAñosElim}`] as [string, string, string, string, string, string],
    ["Cuotas eliminadas", "—", ...props.esc.map(e => e ? `${e.cuotasEliminadas}` : "—"), `${props.recCuotasElim}`] as [string, string, string, string, string, string],
    ["Ahorro total", "—", ...props.esc.map(e => e ? formatCOP(e.ahorroTotal) : "—"), formatCOP(props.recAhorroTotal)] as [string, string, string, string, string, string],
    ["Honorarios a éxito", "—", ...props.esc.map(e => e ? formatCOP(e.honorariosFinal) : "—"), formatCOP(props.recHonorarios)] as [string, string, string, string, string, string],
    ["Beneficio comercial", "—", ...props.esc.map(() => "—"), "Aprobado"] as [string, string, string, string, string, string],
  ];
  const cols = "1.55fr 1fr 1fr 1fr 1fr 1.1fr";
  const headBase: CSSProperties = { color: "#fff", padding: "9px 6px", fontSize: 9, lineHeight: 1.12, fontWeight: 950, textAlign: "center", borderRight: "1px solid rgba(255,255,255,0.12)" };
  const headDark: CSSProperties = { ...headBase, background: "linear-gradient(180deg,#06111E,#071A3D)" };
  const headGreen: CSSProperties = { ...headBase, background: `linear-gradient(180deg,${C.greenDeep},${C.greenDark})`, borderRight: `1px solid ${C.greenDark}` };
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 7, overflow: "hidden", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols }}>
        <div style={headDark}>CONCEPTO</div>
        <div style={headDark}>ACTUAL</div>
        {labels.map((l, i) => (
          <div key={l} style={headDark}><div>ESCENARIO {i + 1}</div><div style={{ fontSize: 7.6, fontWeight: 800, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>{l}</div></div>
        ))}
        <div style={headGreen}><div>★ NUVEX</div><div style={{ fontSize: 7.6, fontWeight: 800, color: "rgba(255,255,255,0.85)", marginTop: 1 }}>RECOMENDADO</div></div>
      </div>
      {rows.map((r, ri) => (
        <div key={r[0]} style={{ display: "grid", gridTemplateColumns: cols, borderTop: `1px solid ${C.softLine}` }}>
          {r.map((c, i) => {
            const isRec = i === 5;
            const isLabel = i === 0;
            return (
              <div key={i} style={{
                background: isRec ? "#EAF6EE" : ri % 2 === 1 ? "#FAFBFD" : "#fff",
                color: isRec ? C.greenDark : isLabel ? C.ink : C.text,
                fontWeight: isLabel ? 900 : isRec ? 950 : 800,
                fontSize: 9.4,
                lineHeight: 1.15,
                padding: "8px 8px",
                textAlign: isLabel ? "left" : "center",
                borderRight: `1px solid ${isRec ? "#CFE9D6" : C.line}`,
              }}>{c}</div>
            );
          })}
        </div>
      ))}
      <div style={{ background: C.panel, borderTop: `1px solid ${C.line}`, color: C.muted, textAlign: "center", fontSize: 8.6, fontWeight: 800, padding: "7px 10px" }}>Total de escenarios analizados: {props.totalEscenarios} · La columna destacada es la propuesta recomendada por nuestro motor financiero.</div>
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <div style={{ marginTop: 12, color: C.greenDeep, fontSize: 13.5, fontWeight: 950, letterSpacing: "0.05em" }}>{title}</div>;
}

function Impact({ icon, label, value, sub, blue }: { icon: ReactNode; label: string; value: string; sub?: string; blue?: boolean }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", minHeight: 79, padding: "12px 15px", display: "grid", gridTemplateColumns: "34px 1fr", gap: 10, alignItems: "center" }}>
      <div style={{ color: blue ? C.blue : C.greenDeep }}>{icon}</div>
      <div><div style={tinyLabelStyle}>{label}</div><div style={{ marginTop: 5, color: blue ? C.blue : C.greenDeep, fontSize: 22, fontWeight: 950, lineHeight: 1 }}>{value}</div>{sub && <div style={{ fontSize: 9.5, color: C.text, fontWeight: 650 }}>{sub}</div>}</div>
    </div>
  );
}

function PriceBox({ label, value, crossed }: { label: string; value: string; crossed?: boolean }) {
  return <div><div style={{ ...tinyLabelStyle, textAlign: "center" }}>{label}</div><div style={{ marginTop: 7, color: C.ink, fontSize: 18, lineHeight: 1, fontWeight: 950, textAlign: "center", textDecoration: crossed ? "line-through" : undefined }}>{value}</div></div>;
}

function Step({ n, icon, title, desc, green }: { n: number; icon: ReactNode; title: string; desc: string; green?: boolean }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, background: "#fff", minHeight: 126, padding: "10px 12px", position: "relative" }}>
      <div style={{ position: "absolute", left: 7, top: 7, width: 20, height: 20, borderRadius: "50%", background: C.black, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 950 }}>{n}</div>
      <div style={{ marginTop: 19, color: green ? C.greenDeep : C.ink, display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ marginTop: 10, color: C.ink, fontSize: 10.2, lineHeight: 1.14, fontWeight: 950 }}>{title}</div>
      <div style={{ marginTop: 7, color: C.text, fontSize: 8.5, lineHeight: 1.22, fontWeight: 600 }}>{desc}</div>
    </div>
  );
}

function FooterStrip() {
  return (
    <div data-pdf-footer="true" style={{ height: 43, background: "linear-gradient(90deg,#02070D,#07121C)", color: "#fff", display: "grid", gridTemplateColumns: "1.15fr 1.15fr 1fr 1fr", gap: 14, alignItems: "center", padding: "0 31px", flexShrink: 0 }}>
      <FooterItem icon={<MapPin />} title="Bucaramanga" lines={["Cra. 16 # 37-48 Piso 4", "Centro"]} />
      <FooterItem icon={<MapPin />} title="Bogotá (Aliado Jurídico)" lines={["Calle 93 # 18 - 28", "Of. 704"]} />
      <FooterItem icon={<Phone />} lines={["+57 316 402 3779"]} />
      <FooterItem icon={<Globe />} lines={["www.nuvex.com.co"]} />
    </div>
  );
}

function FooterItem({ icon, title, lines }: { icon: ReactNode; title?: string; lines: string[] }) {
  return <div style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 8, alignItems: "center" }}><div style={{ color: C.green, border: `1px solid ${C.green}55`, width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div><div style={{ fontSize: 8.4, lineHeight: 1.13, fontWeight: 700 }}>{title && <div style={{ color: "#fff", fontWeight: 900 }}>{title}</div>}{lines.map((l, i) => <div key={i} style={{ color: "rgba(255,255,255,0.82)" }}>{l}</div>)}</div></div>;
}

const tinyLabelStyle: CSSProperties = { color: C.muted, fontSize: 8.2, fontWeight: 950, letterSpacing: "0.15em", lineHeight: 1.1 };

function roundIconStyle(color: string): CSSProperties {
  return { width: 34, height: 34, borderRadius: "50%", border: `1px solid ${C.line}`, background: "#fff", color, display: "flex", alignItems: "center", justifyContent: "center" };
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

function computeHonorarios(ahorroIntereses: number, ahorroSeguros: number, mode: "pesos" | "uvr", plazoOriginal: number): { honorariosFinal: number; honorariosBase: number; minimoAplicado: boolean } {
  const r = calcularMotor({ ahorroIntereses, ahorroSeguros, tipoCredito: mode, plazoOriginalMeses: plazoOriginal });
  return { honorariosFinal: r.honorarioRecomendado, honorariosBase: r.honorarioTeorico, minimoAplicado: r.alertaTope === "minimo" };
}

function mapComercialesToAltRow(propuestas: PropuestaComercialPdfRow[], cuotaActual: number): AltRow[] {
  const fechaBase = new Date();
  return propuestas.map((p) => {
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    return {
      nuevaCuota: p.nuevaCuota,
      incrementoPct: typeof p.incrementoMensual === "number" && cuotaActual > 0 ? (p.incrementoMensual / cuotaActual) * 100 : cuotaActual > 0 ? ((p.nuevaCuota - cuotaActual) / cuotaActual) * 100 : 0,
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

function mapPropuestasToAltRow(mode: "pesos" | "uvr", pesosPropuestas: PesosPropuesta[] | undefined, uvrPropuestas: UVRPropuesta[] | undefined, cuotaActual: number, plazoOriginal: number): AltRow[] {
  const fechaBase = new Date();
  if (mode === "uvr") {
    return (uvrPropuestas || []).map((p) => {
      const cuota = p.nuevaCuotaConSeguroAprox;
      const fechaFin = new Date(fechaBase);
      fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
      const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "uvr", plazoOriginal);
      return { nuevaCuota: cuota, incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0, añosEliminados: p.añosEliminados, cuotasEliminadas: p.cuotasEliminadas, ahorroTotal: p.ahorroTotal, añoFinOpt: fechaFin.getFullYear(), añosOpt: p.nuevoPlazo / 12, ...h };
    });
  }
  return (pesosPropuestas || []).map((p) => {
    const cuota = p.nuevaCuotaConSeguro;
    const fechaFin = new Date(fechaBase);
    fechaFin.setMonth(fechaFin.getMonth() + p.nuevoPlazo);
    const h = computeHonorarios(p.ahorroIntereses, p.ahorroSeguros, "pesos", plazoOriginal);
    return { nuevaCuota: cuota, incrementoPct: cuotaActual > 0 ? ((cuota - cuotaActual) / cuotaActual) * 100 : 0, añosEliminados: p.añosEliminados, cuotasEliminadas: p.cuotasEliminadas, ahorroTotal: p.ahorroTotal, añoFinOpt: fechaFin.getFullYear(), añosOpt: p.nuevoPlazo / 12, ...h };
  });
}

function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "NX";
}