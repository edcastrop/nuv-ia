import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Wrench, Send, Eye, EyeOff } from "lucide-react";
import { NCard } from "@/components/nuvia";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import {
  overlayAuditInputs,
  expedienteFromAudit,
  snapshotInputsAnalista,
} from "@/lib/qaReviewExpediente";
import { escenariosFromAudit } from "@/lib/qaReviewExpediente";
import { PropuestasComerciales } from "@/components/nuvex/PropuestasComerciales";
import { getCanalDeAuditoria, enviarMensaje } from "@/lib/colaboracion";
import { useUserRole, isDirectorQA } from "@/hooks/useUserRole";
import { ComparativaAnalistaAuditor } from "./ComparativaAnalistaAuditor";
import { NuviaValidacionAuditorBlock } from "./NuviaValidacionAuditorBlock";
import { clearSimulatorDraft } from "@/components/nuvex/useSimulatorDraft";


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
  scoreActual,
  onValidated,
}: {
  auditoriaId: string;
  auditoria: Record<string, unknown>;
  inputs: Record<string, unknown>;
  cliente: string;
  banco: string;
  scoreActual?: number;
  onValidated?: () => void;
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

  // V2 QA FIX: el sandbox usa un id estable (`qa-review-<auditoriaId>`), así
  // que el draft de sessionStorage persistía valores viejos del auditor y
  // pisaba el prellenado con los inputs reales del analista. Limpiamos el
  // draft ANTES de que el simulador hijo se monte (vía useState initializer,
  // que corre síncrono en render) para que el simulador siempre arranque con
  // la reconstrucción del analista. Los cambios del auditor se re-persisten
  // automáticamente mientras edita en esta sesión.
  useState(() => {
    if (typeof window !== "undefined") {
      clearSimulatorDraft(modo, sandboxId);
    }
    return true;
  });
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") clearSimulatorDraft(modo, sandboxId);
    };
  }, [modo, sandboxId]);

  // V3 QA FIX: "Compartir en el hilo" ahora publica la comparativa Analista
  // vs Auditor (no solo los inputs del analista). Escuchamos el mismo evento
  // que usa ComparativaAnalistaAuditor para conocer los valores actuales del
  // auditor dentro del simulador embebido.
  type AuditorLive = {
    saldoCapital?: number;
    tasaEa?: number;
    seguros?: number;
    cuotaBase?: number;
    cuotasPendientes?: number;
    nuevaCuota?: number | null;
    saldoUVR?: number;
    valorUVR?: number;
    variacionUVR?: number;
  };
  const [auditorLive, setAuditorLive] = useState<AuditorLive | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as (AuditorLive & { expedienteId?: string }) | undefined;
      if (!detail || detail.expedienteId !== sandboxId) return;
      setAuditorLive({
        saldoCapital: detail.saldoCapital,
        tasaEa: detail.tasaEa,
        seguros: detail.seguros,
        cuotaBase: detail.cuotaBase,
        cuotasPendientes: detail.cuotasPendientes,
        nuevaCuota: detail.nuevaCuota ?? null,
        saldoUVR: detail.saldoUVR,
        valorUVR: detail.valorUVR,
        variacionUVR: detail.variacionUVR,
      });
    };
    window.addEventListener("nuvex:simulador-inputs", handler);
    return () => window.removeEventListener("nuvex:simulador-inputs", handler);
  }, [sandboxId]);

  const handleEnviarHilo = async () => {
    if (!puedeEditar || enviando) return;
    if (!auditorLive) {
      toast.error("Modifica al menos un campo del simulador para generar la comparativa.");
      return;
    }
    setEnviando(true);
    try {
      const canal = await getCanalDeAuditoria(
        auditoriaId,
        `${cliente || "Cliente"} · ${banco || "Banco"}`,
        [],
      );
      const num = (v: unknown) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
      };
      const fmtN = (n: number) =>
        n === 0 ? "—" : n.toLocaleString("es-CO", { maximumFractionDigits: 0 });
      const fmtPct = (n: number) =>
        n === 0 ? "—" : `${n.toLocaleString("es-CO", { maximumFractionDigits: 4 })}%`;
      const fmt = (v: number, kind: "money" | "pct" | "int") =>
        kind === "pct" ? fmtPct(v) : kind === "int" ? String(v || "—") : fmtN(v);
      const pctDelta = (a: number, b: number) =>
        a === 0 ? 0 : ((b - a) / Math.abs(a)) * 100;

      const rows: Array<{ label: string; a: number; b: number; kind: "money" | "pct" | "int" }> = [
        { label: "Saldo capital", a: num(analistaRaw.saldoCapital), b: num(auditorLive.saldoCapital), kind: "money" },
        { label: "Tasa EA", a: num(analistaRaw.tasaEa), b: num(auditorLive.tasaEa), kind: "pct" },
        { label: "Seguros", a: num(analistaRaw.seguros), b: num(auditorLive.seguros), kind: "money" },
        { label: "Cuota base (sin subsidio)", a: num(analistaRaw.cuotaBaseSinSubsidio), b: num(auditorLive.cuotaBase), kind: "money" },
        { label: "Cuotas pendientes", a: num(analistaRaw.cuotasPendientes), b: num(auditorLive.cuotasPendientes), kind: "int" },
      ];
      if (modo === "uvr") {
        rows.push(
          { label: "Saldo UVR", a: num(analistaRaw.saldoUVR), b: num(auditorLive.saldoUVR), kind: "money" },
          { label: "Valor UVR", a: num(analistaRaw.valorUVR), b: num(auditorLive.valorUVR), kind: "money" },
          { label: "Variación UVR EA", a: num(analistaRaw.variacionUvrEa), b: num(auditorLive.variacionUVR), kind: "pct" },
        );
      }

      const lineas = [
        "🔧 **Reconstrucción del auditor · Analista vs Auditor**",
        `Cliente: ${cliente || "—"} · Banco: ${banco || "—"}`,
        "",
        ...rows.map((r) => {
          const d = pctDelta(r.a, r.b);
          const flag = Math.abs(d) >= 5 ? "🔴" : Math.abs(d) >= 0.5 ? "🟡" : "🟢";
          return `${flag} ${r.label}: ${fmt(r.a, r.kind)} → ${fmt(r.b, r.kind)} (${d >= 0 ? "+" : ""}${d.toFixed(2)}%)`;
        }),
      ];
      if (auditorLive.nuevaCuota != null && Number.isFinite(Number(auditorLive.nuevaCuota))) {
        lineas.push("", `💡 Cuota recomendada por el auditor: ${fmtN(num(auditorLive.nuevaCuota))}`);
      }
      lineas.push("", "_Abre el dictamen para ver el detalle de la reconstrucción._");

      await enviarMensaje(canal.id, lineas.join("\n"), [], []);
      toast.success("Comparativa publicada en el hilo de la auditoría.");
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

          {/* V3 — NUVIA valida la reconstrucción del auditor y actualiza el score */}
          <NuviaValidacionAuditorBlock
            auditoriaId={auditoriaId}
            sandboxExpedienteId={sandboxId}
            scoreActual={Number(scoreActual ?? auditoria.qa_score ?? 0)}
            onValidated={onValidated}
          />

          {/* Escenarios financieros del expediente (auditor · solo lectura) */}
          <EscenariosAuditor auditoria={auditoria} inputs={inputs} modo={modo} />




          {/* Simulador embebido */}
          <div
            id="qa-simulador-embebido"
            className="px-5 py-4"
            style={{ borderTop: "1px solid var(--nuvia-border)" }}
          >
            <div
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3"
              style={{
                background: "linear-gradient(135deg, rgba(68,93,163,0.18), rgba(132,185,143,0.12))",
                border: "1px solid rgba(132,185,143,0.28)",
              }}
            >
              <div>
                <div className="text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: "#84B98F" }}>
                  Aquí corrige el auditor
                </div>
                <div className="mt-1 text-[13px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                  Simulador embebido · modifica los campos de Datos del crédito
                </div>
              </div>
              <a
                href="#qa-simulador-campos"
                className="inline-flex items-center rounded-lg px-3 py-1.5 text-[11.5px] font-semibold no-underline"
                style={{ background: "var(--nuvia-gradient-primary)", color: "#FFFFFF" }}
              >
                Ir a campos editables
              </a>
            </div>
          </div>
          <div
            style={{
              opacity: puedeEditar ? 1 : 0.92,
              pointerEvents: puedeEditar ? "auto" : "none",
            }}
          >
            {modo === "pesos" ? (
              <PesosSimulator initialExpediente={expediente} fromSimulador qaEmbedded />
            ) : (
              <UVRSimulator initialExpediente={expediente} fromSimulador qaEmbedded />
            )}
          </div>
        </div>
      )}
    </NCard>
  );
}

