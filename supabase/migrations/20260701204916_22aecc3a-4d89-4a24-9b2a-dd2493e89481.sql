SELECT public.nuvia_patch_expediente_from_extracto(e.id)
FROM public.expedientes e
WHERE EXISTS (
  SELECT 1 FROM public.extractos_lecturas x WHERE x.expediente_id = e.id
);

WITH latest_qa AS (
  SELECT DISTINCT ON (expediente_id)
    expediente_id,
    id,
    qa_score,
    dictamen,
    categoria,
    COALESCE(ejecutado_at, created_at) AS qa_at
  FROM public.qa_auditorias
  WHERE expediente_id IS NOT NULL
  ORDER BY expediente_id, COALESCE(ejecutado_at, created_at) DESC
)
UPDATE public.expedientes e
SET
  qa_auditoria_id = q.id,
  qa_score = q.qa_score,
  qa_dictamen = q.dictamen,
  qa_categoria = q.categoria,
  qa_ejecutada_at = q.qa_at,
  updated_at = now()
FROM latest_qa q
WHERE e.id = q.expediente_id
  AND (
    e.qa_auditoria_id IS DISTINCT FROM q.id OR
    e.qa_score IS DISTINCT FROM q.qa_score OR
    e.qa_dictamen IS DISTINCT FROM q.dictamen OR
    e.qa_categoria IS DISTINCT FROM q.categoria OR
    e.qa_ejecutada_at IS DISTINCT FROM q.qa_at
  );