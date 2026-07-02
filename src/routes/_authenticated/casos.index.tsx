import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo, useState } from "react";
import { listExpedientes, ESTADOS, type EstadoExpediente, type Expediente } from "@/lib/expedientes";
import { formatCOP } from "@/lib/format";
import { computeEtapaActual, getEtapaById, ETAPAS_PIPELINE, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { useAuth } from "@/hooks/useAuth";
import { QABadge } from "@/components/qa-ai/QABadge";
import {
  Search,
  Plus,
  FolderOpen,
  Wallet,
  Building2,
  Sparkles,
  Flag,
  AlertTriangle,
  Clock,
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Loader2,
  Zap,
  TrendingUp,
  Target,
  Activity,
  CheckCircle2,
  FileText,
  Radio,
  Cpu,
  Download,
} from "lucide-react";
import { PageLayout } from "@/components/nuvia";
import { AnalistaAvatar } from "@/components/pipeline/AnalistaAvatar";
import { supabase } from "@/integrations/supabase/client";
import { triggerSimuladorAutoQA } from "@/lib/simuladorAutoQA";

const ETAPA_IDS = ETAPAS_PIPELINE.map((e) => e.id) as [EtapaPipelineId, ...EtapaPipelineId[]];

export const casosSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  estado: fallback(z.enum(["", ...ESTADOS]), "").default(""),
  etapa: fallback(z.enum(["", ...ETAPA_IDS]), "").default(""),
  mios: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/casos/")({
  validateSearch: zodValidator(casosSearchSchema),
  component: CasosPage,
  head: () => ({ meta: [{ title: "Expedientes NUVIA · Command Center" }] }),
});

/* ============ Tokens ============ */
const AZUL = "#445DA3";
const VERDE = "#84B98F";
const CARD = "rgba(10,22,40,0.72)";
const CARD_SOLID = "#0A1628";
const BORDER = "rgba(255,255,255,0.08)";
const BORDER_STRONG = "rgba(255,255,255,0.14)";
const TEXT2 = "#94A3B8";

const ESTADO_THEME: Record<EstadoExpediente, { color: string; label: string }> = {
  SIMULADO: { color: "#445DA3", label: "Simulado" },
  FIRMADO: { color: "#9333EA", label: "Firmado" },
  ENVIADO_CONTRATACION: { color: "#6366F1", label: "Enviado" },
  RADICADO: { color: "#F97316", label: "Radicado" },
  APROBADO: { color: "#84B98F", label: "Aprobado" },
  CONDICIONES_APLICADAS: { color: "#16A34A", label: "Condiciones" },
  FACTURADO: { color: "#D4A017", label: "Facturado" },
  PAGADO: { color: "#1F7A45", label: "Pagado" },
};

const AVATAR_COLORS = ["#445DA3", "#84B98F", "#9333EA", "#F97316", "#D4A017", "#0EA5E9", "#EC4899"];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

const UMBRAL_DIAS_ETAPA: Record<EtapaPipelineId, number> = {
  lead: 3, extracto: 3, proyeccion: 5, presentacion: 5, cierre: 7, contratacion: 7,
  radicacion: 5, banco: 21, resultado_banco: 5, aceptacion_cliente: 5, informe: 5,
  cuenta: 5, pago: 10, comision: 10, paz_salvo: 5, finalizado: 0,
};

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

type SlaNivel = "ok" | "atencion" | "critico" | "neutral";
function slaNivel(dias: number, umbral: number): SlaNivel {
  if (umbral <= 0) return "neutral";
  if (dias >= umbral * 1.5) return "critico";
  if (dias >= umbral) return "atencion";
  return "ok";
}
const SLA_COLORS: Record<SlaNivel, { bg: string; fg: string; border: string }> = {
  ok:       { bg: "rgba(132,185,143,0.10)", fg: "#84B98F", border: "rgba(132,185,143,0.35)" },
  atencion: { bg: "rgba(245,158,11,0.10)",  fg: "#F59E0B", border: "rgba(245,158,11,0.40)" },
  critico:  { bg: "rgba(244,63,94,0.12)",   fg: "#FB7185", border: "rgba(244,63,94,0.45)" },
  neutral:  { bg: "rgba(148,163,184,0.10)", fg: "#94A3B8", border: "rgba(148,163,184,0.30)" },
};

/* Pipeline milestones (5-step progress) */
const MILESTONES = [
  { key: "simulacion", label: "Sim", etapa: 1 },
  { key: "qa",         label: "QA",  etapa: 4 },
  { key: "radicado",   label: "Rad", etapa: 8 },
  { key: "aprobado",   label: "Apr", etapa: 10 },
  { key: "firmado",    label: "Firm", etapa: 15 },
];

