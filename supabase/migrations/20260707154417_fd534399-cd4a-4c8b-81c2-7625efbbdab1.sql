UPDATE public.extractos_lecturas x
SET
  archivo_path = e.credito_data ->> 'archivoPath',
  archivo_nombre = COALESCE(
    x.archivo_nombre,
    regexp_replace(e.credito_data ->> 'archivoPath', '^.*/', '')
  )
FROM public.expedientes e
WHERE x.expediente_id = e.id
  AND COALESCE(x.archivo_path, '') = ''
  AND COALESCE(e.credito_data ->> 'archivoPath', '') <> '';

INSERT INTO public.expediente_soportes (
  expediente_id,
  categoria,
  subcategoria,
  archivo_nombre,
  archivo_path,
  mime_type,
  size_bytes,
  estado_relacionado,
  user_id
)
SELECT
  e.id,
  'extracto_banco',
  'extracto_credito',
  COALESCE(NULLIF(regexp_replace(e.credito_data ->> 'archivoPath', '^.*/', ''), ''), 'extracto_credito.pdf'),
  e.credito_data ->> 'archivoPath',
  'application/pdf',
  NULL,
  COALESCE(e.estado_caso::text, e.estado::text),
  e.asesor_id
FROM public.expedientes e
WHERE COALESCE(e.credito_data ->> 'archivoPath', '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.expediente_soportes s
    WHERE s.expediente_id = e.id
      AND s.archivo_path = e.credito_data ->> 'archivoPath'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.expediente_soportes s
    WHERE s.expediente_id = e.id
      AND (
        lower(COALESCE(s.categoria, '')) LIKE '%extracto%'
        OR lower(COALESCE(s.subcategoria, '')) LIKE '%extracto%'
        OR lower(COALESCE(s.archivo_nombre, '')) LIKE '%extracto%'
      )
  );