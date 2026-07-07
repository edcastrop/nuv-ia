CREATE UNIQUE INDEX IF NOT EXISTS expediente_maestro_dedup_future_idx
ON public.expediente_maestro (
  asesor_id,
  regexp_replace(coalesce(cedula_cliente, ''), '\D', '', 'g'),
  lower(trim(coalesce(credito->>'banco', ''))),
  regexp_replace(coalesce(credito->>'numeroCredito', ''), '\D', '', 'g')
)
WHERE created_at >= TIMESTAMPTZ '2026-07-07 15:00:00+00'
  AND nullif(regexp_replace(coalesce(cedula_cliente, ''), '\D', '', 'g'), '') IS NOT NULL
  AND nullif(lower(trim(coalesce(credito->>'banco', ''))), '') IS NOT NULL
  AND nullif(regexp_replace(coalesce(credito->>'numeroCredito', ''), '\D', '', 'g'), '') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS expedientes_dedup_future_idx
ON public.expedientes (
  asesor_id,
  regexp_replace(coalesce(cedula, ''), '\D', '', 'g'),
  lower(trim(coalesce(banco, ''))),
  regexp_replace(coalesce(numero_credito, ''), '\D', '', 'g')
)
WHERE created_at >= TIMESTAMPTZ '2026-07-07 15:00:00+00'
  AND nullif(regexp_replace(coalesce(cedula, ''), '\D', '', 'g'), '') IS NOT NULL
  AND nullif(lower(trim(coalesce(banco, ''))), '') IS NOT NULL
  AND nullif(regexp_replace(coalesce(numero_credito, ''), '\D', '', 'g'), '') IS NOT NULL;