// Pipeline Maestro — Panel de Etapas 11-14 (Pago honorarios, Comisión,
// Paz y salvo, Finalizado). Frontend-only, derivado de etapaActual.

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Wallet,
  Percent,
  ShieldCheck,
  Flag,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { NUVEX } from "@/components/nuvex/constants";
import { Card } from "@/components/nuvex/ui";
import { ETAPAS_PIPELINE, indexOfEtapa, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { roleLabel } from "@/lib/roleLabels";

interface Props {
  etapaActual: EtapaPipelineId;
}

type EtapaKey = "pago" | "comision" | "paz_salvo" | "finalizado";

export function EtapasFinales11a14({ etapaActual }: Props) {
  const [tab, setTab] = useState<EtapaKey>(() => {
    if (etapaActual === "comision") return "comision";
    if (etapaActual === "paz_salvo") return "paz_salvo";
    if (etapaActual === "finalizado") return "finalizado";
    return "pago";
  });

  const idx = indexOfEtapa(etapaActual);

  const data = useMemo(() => ([
    {
      key: "pago" as const,
      icon: Wallet,
      items: [
        { label: "Cuenta de cobro enviada al cliente", ok: idx >= indexOfEtapa("pago") },
        { label: "Pago de honorarios confirmado", ok: idx >= indexOfEtapa("comision") },
      ],
    },
    {
      key: "comision" as const,
      icon: Percent,
      items: [
        { label: "Honorarios recibidos", ok: idx >= indexOfEtapa("comision") },
        { label: "Comisión AFC liquidada y pagada", ok: idx >= indexOfEtapa("paz_salvo") },
      ],
    },
    {
      key: "paz_salvo" as const,
      icon: ShieldCheck,
      items: [
        { label: "Obligaciones operativas cerradas", ok: idx >= indexOfEtapa("paz_salvo") },
        { label: "Paz y salvo emitido y entregado", ok: idx >= indexOfEtapa("finalizado") || etapaActual === "paz_salvo" },
      ],
    },
    {
      key: "finalizado" as const,
      icon: Flag,
      items: [
        { label: "Paz y salvo confirmado por el cliente", ok: idx >= indexOfEtapa("finalizado") },
        { label: "Caso archivado y métricas consolidadas", ok: etapaActual === "finalizado" },
      ],
    },
  ]), [idx, etapaActual]);

  const etapas = ETAPAS_PIPELINE.slice(10, 14);
  const active = data.find((d) => d.key === tab)!;
  const meta = ETAPAS_PIPELINE.find((e) => e.id === tab)!;
  const Icon = active.icon;

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Etapas 11 · 12 · 13 · 14 — Pago, Comisión, Paz y salvo, Finalizado
          </div>
          <div className="text-sm text-[#242424]/70">
            Cierre financiero y operativo del caso. La etapa 14 sólo se confirma con paz y salvo entregado.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {data.map((d, i) => {
            const done = d.items.filter((it) => it.ok).length;
            const all = d.items.length;
            const complete = done === all;
            const isActive = tab === d.key;
            const m = etapas[i];
            return (
              <button
                key={d.key}
                onClick={() => setTab(d.key)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition"
                style={{
                  borderColor: isActive ? NUVEX.azul : "#E5E7EB",
                  background: isActive ? NUVEX.azul : "#FFFFFF",
                  color: isActive ? "#FFFFFF" : "#242424",
                }}
              >
                {complete ? (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: isActive ? "#FFFFFF" : NUVEX.verdeTextoFuerte }} />
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-60" />
                )}
                <span>{m.numero}. {m.titulo}</span>
                <span className="opacity-70">({done}/{all})</span>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "#E5E7EB", background: "#FBFCFD" }}>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: "#EAF1FF" }}>
              <Icon className="h-4 w-4" style={{ color: NUVEX.azul }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#242424]">Etapa {meta.numero} · {meta.titulo}</div>
              <p className="text-xs text-[#242424]/65">{meta.descripcion}</p>
              <div className="mt-1 text-[11px] text-[#242424]/55">
                Responsables: {meta.responsables.map((r) => roleLabel(r)).join(" · ")}
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-1.5">
            {active.items.map((it) => (
              <li key={it.label} className="flex items-start gap-2 text-xs">
                {it.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: NUVEX.verdeTextoFuerte }} />
                ) : (
                  <Circle className="h-4 w-4 mt-0.5 shrink-0 text-[#9CA3AF]" />
                )}
                <div className={it.ok ? "text-[#242424]" : "text-[#242424]/70"}>{it.label}</div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {tab === "pago" && (
              <Link
                to="/finanzas/cuentas-cobro"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow"
                style={{ background: NUVEX.azul }}
              >
                <Wallet className="h-3.5 w-3.5" />
                Confirmar pago en cuentas de cobro
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {tab === "comision" && (
              <Link
                to="/finanzas/comisiones"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#FFFFFF" }}
              >
                <Percent className="h-3.5 w-3.5" />
                Ir a liquidación de comisiones
              </Link>
            )}
            {tab === "paz_salvo" && (
              <div className="text-[11px] text-[#242424]/60">
                El paz y salvo se genera desde el módulo jurídico una vez confirmados pago de honorarios y cierre operativo.
              </div>
            )}
            {tab === "finalizado" && (
              <div className="text-[11px]" style={{ color: etapaActual === "finalizado" ? NUVEX.verdeTextoFuerte : "#6b7280" }}>
                {etapaActual === "finalizado"
                  ? "✓ Caso finalizado. Métricas consolidadas en gerencia."
                  : "Pendiente de confirmar paz y salvo para cerrar el caso."}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
