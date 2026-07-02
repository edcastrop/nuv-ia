import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { PageLayout } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { listAlertasQA, actualizarAlertaQA } from "@/lib/qaAI.functions";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertTriangle, Bell, CheckCircle2, ArrowRight, ShieldCheck, Sparkles,
  Search, Radio, Zap, Clock, MoreHorizontal, Radar, Activity, TrendingUp, TrendingDown,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";

export const Route = createFileRoute("/_authenticated/qa-ai/alertas")({
  component: AlertasQA,
  head: () => ({ meta: [{ title: "Alert Center · NUVIA" }] }),
});

type Alerta = Awaited<ReturnType<typeof listAlertasQA>>["rows"][number];

// Palette
const C = {
  bg: "#242424",
  blue: "#445DA3",
  green: "#84B98F",
  crit: "#FF3B47",
  alto: "#FF8A3D",
  medio: "#F6C453",
  bajo: "#84B98F",
};

type Priority = "critica" | "alta" | "media" | "baja";
type TabKey = "todos" | "qa" | "estancados" | "seguimiento" | "honorarios" | "criticos";

// Derive priority: severidad + antigüedad
function priorityOf(a: Alerta): Priority {
  if (a.estado === "resuelta") return "baja";
  const hours = (Date.now() - new Date(a.createdAt).getTime()) / 36e5;
  if (a.severidad === "critica" || hours > 120) return "critica";
  if (a.severidad === "warning" && hours > 48) return "alta";
  if (a.severidad === "warning" || hours > 24) return "media";
  return "baja";
}
function priorityColor(p: Priority) {
  return p === "critica" ? C.crit : p === "alta" ? C.alto : p === "media" ? C.medio : C.bajo;
}
function hoursDetained(a: Alerta) {
  return Math.floor((Date.now() - new Date(a.createdAt).getTime()) / 36e5);
}
function fmtHours(h: number) {
  if (h < 1) return "< 1h";
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function AlertasQA() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const list = useServerFn(listAlertasQA);
  const update = useServerFn(actualizarAlertaQA);

  const [rows, setRows] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("todos");
  const [q, setQ] = useState("");
  const [banco, setBanco] = useState<string>("");
  const [dlg, setDlg] = useState<{ alerta: Alerta; accion: "reconocer" | "resolver" } | null>(null);
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const [copilotoOpen, setCopilotoOpen] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const r = await list({ data: {} as never });
      setRows(r.rows);
    } catch { /* ignore */ }
    setLoading(false);
  }, [list]);

  useEffect(() => { if (!rolesLoading) fetchRows(); }, [rolesLoading, fetchRows]);

  const bancos = useMemo(
    () => Array.from(new Set(rows.map((r) => r.banco).filter(Boolean))) as string[],
    [rows],
  );

  // Segmentation
  const seg = useMemo(() => {
    const activas = rows.filter((r) => r.estado !== "resuelta");
    const qa = activas.filter((r) => r.estado === "abierta");
    const estancados = activas.filter((r) => hoursDetained(r) >= 72);
    const seguimiento = activas.filter((r) => hoursDetained(r) < 72 && r.estado === "abierta");
    const honorarios = activas.filter((r) => /honor|comis|fee/i.test(r.tipo ?? ""));
    const criticos = activas.filter((r) => priorityOf(r) === "critica");
    return { activas, qa, estancados, seguimiento, honorarios, criticos };
  }, [rows]);

  const filtered = useMemo(() => {
    let list =
      tab === "qa" ? seg.qa :
      tab === "estancados" ? seg.estancados :
      tab === "seguimiento" ? seg.seguimiento :
      tab === "honorarios" ? seg.honorarios :
      tab === "criticos" ? seg.criticos :
      rows;
    if (banco) list = list.filter((r) => r.banco === banco);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((r) =>
        (r.codigo ?? "").toLowerCase().includes(t) ||
        (r.banco ?? "").toLowerCase().includes(t) ||
        (r.tipo ?? "").toLowerCase().includes(t) ||
        (r.mensaje ?? "").toLowerCase().includes(t) ||
        (r.analistaId ?? "").toLowerCase().includes(t),
      );
    }
    // Sort by priority + antigüedad
    const order: Record<Priority, number> = { critica: 0, alta: 1, media: 2, baja: 3 };
    return [...list].sort((a, b) => {
      const pa = order[priorityOf(a)], pb = order[priorityOf(b)];
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [rows, seg, tab, banco, q]);

  const ejecutarAccion = async () => {
    if (!dlg) return;
    setBusy(true);
    try {
      await update({ data: { id: dlg.alerta.id, accion: dlg.accion, notas: notas || undefined } });
      setDlg(null); setNotas("");
      await fetchRows();
    } catch { /* ignore */ }
    setBusy(false);
  };

  // AI insight (heuristic)
  const insight = useMemo(() => {
    const criticos72 = seg.estancados.filter((r) => priorityOf(r) === "critica").length;
    const totalActivas = seg.activas.length;
    // heurística: cada caso estancado bloquea ~$28M en flujo NUVEX
    const riesgo = seg.estancados.length * 28_000_000;
    const recuperable = seg.activas.length * 32_500_000;
    return { criticos72, totalActivas, riesgo, recuperable };
  }, [seg]);

  const money = (n: number) => "$" + n.toLocaleString("es-CO");

  return (
    <PageLayout>
      <style>{`
        @keyframes nvxSpinSlow { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
        @keyframes nvxSpinRev { from { transform: rotate(360deg);} to { transform: rotate(0deg);} }
        @keyframes nvxPulseCore { 0%,100% { transform: scale(1); opacity:.9;} 50% { transform: scale(1.06); opacity:1;} }
        @keyframes nvxScan { 0% { transform: translateY(-100%);} 100% { transform: translateY(220%);} }
        @keyframes nvxFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
        @keyframes nvxDot { 0%,100% { opacity:.4;} 50% { opacity:1;} }
        .nvx-orb-ring { position:absolute; inset:0; border-radius:50%; border:1px dashed rgba(255,255,255,.08); }
        .nvx-orb-node { position:absolute; top:50%; left:50%; transform-origin:0 0; }
        .nvx-glass { background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015)); border: 1px solid rgba(255,255,255,.08); backdrop-filter: blur(14px); }
        .nvx-chip { border:1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03); color:#E7ECF5; }
        .nvx-chip[data-active="true"] { background: linear-gradient(135deg, rgba(68,93,163,.35), rgba(132,185,143,.18)); border-color: rgba(132,185,143,.55); box-shadow: 0 0 24px rgba(68,93,163,.35); }
        .nvx-alertcard { border:1px solid rgba(255,255,255,.08); background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); transition: all .2s ease; }
        .nvx-alertcard:hover { border-color: rgba(132,185,143,.35); background: linear-gradient(180deg, rgba(132,185,143,.06), rgba(255,255,255,.015)); box-shadow: 0 0 0 1px rgba(132,185,143,.15), 0 12px 30px rgba(0,0,0,.35); transform: translateY(-1px); }
        .nvx-sev-bar { width: 4px; border-radius: 4px; align-self: stretch; box-shadow: 0 0 12px currentColor; }
        .nvx-btn-primary { background: linear-gradient(135deg,#445DA3,#5D77C4); color:#fff; border:1px solid rgba(255,255,255,.15); box-shadow: 0 0 20px rgba(68,93,163,.4); }
        .nvx-btn-ghost { background: rgba(255,255,255,.04); color:#E7ECF5; border:1px solid rgba(255,255,255,.10); }
        .nvx-scanline { position:absolute; left:0; right:0; height:80px; background: linear-gradient(180deg, transparent, rgba(132,185,143,.10), transparent); animation: nvxScan 5.5s linear infinite; pointer-events:none; }
        .nvx-particle { position:absolute; width:3px; height:3px; border-radius:50%; background:#84B98F; box-shadow:0 0 8px #84B98F; animation: nvxDot 2.4s ease-in-out infinite; }
      `}</style>

      {/* ===== HERO HOLOGRÁFICO ===== */}
      <div
        className="nvx-glass"
        style={{
          position: "relative",
          borderRadius: 20,
          overflow: "hidden",
          padding: "22px 24px",
          background:
            `radial-gradient(1000px 400px at 20% -10%, rgba(68,93,163,.25), transparent 60%),
             radial-gradient(700px 320px at 90% 110%, rgba(132,185,143,.18), transparent 60%),
             linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
        }}
      >
        <div className="nvx-scanline" />
        {/* particles */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className="nvx-particle" style={{ top: `${10 + (i * 11) % 80}%`, left: `${(i * 17) % 95}%`, animationDelay: `${i * 0.3}s` }} />
        ))}

        <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr) 380px" }}>
          {/* LEFT — holograma */}
          <div className="flex items-center gap-6">
            {/* Orb */}
            <div style={{ position: "relative", width: 240, height: 240, flexShrink: 0 }}>
              {/* Outer rings */}
              <div className="nvx-orb-ring" style={{ animation: "nvxSpinSlow 22s linear infinite", borderColor: "rgba(68,93,163,.35)" }} />
              <div className="nvx-orb-ring" style={{ inset: 24, animation: "nvxSpinRev 18s linear infinite", borderColor: "rgba(132,185,143,.30)" }} />
              <div className="nvx-orb-ring" style={{ inset: 48, animation: "nvxSpinSlow 26s linear infinite", borderColor: "rgba(246,196,83,.25)" }} />
              <div className="nvx-orb-ring" style={{ inset: 72, animation: "nvxSpinRev 14s linear infinite", borderColor: "rgba(255,59,71,.25)" }} />

              {/* Orbit nodes */}
              {[
                { color: C.blue, val: seg.qa.length, angle: 0, radius: 120, label: "QA" },
                { color: C.alto, val: seg.estancados.length, angle: 90, radius: 96, label: "STK" },
                { color: C.crit, val: seg.seguimiento.length, angle: 180, radius: 72, label: "SEG" },
                { color: C.green, val: seg.honorarios.length, angle: 270, radius: 48, label: "HON" },
              ].map((n, i) => {
                const rad = (n.angle * Math.PI) / 180;
                const x = Math.cos(rad) * n.radius;
                const y = Math.sin(rad) * n.radius;
                return (
                  <div
                    key={i}
                    className="nvx-orb-node"
                    style={{
                      transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                      animation: `nvxFloat 3.${i}s ease-in-out infinite`,
                    }}
                  >
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: "50%",
                        display: "grid", placeItems: "center",
                        background: `radial-gradient(circle at 30% 30%, ${n.color}, ${n.color}22)`,
                        boxShadow: `0 0 22px ${n.color}90, inset 0 0 10px rgba(255,255,255,.15)`,
                        border: `1px solid ${n.color}`,
                        color: "#fff", fontWeight: 800, fontSize: 12,
                      }}
                    >
                      {n.val}
                    </div>
                    <div style={{ textAlign: "center", fontSize: 9, letterSpacing: 1, color: n.color, marginTop: 4, fontWeight: 700 }}>{n.label}</div>
                  </div>
                );
              })}

              {/* Core */}
              <div
                style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                  width: 100, height: 100, borderRadius: "50%",
                  background: `radial-gradient(circle at 35% 30%, #FF6A72, #7A1620 70%, #240607)`,
                  boxShadow: "0 0 40px rgba(255,59,71,.55), inset 0 0 25px rgba(255,255,255,.12)",
                  display: "grid", placeItems: "center", animation: "nvxPulseCore 2.4s ease-in-out infinite",
                  border: "1px solid rgba(255,255,255,.2)",
                }}
              >
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
                  scanning
                </span>
              </div>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, color: "#F4F6FB", lineHeight: 1.1 }}>
                Centro de Alertas <span style={{ color: C.green }}>NUVIA</span>
              </h1>
              <p style={{ fontSize: 13, color: "rgba(231,236,245,.65)", maxWidth: 520, marginTop: 8 }}>
                Radar operativo en tiempo real. Prioriza lo urgente, ataca lo detenido, recupera lo comprometido.
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <button onClick={() => setCopilotoOpen(true)} className="nvx-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                  <Sparkles size={14} /> Copiloto QA
                </button>
                <Link to="/qa-ai">
                  <button className="nvx-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, fontSize: 12, cursor: "pointer" }}>
                    <ShieldCheck size={14} /> Command Center
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT — vertical metrics stack */}
          <div className="flex flex-col gap-2">
            {[
              { label: "QA Pendiente", value: seg.qa.length, color: C.blue, icon: <Bell size={12} />, trend: "+3 hoy" },
              { label: "Estancados > 72h", value: seg.estancados.length, color: C.alto, icon: <Clock size={12} />, trend: "+5 hoy" },
              { label: "Sin seguimiento", value: seg.seguimiento.length, color: C.crit, icon: <Radio size={12} />, trend: "+12 hoy" },
              { label: "Honorarios", value: seg.honorarios.length, color: C.green, icon: <Zap size={12} />, trend: "estable" },
            ].map((m, i) => (
              <div key={i} className="nvx-glass flex items-center gap-3" style={{ borderRadius: 12, padding: "10px 14px", position: "relative", overflow: "hidden" }}>
                <div style={{ width: 3, alignSelf: "stretch", background: m.color, boxShadow: `0 0 8px ${m.color}`, borderRadius: 3 }} />
                <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}55` }}>{m.icon}</div>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>{m.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#F4F6FB", lineHeight: 1 }}>{m.value}</span>
                    <span style={{ fontSize: 10, color: m.color, display: "inline-flex", alignItems: "center", gap: 2 }}>
                      {m.trend.startsWith("+") ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {m.trend}
                    </span>
                  </div>
                </div>
                {/* mini sparkline */}
                <svg width="52" height="22" viewBox="0 0 52 22" style={{ flexShrink: 0 }}>
                  <polyline
                    fill="none" stroke={m.color} strokeWidth="1.5"
                    points={[...Array(8)].map((_, j) => `${j * 7},${11 + Math.sin((i + j) * 1.1) * 6}`).join(" ")}
                  />
                </svg>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== TABS + SEARCH ===== */}
      <div className="flex items-center gap-2 flex-wrap mt-4">
        {([
          { k: "todos", label: "Todos", n: rows.length, c: C.blue },
          { k: "criticos", label: "Críticos", n: seg.criticos.length, c: C.crit },
          { k: "qa", label: "QA", n: seg.qa.length, c: C.blue },
          { k: "estancados", label: "Estancados", n: seg.estancados.length, c: C.alto },
          { k: "seguimiento", label: "Sin seguimiento", n: seg.seguimiento.length, c: C.medio },
          { k: "honorarios", label: "Honorarios", n: seg.honorarios.length, c: C.green },
        ] as { k: TabKey; label: string; n: number; c: string }[]).map((t) => (
          <button
            key={t.k}
            data-active={tab === t.k}
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

      {/* Search bar */}
      <div className="nvx-glass flex items-center gap-2 mt-3" style={{ borderRadius: 12, padding: "8px 12px" }}>
        <Search size={14} color="rgba(231,236,245,.55)" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente, banco, analista, código, mensaje..."
          style={{
            flex: 1, background: "transparent", border: 0, outline: "none",
            color: "#F4F6FB", fontSize: 13,
          }}
        />
        <div style={{ height: 20, width: 1, background: "rgba(255,255,255,.10)" }} />
        <select
          value={banco}
          onChange={(e) => setBanco(e.target.value)}
          style={{
            background: "rgba(255,255,255,.04)", color: "#F4F6FB", border: "1px solid rgba(255,255,255,.10)",
            borderRadius: 8, padding: "5px 10px", fontSize: 12, outline: "none",
          }}
        >
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
          filtered.map((a) => {
            const p = priorityOf(a);
            const col = priorityColor(p);
            const h = hoursDetained(a);
            const initial = (a.codigo ?? a.banco ?? "N").slice(0, 1).toUpperCase();
            return (
              <div key={a.id} className="nvx-alertcard flex items-stretch gap-3" style={{ borderRadius: 12, padding: 12 }}>
                <div className="nvx-sev-bar" style={{ background: col, color: col }} />

                {/* LEFT */}
                <div className="flex items-center gap-3 min-w-0" style={{ width: 260 }}>
                  <div
                    style={{
                      width: 40, height: 40, flexShrink: 0, borderRadius: 10, display: "grid", placeItems: "center",
                      background: `linear-gradient(135deg, ${col}44, ${col}11)`,
                      border: `1px solid ${col}55`, color: "#F4F6FB", fontWeight: 800, fontSize: 15,
                      boxShadow: `0 0 14px ${col}44`,
                    }}
                  >{initial}</div>
                  <div className="min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#F4F6FB" }} className="truncate">
                      {a.codigo ?? (a.expedienteId ? a.expedienteId.slice(0, 8) : "Expediente")}
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }} className="truncate">
                      {a.banco ?? "—"} · {a.analistaId ? a.analistaId.slice(0, 8) : "sin analista"}
                    </div>
                  </div>
                </div>

                {/* CENTER */}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12, color: "#F4F6FB", fontWeight: 600 }} className="truncate">{a.tipo}</div>
                  <div style={{ fontSize: 11, color: "rgba(231,236,245,.65)" }} className="truncate">{a.mensaje}</div>
                  <div className="flex items-center gap-3 mt-1" style={{ fontSize: 10, color: "rgba(231,236,245,.55)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Clock size={10} /> detenido {fmtHours(h)}
                    </span>
                    <span>· estado {a.estado}</span>
                    {a.score !== null && a.score !== undefined && <span>· score {Number(a.score).toFixed(1)}</span>}
                  </div>
                </div>

                {/* RIGHT — badges + actions */}
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 9.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                      padding: "4px 8px", borderRadius: 999,
                      color: col, background: `${col}18`, border: `1px solid ${col}55`,
                      boxShadow: `0 0 10px ${col}33`,
                    }}
                  >{p}</span>

                  {a.estado === "abierta" && (
                    <button
                      disabled={!canValidarProyeccion}
                      onClick={() => { setDlg({ alerta: a, accion: "reconocer" }); setNotas(""); }}
                      className="nvx-btn-ghost"
                      style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, cursor: canValidarProyeccion ? "pointer" : "not-allowed", opacity: canValidarProyeccion ? 1 : 0.4 }}
                    >Reconocer</button>
                  )}
                  {a.estado !== "resuelta" && (
                    <button
                      disabled={!canValidarProyeccion}
                      onClick={() => { setDlg({ alerta: a, accion: "resolver" }); setNotas(""); }}
                      className="nvx-btn-primary"
                      style={{ fontSize: 11, padding: "6px 12px", borderRadius: 8, cursor: canValidarProyeccion ? "pointer" : "not-allowed", opacity: canValidarProyeccion ? 1 : 0.4 }}
                    >Auditar</button>
                  )}
                  {a.auditoriaId ? (
                    <Link to="/qa-ai/$id" params={{ id: a.auditoriaId }} className="nvx-btn-ghost" style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Expediente <ArrowRight size={10} />
                    </Link>
                  ) : a.expedienteId ? (
                    <Link to="/casos/$id" params={{ id: a.expedienteId }} className="nvx-btn-ghost" style={{ fontSize: 11, padding: "6px 10px", borderRadius: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Expediente <ArrowRight size={10} />
                    </Link>
                  ) : null}
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
      <div
        className="nvx-glass mt-4"
        style={{
          borderRadius: 16, padding: 16, position: "relative", overflow: "hidden",
          background: `radial-gradient(600px 200px at 10% 0%, rgba(68,93,163,.22), transparent 60%), linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01))`,
        }}
      >
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "#F4F6FB", marginTop: 2 }}>{money(insight.riesgo)}</div>
            <div style={{ fontSize: 11, color: C.crit }}>{seg.estancados.length} casos estancados</div>
          </div>
          <div style={{ borderLeft: `2px solid ${C.alto}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Recomendación táctica</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#F4F6FB", marginTop: 2, lineHeight: 1.3 }}>
              Priorizar {insight.criticos72} críticos {'>'}72h
            </div>
            <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }}>impacto inmediato en pipeline</div>
          </div>
          <div style={{ borderLeft: `2px solid ${C.green}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase" }}>Potencial recuperable</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.green, marginTop: 2 }}>{money(insight.recuperable)}</div>
            <div style={{ fontSize: 11, color: "rgba(231,236,245,.6)" }}>si se liberan {insight.totalActivas} activas</div>
          </div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 0.5, color: "rgba(231,236,245,.55)", textTransform: "uppercase", marginBottom: 4 }}>Radar 24h</div>
            <svg width="100%" height="56" viewBox="0 0 200 56" preserveAspectRatio="none">
              <defs>
                <linearGradient id="nvxGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={C.blue} stopOpacity="0.6" />
                  <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                fill="url(#nvxGrad)"
                stroke={C.blue}
                strokeWidth="1.5"
                points={"0,50 " + [...Array(24)].map((_, i) => `${(i + 1) * 8.3},${50 - (Math.abs(Math.sin(i * 0.6)) * 30 + (i % 5) * 2)}`).join(" ") + " 200,50"}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={!!dlg} onOpenChange={(o) => { if (!o) { setDlg(null); setNotas(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlg?.accion === "reconocer" ? "Reconocer alerta" : "Resolver alerta"}</DialogTitle>
          </DialogHeader>
          {dlg && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Tipo:</span> {dlg.alerta.tipo} · <span className="font-semibold">Severidad:</span> {dlg.alerta.severidad}</p>
              <p className="text-muted-foreground">{dlg.alerta.mensaje}</p>
              <div>
                <label className="text-xs font-medium">Notas {dlg.accion === "resolver" && "(recomendado)"}</label>
                <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Describe la acción tomada o la justificación…" rows={4} />
              </div>
            </div>
          )}
          <DialogFooter>
            <button onClick={() => { setDlg(null); setNotas(""); }} className="text-xs px-3 py-2 rounded border">Cancelar</button>
            <button onClick={ejecutarAccion} disabled={busy} className="text-xs px-3 py-2 rounded text-white" style={{ background: dlg?.accion === "resolver" ? C.green : C.blue }}>
              {busy ? "Guardando…" : "Confirmar"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} />
    </PageLayout>
  );
}
