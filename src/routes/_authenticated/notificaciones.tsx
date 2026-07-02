import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { PageLayout } from "@/components/nuvia";
import {
  AlertTriangle, Clock, CircleDollarSign, CheckCircle2, ArrowRight, Zap,
  Radar, Search, Sparkles, Activity, TrendingUp, TrendingDown, MoreHorizontal, Radio,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  component: NotificacionesPage,
  head: () => ({ meta: [{ title: "Alert Center · NUVIA" }] }),
});

type TabKey = "todos" | "criticos" | "qa" | "estancados" | "sin_seguimiento" | "honorarios";

interface QAPend { id: string; expediente_id: string; solicitada_at: string; }
interface Alerta { id: string; expediente_id: string; tipo: string; dias_estancado: number; leida: boolean; created_at: string; }
interface Expediente {
  id: string; cliente_nombre: string; banco: string | null; producto: string | null;
  estado_caso: CasoEstado | null; updated_at: string; honorarios_final: number | null;
}

const SIN_SEGUIMIENTO_DIAS = 10;
const C = { bg: "#242424", blue: "#445DA3", green: "#84B98F", crit: "#FF3B47", alto: "#FF8A3D", medio: "#F6C453", bajo: "#84B98F" };

type Priority = "critica" | "alta" | "media" | "baja";

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

// Unified card model
interface AlertItem {
  key: string;
  kind: "qa" | "estancado" | "seguimiento" | "honorario";
  cliente: string;
  banco: string;
  detalle: string;
  minutos: number; // antigüedad
  priority: Priority;
  monto?: number;
  href: string;
  hrefParams: Record<string, string>;
  cta: string;
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
      supabase.from("expedientes").select("id, cliente_nombre, banco, producto, estado_caso, updated_at, honorarios_final" as never).order("updated_at", { ascending: false }),
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

