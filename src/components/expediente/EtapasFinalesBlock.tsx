// Etapas 10–15 del Expediente (post-Resultado Bancario).
// 10 Aceptación Cliente · 11 Informe Final · 12 Facturación
// 13 Pago Honorarios · 14 Paz y Salvo · 15 Caso Cerrado
//
// Cada bloque hace una sola cosa: avanzar el estado del caso con la acción
// correcta (queda registrado en expediente_historial vía cambiarEstadoCaso)
// o persistir los campos específicos (aceptación del cliente).

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NCard } from "@/components/nuvia/NCard";
import { SectionHeader } from "@/components/nuvia/SectionHeader";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { computeEtapaActual, indexOfEtapa, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { ACCION_A_ESTADO, type AccionOrigen } from "@/lib/casoEstados";
import { useUserRole } from "@/hooks/useUserRole";
import { NSelect } from "@/components/nuvia/NSelect";



interface Props {
  expedienteId: string;
  estadoCaso?: string | null;
  etapaPipeline?: EtapaPipelineId | null;
  aceptacionAt?: string | null;
  aceptacionMedio?: string | null;
  aceptacionObservaciones?: string | null;
  onChanged?: () => void;
}

type EtapaNum = 10 | 11 | 12 | 13 | 14 | 15;

export function EtapasFinalesBlock({
  expedienteId,
  estadoCaso,
  etapaPipeline,
  aceptacionAt,
  aceptacionMedio,
  aceptacionObservaciones,
  onChanged,
}: Props) {
  const etapaActual = computeEtapaActual({
    estado_caso: estadoCaso ?? null,
    etapa_pipeline: etapaPipeline ?? null,
  });
  const idxActual = indexOfEtapa(etapaActual);
  const idxActualVisual = (() => {
    if (estadoCaso === "resultado_final_generado") return indexOfEtapa("cuenta");
    if (estadoCaso === "cuenta_cobro_generada" || estadoCaso === "cuenta_cobro_enviada") return indexOfEtapa("pago");
    if (estadoCaso === "honorarios_pagados") return indexOfEtapa("paz_salvo");
    if (estadoCaso === "paz_y_salvo_generado" || estadoCaso === "caso_finalizado" || estadoCaso === "proceso_cerrado") {
      return indexOfEtapa("finalizado") + 1;
    }
    if (aceptacionAt && etapaActual === "resultado_banco") return indexOfEtapa("informe");
    return idxActual;
  })();

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<Flag size={16} />}
        title="Etapas 10 – 15 · Cierre operativo"
        description="Una vez registrado el resultado bancario, el caso avanza de la aceptación del cliente hasta el cierre con paz y salvo."
      />
      <div className="space-y-3">


      <AceptacionCliente
        expedienteId={expedienteId}
        idxActual={idxActualVisual}
        aceptacionAt={aceptacionAt}
        aceptacionMedio={aceptacionMedio}
        aceptacionObservaciones={aceptacionObservaciones}
        onChanged={onChanged}
      />

      <EtapaAvance
        numero={11}
        titulo="Informe final"
        descripcion="Genera y envía el informe final con condiciones aprobadas, honorarios reajustados y soportes."
        accion="resultado_final"
        idxActual={idxActualVisual}
        expedienteId={expedienteId}
        onChanged={onChanged}
        extra={
          <a
            href="#informe-final"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("informe-final")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Abrir constructor de informe ↓
          </a>
        }
      />

      <EtapaAvance
        numero={12}
        titulo="Cuenta de cobro / Facturación"
        descripcion="Genera la cuenta de cobro definitiva y envíala al cliente."
        accion="cuenta_cobro_generada"
        idxActual={idxActualVisual}
        expedienteId={expedienteId}
        onChanged={onChanged}
        extra={
          <Link
            to="/contabilidad/cuentas-cobro"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
          >
            Abrir contabilidad →
          </Link>
        }
      />

      <EtapaAvance
        numero={13}
        titulo="Pago de honorarios"
        descripcion="El pago se registra desde el módulo de Cartera (monto, método, comprobante). Al cubrirse el total, esta etapa se marca automáticamente."
        accion="honorarios_pagados"
        idxActual={idxActualVisual}
        expedienteId={expedienteId}
        onChanged={onChanged}
        soloLectura
        extra={
          <a
            href="#cartera-expediente"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("cartera-expediente")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rounded-lg bg-[#1F7A45] px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            Ir a cartera para registrar pago ↓
          </a>
        }
      />

      <EtapaAvance
        numero={14}
        titulo="Paz y salvo"
        descripcion="Emite el paz y salvo al cliente. Requiere confirmación del pago de honorarios."
        accion="paz_y_salvo_generado"
        idxActual={idxActualVisual}
        expedienteId={expedienteId}
        onChanged={onChanged}
      />

      <EtapaAvance
        numero={15}
        titulo="Caso cerrado"
        descripcion="Cierre operativo definitivo. Los indicadores finales alimentan el dashboard gerencial."
        accion="caso_finalizado"
        idxActual={idxActualVisual}
        expedienteId={expedienteId}
        onChanged={onChanged}
      />
      </div>
    </NCard>

  );
}

