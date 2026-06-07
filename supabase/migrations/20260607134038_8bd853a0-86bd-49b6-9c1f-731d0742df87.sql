-- Permite upsert idempotente del último snapshot de auditoría por expediente
CREATE UNIQUE INDEX IF NOT EXISTS audit_simulaciones_expediente_uniq
  ON public.audit_simulaciones (expediente_id)
  WHERE expediente_id IS NOT NULL;