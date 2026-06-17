import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { PageLayout, NCard, SectionHeader } from "@/components/nuvia";
import { useServerFn } from "@tanstack/react-start";
import { obtenerAuditoriaQA, reejecutarAuditoriaQA } from "@/lib/qaAI.functions";
import { auditar, reconstruir, type AuditarInput } from "@/lib/qaMath";
import { exportarDictamenPDF } from "@/lib/qaPdf";
import { CopilotoQADrawer } from "@/components/qa-ai/CopilotoQADrawer";
import { VeredictoBlock } from "@/components/qa-ai/VeredictoBlock";
import { ProyeccionesDropzone } from "@/components/proyecciones/ProyeccionesDropzone";
import { VerificacionCierreBlock } from "@/components/proyecciones/VerificacionCierreBlock";
import { bancoGeneraProyeccionesCierre, motivoSinProyecciones } from "@/lib/bancosProyecciones";
import { MotivacionNuvia } from "@/components/qa-ai/MotivacionNuvia";
import { supabase } from "@/integrations/supabase/client";
import type { Veredicto } from "@/lib/qaMath";
import {
  Brain, ArrowLeft, AlertTriangle, CheckCircle2, Calculator, Sigma, ShieldAlert,
  Minus, FileDown, Sparkles, RefreshCw, Trophy, ChevronDown, MessageCircle, Coins, Gauge,
  Rocket,
} from "lucide-react";

const qaSearchSchema = z.object({
  from: z.enum(["simulador"]).optional(),
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
});

export const Route = createFileRoute("/_authenticated/qa-ai/$id")({
  component: ResultadoQaAi,
  validateSearch: qaSearchSchema,
  head: () => ({ meta: [{ title: "Certificación Financiera · NUVIA" }] }),
});

type Inc = {
  id: string; tipo: string; severidad: string; campo: string | null;
  valor_extracto: number | null; valor_calculado: number | null; diferencia: number | null;
  mensaje: string; sugerencia: string | null;
};

const penLabel: Record<string, string> = {
  inconsistencias_info: "Inconsistencias informativas",
  inconsistencias_warning: "Inconsistencias de advertencia",
  inconsistencias_critica: "Inconsistencias críticas",
  diff_cuota: "Diferencia en cuota",
  diff_simulacion: "Diferencia con simulación del analista",
  campos_faltantes: "Campos faltantes en captura",
};

const fmt = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });

function primerNombre(full?: string | null, email?: string | null): string {
  const base = (full ?? "").trim().split(/\s+/)[0];
  if (base) return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
  const local = (email ?? "").split("@")[0]?.split(/[.\-_]/)[0];
  if (local) return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
  return "Analista";
}

/* ---------- Mensajes NUVIA (rotación dinámica) ---------- */

const MSGS_APROBADO = [
  "validamos matemáticamente este crédito. La optimización financiera está lista para avanzar.",
  "la matemática financiera coincide con el extracto. Hoy ayudaste a una familia a estar más cerca de su patrimonio.",
  "cada crédito optimizado representa una oportunidad real para una familia. Este caso está certificado.",
];
const MSGS_OBS = [
  "encontramos una observación menor que vale la pena revisar antes de cerrar.",
  "la matemática financiera nos está dando una señal importante. Vale la pena confirmarla con el banco.",
  "detectar esto ahora evitará problemas más adelante. Estás haciendo bien tu trabajo.",
];
const MSGS_REVISION = [
  "este caso requiere una validación adicional antes de continuar.",
  "NUVIA encontró información que merece ser confirmada con el banco.",
  "detenernos ahora evitará una decisión equivocada más adelante.",
];
const MSGS_RECHAZO = [
  "este caso necesita una corrección importante antes de avanzar al cliente.",
  "la información actual no nos permite certificar el crédito todavía.",
  "demos un paso atrás para ajustar antes de presentar esta estrategia financiera.",
];

function pickMsg(arr: string[], seed: string): string {
  let h = 0;
  const k = `${seed}|${Math.floor(Date.now() / 60000)}`;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return arr[h % arr.length]!;
}

/* ---------- Estado de certificación ---------- */

type CertEstado = "certificado" | "certificado_obs" | "revision" | "no_certificado";

function certificacion(dictamen: string): { estado: CertEstado; label: string; color: string; emoji: string } {
  if (dictamen === "aprobado") return { estado: "certificado", label: "CERTIFICADO", color: "var(--nuvia-success)", emoji: "🟢" };
  if (dictamen === "aprobado_obs") return { estado: "certificado_obs", label: "CERTIFICADO CON OBSERVACIONES", color: "var(--nuvia-warning)", emoji: "🟡" };
  if (dictamen === "requiere_revision") return { estado: "revision", label: "REQUIERE REVISIÓN", color: "var(--nuvia-warning)", emoji: "🟡" };
  return { estado: "no_certificado", label: "NO CERTIFICADO", color: "var(--nuvia-danger)", emoji: "🔴" };
}

function logro(score: number): { titulo: string; icono: string; color: string } {
  if (score >= 95) return { titulo: "Auditor Financiero Elite", icono: "🏆", color: "var(--nuvia-success)" };
  if (score >= 90) return { titulo: "Crédito Certificado", icono: "🥇", color: "var(--nuvia-success)" };
  if (score >= 80) return { titulo: "Certificación Parcial", icono: "🥈", color: "var(--nuvia-warning)" };
  return { titulo: "Requiere Corrección", icono: "⚠", color: "var(--nuvia-danger)" };
}

/* ---------- Accordion ---------- */

function Accordion({ title, icon, count, children, defaultOpen = false }:
  { title: string; icon?: ReactNode; count?: number | string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <NCard padding="none">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left"
        style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--nuvia-text-primary)" }}
      >
        <span className="flex items-center gap-2.5 text-[13.5px] font-semibold">
          {icon}
          {title}
          {count !== undefined && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)" }}>
              {count}
            </span>
          )}
        </span>
        <ChevronDown size={16} style={{ color: "var(--nuvia-text-secondary)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </button>
      {open && <div style={{ borderTop: "1px solid var(--nuvia-border)" }}>{children}</div>}
    </NCard>
  );
}

/* ---------- Sticky header ---------- */

