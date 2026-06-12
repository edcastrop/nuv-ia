import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wallet, AlertTriangle, Filter, Sparkles, Inbox } from "lucide-react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  EmptyState,
  InsightCard,
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

const money = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function CarteraDashboardView({ titulo, subtitulo }: { titulo: string; subtitulo: string }) {
  const [items, setItems] = useState<CarteraConExpediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsables, setResponsables] = useState<{ id: string; nombre: string | null; email: string | null }[]>([]);

  const [estado, setEstado] = useState<CarteraEstado | "">("");
  const [responsableId, setResponsableId] = useState("");
  const [banco, setBanco] = useState("");
  const [moraMin, setMoraMin] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nombre, email")
      .eq("activo", true)
      .then(({ data }) => setResponsables(data ?? []));
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
    let th = 0, tp = 0, ts = 0, enMora = 0;
    for (const c of items) {
      th += Number(c.honorarios_totales);
      tp += Number(c.pagado);
      const saldo = Number(c.honorarios_totales) - Number(c.pagado);
      ts += saldo;
      if (diasMora(c.fecha_vencimiento) > 0 && saldo > 0) enMora++;
    }
    return { th, tp, ts, enMora, n: items.length };
  }, [items]);

  return (
    <PageLayout maxWidth="7xl">
      <ExecutiveHero
        badge={{ icon: <Wallet size={12} />, label: "Cartera y Recaudo", tone: "blue" }}
        title={titulo}
        description={subtitulo}
        meta={
          totales.enMora > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{
                background: "rgba(255,107,107,0.12)",
                border: "1px solid rgba(255,107,107,0.35)",
                color: "#FF8585",
              }}
            >
              <AlertTriangle size={12} />
              {totales.enMora} en mora
            </span>
          ) : null
        }
      />

      <KpiGrid cols={4}>
        <KpiCard label="Casos" value={String(totales.n)} tone="neutral" />
        <KpiCard label="Honorarios totales" value={money(totales.th)} tone="blue" />
        <KpiCard label="Pagado" value={money(totales.tp)} tone="green" />
        <KpiCard label="Saldo" value={money(totales.ts)} tone="warning" />
      </KpiGrid>

      <InsightCard scope="dashboard" />

      <NCard padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div
            className="flex items-center gap-1.5 text-[11px] font-semibold uppercase mr-1"
            style={{ color: "var(--nuvia-text-secondary)", letterSpacing: "0.12em" }}
          >
            <Filter size={12} />
            Filtros
          </div>
          <Field label="Estado">
            <Select value={estado} onChange={(e) => setEstado(e.target.value as CarteraEstado | "")}>
              <option value="">Todos</option>
              {CARTERA_ESTADOS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Responsable">
            <Select value={responsableId} onChange={(e) => setResponsableId(e.target.value)}>
              <option value="">Todos</option>
              {responsables.map((r) => (
                <option key={r.id} value={r.id}>{r.nombre || r.email}</option>
              ))}
            </Select>
          </Field>
          <Field label="Banco">
            <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="p.ej. Davivienda" />
          </Field>
          <Field label="Mora mínima (días)">
            <Input
              type="number"
              min={0}
              value={moraMin}
              onChange={(e) => setMoraMin(e.target.value)}
              className="w-28"
            />
          </Field>
          <button
            onClick={() => { setEstado(""); setResponsableId(""); setBanco(""); setMoraMin(""); }}
            className="text-[11px] font-semibold hover:underline"
            style={{ color: "var(--nuvia-accent-blue)" }}
          >
            Limpiar filtros
          </button>
        </div>
      </NCard>

      <NCard padding="none">
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Cargando carteras…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} />}
            title="No hay carteras que coincidan"
            description="Ajusta los filtros o limpia la búsqueda para ver más resultados."
            hint="NUVIA IA: revisa los casos con mayor saldo pendiente para priorizar recaudo."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {["Cliente", "Banco", "Honorarios", "Pagado", "Saldo", "Vencimiento", "Mora", "Estado", "Responsable", ""].map((h, i) => (
                    <th
                      key={i}
                      className="px-4 py-2.5 font-semibold uppercase"
                      style={{
                        textAlign: i >= 2 && i <= 4 ? "right" : "left",
                        fontSize: "10.5px",
                        letterSpacing: "0.12em",
                        color: "var(--nuvia-text-secondary)",
                      }}
                    >
                      {h}
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
                      className="transition-colors"
                      style={{ borderTop: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {c.expediente?.cliente_nombre}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.expediente?.banco ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {money(Number(c.honorarios_totales))}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-success)" }}>
                        {money(Number(c.pagado))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {money(saldo)}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.fecha_vencimiento}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: dm > 0 ? "var(--nuvia-danger)" : "var(--nuvia-text-secondary)" }}>
                        {dm > 0 ? `${dm} días` : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                          style={{ color: def.color, background: def.bg }}
                        >
                          {def.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[11.5px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {c.responsable?.nombre || c.responsable?.email || "—"}
                      </td>
                      <td className="px-4 py-2.5">
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

      <NCard padding="sm">
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
          <Sparkles size={12} style={{ color: "var(--nuvia-accent-green)" }} />
          NUVIA IA · Recomendación: prioriza recaudo de los casos con saldo &gt; promedio y mora &gt; 15 días.
        </div>
      </NCard>
    </PageLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span
        className="uppercase font-semibold"
        style={{
          fontSize: "10.5px",
          letterSpacing: "0.12em",
          color: "var(--nuvia-text-secondary)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`text-[12px] rounded-lg px-2.5 py-1.5 ${props.className ?? ""}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--nuvia-border)",
        color: "var(--nuvia-text-primary)",
        ...(props.style ?? {}),
      }}
    />
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`text-[12px] rounded-lg px-2.5 py-1.5 ${props.className ?? ""}`}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--nuvia-border)",
        color: "var(--nuvia-text-primary)",
        ...(props.style ?? {}),
      }}
    />
  );
}
