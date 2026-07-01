import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  nombre_cliente: string | null;
  cedula_cliente: string | null;
  updated_at: string;
  credito: unknown;
};

interface Props {
  currentId: string;
  cedula: string | null | undefined;
}

/**
 * Panel "Otros créditos de este cliente".
 * Agrupa por cédula todos los expedientes del mismo titular.
 * Cada uno mantiene su propio Poder + Ficha Contractual (documentos independientes por obligación).
 */
export function OtrosCreditosCliente({ currentId, cedula }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = (cedula ?? "").trim();
    if (!c) { setRows([]); return; }
    setLoading(true);
    supabase
      .from("expediente_maestro")
      .select("id,nombre_cliente,cedula_cliente,updated_at,credito")
      .eq("cedula_cliente", c)
      .neq("id", currentId)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setRows((data ?? []) as Row[]);
        setLoading(false);
      });
  }, [currentId, cedula]);

  if (!cedula) return null;
  if (!loading && rows.length === 0) return null;

  return (
    <section className="glass-panel p-4 md:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Layers className="h-4 w-4 text-[var(--nuvia-accent-green)]" />
        <h2 className="text-sm font-semibold text-[var(--nuvia-text-primary)]">
          Otros créditos de este cliente
        </h2>
        <span className="rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--nuvia-text-secondary)]">
          {rows.length}
        </span>
        <span className="ml-2 text-[10px] text-[var(--nuvia-text-secondary)]">
          Cada crédito genera su propio Poder y Ficha Contractual.
        </span>
      </div>
      {loading ? (
        <div className="text-xs text-[var(--nuvia-text-secondary)]">Cargando…</div>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((r) => {
            const cr = (r.credito ?? {}) as { banco?: string; numero_credito?: string; producto?: string };
            return (
              <Link
                key={r.id}
                to="/expediente-maestro/$id"
                params={{ id: r.id }}
                className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-3 py-2 transition hover:border-[var(--nuvia-accent-blue)] hover:bg-[rgba(255,255,255,0.065)]"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--nuvia-text-primary)]">
                    {cr.banco || "Banco s/d"}
                    {cr.producto ? <span className="ml-1 text-xs font-normal text-[var(--nuvia-text-secondary)]">· {cr.producto}</span> : null}
                  </div>
                  <div className="truncate text-[11px] text-[var(--nuvia-text-secondary)]">
                    {cr.numero_credito ? <>N° {cr.numero_credito} · </> : null}
                    act. {new Date(r.updated_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-[var(--nuvia-text-secondary)] group-hover:text-[var(--nuvia-accent-blue)]" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
