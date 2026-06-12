import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  InsightCard,
  NCard,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import {
  listCarteras,
  CARTERA_ESTADO_BY_KEY,
  CARTERA_ESTADOS,
  diasMora,
  type CarteraConExpediente,
  type CarteraEstado,
} from "@/lib/cartera";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Wallet, FolderOpen, AlertTriangle, CheckCircle2, Filter } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cartera/")({
  component: CarteraDashboard,
  head: () => ({ meta: [{ title: "Centro de Cartera · NUVIA" }] }),
});

function money(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

function CarteraDashboard() {
  const { roles, loading: rolesLoading } = useUserRole();
  const [items, setItems] = useState<CarteraConExpediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string | null; email: string | null }[]>([]);

  const [estado, setEstado] = useState<CarteraEstado | "">("");
  const [responsableId, setResponsableId] = useState<string>("");
  const [banco, setBanco] = useState<string>("");
  const [moraMin, setMoraMin] = useState<string>("");

  useEffect(() => {
    supabase.from("profiles").select("id, nombre, email").eq("activo", true).then(({ data }) => setResponsables(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    listCarteras({
      estado: estado || undefined,
      responsableId: responsableId || undefined,
      banco: banco || undefined,
      diasMoraMin: moraMin ? Number(moraMin) : undefined,
    })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [estado, responsableId, banco, moraMin]);

  const totales = useMemo(() => {
    let totalHonorarios = 0, totalPagado = 0, totalSaldo = 0, enMora = 0;
    for (const c of items) {
      totalHonorarios += Number(c.honorarios_totales);
      totalPagado += Number(c.pagado);
      const saldo = Number(c.honorarios_totales) - Number(c.pagado);
      totalSaldo += saldo;
      const dm = diasMora(c.fecha_vencimiento);
      if (dm > 0 && saldo > 0) enMora++;
    }
    return { totalHonorarios, totalPagado, totalSaldo, enMora, n: items.length };
  }, [items]);

  if (rolesLoading) {
    return (
      <PageLayout>
        <div className="text-center text-sm py-24" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando…</div>
      </PageLayout>
    );
  }

  const canSee = roles.some((r) => ["super_admin", "admin", "gerencia", "cartera", "juridica", "licenciado", "asesor"].includes(r));
  if (!canSee) {
    return (
      <PageLayout>
        <EmptyState title="Sin acceso" description="No tienes permiso para ver esta sección." />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Wallet size={12} />, label: "Centro de Cartera", tone: "blue" }}
        title="Recaudo y Vencimientos"
        description="Honorarios generados tras aplicación bancaria. Vencimiento +5 días calendario."
      />

      <KpiGrid cols={4}>
        <KpiCard
          icon={<FolderOpen size={16} />}
          tone="blue"
          label="Casos en cartera"
          value={String(totales.n)}
          hint="Total visible"
        />
        <KpiCard
          icon={<Wallet size={16} />}
          tone="neutral"
          label="Honorarios totales"
          value={money(totales.totalHonorarios)}
        />
        <KpiCard
          icon={<CheckCircle2 size={16} />}
          tone="green"
          label="Recaudado"
          value={money(totales.totalPagado)}
        />
        <KpiCard
          icon={<AlertTriangle size={16} />}
          tone={totales.enMora > 0 ? "danger" : "neutral"}
          label="Casos en mora"
          value={String(totales.enMora)}
          hint={`Saldo $${Math.round(totales.totalSaldo).toLocaleString("es-CO")}`}
        />
      </KpiGrid>

      <InsightCard scope="cartera" />

      <NCard padding="md">
        <SectionHeader
          icon={<Filter size={14} />}
          title="Filtros"
          description="Refina la cartera por estado, responsable, banco o días de mora."
        />
        <div className="flex flex-wrap gap-3 items-end">
          <Field label="Estado">
            <select value={estado} onChange={(e) => setEstado(e.target.value as CarteraEstado | "")} className="nuvia-input" style={{ height: 36 }}>
              <option value="">Todos</option>
              {CARTERA_ESTADOS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="Responsable">
            <select value={responsableId} onChange={(e) => setResponsableId(e.target.value)} className="nuvia-input" style={{ height: 36 }}>
              <option value="">Todos</option>
              {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre || r.email}</option>)}
            </select>
          </Field>
          <Field label="Banco">
            <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="p.ej. Davivienda" className="nuvia-input" style={{ height: 36 }} />
          </Field>
          <Field label="Mora mínima (días)">
            <input type="number" min={0} value={moraMin} onChange={(e) => setMoraMin(e.target.value)} className="nuvia-input" style={{ height: 36, width: 120 }} />
          </Field>
          <button
            onClick={() => { setEstado(""); setResponsableId(""); setBanco(""); setMoraMin(""); }}
            className="text-[11px] font-semibold"
            style={{ color: "var(--nuvia-accent-blue)" }}
          >Limpiar filtros</button>
        </div>
      </NCard>

      <NCard padding="md">
        <SectionHeader title="Listado de cartera" description={`${items.length} registros`} />
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando carteras…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin resultados"
            description="No hay carteras que coincidan con los filtros actuales."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Cliente", a: "left" },
                    { l: "Banco", a: "left" },
                    { l: "Honorarios", a: "right" },
                    { l: "Pagado", a: "right" },
                    { l: "Saldo", a: "right" },
                    { l: "Vencimiento", a: "left" },
                    { l: "Mora", a: "left" },
                    { l: "Estado", a: "left" },
                    { l: "Responsable", a: "left" },
                    { l: "", a: "left" },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-3 py-2.5 font-semibold uppercase"
                      style={{
                        textAlign: h.a as "left" | "right",
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                        borderBottom: "1px solid var(--nuvia-border)",
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((c) => {
                  const saldo = Number(c.honorarios_totales) - Number(c.pagado);
                  const dm = diasMora(c.fecha_vencimiento);
                  const def = CARTERA_ESTADO_BY_KEY[c.estado_cartera];
                  return (
                    <tr
                      key={c.id}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-3 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {c.expediente?.cliente_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.expediente?.banco ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {money(Number(c.honorarios_totales))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-success)" }}>
                        {money(Number(c.pagado))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {money(saldo)}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.fecha_vencimiento}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: dm > 0 ? "var(--nuvia-danger)" : "var(--nuvia-text-secondary)" }}>
                        {dm > 0 ? `${dm} días` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                          style={{ color: def.color, background: def.bg }}
                        >
                          {def.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11.5px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.responsable?.nombre || c.responsable?.email || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          to="/cartera/$id"
                          params={{ id: c.id }}
                          className="text-[11px] font-semibold hover:underline"
                          style={{ color: "var(--nuvia-accent-blue)" }}
                        >
                          Abrir →
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="nuvia-label">{label}</span>
      {children}
    </label>
  );
}
