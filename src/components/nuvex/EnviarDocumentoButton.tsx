// Botón reutilizable: genera el PDF de un elemento oculto y lo envía al cliente
// por correo (Resend) con asunto/cuerpo profesional según el tipo de documento.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Send, X, Loader2, CheckCircle2, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import { elementToPdfBlob } from "@/lib/pdfExport";
import { enviarDocumentoCliente } from "@/lib/envios.functions";
import { supabase } from "@/integrations/supabase/client";

type TipoDocumento = "propuesta_comercial" | "informe_final" | "cuenta_cobro_cliente";

interface Props {
  expedienteId?: string;
  tipo: TipoDocumento;
  elementId: string;
  filename: string;
  /** Lista pre-cargada de correos sugeridos (cliente, intervinientes). */
  destinatariosSugeridos?: string[];
  /** Texto del botón. */
  label?: string;
  /** Deshabilita el botón con tooltip. */
  disabled?: boolean;
  disabledReason?: string;
  /** Color de fondo. */
  bgColor?: string;
}

const TIPO_LABEL: Record<TipoDocumento, string> = {
  propuesta_comercial: "Propuesta comercial",
  informe_final: "Informe final",
  cuenta_cobro_cliente: "Cuenta de cobro",
};

export function EnviarDocumentoButton({
  expedienteId,
  tipo,
  elementId,
  filename,
  destinatariosSugeridos = [],
  label,
  disabled,
  disabledReason,
  bgColor,
}: Props) {
  const [open, setOpen] = useState(false);
  const noExpediente = !expedienteId;
  const bloqueado = disabled || noExpediente;
  const tooltip = noExpediente
    ? "Guarda el expediente antes de enviar por correo."
    : disabledReason;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={bloqueado}
        title={tooltip}
        className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: bloqueado ? "#94A3B8" : bgColor || NUVEX.azul }}
      >
        <Mail size={14} /> {label || `Enviar ${TIPO_LABEL[tipo].toLowerCase()} por correo`}
      </button>
      {open && expedienteId && (
        <EnviarDocumentoModal
          expedienteId={expedienteId}
          tipo={tipo}
          elementId={elementId}
          filename={filename}
          destinatariosSugeridos={destinatariosSugeridos}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function EnviarDocumentoModal({
  expedienteId,
  tipo,
  elementId,
  filename,
  destinatariosSugeridos,
  onClose,
}: {
  expedienteId: string;
  tipo: TipoDocumento;
  elementId: string;
  filename: string;
  destinatariosSugeridos: string[];
  onClose: () => void;
}) {
  const send = useServerFn(enviarDocumentoCliente);
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  // Autocargar correo del cliente desde el expediente
  useEffect(() => {
    const seed = new Set<string>();
    destinatariosSugeridos
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
      .forEach((s) => seed.add(s));

    supabase
      .from("expedientes")
      .select("cliente_data")
      .eq("id", expedienteId)
      .maybeSingle()
      .then(({ data }) => {
        const cd = (data?.cliente_data ?? {}) as Record<string, unknown>;
        const candidatos = [cd.correo, cd.email, cd.correo_electronico].filter(
          (v): v is string => typeof v === "string" && v.trim().length > 0,
        );
        candidatos
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
          .forEach((s) => seed.add(s));
        setDestinatarios(Array.from(seed));
      });
  }, [expedienteId, destinatariosSugeridos]);

  const agregar = () => {
    const v = nuevo.trim().toLowerCase();
    if (!v) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Correo no válido.");
      return;
    }
    if (destinatarios.includes(v)) {
      setError("Ese correo ya está en la lista.");
      return;
    }
    setError(null);
    setDestinatarios((prev) => [...prev, v]);
    setNuevo("");
  };

  const quitar = (e: string) =>
    setDestinatarios((prev) => prev.filter((x) => x !== e));

  const enviar = async () => {
    setError(null);
    if (destinatarios.length === 0) {
      setError("Agrega al menos un correo destinatario.");
      return;
    }
    setSending(true);
    try {
      const pdf = await elementToPdfBlob(elementId);
      if (!pdf) {
        throw new Error("No se pudo generar el PDF para enviar.");
      }
      await send({
        data: {
          expedienteId,
          tipo,
          destinatarios,
          filename,
          contentBase64: pdf.base64,
          contentType: "application/pdf",
        },
      });
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-lg w-full overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: NUVEX.azul }} />
            <div className="font-semibold text-[#242424]">
              Enviar {TIPO_LABEL[tipo].toLowerCase()} al cliente
            </div>
          </div>
          <button onClick={onClose} className="text-[#242424]/60 hover:text-[#242424]">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-lg border bg-[#F7F9FB] p-3 text-xs" style={{ borderColor: "#E3E7EE" }}>
            <div className="font-semibold text-[#242424] mb-1">Adjunto</div>
            <div>{filename}</div>
            <div className="mt-2 text-[11px] text-[#242424]/60">
              El asunto y el cuerpo se generan automáticamente con un mensaje profesional
              firmado por el asesor responsable del caso. Las respuestas llegarán
              directamente al correo del asesor.
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70 mb-1">
              Destinatarios
            </div>
            <div className="space-y-1">
              {destinatarios.map((d) => (
                <div
                  key={d}
                  className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm"
                  style={{ borderColor: "#E3E7EE" }}
                >
                  <div className="flex-1 font-medium text-[#242424]">{d}</div>
                  <button
                    onClick={() => quitar(d)}
                    className="text-[#B42318] hover:bg-[#FDECEC] rounded p-1"
                    title="Quitar"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {destinatarios.length === 0 && (
                <div className="text-xs text-[#242424]/60">
                  Aún no hay correos. Agrega al menos uno.
                </div>
              )}
            </div>

            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregar();
                  }
                }}
                placeholder="cliente@correo.com"
                className="flex-1 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-sm"
              />
              <button
                onClick={agregar}
                className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F7F9FB]"
              >
                <Plus size={13} /> Agregar
              </button>
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg border p-2 text-xs flex items-start gap-1.5"
              style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg, color: NUVEX.rojoTexto }}
            >
              <AlertTriangle size={13} className="mt-0.5" />
              <div>{error}</div>
            </div>
          )}
          {done && (
            <div
              className="rounded-lg border p-2 text-xs inline-flex items-center gap-1.5"
              style={{ borderColor: "#BBE4C9", background: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }}
            >
              <CheckCircle2 size={13} /> Correo enviado correctamente.
            </div>
          )}
        </div>

        <div className="border-t border-[#E3E7EE] px-5 py-3 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
          >
            Cancelar
          </button>
          <button
            onClick={enviar}
            disabled={sending || destinatarios.length === 0 || done}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: NUVEX.azul }}
          >
            {sending ? (
              <>
                <Loader2 size={13} className="animate-spin" /> Enviando…
              </>
            ) : (
              <>
                <Send size={13} /> Enviar ahora
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
