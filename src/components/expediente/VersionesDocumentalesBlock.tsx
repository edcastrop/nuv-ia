import { useEffect, useState } from "react";
import { FileClock, Plus } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
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

interface Props {
  exp: Expediente;
}

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
    <Card>
      <div className="flex items-start gap-3 mb-4">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
          style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.negro})` }}
        >
          <FileClock size={18} />
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Trazabilidad
          </div>
          <h3 className="text-lg font-semibold text-[#242424]">Versiones documentales</h3>
          <p className="text-xs text-[#242424]/60 mt-0.5">
            Cada vez que cambien datos críticos del expediente, las versiones previas quedarán marcadas como OBSOLETAS.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {TIPOS.map((t) => (
          <button
            key={t.key}
            onClick={() => registrar(t.key)}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium disabled:opacity-50"
            style={{ borderColor: "#E3E7EE" }}
          >
            <Plus size={11} /> {t.label}
          </button>
        ))}
      </div>

      {err && <div className="text-xs text-[#B42318] mb-2">{err}</div>}
      {loading && <div className="text-xs text-[#242424]/60">Cargando versiones…</div>}

      {!loading && items.length === 0 && (
        <div className="text-xs text-[#242424]/60">Aún no se han registrado versiones documentales.</div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-1">
          {items.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-center gap-2 border-b border-dashed border-[#E3E7EE] pb-1 last:border-0 text-xs"
            >
              <span className="font-semibold uppercase text-[10px]" style={{ color: NUVEX.azul }}>
                {v.tipo}
              </span>
              <span className="font-medium">v{v.version}</span>
              {v.obsoleto && (
                <span
                  className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: "#FDECEC", color: "#7A0E0E", borderColor: "#F5A8A8" }}
                >
                  OBSOLETO
                </span>
              )}
              <span className="text-[#242424]/60 flex-1 truncate">
                {v.motivo_obsoleto || ""}
              </span>
              <span className="text-[#242424]/50">
                {new Date(v.created_at).toLocaleString("es-CO")}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
