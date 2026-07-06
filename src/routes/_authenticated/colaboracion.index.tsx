import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Hash, Users, Bell, Plus, FolderKanban, MessagesSquare,
  Search, Filter, Shield, Briefcase, Building2, Scale, ClipboardCheck, Calculator,
  FileText, Activity, Clock, Sparkles, AlertTriangle, TrendingUp, Zap, ChevronRight, Radio,
  UserRound, Gauge, CreditCard, CalendarDays, ArrowUpRight, ChevronDown,
  Landmark, HeartHandshake,
} from "lucide-react";
import { PageLayout } from "@/components/nuvia";
import { CanalChat } from "@/components/colaboracion/CanalChat";
import {
  type Canal, listCanales, crearCanal, listDirectorio, getOrCreateDM,
  listMisNotifColab, marcarTodasNotifLeidas, type NotifColab,
} from "@/lib/colaboracion";
import { UserAvatar } from "@/components/nuvex/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useExpedientesLive } from "@/hooks/useExpedientesLive";
import { usePresenciaOnline } from "@/hooks/usePresenciaOnline";
import { getEtapaById, type EtapaPipelineId } from "@/lib/pipelineEtapas";

type CreditInfo = {
  caso_id?: string;
  cliente?: string;
  banco?: string;
  analista?: string;
  asesor_id?: string;
  numero_credito?: string;
  producto?: string;
  created_at?: string;
  qa_score?: number | null;
  qa_auditoria_id?: string | null;
  auditoria_id?: string | null;
  auditoria_created_at?: string | null;
  audit_code?: string | null;
};

type HeaderTarget =
  | { kind: "case"; casoId: string; tab: string }
  | { kind: "audit"; auditoriaId: string };

export const Route = createFileRoute("/_authenticated/colaboracion/")({
  component: ColaboracionPage,
  validateSearch: (s: Record<string, unknown>) => ({
    canal: (s.canal as string) || "",
    tab: (s.tab as string) || "war",
  }),
  head: () => ({ meta: [{ title: "NUVIA · Collab · War Room" }] }),
});

// ---------- Team channel definitions (branded) ----------
const TEAM_CHANNELS: { key: string; label: string; match: RegExp; icon: typeof Hash; accent: string; group: "ops" | "direccion" | "soporte" }[] = [
  { key: "comercial",          label: "Comercial",           match: /comercial/i,                       icon: Briefcase,      accent: "#3B82F6", group: "ops" },
  { key: "juridica",           label: "Jurídica",            match: /jur[ií]dic(?!.*direcci)|^legal/i,  icon: Scale,          accent: "#8B5CF6", group: "ops" },
  { key: "operaciones",        label: "Operaciones",         match: /operacion|^ops/i,                  icon: Building2,      accent: "#22D3EE", group: "ops" },
  { key: "qa",                 label: "QA",                  match: /qa|calidad|auditor/i,              icon: ClipboardCheck, accent: "#10B981", group: "ops" },
  { key: "contabilidad",       label: "Contabilidad",        match: /contab|conta(?!.*direcci)/i,       icon: Calculator,     accent: "#EC4899", group: "ops" },
  { key: "gerencia",           label: "Gerencia",            match: /gerencia|ceo/i,                    icon: Shield,         accent: "#F59E0B", group: "direccion" },
  { key: "direccion_fin",      label: "Dirección Financiera",match: /direcci[oó]n.*(financ|conta)/i,    icon: Landmark,       accent: "#38BDF8", group: "direccion" },
  { key: "direccion_jur",      label: "Dirección Jurídica",  match: /direcci[oó]n.*jur[ií]dic/i,        icon: Scale,          accent: "#A78BFA", group: "direccion" },
  { key: "talento",            label: "Talento Humano",      match: /talento|rrhh|humanos|people/i,     icon: HeartHandshake, accent: "#F472B6", group: "soporte" },
];

// Macro-etapas visibles en el War Room (agrupan las 15 etapas del pipeline).
type MacroEtapa = "SIMULADO" | "QA" | "RADICADO" | "APROBADO" | "FIRMA" | "FINALIZADO";
const MACRO_ETAPAS: { id: MacroEtapa; label: string; accent: string; matches: EtapaPipelineId[] }[] = [
  { id: "SIMULADO",   label: "Simulado",  accent: "#3B82F6", matches: ["lead", "extracto", "proyeccion", "presentacion", "cierre"] },
  { id: "QA",         label: "QA",        accent: "#10B981", matches: ["contratacion"] },
  { id: "RADICADO",   label: "Radicado",  accent: "#22D3EE", matches: ["radicacion", "banco"] },
  { id: "APROBADO",   label: "Aprobado",  accent: "#A78BFA", matches: ["resultado_banco", "aceptacion_cliente", "informe"] },
  { id: "FIRMA",      label: "Firma",     accent: "#F59E0B", matches: ["cuenta", "pago", "comision", "paz_salvo"] },
  { id: "FINALIZADO", label: "Finalizado",accent: "#6EE7B7", matches: ["finalizado"] },
];
const macroFromEtapa = (etapa?: EtapaPipelineId | null): MacroEtapa => {
  if (!etapa) return "SIMULADO";
  return MACRO_ETAPAS.find((m) => m.matches.includes(etapa))?.id ?? "SIMULADO";
};

const asPlainObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const textFrom = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return undefined;
};

const numberFrom = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

