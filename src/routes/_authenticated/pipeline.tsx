// P14 — Vista Kanban del Pipeline de Leads NUVEX.
// El tablero visual muestra 2 etapas ejecutivas; las 15 etapas maestras siguen
// existiendo como estado interno del expediente y auditoría operativa.
// P15 — Filtros (búsqueda, banco, solo estancados).
// P16 — Filtros persistidos en URL via search params (compartibles).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Loader2, Flag, Clock, AlertTriangle, RefreshCw, Eye, Pencil, SlidersHorizontal, ChevronDown, Radar, Gauge, Coins, ShieldAlert, Sparkles, Download, LayoutGrid, CheckCircle2, Search, ArrowRight, TrendingUp } from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { BANCOS } from "@/components/nuvex/constants";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AnalistaAvatar } from "@/components/pipeline/AnalistaAvatar";
import { LeadQuickPeek } from "@/components/pipeline/LeadQuickPeek";
import { LeadEditDrawer } from "@/components/pipeline/LeadEditDrawer";
import { NuviaPipelinePanel, type PipelineCtx } from "@/components/pipeline/NuviaPipelinePanel";
import { PipelineControlPanel, type PipelineControlBreakdown } from "@/components/pipeline/PipelineControlPanel";
import { motivosRevision, progresoLead } from "@/lib/leadFases";

const FASE_IDS = ["con_proyeccion", "en_revision"] as const;
type FaseId = (typeof FASE_IDS)[number];
type PipelineProfileLite = { nombre: string | null; email: string | null; sede?: string | null; equipo?: string | null };
type PipelineIdentity = {
  clienteNombre?: string | null;
  cedula?: string | null;
  banco?: string | null;
  numeroCredito?: string | null;
};

export const pipelineSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  banco: fallback(z.string(), "").default(""),
  stuck: fallback(z.boolean(), false).default(false),
  fase: fallback(z.enum(["", ...FASE_IDS]), "").default(""),
  mios: fallback(z.boolean(), false).default(false),
  asesor: fallback(z.string(), "").default(""),
});

type PipelineLaneId = FaseId | EtapaPipelineId;
type PipelineLane = {
  id: PipelineLaneId;
  numero: number;
  titulo: string;
  descripcion: string;
  internalIds: ReadonlyArray<EtapaPipelineId>;
};

const LEAD_INTERNAL_STAGES: ReadonlyArray<EtapaPipelineId> = ["lead", "extracto", "proyeccion"];

const PIPELINE_VISUAL_LANES: ReadonlyArray<PipelineLane> = [
  {
    id: "en_revision",
    numero: 1,
    titulo: "Lead en Revisión",
    descripcion: "Entrada del pipeline: todo lead nuevo, en auditoría o con alertas espera aquí hasta que quede aprobado.",
    internalIds: LEAD_INTERNAL_STAGES,
  },
  {
    id: "con_proyeccion",
    numero: 2,
    titulo: "Lead con Proyección",
    descripcion: "Lead limpio: proyección lista, auditoría QA aprobada y sin motivos abiertos. Listo para avanzar a contratación.",
    internalIds: LEAD_INTERNAL_STAGES,
  },
  ...ETAPAS_PIPELINE.filter((e) => e.numero >= 4).map((e, idx) => ({
    id: e.id,
    numero: idx + 3,
    titulo: e.titulo,
    descripcion: e.descripcion,
    internalIds: [e.id] as const,
  })),
];



export const Route = createFileRoute("/_authenticated/pipeline")({
  validateSearch: zodValidator(pipelineSearchSchema),
  component: PipelinePage,
});

const UMBRAL_DIAS: Partial<Record<EtapaPipelineId, number>> = {
  lead: 3, extracto: 5, proyeccion: 5, presentacion: 7, cierre: 7,
  contratacion: 10, radicacion: 7, banco: 21, resultado_banco: 5, aceptacion_cliente: 5, informe: 5, cuenta: 5,
  pago: 10, comision: 7, paz_salvo: 5, finalizado: 0,
};

function diasDesde(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000));
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function readAhorro(propuesta: unknown): number {
  if (!propuesta || typeof propuesta !== "object") return 0;
  const o = propuesta as Record<string, unknown>;
  return num(o.ahorro) || num(o.ahorroTotal) || num(o.ahorroIntereses);
}

function cleanText(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "—" || /^null$/i.test(s) || /^undefined$/i.test(s)) return "";
  return s;
}

function isPlaceholderText(v: unknown): boolean {
  const s = cleanText(v).toLowerCase();
  return !s || s === "sin nombre" || s === "s/cédula" || s === "sin banco";
}

function readText(obj: unknown, ...keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = cleanText(o[k]);
    if (v) return v;
  }
  return "";
}

function preferPipelineText(current: unknown, fallback?: unknown): string {
  if (!isPlaceholderText(current)) return cleanText(current);
  const f = cleanText(fallback);
  return f && !isPlaceholderText(f) ? f : cleanText(current);
}

function etapaInterna(exp: Expediente): EtapaPipelineId {
  return computeEtapaActual({
    estado_caso: (exp as unknown as { estado_caso?: string | null }).estado_caso ?? null,
  } as Parameters<typeof computeEtapaActual>[0]);
}

function isLeadInternalStage(etapa: EtapaPipelineId): boolean {
  return LEAD_INTERNAL_STAGES.includes(etapa);
}

function laneVisualLead(exp: Expediente, qa: { id: string; score: number; dictamen: string | null; auditor_aprobado_at?: string | null } | undefined): PipelineLaneId {
  const etapa = etapaInterna(exp);
  if (!isLeadInternalStage(etapa)) return etapa;
  // Regla nueva: E1=en_revision es la entrada por default. Sólo promovemos a
  // E2=con_proyeccion cuando el lead está limpio: sin motivos abiertos,
  // tiene proyección financiera y la auditoría QA fue aprobada y sellada.
  const motivos = motivosRevision(exp, qa);
  if (motivos.length > 0) return "en_revision";
  const propuesta = (exp as unknown as { propuesta_data?: Record<string, unknown> }).propuesta_data ?? {};
  const nuevaCuota = Number(propuesta.nuevaCuota ?? 0) || 0;
  const nuevoPlazo = Number(propuesta.nuevoPlazo ?? 0) || 0;
  const ahorroTotal = Number(propuesta.ahorroTotal ?? 0) || 0;
  const tieneProyeccion = nuevaCuota > 0 || nuevoPlazo > 0 || ahorroTotal > 0;
  const dictamen = (qa?.dictamen ?? "").toLowerCase();
  const auditoriaAprobada = !!qa && !!qa.auditor_aprobado_at && (dictamen === "aprobado" || dictamen === "aprobado_obs");
  if (tieneProyeccion && auditoriaAprobada) return "con_proyeccion";
  return "en_revision";
}


function getLaneById(id: PipelineLaneId): PipelineLane {
  return PIPELINE_VISUAL_LANES.find((x) => x.id === id) ?? PIPELINE_VISUAL_LANES[0];
}

function rowSla(exp: Expediente): number {
  return UMBRAL_DIAS[etapaInterna(exp)] ?? 0;
}

function identityFromPayload(payload: unknown): PipelineIdentity {
  const o = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const reconstruccion = o.reconstruccion && typeof o.reconstruccion === "object" ? (o.reconstruccion as Record<string, unknown>) : {};
  const extracto = o.extracto && typeof o.extracto === "object" ? (o.extracto as Record<string, unknown>) : {};
  return {
    clienteNombre: readText(o, "cliente", "nombre", "clienteNombre") || readText(extracto, "cliente", "nombre", "clienteNombre"),
    cedula: readText(o, "cedula", "identificacion") || readText(extracto, "cedula", "identificacion"),
    banco: readText(o, "banco") || readText(extracto, "banco") || readText(reconstruccion, "banco"),
    numeroCredito: readText(o, "numeroCredito", "numero_credito") || readText(extracto, "numeroCredito", "numero_credito"),
  };
}

