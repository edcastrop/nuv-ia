// CaseSnapshotPDF — render visual pixel-perfect del expediente para captura PDF.
// Estilo dark NUVIA Financial Intelligence. Contenedor 794px ancho.
// NO usa Tailwind. Todos los estilos inline.

import { forwardRef, type CSSProperties, type ReactNode } from "react";
import { Calendar, Copy } from "lucide-react";

const C = {
  bgPage: "#060B19",
  bgCard: "#0B1327",
  bgInner: "#101B34",
  bgInner2: "#0D172D",
  border: "#1E2D45",
  border2: "#263A60",
  blue: "#3B82F6",
  blue2: "#60A5FA",
  green: "#10B981",
  green2: "#34D399",
  purple: "#8B5CF6",
  amber: "#F59E0B",
  red: "#EF4444",
  text: "#F9FAFB",
  textSec: "#CBD5E1",
  textMuted: "#9CA3AF",
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

const cop = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO").replace(/,/g, ".");

const initials = (name: string) =>
  (name || "—")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "—";

const fechaHoy = () =>
  new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

const shortId = (id: string) => (id || "—").slice(0, 36);

const safeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const compactFecha = (fecha: string) =>
  (fecha || "—")
    .replace(/\s+de\s+/g, " ")
    .replace(/\./g, "")
    .trim();

const Label = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: C.text,
      marginBottom: 10,
      ...style,
    }}
  >
    {children}
  </div>
);

const MiniLabel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      fontSize: 8,
      fontWeight: 800,
      letterSpacing: "0.09em",
      textTransform: "uppercase",
      color: C.textMuted,
      lineHeight: 1.15,
      ...style,
    }}
  >
    {children}
  </div>
);

const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: "linear-gradient(180deg, rgba(15,24,45,0.98), rgba(8,15,31,0.98))",
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      boxShadow: "0 16px 40px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Inner = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      background: "linear-gradient(180deg, rgba(17,29,56,0.95), rgba(9,17,34,0.95))",
      border: `1px solid ${C.border}`,
      borderRadius: 6,
      padding: 12,
      ...style,
    }}
  >
    {children}
  </div>
);

const Pill = ({ color, children, small }: { color: string; children: ReactNode; small?: boolean }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: small ? "2px 7px" : "4px 9px",
      borderRadius: 999,
      fontSize: small ? 7 : 8,
      fontWeight: 900,
      letterSpacing: "0.05em",
      textTransform: "uppercase",
      color,
      background: `${color}22`,
      border: `1px solid ${color}55`,
      whiteSpace: "nowrap",
      lineHeight: 1.1,
    }}
  >
    {children}
  </span>
);

const IconWrap = ({ children, color = C.blue, size = 22 }: { children: ReactNode; color?: string; size?: number }) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: 6,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      color,
      background: `${color}16`,
      border: `1px solid ${color}40`,
      flexShrink: 0,
    }}
  >
    {children}
  </span>
);

const SvgUser = ({ size = 22, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20c1.4-4 4.1-6 7.5-6s6.1 2 7.5 6" />
  </svg>
);

const SvgBank = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9h18L12 4 3 9Z" />
    <path d="M5 9v8M9 9v8M15 9v8M19 9v8M4 17h16M3 20h18" />
  </svg>
);

const SvgShield = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
    <path d="m9 12 2 2 4-5" />
  </svg>
);

const SvgMoney = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M12 8v8M14.5 10a2.3 2.3 0 0 0-2.5-1.2c-1.5 0-2.4.6-2.4 1.6 0 2.5 5 1.1 5 3.8 0 1.1-1 2-2.7 2a3.6 3.6 0 0 1-3-1.4" />
  </svg>
);

const SvgCheckCircle = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 2.6 2.6L16.5 9" />
  </svg>
);

const SvgChart = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 19V9M12 19V5M19 19v-7" />
    <path d="M3 19h18" />
    <path d="M5 9h2M12 5h2M19 12h2" />
  </svg>
);

