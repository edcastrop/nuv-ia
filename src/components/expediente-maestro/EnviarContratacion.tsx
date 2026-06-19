// Modal "Enviar a Contratación": valida pre-requisitos, deja editar destinatarios,
// genera Poder + Datos Contrato (Word) en memoria, adjunta cédula + extracto del
// cliente desde expediente_soportes, y dispara el envío.

import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, X, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, Mail } from "lucide-react";
import { NUVEX } from "@/components/nuvex/constants";
import type { LegalDoc } from "@/lib/legalDocs";
import { legalDocToDOCXBlob } from "@/lib/legalDocsExport";
import { supabase } from "@/integrations/supabase/client";
import {
  listDestinatarios, addDestinatario, deleteDestinatario, setDestinatarioActivo,
  type DestinatarioContratacion,
} from "@/lib/contratacion";
import { enviarContratacion } from "@/lib/contratacion.functions";
import { cambiarEstadoConValidacion } from "@/lib/pipelineTransiciones";
import { evaluarQaGuard } from "@/lib/qaGuard";

interface SoporteAdjunto {
  filename: string;
  contentType: string;
  blob: Blob;
  label: string; // "Cédula del titular", "Extracto bancario", etc.
}

const SOPORTE_LABELS: Record<string, string> = {
  cedula_titular: "Cédula del titular",
  extracto: "Extracto bancario",
};

function labelSoporte(categoria: string, subcategoria: string): string {
  if (SOPORTE_LABELS[subcategoria]) return SOPORTE_LABELS[subcategoria];
  if (subcategoria.startsWith("cedula_cotitular")) {
    const n = subcategoria.replace("cedula_cotitular_", "");
    return `Cédula cotitular ${n}`;
  }
  if (categoria === "identidad") return "Documento de identidad";
  if (categoria === "extracto_banco") return "Extracto bancario";
  return subcategoria || categoria;
}

