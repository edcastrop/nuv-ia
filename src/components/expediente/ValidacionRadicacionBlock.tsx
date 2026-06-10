import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw, Landmark, Lock, Save } from "lucide-react";
import { toast } from "sonner";
import { evaluarRequisitosRadicacion, type ResultadoValidacionRadicacion } from "@/lib/validacionRadicacion";
import { NUVEX } from "@/components/nuvex/constants";
import { supabase } from "@/integrations/supabase/client";
import { useEstadoSugerido } from "@/hooks/useEstadoSugerido";
import { ConfirmEstadoModal } from "./ConfirmEstadoModal";
import type { CasoEstado } from "@/lib/casoEstados";
import { labelEstado } from "@/lib/casoEstados";

const ESTADOS_PERMITEN_RADICAR: CasoEstado[] = [
  "documentacion_completa",
  "radicacion_pendiente",
  "radicacion_preparada",
];

interface EstadoInfo {
  estado_caso: CasoEstado | null;
  radicado_id_banco: string | null;
  radicado_fecha: string | null;
}

export function ValidacionRadicacionBlock({ expedienteId }: { expedienteId: string }) {
  const [data, setData] = useState<ResultadoValidacionRadicacion | null>(null);
  const [info, setInfo] = useState<EstadoInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, exp] = await Promise.all([
        evaluarRequisitosRadicacion(expedienteId),
        supabase
          .from("expedientes")
          .select("estado_caso,radicado_id_banco,radicado_fecha" as never)
          .eq("id", expedienteId)
          .single(),
      ]);
      setData(res);
      setInfo((exp.data as unknown as EstadoInfo) ?? null);
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => { void load(); }, [load]);

  const { pendiente, sugerir, confirmar, cancelar } = useEstadoSugerido(
    expedienteId,
    () => { void load(); },
  );

  const estado = info?.estado_caso ?? null;
  const ESTADOS_POST_RADICACION: CasoEstado[] = [
    "radicado_banco",
    "en_estudio_banco",
    "docs_complementarios_banco",
    "aprobado",
    "aprobado_banco",
    "documentos_banco_firmados",
    "condiciones_aplicadas",
    "aplicado_banco",
    "resultado_final_generado",
    "cuenta_cobro_generada",
    "cuenta_cobro_enviada",
    "honorarios_pendientes",
    "honorarios_pagados",
    "paz_y_salvo_generado",
    "caso_finalizado",
    "proceso_cerrado",
  ];
  const tieneRadicadoId = !!info?.radicado_id_banco;
  const estadoPostRadicacion = !!estado && ESTADOS_POST_RADICACION.includes(estado);
  const yaRadicado = tieneRadicadoId && estadoPostRadicacion;
  // Estado avanzado pero falta capturar el ID/fecha del banco
  const faltaCapturarDatos = estadoPostRadicacion && !tieneRadicadoId;

  const puedeAccionar =
    !!data?.puedeRadicar &&
    !estadoPostRadicacion &&
    !!estado &&
    ESTADOS_PERMITEN_RADICAR.includes(estado);

  // Inline form para completar datos cuando el estado ya avanzó
  const [radicadoIdInput, setRadicadoIdInput] = useState("");
  const [fechaInput, setFechaInput] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [savingDatos, setSavingDatos] = useState(false);

  const guardarDatosRadicacion = async () => {
    const id = radicadoIdInput.trim();
    if (id.length < 3) {
      toast.error("Ingresa un ID de radicado válido (mínimo 3 caracteres)");
      return;
    }
    setSavingDatos(true);
    try {
      const fechaIso = fechaInput ? new Date(fechaInput).toISOString() : new Date().toISOString();
      const { error } = await supabase
        .from("expedientes")
        .update({ radicado_id_banco: id, radicado_fecha: fechaIso } as never)
        .eq("id", expedienteId);
      if (error) throw error;
      toast.success("Datos de radicación guardados");
      setRadicadoIdInput("");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudieron guardar los datos";
      toast.error("Error", { description: msg });
    } finally {
      setSavingDatos(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: NUVEX.azul }} />
          <h3 className="text-sm font-semibold text-[#242424]">
            Radicación en banco · control de calidad y registro
          </h3>
        </div>
        <button onClick={() => void load()} className="text-[11px] text-[#445DA3] hover:underline inline-flex items-center gap-1">
          <RefreshCw size={12} /> Reevaluar
        </button>
      </div>

      {loading && <div className="py-3 text-[12px] text-[#242424]/60">Evaluando requisitos…</div>}

      {!loading && data && (
        <>
          <div className="mb-3">
            {yaRadicado ? (
              <div className="rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45]">
                <div className="font-semibold">✓ Caso radicado en el banco</div>
                {info?.radicado_id_banco && (
                  <div className="mt-0.5 text-[11px] text-[#1F7A45]/90">
                    Radicado: <strong>{info.radicado_id_banco}</strong>
                    {info.radicado_fecha && (
                      <> · {new Date(info.radicado_fecha).toLocaleString("es-CO")}</>
                    )}
                  </div>
                )}
                {estado && (
                  <div className="mt-0.5 text-[11px] text-[#1F7A45]/80">
                    Estado actual: {labelEstado(estado)}
                  </div>
                )}
              </div>
            ) : faltaCapturarDatos ? (
              <div className="rounded-lg border border-[#FBBF24] bg-[#FEF3C7] px-3 py-2 text-[12px] text-[#92400E] font-semibold">
                ⚠ El caso figura como <strong>{estado ? labelEstado(estado) : "radicado"}</strong> pero falta capturar el ID y la fecha de radicación. Complétalos abajo.
              </div>
            ) : data.puedeRadicar ? (
              <div className="rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45] font-semibold">
                ✓ El expediente cumple los requisitos. Ya puede radicarse en el banco.
              </div>
            ) : (
              <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B] font-semibold">
                Radicación bloqueada · Faltan {data.pendientes.length} requisito(s).
              </div>
            )}
          </div>

          {/* Form inline para completar datos cuando el estado ya avanzó pero faltan datos */}
          {faltaCapturarDatos && (
            <div className="mb-4 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
                Completar datos de radicación
              </div>
              <div className="text-sm font-semibold text-[#242424] mt-0.5">
                ID/código y fecha entregados por el banco
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px_auto] items-end">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                    ID de radicado <span className="text-[#B42318]">*</span>
                  </label>
                  <input
                    type="text"
                    value={radicadoIdInput}
                    onChange={(e) => setRadicadoIdInput(e.target.value)}
                    placeholder="Ej: 2026-RAD-987654"
                    className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white"
                    maxLength={120}
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#242424]/60">
                    Fecha de radicación
                  </label>
                  <input
                    type="datetime-local"
                    value={fechaInput}
                    onChange={(e) => setFechaInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm bg-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={guardarDatosRadicacion}
                  disabled={savingDatos || radicadoIdInput.trim().length < 3}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: NUVEX.azul }}
                >
                  <Save size={14} />
                  {savingDatos ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}

          {/* Acción: registrar radicado en banco (transición de estado) */}
          {!yaRadicado && !faltaCapturarDatos && (
            <div className="mb-4 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
                    Acción · Operaciones / Apoderado
                  </div>
                  <div className="text-sm font-semibold text-[#242424] mt-0.5">
                    Registrar radicación en el banco
                  </div>
                  <p className="text-[11px] text-[#242424]/65 mt-0.5 max-w-md">
                    Cuando radiques físicamente en el banco, registra aquí el ID/código entregado y observaciones del asesor que atendió.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sugerir("radicado_confirmado")}
                  disabled={!puedeAccionar}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: NUVEX.azul }}
                  title={
                    !data.puedeRadicar
                      ? "Faltan requisitos por cumplir"
                      : !puedeAccionar
                      ? `No disponible en el estado actual (${estado ? labelEstado(estado) : "—"})`
                      : "Registrar radicado"
                  }
                >
                  {puedeAccionar ? <Landmark size={14} /> : <Lock size={14} />}
                  Registrar radicado en banco
                </button>
              </div>
              {!data.puedeRadicar && (
                <div className="mt-2 text-[11px] text-[#991B1B]">
                  Resuelve los requisitos pendientes listados abajo antes de radicar.
                </div>
              )}
            </div>
          )}

          <ul className="space-y-1.5">
            {data.requisitos.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-[12px]">
                {r.cumple
                  ? <CheckCircle2 size={16} className="mt-[1px]" style={{ color: "#1F7A45" }} />
                  : <XCircle size={16} className="mt-[1px]" style={{ color: "#B42318" }} />}
                <div>
                  <div className={r.cumple ? "text-[#242424]" : "text-[#991B1B] font-semibold"}>{r.label}</div>
                  {!r.cumple && r.detalle && <div className="text-[11px] text-[#242424]/65">{r.detalle}</div>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <ConfirmEstadoModal
        open={!!pendiente}
        nuevoEstado={pendiente?.estado ?? null}
        onConfirm={async (obs, submotivo, extras) => { await confirmar(obs, submotivo, extras); }}
        onCancel={cancelar}
      />
    </Card>
  );
}
