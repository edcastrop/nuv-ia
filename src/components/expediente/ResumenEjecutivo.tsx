// Resumen Ejecutivo del Expediente — vista limpia y rápida.
// Cliente, banco, producto, estado actual, responsable, próxima acción, % avance, bloqueos, SLA.
// NUVIA dark.

import { NCard, SectionHeader } from "@/components/nuvia";
import { CaseSnapshotButton } from "./CaseSnapshotButton";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import {
  etapaActualGuiada,
  ETAPAS_GUIADAS,
  porcentajeAvance,
  getBloqueos,
  diasDesde,
  estadoDeEtapa,
} from "@/lib/expedienteGuiado";
import { roleLabels } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

const ETAPA_TONE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  completado:      { bg: "rgba(132,185,143,0.16)", fg: "#9BCB9F", border: "rgba(132,185,143,0.42)", label: "Completado" },
  en_proceso:      { bg: "rgba(68,93,163,0.20)",  fg: "#A5B5E0", border: "rgba(68,93,163,0.55)",  label: "En proceso" },
  pendiente:       { bg: "rgba(255,255,255,0.05)", fg: "var(--nuvia-text-secondary)", border: "var(--nuvia-border)", label: "Pendiente" },
  bloqueado:       { bg: "rgba(255,107,107,0.16)", fg: "#FF8585", border: "rgba(255,107,107,0.45)", label: "Bloqueado" },
  requiere_accion: { bg: "rgba(246,196,83,0.16)",  fg: "#F6C453", border: "rgba(246,196,83,0.45)",  label: "Requiere acción" },
};

const PILL_OK = { bg: "rgba(132,185,143,0.18)", fg: "#9BCB9F" };
const PILL_BAD = { bg: "rgba(255,107,107,0.18)", fg: "#FF8585" };

export function ResumenEjecutivo({ exp }: { exp: Expediente }) {
  const etapaId = etapaActualGuiada(exp);
  const etapa = ETAPAS_GUIADAS.find((e) => e.id === etapaId)!;
  const pct = porcentajeAvance(exp);
  const bloqueos = getBloqueos(exp);
  const dias = diasDesde(exp.updated_at);
  const slaOk = dias < 5;
  const st = estadoDeEtapa(exp, etapaId);
  const colorSt = ETAPA_TONE[st] ?? ETAPA_TONE.pendiente;

  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Cliente", value: <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{exp.cliente_nombre}</span> },
    { label: "Cédula", value: exp.cedula || "—" },
    { label: "Banco", value: exp.banco || "—" },
    { label: "Producto", value: exp.producto || "—" },
    { label: "Modo", value: <span className="uppercase font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{exp.modo}</span> },
    {
      label: "Estado actual",
      value: (
        <span className="inline-flex items-center gap-2 flex-wrap justify-end">
          <EstadoBadge estado={exp.estado} />
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border"
            style={{ background: colorSt.bg, color: colorSt.fg, borderColor: colorSt.border }}
          >
            {colorSt.label}
          </span>
        </span>
      ),
    },
    { label: "Etapa", value: <span className="font-semibold" style={{ color: "var(--nuvia-text-primary)" }}>{etapa.numero}. {etapa.titulo}</span> },
    { label: "Responsable etapa", value: roleLabels(etapa.responsables, true) },
    {
      label: "SLA",
      value: (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: slaOk ? PILL_OK.bg : PILL_BAD.bg, color: slaOk ? PILL_OK.fg : PILL_BAD.fg }}
        >
          {dias} {dias === 1 ? "día" : "días"} en etapa
        </span>
      ),
    },
    {
      label: "Bloqueos",
      value: (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: bloqueos.length === 0 ? PILL_OK.bg : PILL_BAD.bg,
            color: bloqueos.length === 0 ? PILL_OK.fg : PILL_BAD.fg,
          }}
        >
          {bloqueos.length === 0 ? "Sin bloqueos" : `${bloqueos.length} ${bloqueos.length === 1 ? "bloqueo" : "bloqueos"}`}
        </span>
      ),
    },
  ];

  return (
    <NCard variant="elevated">
      <SectionHeader
        title="Resumen ejecutivo"
        description={exp.cliente_nombre}
        action={
          <div className="flex items-center gap-3">
            <CaseSnapshotButton expedienteId={exp.id} clienteNombre={exp.cliente_nombre} />
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--nuvia-text-secondary)" }}>Avance</div>
              <div className="text-2xl font-bold" style={{ color: "var(--nuvia-accent-blue)" }}>{pct}%</div>
            </div>
          </div>
        }
      />

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--nuvia-accent-blue), var(--nuvia-accent-green))" }}
        />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
        {items.map((it) => (
          <div
            key={it.label}
            className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-2"
            style={{ borderBottom: "1px solid var(--nuvia-border)" }}
          >
            <dt
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--nuvia-text-secondary)" }}
            >
              {it.label}
            </dt>
            <dd
              className="min-w-0 break-words text-sm sm:text-right"
              style={{ color: "var(--nuvia-text-primary)" }}
            >
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
    </NCard>
  );
}
