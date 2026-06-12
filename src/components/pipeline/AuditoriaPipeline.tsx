// P7 — Auditoría del Pipeline Maestro.
// Timeline cronológico de cambios de estado del expediente, con etapas
// derivadas (1–14) y resaltado de saltos sospechosos (>1 etapa o retrocesos).

import { useEffect, useState } from "react";
import { listHistorial, labelEstado, type HistorialEntry } from "@/lib/casoEstados";
import {
  computeEtapaActual,
  getEtapaById,
  indexOfEtapa,
} from "@/lib/pipelineEtapas";

interface Props {
  expedienteId: string;
}

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

export function AuditoriaPipeline({ expedienteId }: Props) {
  const [rows, setRows] = useState<HistorialEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listHistorial(expedienteId)
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [expedienteId]);

  const cambios = rows.filter(
    (r) => r.estado_caso_anterior || r.estado_caso_nuevo,
  );
  const visibles = open ? cambios : cambios.slice(0, 8);

  return (
    <section className="rounded-2xl border border-[#E3E7EE] bg-white p-5 shadow-[0_1px_3px_rgba(36,36,36,0.04),0_8px_24px_rgba(36,36,36,0.04)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#242424]">Auditoría del pipeline</h3>
          <p className="text-xs text-[#242424]/60">
            Histórico de cambios de estado y etapas del expediente.
          </p>
        </div>
        <span className="text-xs text-[#242424]/60">
          {cambios.length} {cambios.length === 1 ? "evento" : "eventos"}
        </span>
      </header>

      {loading ? (
        <p className="text-sm text-[#242424]/60">Cargando historial…</p>
      ) : cambios.length === 0 ? (
        <p className="text-sm text-[#242424]/60">Sin cambios registrados aún.</p>
      ) : (
        <ol className="space-y-2">
          {visibles.map((r) => {
            const epAnt = computeEtapaActual({ estado_caso: r.estado_caso_anterior });
            const epNew = computeEtapaActual({ estado_caso: r.estado_caso_nuevo });
            const delta = indexOfEtapa(epNew) - indexOfEtapa(epAnt);
            const ant = getEtapaById(epAnt);
            const nue = getEtapaById(epNew);

            const flag =
              delta > 1
                ? { label: `Salto +${delta}`, cls: "bg-amber-100 text-amber-900" }
                : delta < 0
                  ? { label: `Retroceso ${delta}`, cls: "bg-rose-100 text-rose-900" }
                  : delta === 1
                    ? { label: "Avance", cls: "bg-emerald-100 text-emerald-900" }
                    : { label: "Lateral", cls: "bg-[#F1F3F8] text-[#242424]/70" };

            return (
              <li
                key={r.id}
                className="rounded-lg border border-[#E3E7EE] bg-[#F7F9FB] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-[#242424]/60">
                    {fmt(r.created_at)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${flag.cls}`}>
                    {flag.label}
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 text-[#242424]/70 ring-1 ring-[#E3E7EE]">
                    E{ant.numero} {ant.titulo}
                  </span>
                  <span className="text-[#242424]/45">→</span>
                  <span className="rounded bg-[#EEF1FA] px-2 py-0.5 font-medium text-[#445DA3]">
                    E{nue.numero} {nue.titulo}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[#242424]/60">
                  {labelEstado(r.estado_caso_anterior)} → {labelEstado(r.estado_caso_nuevo)}
                  {r.accion_origen ? (
                    <span className="ml-2 rounded bg-white px-1.5 py-0.5 font-mono ring-1 ring-[#E3E7EE]">
                      {r.accion_origen}
                    </span>
                  ) : null}
                  {r.user_nombre ? (
                    <span className="ml-2">· {r.user_nombre}</span>
                  ) : null}
                </div>
                {r.observacion ? (
                  <p className="mt-1 text-xs text-[#242424]/80">{r.observacion}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {cambios.length > 8 ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-xs font-medium text-[#445DA3] hover:underline"
        >
          {open ? "Ver menos" : `Ver todos (${cambios.length})`}
        </button>
      ) : null}
    </section>
  );
}
