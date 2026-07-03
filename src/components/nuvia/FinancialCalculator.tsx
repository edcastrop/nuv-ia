/**
 * NUVIA · FinancialEngineModal
 *
 * Motor matemático premium con:
 *  - Layout 1200px, dos columnas 60/40
 *  - Holograma orbital con fórmula activa + variables orbitando
 *  - TVM (PV/FV/PMT/NPER/RATE), Tasas, Amortización, VPN/TIR, Historial
 *  - Glassmorphism deep navy + halos NUVIA (#445DA3, #84B98F)
 *  - Sin scroll vertical, alta densidad, resultado protagonista
 *
 * Se monta desde <FinancialCalculator /> como FAB global.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Calculator,
  X,
  History,
  Trash2,
  Copy,
  Sparkles,
  BrainCircuit,
  Save,
  FileDown,
  Zap,
  Command,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Minus,
  Briefcase,
  MessageSquarePlus,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

type Tab = "tvm" | "tasas" | "amort" | "vpn" | "hist";
type Solve = "PV" | "FV" | "PMT" | "NPER" | "RATE";

interface HistEntry {
  id: string;
  ts: number;
  tab: Tab;
  label: string;
  detail: string;
  result: string;
}

const HIST_KEY = "nuvia.finCalc.history";
const ALLOWED: AppRole[] = ["director_financiero_qa", "super_admin", "admin", "gerencia"];

// PALETA NUVEX
const N = {
  ink: "#0A0F1C",
  ink2: "#131a2b",
  ink3: "#0B1220",
  navy: "#242424",
  azul: "#445DA3",
  verde: "#84B98F",
  text: "#EDF1FA",
  textDim: "#8A9BC0",
  textFaint: "#5A6B8C",
  border: "rgba(148,163,184,0.15)",
  border2: "rgba(148,163,184,0.28)",
  glowAzul: "rgba(68,93,163,0.55)",
  glowVerde: "rgba(132,185,143,0.55)",
};

/* ============ STORAGE ============ */
function loadHist(): HistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HIST_KEY) ?? "[]") as HistEntry[];
  } catch { return []; }
}
function saveHist(h: HistEntry[]) {
  try { window.localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 40))); } catch { /* noop */ }
}

/* ============ FORMAT ============ */
const fmtCOP = (n: number) => Number.isFinite(n)
  ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n)
  : "—";
const fmtNum = (n: number, d = 4) => Number.isFinite(n)
  ? n.toLocaleString("es-CO", { maximumFractionDigits: d })
  : "—";
const fmtPct = (n: number, d = 4) => Number.isFinite(n)
  ? `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: d })} %`
  : "—";

/* ============ MATH ============ */
function tvmPV(r: number, n: number, pmt: number, fv: number) {
  if (r === 0) return -(pmt * n + fv);
  const v = Math.pow(1 + r, -n);
  return -(pmt * (1 - v) / r + fv * v);
}
function tvmFV(r: number, n: number, pmt: number, pv: number) {
  if (r === 0) return -(pv + pmt * n);
  const f = Math.pow(1 + r, n);
  return -(pv * f + pmt * (f - 1) / r);
}
function tvmPMT(r: number, n: number, pv: number, fv: number) {
  if (r === 0) return -(pv + fv) / n;
  const f = Math.pow(1 + r, n);
  return -(pv * f + fv) * r / (f - 1);
}
function tvmNPER(r: number, pmt: number, pv: number, fv: number) {
  if (r === 0) return -(pv + fv) / pmt;
  const num = pmt - fv * r;
  const den = pmt + pv * r;
  if (num / den <= 0) return NaN;
  return Math.log(num / den) / Math.log(1 + r);
}
function tvmRATE(n: number, pmt: number, pv: number, fv: number) {
  let r = 0.01;
  for (let i = 0; i < 80; i++) {
    const f = Math.pow(1 + r, n);
    const val = pv * f + pmt * (f - 1) / r + fv;
    const dv = pv * n * Math.pow(1 + r, n - 1)
      + pmt * (n * Math.pow(1 + r, n - 1) / r - (f - 1) / (r * r));
    const nr = r - val / dv;
    if (!Number.isFinite(nr)) return NaN;
    if (Math.abs(nr - r) < 1e-10) return nr;
    r = nr;
  }
  return r;
}
function npv(r: number, flows: number[]) {
  return flows.reduce((a, cf, t) => a + cf / Math.pow(1 + r, t), 0);
}
function irr(flows: number[]) {
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    let f = 0, df = 0;
    for (let t = 0; t < flows.length; t++) {
      f += flows[t] / Math.pow(1 + r, t);
      if (t > 0) df += -t * flows[t] / Math.pow(1 + r, t + 1);
    }
    const nr = r - f / df;
    if (!Number.isFinite(nr)) return NaN;
    if (Math.abs(nr - r) < 1e-9) return nr;
    r = nr;
  }
  return r;
}

/* ============ CSS-in-JS reusable ============ */
const inputCls: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 10,
  border: `1px solid ${N.border2}`,
  background: "rgba(9,14,26,0.65)",
  color: N.text,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  outline: "none",
  transition: "border-color .18s ease, box-shadow .18s ease, background .18s ease",
};
const labelCls: React.CSSProperties = {
  display: "block",
  fontSize: 9.5,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: N.textDim,
  fontWeight: 700,
  marginBottom: 5,
};
const helperCls: React.CSSProperties = {
  marginTop: 4,
  fontSize: 10,
  color: N.textFaint,
  fontStyle: "italic",
};

function Field({
  label, children, helper,
}: { label: string; children: React.ReactNode; helper?: string }) {
  return (
    <div>
      <label style={labelCls}>{label}</label>
      {children}
      {helper && <div style={helperCls}>{helper}</div>}
    </div>
  );
}

