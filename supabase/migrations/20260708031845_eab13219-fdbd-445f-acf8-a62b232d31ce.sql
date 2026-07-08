CREATE OR REPLACE FUNCTION public.promover_qa_a_expediente(_qa_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _qa RECORD;
  _exp_id uuid;
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT id, analista_id, cliente_nombre, banco, producto, expediente_id
    INTO _qa
    FROM public.qa_auditorias
   WHERE id = _qa_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auditoría QA no encontrada';
  END IF;

  -- Validación de propiedad: solo el analista dueño de la QA, o roles
  -- con can_use_qa_ai (super_admin, admin, gerencia, director_financiero_qa)
  -- pueden promoverla a expediente.
  IF _caller <> COALESCE(_qa.analista_id, '00000000-0000-0000-0000-000000000000'::uuid)
     AND NOT public.can_use_qa_ai(_caller) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF _qa.expediente_id IS NOT NULL THEN
    RETURN _qa.expediente_id;
  END IF;

  IF _qa.cliente_nombre IS NULL OR btrim(_qa.cliente_nombre) = '' THEN
    RAISE EXCEPTION 'La auditoría no tiene cliente_nombre; no se puede promover';
  END IF;

  INSERT INTO public.expedientes (
    asesor_id, modo, cliente_nombre, banco, producto,
    estado, qa_auditoria_origen_id
  ) VALUES (
    COALESCE(_qa.analista_id, _caller),
    'pesos',
    _qa.cliente_nombre,
    _qa.banco,
    _qa.producto,
    'SIMULADO',
    _qa.id
  )
  RETURNING id INTO _exp_id;

  UPDATE public.qa_auditorias SET expediente_id = _exp_id WHERE id = _qa.id;

  RETURN _exp_id;
END;
$function$;