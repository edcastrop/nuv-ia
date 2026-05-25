import { supabase } from "@/integrations/supabase/client";

export interface Comision {
  id: string;
  expediente_id: string;
  user_id: string;
  rol: string;
  base: number;
  porcentaje: number;
  valor: number;
  honorarios_contratados: number | null;
  recaudado: number;
  comision_potencial: number;
  comision_liberada: number;
  comision_pagada: number;
  estado: "generada" | "pendiente" | "aprobada" | "pagada" | "rechazada";
  cuenta_cobro_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Saldo cobrable: liberado y no pagado, no incluido en CC activa. */
export function saldoDisponibleComision(c: Comision): number {
  if (c.cuenta_cobro_id) return 0;
  return Math.max(0, Number(c.comision_liberada || 0) - Number(c.comision_pagada || 0));
}

/** Saldo pendiente de recaudo (potencial - liberada). */
export function pendienteRecaudoComision(c: Comision): number {
  return Math.max(0, Number(c.comision_potencial || 0) - Number(c.comision_liberada || 0));
}

export interface CuentaCobro {
  id: string;
  numero: string;
  user_id: string;
  total: number;
  estado:
    | "borrador"
    | "enviada"
    | "aprobada"
    | "devuelta_correccion"
    | "rechazada"
    | "programada_pago"
    | "pagada";
  fecha_envio: string | null;
  fecha_aprobacion: string | null;
  fecha_pago: string | null;
  fecha_programada_pago: string | null;
  observaciones: string | null;
  motivo_devolucion: string | null;
  version: number;
  comprobante_url: string | null;
  porcentaje_comision: number | null;
  created_at: string;
  updated_at: string;
}

export const PORCENTAJES_COMISION_CC = [30, 35, 40, 45, 50] as const;
export type PorcentajeComisionCC = typeof PORCENTAJES_COMISION_CC[number];


export async function listMisComisiones(userId: string): Promise<Comision[]> {
  const { data, error } = await supabase
    .from("comisiones" as never)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Comision[];
}

export async function listTodasComisiones(): Promise<Comision[]> {
  const { data, error } = await supabase
    .from("comisiones" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Comision[];
}

export async function listCuentasCobro(opts?: { userId?: string }): Promise<CuentaCobro[]> {
  let q = supabase.from("cuentas_cobro" as never).select("*").order("created_at", { ascending: false });
  if (opts?.userId) q = q.eq("user_id", opts.userId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as CuentaCobro[];
}

export async function getCuentaCobro(id: string): Promise<CuentaCobro | null> {
  const { data } = await supabase.from("cuentas_cobro" as never).select("*").eq("id", id).maybeSingle();
  return (data ?? null) as unknown as CuentaCobro | null;
}

/** Crear cuenta de cobro con las comisiones seleccionadas */
export async function crearCuentaCobro(userId: string, comisionIds: string[], observaciones?: string): Promise<string> {
  if (comisionIds.length === 0) throw new Error("Selecciona al menos una comisión");
  const { data: cc, error } = await supabase
    .from("cuentas_cobro" as never)
    .insert({ user_id: userId, estado: "borrador", observaciones: observaciones ?? null } as never)
    .select("id")
    .single();
  if (error) throw error;
  const ccId = (cc as unknown as { id: string }).id;
  const { error: errUpd } = await supabase
    .from("comisiones" as never)
    .update({ cuenta_cobro_id: ccId, estado: "pendiente" } as never)
    .in("id", comisionIds)
    .is("cuenta_cobro_id", null);
  if (errUpd) throw errUpd;
  await supabase.from("cuentas_cobro_historial" as never).insert({
    cuenta_cobro_id: ccId,
    user_id: userId,
    accion: "creada",
    observacion: `${comisionIds.length} comisiones agrupadas`,
  } as never);
  await supabase.from("finanzas_auditoria" as never).insert({
    entidad: "cuenta_cobro",
    entidad_id: ccId,
    accion: "creada",
    user_id: userId,
    valor_nuevo: { comisiones: comisionIds.length, observaciones: observaciones ?? null },
  } as never);
  return ccId;
}

export async function cambiarEstadoCuenta(
  ccId: string,
  nuevo: CuentaCobro["estado"],
  observacion?: string,
): Promise<void> {
  // Snapshot previo para auditoría
  const { data: prev } = await supabase.from("cuentas_cobro" as never).select("estado").eq("id", ccId).maybeSingle();
  const estadoAnterior = (prev as unknown as { estado: string } | null)?.estado ?? null;

  const patch: Record<string, unknown> = { estado: nuevo };
  if (nuevo === "enviada") patch.fecha_envio = new Date().toISOString();
  if (nuevo === "aprobada") patch.fecha_aprobacion = new Date().toISOString();
  if (nuevo === "pagada") patch.fecha_pago = new Date().toISOString();
  const { error } = await supabase.from("cuentas_cobro" as never).update(patch as never).eq("id", ccId);
  if (error) throw error;

  // Propagar a comisiones
  const estComision =
    nuevo === "aprobada" ? "aprobada" : nuevo === "pagada" ? "pagada" : nuevo === "rechazada" ? "rechazada" : "pendiente";
  await supabase.from("comisiones" as never).update({ estado: estComision } as never).eq("cuenta_cobro_id", ccId);

  const { data: u } = await supabase.auth.getUser();
  await supabase.from("cuentas_cobro_historial" as never).insert({
    cuenta_cobro_id: ccId,
    user_id: u.user?.id ?? null,
    accion: `estado_${nuevo}`,
    observacion: observacion ?? null,
  } as never);
  await supabase.from("finanzas_auditoria" as never).insert({
    entidad: "cuenta_cobro",
    entidad_id: ccId,
    accion: `estado_${nuevo}`,
    user_id: u.user?.id ?? null,
    motivo: observacion ?? null,
    valor_anterior: { estado: estadoAnterior },
    valor_nuevo: { estado: nuevo },
  } as never);
}