/**
 * Bloque de solo lectura que materializa los cuatro escenarios financieros
 * del expediente auditado. Prioriza histórico persistido (v2) y, en su
 * ausencia, reconstruye legacy (v1) con precedencia de snapshot sobre
 * inputs para Variación UVR EA. Cuando la reconstrucción es imposible
 * muestra un banner explicativo.
 */
export function EscenariosAuditor({
  auditoria,
  inputs,
  modo,
}: {
  auditoria: Record<string, unknown>;
  inputs: Record<string, unknown>;
  modo: "pesos" | "uvr";
}) {
  const data = useMemo(() => escenariosFromAudit(auditoria, inputs), [auditoria, inputs]);
  if (data.origen === null) {
    return (
      <div
        className="px-5 py-4"
        style={{ borderTop: "1px solid var(--nuvia-border)" }}
      >
        <div
          className="rounded-lg px-3 py-2 text-[12px]"
          style={{
            background: "rgba(245,199,126,0.10)",
            border: "1px solid rgba(245,199,126,0.28)",
            color: "var(--nuvia-text-secondary)",
          }}
        >
          <b style={{ color: "#F5C77E" }}>Escenarios no disponibles.</b>{" "}
          {data.reason}
        </div>
      </div>
    );
  }
  const legacyBanner =
    data.origen === "reconstruido_legacy"
      ? "El snapshot original no incluye escenarios (v1). Se muestran reconstruidos con el motor financiero canónico usando los inputs y datos del snapshot."
      : null;
  return (
    <div
      className="px-5 py-4"
      style={{ borderTop: "1px solid var(--nuvia-border)" }}
    >
      <PropuestasComerciales
        readOnly
        mode={modo}
        cuotasPendientes={0}
        baseCredito={0}
        auditorEscenarios={data.escenarios}
        auditorRecomendadaIdx={0}
        auditorBannerLegacy={legacyBanner}
        auditorUvrVariationConflict={data.uvrVariationConflict ?? null}
      />
    </div>
  );
}

