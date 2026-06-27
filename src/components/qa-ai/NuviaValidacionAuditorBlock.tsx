import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Sparkles, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { validarReconstruccionAuditor } from "@/lib/qaAI.functions";
import { useUserRole, isDirectorQA } from "@/hooks/useUserRole";

type AuditorInputs = {
  saldoCapital?: number;
  tasaEa?: number;
  seguros?: number;
  cuotaBase?: number;
  cuotasPendientes?: number;
  saldoUVR?: number;
  valorUVR?: number;
  variacionUVR?: number;
};

type ValidacionResult = {
  scoreAnterior: number;
  scoreNuevo: number;
  delta: number;
  categoria: string;
  dictamen: string;
  inconsistencias: number;
  criticas: number;
};

const dictamenLabel: Record<string, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO C/OBS",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};

const dictamenColor = (d: string) => {
  if (d === "aprobado") return "var(--nuvia-success)";
  if (d === "aprobado_obs") return "var(--nuvia-warning)";
  if (d === "requiere_revision") return "#F5C77E";
  return "var(--nuvia-danger)";
};

/**
 * NUVIA · Validación de la reconstrucción del Auditor.
 *
 * Escucha el evento `nuvex:simulador-inputs` del simulador embebido
 * (sandbox `qa-review-<auditoriaId>`) y permite al auditor pedirle a NUVIA
 * que vuelva a correr el motor matemático sobre **sus** inputs. Si la
 * matemática cuadra, el `qa_score` persistido sube (ej. 85 → 95) y el
 * certificado en el header refleja el nuevo número.
 */
