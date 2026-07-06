CREATE OR REPLACE FUNCTION public.link_certified_qa_to_new_expediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extracto_id uuid;
  v_score numeric;
  v_categoria public.qa_categoria;
  v_dictamen public.qa_dictamen;
  v_ejecutado_at timestamptz;
BEGIN
  IF NEW.qa_auditoria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT qa.extracto_id, qa.qa_score, qa.categoria, qa.dictamen, qa.ejecutado_at
    INTO v_extracto_id, v_score, v_categoria, v_dictamen, v_ejecutado_at
  FROM public.qa_auditorias qa
  WHERE qa.id = NEW.qa_auditoria_id
    AND qa.analista_id = NEW.asesor_id
  LIMIT 1;

  UPDATE public.qa_auditorias qa
     SET expediente_id = NEW.id,
         inputs = jsonb_set(coalesce(qa.inputs, '{}'::jsonb), '{expedienteId}', to_jsonb(NEW.id), true)
   WHERE qa.id = NEW.qa_auditoria_id
     AND qa.analista_id = NEW.asesor_id
     AND qa.expediente_id IS NULL;

  IF v_extracto_id IS NOT NULL THEN
    UPDATE public.extractos_lecturas x
       SET expediente_id = NEW.id
     WHERE x.id = v_extracto_id
       AND x.expediente_id IS NULL;
  END IF;

  UPDATE public.expedientes e
     SET qa_score = v_score,
         qa_categoria = v_categoria,
         qa_dictamen = v_dictamen,
         qa_ejecutada_at = coalesce(v_ejecutado_at, now())
   WHERE e.id = NEW.id;

  RETURN NEW;
END;
$$;