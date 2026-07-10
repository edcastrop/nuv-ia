
ALTER TABLE public.envios_contratacion
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS envios_contratacion_idempotency_key_uidx
  ON public.envios_contratacion(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS envios_contratacion_expediente_inflight_uidx
  ON public.envios_contratacion(expediente_id)
  WHERE estado_envio = 'preparando';
