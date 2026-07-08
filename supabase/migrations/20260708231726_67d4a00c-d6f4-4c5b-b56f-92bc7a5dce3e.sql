ALTER TABLE public.qa_auditorias
  ADD COLUMN IF NOT EXISTS auditor_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auditor_override_justificacion text NULL;

COMMENT ON COLUMN public.qa_auditorias.auditor_override IS 'true cuando la auditoría fue aprobada saltando el guardarraíl de score/dictamen mediante override manual del Director Financiero QA o Super Admin.';
COMMENT ON COLUMN public.qa_auditorias.auditor_override_justificacion IS 'Justificación obligatoria (mínimo 20 caracteres) capturada al ejecutar el override manual. Queda como registro auditable de la decisión humana.';