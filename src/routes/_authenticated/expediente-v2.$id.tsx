// Expediente Maestro V2 — Historia Clínica Financiera (preview)
// Fase 7.6.1C-bis · NUVIA Design System V2 · solo presentación.
// NO migra producción. NO crea tablas. NO toca RLS. Solo evolución visual/UX.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock,
  FileText,
  Flame,
  Folder,
  Gauge,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Target,
  TrendingUp,
  User,
  UserCog,
  Users,
  X,
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
  NSelect,
  SectionHeader,
  EmptyState,
} from "@/components/nuvia";
import { useUserRole, isManager, type AppRole } from "@/hooks/useUserRole";
import {
  listTareas,
  crearTarea,
  actualizarTareaEstado,
  asignarTarea,
  listBitacora,
  agregarBitacora,
  type TareaPrioridad,
  type TareaEstado,
  type BitacoraTipo,
} from "@/lib/expedienteOperativo.functions";

interface TareaRow {
  id: string;
  expediente_id: string;
  responsable_id: string | null;
  titulo: string;
  descripcion: string | null;
  prioridad: TareaPrioridad;
  fecha_objetivo: string | null;
  estado: TareaEstado;
  completada_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BitacoraRow {
  id: string;
  expediente_id: string;
  usuario_id: string;
  comentario: string;
  tipo: BitacoraTipo;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ProfileLite {
  id: string;
  nombre: string | null;
  email: string | null;
}

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

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const diasDesde = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000)) : 0;

