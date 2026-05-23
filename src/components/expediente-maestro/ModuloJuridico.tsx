import { useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { Scale, FileText, Download, Eye, ChevronDown } from "lucide-react";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import {
  buildDerechoPeticion,
  buildTutela,
  buildRespuestaNegacion,
  buildRadicacion,
  type LegalDoc,
  type DerechoPeticionExtra,
  type TutelaExtra,
  type RespuestaNegacionExtra,
  type RadicacionExtra,
} from "@/lib/legalDocs";
import { exportLegalDocPDF, exportLegalDocDOCX } from "@/lib/legalDocsExport";

interface Props {
  expediente: ExpedienteMaestro;
  /** Datos vigentes en pantalla (no necesariamente guardados aún). */
  liveOverride?: Partial<ExpedienteMaestro>;
}

type Tipo = "derecho" | "tutela" | "negacion" | "radicacion";

const TIPOS: { id: Tipo; titulo: string; descripcion: string; color: string }[] = [
  {
    id: "derecho",
    titulo: "Derecho de Petición",
    descripcion: "Art. 23 C.P. · Ley 1755 de 2015. Petición formal a la entidad financiera.",
    color: NUVEX.azul,
  },
  {
    id: "tutela",
    titulo: "Acción de Tutela",
    descripcion: "Art. 86 C.P. · Decreto 2591 de 1991. Protección de derechos fundamentales.",
    color: "#B42318",
  },
  {
    id: "negacion",
    titulo: "Respuesta a Negación",
    descripcion: "Reconsideración y recurso de reposición ante negativa del banco.",
    color: "#8A5A00",
  },
  {
    id: "radicacion",
    titulo: "Oficio de Radicación",
    descripcion: "Constancia de entrega de documentos al banco con número de radicado.",
    color: NUVEX.verde,
  },
];

export function ModuloJuridico({ expediente, liveOverride }: Props) {
  const [openTipo, setOpenTipo] = useState<Tipo | null>(null);
  const [preview, setPreview] = useState<LegalDoc | null>(null);

  const live: ExpedienteMaestro = useMemo(
    () => ({ ...expediente, ...(liveOverride ?? {}) }),
    [expediente, liveOverride],
  );

  return (
    <>
      <Card>
        <div className="mb-4 flex items-start gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
            style={{ background: `linear-gradient(135deg, ${NUVEX.negro}, ${NUVEX.azul})` }}
          >
            <Scale size={18} />
          </div>
          <div>
            <div
              className="text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: NUVEX.azul }}
            >
              Módulo Jurídico NUVEX
            </div>
            <h3 className="text-lg font-semibold text-[#242424]">
              Generación automática de escritos jurídicos
            </h3>
            <p className="text-xs text-[#242424]/60 mt-0.5">
              Los datos del cliente, crédito y apoderado se toman automáticamente del
              expediente. Sólo se solicita la información específica del caso jurídico.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {TIPOS.map((t) => (
            <TipoSection
              key={t.id}
              tipo={t}
              expanded={openTipo === t.id}
              onToggle={() => setOpenTipo((cur) => (cur === t.id ? null : t.id))}
              expediente={live}
              onPreview={setPreview}
            />
          ))}
        </div>
      </Card>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function TipoSection({
  tipo,
  expanded,
  onToggle,
  expediente,
  onPreview,
}: {
  tipo: (typeof TIPOS)[number];
  expanded: boolean;
  onToggle: () => void;
  expediente: ExpedienteMaestro;
  onPreview: (d: LegalDoc) => void;
}) {
  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: "#E3E7EE" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white shrink-0"
            style={{ backgroundColor: tipo.color }}
          >
            <FileText size={15} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[#242424] text-sm truncate">{tipo.titulo}</div>
            <div className="text-[11px] text-[#242424]/60 truncate">{tipo.descripcion}</div>
          </div>
        </div>
        <ChevronDown
          size={16}
          className="shrink-0 text-[#242424]/50 transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-[#E3E7EE]">
          {tipo.id === "derecho" && (
            <DerechoForm expediente={expediente} onPreview={onPreview} />
          )}
          {tipo.id === "tutela" && (
            <TutelaForm expediente={expediente} onPreview={onPreview} />
          )}
          {tipo.id === "negacion" && (
            <NegacionForm expediente={expediente} onPreview={onPreview} />
          )}
          {tipo.id === "radicacion" && (
            <RadicacionForm expediente={expediente} onPreview={onPreview} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Formularios (sólo piden datos NO existentes en el expediente) ──────────

function DerechoForm({
  expediente,
  onPreview,
}: {
  expediente: ExpedienteMaestro;
  onPreview: (d: LegalDoc) => void;
}) {
  const [extra, setExtra] = useState<DerechoPeticionExtra>({
    asunto: "",
    hechos: "",
    pretensiones: "",
  });
  const doc = useMemo(() => buildDerechoPeticion(expediente, extra), [expediente, extra]);
  return (
    <>
      <FieldText
        label="Asunto"
        value={extra.asunto}
        onChange={(v) => setExtra((s) => ({ ...s, asunto: v }))}
        placeholder="Solicitud de información sobre cobros aplicados al crédito"
      />
      <FieldArea
        label="Hechos"
        value={extra.hechos}
        onChange={(v) => setExtra((s) => ({ ...s, hechos: v }))}
        placeholder="Describa de manera clara y cronológica los hechos relevantes."
      />
      <FieldArea
        label="Peticiones"
        value={extra.pretensiones}
        onChange={(v) => setExtra((s) => ({ ...s, pretensiones: v }))}
        placeholder="Liste de manera concreta lo que solicita al banco."
      />
      <DocActions doc={doc} onPreview={() => onPreview(doc)} />
    </>
  );
}

function TutelaForm({
  expediente,
  onPreview,
}: {
  expediente: ExpedienteMaestro;
  onPreview: (d: LegalDoc) => void;
}) {
  const [extra, setExtra] = useState<TutelaExtra>({
    derechoVulnerado: "",
    hechos: "",
    pretensiones: "",
    pruebas: "",
  });
  const doc = useMemo(() => buildTutela(expediente, extra), [expediente, extra]);
  return (
    <>
      <FieldText
        label="Derecho fundamental vulnerado"
        value={extra.derechoVulnerado}
        onChange={(v) => setExtra((s) => ({ ...s, derechoVulnerado: v }))}
        placeholder="Derecho de petición, debido proceso, mínimo vital, vivienda digna…"
      />
      <FieldArea
        label="Hechos"
        value={extra.hechos}
        onChange={(v) => setExtra((s) => ({ ...s, hechos: v }))}
        placeholder="Relate los hechos que sustentan la acción."
      />
      <FieldArea
        label="Pretensiones"
        value={extra.pretensiones}
        onChange={(v) => setExtra((s) => ({ ...s, pretensiones: v }))}
        placeholder="Indique qué se solicita al juez."
      />
      <FieldArea
        label="Pruebas (opcional)"
        value={extra.pruebas ?? ""}
        onChange={(v) => setExtra((s) => ({ ...s, pruebas: v }))}
        placeholder="Documentos anexos, testimonios, etc."
      />
      <DocActions doc={doc} onPreview={() => onPreview(doc)} />
    </>
  );
}

function NegacionForm({
  expediente,
  onPreview,
}: {
  expediente: ExpedienteMaestro;
  onPreview: (d: LegalDoc) => void;
}) {
  const [extra, setExtra] = useState<RespuestaNegacionExtra>({
    fechaNegacion: "",
    radicadoNegacion: "",
    motivoNegacion: "",
    argumentos: "",
  });
  const doc = useMemo(() => buildRespuestaNegacion(expediente, extra), [expediente, extra]);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldText
          label="Fecha de la negación"
          value={extra.fechaNegacion}
          onChange={(v) => setExtra((s) => ({ ...s, fechaNegacion: v }))}
          placeholder="2026-05-10"
        />
        <FieldText
          label="Radicado de la negación"
          value={extra.radicadoNegacion}
          onChange={(v) => setExtra((s) => ({ ...s, radicadoNegacion: v }))}
          placeholder="RAD-987654"
        />
      </div>
      <FieldArea
        label="Motivo invocado por el banco"
        value={extra.motivoNegacion}
        onChange={(v) => setExtra((s) => ({ ...s, motivoNegacion: v }))}
        placeholder="Transcriba textualmente la causal de negación."
      />
      <FieldArea
        label="Argumentos del cliente"
        value={extra.argumentos}
        onChange={(v) => setExtra((s) => ({ ...s, argumentos: v }))}
        placeholder="Argumentos técnicos, contables y jurídicos para reconsiderar."
      />
      <DocActions doc={doc} onPreview={() => onPreview(doc)} />
    </>
  );
}

function RadicacionForm({
  expediente,
  onPreview,
}: {
  expediente: ExpedienteMaestro;
  onPreview: (d: LegalDoc) => void;
}) {
  const [extra, setExtra] = useState<RadicacionExtra>({
    oficina: "Oficina de Crédito Hipotecario",
    asunto: "",
    documentosAdjuntos: "",
    observaciones: "",
  });
  const doc = useMemo(() => buildRadicacion(expediente, extra), [expediente, extra]);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldText
          label="Oficina destino"
          value={extra.oficina}
          onChange={(v) => setExtra((s) => ({ ...s, oficina: v }))}
          placeholder="Oficina de Crédito Hipotecario"
        />
        <FieldText
          label="Asunto"
          value={extra.asunto}
          onChange={(v) => setExtra((s) => ({ ...s, asunto: v }))}
          placeholder="Radicación de documentos soporte"
        />
      </div>
      <FieldArea
        label="Documentos adjuntos (uno por línea)"
        value={extra.documentosAdjuntos}
        onChange={(v) => setExtra((s) => ({ ...s, documentosAdjuntos: v }))}
        placeholder={"Poder especial\nCédula del titular\nÚltimo extracto del crédito"}
      />
      <FieldArea
        label="Observaciones (opcional)"
        value={extra.observaciones ?? ""}
        onChange={(v) => setExtra((s) => ({ ...s, observaciones: v }))}
        placeholder="Información adicional para el funcionario receptor."
      />
      <DocActions doc={doc} onPreview={() => onPreview(doc)} />
    </>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────

function FieldText({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block mt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#445DA3]/30"
      />
    </label>
  );
}

function FieldArea({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block mt-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/70">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="mt-1 w-full rounded-lg border border-[#E3E7EE] px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#445DA3]/30"
      />
    </label>
  );
}

function DocActions({ doc, onPreview }: { doc: LegalDoc; onPreview: () => void }) {
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        onClick={onPreview}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
      >
        <Eye size={13} /> Previsualizar
      </button>
      <button
        onClick={async () => {
          setBusy("pdf");
          try { exportLegalDocPDF(doc); } finally { setBusy(null); }
        }}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: NUVEX.azul }}
      >
        <Download size={13} /> {busy === "pdf" ? "Generando…" : "PDF"}
      </button>
      <button
        onClick={async () => {
          setBusy("docx");
          try { await exportLegalDocDOCX(doc); } finally { setBusy(null); }
        }}
        disabled={busy !== null}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        style={{ backgroundColor: NUVEX.verde }}
      >
        <Download size={13} /> {busy === "docx" ? "Generando…" : "DOCX"}
      </button>
    </div>
  );
}

function PreviewModal({ doc, onClose }: { doc: LegalDoc; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E3E7EE]">
          <div className="font-semibold text-[#242424]">{doc.title}</div>
          <button onClick={onClose} className="text-sm text-[#242424]/60 hover:text-[#242424]">
            Cerrar
          </button>
        </div>
        <div
          className="overflow-y-auto p-8 text-[13px] leading-relaxed text-[#242424]"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {doc.blocks.map((b, i) => {
            switch (b.type) {
              case "title":
                return <h1 key={i} className="text-center text-xl font-bold mb-3">{b.text}</h1>;
              case "subtitle":
                return <h2 key={i} className="text-center text-sm font-semibold mb-3">{b.text}</h2>;
              case "heading":
                return <h3 key={i} className="font-bold mt-3 mb-1">{b.text}</h3>;
              case "paragraph":
                return <p key={i} className="text-justify mb-2 whitespace-pre-wrap">{b.text}</p>;
              case "spacer":
                return <div key={i} style={{ height: (b.size ?? 8) }} />;
              case "signature":
                return (
                  <div
                    key={i}
                    className="grid mt-10 gap-6"
                    style={{ gridTemplateColumns: `repeat(${b.columns.length}, 1fr)` }}
                  >
                    {b.columns.map((c, j) => (
                      <div key={j} className="text-center">
                        <div className="border-t border-[#242424] mx-4 pt-2 font-semibold text-xs">
                          {c.label}
                        </div>
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
