import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import {
  ClipboardList,
  Mail,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Save,
  Undo2,
  History,
  ShieldCheck,
  Paperclip,
  Loader2,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import { readApoderadoNuvexIdExpediente } from "@/lib/expedienteMaestro";
import type { Expediente, PropuestaData } from "@/lib/expedientes";
import {
  buildChecklist,
  bancoLabel,
  ESTADOS_LABEL,
  ESTADOS_COLOR,
  FLAGS_DEFAULT,
  loadChecklistRows,
  upsertChecklistRow,
  buildEmailDefaults,
  loadAuditoriaRows,
  insertAuditoriaRows,
  loadValidacion,
  upsertValidacion,
  esDocumentoCompleto,
  debeSolicitarse,
  type ChecklistRow,
  type AuditoriaRow,
  type ValidacionRow,
  type DocRequerido,
  type EstadoDoc,
  type FlagsCliente,
  type PerfilLaboral,
} from "@/lib/checklistDocumental";
import { enviarChecklistCliente } from "@/lib/checklistEnvio.functions";
import { generarSolicitudCambioPlazosDocx } from "@/lib/solicitudCambioPlazosDocx";
import { generarChecklistDocumentalDocx } from "@/lib/checklistDocumentalDocx";
import { listApoderados, seleccionarApoderado, type ApoderadoNuvex } from "@/lib/apoderados";


interface Props {
  expediente: ExpedienteMaestro;
  /** Expediente persistido (para leer apoderado guardado, plazos previos, etc.). */
  simExpediente?: Expediente | null;
}

type EstadoMap = Record<string, EstadoDoc>;

function estadoOf(rows: ChecklistRow[], docId: string): EstadoDoc {
  const r = rows.find((x) => x.documento_id === docId);
  return (r?.estado as EstadoDoc) ?? "pendiente";
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

export function ChecklistDocumental({ expediente, simExpediente }: Props) {
  const [perfil, setPerfil] = useState<PerfilLaboral>("empleado");
  const [flags, setFlags] = useState<FlagsCliente>(FLAGS_DEFAULT);
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [pending, setPending] = useState<EstadoMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [auditoria, setAuditoria] = useState<AuditoriaRow[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [validacion, setValidacion] = useState<ValidacionRow | null>(null);

  async function refresh() {
    if (!expediente.id) return;
    const [r, a, v] = await Promise.all([
      loadChecklistRows(expediente.id).catch(() => [] as ChecklistRow[]),
      loadAuditoriaRows(expediente.id).catch(() => [] as AuditoriaRow[]),
      loadValidacion(expediente.id).catch(() => null),
    ]);
    setRows(r);
    setAuditoria(a);
    setValidacion(v);
    setPending({});
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expediente.id]);

  const docs = useMemo(
    () => buildChecklist(expediente, perfil, flags),
    [expediente, perfil, flags],
  );

  const rowByDocId = useMemo(() => {
    const m = new Map<string, ChecklistRow>();
    for (const r of rows) m.set(r.documento_id, r);
    return m;
  }, [rows]);

  // Estado efectivo = pending si hay cambio local, si no el persistido
  function effectiveEstado(docId: string): EstadoDoc {
    if (pending[docId]) return pending[docId];
    return estadoOf(rows, docId);
  }

  const dirtyCount = Object.keys(pending).length;
  const isDirty = dirtyCount > 0;

  // Bloquear navegación si hay cambios sin guardar
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function changeEstado(doc: DocRequerido, estado: EstadoDoc) {
    setPending((prev) => {
      const next = { ...prev };
      const original = estadoOf(rows, doc.id);
      if (estado === original) {
        delete next[doc.id];
      } else {
        next[doc.id] = estado;
      }
      return next;
    });
  }

  function discardChanges() {
    if (!isDirty) return;
    if (!confirm(`Vas a descartar ${dirtyCount} cambio(s) sin guardar. ¿Continuar?`)) return;
    setPending({});
  }

  async function saveChanges() {
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const cambios: Array<{
        documento_id: string;
        documento_nombre: string;
        estado_anterior: EstadoDoc | null;
        estado_nuevo: EstadoDoc;
      }> = [];

      for (const [docId, nuevo] of Object.entries(pending)) {
        const doc = docs.find((d) => d.id === docId);
        if (!doc) continue;
        const prev = rowByDocId.get(docId);
        const prevEstado = (prev?.estado as EstadoDoc) ?? "pendiente";
        const now = new Date().toISOString();
        const patch: Partial<ChecklistRow> = {
          estado: nuevo,
          fecha_solicitado:
            nuevo === "solicitado" && !prev?.fecha_solicitado ? now : prev?.fecha_solicitado ?? null,
          fecha_recibido:
            nuevo === "recibido" && !prev?.fecha_recibido ? now : prev?.fecha_recibido ?? null,
          fecha_vencimiento:
            doc.vigenciaDias && (nuevo === "recibido" || nuevo === "aprobado")
              ? new Date(Date.now() + doc.vigenciaDias * 86400000).toISOString()
              : prev?.fecha_vencimiento ?? null,
          archivo_url: prev?.archivo_url ?? null,
          observaciones: prev?.observaciones ?? null,
          recibido_por: prev?.recibido_por ?? null,
        };
        await upsertChecklistRow(expediente.id, doc, patch);
        cambios.push({
          documento_id: doc.id,
          documento_nombre: doc.nombre,
          estado_anterior: prevEstado,
          estado_nuevo: nuevo,
        });
      }

      await insertAuditoriaRows(expediente.id, cambios);
      await refresh();
    } catch (e) {
      console.error("checklist save failed", e);
      alert("No se pudieron guardar los cambios: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Contador: documentos obligatorios completos (recibido / en_revision / aprobado / no_aplica)
  const obligatorios = docs.filter((d) => d.obligatorio);
  const completosObligatorios = obligatorios.filter((d) =>
    esDocumentoCompleto(effectiveEstado(d.id)),
  ).length;
  const totalObligatorios = obligatorios.length;
  const aprobadosObligatorios = obligatorios.filter(
    (d) => effectiveEstado(d.id) === "aprobado",
  ).length;
  const listoRadicacion =
    totalObligatorios > 0 && completosObligatorios === totalObligatorios && !isDirty;
  const puedeValidar = listoRadicacion && !validacion;

  async function handleValidar() {
    if (!puedeValidar) return;
    if (!confirm("¿Marcar la documentación como completa? Esto queda registrado en la auditoría.")) return;
    try {
      await upsertValidacion({
        expediente_id: expediente.id,
        total_obligatorios: totalObligatorios,
      });
      await refresh();
    } catch (e) {
      alert("No se pudo validar: " + (e as Error).message);
    }
  }

  const banco = bancoLabel(expediente.credito?.banco);

  // Documentos pendientes de solicitar (para correo)
  const docsParaSolicitar = docs.filter((d) => debeSolicitarse(effectiveEstado(d.id)));

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
        >
          <ClipboardList size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="text-[11px] uppercase tracking-wider font-semibold"
            style={{ color: NUVEX.azul }}
          >
            Documentos Requeridos
          </div>
          <h3 className="text-lg font-semibold text-[#242424]">
            Checklist Inteligente · {banco}
          </h3>
          <p className="text-xs text-[#242424]/60 mt-0.5">
            Generado automáticamente según el banco y el perfil laboral del cliente.
          </p>
        </div>
        {validacion ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ backgroundColor: NUVEX.verde }}
            title={`Validado por ${validacion.validada_por_nombre ?? "—"} el ${fmtDate(validacion.validada_at)}`}
          >
            <ShieldCheck size={13} /> Documentación validada
          </div>
        ) : listoRadicacion ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ backgroundColor: NUVEX.azul }}
          >
            <CheckCircle2 size={13} /> Lista para validar
          </div>
        ) : null}
      </div>

      {/* Banner cambios pendientes */}
      {isDirty && (
        <div
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2"
          style={{ borderColor: "#F3C892", backgroundColor: "#FFF8EC" }}
        >
          <div className="text-xs font-medium" style={{ color: "#8A5A00" }}>
            <AlertTriangle size={13} className="inline mr-1" />
            Tienes {dirtyCount} cambio(s) pendiente(s) por guardar.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={discardChanges}
              className="inline-flex items-center gap-1 rounded-md border border-[#E3E7EE] bg-white px-2.5 py-1 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
            >
              <Undo2 size={12} /> Descartar
            </button>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: NUVEX.verde }}
            >
              <Save size={12} /> {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </div>
      )}

      {/* Selector perfil + flags */}
      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60 mb-1">
            Perfil laboral
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(["empleado", "independiente", "ambos"] as PerfilLaboral[]).map((p) => (
              <button
                key={p}
                onClick={() => setPerfil(p)}
                className="px-2.5 py-1 rounded-md text-xs font-medium border"
                style={{
                  borderColor: perfil === p ? NUVEX.azul : "#E3E7EE",
                  backgroundColor: perfil === p ? NUVEX.azul : "#fff",
                  color: perfil === p ? "#fff" : "#242424",
                }}
              >
                {p === "ambos" ? "Empleado + Independiente" : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[#E3E7EE] bg-white p-3 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#242424]/60">
            Condiciones del cliente
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={flags.declaraRenta}
              onChange={(e) => setFlags((s) => ({ ...s, declaraRenta: e.target.checked }))}
            />
            ¿Cliente declara renta?
          </label>
          <label className="flex items-center gap-2 text-xs">
            <span>Frecuencia de pago:</span>
            <select
              value={flags.frecuenciaPago}
              onChange={(e) =>
                setFlags((s) => ({ ...s, frecuenciaPago: e.target.value as "mensual" | "quincenal" }))
              }
              className="rounded-md border border-[#E3E7EE] px-2 py-0.5 text-xs"
            >
              <option value="mensual">Mensual (3 desprendibles)</option>
              <option value="quincenal">Quincenal (6 desprendibles)</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={flags.recibePorBilleteras}
              onChange={(e) => setFlags((s) => ({ ...s, recibePorBilleteras: e.target.checked }))}
            />
            ¿Recibe ingresos por billeteras virtuales?
          </label>
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="space-y-2">
        {loading && <div className="text-xs text-[#242424]/60">Cargando…</div>}
        {!loading &&
          docs.map((d) => {
            const row = rowByDocId.get(d.id);
            const estado = effectiveEstado(d.id);
            const dirty = pending[d.id] !== undefined;
            const vencido = row?.fecha_vencimiento && new Date(row.fecha_vencimiento) < new Date();
            return (
              <div
                key={d.id}
                className="rounded-lg border bg-white px-3 py-2.5"
                style={{
                  borderColor: dirty ? "#F3C892" : vencido ? "#F3C892" : "#E3E7EE",
                  boxShadow: dirty ? "0 0 0 2px #FFEFD2 inset" : undefined,
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[#242424]">{d.nombre}</span>
                      {d.obligatorio ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF3F0] text-[#B42318]">
                          Obligatorio
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#F0F4FA] text-[#1E4E8C]">
                          Opcional
                        </span>
                      )}
                      {d.vigenciaDias && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF8EC] text-[#8A5A00] inline-flex items-center gap-1">
                          <AlertTriangle size={10} /> Vigencia {d.vigenciaDias} días
                        </span>
                      )}
                      {dirty && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FFF8EC] text-[#8A5A00]">
                          Cambio sin guardar
                        </span>
                      )}
                    </div>
                    {d.observacion && (
                      <div className="text-[11px] text-[#242424]/60 mt-0.5">{d.observacion}</div>
                    )}
                    {row?.fecha_recibido && (
                      <div className="text-[11px] text-[#242424]/70 mt-0.5">
                        <strong>Recibido:</strong> {fmtDate(row.fecha_recibido)}
                        {row.recibido_por && <> · por usuario {row.recibido_por.slice(0, 8)}…</>}
                      </div>
                    )}
                    {row?.fecha_solicitado && !row?.fecha_recibido && (
                      <div className="text-[11px] text-[#242424]/70 mt-0.5">
                        <strong>Solicitado:</strong> {fmtDate(row.fecha_solicitado)}
                      </div>
                    )}
                    {vencido && (
                      <div className="text-[11px] font-semibold text-[#B42318] mt-0.5">
                        Documento vencido — solicitar uno actualizado.
                      </div>
                    )}
                  </div>
                  <select
                    value={estado}
                    onChange={(e) => changeEstado(d, e.target.value as EstadoDoc)}
                    className="rounded-md border border-[#E3E7EE] px-2 py-1 text-xs font-semibold"
                    style={{ color: ESTADOS_COLOR[estado] }}
                  >
                    {(Object.keys(ESTADOS_LABEL) as EstadoDoc[]).map((s) => (
                      <option key={s} value={s}>
                        {ESTADOS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
      </div>

      {/* Acciones */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={saveChanges}
          disabled={!isDirty || saving}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: NUVEX.verde }}
        >
          <Save size={13} /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          onClick={() => {
            if (isDirty && !confirm("Tienes cambios sin guardar. ¿Recargar y descartarlos?")) return;
            setLoading(true);
            refresh();
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
        >
          <RefreshCw size={13} /> Recargar
        </button>
        <button
          onClick={() => downloadChecklistTxt(expediente, docs)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
        >
          <Download size={13} /> Descargar (.txt)
        </button>
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
        >
          <History size={13} /> {showAudit ? "Ocultar auditoría" : `Auditoría (${auditoria.length})`}
        </button>
        <button
          onClick={() => {
            if (isDirty) {
              alert("Guarda los cambios pendientes antes de enviar el correo.");
              return;
            }
            if (docsParaSolicitar.length === 0) {
              alert("No hay documentos pendientes por solicitar.");
              return;
            }
            setSendOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: NUVEX.azul }}
          title="Solo se enviarán al cliente los documentos que aún faltan por recibir o corregir."
        >
          <Mail size={13} /> Solicitar documentos pendientes ({docsParaSolicitar.length})
        </button>
        <button
          onClick={handleValidar}
          disabled={!puedeValidar}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: NUVEX.verde }}
          title={
            validacion
              ? "Documentación ya validada"
              : !listoRadicacion
              ? "Existen documentos obligatorios pendientes."
              : "Marcar documentación como completa"
          }
        >
          <ShieldCheck size={13} /> Validar documentación completa
        </button>
        <div className="ml-auto text-[11px] text-[#242424]/60 text-right">
          <div>
            <strong className="text-[#242424]">
              {completosObligatorios}/{totalObligatorios}
            </strong>{" "}
            obligatorios completos
          </div>
          <div>{aprobadosObligatorios} aprobado(s) · {docsParaSolicitar.length} por solicitar</div>
        </div>
      </div>

      <p className="mt-2 text-[11px] text-[#242424]/55">
        Solo se enviarán al cliente los documentos que aún faltan por recibir o corregir.
      </p>

      {/* Panel de auditoría */}
      {showAudit && (
        <div className="mt-4 rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70 mb-2">
            Historial de cambios documentales
          </div>
          {auditoria.length === 0 ? (
            <div className="text-xs text-[#242424]/60">Aún no hay cambios registrados.</div>
          ) : (
            <ul className="space-y-1.5 max-h-72 overflow-y-auto">
              {auditoria.map((a) => (
                <li
                  key={a.id}
                  className="text-xs text-[#242424] bg-white rounded-md border border-[#E3E7EE] px-2.5 py-1.5"
                >
                  <div className="font-medium">{a.documento_nombre}</div>
                  <div className="text-[#242424]/70">
                    {a.estado_anterior ? ESTADOS_LABEL[a.estado_anterior as EstadoDoc] : "—"} →{" "}
                    <strong>{ESTADOS_LABEL[a.estado_nuevo as EstadoDoc]}</strong>
                  </div>
                  <div className="text-[10px] text-[#242424]/55">
                    {a.usuario_nombre ?? "Usuario"} · {fmtDate(a.created_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sendOpen && (
        <SendChecklistModal
          expediente={expediente}
          simExpediente={simExpediente ?? null}
          docs={docsParaSolicitar}
          docsConEstado={docs.map((d) => ({ ...d, estado: effectiveEstado(d.id) }))}
          onClose={() => setSendOpen(false)}
          onSent={() => refresh()}
        />
      )}
    </Card>
  );
}


// ─── Modal de envío al cliente (Resend + adjuntos + trazabilidad) ──────────

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

function SendChecklistModal({
  expediente,
  simExpediente,
  docs,
  docsConEstado,
  onClose,
  onSent,
}: {
  expediente: ExpedienteMaestro;
  simExpediente: Expediente | null;
  docs: DocRequerido[];
  docsConEstado: Array<DocRequerido & { estado: EstadoDoc }>;
  onClose: () => void;
  onSent: () => void;
}) {
  const send = useServerFn(enviarChecklistCliente);
  // Sólo solicitamos al cliente los documentos que aún están pendientes;
  // los que ya fueron recibidos/validados/no aplican no deben aparecer en el correo.
  const docsPendientes = useMemo(
    () => docsConEstado.filter((d) => d.estado !== "recibido" && d.estado !== "en_revision" && d.estado !== "aprobado" && d.estado !== "no_aplica"),
    [docsConEstado],
  );
  const defaults = useMemo(() => buildEmailDefaults(expediente, docsPendientes), [expediente, docsPendientes]);

  // Destinatarios editables
  const [destinatarios, setDestinatarios] = useState<string[]>(() =>
    expediente.cliente?.email ? [expediente.cliente.email] : [],
  );
  const [newEmail, setNewEmail] = useState("");
  const [cc, setCc] = useState(expediente.asesor?.email ?? expediente.licenciado?.email ?? "");
  const [asunto, setAsunto] = useState(defaults.asunto);
  const [cuerpo, setCuerpo] = useState(defaults.cuerpo);

  // Default de "Cuotas a eliminar" derivado del caso:
  // plazoOriginal − nuevoPlazo (propuesta_data). Editable por el usuario.
  const cuotasDefault = useMemo(() => {
    const plazoOrigStr = (expediente.credito?.plazoOriginal || "").trim();
    const plazoOrig = parseInt(plazoOrigStr.replace(/[^\d]/g, ""), 10);
    const propuesta = (simExpediente?.propuesta_data ?? {}) as Partial<PropuestaData>;
    const nuevoPlazo = Number(propuesta.nuevoPlazo ?? 0);
    if (!Number.isFinite(plazoOrig) || !Number.isFinite(nuevoPlazo) || nuevoPlazo <= 0) return "";
    const diff = plazoOrig - nuevoPlazo;
    return diff > 0 ? String(diff) : "";
  }, [expediente.credito?.plazoOriginal, simExpediente]);

  // Solicitud Cambio de Plazos (campos opcionales editables)
  const [cuotasAEliminar, setCuotasAEliminar] = useState(cuotasDefault);
  useEffect(() => {
    // Si el usuario aún no escribió nada y aparece un default tardío, aplicarlo.
    setCuotasAEliminar((prev) => (prev ? prev : cuotasDefault));
  }, [cuotasDefault]);
  const [adjuntarSolicitud, setAdjuntarSolicitud] = useState(true);
  const [adjuntarChecklist, setAdjuntarChecklist] = useState(true);

  // Apoderado NUVEX: usa el guardado para el caso si existe (selección manual
  // del editor jurídico). Si no, cae al sugerido por banco.
  const [apoderados, setApoderados] = useState<ApoderadoNuvex[]>([]);
  useEffect(() => {
    listApoderados(true).then(setApoderados).catch(() => setApoderados([]));
  }, []);
  const apoderadoGuardadoId = useMemo(
    () => readApoderadoNuvexIdExpediente(
      (simExpediente as unknown as { cliente_data?: unknown } | null)?.cliente_data,
    ),
    [simExpediente],
  );
  const apoderadoSugerido = useMemo(() => {
    if (apoderadoGuardadoId) {
      const manual = apoderados.find((a) => a.id === apoderadoGuardadoId);
      if (manual) return manual;
    }
    return seleccionarApoderado(expediente.credito?.banco ?? "", apoderados).apoderado;
  }, [apoderadoGuardadoId, expediente.credito?.banco, apoderados]);
  const apoderadoEsManual = !!apoderadoGuardadoId &&
    !!apoderados.find((a) => a.id === apoderadoGuardadoId);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const addEmail = () => {
    const v = newEmail.trim().toLowerCase();
    if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Correo no válido");
      return;
    }
    if (destinatarios.includes(v)) return;
    setError(null);
    setDestinatarios((d) => [...d, v]);
    setNewEmail("");
  };

  const removeEmail = (e: string) =>
    setDestinatarios((d) => d.filter((x) => x !== e));

  async function handleSend() {
    setError(null);
    if (destinatarios.length === 0) {
      setError("Agrega al menos un destinatario.");
      return;
    }
    if (!asunto.trim() || !cuerpo.trim()) {
      setError("Asunto y cuerpo son obligatorios.");
      return;
    }
    setSending(true);
    try {
      // Generar adjuntos
      const attachments: Array<{ filename: string; contentBase64: string; contentType: string }> = [];

      if (adjuntarSolicitud) {
        const docxBlob = await generarSolicitudCambioPlazosDocx(expediente, {
          cuotasAEliminar,
          apoderado: apoderadoSugerido
            ? { nombre: apoderadoSugerido.nombre, cedula: apoderadoSugerido.cedula }
            : null,
        });
        attachments.push({
          filename: `NUVEX_Solicitud_Cambio_Plazos_${(expediente.cliente?.nombre || "cliente").replace(/\s+/g, "_")}.docx`,
          contentBase64: await blobToBase64(docxBlob),
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }

      if (adjuntarChecklist) {
        const chkBlob = await generarChecklistDocumentalDocx(expediente, docsConEstado);
        attachments.push({
          filename: `NUVEX_Checklist_Documental_${(expediente.cliente?.nombre || "cliente").replace(/\s+/g, "_")}.docx`,
          contentBase64: await blobToBase64(chkBlob),
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
      }

      const ccArr = cc.trim() ? [cc.trim()] : [];

      await send({
        data: {
          expedienteId: expediente.id,
          destinatarios,
          cc: ccArr,
          asunto: asunto.trim(),
          cuerpo,
          attachments,
          documentosSolicitados: docs.map((d) => ({
            documento_id: d.id,
            documento_nombre: d.nombre,
          })),
        },
      });
      setDone(true);
      setTimeout(() => {
        onSent();
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "No se pudo enviar el correo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="flex items-center gap-2">
            <Mail size={16} style={{ color: NUVEX.azul }} />
            <div>
              <div className="font-semibold text-[#242424]">Solicitar documentos al cliente</div>
              <div className="text-[11px] text-[#242424]/60">
                {docs.length} documento(s) pendiente(s) · envío vía NUVEX (Resend)
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-[#242424]/60 hover:text-[#242424]"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Destinatarios */}
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70 mb-1">
              Destinatarios (Para)
            </div>
            <div className="space-y-1">
              {destinatarios.map((e) => (
                <div key={e} className="flex items-center gap-2 rounded-lg border border-[#E3E7EE] bg-white p-2 text-sm">
                  <Mail size={13} className="text-[#445DA3]" />
                  <span className="flex-1 text-[#242424]">{e}</span>
                  <button onClick={() => removeEmail(e)} className="text-[#B42318] hover:bg-[#FDECEC] rounded p-1" title="Quitar">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {destinatarios.length === 0 && (
                <div className="text-xs text-[#242424]/60 italic">Sin destinatarios. Agrega al menos uno.</div>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                placeholder="cliente@correo.com"
                className="flex-1 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-sm"
              />
              <button onClick={addEmail} className="inline-flex items-center gap-1 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F7F9FB]">
                <Plus size={13} /> Agregar
              </button>
            </div>
          </div>

          {/* CC */}
          <Field
            label="CC (Analista Financiero / Comercial)"
            value={cc}
            onChange={setCc}
            type="email"
            placeholder="analista@nuvex.com.co"
          />

          {/* Asunto */}
          <Field label="Asunto" value={asunto} onChange={setAsunto} />

          {/* Cuerpo */}
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">
              Cuerpo
            </span>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm leading-relaxed font-mono"
            />
          </label>

          {/* Solicitud Cambio de Plazos */}
          <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#242424] mb-2">
              <input
                type="checkbox"
                checked={adjuntarSolicitud}
                onChange={(e) => setAdjuntarSolicitud(e.target.checked)}
              />
              <Paperclip size={13} /> Adjuntar Solicitud Cambio de Plazos (Word)
            </label>
            {adjuntarSolicitud && (
              <div className="grid gap-2 md:grid-cols-2">
                <Field
                  label="Cuotas a eliminar"
                  value={cuotasAEliminar}
                  onChange={setCuotasAEliminar}
                  placeholder="Ej. 60"
                />
                <div className="rounded-md border border-[#E3E7EE] bg-white px-3 py-2 text-xs">
                  <div className="font-semibold uppercase tracking-wider text-[#242424]/70">
                    Apoderado NUVEX {apoderadoEsManual
                      ? "(selección manual del caso)"
                      : `(sugerido para ${expediente.credito?.banco || "este banco"})`}
                  </div>
                  <div className="mt-1 text-sm text-[#242424]">
                    {apoderadoSugerido
                      ? `${apoderadoSugerido.nombre} · C.C. ${apoderadoSugerido.cedula}`
                      : "Sin apoderado asignado para este banco."}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Checklist Documental (Word) */}
          <div className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#242424]">
              <input
                type="checkbox"
                checked={adjuntarChecklist}
                onChange={(e) => setAdjuntarChecklist(e.target.checked)}
              />
              <Paperclip size={13} /> Adjuntar Checklist Documental (Word)
              <span className="ml-1 text-[10px] font-normal text-[#242424]/60">
                · {docsConEstado.length} documento(s) con estado actual
              </span>
            </label>
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
              <CheckCircle2 size={13} /> Correo enviado correctamente. Los documentos pasan a "Solicitado".
            </div>
          )}
        </div>

        <div className="border-t border-[#E3E7EE] px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]">
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || destinatarios.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: NUVEX.azul }}
          >
            {sending ? <><Loader2 size={13} className="animate-spin" /> Enviando…</> : <><Mail size={13} /> Enviar ahora</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
      />
    </label>
  );
}

function downloadChecklistTxt(exp: ExpedienteMaestro, docs: DocRequerido[]) {
  const banco = exp.credito?.banco || "—";
  const cliente = exp.cliente?.nombre || "—";
  const lines = [
    "NUVEX — DOCUMENTOS REQUERIDOS",
    `Cliente: ${cliente}`,
    `Banco: ${banco}`,
    `Fecha: ${new Date().toLocaleDateString("es-CO")}`,
    "",
    ...docs.map(
      (d, i) =>
        `${i + 1}. ${d.nombre}${d.obligatorio ? " (obligatorio)" : " (opcional)"}${
          d.observacion ? ` — ${d.observacion}` : ""
        }`,
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NUVEX_documentos_${cliente.replace(/\s+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

