// CaseSnapshotPDF — render visual (HTML/CSS) del expediente para captura PDF.
// Estilo dark NUVIA Financial Intelligence. Se renderiza en un contenedor 794×1123px.
// No usa Tailwind para evitar dependencias de tema; todos los estilos inline.

import { forwardRef, type CSSProperties } from "react";
import {
  Building2,
  FileText,
  DollarSign,
  CheckCircle2,
  User,
  Calendar,
  Copy,
  Gauge,
  Target,
  Network,
  Check,
  FileSignature,
  ClipboardCheck,
  Send,
  Inbox,
  FileCheck2,
  Receipt,
  ShieldCheck,
  FlaskConical,
  ClipboardList,
} from "lucide-react";

/* ============================ TOKENS ============================ */
const C = {
  bgPage: "#0A0E1A",
  bgCard: "#111827",
  bgInner: "#1A2235",
  border: "#1E2D45",
  blue: "#3B82F6",
  green: "#10B981",
  purple: "#8B5CF6",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#F9FAFB",
  textSec: "#9CA3AF",
  textLabel: "#6B7280",
};

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;

/* ============================ TYPES ============================ */
export type PipelineEstado =
  | "completado"
  | "en_proceso"
  | "pendiente"
  | "no_iniciado";

export interface CaseSnapshotData {
  id: string;
  cliente: { nombre: string; cc: string };
  banco: string;
  producto: string;
  modalidad: string;
  estado: string;
  analista: string;
  qaScore: number;
  nivelAutonomia: string;
  fecha: string;
  credito: {
    saldoActual: number;
    cuotaActual: number;
    cuotasPendientes: number;
    costoTotal: number;
    multiplicador: number;
  };
  propuesta: {
    nuevaCuota: number;
    nuevoPlazo: number;
    cuotasEliminadas: number;
    ahorroTotal: number;
    ahorroIntereses: number;
    ahorroSeguros: number;
    tiempoRecuperado: string;
  };
  honorarios: {
    pactados: number;
    recalculados: number;
    variacion: number;
    estadoCobro: string;
    estadoPago: string;
    pazYSalvo: boolean;
  };
  pipeline: Array<{ nombre: string; estado: PipelineEstado }>;
  intervinientes: Array<{ rol: string; nombre: string; correo: string }>;
  trazabilidad: Array<{ fecha: string; accion: string; usuario: string }>;
}

export interface CaseSnapshotPDFProps {
  expediente: CaseSnapshotData;
}

/* ============================ HELPERS ============================ */
const cop = (n: number) =>
  "$" +
  Math.round(n || 0)
    .toLocaleString("es-CO")
    .replace(/,/g, ".");

const initials = (name: string) =>
  (name || "—")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "—";

const fechaHoy = () =>
  new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/* ============================ ATOMS ============================ */
const SectionLabel = ({ children, style }: { children: React.ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: C.textLabel,
      marginBottom: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

const MetricLabel = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      fontSize: 10,
      fontWeight: 500,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: C.textSec,
    }}
  >
    {children}
  </div>
);

const Card: React.FC<{ children: React.ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.bgCard,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

const InnerCard: React.FC<{ children: React.ReactNode; style?: CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      background: C.bgInner,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      padding: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

const Pill: React.FC<{ color: string; children: React.ReactNode; style?: CSSProperties }> = ({
  color,
  children,
  style,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 10px",
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color,
      background: `${color}20`,
      border: `1px solid ${color}55`,
      ...style,
    }}
  >
    {children}
  </span>
);

const Avatar: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 32,
  color = C.blue,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: C.bgInner,
      border: `1px solid ${C.border}`,
      color,
      fontSize: size * 0.38,
      fontWeight: 700,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    {initials(name)}
  </div>
);

/* ============================ PIPELINE ============================ */
const PIPELINE_ICONS: Record<string, any> = {
  Simulación: FlaskConical,
  QA: ShieldCheck,
  Contrato: FileSignature,
  Poder: FileText,
  Checklist: ClipboardCheck,
  Radicación: Send,
  "Respuesta Banco": Inbox,
  "Informe Final": FileCheck2,
  "Cuenta Cobro": Receipt,
  "Paz y Salvo": ClipboardList,
};

