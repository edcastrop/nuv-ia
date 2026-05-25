import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
import { formatCOP } from "@/lib/format";
import {
  listMisComisiones,
  listTodasComisiones,
  listCuentasCobro,
  crearCuentaCobro,
  type Comision,
  type CuentaCobro,
} from "@/lib/comisiones";
import { CircleDollarSign, FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones/")({
  component: ComisionesPage,
  head: () => ({ meta: [{ title: "Mis comisiones · NUVEX" }] }),
});

const ESTADO_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  generada: { bg: "#EEF1FA", color: "#445DA3", label: "Generada" },
  pendiente: { bg: "#FFF7E6", color: "#8A5A00", label: "En cuenta de cobro" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
};

function ComisionesPage() {
  const { user } = useAuth();
  const { roles } = useUserRole();
  const esManager = roles.some((r) => ["admin", "gerencia", "super_admin", "cartera"].includes(r));
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
    () => comisiones.filter((c) => c.estado === "generada" && !c.cuenta_cobro_id),
    [comisiones],
  );

  const totalSeleccionado = useMemo(
    () => disponibles.filter((c) => selected.has(c.id)).reduce((s, c) => s + Number(c.valor || 0), 0),
    [disponibles, selected],
  );

  const totales = useMemo(
    () => ({
      generadas: comisiones.filter((c) => c.estado === "generada").reduce((s, c) => s + Number(c.valor), 0),
      pendientes: comisiones.filter((c) => c.estado === "pendiente").reduce((s, c) => s + Number(c.valor), 0),
      aprobadas: comisiones.filter((c) => c.estado === "aprobada").reduce((s, c) => s + Number(c.valor), 0),
      pagadas: comisiones.filter((c) => c.estado === "pagada").reduce((s, c) => s + Number(c.valor), 0),
    }),
    [comisiones],
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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0A1226]">
            {esManager ? "Comisiones (todas)" : "Mis comisiones"}
          </h1>
          <p className="text-sm text-[#242424]/60">
            Las comisiones se liquidan automáticamente al marcar el caso como honorarios pagados.
          </p>
        </div>
        {esManager && (
          <Link
            to="/contabilidad/cuentas-cobro"
            className="rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-medium text-[#445DA3] hover:bg-[#F7F9FB]"
          >
            Panel contabilidad →
          </Link>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Generadas" value={formatCOP(totales.generadas)} color="#445DA3" />
        <Stat label="En trámite" value={formatCOP(totales.pendientes)} color="#8A5A00" />
        <Stat label="Aprobadas" value={formatCOP(totales.aprobadas)} color="#1F7A45" />
        <Stat label="Pagadas" value={formatCOP(totales.pagadas)} color="#1F7A45" />
      </div>

      {/* Comisiones disponibles para generar cuenta */}
      <Card className="mb-6">
        <div className="border-b border-[#E3E7EE] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0A1226]">
            <CircleDollarSign size={15} className="text-[#445DA3]" />
            Comisiones disponibles ({disponibles.length})
          </div>
          {selected.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-[#242424]/70">
                {selected.size} seleccionadas · <strong>{formatCOP(totalSeleccionado)}</strong>
              </span>
              <input
                value={observ}
                onChange={(e) => setObserv(e.target.value)}
                placeholder="Observaciones (opcional)"
                className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] outline-none focus:border-[#445DA3]"
              />
              <button
                onClick={generar}
                disabled={creating}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
              >
                <Plus size={13} /> Generar cuenta de cobro
              </button>
            </div>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">Cargando…</div>
        ) : disponibles.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">No hay comisiones disponibles.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-4 py-2 text-left w-10"></th>
                <th className="px-4 py-2 text-left">Cliente</th>
                <th className="px-4 py-2 text-left">Banco</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">%</th>
                <th className="px-4 py-2 text-right">Comisión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {disponibles.map((c) => {
                const exp = expedientes.get(c.expediente_id);
                return (
                  <tr key={c.id} className="hover:bg-[#F7F9FB]">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                    </td>
                    <td className="px-4 py-2 text-[#0A1226]">{exp?.cliente ?? "—"}</td>
                    <td className="px-4 py-2 text-[#242424]/70">{exp?.banco ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{formatCOP(Number(c.base))}</td>
                    <td className="px-4 py-2 text-right">{Number(c.porcentaje).toFixed(2)}%</td>
                    <td className="px-4 py-2 text-right font-semibold text-[#1F7A45]">
                      {formatCOP(Number(c.valor))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Mis cuentas de cobro */}
      <Card>
        <div className="border-b border-[#E3E7EE] px-4 py-3 flex items-center gap-2 text-sm font-semibold text-[#0A1226]">
          <FileText size={15} className="text-[#445DA3]" />
          Cuentas de cobro
        </div>
        {cuentas.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#242424]/60">No hay cuentas creadas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
              <tr>
                <th className="px-4 py-2 text-left">Número</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Estado</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E7EE]">
              {cuentas.map((cc) => {
                const b = ESTADO_CC[cc.estado];
                return (
                  <tr key={cc.id} className="hover:bg-[#F7F9FB]">
                    <td className="px-4 py-2 font-mono text-[12px] text-[#0A1226]">{cc.numero}</td>
                    <td className="px-4 py-2 text-[#242424]/70">
                      {new Date(cc.created_at).toLocaleDateString("es-CO")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: b.bg, color: b.color }}
                      >
                        {b.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold">{formatCOP(Number(cc.total))}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to="/comisiones/$id"
                        params={{ id: cc.id }}
                        className="text-[12px] font-medium text-[#445DA3] hover:underline"
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "#F1F3F8", color: "#445DA3", label: "Borrador" },
  enviada: { bg: "#EEF1FA", color: "#445DA3", label: "Enviada" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  devuelta_correccion: { bg: "#FEF3C7", color: "#8A5A00", label: "Devuelta" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
  programada_pago: { bg: "#E0E7FF", color: "#3730A3", label: "Programada" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
};

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#E3E7EE] bg-white p-4">
      <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">{label}</div>
      <div className="mt-1 text-lg font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
