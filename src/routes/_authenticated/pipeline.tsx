// P14 — Vista Kanban del Pipeline Maestro NUVEX (15 etapas E1→E15).
// P15 — Filtros (búsqueda, banco, solo estancados).
// P16 — Filtros persistidos en URL via search params (compartibles).

import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Loader2, Flag, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { listExpedientes, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import { BANCOS } from "@/components/nuvex/constants";
import { useAuth } from "@/hooks/useAuth";
import { getRecentCases } from "@/lib/recentCases";
import { supabase } from "@/integrations/supabase/client";

const FASE_IDS = ["comercial", "operativa", "banco", "cobro", "fin"] as const;
type FaseId = (typeof FASE_IDS)[number];

const pipelineSearchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  banco: fallback(z.string(), "").default(""),
  stuck: fallback(z.boolean(), false).default(false),
  fase: fallback(z.enum(["", ...FASE_IDS]), "").default(""),
  mios: fallback(z.boolean(), false).default(false),
  asesor: fallback(z.string(), "").default(""),
});

const FASE_ETAPAS: Record<FaseId, EtapaPipelineId[]> = {
  comercial: ["lead", "extracto", "proyeccion", "presentacion", "cierre"],
  operativa: ["contratacion", "radicacion"],
  banco: ["banco", "resultado_banco", "aceptacion_cliente"],
  cobro: ["informe", "cuenta", "pago", "paz_salvo"],
  fin: ["finalizado"],
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
      if (asesor && r.asesor_id !== asesor) return false;
      if (banco && r.banco !== banco) return false;
      if (term) {
        const hay = `${r.cliente_nombre} ${r.cedula ?? ""} ${r.numero_credito ?? ""} ${r.banco ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, banco, mios, asesor, user?.id]);

  const grupos = useMemo(() => {
    const m = new Map<EtapaPipelineId, Expediente[]>();
    ETAPAS_PIPELINE.forEach((e) => m.set(e.id, []));
    filtered.forEach((r) => {
      const etapa = computeEtapaActual({
        estado_caso: (r as unknown as { estado_caso?: string | null }).estado_caso ?? null,
      } as Parameters<typeof computeEtapaActual>[0]);
      const dias = diasDesde(r.updated_at);
      const umbral = UMBRAL_DIAS[etapa] ?? 0;
      if (soloStuck && !(umbral > 0 && dias > umbral)) return;
      m.get(etapa)?.push(r);
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
  }, [filtered, soloStuck]);

  const totalVisible = Array.from(grupos.values()).reduce((a, b) => a + b.length, 0);

  // P17 — Exportar CSV de los casos visibles (respeta filtros + etapa derivada).
  const exportarCSV = () => {
    const etapaTitulo = new Map(ETAPAS_PIPELINE.map((e) => [e.id, `E${e.numero} ${e.titulo}`]));
    const headers = ["Cliente", "Cédula", "Banco", "Crédito", "Etapa", "Estado", "Días", "Actualizado"];
    const lines: string[] = [headers.join(",")];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    ETAPAS_PIPELINE.forEach((etapa) => {
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
      { id: "comercial", label: "Comercial · E1-5", etapas: ["lead", "extracto", "proyeccion", "presentacion", "cierre"], count: 0 },
      { id: "operativa", label: "Operativa · E6-7", etapas: ["contratacion", "radicacion"], count: 0 },
      { id: "banco",     label: "Banco · E8-10",    etapas: ["banco", "resultado_banco", "aceptacion_cliente"], count: 0 },
      { id: "cobro",     label: "Cobro · E11-14",   etapas: ["informe", "cuenta", "pago", "paz_salvo"], count: 0 },
      { id: "fin",       label: "Cierre · E15",     etapas: ["finalizado"], count: 0 },
    ];
    let honorarios = 0;
    ETAPAS_PIPELINE.forEach((etapa) => {
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
  }, [grupos]);

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

  // P28 — Vistos recientemente (localStorage). Se refresca al cargar y al refrescar.
  const recents = useMemo(() => getRecentCases(), [lastUpdated]);

  // P30 — Embudo ejecutivo E1→E14: conteo por etapa + conversión acumulada vs E1.
  const [showFunnel, setShowFunnel] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("nuvex.pipeline.funnel") !== "0";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("nuvex.pipeline.funnel", showFunnel ? "1" : "0");
    }
  }, [showFunnel]);

  const funnel = useMemo(() => {
    const counts = ETAPAS_PIPELINE.map((e) => ({
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
  }, [grupos]);




  return (
    <div className="mx-auto max-w-[1400px] p-3 md:p-4">
      <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0A1226]">Pipeline Maestro</h1>
          <div className="text-[12px] text-[#242424]/60">
            {totalVisible} de {rows.length} casos · 14 etapas
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={searchInputRef}
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder='Buscar cliente, cédula, crédito…  ( / )'
            className="h-8 w-[240px] rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#0A1226] placeholder:text-[#9CA3AF] focus:border-[#445DA3] focus:outline-none"
          />
          <select
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            className="h-8 rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#0A1226] focus:border-[#445DA3] focus:outline-none"
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
            className="h-8 max-w-[200px] rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#0A1226] focus:border-[#445DA3] focus:outline-none"
          >
            <option value="">Todos los analistas</option>
            {analistas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre || a.email || a.id.slice(0, 8)}</option>
            ))}
          </select>
          <button
            onClick={() => cargar(true)}
            disabled={loading || refreshing}
            title={`Actualizado hace ${haceLabel}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#445DA3] hover:bg-[#F1F3F8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="text-[#242424]/60">hace {haceLabel}</span>
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E3E7EE] bg-white px-2 py-1 text-[12px] text-[#0A1226]">
            <input
              type="checkbox"
              checked={mios}
              onChange={(e) => setMios(e.target.checked)}
              disabled={!user?.id}
              className="h-3.5 w-3.5"
            />
            Mis casos
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E3E7EE] bg-white px-2 py-1 text-[12px] text-[#0A1226]">
            <input
              type="checkbox"
              checked={soloStuck}
              onChange={(e) => setSoloStuck(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            Solo estancados
          </label>
          {(q || banco || soloStuck || fase || mios || asesor) && (
            <button
              onClick={clearAll}
              className="h-8 rounded-md border border-[#E3E7EE] bg-white px-2 text-[12px] text-[#445DA3] hover:bg-[#F1F3F8]"
            >
              Limpiar
            </button>
          )}
          <button
            onClick={exportarCSV}
            disabled={loading || totalVisible === 0}
            className="h-8 rounded-md border border-[#445DA3] bg-[#445DA3] px-2 text-[12px] font-medium text-white hover:bg-[#3a4f8c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exportar CSV
          </button>
          <Link to="/casos" className="text-[12px] text-[#445DA3] hover:underline">
            Ver lista →
          </Link>
        </div>
      </div>

      {recents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/40">
            Vistos recientemente
          </span>
          {recents.map((rc) => (
            <Link
              key={rc.id}
              to="/casos/$id"
              params={{ id: rc.id }}
              className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-[#E3E7EE] bg-white px-2 py-0.5 text-[11px] text-[#0A1226] hover:border-[#445DA3] hover:text-[#445DA3]"
              title={rc.nombre}
            >
              <span className="truncate">{rc.nombre}</span>
            </Link>
          ))}
        </div>
      )}


      {!loading && kpis.total > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <div className="rounded-xl border border-[#E3E7EE] bg-white p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#242424]/50">Total</div>
            <div className="mt-0.5 text-lg font-semibold text-[#0A1226]">{kpis.total}</div>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-rose-600/70">Estancados</div>
            <div className="mt-0.5 flex items-center gap-1 text-lg font-semibold text-rose-700">
              <AlertTriangle className="h-4 w-4" /> {kpis.estancados}
            </div>
          </div>
          <div className="rounded-xl border border-[#E3E7EE] bg-white p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-[#242424]/50">Días prom.</div>
            <div className="mt-0.5 flex items-center gap-1 text-lg font-semibold text-[#0A1226]">
              <Clock className="h-4 w-4 text-[#445DA3]" /> {kpis.promedio}
            </div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5" title="Suma de honorarios_final de los casos visibles">
            <div className="text-[10px] uppercase tracking-wider text-emerald-700/70">Honorarios</div>
            <div className="mt-0.5 text-lg font-semibold text-emerald-800">{fmtCOP(kpis.honorarios)}</div>
          </div>
          {kpis.fases.map((f) => {
            const active = fase === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFase(f.id as FaseId)}
                className={`rounded-xl p-2.5 text-left ring-1 transition hover:brightness-95 ${f.color} ${active ? "ring-2 ring-offset-1 ring-[#445DA3]" : ""}`}
                title={active ? "Quitar filtro de fase" : "Filtrar por esta fase"}
              >
                <div className="text-[10px] uppercase tracking-wider opacity-70">{f.label}</div>
                <div className="mt-0.5 text-lg font-semibold">{f.count}</div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && funnel[0]?.passed > 0 && (
        <div className="rounded-2xl border border-[#E3E7EE] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#445DA3]">
                Embudo ejecutivo · E1 → E14
              </div>
              <div className="text-[11px] text-[#242424]/60">
                Conversión acumulada de casos visibles vs. E1 ({funnel[0].passed}).
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowFunnel((v) => !v)}
              className="h-7 rounded-md border border-[#E3E7EE] bg-white px-2 text-[11px] text-[#445DA3] hover:bg-[#F1F3F8]"
            >
              {showFunnel ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {showFunnel && (
            <div className="space-y-1">
              {funnel.map((f) => {
                const widthPct = Math.max(2, f.pct);
                const isStuck = f.drop >= 30 && f.numero > 1;
                return (
                  <div key={f.id} className="grid grid-cols-[64px_1fr_140px] items-center gap-2">
                    <div className="text-[11px] font-semibold text-[#0A1226]">
                      E{f.numero}
                    </div>
                    <div className="relative h-5 overflow-hidden rounded bg-[#F1F3F8]">
                      <div
                        className={`h-full rounded transition-all ${
                          isStuck ? "bg-rose-400" : "bg-[#445DA3]"
                        }`}
                        style={{ width: `${widthPct}%` }}
                        title={`${f.passed} casos · ${f.pct}%`}
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white mix-blend-difference">
                        {f.titulo}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 text-[11px] tabular-nums">
                      <span className="font-semibold text-[#0A1226]">{f.passed}</span>
                      <span className="text-[#242424]/50">·</span>
                      <span className="text-[#242424]/70">{f.pct}%</span>
                      {f.numero > 1 && (
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                            f.drop >= 30
                              ? "bg-rose-50 text-rose-700"
                              : f.drop > 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
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
        </div>
      )}


      {loading ? (
        <Card>
          <div className="flex items-center gap-2 text-sm text-[#242424]/70">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando pipeline…
          </div>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-3">
            {ETAPAS_PIPELINE.filter((etapa) => !fase || FASE_ETAPAS[fase as FaseId].includes(etapa.id)).map((etapa) => {
              const items = grupos.get(etapa.id) ?? [];
              const umbral = UMBRAL_DIAS[etapa.id] ?? 0;
              const diasArr = items.map((r) => diasDesde(r.updated_at));
              const stuckCount = umbral > 0 ? diasArr.filter((d) => d > umbral).length : 0;
              const avgDias = diasArr.length > 0 ? Math.round(diasArr.reduce((a, b) => a + b, 0) / diasArr.length) : 0;
              const heatBorder = stuckCount > 0 ? "border-rose-300 bg-rose-50/40" : "border-[#E3E7EE] bg-[#F7F9FC]";
              return (
                <div
                  key={etapa.id}
                  className={`w-[280px] flex-shrink-0 rounded-2xl border p-2.5 ${heatBorder}`}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#445DA3]">
                        E{etapa.numero}
                      </div>
                      <div className="truncate text-sm font-semibold text-[#0A1226]">
                        {etapa.titulo}
                      </div>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#242424]/70 ring-1 ring-[#E3E7EE]">
                      {items.length}
                    </span>
                  </div>
                  {items.length > 0 && (
                    <div className="mb-2 flex items-center justify-between gap-2 px-1 text-[10px]">
                      <span className="inline-flex items-center gap-1 text-[#242424]/60">
                        <Clock className="h-3 w-3" /> prom. {avgDias}d
                        {umbral > 0 && <span className="text-[#242424]/40">· umbral {umbral}d</span>}
                      </span>
                      {stuckCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                          <AlertTriangle className="h-3 w-3" /> {stuckCount}
                        </span>
                      )}
                    </div>
                  )}


                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#E3E7EE] bg-white/60 px-2 py-3 text-center text-[11px] text-[#9CA3AF]">
                        Sin casos
                      </div>
                    ) : (
                      items.map((r) => {
                        const dias = diasDesde(r.updated_at);
                        const stuck = umbral > 0 && dias > umbral;
                        const isDup = !!r.cedula && dupCedulas.has(r.cedula.trim());
                        return (
                          <Link
                            key={r.id}
                            to="/casos/$id"
                            params={{ id: r.id }}
                            className="block rounded-lg border border-[#E3E7EE] bg-white p-2.5 text-left transition hover:border-[#445DA3] hover:shadow-sm"
                          >
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 truncate text-sm font-medium text-[#0A1226]">
                                {r.cliente_nombre}
                              </div>
                              {isDup && (
                                <span
                                  title="Esta cédula tiene más de un expediente activo"
                                  className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800"
                                >
                                  Dup
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-[#242424]/60">
                              {r.banco ?? "—"} · {r.cedula ?? "s/cédula"}
                            </div>
                            <div className="mt-0.5 text-[10px] text-[#242424]/45">
                              act. {r.updated_at ? new Date(r.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short" }) : "—"}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 rounded bg-[#F1F3F8] px-1.5 py-0.5 text-[10px] font-medium text-[#445DA3]">
                                <Flag className="h-3 w-3" /> {r.estado}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                  stuck
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {stuck ? (
                                  <AlertTriangle className="h-3 w-3" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                {dias}d
                              </span>
                            </div>
                          </Link>
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
    </div>
  );
}
