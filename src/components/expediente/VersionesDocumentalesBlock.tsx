import { useEffect, useState } from "react";
import { FileClock, Plus } from "lucide-react";
import { NCard, SectionHeader } from "@/components/nuvia";
import {
  listVersionesDocumentos,
  registrarVersionDocumento,
  type VersionDoc,
} from "@/lib/validacionIdentidad";
import type { Expediente } from "@/lib/expedientes";

const TIPOS: Array<{ key: Parameters<typeof registrarVersionDocumento>[1]; label: string }> = [
  { key: "poder", label: "Poder" },
  { key: "contrato", label: "Contrato" },
  { key: "datos_contrato", label: "Datos contrato" },
  { key: "solicitud_plazos", label: "Solicitud cambio de plazos" },
  { key: "derecho_peticion", label: "Derecho de petición" },
  { key: "tutela", label: "Tutela" },
  { key: "negacion", label: "Negación" },
  { key: "radicacion", label: "Radicación banco" },
];

interface Props { exp: Expediente }

export function VersionesDocumentalesBlock({ exp }: Props) {
  const [items, setItems] = useState<VersionDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = () => {
    setLoading(true);
    listVersionesDocumentos(exp.id)
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [exp.id]);

  const registrar = async (tipo: Parameters<typeof registrarVersionDocumento>[1]) => {
    setBusy(true);
    setErr(null);
    try {
      await registrarVersionDocumento(exp.id, tipo, {
        cliente_nombre: exp.cliente_nombre,
        cedula: exp.cedula,
        banco: exp.banco,
        numero_credito: exp.numero_credito,
      });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <NCard variant="elevated">
      <SectionHeader
        icon={<FileClock size={16} />}
        title="Versiones documentales"
        description="Trazabilidad — cuando cambian datos críticos las versiones previas quedan marcadas como OBSOLETAS."
      />

      <div className="flex flex-wrap gap-2 mb-3">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => registrar(t.key)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium disabled:opacity-50 transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-secondary)",
            }}
          >
            <Plus size={11} /> {t.label}
          </button>
        ))}
      </div>

      {err && <div className="text-xs mb-2" style={{ color: "#FFB4B4" }}>{err}</div>}
      {loading && <div className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando versiones…</div>}

      {!loading && items.length === 0 && (
        <div className="text-xs" style={{ color: "var(--nuvia-text-secondary)" }}>
          Aún no se han registrado versiones documentales.
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-1">
          {items.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-2 pb-1.5 last:border-0 text-xs"
              style={{ borderBottom: "1px dashed var(--nuvia-border)" }}
            >
              <span
                className="font-semibold uppercase text-[10px]"
                style={{ color: "var(--nuvia-accent-blue)" }}
              >
                {v.tipo}
              </span>
              <span className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                v{v.version}
              </span>
              {v.obsoleto && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    background: "rgba(255,107,107,0.16)",
                    color: "#FFB4B4",
                    border: "1px solid rgba(255,107,107,0.32)",
                  }}
                >
                  OBSOLETO
                </span>
              )}
              <span className="flex-1 truncate" style={{ color: "var(--nuvia-text-secondary)" }}>
                {v.motivo_obsoleto || ""}
              </span>
              <span style={{ color: "var(--nuvia-text-secondary)", opacity: 0.7 }}>
                {new Date(v.created_at).toLocaleString("es-CO")}
              </span>
            </div>
          ))}
        </div>
      )}
    </NCard>
  );
}