export function NuviaValidacionAuditorBlock({
  auditoriaId,
  sandboxExpedienteId,
  scoreActual,
  onValidated,
}: {
  auditoriaId: string;
  sandboxExpedienteId: string;
  scoreActual: number;
  onValidated?: () => void;
}) {
  const { roles } = useUserRole();
  const puedeValidar = isDirectorQA(roles);
  const doValidar = useServerFn(validarReconstruccionAuditor);
  const overridesRef = useRef<AuditorInputs | null>(null);
  const [tieneCambios, setTieneCambios] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidacionResult | null>(null);
  const [scoreMostrado, setScoreMostrado] = useState<number>(scoreActual);

  // Animación numérica del score (ej. 85 → 95)
  useEffect(() => {
    if (!result) return;
    const from = result.scoreAnterior;
    const to = result.scoreNuevo;
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setScoreMostrado(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [result]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as (AuditorInputs & { expedienteId?: string }) | undefined;
      if (!detail || detail.expedienteId !== sandboxExpedienteId) return;
      overridesRef.current = {
        saldoCapital: detail.saldoCapital,
        tasaEa: detail.tasaEa,
        seguros: detail.seguros,
        cuotaBase: detail.cuotaBase,
        cuotasPendientes: detail.cuotasPendientes,
        saldoUVR: detail.saldoUVR,
        valorUVR: detail.valorUVR,
        variacionUVR: detail.variacionUVR,
      };
      setTieneCambios(true);
    };
    window.addEventListener("nuvex:simulador-inputs", handler);
    return () => window.removeEventListener("nuvex:simulador-inputs", handler);
  }, [sandboxExpedienteId]);

  const handleValidar = async () => {
    if (!puedeValidar || loading) return;
    if (!overridesRef.current) {
      toast.error("Modifica al menos un campo del simulador antes de pedirle validación a NUVIA.");
      return;
    }
    setLoading(true);
    try {
      const r = await doValidar({
        data: { auditoriaId, overrides: overridesRef.current },
      }) as ValidacionResult;
      setResult(r);
      const subio = r.delta > 0;
      toast.success(
        subio
          ? `NUVIA validó la reconstrucción · Score ${Math.round(r.scoreAnterior)} → ${Math.round(r.scoreNuevo)} (+${r.delta.toFixed(1)})`
          : `NUVIA recalculó · Score ${Math.round(r.scoreAnterior)} → ${Math.round(r.scoreNuevo)} (${r.delta.toFixed(1)})`,
      );
      onValidated?.();
    } catch (e) {
      toast.error(`NUVIA no pudo validar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setLoading(false);
    }
  };

  const subio = result ? result.delta > 0 : false;
  const score = result ? scoreMostrado : scoreActual;
  const dColor = result ? dictamenColor(result.dictamen) : "var(--nuvia-accent)";

  return (
    <div
      className="px-5 py-4"
      style={{
        borderBottom: "1px solid var(--nuvia-border)",
        background: result
          ? `linear-gradient(135deg, ${dColor}10, transparent 60%)`
          : "linear-gradient(135deg, rgba(132,185,143,0.06), transparent 60%)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 30, height: 30,
              background: "linear-gradient(135deg, rgba(132,185,143,0.18), rgba(68,93,163,0.18))",
              border: "1px solid rgba(132,185,143,0.35)",
            }}
          >
            <Brain size={15} style={{ color: "#9BD5A8" }} />
          </div>
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
              NUVIA · Validación matemática
            </div>
            <div className="text-[13px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              ¿La reconstrucción del auditor cuadra con la matemática financiera?
            </div>
          </div>
        </div>

        {puedeValidar && (
          <button
            onClick={handleValidar}
            disabled={loading || !tieneCambios}
            className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition hover:opacity-90"
            style={{
              background: tieneCambios && !loading ? "var(--nuvia-gradient-primary)" : "rgba(255,255,255,0.05)",
              color: tieneCambios && !loading ? "#FFFFFF" : "var(--nuvia-text-muted)",
              border: "1px solid rgba(132,185,143,0.35)",
              cursor: loading || !tieneCambios ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? "NUVIA validando…" : result ? "Re-validar con NUVIA" : "Validar con NUVIA"}
          </button>
        )}
      </div>

      {!tieneCambios && !result && (
        <div
          className="px-3 py-2.5 rounded-lg text-[12px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px dashed var(--nuvia-border)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          Modifica un campo del simulador embebido y luego pídele a NUVIA que vuelva a correr el motor matemático sobre tus inputs.
          Si la reconstrucción cuadra, el <b style={{ color: "var(--nuvia-text-primary)" }}>certificado sube de número</b> en vivo.
        </div>
      )}

      {result && (
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(0,0,0,0.18)",
            border: `1px solid ${dColor}55`,
          }}
        >
          <div className="flex flex-wrap items-center gap-5">
            {/* Score animado */}
            <div className="flex items-baseline gap-3">
              <div className="text-[10px] uppercase font-bold tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
                Score
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] tabular-nums line-through" style={{ color: "var(--nuvia-text-muted)" }}>
                  {Math.round(result.scoreAnterior)}
                </span>
                <span style={{ color: "var(--nuvia-text-muted)" }}>→</span>
                <span className="text-[34px] font-bold tabular-nums leading-none" style={{ color: dColor }}>
                  {Math.round(score)}
                </span>
                <span className="text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>/ 100</span>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                style={{
                  background: subio ? "rgba(132,185,143,0.18)" : "rgba(255,142,142,0.15)",
                  color: subio ? "var(--nuvia-success)" : "var(--nuvia-danger)",
                  border: `1px solid ${subio ? "rgba(132,185,143,0.45)" : "rgba(255,142,142,0.4)"}`,
                }}
              >
                {subio ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {result.delta >= 0 ? "+" : ""}
                {result.delta.toFixed(1)}
              </span>
            </div>

            <div className="h-8 w-px" style={{ background: "var(--nuvia-border)" }} />

            {/* Dictamen */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
                Dictamen NUVIA
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {result.dictamen === "aprobado" || result.dictamen === "aprobado_obs" ? (
                  <CheckCircle2 size={15} style={{ color: dColor }} />
                ) : (
                  <AlertTriangle size={15} style={{ color: dColor }} />
                )}
                <span className="text-[13px] font-bold" style={{ color: dColor }}>
                  {dictamenLabel[result.dictamen] ?? result.dictamen.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="h-8 w-px" style={{ background: "var(--nuvia-border)" }} />

            {/* Inconsistencias */}
            <div>
              <div className="text-[10px] uppercase font-bold tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
                Hallazgos
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                  {result.inconsistencias}
                  <span className="text-[11px] font-normal ml-1" style={{ color: "var(--nuvia-text-muted)" }}>totales</span>
                </span>
                {result.criticas > 0 && (
                  <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--nuvia-danger)" }}>
                    {result.criticas} críticas
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 text-[11.5px]" style={{ borderTop: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
            <b style={{ color: "var(--nuvia-text-primary)" }}>NUVIA</b> volvió a correr el motor matemático contra los inputs del auditor.
            El certificado del header y la base de datos quedaron sincronizados con esta nueva calificación.
          </div>
        </div>
      )}
    </div>
  );
}
