UPDATE public.expedientes e
SET
  banco = p.banco,
  cliente_data = jsonb_set(COALESCE(cliente_data, '{}'::jsonb), '{banco}', to_jsonb(p.banco))
FROM (SELECT DISTINCT banco FROM public.productos_bancarios) p
WHERE e.banco IS NOT NULL
  AND lower(e.banco) = lower(p.banco)
  AND e.banco <> p.banco;

UPDATE public.expedientes
SET
  cedula = NULL,
  cliente_data = CASE
    WHEN cliente_data ? 'cedula' THEN jsonb_set(cliente_data, '{cedula}', '""'::jsonb)
    ELSE cliente_data
  END
WHERE cedula ~ '^0+$';