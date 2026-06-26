import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import {
  ensureOperativeExpedienteForMaestro,
  getMaestro,
  upsertMaestro,
  emptyCliente,
  emptyCotitular,
  emptyCredito,
  emptyFresh,
  emptyAsesor,
  emptyLicenciado,
  emptyApoderado,
} from "@/lib/expedienteMaestro";
import { obtenerAuditoriaQA } from "@/lib/qaAI.functions";
import { clearSimulatorDraft } from "@/components/nuvex/useSimulatorDraft";
import type { Expediente } from "@/lib/expedientes";

const simSearchSchema = z.object({
  maestroId: z.string().optional(),
  modo: z.enum(["pesos", "uvr"]).optional(),
  auditoriaId: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/simulador")({
  component: SimuladorPage,
  validateSearch: simSearchSchema,
  head: () => ({
    meta: [{ title: "Simulador · NUVIA" }],
  }),
});

function numToStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function overlayAuditInputs(exp: Expediente, inputs: Record<string, unknown>): Expediente {
  const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
  const cred = { ...(exp.credito_data ?? {}) } as Record<string, string>;
  const setIfEmpty = (k: string, v: string) => {
    if (v && !cred[k]) cred[k] = v;
  };
  // Override siempre con datos auditados (fuente de verdad para revisión QA).
  const saldoCapital = numToStr(rec.saldoCapital ?? ext.saldoCapital);
  const tasa = numToStr(rec.tasaEa ?? ext.tasaEa);
  const tasaPactada = numToStr(rec.tasaEaPactada);
  const seguros = numToStr(rec.seguros ?? ext.seguros);
  const cuotaBase = numToStr(rec.cuotaBaseSinSubsidio ?? ext.cuota);
  const valorDesembolsado = numToStr(rec.valorDesembolsado);
  const saldoUVR = numToStr(rec.saldoUVR);
  const valorUVR = numToStr(rec.valorUVR);
  const variacionUVR = numToStr(rec.variacionUvrEa);
  if (saldoCapital) { cred.saldoCapital = saldoCapital; cred.saldoPesos = saldoCapital; }
  if (tasa) { cred.tea = tasa; cred.teaCobrada = tasaPactada || tasa; }
  if (seguros) cred.seguros = seguros;
  if (cuotaBase) { cred.cuotaActual = cuotaBase; cred.cuotaActualPesos = cuotaBase; }
  if (valorDesembolsado) cred.valorDesembolsado = valorDesembolsado;
  if (saldoUVR) cred.saldoUVR = saldoUVR;
  if (valorUVR) cred.valorUVR = valorUVR;
  if (variacionUVR) cred.variacionUVR = variacionUVR;
  setIfEmpty("interesMensualExtracto", numToStr(ext.intereses));
  setIfEmpty("capitalMensualExtracto", numToStr(ext.capital));
  return { ...exp, credito_data: cred as never };
}