function mergeIdentity(base: PipelineIdentity | undefined, next: PipelineIdentity): PipelineIdentity {
  return {
    clienteNombre: preferPipelineText(base?.clienteNombre, next.clienteNombre) || base?.clienteNombre || next.clienteNombre,
    cedula: preferPipelineText(base?.cedula, next.cedula) || base?.cedula || next.cedula,
    banco: preferPipelineText(base?.banco, next.banco) || base?.banco || next.banco,
    numeroCredito: preferPipelineText(base?.numeroCredito, next.numeroCredito) || base?.numeroCredito || next.numeroCredito,
  };
}

function PipelinePage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/pipeline" });
  const { user } = useAuth();
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now());
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const [qLocal, setQLocal] = useState(search.q);
  const [analistas, setAnalistas] = useState<{ id: string; nombre: string | null; email: string | null }[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, PipelineProfileLite>>(new Map());
  const [qaMap, setQaMap] = useState<Map<string, { id: string; score: number; dictamen: string | null; auditor_aprobado_at: string | null }>>(new Map());
  const [identityMap, setIdentityMap] = useState<Map<string, PipelineIdentity>>(new Map());
  const [peekId, setPeekId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { q, banco, stuck: soloStuck, fase, mios, asesor } = search;

  type PipelineSearch = z.infer<typeof pipelineSearchSchema>;

  // Debounce text input → URL
  useEffect(() => {
    const t = setTimeout(() => {
      if (qLocal !== q) {
        navigate({ search: (prev: PipelineSearch) => ({ ...prev, q: qLocal }), replace: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, q, navigate]);

  const setBanco = (v: string) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, banco: v }), replace: true });
  const setSoloStuck = (v: boolean) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, stuck: v }), replace: true });
  const setMios = (v: boolean) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, mios: v }), replace: true });
  const setAsesor = (v: string) =>
    navigate({ search: (prev: PipelineSearch) => ({ ...prev, asesor: v }), replace: true });
  const toggleFase = (id: FaseId) =>
    navigate({
      search: (prev: PipelineSearch) => ({ ...prev, fase: prev.fase === id ? "" : id }),
      replace: true,
    });
  const clearAll = () => {
    setQLocal("");
    navigate({ search: { q: "", banco: "", stuck: false, fase: "", mios: false, asesor: "" }, replace: true });
  };

  // P29 — Atajos de teclado: "/" enfoca buscador, "m" toggle Mis casos, "s" toggle Stuck, Esc limpia búsqueda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;

      if (e.key === "Escape" && target === searchInputRef.current) {
        setQLocal("");
        navigate({ search: (prev: PipelineSearch) => ({ ...prev, q: "" }), replace: true });
        return;
      }
      if (isTyping) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setMios(!mios);
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setSoloStuck(!soloStuck);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mios, soloStuck, navigate]);



  const cargar = async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const data = await listExpedientes();
      setRows(data);
      setLastUpdated(Date.now());
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    cargar(false);
    const auto = setInterval(() => cargar(true), 60_000);
    const tick = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => {
      clearInterval(auto);
      clearInterval(tick);
    };
  }, []);

  // Cargar analistas (roles operativos) para el filtro.
  useEffect(() => {
    (async () => {
      const { data: ur } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["licenciado", "asesor", "contabilidad", "gerencia", "director_financiero_qa"] as never);
      const ids = Array.from(new Set((ur ?? []).map((r) => (r as { user_id: string }).user_id)));
      if (ids.length === 0) { setAnalistas([]); return; }
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nombre, email")
        .in("id", ids);
      const list = (profs ?? []) as { id: string; nombre: string | null; email: string | null }[];
      list.sort((a, b) => (a.nombre || a.email || "").localeCompare(b.nombre || b.email || "", "es"));
      setAnalistas(list);
    })();
  }, []);


  // Cargar perfiles (nombre/email) de TODOS los asesores referenciados en rows.
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.asesor_id).filter(Boolean)));
    const missing = ids.filter((id) => !profilesMap.has(id));
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nombre, email, sede, equipo")
        .in("id", missing);
      const list = (data ?? []) as ({ id: string } & PipelineProfileLite)[];
      setProfilesMap((prev) => {
        const next = new Map(prev);
        list.forEach((p) => next.set(p.id, { nombre: p.nombre, email: p.email, sede: p.sede, equipo: p.equipo }));
        return next;
      });
    })();
  }, [rows, profilesMap]);

  // Última auditoría QA por expediente — para badge de score en la tarjeta.
  useEffect(() => {
    const ids = Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
    if (ids.length === 0) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("qa_auditorias")
        .select("id, expediente_id, qa_score, dictamen, created_at")
        .in("expediente_id", ids)
        .order("created_at", { ascending: false });
      if (cancel || !data) return;
      const next = new Map<string, { id: string; score: number; dictamen: string | null }>();
      for (const row of data as Array<{ id: string; expediente_id: string; qa_score: number | null; dictamen: string | null }>) {
        if (!row.expediente_id || next.has(row.expediente_id)) continue;
        next.set(row.expediente_id, { id: row.id, score: Number(row.qa_score ?? 0), dictamen: row.dictamen });
      }
      setQaMap(next);
    })();
    return () => { cancel = true; };
  }, [rows]);

  // Hidrata cabeceras del Pipeline cuando el expediente quedó con "Sin nombre"
  // pero la lectura del extracto o la auditoría QA sí contienen datos confiables.
  useEffect(() => {
    const needsHydration = rows.filter((r) =>
      isPlaceholderText(r.cliente_nombre) || isPlaceholderText(r.cedula) || isPlaceholderText(r.banco) || isPlaceholderText(r.numero_credito),
    );
    if (needsHydration.length === 0) {
      setIdentityMap(new Map());
      return;
    }
    let cancel = false;
    const ids = needsHydration.map((r) => r.id);
    (async () => {
      const [lecturas, auditorias] = await Promise.all([
        supabase
          .from("extractos_lecturas")
          .select("expediente_id, datos, created_at")
          .in("expediente_id", ids)
          .order("created_at", { ascending: false }),
        supabase
          .from("qa_auditorias")
          .select("expediente_id, inputs, created_at")
          .in("expediente_id", ids)
          .order("created_at", { ascending: false }),
      ]);
      if (cancel) return;
      const next = new Map<string, PipelineIdentity>();
      for (const row of (lecturas.data ?? []) as Array<{ expediente_id: string | null; datos: unknown }>) {
        if (!row.expediente_id || next.has(row.expediente_id)) continue;
        next.set(row.expediente_id, identityFromPayload(row.datos));
      }
      for (const row of (auditorias.data ?? []) as Array<{ expediente_id: string | null; inputs: unknown }>) {
        if (!row.expediente_id) continue;
        next.set(row.expediente_id, mergeIdentity(next.get(row.expediente_id), identityFromPayload(row.inputs)));
      }
      setIdentityMap(next);
    })();
    return () => { cancel = true; };
  }, [rows]);



  const hace = Math.max(0, Math.round((nowTick - lastUpdated) / 1000));
  const haceLabel = hace < 60 ? `${hace}s` : `${Math.round(hace / 60)}min`;


  const bancos = useMemo(() => {
    const s = new Set<string>(BANCOS);
    rows.forEach((r) => r.banco && s.add(r.banco));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "es"));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const uid = user?.id ?? "";
    return rows.filter((r) => {
      if (mios && uid && r.asesor_id !== uid) return false;
      if (asesor) {
        const asesorIds = asesor.split(",").filter(Boolean);
        if (!asesorIds.includes(r.asesor_id)) return false;
      }
      const identity = identityMap.get(r.id);
      const displayBanco = preferPipelineText(r.banco, identity?.banco);
      if (banco && displayBanco !== banco) return false;
      if (term) {
        const hay = `${preferPipelineText(r.cliente_nombre, identity?.clienteNombre)} ${preferPipelineText(r.cedula, identity?.cedula)} ${preferPipelineText(r.numero_credito, identity?.numeroCredito)} ${displayBanco}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, banco, mios, asesor, user?.id, identityMap]);

  const grupos = useMemo(() => {
    const m = new Map<PipelineLaneId, Expediente[]>();
    PIPELINE_VISUAL_LANES.forEach((e) => m.set(e.id, []));
    filtered.forEach((r) => {
      const lane = laneVisualLead(r, qaMap.get(r.id));
      const dias = diasDesde(r.updated_at);
      const umbral = rowSla(r);
      if (soloStuck && !(umbral > 0 && dias > umbral)) return;
      m.get(lane)?.push(r);
    });
    // P27 — Ordenar cada columna por antigüedad descendente (más estancados arriba).
    m.forEach((items) => {
      items.sort((a, b) => {
        const ta = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const tb = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return ta - tb; // más antiguo primero
      });
    });
    return m;
  }, [filtered, soloStuck, qaMap]);

  const etapasVisibles = useMemo(
    () => {
      if (!fase) return PIPELINE_VISUAL_LANES;
      return PIPELINE_VISUAL_LANES.filter((e) => e.id === fase);
    },
    [fase],
  );


  const totalVisible = etapasVisibles.reduce((a, etapa) => a + (grupos.get(etapa.id) ?? []).length, 0);

  // P17 — Exportar CSV de los casos visibles (respeta filtros + etapa derivada).
  const exportarCSV = () => {
    const etapaTitulo = new Map(PIPELINE_VISUAL_LANES.map((e) => [e.id, `E${e.numero} ${e.titulo}`]));
    const headers = ["Cliente", "Cédula", "Banco", "Crédito", "Etapa", "Estado", "Días", "Actualizado"];
    const lines: string[] = [headers.join(",")];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    etapasVisibles.forEach((etapa) => {
      (grupos.get(etapa.id) ?? []).forEach((r) => {
        lines.push([
          esc(r.cliente_nombre),
          esc(r.cedula),
          esc(r.banco),
          esc(r.numero_credito),
          esc(etapaTitulo.get(etapa.id)),
          esc(r.estado),
          esc(diasDesde(r.updated_at)),
          esc(r.updated_at?.slice(0, 10)),
        ].join(","));
      });
    });
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // P18 — KPIs agregados por fase.
  const kpis = useMemo(() => {
    let totalDias = 0;
    let estancados = 0;
    let total = 0;
    const fases: Array<{ id: string; label: string; count: number }> = [
      { id: "con_proyeccion", label: "Lead con Proyección", count: grupos.get("con_proyeccion")?.length ?? 0 },
      { id: "en_revision", label: "Lead en Revisión", count: grupos.get("en_revision")?.length ?? 0 },
    ];
    let honorarios = 0;
    etapasVisibles.forEach((etapa) => {
      const items = grupos.get(etapa.id) ?? [];
      items.forEach((r) => {
        const d = diasDesde(r.updated_at);
        const umbral = rowSla(r);
        total += 1;
        totalDias += d;
        honorarios += Number(r.honorarios_final ?? 0);
        if (umbral > 0 && d > umbral) estancados += 1;
      });
    });
    return {
      total,
      estancados,
      promedio: total > 0 ? Math.round(totalDias / total) : 0,
      honorarios,
      fases,
    };
  }, [grupos, etapasVisibles]);

  const pipelineBreakdown = useMemo<PipelineControlBreakdown>(() => {
    const bancosMap = new Map<string, PipelineControlBreakdown["bancos"][number]>();
    const analistasMap = new Map<string, PipelineControlBreakdown["analistas"][number]>();
    const oficinasMap = new Map<string, PipelineControlBreakdown["oficinas"][number]>();
    let total = 0;
    let ahorro = 0;
    let casos = 0;
    let sinAnalista = 0;

    etapasVisibles.forEach((etapa) => {
      (grupos.get(etapa.id) ?? []).forEach((r) => {
        const valor = num(r.honorarios_final);
        const ahorroCaso = readAhorro(r.propuesta_data);
        total += valor;
        ahorro += ahorroCaso;
        casos += 1;

        const bancoNombre = r.banco?.trim() || "Sin banco";
        const bancoBucket = bancosMap.get(bancoNombre) ?? { id: bancoNombre, nombre: bancoNombre, total: 0, ahorro: 0, casos: 0 };
        bancoBucket.total += valor;
        bancoBucket.ahorro += ahorroCaso;
        bancoBucket.casos += 1;
        bancosMap.set(bancoNombre, bancoBucket);

        const asesorId = r.asesor_id || "sin-analista";
        if (!r.asesor_id) sinAnalista += 1;
        const prof = r.asesor_id ? profilesMap.get(r.asesor_id) : undefined;
        const analistaNombre = prof?.nombre || prof?.email || (r.asesor_id ? r.asesor_id.slice(0, 8) : "Sin asignar");
        const analistaKey = analistaNombre.trim().toLowerCase() || asesorId;
        const analistaBucket = analistasMap.get(analistaKey) ?? { id: asesorId, nombre: analistaNombre, total: 0, ahorro: 0, casos: 0 };
        if (!analistaBucket.id.split(",").includes(asesorId)) analistaBucket.id = `${analistaBucket.id},${asesorId}`;
        analistaBucket.nombre = analistaNombre;
        analistaBucket.total += valor;
        analistaBucket.ahorro += ahorroCaso;
        analistaBucket.casos += 1;
        analistasMap.set(analistaKey, analistaBucket);

        const oficina = prof?.sede?.trim() || prof?.equipo?.trim() || "Sin oficina";
        const oficinaBucket = oficinasMap.get(oficina) ?? { id: oficina, nombre: oficina, total: 0, ahorro: 0, casos: 0 };
        oficinaBucket.total += valor;
        oficinaBucket.ahorro += ahorroCaso;
        oficinaBucket.casos += 1;
        oficinasMap.set(oficina, oficinaBucket);
      });
    });

    const sortDesc = <T extends { total: number; casos: number; nombre: string }>(arr: T[]) =>
      arr.sort((a, b) => b.total - a.total || b.casos - a.casos || a.nombre.localeCompare(b.nombre, "es"));

    return {
      total,
      ahorro,
      casos,
      sinAnalista,
      bancos: sortDesc(Array.from(bancosMap.values())),
      analistas: sortDesc(Array.from(analistasMap.values())),
      oficinas: sortDesc(Array.from(oficinasMap.values())),
    };
  }, [grupos, etapasVisibles, profilesMap]);

  // P24 — Detección de duplicados por cédula (cliente con varios expedientes activos).
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

  const fmtCOP = (n: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

  // P30 — Embudo ejecutivo E1→E2: conteo por etapa + conversión acumulada vs E1.
  const [showFunnel, setShowFunnel] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nuvex.pipeline.funnel") !== "0";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nuvex.pipeline.funnel", showFunnel ? "1" : "0");
    }
  }, [showFunnel]);

  // Header premium: filtros avanzados y panel de análisis colapsados por defecto.
  const [showFilters, setShowFilters] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nuvex.pipeline.filters") === "1";
  });
  const [showAnalisis, setShowAnalisis] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nuvex.pipeline.analisis") === "1";
  });
  const [controlOpen, setControlOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nuvex.pipeline.control.open") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("nuvex.pipeline.control.open", controlOpen ? "1" : "0");
  }, [controlOpen]);


  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("nuvex.pipeline.filters", showFilters ? "1" : "0");
  }, [showFilters]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("nuvex.pipeline.analisis", showAnalisis ? "1" : "0");
  }, [showAnalisis]);

  const advancedActive = !!(banco || soloStuck || fase || mios || asesor);

  const funnel = useMemo(() => {
    const counts = etapasVisibles.map((e) => ({
      id: e.id,
      numero: e.numero,
      titulo: e.titulo,
      count: (grupos.get(e.id) ?? []).length,
    }));
    // "Pasaron por la etapa" = casos en esa etapa o más adelante.
    let acumDesdeFin = 0;
    const acum = [...counts].reverse().map((c) => {
      acumDesdeFin += c.count;
      return { ...c, passed: acumDesdeFin };
    }).reverse();
    const base = acum[0]?.passed ?? 0;
    return acum.map((c, i) => {
      const prev = acum[i - 1]?.passed ?? base;
      return {
        ...c,
        pct: base > 0 ? Math.round((c.passed / base) * 100) : 0,
        drop: prev > 0 ? Math.round(((prev - c.passed) / prev) * 100) : 0,
      };
    });
  }, [grupos, etapasVisibles]);

  // Contexto NUVIA IA: snapshot ejecutivo compactado del pipeline visible.
  const pipelineCtx: PipelineCtx = useMemo(() => {
    const etapaTitulo = new Map(PIPELINE_VISUAL_LANES.map((e) => [e.id, `E${e.numero} ${e.titulo}`] as const));
    const topEstancados: PipelineCtx["topEstancados"] = [];
    let sinAsesor = 0;
    etapasVisibles.forEach((etapa) => {
      (grupos.get(etapa.id) ?? []).forEach((r) => {
        const d = diasDesde(r.updated_at);
        const umbral = rowSla(r);
        if (!r.asesor_id) sinAsesor += 1;
        if (umbral > 0 && d > umbral) {
          const p = profilesMap.get(r.asesor_id);
          topEstancados.push({
            cliente: r.cliente_nombre,
            banco: r.banco,
            etapa: etapaTitulo.get(etapa.id) ?? etapa.titulo,
            dias: d,
            analista: p?.nombre || p?.email || "—",
          });
        }
      });
    });
    topEstancados.sort((a, b) => b.dias - a.dias);
    return {
      total: kpis.total,
      estancados: kpis.estancados,
      promedioDias: kpis.promedio,
      honorarios: kpis.honorarios,
      fases: kpis.fases.map((f) => ({ id: f.id, label: f.label, count: f.count })),
      funnel: funnel.map((f) => ({
        numero: f.numero,
        titulo: f.titulo,
        count: f.count,
        passed: f.passed,
        pct: f.pct,
        drop: f.drop,
      })),
      topEstancados: topEstancados.slice(0, 8),
      sinAsesor,
      duplicados: dupCedulas.size,
    };
  }, [grupos, etapasVisibles, kpis, funnel, profilesMap, dupCedulas]);

  const peekExpediente = peekId ? rows.find((r) => r.id === peekId) ?? null : null;
  const editExpediente = editId ? rows.find((r) => r.id === editId) ?? null : null;

  // Conteos para el panel de control lateral
  const { criticos, listos } = useMemo(() => {
    let cr = 0;
    etapasVisibles.forEach((e) => {
      (grupos.get(e.id) ?? []).forEach((r) => {
        const umbral = rowSla(r);
        if (umbral <= 0) return;
        if (diasDesde(r.updated_at) > umbral * 2) cr += 1;
      });
    });
    const visibleIds = new Set(etapasVisibles.map((e) => e.id));
    const li =
      (visibleIds.has("paz_salvo") ? (grupos.get("paz_salvo") ?? []).length : 0) +
      (visibleIds.has("pago") ? (grupos.get("pago") ?? []).length : 0);
    return { criticos: cr, listos: li };
  }, [grupos, etapasVisibles]);




  return (
    <div
      className="min-h-[calc(100vh-72px)] px-3 py-4 text-[var(--nuvia-text-primary)] md:px-5"
      style={{
        background:
          "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1680px] space-y-5">
        {/* ══════════════ LEAD COMMAND CENTER — HERO PREMIUM ══════════════ */}
        <section
          className="glass-panel relative overflow-hidden p-4 md:p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(36,36,36,0.72) 0%, rgba(15,20,34,0.85) 55%, rgba(36,36,36,0.72) 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow:
              "0 30px 80px -40px rgba(68,93,163,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Fondo: grid técnico + halos */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(132,185,143,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(68,93,163,0.08) 1px, transparent 1px)",
              backgroundSize: "56px 56px, 56px 56px",
              maskImage:
                "radial-gradient(1200px 400px at 50% 40%, black 40%, transparent 80%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 300px at 12% -10%, rgba(68,93,163,0.28), transparent 60%), radial-gradient(700px 260px at 88% -12%, rgba(132,185,143,0.20), transparent 60%), radial-gradient(500px 200px at 50% 110%, rgba(68,93,163,0.18), transparent 60%)",
            }}
          />
          {/* Partículas flotantes */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {[...Array(14)].map((_, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${(i * 73) % 100}%`,
                  top: `${(i * 41) % 100}%`,
                  width: i % 3 === 0 ? "3px" : "2px",
                  height: i % 3 === 0 ? "3px" : "2px",
                  background:
                    i % 2 === 0 ? "rgba(132,185,143,0.55)" : "rgba(68,93,163,0.55)",
                  boxShadow:
                    i % 2 === 0
                      ? "0 0 8px rgba(132,185,143,0.9)"
                      : "0 0 8px rgba(68,93,163,0.9)",
                  animation: `nuvia-float-${i % 3} ${8 + (i % 5)}s ease-in-out ${i * 0.4}s infinite`,
                }}
              />
            ))}
          </div>

          <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,35fr)_minmax(0,35fr)_minmax(0,30fr)]">
            {/* ═════════ LEFT — Identidad + Toolbar + Quick tags ═════════ */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="flex items-start gap-3">
                <div
                  className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(68,93,163,0.9), rgba(132,185,143,0.55))",
                    boxShadow:
                      "0 0 0 1px rgba(255,255,255,0.08) inset, 0 0 26px rgba(68,93,163,0.55)",
                  }}
                >
                  <Radar className="h-5 w-5 text-white" />
                  <span
                    className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full"
                    style={{
                      background: "#84B98F",
                      boxShadow: "0 0 0 2px #0b1220, 0 0 12px rgba(132,185,143,0.9)",
                    }}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(132,185,143,0.9)]">
                    NUVIA · Operations
                  </div>
                  <h1
                    className="mt-1 text-[26px] font-bold leading-[1.02] tracking-[-0.025em] md:text-[30px] lg:text-[34px]"
                    style={{
                      backgroundImage:
                        "linear-gradient(120deg, #ffffff 0%, #cfe0ff 45%, #b6d9c1 100%)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    LEAD COMMAND CENTER
                  </h1>
                  <p className="mt-1 max-w-[440px] text-[12.5px] leading-snug text-[rgba(200,210,230,0.72)]">
                    Centro operativo de prospección, conversión, seguimiento y cierre inteligente.
                  </p>
                </div>
              </div>

              {/* Toolbar compacto premium */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgba(200,210,230,0.55)]" />
                  <input
                    ref={searchInputRef}
                    value={qLocal}
                    onChange={(e) => setQLocal(e.target.value)}
                    placeholder="Buscar cliente, cédula o crédito…"
                    className="h-8 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] pl-8 pr-7 text-xs text-white outline-none placeholder:text-[rgba(170,179,197,0.5)] backdrop-blur focus:border-[rgba(68,93,163,0.9)] focus:ring-2 focus:ring-[rgba(68,93,163,0.25)]"
                  />
                  <kbd className="pointer-events-none absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-1 text-[9px] text-[rgba(200,210,230,0.6)] sm:inline">/</kbd>
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium backdrop-blur transition hover:shadow-[0_0_18px_-4px_rgba(68,93,163,0.6)] ${
                    showFilters || advancedActive
                      ? "border-[rgba(68,93,163,0.9)] bg-[rgba(68,93,163,0.18)] text-white"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(200,210,230,0.75)]"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {advancedActive && (
                    <span className="ml-0.5 rounded-full bg-[rgba(68,93,163,0.6)] px-1.5 py-0.5 text-[9px] font-semibold text-white">
                      ON
                    </span>
                  )}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>

                <Link
                  to="/casos"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[11px] font-medium text-[rgba(200,210,230,0.75)] backdrop-blur transition hover:border-[rgba(68,93,163,0.9)] hover:text-white hover:shadow-[0_0_18px_-4px_rgba(68,93,163,0.6)]"
                  title="Cambiar a vista lista"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vista
                </Link>

                <button
                  type="button"
                  onClick={() => setControlOpen((v) => !v)}
                  aria-expanded={controlOpen}
                  title="Abrir torre de control (C)"
                  className={`relative inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold backdrop-blur transition hover:shadow-[0_0_18px_-4px_rgba(132,185,143,0.6)] ${
                    controlOpen
                      ? "border-[rgba(68,93,163,0.9)] bg-[rgba(68,93,163,0.18)] text-white"
                      : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(200,210,230,0.75)]"
                  }`}
                >
                  <Radar className="h-3.5 w-3.5 text-[#84B98F]" />
                  Control
                  {criticos > 0 && (
                    <span className="ml-0.5 rounded-full bg-[rgba(220,80,80,0.22)] px-1.5 py-0.5 text-[9px] font-bold text-[#ff8080]">
                      {criticos}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAnalisis((v) => !v)}
                  aria-expanded={showAnalisis}
                  className="relative inline-flex h-8 items-center gap-1.5 overflow-hidden rounded-lg border px-2.5 text-[11px] font-semibold text-white backdrop-blur transition"
                  title="Embudo ejecutivo y análisis NUVIA"
                  style={{
                    borderColor: showAnalisis ? "#84B98F" : "rgba(132,185,143,0.6)",
                    background: showAnalisis
                      ? "linear-gradient(135deg, rgba(132,185,143,0.28), rgba(132,185,143,0.08))"
                      : "linear-gradient(135deg, rgba(132,185,143,0.14), rgba(132,185,143,0.04))",
                    boxShadow:
                      "inset 0 0 0 1px rgba(132,185,143,0.35), 0 0 22px -6px rgba(132,185,143,0.55)",
                  }}
                >
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Sparkles className="relative h-3.5 w-3.5 text-[#84B98F]" />
                  <span className="relative">Análisis IA</span>
                  <ChevronDown className={`relative h-3 w-3 transition-transform ${showAnalisis ? "rotate-180" : ""}`} />
                </button>

                <button
                  onClick={() => cargar(true)}
                  disabled={loading || refreshing}
                  title={`Actualizado hace ${haceLabel}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[11px] text-[rgba(200,210,230,0.75)] backdrop-blur transition hover:border-[rgba(132,185,143,0.6)] disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[#84B98F] ${refreshing ? "animate-spin" : ""}`} />
                  {haceLabel}
                </button>

                <button
                  onClick={exportarCSV}
                  disabled={loading || totalVisible === 0}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold text-white shadow-[0_0_18px_-4px_rgba(68,93,163,0.6)] transition hover:brightness-110 disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #445DA3, #2f4380)",
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>

                {advancedActive && (
                  <button
                    onClick={clearAll}
                    className="h-8 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-2.5 text-[11px] text-[rgba(200,210,230,0.7)] backdrop-blur transition hover:border-[rgba(255,255,255,0.2)]"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Quick tags */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: "mios", label: "Mis casos", active: mios, onClick: () => user?.id && setMios(!mios), dot: "#445DA3" },
                  { key: "stuck", label: "Estancados", active: soloStuck, onClick: () => setSoloStuck(!soloStuck), dot: "#e0a04a" },
                  { key: "prio", label: "Alta prioridad", active: false, onClick: () => {}, dot: "#84B98F" },
                  { key: "cierre", label: "Cierre probable", active: false, onClick: () => {}, dot: "#84B98F" },
                  { key: "riesgo", label: "Riesgo alto", active: false, onClick: () => setSoloStuck(true), dot: "#ff8080" },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={p.onClick}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium backdrop-blur transition ${
                      p.active
                        ? "border-[rgba(132,185,143,0.7)] bg-[rgba(132,185,143,0.16)] text-white shadow-[0_0_14px_-4px_rgba(132,185,143,0.6)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] text-[rgba(200,210,230,0.7)] hover:border-[rgba(132,185,143,0.5)] hover:text-white"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: p.dot, boxShadow: `0 0 8px ${p.dot}` }}
                    />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ═════════ CENTER — HOLOGRAMA NUVIA LEAD ENGINE ═════════ */}
            <div className="relative flex min-h-[280px] items-center justify-center">
              <div className="relative h-[260px] w-[260px]">
                {/* Aura profunda */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(68,93,163,0.55) 0%, rgba(68,93,163,0.15) 40%, transparent 70%)",
                    filter: "blur(24px)",
                  }}
                />
                {/* Anillo exterior */}
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-full border animate-[spin_28s_linear_infinite]"
                  style={{
                    borderColor: "rgba(132,185,143,0.28)",
                    borderStyle: "dashed",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-6 rounded-full border animate-[spin_18s_linear_infinite_reverse]"
                  style={{
                    borderColor: "rgba(68,93,163,0.35)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-12 rounded-full border animate-[spin_10s_linear_infinite]"
                  style={{
                    borderColor: "rgba(255,255,255,0.08)",
                  }}
                />

                {/* Núcleo — esfera luminosa */}
                <div className="absolute left-1/2 top-1/2 h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2">
                  <div
                    className="absolute inset-0 animate-pulse rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 35% 30%, #a9c4ff 0%, #445DA3 45%, #1c2a55 100%)",
                      boxShadow:
                        "0 0 60px rgba(68,93,163,0.9), inset -8px -12px 30px rgba(0,0,0,0.55), inset 6px 8px 22px rgba(255,255,255,0.18)",
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle at 65% 70%, rgba(132,185,143,0.35), transparent 55%)",
                      mixBlendMode: "screen",
                    }}
                  />
                </div>

                {/* Nodo label núcleo */}
                <div className="absolute left-1/2 top-[calc(50%+68px)] -translate-x-1/2 whitespace-nowrap text-center">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[rgba(132,185,143,0.95)]">
                    NUVIA LEAD ENGINE
                  </div>
                  <div className="mt-0.5 text-[9px] text-[rgba(200,210,230,0.55)]">
                    Núcleo operativo · live
                  </div>
                </div>

                {/* 6 nodos orbitando */}
                {[
                  { label: "Leads", icon: TrendingUp, angle: -90 },
                  { label: "Bancos", icon: Coins, angle: -30 },
                  { label: "Analistas", icon: AnalistaAvatar as unknown as typeof TrendingUp, angle: 30 },
                  { label: "IA", icon: Sparkles, angle: 90 },
                  { label: "Riesgo", icon: ShieldAlert, angle: 150 },
                  { label: "Cierres", icon: CheckCircle2, angle: 210 },
                ].map((n, i) => {
                  const rad = (n.angle * Math.PI) / 180;
                  const r = 128;
                  const x = Math.cos(rad) * r;
                  const y = Math.sin(rad) * r;
                  const Icon = n.label === "Analistas" ? TrendingUp : n.icon;
                  return (
                    <div
                      key={n.label}
                      className="absolute left-1/2 top-1/2"
                      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
                    >
                      {/* línea al centro */}
                      <div
                        aria-hidden
                        className="pointer-events-none absolute left-1/2 top-1/2 h-px origin-left"
                        style={{
                          width: `${r - 22}px`,
                          transform: `translate(-100%, -50%) rotate(${n.angle + 180}deg)`,
                          background:
                            "linear-gradient(90deg, rgba(132,185,143,0.5), rgba(68,93,163,0.05))",
                          animation: `nuvia-breath 3.6s ease-in-out ${i * 0.3}s infinite`,
                        }}
                      />
                      <div
                        className="relative grid h-9 w-9 place-items-center rounded-full border backdrop-blur"
                        style={{
                          borderColor: "rgba(132,185,143,0.45)",
                          background:
                            "linear-gradient(135deg, rgba(36,36,36,0.85), rgba(20,26,44,0.85))",
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.05) inset, 0 0 18px -4px rgba(132,185,143,0.55)",
                        }}
                      >
                        <Icon className="h-3.5 w-3.5 text-[#cfe0ff]" />
                      </div>
                      <div className="mt-1 text-center text-[9px] font-medium uppercase tracking-wider text-[rgba(200,210,230,0.75)]">
                        {n.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═════════ RIGHT — KPI stack vertical ═════════ */}
            <div className="flex flex-col gap-2.5">
              {!loading && kpis.total > 0 ? (
                <>
                  <HeroKpiCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Casos activos"
                    value={String(kpis.total)}
                    accent="#445DA3"
                    progress={100}
                  />
                  <HeroKpiCard
                    icon={<AlertTriangle className="h-4 w-4" />}
                    label="En riesgo"
                    value={String(kpis.estancados)}
                    accent="#e07a5f"
                    progress={
                      kpis.total > 0 ? Math.min(100, Math.round((kpis.estancados / kpis.total) * 100)) : 0
                    }
                  />
                  <HeroKpiCard
                    icon={<Clock className="h-4 w-4" />}
                    label="Velocidad promedio"
                    value={`${kpis.promedio}d`}
                    accent="#84B98F"
                    progress={Math.min(100, kpis.promedio * 6)}
                  />
                  <HeroKpiCard
                    icon={<Coins className="h-4 w-4" />}
                    label="Pipeline proyectado"
                    value={fmtCOP(kpis.honorarios)}
                    accent="#84B98F"
                    progress={100}
                    emphasis
                  />
                </>
              ) : (
                <div className="grid h-full min-h-[220px] place-items-center rounded-xl border border-dashed border-[rgba(255,255,255,0.08)] text-xs text-[rgba(200,210,230,0.5)]">
                  {loading ? "Cargando métricas…" : "Sin datos aún"}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════ FILTROS AVANZADOS — barra horizontal debajo del hero ══════════════ */}
        {showFilters && (
          <section
            className="glass-panel relative overflow-hidden p-3"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
                className="h-9 rounded-lg border border-[var(--nuvia-border)] bg-[var(--nuvia-bg-tertiary)] px-3 text-xs text-[var(--nuvia-text-primary)] outline-none focus:border-[var(--nuvia-accent-blue)]"
              >
                <option value="">Todos los bancos</option>
                {bancos.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <select
                value={asesor}
                onChange={(e) => setAsesor(e.target.value)}
                title="Filtrar por analista financiero"
                className="h-9 max-w-[230px] rounded-lg border border-[var(--nuvia-border)] bg-[var(--nuvia-bg-tertiary)] px-3 text-xs text-[var(--nuvia-text-primary)] outline-none focus:border-[var(--nuvia-accent-blue)]"
              >
                <option value="">Todos los analistas</option>
                {(() => {
                  const seen = new Set<string>();
                  const combined: { id: string; nombre: string | null; email: string | null }[] = [];
                  analistas.forEach((a) => { if (!seen.has(a.id)) { seen.add(a.id); combined.push(a); } });
                  rows.forEach((r) => {
                    if (!r.asesor_id || seen.has(r.asesor_id)) return;
                    const p = profilesMap.get(r.asesor_id);
                    seen.add(r.asesor_id);
                    combined.push({ id: r.asesor_id, nombre: p?.nombre ?? null, email: p?.email ?? null });
                  });
                  combined.sort((a, b) => (a.nombre || a.email || "").localeCompare(b.nombre || b.email || "", "es"));
                  return combined.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre || a.email || a.id.slice(0, 8)}</option>
                  ));
                })()}
              </select>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-xs text-[var(--nuvia-text-secondary)]">
                <input
                  type="checkbox"
                  checked={mios}
                  onChange={(e) => setMios(e.target.checked)}
                  disabled={!user?.id}
                  className="h-3.5 w-3.5 accent-[var(--nuvia-accent-blue)]"
                />
                Mis casos
              </label>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-xs text-[var(--nuvia-text-secondary)]">
                <input
                  type="checkbox"
                  checked={soloStuck}
                  onChange={(e) => setSoloStuck(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--nuvia-danger)]"
                />
                Estancados
              </label>

              <div className="ml-1 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase text-[var(--nuvia-text-secondary)]">Fase:</span>
                {kpis.fases.map((f) => {
                  const active = fase === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFase(f.id as FaseId)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition ${
                        active
                          ? "border-[var(--nuvia-accent-blue)] bg-[rgba(68,93,163,0.22)] text-[var(--nuvia-text-primary)]"
                          : "border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] text-[var(--nuvia-text-secondary)] hover:border-[var(--nuvia-accent-blue)]"
                      }`}
                    >
                      {f.label}
                      <span className="rounded bg-[rgba(255,255,255,0.08)] px-1 text-[10px] font-semibold text-[var(--nuvia-text-primary)]">
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        )}



      {/* KPIs y chips de fase ahora viven dentro del header / filtros avanzados. */}

      {!loading && showAnalisis && funnel[0]?.passed > 0 && (
        <section className="glass-panel p-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase text-[var(--nuvia-accent-green)]">
                Embudo ejecutivo · Leads E1 → E2
              </div>
              <div className="text-xs text-[var(--nuvia-text-secondary)]">
                Conversión acumulada de casos visibles vs. E1 ({funnel[0].passed}).
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFunnel((v) => !v)}
              className="h-8 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-xs text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-border-strong)]"
            >
              {showFunnel ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showFunnel && (
            <div className="space-y-2">
              {funnel.map((f) => {
                const widthPct = Math.max(2, f.pct);
                const isStuck = f.drop >= 30 && f.numero > 1;
                return (
                  <div key={f.id} className="grid grid-cols-[44px_minmax(150px,1fr)_112px] items-center gap-2 md:grid-cols-[64px_1fr_140px]">
                    <div className="text-xs font-semibold text-[var(--nuvia-text-primary)]">
                      E{f.numero}
                    </div>
                    <div className="relative h-7 overflow-hidden rounded-lg bg-[rgba(255,255,255,0.03)] ring-1 ring-[var(--nuvia-border)]">
                      <div
                        className="h-full rounded-lg transition-all"
                        style={{
                          width: `${widthPct}%`,
                          background: isStuck
                            ? "color-mix(in oklab, var(--nuvia-danger) 32%, transparent)"
                            : "linear-gradient(90deg, color-mix(in oklab, var(--nuvia-accent-blue) 38%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 38%, transparent))",
                          borderRight: `1px solid ${isStuck ? "color-mix(in oklab, var(--nuvia-danger) 55%, transparent)" : "color-mix(in oklab, var(--nuvia-accent-green) 55%, transparent)"}`,
                        }}
                        title={`${f.passed} casos · ${f.pct}%`}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center px-3 text-xs font-semibold text-[var(--nuvia-text-primary)]">
                        {f.titulo}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-xs tabular-nums text-[var(--nuvia-text-secondary)]">
                      <span className="font-semibold text-[var(--nuvia-text-primary)]">{f.passed}</span>
                      <span>·</span>
                      <span>{f.pct}%</span>
                      {f.numero > 1 && (
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: f.drop >= 30 ? "var(--nuvia-danger)" : f.drop > 0 ? "var(--nuvia-warning)" : "var(--nuvia-accent-green)",
                            background: f.drop >= 30
                              ? "color-mix(in oklab, var(--nuvia-danger) 13%, transparent)"
                              : f.drop > 0
                                ? "color-mix(in oklab, var(--nuvia-warning) 13%, transparent)"
                                : "color-mix(in oklab, var(--nuvia-accent-green) 13%, transparent)",
                          }}
                          title="Caída vs. etapa anterior"
                        >
                          -{f.drop}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}


      {loading ? (
        <div className="glass-panel flex items-center gap-2 p-5 text-sm text-[var(--nuvia-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--nuvia-accent-green)]" /> Cargando pipeline…
        </div>
      ) : (
        <div className="overflow-x-auto pb-4 scrollbar-thin">
          <div className="flex min-w-max gap-2.5">
            {etapasVisibles.map((etapa) => {
              const items = grupos.get(etapa.id) ?? [];
              const diasArr = items.map((r) => diasDesde(r.updated_at));
              const stuckCount = items.filter((r) => {
                const umbral = rowSla(r);
                return umbral > 0 && diasDesde(r.updated_at) > umbral;
              }).length;
              const laneSlaValues = Array.from(new Set(items.map(rowSla).filter((v) => v > 0))).sort((a, b) => a - b);
              const slaLabel = laneSlaValues.length === 0 ? "—" : laneSlaValues.length === 1 ? `${laneSlaValues[0]}d` : "variable";
              const avgDias = diasArr.length > 0 ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length) : 0;
              const heatStyle = stuckCount > 0
                ? {
                    borderColor: "color-mix(in oklab, var(--nuvia-danger) 36%, transparent)",
                    background: "linear-gradient(180deg, color-mix(in oklab, var(--nuvia-danger) 10%, var(--nuvia-bg-tertiary)), var(--nuvia-bg-secondary))",
                  }
                : {
                    borderColor: "var(--nuvia-border)",
                    background: "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018))",
                  };
              return (
                <div
                  key={etapa.id}
                  className="w-[292px] flex-shrink-0 rounded-2xl border p-3 shadow-[var(--nuvia-shadow-sm)]"
                  style={heatStyle}
                >
                  <div className="mb-3 flex items-start justify-between gap-2 px-1">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase text-[var(--nuvia-accent-green)]">
                        E{etapa.numero}
                      </div>
                      <div className="truncate text-base font-semibold text-[var(--nuvia-text-primary)]">
                        {etapa.titulo}
                      </div>
                      <div className="mt-1 line-clamp-2 min-h-[32px] text-[11px] leading-4 text-[var(--nuvia-text-secondary)]">
                        {etapa.descripcion}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.045)] px-2.5 py-1 text-xs font-semibold text-[var(--nuvia-text-primary)]">
                      {items.length}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <div className="mb-3 flex items-center justify-between gap-2 px-1 text-xs">
                      <span className="inline-flex items-center gap-1 text-[var(--nuvia-text-secondary)]">
                        <Clock className="h-3 w-3" /> prom. {avgDias}d
                        {slaLabel !== "—" && <span className="opacity-70">· SLA {slaLabel}</span>}
                      </span>
                      {stuckCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-[var(--nuvia-danger)]" style={{ background: "color-mix(in oklab, var(--nuvia-danger) 13%, transparent)" }}>
                          <AlertTriangle className="h-3 w-3" /> {stuckCount}
                        </span>
                      )}
                    </div>
                  )}


                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.02)] px-3 py-5 text-center text-xs text-[var(--nuvia-text-secondary)]">
                        Sin casos
                      </div>
                    ) : (
                      items.map((r) => {
                        const dias = diasDesde(r.updated_at);
                        const umbral = rowSla(r);
                        const stuck = umbral > 0 && dias > umbral;
                        const isDup = !!r.cedula && dupCedulas.has(r.cedula.trim());
                        const prof = profilesMap.get(r.asesor_id);
                        const qa = qaMap.get(r.id);
                        const identity = identityMap.get(r.id);
                        const displayCliente = preferPipelineText(r.cliente_nombre, identity?.clienteNombre) || "Sin nombre";
                        const displayCedula = preferPipelineText(r.cedula, identity?.cedula) || "s/cédula";
                        const displayBanco = preferPipelineText(r.banco, identity?.banco) || "—";
                        const qaTone = !qa
                          ? { color: "var(--nuvia-text-secondary)", bg: "rgba(255,255,255,0.05)", border: "var(--nuvia-border)" }
                          : qa.score >= 90
                            ? { color: "var(--nuvia-accent-green)", bg: "color-mix(in oklab, var(--nuvia-accent-green) 14%, transparent)", border: "color-mix(in oklab, var(--nuvia-accent-green) 36%, transparent)" }
                            : qa.score >= 70
                              ? { color: "var(--nuvia-warning)", bg: "color-mix(in oklab, var(--nuvia-warning) 14%, transparent)", border: "color-mix(in oklab, var(--nuvia-warning) 36%, transparent)" }
                              : { color: "var(--nuvia-danger)", bg: "color-mix(in oklab, var(--nuvia-danger) 14%, transparent)", border: "color-mix(in oklab, var(--nuvia-danger) 36%, transparent)" };
                        return (
                          <div
                            key={r.id}
                            className="group relative rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] p-3 text-left transition hover:border-[var(--nuvia-accent-blue)] hover:bg-[rgba(255,255,255,0.065)]"
                          >
                            <div className="flex items-center gap-1.5">
                              <AnalistaAvatar nombre={prof?.nombre} email={prof?.email} size={22} />
                              <Link
                                to="/casos/$id"
                                params={{ id: r.id }}
                                className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--nuvia-text-primary)] hover:underline"
                                title="Abrir expediente completo"
                              >
                                 {displayCliente}
                              </Link>
                              {isDup && (
                                <span
                                  title="Esta cédula tiene más de un expediente activo"
                                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[var(--nuvia-warning)]"
                                  style={{ background: "color-mix(in oklab, var(--nuvia-warning) 14%, transparent)" }}
                                >
                                  Dup
                                </span>
                              )}
                            </div>
                            <div className="mt-1 truncate text-xs text-[var(--nuvia-text-secondary)]">
                               {displayBanco} · {displayCedula}
                            </div>
                            {r.codigo && (
                              <div
                                className="mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-black tracking-wider"
                                style={{ background: "color-mix(in oklab, var(--nuvia-accent-green) 12%, transparent)", color: "var(--nuvia-accent-green)", border: "1px solid color-mix(in oklab, var(--nuvia-accent-green) 32%, transparent)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                                title={`Código de expediente NUVIA · ${r.codigo}`}
                              >
                                {r.codigo}
                              </div>
                            )}
                            <div className="mt-1 text-[11px] text-[rgba(170,179,197,0.72)]">
                              act. {r.updated_at ? new Date(r.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—"}
                            </div>
                            {(() => {
                              const fase = laneVisualLead(r, qa) === "en_revision" ? "en_revision" : "con_proyeccion";
                              const prog = progresoLead(r, qa);
                              const motivos = fase === "en_revision" ? motivosRevision(r, qa) : [];
                              return (
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                  <span
                                    title="Soporte bancario cargado"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px]"
                                    style={{
                                      background: prog.extracto ? "color-mix(in oklab, var(--nuvia-accent-green) 16%, transparent)" : "rgba(255,255,255,0.04)",
                                      color: prog.extracto ? "var(--nuvia-accent-green)" : "var(--nuvia-text-secondary)",
                                    }}
                                  >📄</span>
                                  <span
                                    title="Lead con simulación generada"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px]"
                                    style={{
                                      background: prog.simulacion ? "color-mix(in oklab, var(--nuvia-accent-green) 16%, transparent)" : "rgba(255,255,255,0.04)",
                                      color: prog.simulacion ? "var(--nuvia-accent-green)" : "var(--nuvia-text-secondary)",
                                    }}
                                  >🧮</span>
                                  <span
                                    title={prog.qa ? `QA ejecutado · ${prog.qaScore ?? 0}/100` : "Sin QA"}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px]"
                                    style={{
                                      background: prog.qa ? "color-mix(in oklab, var(--nuvia-accent-green) 16%, transparent)" : "rgba(255,255,255,0.04)",
                                      color: prog.qa ? "var(--nuvia-accent-green)" : "var(--nuvia-text-secondary)",
                                    }}
                                  >🛡️</span>
                                  {fase === "en_revision" && (
                                    <Link
                                      to="/direccion/revisiones"
                                      onClick={(e) => e.stopPropagation()}
                                      title={motivos.map((m) => `• ${m.detalle}`).join("\n") || "Lead en revisión Dirección"}
                                      className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition hover:brightness-110"
                                      style={{
                                        color: "var(--nuvia-warning)",
                                        background: "color-mix(in oklab, var(--nuvia-warning) 14%, transparent)",
                                        border: "1px solid color-mix(in oklab, var(--nuvia-warning) 36%, transparent)",
                                      }}
                                    >
                                      <ShieldAlert className="h-3 w-3" /> Revisión
                                    </Link>
                                  )}
                                </div>
                              );
                            })()}
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="inline-flex min-w-0 max-w-[120px] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[var(--nuvia-accent-green)]" style={{ background: "color-mix(in oklab, var(--nuvia-accent-green) 12%, transparent)" }}>
                                <Flag className="h-3 w-3" /> {r.estado}
                              </span>
                              <div className="flex items-center gap-1">
                                {qa ? (
                                  <Link
                                    to="/qa-ai/$id"
                                    params={{ id: qa.id }}
                                    onClick={(e) => e.stopPropagation()}
                                    title={`Auditoría QA · ${qa.dictamen ?? "sin dictamen"} · ${qa.score}/100`}
                                    className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition hover:brightness-110"
                                    style={{ color: qaTone.color, background: qaTone.bg, borderColor: qaTone.border }}
                                  >
                                    <ShieldAlert className="h-3 w-3" />
                                    QA {Math.round(qa.score)}
                                  </Link>
                                ) : (
                                  <Link
                                    to="/qa-ai/nuevo"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Sin auditoría QA — crear"
                                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-[var(--nuvia-border)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-accent-blue)] hover:text-[var(--nuvia-text-primary)]"
                                  >
                                    <ShieldAlert className="h-3 w-3" />
                                    QA —
                                  </Link>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setPeekId(r.id); }}
                                  title="Vista rápida"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-accent-blue)] hover:text-[var(--nuvia-text-primary)]"
                                >
                                  <Eye className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditId(r.id); }}
                                  title="Editar"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-accent-blue)] hover:text-[var(--nuvia-text-primary)]"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <span
                                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                                  style={{
                                    color: stuck ? "var(--nuvia-danger)" : "var(--nuvia-text-secondary)",
                                    background: stuck
                                      ? "color-mix(in oklab, var(--nuvia-danger) 12%, transparent)"
                                      : "rgba(255,255,255,0.045)",
                                  }}
                                >
                                  {stuck ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {dias}d
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>

      {peekExpediente && (
        <LeadQuickPeek
          expediente={peekExpediente}
          analista={(() => {
            const p = profilesMap.get(peekExpediente.asesor_id);
            return p ? { id: peekExpediente.asesor_id, nombre: p.nombre, email: p.email } : null;
          })()}
          diasEnEtapa={diasDesde(peekExpediente.updated_at)}
          etapaTitulo={(() => {
            const lane = laneVisualLead(peekExpediente, qaMap.get(peekExpediente.id));
            const e = getLaneById(lane);
            return e ? `E${e.numero} · ${e.titulo}` : "—";
          })()}
          onClose={() => setPeekId(null)}
          onEdit={() => { setEditId(peekExpediente.id); setPeekId(null); }}
        />
      )}

      {editExpediente && (
        <LeadEditDrawer
          expediente={editExpediente}
          analistas={analistas}
          onClose={() => setEditId(null)}
          onSaved={() => cargar(true)}
        />
      )}

      <PipelineControlPanel
        total={kpis.total}
        estancados={kpis.estancados}
        promedio={kpis.promedio}
        honorarios={kpis.honorarios}
        fases={kpis.fases.map((f) => ({ id: f.id, label: f.label.split(" · ")[0], count: f.count }))}
        criticos={criticos}
        listos={listos}
        breakdown={pipelineBreakdown}
        soloStuck={soloStuck}
        onToggleStuck={() => setSoloStuck(!soloStuck)}
        fmtCOP={fmtCOP}
        open={controlOpen}
        onOpenChange={setControlOpen}
        onSelectBanco={(b) =>
          navigate({ search: (prev: PipelineSearch) => ({ ...prev, banco: b }), replace: true })
        }
        onSelectAnalista={(id) =>
          navigate({ search: (prev: PipelineSearch) => ({ ...prev, asesor: id }), replace: true })
        }
      />


      <NuviaPipelinePanel contexto={pipelineCtx} />
    </div>
  );
}

// Chip compacto del header — etiqueta arriba, valor grande con tono opcional.
function HeaderChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "var(--nuvia-danger)"
      : tone === "success"
      ? "var(--nuvia-accent-green)"
      : "var(--nuvia-text-primary)";
  const border =
    tone === "danger"
      ? "color-mix(in oklab, var(--nuvia-danger) 38%, transparent)"
      : tone === "success"
      ? "color-mix(in oklab, var(--nuvia-accent-green) 36%, transparent)"
      : "var(--nuvia-border)";
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-1.5"
      style={{
        borderColor: border,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--nuvia-text-secondary)]">
        {label}
      </span>
      <span
        className="text-sm font-bold tabular-nums"
        style={{ color, textShadow: tone ? `0 0 18px color-mix(in oklab, ${color} 32%, transparent)` : undefined }}
      >
        {value}
      </span>
    </div>
  );
}

function HeroKpiCard({
  icon,
  label,
  value,
  accent,
  progress = 100,
  emphasis = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent: string;
  progress?: number;
  emphasis?: boolean;
}) {
  return (
    <div
      className="group relative overflow-hidden rounded-xl border p-3 backdrop-blur-xl transition hover:-translate-y-[1px]"
      style={{
        borderColor: "rgba(255,255,255,0.07)",
        background: emphasis
          ? `linear-gradient(135deg, rgba(132,185,143,0.14), rgba(36,36,36,0.55))`
          : `linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 0 22px -12px ${accent}`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
        style={{ background: accent }}
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-[rgba(200,210,230,0.65)]">
            {label}
          </div>
          <div
            className="mt-0.5 truncate text-[18px] font-bold leading-tight tabular-nums text-white"
            style={{ textShadow: `0 0 14px ${accent}55` }}
          >
            {value}
          </div>
        </div>
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${accent}44, ${accent}11)`,
            color: accent,
            boxShadow: `inset 0 0 0 1px ${accent}55`,
          }}
        >
          {icon}
        </div>
      </div>
      {/* micro progress line */}
      <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.05)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(4, Math.min(100, progress))}%`,
            background: `linear-gradient(90deg, ${accent}, ${accent}77)`,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
      </div>
    </div>
  );
}





