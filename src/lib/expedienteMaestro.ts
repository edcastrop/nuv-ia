import { supabase } from "@/integrations/supabase/client";
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
}

export interface CotitularMaestro extends ClienteMaestro {
  activo: boolean;
  parentesco: string;
}

export interface CreditoMaestro {
  banco: string;
  numeroCredito: string;
  tipoProducto: string; // pesos / UVR
  fechaDesembolso: string;
  plazoOriginal: string;
  saldoCapital: string;
  cuotaActual: string;
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
});

export const emptyCotitular = (): CotitularMaestro => ({
  ...emptyCliente(), activo: false, parentesco: "",
});

export const emptyCredito = (): CreditoMaestro => ({
  banco: "", numeroCredito: "", tipoProducto: "", fechaDesembolso: "",
  plazoOriginal: "", saldoCapital: "", cuotaActual: "", tasa: "",
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