function SimuladorPage() {
  const { maestroId, modo: modoSearch, auditoriaId } = Route.useSearch();
  const navigate = useNavigate();
  // El modo se elige explícitamente por el usuario o viene de la URL / expediente maestro.
  // No se autoselecciona desde drafts en sessionStorage.
  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? null);
  const [maestroExp, setMaestroExp] = useState<Expediente | null>(null);
  const [loadingMaestro, setLoadingMaestro] = useState<boolean>(!!maestroId);
  const [creating, setCreating] = useState<boolean>(false);
  const [maestroErr, setMaestroErr] = useState<string | null>(null);

  // Carga del maestro existente (si llegó por URL desde Expediente Maestro).
  useEffect(() => {
    if (!maestroId) {
      setMaestroExp(null);
      setLoadingMaestro(false);
      return;
    }
    setLoadingMaestro(true);
    setMaestroErr(null);
    (async () => {
      try {
        const m = await getMaestro(maestroId);
        let exp = await ensureOperativeExpedienteForMaestro(m);
        if (auditoriaId) {
          // Modo revisión QA: limpiar drafts previos del simulador en sessionStorage
          // para que los inputs de la auditoría sean la única fuente de verdad.
          try {
            clearSimulatorDraft("pesos", exp.id);
            clearSimulatorDraft("uvr", exp.id);
          } catch { /* noop */ }
          try {
            const aud = await obtenerAuditoriaQA({ data: { id: auditoriaId } });
            const inputs = (aud as { auditoria?: { inputs?: Record<string, unknown>; modalidad?: string } })
              ?.auditoria?.inputs;
            if (inputs) exp = overlayAuditInputs(exp, inputs);
            const modAud = (aud as { auditoria?: { modalidad?: string } })?.auditoria?.modalidad;
            if (modAud === "uvr") setMode((c) => c ?? "uvr");
            else if (modAud) setMode((c) => c ?? "pesos");
          } catch (e) {
            console.warn("No se pudo cargar la auditoría para prellenar simulador", e);
          }
        }
        setMaestroExp(exp);
        setMode((current) => current ?? exp.modo);
      } catch (e) {
        setMaestroErr((e as Error).message);
      } finally {
        setLoadingMaestro(false);
      }
    })();
  }, [maestroId, auditoriaId]);


  // Cuando el usuario elige un modo SIN maestroId previo, creamos un expediente
  // maestro vacío y su expediente operativo, y redirigimos con los params en la URL.
  // Esto habilita el mismo flujo que "Expediente / Nuevo expediente / Simulador":
  // el AutoQA se dispara al subir el extracto porque hay expediente_id.
  const handlePickMode = async (m: "pesos" | "uvr") => {
    if (maestroId) {
      setMode(m);
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const maestro = await upsertMaestro({
        cliente: emptyCliente(),
        cotitular: emptyCotitular(),
        credito: emptyCredito(),
        fresh: emptyFresh(),
        asesor: emptyAsesor(),
        licenciado: emptyLicenciado(),
        apoderado: emptyApoderado(),
      });
      const exp = await ensureOperativeExpedienteForMaestro(maestro);
      setMaestroExp(exp);
      setMode(m);
      navigate({
        to: "/simulador",
        search: { maestroId: maestro.id, modo: m },
        replace: true,
      });
    } catch (e) {
      toast.error(
        `No se pudo iniciar el expediente: ${e instanceof Error ? e.message : "error"}`,
      );
    } finally {
      setCreating(false);
    }
  };

  if (maestroId && loadingMaestro) {
    return (
      <div className="p-12 text-center text-sm text-white/60">
        Cargando datos del expediente maestro…
      </div>
    );
  }
  if (creating) {
    return (
      <div className="p-12 text-center text-sm text-white/60">
        Inicializando expediente para auditoría…
      </div>
    );
  }
  if (maestroErr) {
    return <div className="p-12 text-center text-sm text-[#B42318]">{maestroErr}</div>;
  }

  const initial = maestroExp ?? undefined;
  const handleReset = () => {
    setMode(null);
    setMaestroExp(null);
    navigate({ to: "/simulador", search: {} });
  };

  const simReturn = maestroId ? { maestroId, modo: mode ?? undefined } : undefined;

  return (
    <div>
      {auditoriaId && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-600 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-sm dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100">
          🔍 <strong className="font-semibold">Modo revisión QA:</strong> los campos del simulador se prellenan con los inputs exactos que el analista usó en la auditoría
          (saldo capital, tasa pactada, seguros, cuota, UVR y desembolso). Cambios aquí no afectan al expediente del analista.
        </div>
      )}
      {!mode && <ModeSelector onPick={handlePickMode} />}
      {mode === "pesos" && (
        <PesosSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn} fromSimulador />
      )}
      {mode === "uvr" && (
        <UVRSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn} fromSimulador />
      )}
    </div>
  );
}
