import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccionPropuesta = "export" | "whatsapp" | "email";

/**
 * Sella el timestamp + autor de la acción ejecutada sobre la propuesta
 * comercial de un expediente. Cuando `propuesta_exportada_at` y
 * `whatsapp_generado_at` quedan ambos sellados, el pipeline promueve
 * automáticamente el lead a E2.
 */
export const marcarAccionPropuesta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { expedienteId: string; accion: AccionPropuesta }) => {
    if (!data || typeof data !== "object") throw new Error("Payload inválido");
    if (!data.expedienteId) throw new Error("expedienteId requerido");
    if (!["export", "whatsapp", "email"].includes(data.accion)) throw new Error("acción inválida");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const patch: Record<string, string> = {};
    if (data.accion === "export") {
      patch.propuesta_exportada_at = now;
      patch.propuesta_exportada_by = userId;
    } else if (data.accion === "whatsapp") {
      patch.whatsapp_generado_at = now;
      patch.whatsapp_generado_by = userId;
    } else {
      patch.propuesta_email_enviada_at = now;
      patch.propuesta_email_enviada_by = userId;
    }
    const { error } = await supabase
      .from("expedientes")
      .update(patch)
      .eq("id", data.expedienteId);
    if (error) throw new Error(error.message);
    return { ok: true, accion: data.accion, sealed_at: now };
  });

/**
 * Promueve una auditoría QA huérfana a expediente creando la fila
 * correspondiente y enlazándola. Devuelve el `expedienteId` creado
 * (o el existente si la QA ya tenía uno).
 */
export const promoverQaAExpediente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { qaId: string }) => {
    if (!data?.qaId) throw new Error("qaId requerido");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rpc, error } = await supabase.rpc("promover_qa_a_expediente", { _qa_id: data.qaId });
    if (error) throw new Error(error.message);
    return { expedienteId: rpc as unknown as string };
  });