/* ============ HOLOGRAM CORE ============ */
function HologramCore({
  center,
  orbit,
  active,
}: {
  center: string;
  orbit: { key: string; label: string }[];
  active: boolean;
}) {
  // Genera 8 partículas fijas
  const particles = useMemo(
    () => Array.from({ length: 14 }).map((_, i) => ({
      x: (i * 73) % 100,
      y: (i * 41) % 100,
      d: 4 + (i % 5),
      delay: (i * 0.4) % 3,
    })),
    [],
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        maxWidth: 320,
        margin: "0 auto",
      }}
    >
      {/* Grid holográfico de fondo */}
      <svg
        viewBox="0 0 200 200"
        style={{ position: "absolute", inset: 0, opacity: 0.28 }}
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="fe-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={N.verde} stopOpacity="0.35" />
            <stop offset="60%" stopColor={N.azul} stopOpacity="0.18" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id="fe-line" x1="0" x2="1">
            <stop offset="0%" stopColor={N.azul} />
            <stop offset="100%" stopColor={N.verde} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#fe-glow)" />
        {Array.from({ length: 6 }).map((_, i) => (
          <circle key={i} cx="100" cy="100" r={16 + i * 14}
            fill="none" stroke={N.azul} strokeOpacity={0.15} strokeWidth="0.4" />
        ))}
        {[0, 45, 90, 135].map((deg) => (
          <line key={deg} x1="100" y1="10" x2="100" y2="190"
            stroke="url(#fe-line)" strokeOpacity="0.2" strokeWidth="0.4"
            transform={`rotate(${deg} 100 100)`} />
        ))}
      </svg>

      {/* Partículas */}
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 2.5, height: 2.5, borderRadius: "50%",
            background: i % 2 ? N.verde : N.azul,
            boxShadow: `0 0 8px ${i % 2 ? N.glowVerde : N.glowAzul}`,
            animation: `feFloat ${p.d}s ease-in-out ${p.delay}s infinite`,
            opacity: 0.7,
          }}
        />
      ))}

      {/* Órbita rotatoria */}
      <div
        style={{
          position: "absolute", inset: "10%",
          borderRadius: "50%",
          border: `1px dashed ${N.border2}`,
          animation: "feSpin 22s linear infinite",
        }}
      >
        {orbit.map((o, i) => {
          const angle = (i / orbit.length) * 360;
          const isActive = false;
          return (
            <div
              key={o.key}
              style={{
                position: "absolute",
                top: "50%", left: "50%",
                transform: `rotate(${angle}deg) translate(120px) rotate(-${angle}deg)`,
                marginLeft: -22, marginTop: -14,
                width: 44, height: 28,
                borderRadius: 8,
                background: "rgba(9,14,26,0.9)",
                border: `1px solid ${isActive ? N.verde : N.border2}`,
                boxShadow: `0 4px 14px -4px ${N.glowAzul}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                color: isActive ? N.verde : N.text,
                animation: "feSpinReverse 22s linear infinite",
              }}
            >
              {o.label}
            </div>
          );
        })}
      </div>

      {/* Núcleo */}
      <div
        style={{
          position: "absolute",
          inset: "32%",
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${N.verde}, ${N.azul} 55%, ${N.ink} 100%)`,
          boxShadow: `
            0 0 40px ${N.glowVerde},
            0 0 90px ${N.glowAzul},
            inset 0 0 30px rgba(255,255,255,0.12)
          `,
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: active ? "feBreathe 3.4s ease-in-out infinite" : "none",
          border: "1px solid rgba(255,255,255,0.14)",
        }}
      >
        <span
          style={{
            fontSize: 22, fontWeight: 900, color: "#fff",
            letterSpacing: "0.08em",
            textShadow: `0 0 18px ${N.glowVerde}`,
          }}
        >
          {center}
        </span>
      </div>
    </div>
  );
}

/* ============ RESULT CARD ============ */
function ResultCard({
  title, value, mini,
}: {
  title: string;
  value: string;
  mini?: { k: string; v: string }[];
}) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 16,
        borderRadius: 14,
        border: `1px solid ${N.border2}`,
        background: `
          linear-gradient(135deg, rgba(68,93,163,0.14), rgba(132,185,143,0.10)),
          rgba(11,18,32,0.7)
        `,
        boxShadow: `0 10px 40px -18px ${N.glowVerde}, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div style={{
        fontSize: 9.5, textTransform: "uppercase", letterSpacing: "0.16em",
        color: N.textDim, fontWeight: 800,
      }}>{title}</div>
      <div style={{
        marginTop: 6,
        fontSize: 26, fontWeight: 900,
        color: N.verde,
        fontVariantNumeric: "tabular-nums",
        textShadow: `0 0 20px ${N.glowVerde}`,
        letterSpacing: "-0.01em",
        lineHeight: 1.05,
      }}>{value}</div>

      {mini && mini.length > 0 && (
        <div style={{
          marginTop: 12,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}>
          {mini.map((m) => (
            <div key={m.k} style={{
              padding: "6px 8px",
              borderRadius: 8,
              background: "rgba(9,14,26,0.55)",
              border: `1px solid ${N.border}`,
            }}>
              <div style={{ fontSize: 9, color: N.textFaint, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{m.k}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: N.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============ INSIGHT ============ */
function InsightCard({ text }: { text: string }) {
  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid rgba(68,93,163,0.45)`,
        background: `linear-gradient(135deg, rgba(68,93,163,0.18), rgba(9,14,26,0.4))`,
        boxShadow: `0 0 24px -12px ${N.glowAzul}`,
        display: "flex", gap: 10, alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        borderRadius: 8,
        background: `linear-gradient(135deg, ${N.azul}, ${N.verde})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 12px ${N.glowAzul}`,
      }}>
        <BrainCircuit size={15} color="#fff" />
      </div>
      <div>
        <div style={{ fontSize: 9.5, letterSpacing: "0.14em", color: "#A5B5E0", textTransform: "uppercase", fontWeight: 800 }}>
          NUVIA IA sugiere
        </div>
        <div style={{ marginTop: 3, fontSize: 12, color: N.text, lineHeight: 1.45 }}>{text}</div>
      </div>
    </div>
  );
}

