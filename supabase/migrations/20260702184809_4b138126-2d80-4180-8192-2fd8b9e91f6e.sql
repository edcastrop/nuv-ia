UPDATE public.expedientes
SET discount_data = jsonb_set(discount_data::jsonb, '{vigencia}', '""'::jsonb, false)
WHERE discount_data ? 'vigencia'
  AND lower(trim(discount_data->>'vigencia')) IN (
    '12h','12 h','12 horas','24h','24 h','24 horas','48h','48 h','48 horas'
  );