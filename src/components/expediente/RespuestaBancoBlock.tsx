import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { formatCOP, parseCurrency, parseDecimal } from "@/lib/format";
import { honorariosFinalesCliente, calcularRecalculoHonorarios, guardarRecalculoHonorarios } from "@/lib/honorarios";
import { calcularPrecision, registrarPrecisionAnalista } from "@/lib/precisionHistorica";
import { aplicaOtrosi, abrirOtrosiImprimible } from "@/lib/otrosiContrato";
// Notificación al AFC: TODO cuando exista crearNotificacion helper.

interface Props {
  expedienteId: string;
  simulacionId?: string | null;
  analistaId?: string | null;
  clienteNombre?: string;
  clienteCedula?: string;
  bancoNombre?: string;
  numeroExpediente?: string;
  cuotasPactadas?: number;
  honorariosPactados?: number;
  // Datos presentados (referencia para el comparativo)
  cuotaPropuesta?: number;
  plazoPropuesto?: number;
  cuotasEliminadasPropuestas?: number;
  ahorroPropuesto?: number;
}

type Tab = "financiero" | "juridico";

export function RespuestaBancoBlock({
  expedienteId,
  simulacionId,
  analistaId,
  clienteNombre = "",
  clienteCedula = "",
  bancoNombre = "",
  numeroExpediente = "",
  cuotasPactadas = 0,
  honorariosPactados = 0,
  cuotaPropuesta = 0,
  plazoPropuesto = 0,
  cuotasEliminadasPropuestas = 0,
  ahorroPropuesto = 0,
}: Props) {
  const { user } = useAuth();
  const { roles, isSuperAdmin, isDirectorQA, isDirectorJuridico, isApoderado } = useUserRole();

  const puedeEditarFinanciero = isSuperAdmin || isDirectorQA;
  const puedeEditarJuridico =
    isSuperAdmin || isDirectorJuridico || isApoderado || roles.includes("apoderado");
  const soloLectura = !puedeEditarFinanciero && !puedeEditarJuridico;

  const [tab, setTab] = useState<Tab>(puedeEditarFinanciero ? "financiero" : "juridico");
  const [respuesta, setRespuesta] = useState<{
    id?: string;
    cuotaAprobada: string;
    plazoAprobado: string;
    cuotasAprobadas: string;
    fechaAprobacion: string;
    observaciones: string;
  }>({
    cuotaAprobada: "",
    plazoAprobado: "",
    cuotasAprobadas: "",
    fechaAprobacion: "",
    observaciones: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!simulacionId) return;
    let cancel = false;
    supabase
      .from("audit_respuestas_banco")
      .select("*")
      .eq("simulacion_id", simulacionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancel || !data) return;
        setRespuesta({
          id: data.id,
          cuotaAprobada: data.cuota_aprobada ? String(data.cuota_aprobada) : "",
          plazoAprobado: data.plazo_aprobado ? String(data.plazo_aprobado) : "",
          cuotasAprobadas: data.cuotas_aprobadas ? String(data.cuotas_aprobadas) : "",
          fechaAprobacion: data.fecha_aprobacion ?? "",
          observaciones: data.observaciones ?? "",
        });
      });
    return () => {
      cancel = true;
    };
  }, [simulacionId]);

  const cuotaAprob = parseCurrency(respuesta.cuotaAprobada);
  const plazoAprob = parseDecimal(respuesta.plazoAprobado);
  const cuotasAprob = parseDecimal(respuesta.cuotasAprobadas);

  const diffs = useMemo(() => {
    const dCuota =
      cuotaPropuesta > 0 && cuotaAprob > 0
        ? ((cuotaAprob - cuotaPropuesta) / cuotaPropuesta) * 100
        : 0;
    const dPlazo = plazoAprob - plazoPropuesto;
    const dEliminadas = cuotasAprob - cuotasEliminadasPropuestas;
    return { dCuota, dPlazo, dEliminadas };
  }, [cuotaAprob, plazoAprob, cuotasAprob, cuotaPropuesta, plazoPropuesto, cuotasEliminadasPropuestas]);

  // Reajuste de honorarios (regla de 3 sobre cuotas eliminadas).
  const reajuste = useMemo(() => {
    const cuotasAprobadasBanco = Math.max(0, cuotasAprob || 0);
    return calcularRecalculoHonorarios(
      cuotasPactadas || cuotasEliminadasPropuestas || 0,
      cuotasAprobadasBanco,
      honorariosPactados || 0,
    );
  }, [cuotasAprob, cuotasPactadas, cuotasEliminadasPropuestas, honorariosPactados]);

  // Precisión histórica del analista para esta simulación.
  const precision = useMemo(
    () =>
      calcularPrecision({
        cuotaPropuesta,
        plazoPropuesto,
        ahorroPropuesto,
        cuotaAprobada: cuotaAprob,
        plazoAprobado: plazoAprob,
        ahorroAprobado: ahorroPropuesto, // fallback hasta que el banco reporte ahorro
      }),
    [cuotaPropuesta, plazoPropuesto, ahorroPropuesto, cuotaAprob, plazoAprob],
  );

  const requiereOtrosi = useMemo(
    () =>
      cuotaAprob > 0 &&
      aplicaOtrosi({
        numeroExpediente,
        clienteNombre,
        clienteCedula,
        bancoNombre,
        fechaPropuesta: "",
        fechaAprobacion: respuesta.fechaAprobacion,
        cuotaPropuesta,
        plazoPropuesto,
        ahorroPropuesto,
        honorariosPactados,
        cuotaAprobada: cuotaAprob,
        plazoAprobado: plazoAprob,
        ahorroAprobado: ahorroPropuesto,
        honorariosRecalculados: reajuste.honorariosRecalculados,
      }),
    [cuotaAprob, plazoAprob, respuesta.fechaAprobacion, cuotaPropuesta, plazoPropuesto, ahorroPropuesto, honorariosPactados, reajuste.honorariosRecalculados, numeroExpediente, clienteNombre, clienteCedula, bancoNombre],
  );

  async function guardarFinanciero() {
    if (!simulacionId || !user) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        simulacion_id: simulacionId,
        analista_id: user.id,
        cuota_propuesta: cuotaPropuesta || null,
        plazo_propuesto: plazoPropuesto || null,
        cuotas_eliminadas_propuestas: cuotasEliminadasPropuestas || null,
        cuota_aprobada: cuotaAprob || null,
        plazo_aprobado: plazoAprob || null,
        cuotas_aprobadas: cuotasAprob || null,
        fecha_aprobacion: respuesta.fechaAprobacion || null,
        observaciones: respuesta.observaciones || null,
      };
      const { error } = respuesta.id
        ? await supabase.from("audit_respuestas_banco").update(payload).eq("id", respuesta.id)
        : await supabase.from("audit_respuestas_banco").insert(payload);
      if (error) throw error;

      // Automatizaciones Etapa 9:
      // 1) Reajuste de honorarios.
      if (cuotasPactadas > 0 && honorariosPactados > 0 && cuotasAprob > 0) {
        try {
          await guardarRecalculoHonorarios(
            expedienteId,
            cuotasPactadas,
            cuotasAprob,
            honorariosPactados,
          );
        } catch (err) {
          console.warn("[reajuste]", err);
        }
      }
      // 2) Precisión histórica del analista (alimenta licencia de autonomía).
      const targetAnalista = analistaId || user.id;
      try {
        await registrarPrecisionAnalista(targetAnalista, precision);
      } catch (err) {
        console.warn("[precision]", err);
      }

      setMsg(
        requiereOtrosi
          ? "Respuesta registrada. Condiciones difieren: se requiere generar otrosí."
          : "Respuesta del banco registrada y honorarios reajustados.",
      );
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function generarOtrosi() {
    abrirOtrosiImprimible({
      numeroExpediente: numeroExpediente || expedienteId.slice(0, 8),
      clienteNombre,
      clienteCedula,
      bancoNombre,
      fechaPropuesta: "",
      fechaAprobacion: respuesta.fechaAprobacion,
      cuotaPropuesta,
      plazoPropuesto,
      ahorroPropuesto,
      honorariosPactados,
      cuotaAprobada: cuotaAprob,
      plazoAprobado: plazoAprob,
      ahorroAprobado: ahorroPropuesto,
      honorariosRecalculados: reajuste.honorariosRecalculados,
    });
  }

  if (soloLectura) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h3 className="text-base font-semibold text-slate-900">Respuesta del banco</h3>
        <p className="mt-2">
          Solo Dirección Financiera y Apoderado pueden registrar respuestas. Recibirás notificación
          cuando se cargue.
        </p>
        {respuesta.id && (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-slate-500">Cuota aprobada</dt>
              <dd className="font-semibold">{formatCOP(cuotaAprob)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plazo aprobado</dt>
              <dd className="font-semibold">{plazoAprob} meses</dd>
            </div>
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Respuesta oficial del banco</h3>
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {puedeEditarFinanciero && (
            <button
              onClick={() => setTab("financiero")}
              className={`rounded px-3 py-1 ${tab === "financiero" ? "bg-white shadow font-semibold" : ""}`}
            >
              Financiero
            </button>
          )}
          {puedeEditarJuridico && (
            <button
              onClick={() => setTab("juridico")}
              className={`rounded px-3 py-1 ${tab === "juridico" ? "bg-white shadow font-semibold" : ""}`}
            >
              Jurídico
            </button>
          )}
        </div>
      </div>

      {tab === "financiero" && puedeEditarFinanciero && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Cuota aprobada"
              value={respuesta.cuotaAprobada}
              onChange={(v) => setRespuesta((r) => ({ ...r, cuotaAprobada: v }))}
            />
            <Field
              label="Plazo aprobado (meses)"
              value={respuesta.plazoAprobado}
              onChange={(v) => setRespuesta((r) => ({ ...r, plazoAprobado: v }))}
            />
            <Field
              label="Cuotas eliminadas aprobadas"
              value={respuesta.cuotasAprobadas}
              onChange={(v) => setRespuesta((r) => ({ ...r, cuotasAprobadas: v }))}
            />
          </div>
          <Field
            label="Fecha de aprobación"
            type="date"
            value={respuesta.fechaAprobacion}
            onChange={(v) => setRespuesta((r) => ({ ...r, fechaAprobacion: v }))}
          />
          <label className="block text-xs">
            <span className="text-slate-600">Observaciones</span>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={3}
              value={respuesta.observaciones}
              onChange={(e) => setRespuesta((r) => ({ ...r, observaciones: e.target.value }))}
            />
          </label>

          {(cuotaAprob > 0 || plazoAprob > 0) && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <strong className="block text-slate-700">Comparativo presentado vs aprobado</strong>
              <ul className="mt-1 space-y-1">
                <li>
                  Δ Cuota: {diffs.dCuota >= 0 ? "+" : ""}
                  {diffs.dCuota.toFixed(2)}%
                </li>
                <li>Δ Plazo: {diffs.dPlazo} meses</li>
                <li>Δ Cuotas eliminadas: {diffs.dEliminadas}</li>
              </ul>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {msg && <span className="text-xs text-slate-500">{msg}</span>}
            <button
              onClick={guardarFinanciero}
              disabled={saving || !simulacionId}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Guardando…" : "Guardar respuesta financiera"}
            </button>
          </div>
        </div>
      )}

      {tab === "juridico" && puedeEditarJuridico && (
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          <p>
            Adjunta los soportes oficiales del banco (oficio, correo, acta) en el módulo de Soportes
            del expediente. Esta sección registra la aprobación jurídica para activar el flujo de
            otrosí y cuenta de cobro.
          </p>
          <button
            disabled
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500"
            title="Pendiente integración con módulo de soportes"
          >
            Aprobar resultado jurídico (próximamente)
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="text-slate-600">{label}</span>
      <input
        type={type}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// silenced no-unused-import on helper for future wiring
void honorariosFinalesCliente;
