import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { FileText, Download, Eye, Receipt, BadgeCheck, Info, CheckCircle2, AlertTriangle, RefreshCw, Save, Scale } from "lucide-react";
import type { ExpedienteMaestro, ClienteMaestro, CotitularMaestro } from "@/lib/expedienteMaestro";
import { saveInformacionJuridicaExpediente } from "@/lib/expedienteMaestro";
import type { Expediente, PropuestaData } from "@/lib/expedientes";
import {
  buildDatosContrato, buildPoderesForExpediente, detectPoderTemplate,
  type LegalDoc, type ApoderadoSeleccionado, type AcuerdoComercial, type ModalidadPago,
  type PoderTemplateId,
} from "@/lib/legalDocs";
import { PODER_TEMPLATES } from "@/lib/poderTemplates";
import { exportLegalDocPDF, exportLegalDocDOCX } from "@/lib/legalDocsExport";
import { listApoderados, type ApoderadoNuvex } from "@/lib/apoderados";

const fmtCOP = (n: number) =>
  !isFinite(n) || n === 0
    ? "—"
    : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

interface Props {
  expediente: ExpedienteMaestro;
  liveOverride?: Partial<ExpedienteMaestro>;
  /** Expediente del simulador (opcional) para alimentar Datos para Contrato. */
  simExpediente?: Expediente | null;
  /** Si se entrega, habilita persistir Información Jurídica en cliente_data. */
  expedienteIdToPersist?: string;
  /** Notifica al padre cuando se persiste, para que recargue el expediente. */
  onJuridicaSaved?: () => void;
}