/* ───────── Etapa 10 – Aceptación del cliente ───────── */

function AceptacionCliente({
  expedienteId,
  idxActual,
  aceptacionAt,
  aceptacionMedio,
  aceptacionObservaciones,
  onChanged,
}: {
  expedienteId: string;
  idxActual: number;
  aceptacionAt?: string | null;
  aceptacionMedio?: string | null;
  aceptacionObservaciones?: string | null;
  onChanged?: () => void;
}) {
  const idxEtapa = 9; // índice 0-based de "aceptacion_cliente" (etapa 10)
  const { isSuperAdmin, isLicenciado, roles } = useUserRole();
  const puedeEditar = isSuperAdmin || isLicenciado || roles.includes("asesor");

  const [medio, setMedio] = useState(aceptacionMedio ?? "whatsapp");
  const [obs, setObs] = useState(aceptacionObservaciones ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const yaRegistrada = !!aceptacionAt;
  const estado = useMemo(
    () => (yaRegistrada ? "completada" : clasificarEtapa(idxActual, idxEtapa)),
    [idxActual, yaRegistrada],
  );

  async function guardar() {
    if (!puedeEditar) return;
    setSaving(true);
    setMsg(null);
    try {
      const { error } = await supabase
        .from("expedientes")
        .update({
          aceptacion_cliente_at: new Date().toISOString(),
          aceptacion_medio: medio,
          aceptacion_observaciones: obs || null,
        } as never)
        .eq("id", expedienteId);
      if (error) throw error;
      // Auto-avance: cerrar la etapa "Resultado / Aceptación" avanzando el
      // caso a "aplicado_banco" (idempotente). Si el estado ya está más
      // adelante, la validación de pipeline simplemente lo deja igual.
      try {
        await cambiarEstadoConValidacion(
          expedienteId,
          "aplicado_banco",
          "aplicado_banco",
          "Aceptación del cliente registrada",
        );
      } catch (e) {
        console.warn("[aceptacionCliente] no se pudo avanzar estado", e);
      }
      setMsg("Aceptación del cliente registrada.");
      onChanged?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EtapaShell numero={10} titulo="Aceptación del cliente" estado={estado}>
      <p className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
        Registra el medio y la fecha en que el cliente aceptó expresamente las condiciones
        aprobadas por el banco (WhatsApp, correo o carta firmada).
      </p>

      {yaRegistrada && (
        <div
          className="rounded-lg p-3 text-xs"
          style={{
            background: "rgba(132,185,143,0.12)",
            border: "1px solid rgba(132,185,143,0.35)",
            color: "var(--nuvia-accent-green)",
          }}
        >
          <strong>Registrada:</strong> {new Date(aceptacionAt!).toLocaleString()} · medio{" "}
          <span className="font-semibold uppercase">{aceptacionMedio ?? "-"}</span>
          {aceptacionObservaciones && <div className="mt-1 opacity-80">{aceptacionObservaciones}</div>}
        </div>
      )}

      {puedeEditar && (
        <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
          <div className="text-xs">
            <div style={{ color: "var(--nuvia-text-secondary)" }}>Medio</div>
            <div className="mt-1">
              <NSelect
                value={medio}
                onValueChange={setMedio}
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "correo", label: "Correo electrónico" },
                  { value: "carta", label: "Carta firmada" },
                  { value: "llamada_grabada", label: "Llamada grabada" },
                ]}
              />
            </div>
          </div>

          <label className="text-xs">
            <span style={{ color: "var(--nuvia-text-secondary)" }}>Observaciones</span>
            <textarea
              className="nuvia-input nuvia-input-sm mt-1 w-full"
              rows={2}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
            />
          </label>
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {msg && <span className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{msg}</span>}
        {puedeEditar && (
          <button
            onClick={guardar}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--nuvia-accent-blue)" }}
          >
            {saving ? "Guardando…" : yaRegistrada ? "Actualizar aceptación" : "Registrar aceptación"}
          </button>
        )}
      </div>
    </EtapaShell>
  );
}


