import { useEffect, useState } from "react";
import { Card } from "@/components/nuvex/ui";
import { ShieldCheck, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { evaluarRequisitosRadicacion, type ResultadoValidacionRadicacion } from "@/lib/validacionRadicacion";
import { NUVEX } from "@/components/nuvex/constants";

export function ValidacionRadicacionBlock({ expedienteId }: { expedienteId: string }) {
  const [data, setData] = useState<ResultadoValidacionRadicacion | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await evaluarRequisitosRadicacion(expedienteId)); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [expedienteId]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} style={{ color: NUVEX.azul }} />
          <h3 className="text-sm font-semibold text-[#242424]">Control de calidad: requisitos para radicar en banco</h3>
        </div>
        <button onClick={load} className="text-[11px] text-[#445DA3] hover:underline inline-flex items-center gap-1">
          <RefreshCw size={12} /> Reevaluar
        </button>
      </div>

      {loading && <div className="py-3 text-[12px] text-[#242424]/60">Evaluando requisitos…</div>}

      {!loading && data && (
        <>
          <div className="mb-3">
            {data.puedeRadicar ? (
              <div className="rounded-lg border border-[#A6E2B6] bg-[#DDF4E3] px-3 py-2 text-[12px] text-[#1F7A45] font-semibold">
                ✓ El expediente cumple los requisitos. Ya puede radicarse en el banco.
              </div>
            ) : (
              <div className="rounded-lg border border-[#FCA5A5] bg-[#FEE2E2] px-3 py-2 text-[12px] text-[#991B1B] font-semibold">
                Radicación bloqueada · Faltan {data.pendientes.length} requisito(s).
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
