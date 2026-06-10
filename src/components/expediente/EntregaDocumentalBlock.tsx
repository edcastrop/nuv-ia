// Sub-bloque "Entrega documentación financiera" dentro de la pestaña
// Radicación del expediente. Aplica las reglas por banco:
//   • Davivienda → correo a Jurídica
//   • Banco de Bogotá → entregada en el mismo acto
//   • Davibank → física a los 4 días hábiles
//   • AV Villas → física a los 8 días hábiles

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  Landmark,
  Mail,
  Package,
  RefreshCw,
  Send,
  AlertTriangle,
  FileDown,
  Upload,
  X,
} from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { supabase } from "@/integrations/supabase/client";
import { getReglaEntrega } from "@/lib/reglasEntregaBanco";
import {
  leerEntrega,
  programarEntregaDesdeBanco,
  marcarEntregaCompletada,
  type EntregaDocumentalRow,
} from "@/lib/entregaDocumental";
import { diasHabilesHasta } from "@/lib/diasHabiles";
import {
  generarPaqueteDocumentalPdf,
  descargarBlob,
  type DocAdjunto,
} from "@/lib/paqueteDocumentalPdf";

interface Props {
  expedienteId: string;
  onIrAFinanciero?: () => void;
}

interface ExpedienteMini {
  banco: string | null;
  cliente_nombre: string | null;
  cedula: string | null;
  numero_credito: string | null;
}

interface ArchivoCargado {
  id: string;
  nombre: string;
  mime: string;
  size: number;
  dataUrl: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function EntregaDocumentalBlock({ expedienteId, onIrAFinanciero }: Props) {
  const [exp, setExp] = useState<ExpedienteMini | null>(null);
  const [row, setRow] = useState<EntregaDocumentalRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [archivos, setArchivos] = useState<ArchivoCargado[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: e }, r] = await Promise.all([
        supabase
          .from("expedientes")
          .select("banco,cliente_nombre,cedula,numero_credito")
          .eq("id", expedienteId)
          .maybeSingle(),
        leerEntrega(expedienteId),
      ]);
      setExp((e as ExpedienteMini | null) ?? null);
      setRow(r);
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const regla = useMemo(() => getReglaEntrega(exp?.banco), [exp?.banco]);

