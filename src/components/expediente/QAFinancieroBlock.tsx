import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/nuvex/ui";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Brain, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { QABadge, type QACategoria } from "@/components/qa-ai/QABadge";
import {
  ultimaAuditoriaQAPorExpediente,
  auditarLecturaAutomatica,
} from "@/lib/qaAI.functions";
import { supabase } from "@/integrations/supabase/client";

type Auditoria = {
  id: string;
  qa_score: number;
  categoria: QACategoria;
  dictamen: string;
  ejecutado_at: string;
  ejecutado_by: string | null;
  auto_ejecutada: boolean;
  modalidad: string;
};

const dictamenLabel: Record<string, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};

export function QAFinancieroBlock({ expedienteId }: { expedienteId: string }) {
  const fetchUltima = useServerFn(ultimaAuditoriaQAPorExpediente);
  const reauditar = useServerFn(auditarLecturaAutomatica);
  const [data, setData] = useState<{
    auditoria: Auditoria | null;
    inconsistencias: Array<{ tipo: string; severidad: string; mensaje: string; sugerencia: string | null; campo: string | null }>;
    alertasAbiertas: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetchUltima({ data: { expedienteId } });
      setData(r as never);
    } finally { setLoading(false); }
  }, [expedienteId, fetchUltima]);

  useEffect(() => { void load(); }, [load]);

  const reejecutar = async () => {
    setErr(null); setRunning(true);
    try {
      const { data: ext } = await supabase
        .from("extractos_lecturas")
        .select("id")
        .eq("expediente_id", expedienteId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ext) throw new Error("No hay extracto cargado para este expediente.");
      await reauditar({ data: { extractoLecturaId: ext.id } });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo reauditar.");
    } finally { setRunning(false); }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Brain size={18} style={{ color: NUVEX.azul }} />
          <h3 className="text-sm font-semibold text-[#242424]">QA Financiero · NUVIA</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reejecutar}
            disabled={running}
            className="text-[11px] text-[#445DA3] hover:underline inline-flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={12} className={running ? "animate-spin" : ""} /> {running ? "Auditando…" : "Reejecutar auditoría"}
          </button>
        </div>
      </div>

      {loading && <div className="py-3 text-[12px] text-[#242424]/60">Cargando auditoría…</div>}
      {err && <div className="mb-2 text-[12px] text-[#991B1B]">{err}</div>}

      {!loading && data && !data.auditoria && (
        <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-[12px] text-[#475569]">
          Este expediente aún no tiene auditoría QA. Sube un extracto bancario para ejecutarla automáticamente.
        </div>
      )}

      {!loading && data?.auditoria && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <QABadge
              categoria={data.auditoria.categoria}
              score={data.auditoria.qa_score}
              auditoriaId={data.auditoria.id}
              size="md"
            />
            <span className="text-[12px] text-[#242424]/70">
              {dictamenLabel[data.auditoria.dictamen] ?? data.auditoria.dictamen}
            </span>
            {data.auditoria.auto_ejecutada && (
              <span className="text-[10px] uppercase tracking-wide text-[#445DA3] bg-[#EEF2FF] border border-[#C7D2FE] rounded px-1.5 py-[1px]">
                Automática
              </span>
            )}
            <span className="text-[11px] text-[#242424]/50 ml-auto">
              {new Date(data.auditoria.ejecutado_at).toLocaleString("es-CO")}
            </span>
          </div>

          {data.alertasAbiertas > 0 && (
            <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B] font-semibold mb-3 inline-flex items-center gap-2">
              <AlertTriangle size={14} /> {data.alertasAbiertas} alerta(s) QA abierta(s)
            </div>
          )}

          {data.inconsistencias.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] uppercase tracking-wide text-[#242424]/60 mb-1">Hallazgos</div>
              <ul className="space-y-1.5">
                {data.inconsistencias.slice(0, 5).map((i, idx) => (
                  <li key={idx} className="rounded border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] text-[#242424]">
                    <span className="font-semibold uppercase text-[10px] mr-2" style={{ color: i.severidad === "critica" ? "#991B1B" : i.severidad === "warning" ? "#92400E" : "#475569" }}>
                      {i.severidad}
                    </span>
                    {i.mensaje}
                    {i.sugerencia && <span className="block text-[11px] text-[#242424]/60 mt-0.5">→ {i.sugerencia}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px]">
            <Link
              to="/qa-ai/$id"
              params={{ id: data.auditoria.id }}
              className="text-[#445DA3] hover:underline inline-flex items-center gap-1"
            >
              Ver dictamen completo <ExternalLink size={11} />
            </Link>
            {data.auditoria.categoria === "rechazado" && (
              <span className="text-[#991B1B] font-semibold">
                Caso bloqueado para avanzar. Corrija los hallazgos y reejecute.
              </span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
