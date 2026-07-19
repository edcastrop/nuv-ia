import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, ShieldQuestion, Wrench } from "lucide-react";
import { reconstruir } from "@/lib/reconstructor/engine";
import type {
  Clasificacion,
  Confianza,
  Moneda,
  ReconstructorInput,
  ReconstructorOutput,
  TipoCredito,
} from "@/lib/reconstructor/types";
import { NUVEX } from "@/components/nuvex/constants";
import { LabDropzone } from "@/components/herramientas/lab/LabDropzone";
import { LabExtractoTab } from "@/components/herramientas/lab/LabExtractoTab";
import { LabVariablesTab } from "@/components/herramientas/lab/LabVariablesTab";
import { LabReconstruccionTab } from "@/components/herramientas/lab/LabReconstruccionTab";
import { LabAuditoriaTab } from "@/components/herramientas/lab/LabAuditoriaTab";
import { LabDiagnosticoTab } from "@/components/herramientas/lab/LabDiagnosticoTab";
import { normalizarExtracto, runLab } from "@/lib/reconstructor/lab/pipeline";
import { clasificarVariables } from "@/lib/reconstructor/lab/clasificador";
import type { ExtractoLabInput, VariableDetectada } from "@/lib/reconstructor/lab/types";
import type { ExtractoData } from "@/lib/extracto.functions";

// ─────────────────────────────────────────────────────────────
// UI del Reconstructor Financiero NUVIA.
// Sin persistencia · sin PII · sin datos identificables del cliente.
// La UI sólo captura, valida y presenta; toda la matemática vive en el motor.
// ─────────────────────────────────────────────────────────────

interface Draft {
  moneda: Moneda;
  tipoCredito: TipoCredito;
  saldoCapitalPesos: string;
  saldoCapitalUVR: string;
  valorUVR: string;
  cuotaTotal: string;
  cuotaFinancieraReportada: string;
  seguros: string;
  seguros_min: string;
  seguros_max: string;
  frech: string;
  frech_min: string;
  frech_max: string;
  otrosCargos: string;
  otrosCargos_min: string;
  otrosCargos_max: string;
  mora: string;
  interesesMora: string;
  administracion: string;
  opcionAdquisicion: string;
  cargosDesconocidos: string;
  tea: string;
  tem: string;
  cuotasPendientes: string;
  plazoOriginal: string;
  plazoReportado: string;
  abonoExtraordinarioReciente: boolean;
}

const DRAFT_INICIAL: Draft = {
  moneda: "PESOS",
  tipoCredito: "HIPOTECARIO",
  saldoCapitalPesos: "",
  saldoCapitalUVR: "",
  valorUVR: "",
  cuotaTotal: "",
  cuotaFinancieraReportada: "",
  seguros: "",
  seguros_min: "",
  seguros_max: "",
  frech: "",
  frech_min: "",
  frech_max: "",
  otrosCargos: "",
  otrosCargos_min: "",
  otrosCargos_max: "",
  mora: "",
  interesesMora: "",
  administracion: "",
  opcionAdquisicion: "",
  cargosDesconocidos: "",
  tea: "",
  tem: "",
  cuotasPendientes: "",
  plazoOriginal: "",
  plazoReportado: "",
  abonoExtraordinarioReciente: false,
};

