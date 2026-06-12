import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
  EmptyState,
  InsightCard,
} from "@/components/nuvia";
import { formatCOP } from "@/lib/format";
import {
  listMisComisiones,
  listTodasComisiones,
  listCuentasCobro,
  crearCuentaCobro,
  saldoDisponibleComision,
  pendienteRecaudoComision,
  type Comision,
  type CuentaCobro,
} from "@/lib/comisiones";
import {
  AlertTriangle,
  BellRing,
  CircleDollarSign,
  FileText,
  Plus,
  TrendingUp,
  Wallet,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones/")({
  component: ComisionesPage,
  head: () => ({ meta: [{ title: "Mis comisiones · NUVIA" }] }),
});

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "rgba(68,93,163,0.18)", color: "#A5B5E0", label: "Borrador" },
  enviada: { bg: "rgba(68,93,163,0.22)", color: "#A5B5E0", label: "Enviada" },
  aprobada: { bg: "rgba(132,185,143,0.20)", color: "#B6D9BD", label: "Aprobada" },
  devuelta_correccion: { bg: "rgba(245,158,11,0.18)", color: "#FACC15", label: "Devuelta" },
  rechazada: { bg: "rgba(239,68,68,0.18)", color: "#FCA5A5", label: "Rechazada" },
  programada_pago: { bg: "rgba(99,102,241,0.18)", color: "#A5B4FC", label: "Programada" },
  pagada: { bg: "rgba(132,185,143,0.28)", color: "#B6D9BD", label: "Pagada" },
};