function CasosPage() {
  type CasosSearch = z.infer<typeof casosSearchSchema>;
  const urlSearch = Route.useSearch();
  const navigate = useNavigate({ from: "/casos" });
  const { user } = useAuth();
  const { q: search, estado, etapa, mios } = urlSearch;
  const [qLocal, setQLocal] = useState(search);
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [asesores, setAsesores] = useState<Map<string, { nombre: string | null; email: string | null }>>(new Map());
  const [auditCodes, setAuditCodes] = useState<Map<string, string>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);

  // Filtros locales adicionales
  const [banco, setBanco] = useState<string>("");
  const [analistaId, setAnalistaId] = useState<string>("");
  const [modalidad, setModalidad] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== search) {
        navigate({ search: (prev: CasosSearch) => ({ ...prev, q: qLocal }), replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, search, navigate]);

  const setEstado = (v: EstadoExpediente | "") =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, estado: v }), replace: true });
  const setEtapa = (v: EtapaPipelineId | "") =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, etapa: v }), replace: true });
  const setMios = (v: boolean) =>
    navigate({ search: (prev: CasosSearch) => ({ ...prev, mios: v }), replace: true });

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listExpedientes({ search, estado, etapa })
      .then(async (r) => {
        if (cancel) return;
        setRows(r);
        const ids = Array.from(new Set(r.flatMap((row) => [row.asesor_id, row.licenciado_id]).filter(Boolean) as string[]));
        if (ids.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
          const m = new Map<string, { nombre: string | null; email: string | null }>();
          (profs ?? []).forEach((p: any) => m.set(p.id, { nombre: p.nombre ?? null, email: p.email ?? null }));
          if (!cancel) setAsesores(m);
        }
        const auditIds = Array.from(new Set(r.map((row) => row.qa_auditoria_id).filter(Boolean) as string[]));
        if (auditIds.length > 0) {
          const { data: auds } = await supabase.from("qa_auditorias").select("id,codigo").in("id", auditIds);
          const am = new Map<string, string>();
          (auds ?? []).forEach((a: any) => { if (a.codigo) am.set(a.id, a.codigo); });
          if (!cancel) setAuditCodes(am);
        }
      })
      .catch((e) => { if (!cancel) setErr(e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [search, estado, etapa, reloadKey]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (mios && user?.id && !(r.asesor_id === user.id || r.licenciado_id === user.id)) return false;
      if (banco && r.banco !== banco) return false;
      if (modalidad && r.modo !== modalidad) return false;
      if (analistaId && r.asesor_id !== analistaId && r.licenciado_id !== analistaId) return false;
      return true;
    });
  }, [rows, mios, user?.id, banco, modalidad, analistaId]);

  const dupCedulas = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => {
      const c = (r.cedula ?? "").trim();
      if (!c) return;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    const s = new Set<string>();
    counts.forEach((n, c) => { if (n > 1) s.add(c); });
    return s;
  }, [rows]);

  const bancos = useMemo(() => Array.from(new Set(rows.map((r) => r.banco).filter(Boolean))) as string[], [rows]);
  const analistasList = useMemo(() => {
    const s = new Map<string, string>();
    rows.forEach((r) => {
      const id = r.licenciado_id ?? r.asesor_id;
      if (!id) return;
      const info = asesores.get(id);
      s.set(id, info?.nombre || info?.email || id.slice(0, 6));
    });
    return Array.from(s.entries());
  }, [rows, asesores]);

  /* Métricas hero */
  const kpis = useMemo(() => {
    const honorarios = filteredRows.reduce((s, r) => s + Number(r.honorarios_final || 0), 0);
    const total = filteredRows.length;
    const firmados = filteredRows.filter((r) => r.estado === "FIRMADO" || r.estado === "PAGADO" || r.estado === "FACTURADO").length;
    const listosFirma = filteredRows.filter((r) => {
      const et = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
      return et === "cierre" || et === "contratacion" || et === "aceptacion_cliente";
    }).length;
    const conversion = total > 0 ? Math.round((firmados / total) * 100) : 0;
    return { honorarios, total, conversion, listosFirma };
  }, [filteredRows]);

  /* Live pipeline counts */
  const pipeline = useMemo(() => {
    const c = { sim: 0, qa: 0, rad: 0, apr: 0, firm: 0 };
    filteredRows.forEach((r) => {
      if (r.qa_auditoria_id) c.qa += 1;
      if (r.estado === "SIMULADO") c.sim += 1;
      if (r.estado === "RADICADO" || r.estado === "ENVIADO_CONTRATACION") c.rad += 1;
      if (r.estado === "APROBADO" || r.estado === "CONDICIONES_APLICADAS") c.apr += 1;
      if (r.estado === "FIRMADO" || r.estado === "FACTURADO" || r.estado === "PAGADO") c.firm += 1;
    });
    return c;
  }, [filteredRows]);

  /* IA: riesgo, oportunidad, acción */
  const insightIA = useMemo(() => {
    const criticos = filteredRows.filter((r) => {
      const etId = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
      return slaNivel(diasDesde(r.updated_at), UMBRAL_DIAS_ETAPA[etId] ?? 0) === "critico";
    });
    const oportunidad = [...filteredRows]
      .filter((r) => Number(r.honorarios_final || 0) > 0 && r.estado !== "PAGADO")
      .sort((a, b) => Number(b.honorarios_final || 0) - Number(a.honorarios_final || 0))[0];
    const accion = filteredRows.find((r) => !r.qa_auditoria_id && r.estado === "SIMULADO");
    return { criticos, oportunidad, accion };
  }, [filteredRows]);

  const exportarCSV = () => {
    const headers = ["Cliente", "Cédula", "Banco", "Crédito", "Modo", "Estado", "Etapa", "Días", "Honorarios", "Actualizado"];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    filteredRows.forEach((r) => {
      const etId = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
      const et = getEtapaById(etId);
      lines.push([
        esc(r.cliente_nombre), esc(r.cedula), esc(r.banco), esc(r.numero_credito),
        esc(r.modo), esc(ESTADO_THEME[r.estado]?.label ?? r.estado),
        esc(`E${et.numero} ${et.titulo}`), esc(diasDesde(r.updated_at)),
        esc(r.honorarios_final ?? 0), esc(r.updated_at?.slice(0, 10)),
      ].join(","));
    });
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expedientes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PageLayout maxWidth="7xl">
      {/* ============ HERO COMMAND CENTER ============ */}
      <section
        className="relative overflow-hidden rounded-[24px] backdrop-blur-2xl"
        style={{
          background: `linear-gradient(135deg, rgba(10,22,40,0.85) 0%, rgba(7,17,32,0.9) 100%)`,
          border: `1px solid ${BORDER_STRONG}`,
          boxShadow: "0 30px 80px -30px rgba(68,93,163,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
      >
        {/* Grid lines background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          }}
        />
        {/* Light beams */}
        <div className="absolute -top-32 left-1/4 h-[280px] w-[280px] rounded-full blur-[110px] pointer-events-none" style={{ background: AZUL, opacity: 0.28 }} />
        <div className="absolute -bottom-24 right-1/4 h-[240px] w-[240px] rounded-full blur-[100px] pointer-events-none" style={{ background: VERDE, opacity: 0.22 }} />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 p-8">
          {/* LEFT */}
          <div className="flex flex-col justify-between gap-6 min-w-0">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ background: "rgba(68,93,163,0.15)", color: "#A5B5E0", border: `1px solid ${AZUL}55` }}>
                  <Radio size={10} className="animate-pulse" /> Gestión de expedientes
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ background: "rgba(132,185,143,0.12)", color: VERDE, border: `1px solid ${VERDE}55` }}>
                  <Cpu size={10} /> NUVIA CORE · LIVE
                </span>
              </div>
              <h1
                className="font-black leading-[0.95] tracking-tight"
                style={{
                  fontSize: "clamp(38px, 4.6vw, 60px)",
                  backgroundImage: `linear-gradient(120deg, #FFFFFF 0%, #A5B5E0 55%, ${VERDE} 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                EXPEDIENTES NUVIA
              </h1>
              <p className="mt-3 text-[13.5px] max-w-xl leading-relaxed" style={{ color: "#B8C4D8" }}>
                Control inteligente de simulaciones, cierres, radicaciones y aprobaciones.
                Sistema operativo de expedientes vivos en tiempo real.
              </p>
            </div>

            {/* Quick stats micro-glass */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <MicroStat icon={<FolderOpen size={13} />} label="Activos" value={String(kpis.total)} tone="blue" />
              <MicroStat icon={<Wallet size={13} />} label="Honorarios" value={formatCOP(kpis.honorarios)} tone="green" small />
              <MicroStat icon={<TrendingUp size={13} />} label="Conversión" value={`${kpis.conversion}%`} tone="blue" />
              <MicroStat icon={<CheckCircle2 size={13} />} label="Listos firma" value={String(kpis.listosFirma)} tone="green" />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5">
              <Link
                to="/inicio"
                className="inline-flex items-center gap-2 rounded-xl px-5 h-11 text-[11px] font-bold uppercase tracking-wider text-white transition hover:brightness-110"
                style={{
                  background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`,
                  boxShadow: `0 10px 30px -10px ${AZUL}, 0 0 0 1px rgba(255,255,255,0.08) inset`,
                }}
              >
                <Plus size={14} /> Nueva simulación
              </Link>
              <button
                type="button"
                onClick={exportarCSV}
                disabled={loading || filteredRows.length === 0}
                className="inline-flex items-center gap-2 rounded-xl px-4 h-11 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50 hover:bg-white/10"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${BORDER_STRONG}`, color: "#fff" }}
              >
                <Download size={13} /> Exportar CSV
              </button>
            </div>
          </div>

          {/* RIGHT: HOLOGRAM + LIVE PIPELINE */}
          <div className="relative flex items-center justify-center min-h-[340px]">
            <NuviaHologram />
            <LivePipeline pipeline={pipeline} />
          </div>
        </div>
      </section>

      {/* ============ NUVIA IA STRIP ============ */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: VERDE }}>
            NUVIA IA · Inteligencia de expedientes
          </div>
          <div className="text-[11.5px] mt-0.5" style={{ color: TEXT2 }}>
            Recomendaciones ejecutivas basadas en comportamiento, aging y probabilidad de cierre.
          </div>
        </div>
      </div>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <IACard
          tone="risk"
          icon={<AlertTriangle size={16} />}
          title="Riesgo detectado"
          value={insightIA.criticos.length > 0 ? `${insightIA.criticos.length} expedientes fuera de SLA` : "Todo dentro de SLA"}
          hint={insightIA.criticos[0] ? `Prioridad: ${insightIA.criticos[0].cliente_nombre}` : "Sistema en verde"}
          cta="Revisar críticos"
          onClick={() => insightIA.criticos[0] && (window.location.href = `/casos/${insightIA.criticos[0].id}`)}
        />
        <IACard
          tone="opportunity"
          icon={<TrendingUp size={16} />}
          title="Oportunidad de cierre"
          value={insightIA.oportunidad ? insightIA.oportunidad.cliente_nombre || "Expediente" : "Sin oportunidades activas"}
          hint={insightIA.oportunidad ? `${formatCOP(Number(insightIA.oportunidad.honorarios_final || 0))} en honorarios` : "—"}
          cta="Abrir expediente"
          onClick={() => insightIA.oportunidad && (window.location.href = `/casos/${insightIA.oportunidad.id}`)}
        />
        <IACard
          tone="action"
          icon={<Zap size={16} />}
          title="Próxima acción NUVIA"
          value={insightIA.accion ? `Auditar ${insightIA.accion.cliente_nombre || "expediente"}` : "Todo auditado"}
          hint={insightIA.accion ? "Simulado sin QA · ejecutar auditoría" : "Sistema al día"}
          cta="Ir al expediente"
          onClick={() => insightIA.accion && (window.location.href = `/casos/${insightIA.accion.id}`)}
        />
      </section>

      {/* ============ FILTROS COMPACTOS ============ */}
      <section
        className="rounded-2xl backdrop-blur-xl flex flex-wrap items-center gap-2 p-2"
        style={{ background: CARD, border: `1px solid ${BORDER}` }}
      >
        <div className="relative flex-1 basis-full md:basis-[280px] min-w-[240px]">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: TEXT2 }} />
          <input
            type="text"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder="Buscar cliente, cédula, banco, crédito o código de auditoría (NUV_AUD_…)"
            className="w-full h-11 bg-transparent pl-11 pr-4 text-[13px] outline-none placeholder:text-slate-500 rounded-lg"
            style={{ color: "#fff", border: `1px solid ${BORDER}` }}
          />
        </div>
        <GlassSelect value={estado} onChange={(v) => setEstado(v as EstadoExpediente | "")} placeholder="Estado">
          <option value="" style={{ background: CARD_SOLID }}>Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s} style={{ background: CARD_SOLID }}>{ESTADO_THEME[s].label}</option>)}
        </GlassSelect>
        <GlassSelect value={etapa} onChange={(v) => setEtapa(v as EtapaPipelineId | "")} placeholder="Etapa">
          <option value="" style={{ background: CARD_SOLID }}>Todas las etapas</option>
          {ETAPAS_PIPELINE.map((e) => <option key={e.id} value={e.id} style={{ background: CARD_SOLID }}>E{e.numero} · {e.titulo}</option>)}
        </GlassSelect>
        <GlassSelect value={banco} onChange={setBanco} placeholder="Banco">
          <option value="" style={{ background: CARD_SOLID }}>Todos los bancos</option>
          {bancos.map((b) => <option key={b} value={b} style={{ background: CARD_SOLID }}>{b}</option>)}
        </GlassSelect>
        <GlassSelect value={analistaId} onChange={setAnalistaId} placeholder="Analista">
          <option value="" style={{ background: CARD_SOLID }}>Todos los analistas</option>
          {analistasList.map(([id, name]) => <option key={id} value={id} style={{ background: CARD_SOLID }}>{name}</option>)}
        </GlassSelect>
        <GlassSelect value={modalidad} onChange={setModalidad} placeholder="Modalidad">
          <option value="" style={{ background: CARD_SOLID }}>Todas</option>
          <option value="pesos" style={{ background: CARD_SOLID }}>PESOS</option>
          <option value="uvr" style={{ background: CARD_SOLID }}>UVR</option>
        </GlassSelect>
        <button
          type="button"
          onClick={() => setMios(!mios)}
          disabled={!user?.id}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-11 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50 whitespace-nowrap"
          style={{
            background: mios ? `linear-gradient(135deg, ${AZUL}, ${VERDE})` : "rgba(255,255,255,0.04)",
            color: mios ? "#fff" : TEXT2,
            border: `1px solid ${mios ? "transparent" : BORDER}`,
          }}
        >
          <Sparkles size={11} /> Míos
        </button>
      </section>

      {/* ============ TIMELINE CARDS ============ */}
      <section className="space-y-2.5">
        {err && (
          <div className="rounded-xl p-4 text-sm" style={{ background: "rgba(180,35,24,0.1)", border: "1px solid rgba(180,35,24,0.3)", color: "#FCA5A5" }}>
            {err}
          </div>
        )}
        {loading ? (
          <div className="py-24 text-center text-sm flex items-center justify-center gap-2" style={{ color: TEXT2 }}>
            <Loader2 size={14} className="animate-spin" /> Cargando expedientes…
          </div>
        ) : filteredRows.length === 0 ? (
          <div
            className="py-20 text-center text-sm rounded-2xl"
            style={{ background: CARD, border: `1px solid ${BORDER}`, color: TEXT2 }}
          >
            No hay expedientes que coincidan.{" "}
            {!search && !estado && !mios && (
              <>Crea tu primer caso desde el{" "}
                <Link to="/inicio" className="font-semibold hover:underline" style={{ color: VERDE }}>simulador</Link>.
              </>
            )}
          </div>
        ) : (
          <>

            {filteredRows.map((r) => (
              <TimelineCard
                key={r.id}
                r={r}
                isDup={!!r.cedula && dupCedulas.has(r.cedula.trim())}
                asesor={asesores.get(r.asesor_id)}
                licenciado={r.licenciado_id ? asesores.get(r.licenciado_id) : undefined}
                auditCode={r.qa_auditoria_id ? auditCodes.get(r.qa_auditoria_id) : undefined}
                onAudited={() => setReloadKey((k) => k + 1)}
              />
            ))}
          </>
        )}
      </section>
    </PageLayout>
  );
}

/* =====================================================
   HOLOGRAM
   ===================================================== */
function NuviaHologram() {
  // Holograma tipo mockup: stack de folders/expedientes proyectados sobre base circular de energía
  const CYAN = "#4FC3F7";
  return (
    <div className="relative w-[320px] h-[320px] flex items-end justify-center select-none">
      {/* ================= BASE HOLOGRÁFICA ================= */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[300px] h-[130px]" style={{ perspective: 600 }}>
        {/* Glow radial base */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 70%, ${CYAN}55 0%, ${AZUL}33 30%, transparent 65%)`,
            filter: "blur(14px)",
          }}
        />
        {/* Anillos concéntricos elípticos */}
        {[0, 1, 2, 3].map((i) => (
          <div
            key={`ring${i}`}
            className="absolute left-1/2 pointer-events-none rounded-full"
            style={{
              bottom: 10 + i * 3,
              width: 260 - i * 40,
              height: (260 - i * 40) * 0.28,
              transform: "translateX(-50%)",
              border: `1.5px solid ${CYAN}${i === 0 ? "AA" : i === 1 ? "77" : "44"}`,
              boxShadow: `0 0 18px ${CYAN}66, inset 0 0 12px ${CYAN}33`,
              animation: `holoRingPulse ${2.5 + i * 0.4}s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
        {/* Anillo punteado exterior con rotación */}
        <div
          className="absolute left-1/2 pointer-events-none rounded-full"
          style={{
            bottom: 4,
            width: 300,
            height: 84,
            transform: "translateX(-50%)",
            border: `1.5px dashed ${CYAN}88`,
            animation: "holoBaseSpin 20s linear infinite",
          }}
        />
        {/* Beams verticales que emergen de la base */}
        {[-70, -35, 0, 35, 70].map((x, idx) => (
          <div
            key={`beam${idx}`}
            className="absolute bottom-8 pointer-events-none"
            style={{
              left: `calc(50% + ${x}px)`,
              width: 1,
              height: 90 + Math.abs(x) * 0.2,
              background: `linear-gradient(to top, ${CYAN}CC, ${CYAN}00)`,
              boxShadow: `0 0 6px ${CYAN}`,
              animation: `holoBeam ${1.8 + idx * 0.3}s ease-in-out ${idx * 0.15}s infinite`,
              opacity: 0.65,
            }}
          />
        ))}
      </div>

      {/* ================= STACK DE EXPEDIENTES ================= */}
      <div
        className="relative"
        style={{
          animation: "holoFloat 4s ease-in-out infinite",
          filter: `drop-shadow(0 0 22px ${CYAN}66) drop-shadow(0 0 40px ${AZUL}55)`,
        }}
      >
        <FolderStack cyan={CYAN} />
      </div>

      {/* ================= ANILLOS ORBITALES DEL STACK ================= */}
      {[0, 1].map((i) => (
        <div
          key={`orbit${i}`}
          className="absolute left-1/2 top-[50%] pointer-events-none rounded-full"
          style={{
            width: 240 + i * 30,
            height: 240 + i * 30,
            transform: `translate(-50%, -60%) rotateX(72deg)`,
            border: `1px ${i === 0 ? "solid" : "dashed"} ${CYAN}${i === 0 ? "55" : "33"}`,
            animation: `holoOrbit${i} ${16 + i * 6}s linear ${i % 2 ? "reverse" : ""} infinite`,
          }}
        >
          {/* partícula orbitando */}
          <div
            className="absolute rounded-full"
            style={{
              top: -3, left: "50%",
              width: 5, height: 5,
              background: CYAN,
              boxShadow: `0 0 10px ${CYAN}, 0 0 20px ${CYAN}`,
              transform: "translateX(-50%)",
            }}
          />
        </div>
      ))}

      {/* ================= PARTÍCULAS FLOTANTES ================= */}
      {[
        { x: -100, y: -40, d: 3.2 },
        { x: 110, y: -60, d: 3.8 },
        { x: -80, y: 20, d: 2.6 },
        { x: 90, y: 40, d: 3.4 },
        { x: 0, y: -110, d: 2.8 },
      ].map((p, i) => (
        <div
          key={`p${i}`}
          className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
          style={{
            width: 3, height: 3,
            background: CYAN,
            boxShadow: `0 0 8px ${CYAN}`,
            transform: `translate(${p.x}px, ${p.y}px)`,
            animation: `holoParticle ${p.d}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes holoFloat {
          0%, 100% { transform: translateY(-6px); }
          50%      { transform: translateY(-14px); }
        }
        @keyframes holoRingPulse {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        @keyframes holoBaseSpin {
          from { transform: translateX(-50%) rotate(0deg); }
          to   { transform: translateX(-50%) rotate(360deg); }
        }
        @keyframes holoBeam {
          0%, 100% { opacity: 0.25; transform: scaleY(0.9); }
          50%      { opacity: 0.9;  transform: scaleY(1.15); }
        }
        @keyframes holoOrbit0 {
          from { transform: translate(-50%, -60%) rotateX(72deg) rotateZ(0deg); }
          to   { transform: translate(-50%, -60%) rotateX(72deg) rotateZ(360deg); }
        }
        @keyframes holoOrbit1 {
          from { transform: translate(-50%, -60%) rotateX(72deg) rotateZ(0deg); }
          to   { transform: translate(-50%, -60%) rotateX(72deg) rotateZ(360deg); }
        }
        @keyframes holoParticle {
          0%, 100% { opacity: 0.4; transform: translate(var(--tx,0), var(--ty,0)) scale(1); }
          50%      { opacity: 1;   transform: translate(var(--tx,0), var(--ty,0)) scale(1.6); }
        }
      `}</style>
    </div>
  );
}

/** Stack de 3 folders holográficos (SVG) con NUVEX+ label */
function FolderStack({ cyan }: { cyan: string }) {
  const Folder = ({ offset, opacity, scale }: { offset: number; opacity: number; scale: number }) => (
    <svg
      width={150 * scale} height={110 * scale} viewBox="0 0 150 110"
      className="absolute"
      style={{
        left: `calc(50% - ${(150 * scale) / 2}px + ${offset}px)`,
        top: -offset * 1.2,
        opacity,
      }}
    >
      <defs>
        <linearGradient id={`fg${offset}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={cyan} stopOpacity="0.55" />
          <stop offset="60%" stopColor={AZUL} stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0A1628" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`fgTop${offset}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cyan} stopOpacity="0.9" />
          <stop offset="100%" stopColor={AZUL} stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Tab superior */}
      <path
        d="M4 18 L58 18 L68 8 L146 8 L146 22 L4 22 Z"
        fill={`url(#fgTop${offset})`}
        stroke={cyan} strokeWidth="1.2" strokeOpacity="0.9"
      />
      {/* Cuerpo folder */}
      <rect
        x="4" y="20" width="142" height="82" rx="4"
        fill={`url(#fg${offset})`}
        stroke={cyan} strokeWidth="1.4" strokeOpacity="0.95"
      />
      {/* Scanlines horizontales */}
      {[32, 42, 52, 62, 72, 82, 92].map((y) => (
        <line key={y} x1="12" y1={y} x2="138" y2={y} stroke={cyan} strokeOpacity="0.12" strokeWidth="0.6" />
      ))}
      {/* Esquinas iluminadas */}
      <path d="M4 26 L4 20 L10 20" fill="none" stroke={cyan} strokeWidth="1.6" />
      <path d="M146 20 L146 26" fill="none" stroke={cyan} strokeWidth="1.6" />
      <path d="M4 96 L4 102 L10 102" fill="none" stroke={cyan} strokeWidth="1.6" />
      <path d="M146 102 L140 102" fill="none" stroke={cyan} strokeWidth="1.6" />
    </svg>
  );

  return (
    <div className="relative" style={{ width: 180, height: 150 }}>
      {/* Folders traseros → frontal */}
      <Folder offset={14} opacity={0.5} scale={0.95} />
      <Folder offset={7} opacity={0.75} scale={0.98} />
      <Folder offset={0} opacity={1} scale={1} />

      {/* Label NUVEX+ centrado en el folder frontal */}
      <div
        className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2 flex items-center gap-1"
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        }}
      >
        <span
          className="text-[15px] font-black tracking-[0.14em]"
          style={{ color: "#E8F5FF", textShadow: `0 0 10px ${cyan}, 0 0 20px ${cyan}` }}
        >
          NUVEX
        </span>
        <span
          className="text-[15px] font-black"
          style={{ color: cyan, textShadow: `0 0 10px ${cyan}` }}
        >
          +
        </span>
      </div>

      {/* Scan line vertical animada sobre el folder frontal */}
      <div
        className="absolute pointer-events-none overflow-hidden rounded-md"
        style={{ left: "50%", top: 6, transform: "translateX(-50%)", width: 148, height: 96 }}
      >
        <div
          className="absolute left-0 right-0"
          style={{
            height: 3,
            background: `linear-gradient(90deg, transparent, ${cyan}, transparent)`,
            boxShadow: `0 0 12px ${cyan}`,
            animation: "holoScan 3s linear infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes holoScan {
          0%   { top: -6px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100px; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function LivePipeline({ pipeline }: { pipeline: { sim: number; qa: number; rad: number; apr: number; firm: number } }) {
  const items = [
    { label: "SIMULADO", value: pipeline.sim, color: AZUL, icon: <Sparkles size={10} /> },
    { label: "QA", value: pipeline.qa, color: "#0EA5E9", icon: <ShieldCheck size={10} /> },
    { label: "RADICADO", value: pipeline.rad, color: "#F97316", icon: <FileText size={10} /> },
    { label: "APROBADO", value: pipeline.apr, color: VERDE, icon: <CheckCircle2 size={10} /> },
    { label: "FIRMADO", value: pipeline.firm, color: "#9333EA", icon: <Flag size={10} /> },
  ];
  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 w-[140px]">
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg backdrop-blur-lg transition hover:scale-[1.03]"
          style={{
            background: `linear-gradient(90deg, ${it.color}18, rgba(10,22,40,0.6))`,
            border: `1px solid ${it.color}44`,
            boxShadow: `0 0 12px -4px ${it.color}55`,
          }}
        >
          <div className="flex items-center gap-1.5" style={{ color: it.color }}>
            {it.icon}
            <span className="text-[9px] font-bold uppercase tracking-wider">{it.label}</span>
          </div>
          <span className="text-[12px] font-black tabular-nums text-white">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

/* =====================================================
   MICRO STAT
   ===================================================== */
function MicroStat({ icon, label, value, tone, small }: { icon: React.ReactNode; label: string; value: string; tone: "blue" | "green"; small?: boolean }) {
  const c = tone === "blue" ? AZUL : VERDE;
  return (
    <div
      className="relative rounded-xl px-3 py-2.5 backdrop-blur-xl overflow-hidden group transition hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${BORDER_STRONG}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div className="absolute -top-8 -right-8 w-16 h-16 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity" style={{ background: c }} />
      <div className="relative flex items-center gap-1.5 mb-1" style={{ color: c }}>
        {icon}
        <span className="text-[9.5px] font-bold uppercase tracking-[0.15em]">{label}</span>
      </div>
      <div className={`relative font-black tabular-nums leading-none text-white ${small ? "text-[15px]" : "text-[20px]"}`}>
        {value}
      </div>
    </div>
  );
}

/* =====================================================
   IA CARD
   ===================================================== */
function IACard({
  tone, icon, title, value, hint, cta, onClick,
}: { tone: "risk" | "opportunity" | "action"; icon: React.ReactNode; title: string; value: string; hint: string; cta: string; onClick?: () => void }) {
  const palette = tone === "risk"
    ? { fg: "#FB7185", glow: "244,63,94", ring: "rgba(244,63,94,0.45)" }
    : tone === "opportunity"
      ? { fg: VERDE, glow: "132,185,143", ring: "rgba(132,185,143,0.45)" }
      : { fg: "#A5B5E0", glow: "68,93,163", ring: "rgba(68,93,163,0.5)" };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-5 text-left backdrop-blur-xl transition hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(180deg, rgba(10,22,40,0.85), rgba(7,17,32,0.9))`,
        border: `1px solid ${palette.ring}`,
        boxShadow: `0 12px 40px -20px rgba(${palette.glow},0.6), inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      <div
        className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-30 group-hover:opacity-60 transition-opacity"
        style={{ background: palette.fg }}
      />
      <div className="relative flex items-start justify-between mb-3">
        <div
          className="inline-flex items-center justify-center w-9 h-9 rounded-xl"
          style={{
            background: `linear-gradient(135deg, rgba(${palette.glow},0.25), rgba(${palette.glow},0.08))`,
            border: `1px solid ${palette.ring}`,
            color: palette.fg,
            boxShadow: `0 0 20px -4px rgba(${palette.glow},0.6)`,
          }}
        >
          {icon}
        </div>
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em]" style={{ color: palette.fg }}>
          {tone === "risk" ? "Riesgo" : tone === "opportunity" ? "Oportunidad" : "Acción"}
        </span>
      </div>
      <div className="relative">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: TEXT2 }}>
          {title}
        </div>
        <div className="text-[15px] font-bold text-white leading-tight line-clamp-2" title={value}>
          {value}
        </div>
        <div className="text-[11px] mt-1.5" style={{ color: TEXT2 }}>{hint}</div>
      </div>
      <div className="relative mt-4 inline-flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider transition group-hover:gap-2.5" style={{ color: palette.fg }}>
        {cta} <ArrowUpRight size={12} />
      </div>
    </button>
  );
}

/* =====================================================
   GLASS SELECT
   ===================================================== */
function GlassSelect({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={placeholder}
        className="h-11 min-w-[130px] bg-transparent pl-3 pr-8 text-[11.5px] font-semibold outline-none appearance-none cursor-pointer rounded-lg transition hover:bg-white/[0.04]"
        style={{ color: value ? "#fff" : TEXT2, border: `1px solid ${BORDER}` }}
      >
        {children}
      </select>
      <ArrowRight size={11} className="absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" style={{ color: TEXT2 }} />
    </div>
  );
}

/* =====================================================
   TIMELINE CARD — compact executive density
   ===================================================== */
function TimelineCard({
  r, isDup = false, asesor, licenciado, auditCode, onAudited,
}: { r: Expediente; isDup?: boolean; asesor?: { nombre?: string | null; email?: string | null }; licenciado?: { nombre?: string | null; email?: string | null }; auditCode?: string; onAudited?: () => void }) {
  const [auditando, setAuditando] = useState(false);
  const puedeAuditar = !r.qa_auditoria_id;

  const runAuditoria = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (auditando) return;
    setAuditando(true);
    try {
      const cd = (r.credito_data ?? {}) as Record<string, unknown>;
      const pd = (r.propuesta_data ?? {}) as Record<string, unknown>;
      await triggerSimuladorAutoQA({
        expedienteId: r.id,
        raw: {
          banco: r.banco ?? undefined,
          producto: r.producto ?? undefined,
          moneda: r.modo === "uvr" ? "UVR" : "PESOS",
          datos: { ...cd, ...pd, banco: r.banco, producto: r.producto, modo: r.modo, cedula: r.cedula, cliente: r.cliente_nombre },
        },
      });
      onAudited?.();
    } finally { setAuditando(false); }
  };

  const theme = ESTADO_THEME[r.estado];
  const aColor = avatarColor(r.cliente_nombre);
  const initial = (r.cliente_nombre || "?").trim().charAt(0).toUpperCase();

  const etapaId = computeEtapaActual({ estado_caso: r.estado_caso ?? null });
  const etapa = getEtapaById(etapaId);
  const umbral = UMBRAL_DIAS_ETAPA[etapaId] ?? 0;
  const dias = diasDesde(r.updated_at);
  const nivel = slaNivel(dias, umbral);
  const slaTheme = SLA_COLORS[nivel];
  const slaLabel = nivel === "critico" ? `${dias}d · SLA ${umbral}d` : nivel === "atencion" ? `${dias}d / ${umbral}d` : `${dias}d`;

  const qaScore = r.qa_score ?? null;
  const qaCat = (r.qa_categoria ?? "").toString().toUpperCase();
  const qaFailed = qaCat.includes("FAIL") || qaCat.includes("RECHAZ") || (qaScore !== null && qaScore < 70);

  // Progress: current milestone
  const currentIdx = MILESTONES.findIndex((m) => etapa.numero <= m.etapa);
  const activeIdx = currentIdx === -1 ? MILESTONES.length - 1 : currentIdx;

  // Per-stage glow color (SIM/QA/RAD/APR/FIRM)
  const STAGE_GLOW = ["#445DA3", "#F5C542", "#F97316", "#84B98F", "#22FF88"];
  const stageColor = STAGE_GLOW[activeIdx] ?? AZUL;

  // Analista display
  const analistaNombre = licenciado?.nombre || licenciado?.email || asesor?.nombre || asesor?.email || "";
  const analistaEmail  = licenciado?.email || asesor?.email || null;
  const initialsOf = (n: string) => {
    const clean = n.replace(/@.*$/, "").replace(/[._-]+/g, " ").trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };
  const analistaIni = analistaNombre ? initialsOf(analistaNombre) : "";

  // Health score (presentational): prefer QA score, fallback SLA-based
  const healthScore = qaScore != null
    ? Math.round(qaScore)
    : nivel === "critico" ? 42 : nivel === "atencion" ? 68 : 88;
  const healthColor = healthScore >= 80 ? VERDE : healthScore >= 60 ? "#F5C542" : "#FB7185";

  // Priority (presentational, from SLA)
  const prioridad = nivel === "critico" ? { label: "Alta", color: "#FB7185" }
                  : nivel === "atencion" ? { label: "Media", color: "#F59E0B" }
                  : { label: "Normal", color: VERDE };

  return (
    <div
      className="group relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(180deg, rgba(10,22,40,0.75), rgba(7,17,32,0.88))`,
        border: `1px solid ${BORDER}`,
        boxShadow: `0 6px 24px -12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      {/* Lateral glow bar — stage */}
      <span
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${stageColor}, ${stageColor}20)`,
          boxShadow: `0 0 22px ${stageColor}88, 0 0 44px ${stageColor}44`,
        }}
      />
      {/* Hover glow */}
      <span
        className="absolute -right-20 top-1/2 -translate-y-1/2 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-25 blur-3xl pointer-events-none"
        style={{ background: stageColor }}
      />

      <div
        className="relative grid gap-4 px-5 py-3.5 items-center"
        style={{ gridTemplateColumns: "minmax(0,30fr) minmax(0,35fr) minmax(200px,20fr) minmax(150px,15fr)" }}
      >
        {/* ============ 1 · CLIENTE (30%) ============ */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with stage-aware glow */}
          <div className="relative shrink-0">
            <span
              className="absolute inset-0 rounded-2xl blur-lg opacity-70"
              style={{ background: stageColor }}
            />
            <div
              className="relative flex items-center justify-center rounded-2xl text-[16px] font-black text-white"
              style={{
                width: 50, height: 50,
                background: `linear-gradient(135deg, ${aColor}, ${aColor}AA)`,
                border: `1.5px solid ${stageColor}`,
                boxShadow: `0 0 18px ${stageColor}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
              }}
            >
              {initial}
            </div>
            {/* stage ring pulse */}
            <span
              className="absolute -inset-1 rounded-2xl border pointer-events-none animate-pulse"
              style={{ borderColor: `${stageColor}55` }}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(68,93,163,0.15)", color: "#A5B5E0", border: `1px solid ${AZUL}55` }}
                title={etapa.descripcion}
              >
                <Flag size={8} /> E{etapa.numero}
              </span>
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider"
                style={{ background: slaTheme.bg, color: slaTheme.fg, border: `1px solid ${slaTheme.border}` }}
              >
                <Clock size={8} /> {slaLabel}
              </span>
              {isDup && (
                <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider"
                  style={{ background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.4)" }}>Dup</span>
              )}
            </div>
            <div className="font-bold text-[13.5px] leading-tight truncate text-white" title={r.cliente_nombre || "Sin nombre"}>
              {r.cliente_nombre || "Sin nombre"}
            </div>
            <div className="flex items-center gap-1.5 text-[10.5px] mt-0.5 min-w-0" style={{ color: TEXT2 }}>
              <Building2 size={9} className="shrink-0" />
              <span className="truncate">{r.banco || "—"}</span>
              <span className="text-white/20">·</span>
              <span className="truncate">Nº {r.numero_credito || r.cedula || "—"}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[9.5px]" style={{ color: TEXT2 }}>
              <span className="uppercase tracking-wide">{r.producto || "—"}</span>
              <span className="text-white/20">·</span>
              <span className="font-bold" style={{ color: AZUL }}>{r.modo.toUpperCase()}</span>
            </div>
            {/* Analista badge */}
            {analistaNombre && (
              <div className="inline-flex items-center gap-1.5 mt-1.5 pl-0.5 pr-2 py-0.5 rounded-full"
                   style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${BORDER}` }}
                   title={`Analista · ${analistaNombre}`}>
                <span className="inline-flex items-center justify-center rounded-full text-[8.5px] font-black text-white"
                      style={{ width: 18, height: 18, background: `linear-gradient(135deg, ${AZUL}, ${VERDE})` }}>
                  {analistaIni || <AnalistaAvatar nombre={analistaNombre} email={analistaEmail} size={14} />}
                </span>
                <span className="text-[10px] font-semibold truncate max-w-[160px]" style={{ color: "#CBD5E1" }}>
                  {analistaNombre}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ============ 2 · PIPELINE (35%) ============ */}
        <div className="min-w-0 px-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8.5px] font-bold uppercase tracking-[0.22em]" style={{ color: TEXT2 }}>Pipeline</span>
            <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: stageColor, textShadow: `0 0 10px ${stageColor}88` }}>
              {MILESTONES[activeIdx]?.label ?? "—"}
            </span>
          </div>
          <div className="relative">
            {/* rail */}
            <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-[2px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
            {/* filled rail */}
            <div
              className="absolute left-1 top-1/2 -translate-y-1/2 h-[2px] rounded-full transition-all duration-500"
              style={{
                width: `calc((100% - 8px) * ${activeIdx / (MILESTONES.length - 1)})`,
                background: `linear-gradient(90deg, ${AZUL}, ${stageColor})`,
                boxShadow: `0 0 10px ${stageColor}`,
              }}
            />
            <div className="relative flex items-center justify-between">
              {MILESTONES.map((m, i) => {
                const done = i <= activeIdx;
                const active = i === activeIdx;
                const nodeColor = STAGE_GLOW[i] ?? AZUL;
                return (
                  <div key={m.key} className="flex flex-col items-center gap-1">
                    <div
                      className="relative rounded-full transition-all"
                      style={{
                        width: active ? 14 : 10, height: active ? 14 : 10,
                        background: done ? `linear-gradient(135deg, ${AZUL}, ${nodeColor})` : "rgba(255,255,255,0.08)",
                        border: `1.5px solid ${done ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.1)"}`,
                        boxShadow: active ? `0 0 12px ${nodeColor}, 0 0 24px ${nodeColor}66` : done ? `0 0 6px ${nodeColor}55` : "none",
                      }}
                    >
                      {active && (
                        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: nodeColor, opacity: 0.5 }} />
                      )}
                    </div>
                    <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: done ? "#E2E8F0" : TEXT2 }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Health score */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.18em] shrink-0" style={{ color: TEXT2 }}>
              <Activity size={9} /> Health
            </div>
            <div className="relative flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                style={{
                  width: `${healthScore}%`,
                  background: `linear-gradient(90deg, ${AZUL}, ${healthColor})`,
                  boxShadow: `0 0 10px ${healthColor}88`,
                }}
              />
            </div>
            <div className="text-[10.5px] font-black tabular-nums shrink-0" style={{ color: healthColor, textShadow: `0 0 10px ${healthColor}66` }}>
              {healthScore}%
            </div>
          </div>
        </div>

        {/* ============ 3 · CONTROL (20%) ============ */}
        <div className="min-w-0 rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
             style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${BORDER}` }}>
          <div className="text-[8px] font-bold uppercase tracking-[0.22em]" style={{ color: TEXT2 }}>Honorarios</div>
          <div className="text-[19px] font-black tabular-nums leading-none" style={{ color: VERDE, textShadow: `0 0 16px ${VERDE}44` }}>
            {formatCOP(Number(r.honorarios_final))}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <QABadge categoria={r.qa_categoria ?? null} score={r.qa_score ?? null} auditoriaId={r.qa_auditoria_id ?? null} size="xs" asLink={false} />
            <span
              className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[8.5px] font-bold uppercase tracking-wider"
              style={{
                background: qaFailed ? "rgba(244,63,94,0.12)" : `${theme.color}1A`,
                color: qaFailed ? "#FB7185" : theme.color,
                border: `1px solid ${qaFailed ? "rgba(244,63,94,0.45)" : theme.color + "55"}`,
              }}
            >
              <span className="h-1 w-1 rounded-full" style={{ background: qaFailed ? "#FB7185" : theme.color }} />
              {qaFailed ? "QA FAIL" : theme.label}
            </span>
            <span
              className="inline-flex items-center gap-1 px-1.5 py-[2px] rounded-full text-[8.5px] font-bold uppercase tracking-wider"
              style={{ background: `${prioridad.color}1A`, color: prioridad.color, border: `1px solid ${prioridad.color}55` }}
              title="Prioridad operativa"
            >
              <Zap size={8} /> {prioridad.label}
            </span>
            {auditCode && (
              <Link
                to="/qa-ai/$id" params={{ id: r.qa_auditoria_id ?? "" }} onClick={(e) => e.stopPropagation()}
                title="Ir a la auditoría QA"
                className="rounded px-1.5 py-[2px] text-[8px] font-bold uppercase tracking-wider hover:brightness-125 transition truncate max-w-full"
                style={{
                  background: "rgba(68,93,163,0.15)", color: "#A5B5E0",
                  border: "1px solid rgba(68,93,163,0.45)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >{auditCode}</Link>
            )}
          </div>
        </div>

        {/* ============ 4 · ACCIONES (15%) ============ */}
        <div className="flex flex-col gap-1.5 shrink-0 w-full">
          <Link
            to="/casos/$id" params={{ id: r.id }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-8 text-[10px] font-bold uppercase tracking-wider text-white transition hover:brightness-110 whitespace-nowrap w-full"
            style={{ background: `linear-gradient(135deg, ${AZUL}, ${VERDE})`, boxShadow: `0 6px 18px -8px ${AZUL}` }}
          >
            Ver expediente <ArrowRight size={11} />
          </Link>
          <Link
            to="/casos/$id" params={{ id: r.id }} search={{ tab: "trazabilidad" } as never}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-7 text-[9.5px] font-semibold uppercase tracking-wider transition whitespace-nowrap w-full hover:bg-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.03)", color: TEXT2, border: `1px solid ${BORDER}` }}
          >
            Timeline
          </Link>
          <Link
            to="/casos/$id" params={{ id: r.id }} search={{ tab: "snapshot" } as never}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 h-7 text-[9.5px] font-semibold uppercase tracking-wider transition whitespace-nowrap w-full hover:brightness-125"
            style={{ background: "rgba(132,185,143,0.08)", color: VERDE, border: `1px solid ${VERDE}44` }}
          >
            Documentos
          </Link>
          {puedeAuditar && (
            <button
              type="button" onClick={runAuditoria} disabled={auditando}
              title="Ejecutar auditoría NUVIA"
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 h-7 text-[9.5px] font-bold uppercase tracking-wider transition hover:brightness-125 disabled:opacity-60 whitespace-nowrap w-full"
              style={{
                background: "linear-gradient(135deg, rgba(132,185,143,0.16), rgba(68,93,163,0.16))",
                color: "#B8E5C0", border: "1px solid rgba(132,185,143,0.45)",
              }}
            >
              {auditando ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
              {auditando ? "Auditando…" : "Auditar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