/* ───────── Etapas 11-15 – Avance simple por acción ───────── */

function EtapaAvance({
  numero,
  titulo,
  descripcion,
  accion,
  idxActual,
  expedienteId,
  onChanged,
  extra,
  soloLectura,
}: {
  numero: EtapaNum;
  titulo: string;
  descripcion: string;
  accion: Exclude<AccionOrigen, "manual">;
  idxActual: number;
  expedienteId: string;
  onChanged?: () => void;
  extra?: React.ReactNode;
  soloLectura?: boolean;
}) {
  const idxEtapa = numero - 1; // 1-based → 0-based
  const estado = clasificarEtapa(idxActual, idxEtapa);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function avanzar() {
    setSaving(true);
    setMsg(null);
    try {
      await cambiarEstadoConValidacion(expedienteId, ACCION_A_ESTADO[accion], accion);
      setMsg("Etapa avanzada.");
      onChanged?.();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <EtapaShell numero={numero} titulo={titulo} estado={estado}>
      <p className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>{descripcion}</p>
      <div className="flex items-center justify-end gap-2">
        {msg && <span className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>{msg}</span>}
        {extra}
        {!soloLectura && (
          <button
            onClick={avanzar}
            disabled={saving || estado === "futura"}
            title={estado === "futura" ? "Avanza primero las etapas previas" : ""}
            className="rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--nuvia-accent-blue)" }}
          >
            {saving ? "Guardando…" : estado === "completada" ? "Re-confirmar" : "Marcar completada"}
          </button>
        )}
      </div>
    </EtapaShell>
  );
}


/* ───────── Helpers visuales ───────── */

type EstadoEtapa = "completada" | "actual" | "futura";

function clasificarEtapa(idxActual: number, idxEtapa: number): EstadoEtapa {
  if (idxActual > idxEtapa) return "completada";
  if (idxActual === idxEtapa) return "actual";
  return "futura";
}

function EtapaShell({
  numero,
  titulo,
  estado,
  children,
}: {
  numero: EtapaNum;
  titulo: string;
  estado: EstadoEtapa;
  children: React.ReactNode;
}) {
  const palette =
    estado === "completada"
      ? { bg: "rgba(132,185,143,0.10)", border: "rgba(132,185,143,0.35)", chipBg: "rgba(132,185,143,0.18)", chipFg: "var(--nuvia-accent-green)" }
      : estado === "actual"
        ? { bg: "rgba(246,196,83,0.10)", border: "rgba(246,196,83,0.35)", chipBg: "rgba(246,196,83,0.18)", chipFg: "var(--nuvia-warning)" }
        : { bg: "rgba(255,255,255,0.03)", border: "var(--nuvia-border)", chipBg: "rgba(255,255,255,0.06)", chipFg: "var(--nuvia-text-secondary)" };

  const label = estado === "completada" ? "Completada" : estado === "actual" ? "En curso" : "Pendiente";

  return (
    <section
      className="rounded-xl p-4 space-y-2"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
          Etapa {numero} · {titulo}
        </h4>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: palette.chipBg, color: palette.chipFg }}
        >
          {label}
        </span>
      </div>
      {children}
    </section>
  );
}


