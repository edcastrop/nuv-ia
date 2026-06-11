// Expediente Maestro V2 — Historia Clínica Financiera (preview)
// Fase 7.6.1C · NUVIA Design System V2 · solo presentación.
// Construido desde cero. NO reemplaza /expediente/$id ni /expediente-maestro/$id.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Gauge,
  Heart,
  Loader2,
  Stethoscope,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExpediente, type Expediente } from "@/lib/expedientes";
import {
  ETAPAS_PIPELINE,
  computeEtapaActual,
  type EtapaPipelineId,
} from "@/lib/pipelineEtapas";
import {
  PageLayout,
  ExecutiveHero,
  KpiGrid,
  KpiCard,
  NCard,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";

export const Route = createFileRoute("/_authenticated/expediente-v2/$id")({
  component: ExpedienteV2Page,
  head: () => ({ meta: [{ title: "Historia Clínica Financiera · NUVIA" }] }),
});

interface HistorialRow {
  id: string;
  estado_caso_anterior: string | null;
  estado_caso_nuevo: string | null;
  accion_origen: string | null;
  observacion: string | null;
  created_at: string;
}

const SLA_DIAS: Record<EtapaPipelineId, number> = {
  lead: 3, extracto: 5, proyeccion: 5, presentacion: 7, cierre: 7,
  contratacion: 10, radicacion: 7, banco: 21, resultado_banco: 5,
  aceptacion_cliente: 5, informe: 5, cuenta: 5, pago: 10, comision: 7,
  paz_salvo: 5, finalizado: 0,
};

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const diasDesde = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;

function ExpedienteV2Page() {
  const { id } = Route.useParams();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [hist, setHist] = useState<HistorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const e = await getExpediente(id);
        setExp(e);
        const { data } = await supabase
          .from("expediente_historial")
          .select("id, estado_caso_anterior, estado_caso_nuevo, accion_origen, observacion, created_at")
          .eq("expediente_id", id)
          .order("created_at", { ascending: false })
          .limit(30);
        setHist((data as HistorialRow[]) ?? []);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const etapa = useMemo(() => {
    if (!exp) return null;
    const eid = computeEtapaActual({
      estado_caso: (exp as unknown as { estado_caso?: string | null }).estado_caso ?? null,
    } as Parameters<typeof computeEtapaActual>[0]);
    return ETAPAS_PIPELINE.find((e) => e.id === eid) ?? null;
  }, [exp]);

  const diasEnEtapa = diasDesde(exp?.updated_at);
  const sla = etapa ? SLA_DIAS[etapa.id] ?? 7 : 0;
  const exceso = Math.max(0, diasEnEtapa - sla);
  const enRiesgo = exceso > 0;
  const honorarios = Number(exp?.honorarios_final) || Number(exp?.honorarios_base) || 0;
  const aprobado = exp?.aprobado_data ?? null;

  // Diagnóstico: heurística simple sobre datos disponibles
  const diagnosticos = useMemo(() => {
    if (!exp) return [];
    const out: { tipo: "alerta" | "ok" | "info"; titulo: string; detalle: string }[] = [];
    if (enRiesgo) {
      out.push({
        tipo: "alerta",
        titulo: `Caso fuera de SLA (+${exceso}d)`,
        detalle: `La etapa ${etapa?.titulo ?? "—"} excede su umbral de ${sla} días.`,
      });
    }
    if (!exp.banco) out.push({ tipo: "alerta", titulo: "Banco no asignado", detalle: "Bloquea radicación y motor de honorarios." });
    if (!exp.cedula) out.push({ tipo: "alerta", titulo: "Cédula faltante", detalle: "Validación de identidad imposible sin documento." });
    if (!exp.numero_credito) out.push({ tipo: "info", titulo: "Número de crédito pendiente", detalle: "Recomendado para radicación." });
    if (aprobado) out.push({ tipo: "ok", titulo: "Aprobación bancaria registrada", detalle: `Radicado ${aprobado.radicado || "—"} · cuota aprobada ${fmtCOP(aprobado.cuotaAprobada)}.` });
    if (out.length === 0) out.push({ tipo: "ok", titulo: "Sin hallazgos relevantes", detalle: "El expediente está sano según los datos disponibles." });
    return out;
  }, [exp, enRiesgo, exceso, etapa, sla, aprobado]);

  // Plan de tratamiento: próximas acciones según etapa
  const plan = useMemo(() => {
    if (!etapa) return [];
    const responsable = etapa.responsables.join(", ");
    const map: Partial<Record<EtapaPipelineId, string[]>> = {
      lead: ["Confirmar contacto y necesidad", "Solicitar extracto bancario"],
      extracto: ["Cargar y leer extracto", "Validar saldo y cuota actual"],
      proyeccion: ["Generar proyección financiera", "Enviar a QA financiero"],
      presentacion: ["Agendar presentación con cliente", "Compartir propuesta"],
      cierre: ["Confirmar aceptación", "Recolectar documentos para contratación"],
      contratacion: ["Generar contrato y poder", "Firmar y subir soportes"],
      radicacion: ["Preparar paquete", "Radicar ante el banco"],
      banco: ["Hacer seguimiento al banco", "Registrar requerimientos"],
      resultado_banco: ["Registrar respuesta del banco", "Reajustar honorarios"],
      aceptacion_cliente: ["Notificar resultado", "Obtener aceptación expresa"],
      informe: ["Generar informe final", "Enviar al cliente"],
      cuenta: ["Emitir cuenta de cobro", "Enviar al cliente"],
      pago: ["Verificar transferencia", "Conciliar y registrar"],
      paz_salvo: ["Emitir paz y salvo", "Cerrar operativamente"],
    };
    return (map[etapa.id] ?? []).map((accion) => ({ accion, responsable }));
  }, [etapa]);

  // Evolución: timeline de las 14 etapas con estado relativo a la actual
  const timeline = useMemo(() => {
    const activeNum = etapa?.numero ?? 0;
    return ETAPAS_PIPELINE.filter((e) => e.id !== "finalizado" && e.id !== "comision").map((e) => {
      const status: "done" | "current" | "pending" =
        e.numero < activeNum ? "done" : e.numero === activeNum ? "current" : "pending";
      return { ...e, status };
    });
  }, [etapa]);

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center text-[var(--nuvia-text-secondary)]">
        <div className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={18} /> Cargando historia clínica…
        </div>
      </div>
    );
  }

  if (err || !exp) {
    return (
      <PageLayout>
        <EmptyState
          tone="warning"
          title="No se pudo cargar el expediente"
          description={err ?? "No existe o no tienes permisos para verlo."}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Stethoscope size={11} />, label: "Historia Clínica Financiera · v2", tone: "blue" }}
        title={exp.cliente_nombre}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1"><User size={11} /> {exp.cedula ?? "Sin cédula"}</span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1"><Banknote size={11} /> {exp.banco ?? "Sin banco"}</span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1"><FileText size={11} /> {exp.numero_credito ?? "—"}</span>
            <span className="opacity-40">·</span>
            <span className="inline-flex items-center gap-1"><CalendarClock size={11} /> Ingreso {fmtDate(exp.created_at)}</span>
          </span>
        }
        meta={
          etapa && (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${
                enRiesgo
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <span className={`size-1.5 rounded-full ${enRiesgo ? "bg-rose-400" : "bg-emerald-400"} animate-pulse`} />
              E{etapa.numero} · {etapa.titulo}
            </span>
          )
        }
        actions={
          <Link
            to="/casos"
            className="glass-button inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <ArrowLeft size={12} /> Volver a casos
          </Link>
        }
      />

      {/* Signos vitales */}
      <KpiGrid cols={4}>
        <KpiCard
          label="Días en etapa"
          value={`${diasEnEtapa}d`}
          tone={enRiesgo ? "danger" : diasEnEtapa > sla * 0.7 ? "warning" : "green"}
          icon={<Clock size={14} />}
          hint={`SLA ${sla}d · ${enRiesgo ? `+${exceso}d exceso` : "dentro del umbral"}`}
        />
        <KpiCard
          label="Etapa actual"
          value={etapa ? `E${etapa.numero}` : "—"}
          tone="blue"
          icon={<Activity size={14} />}
          hint={etapa?.titulo ?? "Sin etapa"}
        />
        <KpiCard
          label="Honorarios"
          value={fmtCOP(honorarios)}
          tone="neutral"
          icon={<Banknote size={14} />}
          hint={exp.descuento ? `Descuento aplicado ${exp.descuento}%` : "Sin descuento"}
        />
        <KpiCard
          label="Salud del caso"
          value={enRiesgo ? "En riesgo" : diagnosticos.some((d) => d.tipo === "alerta") ? "Vigilar" : "Estable"}
          tone={enRiesgo ? "danger" : diagnosticos.some((d) => d.tipo === "alerta") ? "warning" : "green"}
          icon={<Heart size={14} />}
          hint={`${diagnosticos.filter((d) => d.tipo === "alerta").length} alertas activas`}
        />
      </KpiGrid>

      <PageLayout.BodyWithAside>
        <PageLayout.Main>
          {/* Diagnóstico */}
          <NCard variant="default">
            <SectionHeader
              title="Diagnóstico"
              description="Hallazgos automáticos sobre la salud del expediente."
            />
            <div className="mt-3 space-y-2">
              {diagnosticos.map((d, i) => {
                const tone =
                  d.tipo === "alerta"
                    ? { dot: "bg-rose-400", border: "border-rose-500/20", bg: "bg-rose-500/[0.04]" }
                    : d.tipo === "ok"
                      ? { dot: "bg-emerald-400", border: "border-emerald-500/20", bg: "bg-emerald-500/[0.04]" }
                      : { dot: "bg-sky-400", border: "border-sky-500/20", bg: "bg-sky-500/[0.04]" };
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-3 py-2 rounded-md border ${tone.border} ${tone.bg}`}
                  >
                    <span className={`size-1.5 mt-1.5 rounded-full ${tone.dot} shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-[var(--nuvia-text-primary)]">{d.titulo}</div>
                      <div className="text-[11px] text-[var(--nuvia-text-secondary)] mt-0.5">{d.detalle}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </NCard>

          {/* Plan de tratamiento */}
          <NCard variant="default">
            <SectionHeader
              title="Plan de tratamiento"
              description="Próximas acciones recomendadas para esta etapa."
              icon={<ClipboardList size={14} />}
            />
            {plan.length === 0 ? (
              <EmptyState compact tone="neutral" title="Sin acciones pendientes" description="El caso no tiene próximos pasos definidos." />
            ) : (
              <ol className="mt-3 space-y-1.5">
                {plan.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono text-[var(--nuvia-text-secondary)]">{(i + 1).toString().padStart(2, "0")}</span>
                      <span className="text-[12px] text-[var(--nuvia-text-primary)] truncate">{p.accion}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] shrink-0">
                      {p.responsable}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </NCard>

          {/* Evolución / Timeline 14 etapas */}
          <NCard variant="default">
            <SectionHeader
              title="Evolución del caso"
              description="Ciclo NUVEX de 14 etapas. La etapa actual está resaltada."
              icon={<TrendingUp size={14} />}
            />
            <div className="mt-4 relative">
              <div className="absolute left-3 top-1 bottom-1 w-px bg-[var(--nuvia-border)]" />
              <div className="space-y-2">
                {timeline.map((e) => {
                  const icon =
                    e.status === "done" ? (
                      <CheckCircle2 size={16} className="text-emerald-400" />
                    ) : e.status === "current" ? (
                      <span className="relative inline-flex items-center justify-center">
                        <span className="absolute inline-flex size-5 rounded-full bg-sky-400/30 animate-ping" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-sky-400" />
                      </span>
                    ) : (
                      <Circle size={16} className="text-[var(--nuvia-text-secondary)]/40" />
                    );
                  return (
                    <div
                      key={e.id}
                      className={`relative pl-9 pr-3 py-2 rounded-md ${
                        e.status === "current"
                          ? "bg-sky-500/[0.06] border border-sky-500/20"
                          : e.status === "done"
                            ? "bg-emerald-500/[0.03]"
                            : ""
                      }`}
                    >
                      <span className="absolute left-1 top-2.5">{icon}</span>
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={`text-[12px] ${
                              e.status === "current"
                                ? "text-[var(--nuvia-text-primary)] font-semibold"
                                : e.status === "done"
                                  ? "text-[var(--nuvia-text-primary)]"
                                  : "text-[var(--nuvia-text-secondary)]"
                            }`}
                          >
                            E{e.numero} · {e.titulo}
                          </div>
                          <div className="text-[10px] text-[var(--nuvia-text-secondary)] truncate">{e.descripcion}</div>
                        </div>
                        {e.status === "current" && (
                          <span className="text-[10px] tabular-nums text-sky-300 shrink-0">
                            {diasEnEtapa}d / SLA {sla}d
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </NCard>

          {/* Historial real */}
          <NCard variant="default">
            <SectionHeader
              title="Bitácora clínica"
              description="Cambios de estado y notas registradas."
              icon={<FileText size={14} />}
            />
            {hist.length === 0 ? (
              <EmptyState compact tone="neutral" title="Sin movimientos registrados" description="Aún no hay cambios de estado en este expediente." />
            ) : (
              <div className="mt-3 space-y-1.5">
                {hist.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-2 px-3 py-2 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)]"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] text-[var(--nuvia-text-primary)]">
                        <span className="text-[var(--nuvia-text-secondary)]">{h.estado_caso_anterior ?? "—"}</span>
                        <span className="mx-1.5 text-[var(--nuvia-text-secondary)]">→</span>
                        <span className="font-semibold">{h.estado_caso_nuevo ?? "—"}</span>
                      </div>
                      {(h.observacion || h.accion_origen) && (
                        <div className="text-[10px] text-[var(--nuvia-text-secondary)] mt-0.5 truncate">
                          {h.observacion || h.accion_origen}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-[var(--nuvia-text-secondary)] shrink-0 tabular-nums">
                      {fmtDate(h.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </NCard>
        </PageLayout.Main>

        <PageLayout.Aside>
          {/* Anamnesis */}
          <NCard variant="default">
            <SectionHeader title="Anamnesis" description="Datos clínicos del caso." />
            <dl className="mt-3 space-y-2 text-[11px]">
              {[
                ["Modo", exp.modo?.toUpperCase()],
                ["Producto", exp.producto ?? "—"],
                ["Estado", exp.estado],
                ["Honorarios base", fmtCOP(exp.honorarios_base)],
                ["Descuento", exp.descuento ? `${exp.descuento}%` : "—"],
                ["Honorarios final", fmtCOP(exp.honorarios_final)],
                ["Acertividad", exp.acertividad_global != null ? `${exp.acertividad_global}%` : "—"],
                ["Última actualización", fmtDate(exp.updated_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--nuvia-border)] pb-1.5 last:border-0">
                  <dt className="text-[var(--nuvia-text-secondary)] uppercase tracking-wider text-[10px]">{k}</dt>
                  <dd className="text-[var(--nuvia-text-primary)] text-right tabular-nums">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </NCard>

          {/* Pronóstico / aprobación */}
          <NCard variant="default">
            <SectionHeader title="Pronóstico" description="Resultado esperado del tratamiento." icon={<Target size={14} />} />
            {aprobado ? (
              <div className="mt-3 space-y-2 text-[11px]">
                <Row label="Cuota aprobada" value={fmtCOP(aprobado.cuotaAprobada)} highlight />
                <Row label="Plazo aprobado" value={`${aprobado.plazoAprobado} meses`} />
                <Row label="Ahorro total" value={fmtCOP(aprobado.ahorroAprobado ?? 0)} highlight />
                <Row label="Años eliminados" value={aprobado.añosEliminados ?? "—"} />
                <Row label="Fecha aprobación" value={fmtDate(aprobado.fechaAprobacion)} />
                <Row label="Radicado" value={aprobado.radicado || "—"} />
              </div>
            ) : (
              <EmptyState compact tone="neutral" icon={<Gauge size={18} />} title="Sin pronóstico todavía" description="Aparecerá cuando el banco responda la radicación." />
            )}
          </NCard>

          {/* Alertas resumen */}
          <NCard variant="default" className={enRiesgo ? "border-rose-500/30" : ""}>
            <SectionHeader title="Alertas" icon={<AlertTriangle size={14} />} />
            <div className="mt-3 space-y-1.5">
              {diagnosticos.filter((d) => d.tipo === "alerta").length === 0 ? (
                <div className="text-[11px] text-[var(--nuvia-text-secondary)]">Sin alertas activas.</div>
              ) : (
                diagnosticos
                  .filter((d) => d.tipo === "alerta")
                  .map((d, i) => (
                    <div key={i} className="text-[11px] text-rose-300">
                      • {d.titulo}
                    </div>
                  ))
              )}
            </div>
          </NCard>
        </PageLayout.Aside>
      </PageLayout.BodyWithAside>
    </PageLayout>
  );
}

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-[var(--nuvia-border)] pb-1.5 last:border-0">
      <span className="text-[var(--nuvia-text-secondary)] uppercase tracking-wider text-[10px]">{label}</span>
      <span className={`tabular-nums text-right ${highlight ? "text-emerald-300 font-semibold" : "text-[var(--nuvia-text-primary)]"}`}>{value}</span>
    </div>
  );
}