function ColaboracionPage() {
  const { user, loading: authLoading } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [canales, setCanales] = useState<Canal[]>([]);
  const [tab, setTab] = useState<string>(search.tab || "war");
  const [notifs, setNotifs] = useState<NotifColab[]>([]);
  const [dir, setDir] = useState<Awaited<ReturnType<typeof listDirectorio>>>([]);
  const [showNew, setShowNew] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDesc, setNuevoDesc] = useState("");
  const [nuevoPriv, setNuevoPriv] = useState(false);
  const [caseQuery, setCaseQuery] = useState("");
  const [casePriority, setCasePriority] = useState<"todos" | "alta" | "media" | "baja">("todos");
  const [showRight, setShowRight] = useState(true);

  const reload = () => listCanales().then(setCanales);
  useEffect(() => {
    if (authLoading || !user) return;
    reload();
    listDirectorio().then(setDir);
    listMisNotifColab().then(setNotifs);
  }, [authLoading, user?.id]);

  const canalActivo = useMemo(() => canales.find((c) => c.id === search.canal) ?? null, [canales, search.canal]);

  const canalesArea = canales.filter((c) => c.tipo === "area" || c.tipo === "custom");
  const canalesCaso = canales.filter((c) => c.tipo === "caso");

  // Realtime: etapas actualizadas de los expedientes visibles en War Room
  const casoIdsLive = useMemo(
    () => Array.from(new Set(canalesCaso.map((c) => c.caso_id).filter((x): x is string => !!x))),
    [canalesCaso],
  );
  const expLive = useExpedientesLive(casoIdsLive);

  // Presencia en tiempo real
  const online = usePresenciaOnline();

  // Ficha de crédito por canal (casos y auditorías QA)
  const [creditMap, setCreditMap] = useState<Record<string, CreditInfo>>({});
  useEffect(() => {
    const casoIds = Array.from(new Set(canales.map((c) => c.caso_id).filter((x): x is string => !!x)));
    const auditoriaIds = Array.from(new Set(canales.map((c) => c.auditoria_id).filter((x): x is string => !!x)));
    if (casoIds.length === 0 && auditoriaIds.length === 0) { setCreditMap({}); return; }
    let active = true;
    (async () => {
      type ExpRow = {
        id: string; cliente_nombre: string | null; banco: string | null; asesor_id: string | null;
        numero_credito: string | null; producto: string | null; created_at: string | null;
        qa_score: number | null; qa_auditoria_id: string | null;
      };
      type AuditRow = {
        id: string; expediente_id: string | null; analista_id: string | null; qa_score: number | null;
        cliente_nombre: string | null; banco: string | null; producto: string | null; codigo: string | null;
        created_at: string | null; ejecutado_at: string | null; inputs: unknown; simulador_snapshot: unknown;
      };

      let expRows: ExpRow[] = [];
      if (casoIds.length > 0) {
        const { data: exps } = await supabase
          .from("expedientes")
          .select("id, cliente_nombre, banco, asesor_id, numero_credito, producto, created_at, qa_score, qa_auditoria_id")
          .in("id", casoIds);
        expRows = (exps ?? []) as unknown as ExpRow[];
      }

      let auditRows: AuditRow[] = [];
      if (auditoriaIds.length > 0) {
        const { data: auds } = await supabase
          .from("qa_auditorias")
          .select("id, expediente_id, analista_id, qa_score, cliente_nombre, banco, producto, codigo, created_at, ejecutado_at, inputs, simulador_snapshot")
          .in("id", auditoriaIds);
        auditRows = (auds ?? []) as unknown as AuditRow[];
      }

      const auditExpIds = auditRows.map((r) => r.expediente_id).filter((x): x is string => !!x);
      const missingExpIds = auditExpIds.filter((id) => !expRows.some((r) => r.id === id));
      if (missingExpIds.length > 0) {
        const { data: extraExps } = await supabase
          .from("expedientes")
          .select("id, cliente_nombre, banco, asesor_id, numero_credito, producto, created_at, qa_score, qa_auditoria_id")
          .in("id", missingExpIds);
        expRows = [...expRows, ...((extraExps ?? []) as unknown as ExpRow[])];
      }

      const asesorIds = Array.from(new Set([
        ...expRows.map((r) => r.asesor_id),
        ...auditRows.map((r) => r.analista_id),
      ].filter((x): x is string => !!x)));
      let profMap: Record<string, string> = {};
      if (asesorIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, nombre").in("id", asesorIds);
        profMap = Object.fromEntries(((profs ?? []) as Array<{ id: string; nombre: string | null }>).map((p) => [p.id, p.nombre || ""]));
      }
      if (!active) return;
      const expMap = new Map(expRows.map((r) => [r.id, r]));
      const auditMap = new Map(auditRows.map((r) => [r.id, r]));
      const map: Record<string, CreditInfo> = {};

      for (const c of canales) {
        const exp = c.caso_id ? expMap.get(c.caso_id) : null;
        const audit = c.auditoria_id ? auditMap.get(c.auditoria_id) : null;
        const auditExp = audit?.expediente_id ? expMap.get(audit.expediente_id) : null;
        const snap = asPlainObject(audit?.simulador_snapshot);
        const snapDatos = asPlainObject(snap.datos);
        const inputs = asPlainObject(audit?.inputs);
        const inputExtracto = asPlainObject(inputs.extracto);
        const sourceExp = exp ?? auditExp;

        if (!sourceExp && !audit) continue;
        const analystId = sourceExp?.asesor_id ?? audit?.analista_id ?? null;
        map[c.id] = {
          caso_id: sourceExp?.id ?? audit?.expediente_id ?? c.caso_id ?? undefined,
          cliente: undefined,
          banco: undefined,
          analista: analystId ? profMap[analystId] : undefined,
          asesor_id: analystId || undefined,
          numero_credito: textFrom(sourceExp?.numero_credito, snapDatos.numeroCredito, snapDatos.numero_credito, inputs.numeroCredito),
          producto: textFrom(sourceExp?.producto, audit?.producto, snap.producto, snapDatos.producto, inputExtracto.producto),
          created_at: sourceExp?.created_at ?? audit?.created_at ?? c.created_at,
          qa_score: numberFrom(sourceExp?.qa_score, audit?.qa_score),
          qa_auditoria_id: sourceExp?.qa_auditoria_id ?? audit?.id ?? c.auditoria_id ?? null,
          auditoria_id: audit?.id ?? sourceExp?.qa_auditoria_id ?? c.auditoria_id ?? null,
          auditoria_created_at: audit?.ejecutado_at ?? audit?.created_at ?? null,
          audit_code: audit?.codigo ?? null,
        };
        map[c.id].cliente = textFrom(sourceExp?.cliente_nombre, audit?.cliente_nombre, snapDatos.cliente, snapDatos.titular, c.nombre.replace(/^QA\s*·\s*/i, "").replace(/^Caso\s*·\s*/i, ""));
        map[c.id].banco = textFrom(sourceExp?.banco, audit?.banco, snap.banco, snapDatos.banco, inputExtracto.banco, c.descripcion);
      }
      setCreditMap(map);
    })();
    return () => { active = false; };
  }, [canales.map((c) => `${c.id}:${c.caso_id || ""}:${c.auditoria_id || ""}`).join(",")]);

  const setCanal = (id: string) => navigate({ to: "/colaboracion", search: { canal: id, tab } });
  const setTabAndSync = (t: string) => { setTab(t); navigate({ to: "/colaboracion", search: { canal: search.canal, tab: t } }); };

  const crear = async () => {
    if (!nuevoNombre.trim()) return;
    const c = await crearCanal({ nombre: nuevoNombre.trim(), descripcion: nuevoDesc.trim() || undefined, privado: nuevoPriv });
    setShowNew(false); setNuevoNombre(""); setNuevoDesc(""); setNuevoPriv(false);
    await reload(); setCanal(c.id);
  };

  // Deterministic pseudo-metadata (priority/SLA) from canal id
  const hashOf = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const priorityOf = (id: string): "alta" | "media" | "baja" => (["alta", "media", "baja"] as const)[hashOf(id) % 3];
  const slaOf = (id: string) => (hashOf(id) % 7) + 1;
  const etapaOf = (id: string) => ["Radicado", "Análisis", "En Revisión", "Aprobado", "En Firma", "En Trámite"][hashOf(id) % 6];
  // Fallback determinista cuando el expediente aún no ha llegado por realtime.
  const FALLBACK_ETAPAS: EtapaPipelineId[] = ["extracto", "proyeccion", "contratacion", "radicacion", "banco", "resultado_banco", "informe"];
  const getEtapaByStableHash = (id: string) => getEtapaById(FALLBACK_ETAPAS[hashOf(id) % FALLBACK_ETAPAS.length]);

  const casesFiltered = useMemo(() => {
    const q = caseQuery.trim().toLowerCase();
    return canalesCaso.filter((c) => {
      const okQ = !q || c.nombre.toLowerCase().includes(q) || (c.descripcion || "").toLowerCase().includes(q);
      const okP = casePriority === "todos" || priorityOf(c.id) === casePriority;
      return okQ && okP;
    });
  }, [canalesCaso, caseQuery, casePriority]);

  const matchTeamChannel = (t: typeof TEAM_CHANNELS[number]) =>
    canalesArea.find((c) => t.match.test(c.nombre)) || null;

  const secondaryTabs = (
    <div className="flex items-center gap-1.5">
      {(["war", "dm", "notificaciones", "directorio"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setTabAndSync(t)}
          className="rounded-md px-2.5 py-1 text-[11px] font-semibold transition"
          style={
            tab === t
              ? { background: "rgba(16,185,129,0.15)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.35)" }
              : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.06)" }
          }
        >
          {t === "war" ? "War Room" : t === "dm" ? "DM" : t === "notificaciones" ? "Notif." : "Directorio"}
        </button>
      ))}
    </div>
  );

  return (
    <PageLayout maxWidth="full">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(1200px 600px at 15% 10%, rgba(59,130,246,0.10), transparent 60%), radial-gradient(900px 500px at 90% 20%, rgba(16,185,129,0.08), transparent 60%), radial-gradient(1000px 600px at 50% 100%, rgba(139,92,246,0.06), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
      </div>

      {/* Command header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-md blur-lg" style={{ background: "rgba(16,185,129,0.35)" }} />
            <div className="relative flex items-center gap-2 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-[0.18em]" style={{ background: "rgba(16,185,129,0.12)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.35)" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
              NUVIA · COLLAB
            </div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            <Radio size={11} style={{ color: "#10B981" }} /> Live · <span style={{ color: "rgba(255,255,255,0.75)" }}>{canales.length} canales</span> · <span style={{ color: "rgba(255,255,255,0.75)" }}>{canalesCaso.length} casos</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {secondaryTabs}
          <button onClick={() => setShowRight((v) => !v)} className="hidden lg:inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <Sparkles size={11} /> Case IQ {showRight ? "·" : "·"}
          </button>
        </div>
      </div>

      {tab === "war" && (
        <div
          className={`grid gap-3 grid-cols-1 md:[grid-template-columns:260px_minmax(0,1fr)] lg:[grid-template-columns:220px_280px_minmax(0,1fr)] ${showRight ? "2xl:[grid-template-columns:220px_300px_minmax(0,1fr)_300px]" : "2xl:[grid-template-columns:220px_300px_minmax(0,1fr)]"}`}
          style={{ height: "calc(100dvh - 190px)" }}
        >
          {/* --------- COLUMN 1: TEAM CHANNELS --------- */}
          <GlassPanel className="hidden lg:flex">
            <PanelHeader label="TEAM CHANNELS" accent="#22D3EE" right={<button onClick={() => setShowNew(true)} className="rounded-md p-1 transition hover:bg-white/10" style={{ color: "rgba(255,255,255,0.6)" }}><Plus size={13} /></button>} />
            <div className="p-2 overflow-y-auto flex-1">
              {(["ops", "direccion", "soporte"] as const).map((grp) => {
                const items = TEAM_CHANNELS.filter((t) => t.group === grp);
                if (!items.length) return null;
                const label = grp === "ops" ? "OPERACIÓN" : grp === "direccion" ? "DIRECCIÓN" : "SOPORTE";
                return (
                  <div key={grp} className="mb-2">
                    <div className="px-2 mb-1 text-[9px] font-bold tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.32)" }}>{label}</div>
                    <div className="space-y-1">
                      {items.map((t) => {
                        const canal = matchTeamChannel(t);
                        const active = canal && canalActivo?.id === canal.id;
                        const unread = canal ? hashOf(t.key) % 5 : 0;
                        return (
                          <button
                            key={t.key}
                            onClick={() => canal && setCanal(canal.id)}
                            disabled={!canal}
                            className="group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-all relative overflow-hidden"
                            style={active
                              ? { background: `linear-gradient(90deg, ${t.accent}22, transparent 80%)`, border: `1px solid ${t.accent}55` }
                              : { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                          >
                            {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full" style={{ background: t.accent, boxShadow: `0 0 10px ${t.accent}` }} />}
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition group-hover:scale-110" style={{ background: `${t.accent}18`, border: `1px solid ${t.accent}33`, color: t.accent }}>
                              <t.icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12.5px] font-semibold truncate" style={{ color: canal ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.32)" }}>{t.label}</div>
                              <div className="text-[9.5px] truncate" style={{ color: "rgba(255,255,255,0.38)" }}>{canal ? "#" + canal.nombre : "sin canal"}</div>
                            </div>
                            {unread > 0 && (
                              <span className="ml-1 shrink-0 text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: t.accent, color: "#0B1220", boxShadow: `0 0 8px ${t.accent}88` }}>{unread}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Presence footer */}
            <div className="p-2 border-t space-y-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-bold tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.4)" }}>EN LÍNEA</span>
                <span className="text-[10px] font-bold" style={{ color: "#6EE7B7" }}>{online.size}</span>
              </div>
              <div className="flex flex-wrap gap-1 px-1">
                {dir.filter((p) => online.has(p.user_id)).slice(0, 12).map((p) => (
                  <div key={p.user_id} className="relative" title={`${p.nombre} · en línea`}>
                    <UserAvatar userId={p.user_id} url={p.foto_url} name={p.nombre} size="sm" />
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full" style={{ background: "#10B981", boxShadow: "0 0 6px #10B981", border: "1.5px solid #0B1020" }} />
                  </div>
                ))}
                {online.size === 0 && (
                  <div className="text-[10px] italic" style={{ color: "rgba(255,255,255,0.35)" }}>Nadie conectado ahora</div>
                )}
              </div>
              <div className="rounded-lg px-2.5 py-2 flex items-center gap-2" style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.18)" }}>
                <UserAvatar userId={user?.id || ""} size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{user?.email?.split("@")[0] || "Analista"}</div>
                  <div className="text-[10px] flex items-center gap-1" style={{ color: "#6EE7B7" }}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#10B981" }} /> conectado
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* --------- COLUMN 2: ACTIVE CASES --------- */}
          <GlassPanel className="hidden md:flex">
            <PanelHeader label="CASOS ACTIVOS" accent="#3B82F6" right={<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(59,130,246,0.15)", color: "#93C5FD" }}>{casesFiltered.length}</span>} />
            <div className="px-2.5 pt-2 pb-1.5 space-y-1.5">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.35)" }} />
                <input value={caseQuery} onChange={(e) => setCaseQuery(e.target.value)} placeholder="Buscar caso o banco…"
                  className="w-full rounded-md pl-7 pr-2 py-1.5 text-[12px] outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.92)" }} />
              </div>
              <div className="flex items-center gap-1">
                <Filter size={11} style={{ color: "rgba(255,255,255,0.4)" }} />
                {(["todos", "alta", "media", "baja"] as const).map((p) => (
                  <button key={p} onClick={() => setCasePriority(p)}
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize transition"
                    style={casePriority === p
                      ? { background: prioTone(p).bg, color: prioTone(p).fg, border: `1px solid ${prioTone(p).border}` }
                      : { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-2 space-y-3 overflow-y-auto flex-1">
              {casesFiltered.length === 0 && (
                <div className="text-center text-[11px] py-8" style={{ color: "rgba(255,255,255,0.4)" }}>Sin casos activos.</div>
              )}
              {MACRO_ETAPAS.map((macro) => {
                const items = casesFiltered.filter((c) => {
                  const live = c.caso_id ? expLive[c.caso_id] : undefined;
                  const etapaLive = live?.etapa ?? getEtapaByStableHash(c.id).id;
                  return macroFromEtapa(etapaLive) === macro.id;
                });
                if (!items.length) return null;
                return (
                  <div key={macro.id}>
                    <div className="mb-1.5 flex items-center gap-2 px-1">
                      <span className="w-1 h-3 rounded-full" style={{ background: macro.accent, boxShadow: `0 0 8px ${macro.accent}` }} />
                      <span className="text-[9.5px] font-bold tracking-[0.16em]" style={{ color: macro.accent }}>{macro.label.toUpperCase()}</span>
                      <span className="text-[9.5px] font-bold px-1.5 rounded" style={{ background: `${macro.accent}18`, color: macro.accent }}>{items.length}</span>
                      <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, ${macro.accent}30, transparent)` }} />
                    </div>
                    <div className="space-y-1.5">
                      {items.map((c) => {
                        const active = canalActivo?.id === c.id;
                        const prio = priorityOf(c.id);
                        const sla = slaOf(c.id);
                        const live = c.caso_id ? expLive[c.caso_id] : undefined;
                        const etapaId = live?.etapa ?? getEtapaByStableHash(c.id).id;
                        const etapaLabel = getEtapaById(etapaId).titulo;
                        const p = prioTone(prio);
                        const owner = creditMap[c.id] || {};
                        const cliente = owner.cliente || c.nombre.replace(/^Caso\s*·\s*/i, "");
                        const banco = owner.banco || c.descripcion || "Sin banco asignado";
                        const analistaName = owner.analista || "Sin asignar";
                        // barra de progreso: etapa/15
                        const numero = getEtapaById(etapaId).numero;
                        const pct = Math.min(100, Math.round((numero / 15) * 100));
                        return (
                          <button key={c.id} onClick={() => setCanal(c.id)}
                            className="w-full text-left rounded-lg p-2 transition-all relative overflow-hidden group hover:-translate-y-[1px]"
                            style={active
                              ? { background: `linear-gradient(135deg, ${macro.accent}22, rgba(16,185,129,0.05))`, border: `1px solid ${macro.accent}66`, boxShadow: `0 0 20px ${macro.accent}22` }
                              : { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <div className="text-[11.5px] font-bold truncate flex-1 uppercase tracking-tight" style={{ color: "rgba(255,255,255,0.95)" }}>
                                {cliente}
                              </div>
                              <span className="shrink-0 text-[8.5px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}>{prio}</span>
                            </div>
                            <div className="text-[9.5px] truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{banco}</div>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <OwnerAvatar name={analistaName} priority={prio} />
                              <span className="text-[10px] font-medium truncate flex-1" style={{ color: owner.analista ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.4)" }}>
                                {analistaName}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[9.5px]" style={{ color: sla <= 2 ? "#FCA5A5" : "rgba(255,255,255,0.55)" }}>
                                <Clock size={9} className={sla <= 2 ? "animate-pulse" : ""} /> {sla}d
                              </span>
                            </div>
                            {/* mini progress */}
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${macro.accent}, ${macro.accent}88)`, boxShadow: `0 0 6px ${macro.accent}88` }} />
                              </div>
                              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.5)" }} title={etapaLabel}>{numero}/15</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* --------- COLUMN 3: MAIN CHAT --------- */}
          <GlassPanel>
            {canalActivo ? (
              <>
                <CaseHeader canal={canalActivo} info={creditMap[canalActivo.id]} priority={priorityOf(canalActivo.id)} sla={slaOf(canalActivo.id)} etapa={etapaOf(canalActivo.id)} />
                {(canalActivo.tipo === "caso" || canalActivo.tipo === "qa_auditoria") && (
                  <CreditSummaryCard canal={canalActivo} info={creditMap[canalActivo.id]} />
                )}
                <div className="flex-1 min-h-0">
                  <CanalChat canal={canalActivo} />
                </div>
              </>
            ) : (
              <EmptyMain onPickTeam={(k) => {
                const t = TEAM_CHANNELS.find((x) => x.key === k);
                if (!t) return;
                const canal = matchTeamChannel(t);
                if (canal) setCanal(canal.id);
              }} />
            )}
          </GlassPanel>

          {/* --------- COLUMN 4: CASE INTELLIGENCE --------- */}
          {showRight && (
            <div className="hidden 2xl:flex min-h-0">
              <GlassPanel className="flex-1">
                <PanelHeader label="CASE INTELLIGENCE" accent="#10B981" right={<Sparkles size={12} style={{ color: "#6EE7B7" }} />} />
                <CaseIntelligence canal={canalActivo} info={canalActivo ? creditMap[canalActivo.id] : undefined} sla={canalActivo ? slaOf(canalActivo.id) : 0} etapa={canalActivo ? etapaOf(canalActivo.id) : ""} />
              </GlassPanel>
            </div>
          )}
        </div>
      )}

      {tab === "dm" && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "rgba(255,255,255,0.92)" }}>Iniciar mensaje directo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {dir.filter((p) => p.user_id !== user?.id).map((p) => (
              <button key={p.user_id} onClick={async () => { const c = await getOrCreateDM(p.user_id); await reload(); setTabAndSync("war"); setCanal(c.id); }} className="flex items-center gap-3 rounded-xl border p-3 text-left transition hover:bg-white/5" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <UserAvatar userId={p.user_id} url={p.foto_url} name={p.nombre} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate" style={{ color: "rgba(255,255,255,0.92)" }}>{p.nombre}</div>
                  <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{p.roles.join(", ") || "—"}</div>
                </div>
              </button>
            ))}
          </div>
        </GlassPanel>
      )}

      {tab === "notificaciones" && (
        <GlassPanel className="p-4">
          <div className="flex items-center justify-between mb-3 gap-2">
            <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: "rgba(255,255,255,0.92)" }}><Bell size={14} /> Mis notificaciones</h3>
            <button onClick={async () => { await marcarTodasNotifLeidas(); listMisNotifColab().then(setNotifs); }} className="text-[11px] md:text-[12px] font-medium" style={{ color: "#6EE7B7" }}>
              Marcar todas leídas
            </button>
          </div>
          {notifs.length === 0 ? (
            <div className="text-center text-sm py-6" style={{ color: "rgba(255,255,255,0.55)" }}>Sin notificaciones.</div>
          ) : (
            <div className="space-y-1">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: n.leida ? "rgba(255,255,255,0.025)" : "rgba(59,130,246,0.14)", borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.92)" }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{n.tipo === "mencion" ? "Te mencionaron" : "Nuevo mensaje"}</div>
                    <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.55)" }}>{new Date(n.created_at).toLocaleString("es-CO")}</div>
                  </div>
                  {n.canal_id && <button onClick={() => { setTabAndSync("war"); setCanal(n.canal_id!); }} className="text-[12px] font-semibold" style={{ color: "#6EE7B7" }}>Abrir</button>}
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      )}

      {tab === "directorio" && (
        <GlassPanel className="p-4">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-3" style={{ color: "rgba(255,255,255,0.92)" }}><Users size={14} /> Directorio interno</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
            {dir.map((p) => (
              <div key={p.user_id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                <UserAvatar userId={p.user_id} url={p.foto_url} name={p.nombre} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate" style={{ color: "rgba(255,255,255,0.92)" }}>{p.nombre}</div>
                  <div className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.55)" }}>{p.correo || "—"}</div>
                  <div className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{p.roles.join(", ") || "—"}</div>
                </div>
                {p.user_id !== user?.id && (
                  <button onClick={async () => { const c = await getOrCreateDM(p.user_id); await reload(); setTabAndSync("war"); setCanal(c.id); }} className="rounded-md px-2 py-1 text-[11px] font-semibold" style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)", color: "white" }}>
                    Mensaje
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="w-full md:max-w-md md:rounded-2xl rounded-t-2xl p-4 md:p-5" style={{ background: "rgba(11,18,32,0.95)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.92)", boxShadow: "0 30px 80px rgba(0,0,0,0.5)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Nuevo canal</h3>
              <button onClick={() => setShowNew(false)} className="text-xl leading-none px-2" style={{ color: "rgba(255,255,255,0.55)" }}>×</button>
            </div>
            <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} placeholder="# nombre-canal" className="nuvia-input mb-2" />
            <textarea value={nuevoDesc} onChange={(e) => setNuevoDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2} className="nuvia-input mb-2" />
            <label className="flex items-center gap-2 text-sm mb-4">
              <input type="checkbox" checked={nuevoPriv} onChange={(e) => setNuevoPriv(e.target.checked)} /> Canal privado
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Cancelar</button>
              <button onClick={crear} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: "linear-gradient(135deg, #3B82F6, #10B981)", color: "white" }}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

// ============= Sub-components =============

function GlassPanel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative flex flex-col rounded-2xl overflow-hidden ${className}`} style={{
      background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(18px) saturate(140%)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
    }}>
      {children}
    </div>
  );
}

function PanelHeader({ label, accent, right }: { label: string; accent: string; right?: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.06)", background: `linear-gradient(90deg, ${accent}0F, transparent)` }}>
      <div className="flex items-center gap-2">
        <span className="w-1 h-3 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />
        <span className="text-[10px] font-bold tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.75)" }}>{label}</span>
      </div>
      {right}
    </div>
  );
}

function initialsOf(name: string): string {
  // Regla NUVIA: primera letra del primer nombre + primera letra del primer apellido
  // Ej: "Marsela Gomez Sierra" → MG, "Luis Gustavo Moya Arenas" → LM, "Eduard Castro" → EC
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function OwnerAvatar({ name, priority }: { name: string; priority: "alta" | "media" | "baja" }) {
  const border =
    priority === "alta" ? "rgba(239,68,68,0.55)" :
    priority === "media" ? "rgba(245,158,11,0.55)" :
                           "rgba(16,185,129,0.55)";
  const glow =
    priority === "alta" ? "rgba(239,68,68,0.35)" :
    priority === "media" ? "rgba(245,158,11,0.35)" :
                           "rgba(16,185,129,0.35)";
  const hasOwner = name && name !== "Sin asignar";
  return (
    <span
      title={hasOwner ? `Analista responsable · ${name}` : "Analista responsable"}
      className="relative inline-flex items-center justify-center rounded-full shrink-0 transition"
      style={{
        width: 28, height: 28,
        background: "linear-gradient(135deg, rgba(11,18,32,0.9), rgba(15,23,42,0.85))",
        border: `1.5px solid ${hasOwner ? border : "rgba(255,255,255,0.15)"}`,
        boxShadow: hasOwner ? `0 0 10px ${glow}, inset 0 1px 0 rgba(255,255,255,0.06)` : "inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(8px)",
      }}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.95)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
        {hasOwner ? initialsOf(name) : "—"}
      </span>
    </span>
  );
}

function prioTone(p: "alta" | "media" | "baja" | "todos") {
  if (p === "alta")  return { bg: "rgba(239,68,68,0.15)",  fg: "#FCA5A5", border: "rgba(239,68,68,0.4)" };
  if (p === "media") return { bg: "rgba(245,158,11,0.15)", fg: "#FCD34D", border: "rgba(245,158,11,0.4)" };
  if (p === "baja")  return { bg: "rgba(16,185,129,0.15)", fg: "#6EE7B7", border: "rgba(16,185,129,0.4)" };
  return { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.75)", border: "rgba(255,255,255,0.12)" };
}

function CaseHeader({ canal, info, priority, sla, etapa }: { canal: Canal; info?: CreditInfo; priority: "alta"|"media"|"baja"; sla: number; etapa: string }) {
  const p = prioTone(priority);
  const nombreLimpio = (info?.cliente || canal.nombre).replace(/^Caso\s*·\s*/i, "").replace(/^QA\s*·\s*/i, "");
  const isCase = canal.tipo === "caso" || canal.tipo === "qa_auditoria";
  const expedienteTarget = info?.caso_id
    ? { kind: "case", casoId: info.caso_id, tab: "resumen" } satisfies HeaderTarget
    : info?.auditoria_id
      ? { kind: "audit", auditoriaId: info.auditoria_id } satisfies HeaderTarget
      : null;
  const financieroTarget = info?.caso_id
    ? { kind: "case", casoId: info.caso_id, tab: "financiero" } satisfies HeaderTarget
    : info?.auditoria_id
      ? { kind: "audit", auditoriaId: info.auditoria_id } satisfies HeaderTarget
      : null;
  const timelineTarget = info?.caso_id
    ? { kind: "case", casoId: info.caso_id, tab: "historial" } satisfies HeaderTarget
    : info?.auditoria_id
      ? { kind: "audit", auditoriaId: info.auditoria_id } satisfies HeaderTarget
      : null;
  const auditTarget = info?.auditoria_id
    ? { kind: "audit", auditoriaId: info.auditoria_id } satisfies HeaderTarget
    : info?.caso_id
      ? { kind: "case", casoId: info.caso_id, tab: "auditoria" } satisfies HeaderTarget
      : null;
  return (
    <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "rgba(255,255,255,0.07)", background: "linear-gradient(180deg, rgba(59,130,246,0.06), transparent)" }}>
      <div className="min-w-0 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(16,185,129,0.15))", border: "1px solid rgba(59,130,246,0.35)" }}>
          {isCase ? <FolderKanban size={18} style={{ color: "#93C5FD" }} /> : <Hash size={18} style={{ color: "#93C5FD" }} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[15px] font-bold tracking-tight truncate" style={{ color: "rgba(255,255,255,0.98)" }}>{nombreLimpio.toUpperCase()}</div>
            {isCase && <span className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5" style={{ background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}>{priority}</span>}
          </div>
          <div className="flex items-center gap-3 text-[11px] mt-0.5 flex-wrap" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span>{info?.banco || canal.descripcion || "Sin banco"}</span>
            {isCase && <span>·</span>}
            {isCase && <span style={{ color: "#C4B5FD" }}>ETAPA · {etapa.toUpperCase()}</span>}
            {isCase && <span>·</span>}
            {isCase && <span className={sla <= 2 ? "animate-pulse" : ""} style={{ color: sla <= 2 ? "#FCA5A5" : "rgba(255,255,255,0.7)" }}>SLA {sla}d restantes</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <HeaderAction icon={FileText}   label="Expediente"  target={expedienteTarget} />
        <HeaderAction icon={Activity}   label="Extractos"   target={financieroTarget} />
        <HeaderAction icon={Clock}      label="Timeline"    target={timelineTarget} />
        <HeaderAction icon={Sparkles}   label="IA Analysis" target={auditTarget} accent />
      </div>
    </div>
  );
}

function HeaderAction({ icon: Icon, label, accent, target }: { icon: typeof FileText; label: string; accent?: boolean; target: HeaderTarget | null }) {
  const navigate = useNavigate();
  const disabled = !target;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!target) return;
        if (target.kind === "audit") {
          navigate({ to: "/qa-ai/$id", params: { id: target.auditoriaId } });
          return;
        }
        navigate({ to: "/casos/$id", params: { id: target.casoId }, search: { tab: target.tab } as never });
      }}
      title={disabled ? "Este canal no tiene destino disponible" : `Abrir ${label}`}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={accent
        ? { background: "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(16,185,129,0.15))", color: "white", border: "1px solid rgba(16,185,129,0.4)", boxShadow: "0 0 14px rgba(16,185,129,0.2)" }
        : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <Icon size={12} /> {label}
    </button>
  );
}

function CreditSummaryCard({ canal, info }: { canal: Canal; info?: CreditInfo }) {
  const navigate = useNavigate();
  const auditId = info?.auditoria_id ?? canal.auditoria_id;
  const caseId = info?.caso_id ?? canal.caso_id;
  const score = info?.qa_score ?? null;
  const scoreTone = score == null
    ? { bg: "rgba(255,255,255,0.05)", fg: "rgba(255,255,255,0.72)", border: "rgba(255,255,255,0.10)" }
    : score >= 85
      ? { bg: "rgba(16,185,129,0.12)", fg: "#6EE7B7", border: "rgba(16,185,129,0.32)" }
      : score >= 70
        ? { bg: "rgba(245,158,11,0.12)", fg: "#FCD34D", border: "rgba(245,158,11,0.34)" }
        : { bg: "rgba(239,68,68,0.11)", fg: "#FCA5A5", border: "rgba(239,68,68,0.32)" };

  const openAudit = () => {
    if (auditId) navigate({ to: "/qa-ai/$id", params: { id: auditId } });
    else if (caseId) navigate({ to: "/casos/$id", params: { id: caseId }, search: { tab: "auditoria" } as never });
  };

  return (
    <div className="border-b px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.07)", background: "linear-gradient(135deg, rgba(68,93,163,0.13), rgba(16,185,129,0.055))" }}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "#6EE7B7" }}>Ficha financiera del crédito</div>
          <div className="mt-0.5 truncate text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.96)" }}>{info?.cliente || canal.nombre.replace(/^QA\s*·\s*/i, "").replace(/^Caso\s*·\s*/i, "")}</div>
        </div>
        <button
          type="button"
          onClick={openAudit}
          disabled={!auditId && !caseId}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold transition hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.24), rgba(16,185,129,0.20))", color: "#FFFFFF", border: "1px solid rgba(16,185,129,0.42)", boxShadow: "0 0 14px rgba(16,185,129,0.16)" }}
        >
          <Sparkles size={12} /> Ver auditoría <ArrowUpRight size={11} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <CreditInfoTile icon={UserRound} label="Analista" value={info?.analista || "Sin asignar"} />
        <CreditInfoTile icon={Gauge} label="Score auditoría" value={score == null ? "—" : `${Math.round(score)}/100`} tone={scoreTone} />
        <CreditInfoTile icon={CalendarDays} label="Creación" value={formatShortDate(info?.created_at ?? canal.created_at)} />
        <CreditInfoTile icon={Building2} label="Banco" value={info?.banco || "—"} />
        <CreditInfoTile icon={CreditCard} label="N° crédito" value={info?.numero_credito || "—"} />
        <CreditInfoTile icon={FileText} label="Producto" value={info?.producto || "—"} />
      </div>
    </div>
  );
}

function CreditInfoTile({ icon: Icon, label, value, tone }: { icon: typeof FileText; label: string; value: string; tone?: { bg: string; fg: string; border: string } }) {
  return (
    <div className="min-w-0 rounded-lg px-2.5 py-2" style={{ background: tone?.bg ?? "rgba(255,255,255,0.035)", border: `1px solid ${tone?.border ?? "rgba(255,255,255,0.075)"}` }}>
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ color: tone?.fg ?? "rgba(255,255,255,0.44)" }}>
        <Icon size={10} /> {label}
      </div>
      <div className="truncate text-[12px] font-semibold" title={value} style={{ color: tone?.fg ?? "rgba(255,255,255,0.90)" }}>{value}</div>
    </div>
  );
}


function EmptyMain({ onPickTeam }: { onPickTeam: (k: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="relative inline-flex mb-5">
          <div className="absolute inset-0 rounded-full blur-2xl" style={{ background: "radial-gradient(circle, rgba(16,185,129,0.4), transparent 70%)" }} />
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(16,185,129,0.2))", border: "1px solid rgba(16,185,129,0.4)" }}>
            <MessagesSquare size={26} style={{ color: "#6EE7B7" }} />
          </div>
        </div>
        <div className="text-lg font-bold mb-1" style={{ color: "rgba(255,255,255,0.95)" }}>Selecciona un canal o caso</div>
        <div className="text-[12px] mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>Bienvenido al War Room. Elige un canal de equipo para iniciar.</div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {TEAM_CHANNELS.map((t) => (
            <button key={t.key} onClick={() => onPickTeam(t.key)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition hover:scale-[1.03]" style={{ background: `${t.accent}18`, color: t.accent, border: `1px solid ${t.accent}33` }}>
              <t.icon size={11} /> {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CaseIntelligence({ canal, info, sla, etapa }: { canal: Canal | null; info?: CreditInfo; sla: number; etapa: string }) {
  if (!canal) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Selecciona un caso para ver su inteligencia.</div>
      </div>
    );
  }
  const events = [
    { icon: Zap,        color: "#10B981", text: "Banco respondió requerimiento",  time: "hace 12 min" },
    { icon: FileText,   color: "#3B82F6", text: "Cliente cargó documento",         time: "hace 1 h"   },
    { icon: Scale,      color: "#8B5CF6", text: "Legal aprobó tutela",             time: "hace 3 h"   },
    { icon: Activity,   color: "#22D3EE", text: "Extracto nuevo procesado",        time: "hace 6 h"   },
  ];
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* KPI blocks */}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 rounded-lg p-2.5" style={{ background: "rgba(68,93,163,0.10)", border: "1px solid rgba(68,93,163,0.28)" }}>
          <div className="text-[9px] font-bold tracking-wider" style={{ color: "#BFD3F5" }}>CRÉDITO</div>
          <div className="text-[12px] font-bold mt-0.5 truncate" title={info?.numero_credito || undefined} style={{ color: "rgba(255,255,255,0.95)" }}>{info?.numero_credito || "—"}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div className="text-[9px] font-bold tracking-wider" style={{ color: "#93C5FD" }}>ETAPA</div>
          <div className="text-[13px] font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.95)" }}>{etapa}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: sla <= 2 ? "rgba(239,68,68,0.10)" : "rgba(16,185,129,0.08)", border: `1px solid ${sla <= 2 ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.25)"}` }}>
          <div className="text-[9px] font-bold tracking-wider" style={{ color: sla <= 2 ? "#FCA5A5" : "#6EE7B7" }}>SLA</div>
          <div className="text-[13px] font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.95)" }}>{sla} días</div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <div className="text-[10px] font-bold tracking-[0.14em] mb-2 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
          <Activity size={10} /> ÚLTIMOS EVENTOS
        </div>
        <div className="relative pl-4 space-y-2.5">
          <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: "linear-gradient(180deg, rgba(59,130,246,0.4), rgba(16,185,129,0.2), transparent)" }} />
          {events.map((e, i) => (
            <div key={i} className="relative">
              <span className="absolute -left-4 top-1 w-2.5 h-2.5 rounded-full" style={{ background: e.color, boxShadow: `0 0 8px ${e.color}` }} />
              <div className="text-[12px] leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>{e.text}</div>
              <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{e.time}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Next deadline */}
      <div className="rounded-lg p-3" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(239,68,68,0.05))", border: "1px solid rgba(245,158,11,0.25)" }}>
        <div className="text-[9px] font-bold tracking-wider flex items-center gap-1" style={{ color: "#FCD34D" }}><Clock size={10} /> PRÓXIMO VENCIMIENTO</div>
        <div className="text-[13px] font-semibold mt-1" style={{ color: "rgba(255,255,255,0.95)" }}>Radicación jurídica</div>
        <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>en {sla} días · 5:00 PM</div>
      </div>

      {/* Risks */}
      <div className="rounded-lg p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <div className="text-[9px] font-bold tracking-wider flex items-center gap-1" style={{ color: "#FCA5A5" }}><AlertTriangle size={10} /> RIESGOS DETECTADOS</div>
        <ul className="mt-1.5 space-y-1 text-[11px]" style={{ color: "rgba(255,255,255,0.85)" }}>
          <li className="flex gap-1.5"><ChevronRight size={11} className="mt-0.5 shrink-0" style={{ color: "#FCA5A5" }} /> Documento faltante del cotitular</li>
          <li className="flex gap-1.5"><ChevronRight size={11} className="mt-0.5 shrink-0" style={{ color: "#FCA5A5" }} /> Extracto sin variación UVR</li>
        </ul>
      </div>

      {/* IA Recommendation */}
      <div className="rounded-lg p-3 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.14), rgba(16,185,129,0.10))", border: "1px solid rgba(16,185,129,0.35)", boxShadow: "0 0 20px rgba(16,185,129,0.12)" }}>
        <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl" style={{ background: "rgba(16,185,129,0.3)" }} />
        <div className="relative">
          <div className="text-[9px] font-bold tracking-wider flex items-center gap-1" style={{ color: "#6EE7B7" }}>
            <Sparkles size={10} /> RECOMENDACIÓN NUVIA IA
          </div>
          <div className="text-[12px] mt-1.5 leading-snug" style={{ color: "rgba(255,255,255,0.95)" }}>
            Escalar a jurídica en las próximas 24h para asegurar radicación antes del vencimiento SLA.
          </div>
          <button className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold" style={{ background: "rgba(16,185,129,0.2)", color: "#6EE7B7", border: "1px solid rgba(16,185,129,0.4)" }}>
            <TrendingUp size={10} /> Aplicar sugerencia
          </button>
        </div>
      </div>
    </div>
  );
}
