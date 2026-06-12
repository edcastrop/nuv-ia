import { supabase } from "@/integrations/supabase/client";

export type QaGuardResult =
  | { ok: true }
  | { ok: false; reason: string; categoria: "rechazado"; score: number | null; auditoriaId: string | null };

/**
 * Consulta las columnas denormalizadas en `expedientes` y devuelve si la
 * última auditoría QA bloquea avanzar el caso. Sólo bloquea cuando la
 * categoría es `rechazado` (QA FAILED). Si nunca se auditó, permite avanzar.
 */
export async function evaluarQaGuard(expedienteId: string): Promise<QaGuardResult> {
  const { data, error } = await supabase
    .from("expedientes")
    .select("qa_categoria,qa_score,qa_auditoria_id")
    .eq("id", expedienteId)
    .maybeSingle();
  if (error || !data) return { ok: true };
  if (data.qa_categoria === "rechazado") {
    return {
      ok: false,
      reason: `El caso debe corregirse antes de continuar. Última auditoría QA falló (score ${Number(data.qa_score ?? 0).toFixed(1)}/100).`,
      categoria: "rechazado",
      score: data.qa_score == null ? null : Number(data.qa_score),
      auditoriaId: data.qa_auditoria_id ?? null,
    };
  }
  return { ok: true };
}

/** Lanza un Error con mensaje claro si el guard bloquea. Útil en handlers. */
export async function requireQaOk(expedienteId: string): Promise<void> {
  const r = await evaluarQaGuard(expedienteId);
  if (!r.ok) throw new Error(r.reason);
}
