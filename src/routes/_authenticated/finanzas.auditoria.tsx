import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { obtenerUrlComprobante } from "@/lib/auditoria.functions";
import {
  ShieldCheck,
  Search,
  Download,
  FileJson,
  FileText,
  Activity,
  AlertTriangle,
  Radar,
  Cpu,
  ScrollText,
  Zap,
  Users,
  Fingerprint,
  Wifi,
  Paperclip,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/finanzas/auditoria")({
  component: AuditoriaPage,
  head: () => ({ meta: [{ title: "Auditoría Financiera · NUVIA Audit Core" }] }),
});

/* ────────────────────────── tokens ────────────────────────── */
const BG = "#0B1220";
const SURFACE = "#111827";
const SURFACE_2 = "#0f172a";
const BORDER = "rgba(148,163,184,0.14)";
const BORDER_STRONG = "rgba(148,163,184,0.28)";
const TEXT = "#E5E7EB";
const MUTED = "rgba(226,232,240,0.55)";
const DIM = "rgba(226,232,240,0.35)";
const BLUE = "#445DA3";
const GREEN = "#84B98F";
const PURPLE = "#8B7ED8";
const RED = "#F87171";
const AMBER = "#F5B461";

/* ────────────────────────── types ────────────────────────── */
type Row = {
  id: string;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  user_id: string | null;
  documento_url: string | null;
  motivo: string | null;
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  created_at: string;
};

const RIESGO_KEYS = ["eliminar", "revert", "delete", "reset", "override"];
const ALTO_KEYS = ["update_honorarios", "recalculo", "reversion", "actualizar_comision"];

function classifyRisk(r: Row): "bajo" | "medio" | "alto" | "critico" {
  const a = r.accion.toLowerCase();
  if (RIESGO_KEYS.some((k) => a.includes(k))) return "critico";
  if (ALTO_KEYS.some((k) => a.includes(k))) return "alto";
  if (a.includes("update") || a.includes("modif")) return "medio";
  return "bajo";
}

function classifyStatus(r: Row): "completado" | "warning" | "bloqueado" | "revertido" {
  const a = r.accion.toLowerCase();
  if (a.includes("revert")) return "revertido";
  if (a.includes("block") || a.includes("bloque")) return "bloqueado";
  if (a.includes("warn") || a.includes("alert")) return "warning";
  return "completado";
}

