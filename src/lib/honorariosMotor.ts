// Capa de datos del Motor de Honorarios NUVEX (cliente-side, RLS aplica).
import { supabase } from "@/integrations/supabase/client";
import type { ClasificacionMH, ResultadoMotor, TipoCreditoMH } from "./motorHonorarios";

export interface HonorarioCalculoRow {
  id: string;
  expediente_id: string | null;
  cliente_nombre: string;
  cedula: string | null;
  banco: string | null;
  tipo_credito: string;
  plazo_original_meses: number | null;
  saldo_capital: number | null;
  ahorro_intereses: number;
  ahorro_seguros: number;
  ahorro_total: number;
  clasificacion: ClasificacionMH;
  porcentaje_aplicado: number;
  honorario_teorico: number;
  honorario_topado: number;
  alerta_tope: boolean;
  honorario_ofertado: number | null;
  descuento_aplicado_pct: number | null;
  rentabilidad_pct: number | null;
  estado: string;
  notas: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CrearCalculoInput {
  expedienteId?: string | null;
  clienteNombre: string;
  cedula?: string;
  banco?: string;
  tipoCredito: TipoCreditoMH;
  plazoOriginal?: number;
  saldoCapital?: number;
  ahorroIntereses: number;
  ahorroSeguros: number;
  resultado: ResultadoMotor;
  honorarioOfertado?: number;
  notas?: string;
}

export async function crearCalculo(input: CrearCalculoInput): Promise<HonorarioCalculoRow> {
  const r = input.resultado;
  const ofertado = input.honorarioOfertado ?? r.honorarioRecomendado;
  const descuentoPct = r.honorarioRecomendado > 0
    ? Math.max(0, ((r.honorarioRecomendado - ofertado) / r.honorarioRecomendado) * 100)
    : 0;
  const rentabilidad = r.honorarioRecomendado > 0
    ? (ofertado / r.honorarioRecomendado) * 100
    : 0;

  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("honorarios_calculos")
    .insert({
      expediente_id: input.expedienteId ?? null,
      cliente_nombre: input.clienteNombre,
      cedula: input.cedula ?? null,
      banco: input.banco ?? null,
      tipo_credito: input.tipoCredito,
      plazo_original_meses: input.plazoOriginal ?? null,
      saldo_capital: input.saldoCapital ?? 0,
      ahorro_intereses: input.ahorroIntereses,
      ahorro_seguros: input.ahorroSeguros,
      ahorro_total: r.ahorroTotal,
      clasificacion: r.clasificacion,
      porcentaje_aplicado: r.porcentajeAplicado,
      honorario_teorico: r.honorarioTeorico,
      honorario_topado: r.honorarioRecomendado,
      alerta_tope: r.alertaTope !== null,
      honorario_ofertado: ofertado,
      descuento_aplicado_pct: Number(descuentoPct.toFixed(2)),
      rentabilidad_pct: Number(rentabilidad.toFixed(2)),
      estado: "ofertado",
      notas: input.notas ?? null,
      created_by: u.user!.id,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as HonorarioCalculoRow;
}

export async function listarMisCalculos(): Promise<HonorarioCalculoRow[]> {
  const { data, error } = await supabase
    .from("honorarios_calculos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as HonorarioCalculoRow[];
}

export async function actualizarOferta(id: string, honorarioOfertado: number, recomendado: number) {
  const descuentoPct = recomendado > 0 ? Math.max(0, ((recomendado - honorarioOfertado) / recomendado) * 100) : 0;
  const rentabilidad = recomendado > 0 ? (honorarioOfertado / recomendado) * 100 : 0;
  const { error } = await supabase
    .from("honorarios_calculos")
    .update({
      honorario_ofertado: honorarioOfertado,
      descuento_aplicado_pct: Number(descuentoPct.toFixed(2)),
      rentabilidad_pct: Number(rentabilidad.toFixed(2)),
    } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export interface AprobacionRow {
  id: string;
  calculo_id: string;
  solicitado_por: string;
  aprobado_por: string | null;
  decision: "aprobado" | "rechazado" | "contraofertado" | null;
  honorario_recomendado: number;
  honorario_solicitado: number;
  honorario_contraoferta: number | null;
  motivo_solicitud: string;
  comentarios_aprobador: string | null;
  created_at: string;
  decidido_at: string | null;
}

export async function solicitarAprobacion(input: {
  calculoId: string;
  honorarioRecomendado: number;
  honorarioSolicitado: number;
  motivo: string;
}): Promise<AprobacionRow> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("honorarios_aprobaciones")
    .insert({
      calculo_id: input.calculoId,
      solicitado_por: u.user!.id,
      honorario_recomendado: input.honorarioRecomendado,
      honorario_solicitado: input.honorarioSolicitado,
      motivo_solicitud: input.motivo,
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await supabase
    .from("honorarios_calculos")
    .update({ estado: "pendiente_aprobacion" } as never)
    .eq("id", input.calculoId);
  return data as AprobacionRow;
}

export async function listarAprobaciones(): Promise<AprobacionRow[]> {
  const { data, error } = await supabase
    .from("honorarios_aprobaciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as AprobacionRow[];
}

export async function decidirAprobacion(input: {
  aprobacionId: string;
  calculoId: string;
  decision: "aprobado" | "rechazado" | "contraofertado";
  contraoferta?: number;
  comentarios?: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = {
    aprobado_por: u.user!.id,
    decision: input.decision,
    comentarios_aprobador: input.comentarios ?? null,
    decidido_at: new Date().toISOString(),
  };
  if (input.decision === "contraofertado") patch.honorario_contraoferta = input.contraoferta ?? null;
  const { error } = await supabase
    .from("honorarios_aprobaciones")
    .update(patch as never)
    .eq("id", input.aprobacionId);
  if (error) throw new Error(error.message);

  // Estado del cálculo
  const nuevoEstadoCalc =
    input.decision === "aprobado" ? "aprobado"
    : input.decision === "rechazado" ? "rechazado"
    : "contraofertado";
  const updateCalc: Record<string, unknown> = { estado: nuevoEstadoCalc };
  if (input.decision === "contraofertado" && input.contraoferta != null) {
    updateCalc.honorario_ofertado = input.contraoferta;
  }
  await supabase
    .from("honorarios_calculos")
    .update(updateCalc as never)
    .eq("id", input.calculoId);
}
