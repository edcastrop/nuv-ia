import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Area, AreaChart } from "recharts";
import {
  ShieldAlert, Gavel, RotateCcw, AlertTriangle, Coins, Timer,
  ArrowRight, FileSearch, Paperclip, TrendingUp, TrendingDown, Minus,
  Sparkles, Activity, Zap, Radar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QA_MOTOR_VERSION } from "@/lib/qaMath";


export type CCRow = {
  id: string; expediente_id: string | null; analista_id: string | null;
  codigo?: string | null; modalidad: string; motor_version?: string | null; qa_score: number; categoria: string; dictamen: string;
  ejecutado_at: string; updated_at?: string | null; auditor_aprobado_at?: string | null;
  cliente_nombre: string | null; banco: string | null; producto: string | null;
  estado_caso: string | null; subestado: string | null; validacion_estado: string | null;
  analista_nombre: string | null; extracto_path: string | null;
  alertas_abiertas: number; alertas_criticas: number;
  sla_vence_at: string | null; sla_vencido: boolean;
  ticket: number; fresh: boolean;
};

export type CCBank = { banco: string; auditados: number; promedio: number; pctError: number; riesgo: "alto" | "medio" | "bajo" };
export type CCAnalista = { id: string | null; nombre: string; auditados: number; sumScore: number; aprob: number; rech: number; promedio: number; precision: number; nivel: 1 | 2 | 3 };
export type CCError = { tipo: string; total: number; criticas: number; ultimos7: number };
export type CCTrend = { fecha: string; scoreProm: number; aprobados: number; observados: number; rechazados: number; criticos: number; n: number };

export type Filters = {
  analista: string; banco: string; producto: string; modalidad: string;
  moneda: string; estadoQa: string; nivel: string; rango: string;
  scoreMin: string; criticos: boolean; fresh: boolean;
  q: string;
};
export const EMPTY_FILTERS: Filters = {
  analista: "", banco: "", producto: "", modalidad: "", moneda: "",
  estadoQa: "", nivel: "", rango: "30", scoreMin: "", criticos: false, fresh: false,
  q: "",
};

/* ═══════════════════ DESIGN TOKENS ═══════════════════ */
const C = {
  bg: "#050816",
  bg2: "#08111F",
  surface: "rgba(13,18,38,0.82)",
  surfaceSolid: "#0D1226",
  surfaceElev: "rgba(20,27,52,0.85)",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(255,255,255,0.12)",
  divider: "rgba(255,255,255,0.04)",
  text: "#F5F7FF",
  textSec: "#B6C1DC",
  textMuted: "#6B7693",
  textDim: "#4A5474",
  primary: "#5B8CFF",
  secondary: "#7B61FF",
  success: "#1FD286",
  warning: "#FFB547",
  danger: "#FF5D73",
  info: "#38BDF8",
  purple: "#B983FF",
};

const fCop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

