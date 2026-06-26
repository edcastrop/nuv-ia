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
