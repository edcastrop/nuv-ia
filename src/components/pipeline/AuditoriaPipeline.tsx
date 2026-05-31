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
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Auditoría del pipeline</h3>
          <p className="text-xs text-muted-foreground">
            Histórico de cambios de estado y etapas del expediente.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {cambios.length} {cambios.length === 1 ? "evento" : "eventos"}
        </span>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando historial…</p>
      ) : cambios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cambios registrados aún.</p>
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
                    : { label: "Lateral", cls: "bg-muted text-muted-foreground" };

            return (
              <li
                key={r.id}
                className="rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {fmt(r.created_at)}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${flag.cls}`}>
                    {flag.label}
                  </span>
                  <span className="rounded bg-muted px-2 py-0.5">
                    E{ant.numero} {ant.titulo}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    E{nue.numero} {nue.titulo}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {labelEstado(r.estado_caso_anterior)} → {labelEstado(r.estado_caso_nuevo)}
                  {r.accion_origen ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono">
                      {r.accion_origen}
                    </span>
                  ) : null}
                  {r.user_nombre ? (
                    <span className="ml-2">· {r.user_nombre}</span>
                  ) : null}
                </div>
                {r.observacion ? (
                  <p className="mt-1 text-xs text-foreground/80">{r.observacion}</p>
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
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {open ? "Ver menos" : `Ver todos (${cambios.length})`}
        </button>
      ) : null}
    </section>
  );
}
