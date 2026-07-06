import { useMemo, useState } from "react";
import { upsertExpediente, type UpsertPayload, type Expediente } from "@/lib/expedientes";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { aprobarAutomaticamentePorMotor, enviarAValidacionQA } from "@/lib/validacionQA";
import { auditarSimulacion, type AuditoriaInput } from "@/lib/auditEngine";
import { decidirPdf, type NivelAutonomia } from "@/lib/autonomia";
import { NUVEX } from "./constants";
import { CasoCreadoModal } from "./CasoCreadoModal";

export function SaveExpedienteButton({
  payload,
  expedienteId,
  onSaved,
  onSeguirSimulando,
  enviarAuditoriaManual = true,
  fromSimulador = false,
  auditInput,
  nivelAutonomia,
}: {
  payload: UpsertPayload;
  expedienteId?: string;
  onSaved?: (e: Expediente) => void;
  onSeguirSimulando?: () => void;
  enviarAuditoriaManual?: boolean;
  fromSimulador?: boolean;
  // Si se proveen, el botón decide entre auto-aprobar (motor NUVIA apto) o
  // enviar a QA manual. Si no, mantiene el comportamiento anterior (siempre
  // envía a QA cuando `enviarAuditoriaManual` está activo).
  auditInput?: AuditoriaInput;
  nivelAutonomia?: NivelAutonomia;
}) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [creado, setCreado] = useState<Expediente | null>(null);
  const [qaEnviada, setQaEnviada] = useState(false);

  const decision = useMemo(() => {
    if (!auditInput || !nivelAutonomia) return null;
    try {
      const resultado = auditarSimulacion(auditInput);
      return decidirPdf(nivelAutonomia, resultado);
    } catch {
      return null;
    }
  }, [auditInput, nivelAutonomia]);

  const autoAprobable = enviarAuditoriaManual && (decision?.accion === "permitir" || decision?.accion === "permitir_con_marca");

  const handle = async () => {
    // 🟡 Alerta de primera simulación (una sola vez por analista/navegador).
    // Recuerda verificar los datos antes de guardar para evitar casos huérfanos / "Sin nombre".
    try {
      const FIRST_KEY = "nuvia.simulador.primeraVez.v1";
      if (typeof window !== "undefined" && !window.localStorage.getItem(FIRST_KEY)) {
        const ok = window.confirm(
          "🔔 NUVIA · Antes de guardar tu primera simulación\n\n" +
            "Verifica que los datos del cliente estén correctos:\n" +
            "  • Nombre completo del cliente\n" +
            "  • Cédula\n" +
            "  • Banco y número de crédito\n\n" +
            "Los casos sin nombre generan desorden en el tablero de Casos y dificultan la auditoría QA.\n\n" +
            "¿Deseas continuar?",
        );
        if (!ok) return;
        window.localStorage.setItem(FIRST_KEY, new Date().toISOString());
      }
    } catch {
      /* localStorage no disponible — no bloqueamos el guardado */
    }

    // 🛑 Bloqueo duro: sin nombre del cliente NO se guarda el caso.
    // NUVIA extrae el nombre desde el extracto; si aparece vacío es porque el
    // analista no aplicó la lectura al simulador. Los casos "Sin nombre"
    // rompen la trazabilidad en Casos, QA y Auditoría.
    const nombre = (payload.cliente?.nombre ?? "").trim();
    if (!nombre) {
      setMsg(
        "❌ No se puede guardar: falta el NOMBRE DEL CLIENTE. Aplica la lectura del extracto o escribe el nombre en la ficha del cliente antes de guardar.",
      );
      if (typeof window !== "undefined") {
        window.alert(
          "No se puede guardar este caso sin el NOMBRE DEL CLIENTE.\n\n" +
            "• Si ya cargaste el extracto, vuelve a Datos del cliente y pulsa \"Aplicar al simulador\".\n" +
            "• Si lo estás capturando manual, escribe el nombre completo en el campo Cliente.\n\n" +
            "NUVIA ya no acepta casos \"Sin nombre\" para evitar desorden en el tablero de Casos y en la auditoría QA.",
        );
      }
      return;
    }

    // 🛑 Bloqueo duro: sin datos mínimos del crédito el caso queda huérfano
    // en el tablero (sin banco, sin producto, sin número). NUVIA no acepta
    // guardar simulaciones incompletas: rompen QA, honorarios y auditoría.
    const banco = (payload.cliente?.banco ?? "").trim();
    const producto = (payload.cliente?.tipoProducto ?? "").trim();
    const numeroCredito = (payload.cliente?.numeroCredito ?? "").trim();
    const cedula = (payload.cliente?.cedula ?? "").trim();
    const faltantes: string[] = [];
    if (!banco) faltantes.push("Banco");
    if (!producto) faltantes.push("Tipo de producto");
    if (!numeroCredito) faltantes.push("Número de crédito");
    if (!cedula) faltantes.push("Cédula");
    if (faltantes.length > 0) {
      const lista = faltantes.map((f) => `  • ${f}`).join("\n");
      setMsg(`❌ No se puede guardar: faltan datos del expediente (${faltantes.join(", ")}).`);
      if (typeof window !== "undefined") {
        window.alert(
          "No se puede guardar este caso: faltan datos mínimos del crédito.\n\n" +
            lista +
            "\n\nCompleta la ficha del cliente y del crédito antes de guardar. " +
            "NUVIA ya no acepta expedientes sin banco, producto, cédula o número de crédito " +
            "porque quedan huérfanos en el tablero de Casos y bloquean la auditoría QA y honorarios.",
        );
      }
      return;
    }


    setSaving(true);
    setMsg(null);
    try {
      const wasNew = !expedienteId;
      const e = await upsertExpediente({ ...payload, id: expedienteId });
      if (wasNew || fromSimulador) {
        try {
          await cambiarEstadoConValidacion(e.id, "simulado", "simulacion_guardada");
        } catch (err) {
          console.warn("[estado] simulado", err);
        }
      }

      let qaOk = false;
      let autoAprobado = false;
      if (enviarAuditoriaManual) {
        if (decision?.accion === "permitir" || decision?.accion === "permitir_con_marca") {
          // Motor NUVIA → apto o apto con marca no crítica. Saltamos QA y dejamos el caso listo para Contratación.
          try {
            await aprobarAutomaticamentePorMotor(
              e.id,
              `Motor NUVIA: ${decision.motivo}`,
            );
            autoAprobado = true;
          } catch (err) {
            console.warn("[qa] auto-aprobación NUVIA falló, envío a QA manual", err);
            try {
              await enviarAValidacionQA(e.id);
              qaOk = true;
            } catch (err2) {
              console.warn("[qa] envío manual también falló", err2);
            }
          }
        } else {
          // Bloqueo crítico → red de seguridad: QA manual.
          try {
            await enviarAValidacionQA(e.id);
            qaOk = true;
          } catch (err) {
            console.warn("[qa] envío automático falló", err);
          }
        }
      }
      setQaEnviada(qaOk || autoAprobado);
      setMsg(
        (fromSimulador ? "Expediente creado" : expedienteId ? "Expediente actualizado" : "Expediente creado") +
          (autoAprobado
            ? " · aprobado por NUVIA, listo para Contratación"
            : qaOk
              ? " · enviado a auditoría QA"
              : ""),
      );
      onSaved?.(e);
      if (wasNew || fromSimulador) setCreado(e);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const buttonLabel = (() => {
    if (saving) return "Enviando…";
    if (expedienteId && !enviarAuditoriaManual) return "Actualizar expediente";
    if (autoAprobable) {
      return expedienteId
        ? "Actualizar y enviar a Contratación"
        : "Crear y enviar a Contratación";
    }
    if (decision?.accion === "bloquear") {
      return expedienteId
        ? "Actualizar y enviar a auditoría QA (revisión obligatoria)"
        : "Crear y enviar a auditoría QA (revisión obligatoria)";
    }
    if (fromSimulador) return "Crear expediente";
    return expedienteId
      ? "Actualizar y enviar a auditoría QA"
      : "Crear expediente y enviar a auditoría QA";
  })();

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {msg && <span className="text-xs text-[#242424]/70">{msg}</span>}
        <button
          onClick={handle}
          disabled={saving}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50"
          style={{ backgroundColor: autoAprobable ? "#1F6F4A" : NUVEX.azul }}
        >
          {buttonLabel}
        </button>
      </div>
      {creado && (
        <CasoCreadoModal
          expediente={creado}
          qaEnviada={qaEnviada}
          onClose={() => setCreado(null)}
          onSeguirSimulando={onSeguirSimulando}
        />
      )}
    </>
  );
}
