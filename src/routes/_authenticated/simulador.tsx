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
import { getExpediente, type Expediente } from "@/lib/expedientes";
import { overlayAuditInputs, expedienteFromAudit } from "@/lib/qaReviewExpediente";

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




function SimuladorPage() {
  const { maestroId, modo: modoSearch, auditoriaId } = Route.useSearch();
  const navigate = useNavigate();
  // El modo se elige explícitamente por el usuario o viene de la URL / expediente maestro.
  // No se autoselecciona desde drafts en sessionStorage.
  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? null);
  const [maestroExp, setMaestroExp] = useState<Expediente | null>(null);
  const [loadingMaestro, setLoadingMaestro] = useState<boolean>(!!maestroId || !!auditoriaId);
  const [creating, setCreating] = useState<boolean>(false);
  const [maestroErr, setMaestroErr] = useState<string | null>(null);

  // Carga del maestro existente (si llegó por URL desde Expediente Maestro).
  useEffect(() => {
    if (!maestroId && !auditoriaId) {
      setMaestroExp(null);
      setLoadingMaestro(false);
      return;
    }
    setLoadingMaestro(true);
    setMaestroErr(null);
    (async () => {
      try {
        let exp: Expediente | null = null;
        if (maestroId) {
          try {
            const m = await getMaestro(maestroId);
            exp = await ensureOperativeExpedienteForMaestro(m);
          } catch {
            if (auditoriaId) {
              try { exp = await getExpediente(maestroId); } catch { /* la auditoría puede no tener caso operativo */ }
            } else {
              throw new Error("No se encontró este expediente maestro o ya no está disponible.");
            }
          }
        }
        if (auditoriaId) {
          try {
            const aud = await obtenerAuditoriaQA({ data: { id: auditoriaId } });
            const auditoria = (aud as { auditoria?: Record<string, unknown> })?.auditoria;
            const inputs = auditoria?.inputs as Record<string, unknown> | undefined;
            const expIdAud = typeof auditoria?.expediente_id === "string" ? auditoria.expediente_id : null;
            if (!exp && expIdAud) {
              try { exp = await getExpediente(expIdAud); } catch { /* puede ser auditoría sin expediente operativo */ }
            }
            if (auditoria && inputs) {
              exp = overlayAuditInputs(exp ?? expedienteFromAudit(auditoria, inputs), inputs);
              try {
                clearSimulatorDraft("pesos", exp.id);
                clearSimulatorDraft("uvr", exp.id);
              } catch { /* noop */ }
            }
            const modAud = typeof auditoria?.modalidad === "string" ? auditoria.modalidad : inputs?.modalidad;
            if (modAud === "uvr") setMode("uvr");
            else if (modAud) setMode("pesos");
          } catch (e) {
            console.warn("No se pudo cargar la auditoría para prellenar simulador", e);
          }
        }
        if (exp) {
          setMaestroExp(exp);
          setMode((current) => current ?? exp.modo);
        }
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
        <div className="sticky top-0 z-[60] overflow-hidden border-b border-white/10 bg-gradient-to-r from-[#0B1220] via-[#111A2E] to-[#0B1220] shadow-[0_18px_50px_-22px_rgba(0,0,0,0.8)] backdrop-blur">
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-[0_0_24px_-6px_rgba(251,191,36,0.55)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </div>
            <div className="flex-1 text-[13px] leading-relaxed text-slate-200">
              <div className="mb-0.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">Modo revisión QA</span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">NUVIA · Financial QA AI</span>
              </div>
              <p className="text-slate-300/90">
                Los campos se prellenan con los inputs exactos del analista en la auditoría —{" "}
                <span className="text-slate-100">saldo capital, tasa pactada, seguros, cuota, UVR y desembolso</span>. Cualquier cambio aquí{" "}
                <span className="font-medium text-amber-300">no afecta</span> el expediente original.
              </p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
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
