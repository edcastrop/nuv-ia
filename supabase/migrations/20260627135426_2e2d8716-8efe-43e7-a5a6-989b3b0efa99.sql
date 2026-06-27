ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS auditor_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS auditor_score_anterior numeric;