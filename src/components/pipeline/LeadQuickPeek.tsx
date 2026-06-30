// Popover lateral compacto con resumen del lead. Se abre desde el ícono de ojo.
// Hidrata datos reales (proyecciones, cuotas pendientes, % auditoría) vía server fn.
import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Building2,
  IdCard,
  Hash,
  Flag,
  Clock,
  User2,
  ExternalLink,
  Pencil,
  TrendingUp,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import type { Expediente } from "@/lib/expedientes";
import { AnalistaAvatar } from "./AnalistaAvatar";
import { getQuickPeekData, type QuickPeekData } from "@/lib/pipelineQuickPeek.functions";

type AnalistaInfo = { id: string; nombre: string | null; email: string | null };

function fmtCOP(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "—";
  return `${n.toFixed(digits)} %`;
}

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    let s = v.trim().replace(/[^\d,.-]/g, "");
    if (!s) return 0;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    if (hasComma && hasDot) {
      s = s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
    } else if (hasComma) {
      s = s.replace(",", ".");
    } else if ((s.match(/\./g) ?? []).length > 1) {
      s = s.replace(/\./g, "");
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function readN(obj: unknown, ...keys: string[]): number {
  const o = record(obj);
  for (const k of keys) {
    const v = num(o[k]);
    if (v !== 0) return v;
  }
  return 0;
}

function text(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  if (!s || s === "—" || /^null$/i.test(s) || /^undefined$/i.test(s)) return "";
  return s;
}

function placeholder(v: unknown): boolean {
  const s = text(v).toLowerCase();
  return !s || s === "sin nombre" || s === "s/cédula" || s === "sin banco";
}

function prefer(current: unknown, ...fallbacks: unknown[]): string {
  if (!placeholder(current)) return text(current);
  for (const v of fallbacks) {
    const s = text(v);
    if (s && !placeholder(s)) return s;
  }
  return text(current);
}

export function LeadQuickPeek({
  expediente,
  analista,
  diasEnEtapa,
  etapaTitulo,
  onClose,
  onEdit,
}: {
  expediente: Expediente;
  analista?: AnalistaInfo | null;
  diasEnEtapa: number;
  etapaTitulo: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fetchPeek = useServerFn(getQuickPeekData);

  const { data: peek, error } = useQuery<QuickPeekData>({
    queryKey: ["quick-peek", expediente.id],
    queryFn: () => fetchPeek({ data: { expedienteId: expediente.id } }),
    staleTime: 30_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const clienteData = record(expediente.cliente_data);
  const creditoData = record(expediente.credito_data);
  const propuestaData = record(expediente.propuesta_data);
  const displayNombre = prefer(expediente.cliente_nombre, peek?.clienteNombre, clienteData.nombre, clienteData.clienteNombre);
  const displayCedula = prefer(expediente.cedula, peek?.cedula, clienteData.cedula, clienteData.identificacion);
  const displayBanco = prefer(expediente.banco, peek?.banco, clienteData.banco);
  const displayNumeroCredito = prefer(expediente.numero_credito, peek?.numeroCredito, clienteData.numeroCredito, clienteData.numero_credito);
  const saldo = peek?.saldoCapital || readN(creditoData, "saldoCapital", "saldo_capital", "saldo", "valorCredito", "valorDesembolsado");
  const cuotaActual = peek?.cuotaActual || readN(creditoData, "cuotaActual", "cuota_actual", "cuota", "cuotaBaseSimulacion", "cuotaPagadaCliente");
  const cuotaProp = peek?.cuotaPropuesta || readN(propuestaData, "nuevaCuota", "cuotaPropuesta", "cuotaNueva", "cuota");
  const cuotasTotalesFallback = readN(creditoData, "cuotasTotales", "cuotas_totales", "plazo", "plazoMeses") || num(clienteData.plazoInicial);
  const cuotasPagadasFallback = readN(creditoData, "cuotasPagadas", "cuotas_pagadas") || num(clienteData.cuotasPagadas);
  const cuotasPend = peek?.cuotasPendientes || readN(creditoData, "cuotasPendientes", "cuotas_pendientes", "cuotasRestantes") || (cuotasTotalesFallback > 0 ? Math.max(0, cuotasTotalesFallback - cuotasPagadasFallback) : 0);
  const cuotasPendProp = peek?.cuotasPendientesProp || readN(propuestaData, "nuevoPlazo", "plazo", "plazoNuevo", "plazoMeses");
  const tasaActual = peek?.tasaActualPct || readN(creditoData, "teaPct", "tea", "tasaEA", "tasaEa", "tasa_ea", "teaPactada") || null;
  const ahorro = peek?.ahorro || readN(propuestaData, "ahorroTotal", "ahorro", "ahorroIntereses");
  const audit = peek?.auditPct ?? expediente.qa_score ?? expediente.acertividad_global;

  const auditColor =
    audit == null
      ? "var(--nuvia-text-secondary)"
      : audit >= 80
        ? "var(--nuvia-accent-green)"
        : audit >= 60
          ? "var(--nuvia-warning)"
          : "var(--nuvia-danger)";

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      {/* popover lateral */}
      <aside
        ref={ref}
        role="dialog"
        aria-label={`Resumen de ${displayNombre || "lead"}`}
        className="fixed right-0 top-0 z-[81] h-full w-full max-w-[440px] overflow-y-auto border-l border-[var(--nuvia-border)] p-5 text-[var(--nuvia-text-primary)] shadow-2xl"
        style={{
          background:
            "linear-gradient(180deg, var(--nuvia-bg-secondary) 0%, var(--nuvia-bg-primary) 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-accent-green)]">
              Quick Peek · NUVIA
            </div>
            <h2 className="mt-0.5 truncate text-lg font-semibold">{displayNombre || "Sin nombre"}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--nuvia-text-secondary)]">
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <IdCard className="h-3 w-3" /> {displayCedula || "s/cédula"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <Building2 className="h-3 w-3" /> {displayBanco || "—"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <Hash className="h-3 w-3" /> {displayNumeroCredito || "—"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] p-1.5 text-[var(--nuvia-text-secondary)] transition hover:text-[var(--nuvia-text-primary)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[color-mix(in_oklab,var(--nuvia-warning)_30%,transparent)] bg-[color-mix(in_oklab,var(--nuvia-warning)_8%,transparent)] p-3 text-[11px] text-[var(--nuvia-text-secondary)]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--nuvia-warning)]" />
            Vista rápida usando datos base del expediente mientras se sincroniza la data enriquecida.
          </div>
        )}

        {/* Etapa actual */}
        <div
          className="mt-4 rounded-xl border p-3"
          style={{
            borderColor: "color-mix(in oklab, var(--nuvia-accent-blue) 30%, transparent)",
            background: "color-mix(in oklab, var(--nuvia-accent-blue) 8%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--nuvia-text-primary)]">
              <Flag className="h-3.5 w-3.5 text-[var(--nuvia-accent-blue)]" /> {etapaTitulo}
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--nuvia-text-secondary)]">
              <Clock className="h-3 w-3" /> {diasEnEtapa}d
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--nuvia-text-secondary)]">
            Estado legacy: <span className="text-[var(--nuvia-text-primary)]">{expediente.estado}</span>
          </div>
        </div>

        {/* % Auditoría */}
        <div
          className="mt-3 rounded-xl border p-3"
          style={{
            borderColor: `color-mix(in oklab, ${auditColor} 30%, transparent)`,
            background: `color-mix(in oklab, ${auditColor} 6%, transparent)`,
          }}
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--nuvia-text-primary)]">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: auditColor }} /> % Auditoría
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: auditColor }}>
              {audit == null ? "—" : `${Math.round(audit)}%`}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full transition-all"
              style={{ width: `${Math.min(100, Math.max(0, audit ?? 0))}%`, background: auditColor }}
            />
          </div>
        </div>

        {/* Saldo + plazo */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Saldo crédito" value={fmtCOP(saldo)} />
          <Tile label="Plazo inicial aprobado" value={peek?.cuotasTotales ? `${peek.cuotasTotales} m` : "—"} />
        </div>

        {/* Cuotas: actual vs proyectada */}
        <SectionTitle>Cuota</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Cuota actual" value={fmtCOP(cuotaActual)} />
          <Tile label="Cuota proyectada" value={fmtCOP(cuotaProp)} accent />
        </div>

        {/* Cuotas pendientes */}
        <SectionTitle>Cuotas pendientes por pagar</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Tile
            label="Actual"
            value={cuotasPend > 0 ? `${cuotasPend} cuotas` : "—"}
          />
          <Tile
            label="Proyectada"
            value={cuotasPendProp > 0 ? `${cuotasPendProp} cuotas` : "—"}
            accent
          />
        </div>

        {/* Tasa actual */}
        <SectionTitle>Tasa EA</SectionTitle>
        <div className="grid grid-cols-1 gap-2">
          <Tile label="Tasa actual" value={fmtPct(tasaActual)} />
        </div>


        {/* Ahorro */}
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--nuvia-accent-green)_30%,transparent)] bg-[color-mix(in_oklab,var(--nuvia-accent-green)_8%,transparent)] p-3">
          <TrendingUp className="h-5 w-5 text-[var(--nuvia-accent-green)]" />
          <div className="text-xs">
            <div className="text-[var(--nuvia-text-secondary)]">Ahorro del lead</div>
            <div className="text-lg font-bold text-[var(--nuvia-accent-green)]">{fmtCOP(ahorro)}</div>
          </div>
        </div>

        {/* Analista */}
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.03)] p-3">
          <AnalistaAvatar nombre={analista?.nombre} email={analista?.email} size={32} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-[var(--nuvia-text-primary)]">
              {analista?.nombre || analista?.email || "Sin asignar"}
            </div>
            <div className="flex items-center gap-1 text-[10px] uppercase text-[var(--nuvia-text-secondary)]">
              <User2 className="h-3 w-3" /> Analista asignado
            </div>
          </div>
        </div>

        {/* Honorarios */}
        <SectionTitle>Honorarios</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Base" value={fmtCOP(expediente.honorarios_base)} />
          <Tile label="Final" value={fmtCOP(expediente.honorarios_final)} accent />
        </div>

        {/* Footer acciones */}
        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.05)] px-3 text-sm font-medium text-[var(--nuvia-text-primary)] transition hover:border-[var(--nuvia-accent-blue)]"
          >
            <Pencil className="h-4 w-4" /> Editar información rápida
          </button>
          <Link
            to="/casos/$id"
            params={{ id: expediente.id }}
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--nuvia-text-primary)] shadow-[var(--nuvia-shadow-sm)] transition hover:brightness-110"
            style={{ background: "var(--nuvia-gradient-primary)" }}
          >
            <ExternalLink className="h-4 w-4" /> Abrir expediente completo
          </Link>
        </div>

        <div className="mt-4 text-[10px] text-[var(--nuvia-text-secondary)]">
          Actualizado {expediente.updated_at ? new Date(expediente.updated_at).toLocaleString("es-CO") : "—"}
        </div>
      </aside>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 mt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--nuvia-text-secondary)]">
      {children}
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
  danger,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
  warn?: boolean;
}) {
  const color = danger
    ? "var(--nuvia-danger)"
    : warn
      ? "var(--nuvia-warning)"
      : accent
        ? "var(--nuvia-accent-green)"
        : "var(--nuvia-text-primary)";
  return (
    <div className="rounded-xl border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.035)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--nuvia-text-secondary)]">{label}</div>
      <div className="mt-1 text-sm font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
