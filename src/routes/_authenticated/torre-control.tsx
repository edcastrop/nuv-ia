import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card } from "@/components/nuvex/ui";
import { NUVEX } from "@/components/nuvex/constants";
import {
  ETAPAS_TORRE,
  SEMAFORO_COLORS,
  agruparPorEtapa,
  contarActivos,
  contarDetenidos,
  contarVencidos,
  type EtapaConteo,
  type ExpedienteResumen,
} from "@/lib/torreControl";
import { AlertTriangle, Clock, ShieldCheck, Activity, RadioTower, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/torre-control")({
  component: TorreControlPage,
  head: () => ({ meta: [{ title: "Torre de Control · NUVEX" }] }),
});

function TorreControlPage() {
  const { isSuperAdmin, roles } = useUserRole();
  const autorizado = isSuperAdmin || roles.includes("gerencia" as never);

  const [rows, setRows] = useState<ExpedienteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedEtapa, setSelectedEtapa] = useState<string | null>(null);
  const [usuariosPendientes, setUsuariosPendientes] = useState(0);

  useEffect(() => {
    if (!autorizado) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [{ data: exps, error: e1 }, { count: pend }] = await Promise.all([
          supabase
            .from("expedientes")
            .select("id, cliente_nombre, banco, estado_caso, updated_at")
            .order("updated_at", { ascending: false })
            .limit(2000),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("estado_acceso", "pendiente"),
        ]);
        if (!alive) return;
        if (e1) throw e1;
        setRows((exps ?? []) as ExpedienteResumen[]);
        setUsuariosPendientes(pend ?? 0);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [autorizado]);

  const grupos = useMemo(() => agruparPorEtapa(rows), [rows]);
  const totalActivos = useMemo(() => contarActivos(rows), [rows]);
  const totalDetenidos = useMemo(() => contarDetenidos(rows), [rows]);
  const totalVencidos = useMemo(() => contarVencidos(grupos), [grupos]);
  const grupoSeleccionado = useMemo(
    () => (selectedEtapa ? grupos.find((g) => g.etapa.key === selectedEtapa) ?? null : null),
    [grupos, selectedEtapa],
  );

  if (!autorizado) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: "#7A0E0E" }}>
              <Lock size={18} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-[#242424]">Acceso restringido</h1>
              <p className="text-sm text-[#242424]/70 mt-1">
                La Torre de Control Operativa es exclusiva del Super Admin y de Gerencia Administrativa y Operaciones.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-6 space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
              NUVEX · Gerencia Administrativa y Operaciones
            </div>
            <h1 className="text-2xl font-semibold text-[#242424] flex items-center gap-2">
              <RadioTower size={22} style={{ color: NUVEX.azul }} /> Torre de Control Operativa
            </h1>
            <p className="text-sm text-[#242424]/65 mt-1">
              Control de las 14 etapas del proceso NUVEX con semáforos SLA por tiempo en etapa.
            </p>
          </div>
          <div className="text-[11px] text-[#242424]/55">
            Última actualización: {new Date().toLocaleString("es-CO")}
          </div>
        </div>
      </Card>

      {loading && <Card><div className="text-sm text-[#242424]/60 py-6 text-center">Cargando expedientes…</div></Card>}
      {err && <Card><div className="text-sm text-[#B42318] py-6 text-center">{err}</div></Card>}

      {!loading && !err && (
        <>
          {/* KPIs globales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Activity size={18} />} color={NUVEX.azul} label="Expedientes activos" value={totalActivos} />
            <KpiCard icon={<Clock size={18} />} color="#8A5A00" label="Detenidos" value={totalDetenidos} subtitle="Devueltos / negados / prejurídico" />
            <KpiCard icon={<AlertTriangle size={18} />} color="#B42318" label="Vencidos (SLA)" value={totalVencidos} subtitle="Excedieron umbral por etapa" />
            <KpiCard icon={<ShieldCheck size={18} />} color="#1F7A45" label="Usuarios pendientes" value={usuariosPendientes} subtitle="Esperando aprobación" link="/super-admin/accesos" />
          </div>

          {/* Grilla de etapas */}
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#242424]">Etapas operativas (1 → 14)</h2>
              <Leyenda />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {grupos.map((g) => (
                <EtapaCard
                  key={g.etapa.key}
                  grupo={g}
                  active={selectedEtapa === g.etapa.key}
                  onClick={() => setSelectedEtapa(selectedEtapa === g.etapa.key ? null : g.etapa.key)}
                />
              ))}
            </div>
          </Card>

          {grupoSeleccionado && (
            <Card>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
                    Etapa {grupoSeleccionado.etapa.numero}
                  </div>
                  <h3 className="text-lg font-semibold text-[#242424]">{grupoSeleccionado.etapa.label}</h3>
                  <p className="text-xs text-[#242424]/65 mt-0.5">{grupoSeleccionado.etapa.descripcion}</p>
                  {grupoSeleccionado.etapa.slaRojoHoras > 0 && (
                    <p className="text-[11px] text-[#242424]/55 mt-1">
                      SLA: amarillo {Math.round(grupoSeleccionado.etapa.slaAmarilloHoras)}h ·
                      rojo {Math.round(grupoSeleccionado.etapa.slaRojoHoras)}h
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedEtapa(null)}
                  className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-[11px] font-medium"
                >
                  Cerrar
                </button>
              </div>
              {grupoSeleccionado.expedientes.length === 0 ? (
                <div className="py-6 text-center text-sm text-[#242424]/60">Sin expedientes en esta etapa.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-[#242424]/55 border-b border-[#E3E7EE]">
                        <th className="py-2 pr-4">Cliente</th>
                        <th className="py-2 pr-4">Banco</th>
                        <th className="py-2 pr-4">Tiempo en etapa</th>
                        <th className="py-2 pr-4">SLA</th>
                        <th className="py-2 pr-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {grupoSeleccionado.expedientes.slice(0, 200).map((e) => {
                        const c = SEMAFORO_COLORS[e.nivel];
                        return (
                          <tr key={e.id} className="border-b border-[#F0F2F6] hover:bg-[#F7F9FB]">
                            <td className="py-2 pr-4 font-medium text-[#242424]">{e.cliente_nombre}</td>
                            <td className="py-2 pr-4 text-[#242424]/70">{e.banco || "—"}</td>
                            <td className="py-2 pr-4 text-[#242424]/70">{formatHoras(e.horas)}</td>
                            <td className="py-2 pr-4">
                              <span
                                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
                                style={{ background: c.bg, color: c.color, borderColor: c.border }}
                              >
                                {c.label}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-right">
                              <Link to="/casos/$id" params={{ id: e.id }} className="text-[11px] font-medium text-[#445DA3] hover:underline">
                                Ver expediente →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, color, label, value, subtitle, link }: {
  icon: React.ReactNode; color: string; label: string; value: number; subtitle?: string; link?: string;
}) {
  const inner = (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white shrink-0" style={{ background: color }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-[#242424]/55">{label}</div>
          <div className="text-2xl font-semibold text-[#242424] leading-tight">{value}</div>
          {subtitle && <div className="text-[11px] text-[#242424]/55 mt-0.5">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}

function EtapaCard({ grupo, active, onClick }: { grupo: EtapaConteo; active: boolean; onClick: () => void }) {
  const peor = grupo.rojo > 0 ? SEMAFORO_COLORS.rojo : grupo.amarillo > 0 ? SEMAFORO_COLORS.amarillo : grupo.total > 0 ? SEMAFORO_COLORS.verde : SEMAFORO_COLORS.neutro;
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl border bg-white p-4 transition hover:shadow-md"
      style={{
        borderColor: active ? peor.color : "#E3E7EE",
        boxShadow: active ? `0 0 0 2px ${peor.color}33` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#242424]/55">
            Etapa {grupo.etapa.numero}
          </div>
          <div className="text-sm font-semibold text-[#242424] mt-0.5">{grupo.etapa.label}</div>
        </div>
        <span
          className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full px-2 text-[11px] font-bold border"
          style={{ background: peor.bg, color: peor.color, borderColor: peor.border }}
        >
          {grupo.total}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Pill n={grupo.verde} c={SEMAFORO_COLORS.verde} />
        <Pill n={grupo.amarillo} c={SEMAFORO_COLORS.amarillo} />
        <Pill n={grupo.rojo} c={SEMAFORO_COLORS.rojo} />
      </div>
    </button>
  );
}

function Pill({ n, c }: { n: number; c: { bg: string; color: string; border: string } }) {
  return (
    <span
      className="inline-flex h-5 min-w-[24px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold border"
      style={{ background: c.bg, color: c.color, borderColor: c.border, opacity: n === 0 ? 0.45 : 1 }}
    >
      {n}
    </span>
  );
}

function Leyenda() {
  return (
    <div className="flex items-center gap-2 text-[10px]">
      {(["verde", "amarillo", "rojo"] as const).map((k) => {
        const c = SEMAFORO_COLORS[k];
        return (
          <span
            key={k}
            className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold border"
            style={{ background: c.bg, color: c.color, borderColor: c.border }}
          >
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

function formatHoras(h: number): string {
  if (h < 1) return "menos de 1 h";
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  if (d < 30) return `${d.toFixed(1)} días`;
  return `${Math.round(d)} días`;
}
