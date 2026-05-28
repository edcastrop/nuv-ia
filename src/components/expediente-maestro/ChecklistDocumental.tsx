import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { ClipboardList, Mail, RefreshCw, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import {
  buildChecklist,
  bancoLabel,
  ESTADOS_LABEL,
  ESTADOS_COLOR,
  FLAGS_DEFAULT,
  loadChecklistRows,
  upsertChecklistRow,
  registrarEnvioChecklist,
  buildEmailDefaults,
  buildMailto,
  type ChecklistRow,
  type DocRequerido,
  type EstadoDoc,
  type FlagsCliente,
  type PerfilLaboral,
} from "@/lib/checklistDocumental";

interface Props {
  expediente: ExpedienteMaestro;
}

export function ChecklistDocumental({ expediente }: Props) {
  const [perfil, setPerfil] = useState<PerfilLaboral>("empleado");
  const [flags, setFlags] = useState<FlagsCliente>(FLAGS_DEFAULT);
  const [rows, setRows] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    if (!expediente.id) return;
    loadChecklistRows(expediente.id)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
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

  async function setEstado(doc: DocRequerido, estado: EstadoDoc) {
    const prev = rowByDocId.get(doc.id);
    const now = new Date().toISOString();
    const patch: Partial<ChecklistRow> = {
      estado,
      fecha_solicitado: estado === "solicitado" && !prev?.fecha_solicitado ? now : prev?.fecha_solicitado,
      fecha_recibido: estado === "recibido" && !prev?.fecha_recibido ? now : prev?.fecha_recibido,
      fecha_vencimiento: doc.vigenciaDias && (estado === "recibido" || estado === "aprobado")
        ? new Date(Date.now() + doc.vigenciaDias * 86400000).toISOString()
        : prev?.fecha_vencimiento ?? null,
      archivo_url: prev?.archivo_url ?? null,
      observaciones: prev?.observaciones ?? null,
    };
    try {
      await upsertChecklistRow(expediente.id, doc, patch);
      const next = await loadChecklistRows(expediente.id);
      setRows(next);
    } catch (e) {
      console.error("checklist upsert failed", e);
      alert("No se pudo actualizar el documento.");
    }
  }

  const totalObligatorios = docs.filter((d) => d.obligatorio).length;
  const aprobadosObligatorios = docs.filter(
    (d) => d.obligatorio && rowByDocId.get(d.id)?.estado === "aprobado",
  ).length;
  const listoRadicacion = totalObligatorios > 0 && aprobadosObligatorios === totalObligatorios;

  const banco = bancoLabel(expediente.credito?.banco);

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
        {listoRadicacion && (
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
            style={{ backgroundColor: NUVEX.verde }}
          >
            <CheckCircle2 size={13} /> Listo para radicación
          </div>
        )}
      </div>

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
              onChange={(e) => setFlags((s) => ({ ...s, frecuenciaPago: e.target.value as "mensual" | "quincenal" }))}
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
        {!loading && docs.map((d) => {
          const row = rowByDocId.get(d.id);
          const estado: EstadoDoc = row?.estado ?? "pendiente";
          const vencido = row?.fecha_vencimiento && new Date(row.fecha_vencimiento) < new Date();
          return (
            <div
              key={d.id}
              className="rounded-lg border bg-white px-3 py-2.5"
              style={{ borderColor: vencido ? "#F3C892" : "#E3E7EE" }}
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
                  </div>
                  {d.observacion && (
                    <div className="text-[11px] text-[#242424]/60 mt-0.5">{d.observacion}</div>
                  )}
                  {vencido && (
                    <div className="text-[11px] font-semibold text-[#B42318] mt-0.5">
                      Documento vencido — solicitar uno actualizado.
                    </div>
                  )}
                </div>
                <select
                  value={estado}
                  onChange={(e) => setEstado(d, e.target.value as EstadoDoc)}
                  className="rounded-md border border-[#E3E7EE] px-2 py-1 text-xs font-semibold"
                  style={{ color: ESTADOS_COLOR[estado] }}
                >
                  {(Object.keys(ESTADOS_LABEL) as EstadoDoc[]).map((s) => (
                    <option key={s} value={s}>{ESTADOS_LABEL[s]}</option>
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
          onClick={() => {
            setRows([]);
            loadChecklistRows(expediente.id).then(setRows);
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
          onClick={() => setSendOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: NUVEX.azul }}
        >
          <Mail size={13} /> Enviar checklist al cliente
        </button>
        <div className="ml-auto text-[11px] text-[#242424]/60">
          {aprobadosObligatorios}/{totalObligatorios} documentos obligatorios aprobados
        </div>
      </div>

      {sendOpen && (
        <SendChecklistModal
          expediente={expediente}
          docs={docs}
          onClose={() => setSendOpen(false)}
        />
      )}
    </Card>
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
    ...docs.map((d, i) => `${i + 1}. ${d.nombre}${d.obligatorio ? " (obligatorio)" : " (opcional)"}${d.observacion ? ` — ${d.observacion}` : ""}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NUVEX_documentos_${cliente.replace(/\s+/g, "_")}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function SendChecklistModal({
  expediente, docs, onClose,
}: {
  expediente: ExpedienteMaestro;
  docs: DocRequerido[];
  onClose: () => void;
}) {
  const defaults = useMemo(() => buildEmailDefaults(expediente, docs), [expediente, docs]);
  const [to, setTo] = useState(expediente.cliente?.email ?? "");
  const [cc, setCc] = useState(expediente.licenciado?.email ?? "");
  const [asunto, setAsunto] = useState(defaults.asunto);
  const [cuerpo, setCuerpo] = useState(defaults.cuerpo);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!to.trim()) {
      alert("Falta el correo del cliente.");
      return;
    }
    setSending(true);
    try {
      await registrarEnvioChecklist({
        expediente_id: expediente.id,
        enviado_a_email: to.trim(),
        cc_licenciado_email: cc.trim() || undefined,
        asunto,
        cuerpo,
      });
      window.location.href = buildMailto({ to: to.trim(), cc: cc.trim() || undefined, asunto, cuerpo });
      onClose();
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar el envío.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="font-semibold text-[#242424]">Enviar checklist al cliente</div>
          <button onClick={onClose} className="text-sm text-[#242424]/60 hover:text-[#242424]">Cerrar</button>
        </div>
        <div className="overflow-y-auto p-5 space-y-3">
          <Field label="Para" value={to} onChange={setTo} type="email" />
          <Field label="CC (licenciado)" value={cc} onChange={setCc} type="email" />
          <Field label="Asunto" value={asunto} onChange={setAsunto} />
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">Cuerpo</span>
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              rows={14}
              className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm leading-relaxed font-mono"
            />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E3E7EE]">
          <button onClick={onClose} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium">Cancelar</button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: NUVEX.azul }}
          >
            <Mail size={13} /> {sending ? "Enviando…" : "Abrir cliente de correo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm"
      />
    </label>
  );
}
