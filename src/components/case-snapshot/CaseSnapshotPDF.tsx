// CaseSnapshotPDF — render visual pixel-perfect del expediente para captura PDF.
// Estilo dark NUVIA Financial Intelligence. Contenedor 794px ancho.
// NO usa Tailwind. Todos los estilos inline.

import { forwardRef, type CSSProperties, type ReactNode } from "react";

import { Calendar, Copy } from "lucide-react";

const C = {
  bgPage:    "#0A0E1A",
  bgCard:    "#111827",
  bgInner:   "#1A2235",
  border:    "#1E2D45",
  blue:      "#3B82F6",
  green:     "#10B981",
  purple:    "#8B5CF6",
  amber:     "#F59E0B",
  red:       "#EF4444",
  text:      "#F9FAFB",
  textSec:   "#9CA3AF",
  textLabel: "#6B7280",
};

const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;

export type PipelineEstado = "completado" | "en_proceso" | "pendiente" | "no_iniciado";

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

const cop = (n: number) =>
  "$" + Math.round(n || 0).toLocaleString("es-CO").replace(/,/g, ".");

const initials = (name: string) =>
  (name || "—").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "").join("") || "—";

const fechaHoy = () =>
  new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

const SvgVelocimetro = ({ color }: { color: string }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <path d="M8 26 A13 13 0 0 1 32 26" stroke={color} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    <line x1="8" y1="26" x2="10.5" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="29.5" y1="26" x2="32" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="13" x2="20" y2="15" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="20" y1="26" x2="14" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="20" cy="26" r="2" fill={color} />
  </svg>
);

const SvgDiana = ({ color }: { color: string }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <circle cx="20" cy="20" r="11" stroke={color} strokeWidth="1.2" fill="none" />
    <circle cx="20" cy="20" r="5.5" stroke={color} strokeWidth="1.2" fill="none" />
    <circle cx="20" cy="20" r="2" fill={color} />
    <line x1="27" y1="13" x2="22.5" y2="17.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <polyline points="25,11 29,11 29,15" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const SvgRed = ({ color }: { color: string }) => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="17" stroke={color} strokeWidth="1.5" fill={`${color}15`} />
    <circle cx="20" cy="11" r="3" fill={color} fillOpacity="0.9" />
    <circle cx="11" cy="26" r="3" fill={color} fillOpacity="0.9" />
    <circle cx="29" cy="26" r="3" fill={color} fillOpacity="0.9" />
    <circle cx="20" cy="21" r="2.5" fill={color} />
    <line x1="20" y1="14" x2="20" y2="18.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="17.8" y1="22.5" x2="13.5" y2="23.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    <line x1="22.2" y1="22.5" x2="26.5" y2="23.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const PL_ICONS: Record<string, (c: string) => ReactNode> = {
  "Simulación":      (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></svg>,
  "QA":              (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  "Contrato":        (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  "Poder":           (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  "Checklist":       (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/></svg>,
  "Radicación":      (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  "Respuesta Banco": (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  "Informe Final":   (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 12 18 15 13"/></svg>,
  "Cuenta Cobro":    (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>,
  "Paz y Salvo":     (c) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

const ROL_ICON: Record<string, ReactNode> = {
  "Analista": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  "Director Financiero": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  "Contabilidad": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>,
  "Gerencia": <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
};

const Label = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "#6B7280", marginBottom: 8, ...style }}>{children}</div>
);

const MiniLabel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ fontSize: 9, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "#9CA3AF", ...style }}>{children}</div>
);

const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "#111827", border: "1px solid #1E2D45", borderRadius: 12, ...style }}>{children}</div>
);

const Inner = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "#1A2235", border: "1px solid #1E2D45", borderRadius: 8, padding: 12, ...style }}>{children}</div>
);

const Pill = ({ color, children, small }: { color: string; children: ReactNode; small?: boolean }) => (
  <span style={{ display: "inline-flex", alignItems: "center", padding: small ? "2px 7px" : "3px 9px", borderRadius: 999, fontSize: small ? 7.5 : 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const, color, background: `${color}22`, border: `1px solid ${color}55`, whiteSpace: "nowrap" }}>{children}</span>
);

