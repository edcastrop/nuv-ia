import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import { supabase } from "@/integrations/supabase/client";
import { listValidaciones, type ValidacionQA } from "@/lib/validacionQA";
import { useUserRole } from "@/hooks/useUserRole";
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Inbox,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa")({
  component: QADashboard,
  head: () => ({ meta: [{ title: "Validación Financiera QA · NUVIA" }] }),
});

function QADashboard() {
  const { canValidarProyeccion, loading: rolesLoading } = useUserRole();
  const [items, setItems] = useState<ValidacionQA[]>([]);
  const [nombres, setNombres] = useState<Map<string, string>>(new Map());
  const [expedientes, setExpedientes] = useState<
    Map<string, { existe: boolean; cliente?: string | null; estadoCaso?: string | null }>
  >(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (rolesLoading) return;
      if (!canValidarProyeccion) {
        setLoading(false);
        return;
      }
      const all = await listValidaciones(500);
      setItems(all);
      const expedienteIds = Array.from(new Set(all.map((v) => v.expediente_id).filter(Boolean)));
      if (expedienteIds.length) {
        const { data: exps } = await supabase
          .from("expedientes")
          .select("id,cliente_nombre,estado_caso")
          .in("id", expedienteIds);
        const m = new Map<string, { existe: boolean; cliente?: string | null; estadoCaso?: string | null }>();
        expedienteIds.forEach((eid) => m.set(eid, { existe: false }));
        ((exps ?? []) as Array<{ id: string; cliente_nombre?: string | null; estado_caso?: string | null }>).forEach((e) =>
          m.set(e.id, { existe: true, cliente: e.cliente_nombre, estadoCaso: e.estado_caso ?? null }),
        );
        setExpedientes(m);
      } else {
        setExpedientes(new Map());
      }
      const ids = Array.from(
        new Set(all.flatMap((v) => [v.solicitada_por, v.validada_por]).filter(Boolean) as string[]),
      );
      if (ids.length) {
        const { data } = await supabase.from("profiles").select("id,nombre,email").in("id", ids);
        const m = new Map<string, string>();
        (data ?? []).forEach((p) => m.set(p.id, p.nombre || p.email || "—"));
        setNombres(m);
      }
      setLoading(false);
    })();
  }, [rolesLoading, canValidarProyeccion]);

  const stats = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const visibles = items.filter((v) => expedientes.get(v.expediente_id)?.existe !== false);
    const pendientes = visibles.filter((v) => !v.resultado).length;
    const aprobadasHoy = visibles.filter((v) => v.resultado === "aprobada" && v.validada_at?.startsWith(hoy)).length;
    const devueltasHoy = visibles.filter((v) => v.resultado === "devuelta" && v.validada_at?.startsWith(hoy)).length;
    const tiempos = visibles.filter((v) => v.tiempo_validacion_min != null).map((v) => v.tiempo_validacion_min!);
    const promedio = tiempos.length ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
    return { pendientes, aprobadasHoy, devueltasHoy, promedio };
  }, [items, expedientes]);

  const ranking = useMemo(() => {
    const map = new Map<string, { total: number; aprobadas: number; devueltas: number; aprobadasPrimera: number }>();
    for (const v of items) {
      const k = v.solicitada_por;
      const cur = map.get(k) ?? { total: 0, aprobadas: 0, devueltas: 0, aprobadasPrimera: 0 };
      cur.total += 1;
      if (v.resultado === "aprobada") {
        cur.aprobadas += 1;
        if (v.primera_revision) cur.aprobadasPrimera += 1;
      } else if (v.resultado === "devuelta") {
        cur.devueltas += 1;
      }
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([uid, s]) => ({
        uid,
        nombre: nombres.get(uid) ?? "—",
        ...s,
        calidad: s.total ? Math.round((s.aprobadasPrimera / s.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [items, nombres]);

  if (rolesLoading || loading) {
    return (
      <PageLayout>
        <NCard>
          <p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Cargando validaciones…
          </p>
        </NCard>
      </PageLayout>
    );
  }
  if (!canValidarProyeccion) {
    return (
      <PageLayout>
        <NCard>
          <p className="text-sm" style={{ color: "var(--nuvia-danger)" }}>
            Acceso restringido a Director Financiero QA.
          </p>
        </NCard>
      </PageLayout>
    );
  }

  const calidadTone = (q: number) => (q >= 95 ? "var(--nuvia-success)" : q >= 85 ? "var(--nuvia-warning)" : "var(--nuvia-danger)");
  const calidadBg = (q: number) =>
    q >= 95
      ? "rgba(132,185,143,0.14)"
      : q >= 85
        ? "rgba(246,196,83,0.14)"
        : "rgba(255,107,107,0.14)";

  const pendientes = items.filter((v) => !v.resultado && expedientes.get(v.expediente_id)?.existe !== false);

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <ShieldCheck size={12} />, label: "Control de calidad", tone: "blue" }}
        title="Validación financiera QA"
        description="Dashboard de control de calidad sobre las proyecciones presentadas por los licenciados."
      />

      <KpiGrid cols={4}>
        <KpiCard
          label="Pendientes por validar"
          value={stats.pendientes}
          icon={<Clock size={14} />}
          tone="warning"
          hint="En cola del Director QA"
        />
        <KpiCard
          label="Aprobadas hoy"
          value={stats.aprobadasHoy}
          icon={<CheckCircle2 size={14} />}
          tone="green"
          hint="Validaciones cerradas hoy"
        />
        <KpiCard
          label="Devueltas hoy"
          value={stats.devueltasHoy}
          icon={<XCircle size={14} />}
          tone="danger"
          hint="Reenviadas al analista"
        />
        <KpiCard
          label="Tiempo prom. (min)"
          value={stats.promedio}
          icon={<Timer size={14} />}
          tone="blue"
          hint="Desde solicitud a cierre"
        />
      </KpiGrid>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader
            title={`Proyecciones pendientes (${pendientes.length})`}
            description="Casos en espera de validación financiera."
          />
        </div>
        {pendientes.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} />}
            title="Sin pendientes"
            description="No hay proyecciones esperando validación en este momento."
            hint="NUVIA IA: cuando un Analista F. Comercial solicite validación, aparecerá aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <Th>Solicitada</Th>
                  <Th>Analista F. Comercial</Th>
                  <Th>Expediente</Th>
                  <Th align="right"> </Th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map((v) => (
                  <tr key={v.id} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td
                      className="px-5 py-2.5 whitespace-nowrap"
                      style={{ color: "var(--nuvia-text-secondary)" }}
                    >
                      {new Date(v.solicitada_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>
                      {nombres.get(v.solicitada_por) ?? "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="font-medium" style={{ color: "var(--nuvia-text-primary)" }}>
                        {expedientes.get(v.expediente_id)?.cliente ?? "Expediente"}
                      </div>
                      <div
                        className="font-mono text-[11px]"
                        style={{ color: "var(--nuvia-text-secondary)" }}
                      >
                        {v.expediente_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <Link
                        to="/casos/$id"
                        params={{ id: v.expediente_id }}
                        className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
                        style={{ color: "var(--nuvia-accent-blue)" }}
                      >
                        Abrir <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader
            title="Ranking de licenciados — Calidad"
            description="Aprobadas en primera revisión sobre el total de simulaciones."
          />
        </div>
        {ranking.length === 0 ? (
          <EmptyState
            icon={<Inbox size={28} />}
            title="Sin datos aún"
            description="Aún no hay simulaciones registradas para calcular el ranking."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                  <Th>Analista F. Comercial</Th>
                  <Th align="right">Simulaciones</Th>
                  <Th align="right">Aprobadas</Th>
                  <Th align="right">Devueltas</Th>
                  <Th align="right">Calidad %</Th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.uid} style={{ borderTop: "1px solid var(--nuvia-border)" }}>
                    <td className="px-5 py-2.5" style={{ color: "var(--nuvia-text-primary)" }}>
                      {r.nombre}
                    </td>
                    <td
                      className="px-5 py-2.5 text-right tabular-nums"
                      style={{ color: "var(--nuvia-text-primary)" }}
                    >
                      {r.total}
                    </td>
                    <td
                      className="px-5 py-2.5 text-right tabular-nums"
                      style={{ color: "var(--nuvia-success)" }}
                    >
                      {r.aprobadas}
                    </td>
                    <td
                      className="px-5 py-2.5 text-right tabular-nums"
                      style={{ color: "var(--nuvia-danger)" }}
                    >
                      {r.devueltas}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
                        style={{
                          background: calidadBg(r.calidad),
                          color: calidadTone(r.calidad),
                          border: `1px solid ${calidadTone(r.calidad)}33`,
                        }}
                      >
                        {r.calidad}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NCard>
    </PageLayout>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-5 py-2.5 font-semibold uppercase"
      style={{
        textAlign: align,
        fontSize: "10.5px",
        letterSpacing: "0.12em",
        color: "var(--nuvia-text-secondary)",
      }}
    >
      {children}
    </th>
  );
}