function ComisionesPage() {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const esManager = roles.some((r) =>
    ["admin", "gerencia", "super_admin", "cartera", "contabilidad"].includes(r),
  );
  const [comisiones, setComisiones] = useState<Comision[]>([]);
  const [cuentas, setCuentas] = useState<CuentaCobro[]>([]);
  const [expedientes, setExpedientes] = useState<Map<string, { cliente: string; banco: string | null }>>(new Map());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [observ, setObserv] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const cargar = async () => {
    if (!user) return;
    setLoading(true);
    const [com, cc] = await Promise.all([
      esManager ? listTodasComisiones() : listMisComisiones(user.id),
      listCuentasCobro(esManager ? {} : { userId: user.id }),
    ]);
    setComisiones(com);
    setCuentas(cc);
    const ids = Array.from(new Set(com.map((c) => c.expediente_id)));
    if (ids.length) {
      const { data } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco")
        .in("id", ids);
      const m = new Map<string, { cliente: string; banco: string | null }>();
      (data ?? []).forEach((e) => m.set(e.id, { cliente: e.cliente_nombre, banco: e.banco }));
      setExpedientes(m);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) cargar();
  }, [user]);

  const disponibles = useMemo(
    () => comisiones.filter((c) => saldoDisponibleComision(c) > 0),
    [comisiones],
  );

  const totalSeleccionado = useMemo(
    () =>
      disponibles
        .filter((c) => selected.has(c.id))
        .reduce((s, c) => s + saldoDisponibleComision(c), 0),
    [disponibles, selected],
  );

  const totales = useMemo(() => {
    let potencial = 0, liberada = 0, pagada = 0, recaudado = 0, contratado = 0;
    for (const c of comisiones) {
      potencial += Number(c.comision_potencial || 0);
      liberada += Number(c.comision_liberada || 0);
      pagada += Number(c.comision_pagada || 0);
      recaudado += Number(c.recaudado || 0);
      contratado += Number(c.honorarios_contratados || c.base || 0);
    }
    return {
      potencial,
      liberada,
      pagada,
      pendiente: Math.max(0, liberada - pagada),
      por_recaudar: Math.max(0, potencial - liberada),
      recaudado,
      contratado,
    };
  }, [comisiones]);

  const ccDevueltas = useMemo(
    () => cuentas.filter((cc) => cc.estado === "devuelta_correccion"),
    [cuentas],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const generar = async () => {
    if (!user || selected.size === 0) return;
    setCreating(true);
    try {
      await crearCuentaCobro(user.id, Array.from(selected), observ.trim() || undefined);
      setSelected(new Set());
      setObserv("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <CircleDollarSign size={12} />, label: esManager ? "Comisiones · Vista global" : "Mis comisiones", tone: "blue" }}
        title={esManager ? "Comisiones (todas)" : "Mis comisiones"}
        description="Las comisiones se liberan únicamente sobre el dinero efectivamente recaudado por NUVIA en cartera."
        actions={
          esManager ? (
            <Link
              to="/contabilidad/cuentas-cobro"
              className="text-[12px] font-semibold px-3 py-2 rounded-lg border transition-colors"
              style={{
                color: "var(--nuvia-accent-blue)",
                borderColor: "var(--nuvia-border)",
                background: "rgba(68,93,163,0.10)",
              }}
            >
              Panel contabilidad →
            </Link>
          ) : undefined
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          icon={<TrendingUp size={16} />}
          tone="blue"
          label="Comisión potencial"
          value={formatCOP(totales.potencial)}
          hint={`Por recaudar ${formatCOP(totales.por_recaudar)}`}
        />
        <KpiCard
          icon={<CircleDollarSign size={16} />}
          tone="green"
          label="Comisión liberada"
          value={formatCOP(totales.liberada)}
        />
        <KpiCard
          icon={<Wallet size={16} />}
          tone="green"
          label="Comisión pagada"
          value={formatCOP(totales.pagada)}
        />
        <KpiCard
          icon={<Clock size={16} />}
          tone="warning"
          label="Pendiente de pago"
          value={formatCOP(totales.pendiente)}
        />
      </KpiGrid>

      {(disponibles.length > 0 || ccDevueltas.length > 0) && (
        <div className="flex flex-col gap-2">
          {disponibles.length > 0 && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3 text-[12.5px]"
              style={{
                border: "1px solid rgba(132,185,143,0.30)",
                background: "rgba(132,185,143,0.08)",
                color: "#D7EBDB",
              }}
            >
              <BellRing size={16} className="mt-0.5" style={{ color: "var(--nuvia-success)" }} />
              <div>
                <div className="font-semibold" style={{ color: "#E8F4EB" }}>
                  Tienes comisión disponible para generar cuenta de cobro.
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(215,235,219,0.85)" }}>
                  {disponibles.length} caso{disponibles.length !== 1 ? "s" : ""} con saldo liberado por recaudo real ·{" "}
                  <strong>{formatCOP(totales.pendiente)}</strong> disponible.
                </div>
              </div>
            </div>
          )}
          {ccDevueltas.length > 0 && (
            <div
              className="flex items-start gap-3 rounded-xl px-4 py-3 text-[12.5px]"
              style={{
                border: "1px solid rgba(250,204,21,0.35)",
                background: "rgba(250,204,21,0.08)",
                color: "#FDE68A",
              }}
            >
              <AlertTriangle size={16} className="mt-0.5" style={{ color: "#FACC15" }} />
              <div>
                <div className="font-semibold">
                  {ccDevueltas.length} cuenta{ccDevueltas.length !== 1 ? "s" : ""} devuelta
                  {ccDevueltas.length !== 1 ? "s" : ""} para corrección
                </div>
                <div className="text-[11.5px] mt-0.5" style={{ color: "rgba(253,230,138,0.85)" }}>
                  Revisa el detalle y vuelve a enviarla a Contabilidad.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <InsightCard scope="finanzas" />

      {/* Comisiones disponibles para generar cuenta */}
      <NCard padding="md">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <SectionHeader
            icon={<CircleDollarSign size={14} />}
            title={`Comisiones disponibles (${disponibles.length})`}
            description="Selecciona los casos con saldo cobrable para emitir una cuenta de cobro."
          />
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[11.5px]"
                style={{ color: "var(--nuvia-text-secondary)" }}
              >
                {selected.size} seleccionadas ·{" "}
                <strong style={{ color: "var(--nuvia-text-primary)" }}>{formatCOP(totalSeleccionado)}</strong>
              </span>
              <input
                value={observ}
                onChange={(e) => setObserv(e.target.value)}
                placeholder="Observaciones (opcional)"
                className="nuvia-input nuvia-input-sm"
                style={{ minWidth: 220 }}
              />
              <button
                onClick={generar}
                disabled={creating}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50 transition-shadow"
                style={{
                  background: "linear-gradient(135deg,#445DA3,#84B98F)",
                  boxShadow: "0 10px 26px -12px rgba(132,185,143,0.55)",
                }}
              >
                <Plus size={13} /> Generar cuenta de cobro
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="py-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Cargando comisiones…
          </div>
        ) : disponibles.length === 0 ? (
          <EmptyState
            title="Sin comisión liberada aún"
            description="Las comisiones se liberan a medida que cartera registra los pagos efectivos del cliente."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px] min-w-[1040px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "", a: "left", w: "36px" },
                    { l: "Cliente", a: "left" },
                    { l: "Banco", a: "left" },
                    { l: "Honorarios contratados", a: "right" },
                    { l: "Recaudado", a: "right" },
                    { l: "%", a: "right" },
                    { l: "Potencial", a: "right" },
                    { l: "Liberada", a: "right" },
                    { l: "Pagada", a: "right" },
                    { l: "Saldo cobrable", a: "right" },
                    { l: "Por recaudar", a: "right" },
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
                        width: h.w,
                      }}
                    >
                      {h.l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disponibles.map((c) => {
                  const exp = expedientes.get(c.expediente_id);
                  const disp = saldoDisponibleComision(c);
                  const pendRec = pendienteRecaudoComision(c);
                  const isSel = selected.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{
                        borderBottom: "1px solid var(--nuvia-border)",
                        background: isSel ? "rgba(68,93,163,0.08)" : undefined,
                      }}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(c.id)}
                          style={{ accentColor: "var(--nuvia-accent-blue)" }}
                        />
                      </td>
                      <td className="px-3 py-2.5 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {exp?.cliente ?? "—"}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {exp?.banco ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {formatCOP(Number(c.honorarios_contratados ?? c.base ?? 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {formatCOP(Number(c.recaudado || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {Number(c.porcentaje).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-accent-blue)" }}>
                        {formatCOP(Number(c.comision_potencial || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-success)" }}>
                        {formatCOP(Number(c.comision_liberada || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {formatCOP(Number(c.comision_pagada || 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-success)" }}>
                        {formatCOP(disp)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "#FACC15" }}>
                        {formatCOP(pendRec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      {/* Cuentas de cobro */}
      <NCard padding="md">
        <SectionHeader
          icon={<FileText size={14} />}
          title="Cuentas de cobro"
          description={`${cuentas.length} registro${cuentas.length === 1 ? "" : "s"}`}
        />
        {cuentas.length === 0 ? (
          <EmptyState
            title="No hay cuentas creadas"
            description="Cuando selecciones comisiones disponibles y emitas una cuenta, aparecerá aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  {[
                    { l: "Número", a: "left" },
                    { l: "Fecha", a: "left" },
                    { l: "Estado", a: "left" },
                    { l: "Total", a: "right" },
                    { l: "", a: "right" },
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
                {cuentas.map((cc) => {
                  const b = ESTADO_CC[cc.estado] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-secondary)", label: cc.estado };
                  return (
                    <tr
                      key={cc.id}
                      className="transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: "1px solid var(--nuvia-border)" }}
                    >
                      <td className="px-3 py-2.5 font-mono text-[11.5px]" style={{ color: "var(--nuvia-text-primary)" }}>
                        {cc.numero}
                      </td>
                      <td className="px-3 py-2.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {new Date(cc.created_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                          style={{ color: b.color, background: b.bg }}
                        >
                          {b.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>
                        {formatCOP(Number(cc.total))}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to="/comisiones/$id"
                          params={{ id: cc.id }}
                          className="text-[11px] font-semibold hover:underline"
                          style={{ color: "var(--nuvia-accent-blue)" }}
                        >
                          Ver detalle →
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
