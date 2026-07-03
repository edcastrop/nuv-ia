/**
 * NUVIA Financial Calculator
 * FAB + Drawer lateral con matemática financiera de auditoría:
 *  - TVM (PV, FV, PMT, NPER, RATE) estilo HP-12C
 *  - Conversión de tasas (EA ↔ NM ↔ NA ↔ Periódica)
 *  - Amortización francesa (Pesos / UVR simplificada)
 *  - VPN / TIR con flujos de caja
 *  - Historial de últimos 20 cálculos en localStorage
 *
 * Visible sólo para director_financiero_qa, super_admin y admin.
 */
import { useEffect, useMemo, useState } from "react";
import { Calculator, X, History, Trash2, Copy, Sparkles } from "lucide-react";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";

type Tab = "tvm" | "tasas" | "amort" | "vpn" | "hist";

interface HistEntry {
  id: string;
  ts: number;
  tab: Tab;
  label: string;
  detail: string;
}

const HIST_KEY = "nuvia.finCalc.history";
const ALLOWED: AppRole[] = ["director_financiero_qa", "super_admin", "admin", "gerencia"];

const C = {
  navy: "#0B1220",
  navy2: "#111a2e",
  border: "rgba(148,163,184,0.18)",
  border2: "rgba(148,163,184,0.28)",
  text: "#E6ECFA",
  textDim: "#94A3B8",
  accent: "#84B98F",
  accent2: "#445DA3",
  danger: "#F87171",
};

function loadHist(): HistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIST_KEY);
    return raw ? (JSON.parse(raw) as HistEntry[]) : [];
  } catch {
    return [];
  }
}
function saveHist(h: HistEntry[]) {
  try {
    window.localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 20)));
  } catch { /* noop */ }
}

function fmtCOP(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
function fmtNum(n: number, d = 4): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-CO", { maximumFractionDigits: d });
}
function fmtPct(n: number, d = 4): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("es-CO", { maximumFractionDigits: d })} %`;
}

/* ================== MATH ================== */
// TVM convention: PV + PMT*a + FV*v^n = 0  (a = (1-(1+i)^-n)/i)
function tvmPV(rate: number, nper: number, pmt: number, fv: number): number {
  if (rate === 0) return -(pmt * nper + fv);
  const v = Math.pow(1 + rate, -nper);
  return -(pmt * (1 - v) / rate + fv * v);
}
function tvmFV(rate: number, nper: number, pmt: number, pv: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  const f = Math.pow(1 + rate, nper);
  return -(pv * f + pmt * (f - 1) / rate);
}
function tvmPMT(rate: number, nper: number, pv: number, fv: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  const f = Math.pow(1 + rate, nper);
  return -(pv * f + fv) * rate / (f - 1);
}
function tvmNPER(rate: number, pmt: number, pv: number, fv: number): number {
  if (rate === 0) return -(pv + fv) / pmt;
  const num = pmt - fv * rate;
  const den = pmt + pv * rate;
  if (num / den <= 0) return NaN;
  return Math.log(num / den) / Math.log(1 + rate);
}
function tvmRATE(nper: number, pmt: number, pv: number, fv: number): number {
  // Newton-Raphson
  let r = 0.01;
  for (let i = 0; i < 80; i++) {
    const f = Math.pow(1 + r, nper);
    const val = pv * f + pmt * (f - 1) / r + fv;
    const dv = pv * nper * Math.pow(1 + r, nper - 1)
      + pmt * (nper * Math.pow(1 + r, nper - 1) / r - (f - 1) / (r * r));
    const nr = r - val / dv;
    if (!Number.isFinite(nr)) return NaN;
    if (Math.abs(nr - r) < 1e-10) return nr;
    r = nr;
  }
  return r;
}

function npv(rate: number, flows: number[]): number {
  return flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}
function irr(flows: number[]): number {
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

/* ================== UI PRIMITIVES ================== */
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: `1px solid ${C.border2}`,
  background: "rgba(15,23,42,0.6)",
  color: C.text,
  fontSize: 13,
  fontVariantNumeric: "tabular-nums",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: C.textDim,
  marginBottom: 4,
  display: "block",
  fontWeight: 600,
};
const btnPrimary: React.CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(132,185,143,0.4)",
  background: "linear-gradient(135deg,#445DA3,#84B98F)",
  color: "#fff",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: "0.04em",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: `1px solid ${C.border2}`,
  background: "transparent",
  color: C.textDim,
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ResultBox({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${C.border2}`,
        background: "linear-gradient(135deg, rgba(68,93,163,0.15), rgba(132,185,143,0.10))",
      }}
    >
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textDim, fontWeight: 700 }}>
        {title}
      </div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800, color: C.accent, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {hint && <div style={{ marginTop: 4, fontSize: 11, color: C.textDim }}>{hint}</div>}
    </div>
  );
}

