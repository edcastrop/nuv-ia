import { useEffect, useState } from "react";
import { NCard, SectionHeader } from "@/components/nuvia";
import { Flag, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { evaluarEntregablesFinales, type ResultadoValidacionEntregables } from "@/lib/validacionEntregablesFinales";

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
    <NCard variant="elevated">
      <SectionHeader
        icon={<Flag size={16} />}
        title="Entregables finales"
        description="Requisitos para cerrar el caso."
        action={
          <button
            onClick={load}
            className="text-[11px] inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--nuvia-accent-blue)" }}
          >
            <RefreshCw size={12} /> Reevaluar
          </button>
        }
      />

      {loading && (
        <div className="py-3 text-[12px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          Evaluando entregables…
        </div>
      )}

      {!loading && data && (
        <>
          <div className="mb-3">
            {data.puedeCerrar ? (
              <div
                className="rounded-lg px-3 py-2 text-[12px] font-semibold"
                style={{
                  background: "rgba(125,232,176,0.14)",
                  border: "1px solid rgba(125,232,176,0.32)",
                  color: "#7DE8B0",
                }}
              >
                ✓ Todos los entregables finales están completos. Ya puede generarse el paz y salvo.
              </div>
            ) : (
              <div
                className="rounded-lg px-3 py-2 text-[12px] font-semibold"
                style={{
                  background: "rgba(255,107,107,0.14)",
                  border: "1px solid rgba(255,107,107,0.32)",
                  color: "#FFB4B4",
                }}
              >
                Cierre bloqueado · Faltan {data.pendientes.length} entregable(s).
              </div>
            )}
          </div>
          <ul className="space-y-1.5">
            {data.requisitos.map((r) => (
              <li key={r.key} className="flex items-start gap-2 text-[12px]">
                {r.cumple
                  ? <CheckCircle2 size={16} className="mt-[1px]" style={{ color: "#7DE8B0" }} />
                  : <XCircle size={16} className="mt-[1px]" style={{ color: "#FFB4B4" }} />}
                <div>
                  <div
                    style={{
                      color: r.cumple ? "var(--nuvia-text-primary)" : "#FFB4B4",
                      fontWeight: r.cumple ? 400 : 600,
                    }}
                  >
                    {r.label}
                  </div>
                  {!r.cumple && r.detalle && (
                    <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {r.detalle}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </NCard>
  );
}