const SvgCalendarSmall = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M8 3v4M16 3v4M4 10h16" />
  </svg>
);

const SvgFile = ({ size = 17, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
    <path d="M14 3v6h6" />
    <path d="M8 14h8M8 18h5" />
  </svg>
);

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
  Simulación: (c) => <SvgCheckCircle size={13} color={c} />,
  QA: (c) => <SvgShield size={13} color={c} />,
  Contrato: (c) => <SvgFile size={13} color={c} />,
  Poder: (c) => <SvgUser size={13} color={c} />,
  Checklist: (c) => <SvgCheckCircle size={13} color={c} />,
  Radicación: (c) => <SvgFile size={13} color={c} />,
  "Respuesta Banco": (c) => <SvgFile size={13} color={c} />,
  "Informe Final": (c) => <SvgFile size={13} color={c} />,
  "Cuenta Cobro": (c) => <SvgMoney size={13} color={c} />,
  "Paz y Salvo": (c) => <SvgCheckCircle size={13} color={c} />,
};

const ROL_ICON: Record<string, ReactNode> = {
  Analista: <SvgUser size={13} color={C.blue2} />,
  "Director Financiero": <SvgChart size={13} color={C.blue2} />,
  Contabilidad: <SvgMoney size={13} color={C.blue2} />,
  Gerencia: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.blue2} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  ),
};

const Wave = () => (
  <svg width="330" height="70" viewBox="0 0 330 70" fill="none" style={{ position: "absolute", top: 28, left: 232, opacity: 0.92 }}>
    <defs>
      <linearGradient id="nuvia-wave" x1="0" y1="32" x2="330" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8B5CF6" stopOpacity="0" />
        <stop offset="0.22" stopColor="#8B5CF6" />
        <stop offset="0.52" stopColor="#3B82F6" />
        <stop offset="1" stopColor="#10B981" stopOpacity="0" />
      </linearGradient>
    </defs>
    <path d="M0 33C45 20 76 24 106 43C136 62 168 64 200 38C230 15 270 13 330 27" stroke="url(#nuvia-wave)" strokeWidth="1.5" />
    <path d="M0 37C45 24 77 28 108 46C140 64 169 67 202 42C232 20 270 18 330 31" stroke="#60A5FA" strokeOpacity="0.25" strokeWidth="0.8" />
    <path d="M0 29C45 18 77 22 108 39C140 57 169 59 202 35C232 14 270 12 330 24" stroke="#8B5CF6" strokeOpacity="0.22" strokeWidth="0.8" />
  </svg>
);

