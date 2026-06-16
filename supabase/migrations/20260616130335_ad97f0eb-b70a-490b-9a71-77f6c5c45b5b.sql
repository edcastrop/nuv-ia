
CREATE OR REPLACE FUNCTION public.can_access_expediente(_uid uuid, _exp uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT has_role(_uid,'super_admin'::app_role)
      OR has_role(_uid,'admin'::app_role)
      OR has_role(_uid,'gerencia'::app_role)
      OR has_role(_uid,'director_financiero_qa'::app_role)
      OR has_role(_uid,'director_juridico'::app_role)
      OR has_role(_uid,'operaciones'::app_role)
      OR has_role(_uid,'juridica'::app_role)
      OR has_role(_uid,'licenciado'::app_role)
      OR has_role(_uid,'contabilidad'::app_role)
      OR has_role(_uid,'cartera'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.expedientes e
        WHERE e.id = _exp AND e.asesor_id = _uid
      );
$function$;
