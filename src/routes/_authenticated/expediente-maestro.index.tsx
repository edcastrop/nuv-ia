import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listMaestros, upsertMaestro, deleteMaestro,
  emptyCliente, emptyCotitular, emptyCredito, emptyFresh,
  emptyAsesor, emptyLicenciado, emptyApoderado,
  type ExpedienteMaestro,
} from "@/lib/expedienteMaestro";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expediente-maestro/")({
  component: MaestroIndex,
  head: () => ({ meta: [{ title: "Expediente Maestro · NUVEX" }] }),
});

function MaestroIndex() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ExpedienteMaestro[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const reload = () => {
    setLoading(true);
    listMaestros(search).then(setRows).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  const crear = async () => {
    setCreating(true);
    try {
      const e = await upsertMaestro({
        cliente: emptyCliente(), cotitular: emptyCotitular(), credito: emptyCredito(),
        fresh: emptyFresh(), asesor: emptyAsesor(), licenciado: emptyLicenciado(), apoderado: emptyApoderado(),
      });
      navigate({ to: "/expediente-maestro/$id", params: { id: e.id } });
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>NUVEX</div>
            <h1 className="text-2xl font-semibold text-[#242424]">Expediente Maestro</h1>
            <p className="text-sm text-[#242424]/60 mt-1">
              Información permanente del cliente. Independiente de simuladores y propuestas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") reload(); }}
              placeholder="Buscar por nombre o cédula..."
              className="rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm w-72 outline-none focus:border-[#445DA3]"
            />
            <button onClick={reload} className="rounded-lg border border-[#E3E7EE] px-3 py-2 text-xs font-medium">Buscar</button>
            <button
              onClick={crear}
              disabled={creating}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
              style={{ backgroundColor: NUVEX.azul }}
            >
              <Plus size={14} /> {creating ? "Creando..." : "Nuevo expediente"}
            </button>
          </div>
        </div>
      </Card>

      <Card>
        {loading && <div className="p-6 text-center text-sm text-[#242424]/60">Cargando…</div>}
        {err && <div className="p-6 text-center text-sm text-[#B42318]">{err}</div>}
        {!loading && !err && rows.length === 0 && (
          <div className="p-10 text-center text-sm text-[#242424]/60">Aún no hay expedientes maestros.</div>
        )}
        {!loading && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Cédula</th>
                  <th className="py-2 pr-4">Banco</th>
                  <th className="py-2 pr-4">Producto</th>
                  <th className="py-2 pr-4">Actualizado</th>
                  <th className="py-2 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[#F0F2F6] hover:bg-[#F7F9FB]">
                    <td className="py-2.5 pr-4">
                      <Link to="/expediente-maestro/$id" params={{ id: r.id }} className="font-medium text-[#242424] hover:underline">
                        {r.nombre_cliente}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-[#242424]/70">{r.cedula_cliente || "—"}</td>
                    <td className="py-2.5 pr-4 text-[#242424]/70">{r.credito?.banco || "—"}</td>
                    <td className="py-2.5 pr-4 text-[#242424]/70">{r.credito?.tipoProducto || "—"}</td>
                    <td className="py-2.5 pr-4 text-[#242424]/60 text-xs">{new Date(r.updated_at).toLocaleString("es-CO")}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`¿Eliminar el expediente de ${r.nombre_cliente}?`)) return;
                          try { await deleteMaestro(r.id); reload(); } catch (e) { alert((e as Error).message); }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[#F5C2C2] bg-[#FDECEC] px-2 py-1 text-[11px] font-medium text-[#B42318]"
                      >
                        <Trash2 size={12} /> Eliminar
                      </button>
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
