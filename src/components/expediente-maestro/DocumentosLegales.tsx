import { useMemo, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { FileText, Download, Eye } from "lucide-react";
import type { ExpedienteMaestro } from "@/lib/expedienteMaestro";
import { buildPoderEspecial, buildContratoServicios, type LegalDoc } from "@/lib/legalDocs";
import { exportLegalDocPDF, exportLegalDocDOCX } from "@/lib/legalDocsExport";

interface Props {
  expediente: ExpedienteMaestro;
  /** Datos vigentes en pantalla (no necesariamente guardados aún). */
  liveOverride?: Partial<ExpedienteMaestro>;
}

export function DocumentosLegales({ expediente, liveOverride }: Props) {
  const [preview, setPreview] = useState<LegalDoc | null>(null);

  // Mezcla el expediente guardado con los cambios en pantalla para que el
  // documento siempre refleje el estado vigente del formulario.
  const live: ExpedienteMaestro = useMemo(
    () => ({ ...expediente, ...(liveOverride ?? {}) }),
    [expediente, liveOverride],
  );

  const docs = useMemo(
    () => ({
      poder: buildPoderEspecial(live),
      contrato: buildContratoServicios(live),
    }),
    [live],
  );

  return (
    <>
      <Card>
        <div className="mb-4">
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Documentos jurídicos
          </div>
          <h3 className="text-lg font-semibold text-[#242424]">Generador automático</h3>
          <p className="text-xs text-[#242424]/60 mt-0.5">
            Los documentos se construyen en tiempo real con la información del expediente.
            Cualquier cambio se refleja al volver a descargar o previsualizar.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DocCard
            doc={docs.poder}
            descripcion="Poder amplio y suficiente al apoderado para gestionar el crédito ante el banco."
            onPreview={() => setPreview(docs.poder)}
          />
          <DocCard
            doc={docs.contrato}
            descripcion="Contrato de prestación de servicios profesionales NUVEX, honorarios a éxito."
            onPreview={() => setPreview(docs.contrato)}
          />
        </div>
      </Card>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </>
  );
}

function DocCard({
  doc, descripcion, onPreview,
}: { doc: LegalDoc; descripcion: string; onPreview: () => void }) {
  const [busy, setBusy] = useState<null | "pdf" | "docx">(null);

  const downloadPDF = async () => {
    setBusy("pdf");
    try { exportLegalDocPDF(doc); } finally { setBusy(null); }
  };
  const downloadDOCX = async () => {
    setBusy("docx");
    try { await exportLegalDocDOCX(doc); } finally { setBusy(null); }
  };

  return (
    <div
      className="rounded-xl border bg-white p-4 flex flex-col gap-3"
      style={{ borderColor: "#E3E7EE" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
        >
          <FileText size={18} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-[#242424] text-sm">{doc.title}</div>
          <p className="text-xs text-[#242424]/60 mt-0.5">{descripcion}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <button
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-medium text-[#242424] hover:bg-[#F7F9FB]"
        >
          <Eye size={13} /> Previsualizar
        </button>
        <button
          onClick={downloadPDF}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: NUVEX.azul }}
        >
          <Download size={13} /> {busy === "pdf" ? "Generando…" : "PDF"}
        </button>
        <button
          onClick={downloadDOCX}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: NUVEX.verde }}
        >
          <Download size={13} /> {busy === "docx" ? "Generando…" : "DOCX"}
        </button>
      </div>
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
        <div className="overflow-y-auto p-8 text-[13px] leading-relaxed text-[#242424]" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
          {doc.blocks.map((b, i) => {
            switch (b.type) {
              case "title":
                return <h1 key={i} className="text-center text-xl font-bold mb-3">{b.text}</h1>;
              case "subtitle":
                return <h2 key={i} className="text-center text-sm font-semibold mb-3">{b.text}</h2>;
              case "heading":
                return <h3 key={i} className="font-bold mt-3 mb-1">{b.text}</h3>;
              case "paragraph":
                return <p key={i} className="text-justify mb-2">{b.text}</p>;
              case "spacer":
                return <div key={i} style={{ height: (b.size ?? 8) }} />;
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