  // Build unified list
  const items = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    qaPend.forEach((q) => {
      const exp = expedienteById.get(q.expediente_id);
      const mins = Math.floor((now - new Date(q.solicitada_at).getTime()) / 60_000);
      const p: Priority = mins >= 4320 ? "critica" : mins >= 1440 ? "alta" : mins >= 120 ? "media" : "baja";
      out.push({
        key: `qa-${q.id}`, kind: "qa",
        cliente: exp?.cliente_nombre ?? "Caso sin nombre",
        banco: exp?.banco ?? "—",
        detalle: "Esperando dictamen QA",
        minutos: mins, priority: p,
        href: "/qa-ai", hrefParams: {}, cta: "Auditar",
      });
    });
    alertas.forEach((a) => {
      const exp = expedienteById.get(a.expediente_id);
      const mins = Math.floor((now - new Date(a.created_at).getTime()) / 60_000);
      const p: Priority = a.dias_estancado >= 15 ? "critica" : a.dias_estancado >= 7 ? "alta" : "media";
      out.push({
        key: `es-${a.id}`, kind: "estancado",
        cliente: exp?.cliente_nombre ?? "Caso",
        banco: exp?.banco ?? "—",
        detalle: `Estancado ${a.dias_estancado}d en ${labelEstado(exp?.estado_caso ?? null)}`,
        minutos: mins, priority: p,
        href: "/casos/$id", hrefParams: { id: a.expediente_id }, cta: "Abrir",
        onLeida: () => marcarLeida(a.id),
      });
    });
    sinSeguimiento.forEach((e) => {
      const dias = diasDesde(e.updated_at);
      const p: Priority = dias >= 30 ? "alta" : "media";
      out.push({
        key: `ss-${e.id}`, kind: "seguimiento",
        cliente: e.cliente_nombre, banco: e.banco ?? "—",
        detalle: `Sin actividad ${dias}d · ${labelEstado(e.estado_caso)}`,
        minutos: dias * 1440, priority: p,
        href: "/casos/$id", hrefParams: { id: e.id }, cta: "Abrir",
      });
    });
    honorariosPend.forEach((e) => {
      out.push({
        key: `ho-${e.id}`, kind: "honorario",
        cliente: e.cliente_nombre, banco: e.banco ?? "—",
        detalle: `${labelEstado(e.estado_caso)}`,
        minutos: Math.floor((now - new Date(e.updated_at).getTime()) / 60_000),
        priority: "media", monto: e.honorarios_final ?? undefined,
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
      list = list.filter((i) => i.cliente.toLowerCase().includes(t) || i.banco.toLowerCase().includes(t) || i.detalle.toLowerCase().includes(t));
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

  // Insight heuristic
  const riesgo = alertas.length * 28_000_000 + qaPend.length * 12_000_000;
  const recuperable = items.length * 32_500_000;

  return (
    <PageLayout>
      <style>{`
        @keyframes nvxSpinSlow { from { transform: rotate(0);} to { transform: rotate(360deg);} }
        @keyframes nvxSpinRev { from { transform: rotate(360deg);} to { transform: rotate(0);} }
        @keyframes nvxPulseCore { 0%,100% { transform: scale(1); opacity:.9;} 50% { transform: scale(1.06); opacity:1;} }
        @keyframes nvxScan { 0% { transform: translateY(-100%);} 100% { transform: translateY(220%);} }
        @keyframes nvxFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes nvxDot { 0%,100% { opacity:.4;} 50% { opacity:1;} }
        .nvx-orb-ring { position:absolute; inset:0; border-radius:50%; border:1px dashed rgba(255,255,255,.08); }
        .nvx-orb-node { position:absolute; top:50%; left:50%; }
        .nvx-glass { background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(14px); }
        .nvx-chip { border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03); color:#E7ECF5; }
        .nvx-alertcard { border:1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); transition: all .18s ease; }
        .nvx-alertcard:hover { border-color: rgba(132,185,143,.35); background: linear-gradient(180deg, rgba(132,185,143,.06), rgba(255,255,255,.015)); box-shadow: 0 0 0 1px rgba(132,185,143,.15), 0 12px 30px rgba(0,0,0,.35); transform: translateY(-1px); }
        .nvx-btn-primary { background: linear-gradient(135deg,#445DA3,#5D77C4); color:#fff; border:1px solid rgba(255,255,255,.15); box-shadow: 0 0 20px rgba(68,93,163,.4); }
        .nvx-btn-ghost { background: rgba(255,255,255,.04); color:#E7ECF5; border:1px solid rgba(255,255,255,.10); }
        .nvx-scanline { position:absolute; left:0; right:0; height:80px; background: linear-gradient(180deg, transparent, rgba(132,185,143,.10), transparent); animation: nvxScan 5.5s linear infinite; pointer-events:none; }
        .nvx-particle { position:absolute; width:3px; height:3px; border-radius:50%; background:#84B98F; box-shadow:0 0 8px #84B98F; animation: nvxDot 2.4s ease-in-out infinite; }
      `}</style>

      {/* ===== HERO HOLOGRÁFICO ===== */}
      <div
        className="nvx-glass"
        style={{
          position: "relative", borderRadius: 20, overflow: "hidden", padding: "22px 24px",
          background:
            `radial-gradient(1000px 400px at 20% -10%, rgba(68,93,163,.25), transparent 60%),
             radial-gradient(700px 320px at 90% 110%, rgba(132,185,143,.18), transparent 60%),
             linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
        }}
      >
        <div className="nvx-scanline" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="nvx-particle" style={{ top: `${10 + (i * 11) % 80}%`, left: `${(i * 17) % 95}%`, animationDelay: `${i * 0.3}s` }} />
        ))}

        <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
          <div className="flex items-center gap-6">
            <div style={{ position: "relative", width: 240, height: 240, flexShrink: 0 }}>
              <div className="nvx-orb-ring" style={{ animation: "nvxSpinSlow 22s linear infinite", borderColor: "rgba(68,93,163,.35)" }} />
              <div className="nvx-orb-ring" style={{ inset: 24, animation: "nvxSpinRev 18s linear infinite", borderColor: "rgba(132,185,143,.30)" }} />
              <div className="nvx-orb-ring" style={{ inset: 48, animation: "nvxSpinSlow 26s linear infinite", borderColor: "rgba(246,196,83,.25)" }} />
              <div className="nvx-orb-ring" style={{ inset: 72, animation: "nvxSpinRev 14s linear infinite", borderColor: "rgba(255,59,71,.25)" }} />

              {[
                { color: C.blue, val: counts.qa, angle: 0, radius: 120, label: "QA" },
                { color: C.alto, val: counts.estancados, angle: 90, radius: 96, label: "STK" },
                { color: C.crit, val: counts.seguimiento, angle: 180, radius: 72, label: "SEG" },
                { color: C.green, val: counts.honorarios, angle: 270, radius: 48, label: "HON" },
              ].map((n, i) => {
                const rad = (n.angle * Math.PI) / 180;
                const x = Math.cos(rad) * n.radius;
                const y = Math.sin(rad) * n.radius;
                return (
                  <div key={i} className="nvx-orb-node" style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`, animation: `nvxFloat 3.${i}s ease-in-out infinite` }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center",
                      background: `radial-gradient(circle at 30% 30%, ${n.color}, ${n.color}22)`,
                      boxShadow: `0 0 22px ${n.color}90, inset 0 0 10px rgba(255,255,255,.15)`,
                      border: `1px solid ${n.color}`, color: "#fff", fontWeight: 800, fontSize: 12,
                    }}>{n.val}</div>
                    <div style={{ textAlign: "center", fontSize: 9, letterSpacing: 1, color: n.color, marginTop: 4, fontWeight: 700 }}>{n.label}</div>
                  </div>
                );
              })}

