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
import { numToStr, overlayAuditInputs, expedienteFromAudit } from "@/lib/qaReviewExpediente";

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

function expedienteFromAudit(auditoria: Record<string, unknown>, inputs: Record<string, unknown>): Expediente {
  const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
  const modalidad = String(inputs.modalidad ?? auditoria.modalidad ?? "pesos");
  const id = typeof auditoria.expediente_id === "string" && auditoria.expediente_id
    ? auditoria.expediente_id
    : `qa-review-${String(auditoria.id ?? "temporal")}`;
  return {
    id,
    asesor_id: typeof auditoria.analista_id === "string" ? auditoria.analista_id : "",
    modo: modalidad === "uvr" ? "uvr" : "pesos",
    cliente_nombre: "Revisión QA",
    cedula: null,
    banco: typeof ext.banco === "string" ? ext.banco : null,
    numero_credito: typeof ext.numeroObligacion === "string" ? ext.numeroObligacion : null,
    producto: modalidad === "uvr" ? "Crédito UVR" : "Crédito en pesos",
    cliente_data: {
      nombre: "",
      cedula: "",
      numeroCredito: typeof ext.numeroObligacion === "string" ? ext.numeroObligacion : "",
      banco: typeof ext.banco === "string" ? ext.banco : "",
      tipoProducto: modalidad === "uvr" ? "Crédito UVR" : "Crédito en pesos",
      productoBancarioId: null,
      asesor: "",
      plazoInicial: "",
      cuotasPagadas: numToStr(rec.cuotasPagadas),
      cuotasPendientes: numToStr(rec.cuotasPendientes),
      porcentajeHonorarios: "6",
      correo: "",
      celular: "",
      fechaDesembolso: "",
      lugarExpedicionCedula: "",
      expedidaEn: "",
      lugarExpedicionDepartamento: "",
      lugarExpedicionCiudad: "",
      lugarExpedicionMunicipio: "",
      fechaExpedicionCedula: "",
      fechaExpedicion: "",
      tipoDocumento: "CC",
      direccion: "",
      departamento: "",
      ciudad: "",
      municipio: "",
      perfil: {},
      ingresos: { tipoCredito: "NoVIS", ocupaciones: [], fuentes: [] },
    } as never,
    credito_data: {},
    propuesta_data: {},
    discount_data: {},
    honorarios_base: 0,
    honorarios_final: 0,
    descuento: 0,
    estado: "SIMULADO",
    estado_caso: null,
    fecha_simulacion: new Date().toISOString().slice(0, 10),
    aprobado_data: null,
    acertividad_global: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as never;
}

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