async function fetchSoportesCliente(expedienteId: string): Promise<SoporteAdjunto[]> {
  const { data, error } = await supabase
    .from("expediente_soportes" as never)
    .select("archivo_nombre, archivo_path, mime_type, categoria, subcategoria, created_at")
    .eq("expediente_id", expedienteId)
    .in("categoria", ["identidad", "extracto_banco"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(`No se pudieron leer soportes del cliente: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{
    archivo_nombre: string; archivo_path: string; mime_type: string | null;
    categoria: string; subcategoria: string;
  }>;
  const adjuntos: SoporteAdjunto[] = [];
  for (const r of rows) {
    const { data: signed, error: sErr } = await supabase.storage
      .from("soportes-banco")
      .createSignedUrl(r.archivo_path, 300);
    if (sErr || !signed?.signedUrl) continue;
    try {
      const resp = await fetch(signed.signedUrl);
      if (!resp.ok) continue;
      const blob = await resp.blob();
      adjuntos.push({
        filename: r.archivo_nombre || r.archivo_path.split("/").pop() || "soporte",
        contentType: r.mime_type || blob.type || "application/octet-stream",
        blob,
        label: labelSoporte(r.categoria, r.subcategoria),
      });
    } catch (e) {
      console.warn("[Contratacion] no se pudo descargar soporte:", r.archivo_path, e);
    }
  }
  return adjuntos;
}

export interface ContratacionContext {
  expedienteId: string;
  clienteNombre: string;
  banco: string;
  producto: string;
  asesorNombre: string;
  poderDoc: LegalDoc | null;
  datosDoc: LegalDoc | null;
  faltantes: string[]; // razones por las que NO se puede enviar
}

interface Props {
  ctx: ContratacionContext;
  onSent?: () => void;
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const r = String(fr.result || "");
      const i = r.indexOf(",");
      resolve(i >= 0 ? r.slice(i + 1) : r);
    };
    fr.readAsDataURL(blob);
  });

export function EnviarContratacionButton({ ctx, onSent }: Props) {
  const [open, setOpen] = useState(false);
  const blocked = ctx.faltantes.length > 0;

  return (
    <>
      <div className="mt-5 rounded-xl border bg-white p-4" style={{ borderColor: "#E3E7EE" }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              Contratación
            </div>
            <div className="text-sm font-semibold text-[#242424]">Enviar expediente a contratación</div>
            <p className="text-xs text-[#242424]/60 mt-0.5">
              Genera Poder y Datos para Contrato (PDF + Word) y los envía por correo.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            disabled={blocked}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: blocked ? "#94A3B8" : NUVEX.azul }}
            title={blocked ? "El expediente no está listo para contratación." : "Enviar a contratación"}
          >
            <Send size={14} /> Enviar a Contratación
          </button>
        </div>
        {blocked && (
          <div className="mt-3 rounded-lg border p-2 text-xs"
            style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg, color: NUVEX.rojoTexto }}>
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              <AlertTriangle size={13} /> El expediente no está listo para contratación.
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {ctx.faltantes.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        )}
      </div>
      {open && (
        <EnviarContratacionModal
          ctx={ctx}
          onClose={() => setOpen(false)}
          onSent={() => {
            setOpen(false);
            // Disparador automático: envío a contratación → estado "documentación completa"
            cambiarEstadoConValidacion(ctx.expedienteId, "documentacion_completa", "documentacion_completa")
              .catch((err) => console.warn("[estado] documentacion_completa", err));
            onSent?.();
          }}
        />
      )}
    </>
  );
}

function EnviarContratacionModal({ ctx, onClose, onSent }: { ctx: ContratacionContext; onClose: () => void; onSent: () => void }) {
  const send = useServerFn(enviarContratacion);
  const [destinatarios, setDestinatarios] = useState<DestinatarioContratacion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newEmail, setNewEmail] = useState("");
  const [loadingD, setLoadingD] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [soportes, setSoportes] = useState<SoporteAdjunto[]>([]);
  const [loadingSoportes, setLoadingSoportes] = useState(true);

  const reload = async () => {
    setLoadingD(true);
    try {
      const rows = await listDestinatarios();
      setDestinatarios(rows);
      setSelected(new Set(rows.filter((r) => r.activo).map((r) => r.email)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingD(false);
    }
  };
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSoportes(true);
    fetchSoportesCliente(ctx.expedienteId)
      .then((rows) => { if (!cancelled) setSoportes(rows); })
      .catch((e) => { if (!cancelled) setError((e as Error).message); })
      .finally(() => { if (!cancelled) setLoadingSoportes(false); });
    return () => { cancelled = true; };
  }, [ctx.expedienteId]);

  const tieneCedula = soportes.some((s) => s.label.toLowerCase().startsWith("cédula") || s.label.toLowerCase().startsWith("documento de identidad"));
  const tieneExtracto = soportes.some((s) => s.label.toLowerCase().startsWith("extracto"));

  const asunto = `${ctx.clienteNombre} - Ficha de contratación y poder${ctx.asesorNombre ? ` - ${ctx.asesorNombre}` : ""}`;
  const cuerpo = useMemo(() => {
    const saludo = `Estimado equipo de Contratación,`;
    const intro = `Adjuntamos la documentación correspondiente al cliente ${ctx.clienteNombre} para continuar con el proceso de contratación con ${ctx.banco || "el banco"}${ctx.producto ? ` (${ctx.producto})` : ""}.`;
    const detalle = [
      `Detalle del expediente:`,
      `• Cliente: ${ctx.clienteNombre}`,
      `• Banco: ${ctx.banco || "—"}`,
      `• Producto: ${ctx.producto || "—"}`,
      `• Asesor responsable: ${ctx.asesorNombre || "—"}`,
      `• Fecha de envío: ${new Date().toLocaleString("es-CO")}`,
    ].join("\n");
    const lineasAdjuntos = [
      `Documentos adjuntos:`,
      `- Poder Especial (Word)`,
      `- Ficha de Datos del Contrato (Word)`,
    ];
    if (tieneCedula) lineasAdjuntos.push(`- Cédula del cliente`);
    if (tieneExtracto) lineasAdjuntos.push(`- Extracto bancario del cliente`);
    const adjuntos = lineasAdjuntos.join("\n");
    const cierre = `Quedamos atentos a cualquier observación o requerimiento adicional para avanzar con la radicación.\n\nCordialmente,\n${ctx.asesorNombre || "Equipo NUVEX"}\nNUVEX — Finanzas Inteligentes`;
    return [saludo, intro, detalle, adjuntos, cierre].join("\n\n");
  }, [ctx, tieneCedula, tieneExtracto]);

  const handleAdd = async () => {
    const v = newEmail.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { setError("Correo no válido"); return; }
    setError(null);
    try {
      await addDestinatario(v);
      setNewEmail("");
      await reload();
      setSelected((prev) => new Set([...prev, v]));
    } catch (e) { setError((e as Error).message); }
  };

  const handleDelete = async (d: DestinatarioContratacion) => {
    if (!confirm(`¿Eliminar ${d.email}?`)) return;
    try { await deleteDestinatario(d.id); await reload(); } catch (e) { setError((e as Error).message); }
  };

  const toggleSel = (email: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(email)) n.delete(email); else n.add(email);
      return n;
    });

  const handleSend = async () => {
    setError(null);
    const dests = Array.from(selected);
    if (dests.length === 0) { setError("Selecciona al menos un destinatario."); return; }
    if (!ctx.poderDoc || !ctx.datosDoc) { setError("Faltan documentos por generar."); return; }
    const guard = await evaluarQaGuard(ctx.expedienteId);
    if (!guard.ok) { setError(guard.reason); return; }
    setSending(true);
    try {
      const [poderPdf, poderDocx, datosPdf, datosDocx] = await Promise.all([
        Promise.resolve(legalDocToPDFBlob(ctx.poderDoc)),
        legalDocToDOCXBlob(ctx.poderDoc),
        Promise.resolve(legalDocToPDFBlob(ctx.datosDoc)),
        legalDocToDOCXBlob(ctx.datosDoc),
      ]);
      const attachments = [
        { blob: poderPdf, filename: `${ctx.poderDoc.filename}.pdf`, contentType: "application/pdf" },
        { blob: poderDocx, filename: `${ctx.poderDoc.filename}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        { blob: datosPdf, filename: `${ctx.datosDoc.filename}.pdf`, contentType: "application/pdf" },
        { blob: datosDocx, filename: `${ctx.datosDoc.filename}.docx`, contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
      ];
      const encoded = await Promise.all(attachments.map(async (a) => ({
        filename: a.filename,
        contentType: a.contentType,
        contentBase64: await blobToBase64(a.blob),
      })));
      await send({ data: { expedienteId: ctx.expedienteId, destinatarios: dests, asunto, cuerpo, attachments: encoded } });
      setDone(true);
      setTimeout(() => onSent(), 1200);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: NUVEX.azul }} />
            <div className="font-semibold text-[#242424]">Enviar a Contratación</div>
          </div>
          <button onClick={onClose} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="rounded-lg border bg-[#F7F9FB] p-3 text-xs" style={{ borderColor: "#E3E7EE" }}>
            <div className="font-semibold text-[#242424] mb-1">Asunto</div>
            <div>{asunto}</div>
            <div className="font-semibold text-[#242424] mt-2 mb-1">Cuerpo</div>
            <pre className="whitespace-pre-wrap font-sans text-[12px]">{cuerpo}</pre>
            <div className="font-semibold text-[#242424] mt-2 mb-1">Adjuntos</div>
            <ul className="list-disc pl-5">
              <li>{ctx.poderDoc?.filename}.pdf</li>
              <li>{ctx.poderDoc?.filename}.docx</li>
              <li>{ctx.datosDoc?.filename}.pdf</li>
              <li>{ctx.datosDoc?.filename}.docx</li>
            </ul>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70 mb-1">Destinatarios</div>
            {loadingD ? (
              <div className="text-xs text-[#242424]/60">Cargando…</div>
            ) : (
              <div className="space-y-1">
                {destinatarios.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border bg-white p-2 text-sm" style={{ borderColor: "#E3E7EE" }}>
                    <input type="checkbox" checked={selected.has(d.email)} onChange={() => toggleSel(d.email)} />
                    <div className="flex-1">
                      <div className="font-medium text-[#242424]">{d.email}</div>
                      {d.nombre && <div className="text-[11px] text-[#242424]/60">{d.nombre}</div>}
                    </div>
                    <label className="text-[11px] text-[#242424]/60 inline-flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={d.activo}
                        onChange={async (e) => { try { await setDestinatarioActivo(d.id, e.target.checked); await reload(); } catch (er) { setError((er as Error).message); } }}
                      /> Activo
                    </label>
                    <button onClick={() => handleDelete(d)} className="text-[#B42318] hover:bg-[#FDECEC] rounded p-1" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {destinatarios.length === 0 && (
                  <div className="text-xs text-[#242424]/60">No hay destinatarios. Añade al menos uno.</div>
                )}
              </div>
            )}

            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="agregar@correo.com"
                className="flex-1 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-sm"
              />
              <button onClick={handleAdd} className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F7F9FB]">
                <Plus size={13} /> Agregar
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border p-2 text-xs"
              style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg, color: NUVEX.rojoTexto }}>
              {error}
            </div>
          )}
          {done && (
            <div className="rounded-lg border p-2 text-xs inline-flex items-center gap-1.5"
              style={{ borderColor: "#BBE4C9", background: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }}>
              <CheckCircle2 size={13} /> Correo enviado correctamente.
            </div>
          )}
        </div>

        <div className="border-t border-[#E3E7EE] px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || selected.size === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: NUVEX.azul }}
          >
            {sending ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Send size={13} /> Enviar ahora</>}
          </button>
        </div>
      </div>
    </div>
  );
}
