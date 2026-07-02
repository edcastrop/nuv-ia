import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { PageLayout } from "@/components/nuvia";
import {
  AlertTriangle, Clock, CircleDollarSign, CheckCircle2, ArrowRight, Zap,
  Radar, Search, Sparkles, Activity, TrendingUp, TrendingDown, Radio,
  Target, Shield, FileText, Gauge,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  component: NotificacionesPage,
  head: () => ({ meta: [{ title: "Alert Center · NUVIA" }] }),
});

type TabKey = "todos" | "criticos" | "qa" | "estancados" | "sin_seguimiento" | "honorarios";

interface QAPend { id: string; expediente_id: string; solicitada_at: string; }
interface Alerta { id: string; expediente_id: string; tipo: string; dias_estancado: number; leida: boolean; created_at: string; }
interface Expediente {
  id: string; codigo?: string | null; cliente_nombre: string; banco: string | null; producto: string | null;
  estado_caso: CasoEstado | null; updated_at: string; honorarios_final: number | null;
  analista_id?: string | null;
}

const SIN_SEGUIMIENTO_DIAS = 10;
const C = {
  bg: "#242424",
  blue: "#445DA3",
  green: "#84B98F",
  crit: "#FF3B47",
  alto: "#FF8A3D",
  medio: "#F6C453",
  bajo: "#84B98F",
  revision: "#5AA9E6",
};

type Priority = "critica" | "alta" | "media" | "baja";
type Phase = "SIM" | "QA" | "RAD" | "APR" | "FIRM";

const PHASES: Phase[] = ["SIM", "QA", "RAD", "APR", "FIRM"];

function phaseFromEstado(e: CasoEstado | null | undefined): Phase {
  if (!e) return "SIM";
  const map: Record<string, Phase> = {
    lead_creado: "SIM",
    extracto_cargado: "SIM",
    proyeccion_generada: "SIM",
    qa_solicitado: "QA",
    qa_en_revision: "QA",
    qa_aprobado: "RAD",
    radicado_banco: "RAD",
    en_estudio_banco: "RAD",
    aprobado_banco: "APR",
    contratacion_enviada: "APR",
    firmado: "FIRM",
    desembolsado: "FIRM",
    honorarios_pendientes: "FIRM",
    cuenta_cobro_enviada: "FIRM",
  };
  return map[e] ?? "SIM";
}

