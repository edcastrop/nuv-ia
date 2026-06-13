// Muestra el resultado de la verificación de cierre que NUVIA hace al
// comparar las proyecciones del banco contra la propuesta del cliente.
//
// Diseñado para montarse tanto en el Expediente Maestro (light) como en el
// dictamen QA (dark) — usa tokens NUVIA cuando va en oscuro.

import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, XCircle, Info, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { obtenerVerificacionCierre, verificarCierreContraPropuesta } from "@/lib/proyecciones.functions";
import type { VerificacionCierre, CheckItem, EstadoCheck } from "@/lib/bancosProyecciones";
import { bancoGeneraProyeccionesCierre, motivoSinProyecciones } from "@/lib/bancosProyecciones";

interface Props {
  expedienteId: string;
  bancoHint?: string | null;
  variant?: "expediente" | "qa";
  /** Refrescar señal externa para refetch cuando el dropzone termina la verificación. */
  reloadKey?: number;
}

function colorEstado(estado: EstadoCheck): { bg: string; fg: string; icon: JSX.Element } {
  switch (estado) {
    case "ok":
      return { bg: "rgba(34,197,94,0.12)", fg: "#15803D", icon: <CheckCircle2 size={14} /> };
    case "leve":
      return { bg: "rgba(245,158,11,0.15)", fg: "#B45309", icon: <AlertTriangle size={14} /> };
    case "critico":
      return { bg: "rgba(239,68,68,0.15)", fg: "#B91C1C", icon: <XCircle size={14} /> };
    default:
      return { bg: "rgba(148,163,184,0.18)", fg: "#475569", icon: <Info size={14} /> };
  }
}

export function VerificacionCierreBlock({ expedienteId, bancoHint, variant = "expediente", reloadKey }: Props) {
  const isDark = variant === "qa";
  const fnGet = useServerFn(obtenerVerificacionCierre);
  const fnRun = useServerFn(verificarCierreContraPropuesta);
  const [data, setData] = useState<{ verificacion: VerificacionCierre | null; banco: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fnGet({ data: { expedienteId } });
      setData(r as { verificacion: VerificacionCierre | null; banco: string | null });
    } finally { setLoading(false); }
  }, [fnGet, expedienteId]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const banco = data?.banco ?? bancoHint ?? "";
  const aplica = bancoGeneraProyeccionesCierre(banco);
  const motivoSinProy = !aplica ? motivoSinProyecciones(banco) ?? "Este banco no emite proyecciones formales al cierre." : null;

  const reverificar = useCallback(async () => {
    setRunning(true); setErr(null);
    try { await fnRun({ data: { expedienteId } }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo verificar"); }
    finally { setRunning(false); }
  }, [fnRun, expedienteId, load]);

  const tokens = isDark
    ? { cardBg: "var(--nuvia-surface)", border: "var(--nuvia-border)", text: "var(--nuvia-text-primary)", textDim: "var(--nuvia-text-secondary)", accent: "#A5B5E0" }
    : { cardBg: "#FFFFFF", border: "#E5E7EB", text: "#242424", textDim: "#475569", accent: "#445DA3" };

  if (!aplica) {
    return (
      <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: 16 }}>
        <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: tokens.text }}>
          <ShieldCheck size={16} style={{ color: tokens.accent }} /> Verificación de cierre
        </h3>
        <div className="mt-2 flex items-start gap-2 text-[12.5px] rounded-md px-3 py-2" style={{ background: "rgba(148,163,184,0.12)", color: tokens.textDim }}>
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>{motivoSinProy}</p>
        </div>
      </div>
    );
  }

  const v = data?.verificacion;
  const veredictoColor =
    v?.veredicto === "cumplido" ? "#15803D" :
    v?.veredicto === "cumplido_con_observaciones" ? "#B45309" :
    v?.veredicto === "no_cumplido" ? "#B91C1C" : tokens.textDim;

  return (
    <div style={{ background: tokens.cardBg, border: `1px solid ${tokens.border}`, borderRadius: 14, padding: 16 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold inline-flex items-center gap-2" style={{ color: tokens.text }}>
            <ShieldCheck size={16} style={{ color: tokens.accent }} /> Verificación de cierre · NUVIA
          </h3>
          <p className="text-[11px] mt-1" style={{ color: tokens.textDim }}>
            Compara lo que el banco realmente aplicó (proyecciones de cierre) contra la propuesta que escogió el cliente.
          </p>
        </div>
        {v && (
          <button
            onClick={reverificar}
            disabled={running}
            className="text-[11px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold"
            style={{ background: tokens.accent, color: "#FFFFFF", opacity: running ? 0.6 : 1 }}
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {running ? "Verificando…" : "Reverificar"}
          </button>
        )}
      </div>

      {loading && <p className="text-[12px]" style={{ color: tokens.textDim }}>Cargando verificación…</p>}

      {!loading && !v && (
        <div className="text-[12.5px] rounded-md px-3 py-2 flex items-start gap-2" style={{ background: "rgba(148,163,184,0.12)", color: tokens.textDim }}>
          <Info size={14} className="mt-0.5 shrink-0" />
          <p>Aún no hay verificación de cierre. Sube las proyecciones que emitió el banco y pulsa <strong>"Verificar cierre vs propuesta"</strong>.</p>
        </div>
      )}

      {err && (
        <div className="text-[12px] rounded-md px-3 py-2 mb-3 inline-flex items-start gap-2" style={{ background: "rgba(239,68,68,0.12)", color: "#991B1B" }}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {v && (
        <>
          <div
            className="rounded-lg px-3 py-2.5 mb-3 flex items-start gap-2"
            style={{
              background:
                v.veredicto === "cumplido" ? "rgba(34,197,94,0.12)" :
                v.veredicto === "cumplido_con_observaciones" ? "rgba(245,158,11,0.12)" :
                "rgba(239,68,68,0.12)",
              color: veredictoColor,
            }}
          >
            {v.veredicto === "cumplido" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              : v.veredicto === "no_cumplido" ? <XCircle size={16} className="mt-0.5 shrink-0" />
              : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider">
                {v.veredicto === "cumplido" ? "Cumplido" :
                  v.veredicto === "cumplido_con_observaciones" ? "Cumplido con observaciones" :
                  "No cumplido"}
              </p>
              <p className="text-[12.5px] mt-0.5" style={{ color: tokens.text }}>{v.mensajeCliente}</p>
            </div>
          </div>

          <ul className="space-y-2">
            {v.items.map((it: CheckItem) => {
              const c = colorEstado(it.estado);
              return (
                <li key={it.campo} className="rounded-lg px-3 py-2 flex items-start gap-3" style={{ background: c.bg }}>
                  <span style={{ color: c.fg }} className="mt-0.5">{c.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] font-semibold" style={{ color: tokens.text }}>{it.etiqueta}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(255,255,255,0.6)", color: c.fg }}>
                        {it.estado === "ok" ? "OK" : it.estado === "leve" ? "DESVIACIÓN LEVE" : it.estado === "critico" ? "NO CUMPLE" : "SIN DATO"}
                      </span>
                    </div>
                    <p className="text-[12px] mt-0.5" style={{ color: tokens.text }}>{it.comentario}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <p className="text-[10.5px] mt-3" style={{ color: tokens.textDim }}>
            Generado por NUVIA el {new Date(v.generadoAt).toLocaleString("es-CO")} · banco: {v.banco || "—"}
          </p>
        </>
      )}
    </div>
  );
}
