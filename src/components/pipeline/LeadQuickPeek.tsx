// Popover lateral compacto con resumen del lead. Se abre desde el ícono de ojo.
import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { X, Building2, IdCard, Hash, Flag, Clock, User2, ExternalLink, Pencil, TrendingUp } from "lucide-react";
import type { Expediente } from "@/lib/expedientes";
import { AnalistaAvatar } from "./AnalistaAvatar";

type AnalistaInfo = { id: string; nombre: string | null; email: string | null };

function fmtCOP(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v) || v === 0) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
}

function readNumeric(obj: unknown, ...keys: string[]): number {
  if (!obj || typeof obj !== "object") return 0;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const raw = o[k];
    if (raw == null) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string") {
      const cleaned = raw.replace(/[^\d.-]/g, "");
      const n = Number(cleaned);
      if (Number.isFinite(n) && n !== 0) return n;
    }
  }
  return 0;
}

function readString(obj: unknown, ...keys: string[]): string {
  if (!obj || typeof obj !== "object") return "";
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const raw = o[k];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (typeof raw === "number") return String(raw);
  }
  return "";
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monto = readNumeric(expediente.credito_data, "saldo", "saldoCapital", "monto", "valorCredito");
  const plazo = readNumeric(expediente.credito_data, "plazo", "plazoMeses", "plazo_meses");
  const tasa = readString(expediente.credito_data, "tasa", "tasaEA", "tasa_ea");
  const cuotaActual = readNumeric(expediente.credito_data, "cuota", "cuotaActual", "valorCuota");

  const propuesta = expediente.propuesta_data as Record<string, unknown> | undefined;
  const cuotaPropuesta = readNumeric(propuesta, "cuota", "cuotaNueva", "valorCuota");
  const ahorro = readNumeric(propuesta, "ahorro", "ahorroTotal", "ahorroIntereses");

  const ingresos = readNumeric(expediente.cliente_data as unknown, "ingresosTotales", "ingresos_totales");
  const pctEnd = ingresos > 0 && cuotaPropuesta > 0 ? Math.round((cuotaPropuesta / ingresos) * 100) : 0;

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
        className="fixed right-0 top-0 z-[81] h-full w-full max-w-[420px] overflow-y-auto border-l border-[var(--nuvia-border)] p-5 text-[var(--nuvia-text-primary)] shadow-2xl"
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

        {/* Datos clave */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Saldo crédito" value={fmtCOP(monto)} />
          <Tile label="Plazo" value={plazo > 0 ? `${plazo} m` : "—"} />
          <Tile label="Cuota actual" value={fmtCOP(cuotaActual)} />
          <Tile label="Cuota propuesta" value={fmtCOP(cuotaPropuesta)} accent />
          <Tile label="Tasa" value={tasa || "—"} />
          <Tile
            label="% Endeudamiento"
            value={pctEnd > 0 ? `${pctEnd}%` : "—"}
            danger={pctEnd > 40}
            warn={pctEnd > 30 && pctEnd <= 40}
          />
        </div>

        {ahorro > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--nuvia-accent-green)_30%,transparent)] bg-[color-mix(in_oklab,var(--nuvia-accent-green)_8%,transparent)] p-3">
            <TrendingUp className="h-4 w-4 text-[var(--nuvia-accent-green)]" />
            <div className="text-xs">
              <div className="text-[var(--nuvia-text-secondary)]">Ahorro proyectado</div>
              <div className="text-sm font-semibold text-[var(--nuvia-accent-green)]">{fmtCOP(ahorro)}</div>
            </div>
          </div>
        )}

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
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Tile label="Honorarios base" value={fmtCOP(expediente.honorarios_base)} />
          <Tile label="Honorarios final" value={fmtCOP(expediente.honorarios_final)} accent />
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