function fmtCOP(v: number | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}
function diasDesde(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); }
function fmtHours(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h}h ${mins % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

type RiskTier = "critico" | "alto" | "revision" | "oportunidad";

interface AlertItem {
  key: string;
  kind: "qa" | "estancado" | "seguimiento" | "honorario";
  cliente: string;
  banco: string;
  expedienteCodigo: string;
  expedienteId: string;
  detalle: string;
  descripcion: string;
  minutos: number;
  priority: Priority;
  risk: RiskTier;
  monto?: number;
  href: string;
  hrefParams: Record<string, string>;
  cta: string;
  phase: Phase;
  blocked: boolean;
  recovery: number;
  onLeida?: () => Promise<void>;
}

function NotificacionesPage() {
  const [tab, setTab] = useState<TabKey>("todos");
  const [q, setQ] = useState("");
  const [banco, setBanco] = useState("");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [qaPend, setQaPend] = useState<QAPend[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const cargar = async () => {
    setLoading(true);
    const [{ data: al }, { data: ex }, { data: qa }] = await Promise.all([
      supabase.from("caso_alertas" as never).select("*").eq("leida", false).order("created_at", { ascending: false }),
      supabase.from("expedientes").select("id, codigo, cliente_nombre, banco, producto, estado_caso, updated_at, honorarios_final, analista_id" as never).order("updated_at", { ascending: false }),
      supabase.from("validaciones_qa" as never).select("id, expediente_id, solicitada_at").is("resultado", null).order("solicitada_at", { ascending: true }),
    ]);
    setAlertas((al ?? []) as unknown as Alerta[]);
    setExpedientes((ex ?? []) as unknown as Expediente[]);
    setQaPend((qa ?? []) as unknown as QAPend[]);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
  }, []);

  const expedienteById = useMemo(() => {
    const m = new Map<string, Expediente>();
    expedientes.forEach((e) => m.set(e.id, e));
    return m;
  }, [expedientes]);

  const sinSeguimiento = useMemo(
    () => expedientes.filter((e) =>
      e.estado_caso &&
      !["caso_finalizado", "proceso_cerrado", "negado_banco", "paz_y_salvo_generado"].includes(e.estado_caso) &&
      diasDesde(e.updated_at) >= SIN_SEGUIMIENTO_DIAS,
    ),
    [expedientes],
  );

  const honorariosPend = useMemo(
    () => expedientes.filter((e) => e.estado_caso === "honorarios_pendientes" || e.estado_caso === "cuenta_cobro_enviada"),
    [expedientes],
  );

  const marcarLeida = async (id: string) => {
    await supabase.from("caso_alertas" as never).update({ leida: true } as never).eq("id", id);
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  };

  const items = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    qaPend.forEach((q) => {
      const exp = expedienteById.get(q.expediente_id);
      const mins = Math.floor((now - new Date(q.solicitada_at).getTime()) / 60_000);
      const p: Priority = mins >= 4320 ? "critica" : mins >= 1440 ? "alta" : mins >= 120 ? "media" : "baja";
      const risk: RiskTier = mins >= 4320 ? "critico" : mins >= 1440 ? "alto" : "revision";
      const recovery = Math.max(15, 90 - Math.floor(mins / 60));
      out.push({
        key: `qa-${q.id}`, kind: "qa",
        cliente: exp?.cliente_nombre ?? "Caso sin nombre",
        banco: exp?.banco ?? "—",
        expedienteCodigo: exp?.codigo ?? q.expediente_id.slice(0, 8),
        expedienteId: q.expediente_id,
        detalle: `QA pendiente ${fmtHours(mins)}`,
        descripcion: "Dictamen NUVIA en espera. Bloquea liberación a radicación.",
        minutos: mins, priority: p, risk,
        phase: "QA", blocked: true, recovery,
        href: "/qa-ai", hrefParams: {}, cta: "Auditar",
      });
    });
    alertas.forEach((a) => {
      const exp = expedienteById.get(a.expediente_id);
      const mins = Math.floor((now - new Date(a.created_at).getTime()) / 60_000);
      const p: Priority = a.dias_estancado >= 15 ? "critica" : a.dias_estancado >= 7 ? "alta" : "media";
      const risk: RiskTier = a.dias_estancado >= 15 ? "critico" : "alto";
      const recovery = Math.max(10, 80 - a.dias_estancado * 3);
      out.push({
        key: `es-${a.id}`, kind: "estancado",
        cliente: exp?.cliente_nombre ?? "Caso",
        banco: exp?.banco ?? "—",
        expedienteCodigo: exp?.codigo ?? a.expediente_id.slice(0, 8),
        expedienteId: a.expediente_id,
        detalle: `Caso estancado ${a.dias_estancado}d`,
        descripcion: `Sin movimiento operativo en ${labelEstado(exp?.estado_caso ?? null)}.`,
        minutos: mins, priority: p, risk,
        phase: phaseFromEstado(exp?.estado_caso), blocked: true, recovery,
        href: "/casos/$id", hrefParams: { id: a.expediente_id }, cta: "Abrir",
        onLeida: () => marcarLeida(a.id),
      });
    });
    sinSeguimiento.forEach((e) => {
      const dias = diasDesde(e.updated_at);
      const p: Priority = dias >= 30 ? "alta" : "media";
      const risk: RiskTier = dias >= 30 ? "alto" : "revision";
      const recovery = Math.max(20, 85 - dias * 2);
      out.push({
        key: `ss-${e.id}`, kind: "seguimiento",
        cliente: e.cliente_nombre, banco: e.banco ?? "—",
        expedienteCodigo: e.codigo ?? e.id.slice(0, 8),
        expedienteId: e.id,
        detalle: `Sin contacto ${dias}d`,
        descripcion: `Requiere seguimiento en fase ${labelEstado(e.estado_caso)}.`,
        minutos: dias * 1440, priority: p, risk,
        phase: phaseFromEstado(e.estado_caso), blocked: false, recovery,
        href: "/casos/$id", hrefParams: { id: e.id }, cta: "Abrir",
      });
    });
    honorariosPend.forEach((e) => {
      const dias = diasDesde(e.updated_at);
      const recovery = Math.max(30, 95 - dias);
      out.push({
        key: `ho-${e.id}`, kind: "honorario",
        cliente: e.cliente_nombre, banco: e.banco ?? "—",
        expedienteCodigo: e.codigo ?? e.id.slice(0, 8),
        expedienteId: e.id,
        detalle: `Honorario ${dias >= 15 ? "vencido" : "pendiente"} ${dias}d`,
        descripcion: `${labelEstado(e.estado_caso)} · recuperación de honorarios NUVIA.`,
        minutos: Math.floor((now - new Date(e.updated_at).getTime()) / 60_000),
        priority: dias >= 15 ? "alta" : "media",
        risk: dias >= 15 ? "alto" : "oportunidad",
        monto: e.honorarios_final ?? undefined,
        phase: "FIRM", blocked: false, recovery,
        href: "/cartera/$id", hrefParams: { id: e.id }, cta: "Cartera",
      });
    });
    return out;
  }, [qaPend, alertas, sinSeguimiento, honorariosPend, expedienteById, now]);

  const bancos = useMemo(() => Array.from(new Set(items.map((i) => i.banco).filter((b) => b !== "—"))), [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "qa") list = list.filter((i) => i.kind === "qa");
    else if (tab === "estancados") list = list.filter((i) => i.kind === "estancado");
    else if (tab === "sin_seguimiento") list = list.filter((i) => i.kind === "seguimiento");
    else if (tab === "honorarios") list = list.filter((i) => i.kind === "honorario");
    else if (tab === "criticos") list = list.filter((i) => i.priority === "critica");
    if (banco) list = list.filter((i) => i.banco === banco);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((i) =>
        i.cliente.toLowerCase().includes(t) ||
        i.banco.toLowerCase().includes(t) ||
        i.detalle.toLowerCase().includes(t) ||
        i.expedienteCodigo.toLowerCase().includes(t),
      );
    }
    const order: Record<Priority, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
    return [...list].sort((a, b) => (order[a.priority] - order[b.priority]) || (b.minutos - a.minutos));
  }, [items, tab, q, banco]);

  const counts = useMemo(() => ({
    todos: items.length,
    criticos: items.filter((i) => i.priority === "critica").length,
    qa: qaPend.length,
    estancados: alertas.length,
    seguimiento: sinSeguimiento.length,
    honorarios: honorariosPend.length,
  }), [items, qaPend, alertas, sinSeguimiento, honorariosPend]);

  const honorariosTotal = honorariosPend.reduce((s, e) => s + (e.honorarios_final ?? 0), 0);
  const riesgo = alertas.length * 28_000_000 + qaPend.length * 12_000_000;
  const recuperable = items.length * 32_500_000 + honorariosTotal;
  const recoveryProb = items.length === 0 ? 100 : Math.min(95, Math.round(items.reduce((s, i) => s + i.recovery, 0) / items.length));
  const predictedClosures = Math.round(items.filter((i) => i.recovery >= 55).length * 0.6);

  const orbitNodes = [
    { key: "qa", label: "QA", val: counts.qa, color: C.blue, icon: Shield },
    { key: "stk", label: "ESTANCADOS", val: counts.estancados, color: C.alto, icon: AlertTriangle },
    { key: "seg", label: "SIN SEGUIM.", val: counts.seguimiento, color: C.crit, icon: Clock },
    { key: "hon", label: "HONORARIOS", val: counts.honorarios, color: C.green, icon: CircleDollarSign },
  ];

  return (
    <PageLayout>
      <style>{`
        @keyframes nvxSpinSlow { from { transform: rotate(0);} to { transform: rotate(360deg);} }
        @keyframes nvxSpinRev { from { transform: rotate(360deg);} to { transform: rotate(0);} }
        @keyframes nvxPulseCore { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity:.95;} 50% { transform: translate(-50%,-50%) scale(1.05); opacity:1;} }
        @keyframes nvxScan { 0% { transform: translateY(-100%);} 100% { transform: translateY(220%);} }
        @keyframes nvxDot { 0%,100% { opacity:.35;} 50% { opacity:1;} }
        @keyframes nvxNodePulse { 0%,100% { box-shadow: 0 0 0 0 currentColor;} 60% { box-shadow: 0 0 0 12px transparent;} }
        @keyframes nvxDataPulse { 0% { stroke-dashoffset: 40; } 100% { stroke-dashoffset: 0; } }
        @keyframes nvxShim { 0% { transform: translateX(-100%);} 100% { transform: translateX(120%);} }
        .nvx-glass { background: linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(14px); }
        .nvx-chip { border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03); color:#E7ECF5; }
        .nvx-alertcard { border:1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); transition: all .18s ease; position:relative; overflow:hidden; }
        .nvx-alertcard:hover { border-color: rgba(132,185,143,.35); background: linear-gradient(180deg, rgba(132,185,143,.05), rgba(255,255,255,.015)); box-shadow: 0 0 0 1px rgba(132,185,143,.15), 0 14px 34px rgba(0,0,0,.4); transform: translateY(-1px); }
        .nvx-alertcard::after { content:""; position:absolute; inset:0; background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.05) 50%, transparent 70%); transform: translateX(-100%); pointer-events:none; }
        .nvx-alertcard:hover::after { animation: nvxShim 1.2s ease; }
        .nvx-btn-primary { background: linear-gradient(135deg,#445DA3,#5D77C4); color:#fff; border:1px solid rgba(255,255,255,.15); box-shadow: 0 0 18px rgba(68,93,163,.45); }
        .nvx-btn-ghost { background: rgba(255,255,255,.04); color:#E7ECF5; border:1px solid rgba(255,255,255,.10); }
        .nvx-scanline { position:absolute; left:0; right:0; height:80px; background: linear-gradient(180deg, transparent, rgba(132,185,143,.08), transparent); animation: nvxScan 6s linear infinite; pointer-events:none; }
        .nvx-particle { position:absolute; width:3px; height:3px; border-radius:50%; background:#84B98F; box-shadow:0 0 8px #84B98F; animation: nvxDot 2.4s ease-in-out infinite; }
        .nvx-phase-node { width: 26px; height: 26px; border-radius: 50%; display:grid; place-items:center; font-size: 9px; font-weight: 800; letter-spacing: .5px; }
        .nvx-phase-line { flex:1; height:2px; background: rgba(255,255,255,.08); position:relative; overflow:hidden; }
        .nvx-phase-line.active::after { content:""; position:absolute; inset:0; background: linear-gradient(90deg, transparent, rgba(132,185,143,.7), transparent); animation: nvxShim 1.8s ease-in-out infinite; }
      `}</style>

      {/* ============ HERO — RADAR OPERATIVO NUVIA ============ */}
      <div
        className="nvx-glass"
        style={{
          position: "relative", borderRadius: 20, overflow: "hidden", padding: "22px 24px",
          background:
            `radial-gradient(1000px 400px at 15% -10%, rgba(68,93,163,.25), transparent 60%),
             radial-gradient(700px 320px at 90% 110%, rgba(132,185,143,.18), transparent 60%),
             linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
        }}
      >
        <div className="nvx-scanline" />
        {[...Array(10)].map((_, i) => (
          <div key={i} className="nvx-particle" style={{ top: `${(i * 9 + 7) % 85}%`, left: `${(i * 17) % 95}%`, animationDelay: `${i * 0.25}s` }} />
        ))}

        <div className="grid gap-6 items-center" style={{ gridTemplateColumns: "260px minmax(0,1fr) 360px" }}>
          {/* LEFT — Radar operativo */}
          <div style={{ position: "relative", width: 260, height: 260 }}>
            {/* concentric grid rings */}
            <svg width="260" height="260" style={{ position: "absolute", inset: 0 }}>
              <defs>
                <radialGradient id="radarBg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#445DA3" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#445DA3" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="130" cy="130" r="120" fill="url(#radarBg)" />
              {[40, 70, 100, 120].map((r) => (
                <circle key={r} cx="130" cy="130" r={r} fill="none" stroke="rgba(132,185,143,.14)" strokeWidth="1" strokeDasharray="2 4" />
              ))}
              <line x1="10" y1="130" x2="250" y2="130" stroke="rgba(132,185,143,.10)" strokeWidth="1" />
              <line x1="130" y1="10" x2="130" y2="250" stroke="rgba(132,185,143,.10)" strokeWidth="1" />
              {/* connection lines from core to nodes */}
              {orbitNodes.map((n, i) => {
                const ang = (i * 90 - 45) * Math.PI / 180;
                const x = 130 + Math.cos(ang) * 100;
                const y = 130 + Math.sin(ang) * 100;
                return (
                  <line key={n.key} x1="130" y1="130" x2={x} y2={y}
                    stroke={n.color} strokeOpacity="0.55" strokeWidth="1"
                    strokeDasharray="3 4" style={{ animation: "nvxDataPulse 2.4s linear infinite" }} />
                );
              })}
              {/* rotating sweep */}
              <g style={{ transformOrigin: "130px 130px", animation: "nvxSpinSlow 8s linear infinite" }}>
                <defs>
                  <linearGradient id="sweep" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#84B98F" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#84B98F" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M130,130 L250,130 A120,120 0 0,0 190,26 Z" fill="url(#sweep)" />
              </g>
            </svg>

            {/* Orbit nodes */}
            {orbitNodes.map((n, i) => {
              const ang = (i * 90 - 45) * Math.PI / 180;
              const x = 130 + Math.cos(ang) * 100;
              const y = 130 + Math.sin(ang) * 100;
              const Icon = n.icon;
              return (
                <div key={n.key} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", textAlign: "center" }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%", display: "grid", placeItems: "center",
                    background: `radial-gradient(circle at 30% 30%, ${n.color}, ${n.color}22)`,
                    border: `1px solid ${n.color}`,
                    boxShadow: `0 0 22px ${n.color}90, inset 0 0 10px rgba(255,255,255,.12)`,
                    color: "#fff", position: "relative",
                  }}>
                    <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px solid ${n.color}55`, animation: "nvxNodePulse 2.4s ease-out infinite", color: n.color }} />
                    <Icon size={16} />
                  </div>
                  <div style={{ fontSize: 8, letterSpacing: 1, color: n.color, marginTop: 4, fontWeight: 800 }}>{n.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#F4F6FB", lineHeight: 1 }}>{n.val}</div>
                </div>
              );
            })}

            {/* CORE */}
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              width: 110, height: 110, borderRadius: "50%",
              background: `radial-gradient(circle at 35% 30%, #FF6A72, #7A1620 70%, #240607)`,
              boxShadow: "0 0 40px rgba(255,59,71,.55), inset 0 0 26px rgba(255,255,255,.14)",
              display: "grid", placeItems: "center", animation: "nvxPulseCore 2.4s ease-in-out infinite",
              border: "1px solid rgba(255,255,255,.22)", color: "#fff",
              transform: "translate(-50%,-50%)",
            }}>
              <div style={{ fontSize: 8, letterSpacing: 1.5, opacity: 0.85, fontWeight: 800 }}>ALERT CORE</div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1 }}>{counts.criticos}</div>
              <div style={{ fontSize: 8, letterSpacing: 1, opacity: 0.75 }}>CRÍTICOS</div>
            </div>
          </div>

          {/* CENTER — Title */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="nvx-chip" style={{ fontSize: 10, padding: "4px 10px", borderRadius: 999, letterSpacing: 1, textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Radar size={11} /> NUVIA Alert Core · LIVE
              </span>
              <span style={{ fontSize: 10, color: C.green, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, boxShadow: `0 0 8px ${C.green}` }} />
                {counts.todos} señales activas
              </span>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: "#F4F6FB", lineHeight: 1.1 }}>
              Centro de Alertas <span style={{ color: C.green }}>NUVIA</span>
            </h1>
            <p style={{ fontSize: 13, color: "rgba(231,236,245,.65)", maxWidth: 520, marginTop: 8 }}>
              Supervisa bloqueos, riesgos operativos y oportunidades de recuperación en tiempo real.
            </p>
            <div className="flex items-center gap-2 flex-wrap mt-4">
              <Link to="/qa-ai">
                <button className="nvx-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                  <Sparkles size={14} /> Command Center
                </button>
              </Link>
              <Link to="/casos">
                <button className="nvx-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                  <FileText size={12} /> Expedientes
                </button>
              </Link>
            </div>
          </div>

          {/* RIGHT — KPI stack */}
          <div className="flex flex-col gap-2">
            {[
              { label: "QA Pendiente", value: counts.qa, color: C.blue, icon: <Zap size={12} />, trend: qaPend.length > 0 ? `oldest ${fmtHours(Math.floor((now - new Date(qaPend[0].solicitada_at).getTime()) / 60_000))}` : "estable", up: qaPend.length > 0 },
              { label: "Estancados", value: counts.estancados, color: C.alto, icon: <AlertTriangle size={12} />, trend: "críticos", up: counts.estancados > 0 },
              { label: "Sin seguimiento", value: counts.seguimiento, color: C.crit, icon: <Clock size={12} />, trend: `>${SIN_SEGUIMIENTO_DIAS}d`, up: counts.seguimiento > 0 },
              { label: "Honorarios", value: counts.honorarios, color: C.green, icon: <CircleDollarSign size={12} />, trend: honorariosTotal > 0 ? fmtCOP(honorariosTotal) : "—", up: false },
            ].map((m, i) => (
              <div key={i} className="nvx-glass flex items-center gap-3" style={{ borderRadius: 12, padding: "9px 12px" }}>
                <div style={{ width: 3, alignSelf: "stretch", background: m.color, boxShadow: `0 0 8px ${m.color}`, borderRadius: 3 }} />
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }}>{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>{m.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#F4F6FB", lineHeight: 1 }}>{m.value}</span>
                    <span style={{ fontSize: 10, color: m.color, display: "inline-flex", alignItems: "center", gap: 2 }}>
                      {m.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {m.trend}
                    </span>
                  </div>
                </div>
                <svg width="52" height="22" viewBox="0 0 52 22" style={{ flexShrink: 0 }}>
                  <polyline fill="none" stroke={m.color} strokeWidth="1.5"
                    points={[...Array(8)].map((_, j) => `${j * 7},${11 + Math.sin((i + j) * 1.1) * 6}`).join(" ")} />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============ TABS ============ */}
      <div className="flex items-center gap-2 flex-wrap mt-4">
        {([
          { k: "todos", label: "Todos", n: counts.todos, c: C.blue },
          { k: "criticos", label: "Críticos", n: counts.criticos, c: C.crit },
          { k: "qa", label: "QA", n: counts.qa, c: C.blue },
          { k: "estancados", label: "Estancados", n: counts.estancados, c: C.alto },
          { k: "sin_seguimiento", label: "Sin seguimiento", n: counts.seguimiento, c: C.medio },
          { k: "honorarios", label: "Honorarios", n: counts.honorarios, c: C.green },
        ] as { k: TabKey; label: string; n: number; c: string }[]).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className="nvx-chip"
            style={{
              padding: "7px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              ...(tab === t.k ? { boxShadow: `0 0 18px ${t.c}66, inset 0 0 0 1px ${t.c}88`, borderColor: t.c } : {}),
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.c, boxShadow: `0 0 6px ${t.c}` }} />
            {t.label}
            <span style={{ fontSize: 10, background: "rgba(0,0,0,.35)", padding: "2px 6px", borderRadius: 999, color: "#F4F6FB" }}>{t.n}</span>
          </button>
        ))}
      </div>

      {/* SEARCH */}
      <div className="nvx-glass flex items-center gap-2 mt-3" style={{ borderRadius: 12, padding: "8px 12px" }}>
        <Search size={14} color="rgba(231,236,245,.55)" />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente, banco, expediente, riesgo..."
          style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "#F4F6FB", fontSize: 13 }} />
        <div style={{ height: 20, width: 1, background: "rgba(255,255,255,.10)" }} />
        <select value={banco} onChange={(e) => setBanco(e.target.value)}
          style={{ background: "rgba(255,255,255,.04)", color: "#F4F6FB", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, padding: "5px 10px", fontSize: 12, outline: "none" }}>
          <option value="" style={{ background: C.bg }}>Todos los bancos</option>
          {bancos.map((b) => (<option key={b} value={b} style={{ background: C.bg }}>{b}</option>))}
        </select>
      </div>

      {/* ============ ALERT CARDS (expediente style) ============ */}
      <div className="mt-3 flex flex-col gap-2" style={{ paddingBottom: 100 }}>
        {loading ? (
          <div className="nvx-glass" style={{ borderRadius: 12, padding: 24, textAlign: "center", color: "rgba(231,236,245,.6)", fontSize: 13 }}>
            <Activity size={16} className="inline mr-2" /> Escaneando radar…
          </div>
        ) : filtered.length === 0 ? (
          <div className="nvx-glass" style={{ borderRadius: 12, padding: 32, textAlign: "center" }}>
            <CheckCircle2 size={32} color={C.green} style={{ margin: "0 auto 8px" }} />
            <div style={{ fontSize: 14, color: "#F4F6FB", fontWeight: 600 }}>Radar limpio</div>
            <div style={{ fontSize: 12, color: "rgba(231,236,245,.6)" }}>No hay alertas con los filtros actuales.</div>
          </div>
        ) : (
          filtered.map((it) => {
            const riskColor =
              it.risk === "critico" ? C.crit :
              it.risk === "alto" ? C.alto :
              it.risk === "revision" ? C.revision : C.green;
            const recoveryColor = it.recovery >= 66 ? C.green : it.recovery >= 33 ? C.medio : C.crit;
            const initial = it.cliente.trim().charAt(0).toUpperCase() || "N";
            const activeIdx = PHASES.indexOf(it.phase);

            return (
              <div key={it.key} className="nvx-alertcard flex items-stretch gap-4"
                style={{ borderRadius: 14, padding: "14px 16px", borderLeft: `3px solid ${riskColor}`, boxShadow: `inset 3px 0 20px -12px ${riskColor}` }}>

                {/* LEFT — Identidad */}
                <div className="flex items-center gap-3 min-w-0" style={{ width: 240 }}>
                  <div style={{
                    width: 46, height: 46, flexShrink: 0, borderRadius: "50%", display: "grid", placeItems: "center",
                    background: `radial-gradient(circle at 30% 30%, ${riskColor}66, ${riskColor}11)`,
                    border: `1px solid ${riskColor}77`, color: "#F4F6FB", fontWeight: 800, fontSize: 17,
                    boxShadow: `0 0 18px ${riskColor}55, inset 0 0 8px rgba(255,255,255,.10)`,
                  }}>{initial}</div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 10, color: riskColor, fontWeight: 700, letterSpacing: 0.5 }}>{it.banco}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#F4F6FB" }} className="truncate">{it.cliente}</div>
                    <div style={{ fontSize: 10, color: "rgba(231,236,245,.5)", fontFamily: "ui-monospace, monospace" }} className="truncate">
                      {it.expedienteCodigo}
                    </div>
                  </div>
                </div>

                {/* CENTER-LEFT — Tipo + descripción */}
                <div className="min-w-0" style={{ width: 220 }}>
                  <div style={{ fontSize: 12.5, color: "#F4F6FB", fontWeight: 700 }} className="truncate">{it.detalle}</div>
                  <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)", lineHeight: 1.35, marginTop: 2 }}
                    className="line-clamp-2">{it.descripcion}</div>
                  <div className="flex items-center gap-2 mt-1.5" style={{ fontSize: 10, color: "rgba(231,236,245,.5)" }}>
                    <Clock size={10} /> {fmtHours(it.minutos)}
                    {it.monto ? <><span>·</span><span style={{ color: C.green }}>{fmtCOP(it.monto)}</span></> : null}
                  </div>
                </div>

                {/* CENTER — Pipeline timeline */}
                <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ minWidth: 180 }}>
                  <div className="flex items-center gap-1">
                    {PHASES.map((p, idx) => {
                      const done = idx < activeIdx;
                      const active = idx === activeIdx;
                      const bg = done ? `${C.green}44` : active ? `${riskColor}` : "rgba(255,255,255,.05)";
                      const col = done ? C.green : active ? "#fff" : "rgba(231,236,245,.4)";
                      const border = done ? `${C.green}88` : active ? riskColor : "rgba(255,255,255,.10)";
                      return (
                        <Fragment key={p}>
                          <div className="nvx-phase-node"
                            style={{
                              background: bg, color: col, border: `1px solid ${border}`,
                              boxShadow: active ? `0 0 14px ${riskColor}, 0 0 0 3px ${riskColor}22` : "none",
                              animation: active && it.blocked ? "nvxNodePulse 1.8s ease-out infinite" : "none",
                            }}>{p}</div>
                          {idx < PHASES.length - 1 && (
                            <div className={`nvx-phase-line ${done ? "active" : ""}`}
                              style={{ background: done ? `${C.green}33` : "rgba(255,255,255,.06)" }} />
                          )}
                        </Fragment>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span style={{ fontSize: 9, color: "rgba(231,236,245,.5)", letterSpacing: 1, textTransform: "uppercase" }}>Fase actual</span>
                    <span style={{ fontSize: 10, color: riskColor, fontWeight: 700, letterSpacing: 0.5 }}>{it.phase} · {it.blocked ? "BLOQUEADO" : "EN CURSO"}</span>
                  </div>
                </div>

                {/* CENTER-RIGHT — Recovery Score */}
                <div style={{ width: 130, flexShrink: 0 }} className="flex flex-col justify-center">
                  <div style={{ fontSize: 9, letterSpacing: 1, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Recovery Score</div>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontSize: 22, fontWeight: 800, color: recoveryColor, lineHeight: 1 }}>{it.recovery}</span>
                    <span style={{ fontSize: 10, color: "rgba(231,236,245,.5)" }}>%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
                    <div style={{
                      width: `${it.recovery}%`, height: "100%",
                      background: `linear-gradient(90deg, ${recoveryColor}, ${recoveryColor}dd)`,
                      boxShadow: `0 0 10px ${recoveryColor}`, borderRadius: 6,
                    }} />
                  </div>
                </div>

                {/* RIGHT — Badges + acciones */}
                <div className="flex flex-col items-end gap-1.5" style={{ flexShrink: 0, minWidth: 170 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    padding: "3px 8px", borderRadius: 999,
                    color: riskColor, background: `${riskColor}18`, border: `1px solid ${riskColor}55`,
                    boxShadow: `0 0 10px ${riskColor}33`,
                  }}>{it.priority}</span>
                  <div className="flex items-center gap-1">
                    <Link
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      to={it.href as any}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      params={it.hrefParams as any}
                      className="nvx-btn-primary"
                      style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      {it.cta} <ArrowRight size={11} />
                    </Link>
                    <Link
                      to="/casos/$id"
                      params={{ id: it.expedienteId }}
                      className="nvx-btn-ghost"
                      style={{ fontSize: 11, padding: "6px 8px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}
                      title="Timeline"
                    >
                      <Activity size={11} />
                    </Link>
                  </div>
                  {it.onLeida && (
                    <button onClick={it.onLeida} className="nvx-btn-ghost"
                      style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
                      <CheckCircle2 size={10} /> Marcar leída
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ============ STICKY BOTTOM — NUVIA RECOVERY INTELLIGENCE ============ */}
      <div style={{
        position: "sticky", bottom: 12, marginTop: 12, zIndex: 20,
      }}>
        <div className="nvx-glass" style={{
          borderRadius: 16, padding: "12px 16px", position: "relative", overflow: "hidden",
          background: `radial-gradient(600px 200px at 10% 0%, rgba(68,93,163,.28), transparent 60%),
                       radial-gradient(500px 180px at 90% 100%, rgba(132,185,143,.22), transparent 60%),
                       linear-gradient(180deg, rgba(20,25,40,.85), rgba(15,18,28,.85))`,
          border: "1px solid rgba(132,185,143,.20)",
          boxShadow: "0 -8px 30px rgba(0,0,0,.35), 0 0 30px rgba(68,93,163,.15)",
          backdropFilter: "blur(18px)",
        }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `radial-gradient(circle at 30% 30%, ${C.blue}, #1a2540)`, boxShadow: `0 0 14px ${C.blue}88`, display: "grid", placeItems: "center" }}>
                <Sparkles size={14} color="#fff" />
              </div>
              <div>
                <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 800 }}>NUVIA Recovery Intelligence</div>
                <div style={{ fontSize: 9, color: "rgba(231,236,245,.5)" }}>análisis predictivo en vivo</div>
              </div>
            </div>

            <div className="flex-1 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
              <div style={{ borderLeft: `2px solid ${C.green}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Recovery probability</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.green, lineHeight: 1.1 }}>{recoveryProb}%</div>
              </div>
              <div style={{ borderLeft: `2px solid ${C.blue}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Potential recovery</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#F4F6FB", lineHeight: 1.1 }}>{fmtCOP(recuperable)}</div>
              </div>
              <div style={{ borderLeft: `2px solid ${C.alto}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Cases at risk</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: C.alto, lineHeight: 1.1 }}>{counts.criticos + Math.round(counts.estancados / 2)}</div>
              </div>
              <div style={{ borderLeft: `2px solid ${C.crit}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Blocked capital</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.crit, lineHeight: 1.1 }}>{fmtCOP(riesgo)}</div>
              </div>
              <div style={{ borderLeft: `2px solid ${C.medio}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Predicted closures 7d</div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 18, fontWeight: 800, color: C.medio, lineHeight: 1.1 }}>{predictedClosures}</span>
                  <Target size={12} color={C.medio} />
                </div>
              </div>
              <div className="hidden lg:block">
                <div style={{ fontSize: 9, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase", marginBottom: 2 }}>Radar 24h</div>
                <svg width="100%" height="34" viewBox="0 0 200 34" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="nvxGradFooter" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity="0.6" />
                      <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <polyline fill="url(#nvxGradFooter)" stroke={C.blue} strokeWidth="1.5"
                    points={"0,32 " + [...Array(24)].map((_, i) => `${(i + 1) * 8.3},${32 - (Math.abs(Math.sin(i * 0.6)) * 20 + (i % 5) * 1.5)}`).join(" ") + " 200,32"} />
                </svg>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1 text-[10px]" style={{ color: "rgba(231,236,245,.5)" }}>
              <Gauge size={11} color={C.green} /> tácticamente estable
            </div>
          </div>
        </div>
      </div>

      <span style={{ display: "none" }}><Radio size={1} /></span>
    </PageLayout>
  );
}
