import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { listExpedientes, ESTADOS, type EstadoExpediente, type Expediente } from "@/lib/expedientes";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import { formatCOP } from "@/lib/format";
import { Card, SectionTitle } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";

export const Route = createFileRoute("/_authenticated/casos")({
  component: CasosPage,
  head: () => ({ meta: [{ title: "Casos · NUVEX" }] }),
});

function CasosPage() {
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState<EstadoExpediente | "">("");
  const [rows, setRows] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    listExpedientes({ search, estado })
      .then((r) => { if (!cancel) setRows(r); })
      .catch((e) => { if (!cancel) setErr(e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [search, estado]);

  const totals = useMemo(() => ({
    total: rows.length,
    honorarios: rows.reduce((s, r) => s + Number(r.honorarios_final || 0), 0),
  }), [rows]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <SectionTitle sub="Expedientes de simulación guardados. Cada uno alimenta el resultado final y la cuenta de cobro.">Gestión de Casos</SectionTitle>
          <Link to="/" className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: NUVEX.azul }}>
            + Nueva simulación
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-3 mt-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula, # crédito o banco…"
            className="rounded-lg border border-[#E3E7EE] px-3 py-2.5 text-sm outline-none focus:border-[#445DA3] focus:ring-2 focus:ring-[#445DA3]/15 md:col-span-2"
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoExpediente | "")}
            className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#445DA3]"
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-[#242424]/65">
          <div><span className="font-semibold text-[#242424]">{totals.total}</span> expedientes</div>
          <div><span className="font-semibold text-[#242424]">{formatCOP(totals.honorarios)}</span> en honorarios finales</div>
        </div>
      </Card>

      <Card>
        {err && <div className="text-sm text-[#B42318] mb-3">{err}</div>}
        {loading ? (
          <div className="py-12 text-center text-sm text-[#242424]/60">Cargando expedientes…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#242424]/60">
            No hay expedientes que coincidan. {!search && !estado && (
              <>Crea tu primer caso desde el <Link to="/" className="text-[#445DA3] font-semibold hover:underline">simulador</Link>.</>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Cédula</th>
                  <th className="py-2 pr-3">Banco</th>
                  <th className="py-2 pr-3"># Crédito</th>
                  <th className="py-2 pr-3">Modo</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3 text-right">Honorarios</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F0F3F8] hover:bg-[#F7F9FB]">
                    <td className="py-2.5 pr-3 font-medium text-[#242424]">{r.cliente_nombre}</td>
                    <td className="py-2.5 pr-3 text-[#242424]/75">{r.cedula || "—"}</td>
                    <td className="py-2.5 pr-3 text-[#242424]/75">{r.banco || "—"}</td>
                    <td className="py-2.5 pr-3 text-[#242424]/75">{r.numero_credito || "—"}</td>
                    <td className="py-2.5 pr-3 uppercase text-[10px] font-bold text-[#445DA3]">{r.modo}</td>
                    <td className="py-2.5 pr-3 text-[#242424]/75">{r.fecha_simulacion}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold">{formatCOP(Number(r.honorarios_final))}</td>
                    <td className="py-2.5 pr-3"><EstadoBadge estado={r.estado} /></td>
                    <td className="py-2.5">
                      <Link to="/casos/$id" params={{ id: r.id }}
                        className="text-[#445DA3] font-semibold text-xs hover:underline">
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