const parseNum = (s: string): number | undefined => {
  if (!s || !s.trim()) return undefined;
  const cleaned = s.replace(/[.\s$]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};
const parseInt10 = (s: string): number | undefined => {
  const n = parseNum(s);
  if (n === undefined) return undefined;
  return Math.trunc(n);
};

function draftToInput(d: Draft): ReconstructorInput {
  return {
    moneda: d.moneda,
    tipoCredito: d.tipoCredito,
    saldoCapitalPesos: parseNum(d.saldoCapitalPesos),
    saldoCapitalUVR: parseNum(d.saldoCapitalUVR),
    valorUVR: parseNum(d.valorUVR),
    cuotaTotal: parseNum(d.cuotaTotal),
    cuotaFinancieraReportada: parseNum(d.cuotaFinancieraReportada),
    seguros: parseNum(d.seguros),
    seguros_min: parseNum(d.seguros_min),
    seguros_max: parseNum(d.seguros_max),
    frech: parseNum(d.frech),
    frech_min: parseNum(d.frech_min),
    frech_max: parseNum(d.frech_max),
    otrosCargos: parseNum(d.otrosCargos),
    otrosCargos_min: parseNum(d.otrosCargos_min),
    otrosCargos_max: parseNum(d.otrosCargos_max),
    mora: parseNum(d.mora),
    interesesMora: parseNum(d.interesesMora),
    administracion: parseNum(d.administracion),
    opcionAdquisicion: parseNum(d.opcionAdquisicion),
    cargosDesconocidos: parseNum(d.cargosDesconocidos),
    tea: parseNum(d.tea),
    tem: parseNum(d.tem),
    cuotasPendientes: parseInt10(d.cuotasPendientes),
    plazoOriginal: parseInt10(d.plazoOriginal),
    plazoReportado: parseInt10(d.plazoReportado),
    abonoExtraordinarioReciente: d.abonoExtraordinarioReciente,
  };
}

const fmtMoney = (n: number, moneda: Moneda) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: moneda === "UVR" ? "COP" : "COP",
    maximumFractionDigits: moneda === "UVR" ? 4 : 0,
  }).format(n);
const fmtNum = (n: number, dec = 4) =>
  new Intl.NumberFormat("es-CO", { maximumFractionDigits: dec }).format(n);
const fmtPct = (n: number, dec = 2) => `${(n * 100).toFixed(dec)} %`;

export function ReconstructorFinancieroTool() {
  const [mode, setMode] = useState<"manual" | "lab">("manual");
  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Modo del Reconstructor"
        className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl"
      >
        {(["manual", "lab"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={mode === k}
            onClick={() => setMode(k)}
            className={`rounded-xl px-4 py-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] transition ${
              mode === k
                ? "bg-white/10 text-white"
                : "text-white/60 hover:text-white"
            }`}
          >
            {k === "manual" ? "Manual" : "Laboratorio"}
          </button>
        ))}
      </div>
      {mode === "manual" ? <ManualView /> : <LabView />}
    </div>
  );
}

