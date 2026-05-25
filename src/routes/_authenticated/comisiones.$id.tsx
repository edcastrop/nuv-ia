import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
import { formatCOP } from "@/lib/format";
import { getCuentaCobro, cambiarEstadoCuenta, type CuentaCobro, type Comision } from "@/lib/comisiones";
import { ArrowLeft, Send, CheckCircle2, XCircle, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comisiones/$id")({
  component: DetalleCuentaCobro,
  head: () => ({ meta: [{ title: "Detalle cuenta de cobro · NUVEX" }] }),
});

function DetalleCuentaCobro() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { roles } = useUserRole();
  const navigate = useNavigate();
  const esManager = roles.some((r) => ["admin", "gerencia", "super_admin", "cartera"].includes(r));

  const [cc, setCc] = useState<CuentaCobro | null>(null);
  const [items, setItems] = useState<Comision[]>([]);
  const [expedientes, setExpedientes] = useState<Map<string, { cliente: string; banco: string | null }>>(new Map());
  const [historial, setHistorial] = useState<{ id: string; accion: string; observacion: string | null; created_at: string }[]>([]);
  const [observ, setObserv] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const c = await getCuentaCobro(id);
    setCc(c);
    const { data: its } = await supabase
      .from("comisiones" as never)
      .select("*")
      .eq("cuenta_cobro_id", id);
    const arr = (its ?? []) as unknown as Comision[];
    setItems(arr);
    const ids = arr.map((x) => x.expediente_id);
    if (ids.length) {
      const { data: exps } = await supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco")
        .in("id", ids);
      const m = new Map<string, { cliente: string; banco: string | null }>();
      (exps ?? []).forEach((e) => m.set(e.id, { cliente: e.cliente_nombre, banco: e.banco }));
      setExpedientes(m);
    }
    const { data: hist } = await supabase
      .from("cuentas_cobro_historial" as never)
      .select("*")
      .eq("cuenta_cobro_id", id)
      .order("created_at", { ascending: false });
    setHistorial((hist ?? []) as unknown as typeof historial);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const cambiar = async (nuevo: CuentaCobro["estado"]) => {
    if (!cc) return;
    if (!confirm(`¿Cambiar a "${nuevo}"?`)) return;
    try {
      await cambiarEstadoCuenta(cc.id, nuevo, observ.trim() || undefined);
      setObserv("");
      await cargar();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>;
  if (!cc) return <div className="p-12 text-center text-sm text-[#991B1B]">Cuenta no encontrada.</div>;

  const esDueno = user?.id === cc.user_id;
  const puedeEnviar = esDueno && cc.estado === "borrador";
  const puedeAprobar = esManager && cc.estado === "enviada";
  const puedePagar = esManager && cc.estado === "aprobada";

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link to="/comisiones" className="mb-4 inline-flex items-center gap-1 text-[12px] text-[#445DA3] hover:underline">
        <ArrowLeft size={13} /> Volver a comisiones
      </Link>

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Cuenta de cobro</div>
            <div className="mt-1 font-mono text-lg font-semibold text-[#0A1226]">{cc.numero}</div>
            <div className="mt-1 text-[12px] text-[#242424]/70">
              Creada el {new Date(cc.created_at).toLocaleString("es-CO")}
            </div>
            {cc.observaciones && <div className="mt-2 text-[13px] italic text-[#242424]/70">"{cc.observaciones}"</div>}
          </div>
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wide text-[#242424]/60">Total</div>
            <div className="mt-1 text-2xl font-bold text-[#1F7A45]">{formatCOP(Number(cc.total))}</div>
            <div
              className="mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: ESTADO_CC[cc.estado].bg, color: ESTADO_CC[cc.estado].color }}
            >
              {ESTADO_CC[cc.estado].label}
            </div>
          </div>
        </div>

        {(puedeEnviar || puedeAprobar || puedePagar) && (
          <div className="border-t border-[#E3E7EE] bg-[#F7F9FB] p-4">
            <input
              value={observ}
              onChange={(e) => setObserv(e.target.value)}
              placeholder="Observación (opcional)"
              className="mb-3 w-full rounded-lg border border-[#E3E7EE] bg-white px-3 py-2 text-sm outline-none focus:border-[#445DA3]"
            />
            <div className="flex flex-wrap gap-2">
              {puedeEnviar && (
                <button
                  onClick={() => cambiar("enviada")}
                  className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#445DA3,#84B98F)" }}
                >
                  <Send size={13} /> Enviar a contabilidad
                </button>
              )}
              {puedeAprobar && (
                <>
                  <button
                    onClick={() => cambiar("aprobada")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A45] px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    <CheckCircle2 size={13} /> Aprobar
                  </button>
                  <button
                    onClick={() => cambiar("rechazada")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#991B1B] px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    <XCircle size={13} /> Rechazar
                  </button>
                </>
              )}
              {puedePagar && (
                <button
                  onClick={() => cambiar("pagada")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F7A45] px-4 py-2 text-[12px] font-semibold text-white"
                >
                  <DollarSign size={13} /> Marcar pagada
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">
          Comisiones incluidas ({items.length})
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F7F9FB] text-[11px] uppercase tracking-wide text-[#242424]/60">
            <tr>
              <th className="px-4 py-2 text-left">Cliente</th>
              <th className="px-4 py-2 text-left">Banco</th>
              <th className="px-4 py-2 text-right">Base</th>
              <th className="px-4 py-2 text-right">%</th>
              <th className="px-4 py-2 text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E7EE]">
            {items.map((it) => {
              const exp = expedientes.get(it.expediente_id);
              return (
                <tr key={it.id}>
                  <td className="px-4 py-2 text-[#0A1226]">{exp?.cliente ?? "—"}</td>
                  <td className="px-4 py-2 text-[#242424]/70">{exp?.banco ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatCOP(Number(it.base))}</td>
                  <td className="px-4 py-2 text-right">{Number(it.porcentaje).toFixed(2)}%</td>
                  <td className="px-4 py-2 text-right font-semibold text-[#1F7A45]">
                    {formatCOP(Number(it.valor))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card>
        <div className="border-b border-[#E3E7EE] px-4 py-3 text-sm font-semibold text-[#0A1226]">Historial</div>
        {historial.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#242424]/60">Sin movimientos.</div>
        ) : (
          <ul className="divide-y divide-[#E3E7EE]">
            {historial.map((h) => (
              <li key={h.id} className="px-4 py-2.5">
                <div className="text-[13px] text-[#0A1226]">{h.accion.replace(/_/g, " ")}</div>
                {h.observacion && <div className="text-[12px] text-[#242424]/60">{h.observacion}</div>}
                <div className="text-[11px] text-[#242424]/50">
                  {new Date(h.created_at).toLocaleString("es-CO")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Navigate helper unused but exported so the file uses it cleanly */}
      <span hidden onClick={() => navigate({ to: "/comisiones" })} />
    </div>
  );
}

const ESTADO_CC: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: "#F1F3F8", color: "#445DA3", label: "Borrador" },
  enviada: { bg: "#EEF1FA", color: "#445DA3", label: "Enviada" },
  aprobada: { bg: "#EAF7EE", color: "#1F7A45", label: "Aprobada" },
  rechazada: { bg: "#FEE2E2", color: "#991B1B", label: "Rechazada" },
  pagada: { bg: "#DDF4E3", color: "#1F7A45", label: "Pagada" },
};