const PipelineStep: React.FC<{ nombre: string; estado: PipelineEstado; isLast: boolean }> = ({
  nombre,
  estado,
  isLast,
}) => {
  const Icon = PIPELINE_ICONS[nombre] ?? Check;
  let bg = C.bgInner;
  let border = C.border;
  let iconColor = C.textLabel;
  if (estado === "completado") {
    bg = C.green;
    border = C.green;
    iconColor = "#fff";
  } else if (estado === "en_proceso") {
    bg = C.blue;
    border = C.blue;
    iconColor = "#fff";
  } else if (estado === "pendiente") {
    bg = C.bgInner;
    border = C.amber;
    iconColor = C.amber;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
      {!isLast && (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            width: "100%",
            height: 2,
            background: estado === "completado" ? C.green : C.border,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: bg,
          border: `1.5px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor,
          zIndex: 1,
        }}
      >
        <Icon size={14} strokeWidth={2.5} />
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 8.5,
          color: estado === "no_iniciado" ? C.textLabel : C.textSec,
          textAlign: "center",
          fontWeight: 600,
          lineHeight: 1.2,
          maxWidth: 64,
        }}
      >
        {nombre}
      </div>
    </div>
  );
};

/* ============================ MAIN ============================ */
export const CaseSnapshotPDF = forwardRef<HTMLDivElement, CaseSnapshotPDFProps>(
  ({ expediente: e }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: 794,
          minHeight: 1123,
          background: C.bgPage,
          color: C.text,
          fontFamily: FONT,
          padding: 32,
          boxSizing: "border-box",
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {/* [1] HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>NUVIA</span>
              <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", color: C.blue }}>
                FINANCIAL INTELLIGENCE
              </span>
            </div>
            <div
              style={{
                marginTop: 6,
                width: 220,
                height: 2,
                background: `linear-gradient(90deg, ${C.blue}, ${C.purple}, transparent)`,
                borderRadius: 2,
              }}
            />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: C.textSec }}>Fecha de emisión:</div>
            <div style={{ fontSize: 11, color: C.text, fontWeight: 600 }}>{fechaHoy()}</div>
            <div style={{ fontSize: 9, color: C.textLabel, marginTop: 4 }}>
              Documento ejecutivo · No reemplaza el expediente operativo
            </div>
          </div>
        </div>

        {/* [2] TÍTULO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>
              CASE SNAPSHOT
            </div>
            <div style={{ fontSize: 11, color: C.textSec, marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Resumen ejecutivo del caso
            </div>
          </div>
          <div
            style={{
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              padding: "8px 14px",
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 9, color: C.textLabel, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ID Expediente
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: C.blue,
                marginTop: 2,
                fontWeight: 600,
              }}
            >
              {e.id.slice(0, 18)}
            </div>
          </div>
        </div>

        {/* [3] CARD CLIENTE */}
        <Card style={{ padding: 16, marginBottom: 18 }}>
          {/* Row 1 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Col 1 cliente */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1.8, minWidth: 0 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: C.bgInner,
                  border: `1px solid ${C.border}`,
                  color: C.blue,
                  fontSize: 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials(e.cliente.nombre)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
                  {e.cliente.nombre}
                </div>
                <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>CC {e.cliente.cc}</div>
              </div>
            </div>

            <Divider />
            <ColField icon={Building2} label="Banco" value={e.banco} />
            <Divider />
            <ColField icon={FileText} label="Producto" value={e.producto} />
            <Divider />
            <ColField icon={DollarSign} label="Modalidad" value={e.modalidad} />
            <Divider />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <CheckCircle2 size={11} color={C.green} />
                <MetricLabel>Estado del caso</MetricLabel>
              </div>
              <Pill color={C.green}>{e.estado}</Pill>
            </div>
          </div>

          <div style={{ height: 1, background: C.border, margin: "14px 0" }} />

          {/* Row 2 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ColField icon={User} label="Analista" value={e.analista} />
            <Divider />
            <div style={{ flex: 1.3 }}>
              <MetricLabel>Score QA</MetricLabel>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.blue, marginTop: 2 }}>
                {e.qaScore.toFixed(1)}{" "}
                <span style={{ fontSize: 10, color: C.textSec, fontWeight: 500 }}>/ 100</span>
              </div>
              <div style={{ height: 4, background: C.border, borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.max(0, e.qaScore))}%`,
                    background: `linear-gradient(90deg, ${C.blue}, ${C.purple})`,
                  }}
                />
              </div>
            </div>
            <Divider />
            <div style={{ flex: 1.2 }}>
              <MetricLabel>Nivel autonomía</MetricLabel>
              <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                <Pill color={C.blue}>{e.nivelAutonomia}</Pill>
                <Pill color={C.amber}>Supervisada</Pill>
              </div>
            </div>
            <Divider />
            <ColField icon={Calendar} label="Fecha" value={e.fecha} />
          </div>
        </Card>

        {/* [4] FOTO COMPLETA DEL CRÉDITO */}
        <SectionLabel>Foto completa del crédito</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <MetricCard label="Saldo actual" value={cop(e.credito.saldoActual)} />
          <MetricCard label="Cuota actual" value={cop(e.credito.cuotaActual)} />
          <MetricCard label="Cuotas pendientes" value={String(e.credito.cuotasPendientes)} />
          <MetricCard label="Costo total del crédito" value={cop(e.credito.costoTotal)} />
        </div>

        <div
          style={{
            background: `linear-gradient(120deg, #1A1040 0%, ${C.bgCard} 70%)`,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${C.purple}`,
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 18,
            marginBottom: 18,
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <MetricLabel>Vas a pagar</MetricLabel>
            <div style={{ fontSize: 44, fontWeight: 800, color: C.purple, lineHeight: 1, letterSpacing: "-0.03em" }}>
              {e.credito.multiplicador.toFixed(2)}x
            </div>
            <div style={{ fontSize: 10, color: C.textSec, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              El valor de tu crédito
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 11.5, color: C.textSec, lineHeight: 1.55 }}>
            Si mantienes las condiciones actuales pagarás{" "}
            <strong style={{ color: C.blue }}>{e.credito.multiplicador.toFixed(2)} veces</strong> el valor desembolsado.
            La propuesta NUVIA reduce significativamente este múltiplo y libera capacidad financiera.
          </div>
        </div>

        {/* [5] DIAGNÓSTICO + PROPUESTA */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          {/* IZQ — DIAGNÓSTICO */}
          <div>
            <SectionLabel>Diagnóstico NUVIA AI</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <DiagCard icon={Gauge} label="Riesgo operativo" value="MEDIO" color={C.amber} />
              <DiagCard icon={Target} label="Viabilidad" value="ALTA" color={C.green} />
              <DiagCard icon={Network} label="Complejidad" value="MEDIA" color={C.amber} />
            </div>
            <div style={{ fontSize: 11.5, color: C.textSec, lineHeight: 1.5, marginBottom: 10 }}>
              Existe una <strong style={{ color: C.blue }}>oportunidad de optimización</strong> sobre la estructura
              actual del crédito. La propuesta seleccionada{" "}
              <strong style={{ color: C.blue }}>reduce el tiempo de deuda</strong> y libera flujo de caja sin alterar el
              perfil de riesgo del cliente.
            </div>

            <InnerCard style={{ padding: 12 }}>
              <SectionLabel style={{ marginBottom: 8, fontSize: 9 }}>Honorarios</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <HonCol label="Pactados" value={cop(e.honorarios.pactados)} />
                <HonCol label="Recalculados" value={cop(e.honorarios.recalculados)} />
                <HonCol
                  label="Variación"
                  value={`${e.honorarios.variacion >= 0 ? "+" : ""}${cop(e.honorarios.variacion)}`}
                  color={e.honorarios.variacion < 0 ? C.red : C.green}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: `1px solid ${C.border}`,
                  flexWrap: "wrap",
                }}
              >
                <StatusChip label="Estado cobro" value={e.honorarios.estadoCobro} />
                <StatusChip label="Estado pago" value={e.honorarios.estadoPago} />
                <StatusChip
                  label="Paz y salvo"
                  value={e.honorarios.pazYSalvo ? "Sí" : "No"}
                  color={e.honorarios.pazYSalvo ? C.green : C.amber}
                />
              </div>
            </InnerCard>
          </div>

          {/* DER — PROPUESTA */}
          <div>
            <SectionLabel>Propuesta seleccionada</SectionLabel>
            <div
              style={{
                background: "linear-gradient(135deg, #0F2A1A 0%, #0B1A14 100%)",
                border: `1px solid ${C.green}`,
                borderRadius: 12,
                padding: 14,
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <Pill color={C.green}>★ Recomendada por NUVIA</Pill>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 28 }}>
                <PropMetric
                  label="Nueva cuota"
                  value={cop(e.propuesta.nuevaCuota)}
                  sub={`${e.propuesta.nuevaCuota > e.credito.cuotaActual ? "+" : ""}${
                    e.credito.cuotaActual
                      ? (((e.propuesta.nuevaCuota - e.credito.cuotaActual) / e.credito.cuotaActual) * 100).toFixed(1)
                      : "0"
                  }% vs actual`}
                  subColor={C.textSec}
                />
                <PropMetric
                  label="Nuevo plazo"
                  value={`${e.propuesta.nuevoPlazo} meses`}
                  sub={`-${Math.max(0, e.credito.cuotasPendientes - e.propuesta.nuevoPlazo)} meses`}
                  subColor={C.green}
                />
                <PropMetric
                  label="Cuotas eliminadas"
                  value={String(e.propuesta.cuotasEliminadas)}
                  sub={`${
                    e.credito.cuotasPendientes
                      ? ((e.propuesta.cuotasEliminadas / e.credito.cuotasPendientes) * 100).toFixed(1)
                      : "0"
                  }% del plazo`}
                  subColor={C.green}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 10,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                <PropMetric
                  label="Ahorro total"
                  value={cop(e.propuesta.ahorroTotal)}
                  sub={`${
                    e.credito.costoTotal
                      ? ((e.propuesta.ahorroTotal / e.credito.costoTotal) * 100).toFixed(1)
                      : "0"
                  }% del total`}
                  subColor={C.textSec}
                  highlight={C.green}
                />
                <PropMetric
                  label="Ahorro intereses"
                  value={cop(e.propuesta.ahorroIntereses)}
                  sub="Proyección estimada"
                  subColor={C.textLabel}
                  highlight={C.green}
                />
                <PropMetric
                  label="Ahorro seguros"
                  value={cop(e.propuesta.ahorroSeguros)}
                  sub="Proyección estimada"
                  subColor={C.textLabel}
                  highlight={C.green}
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: `${C.green}15`,
                  border: `1px solid ${C.green}55`,
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <Calendar size={20} color={C.green} />
                <div>
                  <div style={{ fontSize: 9, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Tiempo recuperado
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>
                    {e.propuesta.tiempoRecuperado}
                  </div>
                  <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>
                    Reducción en el tiempo total de deuda
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* [6] PIPELINE */}
        <SectionLabel>Estado operativo del caso</SectionLabel>
        <Card style={{ padding: 14, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {e.pipeline.map((p, i) => (
              <PipelineStep key={i} nombre={p.nombre} estado={p.estado} isLast={i === e.pipeline.length - 1} />
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginTop: 12,
              paddingTop: 10,
              borderTop: `1px solid ${C.border}`,
              fontSize: 9,
              color: C.textSec,
            }}
          >
            <LegendDot color={C.green} label="Completado" />
            <LegendDot color={C.blue} label="En proceso" />
            <LegendDot color={C.amber} label="Pendiente" outline />
            <LegendDot color={C.textLabel} label="No iniciado" outline />
          </div>
        </Card>

        {/* [7] INTERVINIENTES + TRAZABILIDAD */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <div>
            <SectionLabel>Intervinientes</SectionLabel>
            <Card style={{ padding: 10 }}>
              <TableHeader cols={["Rol", "Nombre", "Correo"]} ratios={[1, 1.3, 1.5]} />
              {e.intervinientes.slice(0, 6).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    padding: "8px 0",
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 10.5,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, color: C.textSec, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", fontSize: 9 }}>
                    {p.rol}
                  </div>
                  <div style={{ flex: 1.3, display: "flex", alignItems: "center", gap: 6, color: C.text }}>
                    <Avatar name={p.nombre} size={22} />
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nombre}</span>
                  </div>
                  <div style={{ flex: 1.5, color: C.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.correo}
                  </div>
                </div>
              ))}
              {e.intervinientes.length === 0 && (
                <div style={{ padding: 12, color: C.textLabel, fontSize: 11, textAlign: "center" }}>Sin registros</div>
              )}
            </Card>
          </div>

          <div>
            <SectionLabel>Trazabilidad</SectionLabel>
            <Card style={{ padding: 10 }}>
              <TableHeader cols={["Fecha", "Acción", "Usuario"]} ratios={[1, 1.6, 1]} />
              {e.trazabilidad.slice(0, 5).map((t, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    padding: "8px 0",
                    borderTop: `1px solid ${C.border}`,
                    fontSize: 10.5,
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, color: C.textSec, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: C.blue, flexShrink: 0 }} />
                    {t.fecha}
                  </div>
                  <div style={{ flex: 1.6, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.accion}
                  </div>
                  <div style={{ flex: 1, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.usuario}
                  </div>
                </div>
              ))}
              {e.trazabilidad.length === 0 && (
                <div style={{ padding: 12, color: C.textLabel, fontSize: 11, textAlign: "center" }}>Sin registros</div>
              )}
            </Card>
          </div>
        </div>

        {/* [8] FOOTER */}
        <div
          style={{
            borderTop: `1px solid ${C.border}`,
            paddingTop: 12,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text, letterSpacing: "0.02em" }}>
              NUVIA <span style={{ color: C.blue, fontWeight: 600 }}>Financial Intelligence</span>
            </div>
            <div style={{ fontSize: 9, color: C.blue, marginTop: 2 }}>
              Transformamos datos en decisiones financieras inteligentes.
            </div>
          </div>
          <div style={{ fontSize: 9, color: C.textLabel }}>Página 1 de 1</div>
        </div>
      </div>
    );
  },
);

CaseSnapshotPDF.displayName = "CaseSnapshotPDF";

/* ============================ SUB-COMPONENTS ============================ */
const Divider = () => (
  <div style={{ width: 1, alignSelf: "stretch", background: C.border, margin: "0 4px" }} />
);

const ColField: React.FC<{ icon: any; label: string; value: string; flex?: number }> = ({ icon: Icon, label, value, flex = 1 }) => (
  <div style={{ flex, minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <Icon size={11} color={C.textSec} />
      <MetricLabel>{label}</MetricLabel>
    </div>
    <div
      style={{
        fontSize: 12,
        color: C.text,
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "normal",
        wordBreak: "break-word",
        lineHeight: 1.3,
      }}
    >
      {value}
    </div>
  </div>
);

const MetricCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <InnerCard>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
      <MetricLabel>{label}</MetricLabel>
      <Copy size={11} color={C.textLabel} />
    </div>
    <div style={{ fontSize: 19, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>{value}</div>
  </InnerCard>
);

const DiagCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <InnerCard style={{ padding: 10 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
      <Icon size={12} color={color} />
      <MetricLabel>{label}</MetricLabel>
    </div>
    <div style={{ fontSize: 14, fontWeight: 800, color, letterSpacing: "0.04em" }}>{value}</div>
  </InnerCard>
);

const HonCol: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = C.text }) => (
  <div>
    <MetricLabel>{label}</MetricLabel>
    <div style={{ fontSize: 13, fontWeight: 700, color, marginTop: 3 }}>{value}</div>
  </div>
);

const StatusChip: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color = C.textSec,
}) => (
  <div
    style={{
      fontSize: 9,
      color: C.textLabel,
      textTransform: "uppercase",
      letterSpacing: "0.08em",
      display: "flex",
      gap: 4,
      alignItems: "center",
    }}
  >
    <span>{label}:</span>
    <span style={{ color, fontWeight: 700 }}>{value}</span>
  </div>
);

const PropMetric: React.FC<{
  label: string;
  value: string;
  sub: string;
  subColor: string;
  highlight?: string;
}> = ({ label, value, sub, subColor, highlight }) => (
  <div>
    <MetricLabel>{label}</MetricLabel>
    <div
      style={{
        fontSize: 16,
        fontWeight: 800,
        color: highlight ?? C.text,
        marginTop: 3,
        letterSpacing: "-0.01em",
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 9, color: subColor, marginTop: 2 }}>{sub}</div>
  </div>
);

const TableHeader: React.FC<{ cols: string[]; ratios: number[] }> = ({ cols, ratios }) => (
  <div style={{ display: "flex", padding: "4px 0 8px" }}>
    {cols.map((c, i) => (
      <div
        key={c}
        style={{
          flex: ratios[i],
          fontSize: 9,
          fontWeight: 700,
          color: C.textLabel,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {c}
      </div>
    ))}
  </div>
);

const LegendDot: React.FC<{ color: string; label: string; outline?: boolean }> = ({ color, label, outline }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: outline ? "transparent" : color,
        border: `1.5px solid ${color}`,
      }}
    />
    <span>{label}</span>
  </div>
);