  const inicializar = async () => {
    try {
      await programarEntregaDesdeBanco({
        expedienteId,
        banco: exp?.banco ?? null,
        force: true,
      });
      toast.success("Entrega documental inicializada");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo inicializar";
      toast.error("Error", { description: msg });
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: ArchivoCargado[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name} excede 10 MB`);
        continue;
      }
      const url = await fileToDataUrl(f);
      next.push({
        id: crypto.randomUUID(),
        nombre: f.name,
        mime: f.type || "application/octet-stream",
        size: f.size,
        dataUrl: url,
      });
    }
    setArchivos((prev) => [...prev, ...next]);
  };

  const generarPaquete = async () => {
    if (!exp) return;
    setGenerandoPdf(true);
    try {
      const docs: DocAdjunto[] = archivos.length
        ? archivos.map((a) => ({ nombre: a.nombre, dataUrl: a.dataUrl, tipo: "anexo" }))
        : [
            { nombre: "Copia del poder firmado", tipo: "legal" },
            { nombre: "Copia cédula apoderado", tipo: "identidad" },
            { nombre: "Copia cédula titular(es)", tipo: "identidad" },
            { nombre: "Copia cédula codeudor (si aplica)", tipo: "identidad" },
            { nombre: "Documentos financieros (nómina/extractos/renta)", tipo: "financiero" },
          ];
      const blob = await generarPaqueteDocumentalPdf({
        cliente: exp.cliente_nombre ?? "Cliente",
        banco: regla.bancoLabel,
        cedula: exp.cedula ?? undefined,
        numeroCredito: exp.numero_credito ?? undefined,
        fechaRadicacion: new Date().toLocaleDateString("es-CO"),
        documentos: docs,
      });
      const fname = `Paquete_${(exp.cliente_nombre ?? "caso").replace(/\s+/g, "_")}_${regla.bancoLabel.replace(/\s+/g, "_")}.pdf`;
      descargarBlob(blob, fname);
      toast.success("Paquete documental generado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo generar el PDF";
      toast.error("Error generando paquete", { description: msg });
    } finally {
      setGenerandoPdf(false);
    }
  };

  const marcarEnviadaCorreo = async () => {
    setMarcando(true);
    try {
      await marcarEntregaCompletada({
        expedienteId,
        estado: "enviada_correo",
        notas: `Enviado a Jurídica de ${regla.bancoLabel}`,
      });
      toast.success("Marcada como enviada por correo");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo marcar";
      toast.error("Error", { description: msg });
    } finally {
      setMarcando(false);
    }
  };

  const marcarEntregadaFisica = async () => {
    setMarcando(true);
    try {
      await marcarEntregaCompletada({
        expedienteId,
        estado: "entregada_fisica",
        notas: `Entregada físicamente en ${regla.bancoLabel}`,
      });
      toast.success("Marcada como entregada físicamente");
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo marcar";
      toast.error("Error", { description: msg });
    } finally {
      setMarcando(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="py-3 text-[12px] text-[#242424]/60">Cargando entrega documental…</div>
      </Card>
    );
  }

  const completada = row?.estado === "enviada_correo" || row?.estado === "entregada_fisica";
  const diasFaltantes = row?.fecha_programada ? diasHabilesHasta(row.fecha_programada) : null;
  const vencida = diasFaltantes !== null && diasFaltantes < 0 && !completada;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark size={18} style={{ color: NUVEX.azul }} />
          <h3 className="text-sm font-semibold text-[#242424]">
            Entrega documentación financiera al banco
          </h3>
        </div>
        <button
          onClick={() => void load()}
          className="text-[11px] text-[#445DA3] hover:underline inline-flex items-center gap-1"
        >
          <RefreshCw size={12} /> Recargar
        </button>
      </div>

      {/* Banner: regla del banco detectada */}
      <div className="mb-3 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3 text-[12px] text-[#242424]">
        <div className="font-semibold mb-1" style={{ color: NUVEX.azul }}>
          Regla detectada · {regla.bancoLabel}
        </div>
        <div className="text-[#242424]/80">{regla.descripcion}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-white border border-[#E3E7EE] px-2 py-0.5">
            Modalidad: <strong className="capitalize">{regla.modalidad}</strong>
          </span>
          {regla.modalidad === "fisica" && (
            <span className="rounded bg-white border border-[#E3E7EE] px-2 py-0.5">
              Plazo: <strong>{regla.diasHabilesEntrega} días hábiles</strong>
            </span>
          )}
          {regla.requiereChecklistCompletoAlRadicar && (
            <span className="rounded bg-[#FEE2E2] border border-[#FCA5A5] px-2 py-0.5 text-[#991B1B] font-semibold inline-flex items-center gap-1">
              <AlertTriangle size={11} /> Bloqueo: checklist 100 % al radicar
            </span>
          )}
        </div>
      </div>

      {/* Si no existe fila aún */}
      {!row && (
        <div className="rounded-lg border border-dashed border-[#E3E7EE] p-4 text-center">
          <p className="text-[12px] text-[#242424]/70 mb-2">
            La entrega documental aún no está inicializada. Se creará automáticamente al
            registrar el radicado en banco. También puedes inicializarla ahora.
          </p>
          <button
            type="button"
            onClick={inicializar}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ background: NUVEX.azul }}
          >
            Inicializar entrega documental
          </button>
        </div>
      )}

      {/* Estado actual */}
      {row && (
        <>
          <EstadoBanner row={row} diasFaltantes={diasFaltantes} vencida={vencida} />

          {row.estado === "no_aplica" && (
            <p className="text-[12px] text-[#242424]/70">
              El banco asociado no tiene una regla específica de entrega documental
              configurada. Coordina manualmente.
            </p>
          )}

          {/* Davivienda: correo */}
          {regla.modalidad === "correo" && !completada && (
            <div className="rounded-lg border border-[#E3E7EE] bg-white p-3">
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: NUVEX.azul }}>
                Acción · Davivienda (correo a Jurídica del banco)
              </div>
              <p className="text-[12px] text-[#242424]/75 mb-2">
                Construye el correo desde el módulo <strong>Financiero → Análisis de
                capacidad de pago → Construir solicitud al banco</strong>. Adjunta poder,
                cédulas y documentos financieros. Cuando lo hayas enviado, márcalo aquí.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={marcarEnviadaCorreo}
                  disabled={marcando}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "#1F7A45" }}
                >
                  <Send size={14} /> Marcar enviada por correo
                </button>
              </div>
            </div>
          )}

          {/* Física diferida (Davibank / AV Villas / otros con plazo) */}
          {regla.modalidad === "fisica" && regla.diasHabilesEntrega > 0 && !completada && (
            <div className="rounded-lg border border-[#E3E7EE] bg-white p-3 space-y-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: NUVEX.azul }}>
                  Acción · Entrega física programada
                </div>
                <p className="text-[12px] text-[#242424]/75">
                  Prepara el paquete físico (poder, cédulas, financieros) y entrégalo en
                  ventanilla del banco en la fecha programada.
                </p>
              </div>

              <PaqueteSection
                archivos={archivos}
                onFiles={handleFiles}
                onRemove={(id) => setArchivos((p) => p.filter((a) => a.id !== id))}
                inputRef={inputRef}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generarPaquete}
                  disabled={generandoPdf}
                  className="rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-2 border border-[#E3E7EE] bg-white text-[#242424] hover:bg-[#F7F9FB] disabled:opacity-50"
                >
                  <FileDown size={14} /> {generandoPdf ? "Generando…" : "Generar paquete PDF"}
                </button>
                <button
                  type="button"
                  onClick={marcarEntregadaFisica}
                  disabled={marcando}
                  className="rounded-lg px-3 py-2 text-xs font-semibold text-white inline-flex items-center gap-2 disabled:opacity-50"
                  style={{ background: "#1F7A45" }}
                >
                  <Package size={14} /> Marcar entregada físicamente
                </button>
              </div>
            </div>
          )}

          {/* Bogotá: entregada en el mismo acto (estado ya viene en entregada_fisica) */}
          {regla.modalidad === "fisica" && regla.diasHabilesEntrega === 0 && (
            <p className="text-[12px] text-[#242424]/70 mt-2">
              En {regla.bancoLabel} la documentación se entrega <strong>en el mismo acto
              de radicación</strong>. Si necesitas reimprimir el paquete:
            </p>
          )}
          {regla.modalidad === "fisica" && regla.diasHabilesEntrega === 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generarPaquete}
                disabled={generandoPdf}
                className="rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-2 border border-[#E3E7EE] bg-white text-[#242424] hover:bg-[#F7F9FB] disabled:opacity-50"
              >
                <FileDown size={14} /> {generandoPdf ? "Generando…" : "Reimprimir paquete PDF"}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function EstadoBanner({
  row,
  diasFaltantes,
  vencida,
}: {
  row: EntregaDocumentalRow;
  diasFaltantes: number | null;
  vencida: boolean;
}) {
  if (row.estado === "enviada_correo") {
    return (
      <div className="mb-3 rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45] inline-flex items-center gap-2">
        <CheckCircle2 size={14} />
        <span><strong>Enviada por correo</strong> · {row.fecha_completada ? new Date(row.fecha_completada).toLocaleString("es-CO") : ""}</span>
      </div>
    );
  }
  if (row.estado === "entregada_fisica") {
    return (
      <div className="mb-3 rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45] inline-flex items-center gap-2">
        <CheckCircle2 size={14} />
        <span><strong>Entregada físicamente</strong>{row.fecha_completada ? ` · ${new Date(row.fecha_completada).toLocaleString("es-CO")}` : ""}</span>
      </div>
    );
  }
  if (row.estado === "programada") {
    return (
      <div className={`mb-3 rounded-lg border px-3 py-2 text-[12px] inline-flex items-center gap-2 ${vencida ? "border-[#FCA5A5] bg-[#FEE2E2] text-[#991B1B]" : "border-[#FCD34D] bg-[#FEF3C7] text-[#92400E]"}`}>
        <Clock size={14} />
        <span>
          <strong>{vencida ? "Entrega vencida" : "Entrega programada"}</strong>
          {row.fecha_programada && ` · ${new Date(row.fecha_programada).toLocaleDateString("es-CO")}`}
          {diasFaltantes !== null && (
            <> · {diasFaltantes >= 0 ? `Faltan ${diasFaltantes} días hábiles` : `Hace ${Math.abs(diasFaltantes)} días hábiles`}</>
          )}
        </span>
      </div>
    );
  }
  if (row.estado === "pendiente") {
    return (
      <div className="mb-3 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] px-3 py-2 text-[12px] text-[#242424] inline-flex items-center gap-2">
        <Mail size={14} />
        <span><strong>Pendiente de envío</strong> · construye y envía el correo a Jurídica del banco</span>
      </div>
    );
  }
  return null;
}

function PaqueteSection({
  archivos,
  onFiles,
  onRemove,
  inputRef,
}: {
  archivos: ArchivoCargado[];
  onFiles: (f: FileList | null) => void;
  onRemove: (id: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#E3E7EE] bg-[#F7F9FB] p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70">
          Anexos opcionales para el paquete PDF
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-[11px] inline-flex items-center gap-1 rounded border border-[#E3E7EE] bg-white px-2 py-1 hover:bg-[#EEF1FA] text-[#445DA3]"
        >
          <Upload size={12} /> Agregar PDFs / imágenes
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {archivos.length === 0 ? (
        <p className="text-[11px] text-[#242424]/55">
          Si no agregas anexos, el PDF se generará solo con la carátula (lista
          de documentos que llevarás al banco).
        </p>
      ) : (
        <ul className="space-y-1">
          {archivos.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-[11px] bg-white border border-[#E3E7EE] rounded px-2 py-1">
              <span className="truncate">{a.nombre} · {(a.size / 1024).toFixed(0)} KB</span>
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="text-[#B42318] hover:bg-[#FEE2E2] rounded p-0.5"
                title="Quitar"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
