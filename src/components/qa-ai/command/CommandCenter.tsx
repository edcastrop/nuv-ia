import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import {
  ShieldAlert, Gavel, RotateCcw, AlertTriangle, Coins, Timer,
  ArrowRight, FileSearch, Paperclip, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type CCRow = {
  id: string; expediente_id: string | null; analista_id: string | null;
  modalidad: string; qa_score: number; categoria: string; dictamen: string;
  ejecutado_at: string;
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
};
export const EMPTY_FILTERS: Filters = {
  analista: "", banco: "", producto: "", modalidad: "", moneda: "",
  estadoQa: "", nivel: "", rango: "30", scoreMin: "", criticos: false, fresh: false,
};

const C = {
  bg: "#060B17", surface1: "#0D1323", surface2: "#111A2E",
  border: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
  text: "#FFFFFF", textSec: "#A8B3CF", textMuted: "#6B7693",
  primary: "#5B8CFF", secondary: "#7B61FF",
  success: "#1FD286", warning: "#FFB547", danger: "#FF5D73", info: "#38BDF8",
};

const fCop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

function applyFilters(rows: CCRow[], f: Filters): CCRow[] {
  const since = f.rango ? Date.now() - Number(f.rango) * 86400000 : 0;
  const sm = Number(f.scoreMin) || 0;
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
    return true;
  });
}

export function CommandCenter(props: {
  rows: CCRow[]; bancos: CCBank[]; analistas: CCAnalista[]; topErrores: CCError[]; tendencia: CCTrend[]; prioridad: Record<string, number>;
}) {
  const [f, setF] = useState<Filters>(EMPTY_FILTERS);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);

  const bancosOpts = useMemo(() => [...new Set(props.rows.map((r) => r.banco).filter(Boolean))] as string[], [props.rows]);
  const productosOpts = useMemo(() => [...new Set(props.rows.map((r) => r.producto).filter(Boolean))] as string[], [props.rows]);
  const analistasOpts = useMemo(() => {
    const m = new Map<string, string>();
    props.rows.forEach((r) => { if (r.analista_id && r.analista_nombre) m.set(r.analista_id, r.analista_nombre); });
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [props.rows]);

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

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <FilterBar
        f={f} setF={setF}
        bancos={bancosOpts} productos={productosOpts} analistas={analistasOpts}
        onReset={() => { setF(EMPTY_FILTERS); setPriorityFilter(null); }}
      />

      <PriorityPanel counts={props.prioridad} active={priorityFilter} onPick={(k) => setPriorityFilter(priorityFilter === k ? null : k)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <BankHeatmap bancos={visibleBancos} onPick={(b) => setF((x) => ({ ...x, banco: x.banco === b ? "" : b }))} active={f.banco} />
        <AnalystRanking analistas={visibleAnalistas} onPick={(a) => setF((x) => ({ ...x, analista: x.analista === a ? "" : a }))} active={f.analista} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
        <QaHealthTrend data={props.tendencia} />
        <TopErrors errores={props.topErrores} />
      </div>

      <ReviewQueue rows={filtered} />
    </div>
  );
}