function applyFilters(rows: CCRow[], f: Filters): CCRow[] {
  const since = f.rango ? Date.now() - Number(f.rango) * 86400000 : 0;
  const sm = Number(f.scoreMin) || 0;
  const q = (f.q ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (f.analista && r.analista_id !== f.analista) return false;
    if (f.banco && r.banco !== f.banco) return false;
    if (f.producto && r.producto !== f.producto) return false;
    if (f.modalidad && r.modalidad !== f.modalidad) return false;
    if (f.moneda === "uvr" && r.modalidad !== "uvr") return false;
    if (f.moneda === "pesos" && r.modalidad === "uvr") return false;
    if (f.estadoQa && r.dictamen !== f.estadoQa) return false;
    if (since && new Date(r.ejecutado_at).getTime() < since) return false;
    if (sm && r.qa_score < sm) return false;
    if (f.criticos && r.alertas_criticas <= 0) return false;
    if (f.fresh && !r.fresh) return false;
    if (q) {
      const hay = `${r.cliente_nombre ?? ""} ${r.analista_nombre ?? ""} ${r.banco ?? ""} ${(r as unknown as { codigo?: string | null }).codigo ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function CommandCenter(props: {
  rows: CCRow[]; bancos: CCBank[]; analistas: CCAnalista[]; topErrores: CCError[]; tendencia: CCTrend[]; prioridad: Record<string, number>;
  globalQ?: string;
  showCreateCaseCTA?: boolean;
}) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  // Sync global header search → filters.q
  useEffect(() => {
    if (props.globalQ !== undefined) setF((x) => ({ ...x, q: props.globalQ ?? "" }));
  }, [props.globalQ]);

  const bancosOpts = useMemo(() => [...new Set(props.rows.map((r) => r.banco).filter(Boolean))] as string[], [props.rows]);
  const productosOpts = useMemo(() => [...new Set(props.rows.map((r) => r.producto).filter(Boolean))] as string[], [props.rows]);
  const analistasOpts = useMemo(() => {
    const m = new Map<string, string>();
    props.analistas.forEach((a) => { if (a.id) m.set(a.id, a.nombre); });
    props.rows.forEach((r) => { if (r.analista_id && r.analista_nombre && !m.has(r.analista_id)) m.set(r.analista_id, r.analista_nombre); });
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [props.rows, props.analistas]);

  const filtered = useMemo(() => {
    let out = applyFilters(props.rows, f);
    if (priorityFilter === "bloqueados") out = out.filter((r) => r.dictamen === "rechazado" || r.estado_caso === "bloqueado");
    else if (priorityFilter === "esperando") out = out.filter((r) => r.dictamen === "requiere_revision");
    else if (priorityFilter === "devueltos") out = out.filter((r) => r.validacion_estado === "devuelto");
    else if (priorityFilter === "alertas") out = out.filter((r) => r.alertas_criticas > 0);
    else if (priorityFilter === "uvr") out = out.filter((r) => r.modalidad === "uvr" && (r.dictamen === "requiere_revision" || r.qa_score < 90));
    else if (priorityFilter === "sla") out = out.filter((r) => r.sla_vencido);
    return out;
  }, [props.rows, f, priorityFilter]);

  const visibleBancos = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.banco ?? "—"));
    return props.bancos.filter((b) => ids.has(b.banco));
  }, [props.bancos, filtered]);

  const visibleAnalistas = useMemo(() => {
    const ids = new Set(filtered.map((r) => r.analista_id ?? "—"));
    return props.analistas.filter((a) => ids.has(a.id ?? "—"));
  }, [props.analistas, filtered]);

  const analistaNombreActivo = useMemo(() => {
    if (!f.analista) return null;
    return analistasOpts.find((a) => a.id === f.analista)?.nombre ?? null;
  }, [f.analista, analistasOpts]);

  // NUVIA insights derived from existing data (no new queries)
  const insights = useMemo(() => generateInsights(props.bancos, props.analistas, props.prioridad, props.topErrores), [props.bancos, props.analistas, props.prioridad, props.topErrores]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <FilterBar
        f={f} setF={setF}
        bancos={bancosOpts} productos={productosOpts} analistas={analistasOpts}
        onReset={() => { setF(EMPTY_FILTERS); setPriorityFilter(null); }}
      />

      {(f.analista || f.banco || f.producto || f.modalidad || f.moneda || f.estadoQa || f.criticos || f.fresh) && (
        <ActiveFilterChips
          items={[
            f.analista && analistaNombreActivo ? { key: "analista", label: `Analista: ${analistaNombreActivo}`, clear: () => setF((x) => ({ ...x, analista: "" })) } : null,
            f.banco ? { key: "banco", label: `Banco: ${f.banco}`, clear: () => setF((x) => ({ ...x, banco: "" })) } : null,
            f.producto ? { key: "producto", label: `Producto: ${f.producto}`, clear: () => setF((x) => ({ ...x, producto: "" })) } : null,
            f.modalidad ? { key: "modalidad", label: `Modalidad: ${f.modalidad}`, clear: () => setF((x) => ({ ...x, modalidad: "" })) } : null,
            f.moneda ? { key: "moneda", label: `Moneda: ${f.moneda}`, clear: () => setF((x) => ({ ...x, moneda: "" })) } : null,
            f.estadoQa ? { key: "estadoQa", label: `Dictamen: ${f.estadoQa}`, clear: () => setF((x) => ({ ...x, estadoQa: "" })) } : null,
            f.criticos ? { key: "criticos", label: `Solo críticos`, clear: () => setF((x) => ({ ...x, criticos: false })) } : null,
            f.fresh ? { key: "fresh", label: `FRECH activo`, clear: () => setF((x) => ({ ...x, fresh: false })) } : null,
          ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>}
          total={filtered.length}
        />
      )}

      {/* ROW 1 · KPI mission-control */}
      <PriorityPanel counts={props.prioridad} active={priorityFilter} onPick={(k) => setPriorityFilter(priorityFilter === k ? null : k)} />

      {/* ROW 2 · Bank · Analysts · Alert Center */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 20 }}>
        <div style={{ gridColumn: "span 4" }}>
          <BankHeatmap bancos={visibleBancos} onPick={(b) => setF((x) => ({ ...x, banco: x.banco === b ? "" : b }))} active={f.banco} />
        </div>
        <div style={{ gridColumn: "span 4" }}>
          <AnalystRanking analistas={visibleAnalistas} onPick={(a) => setF((x) => ({ ...x, analista: x.analista === a ? "" : a }))} active={f.analista} />
        </div>
        <div style={{ gridColumn: "span 4" }}>
          <AlertCenter counts={props.prioridad} onPick={(k) => setPriorityFilter(priorityFilter === k ? null : k)} active={priorityFilter} />
        </div>
      </div>

      {/* ROW 3 · Health · Top errors */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0,1fr))", gap: 20 }}>
        <div style={{ gridColumn: "span 7" }}><QaHealthTrend data={props.tendencia} /></div>
        <div style={{ gridColumn: "span 5" }}><TopErrors errores={props.topErrores} /></div>
      </div>

      {/* ROW 4 · Insights */}
      <NuviaInsights
        insights={insights}
        counts={props.prioridad}
        bancos={props.bancos}
        analistas={props.analistas}
        errores={props.topErrores}
        tendencia={props.tendencia}
        totalCasos={filtered.length}
      />

      {/* ROW 5 · Review Queue compact */}
      <ReviewQueue rows={filtered} />
    </div>
  );
}


/* ═══════════════════ ACTIVE FILTER CHIPS ═══════════════════ */
function ActiveFilterChips({ items, total }: { items: Array<{ key: string; label: string; clear: () => void }>; total: number }) {
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      background: "rgba(91,140,255,0.05)", border: `1px solid rgba(91,140,255,0.20)`,
      borderRadius: 14, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: C.primary, letterSpacing: 1.4, textTransform: "uppercase" }}>
        Filtrado · {total} caso{total === 1 ? "" : "s"}
      </span>
      {items.map((it) => (
        <button key={it.key} onClick={it.clear} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(91,140,255,0.10)", border: `1px solid rgba(91,140,255,0.30)`,
          color: C.text, fontSize: 11.5, fontWeight: 500,
          padding: "4px 10px", borderRadius: 999, cursor: "pointer",
        }}>
          {it.label} <span style={{ color: C.textSec, fontWeight: 700 }}>×</span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════ FILTER BAR ═══════════════════ */
function FilterBar({
  f, setF, bancos, productos, analistas, onReset,
}: {
  f: Filters; setF: (u: (x: Filters) => Filters) => void;
  bancos: string[]; productos: string[]; analistas: { id: string; nombre: string }[];
  onReset: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sel: React.CSSProperties = {
    background: "rgba(5,8,22,0.7)", color: C.text, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: "0 12px", fontSize: 12, minWidth: 140, outline: "none", height: 34,
    fontWeight: 500, letterSpacing: 0.02,
  };
  const chk: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec,
    background: "rgba(5,8,22,0.7)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 12px", cursor: "pointer", height: 34,
    fontWeight: 500,
  };
  const advancedActive = Boolean(f.producto || f.modalidad || f.moneda || f.rango !== "30" || f.scoreMin || f.criticos || f.fresh);
  return (
    <div style={{
      background: C.surface, backdropFilter: "blur(20px)",
      border: `1px solid ${C.border}`, borderRadius: 18, padding: 12,
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
      boxShadow: "0 0 40px rgba(34,91,255,0.08)",
    }}>
      <select style={sel} value={f.analista} onChange={(e) => setF((x) => ({ ...x, analista: e.target.value }))}>
        <option value="">Analista · todos ({analistas.length})</option>
        {analistas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
      <select style={sel} value={f.banco} onChange={(e) => setF((x) => ({ ...x, banco: e.target.value }))}>
        <option value="">Banco · todos</option>
        {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      <select style={sel} value={f.estadoQa} onChange={(e) => setF((x) => ({ ...x, estadoQa: e.target.value }))}>
        <option value="">Dictamen · todos</option>
        <option value="aprobado">Aprobado</option>
        <option value="aprobado_obs">Con observaciones</option>
        <option value="requiere_revision">Requiere revisión</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <button onClick={() => setExpanded((v) => !v)} style={{
        ...chk,
        color: advancedActive ? C.primary : C.textSec,
        border: `1px solid ${advancedActive ? "rgba(91,140,255,0.45)" : C.border}`,
        background: advancedActive ? "rgba(91,140,255,0.10)" : "rgba(5,8,22,0.7)",
      }}>
        Más filtros {expanded ? "▲" : "▼"}
      </button>
      <button onClick={onReset} style={{ marginLeft: "auto", ...chk, color: C.textSec }}>
        Limpiar
      </button>

      {expanded && (
        <div style={{ width: "100%", display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 10, marginTop: 4, borderTop: `1px solid ${C.divider}` }}>
          <select style={sel} value={f.producto} onChange={(e) => setF((x) => ({ ...x, producto: e.target.value }))}>
            <option value="">Producto · todos</option>
            {productos.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select style={sel} value={f.modalidad} onChange={(e) => setF((x) => ({ ...x, modalidad: e.target.value }))}>
            <option value="">Modalidad · todas</option>
            <option value="hipotecario">Hipotecario</option>
            <option value="leasing">Leasing</option>
            <option value="uvr">UVR</option>
          </select>
          <select style={sel} value={f.moneda} onChange={(e) => setF((x) => ({ ...x, moneda: e.target.value }))}>
            <option value="">Moneda · todas</option>
            <option value="pesos">Pesos</option>
            <option value="uvr">UVR</option>
          </select>
          <select style={sel} value={f.rango} onChange={(e) => setF((x) => ({ ...x, rango: e.target.value }))}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="">Todo el histórico</option>
          </select>
          <input style={{ ...sel, minWidth: 110 }} placeholder="Score mín." value={f.scoreMin} onChange={(e) => setF((x) => ({ ...x, scoreMin: e.target.value.replace(/[^\d.]/g, "") }))} />
          <label style={chk}>
            <input type="checkbox" checked={f.criticos} onChange={(e) => setF((x) => ({ ...x, criticos: e.target.checked }))} />
            Críticos
          </label>
          <label style={chk}>
            <input type="checkbox" checked={f.fresh} onChange={(e) => setF((x) => ({ ...x, fresh: e.target.checked }))} />
            FRECH activo
          </label>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════ PRIORITY / KPI PANEL ═══════════════════ */
function PriorityPanel({ counts, active, onPick }: { counts: Record<string, number>; active: string | null; onPick: (k: string) => void }) {
  const cards = [
    { key: "bloqueados", label: "Casos bloqueados", value: counts.bloqueados ?? 0, color: C.danger, icon: <ShieldAlert size={18} />, trend: "+12.5% vs ayer" },
    { key: "esperando", label: "Esperando dictamen", value: counts.esperandoDictamen ?? 0, color: C.primary, icon: <Gavel size={18} />, trend: "Sin movimiento" },
    { key: "devueltos", label: "Devueltos", value: counts.devueltos ?? 0, color: C.warning, icon: <RotateCcw size={18} />, trend: "Estable" },
    { key: "alertas", label: "Alertas críticas", value: counts.alertasCriticas ?? 0, color: "#FF8A00", icon: <AlertTriangle size={18} />, trend: "+8.3%" },
    { key: "uvr", label: "UVR sin revisión", value: counts.uvrSinRevision ?? 0, color: C.purple, icon: <Coins size={18} />, trend: "Pendientes" },
    { key: "sla", label: "Vencidos SLA", value: counts.slaVencidos ?? 0, color: C.success, icon: <Timer size={18} />, trend: "Todo al día" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 16 }}>
      {cards.map((c) => {
        const isActive = active === c.key;
        const isCritical = c.key === "bloqueados" || c.key === "alertas";
        return (
          <button key={c.key} onClick={() => onPick(c.key)} style={{
            textAlign: "left", cursor: "pointer",
            background: C.surface, backdropFilter: "blur(20px)",
            border: `1px solid ${isActive ? c.color : C.border}`,
            borderRadius: 18, padding: 16, height: 110,
            transition: "transform .22s ease, box-shadow .22s ease, border-color .22s",
            boxShadow: isActive
              ? `0 0 0 1px ${c.color}55, 0 0 40px ${c.color}33`
              : `0 0 40px rgba(34,91,255,0.06)`,
            display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center",
            position: "relative", overflow: "hidden",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 0 0 1px ${c.color}55, 0 0 40px ${c.color}44`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = isActive ? `0 0 0 1px ${c.color}55, 0 0 40px ${c.color}33` : `0 0 40px rgba(34,91,255,0.06)`; }}
          >
            {/* Icon glow */}
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `linear-gradient(135deg, ${c.color}33, ${c.color}11)`,
              border: `1px solid ${c.color}44`,
              display: "grid", placeItems: "center",
              color: c.color, flexShrink: 0,
              boxShadow: `0 0 24px ${c.color}33`,
              animation: isCritical && c.value > 0 ? "nuvia-pulse 2.4s ease-in-out infinite" : undefined,
            }}>{c.icon}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.4, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: C.text, lineHeight: 1.05, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{c.value}</div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: c.color, marginTop: 2, letterSpacing: 0.02 }}>{c.trend}</div>
            </div>
          </button>
        );
      })}
      <style>{`
        @keyframes nuvia-pulse {
          0%,100% { box-shadow: 0 0 24px currentColor; opacity: 1; }
          50% { box-shadow: 0 0 36px currentColor; opacity: .85; }
        }
      `}</style>
    </div>
  );
}


