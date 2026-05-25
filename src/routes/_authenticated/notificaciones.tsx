import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import { Card } from "@/components/nuvex/ui";
import { AlertTriangle, Clock, CircleDollarSign, Inbox, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  component: NotificacionesPage,
  head: () => ({ meta: [{ title: "Notificaciones · NUVEX" }] }),
});

type TabKey = "estancados" | "sin_seguimiento" | "honorarios";

interface Alerta {
  id: string;
  expediente_id: string;
  tipo: string;
  dias_estancado: number;
  leida: boolean;
  created_at: string;
}

interface Expediente {
  id: string;
  cliente_nombre: string;
  banco: string | null;
  producto: string | null;
  estado_caso: CasoEstado | null;
  updated_at: string;
  honorarios_final: number | null;
}

const SIN_SEGUIMIENTO_DIAS = 10;

function fmtCOP(v: number | null | undefined) {
  if (!v) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function NotificacionesPage() {
  const [tab, setTab] = useState<TabKey>("estancados");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const [{ data: al }, { data: ex }] = await Promise.all([
      supabase
        .from("caso_alertas" as never)
        .select("*")
        .eq("leida", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("expedientes")
        .select("id, cliente_nombre, banco, producto, estado_caso, updated_at, honorarios_final" as never)
        .order("updated_at", { ascending: false }),
    ]);
    setAlertas((al ?? []) as unknown as Alerta[]);
    setExpedientes((ex ?? []) as unknown as Expediente[]);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const expedienteById = useMemo(() => {
    const m = new Map<string, Expediente>();
    expedientes.forEach((e) => m.set(e.id, e));
    return m;
  }, [expedientes]);

  const estancados = alertas;

  const sinSeguimiento = useMemo(
    () =>
      expedientes.filter(
        (e) =>
          e.estado_caso &&
          !["caso_finalizado", "proceso_cerrado", "negado_banco", "paz_y_salvo_generado"].includes(
            e.estado_caso,
          ) &&
          diasDesde(e.updated_at) >= SIN_SEGUIMIENTO_DIAS,
      ),
    [expedientes],
  );

  const honorariosPend = useMemo(
    () =>
      expedientes.filter(
        (e) => e.estado_caso === "honorarios_pendientes" || e.estado_caso === "cuenta_cobro_enviada",
      ),
    [expedientes],
  );

  const marcarLeida = async (id: string) => {
    await supabase.from("caso_alertas" as never).update({ leida: true } as never).eq("id", id);
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  };

  const tabs: { key: TabKey; label: string; count: number; Icon: typeof Inbox }[] = [
    { key: "estancados", label: "Estancados", count: estancados.length, Icon: AlertTriangle },
    { key: "sin_seguimiento", label: "Sin seguimiento", count: sinSeguimiento.length, Icon: Clock },
    { key: "honorarios", label: "Honorarios", count: honorariosPend.length, Icon: CircleDollarSign },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0A1226]">Centro de notificaciones</h1>
          <p className="text-sm text-[#242424]/60">Alertas, casos sin movimiento y honorarios por gestionar.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition"
              style={{
                background: active ? "linear-gradient(135deg,#445DA3,#84B98F)" : "#fff",
                color: active ? "#fff" : "#0A1226",
                borderColor: active ? "transparent" : "#E3E7EE",
              }}
            >
              <t.Icon size={15} />
              <span>{t.label}</span>
              <span
                className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  background: active ? "rgba(255,255,255,0.22)" : "#F1F3F8",
                  color: active ? "#fff" : "#445DA3",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        {loading ? (
          <div className="p-12 text-center text-sm text-[#242424]/60">Cargando…</div>
        ) : tab === "estancados" ? (
          estancados.length === 0 ? (
            <Empty msg="No hay casos estancados 🎉" />
          ) : (
            <ul className="divide-y divide-[#E3E7EE]">
              {estancados.map((a) => {
                const exp = expedienteById.get(a.expediente_id);
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[#0A1226]">
                        {exp?.cliente_nombre ?? "Caso"}{" "}
                        <span className="text-[#242424]/50">· {exp?.banco ?? ""}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] text-[#991B1B]">
                        ⚠ Estancado {a.dias_estancado} días en {labelEstado(exp?.estado_caso ?? null)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        to="/casos/$id"
                        params={{ id: a.expediente_id }}
                        className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] font-medium text-[#445DA3] hover:bg-[#F7F9FB]"
                      >
                        Abrir expediente
                      </Link>
                      <button
                        onClick={() => marcarLeida(a.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#1F7A45] hover:bg-[#EAF7EE]"
                      >
                        <CheckCircle2 size={13} /> Marcar leída
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        ) : tab === "sin_seguimiento" ? (
          sinSeguimiento.length === 0 ? (
            <Empty msg="Todos los casos tienen seguimiento reciente." />
          ) : (
            <ul className="divide-y divide-[#E3E7EE]">
              {sinSeguimiento.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0A1226]">
                      {e.cliente_nombre} <span className="text-[#242424]/50">· {e.banco ?? ""}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-[#8A5A00]">
                      Sin actividad hace {diasDesde(e.updated_at)} días · {labelEstado(e.estado_caso)}
                    </div>
                  </div>
                  <Link
                    to="/casos/$id"
                    params={{ id: e.id }}
                    className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] font-medium text-[#445DA3] hover:bg-[#F7F9FB]"
                  >
                    Abrir expediente
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : honorariosPend.length === 0 ? (
          <Empty msg="No hay honorarios pendientes." />
        ) : (
          <ul className="divide-y divide-[#E3E7EE]">
            {honorariosPend.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[#0A1226]">
                    {e.cliente_nombre} <span className="text-[#242424]/50">· {e.banco ?? ""}</span>
                  </div>
                  <div className="mt-0.5 text-[12px] text-[#445DA3]">
                    {labelEstado(e.estado_caso)} · Honorarios: {fmtCOP(e.honorarios_final)}
                  </div>
                </div>
                <Link
                  to="/cartera/$id"
                  params={{ id: e.id }}
                  className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[12px] font-medium text-[#445DA3] hover:bg-[#F7F9FB]"
                >
                  Ver cartera
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 p-12 text-sm text-[#242424]/60">
      <Inbox size={24} className="text-[#445DA3]/50" />
      <span>{msg}</span>
    </div>
  );
}
