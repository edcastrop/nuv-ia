import { useEffect, useState, useCallback } from "react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Brain, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
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
    <NCard variant="elevated">
      <SectionHeader
        icon={<Brain size={16} />}
        title="QA Financiero · NUVIA"
        description="Auditoría automática de la lectura del extracto."
        action={
          <button
            onClick={reejecutar}
            disabled={running}
            className="text-[11px] inline-flex items-center gap-1 hover:underline disabled:opacity-50"
            style={{ color: "var(--nuvia-accent-blue)" }}
          >
            <RefreshCw size={12} className={running ? "animate-spin" : ""} />
            {running ? "Auditando…" : "Reejecutar auditoría"}
          </button>
        }
      />

      {loading && (
        <div className="py-3 text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          Cargando auditoría…
        </div>
      )}
      {err && <div className="mb-2 text-[12px]" style={{ color: "#FFB4B4" }}>{err}</div>}

      {!loading && data && !data.auditoria && (
        <div
          className="rounded-lg px-3 py-3 text-[12px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--nuvia-border)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
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
            <span className="text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
              {dictamenLabel[data.auditoria.dictamen] ?? data.auditoria.dictamen}
            </span>
            {data.auditoria.auto_ejecutada && (
              <span
                className="text-[10px] uppercase tracking-wide rounded px-1.5 py-[1px]"
                style={{
                  background: "rgba(68,93,163,0.18)",
                  border: "1px solid rgba(68,93,163,0.32)",
                  color: "var(--nuvia-accent-blue)",
                }}
              >
                Automática
              </span>
            )}
            <span
              className="text-[11px] ml-auto"
              style={{ color: "var(--nuvia-text-secondary)", opacity: 0.7 }}
            >
              {new Date(data.auditoria.ejecutado_at).toLocaleString("es-CO")}
            </span>
          </div>

          {data.alertasAbiertas > 0 && (
            <div
              className="rounded-lg px-3 py-2 text-[12px] font-semibold mb-3 inline-flex items-center gap-2"
              style={{
                background: "rgba(255,107,107,0.16)",
                border: "1px solid rgba(255,107,107,0.32)",
                color: "#FFB4B4",
              }}
            >
              <AlertTriangle size={14} /> {data.alertasAbiertas} alerta(s) QA abierta(s)
            </div>
          )}

          {data.inconsistencias.length > 0 && (
            <div className="mb-3">
              <div
                className="text-[11px] uppercase tracking-wide mb-1"
                style={{ color: "var(--nuvia-text-secondary)" }}
              >
                Hallazgos
              </div>
              <ul className="space-y-1.5">
                {data.inconsistencias.slice(0, 5).map((i, idx) => (
                  <li
                    key={idx}
                    className="rounded px-2.5 py-1.5 text-[12px]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--nuvia-border)",
                      color: "var(--nuvia-text-primary)",
                    }}
                  >
                    <span
                      className="font-semibold uppercase text-[10px] mr-2"
                      style={{
                        color:
                          i.severidad === "critica"
                            ? "#FFB4B4"
                            : i.severidad === "warning"
                              ? "#F5C77A"
                              : "var(--nuvia-text-secondary)",
                      }}
                    >
                      {i.severidad}
                    </span>
                    {i.mensaje}
                    {i.sugerencia && (
                      <span
                        className="block text-[11px] mt-0.5"
                        style={{ color: "var(--nuvia-text-secondary)" }}
                      >
                        → {i.sugerencia}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 text-[11px]">
            <Link
              to="/qa-ai/$id"
              params={{ id: data.auditoria.id }}
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: "var(--nuvia-accent-blue)" }}
            >
              Ver dictamen completo <ExternalLink size={11} />
            </Link>
            {data.auditoria.categoria === "rechazado" && (
              <span className="font-semibold" style={{ color: "#FFB4B4" }}>
                Caso bloqueado para avanzar. Corrija los hallazgos y reejecute.
              </span>
            )}
          </div>
        </>
      )}
    </NCard>
  );
}
