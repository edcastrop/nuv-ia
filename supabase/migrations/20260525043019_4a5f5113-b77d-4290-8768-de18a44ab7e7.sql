ALTER TABLE public.cuentas_cobro
  ADD COLUMN IF NOT EXISTS motivo_devolucion text,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fecha_programada_pago date;