/* ================== TABS ================== */

function TvmPanel({ push }: { push: (e: Omit<HistEntry, "id" | "ts">) => void }) {
  const [solveFor, setSolveFor] = useState<"PV" | "FV" | "PMT" | "NPER" | "RATE">("PMT");
  const [pv, setPv] = useState("100000000");
  const [fv, setFv] = useState("0");
  const [pmt, setPmt] = useState("");
  const [nper, setNper] = useState("120");
  const [ratePct, setRatePct] = useState("14");
  const [rateBasis, setRateBasis] = useState<"ea" | "nm" | "periodica">("ea");
  const [freq, setFreq] = useState("12");

  const periodicRate = useMemo(() => {
    const r = parseFloat(ratePct) / 100;
    const m = parseFloat(freq) || 12;
    if (!Number.isFinite(r)) return NaN;
    if (rateBasis === "periodica") return r;
    if (rateBasis === "nm") return r / 12;
    return Math.pow(1 + r, 1 / m) - 1;
  }, [ratePct, rateBasis, freq]);

  const result = useMemo(() => {
    const _pv = parseFloat(pv) || 0;
    const _fv = parseFloat(fv) || 0;
    const _pmt = parseFloat(pmt) || 0;
    const _nper = parseFloat(nper) || 0;
    switch (solveFor) {
      case "PV": return tvmPV(periodicRate, _nper, _pmt, _fv);
      case "FV": return tvmFV(periodicRate, _nper, _pmt, _pv);
      case "PMT": return tvmPMT(periodicRate, _nper, _pv, _fv);
      case "NPER": return tvmNPER(periodicRate, _pmt, _pv, _fv);
      case "RATE": return tvmRATE(_nper, _pmt, _pv, _fv);
    }
  }, [solveFor, pv, fv, pmt, nper, periodicRate]);

  const isRate = solveFor === "RATE";
  const isNper = solveFor === "NPER";
  const isMoney = solveFor === "PV" || solveFor === "FV" || solveFor === "PMT";

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {(["PV", "FV", "PMT", "NPER", "RATE"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setSolveFor(k)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${solveFor === k ? "rgba(132,185,143,0.6)" : C.border2}`,
              background: solveFor === k ? "rgba(132,185,143,0.18)" : "transparent",
              color: solveFor === k ? C.accent : C.textDim,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.06em",
            }}
          >
            Calcular {k}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {solveFor !== "PV" && (
          <Field label="PV · Valor presente"><input style={inputStyle} value={pv} onChange={(e) => setPv(e.target.value)} /></Field>
        )}
        {solveFor !== "FV" && (
          <Field label="FV · Valor futuro"><input style={inputStyle} value={fv} onChange={(e) => setFv(e.target.value)} /></Field>
        )}
        {solveFor !== "PMT" && (
          <Field label="PMT · Cuota"><input style={inputStyle} value={pmt} onChange={(e) => setPmt(e.target.value)} /></Field>
        )}
        {solveFor !== "NPER" && (
          <Field label="NPER · Nº períodos"><input style={inputStyle} value={nper} onChange={(e) => setNper(e.target.value)} /></Field>
        )}
        {solveFor !== "RATE" && (
          <>
            <Field label="Tasa (%)"><input style={inputStyle} value={ratePct} onChange={(e) => setRatePct(e.target.value)} /></Field>
            <Field label="Base tasa">
              <select style={inputStyle as React.CSSProperties} value={rateBasis} onChange={(e) => setRateBasis(e.target.value as "ea" | "nm" | "periodica")}>
                <option value="ea">EA (Efectiva Anual)</option>
                <option value="nm">NM (Nominal Mensual)</option>
                <option value="periodica">Periódica directa</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Períodos/año"><input style={inputStyle} value={freq} onChange={(e) => setFreq(e.target.value)} /></Field>
      </div>

      <ResultBox
        title={`${solveFor} calculado`}
        value={
          isRate ? fmtPct(result, 4) :
          isNper ? `${fmtNum(result, 2)} períodos` :
          isMoney ? fmtCOP(Math.abs(result)) : fmtNum(result)
        }
        hint={
          isRate
            ? `Periódica · EA equivalente: ${fmtPct(Math.pow(1 + result, parseFloat(freq) || 12) - 1, 4)}`
            : `Tasa periódica utilizada: ${fmtPct(periodicRate, 6)}`
        }
      />

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          style={btnPrimary}
          onClick={() =>
            push({
              tab: "tvm",
              label: `TVM · ${solveFor}`,
              detail: `PV=${pv} FV=${fv} PMT=${pmt || "?"} NPER=${nper} i=${ratePct}% ${rateBasis.toUpperCase()} → ${solveFor}=${
                isRate ? fmtPct(result, 4) : isMoney ? fmtCOP(Math.abs(result)) : fmtNum(result, 2)
              }`,
            })
          }
        >
          Guardar en historial
        </button>
      </div>
    </div>
  );
}

function TasasPanel({ push }: { push: (e: Omit<HistEntry, "id" | "ts">) => void }) {
  const [inputPct, setInputPct] = useState("14");
  const [from, setFrom] = useState<"ea" | "nm" | "na" | "per">("ea");
  const [m, setM] = useState("12");

  const r = parseFloat(inputPct) / 100;
  const freq = parseFloat(m) || 12;

  const ea = useMemo(() => {
    if (!Number.isFinite(r)) return NaN;
    if (from === "ea") return r;
    if (from === "nm") return Math.pow(1 + r / 12, 12) - 1;
    if (from === "na") return r;
    return Math.pow(1 + r, freq) - 1;
  }, [r, from, freq]);

  const periodica = Math.pow(1 + ea, 1 / freq) - 1;
  const nm = periodica * 12 * (freq === 12 ? 1 : 1); // NM ≈ 12·i_mensual
  const iMensual = Math.pow(1 + ea, 1 / 12) - 1;
  const na = iMensual * 12;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Field label="Tasa origen (%)"><input style={inputStyle} value={inputPct} onChange={(e) => setInputPct(e.target.value)} /></Field>
        <Field label="Tipo origen">
          <select style={inputStyle} value={from} onChange={(e) => setFrom(e.target.value as typeof from)}>
            <option value="ea">EA</option>
            <option value="nm">NM (Nominal mensual)</option>
            <option value="na">NA (Nominal anual)</option>
            <option value="per">Periódica</option>
          </select>
        </Field>
        <Field label="Períodos/año (m)"><input style={inputStyle} value={m} onChange={(e) => setM(e.target.value)} /></Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
        <ResultBox title="EA · Efectiva Anual" value={fmtPct(ea, 4)} />
        <ResultBox title="Periódica (m definido)" value={fmtPct(periodica, 6)} hint={`m = ${freq}`} />
        <ResultBox title="Mensual efectiva" value={fmtPct(iMensual, 6)} />
        <ResultBox title="NA · Nominal anual" value={fmtPct(na, 4)} hint={`NM ≈ ${fmtPct(nm, 4)}`} />
      </div>

      <button
        style={{ ...btnPrimary, marginTop: 12 }}
        onClick={() =>
          push({
            tab: "tasas",
            label: `Conversión tasas · ${from.toUpperCase()} ${inputPct}%`,
            detail: `EA=${fmtPct(ea, 4)} · Mensual=${fmtPct(iMensual, 6)} · NA=${fmtPct(na, 4)}`,
          })
        }
      >
        Guardar en historial
      </button>
    </div>
  );
}

function AmortPanel({ push }: { push: (e: Omit<HistEntry, "id" | "ts">) => void }) {
  const [saldo, setSaldo] = useState("100000000");
  const [ea, setEa] = useState("14");
  const [nper, setNper] = useState("120");
  const [uvrDia, setUvrDia] = useState("");
  const [modo, setModo] = useState<"pesos" | "uvr">("pesos");

  const iMensual = Math.pow(1 + (parseFloat(ea) || 0) / 100, 1 / 12) - 1;
  const n = parseInt(nper) || 0;
  const pv = parseFloat(saldo) || 0;
  const uvr = parseFloat(uvrDia) || 0;

  const cuota = useMemo(() => Math.abs(tvmPMT(iMensual, n, pv, 0)), [iMensual, n, pv]);
  const totalPagado = cuota * n;
  const intereses = totalPagado - pv;
  const cuotaCOP = modo === "uvr" && uvr > 0 ? cuota * uvr : cuota;

  // Genera primeras 12 filas
  const filas = useMemo(() => {
    const rows: { k: number; cuota: number; interes: number; capital: number; saldo: number }[] = [];
    let s = pv;
    for (let k = 1; k <= Math.min(n, 12); k++) {
      const interes = s * iMensual;
      const capital = cuota - interes;
      s -= capital;
      rows.push({ k, cuota, interes, capital, saldo: Math.max(0, s) });
    }
    return rows;
  }, [pv, iMensual, n, cuota]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Modo">
          <select style={inputStyle} value={modo} onChange={(e) => setModo(e.target.value as "pesos" | "uvr")}>
            <option value="pesos">Pesos</option>
            <option value="uvr">UVR</option>
          </select>
        </Field>
        <Field label={modo === "uvr" ? "Saldo en UVR" : "Saldo (COP)"}><input style={inputStyle} value={saldo} onChange={(e) => setSaldo(e.target.value)} /></Field>
        <Field label="Tasa EA (%)"><input style={inputStyle} value={ea} onChange={(e) => setEa(e.target.value)} /></Field>
        <Field label="Plazo (meses)"><input style={inputStyle} value={nper} onChange={(e) => setNper(e.target.value)} /></Field>
        {modo === "uvr" && (
          <Field label="Valor UVR día"><input style={inputStyle} value={uvrDia} onChange={(e) => setUvrDia(e.target.value)} placeholder="ej. 380.15" /></Field>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 12 }}>
        <ResultBox title="Cuota" value={modo === "uvr" ? `${fmtNum(cuota, 4)} UVR` : fmtCOP(cuota)} hint={modo === "uvr" && uvr > 0 ? `≈ ${fmtCOP(cuotaCOP)}` : undefined} />
        <ResultBox title="Total pagado" value={modo === "uvr" ? `${fmtNum(totalPagado, 2)} UVR` : fmtCOP(totalPagado)} />
        <ResultBox title="Intereses" value={modo === "uvr" ? `${fmtNum(intereses, 2)} UVR` : fmtCOP(intereses)} />
      </div>

      <div style={{ marginTop: 14, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ padding: "8px 12px", fontSize: 10, letterSpacing: "0.1em", color: C.textDim, background: "rgba(255,255,255,0.02)", fontWeight: 700 }}>
          PRIMERAS 12 CUOTAS
        </div>
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["#", "Cuota", "Interés", "Capital", "Saldo"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "right", color: C.textDim, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.k} style={{ borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: "6px 8px", color: C.textDim, textAlign: "right" }}>{f.k}</td>
                  <td style={{ padding: "6px 8px", color: C.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(f.cuota, 0)}</td>
                  <td style={{ padding: "6px 8px", color: "#F4A261", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(f.interes, 0)}</td>
                  <td style={{ padding: "6px 8px", color: C.accent, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(f.capital, 0)}</td>
                  <td style={{ padding: "6px 8px", color: C.text, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtNum(f.saldo, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button
        style={{ ...btnPrimary, marginTop: 12 }}
        onClick={() =>
          push({
            tab: "amort",
            label: `Amort ${modo.toUpperCase()} · ${nper}m · ${ea}% EA`,
            detail: `Saldo ${saldo} → Cuota ${fmtNum(cuota, 2)} · Total ${fmtNum(totalPagado, 0)} · Intereses ${fmtNum(intereses, 0)}`,
          })
        }
      >
        Guardar en historial
      </button>
    </div>
  );
}

function VpnPanel({ push }: { push: (e: Omit<HistEntry, "id" | "ts">) => void }) {
  const [ratePct, setRatePct] = useState("12");
  const [flowsRaw, setFlowsRaw] = useState("-100000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000\n15000000");

  const flows = useMemo(
    () => flowsRaw.split(/[\n,;]+/).map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n)),
    [flowsRaw],
  );
  const r = (parseFloat(ratePct) || 0) / 100;
  const vpn = useMemo(() => npv(r, flows), [r, flows]);
  const tir = useMemo(() => irr(flows), [flows]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
        <Field label="Tasa descuento (% periódica)"><input style={inputStyle} value={ratePct} onChange={(e) => setRatePct(e.target.value)} /></Field>
        <Field label={`Flujos (uno por línea) · ${flows.length} valores`}>
          <textarea
            style={{ ...inputStyle, minHeight: 140, fontFamily: "ui-monospace, monospace" }}
            value={flowsRaw}
            onChange={(e) => setFlowsRaw(e.target.value)}
          />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
        <ResultBox title="VPN" value={fmtCOP(vpn)} hint={`Tasa ${fmtPct(r, 4)}`} />
        <ResultBox title="TIR" value={fmtPct(tir, 4)} hint="TIR periódica del flujo" />
      </div>

      <button
        style={{ ...btnPrimary, marginTop: 12 }}
        onClick={() =>
          push({
            tab: "vpn",
            label: `VPN/TIR · ${flows.length} flujos`,
            detail: `Tasa ${ratePct}% → VPN ${fmtCOP(vpn)} · TIR ${fmtPct(tir, 4)}`,
          })
        }
      >
        Guardar en historial
      </button>
    </div>
  );
}

function HistPanel({ items, clear }: { items: HistEntry[]; clear: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  if (items.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: C.textDim, fontSize: 13 }}>
        Aún no hay cálculos guardados.
        <br />
        Ejecuta un cálculo y presiona <strong>Guardar en historial</strong>.
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: C.textDim, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>
          {items.length} cálculo(s) recientes
        </span>
        <button style={btnGhost} onClick={clear}>
          <Trash2 size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Limpiar
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div key={it.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(15,23,42,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{it.label}</span>
              <button
                style={{ ...btnGhost, padding: "4px 8px", fontSize: 10 }}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${it.label} — ${it.detail}`);
                    setCopied(it.id);
                    setTimeout(() => setCopied(null), 1500);
                  } catch { /* noop */ }
                }}
              >
                <Copy size={11} style={{ marginRight: 3, verticalAlign: "middle" }} />
                {copied === it.id ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: C.text, fontVariantNumeric: "tabular-nums" }}>{it.detail}</div>
            <div style={{ marginTop: 4, fontSize: 10, color: C.textDim }}>{new Date(it.ts).toLocaleString("es-CO")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================== ROOT ================== */
export function FinancialCalculator() {
  const { roles } = useUserRole();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tvm");
  const [hist, setHist] = useState<HistEntry[]>([]);

  useEffect(() => setHist(loadHist()), []);

  // Ctrl+K / Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const allowed = roles.some((r) => ALLOWED.includes(r));
  if (!allowed) return null;

  const push = (e: Omit<HistEntry, "id" | "ts">) => {
    const entry: HistEntry = { ...e, id: crypto.randomUUID(), ts: Date.now() };
    const next = [entry, ...hist].slice(0, 20);
    setHist(next);
    saveHist(next);
    setTab("hist");
  };
  const clear = () => { setHist([]); saveHist([]); };

  const tabs: { id: Tab; label: string }[] = [
    { id: "tvm", label: "TVM" },
    { id: "tasas", label: "Tasas" },
    { id: "amort", label: "Amortización" },
    { id: "vpn", label: "VPN / TIR" },
    { id: "hist", label: `Historial (${hist.length})` },
  ];

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        title="Calculadora Financiera NUVIA (Ctrl+K)"
        style={{
          position: "fixed",
          right: 24,
          bottom: 96,
          zIndex: 9998,
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: "1px solid rgba(132,185,143,0.5)",
          background: "linear-gradient(135deg,#445DA3,#84B98F)",
          color: "#fff",
          cursor: "pointer",
          boxShadow: "0 12px 32px -8px rgba(132,185,143,0.55), 0 0 0 4px rgba(11,18,32,0.6)",
          display: open ? "none" : "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Calculator size={22} />
      </button>

      {/* Drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(3,7,18,0.55)", backdropFilter: "blur(3px)", zIndex: 9998 }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(460px, 100vw)",
              background: `linear-gradient(180deg, ${C.navy}, ${C.navy2})`,
              borderLeft: `1px solid ${C.border2}`,
              zIndex: 9999,
              color: C.text,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-20px 0 60px -10px rgba(0,0,0,0.55)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: C.accent, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700 }}>
                  <Sparkles size={11} /> NUVIA · Motor financiero
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>Calculadora Financiera</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ ...btnGhost, padding: 6 }} title="Cerrar (Esc)">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${tab === t.id ? "rgba(132,185,143,0.55)" : "transparent"}`,
                    background: tab === t.id ? "rgba(132,185,143,0.15)" : "transparent",
                    color: tab === t.id ? C.accent : C.textDim,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {t.id === "hist" && <History size={11} />}
                  {t.label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div style={{ padding: 16, overflowY: "auto", flex: 1 }}>
              {tab === "tvm" && <TvmPanel push={push} />}
              {tab === "tasas" && <TasasPanel push={push} />}
              {tab === "amort" && <AmortPanel push={push} />}
              {tab === "vpn" && <VpnPanel push={push} />}
              {tab === "hist" && <HistPanel items={hist} clear={clear} />}
            </div>

            <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.border}`, fontSize: 10, color: C.textDim, textAlign: "center", letterSpacing: "0.06em" }}>
              Atajo: <strong style={{ color: C.text }}>Ctrl/Cmd + K</strong> · Uso auditoría QA NUVIA
            </div>
          </aside>
        </>
      )}
    </>
  );
}

export default FinancialCalculator;
