// Cliente para crear/leer/actualizar la entrega documental por banco.
// Se invoca después de marcar "radicado en banco" para programar la entrega
// (correo inmediato / física inmediata / física diferida en días hábiles).

import { supabase } from "@/integrations/supabase/client";
import { sumarDiasHabiles } from "@/lib/diasHabiles";
import { getReglaEntrega, type ModalidadEntrega } from "@/lib/reglasEntregaBanco";

export type EstadoEntrega =
  | "pendiente"
  | "programada"
  | "enviada_correo"
  | "entregada_fisica"
  | "no_aplica";

export interface EntregaDocumentalRow {
  id: string;
  expediente_id: string;
  banco: string;
  modalidad: ModalidadEntrega;
  estado: EstadoEntrega;
  fecha_programada: string | null;
  fecha_completada: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export async function leerEntrega(expedienteId: string): Promise<EntregaDocumentalRow | null> {
  const { data, error } = await supabase
    .from("expediente_entrega_documental" as never)
    .select("*")
    .eq("expediente_id", expedienteId)
    .maybeSingle();
  if (error) {
    console.warn("[entregaDocumental] read", error);
    return null;
  }
  return (data as unknown as EntregaDocumentalRow) ?? null;
}

/**
 * Crea (o actualiza) la fila de entrega en función de la regla del banco.
 * Idempotente: si ya existe no la sobreescribe (salvo `force`).
 */
export async function programarEntregaDesdeBanco(opts: {
  expedienteId: string;
  banco: string | null | undefined;
  force?: boolean;
}): Promise<EntregaDocumentalRow | null> {
  const { expedienteId, banco, force } = opts;
  const regla = getReglaEntrega(banco);

  if (!force) {
    const existente = await leerEntrega(expedienteId);
    if (existente) return existente;
  }

  let estado: EstadoEntrega;
  let fechaProgramada: string | null = null;
  let fechaCompletada: string | null = null;

  if (regla.modalidad === "ninguna") {
    estado = "no_aplica";
  } else if (regla.modalidad === "correo") {
    estado = "pendiente"; // disparo manual desde el botón
  } else if (regla.modalidad === "fisica") {
    if (regla.diasHabilesEntrega === 0) {
      // Bogotá: entregada en el mismo acto
      estado = "entregada_fisica";
      fechaCompletada = new Date().toISOString();
    } else {
      estado = "programada";
      fechaProgramada = sumarDiasHabiles(new Date(), regla.diasHabilesEntrega).toISOString();
    }
  } else {
    estado = "pendiente";
  }

  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const payload = {
    expediente_id: expedienteId,
    banco: regla.bancoLabel,
    modalidad: regla.modalidad,
    estado,
    fecha_programada: fechaProgramada,
    fecha_completada: fechaCompletada,
    creado_por: userId,
  };

  const { data, error } = await supabase
    .from("expediente_entrega_documental" as never)
    .upsert(payload as never, { onConflict: "expediente_id" })
    .select("*")
    .single();

  if (error) {
    console.error("[entregaDocumental] upsert", error);
    throw error;
  }
  return data as unknown as EntregaDocumentalRow;
}

export async function marcarEntregaCompletada(opts: {
  expedienteId: string;
  estado: "enviada_correo" | "entregada_fisica";
  notas?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("expediente_entrega_documental" as never)
    .update({
      estado: opts.estado,
      fecha_completada: new Date().toISOString(),
      notas: opts.notas ?? null,
    } as never)
    .eq("expediente_id", opts.expedienteId);
  if (error) throw error;

  await supabase.from("expediente_historial").insert({
    expediente_id: opts.expedienteId,
    nota:
      opts.estado === "enviada_correo"
        ? `📧 Documentación financiera enviada por correo al banco.${opts.notas ? " — " + opts.notas : ""}`
        : `📦 Documentación financiera entregada físicamente al banco.${opts.notas ? " — " + opts.notas : ""}`,
  });
}
