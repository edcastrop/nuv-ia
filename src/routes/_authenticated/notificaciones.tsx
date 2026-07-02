import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { labelEstado, type CasoEstado } from "@/lib/casoEstados";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  EmptyState,
} from "@/components/nuvia";
import {
  AlertTriangle,
  Clock,
  CircleDollarSign,
  Inbox,
  CheckCircle2,
  BellRing,
  ArrowRight,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  component: NotificacionesPage,
  head: () => ({ meta: [{ title: "Centro de Alertas · NUVEX" }] }),
});

type TabKey = "qa" | "estancados" | "sin_seguimiento" | "honorarios";

interface QAPend {
  id: string;
  expediente_id: string;
  solicitada_at: string;
}

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
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
}

function diasDesde(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function NotificacionesPage() {
  const [tab, setTab] = useState<TabKey>("qa");
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [qaPend, setQaPend] = useState<QAPend[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const cargar = async () => {
    setLoading(true);
    const [{ data: al }, { data: ex }, { data: qa }] = await Promise.all([
      supabase
        .from("caso_alertas" as never)
        .select("*")
        .eq("leida", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("expedientes")
        .select(
          "id, cliente_nombre, banco, producto, estado_caso, updated_at, honorarios_final" as never,
        )
        .order("updated_at", { ascending: false }),
      supabase
        .from("validaciones_qa" as never)
        .select("id, expediente_id, solicitada_at")
        .is("resultado", null)
        .order("solicitada_at", { ascending: true }),
    ]);
    setAlertas((al ?? []) as unknown as Alerta[]);
    setExpedientes((ex ?? []) as unknown as Expediente[]);
    setQaPend((qa ?? []) as unknown as QAPend[]);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    const iv = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(iv);
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
    { key: "qa", label: "QA Pendiente", count: qaPend.length, Icon: Zap },
    { key: "estancados", label: "Estancados", count: estancados.length, Icon: AlertTriangle },
    { key: "sin_seguimiento", label: "Sin seguimiento", count: sinSeguimiento.length, Icon: Clock },
    { key: "honorarios", label: "Honorarios", count: honorariosPend.length, Icon: CircleDollarSign },
  ];

  const honorariosTotal = honorariosPend.reduce((s, e) => s + (e.honorarios_final ?? 0), 0);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <BellRing size={12} />, label: "NUVEX · Alertas", tone: "warning" }}
        title="Centro de Alertas"
        description="Casos estancados, sin seguimiento reciente y honorarios pendientes por gestionar."
        meta={
          <span
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "rgba(255,107,107,0.12)",
              border: "1px solid rgba(255,107,107,0.35)",
              color: "var(--nuvia-danger)",
            }}
          >
            {estancados.length + sinSeguimiento.length + honorariosPend.length + qaPend.length} señales activas
          </span>
        }
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="QA pendiente"
          value={qaPend.length}
          icon={<Zap size={14} />}
          tone="danger"
          hint={
            qaPend.length > 0
              ? `Más antigua hace ${Math.floor((now - new Date(qaPend[0].solicitada_at).getTime()) / 60_000)} min`
              : "Sin auditorías sin dictamen"
          }
        />
        <KpiCard
          label="Estancados"
          value={estancados.length}
          icon={<AlertTriangle size={14} />}
          tone="danger"
          hint="Casos sin movimiento crítico"
        />
        <KpiCard
          label="Sin seguimiento"
          value={sinSeguimiento.length}
          icon={<Clock size={14} />}
          tone="warning"
          hint={`Más de ${SIN_SEGUIMIENTO_DIAS} días sin actualizar`}
        />
        <KpiCard
          label="Honorarios pendientes"
          value={honorariosPend.length}
          icon={<CircleDollarSign size={14} />}
          tone="blue"
          hint={fmtCOP(honorariosTotal)}
        />
      </KpiGrid>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-medium border transition"
              style={
                active
                  ? {
                      background: "var(--nuvia-gradient-primary)",
                      color: "#fff",
                      borderColor: "transparent",
                      boxShadow: "var(--nuvia-shadow-sm)",
                    }
                  : {
                      background: "rgba(255,255,255,0.03)",
                      color: "var(--nuvia-text-secondary)",
                      borderColor: "var(--nuvia-border)",
                    }
              }
            >
              <t.Icon size={13} />
              <span>{t.label}</span>
              <span
                className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                style={
                  active
                    ? { background: "rgba(255,255,255,0.22)", color: "#fff" }
                    : { background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-primary)" }
                }
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      <NCard padding="none">
        {loading ? (
          <div
            className="p-12 text-center text-sm"
            style={{ color: "var(--nuvia-text-secondary)" }}
          >
            Cargando…
          </div>
        ) : tab === "qa" ? (
          qaPend.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={20} />}
              title="Sin auditorías pendientes"
              description="Todas las validaciones QA están al día."
            />
          ) : (
            <ListaRows>
              {qaPend.map((q) => {
                const exp = expedienteById.get(q.expediente_id);
                const mins = Math.floor((now - new Date(q.solicitada_at).getTime()) / 60_000);
                const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
                const critico = mins >= 120;
                const atencion = mins >= 60;
                const color = critico
                  ? "var(--nuvia-danger)"
                  : atencion
                    ? "var(--nuvia-warning)"
                    : "var(--nuvia-accent-blue)";
                return (
                  <Row
                    key={q.id}
                    titulo={exp?.cliente_nombre ?? "Caso"}
                    sub={exp?.banco ?? "—"}
                    detalle={
                      <span style={{ color }}>
                        {critico ? "🚨 CRÍTICO · " : atencion ? "⏰ Atención · " : "⏳ "}
                        Esperando dictamen QA hace {label}
                      </span>
                    }
                    actions={
                      <LinkBtn to="/qa-ai" params={{}}>
                        Auditar ahora <ArrowRight size={11} />
                      </LinkBtn>
                    }
                  />
                );
              })}
            </ListaRows>
          )
        ) : tab === "estancados" ? (
          estancados.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Sin casos estancados"
              description="No hay alertas críticas activas. Buen trabajo del equipo."
            />
          ) : (
            <ListaRows>
              {estancados.map((a) => {
                const exp = expedienteById.get(a.expediente_id);
                return (
                  <Row
                    key={a.id}
                    titulo={exp?.cliente_nombre ?? "Caso"}
                    sub={exp?.banco ?? "—"}
                    detalle={
                      <span style={{ color: "var(--nuvia-danger)" }}>
                        ⚠ Estancado {a.dias_estancado} días en {labelEstado(exp?.estado_caso ?? null)}
                      </span>
                    }
                    actions={
                      <>
                        <LinkBtn to="/casos/$id" params={{ id: a.expediente_id }}>
                          Abrir <ArrowRight size={11} />
                        </LinkBtn>
                        <button
                          onClick={() => marcarLeida(a.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-medium transition hover:bg-white/[0.06]"
                          style={{
                            border: "1px solid var(--nuvia-border)",
                            color: "var(--nuvia-success)",
                            background: "rgba(132,185,143,0.08)",
                          }}
                        >
                          <CheckCircle2 size={12} /> Leída
                        </button>
                      </>
                    }
                  />
                );
              })}
            </ListaRows>
          )
        ) : tab === "sin_seguimiento" ? (
          sinSeguimiento.length === 0 ? (
            <EmptyState
              icon={<Inbox size={20} />}
              title="Todo bajo control"
              description="Todos los casos activos tienen seguimiento reciente."
            />
          ) : (
            <ListaRows>
              {sinSeguimiento.map((e) => (
                <Row
                  key={e.id}
                  titulo={e.cliente_nombre}
                  sub={e.banco ?? "—"}
                  detalle={
                    <span style={{ color: "var(--nuvia-warning)" }}>
                      Sin actividad hace {diasDesde(e.updated_at)} días · {labelEstado(e.estado_caso)}
                    </span>
                  }
                  actions={
                    <LinkBtn to="/casos/$id" params={{ id: e.id }}>
                      Abrir expediente <ArrowRight size={11} />
                    </LinkBtn>
                  }
                />
              ))}
            </ListaRows>
          )
        ) : honorariosPend.length === 0 ? (
          <EmptyState
            icon={<Inbox size={20} />}
            title="Sin honorarios pendientes"
            description="No hay cuentas de cobro u honorarios por gestionar."
          />
        ) : (
          <ListaRows>
            {honorariosPend.map((e) => (
              <Row
                key={e.id}
                titulo={e.cliente_nombre}
                sub={e.banco ?? "—"}
                detalle={
                  <span style={{ color: "var(--nuvia-accent-blue)" }}>
                    {labelEstado(e.estado_caso)} · Honorarios: {fmtCOP(e.honorarios_final)}
                  </span>
                }
                actions={
                  <LinkBtn to="/cartera/$id" params={{ id: e.id }}>
                    Ver cartera <ArrowRight size={11} />
                  </LinkBtn>
                }
              />
            ))}
          </ListaRows>
        )}
      </NCard>
    </PageLayout>
  );
}

function ListaRows({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y" style={{ borderColor: "var(--nuvia-border)" }}>
      {children}
    </ul>
  );
}

function Row({
  titulo,
  sub,
  detalle,
  actions,
}: {
  titulo: string;
  sub: string;
  detalle: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
      style={{ borderColor: "var(--nuvia-border)" }}
    >
      <div className="min-w-0">
        <div
          className="text-sm font-semibold truncate"
          style={{ color: "var(--nuvia-text-primary)" }}
        >
          {titulo}{" "}
          <span style={{ color: "var(--nuvia-text-secondary)", fontWeight: 400 }}>· {sub}</span>
        </div>
        <div className="mt-0.5 text-[12px]">{detalle}</div>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </li>
  );
}

function LinkBtn({
  to,
  params,
  children,
}: {
  to: string;
  params: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <Link
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      to={to as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params={params as any}
      className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-95"
      style={{
        background: "var(--nuvia-gradient-primary)",
        boxShadow: "var(--nuvia-shadow-sm)",
      }}
    >
      {children}
    </Link>
  );
}
