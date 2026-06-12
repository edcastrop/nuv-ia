// Pipeline Maestro — Panel de Etapas 4-6 (Presentación, Cierre, Contratación).
// Frontend-only: complementa EtapasIniciales123. Lee estado existente
// (validaciones QA + envíos de contratación) sin crear nuevas tablas.

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  Handshake,
  FileSignature,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { NUVEX } from "@/components/nuvex/constants";
import { Card } from "@/components/nuvex/ui";
import { ETAPAS_PIPELINE } from "@/lib/pipelineEtapas";
import { roleLabel } from "@/lib/roleLabels";
import { obtenerUltimaValidacion, type ValidacionQA } from "@/lib/validacionQA";
import { listEnviosByExpediente, type EnvioContratacion } from "@/lib/contratacion";

type ClienteLike = { nombre?: string; cedula?: string; celular?: string; correo?: string };

interface Props {
  expedienteId: string;
  cliente: ClienteLike;
  /** Scroll target: id del bloque EnviarContratacion en la página. */
  scrollContratacionId?: string;
}

type EtapaKey = "presentacion" | "cierre" | "contratacion";

interface CheckItem {
  label: string;
  ok: boolean;
  hint?: string;
}

export function EtapasMedias456({ expedienteId, cliente, scrollContratacionId }: Props) {
  const [tab, setTab] = useState<EtapaKey>("presentacion");
  const [validacion, setValidacion] = useState<ValidacionQA | null>(null);
  const [envios, setEnvios] = useState<EnvioContratacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [v, e] = await Promise.all([
        obtenerUltimaValidacion(expedienteId),
        listEnviosByExpediente(expedienteId).catch(() => []),
      ]);
      setValidacion(v);
      setEnvios(e);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [expedienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const qaAprobado = validacion?.resultado === "aprobada";
  const envioOk = envios.length > 0;
  const ultimoEnvio = envios[0];

  const checks = useMemo(() => ({
    presentacion: [
      { label: "QA aprobado", ok: qaAprobado, hint: "Sin QA aprobado no se presenta al cliente." },
      { label: "Cliente con contacto válido", ok: !!cliente.celular?.trim() || !!cliente.correo?.trim(), hint: "Necesario celular o correo para presentar la propuesta." },
    ] as CheckItem[],
    cierre: [
      { label: "Propuesta presentada", ok: qaAprobado, hint: "Requiere QA aprobado." },
      { label: "Aceptación del cliente", ok: false, hint: "Marca esta etapa cuando el cliente confirme aceptación (DM / firma / verbal documentada)." },
    ] as CheckItem[],
    contratacion: [
      { label: "Cierre confirmado", ok: false, hint: "El cliente debe haber aceptado la propuesta." },
      { label: "Envío a contratación realizado", ok: envioOk, hint: "Usa «Enviar a contratación» más abajo para disparar el correo a jurídica." },
    ] as CheckItem[],
  }), [qaAprobado, envioOk, cliente]);

  const completar = (items: CheckItem[]) => items.filter((i) => i.ok).length;

  const etapas = ETAPAS_PIPELINE.slice(3, 6);
  const tabKeys: EtapaKey[] = ["presentacion", "cierre", "contratacion"];
  const Icon = tab === "presentacion" ? Send : tab === "cierre" ? Handshake : FileSignature;
  const meta = ETAPAS_PIPELINE.find((e) => e.id === tab)!;

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: NUVEX.azul }}>
            Etapas 4 · 5 · 6 — Presentación, Cierre, Contratación
          </div>
          <div className="text-sm text-[#242424]/70">
            Avance comercial y jurídico previo a la radicación.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabKeys.map((k, i) => {
            const items = checks[k];
            const done = completar(items);
            const all = items.length;
            const complete = done === all;
            const active = tab === k;
            const m = etapas[i];
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className="rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 transition"
                style={{
                  borderColor: active ? NUVEX.azul : "#E5E7EB",
                  background: active ? NUVEX.azul : "#FFFFFF",
                  color: active ? "#FFFFFF" : "#242424",
                }}
              >
                {complete ? (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: active ? "#FFFFFF" : NUVEX.verdeTextoFuerte }} />
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-60" />
                )}
                <span>
                  {m.numero}. {m.titulo}
                </span>
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
            {checks[tab].map((it) => (
              <li key={it.label} className="flex items-start gap-2 text-xs">
                {it.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: NUVEX.verdeTextoFuerte }} />
                ) : (
                  <Circle className="h-4 w-4 mt-0.5 shrink-0 text-[#9CA3AF]" />
                )}
                <div>
                  <div className={it.ok ? "text-[#242424]" : "text-[#242424]/70"}>{it.label}</div>
                  {it.hint && !it.ok && (
                    <div className="text-[10px] text-[#B45309] flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3" />
                      {it.hint}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {tab === "presentacion" && (
              <>
                <Link
                  to="/inicio"
                  search={{ maestroId: expedienteId, modo: "pesos" as const }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow"
                  style={{ background: NUVEX.azul }}
                >
                  Abrir proyección
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/colaboracion/dm"
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                  style={{ borderColor: NUVEX.azul, color: NUVEX.azul, background: "#FFFFFF" }}
                >
                  Mensaje al cliente
                </Link>
              </>
            )}
            {tab === "cierre" && (
              <div className="text-[11px] text-[#242424]/60">
                Documenta la aceptación en el bloque jurídico o por DM. El paso de Cierre se confirma operativamente.
              </div>
            )}
            {tab === "contratacion" && (
              <>
                <a
                  href={scrollContratacionId ? `#${scrollContratacionId}` : undefined}
                  onClick={(ev) => {
                    if (!scrollContratacionId) return;
                    ev.preventDefault();
                    document.getElementById(scrollContratacionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow"
                  style={{ background: NUVEX.azul }}
                >
                  <Send className="h-3.5 w-3.5" />
                  Ir a «Enviar a contratación»
                </a>
                {loading ? (
                  <span className="text-[11px] text-[#242424]/50">Cargando envíos…</span>
                ) : ultimoEnvio ? (
                  <span className="text-[11px]" style={{ color: NUVEX.verdeTextoFuerte }}>
                    ✓ Último envío {new Date(ultimoEnvio.created_at).toLocaleString("es-CO")} ·{" "}
                    {ultimoEnvio.estado_envio}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#242424]/55">Sin envíos a contratación todavía.</span>
                )}
                {err && <span className="text-[11px] text-[#B42318]">{err}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
