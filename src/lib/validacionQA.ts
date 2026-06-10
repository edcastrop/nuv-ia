import { supabase } from "@/integrations/supabase/client";
import { notifQAAprobada, notifQADevuelta, notifQASolicitada } from "@/lib/notifTriggers";
import { cambiarEstadoCaso } from "@/lib/casoEstados";

export type MotivoDevolucionQA =
  | "cuota_incorrecta"
  | "fresh_incorrecto"
  | "ocr_incorrecto"
  | "honorarios_incorrectos"
  | "error_financiero"
  | "error_digitacion"
  | "otro";

export const MOTIVOS_QA: { value: MotivoDevolucionQA; label: string }[] = [
  { value: "cuota_incorrecta", label: "Cuota incorrecta" },
  { value: "fresh_incorrecto", label: "Fresh incorrecto" },
  { value: "ocr_incorrecto", label: "OCR incorrecto" },
  { value: "honorarios_incorrectos", label: "Honorarios incorrectos" },
  { value: "error_financiero", label: "Error financiero" },
  { value: "error_digitacion", label: "Error de digitación" },
  { value: "otro", label: "Otro" },
];

export interface ValidacionQA {
  id: string;
  expediente_id: string;
  solicitada_por: string;
  solicitada_at: string;
  validada_por: string | null;
  validada_at: string | null;
  resultado: "aprobada" | "devuelta" | null;
  motivo: MotivoDevolucionQA | null;
  observacion: string | null;
  tiempo_validacion_min: number | null;
  primera_revision: boolean;
  created_at: string;
}

export async function enviarAValidacionQA(expedienteId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  // Detectar si es primera revisión (no hay validaciones anteriores)
  const { count } = await supabase
    .from("validaciones_qa" as never)
    .select("id", { count: "exact", head: true })
    .eq("expediente_id", expedienteId);
  const primera = (count ?? 0) === 0;
  const { error } = await supabase.from("validaciones_qa" as never).insert({
    expediente_id: expedienteId,
    solicitada_por: u.user.id,
    primera_revision: primera,
  } as never);
  if (error) throw new Error(error.message);
  // Disparador: avisar a Directores QA + super_admin
  await notifQASolicitada(expedienteId);
}

export async function aprobarQA(validacionId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");

  // Recuperar la validación para obtener el expediente y poder snapshotear
  const { data: vRow } = await supabase
    .from("validaciones_qa" as never)
    .select("expediente_id")
    .eq("id", validacionId)
    .maybeSingle();
  const expedienteId = (vRow as { expediente_id?: string } | null)?.expediente_id ?? null;

  const { error } = await supabase
    .from("validaciones_qa" as never)
    .update({
      resultado: "aprobada",
      validada_por: u.user.id,
      validada_at: new Date().toISOString(),
    } as never)
    .eq("id", validacionId);
  if (error) throw new Error(error.message);

  // Snapshot inmutable: congela la propuesta aprobada en aprobado_data
  if (expedienteId) {
    const { data: exp } = await supabase
      .from("expedientes")
      .select(
        "propuesta_data, credito_data, cliente_data, honorarios_final, descuento, banco, producto, numero_credito",
      )
      .eq("id", expedienteId)
      .maybeSingle();
    if (exp) {
      const snapshot = {
        fechaAprobacion: new Date().toISOString(),
        aprobadoPor: u.user.id,
        validacionId,
        propuesta: (exp as Record<string, unknown>).propuesta_data ?? null,
        credito: (exp as Record<string, unknown>).credito_data ?? null,
        cliente: (exp as Record<string, unknown>).cliente_data ?? null,
        honorariosFinal: (exp as Record<string, unknown>).honorarios_final ?? null,
        descuento: (exp as Record<string, unknown>).descuento ?? null,
        banco: (exp as Record<string, unknown>).banco ?? null,
        producto: (exp as Record<string, unknown>).producto ?? null,
        numeroCredito: (exp as Record<string, unknown>).numero_credito ?? null,
      };
      await supabase
        .from("expedientes")
        .update({ aprobado_data: snapshot as unknown as never })
        .eq("id", expedienteId);
    }
    // Disparador: notificar a asesor + jurídica
    await notifQAAprobada(expedienteId);
  }
}


export async function devolverQA(
  validacionId: string,
  motivo: MotivoDevolucionQA,
  observacion: string,
): Promise<void> {
  if (!observacion.trim()) throw new Error("La observación es obligatoria");
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("No autenticado");
  const { data: vRow } = await supabase
    .from("validaciones_qa" as never)
    .select("expediente_id")
    .eq("id", validacionId)
    .maybeSingle();
  const expedienteId = (vRow as { expediente_id?: string } | null)?.expediente_id ?? null;

  const { error } = await supabase
    .from("validaciones_qa" as never)
    .update({
      resultado: "devuelta",
      motivo,
      observacion: observacion.trim(),
      validada_por: u.user.id,
      validada_at: new Date().toISOString(),
    } as never)
    .eq("id", validacionId);
  if (error) throw new Error(error.message);
  if (expedienteId) await notifQADevuelta(expedienteId, motivo, observacion.trim());
}

export async function obtenerUltimaValidacion(
  expedienteId: string,
): Promise<ValidacionQA | null> {
  const { data } = await supabase
    .from("validaciones_qa" as never)
    .select("*")
    .eq("expediente_id", expedienteId)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data as unknown as ValidacionQA[] | null)?.[0] ?? null;
}

export async function listValidacionesPendientes(): Promise<ValidacionQA[]> {
  const { data, error } = await supabase
    .from("validaciones_qa" as never)
    .select("*")
    .is("resultado", null)
    .order("solicitada_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as unknown as ValidacionQA[]) ?? [];
}

export async function listValidaciones(limit = 200): Promise<ValidacionQA[]> {
  const { data, error } = await supabase
    .from("validaciones_qa" as never)
    .select("*")
    .order("solicitada_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as ValidacionQA[]) ?? [];
}