// ───────────── FILTER BAR ─────────────
function FilterBar({
  f, setF, bancos, productos, analistas, onReset,
}: {
  f: Filters; setF: (u: (x: Filters) => Filters) => void;
  bancos: string[]; productos: string[]; analistas: { id: string; nombre: string }[];
  onReset: () => void;
}) {
  const sel: React.CSSProperties = {
    background: C.surface2, color: C.text, border: `1px solid ${C.border}`,
    borderRadius: 8, padding: "7px 10px", fontSize: 12, minWidth: 120, outline: "none",
  };
  const chk: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec,
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer",
  };
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(13,19,35,0.85)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
      border: `1px solid ${C.border}`, borderRadius: 14, padding: 12,
      display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
    }}>
      <select style={sel} value={f.analista} onChange={(e) => setF((x) => ({ ...x, analista: e.target.value }))}>
        <option value="">Analista · todos</option>
        {analistas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
      </select>
      <select style={sel} value={f.banco} onChange={(e) => setF((x) => ({ ...x, banco: e.target.value }))}>
        <option value="">Banco · todos</option>
        {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
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
        <option value="">Moneda</option>
        <option value="pesos">Pesos</option>
        <option value="uvr">UVR</option>
      </select>
      <select style={sel} value={f.estadoQa} onChange={(e) => setF((x) => ({ ...x, estadoQa: e.target.value }))}>
        <option value="">Estado QA</option>
        <option value="aprobado">Aprobado</option>
        <option value="aprobado_obs">Con observaciones</option>
        <option value="requiere_revision">Requiere revisión</option>
        <option value="rechazado">Rechazado</option>
      </select>
      <select style={sel} value={f.rango} onChange={(e) => setF((x) => ({ ...x, rango: e.target.value }))}>
        <option value="7">Últimos 7 días</option>
        <option value="30">Últimos 30 días</option>
        <option value="90">Últimos 90 días</option>
        <option value="">Todo</option>
      </select>
      <input
        style={{ ...sel, minWidth: 90 }} placeholder="Score mín."
        value={f.scoreMin} onChange={(e) => setF((x) => ({ ...x, scoreMin: e.target.value.replace(/[^\d.]/g, "") }))}
      />
      <label style={chk}>
        <input type="checkbox" checked={f.criticos} onChange={(e) => setF((x) => ({ ...x, criticos: e.target.checked }))} />
        Críticos
      </label>
      <label style={chk}>
        <input type="checkbox" checked={f.fresh} onChange={(e) => setF((x) => ({ ...x, fresh: e.target.checked }))} />
        FRECH activo
      </label>
      <button onClick={onReset} style={{ marginLeft: "auto", background: "transparent", color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}>
        Limpiar filtros
      </button>
    </div>
  );
}

// ───────────── PRIORITY PANEL ─────────────
function PriorityPanel({ counts, active, onPick }: { counts: Record<string, number>; active: string | null; onPick: (k: string) => void }) {
  const cards = [
    { key: "bloqueados", label: "Casos bloqueados", value: counts.bloqueados ?? 0, color: C.danger, icon: <ShieldAlert size={16} /> },
    { key: "esperando", label: "Esperando dictamen", value: counts.esperandoDictamen ?? 0, color: C.primary, icon: <Gavel size={16} /> },
    { key: "devueltos", label: "Devueltos al analista", value: counts.devueltos ?? 0, color: C.warning, icon: <RotateCcw size={16} /> },
    { key: "alertas", label: "Alertas críticas abiertas", value: counts.alertasCriticas ?? 0, color: "#FF8A00", icon: <AlertTriangle size={16} /> },
    { key: "uvr", label: "UVR sin revisión", value: counts.uvrSinRevision ?? 0, color: C.secondary, icon: <Coins size={16} /> },
    { key: "sla", label: "Vencidos SLA", value: counts.slaVencidos ?? 0, color: C.textMuted, icon: <Timer size={16} /> },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, letterSpacing: 1.2, color: C.textSec, textTransform: "uppercase" }}>Requieren tu atención</h2>
        {active && <button onClick={() => onPick(active)} style={{ fontSize: 11, color: C.primary, background: "transparent", border: "none", cursor: "pointer" }}>Quitar filtro</button>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 12 }}>
        {cards.map((c) => {
          const isActive = active === c.key;
          return (
            <button key={c.key} onClick={() => onPick(c.key)} style={{
              textAlign: "left", cursor: "pointer",
              background: isActive ? `linear-gradient(135deg, ${c.color}22, ${C.surface1})` : C.surface1,
              border: `1px solid ${isActive ? c.color : C.border}`,
              borderRadius: 14, padding: 14, transition: "all 0.2s",
              boxShadow: isActive ? `0 0 0 1px ${c.color}55, 0 12px 32px -16px ${c.color}66` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: c.color, marginBottom: 8 }}>
                {c.icon}
                <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{c.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{c.value}</div>
              <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6 }}>Click para filtrar cola →</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── BANK HEATMAP ─────────────
function BankHeatmap({ bancos, onPick, active }: { bancos: CCBank[]; onPick: (b: string) => void; active: string }) {
  const tone = (r: string) => r === "alto" ? C.danger : r === "medio" ? C.warning : C.success;
  return (
    <Section title="Riesgo por banco" subtitle="Score promedio, % error y nivel de riesgo (ordenado por riesgo).">
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              {["Banco", "Casos", "Score", "% error", "Riesgo"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.textSec, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bancos.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>Sin datos en el rango.</td></tr>
            ) : bancos.map((b) => {
              const isActive = active === b.banco;
              return (
                <tr key={b.banco} onClick={() => onPick(b.banco)} style={{
                  cursor: "pointer", background: isActive ? "rgba(91,140,255,0.08)" : "transparent",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <td style={{ padding: "10px 12px", color: C.text, fontWeight: 500 }}>{b.banco}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{b.auditados}</td>
                  <td style={{ padding: "10px 12px", color: tone(b.riesgo), fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{b.promedio.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{b.pctError.toFixed(1)}%</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                      textTransform: "uppercase", letterSpacing: 0.8,
                      background: `${tone(b.riesgo)}22`, color: tone(b.riesgo), border: `1px solid ${tone(b.riesgo)}44`,
                    }}>{b.riesgo}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ───────────── ANALYST RANKING ─────────────
function AnalystRanking({ analistas, onPick, active }: { analistas: CCAnalista[]; onPick: (id: string) => void; active: string }) {
  const nivelLabel = (n: number) => n === 3 ? "Autónomo" : n === 2 ? "Semi autónomo" : "Supervisado";
  const nivelColor = (n: number) => n === 3 ? C.success : n === 2 ? C.info : C.warning;
  return (
    <Section title="Desempeño de analistas" subtitle="Precisión, score promedio y nivel de autonomía.">
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        <table style={{ width: "100%", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              {["Analista", "Casos", "Precisión", "Score", "Rech.", "Nivel"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: C.textSec, fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {analistas.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.textMuted }}>Sin analistas en el rango.</td></tr>
            ) : analistas.map((a) => {
              const isActive = a.id && active === a.id;
              return (
                <tr key={a.id ?? "none"} onClick={() => a.id && onPick(a.id)} style={{
                  cursor: a.id ? "pointer" : "default",
                  background: isActive ? "rgba(91,140,255,0.08)" : "transparent",
                  borderBottom: `1px solid ${C.border}`,
                }}>
                  <td style={{ padding: "10px 12px", color: C.text, fontWeight: 500 }}>{a.nombre}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{a.auditados}</td>
                  <td style={{ padding: "10px 12px", color: a.precision >= 90 ? C.success : a.precision >= 75 ? C.warning : C.danger, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{a.precision.toFixed(1)}%</td>
                  <td style={{ padding: "10px 12px", color: C.text, fontVariantNumeric: "tabular-nums" }}>{a.promedio.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px", color: C.danger, fontVariantNumeric: "tabular-nums" }}>{a.rech}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                      background: `${nivelColor(a.nivel)}22`, color: nivelColor(a.nivel), border: `1px solid ${nivelColor(a.nivel)}44`,
                    }}>N{a.nivel} · {nivelLabel(a.nivel)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ───────────── TOP ERRORS ─────────────
function TopErrors({ errores }: { errores: CCError[] }) {
  const max = Math.max(1, ...errores.map((e) => e.total));
  const labelMap: Record<string, string> = {
    cuota: "Cuota incorrecta", tasa_ea: "TEA inconsistente", saldo: "Saldo incorrecto",
    plazo: "Plazo incorrecto", capital: "Capital mal digitado", frech: "FRECH omitido",
    seguros: "Seguro omitido", producto: "Producto mal clasificado",
  };
  return (
    <Section title="Top inconsistencias" subtitle="Tipo, frecuencia, tendencia y gravedad (últimos 30 días).">
      <div style={{ display: "grid", gap: 10, padding: "4px 2px" }}>
        {errores.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 12, padding: 16, textAlign: "center" }}>Sin inconsistencias en el rango.</p>
        ) : errores.map((e) => {
          const tendencia = e.ultimos7 > e.total / 4 ? "up" : e.ultimos7 === 0 ? "down" : "flat";
          const TIcon = tendencia === "up" ? TrendingUp : tendencia === "down" ? TrendingDown : Minus;
          const tColor = tendencia === "up" ? C.danger : tendencia === "down" ? C.success : C.textMuted;
          return (
            <div key={e.tipo} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{labelMap[e.tipo] ?? e.tipo}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>
                    {e.criticas > 0 && (
                      <span style={{ padding: "2px 8px", borderRadius: 999, background: `${C.danger}22`, color: C.danger, border: `1px solid ${C.danger}44`, fontSize: 10 }}>
                        {e.criticas} crít.
                      </span>
                    )}
                    <TIcon size={12} color={tColor} /> {e.total}
                  </span>
                </div>
                <div style={{ height: 6, background: C.surface2, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(e.total / max) * 100}%`, background: `linear-gradient(90deg, ${C.primary}, ${C.secondary})` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ───────────── QA HEALTH TREND ─────────────
function QaHealthTrend({ data }: { data: CCTrend[] }) {
  return (
    <Section title="Salud operativa QA" subtitle="Score promedio, aprobaciones, observaciones, rechazos y críticos.">
      <div style={{ width: "100%", height: 280, padding: "8px 0" }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="fecha" tick={{ fill: C.textMuted, fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
            <YAxis tick={{ fill: C.textMuted, fontSize: 10 }} />
            <Tooltip
              contentStyle={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12 }}
              labelStyle={{ color: C.textSec }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: C.textSec }} />
            <Line type="monotone" dataKey="scoreProm" name="Score prom." stroke={C.primary} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="aprobados" name="Aprobados" stroke={C.success} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="observados" name="Observados" stroke={C.warning} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="rechazados" name="Rechazos" stroke={C.danger} strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="criticos" name="Críticos" stroke={C.secondary} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

// ───────────── REVIEW QUEUE ─────────────
function ReviewQueue({ rows }: { rows: CCRow[] }) {
  const score = (s: number) => s >= 95 ? C.success : s >= 85 ? C.warning : C.danger;
  const dictamen: Record<string, { label: string; color: string }> = {
    aprobado: { label: "APROBADO", color: C.success },
    aprobado_obs: { label: "APROB. C/OBS", color: C.warning },
    requiere_revision: { label: "REVISAR", color: C.info },
    rechazado: { label: "RECHAZADO", color: C.danger },
  };

  // Priority sorting: critico > bloqueado > menor score > antiguo > mayor ticket
  const ordered = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aCrit = a.alertas_criticas > 0 ? 1 : 0;
      const bCrit = b.alertas_criticas > 0 ? 1 : 0;
      if (aCrit !== bCrit) return bCrit - aCrit;
      const aBlock = a.dictamen === "rechazado" ? 1 : 0;
      const bBlock = b.dictamen === "rechazado" ? 1 : 0;
      if (aBlock !== bBlock) return bBlock - aBlock;
      if (a.qa_score !== b.qa_score) return a.qa_score - b.qa_score;
      const aT = new Date(a.ejecutado_at).getTime();
      const bT = new Date(b.ejecutado_at).getTime();
      if (aT !== bT) return aT - bT;
      return b.ticket - a.ticket;
    });
  }, [rows]);

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

  return (
    <Section title={`Cola de revisión (${ordered.length})`} subtitle="Orden inteligente: criticidad → bloqueo → score → antigüedad → ticket.">
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 12, minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.03)" }}>
              {["Prioridad", "Código", "Cliente", "Banco", "Analista", "Producto", "Modalidad", "Ticket", "Score", "Estado QA", "Riesgo", "Acciones"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "10px 12px", color: C.textSec, fontWeight: 500, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 ? (
              <tr><td colSpan={12} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>Sin casos en la cola.</td></tr>
            ) : ordered.map((r) => {
              const p = prioridad(r);
              const d = dictamen[r.dictamen] ?? { label: r.dictamen, color: C.textSec };
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                      background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}44`, whiteSpace: "nowrap",
                    }}>{p.label}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: C.textSec, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 10.5, whiteSpace: "nowrap" }}>
                    {(r as unknown as { codigo: string | null }).codigo ?? "—"}
                    {(r as unknown as { auditor_aprobado_at: string | null }).auditor_aprobado_at ? (
                      <span title="Aprobada por auditor" style={{ marginLeft: 6, color: C.success }}>✓</span>
                    ) : null}
                  </td>
                  <td style={{ padding: "10px 12px", color: C.text, fontWeight: 500 }}>{r.cliente_nombre ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: C.text }}>{r.banco ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec }}>{r.analista_nombre ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec }}>{r.producto ?? "—"}</td>
                  <td style={{ padding: "10px 12px", color: C.text, textTransform: "capitalize" }}>{r.modalidad}</td>
                  <td style={{ padding: "10px 12px", color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{r.ticket ? fCop(r.ticket) : "—"}</td>
                  <td style={{ padding: "10px 12px", color: score(r.qa_score), fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.qa_score.toFixed(1)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 600,
                      background: `${d.color}22`, color: d.color, border: `1px solid ${d.color}44`, whiteSpace: "nowrap",
                    }}>{d.label}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {r.alertas_criticas > 0 ? (
                      <span style={{ color: C.danger, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={12} /> {r.alertas_criticas}
                      </span>
                    ) : r.sla_vencido ? (
                      <span style={{ color: C.warning }}>SLA vencido</span>
                    ) : (
                      <span style={{ color: C.textMuted }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                      <Link to="/qa-ai/$id" params={{ id: r.id }} title="Ver dictamen" style={{
                        display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px",
                        borderRadius: 8, background: `${C.primary}1a`, color: C.primary,
                        border: `1px solid ${C.primary}44`, fontSize: 11, whiteSpace: "nowrap",
                      }}>Ver <ArrowRight size={11} /></Link>
                      <Link
                        to="/simulador" search={{ auditoriaId: r.id, modo: r.modalidad === "uvr" ? "uvr" : "pesos" } as never}
                        title="Reconstruir caso" style={{
                          display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px",
                          borderRadius: 8, background: `${C.secondary}1a`, color: C.secondary,
                          border: `1px solid ${C.secondary}44`, fontSize: 11, whiteSpace: "nowrap",
                        }}><FileSearch size={11} /> Reconstruir</Link>
                      {r.extracto_path && (
                        <button onClick={() => openExtracto(r.extracto_path!)} title="Abrir extracto" style={{
                          padding: "5px 8px", borderRadius: 8, background: "transparent",
                          color: C.textSec, border: `1px solid ${C.border}`, cursor: "pointer",
                        }}><Paperclip size={11} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ───────────── SHARED SHELL ─────────────
function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.surface1} 0%, ${C.bg} 140%)`,
      border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden",
      boxShadow: "0 12px 32px -20px rgba(0,0,0,0.6)",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}` }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0, letterSpacing: 0.2 }}>{title}</h3>
        {subtitle && <p style={{ fontSize: 11.5, color: C.textMuted, margin: "3px 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ padding: 14 }}>{children}</div>
    </div>
  );
}
