import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wrench, Send, Eye, EyeOff } from "lucide-react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import {
  overlayAuditInputs,
  expedienteFromAudit,
  snapshotInputsAnalista,
} from "@/lib/qaReviewExpediente";
import { getCanalDeAuditoria, enviarMensaje } from "@/lib/colaboracion";
import { useUserRole, isDirectorQA } from "@/hooks/useUserRole";
import { ComparativaAnalistaAuditor } from "./ComparativaAnalistaAuditor";

/**
 * Bloque embebido en `/qa-ai/$id` que renderiza el simulador (Pesos/UVR)
 * prellenado con los inputs exactos del analista. Los cambios viven en un
 * expediente sandbox (`qa-review-<auditoriaId>`) y no afectan el caso real.
 *
 * Roles QA pueden además publicar la reconstrucción al hilo de la auditoría
 * como mensaje estructurado (trazabilidad inmutable).
 */
export function ReconstruccionAuditorBlock({
  auditoriaId,
  auditoria,
  inputs,
  cliente,
  banco,
}: {
  auditoriaId: string;
  auditoria: Record<string, unknown>;
  inputs: Record<string, unknown>;
  cliente: string;
  banco: string;
}) {
  const { roles } = useUserRole();
  const puedeEditar = isDirectorQA(roles);
  const [open, setOpen] = useState<boolean>(true);
  const [enviando, setEnviando] = useState(false);

  const modalidad = String(inputs.modalidad ?? auditoria.modalidad ?? "pesos");
  const modo: "pesos" | "uvr" = modalidad === "uvr" ? "uvr" : "pesos";

  const expediente = useMemo(
    () => overlayAuditInputs(expedienteFromAudit(auditoria, inputs), inputs),
    [auditoria, inputs],
  );

  const snapshot = useMemo(() => snapshotInputsAnalista(inputs), [inputs]);

  // Snapshot numérico (no formateado) para la Comparativa Analista vs Auditor.
  const analistaRaw = useMemo(() => {
    const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
    const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
    const pick = (a: unknown, b?: unknown) => {
      const n = Number(a);
      if (Number.isFinite(n) && n !== 0) return n;
      const m = Number(b);
      return Number.isFinite(m) ? m : 0;
    };
    return {
      saldoCapital: pick(rec.saldoCapital, ext.saldoCapital),
      tasaEa: pick(rec.tasaEa, ext.tasaEa),
      tasaEaPactada: pick(rec.tasaEaPactada),
      seguros: pick(rec.seguros, ext.seguros),
      cuotaBaseSinSubsidio: pick(rec.cuotaBaseSinSubsidio, ext.cuota),
      cuotasPendientes: pick(rec.cuotasPendientes),
      saldoUVR: pick(rec.saldoUVR),
      valorUVR: pick(rec.valorUVR),
      variacionUvrEa: pick(rec.variacionUvrEa),
    };
  }, [inputs]);

  const sandboxId = `qa-review-${auditoriaId}`;

  const handleEnviarHilo = async () => {
    if (!puedeEditar || enviando) return;
    setEnviando(true);
    try {
      const canal = await getCanalDeAuditoria(
        auditoriaId,
        `${cliente || "Cliente"} · ${banco || "Banco"}`,
        [],
      );
      const lineas = [
        "🔧 **Reconstrucción del auditor**",
        `Cliente: ${cliente || "—"} · Banco: ${banco || "—"}`,
        "",
        "_Inputs originales del analista:_",
        ...snapshot.map((r) => `• ${r.label}: ${r.value}`),
        "",
        "_El auditor publicó esta reconstrucción para revisar contigo. Abre el dictamen para ver los recálculos._",
      ];
      await enviarMensaje(canal.id, lineas.join("\n"), [], []);
      toast.success("Reconstrucción publicada en el hilo de la auditoría.");
    } catch (e) {
      toast.error(`No se pudo publicar: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setEnviando(false);
    }
  };

  if (!inputs || (!inputs.reconstruccion && !inputs.extracto)) {
    return null;
  }

  return (
    <NCard padding="none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--nuvia-text-primary)" }}
      >
        <span className="flex items-center gap-2.5 text-[13.5px] font-semibold">
          <Wrench size={15} style={{ color: "#F5C77E" }} />
          Reconstrucción del auditor
          <span
            className="text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
            style={{
              background: "rgba(245,199,126,0.12)",
              color: "#F5C77E",
              border: "1px solid rgba(245,199,126,0.35)",
            }}
          >
            {puedeEditar ? "Sandbox · Editable" : "Solo lectura"}
          </span>
          <span className="text-[11px] font-normal" style={{ color: "var(--nuvia-text-muted)" }}>
            · Simulador prellenado con los inputs del analista
          </span>
        </span>
        <span className="flex items-center gap-2 text-[11.5px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          {open ? <EyeOff size={14} /> : <Eye size={14} />}
          {open ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--nuvia-border)" }}>
          {/* Banner de sandbox */}
          <div
            className="px-5 py-3 flex flex-wrap items-center gap-3"
            style={{
              background: "linear-gradient(90deg, rgba(245,199,126,0.08), rgba(245,199,126,0.02))",
              borderBottom: "1px solid rgba(245,199,126,0.18)",
            }}
          >
            <span
              className="text-[10.5px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(245,199,126,0.14)", color: "#F5C77E", border: "1px solid rgba(245,199,126,0.35)" }}
            >
              Modo revisión QA
            </span>
            <span className="text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
              Los cambios aquí <b style={{ color: "var(--nuvia-text-primary)" }}>no afectan</b> el expediente del analista.
              Útil para reconstruir y comparar contra lo que él ingresó.
            </span>
            {puedeEditar && (
              <button
                onClick={handleEnviarHilo}
                disabled={enviando}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition hover:opacity-90"
                style={{
                  background: "var(--nuvia-gradient-primary)",
                  color: "#FFFFFF",
                  border: "1px solid rgba(132,185,143,0.35)",
                  cursor: enviando ? "not-allowed" : "pointer",
                  opacity: enviando ? 0.6 : 1,
                }}
              >
                <Send size={13} /> {enviando ? "Publicando…" : "Compartir en el hilo"}
              </button>
            )}
          </div>

          {/* Snapshot inputs originales */}
          {snapshot.length > 0 && (
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
              <div
                className="text-[10.5px] font-bold uppercase tracking-[0.16em] mb-2"
                style={{ color: "var(--nuvia-text-muted)" }}
              >
                Inputs originales del analista
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                {snapshot.map((r) => (
                  <div
                    key={r.label}
                    className="px-3 py-2 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border)" }}
                  >
                    <div className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>
                      {r.label}
                    </div>
                    <div className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                      {r.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* V2 — Comparativa en vivo Analista vs Auditor */}
          <ComparativaAnalistaAuditor
            auditoriaId={auditoriaId}
            sandboxExpedienteId={sandboxId}
            modo={modo}
            analista={analistaRaw}
            cliente={cliente}
            banco={banco}
          />

          {/* Simulador embebido */}
          <div
            style={{
              opacity: puedeEditar ? 1 : 0.92,
              pointerEvents: puedeEditar ? "auto" : "none",
            }}
          >
            {modo === "pesos" ? (
              <PesosSimulator initialExpediente={expediente} fromSimulador />
            ) : (
              <UVRSimulator initialExpediente={expediente} fromSimulador />
            )}
          </div>
        </div>
      )}
    </NCard>
  );
}
