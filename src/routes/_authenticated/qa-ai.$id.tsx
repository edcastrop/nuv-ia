import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageLayout, ExecutiveHero, NCard, SectionHeader } from "@/components/nuvia";
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
import type { Veredicto } from "@/lib/qaMath";
import { Brain, Gauge, ArrowLeft, AlertTriangle, CheckCircle2, Coins, Calculator, Sigma, ShieldAlert, Minus, FileDown, Sparkles, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/qa-ai/$id")({
  component: ResultadoQaAi,
  head: () => ({ meta: [{ title: "Resultado auditoría · QA AI" }] }),
});

type Inc = {
  id: string; tipo: string; severidad: string; campo: string | null;
  valor_extracto: number | null; valor_calculado: number | null; diferencia: number | null;
  mensaje: string; sugerencia: string | null;
};

const dictamenLabel: Record<string, string> = {
  aprobado: "APROBADO", aprobado_obs: "APROBADO CON OBSERVACIONES",
  requiere_revision: "REQUIERE REVISIÓN", rechazado: "RECHAZADO",
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

function ResultadoQaAi() {
  const { id } = Route.useParams();
  const fetchAud = useServerFn(obtenerAuditoriaQA);
  const doReejecutar = useServerFn(reejecutarAuditoriaQA);
  const [data, setData] = useState<{ auditoria: Record<string, unknown> | null; inconsistencias: Inc[] } | null>(null);
  const [copilotoOpen, setCopilotoOpen] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => { (async () => setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] }))(); }, [id, fetchAud]);

  // Recomputar score+penalizaciones desde los inputs guardados (determinístico)
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

  // Reconstrucción COMPLETA del plan amortizado (todas las cuotas pendientes)
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

  // Metadatos para encabezado (tasa aplicada, FRECH, seguros)
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
      ? Math.max(0, Math.min(n, Math.round(
          r?.coberturaFrechCuotasRestantes ?? (FRECH_MAX - (r?.cuotasPagadas ?? 0)),
        )))
      : 0;
    return { modalidad: inputs?.modalidad ?? "", tasaEa, cob, freshMensual, tasaAplicada, seguros, hasFrech, frechRestantes, frechMax: FRECH_MAX, variacionUvrEa: r?.variacionUvrEa ?? 5.5, valorUVR: r?.valorUVR ?? 0 };
  }, [data]);

  if (!data?.auditoria) {
    return <PageLayout><NCard><p className="text-sm" style={{ color: "var(--nuvia-text-secondary)" }}>Cargando dictamen…</p></NCard></PageLayout>;
  }
  const a = data.auditoria as Record<string, unknown> & {
    qa_score: number; categoria: string; dictamen: string; modalidad: string;
    motor_version: string; ejecutado_at: string; outputs: Record<string, number | unknown[]>;
  };
  const o = (a.outputs ?? {}) as Record<string, number | unknown[]>;
  const score = Number(a.qa_score);
  const isUvr = a.modalidad === "uvr";
  const scoreColor = score >= 95 ? "var(--nuvia-success)" : score >= 85 ? "var(--nuvia-warning)" : "var(--nuvia-danger)";
  const dictColor = a.dictamen === "aprobado" ? "var(--nuvia-success)"
    : a.dictamen === "aprobado_obs" ? "var(--nuvia-warning)"
    : a.dictamen === "requiere_revision" ? "var(--nuvia-warning)" : "var(--nuvia-danger)";

  const sevTone = (s: string) => s === "critica" ? "var(--nuvia-danger)" : s === "warning" ? "var(--nuvia-warning)" : "var(--nuvia-text-secondary)";

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
  const filasResumen: FilaUI[] = [
    ...primeras,
    ...ultimas.filter((f) => !ksPrimeras.has(f.k)),
  ];

  const puedeVerTodas = filasCompletas.length > filasResumen.length;
  const filasAmort: FilaUI[] = verTodas && puedeVerTodas ? (filasCompletas as FilaUI[]) : filasResumen;
  const nTotal = filasCompletas.length || filasResumen.length;

  const penalizaciones = recomputo?.score.penalizaciones ?? [];
  const alertasCriticas = data.inconsistencias.filter((i) => i.severidad === "critica");


  return (
    <PageLayout>
      <ExecutiveHero
        badge={{ icon: <Brain size={12} />, label: `Motor v${a.motor_version}`, tone: "blue" }}
        title={`Dictamen: ${dictamenLabel[a.dictamen] ?? a.dictamen}`}
        description={`Modalidad ${a.modalidad} · ejecutado ${new Date(a.ejecutado_at).toLocaleString("es-CO")}`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={async () => {
                if (reloading) return;
                setReloading(true);
                try {
                  await doReejecutar({ data: { id } });
                  setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] });
                } finally {
                  setReloading(false);
                }
              }}
              disabled={reloading}
              className="nuvia-input nuvia-input-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: reloading ? "not-allowed" : "pointer", opacity: reloading ? 0.6 : 1 }}
            >
              <RefreshCw size={14} className={reloading ? "animate-spin" : ""} /> {reloading ? "Reejecutando…" : "Reejecutar auditoría"}
            </button>
            <button
              onClick={() => setCopilotoOpen(true)}
              className="nuvia-input nuvia-input-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              <Sparkles size={14} /> Copiloto QA
            </button>
            <button
              onClick={() => exportarDictamenPDF({
                auditoriaId: id,
                modalidad: a.modalidad,
                motorVersion: a.motor_version,
                ejecutadoAt: a.ejecutado_at,
                qaScore: score,
                categoria: a.categoria,
                dictamen: a.dictamen,
                outputs: o,
                inputs: (a as Record<string, unknown>).inputs as { reconstruccion?: Record<string, unknown>; extracto?: Record<string, unknown>; simulacion?: Record<string, unknown> },
                penalizaciones: penalizaciones,
                inconsistencias: data.inconsistencias,
              })}
              className="nuvia-input nuvia-input-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer", background: "var(--nuvia-accent)", color: "#fff", border: "none" }}
            >
              <FileDown size={14} /> Exportar PDF
            </button>
            <Link to="/qa-ai">
              <button className="nuvia-input nuvia-input-sm" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", cursor: "pointer" }}>
                <ArrowLeft size={14} /> Volver
              </button>
            </Link>
          </div>
        }
      />

      {/* HERO DICTAMEN — score + dictamen + KPIs financieros en un solo bloque denso */}
      <section
        className="relative overflow-hidden rounded-[var(--nuvia-radius-lg)]"
        style={{
          background:
            "linear-gradient(135deg, rgba(68,93,163,0.18) 0%, var(--nuvia-bg-secondary) 55%, rgba(132,185,143,0.16) 100%)",
          border: "1px solid var(--nuvia-border)",
          boxShadow: "0 22px 48px -28px rgba(68,93,163,0.6)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(68,93,163,0.55), transparent 60%)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(132,185,143,0.55), transparent 60%)" }} />

        <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_2fr] gap-0">
          <div className="p-5 lg:p-6 lg:border-r" style={{ borderColor: "var(--nuvia-border)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: "var(--nuvia-text-muted)" }}>
              QA Score · NUVIA
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="text-6xl font-bold tabular-nums leading-none" style={{ color: scoreColor }}>
                {score.toFixed(1)}
              </p>
              <span className="text-base opacity-50">/ 100</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ background: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}55` }}>
                {a.categoria}
              </span>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ background: `${dictColor}22`, color: dictColor, border: `1px solid ${dictColor}55` }}>
                {dictamenLabel[a.dictamen] ?? a.dictamen}
              </span>
            </div>
            <div className="mt-4 h-1.5 w-full rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: `linear-gradient(90deg, var(--nuvia-accent), ${scoreColor})` }} />
            </div>
          </div>

          <div className="p-5 lg:p-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] mb-3" style={{ color: "var(--nuvia-text-muted)" }}>
              Visión financiera del crédito
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: isUvr ? "Cuota sin subsidio" : "Cuota teórica", value: `$${fmt(o.cuotaTeorica as number, 0)}`, icon: <Calculator size={13} />, tone: "var(--nuvia-accent)" },
                { label: "Cuota total c/seguros", value: `$${fmt(o.cuotaTotalConSeguros as number, 0)}`, icon: <Coins size={13} />, tone: "var(--nuvia-accent)" },
                ...(reconMeta.hasFrech ? [{ label: "Beneficio FRECH/mes", value: `$${fmt(o.beneficioMensualFrech as number, 0)}`, icon: <Gauge size={13} />, tone: "var(--nuvia-accent-green)" }] : []),
                { label: "Veces pagado", value: (o.vecesPagado as number ?? 0).toFixed(2), icon: <Gauge size={13} />, tone: "var(--nuvia-warning)" },
                { label: "Costo total proyectado", value: `$${fmt(o.costoTotal as number, 0)}`, icon: <Coins size={13} />, tone: "var(--nuvia-accent)" },
                { label: "Total intereses", value: `$${fmt(o.totalIntereses as number, 0)}`, icon: <Coins size={13} />, tone: "var(--nuvia-warning)" },
                ...(isUvr ? [{ label: "Corrección UVR", value: `$${fmt(o.totalCorreccionUvr as number, 0)}`, icon: <Gauge size={13} />, tone: "var(--nuvia-warning)" }] : []),
              ].map((k, i) => (
                <div key={i} className="relative rounded-xl p-3"
                  style={{ background: "rgba(0,0,0,0.22)", border: "1px solid var(--nuvia-border)" }}>
                  <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--nuvia-text-muted)" }}>
                    <span style={{ color: k.tone }}>{k.icon}</span>
                    {k.label}
                  </div>
                  <p className="mt-1.5 text-lg font-bold tabular-nums leading-tight" style={{ color: "var(--nuvia-text-primary)" }}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mensaje motivacional personalizado de NUVIA al analista */}
      <MotivacionNuvia seed={id} />

      <VeredictoBlock
        veredicto={
          (recomputo?.veredicto ?? (o.veredicto as unknown as Veredicto | undefined)) as Veredicto | undefined
        }
      />



      {typeof a.expediente_id === "string" ? (() => {
        const banco =
          (((a as Record<string, unknown>).inputs as Record<string, unknown> | undefined)?.extracto as Record<string, unknown> | undefined)?.banco as string | undefined ?? "";
        const aplicaCierre = bancoGeneraProyeccionesCierre(banco);
        const motivo = !aplicaCierre ? motivoSinProyecciones(banco) : null;
        const expId = a.expediente_id;
        return (
          <>
            <ProyeccionesDropzone
              expedienteId={expId}
              variant="qa"
              momento="auditoria"
              onReauditoria={async () => {
                setReloading(true);
                try { setData(await fetchAud({ data: { id } }) as { auditoria: Record<string, unknown> | null; inconsistencias: Inc[] }); }
                finally { setReloading(false); }
              }}
            />
            {aplicaCierre ? (
              <>
                <ProyeccionesDropzone
                  expedienteId={expId}
                  variant="qa"
                  momento="cierre"
                />
                <VerificacionCierreBlock expedienteId={expId} bancoHint={banco} variant="qa" />
              </>
            ) : banco ? (
              <NCard>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>
                  Verificación de cierre
                </p>
                <p className="text-[13px]" style={{ color: "var(--nuvia-text-primary)" }}>
                  {motivo ?? "Este banco no emite proyecciones formales al cierre. NUVIA verificará contra el próximo extracto post-ejecución."}
                </p>
              </NCard>
            ) : null}
          </>
        );
      })() : (
        <NCard>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--nuvia-text-secondary)" }}>
            Proyecciones del banco
          </p>
          <p className="text-[13px]" style={{ color: "var(--nuvia-text-primary)" }}>
            El cargue de proyecciones (ZIP / PDF / Excel / imágenes) está disponible cuando la auditoría está vinculada a un expediente.
            Esta auditoría es una simulación independiente. Para subir proyecciones, ábrela desde el módulo Expediente del caso o ejecuta la auditoría desde un expediente.
          </p>
        </NCard>
      )}



      {/* PANEL: Penalizaciones aplicadas */}
      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader
            title="Penalizaciones aplicadas al QA Score"
            description="Desglose determinístico: qué penalizó, cuánto y por qué. Score = 100 − Σ penalizaciones."
            icon={<Minus size={16} />}
          />
        </div>
        {penalizaciones.length === 0 ? (
          <div className="px-5 pb-5 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
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
      </NCard>

      {/* PANEL: Alertas críticas */}
      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader
            title={`Alertas críticas (${alertasCriticas.length})`}
            description="Hallazgos de severidad crítica que disparan dictamen RECHAZADO automático."
            icon={<ShieldAlert size={16} />}
          />
        </div>
        {alertasCriticas.length === 0 ? (
          <div className="px-5 pb-5 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
            <CheckCircle2 size={16} /> Sin alertas críticas.
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-2">
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
      </NCard>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }}>
          <SectionHeader title={`Inconsistencias (${data.inconsistencias.length})`} description="Extracto vs reconstrucción · simulación analista vs motor NUVIA." />
        </div>
        {data.inconsistencias.length === 0 ? (
          <div className="px-5 pb-5 flex items-center gap-2 text-sm" style={{ color: "var(--nuvia-success)" }}>
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
                {data.inconsistencias.map((i) => (
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
      </NCard>

      {/* PANEL: Fórmulas aplicadas */}
      <NCard>
        <SectionHeader
          title="Fórmulas aplicadas por el motor"
          description="Modelo matemático determinístico — sin IA, sin estimaciones."
          icon={<Sigma size={16} />}
        />
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
      </NCard>

      <NCard padding="none">
        <div style={{ padding: "16px 20px 12px" }} className="flex items-start justify-between gap-3 flex-wrap">
          <SectionHeader
            title={`Reconstrucción matemática (${filasAmort.length} de ${nTotal} filas)`}
            description={
              verTodas && puedeVerTodas
                ? `Plan amortizado completo — ${nTotal} cuotas pendientes. Incluye capital, interés y seguros${reconMeta.hasFrech ? " · tasa FRECH aplicada" : ""}.`
                : `Plan amortizado: primeras 12 + últimas 12. Incluye capital, interés y seguros${reconMeta.hasFrech ? " · tasa FRECH aplicada" : ""}.`
            }
          />
          {puedeVerTodas && (
            <button
              onClick={() => setVerTodas((v) => !v)}
              className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition hover:opacity-90"
              style={{
                borderColor: "var(--nuvia-border)",
                background: verTodas ? "var(--nuvia-accent)" : "rgba(255,255,255,0.04)",
                color: verTodas ? "#0B1220" : "var(--nuvia-text-primary)",
              }}
            >
              {verTodas ? `Ver resumen (${filasResumen.length})` : `Ver todas (${nTotal})`}
            </button>
          )}
        </div>
        <div style={{ padding: "0 20px 12px" }} className="flex flex-wrap gap-2 text-[11px]">
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
              {reconMeta.cob > 0 && (
                <span className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
                  Tasa con FRECH: <b style={{ color: "var(--nuvia-text-primary)" }}>{reconMeta.tasaAplicada.toFixed(2)}%</b> EA
                </span>
              )}
              <span className="rounded-md px-2 py-1" style={{ background: "rgba(132,185,143,0.10)", border: "1px solid rgba(132,185,143,0.35)", color: "var(--nuvia-success)" }}>
                Cobertura restante: <b>{reconMeta.frechRestantes}</b> / {reconMeta.frechMax} cuotas
              </span>
            </>
          )}
          <span className="rounded-md px-2 py-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--nuvia-border)", color: "var(--nuvia-text-secondary)" }}>
            Seguros mensuales: <b style={{ color: "var(--nuvia-text-primary)" }}>${fmt(reconMeta.seguros, 0)}</b>
          </span>
        </div>

        <div className="overflow-x-auto">
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
      </NCard>


      <CopilotoQADrawer open={copilotoOpen} onClose={() => setCopilotoOpen(false)} auditoriaId={id} />
    </PageLayout>
  );
}
