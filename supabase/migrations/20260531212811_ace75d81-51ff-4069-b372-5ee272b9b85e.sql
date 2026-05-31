ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS radicado_id_banco text,
  ADD COLUMN IF NOT EXISTS radicado_fecha timestamptz;

CREATE INDEX IF NOT EXISTS idx_expedientes_radicado_id_banco
  ON public.expedientes (radicado_id_banco)
  WHERE radicado_id_banco IS NOT NULL;