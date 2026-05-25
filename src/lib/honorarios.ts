// Recálculo de honorarios a éxito (regla de 3) — Fase 1
import { supabase } from "@/integrations/supabase/client";

export interface RecalculoHonorarios {
  cuotasPactadas: number;
  cuotasAprobadasBanco: number;
  honorariosPactados: number;
  honorariosRecalculados: number;
  diferencia: number;
  huboRecalculo: boolean;
}

export function calcularRecalculoHonorarios(
  cuotasPactadas: number,
  cuotasAprobadasBanco: number,
  honorariosPactados: number,
): RecalculoHonorarios {
  const cp = Math.max(0, Math.floor(cuotasPactadas || 0));
  const ca = Math.max(0, Math.floor(cuotasAprobadasBanco || 0));
  const hp = Math.max(0, honorariosPactados || 0);

  if (cp <= 0 || hp <= 0 || ca <= 0) {
    return {
      cuotasPactadas: cp,
      cuotasAprobadasBanco: ca,
      honorariosPactados: hp,
      honorariosRecalculados: hp,
      diferencia: 0,
      huboRecalculo: false,
    };
  }

  let recalc: number;
  if (ca === cp) recalc = hp;
  else if (ca < cp) recalc = Math.round((hp / cp) * ca);
  else recalc = hp; // ca > cp: mantener pactados

  if (recalc < 0) recalc = 0;

  return {
    cuotasPactadas: cp,
    cuotasAprobadasBanco: ca,
    honorariosPactados: hp,
    honorariosRecalculados: recalc,
    diferencia: hp - recalc,
    huboRecalculo: ca !== cp && recalc !== hp,
  };
}

export async function guardarRecalculoHonorarios(
  expedienteId: string,
  cuotasPactadas: number,
  cuotasAprobadasBanco: number,
  honorariosPactados: number,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  // Snapshot anterior
  const { data: prev } = await supabase
    .from("expedientes")
    .select("cuotas_pactadas, cuotas_aprobadas_banco, honorarios_pactados, honorarios_recalculados")
    .eq("id", expedienteId)
    .maybeSingle();
  const { error } = await supabase
    .from("expedientes")
    .update({
      cuotas_pactadas: cuotasPactadas,
      cuotas_aprobadas_banco: cuotasAprobadasBanco,
      honorarios_pactados: honorariosPactados,
      recalculo_user_id: u.user?.id ?? null,
      recalculo_at: new Date().toISOString(),
    } as never)
    .eq("id", expedienteId);
  if (error) throw new Error(error.message);

  await supabase.from("finanzas_auditoria" as never).insert({
    entidad: "expediente",
    entidad_id: expedienteId,
    accion: "recalculo_honorarios",
    user_id: u.user?.id ?? null,
    valor_anterior: prev ?? null,
    valor_nuevo: {
      cuotas_pactadas: cuotasPactadas,
      cuotas_aprobadas_banco: cuotasAprobadasBanco,
      honorarios_pactados: honorariosPactados,
    },
  } as never);
}