const ClienteAvatar = () => (
  <div
    style={{
      width: 63,
      height: 63,
      borderRadius: "50%",
      background: "radial-gradient(circle at 35% 20%, #4F69D9, #1D2C71 72%)",
      boxShadow: "0 0 38px rgba(59,130,246,0.32), inset 0 0 0 1px rgba(138,109,255,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}
  >
    <SvgUser size={37} color="#EAF2FF" />
  </div>
);


const Field = ({ icon, label, value, width }: { icon: ReactNode; label: string; value: ReactNode; width?: number }) => (
  <div style={{ width, flex: width ? "0 0 auto" : 1, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 9 }}>
    {icon}
    <div style={{ minWidth: 0, flex: 1 }}>
      <MiniLabel style={{ marginBottom: 5, color: C.textLabel }}>{label}</MiniLabel>
      <div style={{ fontSize: 9.6, lineHeight: 1.24, color: C.text, fontWeight: 700, wordBreak: "normal", overflowWrap: "break-word" }}>{value}</div>
    </div>
  </div>
);

const PStep = ({ nombre, estado, isLast }: { nombre: string; estado: PipelineEstado; isLast: boolean }) => {
  const active = estado === "completado" || estado === "en_proceso";
  const bg =
    estado === "completado"
      ? "radial-gradient(circle at 35% 25%, #34D399, #059669 75%)"
      : estado === "en_proceso"
      ? "radial-gradient(circle at 35% 25%, #60A5FA, #1D4ED8 75%)"
      : "#172139";
  const border = estado === "completado" ? C.green2 : estado === "en_proceso" ? C.blue2 : estado === "pendiente" ? C.border2 : "#334155";
  const ring =
    estado === "completado"
      ? "0 0 0 4px rgba(16,185,129,0.18), 0 0 22px rgba(16,185,129,0.55)"
      : estado === "en_proceso"
      ? "0 0 0 4px rgba(59,130,246,0.20), 0 0 26px rgba(96,165,250,0.65)"
      : "none";
  const iconColor = active ? "#FFFFFF" : C.textLabel;
  const iconFn = PL_ICONS[nombre] ?? PL_ICONS.Simulación;
  const lineBg =
    estado === "completado"
      ? "linear-gradient(90deg, #10B981, #34D399)"
      : estado === "en_proceso"
      ? "linear-gradient(90deg, #10B981 0%, #3B82F6 55%, #29354D 100%)"
      : "#29354D";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minWidth: 0 }}>
      {!isLast && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            width: "100%",
            height: 3,
            background: lineBg,
            borderRadius: 2,
            zIndex: 0,
            boxShadow: estado === "completado" ? "0 0 8px rgba(16,185,129,0.4)" : "none",
          }}
        />
      )}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: bg,
          border: `1.5px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1,
          boxShadow: ring,
        }}
      >
        {iconFn(iconColor)}
      </div>
      <div style={{ marginTop: 9, fontSize: 8.2, color: estado === "no_iniciado" ? C.textLabel : C.text, textAlign: "center", fontWeight: 800, lineHeight: 1.22, maxWidth: 68, letterSpacing: "0.02em" }}>{nombre}</div>
    </div>
  );
};


export const CaseSnapshotPDF = forwardRef<HTMLDivElement, CaseSnapshotPDFProps>(({ expediente: e }, ref) => {
  const varPct = e.credito.cuotaActual ? (((e.propuesta.nuevaCuota - e.credito.cuotaActual) / e.credito.cuotaActual) * 100).toFixed(1) : "0";
  const ahorrosPct = e.credito.costoTotal ? ((e.propuesta.ahorroTotal / e.credito.costoTotal) * 100).toFixed(1) : "0";
  const cuotasElimPct = e.credito.cuotasPendientes ? ((e.propuesta.cuotasEliminadas / e.credito.cuotasPendientes) * 100).toFixed(1) : "0";
  const mesesDiff = Math.max(0, e.credito.cuotasPendientes - e.propuesta.nuevoPlazo);
  const totalAPagarEstimado = Math.max(
    safeNumber(e.credito.costoTotal),
    safeNumber(e.credito.cuotaActual) * safeNumber(e.credito.cuotasPendientes),
    safeNumber(e.credito.saldoActual) * safeNumber(e.credito.multiplicador),
  );
  const multiplicadorCalculado = safeNumber(e.credito.multiplicador) ||
    (safeNumber(e.credito.saldoActual) && totalAPagarEstimado
      ? totalAPagarEstimado / safeNumber(e.credito.saldoActual)
      : 0);
  const multiplicadorTexto = multiplicadorCalculado > 0 ? `${multiplicadorCalculado.toFixed(2)}x` : "—";

  return (
    <div
      ref={ref}
      style={{
        width: 794,
        minHeight: 1191,
        position: "relative",
        overflow: "visible",
        background:
          "radial-gradient(circle at 88% 33%, rgba(59,130,246,0.18), transparent 18%), radial-gradient(circle at 42% 7%, rgba(139,92,246,0.15), transparent 20%), linear-gradient(180deg, #050918 0%, #071021 52%, #050918 100%)",
        color: C.text,
        fontFamily: FONT,
        padding: "28px 30px 25px",
        boxSizing: "border-box",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      <Wave />

      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 950, color: C.text, lineHeight: 0.95, letterSpacing: "0.02em" }}>NUVIA</div>
            <div style={{ fontSize: 9.2, color: C.blue2, fontWeight: 800, letterSpacing: "0.12em", marginTop: 6 }}>FINANCIAL INTELLIGENCE</div>
          </div>
          <div style={{ textAlign: "right", paddingTop: 4 }}>
            <div style={{ fontSize: 8.4, color: C.textMuted, lineHeight: 1.35, fontWeight: 500 }}>Fecha de emisión: <span style={{ color: C.textSec, fontWeight: 600 }}>{fechaHoy()}</span></div>
            <div style={{ fontSize: 7.6, color: C.textLabel, lineHeight: 1.35, fontWeight: 400, marginTop: 2 }}>Documento ejecutivo • No reemplaza el expediente operativo</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 40, fontWeight: 950, color: C.text, letterSpacing: "0", lineHeight: 1 }}>CASE SNAPSHOT</div>
            <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 7, letterSpacing: "0.08em", textTransform: "uppercase" }}>Resumen ejecutivo del caso</div>
          </div>
          <div style={{ width: 316, flexShrink: 0, minHeight: 58, background: "#080F22", border: `1px solid ${C.border2}`, borderRadius: 5, padding: "10px 14px", boxSizing: "border-box", position: "relative", zIndex: 5, boxShadow: "0 0 0 1px rgba(59,130,246,0.18), 0 0 24px rgba(59,130,246,0.18)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <MiniLabel style={{ color: C.blue2, marginBottom: 5 }}>ID Expediente</MiniLabel>
            <div style={{ fontSize: 9.7, lineHeight: 1.25, fontFamily: "'Courier New', Courier, monospace", color: "#F8FAFF", fontWeight: 800, letterSpacing: "0", whiteSpace: "nowrap", overflow: "visible" }}>{shortId(e.id)}</div>
          </div>
        </div>

        <Card style={{ padding: 20, marginBottom: 12, overflow: "visible" }}>
          <div style={{ display: "grid", gridTemplateColumns: "176px 88px minmax(166px,1fr) 70px 154px", gap: 10, alignItems: "center", width: "100%", boxSizing: "border-box" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, paddingRight: 8, borderRight: `1px solid ${C.border}` }}>
              <ClienteAvatar />
              <div style={{ minWidth: 0 }}>
                <MiniLabel style={{ color: C.textLabel, marginBottom: 4 }}>Cliente</MiniLabel>
                <div style={{ fontSize: 10.5, fontWeight: 950, color: C.text, lineHeight: 1.15, wordBreak: "normal", overflowWrap: "break-word", textTransform: "uppercase", letterSpacing: "0.01em" }}>{e.cliente.nombre}</div>
              </div>
            </div>
            <Field icon={<IconWrap><SvgBank /></IconWrap>} label="Banco" value={e.banco} />
            <Field icon={<IconWrap><SvgShield /></IconWrap>} label="Producto" value={e.producto} />
            <Field icon={<IconWrap><SvgMoney /></IconWrap>} label="Modalidad" value={e.modalidad} />
            <Field icon={<IconWrap color={C.green}><SvgCheckCircle /></IconWrap>} label="Estado del caso" value={<span style={{ display: "block", color: C.green2, fontSize: 10.4, lineHeight: 1.14, fontWeight: 900, textShadow: "0 0 10px rgba(16,185,129,0.28)" }}>{e.estado}</span>} />
          </div>

          <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.45), rgba(138,109,255,0.35), transparent)", margin: "20px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "190px 190px 1fr 145px", gap: 24, alignItems: "center" }}>
            <Field icon={<IconWrap><SvgUser /></IconWrap>} label="Analista" value={e.analista} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <IconWrap><SvgShield /></IconWrap>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MiniLabel style={{ color: C.textLabel, marginBottom: 3 }}>Score QA</MiniLabel>
                <div style={{ fontSize: 15.5, fontWeight: 950, color: C.text }}>{e.qaScore.toFixed(1)} <span style={{ fontSize: 10, color: C.textSec, fontWeight: 700 }}>/ 100</span></div>
                <div style={{ height: 5, background: "#152038", borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, e.qaScore))}%`, height: "100%", background: "linear-gradient(90deg, #3B82F6, #8B5CF6)", borderRadius: 999 }} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
              <IconWrap><SvgChart /></IconWrap>
              <div>
                <MiniLabel style={{ color: C.textLabel, marginBottom: 5 }}>Nivel autonomía</MiniLabel>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 14, fontWeight: 950, color: C.text }}>{e.nivelAutonomia}</span>
                  <Pill color={C.blue} small>Supervisada</Pill>
                </div>
              </div>
            </div>
            <Field icon={<IconWrap><SvgCalendarSmall /></IconWrap>} label="Fecha" value={e.fecha} />
          </div>
        </Card>


        <Card style={{ padding: 12, marginBottom: 10 }}>
          <Label>Foto completa del crédito</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 9, marginBottom: 13 }}>
            {[
              { label: "Saldo actual", val: cop(e.credito.saldoActual) },
              { label: "Cuota actual", val: cop(e.credito.cuotaActual) },
              { label: "Cuotas pendientes", val: String(e.credito.cuotasPendientes) },
              { label: "Costo total del crédito", val: cop(e.credito.costoTotal) },
            ].map(({ label, val }) => (
              <Inner key={label} style={{ padding: "11px 13px", minHeight: 58 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 9 }}>
                  <MiniLabel style={{ color: C.blue2 }}>{label}</MiniLabel>
                  <Copy size={13} color={C.blue2} />
                </div>
                <div style={{ fontSize: 17.5, fontWeight: 950, color: C.text, letterSpacing: "0" }}>{val}</div>
              </Inner>
            ))}
          </div>
          <div
            style={{
              minHeight: 132,
              borderRadius: 10,
              border: `1px solid rgba(138,109,255,0.45)`,
              background:
                "radial-gradient(circle at 18% 35%, rgba(68,93,163,0.55), transparent 42%), radial-gradient(circle at 92% 70%, rgba(138,109,255,0.42), transparent 45%), linear-gradient(120deg, #0A1330 0%, #131845 55%, #1B1748 100%)",
              boxShadow: "0 0 0 1px rgba(138,109,255,0.18), 0 18px 48px rgba(68,93,163,0.32), inset 0 1px 0 rgba(255,255,255,0.05)",
              display: "grid",
              gridTemplateColumns: "45% 55%",
              alignItems: "center",
              overflow: "hidden",
              position: "relative",
            }}
          >
              <div style={{ textAlign: "center", padding: "14px 18px", position: "relative", minWidth: 0 }}>
              <MiniLabel style={{ fontSize: 9, marginBottom: 8, color: "#C7B8FF" }}>Vas a pagar</MiniLabel>
              <div style={{ fontSize: 62, fontWeight: 950, lineHeight: 1, letterSpacing: "0", color: "#C7B8FF", textShadow: "0 0 22px rgba(138,109,255,0.55), 0 0 8px rgba(110,139,255,0.45)", whiteSpace: "nowrap" }}>{multiplicadorTexto}</div>
              <div style={{ fontSize: 10.5, fontWeight: 900, color: "#E8E1FF", letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 10 }}>El valor de tu crédito</div>
            </div>
            <div style={{ padding: "0 26px 0 22px", fontSize: 11.4, color: "#DCE3F5", lineHeight: 1.6, borderLeft: "1px solid rgba(138,109,255,0.22)" }}>
              Con las condiciones actuales, terminarás pagando <strong style={{ color: "#C7B8FF" }}>{multiplicadorTexto === "—" ? "—" : multiplicadorTexto.replace("x", " veces")}</strong> el valor del crédito desembolsado.
              <br />
              Valor total proyectado: <strong style={{ color: "#F8FAFF" }}>{cop(totalAPagarEstimado)}</strong>. Incluye intereses, seguros y costos asociados durante todo el plazo.
            </div>
          </div>

        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "41% 59%", gap: 8, marginBottom: 10 }}>
          <div>
            <Card style={{ padding: 14, marginBottom: 8 }}>
              <Label style={{ marginBottom: 14 }}>Diagnóstico NUVIA AI</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 12 }}>
                {[
                  { icon: <SvgVelocimetro color={C.amber} />, label: "Riesgo operativo", value: "MEDIO", color: C.amber, glow: "rgba(245,158,11,0.45)" },
                  { icon: <SvgDiana color={C.green} />, label: "Viabilidad", value: "ALTA", color: C.green2, glow: "rgba(16,185,129,0.5)" },
                  { icon: <SvgRed color={C.amber} />, label: "Complejidad", value: "MEDIA", color: C.amber, glow: "rgba(245,158,11,0.45)" },
                ].map((m) => (
                  <div key={m.label} style={{ textAlign: "center" }}>
                    <div style={{ width: 54, height: 54, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", filter: `drop-shadow(0 0 14px ${m.glow})` }}>
                      <div style={{ transform: "scale(1.35)", transformOrigin: "center" }}>{m.icon}</div>
                    </div>
                    <MiniLabel style={{ marginTop: 9, fontSize: 7.4, color: C.textSec }}>{m.label}</MiniLabel>
                    <div style={{ fontSize: 14.5, fontWeight: 950, color: m.color, marginTop: 3, letterSpacing: "0.04em" }}>{m.value}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.4, color: C.text, lineHeight: 1.5 }}>
                Este crédito presenta una <strong style={{ color: C.blue2 }}>oportunidad de optimización</strong> significativa. La propuesta seleccionada <strong style={{ color: C.blue2 }}>reduce el tiempo de deuda</strong>, disminuye el costo financiero total y <strong style={{ color: C.blue2 }}>mejora tu salud financiera</strong>.
              </div>
            </Card>

            <Card style={{ padding: 11 }}>
              <Label style={{ marginBottom: 12 }}>Honorarios</Label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 10 }}>
                {[
                  { label: "Pactados", val: cop(e.honorarios.pactados), color: C.text },
                  { label: "Recalculados", val: cop(e.honorarios.recalculados), color: C.text },
                  { label: "Variación", val: `${e.honorarios.variacion >= 0 ? "+" : ""}${cop(e.honorarios.variacion)}`, color: e.honorarios.variacion < 0 ? C.red : C.green2 },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <MiniLabel style={{ fontSize: 7 }}>{label}</MiniLabel>
                    <div style={{ fontSize: 10.8, fontWeight: 900, color, marginTop: 4 }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Estado cobro", val: e.honorarios.estadoCobro, color: C.textSec },
                  { label: "Estado pago", val: e.honorarios.estadoPago, color: C.textSec },
                  { label: "Paz y salvo", val: e.honorarios.pazYSalvo ? "Sí" : "No", color: e.honorarios.pazYSalvo ? C.green2 : C.textSec },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <MiniLabel style={{ fontSize: 6.7 }}>{label}</MiniLabel>
                    <div style={{ fontSize: 9.8, color, fontWeight: 850, marginTop: 4, textTransform: "uppercase" }}>{val}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card style={{ padding: "40px 14px 14px", borderColor: "rgba(16,185,129,0.55)", position: "relative", overflow: "hidden", boxShadow: "0 0 0 1px rgba(16,185,129,0.18), 0 22px 50px rgba(16,185,129,0.18), inset 0 1px 0 rgba(255,255,255,0.04)" }}>
            <div style={{ position: "absolute", top: 0, right: 0, height: 28, padding: "0 14px 0 24px", display: "flex", alignItems: "center", background: "linear-gradient(95deg, rgba(16,185,129,0.0) 0%, rgba(16,185,129,0.55) 35%, rgba(52,211,153,0.95) 100%)", clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0 100%)", boxShadow: "0 0 18px rgba(16,185,129,0.45)" }}>
              <span style={{ fontSize: 8.4, fontWeight: 950, color: "#06140E", letterSpacing: "0.08em", textTransform: "uppercase" }}>★ Recomendada por NUVIA</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
              <SvgCheckCircle size={22} color={C.green2} />
              <Label style={{ marginBottom: 0 }}>Propuesta seleccionada</Label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
              {[
                { label: "Nueva cuota", value: cop(e.propuesta.nuevaCuota), sub: `${Number(varPct) >= 0 ? "+" : ""}${varPct}% vs actual`, color: C.green2 },
                { label: "Nuevo plazo", value: `${e.propuesta.nuevoPlazo} meses`, sub: `-${mesesDiff} meses`, color: C.textSec },
                { label: "Cuotas eliminadas", value: String(e.propuesta.cuotasEliminadas), sub: `-${cuotasElimPct}% del plazo total`, color: C.green2 },
              ].map((x) => (
                <div key={x.label} style={{ background: "linear-gradient(180deg, rgba(15,30,52,0.95), rgba(10,20,38,0.95))", border: `1px solid ${C.border}`, borderRadius: 7, padding: "14px 8px 12px", minHeight: 92, textAlign: "center", overflow: "hidden", boxSizing: "border-box" }}>
                  <MiniLabel>{x.label}</MiniLabel>
                  <div style={{ fontSize: 16.5, fontWeight: 950, color: C.text, marginTop: 8, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.value}</div>
                  <div style={{ fontSize: 8.2, color: x.color, marginTop: 7, fontWeight: 700, lineHeight: 1.2 }}>{x.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 10 }}>
              {[
                { label: "Ahorro total", value: cop(e.propuesta.ahorroTotal), sub: `${ahorrosPct}% del total a pagar` },
                { label: "Ahorro intereses", value: cop(e.propuesta.ahorroIntereses), sub: "Proyección estimada" },
                { label: "Ahorro seguros", value: cop(e.propuesta.ahorroSeguros), sub: "Proyección estimada" },
              ].map((x) => (
                <div key={x.label} style={{ background: "linear-gradient(180deg, rgba(15,30,52,0.95), rgba(10,20,38,0.95))", border: `1px solid ${C.border}`, borderRadius: 7, padding: "13px 8px 12px", minHeight: 86, textAlign: "center", overflow: "hidden", boxSizing: "border-box" }}>
                  <MiniLabel>{x.label}</MiniLabel>
                  <div style={{ fontSize: 15.5, fontWeight: 950, color: C.text, marginTop: 8, lineHeight: 1.1, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.value}</div>
                  <div style={{ fontSize: 8.2, color: C.textMuted, marginTop: 7, lineHeight: 1.2 }}>{x.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "13px 14px", minHeight: 64, background: "radial-gradient(circle at 12% 50%, rgba(16,185,129,0.22), transparent 55%), rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 8, display: "flex", alignItems: "center", gap: 12, boxSizing: "border-box" }}>
              <Calendar size={26} color={C.green2} />
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <div style={{ minWidth: 0 }}>
                  <MiniLabel>Tiempo recuperado</MiniLabel>
                  <div style={{ fontSize: 20, fontWeight: 950, color: C.green2, lineHeight: 1.05, marginTop: 3 }}>{e.propuesta.tiempoRecuperado}</div>
                </div>
                <div style={{ color: C.textSec, fontSize: 9.6, lineHeight: 1.25 }}>Reducción en el tiempo total de deuda</div>
              </div>
            </div>
          </Card>

        </div>

        <Card style={{ padding: 12, marginBottom: 10 }}>
          <Label>Estado operativo del caso</Label>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "3px 5px 0" }}>
            {e.pipeline.map((p, i) => (
              <PStep key={`${p.nombre}-${i}`} nombre={p.nombre} estado={p.estado} isLast={i === e.pipeline.length - 1} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 14, fontSize: 7.5, color: C.textMuted }}>
            {[
              { color: C.green, label: "Completado", outline: false },
              { color: C.blue, label: "En proceso", outline: false },
              { color: C.textLabel, label: "Pendiente", outline: true },
              { color: C.textLabel, label: "No iniciado", outline: true },
            ].map(({ color, label, outline }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: outline ? "transparent" : color, border: `1.3px solid ${color}` }} />
                {label}
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14, alignItems: "stretch" }}>
          <Card style={{ padding: "15px 14px 16px", minHeight: 286 }}>
            <Label>Intervinientes</Label>
            {e.intervinientes.slice(0, 5).map((p, i) => (
              <div key={`${p.rol}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "8px 0", borderBottom: i < Math.min(e.intervinientes.length, 5) - 1 ? `1px solid rgba(30,45,69,0.62)` : "none" }}>
                <div style={{ width: 27, height: 27, borderRadius: 8, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(96,165,250,0.35)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 14px rgba(59,130,246,0.13)" }}>
                  {ROL_ICON[p.rol] ?? ROL_ICON.Analista}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 8, lineHeight: 1.15, color: C.blue2, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", flex: "0 0 auto", maxWidth: 112, overflowWrap: "anywhere" }}>{p.rol}</div>
                    <div style={{ fontSize: 10.1, lineHeight: 1.18, color: C.text, fontWeight: 850, overflowWrap: "anywhere", flex: 1 }}>{p.nombre}</div>
                  </div>
                  <div style={{ fontSize: 8.4, lineHeight: 1.2, color: C.textSec, fontWeight: 600, overflowWrap: "anywhere", marginTop: 4 }}>{p.correo}</div>
                </div>
              </div>
            ))}
          </Card>

          <Card style={{ padding: "15px 14px 16px", minHeight: 286 }}>
            <Label>Trazabilidad</Label>
            {e.trazabilidad.slice(0, 5).map((t, i) => (
              <div key={`${t.fecha}-${i}`} style={{ display: "flex", gap: 10, minHeight: 48, padding: "8px 0", borderBottom: i < Math.min(e.trazabilidad.length, 5) - 1 ? `1px solid rgba(30,45,69,0.62)` : "none" }}>
                <div style={{ paddingTop: 4, flexShrink: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: C.blue, display: "block", boxShadow: "0 0 11px rgba(59,130,246,0.75)" }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, minWidth: 0 }}>
                    <div style={{ fontSize: 8.2, lineHeight: 1.15, color: C.blue2, fontWeight: 900, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{compactFecha(t.fecha)}</div>
                    <div style={{ fontSize: 8.4, lineHeight: 1.15, color: C.textSec, fontWeight: 650, textAlign: "right", overflowWrap: "anywhere", maxWidth: 112 }}>{t.usuario}</div>
                  </div>
                  <div style={{ fontSize: 9.6, lineHeight: 1.25, color: C.text, fontWeight: 760, overflowWrap: "anywhere", marginTop: 6 }}>{t.accion.replace(/_/g, " ")}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>


        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, color: C.text, lineHeight: 1 }}>NUVIA</div>
            <div style={{ fontSize: 7.7, color: C.blue2, fontWeight: 800, letterSpacing: "0.1em", marginTop: 3 }}>FINANCIAL INTELLIGENCE</div>
          </div>
          <div style={{ fontSize: 9, color: C.blue2 }}>Transformamos datos en decisiones financieras inteligentes.</div>
          <div style={{ fontSize: 9, color: C.textLabel }}>Página 1 de 1</div>
        </div>
      </div>
    </div>
  );
});

CaseSnapshotPDF.displayName = "CaseSnapshotPDF";
