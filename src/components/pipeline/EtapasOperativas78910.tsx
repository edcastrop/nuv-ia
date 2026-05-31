// Pipeline Maestro — Panel de Etapas 7-10 (Radicación, Banco, Informe, Cuenta de cobro).
// Frontend-only: deriva el progreso desde la etapa actual (que ya mapea
// caso_estado → etapa). No escribe BD.

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Building2,
  Banknote,
  FileText,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { NUVEX } from "@/components/nuvex/constants";
import { Card } from "@/components/nuvex/ui";
import { ETAPAS_PIPELINE, indexOfEtapa, type EtapaPipelineId } from "@/lib/pipelineEtapas";
import { roleLabel } from "@/lib/roleLabels";

interface Props {
  expedienteId: string;
  etapaActual: EtapaPipelineId;
}

type EtapaKey = "radicacion" | "banco" | "informe" | "cuenta";

export function EtapasOperativas78910({ etapaActual }: Props) {
  const [tab, setTab] = useState<EtapaKey>(() => {
    if (etapaActual === "banco") return "banco";
    if (etapaActual === "informe") return "informe";
    if (etapaActual === "cuenta") return "cuenta";
    return "radicacion";
  });

  const idxActual = indexOfEtapa(etapaActual);

  const data = useMemo(() => {
    return ([
      {
        key: "radicacion" as const,
        icon: Building2,
        items: [
          { label: "Contratación firmada", ok: idxActual >= indexOfEtapa("radicacion") },
          { label: "Documentos radicados ante el banco", ok: idxActual >= indexOfEtapa("banco") || etapaActual === "radicacion" },
        ],
      },
      {
        key: "banco" as const,
        icon: Banknote,
        items: [
          { label: "Expediente en estudio bancario", ok: idxActual >= indexOfEtapa("banco") },
          { label: "Resultado final emitido por banco", ok: idxActual >= indexOfEtapa("informe") },
        ],
      },
      {
        key: "informe" as const,
        icon: FileText,
        items: [
          { label: "Resultado bancario disponible", ok: idxActual >= indexOfEtapa("informe") },
          { label: "Informe al cliente entregado", ok: idxActual >= indexOfEtapa("cuenta") },
        ],
      },
      {
        key: "cuenta" as const,
        icon: Receipt,
        items: [
          { label: "Informe entregado al cliente", ok: idxActual >= indexOfEtapa("cuenta") },
          { label: "Cuenta de cobro generada y enviada", ok: idxActual >= indexOfEtapa("pago") || etapaActual === "cuenta" },
        ],
      },
    ]);
  }, [idxActual, etapaActual]);

  const etapas = ETAPAS_PIPELINE.slice(6, 10);
  const active = data.find((d) => d.key === tab)!;
  const meta = ETAPAS_PIPELINE.find((e) => e.id === tab)!;
  const Icon = active.icon;

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Etapas 7 · 8 · 9 · 10 — Radicación, Banco, Informe, Cuenta de cobro
          </div>
          <div className="text-sm text-[#242424]/70">
            Trazabilidad operativa desde la radicación al banco hasta la generación de la cuenta de cobro.
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
            {tab === "radicacion" && (
              <Link
                to="/casos"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#FFFFFF" }}
              >
                Ir a casos operativos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
            {tab === "banco" && (
              <div className="text-[11px] text-[#242424]/60">
                Sin contacto directo con el cliente. El movimiento entre banco, jurídica, dirección financiera y AFC se registra desde el caso operativo.
              </div>
            )}
            {tab === "informe" && (
              <Link
                to="/colaboracion/dm"
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#FFFFFF" }}
              >
                Notificar al cliente
              </Link>
            )}
            {tab === "cuenta" && (
              <Link
                to="/finanzas/cuentas-cobro"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow"
                style={{ background: NUVEX.azul }}
              >
                <Receipt className="h-3.5 w-3.5" />
                Ir a cuentas de cobro
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
