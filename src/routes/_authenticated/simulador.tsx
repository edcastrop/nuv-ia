import { createFileRoute, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ModeSelector } from "@/components/nuvex/ModeSelector";
import { PesosSimulator } from "@/components/nuvex/PesosSimulator";
import { UVRSimulator } from "@/components/nuvex/UVRSimulator";
import {
  ensureOperativeExpedienteForMaestro,
  getMaestro,
  maestroToExpediente,
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

export function SimuladorPage() {
  const { maestroId, modo: modoSearch, auditoriaId } = Route.useSearch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  // Draft mode: cuando el simulador se abre desde /herramientas/simulador NO se
  // crea ningún expediente_maestro. Todo vive en sessionStorage hasta que el
  // usuario haga clic en "Guardar como caso".
  const draftMode = pathname.startsWith("/herramientas/simulador");

  const [mode, setMode] = useState<null | "pesos" | "uvr">(modoSearch ?? null);
  const [maestroExp, setMaestroExp] = useState<Expediente | null>(null);
  const [loadingMaestro, setLoadingMaestro] = useState<boolean>(!!maestroId || !!auditoriaId);
  const [creating, setCreating] = useState<boolean>(false);
  const [maestroErr, setMaestroErr] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveNombre, setSaveNombre] = useState("");
  const [saveCedula, setSaveCedula] = useState("");

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
            try {
              exp = await ensureOperativeExpedienteForMaestro(m);
            } catch (operativeErr) {
              console.warn("[simulador] expediente operativo pendiente; usando maestro en memoria:", operativeErr);
              exp = maestroToExpediente(m, m.id) as unknown as Expediente;
            }
          } catch (maestroLoadErr) {
            if (auditoriaId) {
              try { exp = await getExpediente(maestroId); } catch { /* la auditoría puede no tener caso operativo */ }
            } else {
              console.warn("[simulador] no se pudo cargar expediente maestro:", maestroLoadErr);
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


  // Elección de modo:
  // - draftMode (Herramientas): NUNCA crea maestro. Solo cambia el estado local.
  // - Modo formal (con maestroId): usa el maestro existente.
  // - Modo formal (sin maestroId, flujo legado): crea maestro. Este caso ya no se
  //   alcanza desde el sidebar porque la entrada "Simulador" fue reemplazada por
  //   "Crear Caso" → /expediente-maestro. Se mantiene solo por retro-compatibilidad
  //   con enlaces guardados o accesos directos.
  const handlePickMode = async (m: "pesos" | "uvr") => {
    if (draftMode) {
      setMode(m);
      // Reflejar la selección en la URL para poder compartir el link exploratorio.
      navigate({ to: "/herramientas/simulador", search: { modo: m }, replace: true });
      return;
    }
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
      try {
        const exp = await ensureOperativeExpedienteForMaestro(maestro);
        setMaestroExp(exp);
      } catch (expErr) {
        console.warn("[simulador] expediente operativo se creará al completar datos:", expErr);
        setMaestroExp(maestroToExpediente(maestro, maestro.id) as unknown as Expediente);
      }
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

  const handleSaveAsCase = async () => {
    if (!mode) return;
    const nombre = saveNombre.trim();
    const cedula = saveCedula.trim();
    if (!nombre || !cedula) {
      toast.error("Nombre y cédula son obligatorios para crear el caso.");
      return;
    }
    setSavingDraft(true);
    try {
      // Migrar draft de sessionStorage: standalone → futuro expediente.
      const readKey = (mo: "pesos" | "uvr") => `nuvex.simulatorDraft.${mo}.standalone`;
      const writeKey = (mo: "pesos" | "uvr", expId: string) => `nuvex.simulatorDraft.${mo}.${expId}`;
      const pesosDraft = typeof window !== "undefined" ? sessionStorage.getItem(readKey("pesos")) : null;
      const uvrDraft = typeof window !== "undefined" ? sessionStorage.getItem(readKey("uvr")) : null;

      const cliente = { ...emptyCliente(), nombre, cedula };
      const maestro = await upsertMaestro({
        cliente,
        cotitular: emptyCotitular(),
        credito: emptyCredito(),
        fresh: emptyFresh(),
        asesor: emptyAsesor(),
        licenciado: emptyLicenciado(),
        apoderado: emptyApoderado(),
      });
      let expId: string | null = null;
      try {
        const exp = await ensureOperativeExpedienteForMaestro(maestro);
        expId = exp.id;
      } catch (e) {
        console.warn("[simulador] operativo se creará más adelante:", e);
      }
      if (expId && typeof window !== "undefined") {
        if (pesosDraft) sessionStorage.setItem(writeKey("pesos", expId), pesosDraft);
        if (uvrDraft) sessionStorage.setItem(writeKey("uvr", expId), uvrDraft);
      }
      toast.success("Caso creado. Continúa completando el expediente.");
      setSaveOpen(false);
      navigate({
        to: "/simulador",
        search: { maestroId: maestro.id, modo: mode },
        replace: true,
      });
    } catch (e) {
      toast.error(`No se pudo crear el caso: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSavingDraft(false);
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
    if (draftMode) {
      navigate({ to: "/herramientas/simulador", search: {} });
    } else {
      navigate({ to: "/simulador", search: {} });
    }
  };

  const simReturn = maestroId ? { maestroId, modo: mode ?? undefined } : undefined;


  return (
    <div>
      {draftMode && (
        <DraftBanner
          onSaveAsCase={() => setSaveOpen(true)}
          canSave={!!mode}
        />
      )}
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
        <PesosSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn as never} fromSimulador auditoriaId={auditoriaId} />
      )}
      {mode === "uvr" && (
        <UVRSimulator initialExpediente={initial} onReset={handleReset} simuladorReturn={simReturn as never} fromSimulador auditoriaId={auditoriaId} />
      )}

      {saveOpen && (
        <SaveAsCaseDialog
          nombre={saveNombre}
          cedula={saveCedula}
          onNombre={setSaveNombre}
          onCedula={setSaveCedula}
          onCancel={() => setSaveOpen(false)}
          onConfirm={handleSaveAsCase}
          saving={savingDraft}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Draft banner + Save as case dialog                                        */
/* -------------------------------------------------------------------------- */

function DraftBanner({ onSaveAsCase, canSave }: { onSaveAsCase: () => void; canSave: boolean }) {
  return (
    <div className="sticky top-0 z-[60] border-b border-emerald-400/20 bg-gradient-to-r from-[#0B1220] via-[#0E1A2E] to-[#0B1220] backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-5 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M2 12h20"/></svg>
        </div>
        <div className="flex-1 min-w-[220px] text-[12.5px] leading-snug text-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
              Modo exploración
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Herramientas · Simulador</span>
          </div>
          <p className="mt-0.5 text-slate-300/85">
            Nada de lo que hagas aquí se guarda en el ERP. Cuando estés listo,{" "}
            <span className="text-slate-100">guarda como caso</span> para trabajarlo formalmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/herramientas"
            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-300 hover:bg-white/[0.06]"
          >
            Salir
          </Link>
          <button
            type="button"
            onClick={onSaveAsCase}
            disabled={!canSave}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-3 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-emerald-200 shadow-[0_10px_30px_-15px_rgba(52,211,153,0.6)] transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar como caso
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveAsCaseDialog({
  nombre,
  cedula,
  onNombre,
  onCedula,
  onCancel,
  onConfirm,
  saving,
}: {
  nombre: string;
  cedula: string;
  onNombre: (v: string) => void;
  onCedula: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1220] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-white">Guardar simulación como caso</h3>
        <p className="mt-1 text-[13px] text-white/60">
          Se creará un expediente maestro en el ERP con estos datos. Puedes completar el resto después.
        </p>
        <div className="mt-5 space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Nombre completo del cliente
            <input
              autoFocus
              value={nombre}
              onChange={(e) => onNombre(e.target.value)}
              placeholder="Ej. Valentina Padilla Acevedo"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-white placeholder:text-white/30 focus:border-emerald-400/40 focus:outline-none"
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
            Cédula
            <input
              value={cedula}
              onChange={(e) => onCedula(e.target.value)}
              placeholder="Ej. 1234567890"
              inputMode="numeric"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[14px] font-normal normal-case tracking-normal text-white placeholder:text-white/30 focus:border-emerald-400/40 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-semibold text-white/80 hover:bg-white/[0.06]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !nombre.trim() || !cedula.trim()}
            className="rounded-lg border border-emerald-400/40 bg-emerald-400/20 px-4 py-2 text-[12.5px] font-semibold text-emerald-100 shadow-[0_10px_30px_-15px_rgba(52,211,153,0.6)] hover:bg-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Crear caso"}
          </button>
        </div>
      </div>
    </div>
  );
}