/* ═══════════════════ BANK HEATMAP ═══════════════════ */
function BankHeatmap({ bancos, onPick, active }: { bancos: CCBank[]; onPick: (b: string) => void; active: string }) {
  const tone = (r: string) => r === "alto" ? C.danger : r === "medio" ? C.warning : C.success;
  const maxCases = Math.max(1, ...bancos.map((b) => b.auditados));
  return (
    <Section title="Riesgo por banco" subtitle="Score, error y nivel · ordenado por riesgo" icon={<Radar size={13} />}>
      <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
        {bancos.length === 0 ? (
          <p style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Sin datos en el rango.</p>
        ) : bancos.map((b) => {
          const isActive = active === b.banco;
          const initials = b.banco.split(/\s+/).slice(0, 2).map(s => s[0] ?? "").join("").toUpperCase();
          return (
            <button key={b.banco} onClick={() => onPick(b.banco)} style={{
              display: "grid", width: "100%", textAlign: "left", cursor: "pointer",
              gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
              padding: "10px 12px", borderRadius: 12, marginBottom: 6,
              background: isActive ? "rgba(91,140,255,0.10)" : "transparent",
              border: `1px solid ${isActive ? "rgba(91,140,255,0.35)" : "transparent"}`,
              transition: "background .22s, border-color .22s",
            }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `linear-gradient(135deg, ${tone(b.riesgo)}33, ${tone(b.riesgo)}11)`,
                border: `1px solid ${tone(b.riesgo)}44`, color: tone(b.riesgo),
                display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
              }}>{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.banco}</span>
                  <span style={{ fontSize: 10.5, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{b.auditados} · {b.pctError.toFixed(1)}% err</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(b.auditados / maxCases) * 100}%`, background: `linear-gradient(90deg, ${tone(b.riesgo)}, ${tone(b.riesgo)}88)`, boxShadow: `0 0 8px ${tone(b.riesgo)}66` }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: tone(b.riesgo), fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{b.promedio.toFixed(1)}</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: 1,
                  background: `${tone(b.riesgo)}22`, color: tone(b.riesgo), border: `1px solid ${tone(b.riesgo)}44`,
                }}>{b.riesgo}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}


/* ═══════════════════ ANALYST RANKING ═══════════════════ */
function AnalystRanking({ analistas, onPick, active }: { analistas: CCAnalista[]; onPick: (id: string) => void; active: string }) {
  const nivelMeta = (n: number) => {
    if (n >= 4) return { label: "N4 · Experto", color: C.purple };
    if (n === 3) return { label: "N3 · Autónomo", color: C.success };
    if (n === 2) return { label: "N2 · Semi", color: C.info };
    return { label: "N1 · Supervisado", color: C.warning };
  };
  const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase();
  const avatarBg = (name: string) => {
    const palette = [C.primary, C.secondary, C.success, C.info, C.warning, C.purple, C.danger];
    let hash = 0; for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return palette[hash % palette.length];
  };
  return (
    <Section title="Desempeño de analistas" subtitle="Precisión, score y nivel de autonomía" icon={<Activity size={13} />}>
      <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
        {analistas.length === 0 ? (
          <p style={{ padding: 20, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Sin analistas en el rango.</p>
        ) : analistas.map((a) => {
          const isActive = a.id && active === a.id;
          const nm = nivelMeta(a.nivel);
          const bg = avatarBg(a.nombre);
          const precColor = a.precision >= 90 ? C.success : a.precision >= 75 ? C.warning : C.danger;
          return (
            <button key={a.id ?? Math.random()} onClick={() => a.id && onPick(a.id)} style={{
              display: "grid", width: "100%", textAlign: "left", cursor: a.id ? "pointer" : "default",
              gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center",
              padding: "10px 12px", borderRadius: 12, marginBottom: 6,
              background: isActive ? "rgba(91,140,255,0.10)" : "transparent",
              border: `1px solid ${isActive ? "rgba(91,140,255,0.35)" : "transparent"}`,
              transition: "background .22s",
            }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: `linear-gradient(135deg, ${bg}, ${bg}99)`,
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                boxShadow: `0 0 16px ${bg}55`,
              }}>{initials(a.nombre)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.nombre}</span>
                  <span style={{ fontSize: 10.5, color: C.textMuted, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{a.auditados} · rech {a.rech}</span>
                </div>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, a.precision)}%`, background: `linear-gradient(90deg, ${precColor}, ${precColor}88)`, boxShadow: `0 0 8px ${precColor}66` }} />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: precColor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{a.precision.toFixed(0)}%</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 999, fontSize: 9, fontWeight: 700,
                  background: `${nm.color}22`, color: nm.color, border: `1px solid ${nm.color}44`,
                  whiteSpace: "nowrap",
                }}>{nm.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}


/* ═══════════════════ ALERT CENTER ═══════════════════ */
function AlertCenter({ counts, onPick, active }: { counts: Record<string, number>; onPick: (k: string) => void; active: string | null }) {
  const items = [
    { key: "sla", icon: <Timer size={14} />, label: "SLA vencidos", value: counts.slaVencidos ?? 0, color: C.warning },
    { key: "alertas", icon: <AlertTriangle size={14} />, label: "QA críticos", value: counts.alertasCriticas ?? 0, color: C.danger },
    { key: "esperando", icon: <Gavel size={14} />, label: "Casos estancados", value: counts.esperandoDictamen ?? 0, color: C.primary },
    { key: "devueltos", icon: <RotateCcw size={14} />, label: "Devueltos al analista", value: counts.devueltos ?? 0, color: C.info },
    { key: "uvr", icon: <Coins size={14} />, label: "UVR pendientes", value: counts.uvrSinRevision ?? 0, color: C.purple },
    { key: "bloqueados", icon: <ShieldAlert size={14} />, label: "Bloqueados", value: counts.bloqueados ?? 0, color: C.danger },
  ];
  return (
    <Section title="Alert Center" subtitle="Detalle de bloqueos e incidencias" icon={<Zap size={13} />}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {items.map((it, idx) => {
          const isActive = active === it.key;
          return (
            <div key={it.key} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center",
              padding: "12px 4px",
              borderBottom: idx < items.length - 1 ? `1px solid ${C.divider}` : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: `linear-gradient(135deg, ${it.color}33, ${it.color}11)`,
                border: `1px solid ${it.color}44`, color: it.color,
                display: "grid", placeItems: "center",
                boxShadow: `0 0 16px ${it.color}44`,
              }}>{it.icon}</div>
              <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500 }}>{it.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: it.color, fontVariantNumeric: "tabular-nums" }}>{it.value}</div>
              <button onClick={() => onPick(it.key)} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: isActive ? `${it.color}22` : "transparent",
                border: `1px solid ${isActive ? it.color : C.border}`,
                color: isActive ? it.color : C.textMuted,
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.04,
                padding: "4px 10px", borderRadius: 8, cursor: "pointer",
              }}>Ver <ArrowRight size={10} /></button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}


