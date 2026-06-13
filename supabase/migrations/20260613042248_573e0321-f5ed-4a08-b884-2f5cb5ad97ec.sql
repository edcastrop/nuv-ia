
ALTER TABLE public.expediente_proyecciones
  ADD COLUMN IF NOT EXISTS momento TEXT NOT NULL DEFAULT 'auditoria'
  CHECK (momento IN ('auditoria','cierre'));

CREATE INDEX IF NOT EXISTS idx_exp_proyecciones_expediente_momento
  ON public.expediente_proyecciones(expediente_id, momento, created_at DESC);

ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS verificacion_cierre JSONB NULL;
