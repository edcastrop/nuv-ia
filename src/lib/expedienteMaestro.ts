import { supabase } from "@/integrations/supabase/client";
import type { Expediente } from "@/lib/expedientes";
import { withFreshDerivados, FRESH_DEFAULT_TOTAL } from "@/lib/cobertura";
import type { CoberturaFresh } from "@/lib/proyeccion";

export interface ClienteMaestro {
  nombre: string;
  cedula: string;
  expedidaEn: string;
  fechaNacimiento: string;
  estadoCivil: string;
  profesion: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  /** Información jurídica complementaria (opcional) */
  tipoDocumento?: string;
  fechaExpedicion?: string;
  departamento?: string;
}

export interface CotitularMaestro extends ClienteMaestro {
  activo: boolean;
  parentesco: string;
  /** Si true, dirección/ciudad/departamento se heredan del titular y los campos quedan readonly. */
  mismaDireccionTitular?: boolean;
}


export interface CreditoMaestro {
  banco: string;
  numeroCredito: string;
  tipoProducto: string; // pesos / UVR
  fechaDesembolso: string;
  valorDesembolsado?: string;
  plazoOriginal: string;
  saldoCapital: string;
  cuotaActual: string;
  seguros?: string;
  tasa: string;
  cuotasPagadas: string;
  cuotasPendientes: string;
}

export interface AsesorMaestro {
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  codigo: string;
}

export interface LicenciadoMaestro {
  nombre: string;
  cedulaProfesional: string;
  telefono: string;
  email: string;
}

export interface ApoderadoMaestro {
  nombre: string;
  cedula: string;
  telefono: string;
  email: string;
  direccion: string;
  ciudad: string;
  numeroPoder: string;
  fechaPoder: string;
}

export interface ExpedienteMaestro {
  id: string;
  asesor_id: string;
  cedula_cliente: string | null;
  nombre_cliente: string;
  cliente: ClienteMaestro;
  cotitular: CotitularMaestro;
  credito: CreditoMaestro;
  fresh: CoberturaFresh;
  asesor: AsesorMaestro;
  licenciado: LicenciadoMaestro;
  apoderado: ApoderadoMaestro;
  created_at: string;
  updated_at: string;
}

export const emptyCliente = (): ClienteMaestro => ({
  nombre: "", cedula: "", expedidaEn: "", fechaNacimiento: "", estadoCivil: "",
  profesion: "", telefono: "", email: "", direccion: "", ciudad: "",
  tipoDocumento: "CC", fechaExpedicion: "", departamento: "",
});

export const emptyCotitular = (): CotitularMaestro => ({
  ...emptyCliente(), activo: false, parentesco: "", mismaDireccionTitular: false,
});


export const emptyCredito = (): CreditoMaestro => ({
  banco: "", numeroCredito: "", tipoProducto: "", fechaDesembolso: "",
  valorDesembolsado: "", plazoOriginal: "", saldoCapital: "", cuotaActual: "", seguros: "", tasa: "",
  cuotasPagadas: "", cuotasPendientes: "",
});

export const emptyAsesor = (): AsesorMaestro => ({
  nombre: "", cedula: "", telefono: "", email: "", codigo: "",
});

export const emptyLicenciado = (): LicenciadoMaestro => ({
  nombre: "", cedulaProfesional: "", telefono: "", email: "",
});

export const emptyApoderado = (): ApoderadoMaestro => ({
  nombre: "", cedula: "", telefono: "", email: "",
  direccion: "", ciudad: "", numeroPoder: "", fechaPoder: "",
});

export const emptyFresh = (): CoberturaFresh =>
  withFreshDerivados({ activo: false, cuotasTotales: FRESH_DEFAULT_TOTAL });

export interface UpsertMaestro {
  id?: string;
  cliente: ClienteMaestro;
  cotitular: CotitularMaestro;
  credito: CreditoMaestro;
  fresh: CoberturaFresh;
  asesor: AsesorMaestro;
  licenciado: LicenciadoMaestro;
  apoderado: ApoderadoMaestro;
}

