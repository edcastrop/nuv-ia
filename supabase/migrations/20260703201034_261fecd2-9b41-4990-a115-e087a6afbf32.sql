
-- Escalación del simulador → Cola de Revisión NUVIA QA AI
-- Extiende qa_auditorias para soportar auditorías "huérfanas" (sin expediente)
-- que nacen cuando el analista escala una simulación al Director Financiero.

ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'extracto',
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS producto text,
  ADD COLUMN IF NOT EXISTS cliente_nombre text,
  ADD COLUMN IF NOT EXISTS notas_analista_al_auditor text,
  ADD COLUMN IF NOT EXISTS simulador_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS extracto_archivo jsonb,
  ADD COLUMN IF NOT EXISTS devuelto_al_analista_at timestamptz,
  ADD COLUMN IF NOT EXISTS devuelto_al_analista_by uuid,
  ADD COLUMN IF NOT EXISTS devolucion_notas text,
  ADD COLUMN IF NOT EXISTS devolucion_ajustes jsonb;

-- Check de valores válidos para origen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'qa_auditorias_origen_check'
  ) THEN
    ALTER TABLE public.qa_auditorias
      ADD CONSTRAINT qa_auditorias_origen_check
      CHECK (origen IN ('extracto','simulador_escalado'));
  END IF;
END $$;

-- Índice para la bandeja del analista (mis simulaciones escaladas)
CREATE INDEX IF NOT EXISTS idx_qa_auditorias_origen_analista
  ON public.qa_auditorias (origen, analista_id, created_at DESC);
