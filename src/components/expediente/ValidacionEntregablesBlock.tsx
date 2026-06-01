import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { Flag, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { evaluarEntregablesFinales, type ResultadoValidacionEntregables } from "@/lib/validacionEntregablesFinales";
import { NUVEX } from "@/components/nuvex/constants";

export function ValidacionEntregablesBlock({ expedienteId }: { expedienteId: string }) {
  const [data, setData] = useState<ResultadoValidacionEntregables | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await evaluarEntregablesFinales(expedienteId)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [expedienteId]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flag size={18} style={{ color: NUVEX.azul }} />
          <h3 className="text-sm font-semibold text-[#242424]">Entregables finales: requisitos para cerrar el caso</h3>
        </div>
        <button onClick={load} className="text-[11px] text-[#445DA3] hover:underline inline-flex items-center gap-1">
          <RefreshCw size={12} /> Reevaluar
        </button>
      </div>

      {loading && <div className="py-3 text-[12px] text-[#242424]/60">Evaluando entregables…</div>}

      {!loading && data && (
        <>
          <div className="mb-3">
            {data.puedeCerrar ? (
              <div className="rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45] font-semibold">
                ✓ Todos los entregables finales están completos. Ya puede generarse el paz y salvo.
              </div>
            ) : (
              <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B] font-semibold">
                Cierre bloqueado · Faltan {data.pendientes.length} entregable(s).
              </div>
            )}
          </div>
          <ul className="space-y-1.5">
            {data.requisitos.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-[12px]">
                {r.cumple
                  ? <CheckCircle2 size={16} className="mt-[1px]" style={{ color: "#1F7A45" }} />
                  : <XCircle size={16} className="mt-[1px]" style={{ color: "#B42318" }} />}
                <div>
                  <div className={r.cumple ? "text-[#242424]" : "text-[#991B1B] font-semibold"}>{r.label}</div>
                  {!r.cumple && r.detalle && <div className="text-[11px] text-[#242424]/65">{r.detalle}</div>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