export async function listMaestros(search?: string): Promise<ExpedienteMaestro[]> {
  let q = supabase.from("expediente_maestro").select("*").order("updated_at", { ascending: false });
  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    q = q.or(`nombre_cliente.ilike.${s},cedula_cliente.ilike.${s}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ExpedienteMaestro[];
}

export async function getMaestro(id: string): Promise<ExpedienteMaestro> {
  const { data, error } = await supabase.from("expediente_maestro").select("*").eq("id", id).single();
  if (error) throw error;
  return data as unknown as ExpedienteMaestro;
}

export async function upsertMaestro(p: UpsertMaestro): Promise<ExpedienteMaestro> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const row = {
    asesor_id: u.user.id,
    cedula_cliente: p.cliente.cedula || null,
    nombre_cliente: p.cliente.nombre || "Sin nombre",
    cliente: p.cliente as unknown as never,
    cotitular: p.cotitular as unknown as never,
    credito: p.credito as unknown as never,
    fresh: p.fresh as unknown as never,
    asesor: p.asesor as unknown as never,
    licenciado: p.licenciado as unknown as never,
    apoderado: p.apoderado as unknown as never,
  };
  if (p.id) {
    const { data, error } = await supabase.from("expediente_maestro").update(row).eq("id", p.id).select().single();
    if (error) throw error;
    return data as unknown as ExpedienteMaestro;
  }
  const { data, error } = await supabase.from("expediente_maestro").insert(row).select().single();
  if (error) throw error;
  return data as unknown as ExpedienteMaestro;
}

export async function deleteMaestro(id: string): Promise<void> {
  const { error } = await supabase.from("expediente_maestro").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Determina el modo de simulación a partir del tipo de producto del crédito maestro.
 * No altera reglas de negocio: sólo elige pesos / uvr para abrir el simulador correcto.
 */
export function modoFromMaestro(m: ExpedienteMaestro): "pesos" | "uvr" {
  const t = (m.credito?.tipoProducto || "").toLowerCase();
  return /uvr/.test(t) ? "uvr" : "pesos";
}

/**
 * Construye un `Expediente` parcial (in-memory, sin id) consumible por los simuladores
 * vía la prop `initialExpediente`. NO persiste, NO altera cálculos ni diseño —
 * sólo reemplaza la captura manual por la lectura desde el Expediente Maestro.
 *
 * Los simuladores ya derivan Resultado Final, Cuenta de Cobro y Paz y Salvo a partir
 * de estos datos, por lo que toda la cadena queda alimentada automáticamente.
 */
export function maestroToExpediente(m: ExpedienteMaestro) {
  const modo = modoFromMaestro(m);
  const fresh = m.fresh;
  const coberturaActiva = !!fresh?.activo && Number(fresh?.valorMensual ?? 0) > 0;
  const cobertura = coberturaActiva
    ? {
        activo: true,
        valorCobertura: String(Math.round(Number(fresh.valorMensual) || 0)),
        tasaCobertura: fresh.tasa ? String(fresh.tasa) : "",
        tipoBeneficio: fresh.tipoBeneficio || "",
        cuotaPagadaCliente: m.credito?.cuotaConSubsidio ?? "",
        cuotaConInteresSinSeguros: m.credito?.cuotaConInteresSinSeguros ?? "",
        segurosMensuales: m.credito?.seguros ?? "",
        cuotaBaseSimulacion: m.credito?.cuotaBaseSimulacion ?? m.credito?.cuotaActual ?? "",
        requiereVerificacion: false,
      }
    : { activo: false, valorCobertura: "", tasaCobertura: "" };
  const productoBase = m.credito?.tipoProducto ?? "";
  const productoConBeneficio =
    coberturaActiva && productoBase && !/con\s+beneficio\s+de\s+cobertura/i.test(productoBase)
      ? `${productoBase} con Beneficio de Cobertura`
      : productoBase;
  const cliente_data = {
    nombre: m.cliente?.nombre ?? "",
    cedula: m.cliente?.cedula ?? "",
    numeroCredito: m.credito?.numeroCredito ?? "",
    banco: m.credito?.banco ?? "",
    tipoProducto: productoConBeneficio,
    asesor: m.asesor?.nombre ?? "",
    plazoInicial: m.credito?.plazoOriginal ?? "",
    cuotasPagadas: m.credito?.cuotasPagadas ?? "",
    porcentajeHonorarios: "6",
    cobertura,
  };
  const credito_data: Record<string, string> = {
    valorDesembolsado: m.credito?.valorDesembolsado ?? "",
    saldoCapital: m.credito?.saldoCapital ?? "",
    cuotaActual: m.credito?.cuotaActual ?? "",
    seguros: m.credito?.seguros ?? "",
    tea: m.credito?.tasa ?? "",
    nuevaCuotaManual: "",
  };
  return {
    id: "",
    asesor_id: m.asesor_id,
    modo,
    cliente_nombre: cliente_data.nombre || "Sin nombre",
    cedula: cliente_data.cedula || null,
    banco: cliente_data.banco || null,
    numero_credito: cliente_data.numeroCredito || null,
    producto: cliente_data.tipoProducto || null,
    cliente_data: cliente_data as never,
    credito_data,
    propuesta_data: {},
    discount_data: {},
    honorarios_base: 0,
    honorarios_final: 0,
    descuento: 0,
    estado: "SIMULADO",
    fecha_simulacion: new Date().toISOString().slice(0, 10),
    aprobado_data: null,
    acertividad_global: null,
    created_at: m.created_at,
    updated_at: m.updated_at,
  } as never;
}

/**
 * Construye una vista tipo ExpedienteMaestro a partir de un Expediente del
 * simulador, para alimentar los generadores de documentos jurídicos
 * (Poder Especial, Datos para Contrato) sin requerir que el caso esté
 * vinculado a un Maestro guardado. No persiste ni altera cálculos.
 */
export function expedienteToMaestroLike(exp: Expediente): ExpedienteMaestro {
  const c = exp.cliente_data ?? ({} as Expediente["cliente_data"]);
  const cr = exp.credito_data ?? {};
  // Lectura flexible de datos del caso: cliente_data puede contener campos
  // adicionales (ciudad, email, teléfono, dirección, tipoDocumento) aunque
  // el tipo base ClientData no los liste explícitamente.
  const cAny = c as unknown as Record<string, unknown>;
  const pickStr = (k: string) => (typeof cAny[k] === "string" ? (cAny[k] as string) : "");
  // Información Jurídica persistida en cliente_data (fuente oficial)
  const ij = (cAny.informacionJuridica ?? {}) as {
    titular?: Partial<ClienteMaestro>;
    cotitular?: Partial<CotitularMaestro> & { activo?: boolean };
  };
  const t = ij.titular ?? {};
  const co = ij.cotitular ?? {};
  return {
    id: exp.id,
    asesor_id: exp.asesor_id,
    cedula_cliente: exp.cedula ?? null,
    nombre_cliente: exp.cliente_nombre,
    cliente: {
      ...emptyCliente(),
      // Autocompletado desde Datos del Cliente del expediente
      nombre: c.nombre ?? exp.cliente_nombre ?? "",
      cedula: c.cedula ?? exp.cedula ?? "",
      tipoDocumento: pickStr("tipoDocumento") || "CC",
      ciudad: pickStr("ciudad"),
      email: pickStr("email") || pickStr("correo"),
      telefono: pickStr("telefono") || pickStr("celular"),
      direccion: pickStr("direccion"),
      // Los valores persistidos en Información Jurídica priman
      ...t,
    },
    cotitular: { ...emptyCotitular(), ...co, activo: !!co.activo },
    credito: {
      ...emptyCredito(),
      banco: c.banco ?? exp.banco ?? "",
      numeroCredito: c.numeroCredito ?? exp.numero_credito ?? "",
      tipoProducto: c.tipoProducto ?? exp.producto ?? "",
      plazoOriginal: c.plazoInicial ?? "",
      cuotasPagadas: c.cuotasPagadas ?? "",
      saldoCapital: (cr.saldoCapital as string) ?? "",
      cuotaActual: (cr.cuotaActual as string) ?? "",
      tasa: (cr.tea as string) ?? "",
    },
    fresh: emptyFresh(),
    asesor: { ...emptyAsesor(), nombre: c.asesor ?? "" },
    licenciado: emptyLicenciado(),
    apoderado: emptyApoderado(),
    created_at: exp.created_at,
    updated_at: exp.updated_at,
  };
}


/**
 * Persiste la sección Información Jurídica dentro de `expedientes.cliente_data.informacionJuridica`.
 * Esta es la fuente oficial leída por `expedienteToMaestroLike` y por los generadores
 * de Poder Especial. NO toca campos de simulación ni de propuesta.
 */
export async function saveInformacionJuridicaExpediente(
  expedienteId: string,
  data: {
    titular: Partial<ClienteMaestro>;
    cotitular?: Partial<CotitularMaestro> & { activo?: boolean };
  },
): Promise<void> {
  const { data: row, error: e1 } = await supabase
    .from("expedientes").select("cliente_data").eq("id", expedienteId).single();
  if (e1) throw e1;
  const cd = (row?.cliente_data ?? {}) as Record<string, unknown>;
  const next = { ...cd, informacionJuridica: data };
  const { error: e2 } = await supabase
    .from("expedientes").update({ cliente_data: next as never }).eq("id", expedienteId);
  if (e2) throw e2;
}

