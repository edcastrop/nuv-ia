import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listMaestros, upsertMaestro, deleteMaestro,
  emptyCliente, emptyCotitular, emptyCredito, emptyFresh,
  emptyAsesor, emptyLicenciado, emptyApoderado,
  type ExpedienteMaestro,
} from "@/lib/expedienteMaestro";
import { Plus, Trash2, Search, RefreshCw, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/expediente-maestro/")({
  component: MaestroIndex,
  head: () => ({ meta: [{ title: "Expediente Maestro · NUVIA" }] }),
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
    <div
      className="min-h-[calc(100vh-72px)] px-3 py-4 text-[var(--nuvia-text-primary)] md:px-5"
      style={{
        background:
          "linear-gradient(180deg, var(--nuvia-bg-primary) 0%, var(--nuvia-bg-secondary) 54%, var(--nuvia-bg-primary) 100%)",
      }}
    >
      <div className="mx-auto max-w-[1680px] space-y-4">
        <section className="glass-panel overflow-hidden p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase text-[var(--nuvia-accent-green)]">
                NUVIA · Expedientes
              </div>
              <h1 className="mt-1 text-2xl font-semibold leading-tight text-[var(--nuvia-text-primary)]">
                Expediente Maestro
              </h1>
              <div className="mt-1 text-sm text-[var(--nuvia-text-secondary)]">
                Información permanente del cliente. Independiente de simuladores y propuestas.
              </div>
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
              <div className="relative w-full sm:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--nuvia-text-secondary)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") reload(); }}
                  placeholder="Buscar por nombre o cédula…"
                  className="h-10 w-full rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] pl-9 pr-3 text-sm text-[var(--nuvia-text-primary)] outline-none placeholder:text-[rgba(170,179,197,0.55)] focus:border-[var(--nuvia-accent-blue)] focus:ring-2 focus:ring-[rgba(68,93,163,0.22)]"
                />
              </div>
              <button
                onClick={reload}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] px-3 text-sm text-[var(--nuvia-text-secondary)] transition hover:border-[var(--nuvia-border-strong)] hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 text-[var(--nuvia-accent-green)] ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </button>
              <button
                onClick={crear}
                disabled={creating}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-transparent px-4 text-sm font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "var(--nuvia-gradient-primary)" }}
              >
                <Plus className="h-4 w-4" /> {creating ? "Creando…" : "Nuevo expediente"}
              </button>
            </div>
          </div>
        </section>

        {!loading && !err && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="glass-card p-3">
              <div className="text-[11px] uppercase text-[var(--nuvia-text-secondary)]">Expedientes</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--nuvia-text-primary)]">{rows.length}</div>
            </div>
            <div className="glass-card p-3">
              <div className="text-[11px] uppercase text-[var(--nuvia-text-secondary)]">Con cédula</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--nuvia-accent-blue)]">
                {rows.filter((r) => r.cedula_cliente).length}
              </div>
            </div>
            <div className="glass-card p-3">
              <div className="text-[11px] uppercase text-[var(--nuvia-text-secondary)]">Con banco</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--nuvia-accent-green)]">
                {rows.filter((r) => r.credito?.banco).length}
              </div>
            </div>
            <div className="glass-card p-3">
              <div className="text-[11px] uppercase text-[var(--nuvia-text-secondary)]">Visibles</div>
              <div className="mt-1 text-2xl font-semibold text-[var(--nuvia-text-primary)]">{rows.length}</div>
            </div>
          </div>
        )}

        <section className="glass-panel overflow-hidden">
          {loading && (
            <div className="p-10 text-center text-sm text-[var(--nuvia-text-secondary)]">Cargando…</div>
          )}
          {err && (
            <div className="p-10 text-center text-sm text-[var(--nuvia-danger)]">{err}</div>
          )}
          {!loading && !err && rows.length === 0 && (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: "color-mix(in oklab, var(--nuvia-accent-blue) 18%, transparent)" }}
              >
                <FolderOpen className="h-6 w-6 text-[var(--nuvia-accent-blue)]" />
              </div>
              <div className="text-sm text-[var(--nuvia-text-secondary)]">Aún no hay expedientes maestros.</div>
              <button
                onClick={crear}
                disabled={creating}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)]"
                style={{ background: "var(--nuvia-gradient-primary)" }}
              >
                <Plus className="h-4 w-4" /> Crear primer expediente
              </button>
            </div>
          )}
          {!loading && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
                    <th className="px-4 py-3 font-semibold">Cliente</th>
                    <th className="px-4 py-3 font-semibold">Cédula</th>
                    <th className="px-4 py-3 font-semibold">Banco</th>
                    <th className="px-4 py-3 font-semibold">Producto</th>
                    <th className="px-4 py-3 font-semibold">Actualizado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-t border-[var(--nuvia-border)] transition hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to="/expediente-maestro/$id"
                          params={{ id: r.id }}
                          className="font-medium text-[var(--nuvia-text-primary)] hover:text-[var(--nuvia-accent-green)] hover:underline"
                        >
                          {r.nombre_cliente || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--nuvia-text-secondary)]">{r.cedula_cliente || "—"}</td>
                      <td className="px-4 py-3 text-[var(--nuvia-text-secondary)]">{r.credito?.banco || "—"}</td>
                      <td className="px-4 py-3 text-[var(--nuvia-text-secondary)]">{r.credito?.tipoProducto || "—"}</td>
                      <td className="px-4 py-3 text-xs text-[var(--nuvia-text-secondary)]">
                        {new Date(r.updated_at).toLocaleString("es-CO")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Eliminar el expediente de ${r.nombre_cliente}?`)) return;
                            try { await deleteMaestro(r.id); reload(); } catch (e) { alert((e as Error).message); }
                          }}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition hover:brightness-110"
                          style={{
                            borderColor: "color-mix(in oklab, var(--nuvia-danger) 40%, transparent)",
                            background: "color-mix(in oklab, var(--nuvia-danger) 14%, transparent)",
                            color: "var(--nuvia-danger)",
                          }}
                        >
                          <Trash2 className="h-3 w-3" /> Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