export function DocumentosLegales({ expediente, liveOverride, simExpediente, expedienteIdToPersist, onJuridicaSaved }: Props) {
  const [preview, setPreview] = useState<LegalDoc | null>(null);
  const [apoderados, setApoderados] = useState<ApoderadoNuvex[]>([]);
  const [selectedApId, setSelectedApId] = useState<string>("");

  // ── Información Jurídica editable (fuente oficial para el Poder Especial)
  const [ijTitular, setIjTitular] = useState<Partial<ClienteMaestro>>({});
  const [ijCotitular, setIjCotitular] = useState<Partial<CotitularMaestro> & { activo?: boolean }>({});
  const [savingIJ, setSavingIJ] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [syncFlash, setSyncFlash] = useState(false);

  // Fuente "Datos del Caso" (cliente_data crudo, sin Información Jurídica).
  // Si no llega `simExpediente`, caemos a expediente.cliente como mejor esfuerzo.
  const caseSource = useMemo<Partial<ClienteMaestro>>(() => {
    const cd = (simExpediente?.cliente_data ?? {}) as Record<string, unknown>;
    const pick = (k: string) => (typeof cd[k] === "string" ? (cd[k] as string) : "");
    return {
      tipoDocumento: pick("tipoDocumento") || "CC",
      cedula: pick("cedula") || expediente.cliente?.cedula || "",
      ciudad: pick("ciudad") || expediente.cliente?.ciudad || "",
      email: pick("email") || pick("correo") || expediente.cliente?.email || "",
      telefono: pick("telefono") || pick("celular") || expediente.cliente?.telefono || "",
      direccion: pick("direccion") || expediente.cliente?.direccion || "",
    };
  }, [simExpediente, expediente]);

  // Autocompletado al abrir: rellena SOLO campos vacíos de la Información Jurídica
  // con los datos disponibles del caso. No sobrescribe valores diligenciados.
  useEffect(() => {
    const t = (expediente.cliente ?? {}) as Partial<ClienteMaestro>;
    setIjTitular({
      tipoDocumento: t.tipoDocumento || caseSource.tipoDocumento || "CC",
      cedula: t.cedula || caseSource.cedula || "",
      expedidaEn: t.expedidaEn || "",
      fechaExpedicion: t.fechaExpedicion || "",
      ciudad: t.ciudad || caseSource.ciudad || "",
      departamento: t.departamento || "",
      direccion: t.direccion || caseSource.direccion || "",
      email: t.email || caseSource.email || "",
      telefono: t.telefono || caseSource.telefono || "",
    });
    const co = (expediente.cotitular ?? {}) as Partial<CotitularMaestro> & { activo?: boolean };
    setIjCotitular({
      activo: !!co.activo,
      nombre: co.nombre || "",
      tipoDocumento: co.tipoDocumento || "CC",
      cedula: co.cedula || "",
      expedidaEn: co.expedidaEn || "",
      fechaExpedicion: co.fechaExpedicion || "",
      ciudad: co.ciudad || "",
      departamento: co.departamento || "",
      direccion: co.direccion || "",
      email: co.email || "",
      telefono: co.telefono || "",
    });
  }, [expediente, caseSource]);

  // Sincronización manual: copia TODOS los datos disponibles del caso hacia
  // la Información Jurídica, sobrescribiendo los campos mapeados.
  const syncFromCase = () => {
    setIjTitular((prev) => ({
      ...prev,
      tipoDocumento: caseSource.tipoDocumento || prev.tipoDocumento || "CC",
      cedula: caseSource.cedula || prev.cedula || "",
      ciudad: caseSource.ciudad || prev.ciudad || "",
      email: caseSource.email || prev.email || "",
      telefono: caseSource.telefono || prev.telefono || "",
      direccion: caseSource.direccion || prev.direccion || "",
    }));
    setSyncFlash(true);
    setTimeout(() => setSyncFlash(false), 2500);
  };

  // `live` = expediente + override del padre + edición en vivo de Información Jurídica.
  // Esto garantiza que validación y plantilla del Poder vean los mismos valores que el editor.
  const live: ExpedienteMaestro = useMemo(() => {
    const base = { ...expediente, ...(liveOverride ?? {}) };
    return {
      ...base,
      cliente: { ...base.cliente, ...ijTitular },
      cotitular: {
        ...base.cotitular,
        ...ijCotitular,
        activo: ijCotitular.activo ?? base.cotitular?.activo ?? false,
      } as CotitularMaestro,
    };
  }, [expediente, liveOverride, ijTitular, ijCotitular]);




  useEffect(() => {
    listApoderados(true).then((rows) => {
      setApoderados(rows);
      if (rows.length > 0) setSelectedApId((id) => id || rows[0].id);
    }).catch(() => { /* silencioso */ });
  }, []);

  const selectedAp: ApoderadoSeleccionado | undefined = useMemo(() => {
    const ap = apoderados.find((a) => a.id === selectedApId);
    if (!ap) return undefined;
    return {
      nombre: ap.nombre, cedula: ap.cedula,
      lugarExpedicion: ap.lugar_expedicion, ciudad: ap.ciudad, celular: ap.celular,
    };
  }, [apoderados, selectedApId]);

  // ── Plantilla jurídica detectada (con override manual)
  const detectedTemplate: PoderTemplateId = useMemo(
    () => detectPoderTemplate(live.credito?.banco, live.credito?.tipoProducto),
    [live.credito?.banco, live.credito?.tipoProducto],
  );
  const [tplOverride, setTplOverride] = useState<PoderTemplateId | null>(null);
  const [showTplPicker, setShowTplPicker] = useState(false);
  const activeTemplateId: PoderTemplateId = tplOverride ?? detectedTemplate;
  const activeTemplateMeta = PODER_TEMPLATES.find((t) => t.id === activeTemplateId)!;

  // ── Acuerdo comercial (Contado / Financiado)
  const honorarios = useMemo(() => {
    const p = (simExpediente?.propuesta_data ?? {}) as Partial<PropuestaData>;
    return Number(p.honorarios ?? simExpediente?.honorarios_final ?? 0);
  }, [simExpediente]);

  const [modalidad, setModalidad] = useState<ModalidadPago>("contado");
  const [numCuotas, setNumCuotas] = useState<number>(2);
  const [cuotas, setCuotas] = useState<number[]>([]);

  // Inicializa / redistribuye cuotas cuando cambia número o honorarios
  useEffect(() => {
    if (modalidad !== "financiado") return;
    const n = Math.max(1, Math.min(24, Math.round(numCuotas) || 1));
    const base = honorarios > 0 ? Math.round(honorarios / n) : 0;
    const arr = Array.from({ length: n }, (_, i) =>
      i === n - 1 ? Math.max(0, honorarios - base * (n - 1)) : base,
    );
    setCuotas(arr);
  }, [modalidad, numCuotas, honorarios]);

  const sumaCuotas = useMemo(() => cuotas.reduce((a, b) => a + (Number(b) || 0), 0), [cuotas]);
  const saldoRestante = honorarios - sumaCuotas;

  const acuerdo: AcuerdoComercial = useMemo(
    () => (modalidad === "contado" ? { modalidad: "contado" } : { modalidad: "financiado", cuotas }),
    [modalidad, cuotas],
  );

  const poderes = useMemo(
    () => (selectedAp ? buildPoderesForExpediente(live, selectedAp, tplOverride ?? undefined) : []),
    [live, selectedAp, tplOverride],
  );
  const poderesMissing = poderes.flatMap((p) => p.missing);
  const hasMissing = poderesMissing.length > 0;
  const uniqueMissing = Array.from(new Set(poderesMissing));
  const datosDoc = useMemo(
    () => buildDatosContrato(live, simExpediente ?? null, acuerdo),
    [live, simExpediente, acuerdo],
  );

  return (
    <>
      <Card>
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Jurídica
          </div>
          <h3 className="text-lg font-semibold text-[#242424]">Documentos del expediente</h3>
          <p className="text-xs text-[#242424]/60 mt-0.5">
            Todos los documentos se generan automáticamente desde la información del expediente.
          </p>
        </div>

        {/* INFORMACIÓN JURÍDICA — fuente oficial para el Poder Especial */}
        <InformacionJuridicaEditor
          titular={ijTitular}
          cotitular={ijCotitular}
          onTitular={setIjTitular}
          onCotitular={setIjCotitular}
          canPersist={!!expedienteIdToPersist}
          saving={savingIJ}
          saved={savedFlash}
          onSync={syncFromCase}
          syncFlash={syncFlash}
          onSave={async () => {
            if (!expedienteIdToPersist) return;
            setSavingIJ(true);
            try {
              await saveInformacionJuridicaExpediente(expedienteIdToPersist, {
                titular: ijTitular,
                cotitular: ijCotitular,
              });
              setSavedFlash(true);
              setTimeout(() => setSavedFlash(false), 2000);
              onJuridicaSaved?.();
            } catch (e) {
              alert("No se pudo guardar Información Jurídica: " + (e as Error).message);
            } finally {
              setSavingIJ(false);
            }
          }}
        />



        {/* Selector de apoderado para el Poder Especial */}
        <div className="rounded-xl border bg-[#F7F9FB] p-3 mb-4" style={{ borderColor: "#E3E7EE" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70">
              Apoderado NUVEX
            </div>
            {apoderados.length === 0 ? (
              <span className="text-xs text-[#B42318]">
                No hay apoderados activos. Crea uno en <strong>Apoderados</strong>.
              </span>
            ) : (
              <select
                value={selectedApId}
                onChange={(e) => setSelectedApId(e.target.value)}
                className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-sm"
              >
                {apoderados.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre} — CC {a.cedula}
                  </option>
                ))}
              </select>
            )}
            {selectedAp && (
              <span className="text-[11px] text-[#242424]/60">
                Expedida en {selectedAp.lugarExpedicion || "—"} · Cel {selectedAp.celular || "—"}
              </span>
            )}
          </div>
        </div>

        {/* Acuerdo comercial — Modalidad de pago */}
        <div className="rounded-xl border bg-[#F7F9FB] p-3 mb-4" style={{ borderColor: "#E3E7EE" }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70">
              Acuerdo comercial
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={modalidad === "contado"} onChange={() => setModalidad("contado")} />
              Contado
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="radio" checked={modalidad === "financiado"} onChange={() => setModalidad("financiado")} />
              Financiado
            </label>
            <span className="text-[11px] text-[#242424]/60">
              Honorarios: <strong>{fmtCOP(honorarios)}</strong>
            </span>
          </div>

          {modalidad === "financiado" && (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs text-[#242424]/70">Número de cuotas</label>
                <input
                  type="number" min={1} max={24}
                  value={numCuotas}
                  onChange={(e) => setNumCuotas(Math.max(1, Math.min(24, Number(e.target.value) || 1)))}
                  className="w-20 rounded-lg border border-[#E3E7EE] bg-white px-2 py-1 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {cuotas.map((v, i) => (
                  <label key={i} className="text-xs">
                    <span className="block text-[#242424]/60 mb-0.5">Cuota {i + 1}</span>
                    <input
                      type="number"
                      value={v}
                      onChange={(e) => {
                        const n = Number(e.target.value) || 0;
                        setCuotas((arr) => arr.map((x, j) => (j === i ? n : x)));
                      }}
                      className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1 text-sm"
                    />
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <span>Suma: <strong>{fmtCOP(sumaCuotas)}</strong></span>
                <span style={{ color: saldoRestante === 0 ? "#1F7A45" : "#B42318" }}>
                  {saldoRestante === 0
                    ? "Cuadrado · $0"
                    : saldoRestante > 0
                      ? `Falta ${fmtCOP(saldoRestante)}`
                      : `Excede en ${fmtCOP(Math.abs(saldoRestante))}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Plantilla jurídica detectada + override manual */}
        <div className="rounded-xl border bg-white p-3 mb-4" style={{ borderColor: "#E3E7EE" }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[#242424]/70">
              Plantilla detectada
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: NUVEX.verdeClaro, color: NUVEX.verdeTextoFuerte }}>
              <CheckCircle2 size={13} /> {activeTemplateMeta.nombre}
              {tplOverride && <span className="ml-1 text-[10px] opacity-70">(manual)</span>}
            </span>
            <button
              onClick={() => setShowTplPicker((s) => !s)}
              className="inline-flex items-center gap-1 text-[11px] text-[#445DA3] hover:underline"
            >
              <RefreshCw size={11} /> Cambiar plantilla
            </button>
          </div>
          {showTplPicker && (
            <div className="mt-3 grid gap-2">
              {PODER_TEMPLATES.map((t) => (
                <label key={t.id} className="flex items-start gap-2 rounded-lg border border-[#E3E7EE] p-2 text-xs cursor-pointer hover:bg-[#F7F9FB]">
                  <input
                    type="radio" className="mt-0.5"
                    checked={activeTemplateId === t.id}
                    onChange={() => { setTplOverride(t.id === detectedTemplate ? null : t.id); setShowTplPicker(false); }}
                  />
                  <div>
                    <div className="font-semibold text-[#242424]">{t.nombre}</div>
                    <div className="text-[#242424]/60">{t.descripcion}</div>
                  </div>
                </label>
              ))}
              {tplOverride && (
                <button onClick={() => { setTplOverride(null); setShowTplPicker(false); }} className="text-[11px] text-[#445DA3] hover:underline self-start">
                  Volver a selección automática
                </button>
              )}
            </div>
          )}
          {hasMissing && selectedAp && (
            <div className="mt-3 rounded-lg border p-2 text-xs"
              style={{ borderColor: "#F5C2C2", background: NUVEX.rojoBg, color: NUVEX.rojoTexto }}>
              <div className="flex items-center gap-1.5 font-semibold mb-1">
                <AlertTriangle size={13} /> Faltan datos para generar el poder.
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {uniqueMissing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {poderes.length === 0 && (
            <div className="md:col-span-2 rounded-xl border bg-[#F7F9FB] p-4 text-xs text-[#242424]/70" style={{ borderColor: "#E3E7EE" }}>
              Selecciona un Apoderado NUVEX para generar el Poder Especial.
            </div>
          )}
          {poderes.map((p, i) => (
            <DocCard
              key={i}
              icon={<FileText size={18} />}
              title={`Poder Especial — ${p.doc.title.replace("Poder Especial — ", "")}`}
              descripcion={`Plantilla ${activeTemplateMeta.nombre}. ${p.missing.length ? "Completa los datos faltantes antes de descargar." : "Listo para previsualizar y descargar."}`}
              doc={p.doc}
              disabled={p.missing.length > 0}
              onPreview={() => setPreview(p.doc)}
            />
          ))}
          <DocCard
            icon={<FileText size={18} />}
            title="Datos para Contrato"
            descripcion="Cliente, propuesta, beneficio de cobertura y acuerdo comercial (contado o financiado)."
            doc={datosDoc}
            onPreview={() => setPreview(datosDoc)}
          />
          <InfoCard
            icon={<Receipt size={18} />}
            title="Cuenta de Cobro"
            descripcion="Disponible automáticamente en el simulador del expediente."
          />
          <InfoCard
            icon={<BadgeCheck size={18} />}
            title="Paz y Salvo"
            descripcion="Disponible automáticamente en el simulador del expediente."
          />
        </div>
      </Card>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function DocCard({
  icon, title, descripcion, doc, disabled, onPreview,
}: {
  icon: React.ReactNode; title: string; descripcion: string;
  doc: LegalDoc; disabled?: boolean; onPreview: () => void;
}) {
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
  const downloadPDF = async () => { setBusy("pdf"); try { exportLegalDocPDF(doc); } finally { setBusy(null); } };
  const downloadDOCX = async () => { setBusy("docx"); try { await exportLegalDocDOCX(doc); } finally { setBusy(null); } };

  return (
    <div className="rounded-xl border bg-white p-4 flex flex-col gap-3" style={{ borderColor: "#E3E7EE" }}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[#242424] text-sm">{title}</div>
          <p className="text-xs text-[#242424]/60 mt-0.5">{descripcion}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <button
          onClick={onPreview}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB] disabled:opacity-50"
        >
          <Eye size={13} /> Previsualizar
        </button>
        <button
          onClick={downloadPDF}
          disabled={disabled || busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: NUVEX.azul }}
        >
          <Download size={13} /> {busy === "pdf" ? "Generando…" : "PDF"}
        </button>
        <button
          onClick={downloadDOCX}
          disabled={disabled || busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: NUVEX.verde }}
        >
          <Download size={13} /> {busy === "docx" ? "Generando…" : "Word"}
        </button>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, descripcion }: { icon: React.ReactNode; title: string; descripcion: string }) {
  return (
    <div className="rounded-xl border bg-[#F7F9FB] p-4 flex items-start gap-3" style={{ borderColor: "#E3E7EE" }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
        style={{ background: "linear-gradient(135deg,#94A3B8,#64748B)" }}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-semibold text-[#242424] text-sm">{title}</div>
        <p className="text-xs text-[#242424]/60 mt-0.5">{descripcion}</p>
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#242424]/60">
          <Info size={12} /> Conectado al expediente activo
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="font-semibold text-[#242424]">{doc.title}</div>
          <button onClick={onClose} className="text-sm text-[#242424]/60 hover:text-[#242424]">Cerrar</button>
        </div>
        <div className="overflow-y-auto p-8 text-[13px] leading-relaxed text-[#242424]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {doc.blocks.map((b, i) => {
            switch (b.type) {
              case "title": return <h1 key={i} className="text-center text-xl font-bold mb-3">{b.text}</h1>;
              case "subtitle": return <h2 key={i} className="text-center text-sm font-semibold mb-3">{b.text}</h2>;
              case "heading": return <h3 key={i} className="font-bold mt-3 mb-1">{b.text}</h3>;
              case "paragraph": return <p key={i} className="text-justify mb-2">{b.text}</p>;
              case "section":
                return <h3 key={i} className="font-bold text-sm uppercase tracking-wider border-b border-[#242424] pb-1 mt-4 mb-2">{b.text}</h3>;
              case "field":
                return (
                  <div key={i} className="grid grid-cols-[180px_1fr] gap-3 py-0.5">
                    <div className="font-semibold">{b.label}</div>
                    <div>{b.value || "—"}</div>
                  </div>
                );
              case "spacer": return <div key={i} style={{ height: (b.size ?? 8) }} />;
              case "signature":
                return (
                  <div key={i} className="grid mt-10 gap-6" style={{ gridTemplateColumns: `repeat(${b.columns.length}, 1fr)` }}>
                    {b.columns.map((c, j) => (
                      <div key={j} className="text-center">
                        <div className="border-t border-[#242424] mx-4 pt-2 font-semibold text-xs">{c.label}</div>
                        {c.name && <div className="text-xs mt-1">{c.name}</div>}
                        {c.cc && <div className="text-[11px] text-[#242424]/70">{c.cc}</div>}
                      </div>
                    ))}
                  </div>
                );
            }
          })}
        </div>
      </div>
    </div>
  );
}

const TIPOS_DOC = ["CC", "CE", "PA", "TI", "NIT"];

function IJField({
  label, value, onChange, placeholder, required,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  const empty = required && !value.trim();
  return (
    <label className="text-xs">
      <span className="block text-[#242424]/70 mb-0.5">
        {label}{required && <span className="text-[#B42318]"> *</span>}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-white px-2 py-1.5 text-sm"
        style={{ borderColor: empty ? "#F5C2C2" : "#E3E7EE" }}
      />
    </label>
  );
}

function IJSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="text-xs">
      <span className="block text-[#242424]/70 mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#E3E7EE] bg-white px-2 py-1.5 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function InformacionJuridicaEditor({
  titular, cotitular, onTitular, onCotitular, canPersist, saving, saved, onSave, onSync, syncFlash,
}: {
  titular: Partial<ClienteMaestro>;
  cotitular: Partial<CotitularMaestro> & { activo?: boolean };
  onTitular: (v: Partial<ClienteMaestro>) => void;
  onCotitular: (v: Partial<CotitularMaestro> & { activo?: boolean }) => void;
  canPersist: boolean;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onSync: () => void;
  syncFlash: boolean;
}) {
  const setT = <K extends keyof ClienteMaestro>(k: K, v: string) => onTitular({ ...titular, [k]: v });
  const setC = <K extends keyof CotitularMaestro>(k: K, v: string) => onCotitular({ ...cotitular, [k]: v });

  return (
    <div className="rounded-xl border bg-white p-4 mb-4" style={{ borderColor: "#E3E7EE" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Scale size={16} style={{ color: NUVEX.azul }} />
          <div className="text-sm font-semibold text-[#242424]">Información Jurídica</div>
          <span className="text-[11px] text-[#242424]/60">Fuente oficial del Poder Especial</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSync}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] bg-white px-3 py-1.5 text-xs font-semibold text-[#242424] hover:bg-[#F7F9FB]"
            title="Copia Tipo doc, Cédula, Ciudad, Correo, Celular y Dirección desde Datos del Cliente"
          >
            <RefreshCw size={13} /> Sincronizar desde datos del caso
          </button>
          {syncFlash && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: NUVEX.verdeTextoFuerte }}>
              <CheckCircle2 size={12} /> Información jurídica sincronizada correctamente.
            </span>
          )}
          {canPersist && (
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: saved ? NUVEX.verde : NUVEX.azul }}
            >
              {saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
              {saving ? "Guardando…" : saved ? "Guardado" : "Guardar"}
            </button>
          )}
        </div>
      </div>


      <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: NUVEX.azul }}>
        Titular
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <IJSelect label="Tipo de documento" value={titular.tipoDocumento || "CC"} options={TIPOS_DOC} onChange={(v) => setT("tipoDocumento", v)} />
        <IJField label="Número de documento" value={titular.cedula || ""} onChange={(v) => setT("cedula", v)} required />
        <IJField label="Lugar de expedición" value={titular.expedidaEn || ""} onChange={(v) => setT("expedidaEn", v)} required />
        <IJField label="Fecha de expedición" value={titular.fechaExpedicion || ""} placeholder="DD/MM/AAAA" onChange={(v) => setT("fechaExpedicion", v)} />
        <IJField label="Ciudad de residencia" value={titular.ciudad || ""} onChange={(v) => setT("ciudad", v)} required />
        <IJField label="Departamento" value={titular.departamento || ""} onChange={(v) => setT("departamento", v)} />
        <IJField label="Correo electrónico" value={titular.email || ""} onChange={(v) => setT("email", v)} />
        <IJField label="Celular" value={titular.telefono || ""} onChange={(v) => setT("telefono", v)} />
        <IJField label="Dirección" value={titular.direccion || ""} onChange={(v) => setT("direccion", v)} />
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-[#242424]">
        <input
          type="checkbox"
          checked={!!cotitular.activo}
          onChange={(e) => onCotitular({ ...cotitular, activo: e.target.checked })}
        />
        <span>El crédito tiene cotitular / colocatario</span>
      </label>

      {cotitular.activo && (
        <>
          <div className="text-[11px] uppercase tracking-wider font-semibold mt-3 mb-2" style={{ color: NUVEX.azul }}>
            Cotitular / Colocatario
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <IJField label="Nombre completo" value={cotitular.nombre || ""} onChange={(v) => setC("nombre", v)} required />
            <IJSelect label="Tipo de documento" value={cotitular.tipoDocumento || "CC"} options={TIPOS_DOC} onChange={(v) => setC("tipoDocumento", v)} />
            <IJField label="Número de documento" value={cotitular.cedula || ""} onChange={(v) => setC("cedula", v)} required />
            <IJField label="Lugar de expedición" value={cotitular.expedidaEn || ""} onChange={(v) => setC("expedidaEn", v)} required />
            <IJField label="Fecha de expedición" value={cotitular.fechaExpedicion || ""} placeholder="DD/MM/AAAA" onChange={(v) => setC("fechaExpedicion", v)} />
            <IJField label="Ciudad de residencia" value={cotitular.ciudad || ""} onChange={(v) => setC("ciudad", v)} required />
            <IJField label="Departamento" value={cotitular.departamento || ""} onChange={(v) => setC("departamento", v)} />
            <IJField label="Correo electrónico" value={cotitular.email || ""} onChange={(v) => setC("email", v)} />
            <IJField label="Celular" value={cotitular.telefono || ""} onChange={(v) => setC("telefono", v)} />
            <IJField label="Dirección" value={cotitular.direccion || ""} onChange={(v) => setC("direccion", v)} />
          </div>
        </>
      )}

      {!canPersist && (
        <p className="mt-3 text-[11px] text-[#242424]/60">
          Los cambios se aplican al Poder Especial en esta sesión. Para persistirlos, edita el Expediente Maestro.
        </p>
      )}
    </div>
  );
}