function ManualView() {
  const [draft, setDraft] = useState<Draft>(DRAFT_INICIAL);
  const [result, setResult] = useState<ReconstructorOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const onCalcular = () => {
    setError(null);
    try {
      const input = draftToInput(draft);
      const r = reconstruir(input);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado al reconstruir.");
      setResult(null);
    }
  };

  const onReset = () => {
    setDraft(DRAFT_INICIAL);
    setResult(null);
    setError(null);
  };

  const noPII = useMemo(
    () =>
      "La herramienta no solicita nombre, cédula, número de crédito, teléfono ni correo. Todo se procesa en tu navegador.",
    [],
  );

  return (
    <div className="space-y-6">
      {/* Aviso PII */}
      <div
        className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-[12.5px] text-white/70 backdrop-blur-xl"
        style={{ boxShadow: `0 10px 40px -20px ${NUVEX.azul}` }}
      >
        <ShieldQuestion className="mt-0.5 h-4 w-4 shrink-0 text-[#84B98F]" />
        <span>{noPII}</span>
      </div>

      {/* Contexto */}
      <Section title="Contexto del crédito">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Moneda">
            <SelectDark
              value={draft.moneda}
              onChange={(v) => set("moneda", v as Moneda)}
              options={[
                { value: "PESOS", label: "Pesos" },
                { value: "UVR", label: "UVR" },
              ]}
            />
          </Field>
          <Field label="Tipo de crédito">
            <SelectDark
              value={draft.tipoCredito}
              onChange={(v) => set("tipoCredito", v as TipoCredito)}
              options={[
                { value: "HIPOTECARIO", label: "Hipotecario" },
                { value: "LEASING", label: "Leasing habitacional" },
              ]}
            />
          </Field>
        </div>
      </Section>

      {/* Saldos */}
      <Section title="Saldos y unidades">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Saldo capital en pesos" hint="Del extracto">
            <InputDark value={draft.saldoCapitalPesos} onChange={(v) => set("saldoCapitalPesos", v)} placeholder="0" />
          </Field>
          {draft.moneda === "UVR" && (
            <>
              <Field label="Saldo capital en UVR">
                <InputDark value={draft.saldoCapitalUVR} onChange={(v) => set("saldoCapitalUVR", v)} placeholder="0.0000" />
              </Field>
              <Field label="Valor UVR (día del corte)">
                <InputDark value={draft.valorUVR} onChange={(v) => set("valorUVR", v)} placeholder="0.0000" />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* Cuota */}
      <Section title="Cuota facturada">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Cuota total (facturada)">
            <InputDark value={draft.cuotaTotal} onChange={(v) => set("cuotaTotal", v)} placeholder="0" />
          </Field>
          <Field label="Cuota financiera reportada (opcional)">
            <InputDark
              value={draft.cuotaFinancieraReportada}
              onChange={(v) => set("cuotaFinancieraReportada", v)}
              placeholder="0"
            />
          </Field>
          <Field label="Cuotas pendientes">
            <InputDark value={draft.cuotasPendientes} onChange={(v) => set("cuotasPendientes", v)} placeholder="0" />
          </Field>
        </div>

        {/* Desglose y rangos */}
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <RangoTriple label="Seguros" v={draft.seguros} vmin={draft.seguros_min} vmax={draft.seguros_max}
            onV={(v) => set("seguros", v)} onMin={(v) => set("seguros_min", v)} onMax={(v) => set("seguros_max", v)} />
          <RangoTriple label="FRECH (subsidio)" v={draft.frech} vmin={draft.frech_min} vmax={draft.frech_max}
            onV={(v) => set("frech", v)} onMin={(v) => set("frech_min", v)} onMax={(v) => set("frech_max", v)} />
          <RangoTriple label="Otros cargos" v={draft.otrosCargos} vmin={draft.otrosCargos_min} vmax={draft.otrosCargos_max}
            onV={(v) => set("otrosCargos", v)} onMin={(v) => set("otrosCargos_min", v)} onMax={(v) => set("otrosCargos_max", v)} />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Mora"><InputDark value={draft.mora} onChange={(v) => set("mora", v)} placeholder="0" /></Field>
          <Field label="Intereses de mora"><InputDark value={draft.interesesMora} onChange={(v) => set("interesesMora", v)} placeholder="0" /></Field>
          <Field label="Administración"><InputDark value={draft.administracion} onChange={(v) => set("administracion", v)} placeholder="0" /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Opción de adquisición (leasing, se excluye)">
            <InputDark value={draft.opcionAdquisicion} onChange={(v) => set("opcionAdquisicion", v)} placeholder="0" />
          </Field>
          <Field label="Cargos desconocidos">
            <InputDark value={draft.cargosDesconocidos} onChange={(v) => set("cargosDesconocidos", v)} placeholder="0" />
          </Field>
        </div>
      </Section>

      {/* Tasa y plazo */}
      <Section title="Tasa y plazo">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="TEA (%)"><InputDark value={draft.tea} onChange={(v) => set("tea", v)} placeholder="12.5" /></Field>
          <Field label="TEM (%) mensual"><InputDark value={draft.tem} onChange={(v) => set("tem", v)} placeholder="0.9871" /></Field>
          <Field label="Plazo original"><InputDark value={draft.plazoOriginal} onChange={(v) => set("plazoOriginal", v)} placeholder="240" /></Field>
          <Field label="Plazo reportado"><InputDark value={draft.plazoReportado} onChange={(v) => set("plazoReportado", v)} placeholder="180" /></Field>
        </div>
        <label className="mt-4 inline-flex items-center gap-2 text-[13px] text-white/70">
          <input
            type="checkbox"
            checked={draft.abonoExtraordinarioReciente}
            onChange={(e) => set("abonoExtraordinarioReciente", e.target.checked)}
          />
          Hubo un abono extraordinario reciente
        </label>
      </Section>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onCalcular}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-95"
          style={{ background: `linear-gradient(135deg, ${NUVEX.azul}, ${NUVEX.verde})` }}
        >
          <Wrench className="h-4 w-4" /> Reconstruir
        </button>
        <button
          onClick={onReset}
          className="rounded-full border border-white/15 px-4 py-2.5 text-[13px] text-white/80 hover:bg-white/[0.05]"
        >
          Limpiar
        </button>
        {error && (
          <span className="text-[12.5px] text-red-300">
            <AlertTriangle className="inline h-3.5 w-3.5" /> {error}
          </span>
        )}
      </div>

      {/* Resultados */}
      {result && <Resultados result={result} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Presentación
// ─────────────────────────────────────────────────────────────

function Resultados({ result }: { result: ReconstructorOutput }) {
  const { moneda } = result;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <DiagnosticoCard result={result} />

      <Section title="Cuota financiera reconstruida">
        <div className="grid gap-4 md:grid-cols-3">
          <Kpi label="Cuota financiera reconstruida" value={
            result.cuotaNormalizada.cuotaFinancieraCalculada !== null
              ? fmtMoney(result.cuotaNormalizada.cuotaFinancieraCalculada, "PESOS")
              : "—"
          } />
          <Kpi label="Cuota financiera reportada" value={
            result.cuotaNormalizada.cuotaFinancieraReportada !== null
              ? fmtMoney(result.cuotaNormalizada.cuotaFinancieraReportada, "PESOS")
              : "No reportada"
          } />
          <Kpi label="Diferencia" value={
            result.cuotaNormalizada.diferenciaPct !== null
              ? `${fmtMoney(result.cuotaNormalizada.diferenciaAbs ?? 0, "PESOS")} (${fmtPct(result.cuotaNormalizada.diferenciaPct)})`
              : "—"
          } />
        </div>
        {result.cuotaNormalizada.alertas.length > 0 && (
          <ul className="mt-3 space-y-1 text-[12px] text-amber-300">
            {result.cuotaNormalizada.alertas.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Tasa reconstruida">
        <div className="grid gap-4 md:grid-cols-3">
          <ResultadoBlock label="TEM" res={result.tem} suffix="/mes" pct />
          <ResultadoBlock label="TEA" res={result.tea} suffix="%" />
          <Kpi label="Bisección" value={
            result.tem.motivos.join(" · ")
          } />
        </div>
      </Section>

      <Section title="Saldo y plazo">
        <div className="grid gap-4 md:grid-cols-3">
          <Kpi label="Saldo reconstruido" value={
            result.saldoReconstruido.valor !== null
              ? fmtNum(result.saldoReconstruido.valor, moneda === "UVR" ? 4 : 0)
              : "—"
          } />
          <Kpi label="Saldo reportado" value={
            result.saldoReportado !== null
              ? fmtNum(result.saldoReportado, moneda === "UVR" ? 4 : 0)
              : "—"
          } />
          <Kpi label="Diferencia" value={
            result.diferenciaSaldoPct !== null
              ? fmtPct(result.diferenciaSaldoPct)
              : "—"
          } />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <Kpi label="Plazo matemático" value={
            result.plazo.matematico.valor !== null
              ? fmtNum(result.plazo.matematico.valor, 3)
              : "—"
          } />
          <Kpi label="Plazo matemático redondeado" value={
            result.plazo.matematicoRedondeado.valor !== null
              ? String(result.plazo.matematicoRedondeado.valor)
              : "—"
          } />
          <Kpi label="Plazo operacional NUVEX" value={
            result.plazo.operacionalNuvex.valor !== null
              ? String(result.plazo.operacionalNuvex.valor)
              : "—"
          } sub="Solo visualización" />
        </div>
      </Section>

      {result.uvr && (
        <Section title="Coherencia UVR">
          <div className="grid gap-4 md:grid-cols-3">
            <Kpi label="Valor UVR reportado" value={result.uvr.valorReportado !== null ? fmtNum(result.uvr.valorReportado, 4) : "—"} />
            <Kpi label="Producto reconstruido" value={result.uvr.productoReconstruido !== null ? fmtMoney(result.uvr.productoReconstruido, "PESOS") : "—"} />
            <Kpi label="Diferencia" value={result.uvr.diferenciaPct !== null ? fmtPct(result.uvr.diferenciaPct) : "—"} />
          </div>
          <p className="mt-3 text-[12.5px] text-white/60">{result.uvr.motivo}</p>
        </Section>
      )}

      {result.rangos.length > 0 && (
        <Section title="Rangos operativos (ESTIMADO · confianza máxima MEDIA)">
          <div className="grid gap-3 md:grid-cols-2">
            {result.rangos.map((r, i) => (
              <div
                key={i}
                className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-amber-300">
                  {r.variable} · ESTIMADO
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-[13px] text-white/90">
                  <div>
                    <div className="text-[10px] uppercase text-white/40">Mín</div>
                    {fmtMoney(r.minimo, "PESOS")}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/40">Central*</div>
                    {fmtMoney(r.central, "PESOS")}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/40">Máx</div>
                    {fmtMoney(r.maximo, "PESOS")}
                  </div>
                </div>
                <ul className="mt-2 space-y-1 text-[11.5px] text-white/60">
                  {r.supuestos.map((s, j) => (
                    <li key={j}>• {s}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] italic text-white/45">
                  * El valor central es referencial. Nunca debe presentarse como resultado exacto.
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="Datos utilizados y faltantes">
        <div className="grid gap-4 md:grid-cols-2">
          <Kpi label="Datos utilizados" value={result.datosUsados.join(", ") || "—"} />
          <Kpi label="Datos faltantes" value={result.datosFaltantes.join(", ") || "—"} />
        </div>
      </Section>
    </motion.div>
  );
}

function DiagnosticoCard({ result }: { result: ReconstructorOutput }) {
  const { diagnostico, observaciones } = result.auditoria;
  const color =
    diagnostico === "CREDITO_COHERENTE"
      ? "#84B98F"
      : diagnostico === "COHERENTE_CON_OBSERVACIONES"
        ? "#7B61FF"
        : diagnostico === "INCONSISTENCIA_MODERADA"
          ? "#e0a458"
          : diagnostico === "INCONSISTENCIA_CRITICA"
            ? "#ef4444"
            : "#6b7280";
  const Icon =
    diagnostico === "CREDITO_COHERENTE"
      ? CheckCircle2
      : diagnostico === "INFORMACION_INSUFICIENTE"
        ? Info
        : AlertTriangle;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-5 backdrop-blur-xl"
      style={{
        borderColor: `${color}44`,
        background: `linear-gradient(135deg, ${color}18, rgba(255,255,255,0.02))`,
      }}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" style={{ color }} />
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color }}>
          Diagnóstico
        </div>
      </div>
      <div className="mt-1 text-xl font-semibold text-white">{diagnostico.replace(/_/g, " ")}</div>
      <div className="mt-2 text-[12.5px] text-white/60">
        Clasificación global: <b>{result.clasificacionGlobal}</b> · Confianza global:{" "}
        <b>{result.confianzaGlobal}</b>
      </div>
      {observaciones.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12.5px]">
          {observaciones.map((o, i) => (
            <li
              key={i}
              className={
                o.severidad === "critico"
                  ? "text-red-300"
                  : o.severidad === "aviso"
                    ? "text-amber-300"
                    : "text-white/70"
              }
            >
              • {o.mensaje}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultadoBlock({
  label,
  res,
  suffix,
  pct,
}: {
  label: string;
  res: { valor: number | null; clasificacion: Clasificacion; confianza: Confianza; formula: string };
  suffix?: string;
  pct?: boolean;
}) {
  const value =
    res.valor === null
      ? "—"
      : pct
        ? `${(res.valor * 100).toFixed(4)} ${suffix ?? ""}`
        : `${fmtNum(res.valor, 4)} ${suffix ?? ""}`;
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-white/50">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-[11px] text-white/50">
        {res.clasificacion} · {res.confianza}
      </div>
      {res.formula && <div className="mt-1 text-[10.5px] italic text-white/40">{res.formula}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bloques atómicos
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#84B98F]">
        {title}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11.5px] text-white/70">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[10.5px] text-white/40">{hint}</div>}
    </label>
  );
}

function InputDark({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-[#0a1022] px-3 py-2 text-[13.5px] text-white outline-none transition placeholder:text-white/25 focus:border-[#84B98F]/60"
    />
  );
}

function SelectDark({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-[#0a1022] px-3 py-2 text-[13.5px] text-white outline-none focus:border-[#84B98F]/60"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-[#0a1022] text-white">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RangoTriple({
  label,
  v,
  vmin,
  vmax,
  onV,
  onMin,
  onMax,
}: {
  label: string;
  v: string;
  vmin: string;
  vmax: string;
  onV: (s: string) => void;
  onMin: (s: string) => void;
  onMax: (s: string) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 text-[11.5px] text-white/70">{label}</div>
      <div className="grid grid-cols-3 gap-2">
        <InputDark value={v} onChange={onV} placeholder="Exacto" />
        <InputDark value={vmin} onChange={onMin} placeholder="Mín" />
        <InputDark value={vmax} onChange={onMax} placeholder="Máx" />
      </div>
      <div className="mt-1 text-[10.5px] text-white/40">Deja mín/máx si sólo hay un rango.</div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-white/50">{label}</div>
      <div className="mt-1 text-[15px] font-semibold text-white break-words">{value}</div>
      {sub && <div className="mt-1 text-[10.5px] italic text-white/40">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LABORATORIO FINANCIERO NUVIA (Fase 2) · contenedor con 5 pestañas
// Reutiliza el server fn `extractStatement` sin modificarlo.
// Sin persistencia, sin PII en logs.
// ─────────────────────────────────────────────────────────────

type LabTab = "extracto" | "variables" | "reconstruccion" | "auditoria" | "diagnostico";

function LabView() {
  const [input, setInput] = useState<ExtractoLabInput | null>(null);
  const [variables, setVariables] = useState<VariableDetectada[]>([]);
  const [labError, setLabError] = useState<string | null>(null);
  const [tab, setTab] = useState<LabTab>("extracto");

  const onData = (data: ExtractoData) => {
    setLabError(null);
    const norm = normalizarExtracto(data as unknown as Record<string, unknown>);
    setInput(norm);
    // Clasificación inicial usada como estado editable
    const { clasificarVariables } = require("@/lib/reconstructor/lab/clasificador") as typeof import("@/lib/reconstructor/lab/clasificador");
    const { variables: vs } = clasificarVariables(norm);
    setVariables(vs);
    setTab("variables");
  };

  const onReset = () => {
    setInput(null);
    setVariables([]);
    setLabError(null);
    setTab("extracto");
  };

  const toggleExcluir = (id: string) =>
    setVariables((prev) => prev.map((v) => (v.id === id ? { ...v, excluida: !v.excluida } : v)));

  const editarValor = (id: string, nuevo: number | null) =>
    setVariables((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, valor: nuevo, fuente: "CORREGIDA_ANALISTA", confianzaExtraccion: "ALTA" } : v,
      ),
    );

  const activasFiltradas = variables.filter((v) => !v.excluida);
  const lab = input ? runLab({ ...input }, activasFiltradas) : null;

  return (
    <div className="space-y-4">
      <LabDropzone onData={onData} onError={setLabError} onReset={onReset} />

      {labError && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-[12.5px] text-red-200">
          {labError}
        </div>
      )}

      {input && (
        <>
          <div
            role="tablist"
            aria-label="Pestañas del Laboratorio"
            className="flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1"
          >
            {(
              [
                ["extracto", "Extracto"],
                ["variables", "Variables"],
                ["reconstruccion", "Reconstrucción"],
                ["auditoria", "Auditoría"],
                ["diagnostico", "Diagnóstico"],
              ] as [LabTab, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`rounded-xl px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] transition ${
                  tab === k ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            {tab === "extracto" && <LabExtractoTab input={input} />}
            {tab === "variables" && (
              <LabVariablesTab
                variables={variables}
                onToggleExcluir={toggleExcluir}
                onEditarValor={editarValor}
              />
            )}
            {tab === "reconstruccion" && lab && (
              <LabReconstruccionTab
                faltantes={lab.faltantes}
                reconstrucciones={lab.reconstrucciones}
                hipotesis={lab.hipotesis}
                identificabilidad={lab.identificabilidad}
              />
            )}
            {tab === "auditoria" && lab && <LabAuditoriaTab coherencia={lab.coherencia} />}
            {tab === "diagnostico" && lab && <LabDiagnosticoTab diagnostico={lab.diagnostico} />}
          </div>
        </>
      )}
    </div>
  );
}
