// Bloque de Validación de Identidad mostrado en el expediente.
// - Licenciado: ve resumen, posibles inconsistencias, confirma y envía.
// - Contratación/Jurídica: aprueba, devuelve o bloquea.
// - Super Admin: puede desbloquear excepcionalmente.

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, CheckCircle2, Send, RotateCcw, Lock, Unlock, History, Save, X } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import type { Expediente } from "@/lib/expedientes";
import { CitySelect } from "@/components/ui/CitySelect";
import {
  readValidacion,
  detectarInconsistencias,
  extraerCamposCriticosDesdeExpediente,
  confirmarChecklistLicenciado,
  enviarAValidacion,
  aprobarValidacion,
  devolverValidacion,
  bloquearInconsistencia,
  desbloquearExcepcional,
  listHistorialValidacion,
  actualizarCamposCriticos,
  VALIDACION_LABELS,
  VALIDACION_COLORS,
  MOTIVOS_DEVOLUCION,
  type HistorialItem,
  type CamposCriticos,
} from "@/lib/validacionIdentidad";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  exp: Expediente;
  onChanged?: () => void;
}

export function ValidacionIdentidadBlock({ exp, onChanged }: Props) {
  const { roles, isSuperAdmin } = useUserRole();
  const v = readValidacion(exp as never);
  const campos = useMemo(() => extraerCamposCriticosDesdeExpediente(exp), [exp]);
  const inconsistencias = useMemo(() => detectarInconsistencias(campos), [campos]);
  const altas = inconsistencias.filter((i) => i.severidad === "alta");

  const esContratacion = roles.some((r) =>
    ["juridica", "director_juridico", "operaciones", "admin", "gerencia", "super_admin"].includes(r),
  );
  const esLicenciado =
    roles.includes("licenciado") ||
    roles.includes("asesor") ||
    roles.includes("auxiliar_operativo") ||
    isSuperAdmin ||
    !!exp.asesor_id;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [showHist, setShowHist] = useState(false);
  const [motivoDev, setMotivoDev] = useState<string>(MOTIVOS_DEVOLUCION[0]);
  const [motivoOtro, setMotivoOtro] = useState("");
  const [motivoBloqueo, setMotivoBloqueo] = useState("");
  const [motivoDesb, setMotivoDesb] = useState("");

  // Edición directa de campos críticos (sin modo toggle)
  const [draft, setDraft] = useState<CamposCriticos>(campos);
  useEffect(() => { setDraft(campos); }, [campos]);
  const hayCambios = useMemo(() => {
    return (Object.keys(draft) as (keyof CamposCriticos)[]).some(
      (k) => (draft[k] ?? "") !== (campos[k] ?? ""),
    );
  }, [draft, campos]);

  const puedeEditar =
    (esLicenciado || esContratacion) &&
    (v.validacion_estado === "pendiente_validacion" ||
      v.validacion_estado === "devuelto_datos_incorrectos" ||
      (isSuperAdmin && v.validacion_estado === "bloqueado_inconsistencia"));

  useEffect(() => {
    if (showHist) listHistorialValidacion(exp.id).then(setHistorial).catch(() => {});
  }, [showHist, exp.id]);

  const c = VALIDACION_COLORS[v.validacion_estado];
  const puedeEnviar =
    v.validacion_confirmado_licenciado &&
    altas.length === 0 &&
    (v.validacion_estado === "pendiente_validacion" ||
      v.validacion_estado === "devuelto_datos_incorrectos");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.negro})` }}
          >
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              Validación de identidad
            </div>
            <h3 className="text-lg font-semibold text-[#242424]">Control contractual NUVEX</h3>
            <p className="text-xs text-[#242424]/60 mt-0.5">
              Contratación debe aprobar los datos antes de generar cualquier documento jurídico.
            </p>
          </div>
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
          style={{ background: c.bg, color: c.fg, borderColor: c.border }}
        >
          {VALIDACION_LABELS[v.validacion_estado]} · v{v.validacion_version}
        </div>
      </div>

      {v.validacion_estado === "devuelto_datos_incorrectos" && v.validacion_motivo_devolucion && (
        <div className="mb-3 rounded-lg border p-3 text-xs" style={{ borderColor: c.border, background: c.bg, color: c.fg }}>
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Motivo de devolución
          </div>
          {v.validacion_motivo_devolucion}
        </div>
      )}
      {v.validacion_estado === "bloqueado_inconsistencia" && (
        <div className="mb-3 rounded-lg border p-3 text-xs" style={{ borderColor: c.border, background: c.bg, color: c.fg }}>
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <Lock size={13} /> Expediente bloqueado
          </div>
          {v.validacion_motivo_devolucion || "Sin motivo registrado."}
        </div>
      )}

      {/* Edición directa de campos críticos */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/60">
          Datos críticos del cliente {puedeEditar && <span className="ml-1 normal-case font-normal text-[#242424]/50">— edita directamente y pulsa Guardar</span>}
        </div>
        {puedeEditar && (
          <div className="flex gap-1.5">
            {hayCambios && (
              <button
                onClick={() => setDraft(campos)}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-[#242424] hover:bg-[#F7F9FB]"
                style={{ borderColor: "#E3E7EE" }}
              >
                <X size={12} /> Descartar
              </button>
            )}
            <button
              onClick={() => run(async () => { await actualizarCamposCriticos(exp.id, draft); })}
              disabled={busy || !hayCambios}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: NUVEX.azul }}
            >
              <Save size={12} /> Guardar cambios
            </button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs mb-4">
        <EditField label="Nombre" value={draft.nombre} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, nombre: val })} className="md:col-span-2" />
        <EditField label="Tipo doc." value={draft.tipoDocumento || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, tipoDocumento: val })} />
        <EditField label="Documento" value={draft.cedula} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, cedula: val.replace(/\D/g, "") })} />
        <EditField label="Lugar expedición" value={draft.lugarExpedicion || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, lugarExpedicion: val })} kind="city" />
        <EditField label="Banco" value={draft.banco} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, banco: val })} />
        <EditField label="N° crédito" value={draft.numeroCredito} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, numeroCredito: val })} />
        <EditField label="Producto" value={draft.tipoProducto || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, tipoProducto: val })} />
        <EditField label="Ciudad" value={draft.ciudad || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, ciudad: val })} kind="city" />
        <EditField label="Dirección" value={draft.direccion || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, direccion: val })} className="md:col-span-2" />
        <EditField label="Email" value={draft.email || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, email: val })} />
        <EditField label="Celular" value={draft.celular || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, celular: val })} />
        {(draft.cotitularActivo || campos.cotitularActivo) && (
          <>
            <EditField label="Cotitular" value={draft.cotitularNombre || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, cotitularNombre: val })} />
            <EditField label="Doc. cotitular" value={draft.cotitularCedula || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, cotitularCedula: val.replace(/\D/g, "") })} />
            <EditField label="Dir. cotitular" value={draft.cotitularDireccion || ""} editing={puedeEditar} onChange={(val) => setDraft({ ...draft, cotitularDireccion: val })} />
          </>
        )}
      </div>



      {/* Inconsistencias */}
      {inconsistencias.length > 0 && (
        <div className="mb-4 rounded-lg border p-3 text-xs"
          style={{ borderColor: "#FAD491", background: "#FFF7E6", color: "#8A5A00" }}>
          <div className="font-semibold mb-1 flex items-center gap-1.5">
            <AlertTriangle size={13} /> Posibles inconsistencias detectadas
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {inconsistencias.map((i, idx) => (
              <li key={idx}>
                <strong className="uppercase text-[10px] mr-1">[{i.severidad}]</strong>
                {i.mensaje}
              </li>
            ))}
          </ul>
          {altas.length > 0 && (
            <div className="mt-2 text-[11px] font-semibold">
              Corrige las marcadas como [alta] antes de enviar a Contratación.
            </div>
          )}
        </div>
      )}

      {/* Acciones del licenciado */}
      {esLicenciado && (v.validacion_estado === "pendiente_validacion" || v.validacion_estado === "devuelto_datos_incorrectos") && (
        <div className="rounded-lg border bg-[#F7F9FB] p-3 mb-3" style={{ borderColor: "#E3E7EE" }}>
          <label className="flex items-start gap-2 text-xs text-[#242424]">
            <input
              type="checkbox"
              checked={v.validacion_confirmado_licenciado}
              disabled={busy}
              onChange={(e) => run(() => confirmarChecklistLicenciado(exp.id, e.target.checked))}
              className="mt-0.5"
            />
            <span>
              Confirmo que revisé los datos críticos del cliente y que están digitados exactamente como aparecen en la cédula, extracto y documentos soporte.
            </span>
          </label>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => run(() => enviarAValidacion(exp.id))}
              disabled={!puedeEnviar || busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: NUVEX.azul }}
            >
              <Send size={13} /> Enviar a validación de Contratación
            </button>
          </div>
        </div>
      )}

      {/* Acciones de contratación */}
      {esContratacion && v.validacion_estado === "en_revision_contratacion" && (
        <div className="rounded-lg border bg-[#F7F9FB] p-3 mb-3 space-y-3" style={{ borderColor: "#E3E7EE" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">
            Revisión de Contratación
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(() => aprobarValidacion(exp.id))}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: "#1F6F4A" }}
            >
              <CheckCircle2 size={13} /> Aprobar datos
            </button>
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-[#242424]/60 mb-1">
                Motivo de devolución
              </label>
              <select
                value={motivoDev}
                onChange={(e) => setMotivoDev(e.target.value)}
                className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs"
              >
                {MOTIVOS_DEVOLUCION.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {motivoDev === "Otro" && (
                <input
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                  placeholder="Describe el motivo…"
                  className="mt-1 w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs"
                />
              )}
            </div>
            <button
              onClick={() => {
                const m = motivoDev === "Otro" ? motivoOtro : motivoDev;
                run(() => devolverValidacion(exp.id, m));
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
              style={{ backgroundColor: NUVEX.rojoTexto }}
            >
              <RotateCcw size={13} /> Devolver
            </button>
          </div>

          <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label className="block text-[10px] uppercase font-semibold text-[#242424]/60 mb-1">
                Inconsistencia crítica (bloqueo)
              </label>
              <input
                value={motivoBloqueo}
                onChange={(e) => setMotivoBloqueo(e.target.value)}
                placeholder="Describe la inconsistencia crítica…"
                className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs"
              />
            </div>
            <button
              onClick={() => run(() => bloquearInconsistencia(exp.id, motivoBloqueo))}
              disabled={busy || motivoBloqueo.trim().length < 4}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "#7A0E0E" }}
            >
              <Lock size={13} /> Bloquear
            </button>
          </div>
        </div>
      )}

      {/* Desbloqueo super admin */}
      {isSuperAdmin && v.validacion_estado === "bloqueado_inconsistencia" && (
        <div className="rounded-lg border bg-[#F7F9FB] p-3 mb-3 grid md:grid-cols-[1fr_auto] gap-2 items-end" style={{ borderColor: "#E3E7EE" }}>
          <input
            value={motivoDesb}
            onChange={(e) => setMotivoDesb(e.target.value)}
            placeholder="Motivo del desbloqueo excepcional…"
            className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-xs"
          />
          <button
            onClick={() => run(() => desbloquearExcepcional(exp.id, motivoDesb))}
            disabled={busy || motivoDesb.trim().length < 6}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: NUVEX.azul }}
          >
            <Unlock size={13} /> Desbloquear
          </button>
        </div>
      )}

      {error && (
        <div className="mb-3 rounded-lg border p-2 text-xs"
          style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg, color: NUVEX.rojoTexto }}>
          {error}
        </div>
      )}

      <button
        onClick={() => setShowHist((s) => !s)}
        className="inline-flex items-center gap-1.5 text-[11px] text-[#445DA3] hover:underline"
      >
        <History size={12} /> {showHist ? "Ocultar" : "Ver"} historial de validación
      </button>
      {showHist && (
        <div className="mt-2 rounded-lg border p-2 text-xs space-y-1" style={{ borderColor: "#E3E7EE" }}>
          {historial.length === 0 && <div className="text-[#242424]/60">Sin movimientos.</div>}
          {historial.map((h) => (
            <div key={h.id} className="flex flex-wrap gap-2 border-b border-dashed border-[#E3E7EE] pb-1 last:border-0">
              <span className="font-semibold uppercase text-[10px]" style={{ color: NUVEX.azul }}>{h.accion}</span>
              <span className="text-[#242424]/80 flex-1">{h.motivo || "—"}</span>
              <span className="text-[#242424]/50">{new Date(h.created_at).toLocaleString("es-CO")}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function EditField({
  label,
  value,
  editing,
  onChange,
  className,
  kind = "text",
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (val: string) => void;
  className?: string;
  kind?: "text" | "city";
}) {
  return (
    <div className={`rounded-lg border bg-white px-2 py-1.5 ${className || ""}`} style={{ borderColor: editing ? "#B6CEFF" : "#E3E7EE" }}>
      <div className="text-[10px] uppercase font-semibold text-[#242424]/60">{label}</div>
      {editing ? (
        kind === "city" ? (
          <div className="-mx-1">
            <CitySelect value={value || ""} onChange={onChange} placeholder="Selecciona municipio…" />
          </div>
        ) : (
          <input
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-[12px] text-[#242424] outline-none focus:ring-0 border-0 p-0"
          />
        )
      ) : (
        <div className="text-[12px] text-[#242424] truncate" title={value}>{value || "—"}</div>
      )}
    </div>
  );
}

