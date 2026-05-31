// P10 — Panel de alertas de etapas estancadas (gerencia).
// Lista priorizada de expedientes que rebasaron el umbral SLA de su estado,
// con acceso directo al expediente y acción "marcar como leída".

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { computeEtapaActual, getEtapaById } from "@/lib/pipelineEtapas";

// Umbrales SLA — deben permanecer sincronizados con
// src/routes/api/public/hooks/casos-alertas.ts (UMBRAL_DIAS).
const UMBRAL_DIAS: Record<string, number> = {
  prospecto: 7,
  simulado: 10,
  propuesta_enviada: 7,
  propuesta_presentada: 7,
  acepto_propuesta: 5,
  documentacion_completa: 5,
  contrato_generado: 5,
  poder_generado: 5,
  enviado_contratacion: 5,
  radicacion_preparada: 3,
  radicado_banco: 14,
  en_estudio_banco: 21,
  docs_complementarios_banco: 7,
  aprobado_banco: 7,
  aprobado: 7,
  honorarios_pendientes: 5,
  cuenta_cobro_enviada: 10,
};

interface AlertaRow {
  id: string;
  expediente_id: string;
  tipo: string;
  dias_estancado: number;
  created_at: string;
}
interface ExpRow {
  id: string;
  cliente_nombre: string | null;
  banco: string | null;
  estado_caso: CasoEstado | null;
  asesor_id: string | null;
}
interface Item extends AlertaRow {
  cliente: string;
  banco: string;
  estado: CasoEstado | null;
  umbral: number;
  exceso: number;
  prioridad: "alta" | "media" | "baja";
}

function priorityFrom(dias: number, umbral: number): Item["prioridad"] {
  if (umbral <= 0) return "baja";
  const ratio = dias / umbral;
  if (ratio >= 2) return "alta";
  if (ratio >= 1.2) return "media";
  return "baja";
}

export function AlertasEstancamientoPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiding, setHiding] = useState<Set<string>>(new Set());

  const cargar = async () => {
    try {
      const { data: alertas, error: e1 } = await supabase
        .from("caso_alertas" as never)
        .select("id, expediente_id, tipo, dias_estancado, created_at")
        .eq("leida", false)
        .order("dias_estancado", { ascending: false })
        .limit(50);
      if (e1) throw e1;
      const rows = (alertas ?? []) as unknown as AlertaRow[];
      if (rows.length === 0) {
        setItems([]);
        return;
      }
      const ids = Array.from(new Set(rows.map((r) => r.expediente_id)));
      const { data: exps, error: e2 } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco, estado_caso, asesor_id" as never)
        .in("id", ids);
      if (e2) throw e2;
      const expMap = new Map<string, ExpRow>();
      ((exps ?? []) as unknown as ExpRow[]).forEach((e) => expMap.set(e.id, e));

      const enriched: Item[] = rows.map((a) => {
        const e = expMap.get(a.expediente_id);
        const estado = e?.estado_caso ?? null;
        const umbral = (estado && UMBRAL_DIAS[estado]) || 0;
        const exceso = umbral > 0 ? a.dias_estancado - umbral : 0;
        return {
          ...a,
          cliente: e?.cliente_nombre || "—",
          banco: e?.banco || "—",
          estado,
          umbral,
          exceso,
          prioridad: priorityFrom(a.dias_estancado, umbral),
        };
      });

      // Orden final: prioridad alta → media → baja, luego por exceso desc
      const rank: Record<Item["prioridad"], number> = { alta: 0, media: 1, baja: 2 };
      enriched.sort((a, b) => rank[a.prioridad] - rank[b.prioridad] || b.exceso - a.exceso);
      setItems(enriched.slice(0, 10));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const marcarLeida = async (id: string) => {
    setHiding((s) => new Set(s).add(id));
    try {
      await supabase
        .from("caso_alertas" as never)
        .update({ leida: true } as never)
        .eq("id", id);
      setItems((cur) => (cur ? cur.filter((x) => x.id !== id) : cur));
    } catch (err) {
      console.warn("[alertas] marcar leida", err);
    } finally {
      setHiding((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  };

  const colorPri = (p: Item["prioridad"]) =>
    p === "alta"
      ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
      : p === "media"
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
        : "bg-slate-500/20 text-slate-300 border-slate-500/40";

  return (
    <section
      className="rounded-xl border p-5 shadow-sm"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "#111827" }}
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          <h3 className="text-base font-semibold text-white">Alertas de etapas estancadas</h3>
        </div>
        <Link
          to="/notificaciones"
          className="text-xs text-sky-400 hover:underline"
        >
          Ver todas
        </Link>
      </header>

      {error ? (
        <p className="text-sm text-rose-400">No se pudieron cargar las alertas: {error}</p>
      ) : !items ? (
        <p className="text-sm" style={{ color: "#94A3B8" }}>Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: "#94A3B8" }}>
          No hay expedientes estancados ahora mismo.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const etapa = getEtapaById(computeEtapaActual({ estado_caso: it.estado }));
            return (
              <li
                key={it.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colorPri(it.prioridad)}`}>
                  {it.prioridad}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">
                    {it.cliente}
                    <span className="ml-2 text-xs text-white/50">· {it.banco}</span>
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "#94A3B8" }}>
                    E{etapa.numero} {etapa.titulo} · {labelEstado(it.estado)}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="font-mono text-white">{it.dias_estancado}d</div>
                  <div style={{ color: "#94A3B8" }}>
                    SLA {it.umbral}d {it.exceso > 0 ? `(+${it.exceso})` : ""}
                  </div>
                </div>
                <Link
                  to="/casos/$id"
                  params={{ id: it.expediente_id }}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/5"
                >
                  Abrir <ArrowRight size={11} className="inline" />
                </Link>
                <button
                  type="button"
                  onClick={() => marcarLeida(it.id)}
                  disabled={hiding.has(it.id)}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5 disabled:opacity-50"
                  title="Marcar alerta como atendida"
                >
                  <Check size={11} className="inline" /> Leída
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
