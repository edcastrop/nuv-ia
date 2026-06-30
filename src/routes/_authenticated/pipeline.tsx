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

const PIPELINE_LEAD_LANES: ReadonlyArray<(typeof ETAPAS_PIPELINE)[number]> = ETAPAS_PIPELINE;

const FASE_LANE: Record<FaseId, "con_proyeccion" | "en_revision"> = {
  con_proyeccion: "con_proyeccion",
  en_revision: "en_revision",
};


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

function laneVisualLead(exp: Expediente, qa: { id: string; score: number; dictamen: string | null } | undefined): EtapaPipelineId {
  return motivosRevision(exp, qa).length > 0 ? "proyeccion" : "lead";
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
  const [qaMap, setQaMap] = useState<Map<string, { id: string; score: number; dictamen: string | null }>>(new Map());
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

  // Cargar analistas financieros (rol "licenciado") para el filtro.
  useEffect(() => {
    (async () => {
      const { data: ur } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "licenciado" as never);
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
    const m = new Map<EtapaPipelineId, Expediente[]>();
    PIPELINE_LEAD_LANES.forEach((e) => m.set(e.id, []));
    filtered.forEach((r) => {
      const etapa = etapaInterna(r);
      const dias = diasDesde(r.updated_at);
      const umbral = UMBRAL_DIAS[etapa] ?? 0;
      if (soloStuck && !(umbral > 0 && dias > umbral)) return;
      m.get(laneVisualLead(r, qaMap.get(r.id)))?.push(r);
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
    () => PIPELINE_LEAD_LANES.filter((etapa) => !fase || FASE_LANE[fase as FaseId] === etapa.id),
    [fase],
  );

  const totalVisible = etapasVisibles.reduce((a, etapa) => a + (grupos.get(etapa.id) ?? []).length, 0);

  // P17 — Exportar CSV de los casos visibles (respeta filtros + etapa derivada).
  const exportarCSV = () => {
    const etapaTitulo = new Map(PIPELINE_LEAD_LANES.map((e) => [e.id, `E${e.numero} ${e.titulo}`]));
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
    const fases: Array<{ id: string; label: string; etapas: EtapaPipelineId[]; count: number }> = [
      { id: "con_proyeccion", label: "Lead con Proyección", etapas: ["lead"], count: 0 },
      { id: "en_revision", label: "Lead en Revisión", etapas: ["proyeccion"], count: 0 },
    ];
    let honorarios = 0;
    etapasVisibles.forEach((etapa) => {
      const items = grupos.get(etapa.id) ?? [];
      const umbral = UMBRAL_DIAS[etapa.id] ?? 0;
      items.forEach((r) => {
        const d = diasDesde(r.updated_at);
        total += 1;
        totalDias += d;
        honorarios += Number(r.honorarios_final ?? 0);
        if (umbral > 0 && d > umbral) estancados += 1;
      });
      const fase = fases.find((f) => f.etapas.includes(etapa.id));
      if (fase) fase.count += items.length;
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
    const etapaTitulo = new Map(PIPELINE_LEAD_LANES.map((e) => [e.id, `E${e.numero} ${e.titulo}`] as const));
    const topEstancados: PipelineCtx["topEstancados"] = [];
    let sinAsesor = 0;
    etapasVisibles.forEach((etapa) => {
      const umbral = UMBRAL_DIAS[etapa.id] ?? 0;
      (grupos.get(etapa.id) ?? []).forEach((r) => {
        const d = diasDesde(r.updated_at);
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
      const umbral = UMBRAL_DIAS[e.id] ?? 0;
      if (umbral <= 0) return;
      (grupos.get(e.id) ?? []).forEach((r) => {
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
        <section className="glass-panel relative overflow-hidden p-4 md:p-5">
          {/* Aura sutil de torre de control */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(1000px 320px at 8% -10%, color-mix(in oklab, var(--nuvia-accent-blue) 16%, transparent), transparent 60%), radial-gradient(800px 260px at 95% -20%, color-mix(in oklab, var(--nuvia-accent-green) 12%, transparent), transparent 60%)",
            }}
          />

          {/* Fila ejecutiva: identidad operacional + 4 KPIs premium */}
          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--nuvia-text-primary)]"
                style={{
                  background: "var(--nuvia-gradient-primary)",
                  boxShadow: "var(--nuvia-shadow-md), inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 24px color-mix(in oklab, var(--nuvia-accent-blue) 30%, transparent)",
                }}
                aria-hidden
              >
                <Radar className="h-5 w-5" />
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full"
                  style={{
                    background: "var(--nuvia-accent-green)",
                    boxShadow: "0 0 0 2px var(--nuvia-bg-secondary), 0 0 14px color-mix(in oklab, var(--nuvia-accent-green) 80%, transparent)",
                  }}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-[26px] font-bold leading-[1.05] tracking-[-0.02em] text-[var(--nuvia-text-primary)] md:text-[32px] lg:text-[40px]">
                  Pipeline de Leads
                </h1>
              </div>
            </div>

            {/* Resumen mínimo en el header — el detalle vive en la Torre de control lateral */}
            {!loading && kpis.total > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <HeaderChip label="Casos activos" value={String(kpis.total)} />
                <HeaderChip label="En riesgo" value={String(kpis.estancados)} tone="danger" />
                <HeaderChip label="Velocidad" value={`${kpis.promedio}d`} />
                <HeaderChip label="Pipeline" value={fmtCOP(kpis.honorarios)} tone="success" />
              </div>
            )}
          </div>

          {/* Momentum + Toolbar */}
          <div className="relative mt-5 flex flex-col gap-3 border-t border-[var(--nuvia-border)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Buscador reducido */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-[288px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--nuvia-text-secondary)]" />
                <input
                  ref={searchInputRef}
                  value={qLocal}
                  onChange={(e) => setQLocal(e.target.value)}
                  placeholder="Buscar cliente, cédula o crédito…"
                  className="h-9 w-full rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] pl-8 pr-8 text-sm text-[var(--nuvia-text-primary)] outline-none placeholder:text-[rgba(170,179,197,0.55)] focus:border-[var(--nuvia-accent-blue)] focus:ring-2 focus:ring-[rgba(68,93,163,0.22)]"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-1 text-[10px] text-[var(--nuvia-text-secondary)] sm:inline">/</kbd>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((v) => !v)}
                  aria-expanded={showFilters}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${
                    showFilters || advancedActive
                      ? "border-[var(--nuvia-accent-blue)] bg-[rgba(68,93,163,0.16)] text-[var(--nuvia-text-primary)]"
                      : "border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] text-[var(--nuvia-text-secondary)] hover:border-[var(--nuvia-border-strong)]"
                  }`}
                  title="Banco, analista, fase, mis casos, estancados"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtros
                  {advancedActive && (
                    <span
                      className="ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-[var(--nuvia-text-primary)]"
                      style={{ background: "color-mix(in oklab, var(--nuvia-accent-blue) 55%, transparent)" }}
                    >
                      ON
                    </span>
                  )}
                  <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                </button>

                <Link
                  to="/casos"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-2.5 text-xs text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-border-strong)] hover:text-[var(--nuvia-text-primary)]"
                  title="Cambiar a vista lista"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Vista
                </Link>

                {/* Torre de control — chip que abre el drawer lateral */}
                <button
                  type="button"
                  onClick={() => setControlOpen((v) => !v)}
                  aria-expanded={controlOpen}
                  title="Abrir torre de control (C)"
                  className={`relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${
                    controlOpen
                      ? "border-[var(--nuvia-accent-blue)] bg-[rgba(68,93,163,0.18)] text-[var(--nuvia-text-primary)]"
                      : "border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] text-[var(--nuvia-text-secondary)] hover:border-[var(--nuvia-border-strong)] hover:text-[var(--nuvia-text-primary)]"
                  }`}
                >
                  <Radar className="h-3.5 w-3.5 text-[var(--nuvia-accent-green)]" />
                  Control
                  {criticos > 0 && (
                    <span
                      className="ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                      style={{
                        background: "color-mix(in oklab, var(--nuvia-danger) 22%, transparent)",
                        color: "var(--nuvia-danger)",
                      }}
                    >
                      {criticos}
                    </span>
                  )}
                </button>


                {/* Análisis IA — protagonista */}
                <button
                  type="button"
                  onClick={() => setShowAnalisis((v) => !v)}
                  aria-expanded={showAnalisis}
                  className="relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-lg border px-3 text-xs font-semibold transition"
                  title="Embudo ejecutivo y análisis NUVIA"
                  style={{
                    borderColor: showAnalisis
                      ? "var(--nuvia-accent-green)"
                      : "color-mix(in oklab, var(--nuvia-accent-green) 55%, transparent)",
                    background: showAnalisis
                      ? "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-green) 22%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 8%, transparent))"
                      : "linear-gradient(135deg, color-mix(in oklab, var(--nuvia-accent-green) 12%, transparent), color-mix(in oklab, var(--nuvia-accent-green) 4%, transparent))",
                    color: "var(--nuvia-text-primary)",
                    boxShadow: showAnalisis
                      ? "0 0 0 1px color-mix(in oklab, var(--nuvia-accent-green) 40%, transparent) inset, 0 0 28px -6px color-mix(in oklab, var(--nuvia-accent-green) 55%, transparent)"
                      : "0 0 0 1px color-mix(in oklab, var(--nuvia-accent-green) 30%, transparent) inset, 0 0 22px -8px color-mix(in oklab, var(--nuvia-accent-green) 35%, transparent)",
                  }}
                >
                  <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Sparkles className="relative h-4 w-4 text-[var(--nuvia-accent-green)]" />
                  <span className="relative">Análisis IA</span>
                  <ChevronDown className={`relative h-3 w-3 transition-transform ${showAnalisis ? "rotate-180" : ""}`} />
                </button>

                {advancedActive && (
                  <button
                    onClick={clearAll}
                    className="h-9 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-2.5 text-xs text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-border-strong)]"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {/* Momentum vive ahora dentro de la Torre de control lateral */}

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => cargar(true)}
                  disabled={loading || refreshing}
                  title={`Actualizado hace ${haceLabel}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-2.5 text-xs text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-[var(--nuvia-accent-green)] ${refreshing ? "animate-spin" : ""}`} />
                  {haceLabel}
                </button>
                <button
                  onClick={exportarCSV}
                  disabled={loading || totalVisible === 0}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-transparent px-3 text-xs font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: "var(--nuvia-gradient-primary)" }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
              </div>
            </div>
          </div>

          {/* Filtros avanzados colapsables */}
          {showFilters && (
            <div className="relative mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.025)] p-3">
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
                {analistas.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre || a.email || a.id.slice(0, 8)}</option>
                ))}
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

              {/* Fases en chips compactos dentro de filtros avanzados */}
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
          )}
        </section>



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
              const umbral = UMBRAL_DIAS[etapa.id] ?? 0;
              const diasArr = items.map((r) => diasDesde(r.updated_at));
              const stuckCount = umbral > 0 ? diasArr.filter((d) => d > umbral).length : 0;
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
                        {umbral > 0 && <span className="opacity-70">· SLA {umbral}d</span>}
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
                            <div className="mt-1 text-[11px] text-[rgba(170,179,197,0.72)]">
                              act. {r.updated_at ? new Date(r.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—"}
                            </div>
                            {(() => {
                              const fase = laneVisualLead(r, qa) === "proyeccion" ? "en_revision" : "con_proyeccion";
                              const prog = progresoLead(r, qa);
                              const motivos = fase === "en_revision" ? motivosRevision(r, qa) : [];
                              return (
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                  <span
                                    title="Lead con extracto cargado"
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
            const e = PIPELINE_LEAD_LANES.find((x) => x.id === lane);
            const interna = ETAPAS_PIPELINE.find((x) => x.id === etapaInterna(peekExpediente));
            return e ? `E${e.numero} · ${e.titulo}${interna ? ` · Interna: ${interna.titulo}` : ""}` : "—";
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