/* ============ TAB: TVM ============ */
interface TvmState {
  solve: Solve;
  pv: string; fv: string; pmt: string; nper: string;
  ratePct: string; basis: "ea" | "nm" | "periodica"; freq: string;
}
function TvmPanel({
  state, setState, onSave,
}: {
  state: TvmState;
  setState: (s: TvmState) => void;
  onSave: (label: string, detail: string, result: string) => void;
}) {
  const { solve, pv, fv, pmt, nper, ratePct, basis, freq } = state;
  const upd = <K extends keyof TvmState>(k: K, v: TvmState[K]) => setState({ ...state, [k]: v });

  const periodic = useMemo(() => {
    const r = parseFloat(ratePct) / 100;
    const m = parseFloat(freq) || 12;
    if (!Number.isFinite(r)) return NaN;
    if (basis === "periodica") return r;
    if (basis === "nm") return r / 12;
    return Math.pow(1 + r, 1 / m) - 1;
  }, [ratePct, basis, freq]);

  const result = useMemo(() => {
    const _pv = parseFloat(pv) || 0, _fv = parseFloat(fv) || 0;
    const _pmt = parseFloat(pmt) || 0, _n = parseFloat(nper) || 0;
    switch (solve) {
      case "PV":   return tvmPV(periodic, _n, _pmt, _fv);
      case "FV":   return tvmFV(periodic, _n, _pmt, _pv);
      case "PMT":  return tvmPMT(periodic, _n, _pv, _fv);
      case "NPER": return tvmNPER(periodic, _pmt, _pv, _fv);
      case "RATE": return tvmRATE(_n, _pmt, _pv, _fv);
    }
  }, [solve, pv, fv, pmt, nper, periodic]);

  const isRate = solve === "RATE";
  const isNper = solve === "NPER";
  const isMoney = solve === "PV" || solve === "FV" || solve === "PMT";
  const resultStr = isRate ? fmtPct(result, 4)
    : isNper ? `${fmtNum(result, 2)} períodos`
    : isMoney ? fmtCOP(Math.abs(result)) : fmtNum(result);

  const mensualEq = isRate
    ? fmtPct(result, 6)
    : fmtPct(periodic, 6);
  const eaEq = isRate
    ? fmtPct(Math.pow(1 + result, parseFloat(freq) || 12) - 1, 4)
    : fmtPct(Math.pow(1 + periodic, parseFloat(freq) || 12) - 1, 4);

  const helperTasa = Number.isFinite(periodic)
    ? `TEA ${ratePct}% ≈ ${fmtPct(periodic, 4)} periódica`
    : "Ingresa una tasa válida";

  const insight = useMemo(() => {
    if (solve === "PMT" && Number.isFinite(result)) {
      const c = Math.abs(result);
      const extra = c * 0.15;
      return `Con esta estructura, un abono extra de ${fmtCOP(extra)} mensual reduciría intereses de forma significativa.`;
    }
    if (solve === "NPER" && Number.isFinite(result)) {
      return `Se requieren ${fmtNum(result, 1)} períodos. Cada punto menos de tasa acorta el plazo entre 4-8 %.`;
    }
    return `Tasa periódica activa: ${fmtPct(periodic, 6)}. EA equivalente: ${eaEq}.`;
  }, [solve, result, periodic, eaEq]);

  return {
    center: solve,
    orbit: (["PV", "FV", "PMT", "NPER", "RATE"] as Solve[])
      .filter((k) => k !== solve).map((k) => ({ key: k, label: k })),
    result: resultStr,
    mini: [
      { k: "Tasa periódica", v: fmtPct(periodic, 6) },
      { k: "Mensual efectiva", v: mensualEq },
      { k: "EA equivalente", v: eaEq },
      { k: "Períodos/año", v: freq },
    ],
    insight,
    body: (
      <div>
        {/* Segmented control */}
        <div style={{
          display: "flex", gap: 4, padding: 4,
          borderRadius: 12,
          background: "rgba(9,14,26,0.55)",
          border: `1px solid ${N.border}`,
          marginBottom: 14,
        }}>
          {(["PV", "FV", "PMT", "NPER", "RATE"] as Solve[]).map((k) => {
            const on = solve === k;
            return (
              <button
                key={k}
                onClick={() => upd("solve", k)}
                style={{
                  flex: 1,
                  padding: "8px 4px",
                  borderRadius: 8,
                  border: "1px solid transparent",
                  background: on
                    ? `linear-gradient(135deg, rgba(132,185,143,0.28), rgba(68,93,163,0.22))`
                    : "transparent",
                  boxShadow: on ? `0 0 18px -4px ${N.glowVerde}, inset 0 0 0 1px rgba(132,185,143,0.55)` : "none",
                  color: on ? N.verde : N.textDim,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: "0.08em",
                  cursor: "pointer", transition: "all .18s ease",
                }}
              >{k}</button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {solve !== "PV" && (
            <Field label="Valor presente (PV)">
              <input style={inputCls} value={pv} onChange={(e) => upd("pv", e.target.value)} placeholder="100.000.000" />
            </Field>
          )}
          {solve !== "FV" && (
            <Field label="Valor futuro (FV)">
              <input style={inputCls} value={fv} onChange={(e) => upd("fv", e.target.value)} placeholder="0" />
            </Field>
          )}
          {solve !== "PMT" && (
            <Field label="Cuota (PMT)">
              <input style={inputCls} value={pmt} onChange={(e) => upd("pmt", e.target.value)} placeholder="ej. 1.500.000" />
            </Field>
          )}
          {solve !== "NPER" && (
            <Field label="Nº de períodos (NPER)">
              <input style={inputCls} value={nper} onChange={(e) => upd("nper", e.target.value)} placeholder="120" />
            </Field>
          )}
          {solve !== "RATE" && (
            <>
              <Field label="Tasa (%)" helper={helperTasa}>
                <input style={inputCls} value={ratePct} onChange={(e) => upd("ratePct", e.target.value)} placeholder="14" />
              </Field>
              <Field label="Base de tasa">
                <select style={inputCls} value={basis} onChange={(e) => upd("basis", e.target.value as TvmState["basis"])}>
                  <option value="ea">EA · Efectiva Anual</option>
                  <option value="nm">NM · Nominal Mensual</option>
                  <option value="periodica">Periódica directa</option>
                </select>
              </Field>
            </>
          )}
          <Field label="Períodos por año">
            <input style={inputCls} value={freq} onChange={(e) => upd("freq", e.target.value)} placeholder="12" />
          </Field>
        </div>

        <button
          onClick={() => onSave(
            `TVM · ${solve}`,
            `PV=${pv} · FV=${fv} · PMT=${pmt || "?"} · NPER=${nper} · i=${ratePct}% ${basis.toUpperCase()}`,
            resultStr,
          )}
          style={btnGhost}
        >
          <Save size={12} /> Guardar en historial
        </button>
      </div>
    ),
  };
}

/* ============ TAB: TASAS ============ */
function TasasPanel({
  ratePct, from, m, setRatePct, setFrom, setM, onSave,
}: {
  ratePct: string; from: "ea" | "nm" | "na" | "per"; m: string;
  setRatePct: (v: string) => void;
  setFrom: (v: "ea" | "nm" | "na" | "per") => void;
  setM: (v: string) => void;
  onSave: (l: string, d: string, r: string) => void;
}) {
  const r = parseFloat(ratePct) / 100;
  const freq = parseFloat(m) || 12;
  const ea = useMemo(() => {
    if (!Number.isFinite(r)) return NaN;
    if (from === "ea") return r;
    if (from === "nm") return Math.pow(1 + r / 12, 12) - 1;
    if (from === "na") return r;
    return Math.pow(1 + r, freq) - 1;
  }, [r, from, freq]);
  const iMens = Math.pow(1 + ea, 1 / 12) - 1;
  const periodica = Math.pow(1 + ea, 1 / freq) - 1;
  const na = iMens * 12;

  return {
    center: from.toUpperCase(),
    orbit: [
      { key: "ea", label: "EA" },
      { key: "nm", label: "NM" },
      { key: "na", label: "NA" },
      { key: "per", label: "Periódica" },
    ].filter((o) => o.key !== from),
    result: fmtPct(ea, 4),
    mini: [
      { k: "Mensual efectiva", v: fmtPct(iMens, 6) },
      { k: "Periódica (m)", v: fmtPct(periodica, 6) },
      { k: "Nominal anual", v: fmtPct(na, 4) },
      { k: "Períodos/año", v: String(freq) },
    ],
    insight: `Convertir a EA elimina ambigüedad. Toda comparación entre créditos debe hacerse sobre EA.`,
    body: (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Field label="Tasa origen (%)" helper={`EA equivalente: ${fmtPct(ea, 4)}`}>
            <input style={inputCls} value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
          </Field>
          <Field label="Tipo origen">
            <select style={inputCls} value={from} onChange={(e) => setFrom(e.target.value as typeof from)}>
              <option value="ea">EA · Efectiva Anual</option>
              <option value="nm">NM · Nominal Mensual</option>
              <option value="na">NA · Nominal Anual</option>
              <option value="per">Periódica</option>
            </select>
          </Field>
          <Field label="Períodos/año (m)">
            <input style={inputCls} value={m} onChange={(e) => setM(e.target.value)} />
          </Field>
        </div>

        <button
          onClick={() => onSave(
            `Conversión · ${from.toUpperCase()} ${ratePct}%`,
            `EA=${fmtPct(ea, 4)} · Mensual=${fmtPct(iMens, 6)} · NA=${fmtPct(na, 4)}`,
            fmtPct(ea, 4),
          )}
          style={btnGhost}
        >
          <Save size={12} /> Guardar en historial
        </button>
      </div>
    ),
  };
}

/* ============ TAB: AMORT ============ */
function AmortPanel({
  saldo, ea, nper, uvrDia, modo,
  setSaldo, setEa, setNper, setUvrDia, setModo, onSave,
}: {
  saldo: string; ea: string; nper: string; uvrDia: string; modo: "pesos" | "uvr";
  setSaldo: (v: string) => void; setEa: (v: string) => void; setNper: (v: string) => void;
  setUvrDia: (v: string) => void; setModo: (v: "pesos" | "uvr") => void;
  onSave: (l: string, d: string, r: string) => void;
}) {
  const iMens = Math.pow(1 + (parseFloat(ea) || 0) / 100, 1 / 12) - 1;
  const n = parseInt(nper) || 0;
  const pv = parseFloat(saldo) || 0;
  const uvr = parseFloat(uvrDia) || 0;
  const cuota = useMemo(() => Math.abs(tvmPMT(iMens, n, pv, 0)), [iMens, n, pv]);
  const total = cuota * n;
  const intereses = total - pv;
  const cuotaCOP = modo === "uvr" && uvr > 0 ? cuota * uvr : cuota;

  return {
    center: "AMORT",
    orbit: [
      { key: "pv", label: "PV" },
      { key: "i", label: "i" },
      { key: "n", label: "n" },
      { key: "pmt", label: "PMT" },
    ],
    result: modo === "uvr" ? `${fmtNum(cuota, 4)} UVR` : fmtCOP(cuota),
    mini: [
      { k: "Total pagado", v: modo === "uvr" ? `${fmtNum(total, 2)} UVR` : fmtCOP(total) },
      { k: "Intereses", v: modo === "uvr" ? `${fmtNum(intereses, 2)} UVR` : fmtCOP(intereses) },
      { k: "Cuota mensual", v: modo === "uvr" && uvr > 0 ? fmtCOP(cuotaCOP) : "—" },
      { k: "Períodos", v: `${n} meses` },
    ],
    insight: `Sobre ${fmtCOP(pv)} a ${ea}% EA por ${n} meses, los intereses representan ${
      pv > 0 ? ((intereses / pv) * 100).toFixed(1) : "0"
    }% del capital.`,
    body: (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Modo">
            <select style={inputCls} value={modo} onChange={(e) => setModo(e.target.value as "pesos" | "uvr")}>
              <option value="pesos">Pesos (COP)</option>
              <option value="uvr">UVR</option>
            </select>
          </Field>
          <Field label={modo === "uvr" ? "Saldo (UVR)" : "Saldo (COP)"}>
            <input style={inputCls} value={saldo} onChange={(e) => setSaldo(e.target.value)} />
          </Field>
          <Field label="Tasa EA (%)" helper={`Mensual efectiva ≈ ${fmtPct(iMens, 6)}`}>
            <input style={inputCls} value={ea} onChange={(e) => setEa(e.target.value)} />
          </Field>
          <Field label="Plazo (meses)">
            <input style={inputCls} value={nper} onChange={(e) => setNper(e.target.value)} />
          </Field>
          {modo === "uvr" && (
            <Field label="Valor UVR día" helper="Ej. 380.15">
              <input style={inputCls} value={uvrDia} onChange={(e) => setUvrDia(e.target.value)} />
            </Field>
          )}
        </div>

        <button
          onClick={() => onSave(
            `Amort ${modo.toUpperCase()} · ${nper}m · ${ea}% EA`,
            `Saldo ${saldo} → Cuota ${fmtNum(cuota, 2)} · Intereses ${fmtNum(intereses, 0)}`,
            modo === "uvr" ? `${fmtNum(cuota, 4)} UVR` : fmtCOP(cuota),
          )}
          style={btnGhost}
        >
          <Save size={12} /> Guardar en historial
        </button>
      </div>
    ),
  };
}

/* ============ TAB: VPN/TIR ============ */
function VpnPanel({
  ratePct, flowsRaw, setRatePct, setFlowsRaw, onSave,
}: {
  ratePct: string; flowsRaw: string;
  setRatePct: (v: string) => void; setFlowsRaw: (v: string) => void;
  onSave: (l: string, d: string, r: string) => void;
}) {
  const flows = useMemo(
    () => flowsRaw.split(/[\n,;]+/).map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n)),
    [flowsRaw],
  );
  const r = (parseFloat(ratePct) || 0) / 100;
  const vpn = useMemo(() => npv(r, flows), [r, flows]);
  const tir = useMemo(() => irr(flows), [flows]);

  return {
    center: "VPN",
    orbit: [
      { key: "cf0", label: "CF₀" },
      { key: "cf1", label: "CF₁" },
      { key: "cfn", label: "CFₙ" },
      { key: "tir", label: "TIR" },
    ],
    result: fmtCOP(vpn),
    mini: [
      { k: "TIR", v: fmtPct(tir, 4) },
      { k: "Tasa descuento", v: fmtPct(r, 4) },
      { k: "Nº flujos", v: String(flows.length) },
      { k: "Signo VPN", v: vpn >= 0 ? "Positivo ✓" : "Negativo ✗" },
    ],
    insight: vpn >= 0
      ? `VPN positivo (${fmtCOP(vpn)}). El proyecto crea valor. TIR ${fmtPct(tir, 3)} supera la tasa exigida.`
      : `VPN negativo. La TIR ${fmtPct(tir, 3)} está por debajo de la tasa exigida (${fmtPct(r, 3)}).`,
    body: (
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <Field label="Tasa descuento (%)" helper="Periódica del flujo">
            <input style={inputCls} value={ratePct} onChange={(e) => setRatePct(e.target.value)} />
          </Field>
          <Field label={`Flujos · ${flows.length} valores`} helper="Uno por línea. El primero suele ser negativo (inversión).">
            <textarea
              style={{ ...inputCls, minHeight: 130, fontFamily: "ui-monospace, monospace", resize: "vertical" }}
              value={flowsRaw}
              onChange={(e) => setFlowsRaw(e.target.value)}
            />
          </Field>
        </div>

        <button
          onClick={() => onSave(
            `VPN/TIR · ${flows.length} flujos`,
            `Tasa ${ratePct}% · TIR ${fmtPct(tir, 4)}`,
            fmtCOP(vpn),
          )}
          style={btnGhost}
        >
          <Save size={12} /> Guardar en historial
        </button>
      </div>
    ),
  };
}

/* ============ BOTONES ============ */
const btnPrimary: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(132,185,143,0.55)",
  background: `linear-gradient(135deg, ${N.azul}, ${N.verde})`,
  color: "#fff",
  fontSize: 12, fontWeight: 800, letterSpacing: "0.06em",
  cursor: "pointer",
  boxShadow: `0 8px 24px -8px ${N.glowVerde}`,
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnSecondary: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: `1px solid ${N.border2}`,
  background: "rgba(9,14,26,0.6)",
  color: N.text,
  fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
  cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const btnGhost: React.CSSProperties = {
  marginTop: 14,
  padding: "8px 12px",
  borderRadius: 9,
  border: `1px solid ${N.border2}`,
  background: "transparent",
  color: N.textDim,
  fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
  cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 6,
};

/* ============ CASE CONTEXT ============ */
type CaseCtx = {
  expedienteId: string;
  codigo: string | null;
  cliente: string | null;
  banco: string | null;
  numeroCredito: string | null;
  modo: string | null;
  analista: string | null;
  qaScore: number | null;
} | null;

function useCaseContext(): CaseCtx {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [ctx, setCtx] = useState<CaseCtx>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      // Match /casos/:id o /qa-ai/:id
      const mCaso = pathname.match(/^\/casos\/([0-9a-f-]{36})/i);
      const mQA = pathname.match(/^\/qa-ai\/([0-9a-f-]{36})/i);
      let expedienteId: string | null = null;
      if (mCaso) expedienteId = mCaso[1];
      else if (mQA) {
        // qa-ai/:auditoriaId → resolver expediente_id
        const { data: aud } = await supabase
          .from("qa_auditorias")
          .select("expediente_id")
          .eq("id", mQA[1])
          .maybeSingle();
        expedienteId = aud?.expediente_id ?? null;
      }
      if (!expedienteId) { if (!cancel) setCtx(null); return; }
      const { data: exp } = await supabase
        .from("expedientes")
        .select("id,codigo,cliente_nombre,banco,numero_credito,modo,asesor_id,qa_score")
        .eq("id", expedienteId)
        .maybeSingle();
      if (!exp) { if (!cancel) setCtx(null); return; }
      let analistaNombre: string | null = null;
      if (exp.asesor_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("nombre")
          .eq("id", exp.asesor_id)
          .maybeSingle();
        analistaNombre = p?.nombre ?? null;
      }
      if (cancel) return;
      setCtx({
        expedienteId: exp.id,
        codigo: exp.codigo ?? null,
        cliente: exp.cliente_nombre ?? null,
        banco: exp.banco ?? null,
        numeroCredito: exp.numero_credito ?? null,
        modo: exp.modo ?? null,
        analista: analistaNombre,
        qaScore: typeof exp.qa_score === "number" ? exp.qa_score : null,
      });
    }
    load();
    return () => { cancel = true; };
  }, [pathname]);
  return ctx;
}

