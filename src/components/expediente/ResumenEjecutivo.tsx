// Resumen Ejecutivo del Expediente — vista limpia y rápida.
// Cliente, banco, producto, estado actual, responsable, próxima acción, % avance, bloqueos, SLA.

import { Card } from "@/components/nuvex/ui";
import { EstadoBadge } from "@/components/nuvex/EstadoBadge";
import {
  etapaActualGuiada,
  ETAPAS_GUIADAS,
  porcentajeAvance,
  getBloqueos,
  diasDesde,
  estadoDeEtapa,
  ESTADO_COLOR,
} from "@/lib/expedienteGuiado";
import { roleLabels } from "@/lib/roleLabels";
import type { Expediente } from "@/lib/expedientes";

export function ResumenEjecutivo({ exp }: { exp: Expediente }) {
  const etapaId = etapaActualGuiada(exp);
  const etapa = ETAPAS_GUIADAS.find((e) => e.id === etapaId)!;
  const pct = porcentajeAvance(exp);
  const bloqueos = getBloqueos(exp);
  const dias = diasDesde(exp.updated_at);
  const slaOk = dias < 5;
  const st = estadoDeEtapa(exp, etapaId);
  const colorSt = ESTADO_COLOR[st];

  const items: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Cliente", value: <span className="font-semibold">{exp.cliente_nombre}</span> },
    { label: "Cédula", value: exp.cedula || "—" },
    { label: "Banco", value: exp.banco || "—" },
    { label: "Producto", value: exp.producto || "—" },
    { label: "Modo", value: <span className="uppercase font-semibold">{exp.modo}</span> },
    {
      label: "Estado actual",
      value: (
        <span className="inline-flex items-center gap-2">
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
    { label: "Etapa", value: <span className="font-semibold">{etapa.numero}. {etapa.titulo}</span> },
    { label: "Responsable etapa", value: roleLabels(etapa.responsables, true) },
    {
      label: "SLA",
      value: (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: slaOk ? "#EAF7EE" : "#FEE2E2", color: slaOk ? "#1F7A45" : "#991B1B" }}
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
          style={{ background: bloqueos.length === 0 ? "#EAF7EE" : "#FEE2E2", color: bloqueos.length === 0 ? "#1F7A45" : "#991B1B" }}
        >
          {bloqueos.length === 0 ? "Sin bloqueos" : `${bloqueos.length} ${bloqueos.length === 1 ? "bloqueo" : "bloqueos"}`}
        </span>
      ),
    },
  ];

  return (
    <Card>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#445DA3]">
            Resumen ejecutivo
          </div>
          <h2 className="text-xl font-semibold text-[#0A1226]">{exp.cliente_nombre}</h2>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[#242424]/55">Avance</div>
          <div className="text-2xl font-bold text-[#445DA3]">{pct}%</div>
        </div>
      </div>

      <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-[#F2F4F8]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#445DA3,#1F7A45)" }}
        />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-start justify-between gap-2 border-b border-[#F2F4F8] py-1.5 last:border-b-0">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#242424]/55">{it.label}</dt>
            <dd className="text-right text-sm text-[#0A1226]">{it.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