/* ═══════════════════ TOP ERRORS ═══════════════════ */
function TopErrors({ errores }: { errores: CCError[] }) {
  const max = Math.max(1, ...errores.map((e) => e.total));
  const labelMap: Record<string, string> = {
    cuota: "Cuota incorrecta", tasa_ea: "TEA inconsistente", saldo: "Saldo incorrecto",
    plazo: "Plazo incorrecto", capital: "Capital mal digitado", frech: "FRECH omitido",
    seguros: "Seguro omitido", producto: "Producto mal clasificado",
  };
  return (
    <Section title="Top inconsistencias" subtitle="Frecuencia, tendencia y gravedad · 30 días">
      <div style={{ display: "grid", gap: 14 }}>
        {errores.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 12, padding: 16, textAlign: "center" }}>Sin inconsistencias en el rango.</p>
        ) : errores.map((e) => {
          const tendencia = e.ultimos7 > e.total / 4 ? "up" : e.ultimos7 === 0 ? "down" : "flat";
          const TIcon = tendencia === "up" ? TrendingUp : tendencia === "down" ? TrendingDown : Minus;
          const tColor = tendencia === "up" ? C.danger : tendencia === "down" ? C.success : C.textMuted;
          const critical = e.criticas > 0;
          return (
            <div key={e.tipo}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12.5, color: C.text, fontWeight: 600 }}>{labelMap[e.tipo] ?? e.tipo}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>
                  {critical && (
                    <span style={{ padding: "2px 8px", borderRadius: 999, background: `${C.danger}22`, color: C.danger, border: `1px solid ${C.danger}44`, fontSize: 10, fontWeight: 700 }}>
                      {e.criticas} crít.
                    </span>
                  )}
                  <TIcon size={12} color={tColor} />
                  <span style={{ fontWeight: 700, color: C.text }}>{e.total}</span>
                </span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${(e.total / max) * 100}%`,
                  background: critical
                    ? `linear-gradient(90deg, ${C.danger}, ${C.warning})`
                    : `linear-gradient(90deg, ${C.primary}, ${C.secondary})`,
                  boxShadow: critical ? `0 0 12px ${C.danger}66` : `0 0 12px ${C.primary}55`,
                  transition: "width .6s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}


/* ═══════════════════ QA HEALTH TREND ═══════════════════ */
function QaHealthTrend({ data }: { data: CCTrend[] }) {
  return (
    <Section title="Salud operativa QA" subtitle="Score, aprobaciones, observaciones, rechazos y críticos">
      <div style={{ width: "100%", height: 260, padding: "8px 0 0" }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="ncGradPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.primary} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(8,17,31,0.95)", border: `1px solid ${C.borderStrong}`,
                borderRadius: 12, color: C.text, fontSize: 12,
                boxShadow: "0 0 40px rgba(34,91,255,0.20)", backdropFilter: "blur(20px)",
              }}
              labelStyle={{ color: C.textSec, fontWeight: 600, marginBottom: 4 }}
              cursor={{ stroke: C.primary, strokeOpacity: 0.35, strokeWidth: 1 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: C.textSec, paddingTop: 6 }} iconType="circle" />
            <Area type="monotone" dataKey="scoreProm" name="Score prom." stroke={C.primary} strokeWidth={2.5} fill="url(#ncGradPrimary)" dot={false} />
            <Line type="monotone" dataKey="aprobados" name="Aprobados" stroke={C.success} strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="observados" name="Observados" stroke={C.warning} strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="rechazados" name="Rechazos" stroke={C.danger} strokeWidth={1.6} dot={false} />
            <Line type="monotone" dataKey="criticos" name="Críticos" stroke={C.purple} strokeWidth={1.6} dot={false} strokeDasharray="4 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}


/* ═══════════════════ NUVIA INSIGHTS ═══════════════════ */
type Insight = { icon: React.ReactNode; title: string; impact: "alto" | "medio" | "info"; cta?: string };

function generateInsights(bancos: CCBank[], analistas: CCAnalista[], counts: Record<string, number>, errores: CCError[]): Insight[] {
  const list: Insight[] = [];

  const totalRech = bancos.reduce((s, b) => s + Math.round((b.pctError / 100) * b.auditados), 0);
  const worstBank = [...bancos].filter(b => b.auditados > 0).sort((a, b) => b.pctError - a.pctError)[0];
  if (worstBank && totalRech > 0) {
    const rechBank = Math.round((worstBank.pctError / 100) * worstBank.auditados);
    const pct = Math.round((rechBank / Math.max(1, totalRech)) * 100);
    if (pct >= 20) list.push({
      icon: <Radar size={16} />,
      title: `${worstBank.banco} concentra el ${pct}% de rechazos totales.`,
      impact: "alto", cta: "Revisar patrón",
    });
  }

  const worstAnalyst = [...analistas].filter(a => a.auditados >= 3).sort((a, b) => a.precision - b.precision)[0];
  if (worstAnalyst && worstAnalyst.precision < 85) list.push({
    icon: <Activity size={16} />,
    title: `${worstAnalyst.nombre} bajó a ${worstAnalyst.precision.toFixed(0)}% de precisión.`,
    impact: worstAnalyst.precision < 70 ? "alto" : "medio", cta: "Coaching",
  });

  const uvr = counts.uvrSinRevision ?? 0;
  if (uvr > 0) list.push({
    icon: <Coins size={16} />,
    title: `UVR tiene ${uvr} caso${uvr === 1 ? "" : "s"} pendientes de revisión.`,
    impact: uvr > 20 ? "alto" : "medio", cta: "Priorizar UVR",
  });

  const topErr = [...errores].sort((a, b) => b.total - a.total)[0];
  if (topErr && topErr.total > 0) list.push({
    icon: <Sparkles size={16} />,
    title: `"${topErr.tipo}" es el error #1 con ${topErr.total} ocurrencias.`,
    impact: topErr.criticas > 0 ? "alto" : "info", cta: "Ver regla",
  });

  const bloq = counts.bloqueados ?? 0;
  if (bloq > 10) list.push({
    icon: <ShieldAlert size={16} />,
    title: `${bloq} casos bloqueados están frenando la operación.`,
    impact: "alto", cta: "Desbloquear",
  });

  if (list.length === 0) list.push({
    icon: <Sparkles size={16} />,
    title: "Sistema estable. Sin patrones críticos detectados en el rango.",
    impact: "info",
  });

  return list.slice(0, 5);
}

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function Sparkline({ values, color = "#5B8CFF", height = 26, width = 70 }: { values: number[]; color?: string; height?: number; width?: number }) {
  if (!values.length) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const span = Math.max(1, max - min);
  const pts = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - ((v - min) / span) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={`url(#sg-${color.replace("#","")})`} stroke="none" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NuviaInsights({
  insights, counts, bancos, analistas, errores, tendencia, totalCasos,
}: {
  insights: Insight[]; counts: Record<string, number>;
  bancos: CCBank[]; analistas: CCAnalista[]; errores: CCError[];
  tendencia: CCTrend[]; totalCasos: number;
}) {
  // ── Live AI metrics
  const bloqueados = counts.bloqueados ?? 0;
  const criticas = counts.criticas ?? 0;
  const uvrPend = counts.uvrSinRevision ?? 0;
  const precisionGlobal = useMemo(() => {
    const withData = analistas.filter(a => a.auditados > 0);
    if (!withData.length) return 0;
    return withData.reduce((s, a) => s + a.precision, 0) / withData.length;
  }, [analistas]);

  const cCasos = useCountUp(totalCasos);
  const cAlerts = useCountUp(criticas);
  const cBloq = useCountUp(bloqueados);
  const cPrec = useCountUp(Math.round(precisionGlobal * 10));

  // ── Predictions
  const worstBankPred = useMemo(() => {
    const b = [...bancos].filter(x => x.auditados > 0).sort((a, b) => b.pctError - a.pctError)[0];
    if (!b) return null;
    const risk = Math.min(95, Math.round(b.pctError * 1.6 + (b.auditados > 10 ? 20 : 10)));
    return { name: b.banco, risk };
  }, [bancos]);
  const rechazoMasivo = useMemo(() => {
    if (!bancos.length) return 0;
    const avgErr = bancos.reduce((s, b) => s + b.pctError, 0) / bancos.length;
    return Math.min(90, Math.round(avgErr * 1.4 + (criticas > 50 ? 15 : 5)));
  }, [bancos, criticas]);
  const bestAnalyst = useMemo(() => {
    return [...analistas].filter(a => a.auditados >= 2).sort((a, b) => b.precision - a.precision)[0] ?? null;
  }, [analistas]);
  const trendError = useMemo(() => {
    if (tendencia.length < 8) return { delta: 0, spark: [] as number[] };
    const spark = tendencia.slice(-14).map(t => t.rechazados + t.criticos);
    const half = Math.floor(spark.length / 2);
    const a = spark.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(1, half);
    const b = spark.slice(half).reduce((s, v) => s + v, 0) / Math.max(1, spark.length - half);
    const delta = a === 0 ? 0 : Math.round(((b - a) / a) * 100);
    return { delta, spark };
  }, [tendencia]);
  const sparkPrecision = useMemo(() => tendencia.slice(-14).map(t => t.scoreProm), [tendencia]);
  const sparkBloq = useMemo(() => tendencia.slice(-14).map(t => t.rechazados), [tendencia]);

  const impactColor = (i: Insight["impact"]) => i === "alto" ? C.danger : i === "medio" ? C.warning : C.info;
  const NUVIA_GREEN = "#84B98F";
  const NUVIA_BLUE = "#445DA3";

  return (
    <div style={{
      background: "linear-gradient(180deg, #0A1224 0%, #08111F 100%)",
      border: `1px solid rgba(68,93,163,0.20)`, borderRadius: 22, padding: 18,
      boxShadow: "0 20px 50px rgba(68,93,163,0.18)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div aria-hidden style={{
        position: "absolute", left: "18%", top: "50%", width: 380, height: 380, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(68,93,163,0.28) 0%, transparent 65%)",
        filter: "blur(30px)", transform: "translateY(-50%)", pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", right: "5%", bottom: "-20%", width: 260, height: 260, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(132,185,143,0.15) 0%, transparent 70%)",
        filter: "blur(24px)", pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: `linear-gradient(135deg, ${NUVIA_BLUE}, ${NUVIA_GREEN})`,
            border: `1px solid rgba(132,185,143,0.35)`, color: "#EAF1FF",
            display: "grid", placeItems: "center",
            boxShadow: `0 0 24px ${NUVIA_BLUE}88, inset 0 0 12px rgba(255,255,255,0.15)`,
          }}><Sparkles size={18} /></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: 0.6, textTransform: "uppercase" }}>NUVIA Insights</div>
            <div style={{ fontSize: 10.5, color: C.textMuted, letterSpacing: 0.4 }}>
              Motor de inteligencia predictiva y detección operativa en tiempo real.
            </div>
          </div>
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 11px", borderRadius: 999,
          background: `linear-gradient(90deg, rgba(132,185,143,0.18), rgba(68,93,163,0.18))`,
          border: `1px solid ${NUVIA_GREEN}55`,
          fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: NUVIA_GREEN,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: "50%", background: NUVIA_GREEN,
            boxShadow: `0 0 10px ${NUVIA_GREEN}`, animation: "nuvia-live-blink 1.6s ease-in-out infinite",
          }} />
          LIVE AI
        </div>
      </div>

      {/* 3-column grid */}
      <div style={{
        display: "grid", gridTemplateColumns: "38% 37% 25%", gap: 14,
        position: "relative", alignItems: "stretch",
      }}>
        {/* ── COL 1 · BRAIN CORE */}
        <div style={{
          position: "relative",
          background: "rgba(255,255,255,0.02)",
          border: `1px solid rgba(68,93,163,0.20)`, borderRadius: 18,
          padding: "10px 12px 12px",
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8,
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: NUVIA_GREEN, letterSpacing: 1.6, textTransform: "uppercase" }}>Brain Core</div>
            <div style={{ fontSize: 9.5, color: C.textMuted, letterSpacing: 1.2, textTransform: "uppercase" }}>Cognitive Engine</div>
          </div>
          <HolographicBrain />
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6, marginTop: 2,
          }}>
            <BrainMetric dot={NUVIA_BLUE} label="Procesando" value={`${cCasos} casos`} />
            <BrainMetric dot={C.danger} label="Alertas críticas" value={`${cAlerts}`} />
            <BrainMetric dot={C.warning} label="Bloqueos" value={`${cBloq}`} />
            <BrainMetric dot={NUVIA_GREEN} label="Precisión global" value={`${(cPrec / 10).toFixed(1)}%`} />
          </div>
        </div>

        {/* ── COL 2 · CRITICAL INSIGHTS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: NUVIA_BLUE, letterSpacing: 1.6, textTransform: "uppercase", paddingLeft: 2 }}>
            Insights críticos
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 8,
            overflowY: "auto", paddingRight: 4, maxHeight: 360,
          }}>
            {insights.map((it, i) => {
              const c = impactColor(it.impact);
              return (
                <div key={i} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid rgba(68,93,163,0.20)`,
                  borderLeft: `3px solid ${c}`,
                  borderRadius: 12, padding: "10px 12px",
                  display: "grid", gridTemplateColumns: "auto 1fr", gap: 10, alignItems: "flex-start",
                  transition: "transform .22s ease, border-color .22s, box-shadow .22s",
                  boxShadow: `0 0 0 rgba(0,0,0,0)`,
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.borderColor = `${c}66`;
                    e.currentTarget.style.boxShadow = `0 12px 24px rgba(0,0,0,0.35), 0 0 22px ${c}22`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "rgba(68,93,163,0.20)";
                    e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)";
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: `linear-gradient(135deg, ${c}33, ${c}11)`,
                    border: `1px solid ${c}44`, color: c,
                    display: "grid", placeItems: "center",
                    boxShadow: `0 0 12px ${c}55`,
                  }}>{it.icon}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, color: C.text, fontWeight: 600, lineHeight: 1.35 }}>{it.title}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <span style={{
                        padding: "1px 7px", borderRadius: 999, fontSize: 8.5, fontWeight: 800,
                        textTransform: "uppercase", letterSpacing: 1,
                        background: `${c}22`, color: c, border: `1px solid ${c}44`,
                      }}>Impacto {it.impact}</span>
                      <button style={{
                        marginLeft: "auto",
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: "transparent", border: "none", cursor: "pointer",
                        color: NUVIA_BLUE, fontSize: 10.5, fontWeight: 700, padding: 0,
                      }}>{it.cta ?? "Ver análisis"} <ArrowRight size={10} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── COL 3 · PREDICTIVE ENGINE */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: NUVIA_GREEN, letterSpacing: 1.6, textTransform: "uppercase", paddingLeft: 2 }}>
            Predictive Engine
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
            <PredictCard
              icon={<TrendingUp size={13} />}
              iconColor={C.danger}
              label={worstBankPred ? `Riesgo saturación ${worstBankPred.name}` : "Riesgo saturación banco"}
              value={`${worstBankPred?.risk ?? 0}%`}
              spark={sparkBloq} sparkColor={C.danger}
            />
            <PredictCard
              icon={<Zap size={13} />}
              iconColor={C.warning}
              label="Prob. rechazo masivo"
              value={`${rechazoMasivo}%`}
              spark={sparkBloq} sparkColor={C.warning}
            />
            <PredictCard
              icon={<Activity size={13} />}
              iconColor={NUVIA_GREEN}
              label={bestAnalyst ? `Mayor mejora · ${bestAnalyst.nombre.split(" ")[0]}` : "Analista destacado"}
              value={bestAnalyst ? `${bestAnalyst.precision.toFixed(0)}%` : "—"}
              spark={sparkPrecision} sparkColor={NUVIA_GREEN}
            />
            <PredictCard
              icon={trendError.delta <= 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
              iconColor={trendError.delta <= 0 ? NUVIA_GREEN : C.danger}
              label="Tendencia de errores"
              value={`${trendError.delta > 0 ? "+" : ""}${trendError.delta}%`}
              spark={trendError.spark} sparkColor={trendError.delta <= 0 ? NUVIA_GREEN : C.danger}
            />
            <PredictCard
              icon={<Coins size={13} />}
              iconColor={NUVIA_BLUE}
              label="UVR pendiente revisión"
              value={`${uvrPend}`}
              spark={sparkBloq} sparkColor={NUVIA_BLUE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainMetric({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(68,93,163,0.18)",
      borderRadius: 10, padding: "6px 8px",
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%", background: dot,
        boxShadow: `0 0 8px ${dot}`, flexShrink: 0,
      }} />
      <div style={{ minWidth: 0, lineHeight: 1.1 }}>
        <div style={{ fontSize: 8.5, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: C.text, fontWeight: 700, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

function PredictCard({ icon, iconColor, label, value, spark, sparkColor }: {
  icon: React.ReactNode; iconColor: string; label: string; value: string;
  spark: number[]; sparkColor: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(68,93,163,0.20)",
      borderRadius: 12, padding: "9px 11px",
      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center",
      transition: "transform .22s, box-shadow .22s, border-color .22s",
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.borderColor = `${iconColor}55`;
        e.currentTarget.style.boxShadow = `0 12px 22px rgba(0,0,0,0.35), 0 0 18px ${iconColor}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(68,93,163,0.20)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 7,
        background: `linear-gradient(135deg, ${iconColor}33, ${iconColor}11)`,
        border: `1px solid ${iconColor}44`, color: iconColor,
        display: "grid", placeItems: "center", boxShadow: `0 0 10px ${iconColor}44`,
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ fontSize: 14, color: C.text, fontWeight: 800, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      </div>
      <Sparkline values={spark} color={sparkColor} height={22} width={54} />
    </div>
  );
}

/* ═══════════════════ HOLOGRAPHIC BRAIN ═══════════════════ */
function HolographicBrain() {
  const NEURONS = useMemo(() => Array.from({ length: 14 }).map(() => ({
    x: 50 + (Math.random() - 0.5) * 68,
    y: 50 + (Math.random() - 0.5) * 68,
    r: 1 + Math.random() * 1.6,
    d: 2.4 + Math.random() * 2.8,
    delay: -Math.random() * 4,
  })), []);
  const CONNECTIONS = useMemo(() => {
    const c: Array<{ x1: number; y1: number; x2: number; y2: number; d: number; delay: number }> = [];
    for (let i = 0; i < 10; i++) {
      const a = NEURONS[Math.floor(Math.random() * NEURONS.length)];
      const b = NEURONS[Math.floor(Math.random() * NEURONS.length)];
      if (a && b && a !== b) c.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, d: 2.5 + Math.random() * 2, delay: -Math.random() * 3 });
    }
    return c;
  }, [NEURONS]);

  return (
    <div style={{
      position: "relative", width: "100%", height: 210, maxWidth: 240, margin: "0 auto",
      display: "grid", placeItems: "center",
    }}>
      <style>{`
        @keyframes nuvia-live-blink { 0%,100% { opacity:1;} 50% { opacity:.35;} }
        @keyframes nuvia-brain-spin { from { transform: translate(-50%,-50%) rotate(0deg);} to { transform: translate(-50%,-50%) rotate(360deg);} }
        @keyframes nuvia-brain-spin-rev { from { transform: translate(-50%,-50%) rotate(360deg);} to { transform: translate(-50%,-50%) rotate(0deg);} }
        @keyframes nuvia-brain-pulse {
          0%, 100% { opacity:.88; transform: translate(-50%,-50%) scale(1); box-shadow: 0 0 32px rgba(68,93,163,0.9), 0 0 60px rgba(132,185,143,0.35), inset 0 0 18px rgba(255,255,255,0.35);}
          50% { opacity:1; transform: translate(-50%,-50%) scale(1.09); box-shadow: 0 0 55px rgba(68,93,163,1), 0 0 90px rgba(132,185,143,0.55), inset 0 0 24px rgba(255,255,255,0.5);}
        }
        @keyframes nuvia-particle-orbit {
          0% { transform: rotate(var(--a)) translateX(var(--r)) scale(.6); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: rotate(calc(var(--a) + 360deg)) translateX(var(--r)) scale(1); opacity: 0; }
        }
        @keyframes nuvia-neuron-pulse {
          0%,100% { opacity:.35; r: var(--r0);}
          50% { opacity: 1; r: calc(var(--r0) * 1.6);}
        }
        @keyframes nuvia-syn { 0%,100% { stroke-opacity: 0.15;} 50% { stroke-opacity: 0.75;} }
        @keyframes nuvia-wave {
          0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7;}
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0;}
        }
        @keyframes nuvia-datastream {
          0% { stroke-dashoffset: 30; opacity: 0;}
          20% { opacity: 1;}
          100% { stroke-dashoffset: -30; opacity: 0;}
        }
      `}</style>

      {/* Ambient */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% 50%, rgba(68,93,163,0.35) 0%, rgba(132,185,143,0.10) 40%, transparent 72%)",
        filter: "blur(10px)",
      }} />

      {/* Energy waves */}
      {[0, 1.2, 2.4].map((delay, i) => (
        <div key={`w-${i}`} style={{
          position: "absolute", top: "50%", left: "50%",
          width: 120, height: 120, borderRadius: "50%",
          border: "1px solid rgba(132,185,143,0.55)",
          animation: `nuvia-wave 3.6s ease-out ${delay}s infinite`,
          transformOrigin: "center",
        }} />
      ))}

      {/* Orbital rings */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: "88%", aspectRatio: "1/1", borderRadius: "50%",
        border: "1px dashed rgba(68,93,163,0.55)",
        animation: "nuvia-brain-spin 24s linear infinite",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: "68%", aspectRatio: "1/1", borderRadius: "50%",
        border: "1px solid rgba(132,185,143,0.55)",
        boxShadow: "inset 0 0 20px rgba(68,93,163,0.35), 0 0 22px rgba(132,185,143,0.35)",
        animation: "nuvia-brain-spin-rev 18s linear infinite",
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: "50%", aspectRatio: "1/1", borderRadius: "50%",
        border: "2px solid rgba(68,93,163,0.9)",
        boxShadow: "0 0 22px rgba(68,93,163,0.65), inset 0 0 18px rgba(132,185,143,0.35)",
        animation: "nuvia-brain-spin 12s linear infinite",
      }} />

      {/* Neural network */}
      <svg viewBox="0 0 100 100" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none",
      }}>
        <defs>
          <radialGradient id="brain-core" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#EAF1FF" />
            <stop offset="35%" stopColor="#84B98F" stopOpacity="0.85" />
            <stop offset="70%" stopColor="#445DA3" />
            <stop offset="100%" stopColor="#0A1224" />
          </radialGradient>
          <linearGradient id="brain-stream" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#445DA3" stopOpacity="0" />
            <stop offset="50%" stopColor="#84B98F" stopOpacity="1" />
            <stop offset="100%" stopColor="#445DA3" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Synapse lines */}
        {CONNECTIONS.map((c, i) => (
          <line key={`c-${i}`}
            x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2}
            stroke="#84B98F" strokeWidth="0.3" strokeOpacity="0.4"
            style={{ animation: `nuvia-syn ${c.d}s ease-in-out ${c.delay}s infinite` }}
          />
        ))}

        {/* Neurons */}
        {NEURONS.map((n, i) => (
          <circle key={`n-${i}`}
            cx={n.x} cy={n.y} r={n.r}
            fill="#B5D0FF"
            style={{
              ["--r0" as any]: `${n.r}`,
              animation: `nuvia-neuron-pulse ${n.d}s ease-in-out ${n.delay}s infinite`,
              filter: "drop-shadow(0 0 2px #84B98F)",
            } as React.CSSProperties}
          />
        ))}

        {/* Data streams in/out */}
        {[
          { x1: 5, y1: 50, x2: 30, y2: 50, d: 1.6, delay: 0 },
          { x1: 95, y1: 50, x2: 70, y2: 50, d: 1.8, delay: 0.4 },
          { x1: 50, y1: 5, x2: 50, y2: 30, d: 2.0, delay: 0.8 },
          { x1: 50, y1: 95, x2: 50, y2: 70, d: 1.9, delay: 1.2 },
          { x1: 15, y1: 20, x2: 34, y2: 34, d: 2.1, delay: 0.2 },
          { x1: 85, y1: 80, x2: 66, y2: 66, d: 2.1, delay: 1.4 },
        ].map((s, i) => (
          <line key={`s-${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="url(#brain-stream)" strokeWidth="0.6"
            strokeDasharray="4 6"
            style={{ animation: `nuvia-datastream ${s.d}s linear ${s.delay}s infinite` }}
          />
        ))}
      </svg>

      {/* Core orb */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: "34%", aspectRatio: "1/1", borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #EAF1FF 0%, #84B98F 30%, #445DA3 65%, #0A1224 100%)",
        animation: "nuvia-brain-pulse 3s ease-in-out infinite",
      }} />

      {/* Orbiting particles */}
      {[
        { a: "0deg", r: "34%", d: "5s", c: "#84B98F" },
        { a: "72deg", r: "38%", d: "6.5s", c: "#445DA3" },
        { a: "144deg", r: "32%", d: "4.6s", c: "#B5D0FF" },
        { a: "216deg", r: "40%", d: "7s", c: "#84B98F" },
        { a: "288deg", r: "36%", d: "5.4s", c: "#445DA3" },
      ].map((p, i) => (
        <div key={`p-${i}`} style={{
          position: "absolute", top: "50%", left: "50%", width: 0, height: 0,
        }}>
          <div style={{
            position: "absolute", width: 5, height: 5, borderRadius: "50%",
            background: p.c, boxShadow: `0 0 10px ${p.c}`,
            ["--a" as any]: p.a, ["--r" as any]: p.r,
            animation: `nuvia-particle-orbit ${p.d} linear infinite`,
          } as React.CSSProperties} />
        </div>
      ))}
    </div>
  );
}


