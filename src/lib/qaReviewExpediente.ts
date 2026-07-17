// Helpers compartidos para construir un Expediente "sandbox" a partir de una
// auditoría QA, de modo que el simulador (página `/simulador` o el bloque
// embebido en `/qa-ai/$id`) pueda renderizarse con los inputs exactos que
// usó el analista, sin contaminar el expediente real del caso.

import type { Expediente } from "@/lib/expedientes";

export function numToStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

export function overlayAuditInputs(exp: Expediente, inputs: Record<string, unknown>): Expediente {
  const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
  const cred = { ...(exp.credito_data ?? {}) } as Record<string, string>;
  const setIfEmpty = (k: string, v: string) => {
    if (v && !cred[k]) cred[k] = v;
  };
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

export function expedienteFromAudit(auditoria: Record<string, unknown>, inputs: Record<string, unknown>): Expediente {
  const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
  const modalidad = String(inputs.modalidad ?? auditoria.modalidad ?? "pesos");
  const id = `qa-review-${String(auditoria.id ?? "temporal")}`;
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

/** Snapshot legible (label/valor) de los inputs originales del analista. */
export function snapshotInputsAnalista(inputs: Record<string, unknown>): Array<{ label: string; value: string }> {
  const rec = (inputs.reconstruccion ?? {}) as Record<string, unknown>;
  const ext = (inputs.extracto ?? {}) as Record<string, unknown>;
  const fmtN = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "—";
    return n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
  };
  const fmtPct = (v: unknown) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n === 0) return "—";
    return `${n.toLocaleString("es-CO", { maximumFractionDigits: 4 })}%`;
  };
  return [
    { label: "Saldo capital", value: fmtN(rec.saldoCapital ?? ext.saldoCapital) },
    { label: "Tasa EA", value: fmtPct(rec.tasaEa ?? ext.tasaEa) },
    { label: "Tasa EA pactada", value: fmtPct(rec.tasaEaPactada) },
    { label: "Seguros", value: fmtN(rec.seguros ?? ext.seguros) },
    { label: "Cuota base (sin subsidio)", value: fmtN(rec.cuotaBaseSinSubsidio ?? ext.cuota) },
    { label: "Cuotas pagadas", value: String(rec.cuotasPagadas ?? "—") },
    { label: "Cuotas pendientes", value: String(rec.cuotasPendientes ?? "—") },
    { label: "Valor desembolsado", value: fmtN(rec.valorDesembolsado) },
    { label: "Saldo UVR", value: fmtN(rec.saldoUVR) },
    { label: "Valor UVR", value: fmtN(rec.valorUVR) },
  ].filter((r) => r.value !== "—");
}

// ─── Escenarios financieros del auditor ──────────────────────────────
//
// Fuente única para materializar los cuatro escenarios financieros que
// verá el auditor. Consume el contrato de snapshot centralizado en
// `nuviaQaSnapshot.validateAuditSnapshotContract` para evitar
// validaciones duplicadas. Precedencia UVR: el `simulador_snapshot`
// (contrato original del analista al momento del OCR) prima sobre
// `inputs.reconstruccion` cuando ambos difieren.

import {
  validateAuditSnapshotContract,
  reconstructLegacyUvrScenarios,
  type SnapshotEscenario,
  type AuditSnapshotContract,
} from "@/lib/nuviaQaSnapshot";
import type { DraftRawSnapshot } from "@/components/nuvex/NuviaDraftAuditCard";

export type EscenariosOrigen =
  | "historico_persistido"
  | "reconstruido_legacy"
  | null;

export type EscenariosAuditor = {
  origen: EscenariosOrigen;
  escenarios: SnapshotEscenario[];
  contract: AuditSnapshotContract;
  /** Mensaje diagnóstico cuando `origen=null`. */
  reason?: string;
  /** Conflicto de variación UVR entre snapshot e inputs (cuando aplica). */
  uvrVariationConflict?: null | { snapshotValue: number; inputsValue: number; chosen: number };
};

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  return 0;
}

export function escenariosFromAudit(
  auditoria: Record<string, unknown>,
  inputs: Record<string, unknown>,
): EscenariosAuditor {
  const snapshotObj = (auditoria.simulador_snapshot ?? null) as DraftRawSnapshot | null;
  const contract = validateAuditSnapshotContract(snapshotObj);
  if (contract.kind === "historico_persistido") {
    return { origen: "historico_persistido", escenarios: contract.escenarios, contract };
  }
  if (contract.kind === "invalido_v2") {
    return {
      origen: null,
      escenarios: [],
      contract,
      reason: `Snapshot v2 inválido (${contract.reason}). La reconstrucción legacy queda deshabilitada; el analista debe re-auditar.`,
    };
  }
  if (contract.kind === "version_desconocida") {
    return {
      origen: null,
      escenarios: [],
      contract,
      reason: `Versión de snapshot desconocida: ${contract.version}.`,
    };
  }
  // Legacy (v1) o sin_snapshot → intentamos reconstrucción determinística.
  const rec = (inputs?.reconstruccion ?? {}) as Record<string, unknown>;
  const datosSnap = (snapshotObj?.datos ?? {}) as Record<string, unknown>;
  // Precedencia UVR: snapshot.datos.variacionUVR prima sobre inputs.reconstruccion.variacionUvrEa.
  const varUvrSnap = num(datosSnap.variacionUVR);
  const varUvrInp = num(rec.variacionUvrEa);
  const variacionUVR = varUvrSnap > 0 ? varUvrSnap : varUvrInp;
  const reconstructed = reconstructLegacyUvrScenarios(
    {
      saldoUVR: num(datosSnap.saldoUVR ?? rec.saldoUVR),
      valorUVR: num(datosSnap.valorUVR ?? rec.valorUVR),
      cuotaActualPesos: num(datosSnap.cuotaActualPesos ?? datosSnap.cuotaActual ?? rec.cuotaBaseSinSubsidio),
      teaCobrada: num(datosSnap.teaCobrada ?? datosSnap.tasaEA ?? rec.tasaEaPactada ?? rec.tasaEa),
      variacionUVR,
      plazoInicial: num(datosSnap.plazoInicial ?? rec.plazoInicial),
      cuotasPendientes: num(datosSnap.cuotasPendientes ?? rec.cuotasPendientes),
      seguros: num(datosSnap.seguros ?? rec.seguros),
      variacionUVRPropuestas: num(datosSnap.variacionUVRPropuestas),
    },
    varUvrSnap > 0 && varUvrInp > 0
      ? { snapshotValue: varUvrSnap, inputsValue: varUvrInp }
      : null,
  );
  if (!reconstructed) {
    return {
      origen: null,
      escenarios: [],
      contract,
      reason:
        "Datos insuficientes para reconstruir escenarios (faltan saldo, cuota, plazo, tea, uvr o variación).",
    };
  }
  return {
    origen: "reconstruido_legacy",
    escenarios: reconstructed.escenarios,
    contract,
    uvrVariationConflict: reconstructed.uvrVariationConflict,
  };
}
