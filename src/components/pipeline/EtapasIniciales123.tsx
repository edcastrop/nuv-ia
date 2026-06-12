// Pipeline Maestro — Panel de Etapas 1-3 (Lead, Extracto, Proyección + QA).
// Frontend-only: organiza el trabajo del Expediente Maestro por etapa con
// checklist visual y gating. No modifica BD ni lógica de negocio existente.

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, AlertCircle, ArrowRight, FileSpreadsheet, Sparkles, User, Loader2 } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { Card } from "@/components/nuvex/ui";
import { QABadge, type QACategoria } from "@/components/qa-ai/QABadge";
import { supabase } from "@/integrations/supabase/client";
import { ETAPAS_PIPELINE, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { roleLabel } from "@/lib/roleLabels";
import {
  enviarAValidacionQA,
  obtenerUltimaValidacion,
  type ValidacionQA,
  MOTIVOS_QA,
} from "@/lib/validacionQA";

type ClienteLike = { nombre?: string; cedula?: string; celular?: string; correo?: string };
type CreditoLike = {
  banco?: string;
  saldoCapital?: string;
  cuotaActual?: string;
  tasa?: string;
  numeroCredito?: string;
};

interface Props {
  expedienteId: string;
  cliente: ClienteLike;
  credito: CreditoLike;
  etapaActual: EtapaPipelineId;
  /** Opcional; si se omite, el componente consulta la última validación. */
  qaEstado?: "pendiente" | "aprobada" | "devuelta" | null;
}

type EtapaKey = "lead" | "extracto" | "proyeccion";

type AutoQAEstado = {
  qa_score: number | null;
  qa_categoria: QACategoria;
  qa_dictamen: string | null;
  qa_auditoria_id: string | null;
  qa_ejecutada_at: string | null;
};

const dictamenAutoLabel: Record<string, string> = {
  aprobado: "APROBADO",
  aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN",
  rechazado: "RECHAZADO",
};

interface CheckItem {
  label: string;
  ok: boolean;
  hint?: string;
}

export function EtapasIniciales123({ expedienteId, cliente, credito, etapaActual }: Props) {
  const [tab, setTab] = useState<EtapaKey>(() => {
    if (etapaActual === "extracto") return "extracto";
    if (etapaActual === "proyeccion") return "proyeccion";
    return "lead";
  });

  const [validacion, setValidacion] = useState<ValidacionQA | null>(null);
  const [autoQA, setAutoQA] = useState<AutoQAEstado | null>(null);
  const [loadingQA, setLoadingQA] = useState(true);
  const [enviandoQA, setEnviandoQA] = useState(false);
  const [errQA, setErrQA] = useState<string | null>(null);

  const cargarQA = useCallback(async () => {
    setLoadingQA(true);
    try {
      const [v, auto] = await Promise.all([
        obtenerUltimaValidacion(expedienteId),
        supabase
          .from("expedientes")
          .select("qa_score,qa_categoria,qa_dictamen,qa_auditoria_id,qa_ejecutada_at")
          .eq("id", expedienteId)
          .maybeSingle(),
      ]);
      setValidacion(v);
      const row = auto.data as AutoQAEstado | null;
      setAutoQA(row?.qa_auditoria_id ? row : null);
    } catch (e) {
      setErrQA((e as Error).message);
    } finally {
      setLoadingQA(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    cargarQA();
  }, [cargarQA]);

  const qaEstadoCalc: "pendiente" | "aprobada" | "devuelta" | null = validacion
    ? validacion.resultado ?? "pendiente"
    : null;
  const autoQaEjecutada = !!autoQA?.qa_auditoria_id;
  const autoQaHabilita = autoQaEjecutada && autoQA.qa_categoria !== "rechazado";

  const handleEnviarQA = async () => {
    setEnviandoQA(true);
    setErrQA(null);
    try {
      await enviarAValidacionQA(expedienteId);
      await cargarQA();
    } catch (e) {
      setErrQA((e as Error).message);
    } finally {
      setEnviandoQA(false);
    }
  };

  const datosCreditoOk = !!credito.saldoCapital && !!credito.cuotaActual && !!credito.tasa;

  const checks = useMemo(() => ({
    lead: [
      { label: "Nombre del cliente", ok: !!cliente.nombre?.trim() },
      { label: "Cédula", ok: !!cliente.cedula?.trim() },
      { label: "Celular", ok: !!cliente.celular?.trim(), hint: "Necesario para notificaciones y DM." },
      { label: "Correo electrónico", ok: !!cliente.correo?.trim() },
    ] as CheckItem[],
    extracto: [
      { label: "Banco identificado", ok: !!credito.banco?.trim() },
      { label: "Número de crédito", ok: !!credito.numeroCredito?.trim() },
      { label: "Saldo capital", ok: !!credito.saldoCapital?.trim() },
      { label: "Cuota actual", ok: !!credito.cuotaActual?.trim() },
      { label: "Tasa EA", ok: !!credito.tasa?.trim() },
    ] as CheckItem[],
    proyeccion: [
      { label: "Datos de crédito completos", ok: datosCreditoOk },
      { label: "Auto-QA financiero ejecutado", ok: autoQaEjecutada || !!validacion, hint: "Carga o aplica el extracto asociado al expediente para activar la auditoría automática." },
      { label: "Resultado QA habilitante", ok: autoQaHabilita || qaEstadoCalc === "aprobada", hint: "Si QA falla, corrige los hallazgos antes de avanzar." },
    ] as CheckItem[],
  }), [cliente, credito, datosCreditoOk, validacion, qaEstadoCalc, autoQaEjecutada, autoQaHabilita]);

  const completar = (items: CheckItem[]) => items.filter((i) => i.ok).length;
  const total = (items: CheckItem[]) => items.length;

  const etapas = ETAPAS_PIPELINE.slice(0, 3);


  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              Etapas 1 · 2 · 3 — Pipeline Maestro
            </div>
            <div className="text-sm text-[#242424]/70">
              Checklist operativo de las primeras tres etapas. Cada etapa tiene su responsable.
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(["lead", "extracto", "proyeccion"] as EtapaKey[]).map((k, i) => {
            const items = checks[k];
            const done = completar(items);
            const all = total(items);
            const complete = done === all;
            const active = tab === k;
            const meta = etapas[i];
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition"
                style={{
                  borderColor: active ? NUVEX.azul : "#E5E7EB",
                  background: active ? NUVEX.azul : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#242424",
                }}
              >
                {complete ? (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: active ? "#FFFFFF" : NUVEX.verdeTextoFuerte }} />
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-60" />
                )}
                <span>
                  {meta.numero}. {meta.titulo}
                </span>
                <span className="opacity-70">({done}/{all})</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <EtapaPanel
          etapa={tab}
          items={checks[tab]}
          expedienteId={expedienteId}
          qaEstado={qaEstadoCalc}
          validacion={validacion}
          autoQA={autoQA}
          loadingQA={loadingQA}
          enviandoQA={enviandoQA}
          errQA={errQA}
          onEnviarQA={handleEnviarQA}
          puedeEnviarQA={datosCreditoOk && (validacion?.resultado !== null && validacion?.resultado !== undefined ? validacion.resultado === "devuelta" : !validacion)}
        />
      </div>
    </Card>
  );
}

function EtapaPanel({
  etapa,
  items,
  expedienteId,
  qaEstado,
  validacion,
  loadingQA,
  enviandoQA,
  errQA,
  onEnviarQA,
  puedeEnviarQA,
}: {
  etapa: EtapaKey;
  items: CheckItem[];
  expedienteId: string;
  qaEstado: "pendiente" | "aprobada" | "devuelta" | null;
  validacion: ValidacionQA | null;
  loadingQA: boolean;
  enviandoQA: boolean;
  errQA: string | null;
  onEnviarQA: () => void;
  puedeEnviarQA: boolean;
}) {
  const meta = ETAPAS_PIPELINE.find((e) => e.id === etapa)!;
  const Icon = etapa === "lead" ? User : etapa === "extracto" ? FileSpreadsheet : Sparkles;
  const motivoLabel = (m: string | null) => MOTIVOS_QA.find((x) => x.value === m)?.label ?? m ?? "—";

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "#E5E7EB", background: "#FBFCFD" }}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: "#EAF1FF" }}
        >
          <Icon className="h-4 w-4" style={{ color: NUVEX.azul }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#242424]">
            Etapa {meta.numero} · {meta.titulo}
          </div>
          <p className="text-xs text-[#242424]/65">{meta.descripcion}</p>
          <div className="mt-1 text-[11px] text-[#242424]/55">
            Responsables: {meta.responsables.map((r) => roleLabel(r)).join(" · ")}
          </div>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2 text-xs">
            {it.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: NUVEX.verdeTextoFuerte }} />
            ) : (
              <Circle className="h-4 w-4 mt-0.5 shrink-0 text-[#9CA3AF]" />
            )}
            <div>
              <div className={it.ok ? "text-[#242424]" : "text-[#242424]/70"}>{it.label}</div>
              {it.hint && !it.ok && (
                <div className="text-[10px] text-[#B45309] flex items-center gap-1 mt-0.5">
                  <AlertCircle className="h-3 w-3" />
                  {it.hint}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* CTAs por etapa */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {etapa === "lead" && (
          <div className="text-[11px] text-[#242424]/60">
            Completa los datos del cliente en el bloque «Expediente» más abajo.
          </div>
        )}
        {etapa === "extracto" && (
          <div className="text-[11px] text-[#242424]/60">
            Sube el extracto en el «Motor de Extractos» más abajo. Al confirmar, los datos del crédito se autocompletan.
          </div>
        )}
        {etapa === "proyeccion" && (
          <>
            <Link
              to="/inicio"
              search={{ maestroId: expedienteId, modo: "pesos" as const }}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow"
              style={{ background: NUVEX.azul }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generar proyección
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onEnviarQA}
              disabled={!puedeEnviarQA || enviandoQA || loadingQA}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#FFFFFF" }}
              title={
                !puedeEnviarQA
                  ? qaEstado === "pendiente"
                    ? "Ya hay una validación pendiente"
                    : qaEstado === "aprobada"
                      ? "QA ya aprobado"
                      : "Completa los datos del crédito antes de enviar a QA"
                  : "Enviar proyección al equipo de QA"
              }
            >
              {enviandoQA ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {validacion?.resultado === "devuelta" ? "Reenviar a QA" : "Enviar a QA"}
            </button>
            <Link
              to="/qa"
              className="text-[11px] text-[#445DA3] hover:underline"
            >
              Ver tablero QA →
            </Link>

            {loadingQA ? (
              <span className="text-[11px] text-[#242424]/50">Consultando QA…</span>
            ) : qaEstado === "pendiente" ? (
              <span className="text-[11px] font-semibold" style={{ color: "#8A5A00" }}>
                ⏳ Pendiente de validación QA — solicitada {new Date(validacion!.solicitada_at).toLocaleString("es-CO")}
              </span>
            ) : qaEstado === "devuelta" ? (
              <div className="basis-full mt-2 rounded-md border p-2 text-[11px]" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}>
                <div className="font-semibold">QA devolvió la proyección · {motivoLabel(validacion!.motivo)}</div>
                {validacion!.observacion && <div className="mt-1 text-[#7F1D1D]">{validacion!.observacion}</div>}
              </div>
            ) : qaEstado === "aprobada" ? (
              <span className="text-[11px] font-semibold" style={{ color: NUVEX.verdeTextoFuerte }}>
                ✓ QA aprobado — puede avanzar a Presentación.
              </span>
            ) : null}

            {errQA && <span className="text-[11px] text-[#B42318] basis-full">{errQA}</span>}
          </>
        )}
      </div>
    </div>
  );
}
