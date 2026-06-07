// Persiste el snapshot vigente de auditoría financiera de un expediente
// en la tabla `audit_simulaciones`. Es idempotente (upsert por expediente_id).
import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaInput, AuditoriaResultado } from "@/lib/auditEngine";

export async function persistirAuditoriaSimulacion(
  expedienteId: string | undefined,
  input: AuditoriaInput,
  resultado: AuditoriaResultado,
): Promise<void> {
  if (!expedienteId) return;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  const motivoEscalamiento =
    resultado.clasificacion.factores.length > 0
      ? resultado.clasificacion.factores.join(" | ").slice(0, 500)
      : null;

  const nivelRiesgo: "apto" | "revisar" | "escalar" =
    resultado.clasificacion.requiereRevision
      ? "escalar"
      : resultado.score.total >= 95
        ? "apto"
        : resultado.score.total >= 85
          ? "revisar"
          : "escalar";



  const payload = {
    analista_id: u.user.id,
    expediente_id: expedienteId,
    banco: input.analista?.banco ?? input.extracto?.banco ?? null,
    producto: input.analista?.producto ?? input.extracto?.producto ?? null,
    tipo_credito: null as string | null,
    moneda: input.moneda,
    datos_extracto: (input.extracto ?? {}) as unknown as never,
    datos_analista: (input.analista ?? {}) as unknown as never,
    datos_propuesta: (input.propuesta ?? {}) as unknown as never,
    inconsistencias: resultado.inconsistencias as unknown as never,
    score_extracto: Math.round(resultado.score.extracto),
    score_matematico: Math.round(resultado.score.matematica),
    score_campos: Math.round(resultado.score.campos),
    score_documental: Math.round(resultado.score.documental),
    score_total: Math.round(resultado.score.total),
    nivel_riesgo: nivelRiesgo,
    requiere_revision: resultado.clasificacion.requiereRevision,
    motivo_escalamiento: motivoEscalamiento,
  };

  await supabase
    .from("audit_simulaciones" as never)
    .upsert(payload as never, { onConflict: "expediente_id" } as never);
}
