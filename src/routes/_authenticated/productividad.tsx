import { createFileRoute } from "@tanstack/react-router";
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
import { useUserRole } from "@/hooks/useUserRole";
import {
  cargarProductividad,
  RANGOS_PRODUCTIVIDAD,
  type ProductividadUsuario,
  type RangoKey,
} from "@/lib/productividad";

import {
  Activity,
  TrendingUp,
  Minus,
  Users,
  Timer,
  AlertTriangle,
  Trophy,
  Target,
  Flame,
  ArrowUp,
  ArrowDown,
  Medal,
  Calendar as CalendarIcon,
  ArrowRight,
  Repeat,
  CheckCircle2,
  Bell,
} from "lucide-react";



export const Route = createFileRoute("/_authenticated/productividad")({
  component: ProductividadPage,
  head: () => ({ meta: [{ title: "Productividad y tiempos · NUVIA" }] }),
});

interface Periodo {
  desde: string;
  hasta: string;
  prevDesde: string;
  prevHasta: string;
  label: string;
}

function periodoDesdeRango(key: RangoKey, mesRef: { anio: number; mes: number }): Periodo {
  // Anclamos al mes de referencia. "hasta" = fin del mes de referencia.
  // "desde" = inicio del mes (mesRef - dias equivalentes en meses).
  const meses = key === "mensual" ? 1 : key === "bimensual" ? 2 : key === "trimestral" ? 3 : 6;
  const finMes = new Date(Date.UTC(mesRef.anio, mesRef.mes, 1) - 1);
  const inicio = new Date(Date.UTC(mesRef.anio, mesRef.mes - meses, 1));
  const prevInicio = new Date(Date.UTC(mesRef.anio, mesRef.mes - meses * 2, 1));
  const prevFin = new Date(Date.UTC(mesRef.anio, mesRef.mes - meses, 1) - 1);
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
  return {
    desde: inicio.toISOString(),
    hasta: finMes.toISOString(),
    prevDesde: prevInicio.toISOString(),
    prevHasta: prevFin.toISOString(),
    label: `${fmt(inicio)} → ${fmt(finMes)}`,
  };
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function scoreOf(r: ProductividadUsuario): number {
  return r.cambios_estado + r.casos_cerrados * 3 - r.alertas_recibidas;
}

function ProductividadPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const autorizado = isSuperAdmin || roles.includes("gerencia" as never);

  const now = new Date();
  const [rango, setRango] = useState<RangoKey>("mensual");
  const [mesRef, setMesRef] = useState({
    anio: now.getUTCFullYear(),
    mes: now.getUTCMonth() + 1,
  });

  const periodo = useMemo(() => periodoDesdeRango(rango, mesRef), [rango, mesRef]);

  const [rows, setRows] = useState<ProductividadUsuario[]>([]);
  const [prevRows, setPrevRows] = useState<ProductividadUsuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!autorizado) return;
    setLoading(true);
    Promise.all([
      cargarProductividad(periodo.desde, periodo.hasta),
      cargarProductividad(periodo.prevDesde, periodo.prevHasta),
    ])
      .then(([cur, prev]) => {
        setRows(cur);
        setPrevRows(prev);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [periodo, autorizado]);

  const prevScoreByUser = useMemo(() => {
    const m = new Map<string, number>();
    prevRows.forEach((r) => m.set(r.user_id, scoreOf(r)));
    return m;
  }, [prevRows]);

  const totales = useMemo(
    () => ({
      cambios: rows.reduce((s, r) => s + r.cambios_estado, 0),
      cerrados: rows.reduce((s, r) => s + r.casos_cerrados, 0),
      alertas: rows.reduce((s, r) => s + r.alertas_recibidas, 0),
      promCiclo: (() => {
        const vals = rows.filter((r) => r.horas_promedio_ciclo > 0).map((r) => r.horas_promedio_ciclo);
        return vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : 0;
      })(),
    }),
    [rows],
  );

  const ranked = useMemo(
    () =>
      [...rows]
        .map((r) => ({ ...r, score: scoreOf(r) }))
        .sort((a, b) => b.score - a.score),
    [rows],
  );

  const top3 = ranked.slice(0, 3);
  const maxTrans = Math.max(1, ...ranked.map((r) => r.cambios_estado));
  const maxActivos = Math.max(1, ...ranked.map((r) => r.casos_activos));

  // Meta del equipo: cerrar 40 casos por trimestre → escalar por periodo
  const metaMeses = rango === "mensual" ? 1 : rango === "bimensual" ? 2 : rango === "trimestral" ? 3 : 6;
  const metaCerrados = 13 * metaMeses; // ~40 por trimestre
  const progresoMeta = Math.min(100, Math.round((totales.cerrados / metaCerrados) * 100));

  if (!autorizado) {
    return (
      <PageLayout>
        <EmptyState title="Sin acceso" description="Esta sección es exclusiva para Gerencia y Super Admin." />
      </PageLayout>
    );
  }

  const rangoActions = (
    <div className="flex gap-2 flex-wrap items-center">
      {RANGOS_PRODUCTIVIDAD.map((r) => (
        <button
          key={r.key}
          onClick={() => setRango(r.key)}
          className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition"
          style={{
            background:
              rango === r.key
                ? "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))"
                : "rgba(255,255,255,0.04)",
            color: rango === r.key ? "#fff" : "var(--nuvia-text-secondary)",
            border: rango === r.key ? "1px solid transparent" : "1px solid var(--nuvia-border)",
          }}
        >
          {r.label}
        </button>
      ))}
      <input
        type="month"
        value={`${mesRef.anio}-${String(mesRef.mes).padStart(2, "0")}`}
        onChange={(e) => {
          const [a, m] = e.target.value.split("-").map(Number);
          if (a && m) setMesRef({ anio: a, mes: m });
        }}
        className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--nuvia-border)",
          color: "var(--nuvia-text-primary)",
          colorScheme: "dark",
        }}
      />
    </div>
  );

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Activity size={12} />, label: `Gerencia · ${periodo.label}`, tone: "blue" }}
        title="Productividad y Tiempos"
        description="Ranking gamificado, retos del equipo y coaching NUVIA por periodo."
        actions={rangoActions}
      />

      <KpiGrid cols={4}>
        <KpiCard icon={<TrendingUp size={16} />} tone="blue" label="Transiciones" value={totales.cambios} />
        <KpiCard icon={<Users size={16} />} tone="green" label="Casos cerrados" value={totales.cerrados} />
        <KpiCard icon={<AlertTriangle size={16} />} tone={totales.alertas > 0 ? "warning" : "neutral"} label="Alertas recibidas" value={totales.alertas} />
        <KpiCard icon={<Timer size={16} />} tone="neutral" label="Ciclo promedio (h)" value={totales.promCiclo} />
      </KpiGrid>

      {/* PODIUM NUVIA */}
      <PodiumBlock top3={top3} loading={loading} />

      {/* META DEL EQUIPO */}
      <MetaEquipo
        cerrados={totales.cerrados}
        meta={metaCerrados}
        progreso={progresoMeta}
        alertas={totales.alertas}
        ciclo={totales.promCiclo}
      />

      <InsightCard scope="productividad" />

      <NCard padding="md">
        <SectionHeader
          title="Ranking operativo del periodo"
          description="Score = transiciones + (cerrados × 3) − alertas · Top 3 destacados con medalla."
        />
        {loading && (
          <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
            Calculando métricas…
          </div>
        )}
        {err && (
          <div className="py-8 text-center text-sm" style={{ color: "var(--nuvia-danger)" }}>
            {err}
          </div>
        )}
        {!loading && !err && ranked.length === 0 && (
          <EmptyState title="Sin actividad registrada" description="No hay datos para el periodo seleccionado." />
        )}
        {!loading && !err && ranked.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "var(--nuvia-text-body)" }}>
              <thead>
                <tr style={{ color: "var(--nuvia-text-secondary)" }}>
                  <th className="text-left py-2 pl-2 pr-3 text-[11px] uppercase tracking-wider">#</th>
                  <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider">Colaborador</th>
                  <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider">Transiciones</th>
                  <th className="py-2 pr-4 text-right text-[11px] uppercase tracking-wider">Cerrados</th>
                  <th className="text-left py-2 pr-4 text-[11px] uppercase tracking-wider">Activos</th>
                  <th className="py-2 pr-4 text-right text-[11px] uppercase tracking-wider">Alertas</th>
                  <th className="py-2 pr-4 text-right text-[11px] uppercase tracking-wider">Ciclo (h)</th>
                  <th className="py-2 pr-4 text-right text-[11px] uppercase tracking-wider">Score</th>
                  <th className="py-2 pr-2 text-right text-[11px] uppercase tracking-wider">Δ vs prev</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, idx) => {
                  const pos = idx + 1;
                  const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : null;
                  const prev = prevScoreByUser.get(r.user_id) ?? 0;
                  const delta = r.score - prev;
                  const highlight = pos <= 3;
                  return (
                    <tr
                      key={r.user_id}
                      className="transition"
                      style={{
                        background: highlight ? "rgba(255,255,255,0.025)" : "transparent",
                      }}
                    >
                      <td className="py-3 pl-2 pr-3">
                        <div
                          className="grid place-items-center rounded-lg font-bold"
                          style={{
                            width: 32,
                            height: 32,
                            background: highlight
                              ? pos === 1
                                ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
                                : pos === 2
                                  ? "linear-gradient(135deg, #cbd5e1, #94a3b8)"
                                  : "linear-gradient(135deg, #d97706, #92400e)"
                              : "rgba(255,255,255,0.04)",
                            color: highlight ? "#0b1121" : "var(--nuvia-text-secondary)",
                            fontSize: 13,
                          }}
                        >
                          {medal ?? pos}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <Avatar nombre={r.nombre} avatarUrl={r.avatar_url} size={36} />
                          <div>
                            <div className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                              {r.nombre}
                            </div>
                            <div className="text-[11px]" style={{ color: "var(--nuvia-text-secondary)" }}>
                              {r.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4" style={{ minWidth: 140 }}>
                        <ProgressBar
                          value={r.cambios_estado}
                          max={maxTrans}
                          color="var(--nuvia-accent-blue)"
                        />
                      </td>
                      <td
                        className="py-3 pr-4 text-right font-semibold"
                        style={{ color: r.casos_cerrados > 0 ? "var(--nuvia-success)" : "var(--nuvia-text-secondary)" }}
                      >
                        {r.casos_cerrados}
                      </td>
                      <td className="py-3 pr-4" style={{ minWidth: 120 }}>
                        <ProgressBar
                          value={r.casos_activos}
                          max={maxActivos}
                          color="var(--nuvia-accent-green)"
                        />
                      </td>
                      <td
                        className="py-3 pr-4 text-right"
                        style={{ color: r.alertas_recibidas > 0 ? "var(--nuvia-warning)" : "var(--nuvia-text-secondary)" }}
                      >
                        {r.alertas_recibidas}
                      </td>
                      <td className="py-3 pr-4 text-right" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {r.horas_promedio_ciclo > 0 ? r.horas_promedio_ciclo : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span
                          className="inline-flex items-center gap-1 font-bold px-2 py-1 rounded-md"
                          style={{
                            background: r.score > 0 ? "rgba(132,185,143,0.12)" : "rgba(255,255,255,0.04)",
                            color: r.score > 0 ? "var(--nuvia-success)" : "var(--nuvia-text-secondary)",
                            fontSize: 13,
                          }}
                        >
                          <Flame size={12} /> {r.score}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <TrendChip delta={delta} />
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

/* ============================ SUBCOMPONENTES ============================ */

function Avatar({ nombre, avatarUrl, size = 40 }: { nombre: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={nombre}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "linear-gradient(135deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))",
        color: "#fff",
        fontSize: Math.round(size * 0.38),
      }}
    >
      {iniciales(nombre)}
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 55%, #fff))`,
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
      </div>
      <span className="font-mono text-xs" style={{ color: "var(--nuvia-text-primary)", minWidth: 28, textAlign: "right" }}>
        {value}
      </span>
    </div>
  );
}

function TrendChip({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md"
        style={{ background: "rgba(255,255,255,0.04)", color: "var(--nuvia-text-secondary)" }}
      >
        <Minus size={10} /> 0
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md"
      style={{
        background: up ? "rgba(132,185,143,0.12)" : "rgba(239,68,68,0.12)",
        color: up ? "var(--nuvia-success)" : "var(--nuvia-danger)",
      }}
    >
      {up ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {up ? "+" : ""}
      {delta}
    </span>
  );
}

function PodiumBlock({
  top3,
  loading,
}: {
  top3: (ProductividadUsuario & { score: number })[];
  loading: boolean;
}) {
  const [second, first, third] = [top3[1], top3[0], top3[2]];
  return (
    <section
      className="relative overflow-hidden rounded-[20px]"
      style={{
        background:
          "radial-gradient(circle at 50% 0%, rgba(251,191,36,0.10) 0%, transparent 50%), var(--nuvia-bg-tertiary)",
        border: "1px solid var(--nuvia-border-strong)",
        padding: "var(--nuvia-space-5)",
        boxShadow: "var(--nuvia-shadow-md)",
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="grid place-items-center rounded-xl"
            style={{
              width: 36,
              height: 36,
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              color: "#0b1121",
            }}
          >
            <Trophy size={18} />
          </div>
          <div>
            <div className="font-bold text-white" style={{ fontSize: "var(--nuvia-text-h3)" }}>
              Podium NUVIA
            </div>
            <div style={{ fontSize: "var(--nuvia-text-caption)", color: "var(--nuvia-text-secondary)" }}>
              Top 3 del periodo · Disciplina, seguimiento y equipo.
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Calculando podium…
        </div>
      ) : top3.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>
          Aún no hay resultados suficientes para el podium.
        </div>
      ) : (
        <div className="grid gap-4 items-end" style={{ gridTemplateColumns: "1fr 1.3fr 1fr" }}>
          <PodiumSpot user={second} pos={2} height={160} glow="#cbd5e1" />
          <PodiumSpot user={first} pos={1} height={210} glow="#fbbf24" />
          <PodiumSpot user={third} pos={3} height={140} glow="#d97706" />
        </div>
      )}

      <div
        className="mt-6 text-center italic"
        style={{ fontSize: "var(--nuvia-text-caption)", color: "var(--nuvia-text-secondary)" }}
      >
        “Los resultados se construyen con disciplina, seguimiento y trabajo en equipo.”
      </div>
    </section>
  );
}

function PodiumSpot({
  user,
  pos,
  height,
  glow,
}: {
  user: (ProductividadUsuario & { score: number }) | undefined;
  pos: 1 | 2 | 3;
  height: number;
  glow: string;
}) {
  if (!user) {
    return (
      <div
        className="rounded-2xl grid place-items-center text-xs"
        style={{
          height,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed var(--nuvia-border)",
          color: "var(--nuvia-text-secondary)",
        }}
      >
        Puesto {pos} vacante
      </div>
    );
  }
  const medal = pos === 1 ? "🥇" : pos === 2 ? "🥈" : "🥉";
  return (
    <div
      className="relative rounded-2xl overflow-hidden flex flex-col items-center justify-end pb-4 pt-6 px-3"
      style={{
        height,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
        border: `1px solid ${glow}55`,
        boxShadow: `0 0 40px -8px ${glow}66, inset 0 0 24px ${glow}22`,
      }}
    >
      <div
        className="absolute top-0 inset-x-0 h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }}
      />
      <div className="text-2xl mb-2">{medal}</div>
      <Avatar nombre={user.nombre} avatarUrl={user.avatar_url} size={pos === 1 ? 64 : 52} />
      <div
        className="mt-2 font-bold text-center text-white"
        style={{ fontSize: pos === 1 ? 15 : 13, lineHeight: 1.2 }}
      >
        {user.nombre}
      </div>
      <div
        className="mt-1 font-mono font-bold"
        style={{ color: glow, fontSize: pos === 1 ? 22 : 18 }}
      >
        {user.score}
      </div>
      <div
        className="flex gap-3 mt-1 text-[10px]"
        style={{ color: "var(--nuvia-text-secondary)" }}
      >
        <span>T {user.cambios_estado}</span>
        <span>C {user.casos_cerrados}</span>
        <span>A {user.alertas_recibidas}</span>
      </div>
    </div>
  );
}

function MetaEquipo({
  cerrados,
  meta,
  progreso,
  alertas,
  ciclo,
}: {
  cerrados: number;
  meta: number;
  progreso: number;
  alertas: number;
  ciclo: number;
}) {
  return (
    <section
      className="rounded-[20px] grid gap-4 md:grid-cols-3 p-5"
      style={{
        background: "var(--nuvia-bg-tertiary)",
        border: "1px solid var(--nuvia-border-strong)",
        boxShadow: "var(--nuvia-shadow-md)",
      }}
    >
      <RetoCard
        icon={<Target size={16} />}
        color="var(--nuvia-accent-blue)"
        label="Meta del equipo"
        titulo={`Cerrar ${meta} casos`}
        detalle={`${cerrados} de ${meta} · ${progreso}%`}
        progreso={progreso}
      />
      <RetoCard
        icon={<AlertTriangle size={16} />}
        color="var(--nuvia-warning)"
        label="Reto operativo"
        titulo="Reducir alertas 20%"
        detalle={`${alertas} alertas activas · seguimiento en curso`}
        progreso={alertas === 0 ? 100 : Math.max(0, 100 - Math.min(100, alertas * 5))}
      />
      <RetoCard
        icon={<Timer size={16} />}
        color="var(--nuvia-accent-green)"
        label="Reto de tiempos"
        titulo="Bajar ciclo 15%"
        detalle={ciclo > 0 ? `Ciclo actual: ${ciclo}h` : "Sin cierres en el periodo"}
        progreso={ciclo > 0 ? Math.min(100, Math.round((72 / Math.max(ciclo, 1)) * 100)) : 0}
      />
    </section>
  );
}

function RetoCard({
  icon,
  color,
  label,
  titulo,
  detalle,
  progreso,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  titulo: string;
  detalle: string;
  progreso: number;
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--nuvia-border)",
      }}
    >
      <div
        className="flex items-center gap-2 uppercase font-bold tracking-wider mb-2"
        style={{ color, fontSize: "var(--nuvia-text-badge)" }}
      >
        {icon}
        {label}
      </div>
      <div className="font-bold text-white mb-1" style={{ fontSize: 15 }}>
        {titulo}
      </div>
      <div className="text-xs mb-3" style={{ color: "var(--nuvia-text-secondary)" }}>
        {detalle}
      </div>
      <div
        className="relative h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progreso}%`,
            background: `linear-gradient(90deg, ${color}, color-mix(in oklab, ${color} 55%, #fff))`,
            boxShadow: `0 0 10px ${color}66`,
          }}
        />
      </div>
    </div>
  );
}