function StickyHeader({ cliente, banco, producto, fecha, score, scoreColor, certLabel, certColor }:
  { cliente: string; banco: string; producto: string; fecha: string; score: number; scoreColor: string; certLabel: string; certColor: string }) {
  return (
    <div
      className="sticky top-0 z-30 -mx-4 px-4 py-2 backdrop-blur-md"
      style={{
        background: "color-mix(in oklab, var(--nuvia-bg-secondary) 88%, transparent)",
        borderBottom: "1px solid var(--nuvia-border)",
      }}
    >
      <div className="flex items-center gap-3 flex-wrap text-[11.5px]">
        <span className="font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-accent)" }}>NUVIA · Certificación</span>
        <span style={{ color: "var(--nuvia-border)" }}>·</span>
        <span style={{ color: "var(--nuvia-text-primary)" }}><b>{cliente}</b></span>
        <span style={{ color: "var(--nuvia-text-secondary)" }}>{banco}</span>
        <span style={{ color: "var(--nuvia-text-muted)" }}>·</span>
        <span style={{ color: "var(--nuvia-text-secondary)" }}>{producto}</span>
        <span style={{ color: "var(--nuvia-text-muted)" }}>·</span>
        <span style={{ color: "var(--nuvia-text-muted)" }}>{fecha}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-[10px]"
            style={{ background: `${certColor}22`, color: certColor, border: `1px solid ${certColor}55` }}>
            {certLabel}
          </span>
          <span className="font-bold tabular-nums text-[13px]" style={{ color: scoreColor }}>{Math.round(score)}</span>
        </span>
      </div>
    </div>
  );
}