/* ═══════════════════ REVIEW QUEUE (Top 5) ═══════════════════ */
function ReviewQueue({ rows }: { rows: CCRow[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const score = (s: number) => s >= 95 ? C.success : s >= 85 ? C.warning : C.danger;
  const dictamen: Record<string, { label: string; color: string }> = {
    aprobado: { label: "APROBADO", color: C.success },
    aprobado_obs: { label: "APROB. C/OBS", color: C.warning },
    requiere_revision: { label: "REVISAR", color: C.info },
    rechazado: { label: "RECHAZADO", color: C.danger },
  };

  type DateBucket = "hoy" | "7d" | "30d" | "todo" | "custom";
  const [dateBucket, setDateBucket] = useState<DateBucket>("30d");
  const [customDate, setCustomDate] = useState<string>("");

  const dateFiltered = useMemo(() => {
    if (dateBucket === "todo") return rows;
    if (dateBucket === "custom") {
      if (!customDate) return rows;
      return rows.filter((r) => (r.ejecutado_at ?? "").slice(0, 10) === customDate);
    }
    const now = Date.now();
    const day = 86400000;
    if (dateBucket === "hoy") {
      const today = new Date().toISOString().slice(0, 10);
      return rows.filter((r) => (r.ejecutado_at ?? "").slice(0, 10) === today);
    }
    const windowMs = dateBucket === "7d" ? 7 * day : 30 * day;
    return rows.filter((r) => {
      const t = new Date(r.ejecutado_at).getTime();
      return !Number.isNaN(t) && now - t <= windowMs;
    });
  }, [rows, dateBucket, customDate]);

  const ordered = useMemo(() => {
    return [...dateFiltered].sort((a, b) => {
      const aCrit = a.alertas_criticas > 0 ? 1 : 0;
      const bCrit = b.alertas_criticas > 0 ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      const aBlock = a.dictamen === "rechazado" ? 1 : 0;
      const bBlock = b.dictamen === "rechazado" ? 1 : 0;
      if (aBlock !== bBlock) return bBlock - aBlock;
      if (a.qa_score !== b.qa_score) return a.qa_score - b.qa_score;
      const aT = new Date(a.ejecutado_at).getTime();
      const bT = new Date(b.ejecutado_at).getTime();
      if (aT !== bT) return bT - aT;
      return b.ticket - a.ticket;
    });
  }, [dateFiltered]);

  const prioridad = (r: CCRow): { label: string; color: string } => {
    if (r.alertas_criticas > 0) return { label: "P0 · Crítico", color: C.danger };
    if (r.dictamen === "rechazado") return { label: "P1 · Bloqueado", color: "#FF8A00" };
    if (r.dictamen === "requiere_revision") return { label: "P2 · Revisar", color: C.warning };
    if (r.qa_score < 90) return { label: "P3 · Score bajo", color: C.info };
    return { label: "P4 · Rutina", color: C.textMuted };
  };

  const openExtracto = async (path: string) => {
    const { data, error } = await supabase.storage.from("extractos").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) { alert("No se pudo abrir el extracto."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const [showAll, setShowAll] = useState(false);
  const visibles = showAll ? ordered : ordered.slice(0, 5);

  const scrollQueue = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.72), behavior: "smooth" });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    const horizontalIntent = Math.abs(e.deltaX) >= Math.abs(e.deltaY);
    const delta = horizontalIntent ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (!delta) return;
    const next = Math.max(0, Math.min(max, el.scrollLeft + delta));
    if (next !== el.scrollLeft) {
      e.preventDefault();
      el.scrollLeft = next;
    }
  };

  const th: React.CSSProperties = {
    textAlign: "left", padding: "10px 12px", color: C.textMuted, fontWeight: 700,
    borderBottom: `1px solid ${C.divider}`, whiteSpace: "nowrap", fontSize: 9.5,
    letterSpacing: 1.4, textTransform: "uppercase",
  };
  const td: React.CSSProperties = { padding: "0 12px", whiteSpace: "nowrap" };

  const bucketBtn = (key: DateBucket, label: string) => {
    const active = dateBucket === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => setDateBucket(key)}
        style={{
          padding: "5px 11px", borderRadius: 8, cursor: "pointer",
          fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
          background: active ? "rgba(91,140,255,0.18)" : "rgba(255,255,255,0.03)",
          color: active ? C.primary : C.textSec,
          border: `1px solid ${active ? "rgba(91,140,255,0.45)" : C.border}`,
          whiteSpace: "nowrap",
        }}
      >{label}</button>
    );
  };


  return (
    <Section
      title={`Cola de revisión · Top ${visibles.length} de ${ordered.length}`}
      subtitle="Orden inteligente: criticidad → bloqueo → score → antigüedad → ticket"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.textMuted, marginRight: 4 }}>Fecha:</span>
          {bucketBtn("hoy", "Hoy")}
          {bucketBtn("7d", "7 días")}
          {bucketBtn("30d", "30 días")}
          {bucketBtn("todo", "Todo")}
          <input
            type="date"
            value={customDate}
            onChange={(e) => { setCustomDate(e.target.value); setDateBucket(e.target.value ? "custom" : "30d"); }}
            style={{
              padding: "5px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: dateBucket === "custom" ? "rgba(91,140,255,0.14)" : "rgba(255,255,255,0.03)",
              color: dateBucket === "custom" ? C.primary : C.textSec,
              border: `1px solid ${dateBucket === "custom" ? "rgba(91,140,255,0.45)" : C.border}`,
              colorScheme: "dark",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => scrollQueue(-1)} title="Mover cola hacia la izquierda" style={{
            width: 30, height: 28, borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", color: C.textSec, border: `1px solid ${C.border}`,
          }}>←</button>
          <button type="button" onClick={() => scrollQueue(1)} title="Mover cola hacia la derecha" style={{
            width: 30, height: 28, borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.04)", color: C.textSec, border: `1px solid ${C.border}`,
          }}>→</button>
        </div>
      </div>

      <div ref={scrollerRef} onWheel={handleWheel} style={{ overflowX: "hidden" }}>
        {visibles.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 12 }}>Sin casos en la cola.</div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 12,
          }}>
            {visibles.map((r) => {
              const p = prioridad(r);
              const d = dictamen[r.dictamen] ?? { label: r.dictamen, color: C.textSec };
              const scoreCol = score(r.qa_score);
              const iniciales = (r.cliente_nombre ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "·";
              const fecha = r.ejecutado_at
                ? new Date(r.ejecutado_at).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "—";
              const tipo = r.modalidad === "uvr" ? "Hipotecario UVR"
                : r.modalidad === "hipotecario" ? "Hipotecario"
                : r.modalidad === "leasing" ? "Leasing"
                : (r.modalidad || "Crédito");
              return (
                <div
                  key={r.id}
                  style={{
                    background: "rgba(13,18,38,0.72)",
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${p.color}`,
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    transition: "transform .18s ease, border-color .18s ease, background .18s ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = "rgba(20,27,52,0.82)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "rgba(13,18,38,0.72)"; }}
                >
                  {/* Header row: badges + score */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, minWidth: 0, flex: 1 }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3,
                        background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44`, whiteSpace: "nowrap",
                      }}>{p.label}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 700, letterSpacing: 0.3,
                        background: `${d.color}22`, color: d.color, border: `1px solid ${d.color}44`, whiteSpace: "nowrap",
                      }}>{d.label}</span>
                      {r.auditor_aprobado_at && (
                        props.showCreateCaseCTA && !r.expediente_id ? (
                          <Link
                            to="/herramientas/simulador"
                            search={{ auditoriaId: r.id }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ textDecoration: "none" }}
                          >
                            <span title="Aprobada por auditor — continúa en el simulador para crear el caso" style={{
                              padding: "2px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 700,
                              background: `${C.success}2f`, color: C.success, border: `1px solid ${C.success}77`,
                              whiteSpace: "nowrap", cursor: "pointer",
                            }}>✓ Aprobada · Crear caso</span>
                          </Link>
                        ) : (
                          <span title="Aprobada por auditor" style={{
                            padding: "2px 7px", borderRadius: 999, fontSize: 9.5, fontWeight: 700,
                            background: `${C.success}1f`, color: C.success, border: `1px solid ${C.success}55`,
                          }}>✓ Auditor</span>
                        )
                      )}
                    </div>
                    <div style={{
                      display: "grid", placeItems: "center", minWidth: 44, height: 44, borderRadius: 10,
                      background: `${scoreCol}1a`, border: `1px solid ${scoreCol}55`, flexShrink: 0,
                    }}>
                      <span style={{ color: scoreCol, fontWeight: 800, fontSize: 15, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{r.qa_score.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Identity: initials + client */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: "linear-gradient(135deg, rgba(91,140,255,0.28), rgba(31,210,134,0.20))",
                      border: `1px solid ${C.borderStrong}`,
                      color: C.text, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700,
                    }}>{iniciales}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: C.text, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.cliente_nombre ?? "Cliente sin identificar"}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                        <span style={{
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 10, color: C.textMuted,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{r.codigo ?? "—"}</span>
                        {r.motor_version && r.motor_version !== QA_MOTOR_VERSION && (
                          <span title="Motor desactualizado" style={{ color: C.danger, fontSize: 11 }}>↻</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grid of key fields */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "6px 12px",
                    fontSize: 11, color: C.textSec,
                  }}>
                    <Meta label="Banco" value={r.banco ?? "—"} strong />
                    <Meta label="Producto" value={r.producto ?? "—"} strong />
                    <Meta label="Tipo" value={tipo} strong capitalize />
                    <Meta label="Ticket" value={r.ticket ? fCop(r.ticket) : "—"} mono />
                    <Meta label="Analista" value={r.analista_nombre ?? "—"} span2 />
                    <Meta label="Fecha" value={fecha} mono span2 />
                  </div>

                  {/* Footer: risk + actions */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 8, borderTop: `1px solid ${C.divider}` }}>
                    <div style={{ fontSize: 10.5, minWidth: 0, flex: 1 }}>
                      {r.alertas_criticas > 0 ? (
                        <span style={{ color: C.danger, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                          <AlertTriangle size={11} /> {r.alertas_criticas} crítica{r.alertas_criticas === 1 ? "" : "s"}
                        </span>
                      ) : r.sla_vencido ? (
                        <span style={{ color: C.warning, fontWeight: 700 }}>SLA vencido</span>
                      ) : (
                        <span style={{ color: C.textMuted }}>Sin alertas</span>
                      )}
                    </div>
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <Link to="/qa-ai/$id" params={{ id: r.id }} title="Ver dictamen" style={{
                        display: "inline-flex", alignItems: "center", gap: 3, padding: "5px 10px",
                        borderRadius: 8, background: `${C.primary}1a`, color: C.primary,
                        border: `1px solid ${C.primary}44`, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                      }}>Ver <ArrowRight size={11} /></Link>
                      <Link
                        to="/simulador" search={{ auditoriaId: r.id, modo: r.modalidad === "uvr" ? "uvr" : "pesos" } as never}
                        title="Reconstruir caso" style={{
                          display: "inline-flex", alignItems: "center", gap: 3, padding: "5px 10px",
                          borderRadius: 8, background: `${C.secondary}1a`, color: C.secondary,
                          border: `1px solid ${C.secondary}44`, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
                        }}><FileSearch size={11} /> Recons.</Link>
                      {r.extracto_path && (
                        <button onClick={() => openExtracto(r.extracto_path!)} title="Abrir extracto" style={{
                          padding: "5px 8px", borderRadius: 8, background: "transparent",
                          color: C.textSec, border: `1px solid ${C.border}`, cursor: "pointer",
                        }}><Paperclip size={11} /></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {ordered.length > 5 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
          <button onClick={() => setShowAll((v) => !v)} style={{
            background: "rgba(91,140,255,0.10)", border: `1px solid ${C.primary}55`, color: C.primary,
            padding: "8px 20px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
            letterSpacing: 0.04, transition: "transform .22s, background .22s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.background = "rgba(91,140,255,0.16)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.background = "rgba(91,140,255,0.10)"; }}
          >
            {showAll ? "Ver solo Top 5 ▲" : `Ver cola completa (${ordered.length}) ▼`}
          </button>
        </div>
      )}
    </Section>
  );
}


/* ═══════════════════ SHARED SECTION SHELL ═══════════════════ */
function Section({ title, subtitle, children, icon }: { title: string; subtitle?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface,
      backdropFilter: "blur(20px) saturate(140%)",
      border: `1px solid ${C.border}`, borderRadius: 22,
      overflow: "hidden",
      boxShadow: "0 0 40px rgba(34,91,255,0.06), inset 0 1px 0 rgba(255,255,255,0.03)",
      height: "100%", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        padding: "14px 18px",
        borderBottom: `1px solid ${C.divider}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {icon && (
          <div style={{
            width: 26, height: 26, borderRadius: 8,
            background: "linear-gradient(135deg, rgba(91,140,255,0.20), rgba(123,97,255,0.15))",
            border: "1px solid rgba(91,140,255,0.28)", color: "#8FB4FF",
            display: "grid", placeItems: "center",
          }}>{icon}</div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, letterSpacing: 0.02 }}>{title}</h3>
          {subtitle && <p style={{ fontSize: 10.5, color: C.textMuted, margin: "2px 0 0", letterSpacing: 0.04 }}>{subtitle}</p>}
        </div>
      </div>
      <div style={{ padding: 18, flex: 1 }}>{children}</div>
    </div>
  );
}

function Meta({ label, value, strong, mono, capitalize, span2 }: { label: string; value: string; strong?: boolean; mono?: boolean; capitalize?: boolean; span2?: boolean }) {
  return (
    <div style={{ gridColumn: span2 ? "1 / -1" : undefined, minWidth: 0 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: C.textMuted }}>{label}</div>
      <div style={{
        marginTop: 1,
        fontSize: 11.5,
        fontWeight: strong ? 600 : 500,
        color: strong ? C.text : C.textSec,
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : undefined,
        textTransform: capitalize ? "capitalize" : undefined,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</div>
    </div>
  );
}