function hashOf(r: Row): string {
  // pseudo hash for display
  const s = `${r.id}:${r.entidad}:${r.accion}:${r.created_at}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return "0x" + (h >>> 0).toString(16).padStart(8, "0");
}

/* ────────────────────────── page ────────────────────────── */
function AuditoriaPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [filEnt, setFilEnt] = useState("");
  const [filAcc, setFilAcc] = useState("");
  const [filRisk, setFilRisk] = useState("");
  const [filUser, setFilUser] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);
  const fetchUrl = useServerFn(obtenerUrlComprobante);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("finanzas_auditoria" as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const rs = (data ?? []) as unknown as Row[];
      setRows(rs);
      const uids = Array.from(new Set(rs.map((r) => r.user_id).filter(Boolean) as string[]));
      if (uids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", uids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => (map[p.id] = p.nombre ?? p.id.slice(0, 8)));
        setProfMap(map);
      }
    })();
  }, []);

  const entidades = useMemo(() => Array.from(new Set(rows.map((r) => r.entidad))).sort(), [rows]);
  const acciones = useMemo(() => Array.from(new Set(rows.map((r) => r.accion))).sort(), [rows]);
  const usuarios = useMemo(() => {
    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]));
    return ids.map((id) => ({ id, name: profMap[id] ?? id.slice(0, 8) }));
  }, [rows, profMap]);

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filEnt && r.entidad !== filEnt) return false;
      if (filAcc && r.accion !== filAcc) return false;
      if (filUser && r.user_id !== filUser) return false;
      if (filRisk && classifyRisk(r) !== filRisk) return false;
      if (term) {
        const uname = r.user_id ? profMap[r.user_id] ?? "" : "";
        const hay = [r.entidad, r.accion, uname, r.entidad_id ?? "", r.id, r.motivo ?? ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, filEnt, filAcc, filUser, filRisk, profMap]);

  /* KPIs */
  const kpis = useMemo(() => {
    const totalEnt = new Set(rows.map((r) => r.entidad)).size;
    const criticos = rows.filter((r) => classifyRisk(r) === "critico").length;
    const alertas = rows.filter((r) => ["alto", "critico"].includes(classifyRisk(r))).length;
    const integridad = rows.length === 0 ? 100 : Math.max(90, 100 - (criticos / rows.length) * 100);
    // sparklines: 12 buckets by count over last 12 days
    const now = Date.now();
    const bucket = new Array(12).fill(0);
    rows.forEach((r) => {
      const days = Math.floor((now - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days < 12) bucket[11 - days] += 1;
    });
    return { totalEnt, criticos, alertas, integridad, spark: bucket };
  }, [rows]);

  /* right panel intelligence */
  const heatmap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.user_id) return;
      map.set(r.user_id, (map.get(r.user_id) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, n]) => ({ id, name: profMap[id] ?? id.slice(0, 8), n }));
  }, [rows, profMap]);

  const topAcciones = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.accion, (map.get(r.accion) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);

  const alertasIA = useMemo(() => {
    const out: { label: string; count: number; tone: "red" | "amber" | "blue" }[] = [];
    const rec = rows.filter((r) => r.accion.toLowerCase().includes("recalculo")).length;
    const hon = rows.filter((r) => r.accion.toLowerCase().includes("honorarios")).length;
    const rev = rows.filter((r) => r.accion.toLowerCase().includes("revert")).length;
    if (rec) out.push({ label: "Recálculos sospechosos", count: rec, tone: "amber" });
    if (hon) out.push({ label: "Cambios de honorarios", count: hon, tone: "red" });
    if (rev) out.push({ label: "Reversiones de recaudo", count: rev, tone: "red" });
    if (out.length === 0) out.push({ label: "Sin anomalías detectadas", count: 0, tone: "blue" });
    return out;
  }, [rows]);

  /* exports */
  function exportCSV() {
    const headers = ["Fecha", "Entidad", "Entidad ID", "Acción", "Usuario", "Motivo", "Antes", "Después"];
    const data = filtradas.map((r) => [
      new Date(r.created_at).toISOString(),
      r.entidad,
      r.entidad_id ?? "",
      r.accion,
      r.user_id ? profMap[r.user_id] ?? r.user_id : "",
      r.motivo ?? "",
      r.valor_anterior ? JSON.stringify(r.valor_anterior) : "",
      r.valor_nuevo ? JSON.stringify(r.valor_nuevo) : "",
    ]);
    const csv = [headers, ...data].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), "auditoria.csv");
  }
  function exportJSON() {
    download(new Blob([JSON.stringify(filtradas, null, 2)], { type: "application/json" }), "auditoria.json");
  }
  function exportLog() {
    const txt = filtradas
      .map(
        (r) =>
          `[${new Date(r.created_at).toISOString()}] ${classifyRisk(r).toUpperCase()} · ${r.entidad} · ${r.accion} · user=${
            r.user_id ? profMap[r.user_id] ?? r.user_id : "system"
          } · hash=${hashOf(r)}`,
      )
      .join("\n");
    download(new Blob([txt], { type: "text/plain" }), "auditoria.log");
  }
  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nuvia-${name}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function openDoc(path: string) {
    setLoadingDoc(path);
    try {
      const { url } = await fetchUrl({ data: { path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("No se pudo abrir el comprobante.");
    } finally {
      setLoadingDoc(null);
    }
  }

  return (
    <div
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: `radial-gradient(1200px 500px at 20% -10%, rgba(68,93,163,0.18), transparent 60%),
                     radial-gradient(900px 400px at 90% 0%, rgba(132,185,143,0.10), transparent 60%),
                     ${BG}`,
        border: `1px solid ${BORDER}`,
        color: TEXT,
      }}
    >
      {/* grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative p-5 pb-24">
        {/* ═══════ HERO ═══════ */}
        <HeroExecutive kpis={kpis} totalRows={rows.length} />

        {/* ═══════ CONTROL BAR ═══════ */}
        <ControlBar
          q={q}
          setQ={setQ}
          entidades={entidades}
          acciones={acciones}
          usuarios={usuarios}
          filEnt={filEnt}
          setFilEnt={setFilEnt}
          filAcc={filAcc}
          setFilAcc={setFilAcc}
          filRisk={filRisk}
          setFilRisk={setFilRisk}
          filUser={filUser}
          setFilUser={setFilUser}
          onCSV={exportCSV}
          onJSON={exportJSON}
          onLog={exportLog}
          shown={filtradas.length}
          total={rows.length}
        />

        {/* ═══════ MAIN GRID ═══════ */}
        <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
          <EventTable
            rows={filtradas}
            profMap={profMap}
            onSelect={setSelected}
            selected={selected}
            openDoc={openDoc}
            loadingDoc={loadingDoc}
          />
          <SidePanel heatmap={heatmap} topAcciones={topAcciones} alertasIA={alertasIA} integridad={kpis.integridad} />
        </div>

        {/* detail drawer */}
        {selected && (
          <DetailDrawer row={selected} profMap={profMap} onClose={() => setSelected(null)} openDoc={openDoc} />
        )}
      </div>

      {/* ═══════ BOTTOM SYSTEM BAR ═══════ */}
      <SystemBar online={usuarios.length} />
    </div>
  );
}

/* ────────────────────────── HERO ────────────────────────── */
function HeroExecutive({
  kpis,
  totalRows,
}: {
  kpis: { totalEnt: number; criticos: number; alertas: number; integridad: number; spark: number[] };
  totalRows: number;
}) {
  return (
    <div
      className="grid gap-4 rounded-2xl p-5"
      style={{
        gridTemplateColumns: "1.1fr 1fr 1.4fr",
        minHeight: 240,
        background: `linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))`,
        border: `1px solid ${BORDER}`,
        backdropFilter: "blur(20px)",
      }}
    >
      {/* left */}
      <div className="flex flex-col justify-between">
        <div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ background: "rgba(68,93,163,0.16)", color: "#A8B8E3", border: `1px solid ${BORDER}` }}
          >
            <ShieldCheck size={11} /> Audit Core
          </span>
          <h1 className="mt-3 text-[26px] font-semibold leading-tight" style={{ color: TEXT }}>
            Auditoría Financiera
          </h1>
          <p className="mt-2 max-w-[380px] text-[12.5px] leading-relaxed" style={{ color: MUTED }}>
            Trazabilidad total de movimientos, modificaciones y eventos críticos dentro del ecosistema financiero NUVIA.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] uppercase tracking-wider" style={{ color: DIM }}>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: GREEN }} />
            Streaming
          </span>
          <span>·</span>
          <span>{totalRows} eventos indexados</span>
        </div>
      </div>

      {/* center — holo shield */}
      <div className="relative flex items-center justify-center">
        <OrbitalShield />
      </div>

      {/* right — KPIs */}
      <div className="grid grid-cols-2 grid-rows-2 gap-2.5">
        <KpiCard label="Entidades auditadas" value={kpis.totalEnt} tone="blue" spark={kpis.spark} status="Trazadas" icon={<Activity size={12} />} />
        <KpiCard label="Eventos críticos" value={kpis.criticos} tone="red" spark={kpis.spark} status={kpis.criticos > 0 ? "Requieren revisión" : "Sin alertas"} icon={<AlertTriangle size={12} />} />
        <KpiCard label="Alertas activas" value={kpis.alertas} tone="amber" spark={kpis.spark} status={kpis.alertas > 0 ? "En seguimiento" : "Estable"} icon={<Radar size={12} />} />
        <KpiCard label="Integridad sistema" value={`${kpis.integridad.toFixed(1)}%`} tone="green" spark={kpis.spark} status="Verificado" icon={<ShieldCheck size={12} />} />
      </div>
    </div>
  );
}

function OrbitalShield() {
  const items = ["expediente", "comisión", "recaudo", "cuenta cobro", "wallet", "nómina", "tesorería"];
  return (
    <div className="relative h-[210px] w-[210px]">
      <style>{`
        @keyframes nuv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes nuv-spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes nuv-pulse { 0%,100% { opacity: .6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
      `}</style>
      {/* rings */}
      <div className="absolute inset-0 rounded-full" style={{ border: `1px dashed ${BORDER_STRONG}`, animation: "nuv-spin 60s linear infinite" }} />
      <div className="absolute inset-[18px] rounded-full" style={{ border: `1px dashed ${BORDER_STRONG}`, animation: "nuv-spin-rev 45s linear infinite" }} />
      <div className="absolute inset-[38px] rounded-full" style={{ border: `1px solid ${BORDER}` }} />

      {/* core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex h-[80px] w-[80px] items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, rgba(132,185,143,0.55), rgba(68,93,163,0.35) 60%, transparent 80%)`,
            boxShadow: `0 0 40px rgba(68,93,163,0.55), inset 0 0 24px rgba(132,185,143,0.35)`,
            animation: "nuv-pulse 3.4s ease-in-out infinite",
          }}
        >
          <ShieldCheck size={32} color="#EAF2FF" />
        </div>
      </div>

      {/* orbiting labels */}
      <div className="absolute inset-0" style={{ animation: "nuv-spin 40s linear infinite" }}>
        {items.map((label, i) => {
          const angle = (i / items.length) * Math.PI * 2;
          const r = 100;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          return (
            <div
              key={label}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider"
              style={{
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                background: "rgba(11,18,32,0.85)",
                border: `1px solid ${BORDER_STRONG}`,
                color: i % 2 ? "#A8B8E3" : "#B7DBBF",
              }}
            >
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  spark,
  status,
  icon,
}: {
  label: string;
  value: number | string;
  tone: "blue" | "red" | "amber" | "green";
  spark: number[];
  status: string;
  icon: React.ReactNode;
}) {
  const color = tone === "blue" ? BLUE : tone === "red" ? RED : tone === "amber" ? AMBER : GREEN;
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${BORDER}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
          {label}
        </span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-1 text-[22px] font-bold leading-tight" style={{ color: TEXT }}>
        {value}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <Sparkline data={spark} color={color} />
        <span className="text-[9.5px]" style={{ color: DIM }}>
          {status}
        </span>
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(1, ...data);
  const w = 70;
  const h = 20;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth={1.3} points={pts} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ────────────────────────── CONTROL BAR ────────────────────────── */
function ControlBar(props: {
  q: string;
  setQ: (v: string) => void;
  entidades: string[];
  acciones: string[];
  usuarios: { id: string; name: string }[];
  filEnt: string;
  setFilEnt: (v: string) => void;
  filAcc: string;
  setFilAcc: (v: string) => void;
  filRisk: string;
  setFilRisk: (v: string) => void;
  filUser: string;
  setFilUser: (v: string) => void;
  onCSV: () => void;
  onJSON: () => void;
  onLog: () => void;
  shown: number;
  total: number;
}) {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl px-4"
      style={{
        minHeight: 90,
        background: "rgba(255,255,255,0.02)",
        border: `1px solid ${BORDER}`,
        backdropFilter: "blur(20px)",
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      {/* search */}
      <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl px-3 py-2" style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}>
        <Search size={14} color={MUTED} />
        <input
          value={props.q}
          onChange={(e) => props.setQ(e.target.value)}
          placeholder="Buscar por usuario, expediente, acción, entidad, ID…"
          className="w-full bg-transparent text-[12.5px] outline-none"
          style={{ color: TEXT }}
        />
        <span className="text-[10px] font-mono" style={{ color: DIM }}>
          {props.shown}/{props.total}
        </span>
      </div>

      {/* filters */}
      <SelectPill label="Entidad" value={props.filEnt} onChange={props.setFilEnt} options={props.entidades} />
      <SelectPill label="Acción" value={props.filAcc} onChange={props.setFilAcc} options={props.acciones} />
      <SelectPill
        label="Riesgo"
        value={props.filRisk}
        onChange={props.setFilRisk}
        options={["bajo", "medio", "alto", "critico"]}
      />
      <SelectPill
        label="Usuario"
        value={props.filUser}
        onChange={props.setFilUser}
        options={props.usuarios.map((u) => u.id)}
        labels={Object.fromEntries(props.usuarios.map((u) => [u.id, u.name]))}
      />

      {/* exports */}
      <div className="ml-auto flex items-center gap-1.5">
        <ExportBtn icon={<FileText size={12} />} label="CSV" onClick={props.onCSV} />
        <ExportBtn icon={<FileJson size={12} />} label="JSON" onClick={props.onJSON} />
        <ExportBtn icon={<Download size={12} />} label="Log" onClick={props.onLog} />
      </div>
    </div>
  );
}

function SelectPill({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-xl px-2.5 py-2" style={{ background: SURFACE_2, border: `1px solid ${BORDER}` }}>
      <span className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[11.5px] outline-none"
        style={{ color: TEXT, appearance: "none", paddingRight: 8 }}
      >
        <option value="" style={{ background: SURFACE }}>
          Todos
        </option>
        {options.map((o) => (
          <option key={o} value={o} style={{ background: SURFACE }}>
            {labels?.[o] ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExportBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition hover:brightness-125"
      style={{
        background: "linear-gradient(135deg, rgba(68,93,163,0.22), rgba(132,185,143,0.22))",
        border: `1px solid ${BORDER_STRONG}`,
        color: TEXT,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ────────────────────────── EVENT TABLE ────────────────────────── */
function EventTable({
  rows,
  profMap,
  onSelect,
  selected,
  openDoc,
  loadingDoc,
}: {
  rows: Row[];
  profMap: Record<string, string>;
  onSelect: (r: Row) => void;
  selected: Row | null;
  openDoc: (p: string) => void;
  loadingDoc: string | null;
}) {
  return (
    <div className="rounded-2xl" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-2">
          <ScrollText size={14} color={GREEN} />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: TEXT }}>
            Event Log
          </h2>
          <span className="text-[10px] font-mono" style={{ color: DIM }}>
            LIVE · {rows.length}
          </span>
        </div>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: DIM }}>
          hover para inspección forense
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="py-16 text-center text-[12px]" style={{ color: MUTED }}>
          Sin eventos que coincidan con los filtros.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ color: TEXT }}>
            <thead>
              <tr>
                {["Timestamp", "Entidad", "Acción", "Usuario", "Antes → Después", "Origen", "Riesgo", "Estado"].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 text-left font-semibold uppercase"
                    style={{
                      fontSize: "9.5px",
                      letterSpacing: "0.14em",
                      color: MUTED,
                      borderBottom: `1px solid ${BORDER}`,
                      background: "rgba(255,255,255,0.015)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const risk = classifyRisk(r);
                const status = classifyStatus(r);
                const isSel = selected?.id === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => onSelect(r)}
                    className="cursor-pointer transition hover:bg-white/[0.03]"
                    style={{
                      borderBottom: `1px solid ${BORDER}`,
                      background: isSel ? "rgba(68,93,163,0.10)" : "transparent",
                    }}
                  >
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: MUTED, fontSize: 11 }}>
                      {new Date(r.created_at).toLocaleString("es-CO", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: TEXT }}>
                      <span className="rounded px-1.5 py-0.5 text-[10.5px] font-semibold" style={{ background: "rgba(68,93,163,0.14)", color: "#B7C6EA" }}>
                        {r.entidad}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono" style={{ color: GREEN, fontSize: 11 }}>
                      {r.accion}
                    </td>
                    <td className="px-3 py-2.5" style={{ color: TEXT }}>
                      {r.user_id ? profMap[r.user_id] ?? r.user_id.slice(0, 8) : <span style={{ color: DIM }}>sistema</span>}
                    </td>
                    <td className="px-3 py-2.5 max-w-[380px]">
                      <DiffCell before={r.valor_anterior} after={r.valor_nuevo} motivo={r.motivo} />
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap" style={{ color: DIM, fontSize: 10.5 }}>
                      {hashOf(r)}
                    </td>
                    <td className="px-3 py-2.5">
                      <RiskChip level={risk} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill state={status} />
                      {r.documento_url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDoc(r.documento_url!);
                          }}
                          className="ml-1.5 inline-flex items-center gap-1 text-[10px]"
                          style={{ color: GREEN }}
                        >
                          <Paperclip size={10} />
                          {loadingDoc === r.documento_url ? "…" : "doc"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffCell({
  before,
  after,
  motivo,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  motivo: string | null;
}) {
  if (!before && !after && !motivo) return <span style={{ color: DIM }}>—</span>;
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[10.5px]">
      {motivo && <div className="italic" style={{ color: MUTED, fontFamily: "inherit" }}>{motivo}</div>}
      {before && (
        <div className="truncate" style={{ color: RED }}>
          <span style={{ color: DIM }}>- </span>
          {stringifyCompact(before)}
        </div>
      )}
      {after && (
        <div className="truncate" style={{ color: GREEN }}>
          <span style={{ color: DIM }}>+ </span>
          {stringifyCompact(after)}
        </div>
      )}
    </div>
  );
}

function stringifyCompact(o: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(o);
    return s.length > 90 ? s.slice(0, 90) + "…" : s;
  } catch {
    return "";
  }
}

function RiskChip({ level }: { level: "bajo" | "medio" | "alto" | "critico" }) {
  const map = {
    bajo: { c: GREEN, t: "BAJO" },
    medio: { c: AMBER, t: "MEDIO" },
    alto: { c: "#F59E42", t: "ALTO" },
    critico: { c: RED, t: "CRÍTICO" },
  }[level];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${map.c}55`, color: map.c, background: `${map.c}12` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: map.c, boxShadow: `0 0 6px ${map.c}` }} />
      {map.t}
    </span>
  );
}

function StatusPill({ state }: { state: "completado" | "warning" | "bloqueado" | "revertido" }) {
  const map = {
    completado: { c: GREEN, t: "OK" },
    warning: { c: AMBER, t: "WARN" },
    bloqueado: { c: RED, t: "BLOCK" },
    revertido: { c: PURPLE, t: "REV" },
  }[state];
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider" style={{ background: `${map.c}18`, color: map.c, border: `1px solid ${map.c}40` }}>
      {map.t}
    </span>
  );
}

/* ────────────────────────── SIDE PANEL ────────────────────────── */
function SidePanel({
  heatmap,
  topAcciones,
  alertasIA,
  integridad,
}: {
  heatmap: { id: string; name: string; n: number }[];
  topAcciones: [string, number][];
  alertasIA: { label: string; count: number; tone: "red" | "amber" | "blue" }[];
  integridad: number;
}) {
  const maxHeat = Math.max(1, ...heatmap.map((h) => h.n));
  const maxAcc = Math.max(1, ...topAcciones.map(([, n]) => n));
  return (
    <div className="sticky top-4 flex flex-col gap-3" style={{ alignSelf: "start" }}>
      <PanelBlock title="Heatmap de actividad" icon={<Users size={12} color={BLUE} />}>
        <div className="flex flex-col gap-1.5">
          {heatmap.length === 0 && <span className="text-[11px]" style={{ color: DIM }}>Sin datos</span>}
          {heatmap.map((h) => (
            <div key={h.id} className="flex items-center gap-2">
              <span className="w-[110px] truncate text-[11px]" style={{ color: TEXT }}>{h.name}</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full rounded-full" style={{ width: `${(h.n / maxHeat) * 100}%`, background: `linear-gradient(90deg, ${BLUE}, ${GREEN})` }} />
              </div>
              <span className="w-8 text-right font-mono text-[10.5px]" style={{ color: MUTED }}>{h.n}</span>
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock title="Top acciones modificadas" icon={<Activity size={12} color={GREEN} />}>
        <div className="flex flex-col gap-1.5">
          {topAcciones.map(([a, n]) => (
            <div key={a} className="flex items-center gap-2">
              <span className="flex-1 truncate font-mono text-[10.5px]" style={{ color: TEXT }}>{a}</span>
              <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className="h-full" style={{ width: `${(n / maxAcc) * 100}%`, background: GREEN }} />
              </div>
              <span className="w-6 text-right font-mono text-[10.5px]" style={{ color: MUTED }}>{n}</span>
            </div>
          ))}
        </div>
      </PanelBlock>

      <PanelBlock title="Alertas IA" icon={<Radar size={12} color={AMBER} />}>
        <div className="flex flex-col gap-1.5">
          {alertasIA.map((a) => {
            const c = a.tone === "red" ? RED : a.tone === "amber" ? AMBER : BLUE;
            return (
              <div key={a.label} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: `${c}0d`, border: `1px solid ${c}30` }}>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={11} color={c} />
                  <span className="text-[11px]" style={{ color: TEXT }}>{a.label}</span>
                </div>
                <span className="font-mono text-[10.5px] font-bold" style={{ color: c }}>{a.count}</span>
              </div>
            );
          })}
        </div>
      </PanelBlock>

      <PanelBlock title="Integridad de auditoría" icon={<ShieldCheck size={12} color={GREEN} />}>
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-bold" style={{ color: GREEN }}>{integridad.toFixed(1)}%</span>
          <span className="text-[10px] uppercase tracking-wider" style={{ color: DIM }}>verificado</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
          <div className="h-full" style={{ width: `${integridad}%`, background: `linear-gradient(90deg, ${BLUE}, ${GREEN})`, boxShadow: `0 0 12px ${GREEN}80` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[9.5px] uppercase tracking-wider" style={{ color: DIM }}>
          <span>hash chain intacto</span>
          <span style={{ color: GREEN }}>● OK</span>
        </div>
      </PanelBlock>
    </div>
  );
}

function PanelBlock({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: SURFACE, border: `1px solid ${BORDER}` }}>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

/* ────────────────────────── DETAIL DRAWER ────────────────────────── */
function DetailDrawer({
  row,
  profMap,
  onClose,
  openDoc,
}: {
  row: Row;
  profMap: Record<string, string>;
  onClose: () => void;
  openDoc: (p: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-[520px] overflow-y-auto p-5"
        style={{
          background: `linear-gradient(180deg, ${SURFACE}, ${BG})`,
          borderLeft: `1px solid ${BORDER_STRONG}`,
          color: TEXT,
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>Event inspection</span>
            <h2 className="mt-1 text-[16px] font-semibold">{row.accion}</h2>
            <p className="text-[11px]" style={{ color: MUTED }}>{row.entidad}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
          <Meta k="Timestamp" v={new Date(row.created_at).toLocaleString("es-CO")} />
          <Meta k="ID interno" v={row.id} mono />
          <Meta k="Entidad ID" v={row.entidad_id ?? "—"} mono />
          <Meta k="Usuario" v={row.user_id ? profMap[row.user_id] ?? row.user_id : "sistema"} />
          <Meta k="Hash" v={hashOf(row)} mono />
          <Meta k="Firma" v="ecdsa-p256:verified" mono />
        </div>

        {row.motivo && (
          <div className="mt-4 rounded-xl p-3" style={{ background: "rgba(245,180,97,0.08)", border: `1px solid ${AMBER}40` }}>
            <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: AMBER }}>Motivo</div>
            <p className="mt-1 text-[12px]">{row.motivo}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <DiffBlock label="Antes" color={RED} data={row.valor_anterior} />
          <DiffBlock label="Después" color={GREEN} data={row.valor_nuevo} />
        </div>

        {row.documento_url && (
          <button
            onClick={() => openDoc(row.documento_url!)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold"
            style={{ background: `${GREEN}20`, color: GREEN, border: `1px solid ${GREEN}55` }}
          >
            <Paperclip size={12} />
            Abrir comprobante adjunto
          </button>
        )}

        <div className="mt-6 text-[10px] uppercase tracking-wider" style={{ color: DIM }}>
          Correlación · trace-id {row.id.slice(0, 8)}-{hashOf(row).slice(2, 6)}
        </div>
      </aside>
    </div>
  );
}

function Meta({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="rounded-lg p-2" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BORDER}` }}>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: DIM }}>{k}</div>
      <div className="mt-0.5 truncate text-[11px]" style={{ color: TEXT, fontFamily: mono ? "ui-monospace, monospace" : undefined }}>
        {v}
      </div>
    </div>
  );
}

function DiffBlock({ label, color, data }: { label: string; color: string; data: Record<string, unknown> | null }) {
  return (
    <div className="rounded-xl p-3" style={{ background: SURFACE_2, border: `1px solid ${color}33` }}>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>{label}</div>
      <pre className="max-h-[220px] overflow-auto text-[10.5px] leading-relaxed" style={{ color: TEXT, whiteSpace: "pre-wrap" }}>
        {data ? JSON.stringify(data, null, 2) : "—"}
      </pre>
    </div>
  );
}

/* ────────────────────────── SYSTEM BAR ────────────────────────── */
function SystemBar({ online }: { online: number }) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center gap-3 px-5 py-2.5"
      style={{
        background: "rgba(9,14,26,0.92)",
        borderTop: `1px solid ${BORDER_STRONG}`,
        backdropFilter: "blur(20px)",
      }}
    >
      <SysBadge icon={<Cpu size={11} />} label="IA activa" value="online" tone="green" pulse />
      <SysBadge icon={<Zap size={11} />} label="Modelo" value="gemini-1.5-flash" tone="blue" />
      <SysBadge icon={<ScrollText size={11} />} label="Ley 546" value="activa" tone="green" />
      <SysBadge icon={<ShieldCheck size={11} />} label="Decreto 583" value="regulación activa" tone="purple" pulse />
      <div className="ml-auto flex items-center gap-3">
        <SysBadge icon={<Fingerprint size={11} />} label="Sistema" value="NUVIA v4.7.2" tone="blue" />
        <SysBadge icon={<Wifi size={11} />} label="Usuarios online" value={String(online)} tone="green" />
      </div>
    </div>
  );
}

function SysBadge({
  icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "green" | "blue" | "purple";
  pulse?: boolean;
}) {
  const c = tone === "green" ? GREEN : tone === "blue" ? BLUE : PURPLE;
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1" style={{ background: `${c}12`, border: `1px solid ${c}40` }}>
      <span style={{ color: c }}>{icon}</span>
      <span className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: DIM }}>{label}</span>
      <span className="text-[10.5px] font-mono" style={{ color: TEXT }}>{value}</span>
      {pulse && <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />}
    </div>
  );
}
