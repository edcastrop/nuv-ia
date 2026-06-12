import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { PageLayout, ExecutiveHero, NCard } from "@/components/nuvia";
import { useUserRole } from "@/hooks/useUserRole";
import {
  listBandejaValidacion,
  VALIDACION_LABELS,
  VALIDACION_COLORS,
  type BandejaItem,
  type ValidacionEstado,
} from "@/lib/validacionIdentidad";

export const Route = createFileRoute("/_authenticated/contratacion/validacion")({
  component: BandejaValidacion,
  head: () => ({ meta: [{ title: "Validación · Contratación · NUVIA" }] }),
});

const FILTROS: Array<{ key: ValidacionEstado | "todos"; label: string }> = [
  { key: "en_revision_contratacion", label: "En revisión" },
  { key: "pendiente_validacion", label: "Pendientes" },
  { key: "devuelto_datos_incorrectos", label: "Devueltos" },
  { key: "bloqueado_inconsistencia", label: "Bloqueados" },
  { key: "todos", label: "Todos (activos)" },
];

function BandejaValidacion() {
  const { roles, loading: rolesLoading } = useUserRole();
  const allowed = roles.some((r) =>
    ["super_admin", "admin", "gerencia", "operaciones", "auxiliar_operativo", "juridica"].includes(r),
  );
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

  useEffect(() => {
    if (!allowed) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, allowed]);

  if (!rolesLoading && !allowed) return <Navigate to="/inicio" />;

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Contratación", tone: "blue" }}
        title="Bandeja de validación de identidad"
        description="Revisa los datos críticos del cliente antes de habilitar la generación documental."
        actions={
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
            style={{
              border: "1px solid var(--nuvia-border)",
              color: "var(--nuvia-text-primary)",
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <RefreshCw size={12} /> Recargar
          </button>
        }
      />

      <NCard padding="md">
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTROS.map((f) => {
            const active = filtro === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFiltro(f.key)}
                className="rounded-full px-3 py-1 text-[11px] font-semibold transition"
                style={{
                  border: `1px solid ${active ? "var(--nuvia-accent-blue)" : "var(--nuvia-border)"}`,
                  background: active ? "rgba(68,93,163,0.18)" : "rgba(255,255,255,0.02)",
                  color: active ? "#A5B5E0" : "var(--nuvia-text-secondary)",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {loading && (
          <div className="py-6 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            Cargando…
          </div>
        )}
        {err && (
          <div className="py-3 text-[12px]" style={{ color: "var(--nuvia-danger)" }}>
            {err}
          </div>
        )}
        {!loading && !err && items.length === 0 && (
          <div className="py-8 text-center text-[12px]" style={{ color: "var(--nuvia-text-muted)" }}>
            No hay expedientes en este filtro.
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  {["Cliente", "CC", "Banco", "Estado", "Conf. lic.", "v", "Enviado", ""].map((h, i) => (
                    <th
                      key={i}
                      className="py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--nuvia-text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const c = VALIDACION_COLORS[it.validacion_estado];
                  return (
                    <tr key={it.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                      <td className="py-2 pr-3 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {it.cliente_nombre}
                      </td>
                      <td className="py-2 pr-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {it.cedula || "—"}
                      </td>
                      <td className="py-2 pr-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {it.banco || "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
                        >
                          {VALIDACION_LABELS[it.validacion_estado]}
                        </span>
                      </td>
                      <td className="py-2 pr-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {it.validacion_confirmado_licenciado ? "Sí" : "—"}
                      </td>
                      <td className="py-2 pr-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                        v{it.validacion_version}
                      </td>
                      <td className="py-2 pr-3" style={{ color: "var(--nuvia-text-muted)" }}>
                        {it.validacion_enviado_at
                          ? new Date(it.validacion_enviado_at).toLocaleString("es-CO")
                          : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Link
                          to="/casos/$id"
                          params={{ id: it.id }}
                          className="font-semibold hover:underline"
                          style={{ color: "#A5B5E0" }}
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
      </NCard>
    </PageLayout>
  );
}
