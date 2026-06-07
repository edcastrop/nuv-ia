
ALTER TABLE public.analista_metricas
  ADD COLUMN IF NOT EXISTS precision_cuota numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precision_plazo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS precision_ahorro numeric NOT NULL DEFAULT 0;

ALTER TABLE public.expedientes
  ADD COLUMN IF NOT EXISTS aceptacion_cliente_at timestamptz,
  ADD COLUMN IF NOT EXISTS aceptacion_medio text,
  ADD COLUMN IF NOT EXISTS aceptacion_observaciones text;
