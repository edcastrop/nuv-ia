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

  const { data: peek } = useQuery<QuickPeekData>({
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

  const saldo = peek?.saldoCapital ?? 0;
  const cuotaActual = peek?.cuotaActual ?? 0;
  const cuotaProp = peek?.cuotaPropuesta ?? 0;
  const cuotasPend = peek?.cuotasPendientes ?? 0;
  const cuotasPendProp = peek?.cuotasPendientesProp ?? 0;
  const tasaActual = peek?.tasaActualPct ?? null;
  const ahorro = peek?.ahorro ?? 0;
  const audit = peek?.auditPct;

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
        aria-label={`Resumen de ${expediente.cliente_nombre}`}
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
            <h2 className="mt-0.5 truncate text-lg font-semibold">{expediente.cliente_nombre}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--nuvia-text-secondary)]">
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <IdCard className="h-3 w-3" /> {expediente.cedula ?? "s/cédula"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <Building2 className="h-3 w-3" /> {expediente.banco ?? "—"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--nuvia-border)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5">
                <Hash className="h-3 w-3" /> {expediente.numero_credito ?? "—"}
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