/* ============ ROOT ============ */
type Mode = "closed" | "mini" | "panel" | "expanded";
const PIN_KEY = "nuvia.finCalc.pinned";

export function FinancialCalculator() {
  const { roles } = useUserRole();
  const [mode, setMode] = useState<Mode>("closed");
  const [pinned, setPinned] = useState(false);
  const [tab, setTab] = useState<Tab>("tvm");
  const [hist, setHist] = useState<HistEntry[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const caseCtx = useCaseContext();

  // TVM state persistente al cambiar de tab
  const [tvm, setTvm] = useState<TvmState>({
    solve: "PMT", pv: "100000000", fv: "0", pmt: "",
    nper: "120", ratePct: "14", basis: "ea", freq: "12",
  });
  // Tasas
  const [tasasRate, setTasasRate] = useState("14");
  const [tasasFrom, setTasasFrom] = useState<"ea" | "nm" | "na" | "per">("ea");
  const [tasasM, setTasasM] = useState("12");
  // Amort
  const [amSaldo, setAmSaldo] = useState("100000000");
  const [amEa, setAmEa] = useState("14");
  const [amNper, setAmNper] = useState("120");
  const [amUvr, setAmUvr] = useState("");
  const [amModo, setAmModo] = useState<"pesos" | "uvr">("pesos");
  // VPN
  const [vpnRate, setVpnRate] = useState("12");
  const [vpnFlows, setVpnFlows] = useState("-100000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000");

  useEffect(() => setHist(loadHist()), []);
  useEffect(() => {
    try {
      const p = window.localStorage.getItem(PIN_KEY);
      if (p === "1") { setPinned(true); setMode("panel"); }
    } catch { /* noop */ }
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMode((m) => (m === "closed" || m === "mini" ? "panel" : "closed"));
      }
      if (e.key === "Escape" && !pinned && mode === "expanded") setMode("panel");
      else if (e.key === "Escape" && !pinned) setMode("closed");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, mode]);

  const allowed = roles.some((r) => ALLOWED.includes(r));
  if (!allowed) return null;

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try { window.localStorage.setItem(PIN_KEY, next ? "1" : "0"); } catch { /* noop */ }
    if (next && mode === "closed") setMode("panel");
  };

  const pushHist = (label: string, detail: string, result: string) => {
    const entry: HistEntry = { id: crypto.randomUUID(), ts: Date.now(), tab, label, detail, result };
    const next = [entry, ...hist].slice(0, 40);
    setHist(next); saveHist(next);
  };

  const tvmView = TvmPanel({ state: tvm, setState: setTvm, onSave: pushHist });
  const tasasView = TasasPanel({
    ratePct: tasasRate, from: tasasFrom, m: tasasM,
    setRatePct: setTasasRate, setFrom: setTasasFrom, setM: setTasasM, onSave: pushHist,
  });
  const amortView = AmortPanel({
    saldo: amSaldo, ea: amEa, nper: amNper, uvrDia: amUvr, modo: amModo,
    setSaldo: setAmSaldo, setEa: setAmEa, setNper: setAmNper, setUvrDia: setAmUvr, setModo: setAmModo, onSave: pushHist,
  });
  const vpnView = VpnPanel({
    ratePct: vpnRate, flowsRaw: vpnFlows,
    setRatePct: setVpnRate, setFlowsRaw: setVpnFlows, onSave: pushHist,
  });

  const active = tab === "tvm" ? tvmView
    : tab === "tasas" ? tasasView
    : tab === "amort" ? amortView
    : tab === "vpn" ? vpnView
    : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "tvm", label: "TVM" },
    { id: "tasas", label: "Tasas" },
    { id: "amort", label: "Amort" },
    { id: "vpn", label: "VPN/TIR" },
    { id: "hist", label: `Hist·${hist.length}` },
  ];

  const copyResult = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(`${label} → ${value}`);
      setCopied("__toast");
      setTimeout(() => setCopied(null), 1500);
    } catch { /* noop */ }
  };

  const usarEnObservacionQA = () => {
    if (!active) return;
    const payload = {
      expedienteId: caseCtx?.expedienteId ?? null,
      tab, label: active.center, result: active.result,
      detail: (active.mini ?? []).map((m) => `${m.k}: ${m.v}`).join(" · "),
      insight: active.insight,
      ts: Date.now(),
    };
    try {
      window.dispatchEvent(new CustomEvent("nuvia:qa-observacion-append", { detail: payload }));
      // Fallback: dejar copiado en portapapeles como bloque de texto listo para pegar
      const bloque = `[NUVIA · ${tab.toUpperCase()}] ${active.center} = ${active.result}\n${payload.detail}\n→ ${active.insight}`;
      void navigator.clipboard.writeText(bloque);
      setCopied("__obs");
      setTimeout(() => setCopied(null), 1800);
    } catch { /* noop */ }
  };

  const guardarEnExpediente = () => {
    if (!active) return;
    pushHist(
      `${tab.toUpperCase()}${caseCtx?.codigo ? ` · ${caseCtx.codigo}` : ""}`,
      `${caseCtx?.cliente ?? "Sin caso"} · ${caseCtx?.banco ?? "-"} · ${active.result}`,
      active.result,
    );
    setCopied("__saved");
    setTimeout(() => setCopied(null), 1500);
  };

  /* ============ RENDER MODOS ============ */
  const globalStyles = (
    <style>{`
      @keyframes feSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes feSpinReverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      @keyframes feBreathe {
        0%, 100% { transform: scale(1); filter: brightness(1); }
        50% { transform: scale(1.06); filter: brightness(1.15); }
      }
      @keyframes feFloat {
        0%, 100% { transform: translate(0,0); opacity: 0.5; }
        50% { transform: translate(6px,-8px); opacity: 1; }
      }
      @keyframes feSlideIn {
        from { opacity: 0; transform: translateX(24px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes feFadeIn {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes feMiniPulse {
        0%, 100% { box-shadow: 0 14px 34px -8px ${N.glowVerde}, 0 0 0 4px rgba(11,18,32,0.6); }
        50% { box-shadow: 0 14px 34px -8px ${N.glowVerde}, 0 0 0 4px rgba(11,18,32,0.6), 0 0 40px ${N.glowAzul}; }
      }
      .fe-input:focus {
        border-color: rgba(132,185,143,0.7) !important;
        box-shadow: 0 0 0 3px rgba(132,185,143,0.12) !important;
        background: rgba(9,14,26,0.9) !important;
      }
    `}</style>
  );

  // ---------- FAB (modo mini) ----------
  const fab = (
    <button
      onClick={() => setMode("panel")}
      title="Calculadora Financiera NUVIA (Ctrl/⌘ + K)"
      aria-label="Abrir calculadora financiera"
      style={{
        position: "fixed", right: 24, bottom: 104, zIndex: 9998,
        height: 56, width: 56, padding: 0,
        borderRadius: "50%",
        border: "1px solid rgba(132,185,143,0.55)",
        background: `linear-gradient(135deg, ${N.azul}, ${N.verde})`,
        color: "#fff", cursor: "pointer",
        boxShadow: "0 10px 30px rgba(10,35,66,0.45), 0 0 0 4px rgba(132,185,143,0.12)",
        display: mode === "closed" || mode === "mini" ? "inline-flex" : "none",
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Calculator size={22} />
    </button>
  );


  // ---------- Header actions (pin / expand / min / close) ----------
  const headerActions = (
    <div style={{ display: "flex", gap: 6 }}>
      <button
        onClick={togglePin}
        title={pinned ? "Desfijar" : "Fijar panel"}
        style={miniBtn(pinned)}
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
      <button
        onClick={() => setMode(mode === "expanded" ? "panel" : "expanded")}
        title={mode === "expanded" ? "Contraer" : "Expandir"}
        style={miniBtn(false)}
      >
        {mode === "expanded" ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
      <button
        onClick={() => setMode("mini")}
        title="Minimizar"
        style={miniBtn(false)}
      >
        <Minus size={13} />
      </button>
      <button
        onClick={() => setMode("closed")}
        title="Cerrar"
        style={miniBtn(false)}
      >
        <X size={13} />
      </button>
    </div>
  );

  // ---------- Case context block ----------
  const caseBlock = (
    <div style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${caseCtx ? "rgba(132,185,143,0.35)" : N.border}`,
      background: caseCtx
        ? `linear-gradient(135deg, rgba(132,185,143,0.10), rgba(9,14,26,0.6))`
        : "rgba(9,14,26,0.4)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 9, letterSpacing: "0.18em", color: N.verde,
        textTransform: "uppercase", fontWeight: 800,
      }}>
        <Briefcase size={10} /> Contexto del caso
      </div>
      {caseCtx ? (
        <div style={{
          marginTop: 6, display: "grid",
          gridTemplateColumns: "1fr 1fr", gap: "4px 10px",
          fontSize: 11, color: N.text,
        }}>
          <CtxRow k="Código" v={caseCtx.codigo ?? "—"} />
          <CtxRow k="Modalidad" v={caseCtx.modo ?? "—"} />
          <CtxRow k="Cliente" v={caseCtx.cliente ?? "—"} full />
          <CtxRow k="Banco" v={caseCtx.banco ?? "—"} />
          <CtxRow k="Nº Crédito" v={caseCtx.numeroCredito ?? "—"} />
          <CtxRow k="Analista" v={caseCtx.analista ?? "—"} />
          <CtxRow k="QA Score" v={caseCtx.qaScore != null ? `${caseCtx.qaScore}` : "—"} />
        </div>
      ) : (
        <div style={{ marginTop: 4, fontSize: 11, color: N.textFaint }}>
          Sin expediente detectado — abre un caso o auditoría para vincular.
        </div>
      )}
    </div>
  );

  // ---------- Sticky result ----------
  const stickyResult = active && tab !== "hist" ? (
    <div style={{
      position: "sticky", top: 0, zIndex: 2,
      padding: "10px 12px",
      borderRadius: 12,
      border: `1px solid ${N.border2}`,
      background: `linear-gradient(135deg, rgba(68,93,163,0.16), rgba(132,185,143,0.10)), rgba(11,18,32,0.92)`,
      backdropFilter: "blur(8px)",
      boxShadow: `0 10px 34px -18px ${N.glowVerde}`,
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 9, letterSpacing: "0.18em", color: N.textDim,
          textTransform: "uppercase", fontWeight: 800,
        }}>
          {tab.toUpperCase()} · {active.center}
        </div>
        <div style={{
          fontSize: 20, fontWeight: 900, color: N.verde,
          textShadow: `0 0 20px ${N.glowVerde}`,
          fontVariantNumeric: "tabular-nums", lineHeight: 1.1,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{active.result}</div>
      </div>
      <button
        onClick={() => copyResult(`${tab.toUpperCase()} · ${active.center}`, active.result)}
        style={{ ...miniBtn(false), width: 30, height: 30, padding: 0 }}
        title="Copiar resultado"
      >
        <Copy size={14} />
      </button>
    </div>
  ) : null;

  // ---------- PANEL / DRAWER ----------
  const drawerWidth = mode === "expanded" ? "min(1200px, 96vw)" : "clamp(420px, 34vw, 480px)";

  const drawer = mode === "panel" || mode === "expanded" ? (
    <>
      {/* Backdrop solo en expanded o cuando no está pinneado */}
      {(mode === "expanded" || (!pinned && mode === "panel")) && (
        <div
          onClick={() => (pinned ? setMode("panel") : setMode("closed"))}
          style={{
            position: "fixed", inset: 0, zIndex: 9997,
            background: mode === "expanded" ? "rgba(3,6,15,0.72)" : "rgba(3,6,15,0.35)",
            backdropFilter: mode === "expanded" ? "blur(6px)" : "blur(2px)",
            pointerEvents: pinned && mode === "panel" ? "none" : "auto",
          }}
        />
      )}
      <aside
        role="dialog"
        aria-label="Calculadora Financiera NUVIA"
        style={{
          position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 9998,
          width: drawerWidth,
          borderLeft: `1px solid ${N.border2}`,
          background: `
            radial-gradient(circle at 90% 8%, rgba(132,185,143,0.10), transparent 45%),
            radial-gradient(circle at 10% 90%, rgba(68,93,163,0.14), transparent 45%),
            linear-gradient(180deg, ${N.ink}, ${N.ink3})
          `,
          boxShadow: `-40px 0 100px -20px rgba(0,0,0,0.6), 0 0 60px -20px ${N.glowAzul}`,
          display: "flex", flexDirection: "column",
          animation: "feSlideIn .28s ease-out",
        }}
      >
        {/* Grid sutil de fondo */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none",
          backgroundImage: `linear-gradient(${N.text} 1px, transparent 1px), linear-gradient(90deg, ${N.text} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }} />

        {/* Header compacto */}
        <div style={{
          position: "relative", padding: "14px 16px",
          borderBottom: `1px solid ${N.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontSize: 9, letterSpacing: "0.22em",
              color: N.verde, textTransform: "uppercase", fontWeight: 800,
            }}>
              <Sparkles size={10} /> NUVIA · Motor Financiero
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
              <h2 style={{
                margin: 0, fontSize: 16, fontWeight: 800,
                color: N.text, letterSpacing: "-0.01em",
              }}>Calculadora QA</h2>
              <span style={{
                fontSize: 9, letterSpacing: "0.14em", fontWeight: 800,
                padding: "2px 7px", borderRadius: 999,
                background: "rgba(132,185,143,0.14)",
                color: N.verde, border: "1px solid rgba(132,185,143,0.4)",
                textTransform: "uppercase",
              }}>Modo Auditoría</span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 11, color: N.textDim, lineHeight: 1.35 }}>
              Herramienta de apoyo para auditoría financiera del expediente.
            </p>
          </div>
          {headerActions}
        </div>

        {/* Body scroll */}
        <div style={{ position: "relative", flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {caseBlock}
          {stickyResult}

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 3, padding: 3,
            borderRadius: 10,
            background: "rgba(9,14,26,0.55)",
            border: `1px solid ${N.border}`,
          }}>
            {tabs.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1,
                    padding: "7px 4px",
                    borderRadius: 7,
                    border: "1px solid transparent",
                    background: on
                      ? `linear-gradient(135deg, rgba(68,93,163,0.32), rgba(68,93,163,0.18))`
                      : "transparent",
                    boxShadow: on ? `0 0 16px -6px ${N.glowAzul}, inset 0 0 0 1px rgba(68,93,163,0.5)` : "none",
                    color: on ? "#C6D4F5" : N.textDim,
                    fontSize: 10.5, fontWeight: 800, letterSpacing: "0.04em",
                    cursor: "pointer",
                    transition: "all .18s ease",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
                  }}
                >
                  {t.id === "hist" && <History size={10} />}
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div>
            {tab === "hist" ? (
              <HistTimeline items={hist} onClear={() => { setHist([]); saveHist([]); }} copied={copied} setCopied={setCopied} />
            ) : (
              <>
                {mode === "expanded" && active && (
                  <div style={{ marginBottom: 14 }}>
                    <HologramCore center={active.center} orbit={active.orbit} active />
                  </div>
                )}
                {active?.body}
                {active && (
                  <>
                    <ResultCard title="Resultado detallado" value={active.result} mini={active.mini} />
                    <InsightCard text={active.insight} />
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer sticky */}
        <div style={{
          padding: "10px 12px",
          borderTop: `1px solid ${N.border}`,
          background: "rgba(9,14,26,0.7)",
          backdropFilter: "blur(6px)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button style={btnSecondaryCompact} onClick={usarEnObservacionQA} disabled={!active}>
              <MessageSquarePlus size={12} /> {copied === "__obs" ? "¡Listo!" : "Usar en observación QA"}
            </button>
            <button style={btnSecondaryCompact} onClick={guardarEnExpediente} disabled={!active}>
              <Save size={12} /> {copied === "__saved" ? "Guardado" : "Guardar cálculo"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{
              display: "flex", gap: 6, alignItems: "center",
              fontSize: 9.5, color: N.textFaint, letterSpacing: "0.06em",
            }}>
              <Command size={10} /> <span><strong style={{ color: N.text }}>Ctrl/⌘ + K</strong></span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                style={{ ...btnSecondaryCompact, width: 30, height: 30, padding: 0 }}
                onClick={() => active && copyResult(`${tab.toUpperCase()} · ${active.center}`, active.result)}
                disabled={!active}
                title="Copiar resultado"
              >
                <Copy size={14} />
              </button>
              <button
                style={btnSecondaryCompact}
                onClick={() => window.print()}
                title="Exportar (usar Guardar como PDF)"
              >
                <FileDown size={12} /> PDF
              </button>
              <button
                style={{ ...btnPrimary, padding: "8px 12px", fontSize: 11 }}
                onClick={() => active && copyResult(`${tab.toUpperCase()} · ${active.center}`, active.result)}
                disabled={!active}
              >
                <Zap size={12} /> Usar
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  ) : null;

  return (
    <>
      {globalStyles}
      {fab}
      {drawer}
    </>
  );
}

/* ============ helpers UI drawer ============ */
function miniBtn(active: boolean): React.CSSProperties {
  return {
    width: 30, height: 30,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 8,
    border: `1px solid ${active ? "rgba(132,185,143,0.6)" : N.border2}`,
    background: active
      ? "rgba(132,185,143,0.14)"
      : "rgba(9,14,26,0.6)",
    color: active ? N.verde : N.text,
    cursor: "pointer",
    transition: "all .15s ease",
  };
}
const btnSecondaryCompact: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${N.border2}`,
  background: "rgba(9,14,26,0.6)",
  color: N.text,
  fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
  cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
};
function CtxRow({ k, v, full }: { k: string; v: string; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined, minWidth: 0 }}>
      <div style={{
        fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.12em",
        color: N.textFaint, fontWeight: 700,
      }}>{k}</div>
      <div style={{
        fontSize: 11.5, color: N.text, fontWeight: 700,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{v}</div>
    </div>
  );
}

/* ============ HIST TIMELINE ============ */
function HistTimeline({
  items, onClear, copied, setCopied,
}: {
  items: HistEntry[];
  onClear: () => void;
  copied: string | null;
  setCopied: (s: string | null) => void;
}) {
  if (items.length === 0) {
    return (
      <div style={{
        padding: 40, textAlign: "center", color: N.textDim, fontSize: 13,
        border: `1px dashed ${N.border2}`, borderRadius: 14, background: "rgba(9,14,26,0.35)",
      }}>
        Aún no hay cálculos.
        <br />
        <span style={{ fontSize: 11, color: N.textFaint }}>Ejecuta uno y pulsa <strong>Guardar</strong>.</span>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 10, color: N.textDim, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: 800 }}>
          Timeline · {items.length} cálculos
        </span>
        <button onClick={onClear} style={{ ...btnGhost, marginTop: 0 }}>
          <Trash2 size={12} /> Limpiar
        </button>
      </div>
      <div style={{ position: "relative", paddingLeft: 18 }}>
        {/* Línea vertical */}
        <div style={{
          position: "absolute", left: 6, top: 4, bottom: 4, width: 2,
          background: `linear-gradient(180deg, ${N.azul}, ${N.verde})`,
          opacity: 0.4, borderRadius: 2,
        }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <div key={it.id} style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: -18, top: 14, width: 12, height: 12,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${N.verde}, ${N.azul})`,
                boxShadow: `0 0 10px ${N.glowVerde}`,
                border: "2px solid rgba(9,14,26,0.9)",
              }} />
              <div style={{
                padding: 11,
                borderRadius: 11,
                border: `1px solid ${N.border}`,
                background: "rgba(9,14,26,0.55)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: N.verde }}>{it.label}</span>
                  <span style={{ fontSize: 10, color: N.textFaint }}>{new Date(it.ts).toLocaleString("es-CO")}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: N.text, fontVariantNumeric: "tabular-nums" }}>{it.detail}</div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: N.text }}>{it.result}</span>
                  <button
                    style={{ ...btnGhost, marginTop: 0, padding: 0, width: 26, height: 26 }}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${it.label} — ${it.detail} → ${it.result}`);
                        setCopied(it.id);
                        setTimeout(() => setCopied(null), 1500);
                      } catch { /* noop */ }
                    }}
                    title="Copiar resultado"
                  >
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FinancialCalculator;