function ResultadoQaAi() {
  const { id } = Route.useParams();
  const { from, maestroId, modo } = Route.useSearch();
  const fromSimulador = from === "simulador";
  const fetchAud = useServerFn(obtenerAuditoriaQA);
  const doReejecutar = useServerFn(reejecutarAuditoriaQA);
  const [data, setData] = useState<{ auditoria: Record<string, unknown> | null; inconsistencias: Inc[] } | null>(null);
  const [copilotoOpen, setCopilotoOpen] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [nombre, setNombre] = useState<string>("Analista");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancel) return;
        const { data: prof } = await supabase.from("profiles" as never).select("nombre").eq("id", user.id).maybeSingle();
        const n = (prof as { nombre?: string } | null)?.nombre ?? user.user_metadata?.full_name ?? null;
        if (!cancel) setNombre(primerNombre(n, user.email));
      } catch { /* noop */ }
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => { (async () => setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] }))(); }, [id, fetchAud]);

  const recomputo = useMemo(() => {
    if (!data?.auditoria) return null;
    try {
      const inputs = (data.auditoria as Record<string, unknown>).inputs as AuditarInput & { reconstruccion: AuditarInput["reconstruccion"] & { modalidad?: AuditarInput["modalidad"] } };
      if (!inputs) return null;
      const normalizado: AuditarInput = {
        modalidad: inputs.modalidad,
        reconstruccion: { ...inputs.reconstruccion, modalidad: inputs.modalidad },
        extracto: inputs.extracto ?? {},
        simulacion: inputs.simulacion,
      };
      return auditar(normalizado);
    } catch { return null; }
  }, [data]);

  const filasCompletas = useMemo(() => {
    if (!data?.auditoria) return [] as Array<{ k: number; cuota: number; interes: number; capital: number; seguros: number; fresh: number; cuotaTotal: number; saldo: number; subsidioActivo: boolean; saldoUvr?: number; valorUvr?: number; correccionUvr?: number }>;
    const inputs = (data.auditoria as Record<string, unknown>).inputs as
      | { modalidad?: AuditarInput["modalidad"]; reconstruccion?: AuditarInput["reconstruccion"] & { cuotasPagadas?: number } }
      | undefined;
    const r = inputs?.reconstruccion;
    if (!r || !r.saldoCapital || !r.tasaEa || !r.cuotasPendientes) return [];
    try {
      const saved = ((data.auditoria as Record<string, unknown>).outputs as Record<string, unknown> | undefined)?.todasCuotas;
      if (Array.isArray(saved) && saved.length) return saved as never;
      return reconstruir({ ...r, modalidad: inputs?.modalidad ?? "hipotecario" }).todasCuotas;
    } catch { return []; }
  }, [data]);

  const reconMeta = useMemo(() => {
    const inputs = (data?.auditoria as Record<string, unknown> | undefined)?.inputs as
      | { modalidad?: string; reconstruccion?: { tasaEa?: number; coberturaFrechPp?: number; coberturaFrechValorMensual?: number; coberturaFrechCuotasRestantes?: number; cuotasPagadas?: number; cuotasPendientes?: number; seguros?: number; variacionUvrEa?: number; valorUVR?: number } }
      | undefined;
    const r = inputs?.reconstruccion;
    const tasaEa = r?.tasaEa ?? 0;
    const cob = r?.coberturaFrechPp ?? 0;
    const freshMensual = Math.max(0, r?.coberturaFrechValorMensual ?? 0);
    const tasaAplicada = Math.max(0, tasaEa - cob);
    const seguros = Math.max(0, r?.seguros ?? 0);
    const FRECH_MAX = 84;
    const n = Math.max(0, Math.round(r?.cuotasPendientes ?? 0));
    const hasFrech = cob > 0 || freshMensual > 0;
    const frechRestantes = hasFrech
      ? Math.max(0, Math.min(n, Math.round(r?.coberturaFrechCuotasRestantes ?? (FRECH_MAX - (r?.cuotasPagadas ?? 0)))))
      : 0;
    return { modalidad: inputs?.modalidad ?? "", tasaEa, cob, freshMensual, tasaAplicada, seguros, hasFrech, frechRestantes, frechMax: FRECH_MAX, variacionUvrEa: r?.variacionUvrEa ?? 5.5, valorUVR: r?.valorUVR ?? 0 };
  }, [data]);

  if (!data?.auditoria) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando certificación…</p></NCard></PageLayout>;
  }

  const a = data.auditoria as Record<string, unknown> & {
    qa_score: number; categoria: string; dictamen: string; modalidad: string;
    motor_version: string; ejecutado_at: string; outputs: Record<string, number | unknown[]>;
  };
  const o = ({ ...(a.outputs ?? {}), ...(recomputo?.reconstruccion ? {
    cuotaTeorica: recomputo.reconstruccion.cuotaTeorica,
    cuotaConSubsidio: recomputo.reconstruccion.cuotaConSubsidio,
    cuotaTotalConSeguros: recomputo.reconstruccion.cuotaTotalConSeguros,
    beneficioMensualFrech: recomputo.reconstruccion.beneficioMensualFrech,
    costoTotal: recomputo.reconstruccion.costoTotal,
    totalIntereses: recomputo.reconstruccion.totalIntereses,
    totalCorreccionUvr: recomputo.reconstruccion.totalCorreccionUvr,
    vecesPagado: recomputo.reconstruccion.vecesPagado,
    primerasCuotas: recomputo.reconstruccion.primerasCuotas,
    ultimasCuotas: recomputo.reconstruccion.ultimasCuotas,
    todasCuotas: recomputo.reconstruccion.todasCuotas,
    veredicto: recomputo.veredicto,
  } : {}) }) as Record<string, number | unknown[]>;
  const score = Number(recomputo?.score.score ?? a.qa_score);
  const dictamenEfectivo = recomputo?.score.dictamen ?? a.dictamen;
  const categoriaEfectiva = recomputo?.score.categoria ?? a.categoria;
  const isUvr = a.modalidad === "uvr";
  const scoreColor = score >= 95 ? "var(--nuvia-success)" : score >= 85 ? "var(--nuvia-warning)" : "var(--nuvia-danger)";
  const cert = certificacion(dictamenEfectivo);
  const trofeo = logro(score);
  const certAprobada = cert.estado === "certificado" || cert.estado === "certificado_obs";
  const puedeVolverAlSimulador = fromSimulador && certAprobada && !!maestroId && !!modo;
  const expedienteIdCert = typeof a.expediente_id === "string" ? a.expediente_id : null;
  const puedeConstruirPropuesta = certAprobada && !!expedienteIdCert && !puedeVolverAlSimulador;
  const sevTone = (s: string) => s === "critica" ? "var(--nuvia-danger)" : s === "warning" ? "var(--nuvia-warning)" : "var(--nuvia-text-secondary)";

  /* ----- Datos sticky header ----- */
  const inputs = (a as Record<string, unknown>).inputs as { extracto?: Record<string, unknown>; reconstruccion?: Record<string, unknown>; simulacion?: Record<string, unknown>; proyecciones?: { aplicadas?: string[]; aplicadasAt?: string | null; plazoRecalculadoPorProyeccion?: boolean; cuotasPendientesExtractoOriginal?: number | null; cuotasPendientesRecalculadas?: number | null; saldoCapitalAplicado?: number | null; cuotaClienteAplicada?: number | null; cuotaFinancieraAplicada?: number | null; segurosAplicados?: number | null; tasaEaAplicada?: number | null; saldoUvrAplicado?: number | null; valorUvrAplicado?: number | null; formulaPlazo?: string | null; count?: number } } | undefined;
  const proyInfo = inputs?.proyecciones;
  const proyectoresAplicadas = (proyInfo?.count ?? proyInfo?.aplicadas?.length ?? 0) > 0;
  const ex = (inputs?.extracto ?? {}) as Record<string, unknown>;
  const recSnap = (inputs?.reconstruccion ?? {}) as Record<string, unknown>;
  const numDato = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v == null || v === "") return undefined;
    const n = Number(String(v).replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  };
  const proySaldoAplicado = numDato(proyInfo?.saldoCapitalAplicado) ?? numDato(recSnap.saldoCapital);
  const proyCuotaCliente = numDato(proyInfo?.cuotaClienteAplicada) ?? numDato(ex.cuota);
  const proyCuotaFinanciera = numDato(proyInfo?.cuotaFinancieraAplicada) ?? numDato(recSnap.cuotaFinancieraSinSeguros);
  const proyTasaEa = numDato(proyInfo?.tasaEaAplicada) ?? numDato(recSnap.tasaEa);
  const cliente = (ex.cliente as string) || (ex.titular as string) || "Cliente";
  const banco = (ex.banco as string) || "—";
  const producto = a.modalidad === "uvr" ? "Hipotecario UVR" : a.modalidad === "hipotecario" ? "Hipotecario" : a.modalidad === "leasing" ? "Leasing" : String(a.modalidad ?? "Crédito");
  const fecha = new Date(a.ejecutado_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

  /* ----- Mensaje NUVIA al hero ----- */
  const msgArr = cert.estado === "certificado" ? MSGS_APROBADO
    : cert.estado === "certificado_obs" ? MSGS_OBS
    : cert.estado === "revision" ? MSGS_REVISION
    : MSGS_RECHAZO;
  const mensajeHero = pickMsg(msgArr, id);

  /* ----- Semáforo de confianza ----- */
  const inconsistenciasEfectivas: Inc[] = recomputo?.inconsistencias
    ? recomputo.inconsistencias.map((i, idx) => ({
      id: `recalc-${idx}`,
      tipo: i.tipo,
      severidad: i.severidad,
      campo: i.campo ?? null,
      valor_extracto: i.valorExtracto ?? null,
      valor_calculado: i.valorCalculado ?? null,
      diferencia: i.diferencia ?? null,
      mensaje: i.mensaje,
      sugerencia: i.sugerencia ?? null,
    }))
    : data.inconsistencias;
  const incCrit = inconsistenciasEfectivas.filter((i) => i.severidad === "critica").length;
  const incWarn = inconsistenciasEfectivas.filter((i) => i.severidad === "warning").length;
  const penTipos = new Set((recomputo?.score.penalizaciones ?? []).map((p) => p.tipo));
  const semaforo: Array<{ titulo: string; estado: "ok" | "warn" | "err"; detalle: string }> = [
    {
      titulo: "Extracto Validado",
      estado: penTipos.has("diff_cuota") ? "warn" : "ok",
      detalle: penTipos.has("diff_cuota") ? "Diferencia en cuota detectada" : "Cuota y saldos coinciden",
    },
    {
      titulo: "Simulación Consistente",
      estado: penTipos.has("diff_simulacion") ? "warn" : "ok",
      detalle: penTipos.has("diff_simulacion") ? "Difiere del cálculo NUVIA" : "Coincide con el motor",
    },
    {
      titulo: "Matemática Financiera",
      estado: incCrit > 0 ? "err" : incWarn > 0 ? "warn" : "ok",
      detalle: incCrit > 0 ? `${incCrit} hallazgo(s) crítico(s)` : incWarn > 0 ? `${incWarn} observación(es)` : "Reconstrucción correcta",
    },
    {
      titulo: "Información por Confirmar",
      estado: penTipos.has("campos_faltantes") ? "warn" : "ok",
      detalle: penTipos.has("campos_faltantes") ? "Faltan campos críticos" : "Captura completa",
    },
  ];
  const tonoSem = (e: "ok" | "warn" | "err") =>
    e === "ok" ? { c: "var(--nuvia-success)", emoji: "🟢" }
    : e === "warn" ? { c: "var(--nuvia-warning)", emoji: "🟡" }
    : { c: "var(--nuvia-danger)", emoji: "🔴" };

  /* ----- Veredicto ejecutivo principal ----- */
  const veredicto = (recomputo?.veredicto ?? (o.veredicto as unknown as Veredicto | undefined)) as Veredicto | undefined;
  const tienePlazo = veredicto?.plazoImplicito !== undefined && veredicto?.plazoReportado !== undefined;
  const desfase = veredicto?.desfasePlazo ?? 0;
  const nivelDesfase = Math.abs(desfase) === 0 ? "OK" : Math.abs(desfase) <= 6 ? "BAJO" : Math.abs(desfase) <= 24 ? "MEDIO" : "ALTO";
  const colorDesfase = nivelDesfase === "OK" ? "var(--nuvia-success)"
    : nivelDesfase === "BAJO" ? "var(--nuvia-warning)"
    : nivelDesfase === "MEDIO" ? "var(--nuvia-warning)" : "var(--nuvia-danger)";

  /* ----- Acción recomendada (máx 3) ----- */
  const acciones = (veredicto?.recomendaciones ?? []).slice(0, 3);
  if (proyectoresAplicadas && incCrit === 0 && incWarn === 0) {
    acciones.splice(0, acciones.length,
      `Construye la propuesta comercial con ${Math.round(proyInfo?.cuotasPendientesRecalculadas ?? veredicto?.plazoImplicito ?? 0)} meses reales, no con las ${Math.round(proyInfo?.cuotasPendientesExtractoOriginal ?? 0)} cuotas del extracto inicial.`,
      `Usa como base: saldo $${fmt(proySaldoAplicado, 0)}, cuota actual $${fmt(proyCuotaCliente, 0)} y TEA ${fmt(proyTasaEa, 4)}%.`,
      "El caso queda matemáticamente certificado: avanza al simulador/propuesta y conserva la proyección oficial como soporte.",
    );
  }
  if (acciones.length === 0) {
    if (cert.estado === "certificado") {
      acciones.push("Avanza con la propuesta de optimización del crédito al cliente.");
    } else if (cert.estado === "certificado_obs") {
      acciones.push("Revisa la observación menor antes de presentar al cliente.");
      acciones.push("Confirma los datos pendientes con el banco si aplica.");
    } else {
      acciones.push("Solicita las proyecciones oficiales al banco.");
      acciones.push("Valida si existen abonos extraordinarios o cambios de tasa.");
      acciones.push("Reejecuta la auditoría cuando tengas la información.");
    }
  }

  /* ----- KPIs principales (4) ----- */
  const kpisPrincipales = [
    { label: "Cuota Real", value: `$${fmt(o.cuotaTotalConSeguros as number, 0)}`, icon: <Calculator size={14} /> },
    { label: "Costo Total", value: `$${fmt(o.costoTotal as number, 0)}`, icon: <Coins size={14} /> },
    { label: "Intereses Totales", value: `$${fmt(o.totalIntereses as number, 0)}`, icon: <Coins size={14} /> },
    { label: "Veces Pagado", value: (o.vecesPagado as number ?? 0).toFixed(2), icon: <Gauge size={14} /> },
  ];

  /* ----- Reconstrucción tabla (ya existente) ----- */
  type FilaUI = { k: number; cuota: number; interes: number; capital: number; seguros: number; fresh: number; cuotaTotal: number; saldo: number; subsidioActivo: boolean; saldoUvr?: number; valorUvr?: number; correccionUvr?: number };
  const enriquecer = (f: { k: number; cuota: number; interes: number; capital: number; saldo: number; seguros?: number; fresh?: number; cuotaTotal?: number; subsidioActivo?: boolean }): FilaUI => ({
    k: f.k, cuota: f.cuota, interes: f.interes, capital: f.capital, saldo: f.saldo,
    seguros: f.seguros ?? reconMeta.seguros,
    fresh: f.fresh ?? (reconMeta.hasFrech && f.k <= reconMeta.frechRestantes ? reconMeta.freshMensual : 0),
    cuotaTotal: f.cuotaTotal ?? (f.cuota + (f.seguros ?? reconMeta.seguros) - (f.fresh ?? (reconMeta.hasFrech && f.k <= reconMeta.frechRestantes ? reconMeta.freshMensual : 0))),
    subsidioActivo: f.subsidioActivo ?? (reconMeta.hasFrech && f.k <= reconMeta.frechRestantes),
    saldoUvr: (f as FilaUI).saldoUvr,
    valorUvr: (f as FilaUI).valorUvr,
    correccionUvr: (f as FilaUI).correccionUvr,
  });
  const primeras = ((o.primerasCuotas as Array<{ k: number; cuota: number; interes: number; capital: number; saldo: number; seguros?: number; fresh?: number; cuotaTotal?: number; subsidioActivo?: boolean }>) ?? []).map(enriquecer);
  const ultimas = ((o.ultimasCuotas as Array<{ k: number; cuota: number; interes: number; capital: number; saldo: number; seguros?: number; fresh?: number; cuotaTotal?: number; subsidioActivo?: boolean }>) ?? []).map(enriquecer);
  const ksPrimeras = new Set(primeras.map((f) => f.k));
  const filasResumen: FilaUI[] = [...primeras, ...ultimas.filter((f) => !ksPrimeras.has(f.k))];
  const puedeVerTodas = filasCompletas.length > filasResumen.length;
  const filasAmort: FilaUI[] = verTodas && puedeVerTodas ? (filasCompletas as FilaUI[]) : filasResumen;
  const nTotal = filasCompletas.length || filasResumen.length;
  const penalizaciones = recomputo?.score.penalizaciones ?? [];
  const alertasCriticas = inconsistenciasEfectivas.filter((i) => i.severidad === "critica");

  const handleReejecutar = async () => {
    if (reloading) return;
    setReloading(true);
    try {
      await doReejecutar({ data: { id } });
      setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] });
    } finally { setReloading(false); }
  };

  const handlePdf = () => exportarDictamenPDF({
    auditoriaId: id, modalidad: a.modalidad, motorVersion: a.motor_version, ejecutadoAt: a.ejecutado_at,
    qaScore: score, categoria: categoriaEfectiva, dictamen: dictamenEfectivo, outputs: o,
    inputs: (a as Record<string, unknown>).inputs as { reconstruccion?: Record<string, unknown>; extracto?: Record<string, unknown>; simulacion?: Record<string, unknown> },
    penalizaciones, inconsistencias: inconsistenciasEfectivas as Inc[],
  });

  return (
    <PageLayout>
      <StickyHeader
        cliente={cliente} banco={banco} producto={producto} fecha={fecha}
        score={score} scoreColor={scoreColor} certLabel={cert.label} certColor={cert.color}
      />

      {/* HERO DE CERTIFICACIÓN */}
      <section
        className="relative overflow-hidden rounded-[var(--nuvia-radius-lg)]"
        style={{
          background: "linear-gradient(135deg, rgba(68,93,163,0.20) 0%, var(--nuvia-bg-secondary) 55%, rgba(132,185,143,0.18) 100%)",
          border: "1px solid var(--nuvia-border)",
          boxShadow: "0 24px 56px -30px rgba(68,93,163,0.7)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(68,93,163,0.55), transparent 60%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full opacity-35 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(132,185,143,0.55), transparent 60%)" }} />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-0">
          {/* Score gigante */}
          <div className="p-6 lg:p-8 lg:border-r" style={{ borderColor: "var(--nuvia-border)" }}>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: "var(--nuvia-text-muted)" }}>
              <Brain size={12} style={{ color: "var(--nuvia-accent)" }} />
              Certificación Financiera · NUVIA
            </div>
            <div className="mt-3 flex items-end gap-4">
              <p
                className="font-bold tabular-nums leading-none"
                style={{ color: scoreColor, fontSize: "clamp(96px, 14vw, 160px)", letterSpacing: "-0.04em" }}
              >
                {Math.round(score)}
              </p>
              <div className="pb-3 flex flex-col gap-1.5">
                <span className="rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider whitespace-nowrap"
                  style={{ background: `${cert.color}22`, color: cert.color, border: `1px solid ${cert.color}66` }}>
                  {cert.emoji} {cert.label}
                </span>
                <span className="rounded-full px-3 py-1 text-[11px] font-semibold inline-flex items-center gap-1.5"
                  style={{ background: `${trofeo.color}1a`, color: trofeo.color, border: `1px solid ${trofeo.color}44` }}>
                  {trofeo.icono} {trofeo.titulo}
                </span>
              </div>
            </div>

            <p className="mt-5 text-[15px] leading-snug max-w-xl" style={{ color: "var(--nuvia-text-primary)" }}>
              <span className="font-semibold">
                {(() => {
                  const h = new Date().getHours();
                  if (h < 12) return "Buenos días";
                  if (h < 19) return "Buenas tardes";
                  return "Buenas noches";
                })()}, {nombre}.
              </span>{" "}
              <span style={{ color: "var(--nuvia-text-secondary)" }}>{mensajeHero}</span>
            </p>

            {/* Acciones premium */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => setCopilotoOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                style={{ background: "var(--nuvia-accent)", color: "#0B1220", border: "none", cursor: "pointer", boxShadow: "0 8px 20px -10px rgba(68,93,163,0.6)" }}>
                <MessageCircle size={14} /> Explícame este dictamen
              </button>
              <button onClick={handlePdf}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border)", cursor: "pointer" }}>
                <FileDown size={14} /> Exportar PDF
              </button>
              <button onClick={handleReejecutar} disabled={reloading}
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--nuvia-text-primary)", border: "1px solid var(--nuvia-border)", cursor: reloading ? "not-allowed" : "pointer", opacity: reloading ? 0.5 : 1 }}>
                <RefreshCw size={14} className={reloading ? "animate-spin" : ""} /> {reloading ? "Reauditando…" : "Reauditar"}
              </button>
              {puedeVolverAlSimulador ? (
                <Link
                  to="/simulador"
                  search={{ maestroId, modo }}
                >
                  <button className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                    style={{ background: "var(--nuvia-success)", color: "#0B1220", border: "none", cursor: "pointer", boxShadow: "0 8px 20px -10px rgba(132,185,143,0.6)" }}>
                    <Rocket size={14} /> Volver al simulador · Crear caso
                  </button>
                </Link>
              ) : puedeConstruirPropuesta && expedienteIdCert ? (
                <Link to="/casos/$id" params={{ id: expedienteIdCert }}>
                  <button className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                    style={{ background: "var(--nuvia-success)", color: "#0B1220", border: "none", cursor: "pointer", boxShadow: "0 8px 20px -10px rgba(132,185,143,0.6)" }}>
                    <Rocket size={14} /> Construir propuestas comerciales
                  </button>
                </Link>
              ) : (
                <Link to="/qa-ai">
                  <button className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition hover:opacity-90"
                    style={{ background: "transparent", color: "var(--nuvia-text-secondary)", border: "1px solid var(--nuvia-border)", cursor: "pointer" }}>
                    <ArrowLeft size={14} /> Volver
                  </button>
                </Link>
              )}
            </div>
          </div>


          {/* Lado derecho: KPIs + Semáforo */}
          <div className="p-6 lg:p-8 flex flex-col gap-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-2.5" style={{ color: "var(--nuvia-text-muted)" }}>
                KPIs del crédito
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {kpisPrincipales.map((k, i) => (
                  <div key={i} className="rounded-xl px-3 py-2.5"
                    style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--nuvia-border)" }}>
                    <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--nuvia-text-muted)" }}>
                      <span style={{ color: "var(--nuvia-accent)" }}>{k.icon}</span>
                      {k.label}
                    </div>
                    <p className="mt-1 text-[17px] font-bold tabular-nums leading-tight" style={{ color: "var(--nuvia-text-primary)" }}>
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-2.5" style={{ color: "var(--nuvia-text-muted)" }}>
                Semáforo de confianza
              </p>
              <div className="grid grid-cols-2 gap-2">
                {semaforo.map((s, i) => {
                  const t = tonoSem(s.estado);
                  return (
                    <div key={i} className="rounded-lg px-3 py-2"
                      style={{ background: `${t.c}10`, border: `1px solid ${t.c}33` }}>
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: t.c }}>
                        <span>{t.emoji}</span>
                        {s.titulo}
                      </div>
                      <p className="text-[10.5px] mt-0.5 leading-snug" style={{ color: "var(--nuvia-text-secondary)" }}>
                        {s.detalle}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA: continuar al simulador solo si la certificación fue aprobada */}
      {puedeVolverAlSimulador && (
        <section
          className="relative overflow-hidden rounded-[var(--nuvia-radius-lg)] border p-5"
          style={{
            background: "linear-gradient(135deg, rgba(132,185,143,0.18) 0%, rgba(15,23,42,0.55) 100%)",
            borderColor: "rgba(132,185,143,0.45)",
            boxShadow: "0 18px 48px -28px rgba(132,185,143,0.55)",
          }}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border"
                style={{ background: "rgba(132,185,143,0.25)", borderColor: "rgba(132,185,143,0.45)" }}>
                <CheckCircle2 size={20} style={{ color: "var(--nuvia-success)" }} />
              </div>
              <div>
                <p className="text-[13.5px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
                  {cert.estado === "certificado"
                    ? "Certificación aprobada · Listo para crear el caso"
                    : "Certificación aprobada con observaciones · Revisa antes de crear el caso"}
                </p>
                <p className="text-[12.5px] mt-0.5" style={{ color: "var(--nuvia-text-secondary)" }}>
                  {cert.estado === "certificado"
                    ? "La auditoría QA fue exitosa. Vuelve al simulador para guardar el expediente y continuar."
                    : "La auditoría QA fue exitosa con observaciones menores. Revisa el dictamen y vuelve al simulador para guardar el caso."}
                </p>
              </div>
            </div>
            <Link to="/simulador" search={{ maestroId, modo }}>
              <button className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition hover:opacity-90"
                style={{ background: "var(--nuvia-success)", color: "#0B1220", border: "none", cursor: "pointer", boxShadow: "0 8px 20px -10px rgba(132,185,143,0.6)" }}>
                <Rocket size={15} /> Volver al simulador
              </button>
            </Link>
          </div>
        </section>
      )}

      {/* BANNER: NUVIA revisó proyecciones del banco */}
      {proyectoresAplicadas && (() => {
        const n = proyInfo?.count ?? proyInfo?.aplicadas?.length ?? 0;
        const fechaProy = proyInfo?.aplicadasAt ? new Date(proyInfo.aplicadasAt).toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
        const recalculo = proyInfo?.plazoRecalculadoPorProyeccion === true;
        const cuotasAntes = proyInfo?.cuotasPendientesExtractoOriginal;
        const cuotasDespues = proyInfo?.cuotasPendientesRecalculadas;
        const resolvio = incCrit === 0 && incWarn === 0;
        const tono = resolvio ? "var(--nuvia-success)" : "var(--nuvia-warning)";
        return (
          <section className="rounded-[var(--nuvia-radius-lg)] p-4 lg:p-5"
            style={{ background: `linear-gradient(135deg, ${tono}18, rgba(255,255,255,0.03))`, border: `1px solid ${tono}55` }}>
            <div className="flex items-start gap-3">
              <div className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: `${tono}22`, color: tono, border: `1px solid ${tono}66` }}>
                NUVIA · Proyecciones revisadas
              </div>
              {fechaProy && (
                <span className="text-[11px]" style={{ color: "var(--nuvia-text-muted)" }}>{fechaProy}</span>
              )}
            </div>
            <p className="mt-2 text-[13.5px] leading-snug" style={{ color: "var(--nuvia-text-primary)" }}>
              NUVIA leyó <strong>{n}</strong> proyección{n === 1 ? "" : "es"} oficial{n === 1 ? "" : "es"} entregada{n === 1 ? "" : "s"} por el banco, las fusionó con el extracto y volvió a auditar el crédito desde la matemática financiera.
            </p>
            {recalculo && cuotasAntes && cuotasDespues && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                {[
                  ["Extracto inicial", `${Math.round(cuotasAntes)} cuotas reportadas`],
                  ["Proyección banco", `$${fmt(proySaldoAplicado, 0)} · cuota $${fmt(proyCuotaCliente, 0)}`],
                  ["Cuota financiera", `$${fmt(proyCuotaFinanciera, 0)} sin seguros · TEA ${fmt(proyTasaEa, 4)}%`],
                  ["Resultado NUVIA", `${Math.round(cuotasDespues)} meses reales`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.18)", border: "1px solid var(--nuvia-border)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--nuvia-text-muted)" }}>{k}</p>
                    <p className="mt-1 text-[12px] font-semibold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{v}</p>
                  </div>
                ))}
              </div>
            )}
            {recalculo && (
              <p className="mt-2 text-[12.5px] leading-snug" style={{ color: "var(--nuvia-text-secondary)" }}>
                Fórmula aplicada: <strong>{proyInfo?.formulaPlazo ?? (isUvr ? "n = ln(C_UVR / (C_UVR − Saldo_UVR × i)) / ln(1 + i)" : "n = ln(C / (C − Saldo × i)) / ln(1 + i)")}</strong>. NUVIA reconstruyó el crédito con saldo a capital, cuota financiera sin seguros y TEA derivada de la proyección oficial.
              </p>
            )}
            <p className="mt-2 text-[13px] font-semibold" style={{ color: tono }}>
              {resolvio
                ? "✅ Con las proyecciones aplicadas, la inconsistencia queda resuelta: el plazo comercial de trabajo es el recalculado por NUVIA. Paso siguiente: construir propuesta sobre ese plazo real y no sobre las 320 cuotas del extracto."
                : `⚠️ Aún con las proyecciones del banco aplicadas, persisten ${incCrit + incWarn} hallazgo(s) (${incCrit} crítico${incCrit === 1 ? "" : "s"}, ${incWarn} observación${incWarn === 1 ? "" : "es"}). Paso siguiente: pedir aclaración formal al banco sobre esos datos.`}
            </p>
          </section>
        );
      })()}

      {/* VEREDICTO EJECUTIVO + ACCIÓN RECOMENDADA */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Veredicto */}
        <NCard>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} style={{ color: colorDesfase }} />
            <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              ¿Qué encontró NUVIA?
            </h3>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: `${colorDesfase}22`, color: colorDesfase, border: `1px solid ${colorDesfase}55` }}>
              NIVEL {nivelDesfase}
            </span>
          </div>

          {tienePlazo ? (
            <>
              <p className="text-[13px] leading-snug mb-3" style={{ color: "var(--nuvia-text-secondary)" }}>
                {veredicto!.titular}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border)" }}>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--nuvia-text-muted)" }}>Plazo extracto</p>
                  <p className="mt-1 text-[20px] font-bold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{veredicto!.plazoReportado}</p>
                  <p className="text-[10px]" style={{ color: "var(--nuvia-text-muted)" }}>cuotas</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border)" }}>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--nuvia-text-muted)" }}>Plazo matemático</p>
                  <p className="mt-1 text-[20px] font-bold tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>{veredicto!.plazoImplicito}</p>
                  <p className="text-[10px]" style={{ color: "var(--nuvia-text-muted)" }}>cuotas</p>
                </div>
                <div className="rounded-lg p-3" style={{ background: `${colorDesfase}12`, border: `1px solid ${colorDesfase}44` }}>
                  <p className="text-[10px] uppercase tracking-wider font-bold" style={{ color: colorDesfase }}>Diferencia</p>
                  <p className="mt-1 text-[20px] font-bold tabular-nums" style={{ color: colorDesfase }}>
                    {desfase > 0 ? "+" : ""}{desfase}
                  </p>
                  <p className="text-[10px]" style={{ color: colorDesfase }}>cuotas</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-snug" style={{ color: "var(--nuvia-text-secondary)" }}>
              {veredicto?.resumen ?? "Sin diferencias materiales detectadas en la reconstrucción matemática."}
            </p>
          )}
        </NCard>

        {/* Acción recomendada */}
        <NCard>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} style={{ color: "var(--nuvia-accent)" }} />
            <h3 className="text-[13.5px] font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>
              Basado en lo anterior, esta es mi recomendación
            </h3>
          </div>
          <ul className="space-y-2.5">
            {acciones.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
                style={{ background: "linear-gradient(135deg, rgba(68,93,163,0.10), rgba(132,185,143,0.08))", border: "1px solid var(--nuvia-border)" }}>
                <span className="text-[14px] leading-none" style={{ color: "var(--nuvia-accent-green)" }}>👉</span>
                <span className="text-[13px] leading-snug" style={{ color: "var(--nuvia-text-primary)" }}>{r}</span>
              </li>
            ))}
          </ul>
        </NCard>
      </section>

      {/* REFLEXIÓN NUVIA — motor de inspiración */}
      <MotivacionNuvia seed={id} />

      {/* PROYECCIONES (sin cambios — comportamiento existente) */}
      {typeof a.expediente_id === "string" ? (() => {
        const bancoExp = (((a as Record<string, unknown>).inputs as Record<string, unknown> | undefined)?.extracto as Record<string, unknown> | undefined)?.banco as string | undefined ?? "";
        const aplicaCierre = bancoGeneraProyeccionesCierre(bancoExp);
        const motivo = !aplicaCierre ? motivoSinProyecciones(bancoExp) : null;
        const expId = a.expediente_id;
        return (
          <>
            <ProyeccionesDropzone expedienteId={expId} variant="qa" momento="auditoria"
              onReauditoria={async (nuevaAuditoriaId) => {
                setReloading(true);
                try {
                  // La reauditoría crea un NUEVO dictamen QA (el anterior queda en histórico).
                  // Si el id cambió, navegamos a la nueva URL; si por alguna razón no, refrescamos.
                  if (nuevaAuditoriaId && nuevaAuditoriaId !== id) {
                    if (typeof window !== "undefined") {
                      window.location.assign(`/qa-ai/${nuevaAuditoriaId}`);
                      return;
                    }
                  }
                  setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] });
                }
                finally { setReloading(false); }
              }} />

            {aplicaCierre ? (
              <>
                <ProyeccionesDropzone expedienteId={expId} variant="qa" momento="cierre" />
                <VerificacionCierreBlock expedienteId={expId} bancoHint={bancoExp} variant="qa" />
              </>
            ) : bancoExp ? (
              <NCard>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>Verificación de cierre</p>
                <p className="text-[13px]" style={{ color: "var(--nuvia-text-primary)" }}>
                  {motivo ?? "Este banco no emite proyecciones formales al cierre. NUVIA verificará contra el próximo extracto post-ejecución."}
                </p>
              </NCard>
            ) : null}
          </>
        );
      })() : null}

      {/* INFORMACIÓN TÉCNICA — todo en acordeones cerrados por defecto */}
      <div className="flex items-center gap-2 mt-2 mb-1">
        <Trophy size={14} style={{ color: "var(--nuvia-accent)" }} />
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--nuvia-text-muted)" }}>
          Información técnica · Profundiza si lo necesitas
        </p>
      </div>

      <Accordion title="Veredicto técnico completo" icon={<Brain size={15} style={{ color: "var(--nuvia-accent)" }} />}>
        <div className="-mt-px">
          <VeredictoBlock veredicto={veredicto} />
        </div>
      </Accordion>

      <Accordion
        title="Penalizaciones aplicadas al QA Score"
        icon={<Minus size={15} style={{ color: "var(--nuvia-warning)" }} />}
        count={penalizaciones.length}
      >
        {penalizaciones.length === 0 ? (
          <div className="px-5 py-4 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
            <CheckCircle2 size={16} /> Sin penalizaciones. Score perfecto: 100/100.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Concepto", "Razón", "Puntos restados"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {penalizaciones.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{penLabel[p.tipo] ?? p.tipo}</td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-secondary)" }}>
                      {p.tipo.startsWith("inconsistencias_") && `Cada hallazgo de esa severidad penaliza según tolerancias configuradas.`}
                      {p.tipo === "diff_cuota" && `La cuota mensual reconstruida difiere de la del extracto bancario.`}
                      {p.tipo === "diff_simulacion" && `El ahorro/plazo declarado por el analista difiere del cálculo matemático.`}
                      {p.tipo === "campos_faltantes" && `Faltan campos críticos (saldo, tasa, plazo, cuota o saldo extracto).`}
                    </td>
                    <td className="px-4 py-2 tabular-nums font-semibold text-right" style={{ color: "var(--nuvia-danger)" }}>−{p.valor.toFixed(1)}</td>
                  </tr>
                ))}
                <tr style={{ background: "rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-2 font-semibold" style={{ color: "var(--nuvia-text-primary)" }} colSpan={2}>QA Score final</td>
                  <td className="px-4 py-2 tabular-nums font-bold text-right" style={{ color: scoreColor }}>{score.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Accordion>

      <Accordion
        title="Alertas críticas"
        icon={<ShieldAlert size={15} style={{ color: "var(--nuvia-danger)" }} />}
        count={alertasCriticas.length}
      >
        {alertasCriticas.length === 0 ? (
          <div className="px-5 py-4 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
            <CheckCircle2 size={16} /> Sin alertas críticas.
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {alertasCriticas.map((al) => (
              <div key={al.id} className="flex items-start gap-3 px-3 py-2 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                <AlertTriangle size={16} style={{ color: "var(--nuvia-danger)", flexShrink: 0, marginTop: 2 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--nuvia-text-primary)" }}>{al.mensaje}</p>
                  {al.sugerencia && <p className="text-xs mt-1" style={{ color: "var(--nuvia-text-secondary)" }}>↳ {al.sugerencia}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Accordion>

      <Accordion
        title="Inconsistencias detectadas"
        icon={<AlertTriangle size={15} style={{ color: "var(--nuvia-warning)" }} />}
        count={inconsistenciasEfectivas.length}
      >
        {inconsistenciasEfectivas.length === 0 ? (
          <div className="px-5 py-4 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
            <CheckCircle2 size={16} /> Sin inconsistencias matemáticas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                  {["Tipo", "Sev.", "Campo", "Extracto", "Calculado", "Δ", "Mensaje"].map((h) => (
                    <th key={h} className="text-left px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {inconsistenciasEfectivas.map((i) => (
                  <tr key={i.id} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                    <td className="px-4 py-2 capitalize" style={{ color: "var(--nuvia-text-primary)" }}>{i.tipo}</td>
                    <td className="px-4 py-2 font-semibold uppercase" style={{ color: sevTone(i.severidad) }}>
                      <span className="inline-flex items-center gap-1">{i.severidad === "critica" && <AlertTriangle size={12} />} {i.severidad}</span>
                    </td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-secondary)" }}>{i.campo ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(i.valor_extracto, 2)}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(i.valor_calculado, 2)}</td>
                    <td className="px-4 py-2 tabular-nums" style={{ color: sevTone(i.severidad) }}>{fmt(i.diferencia, 2)}</td>
                    <td className="px-4 py-2" style={{ color: "var(--nuvia-text-primary)" }}>
                      {i.mensaje}
                      {i.sugerencia && <div className="text-[11px] mt-0.5" style={{ color: "var(--nuvia-text-secondary)" }}>{i.sugerencia}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Accordion>

      <Accordion title="Fórmulas aplicadas por el motor" icon={<Sigma size={15} style={{ color: "var(--nuvia-accent)" }} />}>
        <div className="p-5">
          <SectionHeader title="Modelo matemático determinístico" description="Sin IA, sin estimaciones." icon={<Sigma size={14} />} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[13px]">
            {(isUvr ? [
              { t: "Tasa mensual cobrada", f: "i = (1 + TE_Cobrada)^(1/12) − 1" },
              { t: "Variación mensual UVR", f: "v = (1 + Variación_UVR_EA)^(1/12) − 1" },
              { t: "Cuota financiera UVR", f: "C_uvr = PMT(TE_Cobrada_mes, cuotas_pendientes, saldo_uvr)" },
              { t: "Interés UVR", f: "I_uvr,k = Saldo_uvr,k−1 · i" },
              { t: "Capital UVR", f: "K_uvr,k = C_uvr − I_uvr,k" },
              { t: "Saldo COP", f: "Saldo_COP,k = (Saldo_uvr,k−1 − K_uvr,k) · Valor_UVR_k" },
              { t: "Corrección UVR", f: "Corrección_k = Saldo_uvr,k−1 · (Valor_UVR_k − Valor_UVR_k−1)" },
              ...(reconMeta.hasFrech ? [{ t: "Pago cliente", f: "Pago = Cuota_sin_subsidio − Beneficio_FRECH" }] : []),
            ] : [
              { t: "Tasa mensual vencida (i_mv)", f: "i_mv = (1 + EA)^(1/12) − 1" },
              { t: "Cuota teórica (sistema francés)", f: "C = S · i_mv / (1 − (1 + i_mv)^−n)" },
              ...(reconMeta.hasFrech ? [
                { t: "Cuota con subsidio FRECH", f: "i_sub = (1 + (EA − cob))^(1/12) − 1  →  C_sub = S · i_sub / (1 − (1+i_sub)^−n)" },
                { t: "Beneficio mensual FRECH", f: "Beneficio = C − C_sub" },
                { t: "Cuota total mensual", f: "Cuota_total = C_sub + Seguros" },
              ] : [
                { t: "Cuota total mensual", f: "Cuota_total = C + Seguros" },
              ]),
              { t: "Interés de la cuota k", f: "I_k = Saldo_{k−1} · i_periodica" },
              { t: "Capital de la cuota k", f: "K_k = C − I_k" },
              { t: "Costo total proyectado", f: reconMeta.hasFrech ? "Costo = C_sub · n + Seguros · n" : "Costo = C · n + Seguros · n" },
              { t: "Veces pagado vs desembolso", f: "Veces = Costo / Desembolso" },
              { t: "QA Score", f: "Score = 100 − Σ penalizaciones (info×1, warn×5, crit×15 + diff_cuota + diff_sim + faltantes)" },
            ]).map((x, i) => (
              <div key={i} className="px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--nuvia-border)" }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>{x.t}</p>
                <code className="font-mono text-[12px]" style={{ color: "var(--nuvia-accent)" }}>{x.f}</code>
              </div>
            ))}
          </div>
        </div>
      </Accordion>

      <Accordion
        title="Plan de amortización"
        icon={<Calculator size={15} style={{ color: "var(--nuvia-accent)" }} />}
        count={`${filasAmort.length}/${nTotal}`}
      >
        <div style={{ padding: "12px 20px 0" }} className="flex flex-wrap gap-2 text-[11px] items-center">
          <span className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
            {isUvr ? "TE cobrada" : "Tasa EA pactada"}: <b style={{ color: "var(--nuvia-text-primary)" }}>{reconMeta.tasaEa.toFixed(2)}%</b>
          </span>
          {isUvr && (
            <span className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
              Variación UVR EA: <b style={{ color: "var(--nuvia-text-primary)" }}>{reconMeta.variacionUvrEa.toFixed(2)}%</b>
            </span>
          )}
          {reconMeta.hasFrech && (
            <>
              {reconMeta.cob > 0 && (
                <span className="rounded-md px-2 py-1" style={{ background: "rgba(132,185,143,0.10)", border: "1px solid rgba(132,185,143,0.35)", color: "var(--nuvia-success)" }}>
                  FRECH: −{reconMeta.cob.toFixed(2)} pp
                </span>
              )}
              {reconMeta.freshMensual > 0 && (
                <span className="rounded-md px-2 py-1" style={{ background: "rgba(132,185,143,0.10)", border: "1px solid rgba(132,185,143,0.35)", color: "var(--nuvia-success)" }}>
                  Fresh mensual: −${fmt(reconMeta.freshMensual, 0)}
                </span>
              )}
            </>
          )}
          <span className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
            Seguros mensuales: <b style={{ color: "var(--nuvia-text-primary)" }}>${fmt(reconMeta.seguros, 0)}</b>
          </span>
          {puedeVerTodas && (
            <button
              onClick={() => setVerTodas((v) => !v)}
              className="ml-auto rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-90"
              style={{
                borderColor: "var(--nuvia-border)",
                background: verTodas ? "var(--nuvia-accent)" : "rgba(255,255,255,0.04)",
                color: verTodas ? "#0B1220" : "var(--nuvia-text-primary)",
                cursor: "pointer",
              }}
            >
              {verTodas ? `Ver resumen (${filasResumen.length})` : `Ver todas (${nTotal})`}
            </button>
          )}
        </div>

        <div className="overflow-x-auto mt-3">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                {(isUvr
                  ? ["#", "Cuota", "Interés", "Capital", "Corrección", "Seguros", ...(reconMeta.hasFrech ? ["Fresh"] : []), "Cuota total", "Saldo COP", "Saldo UVR", "Valor UVR"]
                  : ["#", "Cuota", "Interés", "Capital", "Seguros", ...(reconMeta.hasFrech ? ["Fresh"] : []), "Cuota total", "Saldo"]
                ).map((h) => (
                  <th key={h} className="text-right px-4 py-2 font-medium" style={{ color: "var(--nuvia-text-secondary)", borderBottom: "1px solid var(--nuvia-border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filasAmort.map((f) => (
                <tr key={f.k} style={{ borderBottom: "1px solid var(--nuvia-border)" }}>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>
                    <span className="inline-flex items-center gap-1.5 justify-end">
                      {f.subsidioActivo && (
                        <span title="Cuota con FRECH/Fresh" style={{ width: 6, height: 6, borderRadius: 999, background: "var(--nuvia-success)", display: "inline-block" }} />
                      )}
                      {f.k}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-primary)" }}>${fmt(f.cuota, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.interes, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.capital, 0)}</td>
                  {isUvr && <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-warning)" }}>${fmt(f.correccionUvr, 0)}</td>}
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.seguros, 0)}</td>
                  {reconMeta.hasFrech && <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: f.fresh > 0 ? "var(--nuvia-success)" : "var(--nuvia-text-secondary)" }}>{f.fresh > 0 ? `−$${fmt(f.fresh, 0)}` : "$0"}</td>}
                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>${fmt(f.cuotaTotal, 0)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>${fmt(f.saldo, 0)}</td>
                  {isUvr && <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(f.saldoUvr, 4)}</td>}
                  {isUvr && <td className="px-4 py-1.5 text-right tabular-nums" style={{ color: "var(--nuvia-text-secondary)" }}>{fmt(f.valorUvr, 4)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Accordion>

      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} auditoriaId={id} />
    </PageLayout>
  );
}