const Avatar = ({ name, size = 30 }: { name: string; size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: "#1A2235", border: "1px solid #1E2D45", color: "#3B82F6", fontSize: size * 0.34, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    {initials(name)}
  </div>
);

const Divider = () => <div style={{ width: 1, alignSelf: "stretch", background: "#1E2D45", margin: "0 8px", flexShrink: 0 }} />;

const PStep = ({ nombre, estado, isLast }: { nombre: string; estado: PipelineEstado; isLast: boolean }) => {
  let bg = "#1A2235", border = "#1E2D45", iconColor = "#6B7280";
  if (estado === "completado") { bg = "#10B981"; border = "#10B981"; iconColor = "#fff"; }
  if (estado === "en_proceso") { bg = "#3B82F6"; border = "#3B82F6"; iconColor = "#fff"; }
  if (estado === "pendiente")  { bg = "#1A2235"; border = "#F59E0B"; iconColor = "#F59E0B"; }
  const iconFn = PL_ICONS[nombre] ?? PL_ICONS["Simulación"];
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, position: "relative" }}>
      {!isLast && <div style={{ position: "absolute", top: 14, left: "50%", width: "100%", height: 2, background: estado === "completado" ? "#10B981" : "#1E2D45", zIndex: 0 }} />}
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, border: `1.5px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, flexShrink: 0 }}>
        {iconFn(iconColor)}
      </div>
      <div style={{ marginTop: 5, fontSize: 7.5, color: estado === "no_iniciado" ? "#6B7280" : "#9CA3AF", textAlign: "center", fontWeight: 600, lineHeight: 1.2, maxWidth: 55 }}>{nombre}</div>
    </div>
  );
};

export const CaseSnapshotPDF = forwardRef<HTMLDivElement, CaseSnapshotPDFProps>(
  ({ expediente: e }, ref) => {
    const varPct = e.credito.cuotaActual ? (((e.propuesta.nuevaCuota - e.credito.cuotaActual) / e.credito.cuotaActual) * 100).toFixed(1) : "0";
    const ahorrosPct = e.credito.costoTotal ? ((e.propuesta.ahorroTotal / e.credito.costoTotal) * 100).toFixed(1) : "0";
    const cuotasElimPct = e.credito.cuotasPendientes ? ((e.propuesta.cuotasEliminadas / e.credito.cuotasPendientes) * 100).toFixed(1) : "0";
    const mesesDiff = Math.max(0, e.credito.cuotasPendientes - e.propuesta.nuevoPlazo);

    return (
      <div ref={ref} style={{ width: 794, background: "#0A0E1A", color: "#F9FAFB", fontFamily: FONT, padding: "28px 32px", boxSizing: "border-box", fontSize: 12, lineHeight: 1.4 }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#F9FAFB" }}>NUVIA</span>
              <span style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: "0.22em", color: "#3B82F6" }}>FINANCIAL INTELLIGENCE</span>
            </div>
            <div style={{ marginTop: 5, width: 210, height: 2, background: "linear-gradient(90deg, #3B82F6, #8B5CF6, transparent)", borderRadius: 2 }} />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 9.5, color: "#9CA3AF" }}>Fecha de emisión:</div>
            <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600 }}>{fechaHoy()}</div>
            <div style={{ fontSize: 8.5, color: "#6B7280", marginTop: 3 }}>Documento ejecutivo · No reemplaza el expediente operativo</div>
          </div>
        </div>

        {/* TÍTULO */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: "#F9FAFB", letterSpacing: "-0.02em", lineHeight: 1 }}>CASE SNAPSHOT</div>
            <div style={{ fontSize: 10.5, color: "#9CA3AF", marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase" }}>Resumen ejecutivo del caso</div>
          </div>
          <div style={{ background: "#111827", border: "1px solid #1E2D45", borderRadius: 8, padding: "8px 14px", textAlign: "right" }}>
            <div style={{ fontSize: 8.5, color: "#6B7280", letterSpacing: "0.1em", textTransform: "uppercase" }}>ID Expediente</div>
            <div style={{ fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: "#3B82F6", marginTop: 2, fontWeight: 600 }}>{e.id.slice(0, 18)}</div>
          </div>
        </div>

        {/* CARD CLIENTE */}
        <Card style={{ padding: 14, marginBottom: 14 }}>
          {/* Fila 1 */}
          <div style={{ display: "flex", alignItems: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: 168, flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1A2235", border: "1px solid #1E2D45", color: "#3B82F6", fontSize: 15, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(e.cliente.nombre)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#F9FAFB", lineHeight: 1.25, wordBreak: "break-word" }}>{e.cliente.nombre}</div>
                <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>CC {e.cliente.cc}</div>
              </div>
            </div>
            <Divider />
            <div style={{ width: 90, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 4 }}>Banco</MiniLabel>
              <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600, lineHeight: 1.3 }}>{e.banco}</div>
            </div>
            <Divider />
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniLabel style={{ marginBottom: 4 }}>Producto</MiniLabel>
              <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600, lineHeight: 1.3 }}>{e.producto}</div>
            </div>
            <Divider />
            <div style={{ width: 72, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 4 }}>Modalidad</MiniLabel>
              <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600 }}>{e.modalidad}</div>
            </div>
            <Divider />
            <div style={{ width: 105, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 4 }}>Estado del caso</MiniLabel>
              <Pill color="#10B981" small>{e.estado}</Pill>
            </div>
          </div>
          <div style={{ height: 1, background: "#1E2D45", margin: "12px 0" }} />
          {/* Fila 2 */}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 168, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 3 }}>Analista</MiniLabel>
              <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600 }}>{e.analista}</div>
            </div>
            <Divider />
            <div style={{ width: 155, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 3 }}>Score QA</MiniLabel>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#3B82F6" }}>{e.qaScore.toFixed(1)} <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 500 }}>/ 100</span></div>
              <div style={{ height: 3, background: "#1E2D45", borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(100, e.qaScore)}%`, background: "linear-gradient(90deg, #3B82F6, #8B5CF6)" }} />
              </div>
            </div>
            <Divider />
            <div style={{ flex: 1, minWidth: 0 }}>
              <MiniLabel style={{ marginBottom: 3 }}>Nivel autonomía</MiniLabel>
              <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 2, flexWrap: "nowrap" }}>
                <Pill color="#3B82F6" small>{e.nivelAutonomia}</Pill>
                <Pill color="#F59E0B" small>Supervisada</Pill>
              </div>
            </div>
            <Divider />
            <div style={{ width: 105, flexShrink: 0 }}>
              <MiniLabel style={{ marginBottom: 3 }}>Fecha</MiniLabel>
              <div style={{ fontSize: 11, color: "#F9FAFB", fontWeight: 600 }}>{e.fecha}</div>
            </div>
          </div>
        </Card>

        {/* FOTO CRÉDITO */}
        <Label>Foto completa del crédito</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { label: "Saldo actual", val: cop(e.credito.saldoActual) },
            { label: "Cuota actual", val: cop(e.credito.cuotaActual) },
            { label: "Cuotas pendientes", val: String(e.credito.cuotasPendientes) },
            { label: "Costo total del crédito", val: cop(e.credito.costoTotal) },
          ].map(({ label, val }) => (
            <Inner key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <MiniLabel>{label}</MiniLabel>
                <Copy size={10} color="#6B7280" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#F9FAFB", letterSpacing: "-0.02em" }}>{val}</div>
            </Inner>
          ))}
        </div>

        {/* BANNER MULTIPLICADOR */}
        <div style={{ background: "linear-gradient(120deg, #1A1040 0%, #111827 70%)", borderRadius: 12, border: "1px solid #1E2D45", borderLeft: "3px solid #8B5CF6", padding: "14px 18px", display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
          <div style={{ flexShrink: 0, textAlign: "center", minWidth: 120 }}>
            <MiniLabel>Vas a pagar</MiniLabel>
            <div style={{ fontSize: 42, fontWeight: 800, color: "#8B5CF6", lineHeight: 1, letterSpacing: "-0.03em" }}>{e.credito.multiplicador.toFixed(2)}x</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase" }}>El valor de tu crédito</div>
          </div>
          <div style={{ flex: 1, fontSize: 11, color: "#9CA3AF", lineHeight: 1.6 }}>
            Con las condiciones actuales, terminarás pagando{" "}
            <strong style={{ color: "#3B82F6" }}>{e.credito.multiplicador.toFixed(2)} veces</strong> el valor del crédito desembolsado.
            Este análisis considera intereses, seguros y costos asociados durante todo el plazo del crédito.
          </div>
        </div>

        {/* DIAGNÓSTICO + PROPUESTA */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <Label>Diagnóstico NUVIA AI</Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <Inner style={{ padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
                <SvgVelocimetro color="#F59E0B" /><MiniLabel>Riesgo operativo</MiniLabel>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B" }}>MEDIO</div>
              </Inner>
              <Inner style={{ padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
                <SvgDiana color="#10B981" /><MiniLabel>Viabilidad</MiniLabel>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>ALTA</div>
              </Inner>
              <Inner style={{ padding: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
                <SvgRed color="#F59E0B" /><MiniLabel>Complejidad</MiniLabel>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B" }}>MEDIA</div>
              </Inner>
            </div>
            <div style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.55, marginBottom: 10 }}>
              Este crédito presenta una <strong style={{ color: "#3B82F6" }}>oportunidad de optimización</strong> significativa.
              La propuesta seleccionada <strong style={{ color: "#3B82F6" }}>reduce el tiempo de deuda</strong>, disminuye el
              costo financiero total y <strong style={{ color: "#3B82F6" }}>mejora tu salud financiera</strong>.
            </div>
            <Inner style={{ padding: 12 }}>
              <Label style={{ fontSize: 9, marginBottom: 8 }}>Honorarios</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[
                  { label: "Pactados",     val: cop(e.honorarios.pactados),     color: "#F9FAFB" },
                  { label: "Recalculados", val: cop(e.honorarios.recalculados), color: "#F9FAFB" },
                  { label: "Variación",    val: `${e.honorarios.variacion >= 0 ? "+" : ""}${cop(e.honorarios.variacion)}`, color: e.honorarios.variacion < 0 ? "#EF4444" : "#10B981" },
                ].map(({ label, val, color }) => (
                  <div key={label}><MiniLabel>{label}</MiniLabel>
                    <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 3 }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #1E2D45", paddingTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                {[
                  { label: "Estado cobro", val: e.honorarios.estadoCobro, color: "#9CA3AF" },
                  { label: "Estado pago",  val: e.honorarios.estadoPago,  color: "#9CA3AF" },
                  { label: "Paz y salvo",  val: e.honorarios.pazYSalvo ? "Sí" : "No", color: e.honorarios.pazYSalvo ? "#10B981" : "#F59E0B" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    {label}: <strong style={{ color }}>{val}</strong>
                  </div>
                ))}
              </div>
            </Inner>
          </div>
          <div>
            <Label>Propuesta seleccionada</Label>
            <div style={{ background: "linear-gradient(135deg, #0F2A1A 0%, #0B1A14 100%)", border: "1px solid #10B981", borderRadius: 12, padding: 14, position: "relative" }}>
              <div style={{ position: "absolute", top: 10, right: 10 }}>
                <Pill color="#10B981" small>★ Recomendada por NUVIA</Pill>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 28, paddingBottom: 12, borderBottom: "1px solid #1E2D45" }}>
                <div><MiniLabel>Nueva cuota</MiniLabel>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#F9FAFB", marginTop: 3 }}>{cop(e.propuesta.nuevaCuota)}</div>
                  <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>{Number(varPct) >= 0 ? "+" : ""}{varPct}% vs actual</div>
                </div>
                <div><MiniLabel>Nuevo plazo</MiniLabel>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#F9FAFB", marginTop: 3 }}>{e.propuesta.nuevoPlazo} meses</div>
                  <div style={{ fontSize: 9, color: "#10B981", marginTop: 2 }}>-{mesesDiff} meses</div>
                </div>
                <div><MiniLabel>Cuotas eliminadas</MiniLabel>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#F9FAFB", marginTop: 3 }}>{e.propuesta.cuotasEliminadas}</div>
                  <div style={{ fontSize: 9, color: "#10B981", marginTop: 2 }}>-{cuotasElimPct}% del plazo total</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, paddingTop: 12, paddingBottom: 12, borderBottom: "1px solid #1E2D45" }}>
                <div><MiniLabel>Ahorro total</MiniLabel>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981", marginTop: 3 }}>{cop(e.propuesta.ahorroTotal)}</div>
                  <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 2 }}>{ahorrosPct}% del total a pagar</div>
                </div>
                <div><MiniLabel>Ahorro intereses</MiniLabel>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981", marginTop: 3 }}>{cop(e.propuesta.ahorroIntereses)}</div>
                  <div style={{ fontSize: 9, color: "#6B7280", marginTop: 2 }}>Proyección estimada</div>
                </div>
                <div><MiniLabel>Ahorro seguros</MiniLabel>
                  <div style={{ fontSize: 14, fontWeight: 800, color: "#10B981", marginTop: 3 }}>{cop(e.propuesta.ahorroSeguros)}</div>
                  <div style={{ fontSize: 9, color: "#6B7280", marginTop: 2 }}>Proyección estimada</div>
                </div>
              </div>
              <div style={{ marginTop: 12, padding: "10px 12px", background: "#10B98115", border: "1px solid #10B98140", borderRadius: 8, display: "flex", alignItems: "center", gap: 10 }}>
                <Calendar size={18} color="#10B981" />
                <div>
                  <div style={{ fontSize: 8.5, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tiempo recuperado</div>
                  <div style={{ fontSize: 19, fontWeight: 800, color: "#10B981", lineHeight: 1.1 }}>{e.propuesta.tiempoRecuperado}</div>
                  <div style={{ fontSize: 9.5, color: "#9CA3AF", marginTop: 1 }}>Reducción en el tiempo total de deuda</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PIPELINE */}
        <Label>Estado operativo del caso</Label>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            {e.pipeline.map((p, i) => (
              <PStep key={i} nombre={p.nombre} estado={p.estado} isLast={i === e.pipeline.length - 1} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10, paddingTop: 8, borderTop: "1px solid #1E2D45", fontSize: 9, color: "#9CA3AF" }}>
            {[
              { color: "#10B981", label: "Completado",  outline: false },
              { color: "#3B82F6", label: "En proceso",  outline: false },
              { color: "#F59E0B", label: "Pendiente",   outline: true },
              { color: "#6B7280", label: "No iniciado", outline: true },
            ].map(({ color, label, outline }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: outline ? "transparent" : color, border: `1.5px solid ${color}`, flexShrink: 0 }} />
                {label}
              </div>
            ))}
          </div>
        </Card>

        {/* INTERVINIENTES + TRAZABILIDAD */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <Label>Intervinientes</Label>
            <Card style={{ padding: "8px 10px" }}>
              <div style={{ display: "flex", padding: "0 0 6px", borderBottom: "1px solid #1E2D45" }}>
                <div style={{ width: 90, flexShrink: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Rol</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Nombre</div>
                <div style={{ width: 110, flexShrink: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Correo</div>
              </div>
              {e.intervinientes.slice(0, 5).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: i < e.intervinientes.length - 1 ? "1px solid #1E2D45" : "none" }}>
                  <div style={{ width: 90, flexShrink: 0, display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                    <span style={{ flexShrink: 0 }}>{ROL_ICON[p.rol] ?? ROL_ICON["Analista"]}</span>
                    <span style={{ fontSize: 8, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.rol}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 5 }}>
                    <Avatar name={p.nombre} size={18} />
                    <span style={{ fontSize: 10, color: "#F9FAFB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{p.nombre}</span>
                  </div>
                  <div style={{ width: 110, flexShrink: 0, fontSize: 8.5, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.correo}</div>
                </div>
              ))}
            </Card>
          </div>
          <div>
            <Label>Trazabilidad</Label>
            <Card style={{ padding: "8px 10px" }}>
              <div style={{ display: "flex", padding: "0 0 6px", borderBottom: "1px solid #1E2D45" }}>
                <div style={{ width: 68, flexShrink: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Fecha</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Acción</div>
                <div style={{ width: 75, flexShrink: 0, fontSize: 8, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>Usuario</div>
              </div>
              {e.trazabilidad.slice(0, 5).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "6px 0", borderBottom: i < 4 ? "1px solid #1E2D45" : "none" }}>
                  <div style={{ width: 68, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: "#3B82F6", flexShrink: 0 }} />
                    <span style={{ fontSize: 9, color: "#9CA3AF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.fecha}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 10, color: "#F9FAFB", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.accion.replace(/_/g, " ")}</div>
                  <div style={{ width: 75, flexShrink: 0, fontSize: 9, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.usuario}</div>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #1E2D45", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#F9FAFB" }}>NUVIA <span style={{ color: "#3B82F6", fontWeight: 600 }}>Financial Intelligence</span></div>
            <div style={{ fontSize: 9, color: "#3B82F6", marginTop: 2 }}>Transformamos datos en decisiones financieras inteligentes.</div>
          </div>
          <div style={{ fontSize: 9, color: "#6B7280" }}>Página 1 de 1</div>
        </div>
      </div>
    );
  }
);

CaseSnapshotPDF.displayName = "CaseSnapshotPDF";