              <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: 100, height: 100, borderRadius: "50%",
                background: `radial-gradient(circle at 35% 30%, #FF6A72, #7A1620 70%, #240607)`,
                boxShadow: "0 0 40px rgba(255,59,71,.55), inset 0 0 25px rgba(255,255,255,.12)",
                display: "grid", placeItems: "center", animation: "nvxPulseCore 2.4s ease-in-out infinite",
                border: "1px solid rgba(255,255,255,.2)",
              }}>
                <AlertTriangle size={38} color="#fff" strokeWidth={2.4} />
              </div>
            </div>

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
                Radar operativo en tiempo real. Prioriza lo urgente, ataca lo detenido, recupera lo comprometido.
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <Link to="/qa-ai">
                  <button className="nvx-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                    <Sparkles size={14} /> Command Center QA
                  </button>
                </Link>
                <Link to="/casos">
                  <button className="nvx-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                    Expedientes
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT metrics */}
          <div className="flex flex-col gap-2">
            {[
              { label: "QA Pendiente", value: counts.qa, color: C.blue, icon: <Zap size={12} />, trend: qaPend.length > 0 ? `oldest ${fmtHours(Math.floor((now - new Date(qaPend[0].solicitada_at).getTime()) / 60_000))}` : "estable", up: qaPend.length > 0 },
              { label: "Estancados", value: counts.estancados, color: C.alto, icon: <AlertTriangle size={12} />, trend: "críticos", up: counts.estancados > 0 },
              { label: "Sin seguimiento", value: counts.seguimiento, color: C.crit, icon: <Clock size={12} />, trend: `>${SIN_SEGUIMIENTO_DIAS}d`, up: counts.seguimiento > 0 },
              { label: "Honorarios", value: counts.honorarios, color: C.green, icon: <CircleDollarSign size={12} />, trend: honorariosTotal > 0 ? fmtCOP(honorariosTotal) : "—", up: false },
            ].map((m, i) => (
              <div key={i} className="nvx-glass flex items-center gap-3" style={{ borderRadius: 12, padding: "10px 14px" }}>
                <div style={{ width: 3, alignSelf: "stretch", background: m.color, boxShadow: `0 0 8px ${m.color}`, borderRadius: 3 }} />
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }}>{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>{m.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#F4F6FB", lineHeight: 1 }}>{m.value}</span>
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

      {/* ===== TABS ===== */}
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
          placeholder="Buscar cliente, banco, estado, riesgo..."
          style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "#F4F6FB", fontSize: 13 }} />
        <div style={{ height: 20, width: 1, background: "rgba(255,255,255,.10)" }} />
        <select value={banco} onChange={(e) => setBanco(e.target.value)}
          style={{ background: "rgba(255,255,255,.04)", color: "#F4F6FB", border: "1px solid rgba(255,255,255,.10)", borderRadius: 8, padding: "5px 10px", fontSize: 12, outline: "none" }}>
          <option value="" style={{ background: C.bg }}>Todos los bancos</option>
          {bancos.map((b) => (<option key={b} value={b} style={{ background: C.bg }}>{b}</option>))}
        </select>
      </div>

      {/* ===== ALERT CARDS ===== */}
      <div className="mt-3 flex flex-col gap-2">
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
            const col = it.priority === "critica" ? C.crit : it.priority === "alta" ? C.alto : it.priority === "media" ? C.medio : C.bajo;
            const initial = it.cliente.trim().charAt(0).toUpperCase() || "N";
            return (
              <div key={it.key} className="nvx-alertcard flex items-stretch gap-3" style={{ borderRadius: 12, padding: 12 }}>
                <div style={{ width: 4, borderRadius: 4, background: col, boxShadow: `0 0 12px ${col}` }} />
                {/* LEFT */}
                <div className="flex items-center gap-3 min-w-0" style={{ width: 280 }}>
                  <div style={{
                    width: 40, height: 40, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center",
                    background: `linear-gradient(135deg, ${col}44, ${col}11)`,
                    border: `1px solid ${col}55`, color: "#F4F6FB", fontWeight: 800, fontSize: 15,
                    boxShadow: `0 0 14px ${col}44`,
                  }}>{initial}</div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F6FB" }} className="truncate">{it.cliente}</div>
                    <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }} className="truncate">{it.banco}</div>
                  </div>
                </div>
                {/* CENTER */}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12, color: "#F4F6FB", fontWeight: 600 }} className="truncate">{it.detalle}</div>
                  <div className="flex items-center gap-3 mt-1" style={{ fontSize: 10, color: "rgba(231,236,245,.55)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Clock size={10} /> {fmtHours(it.minutos)}
                    </span>
                    <span>· tipo {it.kind}</span>
                    {it.monto ? <span>· {fmtCOP(it.monto)}</span> : null}
                  </div>
                </div>
                {/* RIGHT */}
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                    padding: "4px 8px", borderRadius: 999,
                    color: col, background: `${col}18`, border: `1px solid ${col}55`,
                    boxShadow: `0 0 10px ${col}33`,
                  }}>{it.priority}</span>
                  <Link
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    to={it.href as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    params={it.hrefParams as any}
                    className="nvx-btn-primary"
                    style={{ fontSize: 11, padding: "6px 12px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    {it.cta} <ArrowRight size={11} />
                  </Link>
                  {it.onLeida && (
                    <button onClick={it.onLeida} className="nvx-btn-ghost"
                      style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <CheckCircle2 size={11} /> Leída
                    </button>
                  )}
                  <button className="nvx-btn-ghost" style={{ padding: 6, borderRadius: 8, cursor: "pointer" }} aria-label="Más">
                    <MoreHorizontal size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ===== NUVIA AI INSIGHT ===== */}
      <div className="nvx-glass mt-4" style={{
        borderRadius: 16, padding: 16, position: "relative", overflow: "hidden",
        background: `radial-gradient(600px 200px at 10% 0%, rgba(68,93,163,.22), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
      }}>
        <div className="flex items-center gap-2 mb-3">
          <div style={{ width: 26, height: 26, borderRadius: 8, background: `radial-gradient(circle at 30% 30%, ${C.blue}, #1a2540)`, boxShadow: `0 0 14px ${C.blue}88`, display: "grid", placeItems: "center" }}>
            <Sparkles size={13} color="#fff" />
          </div>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: C.blue, fontWeight: 700 }}>NUVIA AI Insight</div>
          <span style={{ fontSize: 10, color: "rgba(231,236,245,.5)" }}>· análisis en tiempo real</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div style={{ borderLeft: `2px solid ${C.crit}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Riesgo comprometido</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F4F6FB", marginTop: 2 }}>{fmtCOP(riesgo)}</div>
            <div style={{ fontSize: 11, color: C.crit }}>{counts.estancados} estancados · {counts.qa} QA</div>
          </div>
          <div style={{ borderLeft: `2px solid ${C.alto}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Recomendación táctica</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F6FB", marginTop: 2, lineHeight: 1.3 }}>Priorizar {counts.criticos} críticos</div>
            <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }}>impacto inmediato en pipeline</div>
          </div>
          <div style={{ borderLeft: `2px solid ${C.green}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Potencial recuperable</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginTop: 2 }}>{fmtCOP(recuperable)}</div>
            <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }}>si se liberan {counts.todos} señales</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase", marginBottom: 4 }}>Radar 24h</div>
            <svg width="100%" height="56" viewBox="0 0 200 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="nvxGradN" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline fill="url(#nvxGradN)" stroke={C.blue} strokeWidth="1.5"
                points={"0,50 " + [...Array(24)].map((_, i) => `${(i + 1) * 8.3},${50 - (Math.abs(Math.sin(i * 0.6)) * 30 + (i % 5) * 2)}`).join(" ") + " 200,50"} />
            </svg>
          </div>
        </div>
      </div>

      {/* Radio hidden to keep import used */}
      <span style={{ display: "none" }}><Radio size={1} /></span>
    </PageLayout>
  );
}
