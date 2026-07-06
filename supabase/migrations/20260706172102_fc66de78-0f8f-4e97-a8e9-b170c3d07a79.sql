CREATE OR REPLACE FUNCTION public.link_certified_qa_to_new_expediente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_extracto_id uuid;
BEGIN
  IF NEW.qa_auditoria_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT qa.extracto_id
    INTO v_extracto_id
  FROM public.qa_auditorias qa
  WHERE qa.id = NEW.qa_auditoria_id
    AND qa.analista_id = NEW.asesor_id
    AND qa.expediente_id IS NULL
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_certified_qa_to_new_expediente ON public.expedientes;
CREATE TRIGGER trg_link_certified_qa_to_new_expediente
AFTER INSERT ON public.expedientes
FOR EACH ROW
EXECUTE FUNCTION public.link_certified_qa_to_new_expediente();