const parseMoney = (raw: unknown): number => {
  if (raw == null) return 0;
  const s = String(raw).replace(/[^0-9.-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

type Severidad = "critico" | "alerta" | "info";
interface Hallazgo {
  severidad: Severidad;
  titulo: string;
  bloqueador: string;
  responsable: string;
  fechaLimite: string;
  accion: string;
}

type Prioridad = "alta" | "media" | "baja";
interface PlanItem {
  accion: string;
  responsable: string;
  prioridad: Prioridad;
  fechaObjetivo: string;
  estado: "pendiente" | "en_curso" | "bloqueada";
}

function addDays(base: Date, d: number) {
  const x = new Date(base);
  x.setDate(x.getDate() + d);
  return x;
}

function ExpedienteV2Page() {
  const { id } = Route.useParams();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [hist, setHist] = useState<HistorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [commTab, setCommTab] = useState<"whatsapp" | "email" | "llamada" | "nota">("whatsapp");
  const [profilesById, setProfilesById] = useState<Record<string, ProfileLite>>({});
  const [profileList, setProfileList] = useState<ProfileLite[]>([]);
  const [showTareaForm, setShowTareaForm] = useState(false);

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
          .limit(50);
        setHist((data as HistorialRow[]) ?? []);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre, email")
          .eq("activo", true)
          .order("nombre", { ascending: true })
          .limit(200);
        const list = (profs as ProfileLite[]) ?? [];
        setProfileList(list);
        setProfilesById(Object.fromEntries(list.map((p) => [p.id, p])));
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ===== Tareas y Bitácora reales (D-2) =====
  const fetchTareas = useServerFn(listTareas);
  const fetchBitacora = useServerFn(listBitacora);
  const crearTareaFn = useServerFn(crearTarea);
  const actualizarEstadoFn = useServerFn(actualizarTareaEstado);
  const asignarFn = useServerFn(asignarTarea);
  const agregarBitacoraFn = useServerFn(agregarBitacora);
  const qc = useQueryClient();

  const tareasQuery = useQuery({
    queryKey: ["expediente-tareas", id],
    queryFn: () => fetchTareas({ data: { expediente_id: id } }),
  });
  const bitacoraQuery = useQuery({
    queryKey: ["expediente-bitacora", id],
    queryFn: () => fetchBitacora({ data: { expediente_id: id, limit: 100 } }),
  });

  const tareas = (tareasQuery.data?.tareas ?? []) as TareaRow[];
  const bitacora = (bitacoraQuery.data?.entradas ?? []) as BitacoraRow[];

  const invalidarTareas = () => qc.invalidateQueries({ queryKey: ["expediente-tareas", id] });
  const invalidarBitacora = () => qc.invalidateQueries({ queryKey: ["expediente-bitacora", id] });

  const crearTareaM = useMutation({
    mutationFn: (input: {
      titulo: string;
      descripcion?: string | null;
      prioridad: TareaPrioridad;
      fecha_objetivo?: string | null;
      responsable_id?: string | null;
    }) => crearTareaFn({ data: { expediente_id: id, ...input } }),
    onSuccess: () => {
      invalidarTareas();
      setShowTareaForm(false);
    },
  });
  const actualizarEstadoM = useMutation({
    mutationFn: (input: { id: string; estado: TareaEstado }) =>
      actualizarEstadoFn({ data: input }),
    onSuccess: invalidarTareas,
  });
  const asignarM = useMutation({
    mutationFn: (input: { id: string; responsable_id: string | null }) =>
      asignarFn({ data: input }),
    onSuccess: invalidarTareas,
  });
  const agregarBitacoraM = useMutation({
    mutationFn: (input: { comentario: string; tipo: BitacoraTipo }) =>
      agregarBitacoraFn({ data: { expediente_id: id, ...input } }),
    onSuccess: invalidarBitacora,
  });

  const etapa = useMemo(() => {
    if (!exp) return null;
    const eid = computeEtapaActual({
      estado_caso: (exp as unknown as { estado_caso?: string | null }).estado_caso ?? null,
    } as Parameters<typeof computeEtapaActual>[0]);
    return ETAPAS_PIPELINE.find((e) => e.id === eid) ?? null;
  }, [exp]);

  const credito = (exp?.credito_data ?? {}) as Record<string, string>;
  const valorDesembolsado = parseMoney(credito.valorDesembolsado);
  const saldoActual = parseMoney(credito.saldoCapital);
  const producto = exp?.producto || credito.tipoProducto || "—";

  const diasEnEtapa = diasDesde(exp?.updated_at);
  const diasTotales = diasDesde(exp?.created_at);
  const sla = etapa ? SLA_DIAS[etapa.id] ?? 7 : 0;
  const exceso = Math.max(0, diasEnEtapa - sla);
  const enRiesgo = exceso > 0;
  const honorarios = Number(exp?.honorarios_final) || Number(exp?.honorarios_base) || 0;
  const aprobado = exp?.aprobado_data ?? null;
  const responsableActual = etapa?.responsables.join(" · ") ?? "Sin asignar";
  const totalEtapas = 14;
  const avancePct = etapa ? Math.min(100, Math.round((etapa.numero / totalEtapas) * 100)) : 0;

  // ===== Diagnóstico estructurado =====
  const hallazgos: Hallazgo[] = useMemo(() => {
    if (!exp) return [];
    const out: Hallazgo[] = [];
    const baseDate = new Date();

    if (enRiesgo) {
      const sev: Severidad = exceso > sla ? "critico" : "alerta";
      out.push({
        severidad: sev,
        titulo: `Caso fuera de SLA (+${exceso}d)`,
        bloqueador: `La etapa ${etapa?.titulo ?? "actual"} excede el umbral de ${sla} días.`,
        responsable: responsableActual,
        fechaLimite: fmtDate(addDays(baseDate, 1).toISOString()),
        accion: "Forzar avance de etapa o registrar bloqueo formal.",
      });
    }
    if (!exp.cedula) {
      out.push({
        severidad: "critico",
        titulo: "Cédula faltante",
        bloqueador: "Sin identificación no se puede validar al cliente ni radicar.",
        responsable: "Asesor Comercial",
        fechaLimite: fmtDate(addDays(baseDate, 1).toISOString()),
        accion: "Solicitar cédula al cliente y cargarla al expediente.",
      });
    }
    if (!exp.banco) {
      out.push({
        severidad: "alerta",
        titulo: "Banco no asignado",
        bloqueador: "Bloquea radicación y motor de honorarios.",
        responsable: "Asesor Comercial",
        fechaLimite: fmtDate(addDays(baseDate, 2).toISOString()),
        accion: "Asignar banco origen del crédito.",
      });
    }
    if (!exp.numero_credito) {
      out.push({
        severidad: "info",
        titulo: "Número de crédito pendiente",
        bloqueador: "Recomendado para trazabilidad y radicación.",
        responsable: "Asesor Comercial",
        fechaLimite: fmtDate(addDays(baseDate, 3).toISOString()),
        accion: "Capturar número de crédito desde el extracto.",
      });
    }
    if (saldoActual === 0) {
      out.push({
        severidad: "alerta",
        titulo: "Saldo de capital no capturado",
        bloqueador: "Sin saldo no se puede generar proyección financiera.",
        responsable: "Asesor Comercial",
        fechaLimite: fmtDate(addDays(baseDate, 2).toISOString()),
        accion: "Leer extracto y registrar saldo actual.",
      });
    }
    if (aprobado) {
      out.push({
        severidad: "info",
        titulo: "Aprobación bancaria registrada",
        bloqueador: "—",
        responsable: "Cartera",
        fechaLimite: fmtDate(addDays(baseDate, 5).toISOString()),
        accion: `Confirmar aceptación del cliente (radicado ${aprobado.radicado || "—"}).`,
      });
    }
    if (out.length === 0) {
      out.push({
        severidad: "info",
        titulo: "Expediente sano",
        bloqueador: "Sin hallazgos relevantes.",
        responsable: responsableActual,
        fechaLimite: "—",
        accion: "Continuar con el plan de tratamiento.",
      });
    }
    return out;
  }, [exp, enRiesgo, exceso, etapa, sla, aprobado, saldoActual, responsableActual]);

  const conteoSeveridad = useMemo(() => ({
    critico: hallazgos.filter((h) => h.severidad === "critico").length,
    alerta: hallazgos.filter((h) => h.severidad === "alerta").length,
    info: hallazgos.filter((h) => h.severidad === "info").length,
  }), [hallazgos]);

  // ===== Plan de tratamiento (cola operativa) =====
  const plan: PlanItem[] = useMemo(() => {
    if (!etapa) return [];
    const responsable = etapa.responsables.join(", ");
    const baseDate = new Date();
    const map: Partial<Record<EtapaPipelineId, { accion: string; prioridad: Prioridad; en: number }[]>> = {
      lead:           [{ accion: "Confirmar contacto y necesidad", prioridad: "alta", en: 1 }, { accion: "Solicitar extracto bancario", prioridad: "alta", en: 2 }],
      extracto:       [{ accion: "Cargar y leer extracto", prioridad: "alta", en: 1 }, { accion: "Validar saldo y cuota actual", prioridad: "media", en: 2 }],
      proyeccion:     [{ accion: "Generar proyección financiera", prioridad: "alta", en: 1 }, { accion: "Enviar a QA financiero", prioridad: "media", en: 2 }],
      presentacion:   [{ accion: "Agendar presentación con cliente", prioridad: "alta", en: 1 }, { accion: "Compartir propuesta", prioridad: "media", en: 2 }],
      cierre:         [{ accion: "Confirmar aceptación", prioridad: "alta", en: 1 }, { accion: "Recolectar documentos para contratación", prioridad: "alta", en: 3 }],
      contratacion:   [{ accion: "Generar contrato y poder", prioridad: "alta", en: 1 }, { accion: "Firmar y subir soportes", prioridad: "alta", en: 3 }],
      radicacion:     [{ accion: "Preparar paquete", prioridad: "alta", en: 1 }, { accion: "Radicar ante el banco", prioridad: "alta", en: 2 }],
      banco:          [{ accion: "Seguimiento al banco", prioridad: "media", en: 2 }, { accion: "Registrar requerimientos", prioridad: "media", en: 5 }],
      resultado_banco:[{ accion: "Registrar respuesta del banco", prioridad: "alta", en: 1 }, { accion: "Reajustar honorarios", prioridad: "media", en: 2 }],
      aceptacion_cliente:[{ accion: "Notificar resultado al cliente", prioridad: "alta", en: 1 }, { accion: "Obtener aceptación expresa", prioridad: "alta", en: 2 }],
      informe:        [{ accion: "Generar informe final", prioridad: "media", en: 2 }, { accion: "Enviar al cliente", prioridad: "media", en: 3 }],
      cuenta:         [{ accion: "Emitir cuenta de cobro", prioridad: "alta", en: 1 }, { accion: "Enviar al cliente", prioridad: "media", en: 2 }],
      pago:           [{ accion: "Verificar transferencia", prioridad: "alta", en: 2 }, { accion: "Conciliar y registrar", prioridad: "media", en: 3 }],
      paz_salvo:      [{ accion: "Emitir paz y salvo", prioridad: "media", en: 2 }, { accion: "Cerrar operativamente", prioridad: "media", en: 3 }],
    };
    return (map[etapa.id] ?? []).map((p, i) => ({
      accion: p.accion,
      responsable,
      prioridad: p.prioridad,
      fechaObjetivo: fmtDate(addDays(baseDate, p.en).toISOString()),
      estado: i === 0 ? "en_curso" : "pendiente",
    }));
  }, [etapa]);

  // ===== Evolución / Timeline =====
  const timeline = useMemo(() => {
    const activeNum = etapa?.numero ?? 0;
    return ETAPAS_PIPELINE.filter((e) => e.id !== "finalizado" && e.id !== "comision").map((e) => {
      const status: "done" | "current" | "pending" =
        e.numero < activeNum ? "done" : e.numero === activeNum ? "current" : "pending";
      // Match historical entry by estado_caso_nuevo containing the etapa id (best-effort)
      const evento = hist.find((h) => (h.estado_caso_nuevo ?? "").toLowerCase().includes(e.id));
      return { ...e, status, evento };
    });
  }, [etapa, hist]);

  // ===== Documentos (placeholder visual) =====
  const documentos = useMemo(() => {
    if (!exp) return [];
    const cargado = (n: string, ok: boolean) => ({
      nombre: n,
      estado: ok ? "Cargado" : "Pendiente",
      ok,
      fechaCarga: ok ? fmtDate(exp.created_at) : "—",
      responsable: "Asesor Comercial",
      ultima: ok ? fmtDate(exp.updated_at) : "—",
    });
    return [
      cargado("Cédula del cliente", !!exp.cedula),
      cargado("Extracto bancario", !!credito.saldoCapital),
      cargado("Proyección financiera", !!exp.propuesta_data && Object.keys(exp.propuesta_data).length > 0),
      cargado("Contrato firmado", exp.estado === "FIRMADO" || exp.estado === "RADICADO" || exp.estado === "APROBADO"),
      cargado("Carta de aprobación", !!aprobado),
      cargado("Cuenta de cobro", exp.estado === "FACTURADO" || exp.estado === "PAGADO"),
    ];
  }, [exp, credito.saldoCapital, aprobado]);

  // ===== Pronóstico NUVIA IA (reglas) =====
  const forecast = useMemo(() => {
    if (!exp) return null;
    let probAprob = 50;
    if (exp.banco) probAprob += 10;
    if (exp.cedula) probAprob += 8;
    if (saldoActual > 0) probAprob += 7;
    if (exp.numero_credito) probAprob += 5;
    if (aprobado) probAprob = 96;
    if (enRiesgo) probAprob -= Math.min(20, exceso * 2);
    probAprob = Math.max(5, Math.min(98, probAprob));

    const docsCargados = documentos.filter((d) => d.ok).length;
    const riesgoDoc = Math.max(0, Math.round(100 - (docsCargados / documentos.length) * 100));
    const riesgoRetraso = Math.min(100, enRiesgo ? 40 + exceso * 4 : Math.round((diasEnEtapa / Math.max(1, sla)) * 30));

    const proxima = plan[0]?.accion ?? "Revisar próximo paso del expediente.";
    return { probAprob, riesgoDoc, riesgoRetraso, proxima };
  }, [exp, saldoActual, aprobado, enRiesgo, exceso, documentos, diasEnEtapa, sla, plan]);

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
      {/* ===== HERO CLÍNICO ===== */}
      <ExecutiveHero
        badge={{ icon: <Stethoscope size={11} />, label: "Historia Clínica Financiera · v2", tone: "blue" }}
        title={exp.cliente_nombre}
        description={
          <div className="flex flex-col gap-1 text-[12px]">
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              <Chip icon={<User size={11} />} label={exp.cedula ?? "Sin cédula"} />
              <Chip icon={<Banknote size={11} />} label={exp.banco ?? "Sin banco"} />
              <Chip icon={<FileText size={11} />} label={producto} />
              <Chip icon={<CalendarClock size={11} />} label={`Ingreso ${fmtDate(exp.created_at)}`} />
            </span>
            <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1 text-[var(--nuvia-text-secondary)]">
              <Stat label="Desembolso" value={valorDesembolsado ? fmtCOP(valorDesembolsado) : "—"} />
              <Stat label="Saldo" value={saldoActual ? fmtCOP(saldoActual) : "—"} />
              <Stat label="Honorarios" value={fmtCOP(honorarios)} tone="primary" />
              <Stat label="Estado" value={exp.estado.replace(/_/g, " ")} />
              <Stat label="Responsable" value={responsableActual} icon={<Users size={11} />} />
            </span>
          </div>
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

      {/* ===== SIGNOS VITALES (6 KPI) ===== */}
      <KpiGrid cols={3}>
        <KpiCard
          label="Días totales"
          value={`${diasTotales}d`}
          tone="neutral"
          icon={<CalendarClock size={14} />}
          hint={`Ingreso ${fmtDate(exp.created_at)}`}
        />
        <KpiCard
          label="Días en etapa"
          value={`${diasEnEtapa}d`}
          tone={enRiesgo ? "danger" : diasEnEtapa > sla * 0.7 ? "warning" : "green"}
          icon={<Clock size={14} />}
          hint={enRiesgo ? `+${exceso}d exceso` : "dentro de SLA"}
        />
        <KpiCard
          label="SLA objetivo"
          value={`${sla}d`}
          tone="blue"
          icon={<Target size={14} />}
          hint={etapa?.titulo ?? "—"}
        />
        <KpiCard
          label="% avance"
          value={`${avancePct}%`}
          tone="blue"
          icon={<TrendingUp size={14} />}
          hint={`E${etapa?.numero ?? 0}/${totalEtapas}`}
        />
        <KpiCard
          label="Riesgo expediente"
          value={enRiesgo ? "Alto" : conteoSeveridad.alerta > 0 ? "Medio" : "Bajo"}
          tone={enRiesgo ? "danger" : conteoSeveridad.alerta > 0 ? "warning" : "green"}
          icon={<ShieldAlert size={14} />}
          hint={`${conteoSeveridad.critico} críticos · ${conteoSeveridad.alerta} alertas`}
        />
        <KpiCard
          label="Honorarios"
          value={fmtCOP(honorarios)}
          tone="neutral"
          icon={<Banknote size={14} />}
          hint={exp.descuento ? `Desc ${exp.descuento}%` : "Sin descuento"}
        />
      </KpiGrid>

      <PageLayout.BodyWithAside>
        <PageLayout.Main>
          {/* ===== DIAGNÓSTICO ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Diagnóstico"
              description="Hallazgos clasificados por severidad clínica."
              icon={<Activity size={14} />}
              action={
                <div className="flex items-center gap-1.5 text-[10px]">
                  <Pill tone="critico" count={conteoSeveridad.critico} label="Crítico" />
                  <Pill tone="alerta" count={conteoSeveridad.alerta} label="Alerta" />
                  <Pill tone="info" count={conteoSeveridad.info} label="Info" />
                </div>
              }
            />
            <div className="mt-3 space-y-2">
              {hallazgos.map((h, i) => (
                <HallazgoCard key={i} h={h} />
              ))}
            </div>
          </NCard>

          {/* ===== PLAN DE TRATAMIENTO (real) ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Plan de tratamiento"
              description="Tareas clínicas reales del expediente."
              icon={<ClipboardList size={14} />}
              action={
                <button
                  type="button"
                  onClick={() => setShowTareaForm((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[10px] hover:bg-sky-500/20"
                >
                  {showTareaForm ? <X size={11} /> : <Plus size={11} />}
                  {showTareaForm ? "Cancelar" : "Nueva tarea"}
                </button>
              }
            />
            {showTareaForm && (
              <NuevaTareaForm
                profiles={profileList}
                onCancel={() => setShowTareaForm(false)}
                onSubmit={(v) => crearTareaM.mutate(v)}
                submitting={crearTareaM.isPending}
                error={crearTareaM.error ? (crearTareaM.error as Error).message : null}
              />
            )}
            {tareasQuery.isLoading ? (
              <div className="mt-3 text-[11px] text-[var(--nuvia-text-secondary)] inline-flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Cargando tareas…
              </div>
            ) : tareas.length === 0 ? (
              <EmptyState compact tone="neutral" title="Sin tareas registradas" description='Usa "Nueva tarea" para crear el primer procedimiento clínico.' />
            ) : (
              <div className="mt-3 space-y-2">
                {tareas.map((t) => (
                  <TareaCard
                    key={t.id}
                    t={t}
                    responsableNombre={t.responsable_id ? profilesById[t.responsable_id]?.nombre ?? null : null}
                    profiles={profileList}
                    onChangeEstado={(estado) => actualizarEstadoM.mutate({ id: t.id, estado })}
                    onAsignar={(responsable_id) => asignarM.mutate({ id: t.id, responsable_id })}
                    busy={actualizarEstadoM.isPending || asignarM.isPending}
                  />
                ))}
              </div>
            )}
            <p className="mt-2 text-[10px] text-[var(--nuvia-text-secondary)] italic">
              Tareas persistidas en <code>expediente_tareas</code> con RLS por expediente.
            </p>
          </NCard>


          {/* ===== EVOLUCIÓN / TIMELINE ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Evolución del caso"
              description="Ciclo NUVEX. Cada hito incluye fecha, usuario y comentario clínico."
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
                        <div className="min-w-0 flex-1">
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
                          {e.evento && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--nuvia-text-secondary)]">
                              <span className="inline-flex items-center gap-1"><CalendarClock size={10} /> {fmtDateTime(e.evento.created_at)}</span>
                              <span className="inline-flex items-center gap-1"><User size={10} /> Sistema</span>
                              {e.evento.observacion && <span className="italic">"{e.evento.observacion}"</span>}
                            </div>
                          )}
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

          {/* ===== DOCUMENTOS ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Documentos"
              description="Expediente documental del cliente."
              icon={<Folder size={14} />}
              action={
                <span className="text-[10px] text-[var(--nuvia-text-secondary)]">
                  {documentos.filter((d) => d.ok).length}/{documentos.length} cargados
                </span>
              }
            />
            <div className="mt-3 overflow-hidden rounded-md border border-[var(--nuvia-border)]">
              <table className="w-full text-[11px]">
                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Documento</th>
                    <th className="text-left px-3 py-2 font-medium">Estado</th>
                    <th className="text-left px-3 py-2 font-medium">Fecha carga</th>
                    <th className="text-left px-3 py-2 font-medium">Responsable</th>
                    <th className="text-left px-3 py-2 font-medium">Última modificación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--nuvia-border)]">
                  {documentos.map((d, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-[var(--nuvia-text-primary)] inline-flex items-center gap-2">
                        <FileText size={12} className="text-[var(--nuvia-text-secondary)]" /> {d.nombre}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border ${
                          d.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}>
                          <span className={`size-1 rounded-full ${d.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {d.estado}
                        </span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-[var(--nuvia-text-secondary)]">{d.fechaCarga}</td>
                      <td className="px-3 py-2 text-[var(--nuvia-text-secondary)]">{d.responsable}</td>
                      <td className="px-3 py-2 tabular-nums text-[var(--nuvia-text-secondary)]">{d.ultima}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-[var(--nuvia-text-secondary)] italic">
              Vista preliminar · La gestión real de archivos se habilita en Fase 7.6.1D.
            </p>
          </NCard>

          {/* ===== COMUNICACIONES ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Comunicaciones"
              description="Historial centralizado de interacción con el cliente."
              icon={<MessageSquare size={14} />}
            />
            <div className="mt-3 flex items-center gap-1 border-b border-[var(--nuvia-border)]">
              {[
                { id: "whatsapp" as const, label: "WhatsApp", icon: <MessageSquare size={12} /> },
                { id: "email" as const, label: "Correo", icon: <Mail size={12} /> },
                { id: "llamada" as const, label: "Llamadas", icon: <Phone size={12} /> },
                { id: "nota" as const, label: "Notas internas", icon: <Paperclip size={12} /> },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setCommTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-b-2 transition ${
                    commTab === t.id
                      ? "border-sky-400 text-[var(--nuvia-text-primary)]"
                      : "border-transparent text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-text-primary)]"
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <EmptyState
                compact
                tone="neutral"
                icon={<MessageSquare size={18} />}
                title={`Sin ${commTab === "nota" ? "notas" : commTab === "llamada" ? "llamadas" : commTab === "email" ? "correos" : "mensajes"} registrados`}
                description="La integración con proveedores externos se activa en una fase posterior. Aquí vivirá el historial centralizado."
              />
            </div>
          </NCard>

          {/* ===== BITÁCORA CLÍNICA (real) ===== */}
          <NCard variant="default">
            <SectionHeader
              title="Bitácora clínica"
              description="Notas, evidencias, auditoría, seguimiento y alertas del expediente."
              icon={<FileText size={14} />}
            />
            <BitacoraComposer
              onSubmit={(v) => agregarBitacoraM.mutate(v)}
              submitting={agregarBitacoraM.isPending}
              error={agregarBitacoraM.error ? (agregarBitacoraM.error as Error).message : null}
            />
            {bitacoraQuery.isLoading ? (
              <div className="mt-3 text-[11px] text-[var(--nuvia-text-secondary)] inline-flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" /> Cargando bitácora…
              </div>
            ) : bitacora.length === 0 ? (
              <div className="mt-3">
                <EmptyState compact tone="neutral" title="Bitácora vacía" description="Aún no hay notas clínicas registradas en este expediente." />
              </div>
            ) : (
              <div className="mt-3 space-y-1.5">
                {bitacora.map((b) => (
                  <BitacoraEntry
                    key={b.id}
                    b={b}
                    autorNombre={profilesById[b.usuario_id]?.nombre ?? profilesById[b.usuario_id]?.email ?? null}
                  />
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-[var(--nuvia-border)] pt-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] mb-2">Movimientos automáticos (estado_caso)</div>
              {hist.length === 0 ? (
                <EmptyState compact tone="neutral" title="Sin movimientos" description="Aún no hay cambios registrados." />
              ) : (
                <div className="space-y-1.5">
                  {hist.slice(0, 10).map((h) => (
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
                        {fmtDateTime(h.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </NCard>

        </PageLayout.Main>

        <PageLayout.Aside>
          {/* ===== PRONÓSTICO NUVIA IA ===== */}
          <NCard variant="default" className="border-sky-500/30 bg-gradient-to-b from-sky-500/[0.05] to-transparent">
            <SectionHeader
              title="NUVIA IA Clinical Forecast"
              description="Pronóstico clínico basado en reglas."
              icon={<Brain size={14} />}
            />
            {forecast ? (
              <div className="mt-3 space-y-3">
                <ForecastBar label="Probabilidad de aprobación" value={forecast.probAprob} tone="positive" />
                <ForecastBar label="Riesgo documental" value={forecast.riesgoDoc} tone="negative" />
                <ForecastBar label="Riesgo de retraso" value={forecast.riesgoRetraso} tone="negative" />
                <div className="pt-2 border-t border-[var(--nuvia-border)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] mb-1 inline-flex items-center gap-1">
                    <Sparkles size={10} /> Próxima acción recomendada
                  </div>
                  <div className="text-[12px] text-[var(--nuvia-text-primary)] leading-snug">{forecast.proxima}</div>
                </div>
              </div>
            ) : (
              <EmptyState compact tone="neutral" icon={<Gauge size={18} />} title="Sin pronóstico" description="Datos insuficientes." />
            )}
          </NCard>

          {/* Anamnesis */}
          <NCard variant="default">
            <SectionHeader title="Anamnesis" description="Datos clínicos del caso." />
            <dl className="mt-3 space-y-2 text-[11px]">
              {[
                ["Modo", exp.modo?.toUpperCase()],
                ["Producto", producto],
                ["Estado", exp.estado.replace(/_/g, " ")],
                ["Desembolso", valorDesembolsado ? fmtCOP(valorDesembolsado) : "—"],
                ["Saldo actual", saldoActual ? fmtCOP(saldoActual) : "—"],
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

          {/* Aprobación bancaria */}
          <NCard variant="default">
            <SectionHeader title="Resultado bancario" description="Aprobación registrada." icon={<Target size={14} />} />
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
              <EmptyState compact tone="neutral" icon={<Gauge size={18} />} title="Sin aprobación todavía" description="Aparecerá cuando el banco responda la radicación." />
            )}
          </NCard>

          {/* Alertas resumen */}
          <NCard variant="default" className={conteoSeveridad.critico > 0 ? "border-rose-500/40" : enRiesgo ? "border-amber-500/30" : ""}>
            <SectionHeader title="Alertas activas" icon={<AlertTriangle size={14} />} />
            <div className="mt-3 space-y-1.5">
              {hallazgos.filter((h) => h.severidad !== "info").length === 0 ? (
                <div className="text-[11px] text-[var(--nuvia-text-secondary)]">Sin alertas activas.</div>
              ) : (
                hallazgos
                  .filter((h) => h.severidad !== "info")
                  .map((h, i) => (
                    <div key={i} className={`text-[11px] ${h.severidad === "critico" ? "text-rose-300" : "text-amber-300"}`}>
                      • {h.titulo}
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

// ===== Subcomponents =====
function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <span className="inline-flex items-center gap-1 text-[var(--nuvia-text-secondary)]">{icon}<span className="text-[var(--nuvia-text-primary)]">{label}</span></span>;
}

function Stat({ label, value, tone, icon }: { label: string; value: React.ReactNode; tone?: "primary"; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      {icon && <span className="text-[var(--nuvia-text-secondary)]">{icon}</span>}
      <span className="text-[10px] uppercase tracking-wider">{label}</span>
      <span className={`tabular-nums text-[12px] ${tone === "primary" ? "text-sky-300 font-semibold" : "text-[var(--nuvia-text-primary)]"}`}>{value}</span>
    </span>
  );
}

function Pill({ tone, count, label }: { tone: Severidad; count: number; label: string }) {
  const cls =
    tone === "critico" ? "border-rose-500/40 bg-rose-500/15 text-rose-300"
    : tone === "alerta" ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
    : "border-sky-500/40 bg-sky-500/15 text-sky-300";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${cls}`}>
      <span className="tabular-nums font-semibold">{count}</span> {label}
    </span>
  );
}

function HallazgoCard({ h }: { h: Hallazgo }) {
  const cfg = h.severidad === "critico"
    ? { icon: <Flame size={12} />, border: "border-rose-500/30", bg: "bg-rose-500/[0.06]", text: "text-rose-300", label: "CRÍTICO" }
    : h.severidad === "alerta"
      ? { icon: <AlertTriangle size={12} />, border: "border-amber-500/30", bg: "bg-amber-500/[0.06]", text: "text-amber-300", label: "ALERTA" }
      : { icon: <Info size={12} />, border: "border-sky-500/30", bg: "bg-sky-500/[0.06]", text: "text-sky-300", label: "INFO" };
  return (
    <div className={`rounded-md border ${cfg.border} ${cfg.bg} px-3 py-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-1 text-[9px] font-semibold tracking-wider ${cfg.text} mb-0.5`}>
            {cfg.icon} {cfg.label}
          </div>
          <div className="text-[12px] font-semibold text-[var(--nuvia-text-primary)]">{h.titulo}</div>
        </div>
        <div className="text-[10px] text-[var(--nuvia-text-secondary)] shrink-0 tabular-nums">
          ⏱ {h.fechaLimite}
        </div>
      </div>
      <div className="mt-1.5 grid grid-cols-1 md:grid-cols-3 gap-1.5 text-[10px]">
        <Field label="Bloqueador" value={h.bloqueador} />
        <Field label="Responsable" value={h.responsable} />
        <Field label="Acción sugerida" value={h.accion} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">{label}</div>
      <div className="text-[11px] text-[var(--nuvia-text-primary)] leading-snug">{value}</div>
    </div>
  );
}

function PriorityPill({ p }: { p: Prioridad }) {
  const cls = p === "alta" ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
    : p === "media" ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
    : "border-slate-500/30 bg-slate-500/10 text-slate-300";
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] capitalize ${cls}`}>{p}</span>;
}

function EstadoPill({ e }: { e: PlanItem["estado"] }) {
  const map = {
    pendiente: { cls: "border-slate-500/30 bg-slate-500/10 text-slate-300", label: "Pendiente" },
    en_curso: { cls: "border-sky-500/30 bg-sky-500/10 text-sky-300", label: "En curso" },
    bloqueada: { cls: "border-rose-500/30 bg-rose-500/10 text-rose-300", label: "Bloqueada" },
  } as const;
  const c = map[e];
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] ${c.cls}`}>{c.label}</span>;
}

function ForecastBar({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" }) {
  const color = tone === "positive"
    ? value >= 70 ? "bg-emerald-400" : value >= 40 ? "bg-amber-400" : "bg-rose-400"
    : value >= 70 ? "bg-rose-400" : value >= 40 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-[var(--nuvia-text-primary)]">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
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

// ===== D-2 · Tareas + Bitácora subcomponents =====

const PRIORIDAD_OPTIONS: { value: TareaPrioridad; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

const ESTADO_OPTIONS: { value: TareaEstado; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En progreso" },
  { value: "completada", label: "Completada" },
  { value: "cancelada", label: "Cancelada" },
];

const BITACORA_TIPOS: { value: BitacoraTipo; label: string; cls: string }[] = [
  { value: "comentario", label: "Comentario", cls: "border-slate-500/30 bg-slate-500/10 text-slate-300" },
  { value: "evidencia", label: "Evidencia", cls: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  { value: "auditoria", label: "Auditoría", cls: "border-violet-500/30 bg-violet-500/10 text-violet-300" },
  { value: "seguimiento", label: "Seguimiento", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  { value: "alerta", label: "Alerta", cls: "border-rose-500/30 bg-rose-500/10 text-rose-300" },
];

function prioridadCls(p: TareaPrioridad): string {
  switch (p) {
    case "critica": return "border-rose-500/40 bg-rose-500/15 text-rose-300";
    case "alta": return "border-amber-500/40 bg-amber-500/15 text-amber-300";
    case "media": return "border-sky-500/40 bg-sky-500/15 text-sky-300";
    default: return "border-slate-500/40 bg-slate-500/15 text-slate-300";
  }
}

function estadoCls(e: TareaEstado): string {
  switch (e) {
    case "completada": return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "en_progreso": return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "cancelada": return "border-slate-500/30 bg-slate-500/10 text-slate-400";
    default: return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

function NuevaTareaForm({
  profiles,
  onCancel,
  onSubmit,
  submitting,
  error,
}: {
  profiles: ProfileLite[];
  onCancel: () => void;
  onSubmit: (v: {
    titulo: string;
    descripcion?: string | null;
    prioridad: TareaPrioridad;
    fecha_objetivo?: string | null;
    responsable_id?: string | null;
  }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState<TareaPrioridad>("media");
  const [fecha, setFecha] = useState("");
  const [responsable, setResponsable] = useState<string>("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!titulo.trim()) return;
        onSubmit({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          prioridad,
          fecha_objetivo: fecha || null,
          responsable_id: responsable || null,
        });
      }}
      className="mt-3 p-3 rounded-md border border-sky-500/20 bg-sky-500/[0.04] space-y-2"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] md:col-span-2">
          Título *
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={200}
            required
            className="mt-1 w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] normal-case tracking-normal"
            placeholder="Ej. Solicitar extracto bancario al cliente"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] md:col-span-2">
          Descripción
          <textarea
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            maxLength={2000}
            rows={2}
            className="mt-1 w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] normal-case tracking-normal resize-none"
            placeholder="Contexto clínico, criterios de éxito…"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
          Prioridad
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value as TareaPrioridad)}
            className="mt-1 w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] normal-case tracking-normal"
          >
            {PRIORIDAD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
          Fecha objetivo
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] normal-case tracking-normal"
          />
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] md:col-span-2">
          Responsable
          <select
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] normal-case tracking-normal"
          >
            <option value="">Sin asignar</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre ?? p.email ?? p.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
      </div>
      {error && <div className="text-[11px] text-rose-300">{error}</div>}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1 rounded-md border border-[var(--nuvia-border)] text-[11px] text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-text-primary)]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting || !titulo.trim()}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-sky-500/40 bg-sky-500/20 text-sky-200 text-[11px] hover:bg-sky-500/30 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
          Crear tarea
        </button>
      </div>
    </form>
  );
}

function TareaCard({
  t,
  responsableNombre,
  profiles,
  onChangeEstado,
  onAsignar,
  busy,
}: {
  t: TareaRow;
  responsableNombre: string | null;
  profiles: ProfileLite[];
  onChangeEstado: (e: TareaEstado) => void;
  onAsignar: (id: string | null) => void;
  busy: boolean;
}) {
  const vencida = t.fecha_objetivo && t.estado !== "completada" && t.estado !== "cancelada"
    ? new Date(t.fecha_objetivo).getTime() < Date.now() - 86400000
    : false;
  return (
    <div className={`rounded-md border px-3 py-2 ${vencida ? "border-rose-500/30 bg-rose-500/[0.04]" : "border-[var(--nuvia-border)] bg-white/[0.02]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] capitalize ${prioridadCls(t.prioridad)}`}>
              {t.prioridad}
            </span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] ${estadoCls(t.estado)}`}>
              {t.estado.replace("_", " ")}
            </span>
            {vencida && (
              <span className="inline-flex items-center gap-1 text-[10px] text-rose-300">
                <AlertTriangle size={10} /> Vencida
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] font-semibold text-[var(--nuvia-text-primary)]">{t.titulo}</div>
          {t.descripcion && (
            <div className="text-[11px] text-[var(--nuvia-text-secondary)] mt-0.5 leading-snug">{t.descripcion}</div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-[var(--nuvia-text-secondary)]">
            <span className="inline-flex items-center gap-1"><CalendarClock size={10} /> {t.fecha_objetivo ? fmtDate(t.fecha_objetivo) : "Sin fecha"}</span>
            <span className="inline-flex items-center gap-1"><User size={10} /> {responsableNombre ?? "Sin asignar"}</span>
            <span className="tabular-nums">Creada {fmtDateTime(t.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--nuvia-border)]">
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] inline-flex items-center gap-1">
          Estado
          <select
            disabled={busy}
            value={t.estado}
            onChange={(e) => onChangeEstado(e.target.value as TareaEstado)}
            className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-[var(--nuvia-border)] text-[11px] text-[var(--nuvia-text-primary)] normal-case tracking-normal"
          >
            {ESTADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)] inline-flex items-center gap-1">
          Responsable
          <select
            disabled={busy}
            value={t.responsable_id ?? ""}
            onChange={(e) => onAsignar(e.target.value || null)}
            className="px-1.5 py-0.5 rounded-md bg-white/[0.04] border border-[var(--nuvia-border)] text-[11px] text-[var(--nuvia-text-primary)] normal-case tracking-normal max-w-[200px]"
          >
            <option value="">Sin asignar</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre ?? p.email ?? p.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        {t.estado !== "completada" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeEstado("completada")}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <CheckCircle2 size={11} /> Marcar completada
          </button>
        )}
      </div>
    </div>
  );
}

function BitacoraComposer({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (v: { comentario: string; tipo: BitacoraTipo }) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [comentario, setComentario] = useState("");
  const [tipo, setTipo] = useState<BitacoraTipo>("comentario");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const c = comentario.trim();
        if (!c) return;
        onSubmit({ comentario: c, tipo });
        setComentario("");
      }}
      className="mt-3 p-3 rounded-md border border-[var(--nuvia-border)] bg-white/[0.02] space-y-2"
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">Agregar nota clínica</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {BITACORA_TIPOS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setTipo(o.value)}
            className={`px-2 py-0.5 rounded-full border text-[10px] capitalize transition ${
              tipo === o.value ? o.cls : "border-[var(--nuvia-border)] text-[var(--nuvia-text-secondary)] hover:text-[var(--nuvia-text-primary)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={4000}
        rows={2}
        placeholder="Escribe una observación, evidencia, auditoría, seguimiento o alerta…"
        className="w-full px-2 py-1.5 rounded-md bg-white/[0.03] border border-[var(--nuvia-border)] text-[12px] text-[var(--nuvia-text-primary)] resize-none"
      />
      {error && <div className="text-[11px] text-rose-300">{error}</div>}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-[var(--nuvia-text-secondary)] tabular-nums">{comentario.length}/4000</span>
        <button
          type="submit"
          disabled={submitting || !comentario.trim()}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-sky-500/40 bg-sky-500/20 text-sky-200 text-[11px] hover:bg-sky-500/30 disabled:opacity-50"
        >
          {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
          Registrar
        </button>
      </div>
    </form>
  );
}

function BitacoraEntry({ b, autorNombre }: { b: BitacoraRow; autorNombre: string | null }) {
  const cfg = BITACORA_TIPOS.find((t) => t.value === b.tipo) ?? BITACORA_TIPOS[0];
  return (
    <div className="px-3 py-2 rounded-md border border-[var(--nuvia-border)] bg-white/[0.02]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] capitalize ${cfg.cls}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-[var(--nuvia-text-secondary)] inline-flex items-center gap-1">
              <User size={10} /> {autorNombre ?? "Usuario"}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-[var(--nuvia-text-primary)] leading-snug whitespace-pre-wrap">{b.comentario}</div>
        </div>
        <span className="text-[10px] text-[var(--nuvia-text-secondary)] shrink-0 tabular-nums">{fmtDateTime(b.created_at)}</span>
      </div>
    </div>
  );
}
