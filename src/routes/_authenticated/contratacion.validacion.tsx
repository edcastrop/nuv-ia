import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import {
  listBandejaValidacion,
  VALIDACION_LABELS,
  VALIDACION_COLORS,
  type BandejaItem,
  type ValidacionEstado,
} from "@/lib/validacionIdentidad";

export const Route = createFileRoute("/_authenticated/contratacion/validacion")({
  component: BandejaValidacion,
  head: () => ({ meta: [{ title: "Validación · Contratación · NUVEX" }] }),
});

const FILTROS: Array<{ key: ValidacionEstado | "todos"; label: string }> = [
  { key: "en_revision_contratacion", label: "En revisión" },
  { key: "pendiente_validacion", label: "Pendientes" },
  { key: "devuelto_datos_incorrectos", label: "Devueltos" },
  { key: "bloqueado_inconsistencia", label: "Bloqueados" },
  { key: "todos", label: "Todos (activos)" },
];

function BandejaValidacion() {
  const [items, setItems] = useState<BandejaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<ValidacionEstado | "todos">("en_revision_contratacion");

  const reload = () => {
    setLoading(true);
    listBandejaValidacion(filtro)
      .then(setItems)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, [filtro]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.negro})` }}
            >
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
                Contratación
              </div>
              <h1 className="text-2xl font-semibold text-[#242424]">Bandeja de validación de identidad</h1>
              <p className="text-xs text-[#242424]/60 mt-0.5">
                Revisa los datos críticos del cliente antes de habilitar la generación documental.
              </p>
            </div>
          </div>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "#E3E7EE" }}
          >
            <RefreshCw size={12} /> Recargar
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2 mb-3">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className="rounded-full border px-3 py-1 text-xs font-medium"
              style={{
                borderColor: filtro === f.key ? NUVEX.azul : "#E3E7EE",
                background: filtro === f.key ? NUVEX.azul : "#fff",
                color: filtro === f.key ? "#fff" : "#242424",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div className="text-sm text-[#242424]/60 py-6 text-center">Cargando…</div>}
        {err && <div className="text-sm text-[#B42318] py-3">{err}</div>}
        {!loading && !err && items.length === 0 && (
          <div className="text-sm text-[#242424]/60 py-6 text-center">No hay expedientes en este filtro.</div>
        )}

        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#242424]/60 border-b border-[#E3E7EE]">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">CC</th>
                  <th className="py-2 pr-3">Banco</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Conf. lic.</th>
                  <th className="py-2 pr-3">v</th>
                  <th className="py-2 pr-3">Enviado</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const c = VALIDACION_COLORS[it.validacion_estado];
                  return (
                    <tr key={it.id} className="border-b border-[#F0F2F6] hover:bg-[#FAFBFC]">
                      <td className="py-2 pr-3 font-medium text-[#242424]">{it.cliente_nombre}</td>
                      <td className="py-2 pr-3">{it.cedula || "—"}</td>
                      <td className="py-2 pr-3">{it.banco || "—"}</td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                        >
                          {VALIDACION_LABELS[it.validacion_estado]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{it.validacion_confirmado_licenciado ? "Sí" : "—"}</td>
                      <td className="py-2 pr-3">v{it.validacion_version}</td>
                      <td className="py-2 pr-3 text-[#242424]/60">
                        {it.validacion_enviado_at
                          ? new Date(it.validacion_enviado_at).toLocaleString("es-CO")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link
                          to="/casos/$id"
                          params={{ id: it.id }}
                          className="text-[#445DA3] hover:underline font-medium"
                        >
                          Revisar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
